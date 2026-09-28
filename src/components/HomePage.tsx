import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Home, 
  Package, 
  ClipboardList, 
  CheckSquare, 
  ShoppingCart, 
  Cake, 
  FlaskConical, 
  MoreHorizontal, 
  Settings, 
  LogOut, 
  Menu, 
  Bell, 
  Calendar, 
  MapPin, 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle, 
  Database, 
  SlidersHorizontal,
  X,
  CheckCircle2,
  Clock,
  History,
  FileText,
  UserCheck,
  ShieldCheck,
  Building,
  Coffee,
  ChefHat,
  LayoutGrid
} from 'lucide-react';
import { UserRole } from './LoginForm';
import { AppPermissions, ReceivingRecord, WasteLogEntry } from '../types';

interface HomePageProps {
  user: { 
    name: string; 
    role: UserRole; 
    permissions?: AppPermissions; 
    branch?: 'Rayong' | 'Bangkok';
  } | null;
  onNavigate: (tab: any) => void;
  onRefreshData?: () => Promise<void> | void;
  receivingRecords?: ReceivingRecord[];
  wasteLogs?: WasteLogEntry[];
  lowStockCount?: number;
  outOfStockCount?: number;
  dbStatus?: 'checking' | 'connected' | 'offline';
  onLogout?: () => void;
}

interface AlertItem {
  id: string;
  name: string;
  status: 'outOfStock' | 'lowStock';
  statusLabel: string;
  badgeBg: string;
  badgeText: string;
  remainingText: string;
  department: 'Bar' | 'Bakery';
}

export const HomePage: React.FC<HomePageProps> = ({
  user,
  onNavigate,
  onRefreshData,
  receivingRecords = [],
  wasteLogs = [],
  lowStockCount = 26,
  outOfStockCount = 9,
  dbStatus = 'connected',
  onLogout
}) => {
  // Navigation rail collapse state (Collapsed: 72px / Expanded: 220px)
  const [isRailExpanded, setIsRailExpanded] = useState<boolean>(true);

  // Mobile menu drawer open state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Active flyout sub-menu key
  const [activeFlyout, setActiveFlyout] = useState<
    'stock' | 'reports' | 'checkin' | 'bakery' | 'more' | null
  >(null);

  // Filter states
  const [selectedMonth, setSelectedMonth] = useState<string>('เดือนนี้');
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState<boolean>(false);
  const [selectedBranch, setSelectedBranch] = useState<'Rayong' | 'Bangkok'>(
    user?.branch || 'Rayong'
  );
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState<boolean>(false);

  // Inventory Location Filter State: "all" (ทั้งหมด) | "bar" (บาร์) | "kitchen" (ครัว)
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
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState<boolean>(false);

  // Sync locationFilter with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('crenn_location_filter', locationFilter);
    } catch {
      // ignore
    }
  }, [locationFilter]);

  // Notifications Modal
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);

  // Settings / Status Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);

  // Refs for outside click handling
  const railContainerRef = useRef<HTMLDivElement>(null);
  const headerFiltersRef = useRef<HTMLDivElement>(null);

  // Close flyouts and header dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        railContainerRef.current && 
        !railContainerRef.current.contains(event.target as Node)
      ) {
        setActiveFlyout(null);
      }
      if (
        headerFiltersRef.current &&
        !headerFiltersRef.current.contains(event.target as Node)
      ) {
        setIsMonthDropdownOpen(false);
        setIsBranchDropdownOpen(false);
        setIsLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute initials for avatar
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'AD';

  // Comprehensive stock alert items by department
  const allAlertItems: AlertItem[] = [
    // Bar critical items
    {
      id: 'bar-1',
      name: 'Everyday Blend (Medium Roast)',
      status: 'outOfStock',
      statusLabel: 'หมดสต็อก',
      badgeBg: 'bg-[#FEE2E2]',
      badgeText: 'text-[#EF4444]',
      remainingText: 'คงเหลือ 0 ถุง (ขั้นต่ำ 2 ถุง)',
      department: 'Bar'
    },
    {
      id: 'bar-2',
      name: 'Colombia Santander Supremo (Medium)',
      status: 'outOfStock',
      statusLabel: 'หมดสต็อก',
      badgeBg: 'bg-[#FEE2E2]',
      badgeText: 'text-[#EF4444]',
      remainingText: 'คงเหลือ 0 ถุง (ขั้นต่ำ 4 ถุง)',
      department: 'Bar'
    },
    {
      id: 'bar-3',
      name: 'นมอัลมอนด์ 137 Degrees',
      status: 'outOfStock',
      statusLabel: 'หมดสต็อก',
      badgeBg: 'bg-[#FEE2E2]',
      badgeText: 'text-[#EF4444]',
      remainingText: 'คงเหลือ 0 กล่อง (ขั้นต่ำ 1 กล่อง)',
      department: 'Bar'
    },
    {
      id: 'bar-4',
      name: 'ผงโฮจิฉะ Medium Firing',
      status: 'outOfStock',
      statusLabel: 'หมดสต็อก',
      badgeBg: 'bg-[#FEE2E2]',
      badgeText: 'text-[#EF4444]',
      remainingText: 'คงเหลือ 0 ถุง (ขั้นต่ำ 1 ถุง)',
      department: 'Bar'
    },
    {
      id: 'bar-5',
      name: 'Brazil Santos (Medium to Dark)',
      status: 'outOfStock',
      statusLabel: 'หมดสต็อก',
      badgeBg: 'bg-[#FEE2E2]',
      badgeText: 'text-[#EF4444]',
      remainingText: 'คงเหลือ 0 ถุง (ขั้นต่ำ 6 ถุง)',
      department: 'Bar'
    },
    {
      id: 'bar-6',
      name: 'แก้ว 16 Oz. (FC)',
      status: 'lowStock',
      statusLabel: 'ใกล้หมด',
      badgeBg: 'bg-[#FEF3C7]',
      badgeText: 'text-[#F59E0B]',
      remainingText: 'คงเหลือ 6 แถว (ขั้นต่ำ 15 แถว)',
      department: 'Bar'
    },
    {
      id: 'bar-7',
      name: 'Monin Syrup (Vanilla)',
      status: 'lowStock',
      statusLabel: 'ใกล้หมด',
      badgeBg: 'bg-[#FEF3C7]',
      badgeText: 'text-[#F59E0B]',
      remainingText: 'คงเหลือ 1 ขวด (ขั้นต่ำ 2 ขวด)',
      department: 'Bar'
    },
    {
      id: 'bar-8',
      name: 'ซอสคาราเมล Topping ตรา Juniper',
      status: 'lowStock',
      statusLabel: 'ใกล้หมด',
      badgeBg: 'bg-[#FEF3C7]',
      badgeText: 'text-[#F59E0B]',
      remainingText: 'คงเหลือ 2 ขวด (ขั้นต่ำ 4 ขวด)',
      department: 'Bar'
    },

    // Bakery critical items
    {
      id: 'bakery-1',
      name: 'ช็อกโกแลต Callebaut 70.5%',
      status: 'outOfStock',
      statusLabel: 'หมดสต็อก',
      badgeBg: 'bg-[#FEE2E2]',
      badgeText: 'text-[#EF4444]',
      remainingText: 'คงเหลือ 0 ถุง (ขั้นต่ำ 2 ถุง)',
      department: 'Bakery'
    },
    {
      id: 'bakery-2',
      name: 'ยีสต์สด SAF (ก้อน 500g)',
      status: 'outOfStock',
      statusLabel: 'หมดสต็อก',
      badgeBg: 'bg-[#FEE2E2]',
      badgeText: 'text-[#EF4444]',
      remainingText: 'คงเหลือ 0 ก้อน (ขั้นต่ำ 4 ก้อน)',
      department: 'Bakery'
    },
    {
      id: 'bakery-3',
      name: 'กลิ่นวานิลลา Vanilla bean paste',
      status: 'outOfStock',
      statusLabel: 'หมดสต็อก',
      badgeBg: 'bg-[#FEE2E2]',
      badgeText: 'text-[#EF4444]',
      remainingText: 'คงเหลือ 0 กระปุก (ขั้นต่ำ 1 กระปุก)',
      department: 'Bakery'
    },
    {
      id: 'bakery-4',
      name: 'อัลมอนด์สไลด์ ตรากิเลน',
      status: 'outOfStock',
      statusLabel: 'หมดสต็อก',
      badgeBg: 'bg-[#FEE2E2]',
      badgeText: 'text-[#EF4444]',
      remainingText: 'คงเหลือ 0 ถุง (ขั้นต่ำ 1 ถุง)',
      department: 'Bakery'
    },
    {
      id: 'bakery-5',
      name: 'น้ำเลมอน (หลัก) Ital lemon',
      status: 'lowStock',
      statusLabel: 'ใกล้หมด',
      badgeBg: 'bg-[#FEF3C7]',
      badgeText: 'text-[#F59E0B]',
      remainingText: 'คงเหลือ 1 ขวด (ขั้นต่ำ 3 ขวด)',
      department: 'Bakery'
    },
    {
      id: 'bakery-6',
      name: 'วิปครีม Debic (1 ลิตร)',
      status: 'lowStock',
      statusLabel: 'ใกล้หมด',
      badgeBg: 'bg-[#FEF3C7]',
      badgeText: 'text-[#F59E0B]',
      remainingText: 'คงเหลือ 1 ลัง (ขั้นต่ำ 2 ลัง)',
      department: 'Bakery'
    },
    {
      id: 'bakery-7',
      name: 'แป้งเค้ก ตราพัด',
      status: 'lowStock',
      statusLabel: 'ใกล้หมด',
      badgeBg: 'bg-[#FEF3C7]',
      badgeText: 'text-[#F59E0B]',
      remainingText: 'คงเหลือ 2 ถุง (ขั้นต่ำ 5 ถุง)',
      department: 'Bakery'
    },
    {
      id: 'bakery-8',
      name: 'เนยมีลเมทเค็ม Mealmate',
      status: 'lowStock',
      statusLabel: 'ใกล้หมด',
      badgeBg: 'bg-[#FEF3C7]',
      badgeText: 'text-[#F59E0B]',
      remainingText: 'คงเหลือ 1 กล่อง (ขั้นต่ำ 3 ชิ้น)',
      department: 'Bakery'
    }
  ];

  // Dynamic alert items filtered by selected department
  const displayedAlertItems = useMemo(() => {
    if (selectedDepartment === 'Bar') {
      return allAlertItems.filter(item => item.department === 'Bar');
    }
    if (selectedDepartment === 'Bakery') {
      return allAlertItems.filter(item => item.department === 'Bakery');
    }
    // 'All' - balanced top 8 items across both departments
    return [
      allAlertItems.find(i => i.id === 'bar-1')!,
      allAlertItems.find(i => i.id === 'bakery-1')!,
      allAlertItems.find(i => i.id === 'bar-2')!,
      allAlertItems.find(i => i.id === 'bakery-2')!,
      allAlertItems.find(i => i.id === 'bar-3')!,
      allAlertItems.find(i => i.id === 'bakery-5')!,
      allAlertItems.find(i => i.id === 'bakery-6')!,
      allAlertItems.find(i => i.id === 'bar-6')!,
    ].filter(Boolean);
  }, [selectedDepartment]);

  // Reactive Stock counts and percentages according to active department filter
  const stats = useMemo(() => {
    if (selectedDepartment === 'Bar') {
      const total = 53;
      const out = 5;
      const low = 11;
      const normal = total - out - low; // 37
      const idle = 0;
      return {
        total,
        out,
        low,
        normal,
        idle,
        normalPercent: Math.round((normal / total) * 100),
        outPercent: Math.round((out / total) * 100),
        lowPercent: Math.round((low / total) * 100),
        idlePercent: 0,
        description: 'วัตถุดิบแผนกบาร์เครื่องดื่มทั้งหมด 53 รายการ',
        subtextOut: 'ต้องเติมบาร์ด่วนก่อนเริ่มรอบถัดไป',
        subtextLow: 'บาร์: ต่ำกว่าเกณฑ์สต็อกขั้นต่ำ'
      };
    } else if (selectedDepartment === 'Bakery') {
      const total = 81;
      const out = 4;
      const low = 15;
      const normal = total - out - low; // 62
      const idle = 0;
      return {
        total,
        out,
        low,
        normal,
        idle,
        normalPercent: Math.round((normal / total) * 100),
        outPercent: Math.round((out / total) * 100),
        lowPercent: Math.round((low / total) * 100),
        idlePercent: 0,
        description: 'วัตถุดิบแผนกเบเกอรี่และครัวทั้งหมด 81 รายการ',
        subtextOut: 'ต้องเติมครัวด่วนสำหรับแผนอบขนม',
        subtextLow: 'ครัว: ต่ำกว่าเกณฑ์สต็อกขั้นต่ำ'
      };
    } else {
      const total = 134;
      const out = outOfStockCount > 0 ? outOfStockCount : 9;
      const low = lowStockCount > 0 ? lowStockCount : 26;
      const normal = Math.max(0, total - out - low); // 99
      const idle = 0;
      return {
        total,
        out,
        low,
        normal,
        idle,
        normalPercent: Math.round((normal / total) * 100),
        outPercent: Math.round((out / total) * 100),
        lowPercent: Math.round((low / total) * 100),
        idlePercent: 0,
        description: 'วัตถุดิบ บาร์ 53 รายการ / ครัว 81 รายการ',
        subtextOut: 'ต้องเติมด่วนก่อนเริ่มรอบถัดไป',
        subtextLow: 'ต่ำกว่าเกณฑ์สต็อกขั้นต่ำ (Min Stock)'
      };
    }
  }, [selectedDepartment, outOfStockCount, lowStockCount]);

  // Donut chart calculations based on current reactive stats
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const normalStroke = (stats.normalPercent / 100) * circumference;
  const outStroke = (stats.outPercent / 100) * circumference;
  const lowStroke = (stats.lowPercent / 100) * circumference;

  // Offset calculations for donut segments
  const outOffset = -normalStroke;
  const lowOffset = -(normalStroke + outStroke);

  // Formatted date string
  const todayDateString = new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  const handleNavClick = (
    key: 'stock' | 'reports' | 'checkin' | 'bakery' | 'more' | 'home' | 'purchasing' | 'rnd'
  ) => {
    if (key === 'home') {
      setActiveFlyout(null);
      setIsMobileMenuOpen(false);
      return;
    }
    if (key === 'purchasing') {
      setActiveFlyout(null);
      setIsMobileMenuOpen(false);
      onNavigate('barPurchasing');
      return;
    }
    if (key === 'rnd') {
      setActiveFlyout(null);
      setIsMobileMenuOpen(false);
      onNavigate('rndReport');
      return;
    }

    // Toggle sub-menu flyout
    if (activeFlyout === key) {
      setActiveFlyout(null);
    } else {
      setActiveFlyout(key);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#F0F5F4] text-slate-800 font-sans antialiased overflow-x-hidden selection:bg-[#7A9E9C]/20">
      
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* 🗂️ SIDE NAVIGATION RAIL (Left Panel)     */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        ref={railContainerRef}
        className={`shrink-0 min-h-screen flex flex-col justify-between transition-all duration-300 z-50 select-none bg-gradient-to-b from-[#2D4A49] to-[#3D6B69] shadow-[4px_0_12px_rgba(0,0,0,0.08)] fixed inset-y-0 left-0 md:static md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isRailExpanded ? 'w-[260px] md:w-[220px]' : 'w-[260px] md:w-[72px]'}`}
      >
        {/* Rail Top & Items */}
        <div className="w-full flex flex-col">
          {/* Rail Header (Top) */}
          <div className="px-3.5 pt-5 pb-4 border-b border-white/10 flex flex-col">
            <div className="flex items-center justify-between min-h-[48px]">
              {/* Toggle Button for Tablet/Desktop (☰) */}
              <button
                type="button"
                onClick={() => setIsRailExpanded(!isRailExpanded)}
                className="hidden md:flex w-12 h-12 items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
                aria-label="Toggle navigation rail"
                title={isRailExpanded ? 'ยุบเมนู (Collapse)' : 'ขยายเมนู (Expand)'}
              >
                <Menu size={22} />
              </button>

              {/* Close Button for Mobile (X) */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="md:hidden w-11 h-11 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
                aria-label="Close menu"
              >
                <X size={22} />
              </button>

              {/* CRENN Brand (Always on mobile drawer, or expanded on md+) */}
              <div className={`flex-1 ml-2 overflow-hidden ${isRailExpanded ? 'block' : 'md:hidden'}`}>
                <span className="text-white font-extrabold text-[18px] tracking-[0.22em] uppercase truncate block">
                  CRENN
                </span>
              </div>
            </div>

            {/* User Profile Summary */}
            <div className="flex items-center gap-2.5 mt-3 px-1 min-h-[48px]">
              {/* Avatar circle bg #7A9E9C white initials */}
              <div 
                className="w-11 h-11 rounded-full bg-[#7A9E9C] text-white flex items-center justify-center font-bold text-[14px] shadow-sm shrink-0 border border-white/20"
                title={user?.name || 'Admin'}
              >
                {userInitials}
              </div>

              <div className={`flex flex-col min-w-0 flex-1 ${isRailExpanded ? 'block' : 'md:hidden'}`}>
                <span className="text-white text-[14px] font-semibold truncate leading-tight">
                  {user?.name || 'Admin'}
                </span>
                <div className="mt-1">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white tracking-wider uppercase bg-white/20 border border-white/10">
                    {user?.role || 'ADMIN'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Items (Vertical List, min-height 56px, touch targets ≥ 48x48px) */}
          <nav className="flex-1 py-3 px-2 space-y-1">
            {/* 1. 🏠 หน้าหลัก (Active) */}
            <button
              type="button"
              onClick={() => handleNavClick('home')}
              className={`w-full min-h-[56px] px-3.5 flex items-center rounded-xl transition-all cursor-pointer text-left ${
                activeFlyout === null
                  ? 'bg-white/15 border-l-[3px] border-[#C5D5D3] text-white shadow-xs'
                  : 'text-white/60 hover:bg-white/8 hover:text-white'
              }`}
              title="หน้าหลัก"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <Home size={20} className="text-white" />
              </div>
              <span className={`ml-3 text-[14px] font-medium text-white tracking-wide truncate ${isRailExpanded ? 'inline' : 'md:hidden'}`}>
                หน้าหลัก
              </span>
            </button>

            {/* 2. 📦 สต็อก */}
            <div className="relative">
              <button
                type="button"
                onClick={() => handleNavClick('stock')}
                className={`w-full min-h-[56px] px-3.5 flex items-center justify-between rounded-xl transition-all cursor-pointer text-left ${
                  activeFlyout === 'stock'
                    ? 'bg-white/15 border-l-[3px] border-[#C5D5D3] text-white'
                    : 'text-white/60 hover:bg-white/8 hover:text-white'
                }`}
                title="สต็อก (Stock)"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <Package size={20} />
                  </div>
                  <span className={`ml-3 text-[14px] font-medium tracking-wide truncate ${isRailExpanded ? 'inline' : 'md:hidden'}`}>
                    สต็อก
                  </span>
                </div>
                <ChevronRight 
                  size={16} 
                  className={`transition-transform duration-200 ${isRailExpanded ? 'inline' : 'md:hidden'} ${
                    activeFlyout === 'stock' ? 'rotate-90 text-white' : 'text-white/40'
                  }`} 
                />
              </button>

              {/* Flyout Sub-menu: Stock */}
              {activeFlyout === 'stock' && (
                <div
                  className={`fixed z-50 top-28 ${isRailExpanded ? 'md:left-[228px]' : 'md:left-[80px]'} left-4 right-4 md:right-auto bg-white rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-slate-100 p-2 min-w-[210px] animate-in fade-in zoom-in-95 duration-150`}
                >
                  <div className="px-3 py-1.5 text-[11px] font-bold text-[#6B8F8E] uppercase tracking-wider border-b border-slate-100 mb-1">
                    จัดการสต็อกสินค้า
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      setIsMobileMenuOpen(false);
                      onNavigate('barStock');
                    }}
                    className="w-full min-h-[48px] px-3 flex items-center gap-2.5 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors cursor-pointer text-left"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#7A9E9C]"></span>
                    <span>Stock บาร์ (Bar Stock)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      setIsMobileMenuOpen(false);
                      onNavigate('bakeryStock');
                    }}
                    className="w-full min-h-[48px] px-3 flex items-center gap-2.5 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors cursor-pointer text-left"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#7A9E9C]"></span>
                    <span>Stock ครัว (Bakery Stock)</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. 📋 รายงาน */}
            <div className="relative">
              <button
                type="button"
                onClick={() => handleNavClick('reports')}
                className={`w-full min-h-[56px] px-3.5 flex items-center justify-between rounded-xl transition-all cursor-pointer text-left ${
                  activeFlyout === 'reports'
                    ? 'bg-white/15 border-l-[3px] border-[#C5D5D3] text-white'
                    : 'text-white/60 hover:bg-white/8 hover:text-white'
                }`}
                title="รายงาน (Reports)"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <ClipboardList size={20} />
                  </div>
                  <span className={`ml-3 text-[14px] font-medium tracking-wide truncate ${isRailExpanded ? 'inline' : 'md:hidden'}`}>
                    รายงาน
                  </span>
                </div>
                <ChevronRight 
                  size={16} 
                  className={`transition-transform duration-200 ${isRailExpanded ? 'inline' : 'md:hidden'} ${
                    activeFlyout === 'reports' ? 'rotate-90 text-white' : 'text-white/40'
                  }`} 
                />
              </button>

              {/* Flyout Sub-menu: Reports (Group 1: Daily, Group 2: History) */}
              {activeFlyout === 'reports' && (
                <div
                  className={`fixed z-50 top-36 ${isRailExpanded ? 'md:left-[228px]' : 'md:left-[80px]'} left-4 right-4 md:right-auto bg-white rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-slate-100 p-2.5 min-w-[270px] max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150`}
                >
                  {/* Group 1: Daily */}
                  <div className="px-3 py-1 text-[11px] font-bold text-[#6B8F8E] uppercase tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
                    <span>กลุ่มที่ 1: รายการประจำวัน (Daily)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      onNavigate('barReceiving');
                    }}
                    className="w-full min-h-[44px] px-3 flex items-center gap-2 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88]"></span>
                    รับวัตถุดิบ บาร์ (Bar Receiving)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      onNavigate('bakeryReceiving');
                    }}
                    className="w-full min-h-[44px] px-3 flex items-center gap-2 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88]"></span>
                    รับวัตถุดิบ ครัว (Bakery Receiving)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      onNavigate('barDailyCount');
                    }}
                    className="w-full min-h-[44px] px-3 flex items-center gap-2 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88]"></span>
                    นับสต็อก บาร์ (Daily Count Bar)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      onNavigate('bakeryDailyCount');
                    }}
                    className="w-full min-h-[44px] px-3 flex items-center gap-2 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88]"></span>
                    นับสต็อก ครัว (Daily Count Bakery)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      onNavigate('barWasteLog');
                    }}
                    className="w-full min-h-[44px] px-3 flex items-center gap-2 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    Waste บาร์ (Waste Report Bar)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      onNavigate('bakeryWasteLog');
                    }}
                    className="w-full min-h-[44px] px-3 flex items-center gap-2 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    Waste ครัว (Waste Report Bakery)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      onNavigate('barWaste');
                    }}
                    className="w-full min-h-[44px] px-3 flex items-center gap-2 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Waste เมล็ดกาแฟ (Coffee Waste)
                  </button>

                  {/* Group 2: History */}
                  <div className="px-3 pt-2.5 pb-1 text-[11px] font-bold text-[#6B8F8E] uppercase tracking-wider border-t border-b border-slate-100 mt-2 mb-1">
                    กลุ่มที่ 2: ประวัติและบันทึกย้อนหลัง (History)
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      onNavigate('logs');
                    }}
                    className="w-full min-h-[44px] px-3 flex items-center gap-2 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <History size={15} className="text-[#5A8A88]" />
                    ประวัติแก้ไข (Audit Logs)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      onNavigate('stockSubmitHistory');
                    }}
                    className="w-full min-h-[44px] px-3 flex items-center gap-2 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <Clock size={15} className="text-[#5A8A88]" />
                    ประวัตินับสต็อก (Stock Count Logs)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      onNavigate('receivingHistory');
                    }}
                    className="w-full min-h-[44px] px-3 flex items-center gap-2 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <FileText size={15} className="text-[#5A8A88]" />
                    ประวัติรับวัตถุดิบ (Receiving Logs)
                  </button>
                </div>
              )}
            </div>

            {/* 4. ✅ Check-in */}
            <div className="relative">
              <button
                type="button"
                onClick={() => handleNavClick('checkin')}
                className={`w-full min-h-[56px] px-3.5 flex items-center justify-between rounded-xl transition-all cursor-pointer text-left ${
                  activeFlyout === 'checkin'
                    ? 'bg-white/15 border-l-[3px] border-[#C5D5D3] text-white'
                    : 'text-white/60 hover:bg-white/8 hover:text-white'
                }`}
                title="Check-in Checklist"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <CheckSquare size={20} />
                  </div>
                  <span className={`ml-3 text-[14px] font-medium tracking-wide truncate ${isRailExpanded ? 'inline' : 'md:hidden'}`}>
                    Check-in
                  </span>
                </div>
                <ChevronRight 
                  size={16} 
                  className={`transition-transform duration-200 ${isRailExpanded ? 'inline' : 'md:hidden'} ${
                    activeFlyout === 'checkin' ? 'rotate-90 text-white' : 'text-white/40'
                  }`} 
                />
              </button>

              {/* Flyout Sub-menu: Check-in */}
              {activeFlyout === 'checkin' && (
                <div
                  className={`fixed z-50 top-48 ${isRailExpanded ? 'md:left-[228px]' : 'md:left-[80px]'} left-4 right-4 md:right-auto bg-white rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-slate-100 p-2 min-w-[220px] animate-in fade-in zoom-in-95 duration-150`}
                >
                  <div className="px-3 py-1.5 text-[11px] font-bold text-[#6B8F8E] uppercase tracking-wider border-b border-slate-100 mb-1">
                    การตรวจเช็กประจำวัน
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      setIsMobileMenuOpen(false);
                      onNavigate('barChecklist');
                    }}
                    className="w-full min-h-[48px] px-3 flex items-center gap-2.5 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    Check-in บาร์ (Bar Checklist)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      setIsMobileMenuOpen(false);
                      onNavigate('bakeryChecklist');
                    }}
                    className="w-full min-h-[48px] px-3 flex items-center gap-2.5 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <CheckCircle2 size={16} className="text-amber-500" />
                    Check-in ครัว (Bakery Checklist)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      setIsMobileMenuOpen(false);
                      onNavigate('checklistHistory');
                    }}
                    className="w-full min-h-[48px] px-3 flex items-center gap-2.5 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left border-t border-slate-100 mt-1"
                  >
                    <History size={16} className="text-[#5A8A88]" />
                    ประวัติ Check-in (Checklist Logs)
                  </button>
                </div>
              )}
            </div>

            {/* 5. 🛒 Purchasing (Single Page) */}
            <button
              type="button"
              onClick={() => handleNavClick('purchasing')}
              className="w-full min-h-[56px] px-3.5 flex items-center rounded-xl text-white/60 hover:bg-white/8 hover:text-white transition-all cursor-pointer text-left"
              title="Purchasing (สรุปยอดสั่งซื้อ)"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <ShoppingCart size={20} />
              </div>
              <span className={`ml-3 text-[14px] font-medium tracking-wide truncate ${isRailExpanded ? 'inline' : 'md:hidden'}`}>
                Purchasing
              </span>
            </button>

            {/* 6. 🧁 Bakery */}
            <div className="relative">
              <button
                type="button"
                onClick={() => handleNavClick('bakery')}
                className={`w-full min-h-[56px] px-3.5 flex items-center justify-between rounded-xl transition-all cursor-pointer text-left ${
                  activeFlyout === 'bakery'
                    ? 'bg-white/15 border-l-[3px] border-[#C5D5D3] text-white'
                    : 'text-white/60 hover:bg-white/8 hover:text-white'
                }`}
                title="แผนงานเบเกอรี่ (Bakery)"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <Cake size={20} />
                  </div>
                  <span className={`ml-3 text-[14px] font-medium tracking-wide truncate ${isRailExpanded ? 'inline' : 'md:hidden'}`}>
                    Bakery
                  </span>
                </div>
                <ChevronRight 
                  size={16} 
                  className={`transition-transform duration-200 ${isRailExpanded ? 'inline' : 'md:hidden'} ${
                    activeFlyout === 'bakery' ? 'rotate-90 text-white' : 'text-white/40'
                  }`} 
                />
              </button>

              {/* Flyout Sub-menu: Bakery */}
              {activeFlyout === 'bakery' && (
                <div
                  className={`fixed z-50 top-64 ${isRailExpanded ? 'md:left-[228px]' : 'md:left-[80px]'} left-4 right-4 md:right-auto bg-white rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-slate-100 p-2 min-w-[230px] animate-in fade-in zoom-in-95 duration-150`}
                >
                  <div className="px-3 py-1.5 text-[11px] font-bold text-[#6B8F8E] uppercase tracking-wider border-b border-slate-100 mb-1">
                    แผนงานเบเกอรี่
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      setIsMobileMenuOpen(false);
                      onNavigate('bakeryPlan');
                    }}
                    className="w-full min-h-[48px] px-3 flex items-center gap-2.5 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <Cake size={16} className="text-[#5A8A88]" />
                    แผนงาน Bakery (Bakery Plan)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      setIsMobileMenuOpen(false);
                      onNavigate('bakeryPlanHistory');
                    }}
                    className="w-full min-h-[48px] px-3 flex items-center gap-2.5 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <History size={16} className="text-[#5A8A88]" />
                    ประวัติ 24 สัปดาห์ (24 Weeks History)
                  </button>
                </div>
              )}
            </div>

            {/* 7. 🔬 R&D (Single Page) */}
            <button
              type="button"
              onClick={() => handleNavClick('rnd')}
              className="w-full min-h-[56px] px-3.5 flex items-center rounded-xl text-white/60 hover:bg-white/8 hover:text-white transition-all cursor-pointer text-left"
              title="R&D Report"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <FlaskConical size={20} />
              </div>
              <span className={`ml-3 text-[14px] font-medium tracking-wide truncate ${isRailExpanded ? 'inline' : 'md:hidden'}`}>
                R&D
              </span>
            </button>

            {/* ─── Divider ─── */}
            <div className="py-2">
              <div className="h-px bg-white/10 mx-2"></div>
            </div>

            {/* 8. ··· เพิ่มเติม (More) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => handleNavClick('more')}
                className={`w-full min-h-[56px] px-3.5 flex items-center justify-between rounded-xl transition-all cursor-pointer text-left ${
                  activeFlyout === 'more'
                    ? 'bg-white/15 border-l-[3px] border-[#C5D5D3] text-white'
                    : 'text-white/60 hover:bg-white/8 hover:text-white'
                }`}
                title="เพิ่มเติม (More)"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <MoreHorizontal size={20} />
                  </div>
                  <span className={`ml-3 text-[14px] font-medium tracking-wide truncate ${isRailExpanded ? 'inline' : 'md:hidden'}`}>
                    เพิ่มเติม
                  </span>
                </div>
                <ChevronRight 
                  size={16} 
                  className={`transition-transform duration-200 ${isRailExpanded ? 'inline' : 'md:hidden'} ${
                    activeFlyout === 'more' ? 'rotate-90 text-white' : 'text-white/40'
                  }`} 
                />
              </button>

              {/* Flyout Sub-menu: More */}
              {activeFlyout === 'more' && (
                <div
                  className={`fixed z-50 bottom-24 ${isRailExpanded ? 'md:left-[228px]' : 'md:left-[80px]'} left-4 right-4 md:right-auto bg-white rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-slate-100 p-2 min-w-[220px] animate-in fade-in zoom-in-95 duration-150`}
                >
                  <div className="px-3 py-1.5 text-[11px] font-bold text-[#6B8F8E] uppercase tracking-wider border-b border-slate-100 mb-1">
                    เมนูเพิ่มเติม
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      setIsMobileMenuOpen(false);
                      onNavigate('userSettings');
                    }}
                    className="w-full min-h-[48px] px-3 flex items-center gap-2.5 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <Settings size={16} className="text-[#5A8A88]" />
                    ตั้งค่าความปลอดภัย (Settings)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      setIsMobileMenuOpen(false);
                      onNavigate('logs');
                    }}
                    className="w-full min-h-[48px] px-3 flex items-center gap-2.5 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <History size={16} className="text-[#5A8A88]" />
                    ประวัติแก้ไข (Audit Logs)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      setIsMobileMenuOpen(false);
                      setIsBranchDropdownOpen(true);
                    }}
                    className="w-full min-h-[48px] px-3 flex items-center gap-2.5 rounded-lg hover:bg-[#F0F5F4] text-[#2D4A49] text-[13px] font-medium transition-colors text-left"
                  >
                    <Building size={16} className="text-[#5A8A88]" />
                    สลับสาขา (Switch Branch)
                  </button>
                  <div className="h-px bg-slate-100 my-1"></div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFlyout(null);
                      setIsMobileMenuOpen(false);
                      onLogout?.();
                    }}
                    className="w-full min-h-[48px] px-3 flex items-center gap-2.5 rounded-lg hover:bg-rose-50 text-rose-600 text-[13px] font-medium transition-colors text-left"
                  >
                    <LogOut size={16} />
                    ออกจากระบบ (Logout)
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Rail Footer (Pinned Bottom) */}
        <div className="px-2 pb-4 pt-2 border-t border-white/10 space-y-1">
          {/* ⚙️ ตั้งค่า */}
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              onNavigate('userSettings');
            }}
            className="w-full min-h-[48px] px-3.5 flex items-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all cursor-pointer text-left"
            title="ตั้งค่า (Settings)"
          >
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <Settings size={18} />
            </div>
            <span className={`ml-3 text-[13px] font-medium tracking-wide truncate ${isRailExpanded ? 'inline' : 'md:hidden'}`}>
              ตั้งค่า
            </span>
          </button>

          {/* 🚪 ออกจากระบบ */}
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              onLogout?.();
            }}
            className="w-full min-h-[48px] px-3.5 flex items-center rounded-xl text-rose-200/80 hover:bg-rose-500/20 hover:text-rose-100 transition-all cursor-pointer text-left"
            title="ออกจากระบบ (Logout)"
          >
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <LogOut size={18} />
            </div>
            <span className={`ml-3 text-[13px] font-medium tracking-wide truncate ${isRailExpanded ? 'inline' : 'md:hidden'}`}>
              ออกจากระบบ
            </span>
          </button>

          {/* ──────────────── Divider & Supabase Connected */}
          <div className="pt-2 px-3">
            <div className={`items-center gap-2 text-white/80 text-[10px] tracking-wider uppercase font-medium ${isRailExpanded ? 'flex' : 'flex md:hidden'}`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
              </span>
              <span className="truncate">Supabase Connected</span>
            </div>

            <div className={`justify-center ${isRailExpanded ? 'hidden' : 'hidden md:flex'}`} title="Supabase Connected">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22C55E]"></span>
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* 📋 CONTENT AREA (Right of Rail)          */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F0F5F4] p-4 sm:p-6 lg:p-8 xl:p-10 overflow-y-auto">
        <div className="w-full xl:max-w-[1600px] xl:mx-auto flex flex-col">
        
        {/* CONTENT HEADER BAR */}
        <header className="w-full flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6">
          {/* Left Header: Breadcrumb & Page Title (with Mobile Hamburger) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden w-11 h-11 flex items-center justify-center bg-white rounded-xl text-[#2D4A49] shadow-xs border border-slate-200/80 hover:bg-slate-50 transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div>
              <div className="text-[12px] md:text-[13px] font-semibold text-[#6B8F8E] tracking-wide mb-0.5">
                หน้าหลัก
              </div>
              <h1 className="text-[20px] sm:text-[24px] lg:text-[28px] font-bold text-[#2D4A49] leading-tight tracking-tight">
                Inventory Dashboard
              </h1>
            </div>
          </div>

          {/* Right Header: Filters, Notification, Date */}
          <div ref={headerFiltersRef} className="flex items-center flex-wrap gap-2.5">
            {/* Filter Pill 1: [📅 เดือนนี้ ▼] */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsMonthDropdownOpen(!isMonthDropdownOpen);
                  setIsBranchDropdownOpen(false);
                  setIsDepartmentDropdownOpen(false);
                }}
                className="min-h-[48px] px-4 py-2.5 rounded-full bg-white text-[#2D4A49] text-[13px] font-semibold shadow-xs border border-slate-200/80 hover:bg-slate-50 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Calendar size={15} className="text-[#5A8A88]" />
                <span>{selectedMonth}</span>
                <ChevronDown size={14} className="text-[#6B8F8E]" />
              </button>

              {isMonthDropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-30">
                  {['วันนี้', 'สัปดาห์นี้', 'เดือนนี้', 'ไตรมาสนี้'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setSelectedMonth(m);
                        setIsMonthDropdownOpen(false);
                      }}
                      className={`w-full min-h-[44px] px-4 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#F0F5F4] transition-colors ${
                        selectedMonth === m ? 'text-[#2D4A49] font-bold bg-[#F0F5F4]' : 'text-slate-600'
                      }`}
                    >
                      <span>{m}</span>
                      {selectedMonth === m && <CheckCircle2 size={14} className="text-[#5A8A88]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Pill 2: [🏪 สาขา ▼] */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsBranchDropdownOpen(!isBranchDropdownOpen);
                  setIsMonthDropdownOpen(false);
                  setIsDepartmentDropdownOpen(false);
                }}
                className="min-h-[48px] px-4 py-2.5 rounded-full bg-white text-[#2D4A49] text-[13px] font-semibold shadow-xs border border-slate-200/80 hover:bg-slate-50 flex items-center gap-2 transition-all cursor-pointer"
              >
                <MapPin size={15} className="text-[#5A8A88]" />
                <span>
                  {selectedBranch === 'Rayong' ? 'สาขาระยอง' : 'สาขากรุงเทพฯ'}
                </span>
                <ChevronDown size={14} className="text-[#6B8F8E]" />
              </button>

              {isBranchDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-30">
                  <div className="px-4 py-1 text-[11px] font-bold text-[#6B8F8E] uppercase tracking-wider border-b border-slate-100 mb-1">
                    เลือกสาขาทำงาน
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBranch('Rayong');
                      setIsBranchDropdownOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-4 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#F0F5F4] transition-colors ${
                      selectedBranch === 'Rayong' ? 'text-[#2D4A49] font-bold bg-[#F0F5F4]' : 'text-slate-600'
                    }`}
                  >
                    <span>📍 สาขาระยอง (Rayong)</span>
                    {selectedBranch === 'Rayong' && <CheckCircle2 size={14} className="text-[#5A8A88]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBranch('Bangkok');
                      setIsBranchDropdownOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-4 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#F0F5F4] transition-colors ${
                      selectedBranch === 'Bangkok' ? 'text-[#2D4A49] font-bold bg-[#F0F5F4]' : 'text-slate-600'
                    }`}
                  >
                    <span>📍 สาขากรุงเทพฯ (Bangkok)</span>
                    {selectedBranch === 'Bangkok' && <CheckCircle2 size={14} className="text-[#5A8A88]" />}
                  </button>
                </div>
              )}
            </div>

            {/* Filter Pill 3: [🏢 แผนก: ทั้งหมด / บาร์ / ครัว ▼] */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsDepartmentDropdownOpen(!isDepartmentDropdownOpen);
                  setIsBranchDropdownOpen(false);
                  setIsMonthDropdownOpen(false);
                }}
                className="min-h-[48px] px-4 py-2.5 rounded-full bg-white text-[#2D4A49] text-[13px] font-semibold shadow-xs border border-slate-200/80 hover:bg-slate-50 flex items-center gap-2 transition-all cursor-pointer"
              >
                {selectedDepartment === 'All' && <LayoutGrid size={15} className="text-[#5A8A88]" />}
                {selectedDepartment === 'Bar' && <Coffee size={15} className="text-[#5A8A88]" />}
                {selectedDepartment === 'Bakery' && <ChefHat size={15} className="text-[#5A8A88]" />}
                <span>
                  {selectedDepartment === 'All' ? 'ทั้งหมด' : selectedDepartment === 'Bar' ? 'บาร์' : 'ครัว'}
                </span>
                <ChevronDown size={14} className="text-[#6B8F8E]" />
              </button>

              {isDepartmentDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-1 text-[11px] font-bold text-[#6B8F8E] uppercase tracking-wider border-b border-slate-100 mb-1">
                    เลือกแผนกที่ต้องการดู
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDepartment('All');
                      setIsDepartmentDropdownOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-4 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#F0F5F4] transition-colors ${
                      selectedDepartment === 'All' ? 'text-[#2D4A49] font-bold bg-[#F0F5F4]' : 'text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGrid size={14} className="text-[#5A8A88]" />
                      <span>ทั้งหมด (All)</span>
                    </div>
                    {selectedDepartment === 'All' && <CheckCircle2 size={14} className="text-[#5A8A88]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDepartment('Bar');
                      setIsDepartmentDropdownOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-4 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#F0F5F4] transition-colors ${
                      selectedDepartment === 'Bar' ? 'text-[#2D4A49] font-bold bg-[#F0F5F4]' : 'text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Coffee size={14} className="text-[#5A8A88]" />
                      <span>บาร์ (Bar)</span>
                    </div>
                    {selectedDepartment === 'Bar' && <CheckCircle2 size={14} className="text-[#5A8A88]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDepartment('Bakery');
                      setIsDepartmentDropdownOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-4 text-left text-xs font-semibold flex items-center justify-between hover:bg-[#F0F5F4] transition-colors ${
                      selectedDepartment === 'Bakery' ? 'text-[#2D4A49] font-bold bg-[#F0F5F4]' : 'text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ChefHat size={14} className="text-[#5A8A88]" />
                      <span>ครัว (Bakery)</span>
                    </div>
                    {selectedDepartment === 'Bakery' && <CheckCircle2 size={14} className="text-[#5A8A88]" />}
                  </button>
                </div>
              )}
            </div>

            {/* Notification Bell Icon (#5A8A88) */}
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className="w-12 h-12 rounded-full bg-white text-[#5A8A88] hover:text-[#2D4A49] hover:bg-slate-50 border border-slate-200/80 shadow-xs flex items-center justify-center transition-all relative cursor-pointer"
              title="การแจ้งเตือน"
            >
              <Bell size={20} />
              {/* Notification red dot badge */}
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#EF4444] rounded-full ring-2 ring-white"></span>
            </button>

            {/* Date string #6B8F8E 13px */}
            <div className="hidden sm:flex items-center text-[13px] font-medium text-[#6B8F8E] pl-1">
              {todayDateString}
            </div>
          </div>
        </header>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* KPI ROW (3 Cards, Full Width, Horizontal) */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-7">
          {/* Card 1: หมดสต็อก (Top accent 4px Red #EF4444) */}
          <div
            onClick={() => onNavigate(selectedDepartment === 'Bakery' ? 'bakeryStock' : 'barStock')}
            className="bg-white rounded-[16px] p-6 shadow-[0_2px_12px_rgba(90,138,136,0.1)] border-t-4 border-[#EF4444] flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#6B8F8E]">
                หมดสต็อก
              </span>
              <span className="w-8 h-8 rounded-full bg-red-50 text-[#EF4444] flex items-center justify-center group-hover:scale-105 transition-transform">
                <AlertTriangle size={16} />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-[38px] lg:text-[40px] font-extrabold text-[#2D4A49] leading-none">
                {stats.out}
              </div>
              <div className="text-[12px] text-red-500 font-medium mt-1">
                {stats.subtextOut}
              </div>
            </div>
          </div>

          {/* Card 2: ใกล้หมด (Top accent 4px Amber #F59E0B) */}
          <div
            onClick={() => onNavigate('barPurchasing')}
            className="bg-white rounded-[16px] p-6 shadow-[0_2px_12px_rgba(90,138,136,0.1)] border-t-4 border-[#F59E0B] flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#6B8F8E]">
                ใกล้หมด
              </span>
              <span className="w-8 h-8 rounded-full bg-amber-50 text-[#F59E0B] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Clock size={16} />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-[38px] lg:text-[40px] font-extrabold text-[#2D4A49] leading-none">
                {stats.low}
              </div>
              <div className="text-[12px] text-amber-600 font-medium mt-1">
                {stats.subtextLow}
              </div>
            </div>
          </div>

          {/* Card 3: รายการรวม (Top accent 4px Teal #5A8A88) */}
          <div
            onClick={() => onNavigate(selectedDepartment === 'Bakery' ? 'bakeryStock' : 'barStock')}
            className="bg-white rounded-[16px] p-6 shadow-[0_2px_12px_rgba(90,138,136,0.1)] border-t-4 border-[#5A8A88] flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#6B8F8E]">
                รายการรวม
              </span>
              <span className="w-8 h-8 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Package size={16} />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-[38px] lg:text-[40px] font-extrabold text-[#2D4A49] leading-none">
                {stats.total}
              </div>
              <div className="text-[12px] text-[#6B8F8E] font-medium mt-1">
                {stats.description}
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* MAIN CONTENT — 2-Column Layout           */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (55% / 7 cols): STOCK STATUS CARD */}
          <section className="lg:col-span-7 bg-[#E8F3F2] rounded-[20px] p-6 lg:p-7 shadow-xs border border-[#C5D5D3]/60 flex flex-col justify-between">
            {/* Title & Settings Icon */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] lg:text-[20px] font-bold text-[#2D4A49]">
                สถานะสต็อก {selectedDepartment !== 'All' ? `(${selectedDepartment === 'Bar' ? 'แผนกบาร์' : 'แผนกครัว'})` : ''}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate(selectedDepartment === 'Bakery' ? 'bakeryStock' : 'barStock')}
                className="w-10 h-10 rounded-full hover:bg-white/60 flex items-center justify-center text-[#5A8A88] transition-colors cursor-pointer"
                title="ตัวกรองและมุมมองสต็อก"
              >
                <SlidersHorizontal size={19} />
              </button>
            </div>

            {/* Donut Chart & Legend */}
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
              {/* Donut Chart (SVG) */}
              <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
                  {/* Background Track Circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="#D2E3E1"
                    strokeWidth="18"
                    fill="transparent"
                  />
                  {/* Segment 1: สินค้าปกติ (Teal #7A9E9C) */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="#7A9E9C"
                    strokeWidth="18"
                    fill="transparent"
                    strokeDasharray={`${normalStroke} ${circumference}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                  {/* Segment 2: หมดสต็อก (Red #EF4444) */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="#EF4444"
                    strokeWidth="18"
                    fill="transparent"
                    strokeDasharray={`${outStroke} ${circumference}`}
                    strokeDashoffset={outOffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                  {/* Segment 3: ใกล้หมด (Amber #F59E0B) */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="#F59E0B"
                    strokeWidth="18"
                    fill="transparent"
                    strokeDasharray={`${lowStroke} ${circumference}`}
                    strokeDashoffset={lowOffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                  <span className="text-[34px] font-black text-[#2D4A49] leading-none tracking-tight">
                    {stats.total}
                  </span>
                  <span className="text-[13px] font-medium text-[#6B8F8E] mt-1">
                    รายการ
                  </span>
                </div>
              </div>

              {/* Legend (Vertical) */}
              <div className="flex flex-col space-y-3.5 w-full sm:w-auto min-w-[200px]">
                {/* 1. สินค้าปกติ */}
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#7A9E9C] shrink-0"></span>
                    <span className="font-semibold text-[#2D4A49]">สินค้าปกติ</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#2D4A49]">{stats.normal}</span>
                    <span className="text-[#6B8F8E] text-xs ml-1.5">({stats.normalPercent}%)</span>
                  </div>
                </div>

                {/* 2. หมดสต็อก */}
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#EF4444] shrink-0"></span>
                    <span className="font-semibold text-[#2D4A49]">หมดสต็อก</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#EF4444]">{stats.out}</span>
                    <span className="text-[#6B8F8E] text-xs ml-1.5">({stats.outPercent}%)</span>
                  </div>
                </div>

                {/* 3. ใกล้หมด */}
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#F59E0B] shrink-0"></span>
                    <span className="font-semibold text-[#2D4A49]">ใกล้หมด</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#F59E0B]">{stats.low}</span>
                    <span className="text-[#6B8F8E] text-xs ml-1.5">({stats.lowPercent}%)</span>
                  </div>
                </div>

                {/* 4. สต็อกนิ่ง */}
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#A8BCBB] shrink-0"></span>
                    <span className="font-semibold text-[#2D4A49]">สต็อกนิ่ง</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#2D4A49]">{stats.idle}</span>
                    <span className="text-[#6B8F8E] text-xs ml-1.5">({stats.idlePercent}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick action helper bottom */}
            <div className="mt-6 pt-4 border-t border-[#C5D5D3]/60 flex items-center justify-between text-xs text-[#6B8F8E]">
              <span>อัปเดตข้อมูลล่าสุดจากการตรวจนับตามรอบ</span>
              <button
                type="button"
                onClick={() => onNavigate(selectedDepartment === 'Bakery' ? 'bakeryDailyCount' : 'barDailyCount')}
                className="font-semibold text-[#5A8A88] hover:underline cursor-pointer"
              >
                บันทึกการนับสต็อกวันนี้ &rsaquo;
              </button>
            </div>
          </section>

          {/* Right Column (45% / 5 cols): STOCK ALERT CARD */}
          <section className="lg:col-span-5 bg-white rounded-[16px] shadow-[0_2px_12px_rgba(90,138,136,0.1)] border-l-4 border-[#EF4444] p-6 flex flex-col justify-between">
            <div>
              {/* Card Title */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[17px] lg:text-[18px] font-bold text-[#2D4A49] flex items-center gap-2">
                  <span>⚠️</span>
                  <span>รายการที่ต้องดำเนินการ</span>
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-[#EF4444] font-bold">
                  {displayedAlertItems.length} รายการ
                </span>
              </div>

              {/* Critical Items List (5–8 items) */}
              <div className="divide-y divide-slate-100">
                {displayedAlertItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onNavigate(item.department === 'Bar' ? 'barStock' : 'bakeryStock')}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-[#F0F5F4]/60 px-2 rounded-lg transition-colors cursor-pointer group min-h-[48px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-[#2D4A49] truncate group-hover:text-[#5A8A88] transition-colors">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-[#6B8F8E] truncate mt-0.5">
                        {item.remainingText} &bull; <span className="font-medium text-slate-500">{item.department}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${item.badgeBg} ${item.badgeText}`}
                    >
                      {item.statusLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* "ดูทั้งหมด ›" Link (#5A8A88) */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => onNavigate(selectedDepartment === 'Bakery' ? 'bakeryStock' : 'barStock')}
                className="text-[#5A8A88] hover:text-[#2D4A49] text-[13px] font-bold flex items-center gap-1 transition-colors cursor-pointer min-h-[44px]"
              >
                <span>ดูทั้งหมด</span>
                <span className="text-base">&rsaquo;</span>
              </button>
            </div>
          </section>

        </div>
        </div>
      </main>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* NOTIFICATIONS MODAL                      */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {isNotificationsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[#2D4A49] text-base">การแจ้งเตือนระบบ</h3>
                  <p className="text-xs text-[#6B8F8E]">แจ้งเตือนสต็อกและการเคลื่อนไหวล่าสุด</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs">
                <div className="font-bold text-red-800 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-red-500" />
                  วัตถุดิบหมดสต็อก 9 รายการ
                </div>
                <p className="text-red-700 mt-1">
                  มีรายการเมล็ดกาแฟและผลิตภัณฑ์นมหมดสต็อก กรุณาออกใบสั่งซื้อใน Purchasing
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs">
                <div className="font-bold text-amber-800 flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-500" />
                  วัตถุดิบใกล้หมด 26 รายการ
                </div>
                <p className="text-amber-700 mt-1">
                  ระดับสต็อกลดลงถึงจุดสั่งซื้อขั้นต่ำ (Reorder Point)
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs">
                <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Supabase Cloud Synchronization
                </div>
                <p className="text-emerald-700 mt-1">
                  ฐานข้อมูลเชื่อมต่อและซิงค์ข้อมูลกับเซิร์ฟเวอร์แบบเรียลไทม์เรียบร้อยแล้ว
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(false)}
                className="px-5 py-2 rounded-full bg-[#5A8A88] text-white text-xs font-bold hover:bg-[#4a7573] transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
