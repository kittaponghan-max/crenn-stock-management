import React, { useMemo } from 'react';
import { Ingredient } from '../types';
import { format, parseISO, isSameDay } from 'date-fns';
import { Trash2, TrendingDown, Coffee, Calendar, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface BarWasteReportProps {
  ingredients: Ingredient[];
  checklistRecords: any[];
}

interface WasteItem {
  checkIn: number;
  checkOut: number;
  waste: number;
}

export function BarWasteReport({ ingredients, checklistRecords }: BarWasteReportProps) {
  const coffeeIngredients = ingredients.filter(ing => ing.category === 'Coffee');

  const dailyWaste = useMemo(() => {
    const wasteMap: Record<string, Record<string, WasteItem>> = {};

    // Group records by day
    const recordsByDay: Record<string, { checkIn?: any; checkOut?: any }> = {};
    
    checklistRecords.forEach(record => {
      const dateKey = format(parseISO(record.timestamp), 'yyyy-MM-dd');
      if (!recordsByDay[dateKey]) recordsByDay[dateKey] = {};
      
      if (record.type === 'Check-in') {
        recordsByDay[dateKey].checkIn = record;
      } else if (record.type === 'Check-out') {
        recordsByDay[dateKey].checkOut = record;
      }
    });

    // Calculate waste for each day where both check-in and check-out exist
    Object.entries(recordsByDay).forEach(([dateKey, records]) => {
      if (records.checkIn && records.checkOut) {
        const dayWaste: Record<string, WasteItem> = {};
        
        coffeeIngredients.forEach(ing => {
          const startWeight = parseFloat(records.checkIn.coffeeWeights?.[ing.id] || '0');
          const endWeight = parseFloat(records.checkOut.coffeeWeights?.[ing.id] || '0');
          
          if (startWeight > 0 || endWeight > 0) {
            dayWaste[ing.id] = {
              checkIn: startWeight,
              checkOut: endWeight,
              waste: Math.max(0, startWeight - endWeight)
            };
          }
        });

        if (Object.keys(dayWaste).length > 0) {
          wasteMap[dateKey] = dayWaste;
        }
      }
    });

    return Object.entries(wasteMap).sort((a, b) => b[0].localeCompare(a[0]));
  }, [ingredients, checklistRecords]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500 rounded-xl">
              <Trash2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">รายงาน Waste เมล็ดกาแฟรายวัน</h2>
              <p className="text-slate-400 text-xs mt-1">คำนวณจากน้ำหนักเมล็ดกาแฟตอน Check-in และ Check-out</p>
            </div>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">จำนวนบันทึก</div>
            <div className="text-xl font-black">{dailyWaste.length} วัน</div>
          </div>
        </div>

        <div className="p-6">
          {dailyWaste.length > 0 ? (
            <div className="space-y-8">
              {dailyWaste.map(([date, wasteData]) => (
                <div key={date} className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Calendar size={18} className="text-blue-500" />
                    <h3 className="font-bold text-slate-800">{format(parseISO(date), 'EEEEที่ d MMMM yyyy')}</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(wasteData).map(([ingId, data]) => {
                      const item = data as WasteItem;
                      const ingredient = ingredients.find(i => i.id === ingId);
                      if (!ingredient) return null;
                      
                      return (
                        <div key={ingId} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3 mb-4">
                            <img src={ingredient.image} alt={ingredient.name} className="w-10 h-10 rounded-lg object-cover border border-slate-100" referrerPolicy="no-referrer" />
                            <div>
                              <div className="text-sm font-bold text-slate-800">{ingredient.name}</div>
                              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{ingredient.brand}</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-blue-50 p-2 rounded-xl border border-blue-100">
                              <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">Check-in</div>
                              <div className="text-lg font-black text-blue-800">{item.checkIn} <span className="text-[10px] font-bold">กรัม</span></div>
                            </div>
                            <div className="bg-orange-50 p-2 rounded-xl border border-orange-100">
                              <div className="text-[10px] font-bold text-orange-600 uppercase mb-1">Check-out</div>
                              <div className="text-lg font-black text-orange-800">{item.checkOut} <span className="text-[10px] font-bold">กรัม</span></div>
                            </div>
                          </div>
                          
                          <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <TrendingDown size={16} className="text-red-600" />
                              <span className="text-xs font-bold text-red-700 uppercase">Waste (ปริมาณที่ใช้ไป)</span>
                            </div>
                            <div className="text-xl font-black text-red-800">{item.waste} <span className="text-xs font-bold">กรัม</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={40} className="text-slate-300" />
              </div>
              <h3 className="text-slate-800 font-bold text-lg mb-2">ยังไม่มีข้อมูลรายงาน Waste</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                ระบบจะคำนวณ Waste เมื่อมีการบันทึกทั้ง Check-in และ Check-out ในวันเดียวกัน พร้อมกรอกน้ำหนักเมล็ดกาแฟ
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
