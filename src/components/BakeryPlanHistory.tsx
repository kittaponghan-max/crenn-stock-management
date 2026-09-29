import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Calendar as CalendarIcon, History, RefreshCw, Loader2 } from 'lucide-react';
import { BakeryPlan } from './BakeryPlan';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export function BakeryPlanHistory({ onBack }: { onBack: () => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check local storage fallback first
      let localFallback: any[] = [];
      const saved = localStorage.getItem('bakeryPlanHistory');
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

      let branch = 'Rayong';
      try {
        const rawUser = localStorage.getItem('cafe-user');
        if (rawUser) {
          const u = JSON.parse(rawUser);
          if (u.branch) branch = u.branch;
        }
      } catch (e) {}

      let query = supabase
        .from('bakery_plan_records')
        .select('*')
        .order('week_key', { ascending: false });

      if (branch) {
        query = query.eq('branch', branch);
      }

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
        setHistory(localFallback);
      }
    } catch (err: any) {
      console.error('Fetch exception in bakery_plan_records:', err);
      setError(err?.message || 'Error fetching data');
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time Supabase subscription
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`realtime-bakery_plan-${Math.random().toString(36).substring(2, 7)}`)
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

  if (selectedRecord) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedRecord(null)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <ChevronLeft size={24} className="text-slate-600" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                ประวัติแผนงาน {selectedRecord.weekLabel}
              </h2>
              <p className="text-sm text-slate-500">บันทึกเมื่อ: {new Date(selectedRecord.savedAt).toLocaleString('th-TH')}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-2xl p-2 border border-slate-200 shadow-sm">
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <ChevronLeft size={24} className="text-slate-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <History className="text-amber-500" />
              ประวัติแผนงาน Bakery
            </h2>
            <p className="text-slate-500">ตรวจสอบประวัติแผนงานย้อนหลัง (เก็บสูงสุด 24 สัปดาห์)</p>
          </div>
        </div>

        <button
          onClick={() => fetchData()}
          disabled={loading}
          title="รีเฟรชข้อมูล (Sync with Supabase)"
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
        >
          <RefreshCw size={14} className={cn(loading && "animate-spin text-amber-500")} />
          <span>{loading ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && history.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Loader2 className="text-slate-400 animate-spin mb-3" size={28} />
            <p className="text-slate-500 text-sm">กำลังโหลดประวัติแผนงานจากระบบ...</p>
          </div>
        ) : history.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {history.map((record, index) => (
              <div
                key={record.weekKey || index}
                onClick={() => setSelectedRecord(record)}
                className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                    <CalendarIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">สัปดาห์ที่ {record.weekLabel}</h3>
                    <p className="text-sm text-slate-500">บันทึกเมื่อ: {new Date(record.savedAt).toLocaleString('th-TH')}</p>
                  </div>
                </div>
                <ChevronLeft className="text-slate-300 rotate-180" />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500">
            ไม่มีข้อมูลประวัติย้อนหลัง
          </div>
        )}
      </div>
    </div>
  );
}
