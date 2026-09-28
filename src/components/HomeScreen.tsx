import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Bell, 
  Calendar, 
  MapPin, 
  AlertTriangle, 
  AlertCircle, 
  Database, 
  X, 
  ChevronRight, 
  ChevronDown, 
  Coffee, 
  Cake, 
  Package, 
  CheckCircle2, 
  Loader2,
  Building
} from 'lucide-react';
import { Ingredient, StockRecord, Branch, AppPermissions } from '../types';
import { UserRole } from './LoginForm';

export interface HomeScreenProps {
  user: {
    name: string;
    role: UserRole;
    permissions?: AppPermissions;
    branch?: Branch;
  };
  ingredients: Ingredient[];
  stockRecord: StockRecord;
  onNavigate: (tab: any) => void;
  onLogout: () => void;
  dbStatus: 'connected' | 'checking' | 'offline';
  onChangeBranch?: (branch: Branch) => void;
  hasPermission?: (funcId: keyof AppPermissions) => boolean;
}

export function HomeScreen({
  user,
  ingredients,
  stockRecord,
  onNavigate,
  onLogout,
  dbStatus,
  onChangeBranch,
  hasPermission = () => true
}: HomeScreenProps) {
  // Filters
  const [timeFilter, setTimeFilter] = useState<'thisMonth' | 'thisWeek' | 'all'>('thisMonth');
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  
  // Location Filter State: "all" (ทั้งหมด) | "bar" (บาร์) | "kitchen" (ครัว)
  const [locationFilter, setLocationFilter] = useState<'all' | 'bar' | 'kitchen'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('crenn_location_filter');
        if (saved === 'bar' || saved === 'kitchen' || saved === 'all') {
          return saved;
        }
      } catch {
        // ignore
      }
    }
    return 'all';
  });
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Sync locationFilter with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('crenn_location_filter', locationFilter);
    } catch {
      // ignore
    }
  }, [locationFilter]);

  // Click outside listener for filter bar
  const filterBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(event.target as Node)) {
        setShowTimeDropdown(false);
        setShowBranchDropdown(false);
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Modals & Popups
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);

  // Filter ingredients by location:
  // "all": all ingredients
  // "bar": department === 'Bar' OR location === 'bar' OR category includes bar-related
  // "kitchen": department in ('Kitchen', 'Bakery') OR location in ('kitchen', 'bakery') OR category includes kitchen/bakery/packaging/cleaning
  const filteredIngredients = useMemo(() => {
    if (locationFilter === 'all') return ingredients;
    return ingredients.filter(ing => {
      const dept = (ing.department || '').toLowerCase();
      const loc = ((ing as any).location || '').toLowerCase();
      const cat = (ing.category || '').toLowerCase();
      const name = (ing.name || '').toLowerCase();
      const id = ing.id || '';

      if (locationFilter === 'bar') {
        return (
          dept === 'bar' ||
          loc === 'bar' ||
          cat.includes('bar') ||
          cat === 'coffee' ||
          cat.includes('milk') ||
          cat.includes('dairy') ||
          cat.includes('syrup') ||
          cat.includes('powder') ||
          cat.includes('tea') ||
          name.includes('coffee') ||
          name.includes('syrup')
        );
      }

      if (locationFilter === 'kitchen') {
        return (
          dept === 'kitchen' ||
          dept === 'bakery' ||
          loc === 'kitchen' ||
          loc === 'bakery' ||
          cat.includes('kitchen') ||
          cat.includes('bakery') ||
          cat.includes('บรรจุภัณฑ์') ||
          cat.includes('ทำความสะอาด') ||
          cat.includes('cleaning') ||
          cat.includes('packaging') ||
          cat.includes('food') ||
          id.startsWith('b-')
        );
      }

      return true;
    });
  }, [ingredients, locationFilter]);

  // Labels for current location selection
  const locationLabel = useMemo(() => {
    if (locationFilter === 'bar') return 'วัตถุดิบบาร์';
    if (locationFilter === 'kitchen') return 'วัตถุดิบครัว';
    return 'วัตถุดิบทั้งหมด';
  }, [locationFilter]);

  const locationSubtitle = useMemo(() => {
    if (locationFilter === 'bar') return 'สรุปสถานะสต็อกบาร์';
    if (locationFilter === 'kitchen') return 'สรุปสถานะสต็อกครัว';
    return 'สรุปสถานะสต็อกทั้งหมด';
  }, [locationFilter]);

  // Calculate current stock levels for filtered ingredients
  const stockData = useMemo(() => {
    const stockMap: Record<string, number> = {};
    const sortedDatesAsc = Object.keys(stockRecord).sort();

    sortedDatesAsc.forEach(dateKey => {
      filteredIngredients.forEach(ing => {
        const val = stockRecord[dateKey]?.[ing.id];
        if (typeof val === 'number') {
          stockMap[ing.id] = val;
        } else if (val) {
          const explicitRemaining = val.remaining;
          if (explicitRemaining !== undefined && explicitRemaining !== null) {
            stockMap[ing.id] = explicitRemaining;
          } else {
            const prev = stockMap[ing.id] || 0;
            const added = val.in || 0;
            const removed = val.out || 0;
            stockMap[ing.id] = prev + added - removed;
          }
        }
      });
    });

    const outOfStockList: Array<{ ing: Ingredient; remaining: number }> = [];
    const lowStockList: Array<{ ing: Ingredient; remaining: number }> = [];
    const goodStockList: Array<{ ing: Ingredient; remaining: number }> = [];

    filteredIngredients.forEach(ing => {
      const remaining = stockMap[ing.id] ?? 0;
      if (remaining <= 0) {
        outOfStockList.push({ ing, remaining });
      } else if (remaining <= ing.minStock) {
        lowStockList.push({ ing, remaining });
      } else {
        goodStockList.push({ ing, remaining });
      }
    });

    const total = filteredIngredients.length;
    const outCount = outOfStockList.length;
    const lowCount = lowStockList.length;
    const goodCount = goodStockList.length;

    // Critical items (Out of stock first, then lowest remaining/minStock ratio)
    const criticalList = [...outOfStockList, ...lowStockList].slice(0, 8);

    return {
      total,
      outCount,
      lowCount,
      goodCount,
      criticalList,
      stockMap
    };
  }, [filteredIngredients, stockRecord]);

  // Donut chart calculations
  const chartValues = useMemo(() => {
    const total = stockData.total || 1;
    const goodPct = Math.round((stockData.goodCount / total) * 100);
    const lowPct = Math.round((stockData.lowCount / total) * 100);
    const outPct = 100 - goodPct - lowPct;

    const r = 40;
    const circumference = 2 * Math.PI * r;

    const goodLen = (stockData.goodCount / total) * circumference;
    const lowLen = (stockData.lowCount / total) * circumference;
    const outLen = (stockData.outCount / total) * circumference;

    const goodOffset = 0;
    const lowOffset = -goodLen;
    const outOffset = -(goodLen + lowLen);

    return {
      circumference,
      goodLen,
      lowLen,
      outLen,
      goodOffset,
      lowOffset,
      outOffset,
      goodPct,
      lowPct,
      outPct: Math.max(0, outPct)
    };
  }, [stockData]);

  return (
    <div className="min-h-screen bg-[#F4F8F7] text-slate-800 pb-28 font-sans">
      
      {/* 1. TOP BAR: CRENN + 🔔 + avatar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#D4E4E3] shadow-xs px-4 py-3">
        <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto flex items-center justify-between">
          
          {/* Brand Name CRENN */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onNavigate('home')}
              className="text-left group focus:outline-none"
            >
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-[0.22em] uppercase leading-none font-sans">
                CRENN
              </h1>
              <p className="text-[9px] text-[#5A8A88] font-bold tracking-widest uppercase mt-0.5">
                Cafe Management
              </p>
            </button>
          </div>

          {/* Right Action Icons: Notification Bell + User Avatar */}
          <div className="flex items-center gap-2.5">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-9 h-9 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] text-[#5A8A88] flex items-center justify-center transition-colors relative focus:outline-none shadow-xs"
                title="การแจ้งเตือน"
              >
                <Bell size={18} />
                {stockData.outCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-pulse"></span>
                )}
              </button>

              {/* Notification Popup */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[#D4E4E3] p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800">การแจ้งเตือนสต็อก (Alerts)</span>
                    <button 
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto text-xs">
                    {stockData.outCount > 0 ? (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                        <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">สินค้าหมดสต็อก {stockData.outCount} รายการ</p>
                          <p className="text-[11px] text-rose-600 mt-0.5">กรุณาตรวจสอบและสั่งซื้อด่วน</p>
                        </div>
                      </div>
                    ) : null}

                    {stockData.lowCount > 0 ? (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">สินค้าใกล้หมด {stockData.lowCount} รายการ</p>
                          <p className="text-[11px] text-amber-600 mt-0.5">ต่ำกว่าเกณฑ์ขั้นต่ำที่กำหนด</p>
                        </div>
                      </div>
                    ) : null}

                    <div className="p-2.5 rounded-xl bg-[#E8F3F2] border border-[#D4E4E3] text-[#476E6C] flex items-start gap-2">
                      <Database size={15} className="text-[#5A8A88] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">ระบบออนไลน์ (Supabase)</p>
                        <p className="text-[11px] text-[#5A8A88] mt-0.5">เชื่อมต่อฐานข้อมูลเรียบร้อยแล้ว</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Avatar Circle */}
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 p-1 pr-2.5 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#D4E4E3] transition-colors focus:outline-none"
              title="โปรไฟล์ผู้ใช้"
            >
              <div className="w-7 h-7 rounded-full bg-[#5A8A88] text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                {user.name.charAt(0)}
              </div>
              <span className="text-xs font-semibold text-[#476E6C] max-w-[70px] truncate hidden sm:inline-block">
                {user.name}
              </span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 space-y-4 md:space-y-6">
        
        {/* 2. GREETING + "Inventory Dashboard" TITLE */}
        <section className="bg-gradient-to-r from-white to-[#EAF2F1] rounded-2xl p-4 md:p-5 border border-[#D4E4E3] shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#5A8A88] font-medium flex items-center gap-1.5">
                <span>👋 สวัสดี,</span>
                <span className="font-bold text-slate-800">{user.name}</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-[#5A8A88]/15 text-[#5A8A88]">
                  {user.role}
                </span>
              </p>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight mt-1">
                Inventory Dashboard
              </h2>
              {/* Filter context subtitle */}
              <p className="text-xs md:text-sm text-[#6B8F8E] font-medium mt-1">
                {locationSubtitle}
              </p>
            </div>
            <div className="w-11 h-11 md:w-13 md:h-13 rounded-2xl bg-white border border-[#D4E4E3] flex items-center justify-center text-[#5A8A88] shadow-xs">
              <Package size={24} />
            </div>
          </div>
        </section>

        {/* 3. FILTER BAR: [📅 เดือนนี้ ▼]  [📍 สาขา ▼]  [🏪 ทั้งหมด ▼] */}
        <section ref={filterBarRef} className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          {/* Filter 1: Time Filter */}
          <div className="relative flex-1 min-w-[110px]">
            <button
              onClick={() => {
                setShowTimeDropdown(!showTimeDropdown);
                setShowBranchDropdown(false);
                setShowLocationDropdown(false);
              }}
              className="w-full flex items-center justify-between px-3.5 sm:px-4 py-2 rounded-full bg-white border border-[#D4E4E3] text-[13px] sm:text-sm font-semibold text-[#2D4A49] hover:bg-[#F0F5F4] transition-colors shadow-xs"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Calendar size={14} className="text-[#5A8A88] shrink-0" />
                <span className="truncate">
                  {timeFilter === 'thisMonth' ? 'เดือนนี้' : timeFilter === 'thisWeek' ? 'สัปดาห์นี้' : 'ทั้งหมด'}
                </span>
              </div>
              <ChevronDown size={14} className="text-[#6B8F8E] shrink-0 ml-1" />
            </button>

            {showTimeDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-[#D4E4E3] py-1.5 z-30 text-xs">
                <button
                  onClick={() => { setTimeFilter('thisMonth'); setShowTimeDropdown(false); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#E8F3F2] flex items-center justify-between font-medium"
                >
                  <span>เดือนนี้ (This Month)</span>
                  {timeFilter === 'thisMonth' && <CheckCircle2 size={13} className="text-[#5A8A88]" />}
                </button>
                <button
                  onClick={() => { setTimeFilter('thisWeek'); setShowTimeDropdown(false); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#E8F3F2] flex items-center justify-between font-medium"
                >
                  <span>สัปดาห์นี้ (This Week)</span>
                  {timeFilter === 'thisWeek' && <CheckCircle2 size={13} className="text-[#5A8A88]" />}
                </button>
                <button
                  onClick={() => { setTimeFilter('all'); setShowTimeDropdown(false); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#E8F3F2] flex items-center justify-between font-medium"
                >
                  <span>ทั้งหมด (All)</span>
                  {timeFilter === 'all' && <CheckCircle2 size={13} className="text-[#5A8A88]" />}
                </button>
              </div>
            )}
          </div>

          {/* Filter 2: Branch Filter */}
          <div className="relative flex-1 min-w-[110px]">
            <button
              onClick={() => {
                setShowBranchDropdown(!showBranchDropdown);
                setShowTimeDropdown(false);
                setShowLocationDropdown(false);
              }}
              className="w-full flex items-center justify-between px-3.5 sm:px-4 py-2 rounded-full bg-white border border-[#D4E4E3] text-[13px] sm:text-sm font-semibold text-[#2D4A49] hover:bg-[#F0F5F4] transition-colors shadow-xs"
            >
              <div className="flex items-center gap-1.5 truncate">
                <MapPin size={14} className="text-[#5A8A88] shrink-0" />
                <span className="truncate">
                  {user.branch === 'Rayong' ? 'สาขาระยอง' : user.branch === 'Bangkok' ? 'สาขากรุงเทพฯ' : (user.branch || 'สาขา')}
                </span>
              </div>
              <ChevronDown size={14} className="text-[#6B8F8E] shrink-0 ml-1" />
            </button>

            {showBranchDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-[#D4E4E3] py-1.5 z-30 text-xs">
                <button
                  onClick={() => {
                    if (onChangeBranch) onChangeBranch('Rayong');
                    setShowBranchDropdown(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#E8F3F2] flex items-center justify-between font-medium"
                >
                  <span>📍 สาขาระยอง (Rayong)</span>
                  {user.branch === 'Rayong' && <CheckCircle2 size={13} className="text-[#5A8A88]" />}
                </button>
                <button
                  onClick={() => {
                    if (onChangeBranch) onChangeBranch('Bangkok');
                    setShowBranchDropdown(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#E8F3F2] flex items-center justify-between font-medium"
                >
                  <span>📍 สาขากรุงเทพฯ (Bangkok)</span>
                  {user.branch === 'Bangkok' && <CheckCircle2 size={13} className="text-[#5A8A88]" />}
                </button>
              </div>
            )}
          </div>

          {/* Filter 3: Inventory Location Filter [🏪 ทั้งหมด ▼ / 🍹 บาร์ ▼ / 🍳 ครัว ▼] */}
          <div className="relative flex-1 min-w-[120px]">
            <button
              type="button"
              onClick={() => {
                setShowLocationDropdown(!showLocationDropdown);
                setShowTimeDropdown(false);
                setShowBranchDropdown(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 sm:px-4 py-2 rounded-full border text-[13px] sm:text-sm font-semibold transition-all duration-200 shadow-xs cursor-pointer ${
                locationFilter !== 'all'
                  ? 'bg-[#E8F3F2] border-[#5A8A88] text-[#5A8A88]'
                  : 'bg-white border-[#D4E4E3] text-[#2D4A49] hover:bg-[#F0F5F4]'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="shrink-0 text-sm">
                  {locationFilter === 'bar' ? '🍹' : locationFilter === 'kitchen' ? '🍳' : '🏪'}
                </span>
                <span className="truncate">
                  {locationFilter === 'bar' ? 'บาร์' : locationFilter === 'kitchen' ? 'ครัว' : 'ทั้งหมด'}
                </span>
              </div>
              <ChevronDown 
                size={14} 
                className={`shrink-0 ml-1 transition-transform duration-200 ${
                  showLocationDropdown ? 'rotate-180 text-[#5A8A88]' : 'text-[#6B8F8E]'
                }`} 
              />
            </button>

            {showLocationDropdown && (
              <div className="absolute top-full right-0 sm:left-0 sm:right-auto sm:w-48 mt-1 bg-white rounded-2xl shadow-xl border border-[#D4E4E3] py-1.5 z-30 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-1 text-[10px] font-bold text-[#6B8F8E] uppercase tracking-wider border-b border-slate-100 mb-1">
                  เลือกพื้นที่จัดเก็บสต็อก
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLocationFilter('all');
                    setShowLocationDropdown(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 hover:bg-[#F0F5F4] flex items-center justify-between font-medium transition-colors ${
                    locationFilter === 'all' ? 'bg-[#E8F3F2] text-[#5A8A88] font-bold' : 'text-[#2D4A49]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🏪</span>
                    <span>ทั้งหมด (all)</span>
                  </span>
                  {locationFilter === 'all' && <CheckCircle2 size={13} className="text-[#5A8A88]" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLocationFilter('bar');
                    setShowLocationDropdown(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 hover:bg-[#F0F5F4] flex items-center justify-between font-medium transition-colors ${
                    locationFilter === 'bar' ? 'bg-[#E8F3F2] text-[#5A8A88] font-bold' : 'text-[#2D4A49]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🍹</span>
                    <span>บาร์ (bar)</span>
                  </span>
                  {locationFilter === 'bar' && <CheckCircle2 size={13} className="text-[#5A8A88]" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLocationFilter('kitchen');
                    setShowLocationDropdown(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 hover:bg-[#F0F5F4] flex items-center justify-between font-medium transition-colors ${
                    locationFilter === 'kitchen' ? 'bg-[#E8F3F2] text-[#5A8A88] font-bold' : 'text-[#2D4A49]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🍳</span>
                    <span>ครัว (kitchen)</span>
                  </span>
                  {locationFilter === 'kitchen' && <CheckCircle2 size={13} className="text-[#5A8A88]" />}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 4. KPI ROW: 3 CARDS (หมดสต็อก / ใกล้หมด / รวม) */}
        <section className="grid grid-cols-3 gap-2.5 md:gap-4 lg:gap-6">
          {/* Card 1: หมดสต็อก */}
          <div className="bg-white rounded-2xl p-3 md:p-4 border border-rose-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-sm">
            <div className="absolute top-0 right-0 w-12 h-12 bg-rose-50 rounded-bl-full -z-0"></div>
            <div className="z-10 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-rose-700">หมดสต็อก</span>
                <span className="text-[11px] text-[#6B8F8E] font-medium block mt-0.5">{locationLabel}</span>
              </div>
              <AlertCircle size={15} className="text-rose-500 shrink-0" />
            </div>
            <div className="mt-2 z-10">
              <span className="text-2xl md:text-3xl lg:text-4xl font-black text-rose-600 leading-none">
                {stockData.outCount}
              </span>
              <span className="text-[10px] md:text-xs text-slate-400 font-medium ml-1">รายการ</span>
            </div>
            <div className="mt-1 text-[9px] md:text-[10px] text-rose-500 font-medium truncate z-10">
              ต้องสั่งซื้อด่วน
            </div>
          </div>

          {/* Card 2: ใกล้หมด */}
          <div className="bg-white rounded-2xl p-3 md:p-4 border border-amber-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-sm">
            <div className="absolute top-0 right-0 w-12 h-12 bg-amber-50 rounded-bl-full -z-0"></div>
            <div className="z-10 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-700">ใกล้หมด</span>
                <span className="text-[11px] text-[#6B8F8E] font-medium block mt-0.5">{locationLabel}</span>
              </div>
              <AlertTriangle size={15} className="text-amber-500 shrink-0" />
            </div>
            <div className="mt-2 z-10">
              <span className="text-2xl md:text-3xl lg:text-4xl font-black text-amber-600 leading-none">
                {stockData.lowCount}
              </span>
              <span className="text-[10px] md:text-xs text-slate-400 font-medium ml-1">รายการ</span>
            </div>
            <div className="mt-1 text-[9px] md:text-[10px] text-amber-600 font-medium truncate z-10">
              ต่ำกว่าขั้นต่ำ
            </div>
          </div>

          {/* Card 3: รวม */}
          <div className="bg-white rounded-2xl p-3 md:p-4 border border-[#D4E4E3] shadow-xs flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-sm">
            <div className="absolute top-0 right-0 w-12 h-12 bg-[#E8F3F2] rounded-bl-full -z-0"></div>
            <div className="z-10 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#476E6C]">รวม</span>
                <span className="text-[11px] text-[#6B8F8E] font-medium block mt-0.5">{locationLabel}</span>
              </div>
              <Package size={15} className="text-[#5A8A88] shrink-0" />
            </div>
            <div className="mt-2 z-10">
              <span className="text-2xl md:text-3xl lg:text-4xl font-black text-[#5A8A88] leading-none">
                {stockData.total}
              </span>
              <span className="text-[10px] md:text-xs text-slate-400 font-medium ml-1">รายการ</span>
            </div>
            <div className="mt-1 text-[9px] md:text-[10px] text-[#5A8A88] font-medium truncate z-10">
              {locationLabel}
            </div>
          </div>
        </section>

        {/* 5 & 6. STOCK STATUS CARD + STOCK ALERT CARD (Responsive 2-column on md+) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          {/* 5. STOCK STATUS CARD: Donut chart + legend */}
          <section className="md:col-span-7 bg-white rounded-2xl p-4 md:p-5 border border-[#D4E4E3] shadow-xs transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#5A8A88]"></div>
                <h3 className="text-xs md:text-sm font-bold text-slate-800 uppercase tracking-wider">
                  สถานะสต็อกสินค้า ({locationLabel})
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                ทั้งหมด {stockData.total} รายการ
              </span>
            </div>

            <div className="flex items-center justify-around gap-4 py-2 my-auto">
              {/* Donut Chart SVG */}
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                  {/* Background ring */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#F1F5F4"
                    strokeWidth="12"
                  />
                  {/* Good stock ring segment */}
                  {stockData.goodCount > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#5A8A88"
                      strokeWidth="12"
                      strokeDasharray={`${chartValues.goodLen} ${chartValues.circumference}`}
                      strokeDashoffset={chartValues.goodOffset}
                      strokeLinecap="round"
                    />
                  )}
                  {/* Low stock ring segment */}
                  {stockData.lowCount > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#F59E0B"
                      strokeWidth="12"
                      strokeDasharray={`${chartValues.lowLen} ${chartValues.circumference}`}
                      strokeDashoffset={chartValues.lowOffset}
                      strokeLinecap="round"
                    />
                  )}
                  {/* Out of stock ring segment */}
                  {stockData.outCount > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#EF4444"
                      strokeWidth="12"
                      strokeDasharray={`${chartValues.outLen} ${chartValues.circumference}`}
                      strokeDashoffset={chartValues.outOffset}
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-base sm:text-lg font-black text-slate-800 leading-none">
                    {chartValues.goodPct}%
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 mt-0.5">
                    ความพร้อม
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-2 flex-1 text-xs">
                <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#5A8A88]"></span>
                    <span className="text-slate-700 font-medium">สต็อกปกติ</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-slate-800">{stockData.goodCount}</span>
                    <span className="text-[10px] text-slate-400">({chartValues.goodPct}%)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-amber-50/60 border border-amber-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className="text-amber-900 font-medium">ใกล้หมด</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-amber-700">{stockData.lowCount}</span>
                    <span className="text-[10px] text-amber-500">({chartValues.lowPct}%)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-rose-50/60 border border-rose-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span className="text-rose-900 font-medium">หมดสต็อก</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-rose-700">{stockData.outCount}</span>
                    <span className="text-[10px] text-rose-500">({chartValues.outPct}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 6. STOCK ALERT CARD: Top critical items */}
          <section className="md:col-span-5 bg-white rounded-2xl p-4 md:p-5 border border-[#D4E4E3] shadow-xs transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-amber-500" />
                  <h3 className="text-xs md:text-sm font-bold text-slate-800 uppercase tracking-wider">
                    รายการวิกฤตที่ต้องสั่งซื้อ ({locationLabel})
                  </h3>
                </div>
                <button
                  onClick={() => onNavigate(locationFilter === 'kitchen' ? 'bakeryPlan' : 'barPurchasing')}
                  className="text-[11px] font-bold text-[#5A8A88] hover:text-[#476E6C] flex items-center gap-0.5 cursor-pointer"
                >
                  สั่งซื้อ
                  <ChevronRight size={13} />
                </button>
              </div>

              {stockData.criticalList.length === 0 ? (
                <div className="py-8 text-center text-[#6B8F8E]">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs md:text-sm font-semibold text-slate-700">ไม่มีรายการวิกฤตในส่วนนี้</p>
                  <p className="text-[11px] text-[#6B8F8E] mt-0.5">{locationLabel} อยู่ในเกณฑ์ปกติทุกรายการ</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                  {stockData.criticalList.map(({ ing, remaining }) => {
                    const isZero = remaining <= 0;
                    return (
                      <div key={ing.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isZero ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'
                          }`}>
                            {ing.department === 'Bar' ? <Coffee size={16} /> : <Cake size={16} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate leading-snug">
                              {ing.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {ing.brand || '-'} • ขั้นต่ำ: {ing.minStock} {ing.unit}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isZero ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {remaining} / {ing.minStock} {ing.unit}
                          </span>
                          <p className="text-[9px] font-medium text-slate-400 mt-0.5">
                            {isZero ? 'หมดแล้ว' : 'ใกล้หมด'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* 7. SUPABASE STATUS: ● Connected (read-only) */}
        <section className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-[#D4E4E3] shadow-xs flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-slate-500" />
            <span className="font-medium text-slate-600 text-[11px]">Database Status</span>
          </div>

          <div className="flex items-center gap-1.5 font-semibold text-[11px]">
            {dbStatus === 'connected' && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E] shadow-[0_0_6px_#22C55E]"></span>
                </span>
                <span className="text-emerald-700">Supabase ● Connected</span>
              </>
            )}

            {dbStatus === 'checking' && (
              <>
                <Loader2 size={12} className="animate-spin text-amber-500" />
                <span className="text-amber-700">Supabase ● Connecting...</span>
              </>
            )}

            {dbStatus === 'offline' && (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span className="text-rose-700">Supabase ● Disconnected (Offline)</span>
              </>
            )}
          </div>
        </section>

      </main>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center font-bold text-2xl mx-auto shadow-xs border-2 border-[#D4E4E3]">
              {user.name.charAt(0)}
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-800">{user.name}</h3>
              <p className="text-xs font-semibold text-[#5A8A88] mt-0.5">{user.role}</p>
              <p className="text-[11px] text-slate-400 mt-1">สาขา: {user.branch === 'Rayong' ? 'ระยอง' : 'กรุงเทพฯ'}</p>
            </div>
            <div className="pt-2 space-y-2">
              <button
                onClick={() => { setShowProfileModal(false); onNavigate('userSettings'); }}
                className="w-full py-2.5 rounded-full bg-[#E8F3F2] text-[#476E6C] font-semibold text-xs hover:bg-[#D8EAE8] transition-colors"
              >
                จัดการบัญชีและความปลอดภัย
              </button>
              <button
                onClick={() => { setShowProfileModal(false); onLogout(); }}
                className="w-full py-2.5 rounded-full bg-rose-50 text-rose-600 font-semibold text-xs hover:bg-rose-100 transition-colors"
              >
                ออกจากระบบ
              </button>
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-full py-2 rounded-full text-slate-400 font-medium text-xs hover:text-slate-600 transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Info Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center mx-auto">
              <Building size={24} />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-800">ข้อมูลสาขา (Branch Info)</h3>
              <p className="text-xs text-slate-600 mt-2 font-medium">
                📍 สาขาปัจจุบัน: <span className="font-bold text-[#5A8A88]">{user.branch === 'Rayong' ? 'สาขาระยอง (Rayong)' : 'สาขากรุงเทพฯ (Bangkok)'}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                ระบบจัดเก็บข้อมูลและประวัติสต็อกแยกตามสาขาเพื่อความถูกต้องของการดำเนินงาน
              </p>
            </div>
            <button
              onClick={() => setShowBranchModal(false)}
              className="w-full py-2.5 rounded-full bg-[#5A8A88] text-white font-semibold text-xs hover:bg-[#476E6C] transition-colors"
            >
              ตกลง (OK)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
