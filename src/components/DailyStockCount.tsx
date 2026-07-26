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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-700 font-medium whitespace-nowrap">
              <CalendarIcon size={20} className="text-blue-600" />
              <span>เลือกวันที่ตรวจนับ:</span>
            </div>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto font-mono text-[13px]"
            />
          </div>
          {lastSubmittedDate && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium pl-1">
              <Clock size={14} className="text-slate-400" />
              <span>Last Submitted Date: <span className="text-slate-700">{lastSubmittedDate}</span></span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isReadOnly && (
            <>
              <button
                onClick={() => setCounts({})}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-[14px] font-bold hover:bg-slate-200 transition-all border border-slate-300"
              >
                <RotateCcw size={18} />
                ล้างข้อมูล
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-[14px] font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 transform hover:scale-105 active:scale-95 border border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
                {isSubmitting ? 'กำลังส่ง...' : 'ส่งรายงาน'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-auto max-h-[560px] border border-slate-200 rounded-xl shadow-lg bg-white scrollbar-thin">
        <table className="w-full min-w-max border-collapse relative">
          <thead className="sticky top-0 z-40 shadow-md">
            <tr className="bg-slate-800 text-white border-b border-slate-700">
              <th className="sticky left-0 z-50 px-2 py-3 text-center font-medium tracking-wide w-[50px] min-w-[50px] max-w-[50px] bg-slate-800 border-r border-slate-700 text-[12px]">รูป</th>
              <th className="sticky left-[50px] z-50 px-2 py-3 text-left font-medium tracking-wide w-[180px] min-w-[180px] max-w-[180px] bg-slate-800 border-r border-slate-700 text-[12px]">รายการสินค้า</th>
              <th className="sticky left-[230px] z-50 px-2 py-3 text-left font-medium tracking-wide w-[100px] min-w-[100px] max-w-[100px] bg-slate-800 border-r border-slate-700 text-[12px]">ยี่ห้อ</th>
              <th className="sticky left-[330px] z-50 px-2 py-3 text-left font-medium tracking-wide w-[100px] min-w-[100px] max-w-[100px] bg-slate-800 border-r border-slate-700 text-[12px]">ขนาด/หน่วย</th>
              <th className="px-2 py-3 text-center font-medium tracking-wide w-[90px] min-w-[90px] max-w-[90px] bg-slate-800 border-r border-slate-700 text-[12px] leading-tight">คงเหลือ<br/>ขั้นต่ำ</th>
              <th className="px-4 py-3 text-center font-bold tracking-wide w-[120px] min-w-[120px] max-w-[120px] bg-blue-600 border-r border-slate-700 text-[13px]">
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
                <tr className="bg-slate-100 border-y border-slate-200">
                  <td colSpan={6} className="p-0">
                    <div className="sticky left-0 w-fit p-3 pl-4 font-bold text-[13px] text-slate-700 flex items-center gap-2 bg-slate-100 z-20">
                      <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                      {category}
                    </div>
                  </td>
                </tr>
                {items.map((item, index) => {
                  const currentValue = counts[item.id];
                  const isLowStock = currentValue !== undefined && currentValue < item.minStock;

                  return (
                    <tr key={item.id} className={cn(
                      "group transition-all border-b border-slate-100 hover:bg-blue-50",
                      index % 2 === 0 ? "bg-white" : "bg-slate-50"
                    )}>
                      <td className="sticky left-0 z-20 p-1 w-[50px] min-w-[50px] max-w-[50px] border-r border-slate-100 font-medium text-slate-800 text-center bg-inherit">
                        <div className="w-[28px] h-[28px] rounded-md overflow-hidden bg-slate-100 mx-auto flex items-center justify-center border border-slate-200">
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0" 
                              referrerPolicy="no-referrer"
                              onClick={() => setSelectedImage(item.image!)}
                            />
                          ) : (
                            <ShoppingCart size={14} className="text-slate-300" />
                          )}
                        </div>
                      </td>
                      <td className="sticky left-[50px] z-20 px-2 py-2 w-[180px] min-w-[180px] max-w-[180px] border-r border-slate-100 font-medium text-slate-800 bg-inherit">
                        <div className="truncate text-[13px]" title={item.name}>{item.name}</div>
                      </td>
                      <td className="sticky left-[230px] z-20 px-2 py-2 w-[100px] min-w-[100px] max-w-[100px] border-r border-slate-100 text-[12px] text-slate-600 bg-inherit">
                        <div className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px] inline-block text-slate-500 font-medium truncate max-w-full" title={item.brand || '-'}>
                          {item.brand || '-'}
                        </div>
                      </td>
                      <td className="sticky left-[330px] z-20 px-2 py-2 w-[100px] min-w-[100px] max-w-[100px] border-r border-slate-100 text-[12px] text-slate-600 font-mono bg-inherit truncate" title={item.sizePerUnit || '-'}>
                        {item.sizePerUnit || '-'}
                      </td>
                      <td className="px-2 py-2 w-[90px] min-w-[90px] max-w-[90px] border-r border-slate-100 font-mono text-[12px] text-center text-slate-600 bg-inherit shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]">
                        <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full text-[12px] font-bold border border-orange-100">
                          {item.minStock} {item.unit}
                        </span>
                      </td>
                      <td className="p-2 w-[120px] min-w-[120px] max-w-[120px] border-r border-slate-100 text-center bg-blue-50/30">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            className={cn(
                              "w-full h-9 text-center focus:outline-none font-mono text-[13px] rounded-md border-2 bg-white transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed",
                              isLowStock
                                ? "border-red-400 text-red-600 shadow-sm focus:border-red-500 focus:ring-2 focus:ring-red-200"
                                : "border-blue-200 text-slate-900 font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
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
                            <div className="absolute top-1/2 -translate-y-1/2 right-3 text-red-500" title="ต่ำกว่ายอดคงเหลือขั้นต่ำ">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
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
                <td colSpan={6} className="p-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                      <ShoppingCart size={32} className="text-slate-300" />
                    </div>
                    <p className="text-[13px] font-medium text-slate-500">ยังไม่มีรายการสินค้า</p>
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
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
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
              alt="Enlarged ingredient"
              className="w-full h-full object-contain max-h-[85vh]"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowConfirmModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center transform transition-all animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">ยืนยันการส่งรายงาน</h3>
            <p className="text-slate-600 text-[14px] mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการส่งรายงานตรวจนับสต็อกประจำวันที่ <span className="font-bold text-slate-800">{format(new Date(selectedDate + 'T00:00:00'), 'dd/MM/yyyy')}</span>?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
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
