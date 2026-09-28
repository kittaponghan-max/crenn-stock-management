import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Ingredient, StockRecord, CATEGORIES } from '../types';
import { format } from 'date-fns';
import { ShoppingCart, Send, Calendar as CalendarIcon, RotateCcw, Clock, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface DailyStockCountProps {
  ingredients: Ingredient[];
  stockRecord: StockRecord;
  onSubmit: (dateKey: string, counts: Record<string, number>) => Promise<void> | void;
  isReadOnly?: boolean;
}

export function DailyStockCount({ ingredients, stockRecord, onSubmit, isReadOnly = false }: DailyStockCountProps) {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Initialize counts when date changes, but not automatically when stockRecord changes
  useEffect(() => {
    const dateKey = selectedDate;
    const newCounts: Record<string, number> = {};
    ingredients.forEach(ing => {
      const val = stockRecord[dateKey]?.[ing.id];
      const remaining = typeof val === 'number' ? val : val?.remaining;
      if (remaining !== undefined) {
        newCounts[ing.id] = remaining;
      }
    });
    setCounts(newCounts);
  }, [selectedDate, ingredients]); // Removed stockRecord to prevent auto-fill after submit

  const lastSubmittedDate = useMemo(() => {
    const dates = Object.keys(stockRecord).filter(dateKey => {
      const recordsForDate = stockRecord[dateKey];
      return Object.keys(recordsForDate).some(ingId => ingredients.some(ing => ing.id === ingId));
    });
    if (dates.length === 0) return null;
    return dates.sort().reverse()[0];
  }, [stockRecord, ingredients]);

  const groupedIngredients = useMemo(() => {
    return ingredients.reduce((acc, ing) => {
      if (!acc[ing.category]) acc[ing.category] = [];
      acc[ing.category].push(ing);
      return acc;
    }, {} as Record<string, Ingredient[]>);
  }, [ingredients]);

  const handleSubmit = () => {
    if (Object.keys(counts).length === 0) {
      alert('กรุณากรอกข้อมูลอย่างน้อย 1 รายการ');
      return;
    }
    
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    await onSubmit(selectedDate, counts);
    setCounts({}); // Clear the count data for the next entry
    setShowConfirmModal(false);
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-xl shadow-xs border border-[#D4E4E3] gap-4">
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[#2D4A49] font-medium whitespace-nowrap">
              <CalendarIcon size={20} className="text-[#5A8A88]" />
              <span className="font-semibold">เลือกวันที่ตรวจนับ:</span>
            </div>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-[#D4E4E3] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5A8A88]/20 focus:border-[#5A8A88] w-full sm:w-auto font-mono text-[13px] text-[#2D4A49]"
            />
          </div>
          {lastSubmittedDate && (
            <div className="flex items-center gap-1.5 text-xs text-[#6B8F8E] font-medium pl-1">
              <Clock size={14} className="text-[#6B8F8E]" />
              <span>Last Submitted Date: <span className="text-[#2D4A49] font-semibold">{lastSubmittedDate}</span></span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isReadOnly && (
            <>
              <button
                onClick={() => setCounts({})}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#F0F5F4] text-[#2D4A49] px-4 py-2.5 rounded-xl text-[14px] font-bold hover:bg-[#E8F3F2] transition-all border border-[#D4E4E3]"
              >
                <RotateCcw size={18} className="text-[#5A8A88]" />
                ล้างข้อมูล
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#5A8A88] text-white px-6 py-2.5 rounded-xl text-[14px] font-bold hover:bg-[#4A7A78] transition-all shadow-md transform hover:scale-105 active:scale-95 border border-[#5A8A88] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
                {isSubmitting ? 'กำลังส่ง...' : 'ส่งรายงาน'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-auto max-h-[560px] border border-[#D4E4E3] rounded-xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] bg-white scrollbar-thin">
        <table className="w-full min-w-max border-collapse relative">
          <thead className="sticky top-0 z-40 shadow-sm">
            <tr className="bg-[#2D4A49] text-white border-b-2 border-[#5A8A88]">
              <th className="sticky left-0 z-50 px-2 py-3 text-center font-semibold tracking-wide w-[45px] min-w-[45px] max-w-[45px] bg-[#2D4A49] border-r border-[#3D6B69] text-xs">รูป</th>
              <th className="sticky left-[45px] z-50 px-3 py-3 text-left font-semibold tracking-wide w-[170px] min-w-[170px] max-w-[170px] bg-[#2D4A49] border-r border-[#3D6B69] text-xs shadow-[2px_0_6px_-1px_rgba(0,0,0,0.2)]">รายการสินค้า</th>
              <th className="hidden md:table-cell px-2 py-3 text-left font-semibold tracking-wide w-[100px] min-w-[100px] max-w-[100px] bg-[#2D4A49] border-r border-[#3D6B69] text-xs">ยี่ห้อ</th>
              <th className="hidden md:table-cell px-2 py-3 text-left font-semibold tracking-wide w-[100px] min-w-[100px] max-w-[100px] bg-[#2D4A49] border-r border-[#3D6B69] text-xs">ขนาด/หน่วย</th>
              <th className="px-2 py-3 text-center font-semibold tracking-wide w-[85px] min-w-[85px] max-w-[85px] bg-[#2D4A49] border-r border-[#3D6B69] text-xs leading-tight">คงเหลือ<br/>ขั้นต่ำ</th>
              <th className="px-3 py-3 text-center font-bold tracking-wide w-[120px] min-w-[120px] max-w-[120px] bg-[#5A8A88] border-r border-[#3D6B69] text-sm text-white">
                ยอดตรวจนับ
              </th>
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
              .map(([category, items]: [string, Ingredient[]]) => (
              <React.Fragment key={category}>
                <tr className="bg-[#F0F5F4] border-y border-[#D4E4E3]">
                  <td colSpan={6} className="p-0">
                    <div className="sticky left-0 w-fit p-2.5 pl-4 font-semibold text-xs text-[#5A8A88] flex items-center gap-2 bg-[#F0F5F4] z-20 border-l-[3px] border-[#5A8A88]">
                      <span className="w-2 h-2 rounded-full bg-[#5A8A88]"></span>
                      {category}
                    </div>
                  </td>
                </tr>
                {items.map((item, index) => {
                  const currentValue = counts[item.id];
                  const isLowStock = currentValue !== undefined && currentValue <= item.minStock;

                  return (
                    <tr key={item.id} className={cn(
                      "group transition-colors border-b border-[#D4E4E3] hover:bg-[#E8F3F2]",
                      index % 2 === 0 ? "bg-white" : "bg-[#F8FAFA]"
                    )}>
                      <td className="sticky left-0 z-20 p-1 w-[45px] min-w-[45px] max-w-[45px] border-r border-[#D4E4E3] font-medium text-[#2D4A49] text-center bg-inherit">
                        <div className="w-[30px] h-[30px] rounded-lg overflow-hidden bg-[#F0F5F4] mx-auto flex items-center justify-center border border-[#D4E4E3]">
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0" 
                              referrerPolicy="no-referrer"
                              onClick={() => setSelectedImage(item.image!)}
                            />
                          ) : (
                            <ShoppingCart size={14} className="text-[#A8BCBB]" />
                          )}
                        </div>
                      </td>
                      <td className="sticky left-[45px] z-20 px-2.5 py-2 w-[170px] min-w-[170px] max-w-[170px] border-r border-[#D4E4E3] font-medium text-[#2D4A49] bg-inherit shadow-[2px_0_6px_-1px_rgba(90,138,136,0.06)]">
                        <div className="truncate text-xs font-semibold text-[#2D4A49]" title={item.name}>{item.name}</div>
                        <div className="text-[11px] text-[#6B8F8E] truncate md:hidden mt-0.5">
                          {item.brand ? <span>{item.brand} · </span> : null}
                          <span>{item.sizePerUnit || item.unit}</span>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-2 py-2 w-[100px] min-w-[100px] max-w-[100px] border-r border-[#D4E4E3] text-xs text-[#6B8F8E] bg-inherit">
                        <div className="bg-[#F0F5F4] px-1.5 py-0.5 rounded text-xs inline-block text-[#6B8F8E] font-medium truncate max-w-full border border-[#D4E4E3]" title={item.brand || '-'}>
                          {item.brand || '-'}
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-2 py-2 w-[100px] min-w-[100px] max-w-[100px] border-r border-[#D4E4E3] text-xs text-[#6B8F8E] font-mono bg-inherit truncate" title={item.sizePerUnit || '-'}>
                        {item.sizePerUnit || '-'}
                      </td>
                      <td className="px-2 py-2 w-[85px] min-w-[85px] max-w-[85px] border-r border-[#D4E4E3] font-mono text-xs text-center bg-inherit">
                        <span className="bg-[#E8F3F2] text-[#5A8A88] px-2 py-0.5 rounded-full text-xs font-bold border border-[#B8D4D2] tabular-nums">
                          {item.minStock} {item.unit}
                        </span>
                      </td>
                      <td className="p-1.5 w-[120px] min-w-[120px] max-w-[120px] border-r border-[#D4E4E3] text-center bg-[#E8F3F2]/30">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            className={cn(
                              "w-full h-10 text-center focus:outline-none font-mono text-sm rounded-lg border-2 bg-white transition-all disabled:opacity-50 disabled:bg-[#F0F5F4] disabled:cursor-not-allowed tabular-nums",
                              isLowStock
                                ? "border-[#FECACA] bg-[#FEE2E2] text-[#EF4444] font-bold shadow-xs focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/20"
                                : "border-[#D4E4E3] text-[#2D4A49] font-bold focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/20 shadow-xs"
                            )}
                            placeholder="0"
                            value={currentValue ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value);
                              setCounts(prev => {
                                if (val === undefined) {
                                  const { [item.id]: _, ...rest } = prev;
                                  return rest;
                                }
                                return { ...prev, [item.id]: val };
                              });
                            }}
                            disabled={isReadOnly}
                          />
                          {isLowStock && (
                            <div className="absolute top-1/2 -translate-y-1/2 right-2.5 text-[#EF4444] pointer-events-none" title="ต่ำกว่ายอดคงเหลือขั้นต่ำ">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {ingredients.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-[#6B8F8E]">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 bg-[#F0F5F4] rounded-full flex items-center justify-center border border-[#D4E4E3]">
                      <ShoppingCart size={32} className="text-[#A8BCBB]" />
                    </div>
                    <p className="text-[14px] font-bold text-[#2D4A49]">ยังไม่มีรายการสินค้า</p>
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
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[#D4E4E3]"
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
              alt="Enlarged ingredient" 
              className="w-full h-full object-contain max-h-[85vh]"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowConfirmModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center transform transition-all animate-in zoom-in-95 duration-200 border border-[#D4E4E3]" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-[#E8F3F2] text-[#5A8A88] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#B8D4D2]">
              <Send size={32} />
            </div>
            <h3 className="text-lg font-bold text-[#2D4A49] mb-2">ยืนยันการส่งรายงาน</h3>
            <p className="text-[#6B8F8E] text-[14px] mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการส่งรายงานตรวจนับสต็อกประจำวันที่ <span className="font-bold text-[#2D4A49]">{format(new Date(selectedDate + 'T00:00:00'), 'dd/MM/yyyy')}</span>?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-[#2D4A49] bg-[#F0F5F4] hover:bg-[#E8F3F2] transition-colors border border-[#D4E4E3]"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white bg-[#5A8A88] hover:bg-[#4A7A78] transition-colors shadow-md"
              >
                ยืนยันส่งรายงาน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
