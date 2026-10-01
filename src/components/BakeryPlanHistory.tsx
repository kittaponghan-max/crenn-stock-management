import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChevronLeft, 
  Calendar as CalendarIcon, 
  History, 
  RefreshCw, 
  Loader2, 
  ChevronRight, 
  ChevronUp 
} from 'lucide-react';
import { BakeryPlan } from './BakeryPlan';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export function BakeryPlanHistory({ onBack, branch }: { onBack: () => void; branch?: 'Rayong' | 'Bangkok' }) {
  const currentBranch = branch || (() => {
    try {
      const rawUser = localStorage.getItem('cafe-user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u.branch) return u.branch;
      }
    } catch (e) {}
    return 'Rayong';
  })();
  const [history, setHistory] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLastFetch] = useState<Date>(new Date());
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Monitor scroll for scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check local storage fallback first
      let localFallback: any[] = [];
      const saved = localStorage.getItem(`bakeryPlanHistory-${currentBranch}`) || (currentBranch === 'Rayong' ? localStorage.getItem('bakeryPlanHistory') : null);
      if (saved) {
        try {
          localFallback = JSON.parse(saved);
        } catch (e) {}
      }

      if (!supabase) {
        setHistory(localFallback);
        setLoading(false);
        return;
      }

      const query = supabase
        .from('bakery_plan_records')
        .select('*')
        .eq('branch', currentBranch)
        .order('week_key', { ascending: false });

      const { data, error: fetchErr } = await query;

      if (fetchErr) {
        console.error('Error fetching bakery_plan_records from Supabase:', fetchErr);
        setError(fetchErr.message);
        if (localFallback.length > 0) {
          setHistory(localFallback);
        }
      } else if (data && data.length > 0) {
        const mapped = data.map((r: any) => ({
          weekKey: r.week_key,
          weekLabel: r.week_label,
          savedAt: r.saved_at,
          userName: r.user_name,
          data: r.plan_data
        }));
        setHistory(mapped);
      } else {
        setHistory([]);
      }
    } catch (err: any) {
      console.error('Fetch exception in bakery_plan_records:', err);
      setError(err?.message || 'Error fetching data');
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, [currentBranch]);

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData, currentBranch]);

  // Real-time Supabase subscription
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`realtime-bakery_plan-${currentBranch}-${Math.random().toString(36).substring(2, 7)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bakery_plan_records'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Re-fetch on tab focus / visibilitychange
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    const handleFocus = () => {
      fetchData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchData]);

  // Selected Record View (Detail / Inspection)
  if (selectedRecord) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#D4E4E3] shadow-[0_2px_8px_rgba(90,138,136,0.08)]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedRecord(null)}
              title="ย้อนกลับไปรายการประวัติ"
              className="w-8 h-8 rounded-lg bg-white border border-[#D4E4E3] flex items-center justify-center text-[#5A8A88] hover:bg-[#E8F3F2] transition-colors cursor-pointer shrink-0"
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2D4A49]">
                ประวัติแผนงาน {selectedRecord.weekLabel?.startsWith('สัปดาห์ที่') ? selectedRecord.weekLabel : `สัปดาห์ที่ ${selectedRecord.weekLabel}`}
              </h2>
              <p className="text-xs text-[#6B8F8E] mt-0.5">
                บันทึกเมื่อ: {new Date(selectedRecord.savedAt).toLocaleString('th-TH')}
                {selectedRecord.userName ? ` โดย ${selectedRecord.userName}` : ''}
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block bg-[#E8F3F2] text-[#5A8A88] text-xs font-semibold px-3 py-1 rounded-full border border-[#D4E4E3]">
            โหมดดูย้อนหลัง (Read-Only)
          </span>
        </div>
        
        <div className="bg-[#F0F5F4] rounded-2xl p-2 sm:p-3 border border-[#D4E4E3]">
          <BakeryPlan 
            isReadOnly={true} 
            historyData={selectedRecord.data} 
            historyWeek={new Date(selectedRecord.weekKey)} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[700px] mx-auto space-y-4 animate-in fade-in duration-200">
      {/* 🔙 PAGE HEADER */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            title="กลับไปหน้าหลัก"
            className="w-8 h-8 rounded-lg bg-white border border-[#D4E4E3] flex items-center justify-center text-[#5A8A88] hover:bg-[#E8F3F2] transition-colors cursor-pointer shrink-0"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>

          {/* Icon badge */}
          <div className="w-9 h-9 rounded-[10px] bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] shrink-0">
            <History size={18} strokeWidth={2} />
          </div>

          {/* Title & Subtitle */}
          <div className="min-w-0">
            <h2 className="text-base sm:text-[18px] font-bold text-[#2D4A49] leading-tight truncate">
              ประวัติแผนงาน Bakery
            </h2>
            <p className="text-[11px] text-[#6B8F8E] mt-0.5 leading-tight truncate">
              ตรวจสอบประวัติแผนงานย้อนหลัง (เก็บสูงสุด 24 สัปดาห์)
            </p>
          </div>
        </div>

        {/* Right block — Refresh button */}
        <button
          type="button"
          onClick={() => fetchData()}
          disabled={loading}
          title="รีเฟรชข้อมูล (Sync with Supabase)"
          className="flex items-center gap-1.5 text-xs text-[#5A8A88] font-medium bg-white hover:bg-[#E8F3F2] px-3.5 py-2 rounded-lg border border-[#D4E4E3] transition-colors disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
        >
          <RefreshCw size={14} className={cn(loading && "animate-spin", "text-[#5A8A88]")} />
          <span>{loading ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
        </button>
      </div>

      {/* 📊 SUMMARY BADGE */}
      {history.length > 0 && (
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-xs text-[#6B8F8E]">
            รายการทั้งหมด
          </span>
          <span className="bg-[#E8F3F2] text-[#5A8A88] text-xs font-semibold px-2.5 py-0.5 rounded-md">
            {history.length} สัปดาห์
          </span>
        </div>
      )}

      {/* 📋 HISTORY LIST CARD */}
      <div className="bg-white rounded-2xl border border-[#D4E4E3] p-2 shadow-[0_2px_8px_rgba(90,138,136,0.08)] w-full overflow-hidden">
        {loading && history.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 className="text-[#5A8A88] animate-spin mb-3" size={28} />
            <p className="text-xs text-[#6B8F8E]">กำลังโหลดประวัติแผนงานจากระบบ...</p>
          </div>
        ) : history.length > 0 ? (
          <div>
            {history.map((record, index) => {
              const weekTitle = record.weekLabel?.startsWith('สัปดาห์ที่') 
                ? record.weekLabel 
                : `สัปดาห์ที่ ${record.weekLabel}`;

              return (
                <div
                  key={record.weekKey || index}
                  onClick={() => setSelectedRecord(record)}
                  className="flex items-center gap-3.5 p-3.5 rounded-xl cursor-pointer transition-all duration-150 relative bg-transparent hover:bg-[#E8F3F2] border-b border-[#F0F5F4] last:border-b-0 group"
                >
                  {/* LEFT — Calendar Icon Badge */}
                  <div className="w-10 h-10 rounded-xl bg-[#E8F3F2] border border-[#D4E4E3] flex items-center justify-center shrink-0 transition-colors group-hover:bg-[#B8D4D2]">
                    <CalendarIcon size={18} className="text-[#5A8A88] group-hover:text-[#2D4A49] transition-colors" />
                  </div>

                  {/* MIDDLE — Content block */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-bold text-[#2D4A49] truncate">
                        {weekTitle}
                      </h3>
                    </div>
                    <p className="text-[11px] font-normal text-[#6B8F8E] mt-0.5 truncate">
                      บันทึกเมื่อ: {new Date(record.savedAt).toLocaleString('th-TH')}
                      {record.userName ? ` (${record.userName})` : ''}
                    </p>
                  </div>

                  {/* RIGHT — Chevron */}
                  <ChevronRight size={16} className="text-[#A8BCBB] group-hover:text-[#5A8A88] transition-colors shrink-0" />
                </div>
              );
            })}
          </div>
        ) : (
          /* 📭 EMPTY STATE */
          <div className="p-10 text-center flex flex-col items-center justify-center">
            <CalendarIcon size={40} className="text-[#C5D5D3] mb-3" />
            <h4 className="text-sm font-semibold text-[#6B8F8E] mb-1">
              ยังไม่มีประวัติแผนงาน
            </h4>
            <p className="text-[11px] text-[#A8BCBB]">
              {error ? `ข้อผิดพลาด: ${error}` : 'ประวัติจะปรากฏเมื่อมีการบันทึกแผนงาน Bakery'}
            </p>
          </div>
        )}
      </div>

      {/* 🔼 "เลื่อนขึ้นบนสุด" BUTTON */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-[80px] right-5 z-40 bg-[#5A8A88] hover:bg-[#4A7A78] text-white rounded-[10px] px-4 py-2.5 shadow-[0_4px_12px_rgba(90,138,136,0.3)] flex items-center gap-1.5 transition-all duration-150 cursor-pointer text-xs font-medium animate-in fade-in slide-in-from-bottom-2"
        >
          <ChevronUp size={14} className="text-white" />
          <span>เลื่อนขึ้นบนสุด</span>
        </button>
      )}
    </div>
  );
}

export default BakeryPlanHistory;
