import React, { useRef, useState } from 'react';
import { Ingredient, StockRecord, CATEGORIES } from '../types';
import { format, isSameDay, startOfWeek, addDays, subDays, differenceInDays } from 'date-fns';
import { AlertTriangle, Check, ShoppingCart, ChevronLeft, ChevronRight, X, RotateCcw, Pencil, Trash2 } from 'lucide-react';
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
    manage: true,
    brand: false,
    sizePerUnit: true,
    minStock: true,
    minOrder: true,
    supplier: false
  });

  const showManageCol = isAdmin && visibleCols.manage;

  const weekDays = React.useMemo(() => {
    const daysCount = Math.max(1, Math.min(7, differenceInDays(dateRange.end, dateRange.start) + 1));
    return Array.from({ length: daysCount }).map((_, i) => addDays(dateRange.start, i));
  }, [dateRange]);
  const isSingleDay = weekDays.length === 1;
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
    (showManageCol ? 1 : 0) + 
    2 + // รูป + รายการสินค้า
    (visibleCols.brand ? 1 : 0) +
    (visibleCols.sizePerUnit ? 1 : 0) +
    (visibleCols.minStock ? 1 : 0) +
    (visibleCols.minOrder ? 1 : 0) +
    (visibleCols.supplier ? 1 : 0) +
    weekDays.length;

  return (
    <div className="space-y-2.5 w-full">
      {/* ROW 3 — Column Visibility Bar */}
      <div className="flex flex-wrap sm:flex-nowrap gap-3 justify-between items-center bg-white p-2.5 sm:px-4 rounded-[10px] border border-[#D4E4E3] shadow-[0_1px_4px_rgba(90,138,136,0.06)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-medium text-[#6B8F8E]">แสดง:</span>
          <label className="flex items-center gap-1.5 text-[11px] text-[#2D4A49] font-normal cursor-pointer hover:text-[#5A8A88]">
            <input type="checkbox" checked={visibleCols.brand} onChange={(e) => setVisibleCols(prev => ({...prev, brand: e.target.checked}))} className="rounded border-[#D4E4E3] text-[#5A8A88] focus:ring-[#5A8A88] accent-[#5A8A88]" />
            ยี่ห้อ
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-[#2D4A49] font-normal cursor-pointer hover:text-[#5A8A88]">
            <input type="checkbox" checked={visibleCols.sizePerUnit} onChange={(e) => setVisibleCols(prev => ({...prev, sizePerUnit: e.target.checked}))} className="rounded border-[#D4E4E3] text-[#5A8A88] focus:ring-[#5A8A88] accent-[#5A8A88]" />
            ขนาด/หน่วย
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-[#2D4A49] font-normal cursor-pointer hover:text-[#5A8A88]">
            <input type="checkbox" checked={visibleCols.minStock} onChange={(e) => setVisibleCols(prev => ({...prev, minStock: e.target.checked}))} className="rounded border-[#D4E4E3] text-[#5A8A88] focus:ring-[#5A8A88] accent-[#5A8A88]" />
            คงเหลือขั้นต่ำ
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-[#2D4A49] font-normal cursor-pointer hover:text-[#5A8A88]">
            <input type="checkbox" checked={visibleCols.minOrder} onChange={(e) => setVisibleCols(prev => ({...prev, minOrder: e.target.checked}))} className="rounded border-[#D4E4E3] text-[#5A8A88] focus:ring-[#5A8A88] accent-[#5A8A88]" />
            สั่งซื้อขั้นต่ำ
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-[#2D4A49] font-normal cursor-pointer hover:text-[#5A8A88]">
            <input type="checkbox" checked={visibleCols.supplier} onChange={(e) => setVisibleCols(prev => ({...prev, supplier: e.target.checked}))} className="rounded border-[#D4E4E3] text-[#5A8A88] focus:ring-[#5A8A88] accent-[#5A8A88]" />
            ผู้จัดจำหน่าย
          </label>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-3 pl-3 sm:border-l sm:border-[#D4E4E3] ml-auto sm:ml-0">
            <label className="flex items-center gap-1.5 text-[11px] text-[#2D4A49] font-normal cursor-pointer hover:text-[#5A8A88]">
              <input 
                type="checkbox" 
                checked={visibleCols.manage} 
                onChange={(e) => setVisibleCols(prev => ({...prev, manage: e.target.checked}))} 
                className="rounded border-[#D4E4E3] text-[#5A8A88] focus:ring-[#5A8A88] accent-[#5A8A88]" 
              />
              จัดการ
            </label>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div 
        ref={tableContainerRef} 
        className={cn(
          "overflow-y-auto max-h-[550px] md:max-h-[68vh] border border-[#D4E4E3] rounded-xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] bg-white scrollbar-thin",
          isSingleDay ? "overflow-x-hidden" : "overflow-x-auto"
        )}
      >
      <table className={cn("w-full border-collapse relative", isSingleDay ? "table-fixed min-w-0" : "table-fixed min-w-[700px]")}>
        <thead className="sticky top-0 z-40 shadow-sm">
          <tr className="bg-[#2D4A49] text-white border-b-2 border-[#5A8A88]">
            {showManageCol && (
              <th className={cn(
                "px-1 py-2 text-center border-r border-[#3D6B69] bg-[#2D4A49] no-print text-[10px] font-semibold",
                isSingleDay ? "w-[44px] min-w-[44px] max-w-[44px]" : "sticky left-0 z-50 w-[56px] min-w-[56px] max-w-[56px]"
              )}>
                จัดการ
              </th>
            )}
            <th className={cn(
              "px-1 py-2 text-center font-semibold tracking-wide bg-[#2D4A49] border-r border-[#3D6B69] text-[10px]",
              isSingleDay 
                ? "w-[38px] min-w-[38px] max-w-[38px]" 
                : cn("sticky z-50 w-[48px] min-w-[48px] max-w-[48px]", showManageCol ? "left-[56px]" : "left-0")
            )}>
              รูป
            </th>
            <th className={cn(
              "px-2.5 py-2 text-left font-semibold tracking-wide bg-[#2D4A49] border-r border-[#3D6B69] text-[10px]",
              isSingleDay 
                ? "w-auto min-w-[120px]" 
                : cn("sticky z-50 w-[200px] min-w-[180px] max-w-[280px]", showManageCol ? "left-[104px]" : "left-[48px]")
            )}>
              รายการสินค้า
            </th>
            {visibleCols.brand && (
              <th className={cn(
                "px-2 py-2 text-left font-semibold tracking-wide bg-[#2D4A49] border-r border-[#3D6B69] text-[10px]",
                isSingleDay ? "w-[75px] min-w-[70px] max-w-[80px]" : "w-[90px] min-w-[90px] max-w-[90px]"
              )}>
                ยี่ห้อ
              </th>
            )}
            {visibleCols.sizePerUnit && (
              <th className={cn(
                "px-2 py-2 text-center font-semibold tracking-wide bg-[#2D4A49] border-r border-[#3D6B69] text-[10px]",
                isSingleDay ? "w-[75px] min-w-[70px] max-w-[80px]" : "w-[100px] min-w-[100px] max-w-[100px]"
              )}>
                ขนาด/หน่วย
              </th>
            )}
            {visibleCols.minStock && (
              <th className={cn(
                "px-1.5 py-2 text-center font-semibold tracking-wide bg-[#2D4A49] border-r border-[#3D6B69] text-[10px] leading-tight",
                isSingleDay ? "w-[68px] min-w-[65px] max-w-[72px]" : "w-[80px] min-w-[80px] max-w-[80px]"
              )}>
                คงเหลือ<br/>ขั้นต่ำ
              </th>
            )}
            {visibleCols.minOrder && (
              <th className={cn(
                "px-1.5 py-2 text-center font-semibold tracking-wide bg-[#2D4A49] border-r border-[#3D6B69] text-[10px] leading-tight",
                isSingleDay ? "w-[68px] min-w-[65px] max-w-[72px]" : "w-[80px] min-w-[80px] max-w-[80px]"
              )}>
                สั่งซื้อ<br/>ขั้นต่ำ
              </th>
            )}
            {visibleCols.supplier && (
              <th className={cn(
                "px-2 py-2 text-left font-semibold tracking-wide bg-[#2D4A49] border-r border-[#3D6B69] text-[10px]",
                isSingleDay ? "w-[85px] min-w-[80px] max-w-[90px]" : "w-[90px] min-w-[90px] max-w-[90px]"
              )}>
                ผู้จัดจำหน่าย
              </th>
            )}
            {weekDays.map((day) => {
              const isToday = isSameDay(day, new Date());

              return (
                <th key={day.toString()} data-is-today={isToday ? "true" : "false"} className={cn(
                  "px-1 py-1.5 text-center font-semibold transition-colors border-r border-[#3D6B69] last:border-0 relative bg-[#5A8A88] text-white",
                  isSingleDay ? "w-[135px] min-w-[125px] max-w-[145px]" : "w-[160px] min-w-[160px] max-w-[160px]",
                  isToday ? "ring-2 ring-inset ring-white/40 shadow-inner font-bold" : ""
                )}>
                  <button
                    onClick={() => setDayToClear({ 
                      dateKey: format(day, 'yyyy-MM-dd'), 
                      label: `${format(day, 'EEE')} ${format(day, 'd/M')}` 
                    })}
                    className="absolute top-1 right-1 w-4 h-4 bg-black/20 hover:bg-[#EF4444] rounded border border-white/20 transition-all flex flex-col items-center justify-center group"
                    title="ล้างข้อมูลของวันนี้"
                  >
                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform text-white" />
                  </button>

                  <div className="text-[10px] uppercase font-semibold text-white">{format(day, 'EEE')}</div>
                  <div className="text-[10px] font-normal text-white/90 mb-1">{format(day, 'd/M')}</div>
                  <div className="grid grid-cols-3 gap-1 text-[9px] sm:text-[10px] bg-[#4A7A78] rounded px-1 py-0.5 text-white font-medium text-center">
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
                  <div className="w-fit p-1.5 pl-3 font-semibold text-[10px] text-[#5A8A88] flex items-center gap-1.5 bg-[#F0F5F4] border-l-[3px] border-[#5A8A88]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88]"></span>
                    {category}
                  </div>
                </td>
              </tr>
              {items.map((item, index) => (
                <tr key={item.id} className={cn(
                  "group transition-colors border-b border-[#D4E4E3] hover:bg-[#E8F3F2]",
                  index % 2 === 0 ? "bg-white" : "bg-[#F8FAFA]"
                )}>
                  {showManageCol && (
                    <td className={cn(
                      "p-1 border-r border-[#D4E4E3] text-center whitespace-nowrap bg-inherit no-print",
                      isSingleDay ? "w-[44px] min-w-[44px] max-w-[44px]" : "sticky left-0 z-20 w-[56px] min-w-[56px] max-w-[56px]"
                    )}>
                      <div className="flex items-center justify-center gap-0.5">
                        <button 
                          onClick={() => onEditIngredient(item)}
                          className="p-1 text-[#5A8A88] hover:text-[#4A7A78] hover:bg-[#E8F3F2] rounded-[5px] transition-all"
                          title="แก้ไข"
                        >
                          <Pencil size={12} />
                        </button>
                        <button 
                          onClick={() => setItemToDelete(item)}
                          className="p-1 text-[#EF4444] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-[5px] transition-all"
                          title="ลบ"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                  <td className={cn(
                    "p-1 border-r border-[#D4E4E3] text-center bg-inherit",
                    isSingleDay 
                      ? "w-[38px] min-w-[38px] max-w-[38px]" 
                      : cn("sticky z-20 w-[48px] min-w-[48px] max-w-[48px]", showManageCol ? "left-[56px]" : "left-0")
                  )}>
                    <div className={cn(
                      "rounded-md overflow-hidden bg-[#F0F5F4] mx-auto flex items-center justify-center border border-[#D4E4E3]",
                      isSingleDay ? "w-[24px] h-[24px]" : "w-[28px] h-[28px]"
                    )}>
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                          referrerPolicy="no-referrer" 
                          onClick={() => setSelectedImage(item.image!)}
                        />
                      ) : (
                        <ShoppingCart size={isSingleDay ? 11 : 13} className="text-[#A8BCBB]" />
                      )}
                    </div>
                  </td>
                  <td className={cn(
                    "px-2.5 py-1.5 border-r border-[#D4E4E3] bg-inherit",
                    isSingleDay 
                      ? "w-auto min-w-[120px]" 
                      : cn("sticky z-20 w-[200px] min-w-[180px] max-w-[280px] shadow-[4px_0_8px_-2px_rgba(90,138,136,0.06)]", showManageCol ? "left-[104px]" : "left-[48px]")
                  )}>
                    <div className="truncate text-[10px] font-medium text-[#2D4A49]" title={item.name}>{item.name}</div>
                  </td>
                  {visibleCols.brand && (
                    <td className={cn(
                      "px-2 py-1.5 border-r border-[#D4E4E3] text-[10px] text-[#6B8F8E] font-normal bg-inherit hidden md:table-cell",
                      isSingleDay ? "w-[75px] min-w-[70px] max-w-[80px]" : "w-[90px] min-w-[90px] max-w-[90px]"
                    )}>
                      <div className="bg-[#F0F5F4] px-1.5 py-0.5 rounded text-[10px] inline-block text-[#6B8F8E] font-normal truncate max-w-full border border-[#D4E4E3]" title={item.brand || '-'}>
                        {item.brand || '-'}
                      </div>
                    </td>
                  )}
                  {visibleCols.sizePerUnit && (
                    <td className={cn(
                      "px-1.5 py-1.5 border-r border-[#D4E4E3] text-[10px] text-[#6B8F8E] font-normal text-center bg-inherit truncate",
                      isSingleDay ? "w-[75px] min-w-[70px] max-w-[80px]" : "w-[100px] min-w-[100px] max-w-[100px]"
                    )} title={item.sizePerUnit || '-'}>
                      {item.sizePerUnit || '-'}
                    </td>
                  )}
                  {visibleCols.minStock && (
                    <td className={cn(
                      "px-1 py-1.5 border-r border-[#D4E4E3] text-center bg-inherit",
                      isSingleDay ? "w-[68px] min-w-[65px] max-w-[72px]" : "w-[80px] min-w-[80px] max-w-[80px]"
                    )}>
                      <span className="bg-[#E8F3F2] text-[#5A8A88] px-1.5 py-0.5 rounded-md text-[10px] font-semibold border border-[#B8D4D2] inline-block">
                        {item.minStock} {item.unit}
                      </span>
                    </td>
                  )}
                  {visibleCols.minOrder && (
                    <td className={cn(
                      "px-1 py-1.5 border-r border-[#D4E4E3] text-center bg-inherit",
                      isSingleDay ? "w-[68px] min-w-[65px] max-w-[72px]" : "w-[80px] min-w-[80px] max-w-[80px]"
                    )}>
                      <span className="bg-[#FEF3C7] text-[#F59E0B] px-1.5 py-0.5 rounded-md text-[10px] font-semibold border border-[#FDE68A] inline-block">
                        {item.minOrder} {item.unit}
                      </span>
                    </td>
                  )}
                  {visibleCols.supplier && (
                    <td className={cn(
                      "px-2 py-1.5 border-r border-[#D4E4E3] text-[10px] text-[#6B8F8E] font-normal bg-inherit group/supplier relative",
                      isSingleDay ? "w-[85px] min-w-[80px] max-w-[90px]" : "w-[90px] min-w-[90px] max-w-[90px]"
                    )} title={item.supplier}>
                      <div className="truncate text-[10px] font-normal">
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
                          "p-1 border-r border-[#D4E4E3] text-center relative transition-colors",
                          isSingleDay ? "w-[135px] min-w-[125px] max-w-[145px]" : "w-[160px] min-w-[160px] max-w-[160px]",
                          isToday ? "bg-[#E8F3F2]/40" : ""
                        )}
                      >
                        <div className="grid grid-cols-3 gap-1 items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            className={cn(
                              "w-full text-center focus:outline-none font-mono tabular-nums text-[10px] font-medium rounded-md border border-[#D4E4E3] bg-white text-[#2D4A49] p-0.5 focus:bg-white focus:border-[#5A8A88] focus:ring-1 focus:ring-[#5A8A88]/20 disabled:opacity-50 disabled:bg-[#F0F5F4] disabled:cursor-not-allowed",
                              isSingleDay ? "h-6" : "h-7"
                            )}
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
                            className={cn(
                              "w-full text-center focus:outline-none font-mono tabular-nums text-[10px] font-medium rounded-md border border-[#D4E4E3] bg-white text-[#2D4A49] p-0.5 focus:bg-white focus:border-[#5A8A88] focus:ring-1 focus:ring-[#5A8A88]/20 disabled:opacity-50 disabled:bg-[#F0F5F4] disabled:cursor-not-allowed",
                              isSingleDay ? "h-6" : "h-7"
                            )}
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
                                "w-full text-center focus:outline-none font-mono tabular-nums text-[10px] font-medium rounded-md border p-0.5 transition-all shadow-xs disabled:opacity-75 disabled:cursor-not-allowed",
                                isSingleDay ? "h-6" : "h-7",
                                isLowStock 
                                  ? "border-[#FECACA] bg-[#FEE2E2] text-[#EF4444] font-semibold focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]/20" 
                                  : currentStockObj.isAutoCalculated 
                                    ? "border-[#B8D4D2] bg-[#E8F3F2] text-[#2D4A49] font-medium focus:border-[#5A8A88] focus:ring-1 focus:ring-[#5A8A88]/20"
                                    : currentStockObj.remaining !== undefined
                                      ? "border-[#5A8A88] bg-white text-[#2D4A49] font-semibold focus:border-[#5A8A88] focus:ring-1 focus:ring-[#5A8A88]/20"
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
                              <div className="absolute -top-1 -right-1 pointer-events-none">
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
                  <p className="text-[10px] font-semibold text-[#2D4A49]">ยังไม่มีรายการสินค้า</p>
                  <p className="text-[10px] text-[#6B8F8E]">กดปุ่ม "เพิ่มรายการวัตถุดิบ" เพื่อเริ่มต้นใช้งาน</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
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
  );
}
