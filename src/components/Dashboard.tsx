import React, { useMemo, useState, useRef } from 'react';
import { Ingredient, StockRecord } from '../types';
import { format } from 'date-fns';
import { AlertTriangle, Package, ShoppingCart, CheckCircle2, TrendingDown, AlertCircle, Filter, Coffee, ChefHat, LayoutGrid, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface DashboardProps {
  ingredients: Ingredient[];
  stockRecord: StockRecord;
  allowedDepartments?: ('Bar' | 'Bakery')[];
}

type FilterType = 'all' | 'outOfStock' | 'lowStock' | 'goodStock' | 'needsAttention';
type DepartmentFilter = 'All' | 'Bar' | 'Bakery';

export function Dashboard({ ingredients, stockRecord, allowedDepartments = ['Bar', 'Bakery'] }: DashboardProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('needsAttention');
  const initialDept = allowedDepartments.length === 2 ? 'All' : allowedDepartments[0] || 'All';
  const [activeDepartment, setActiveDepartment] = useState<DepartmentFilter>(initialDept);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const scrollTable = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!tableContainerRef.current) return;
    const scrollAmount = 200;
    switch (direction) {
      case 'up': tableContainerRef.current.scrollBy({ top: -scrollAmount, behavior: 'smooth' }); break;
      case 'down': tableContainerRef.current.scrollBy({ top: scrollAmount, behavior: 'smooth' }); break;
      case 'left': tableContainerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' }); break;
      case 'right': tableContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' }); break;
    }
  };

  // Filter ingredients by department first
  const departmentIngredients = useMemo(() => {
    const allowedIngs = ingredients.filter(ing => allowedDepartments.includes(ing.department as any));
    if (activeDepartment === 'All') return allowedIngs;
    return allowedIngs.filter(ing => ing.department === activeDepartment);
  }, [ingredients, activeDepartment, allowedDepartments]);

  // Calculate latest stock for each ingredient using forward-rolling logic
  const latestStock = useMemo(() => {
    const stockMap: Record<string, { stock: number; date: string }> = {};
    
    // Get all available dates in the stock record and sort them ascending (oldest first)
    const sortedDatesAsc = Object.keys(stockRecord).sort();
    
    // Create a tracker for the rolling stock
    const currentRemaining: Record<string, number> = {};
    const lastUpdateDate: Record<string, string> = {};

    sortedDatesAsc.forEach(dateKey => {
      departmentIngredients.forEach(ing => {
        const id = ing.id;
        const val = stockRecord[dateKey]?.[id];
        
        if (typeof val === 'number') {
          currentRemaining[id] = val;
          lastUpdateDate[id] = dateKey;
        } else if (val) {
          const inVal = val.in === null ? undefined : val.in;
          const outVal = val.out === null ? undefined : val.out;
          const explicitRemaining = val.remaining === null ? undefined : val.remaining;

          if (explicitRemaining !== undefined) {
             currentRemaining[id] = explicitRemaining;
             lastUpdateDate[id] = dateKey;
          } else {
             if (currentRemaining[id] !== undefined || inVal !== undefined || outVal !== undefined) {
               const prevRemaining = currentRemaining[id] || 0;
               const added = inVal || 0;
               const removed = outVal || 0;
               currentRemaining[id] = prevRemaining + added - removed;
               lastUpdateDate[id] = dateKey;
             }
          }
        }
      });
    });

    departmentIngredients.forEach(ing => {
       stockMap[ing.id] = { 
         stock: currentRemaining[ing.id] || 0, 
         date: lastUpdateDate[ing.id] || '-' 
       };
    });

    return stockMap;
  }, [departmentIngredients, stockRecord]);

  const stats = useMemo(() => {
    let outOfStock = 0;
    let lowStock = 0;
    let goodStock = 0;

    departmentIngredients.forEach(ing => {
      const record = latestStock[ing.id];
      if (!record) return;
      if (record.stock === 0) {
        outOfStock++;
      } else if (record.stock < ing.minStock) {
        lowStock++;
      } else {
        goodStock++;
      }
    });

    return { outOfStock, lowStock, goodStock, total: departmentIngredients.length };
  }, [departmentIngredients, latestStock]);

  const filteredIngredients = useMemo(() => {
    let filtered = departmentIngredients;
    
    if (activeFilter === 'outOfStock') {
      filtered = departmentIngredients.filter(ing => (latestStock[ing.id]?.stock || 0) === 0);
    } else if (activeFilter === 'lowStock') {
      filtered = departmentIngredients.filter(ing => {
        const stock = latestStock[ing.id]?.stock || 0;
        return stock > 0 && stock < ing.minStock;
      });
    } else if (activeFilter === 'goodStock') {
      filtered = departmentIngredients.filter(ing => {
        const stock = latestStock[ing.id]?.stock || 0;
        return stock >= ing.minStock;
      });
    } else if (activeFilter === 'needsAttention') {
      filtered = departmentIngredients.filter(ing => {
        const stock = latestStock[ing.id]?.stock || 0;
        return stock < ing.minStock;
      });
    }

    return [...filtered].sort((a, b) => {
      const stockA = latestStock[a.id]?.stock || 0;
      const stockB = latestStock[b.id]?.stock || 0;
      return stockA - stockB;
    });
  }, [ingredients, latestStock, activeFilter]);

  const tableHeaderInfo = useMemo(() => {
    switch (activeFilter) {
      case 'all': return { title: 'รายการสินค้าทั้งหมด (All Items)', icon: <Package className="text-blue-500" size={20} />, color: 'text-blue-700', bg: 'bg-blue-100' };
      case 'outOfStock': return { title: 'สินค้าหมด (Out of Stock)', icon: <AlertCircle className="text-red-500" size={20} />, color: 'text-red-700', bg: 'bg-red-100' };
      case 'lowStock': return { title: 'สินค้าใกล้หมด (Low Stock)', icon: <TrendingDown className="text-orange-500" size={20} />, color: 'text-orange-700', bg: 'bg-orange-100' };
      case 'goodStock': return { title: 'สินค้าสถานะปกติ (Good Stock)', icon: <CheckCircle2 className="text-green-500" size={20} />, color: 'text-green-700', bg: 'bg-green-100' };
      case 'needsAttention': return { title: 'รายการที่ต้องสั่งซื้อด่วน (Needs Attention)', icon: <AlertTriangle className="text-orange-500" size={20} />, color: 'text-orange-700', bg: 'bg-orange-100' };
    }
  }, [activeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">ภาพรวมสต็อกสินค้า (Dashboard)</h2>
          <p className="text-[13px] text-slate-500 mt-1">สรุปสถานะวัตถุดิบและรายการที่ต้องสั่งซื้อ</p>
        </div>
        
        <div className="flex bg-slate-100/50 backdrop-blur-md p-2 rounded-2xl border border-slate-200 self-start shadow-sm gap-2">
          {(['All', 'Bar', 'Bakery'] as DepartmentFilter[])
          .filter(dept => dept === 'All' ? allowedDepartments.length === 2 : allowedDepartments.includes(dept as any))
          .map((dept) => {
            const isActive = activeDepartment === dept;
            const Icon = dept === 'All' ? LayoutGrid : dept === 'Bar' ? Coffee : ChefHat;
            
            // Define colors for each department
            const colors = {
              All: {
                active: "bg-blue-600 text-white shadow-blue-200",
                hover: "hover:bg-blue-50 hover:text-blue-600",
                icon: "text-blue-600"
              },
              Bar: {
                active: "bg-orange-600 text-white shadow-orange-200",
                hover: "hover:bg-orange-50 hover:text-orange-600",
                icon: "text-orange-600"
              },
              Bakery: {
                active: "bg-pink-600 text-white shadow-pink-200",
                hover: "hover:bg-pink-50 hover:text-pink-600",
                icon: "text-pink-600"
              }
            };

            const theme = colors[dept];
            
            return (
              <button
                key={dept}
                onClick={() => {
                  setActiveDepartment(dept);
                  setActiveFilter('needsAttention');
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all duration-300 shadow-sm border border-transparent",
                  isActive 
                    ? cn(theme.active, "shadow-md scale-105 border-white/20") 
                    : cn("bg-white text-slate-500 border-slate-100", theme.hover)
                )}
              >
                <Icon size={16} className={cn("transition-transform duration-300", isActive ? "scale-110 text-white" : theme.icon)} />
                <span>
                  {dept === 'All' ? 'ทั้งหมด' : dept === 'Bar' ? 'บาร์ (Bar)' : 'ครัว (Bakery)'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveFilter(activeFilter === 'all' ? 'needsAttention' : 'all')}
          className={cn(
            "bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4 cursor-pointer transition-all hover:shadow-md",
            activeFilter === 'all' ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Package className="text-blue-600" size={24} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-slate-500">รายการทั้งหมด</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.total}</h3>
          </div>
        </div>

        <div 
          onClick={() => setActiveFilter(activeFilter === 'outOfStock' ? 'needsAttention' : 'outOfStock')}
          className={cn(
            "bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4 cursor-pointer transition-all hover:shadow-md",
            activeFilter === 'outOfStock' ? "border-red-500 ring-2 ring-red-200" : "border-red-100"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <AlertCircle className="text-red-600" size={24} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-red-600">สินค้าหมด (Out of Stock)</p>
            <h3 className="text-2xl font-bold text-red-700">{stats.outOfStock}</h3>
          </div>
        </div>

        <div 
          onClick={() => setActiveFilter(activeFilter === 'lowStock' ? 'needsAttention' : 'lowStock')}
          className={cn(
            "bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4 cursor-pointer transition-all hover:shadow-md",
            activeFilter === 'lowStock' ? "border-orange-500 ring-2 ring-orange-200" : "border-orange-100"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
            <TrendingDown className="text-orange-600" size={24} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-orange-600">ใกล้หมด (Low Stock)</p>
            <h3 className="text-2xl font-bold text-orange-700">{stats.lowStock}</h3>
          </div>
        </div>

        <div 
          onClick={() => setActiveFilter(activeFilter === 'goodStock' ? 'needsAttention' : 'goodStock')}
          className={cn(
            "bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4 cursor-pointer transition-all hover:shadow-md",
            activeFilter === 'goodStock' ? "border-green-500 ring-2 ring-green-200" : "border-green-100"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="text-green-600" size={24} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-green-600">สถานะปกติ</p>
            <h3 className="text-2xl font-bold text-green-700">{stats.goodStock}</h3>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tableHeaderInfo.icon}
            <h3 className="font-bold text-slate-800 text-[15px]">
              {tableHeaderInfo.title} 
              <span className="text-slate-400 font-normal mx-2">|</span>
              <span className={cn(
                "px-2 py-0.5 rounded-md text-[12px] font-bold uppercase",
                activeDepartment === 'All' ? "bg-blue-100 text-blue-700" :
                activeDepartment === 'Bar' ? "bg-orange-100 text-orange-700" :
                "bg-pink-100 text-pink-700"
              )}>
                {activeDepartment === 'All' ? 'ทุกแผนก' : activeDepartment === 'Bar' ? 'แผนกบาร์' : 'แผนกครัว'}
              </span>
            </h3>
            <span className={cn("ml-2 py-0.5 px-2 rounded-full text-[11px] font-bold", tableHeaderInfo.bg, tableHeaderInfo.color)}>
              {filteredIngredients.length} รายการ
            </span>
          </div>
          {activeFilter !== 'needsAttention' && (
            <button 
              onClick={() => setActiveFilter('needsAttention')}
              className="text-[13px] text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-md shadow-sm transition-colors hover:bg-slate-100"
            >
              <Filter size={14} />
              ล้างตัวกรอง
            </button>
          )}
        </div>
        
        {filteredIngredients.length > 0 ? (
          <div className="relative group/table">
            {/* Scroll Buttons */}
            <div className="absolute right-4 bottom-4 flex flex-col gap-2 z-40 opacity-0 group-hover/table:opacity-100 transition-opacity">
              <div className="flex gap-2">
                <button 
                  onClick={() => scrollTable('left')}
                  className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                  title="เลื่อนซ้าย"
                >
                  <ChevronLeft size={20} />
                </button>
                <button 
                  onClick={() => scrollTable('right')}
                  className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                  title="เลื่อนขวา"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => scrollTable('up')}
                  className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                  title="เลื่อนขึ้น"
                >
                  <ChevronUp size={20} />
                </button>
                <button 
                  onClick={() => scrollTable('down')}
                  className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                  title="เลื่อนลง"
                >
                  <ChevronDown size={20} />
                </button>
              </div>
            </div>

            <div 
              ref={tableContainerRef}
              className="overflow-auto max-h-[480px] relative scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent border-t border-slate-100"
            >
              <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 shadow-sm">
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold whitespace-nowrap">
                  <th className="px-3 py-2 bg-slate-50 sticky left-0 z-30 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[260px] max-w-[260px]">สินค้า</th>
                  {activeDepartment === 'All' && <th className="px-2 py-2 text-center bg-slate-50 w-[80px]">แผนก</th>}
                  <th className="px-2 py-2 text-center bg-slate-50 w-[100px]">คงเหลือล่าสุด</th>
                  <th className="px-2 py-2 text-center bg-slate-50 w-[80px]">ขั้นต่ำ</th>
                  <th className="px-3 py-2 text-right bg-slate-50 w-[100px]">อัปเดตล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {filteredIngredients.map(item => {
                  const record = latestStock[item.id];
                  const isOut = record.stock === 0;
                  const isLow = record.stock > 0 && record.stock < item.minStock;
                  
                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                      <td className="px-3 py-2 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] w-[260px] max-w-[260px]">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><ShoppingCart size={12} className="text-slate-300"/></div>
                            )}
                          </div>
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-[10px] text-slate-800 truncate" title={item.name}>{item.name}</p>
                            <p className="text-[9px] text-slate-500 truncate" title={item.brand || '-'}>{item.brand || '-'}</p>
                          </div>
                        </div>
                      </td>
                      {activeDepartment === 'All' && (
                        <td className="px-2 py-2 text-center">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap",
                            item.department === 'Bar' ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-pink-50 text-pink-600 border border-pink-100"
                          )}>
                            {item.department}
                          </span>
                        </td>
                      )}
                      <td className="px-2 py-2 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                          isOut ? "bg-red-50 text-red-700 border-red-200" : 
                          isLow ? "bg-orange-50 text-orange-700 border-orange-200" :
                          "bg-green-50 text-green-700 border-green-200"
                        )}>
                          {record.stock} {item.unit}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center text-[10px] text-slate-600 font-mono">
                        {item.minStock}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-500 text-right whitespace-nowrap">
                        {record.date === format(new Date(), 'yyyy-MM-dd') ? 'วันนี้' : record.date}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-slate-400" />
            </div>
            <h4 className="text-slate-800 font-medium mb-1">ไม่มีรายการในหมวดหมู่นี้</h4>
            <p className="text-[13px] text-slate-500">
              {activeFilter === 'needsAttention' ? 'สต็อกสินค้าอยู่ในเกณฑ์ปกติ ไม่มีรายการสินค้าที่ต่ำกว่าเกณฑ์ขั้นต่ำในขณะนี้' : 'ไม่พบรายการสินค้าที่ตรงกับเงื่อนไขที่เลือก'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
