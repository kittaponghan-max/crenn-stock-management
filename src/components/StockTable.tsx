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
    <div className="space-y-2.5 w-full">
      {/* Column Visibility Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-2.5 sm:px-4 rounded-[10px] border border-[#D4E4E3] shadow-[0_1px_4px_rgba(90,138,136,0.06)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-[#6B8F8E]">แสดงคอลัมน์นี้:</span>
          <label className="flex items-center gap-1.5 text-xs text-[#2D4A49] font-medium cursor-pointer hover:text-[#5A8A88]">
            <input type="checkbox" checked={visibleCols.brand} onChange={(e) => setVisibleCols(prev => ({...prev, brand: e.target.checked}))} className="rounded border-[#D4E4E3] text-[#5A8A88] focus:ring-[#5A8A88] accent-[#5A8A88]" />
            ยี่ห้อ
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#2D4A49] font-medium cursor-pointer hover:text-[#5A8A88]">
            <input type="checkbox" checked={visibleCols.sizePerUnit} onChange={(e) => setVisibleCols(prev => ({...prev, sizePerUnit: e.target.checked}))} className="rounded border-[#D4E4E3] text-[#5A8A88] focus:ring-[#5A8A88] accent-[#5A8A88]" />
            ขนาด/หน่วย
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#2D4A49] font-medium cursor-pointer hover:text-[#5A8A88]">
            <input type="checkbox" checked={visibleCols.minStock} onChange={(e) => setVisibleCols(prev => ({...prev, minStock: e.target.checked}))} className="rounded border-[#D4E4E3] text-[#5A8A88] focus:ring-[#5A8A88] accent-[#5A8A88]" />
            คงเหลือขั้นต่ำ
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#2D4A49] font-medium cursor-pointer hover:text-[#5A8A88]">
            <input type="checkbox" checked={visibleCols.minOrder} onChange={(e) => setVisibleCols(prev => ({...prev, minOrder: e.target.checked}))} className="rounded border-[#D4E4E3] text-[#5A8A88] focus:ring-[#5A8A88] accent-[#5A8A88]" />
            สั่งซื้อขั้นต่ำ
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#2D4A49] font-medium cursor-pointer hover:text-[#5A8A88]">
            <input type="checkbox" checked={visibleCols.supplier} onChange={(e) => setVisibleCols(prev => ({...prev, supplier: e.target.checked}))} className="rounded border-[#D4E4E3] text-[#5A8A88] focus:ring-[#5A8A88] accent-[#5A8A88]" />
            ผู้จัดจำหน่าย
          </label>
        </div>
      </div>

      {/* Day Selector Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-[#2D4A49] text-white p-3 sm:px-4 rounded-xl shadow-xs">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#C5D5D3]">
          <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse"></span>
          <span>เลือกวันที่ต้องการดู:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {weekDays.map((day, idx) => {
            const isToday = isSameDay(day, new Date());
            return (
              <button
                key={day.toString()}
                type="button"
                onClick={() => {
                  if (tableContainerRef.current) {
                    const baseOffset = 260;
                    tableContainerRef.current.scrollTo({
                      left: baseOffset + (idx * 130),
                      behavior: 'smooth'
                    });
                  }
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all border active:scale-95",
                  isToday 
                    ? "bg-[#5A8A88] text-white border-[#7A9E9C] shadow-sm"
                    : "bg-white/10 text-[#C5D5D3] border-white/10 hover:bg-white/20 hover:text-white"
                )}
              >
                {format(day, 'EEE d/M')}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={tableContainerRef} className="overflow-auto max-h-[550px] md:max-h-[68vh] border border-[#D4E4E3] rounded-xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] bg-white scrollbar-thin">
      <table className="w-full min-w-max border-collapse relative">
        <thead className="sticky top-0 z-40 shadow-sm">
          <tr className="bg-[#2D4A49] text-white border-b-2 border-[#5A8A88]">
            {isAdmin && <th className="sticky left-0 z-50 px-1 py-2 w-[52px] sm:w-[60px] min-w-[52px] sm:min-w-[60px] text-center border-r border-[#3D6B69] bg-[#2D4A49] no-print text-[10px] font-semibold">จัดการ</th>}
            <th className={cn("sticky z-50 px-1 py-2 text-center font-semibold tracking-wide w-[36px] sm:w-[45px] min-w-[36px] sm:min-w-[45px] bg-[#2D4A49] border-r border-[#3D6B69] text-[10px]", isAdmin ? "left-[52px] sm:left-[60px]" : "left-0")}>รูป</th>
            <th className={cn("sticky z-50 px-2 py-2 text-left font-semibold tracking-wide w-[140px] sm:w-[170px] min-w-[140px] sm:min-w-[170px] bg-[#2D4A49] border-r border-[#3D6B69] text-[10px]", isAdmin ? "left-[88px] sm:left-[105px]" : "left-[36px] sm:left-[45px]")}>รายการสินค้า</th>
            {visibleCols.brand && <th className="px-2 py-2 text-left font-semibold tracking-wide w-[80px] min-w-[80px] max-w-[80px] bg-[#2D4A49] border-r border-[#3D6B69] text-[10px]">ยี่ห้อ</th>}
            {visibleCols.sizePerUnit && <th className="px-2 py-2 text-left font-semibold tracking-wide w-[80px] min-w-[80px] max-w-[80px] bg-[#2D4A49] border-r border-[#3D6B69] text-[10px]">ขนาด/หน่วย</th>}
            {visibleCols.minStock && <th className="px-2 py-2 text-center font-semibold tracking-wide w-[70px] min-w-[70px] max-w-[70px] bg-[#2D4A49] border-r border-[#3D6B69] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.2)] text-[10px] leading-tight">คงเหลือ<br/>ขั้นต่ำ</th>}
            {visibleCols.minOrder && <th className="px-2 py-2 text-center font-semibold tracking-wide w-[70px] min-w-[70px] max-w-[70px] bg-[#2D4A49] shadow-xl border-r border-[#3D6B69] text-[10px] leading-tight">สั่งซื้อ<br/>ขั้นต่ำ</th>}
            {visibleCols.supplier && <th className="px-2 py-2 text-left font-semibold tracking-wide w-[90px] min-w-[90px] max-w-[90px] bg-[#2D4A49] border-r border-[#3D6B69] text-[10px]">ผู้จัดจำหน่าย</th>}
            {weekDays.map((day) => {
              const isToday = isSameDay(day, new Date());

              return (
                <th key={day.toString()} data-is-today={isToday ? "true" : "false"} className={cn(
                  "px-1 py-1 text-center font-semibold w-[130px] min-w-[130px] max-w-[130px] transition-colors border-r border-[#3D6B69] last:border-0 relative bg-[#5A8A88] text-white",
                  isToday ? "ring-2 ring-inset ring-white/40 shadow-inner font-bold" : ""
                )}>
                  <button
                    onClick={() => setDayToClear({ 
                      dateKey: format(day, 'yyyy-MM-dd'), 
                      label: `${format(day, 'EEE')} ${format(day, 'd/M')}` 
                    })}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/20 hover:bg-[#EF4444] rounded border border-white/20 transition-all flex flex-col items-center justify-center group"
                    title="ล้างข้อมูลของวันนี้"
                  >
                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform text-white" />
                  </button>

                  <div className="text-[10px] uppercase font-bold text-white">{format(day, 'EEE')}</div>
                  <div className="text-[9px] text-white/90 mb-0.5">{format(day, 'd/M')}</div>
                  <div className="grid grid-cols-3 gap-0.5 text-[10px] bg-[#4A7A78] rounded px-0.5 py-0.5 text-white font-medium">
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
              <tr className="bg-[#F0F5F4] border-y border-[#D4E4E3]">
                <td colSpan={baseColsCount} className="p-0">
                  <div className="sticky left-0 w-fit p-2 pl-3 font-semibold text-xs text-[#5A8A88] flex items-center gap-2 bg-[#F0F5F4] z-20 border-l-[3px] border-[#5A8A88]">
                    <span className="w-2 h-2 rounded-full bg-[#5A8A88]"></span>
                    {category}
                  </div>
                </td>
              </tr>
              {items.map((item, index) => (
                <tr key={item.id} className={cn(
                  "group transition-colors border-b border-[#D4E4E3] hover:bg-[#E8F3F2]",
                  index % 2 === 0 ? "bg-white" : "bg-[#F8FAFA]"
                )}>
                  {isAdmin && (
                    <td className="sticky left-0 z-20 p-1 w-[52px] sm:w-[60px] min-w-[52px] sm:min-w-[60px] border-r border-[#D4E4E3] text-center whitespace-nowrap bg-inherit no-print">
                      <div className="flex items-center justify-center gap-0.5">
                        <button 
                          onClick={() => onEditIngredient(item)}
                          className="p-1 text-[#5A8A88] hover:text-[#4A7A78] hover:bg-[#E8F3F2] rounded-md transition-all"
                          title="แก้ไข"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                        <button 
                          onClick={() => setItemToClear(item)}
                          className="p-1 text-[#A8BCBB] hover:text-[#5A8A88] hover:bg-[#F0F5F4] rounded-md transition-all"
                          title="ล้างข้อมูลสัปดาห์นี้"
                        >
                          <RotateCcw size={13} />
                        </button>
                        <button 
                          onClick={() => setItemToDelete(item)}
                          className="p-1 text-[#EF4444] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-md transition-all"
                          title="ลบ"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </td>
                  )}
                  <td className={cn("sticky z-20 p-1 w-[36px] sm:w-[45px] min-w-[36px] sm:min-w-[45px] border-r border-[#D4E4E3] font-medium text-[#2D4A49] text-center bg-inherit", isAdmin ? "left-[52px] sm:left-[60px]" : "left-0")}>
                    <div className="w-[22px] h-[22px] rounded-md overflow-hidden bg-[#F0F5F4] mx-auto flex items-center justify-center border border-[#D4E4E3]">
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                          referrerPolicy="no-referrer" 
                          onClick={() => setSelectedImage(item.image!)}
                        />
                      ) : (
                        <ShoppingCart size={12} className="text-[#A8BCBB]" />
                      )}
                    </div>
                  </td>
                  <td className={cn("sticky z-20 px-2.5 py-1.5 w-[140px] sm:w-[170px] min-w-[140px] sm:min-w-[170px] border-r border-[#D4E4E3] font-medium text-[#2D4A49] bg-inherit shadow-[4px_0_8px_-2px_rgba(90,138,136,0.06)]", isAdmin ? "left-[88px] sm:left-[105px]" : "left-[36px] sm:left-[45px]")}>
                    <div className="truncate text-[12px] sm:text-[11px] font-semibold text-[#2D4A49]" title={item.name}>{item.name}</div>
                  </td>
                  {visibleCols.brand && (
                    <td className="px-2 py-1.5 w-[80px] min-w-[80px] max-w-[80px] border-r border-[#D4E4E3] text-[11px] text-[#6B8F8E] bg-inherit hidden md:table-cell">
                      <div className="bg-[#F0F5F4] px-1.5 py-0.5 rounded text-[10px] inline-block text-[#6B8F8E] font-medium truncate max-w-full border border-[#D4E4E3]" title={item.brand || '-'}>
                        {item.brand || '-'}
                      </div>
                    </td>
                  )}
                  {visibleCols.sizePerUnit && (
                    <td className="px-2 py-1.5 w-[80px] min-w-[80px] max-w-[80px] border-r border-[#D4E4E3] text-[11px] text-[#6B8F8E] font-mono bg-inherit truncate" title={item.sizePerUnit || '-'}>
                      {item.sizePerUnit || '-'}
                    </td>
                  )}
                  {visibleCols.minStock && (
                    <td className="px-1 py-1.5 w-[70px] min-w-[70px] max-w-[70px] border-r border-[#D4E4E3] font-mono text-[10px] text-center bg-inherit">
                      <span className="bg-[#E8F3F2] text-[#5A8A88] px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#B8D4D2]">
                        {item.minStock} {item.unit}
                      </span>
                    </td>
                  )}
                  {visibleCols.minOrder && (
                    <td className="px-1 py-1.5 w-[70px] min-w-[70px] max-w-[70px] border-r border-[#D4E4E3] font-mono text-[10px] text-center bg-inherit">
                      <span className="bg-[#FEF3C7] text-[#D97706] px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#FDE68A]">
                        {item.minOrder} {item.unit}
                      </span>
                    </td>
                  )}
                  {visibleCols.supplier && (
                    <td className="px-2 py-1.5 w-[90px] min-w-[90px] max-w-[90px] border-r border-[#D4E4E3] text-[11px] text-[#6B8F8E] bg-inherit group/supplier relative" title={item.supplier}>
                      <div className="truncate text-[11px]">
                        {item.supplier.split(',').map((sup, idx, arr) => {
                          const isPrimary = sup.includes('(หลัก)');
                          const text = sup.replace(' (หลัก)', '').trim();
                          return (
                            <span key={idx} className={isPrimary ? "font-bold text-[#5A8A88]" : ""}>
                              {text}
                              {isPrimary && <span className="text-[#F59E0B] ml-0.5" title="ผู้จัดจำหน่ายหลัก">★</span>}
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

                    const isLowStock = currentStockObj.remaining !== undefined && currentStockObj.remaining <= item.minStock;
                    const isToday = isSameDay(day, new Date());

                    return (
                      <td 
                        key={dateKey} 
                        className={cn(
                          "p-1 w-[130px] min-w-[130px] max-w-[130px] border-r border-[#D4E4E3] text-center relative transition-colors",
                          isToday ? "bg-[#E8F3F2]/40" : ""
                        )}
                      >
                        <div className="grid grid-cols-3 gap-0.5 items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            className="w-full h-8 sm:h-7 text-center focus:outline-none font-mono tabular-nums text-xs sm:text-[10px] rounded-md border border-[#D4E4E3] bg-white text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/20 disabled:opacity-50 disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
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
                            className="w-full h-8 sm:h-7 text-center focus:outline-none font-mono tabular-nums text-xs sm:text-[10px] rounded-md border border-[#D4E4E3] bg-white text-[#2D4A49] focus:bg-white focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/20 disabled:opacity-50 disabled:bg-[#F0F5F4] disabled:cursor-not-allowed"
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
                                "w-full h-8 sm:h-7 text-center focus:outline-none font-mono tabular-nums text-xs sm:text-[10px] rounded-md border transition-all shadow-xs disabled:opacity-75 disabled:cursor-not-allowed",
                                isLowStock 
                                  ? "border-[#FECACA] bg-[#FEE2E2] text-[#EF4444] font-bold focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/20" 
                                  : currentStockObj.isAutoCalculated 
                                    ? "border-[#B8D4D2] bg-[#E8F3F2] text-[#2D4A49] font-medium focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/20"
                                    : currentStockObj.remaining !== undefined
                                      ? "border-[#5A8A88] bg-white text-[#2D4A49] font-bold focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/20"
                                      : "border-[#D4E4E3] bg-[#F0F5F4] text-[#6B8F8E] focus:bg-white focus:border-[#5A8A88] focus:text-[#2D4A49]"
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
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#EF4444]"></span>
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
              <td colSpan={baseColsCount} className="p-12 text-center text-[#6B8F8E]">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 bg-[#F0F5F4] rounded-full flex items-center justify-center border border-[#D4E4E3]">
                    <ShoppingCart size={32} className="text-[#A8BCBB]" />
                  </div>
                  <p className="text-[14px] font-bold text-[#2D4A49]">ยังไม่มีรายการสินค้า</p>
                  <p className="text-[13px] text-[#6B8F8E]">กดปุ่ม "เพิ่มรายการวัตถุดิบ" เพื่อเริ่มต้นใช้งาน</p>
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
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#D4E4E3]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-3 right-3 p-2 bg-[#2D4A49]/80 hover:bg-[#2D4A49] text-white rounded-full transition-colors z-10"
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
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center transform transition-all animate-in zoom-in-95 duration-200 border border-[#D4E4E3]" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-100 text-[#EF4444] rounded-full flex items-center justify-center mx-auto mb-4">
              <RotateCcw size={32} />
            </div>
            <h3 className="text-lg font-bold text-[#2D4A49] mb-2">ยืนยันการล้างข้อมูล</h3>
            <p className="text-[#6B8F8E] text-[14px] mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลสต็อกทั้งหมดของวันที่ <span className="font-bold text-[#2D4A49]">{dayToClear.label}</span>?
              <br />
              <span className="text-[#EF4444] text-[12px] font-medium mt-2 block">** ข้อมูล เข้า, เบิก, คงเหลือ ของวันนี้จะถูกลบออกทั้งหมด</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDayToClear(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-[#2D4A49] bg-[#F0F5F4] hover:bg-[#E8F3F2] transition-colors border border-[#D4E4E3]"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  onClearDay(dayToClear.dateKey);
                  setDayToClear(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white bg-[#EF4444] hover:bg-[#DC2626] transition-colors shadow-md"
              >
                ยืนยันล้างข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {itemToClear && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setItemToClear(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center transform transition-all animate-in zoom-in-95 duration-200 border border-[#D4E4E3]" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-amber-100 text-[#F59E0B] rounded-full flex items-center justify-center mx-auto mb-4">
              <RotateCcw size={32} />
            </div>
            <h3 className="text-lg font-bold text-[#2D4A49] mb-2">ยืนยันการล้างข้อมูล</h3>
            <p className="text-[#6B8F8E] text-[14px] mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูล <span className="font-bold text-[#2D4A49]">เข้า, เบิก, คงเหลือ</span> ทั้งหมดของ <span className="font-bold text-[#2D4A49]">{itemToClear.name}</span> ในสัปดาห์นี้?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setItemToClear(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-[#2D4A49] bg-[#F0F5F4] hover:bg-[#E8F3F2] transition-colors border border-[#D4E4E3]"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  onClearIngredientWeek(itemToClear.id);
                  setItemToClear(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white bg-[#F59E0B] hover:bg-[#D97706] transition-colors shadow-md"
              >
                ยืนยันล้างข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setItemToDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center transform transition-all border border-[#D4E4E3]" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-100 text-[#EF4444] rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-[#2D4A49] mb-2">ยืนยันการลบรายการ</h3>
            <p className="text-[#6B8F8E] text-[14px] mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการลบ <span className="font-bold text-[#2D4A49]">{itemToDelete.name}</span>? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-[#2D4A49] bg-[#F0F5F4] hover:bg-[#E8F3F2] transition-colors border border-[#D4E4E3]"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  onDeleteIngredient(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white bg-[#EF4444] hover:bg-[#DC2626] transition-colors shadow-md"
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
