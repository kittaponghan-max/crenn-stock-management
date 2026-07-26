import React, { useRef, useState } from 'react';
import { Ingredient, StockRecord, CATEGORIES } from '../types';
import { format, isSameDay, startOfWeek, addDays, subDays, differenceInDays } from 'date-fns';
import { AlertTriangle, Check, ShoppingCart, ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';

import { UserRole } from './LoginForm';

interface StockTableProps {
  ingredients: Ingredient[];
  stockRecord: StockRecord;
  dateRange: { start: Date; end: Date };
  onUpdateStock: (ingredientId: string, date: Date, field: 'in' | 'out' | 'remaining', value: number | undefined) => void;
  onClearIngredientWeek: (ingredientId: string) => void;
  onClearDay: (dateKey: string) => void;
  onDeleteIngredient: (id: string) => void;
  onEditIngredient: (ingredient: Ingredient) => void;
  userRole: UserRole;
  isReadOnly?: boolean;

}

export function StockTable({ ingredients, stockRecord, dateRange, onUpdateStock, onClearIngredientWeek, onClearDay, onDeleteIngredient, onEditIngredient, userRole, isReadOnly = false, }: StockTableProps) {
  const isAdmin = !isReadOnly && ['Admin', 'Branch Manager'].includes(userRole);
  
  

  const [visibleCols, setVisibleCols] = React.useState({
    brand: false,
    sizePerUnit: true,
    minStock: true,
    minOrder: true,
    supplier: false
  });

  const weekDays = React.useMemo(() => {
    const daysCount = Math.max(1, Math.min(7, differenceInDays(dateRange.end, dateRange.start) + 1));
    return Array.from({ length: daysCount }).map((_, i) => addDays(dateRange.start, i));
  }, [dateRange]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Ingredient | null>(null);
  const [itemToClear, setItemToClear] = useState<Ingredient | null>(null);
  const [dayToClear, setDayToClear] = useState<{ dateKey: string; label: string } | null>(null);



  // Auto-calculate remaining logic
  const computedStock = React.useMemo(() => {
    const datesSet = new Set<string>(Object.keys(stockRecord));
    weekDays.forEach(d => datesSet.add(format(d, 'yyyy-MM-dd')));
    const allDates = Array.from(datesSet).sort();
    
    const currentRemaining: Record<string, number> = {};
    const computed: Record<string, Record<string, { in?: number; out?: number; remaining?: number; isAutoCalculated?: boolean }>> = {};

    allDates.forEach(dateKey => {
      computed[dateKey] = {};
      const dayData = stockRecord[dateKey] || {};
      
      ingredients.forEach(ing => {
        const id = ing.id;
        const val = dayData[id];
        let obj = { in: undefined as number | undefined, out: undefined as number | undefined, remaining: undefined as number | undefined, isAutoCalculated: false };

        if (typeof val === 'number') {
          obj.remaining = val;
        } else if (val) {
          obj.in = val.in === null ? undefined : val.in;
          obj.out = val.out === null ? undefined : val.out;
          obj.remaining = val.remaining === null ? undefined : val.remaining;
        }

        if (obj.remaining !== undefined) {
           // Explicit override
           currentRemaining[id] = obj.remaining;
           obj.isAutoCalculated = false;
        } else {
           // Auto Calculate
           if (currentRemaining[id] !== undefined || obj.in !== undefined || obj.out !== undefined) {
             const prevRemaining = currentRemaining[id] || 0;
             const inVal = obj.in || 0;
             const outVal = obj.out || 0;
             const calc = prevRemaining + inVal - outVal;
             obj.remaining = calc;
             currentRemaining[id] = calc;
             obj.isAutoCalculated = true;
           }
        }
        
        computed[dateKey][id] = obj;
      });
    });

    return computed;
  }, [stockRecord, ingredients, dateRange]);

  // Group ingredients by category
  const groupedIngredients = ingredients.reduce((acc, ing) => {
    if (!acc[ing.category]) acc[ing.category] = [];
    acc[ing.category].push(ing);
    return acc;
  }, {} as Record<string, Ingredient[]>);


  const baseColsCount = 
    (isAdmin ? 1 : 0) + 
    2 + // รูป + รายการสินค้า
    (visibleCols.brand ? 1 : 0) +
    (visibleCols.sizePerUnit ? 1 : 0) +
    (visibleCols.minStock ? 1 : 0) +
    (visibleCols.minOrder ? 1 : 0) +
    (visibleCols.supplier ? 1 : 0) +
    weekDays.length;

  return (
    <div className="space-y-2 w-full">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-700">แสดงคอลัมน์:</span>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-slate-900">
            <input type="checkbox" checked={visibleCols.brand} onChange={(e) => setVisibleCols(prev => ({...prev, brand: e.target.checked}))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            ยี่ห้อ
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-slate-900">
            <input type="checkbox" checked={visibleCols.sizePerUnit} onChange={(e) => setVisibleCols(prev => ({...prev, sizePerUnit: e.target.checked}))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            ขนาด/หน่วย
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-slate-900">
            <input type="checkbox" checked={visibleCols.minStock} onChange={(e) => setVisibleCols(prev => ({...prev, minStock: e.target.checked}))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            คงเหลือขั้นต่ำ
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-slate-900">
            <input type="checkbox" checked={visibleCols.minOrder} onChange={(e) => setVisibleCols(prev => ({...prev, minOrder: e.target.checked}))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            สั่งซื้อขั้นต่ำ
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-slate-900">
            <input type="checkbox" checked={visibleCols.supplier} onChange={(e) => setVisibleCols(prev => ({...prev, supplier: e.target.checked}))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            ผู้จัดจำหน่าย
          </label>
        </div>
      </div>

      <div className="text-[12.5px] font-bold text-amber-700 bg-amber-50/80 px-3.5 py-2.5 rounded-xl border border-amber-100/75 flex items-center justify-between gap-2 shadow-sm animate-pulse-slow">
        <span className="flex items-center gap-1.5 leading-tight">
          📱 สำหรับระบบแท็บเล็ต (Tablet): เลื่อนหรือปัดหน้าจอไปทางซ้าย-ขวา เพื่อตรวจสัญลักษ์นำทางและการเข้าถึงคอลัมน์ด้านนอกที่สมบูรณ์
        </span>
        <span className="text-[11px] text-amber-600 font-bold bg-white px-2 py-0.5 rounded-md border border-amber-200 shrink-0 hidden sm:inline">
          Swipe Left/Right ↔️
        </span>
      </div>
      <div ref={tableContainerRef} className="overflow-auto max-h-[550px] md:max-h-[68vh] border border-slate-200 rounded-2xl shadow-lg bg-white scrollbar-thin">
      <table className="w-full min-w-max border-collapse relative">
        <thead className="sticky top-0 z-40 shadow-md">
          <tr className="bg-slate-800 text-white border-b border-slate-700">
            {isAdmin && <th className="sticky left-0 z-50 px-1 py-2 w-[60px] min-w-[60px] max-w-[60px] text-center border-r border-slate-700 bg-slate-800 no-print text-[10px]">จัดการ</th>}
            <th className={cn("sticky z-50 px-1 py-2 text-center font-medium tracking-wide w-[45px] min-w-[45px] max-w-[45px] bg-slate-800 border-r border-slate-700 text-[10px]", isAdmin ? "left-[60px]" : "left-0")}>รูป</th>
            <th className={cn("sticky z-50 px-2 py-2 text-left font-medium tracking-wide w-[170px] min-w-[170px] max-w-[170px] bg-slate-800 border-r border-slate-700 text-[10px]", isAdmin ? "left-[105px]" : "left-[45px]")}>รายการสินค้า</th>
            {visibleCols.brand && <th className="px-2 py-2 text-left font-medium tracking-wide w-[80px] min-w-[80px] max-w-[80px] bg-slate-800 border-r border-slate-700 text-[10px]">ยี่ห้อ</th>}
            {visibleCols.sizePerUnit && <th className="px-2 py-2 text-left font-medium tracking-wide w-[80px] min-w-[80px] max-w-[80px] bg-slate-800 border-r border-slate-700 text-[10px]">ขนาด/หน่วย</th>}
            {visibleCols.minStock && <th className="px-2 py-2 text-center font-medium tracking-wide w-[70px] min-w-[70px] max-w-[70px] bg-slate-800 border-r border-slate-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)] text-[10px] leading-tight">คงเหลือ<br/>ขั้นต่ำ</th>}
            {visibleCols.minOrder && <th className="px-2 py-2 text-center font-medium tracking-wide w-[70px] min-w-[70px] max-w-[70px] bg-slate-800 shadow-xl border-r border-slate-700 text-[10px] leading-tight">สั่งซื้อ<br/>ขั้นต่ำ</th>}
            {visibleCols.supplier && <th className="px-2 py-2 text-left font-medium tracking-wide w-[90px] min-w-[90px] max-w-[90px] border-r border-slate-700 text-[10px]">ผู้จัดจำหน่าย</th>}
            {weekDays.map((day) => {
              const isToday = isSameDay(day, new Date());
              const dayOfWeek = day.getDay();
              const dayColors: Record<number, string> = {
                0: "bg-red-500 text-white",        // Sunday
                1: "bg-yellow-400 text-slate-900", // Monday
                2: "bg-pink-500 text-white",       // Tuesday
                3: "bg-green-500 text-white",      // Wednesday
                4: "bg-orange-500 text-white",     // Thursday
                5: "bg-blue-500 text-white",       // Friday
                6: "bg-purple-500 text-white",     // Saturday
              };

              return (
                <th key={day.toString()} data-is-today={isToday ? "true" : "false"} className={cn(
                  "px-1 py-1 text-center font-medium w-[130px] min-w-[130px] max-w-[130px] transition-colors border-r border-slate-700 last:border-0 relative",
                  dayColors[dayOfWeek],
                  isToday ? "ring-2 ring-inset ring-slate-800 shadow-inner font-bold" : ""
                )}>
                  <button
                    onClick={() => setDayToClear({ 
                      dateKey: format(day, 'yyyy-MM-dd'), 
                      label: `${format(day, 'EEE')} ${format(day, 'd/M')}` 
                    })}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/20 hover:bg-red-500/60 rounded border border-white/10 transition-all flex flex-col items-center justify-center group"
                    title="Clear Day Data"
                  >
                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" />
                  </button>

                  <div className="text-[10px] uppercase">{format(day, 'EEE')}</div>
                  <div className="text-[9px] opacity-90 mb-0.5">{format(day, 'd/M')}</div>
                  <div className="grid grid-cols-3 gap-0.5 text-[10px] bg-black/20 rounded px-0.5 py-0.5">
                    <div>เข้า</div>
                    <div>เบิก</div>
                    <div>เหลือ</div>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedIngredients)
            .sort(([catA], [catB]) => {
              const indexA = CATEGORIES.indexOf(catA as any);
              const indexB = CATEGORIES.indexOf(catB as any);
              if (indexA !== -1 && indexB !== -1) return indexA - indexB;
              if (indexA !== -1) return -1;
              if (indexB !== -1) return 1;
              return catA.localeCompare(catB);
            })
            .map(([category, items]) => (
            <React.Fragment key={category}>
              <tr className="bg-slate-100 border-y border-slate-200">
                <td colSpan={baseColsCount} className="p-0">
                  <div className="sticky left-0 w-fit p-1.5 pl-2 font-bold text-[11px] text-slate-700 flex items-center gap-1.5 bg-slate-100 z-20">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                    {category}
                  </div>
                </td>
              </tr>
              {items.map((item, index) => (
                <tr key={item.id} className={cn(
                  "group transition-all border-b border-slate-100 hover:bg-blue-50",
                  index % 2 === 0 ? "bg-white" : "bg-slate-50"
                )}>
                  {isAdmin && (
                    <td className="sticky left-0 z-20 p-1 w-[60px] min-w-[60px] max-w-[60px] border-r border-slate-100 text-center whitespace-nowrap bg-inherit no-print">
                      <div className="flex items-center justify-center gap-0.5">
                        <button 
                          onClick={() => onEditIngredient(item)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                          title="แก้ไข"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                        <button 
                          onClick={() => setItemToClear(item)}
                          className="p-1 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-all"
                          title="ล้างข้อมูลสัปดาห์นี้"
                        >
                          <RotateCcw size={12} />
                        </button>
                        <button 
                          onClick={() => setItemToDelete(item)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                          title="ลบ"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </td>
                  )}
                  <td className={cn("sticky z-20 p-1 w-[45px] min-w-[45px] max-w-[45px] border-r border-slate-100 font-medium text-slate-800 text-center bg-inherit", isAdmin ? "left-[60px]" : "left-0")}>
                    <div className="w-[20px] h-[20px] rounded-md overflow-hidden bg-slate-100 mx-auto flex items-center justify-center border border-slate-200">
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                          referrerPolicy="no-referrer" 
                          onClick={() => setSelectedImage(item.image!)}
                        />
                      ) : (
                        <ShoppingCart size={12} className="text-slate-300" />
                      )}
                    </div>
                  </td>
                  <td className={cn("sticky z-20 px-2 py-1.5 w-[170px] min-w-[170px] max-w-[170px] border-r border-slate-100 font-medium text-slate-800 bg-inherit shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]", isAdmin ? "left-[105px]" : "left-[45px]")}>
                    <div className="truncate text-[10px]" title={item.name}>{item.name}</div>
                  </td>
                  {visibleCols.brand && (
                    <td className="px-2 py-1.5 w-[80px] min-w-[80px] max-w-[80px] border-r border-slate-100 text-[10px] text-slate-600 bg-inherit hidden md:table-cell">
                      <div className="bg-slate-100 px-1 py-0.5 rounded text-[10px] inline-block text-slate-500 font-medium truncate max-w-full" title={item.brand || '-'}>
                        {item.brand || '-'}
                      </div>
                    </td>
                  )}
                  {visibleCols.sizePerUnit && (
                    <td className="px-2 py-1.5 w-[80px] min-w-[80px] max-w-[80px] border-r border-slate-100 text-[10px] text-slate-600 font-mono bg-inherit truncate" title={item.sizePerUnit || '-'}>
                      {item.sizePerUnit || '-'}
                    </td>
                  )}
                  {visibleCols.minStock && (
                    <td className="px-1 py-1.5 w-[70px] min-w-[70px] max-w-[70px] border-r border-slate-100 font-mono text-[10px] text-center text-slate-600 bg-inherit">
                      <span className="bg-orange-50 text-orange-700 px-1 py-0.5 rounded-full text-[10px] font-bold border border-orange-100">
                        {item.minStock} {item.unit}
                      </span>
                    </td>
                  )}
                  {visibleCols.minOrder && (
                    <td className="px-1 py-1.5 w-[70px] min-w-[70px] max-w-[70px] border-r border-slate-100 font-mono text-[10px] text-center text-slate-600 bg-inherit">
                      <span className="bg-purple-50 text-purple-700 px-1 py-0.5 rounded-full text-[10px] font-bold border border-purple-100">
                        {item.minOrder} {item.unit}
                      </span>
                    </td>
                  )}
                  {visibleCols.supplier && (
                    <td className="px-2 py-1.5 w-[90px] min-w-[90px] max-w-[90px] border-r border-slate-100 text-[10px] text-slate-600 bg-inherit group/supplier relative" title={item.supplier}>
                      <div className="truncate">
                        {item.supplier.split(',').map((sup, idx, arr) => {
                          const isPrimary = sup.includes('(หลัก)');
                          const text = sup.replace(' (หลัก)', '').trim();
                          return (
                            <span key={idx} className={isPrimary ? "font-bold text-amber-600" : ""}>
                              {text}
                              {isPrimary && <span className="text-amber-500 ml-0.5" title="ผู้จัดจำหน่ายหลัก">★</span>}
                              {idx < arr.length - 1 ? ", " : ""}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  )}
                  {weekDays.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const currentStockObj = computedStock[dateKey]?.[item.id] || { in: undefined, out: undefined, remaining: undefined, isAutoCalculated: false };

                    const isLowStock = currentStockObj.remaining !== undefined && currentStockObj.remaining < item.minStock;
                    const isToday = isSameDay(day, new Date());

                    return (
                      <td 
                        key={dateKey} 
                        className={cn(
                          "p-1 w-[130px] min-w-[130px] max-w-[130px] border-r border-slate-100 text-center relative transition-colors",
                          isToday ? "bg-blue-50/30" : ""
                        )}
                      >
                        <div className="grid grid-cols-3 gap-0.5 items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            className="w-full h-7 text-center focus:outline-none font-mono text-[10px] rounded border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:border-blue-400 disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            placeholder="0"
                            value={currentStockObj.in ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value);
                              onUpdateStock(item.id, day, 'in', val);
                            }}
                            disabled={isReadOnly}
                          />
                          <input
                            type="number"
                            min="0"
                            className="w-full h-7 text-center focus:outline-none font-mono text-[10px] rounded border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:border-blue-400 disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            placeholder="0"
                            value={currentStockObj.out ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value);
                              onUpdateStock(item.id, day, 'out', val);
                            }}
                            disabled={isReadOnly}
                          />
                          <div className="relative flex items-center justify-center">
                            <input
                              type="number"
                              min="0"
                              className={cn(
                                "w-full h-7 text-center focus:outline-none font-mono text-[10px] rounded border-2 transition-all shadow-sm disabled:opacity-75 disabled:cursor-not-allowed",
                                isLowStock 
                                  ? "border-red-300 bg-red-50 text-red-600 font-bold focus:border-red-500 focus:ring-2 focus:ring-red-200" 
                                  : currentStockObj.isAutoCalculated 
                                    ? "border-emerald-200 bg-emerald-50/30 text-emerald-700 font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                                    : currentStockObj.remaining !== undefined
                                      ? "border-blue-200 bg-white text-slate-900 font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                      : "border-slate-200 bg-slate-50 text-slate-400 focus:bg-white focus:border-blue-400 focus:text-slate-900"
                              )}
                              placeholder="0"
                              value={currentStockObj.remaining ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                onUpdateStock(item.id, day, 'remaining', val);
                              }}
                              title={currentStockObj.isAutoCalculated ? "คำนวณอัตโนมัติ" : "ระบุเอง"}
                              disabled={isReadOnly}
                            />
                            {isLowStock && (
                              <div className="absolute -top-1 -right-1">
                                <span className="flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
          {ingredients.length === 0 && (
            <tr>
              <td colSpan={baseColsCount} className="p-12 text-center text-slate-400">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                    <ShoppingCart size={32} className="text-slate-300" />
                  </div>
                  <p className="text-[13px] font-medium text-slate-500">ยังไม่มีรายการสินค้า</p>
                  <p className="text-[13px] text-slate-400">กดปุ่ม "เพิ่มรายการวัตถุดิบ" เพื่อเริ่มต้นใช้งาน</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors z-10"
              title="Close"
            >
              <X size={20} />
            </button>
            <img
              src={selectedImage}
              alt="Enlarged view"
              className="w-full h-full object-contain max-h-[85vh]"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

      {dayToClear && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDayToClear(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center transform transition-all animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <RotateCcw size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">ยืนยันการล้างข้อมูล</h3>
            <p className="text-slate-600 text-[14px] mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลสต็อกทั้งหมดของวันที่ <span className="font-bold text-slate-800">{dayToClear.label}</span>?
              <br />
              <span className="text-red-500 text-[12px] font-medium mt-2 block">** ข้อมูล เข้า, เบิก, คงเหลือ ของวันนี้จะถูกลบออกทั้งหมด</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDayToClear(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  onClearDay(dayToClear.dateKey);
                  setDayToClear(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
              >
                ยืนยันล้างข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {itemToClear && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setItemToClear(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-sm w-full text-center transform transition-all animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <RotateCcw size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">ยืนยันการล้างข้อมูล</h3>
            <p className="text-slate-600 text-[14px] mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูล <span className="font-bold text-slate-800">เข้า, เบิก, คงเหลือ</span> ทั้งหมดของ <span className="font-bold text-slate-800">{itemToClear.name}</span> ในสัปดาห์นี้?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setItemToClear(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  onClearIngredientWeek(itemToClear.id);
                  setItemToClear(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors shadow-lg shadow-orange-900/20"
              >
                ยืนยันล้างข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setItemToDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center transform transition-all" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">ยืนยันการลบรายการ</h3>
            <p className="text-slate-600 text-[14px] mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการลบ <span className="font-bold text-slate-800">{itemToDelete.name}</span>? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  onDeleteIngredient(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-[14px] font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
