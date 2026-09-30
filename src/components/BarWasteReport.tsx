import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Ingredient } from '../types';
import { format, parseISO } from 'date-fns';
import { Trash2, Calendar, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react';
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
  // Reliable data fetching pattern & real-time sync with Supabase
  const [liveChecklists, setLiveChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      let branch = 'Rayong';
      try {
        const savedUser = localStorage.getItem('cafe-user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed.branch) branch = parsed.branch;
        }
      } catch (e) {}

      let query = supabase
        .from('checklist_records')
        .select('*')
        .order('timestamp', { ascending: false });

      if (branch) {
        query = query.eq('branch', branch);
      }

      const { data, error: fetchErr } = await query.limit(150);

      if (fetchErr) {
        console.error('Error fetching checklist_records in BarWasteReport:', fetchErr);
        setError(fetchErr.message);
      } else if (data) {
        const mapped = data.map((c: any) => ({
          id: c.id,
          timestamp: c.timestamp,
          type: c.type,
          reportDate: c.report_date,
          reporterName: c.reporter_name,
          ...c.data
        }));
        setLiveChecklists(mapped);
      }
    } catch (err: any) {
      console.error('Fetch exception in BarWasteReport:', err);
      setError(err?.message || 'Failed to sync with Supabase');
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time listener for checklist_records
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`bar-waste-checklist-rt-${Math.random().toString(36).substring(2, 7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_records' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Tab visibility and window focus sync
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    const handleFocus = () => fetchData();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchData]);

  const effectiveChecklists = liveChecklists.length > 0 ? liveChecklists : checklistRecords;

  // Filter only Coffee Beans ingredients
  const coffeeIngredients = useMemo(() => {
    return ingredients.filter(i => 
      i.category?.toLowerCase().includes('coffee') || 
      i.name.includes('เมล็ดกาแฟ') || 
      i.name.includes('Coffee') ||
      i.id.includes('coffee')
    );
  }, [ingredients]);

  // Group checklists by date and match Check-in and Check-out
  const dailyWaste = useMemo(() => {
    const mapByDate: Record<string, { checkIn?: any; checkOut?: any }> = {};

    effectiveChecklists.forEach(record => {
      const dateKey = record.reportDate || (record.timestamp ? record.timestamp.split('T')[0] : '');
      if (!dateKey) return;

      if (!mapByDate[dateKey]) {
        mapByDate[dateKey] = {};
      }

      if (record.type === 'Check-in') {
        mapByDate[dateKey].checkIn = record;
      } else if (record.type === 'Check-out') {
        mapByDate[dateKey].checkOut = record;
      }
    });

    const wasteMap: Record<string, Record<string, WasteItem>> = {};

    Object.entries(mapByDate).forEach(([dateKey, records]) => {
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
  }, [ingredients, effectiveChecklists, coffeeIngredients]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] overflow-hidden">
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PAGE HEADER (REPLACED DARK BAND WITH WHITE CARD)
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="bg-white border-b border-[#D4E4E3] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Left block */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FEE2E2] rounded-xl shrink-0 flex items-center justify-center">
              <Trash2 size={20} className="text-[#EF4444]" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[#2D4A49]">
                รายงาน Waste เมล็ดกาแฟรายวัน
              </h2>
              <p className="text-[11px] text-[#6B8F8E] mt-0.5">
                คำนวณจากน้ำหนักเมล็ดกาแฟตอน Check-in และ Check-out
              </p>
            </div>
          </div>

          {/* Right — Summary badge */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <div className="flex items-center gap-3 bg-[#E8F3F2] border border-[#D4E4E3] rounded-xl px-5 py-2.5">
              <div>
                <div className="text-[10px] font-semibold text-[#6B8F8E] uppercase tracking-wider">
                  จำนวนบันทึก
                </div>
                <div className="text-[20px] font-extrabold text-[#2D4A49] leading-tight">
                  {dailyWaste.length} วัน
                </div>
              </div>
              <button
                type="button"
                onClick={() => fetchData()}
                disabled={loading}
                title="รีเฟรชข้อมูลล่าสุด (Sync with Supabase)"
                className="p-2 bg-white border border-[#D4E4E3] rounded-lg text-[#5A8A88] hover:bg-[#E8F3F2] transition-colors disabled:opacity-50 cursor-pointer shadow-xs shrink-0 ml-1"
              >
                <RefreshCw size={14} className={cn("text-[#5A8A88]", loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PAGE CONTENT & DATE GROUPS
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="p-4 sm:p-6">
          {dailyWaste.length > 0 ? (
            <div className="space-y-6">
              {dailyWaste.map(([date, wasteData]) => (
                <div key={date} className="space-y-3">
                  {/* Date Header: "Tuesdayที่ 29 September 2026" */}
                  <div className="flex items-center gap-2 pb-2 border-b border-[#E2EAE9]">
                    <Calendar size={14} className="text-[#5A8A88]" />
                    <h3 className="text-[13px] font-semibold text-[#2D4A49]">
                      {format(parseISO(date), 'EEEEที่ d MMMM yyyy')}
                    </h3>
                  </div>
                  
                  {/* Coffee Item Cards (grid): 3 cols PC/tablet, 1 col mobile, gap 12px */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(wasteData).map(([ingId, data]) => {
                      const item = data as WasteItem;
                      const ingredient = ingredients.find(i => i.id === ingId);
                      if (!ingredient) return null;

                      const isHighWaste = item.waste > 300; // Highlight if high waste
                      
                      return (
                        <div 
                          key={ingId} 
                          className="bg-white border border-[#D4E4E3] rounded-xl p-3.5 shadow-[0_1px_4px_rgba(90,138,136,0.06)] hover:shadow-md transition-shadow flex flex-col justify-between"
                        >
                          {/* Header row */}
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <img 
                              src={ingredient.image || '/coffee-placeholder.png'} 
                              alt={ingredient.name} 
                              className="w-9 h-9 rounded-lg object-cover border border-[#D4E4E3] shrink-0" 
                              referrerPolicy="no-referrer" 
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] font-bold text-[#2D4A49] truncate">
                                {ingredient.name}
                              </div>
                              <div className="text-[10px] text-[#6B8F8E] font-medium uppercase tracking-wider truncate">
                                {ingredient.brand || 'House Blend'}
                              </div>
                            </div>
                          </div>
                          
                          {/* Data grid (2 columns — CHECK-IN / CHECK-OUT) */}
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            {/* CHECK-IN */}
                            <div className="bg-[#E8F3F2] border border-[#D4E4E3] rounded-lg p-2 text-center">
                              <div className="text-[9px] font-semibold text-[#5A8A88] uppercase tracking-wider mb-0.5">
                                CHECK-IN
                              </div>
                              <div className="text-[15px] font-bold text-[#2D4A49]">
                                {item.checkIn} <span className="text-[10px] font-normal text-[#6B8F8E]">กรัม</span>
                              </div>
                            </div>

                            {/* CHECK-OUT */}
                            <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-lg p-2 text-center">
                              <div className="text-[9px] font-semibold text-[#F59E0B] uppercase tracking-wider mb-0.5">
                                CHECK-OUT
                              </div>
                              <div className="text-[15px] font-bold text-[#2D4A49]">
                                {item.checkOut} <span className="text-[10px] font-normal text-[#6B8F8E]">กรัม</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* WASTE ROW (full width, below grid) */}
                          <div className={cn(
                            "bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-3 py-2 mt-2 flex items-center justify-between",
                            isHighWaste && "border-l-[3px] border-l-[#EF4444]"
                          )}>
                            <div className="flex items-center gap-1.5">
                              {isHighWaste && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                              )}
                              <TrendingDown size={12} className="text-[#EF4444]" />
                              <span className="text-[9px] font-semibold text-[#EF4444] uppercase tracking-[0.05em]">
                                WASTE (ปริมาณที่ใช้ไป)
                              </span>
                            </div>
                            <div className="text-[15px] font-extrabold text-[#EF4444]">
                              {item.waste} <span className="text-[10px] font-semibold">กรัม</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-[#F0F5F4] rounded-full flex items-center justify-center mb-3">
                <AlertCircle size={32} className="text-[#A8BCBB]" />
              </div>
              <h3 className="text-[#2D4A49] font-bold text-[15px] mb-1">ยังไม่มีข้อมูลรายงาน Waste</h3>
              <p className="text-[#6B8F8E] text-[12px] max-w-md mx-auto">
                ระบบจะคำนวณ Waste เมื่อมีการบันทึกทั้ง Check-in และ Check-out ในวันเดียวกัน พร้อมกรอกน้ำหนักเมล็ดกาแฟ
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
