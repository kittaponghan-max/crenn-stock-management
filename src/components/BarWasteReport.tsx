import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Ingredient } from '../types';
import { format, parseISO, isSameDay } from 'date-fns';
import { Trash2, TrendingDown, Coffee, Calendar, ChevronRight, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

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
  const [liveChecklists, setLiveChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      let branch = 'Rayong';
      try {
        const raw = localStorage.getItem('cafe-user');
        if (raw) {
          const u = JSON.parse(raw);
          if (u.branch) branch = u.branch;
        }
      } catch (e) {}

      const { data, error } = await supabase
        .from('checklist_records')
        .select('*')
        .eq('branch', branch)
        .order('timestamp', { ascending: false })
        .limit(150);

      if (data) {
        setLiveChecklists(data.map((c: any) => ({
          id: c.id,
          timestamp: c.timestamp,
          type: c.type,
          reportDate: c.report_date,
          reporterName: c.reporter_name,
          ...c.data
        })));
      }
    } catch (e) {
      console.error('Error fetching checklist_records in BarWasteReport:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time Supabase subscription
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`bar-waste-checklist-rt-${Math.random().toString(36).substring(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_records' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Visibility and focus listeners
  useEffect(() => {
    const handleVis = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    const handleFoc = () => fetchData();
    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('focus', handleFoc);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('focus', handleFoc);
    };
  }, [fetchData]);

  const effectiveChecklists = liveChecklists.length > 0 ? liveChecklists : checklistRecords;
  const coffeeIngredients = ingredients.filter(ing => ing.category === 'Coffee');

  const dailyWaste = useMemo(() => {
    const wasteMap: Record<string, Record<string, WasteItem>> = {};

    // Group records by day
    const recordsByDay: Record<string, { checkIn?: any; checkOut?: any }> = {};
    
    effectiveChecklists.forEach(record => {
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
  }, [ingredients, effectiveChecklists]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 p-4 sm:p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500 rounded-xl shrink-0">
              <Trash2 size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">รายงาน Waste เมล็ดกาแฟรายวัน</h2>
              <p className="text-slate-400 text-xs mt-0.5">คำนวณจากน้ำหนักเมล็ดกาแฟตอน Check-in และ Check-out</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => fetchData()}
              disabled={loading}
              title="รีเฟรชข้อมูลล่าสุด (Sync with Supabase)"
              className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={16} className={cn(loading && "animate-spin text-red-400")} />
            </button>
            <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">จำนวนบันทึก</div>
              <div className="text-lg sm:text-xl font-black">{dailyWaste.length} วัน</div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
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
