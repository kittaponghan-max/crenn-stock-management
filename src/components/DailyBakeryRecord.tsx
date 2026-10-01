import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Cake, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Save, 
  Download, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Info,
  CalendarDays
} from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { th } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

export interface DailyBakeryRecordProps {
  user?: {
    name: string;
    role?: string;
    branch?: string;
  } | null;
  branch?: string;
  onNavigate?: (tab: string) => void;
}

export interface BakeryItemDef {
  id: string;
  name: string;
  category: string;
}

export interface BakeryDayRecord {
  totalQty: number | '';
  lineQty: number | '';
  storeQty: number | '';
  soldQty: number | '';
  note: string;
}

const DEFAULT_BAKERY_ITEMS: BakeryItemDef[] = [
  // หมวด 1: ครัวซอง & เดนิส
  { id: '1', name: 'ครัวซอง เนยสด', category: 'ครัวซอง & เดนิส' },
  { id: '2', name: 'อัลมอนด์', category: 'ครัวซอง & เดนิส' },
  { id: '3', name: 'แฮมชีส', category: 'ครัวซอง & เดนิส' },
  { id: '4', name: 'ครัฟฟิน', category: 'ครัวซอง & เดนิส' },
  { id: '5', name: 'ช็อคโก', category: 'ครัวซอง & เดนิส' },
  { id: '6', name: 'ลูกเกด', category: 'ครัวซอง & เดนิส' },
  { id: '7', name: 'เดนิส ผักโขม', category: 'ครัวซอง & เดนิส' },
  { id: '8', name: 'เดนิส สตรอว์', category: 'ครัวซอง & เดนิส' },
  { id: '9', name: 'เดนิส บลูเบอรี่', category: 'ครัวซอง & เดนิส' },

  // หมวด 2: เบเกอรี่ & เค้กอื่นๆ
  { id: '10', name: 'โบว์', category: 'ขนม & เค้กอื่นๆ' },
  { id: '11', name: 'แป้งชุย', category: 'ขนม & เค้กอื่นๆ' },
  { id: '12', name: 'ลาซานญ่า', category: 'ขนม & เค้กอื่นๆ' },
  { id: '13', name: 'เค้กกล้วยหอม', category: 'ขนม & เค้กอื่นๆ' },
  { id: '14', name: 'เค้กแครอท', category: 'ขนม & เค้กอื่นๆ' },
  { id: '15', name: 'โทส', category: 'ขนม & เค้กอื่นๆ' },
  { id: '16', name: 'คุกกี้เนยสด', category: 'ขนม & เค้กอื่นๆ' },
  { id: '17', name: 'บราวนี่', category: 'ขนม & เค้กอื่นๆ' },
  { id: '18', name: 'ชีสเค้ก', category: 'ขนม & เค้กอื่นๆ' },
];

export function DailyBakeryRecord({ user, branch = 'Rayong', onNavigate }: DailyBakeryRecordProps) {
  const currentBranch = branch || user?.branch || 'Rayong';
  const recorderName = user?.name || 'Admin';

  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  // active Day pair index: 0 = Mon-Tue, 1 = Wed-Thu, 2 = Fri-Sat, 3 = Sun (+Mon next)
  const [dayPairIndex, setDayPairIndex] = useState<number>(0);
  const [viewAllDays, setViewAllDays] = useState<boolean>(false);

  // Data state: records[itemName][dateStr] = BakeryDayRecord
  const [records, setRecords] = useState<Record<string, Record<string, BakeryDayRecord>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [tableExistsWarning, setTableExistsWarning] = useState<string | null>(null);

  // 7 days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(currentWeek, i);
      return {
        date: d,
        dateStr: format(d, 'yyyy-MM-dd'),
        dayName: format(d, 'EEEE', { locale: th }),
        shortDate: format(d, 'd MMM yyyy', { locale: th }),
        shortDay: format(d, 'EEE d', { locale: th }),
      };
    });
  }, [currentWeek]);

  // Determine which dates are currently shown (either 2 selected dates or all 7)
  const displayedDays = useMemo(() => {
    if (viewAllDays) return weekDays;
    const startIdx = dayPairIndex * 2;
    return weekDays.slice(startIdx, Math.min(startIdx + 2, 7));
  }, [weekDays, dayPairIndex, viewAllDays]);

  // Load data from LocalStorage & Supabase
  const loadWeekData = useCallback(async () => {
    const dates = weekDays.map(w => w.dateStr);
    const localKey = `daily_bakery_${currentBranch}_${dates[0]}`;

    let loaded: Record<string, Record<string, BakeryDayRecord>> = {};

    // 1. Try LocalStorage
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        loaded = JSON.parse(cached);
      }
    } catch (e) {
      console.error('LocalStorage read error:', e);
    }

    // 2. Try Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('daily_bakery_records')
          .select('*')
          .eq('branch', currentBranch)
          .in('date', dates);

        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            setTableExistsWarning('กรุณาสร้างตาราง daily_bakery_records ใน Supabase ก่อนใช้งาน (ระบบกำลังบันทึกข้อมูลไว้ในเครื่องชั่วคราว)');
          } else {
            console.warn('Supabase query daily_bakery_records error:', error.message);
          }
        } else if (data && data.length > 0) {
          setTableExistsWarning(null);
          data.forEach((rec: any) => {
            const item = rec.item_name;
            const d = rec.date;
            if (!loaded[item]) loaded[item] = {};
            loaded[item][d] = {
              totalQty: rec.total_qty ?? '',
              lineQty: rec.line_qty ?? '',
              storeQty: rec.store_qty ?? '',
              soldQty: rec.sold_qty ?? '',
              note: rec.note ?? '',
            };
          });
        }
      } catch (err: any) {
        console.warn('Supabase error:', err);
      }
    }

    setRecords(loaded);
  }, [currentBranch, weekDays]);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

  // Handle input change
  const handleChange = (itemName: string, dateStr: string, field: keyof BakeryDayRecord, value: string) => {
    setRecords(prev => {
      const itemMap = { ...(prev[itemName] || {}) };
      const currentDayRec = { ...(itemMap[dateStr] || { totalQty: '', lineQty: '', storeQty: '', soldQty: '', note: '' }) };

      if (field === 'note') {
        currentDayRec.note = value;
      } else {
        const numVal = value === '' ? '' : Number(value);
        const cleanVal = isNaN(numVal as number) ? '' : numVal;
        currentDayRec[field] = cleanVal as any;

        // Auto calculate storeQty when totalQty or lineQty changes
        if (field === 'totalQty' || field === 'lineQty') {
          const tot = field === 'totalQty' ? (cleanVal === '' ? 0 : Number(cleanVal)) : (currentDayRec.totalQty === '' ? 0 : Number(currentDayRec.totalQty));
          const line = field === 'lineQty' ? (cleanVal === '' ? 0 : Number(cleanVal)) : (currentDayRec.lineQty === '' ? 0 : Number(currentDayRec.lineQty));
          
          if (tot > 0 || line > 0) {
            currentDayRec.storeQty = Math.max(0, tot - line);
          } else {
            currentDayRec.storeQty = '';
          }
        }
      }

      itemMap[dateStr] = currentDayRec;
      return {
        ...prev,
        [itemName]: itemMap,
      };
    });
  };

  // Save to Supabase and LocalStorage
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);

    const dates = weekDays.map(w => w.dateStr);
    const localKey = `daily_bakery_${currentBranch}_${dates[0]}`;

    // 1. Save to LocalStorage
    try {
      localStorage.setItem(localKey, JSON.stringify(records));
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }

    // 2. Save to Supabase
    if (supabase) {
      try {
        const recordsToUpsert: any[] = [];

        Object.entries(records).forEach(([itemName, dateMap]) => {
          Object.entries(dateMap).forEach(([dateStr, rec]) => {
            if (
              rec.totalQty !== '' ||
              rec.lineQty !== '' ||
              rec.storeQty !== '' ||
              rec.soldQty !== '' ||
              (rec.note && rec.note.trim() !== '')
            ) {
              recordsToUpsert.push({
                date: dateStr,
                branch: currentBranch,
                item_name: itemName,
                total_qty: rec.totalQty === '' ? 0 : Number(rec.totalQty),
                line_qty: rec.lineQty === '' ? 0 : Number(rec.lineQty),
                store_qty: rec.storeQty === '' ? 0 : Number(rec.storeQty),
                sold_qty: rec.soldQty === '' ? 0 : Number(rec.soldQty),
                note: rec.note || '',
                recorded_by: recorderName,
                created_at: new Date().toISOString(),
              });
            }
          });
        });

        if (recordsToUpsert.length > 0) {
          const { error } = await supabase
            .from('daily_bakery_records')
            .upsert(recordsToUpsert, { onConflict: 'date,branch,item_name' });

          if (error) {
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
              setTableExistsWarning('กรุณาสร้างตาราง daily_bakery_records ใน Supabase ก่อนใช้งาน');
              setSaveStatus({
                type: 'info',
                message: 'บันทึกลงในเครื่องเรียบร้อยแล้ว (ยังไม่มีตาราง daily_bakery_records ใน Supabase)',
              });
            } else {
              throw error;
            }
          } else {
            setTableExistsWarning(null);
            setSaveStatus({
              type: 'success',
              message: 'บันทึกข้อมูลจำนวนขนมประจำวันสำเร็จเรียบร้อย',
            });
          }
        } else {
          setSaveStatus({
            type: 'info',
            message: 'ไม่มีรายการที่ต้องบันทึก (ข้อมูลว่าง)',
          });
        }
      } catch (err: any) {
        console.error('Save error:', err);
        setSaveStatus({
          type: 'error',
          message: `เกิดข้อผิดพลาดในการบันทึก: ${err.message || 'กรุณาลองใหม่อีกครั้ง'}`,
        });
      }
    } else {
      setSaveStatus({
        type: 'success',
        message: 'บันทึกลงในเครื่องเรียบร้อยแล้ว (ออฟไลน์โหมด)',
      });
    }

    setIsSaving(false);
    setTimeout(() => {
      setSaveStatus(null);
    }, 4000);
  };

  // Export to CSV / Excel
  const handleExportExcel = () => {
    const dates = weekDays.map(w => w.dateStr);
    const headers = ['หมวดหมู่', 'รายการ'];
    
    weekDays.forEach(w => {
      headers.push(`${w.shortDate} - ทั้งหมด`);
      headers.push(`${w.shortDate} - Official Line`);
      headers.push(`${w.shortDate} - ขายหน้าร้าน`);
      headers.push(`${w.shortDate} - ขายได้จริง`);
      headers.push(`${w.shortDate} - หมายเหตุ`);
    });

    const csvRows = [headers.join(',')];

    DEFAULT_BAKERY_ITEMS.forEach(item => {
      const row = [`"${item.category}"`, `"${item.name}"`];
      weekDays.forEach(w => {
        const rec = records[item.name]?.[w.dateStr] || { totalQty: '', lineQty: '', storeQty: '', soldQty: '', note: '' };
        row.push(rec.totalQty !== '' ? String(rec.totalQty) : '0');
        row.push(rec.lineQty !== '' ? String(rec.lineQty) : '0');
        row.push(rec.storeQty !== '' ? String(rec.storeQty) : '0');
        row.push(rec.soldQty !== '' ? String(rec.soldQty) : '0');
        row.push(`"${(rec.note || '').replace(/"/g, '""')}"`);
      });
      csvRows.push(row.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const startStr = format(weekDays[0].date, 'yyyyMMdd');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Bakery_Record_${currentBranch}_${startStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Categories
  const categories = useMemo(() => {
    const cats: { name: string; items: BakeryItemDef[] }[] = [];
    DEFAULT_BAKERY_ITEMS.forEach(item => {
      let found = cats.find(c => c.name === item.category);
      if (!found) {
        found = { name: item.category, items: [] };
        cats.push(found);
      }
      found.items.push(item);
    });
    return cats;
  }, []);

  // Calculate day totals for displayed days
  const dayTotals = useMemo(() => {
    const totals: Record<string, { totalQty: number; lineQty: number; storeQty: number; soldQty: number }> = {};
    displayedDays.forEach(day => {
      let total = 0;
      let line = 0;
      let store = 0;
      let sold = 0;
      DEFAULT_BAKERY_ITEMS.forEach(item => {
        const rec = records[item.name]?.[day.dateStr];
        if (rec) {
          if (rec.totalQty !== '') total += Number(rec.totalQty);
          if (rec.lineQty !== '') line += Number(rec.lineQty);
          if (rec.storeQty !== '') store += Number(rec.storeQty);
          if (rec.soldQty !== '') sold += Number(rec.soldQty);
        }
      });
      totals[day.dateStr] = { totalQty: total, lineQty: line, storeQty: store, soldQty: sold };
    });
    return totals;
  }, [displayedDays, records]);

  const weekStartStr = format(currentWeek, 'd MMM yyyy', { locale: th });
  const weekEndStr = format(addDays(currentWeek, 6), 'd MMM yyyy', { locale: th });

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {saveStatus && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between shadow-md transition-all ${
          saveStatus.type === 'success' 
            ? 'bg-[#E8F3F2] border-[#5A8A88] text-[#2D4A49]' 
            : saveStatus.type === 'error'
            ? 'bg-rose-50 border-rose-300 text-rose-800'
            : 'bg-amber-50 border-amber-300 text-amber-800'
        }`}>
          <div className="flex items-center gap-2.5 text-xs font-medium">
            {saveStatus.type === 'success' && <CheckCircle2 size={16} className="text-[#5A8A88] shrink-0" />}
            {saveStatus.type === 'error' && <AlertCircle size={16} className="text-rose-600 shrink-0" />}
            {saveStatus.type === 'info' && <Info size={16} className="text-amber-600 shrink-0" />}
            <span>{saveStatus.message}</span>
          </div>
        </div>
      )}

      {/* Warning banner if Supabase table is missing */}
      {tableExistsWarning && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">{tableExistsWarning}</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              คอลัมน์ที่ต้องสร้างใน Supabase: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">date (text), branch (text), item_name (text), total_qty (numeric), line_qty (numeric), store_qty (numeric), sold_qty (numeric), note (text), recorded_by (text), created_at (timestamptz)</code> (Primary key: date, branch, item_name)
            </p>
          </div>
        </div>
      )}

      {/* HEADER CARD */}
      <div className="bg-white rounded-2xl border border-[#D4E4E3] p-5 shadow-[0_2px_8px_rgba(90,138,136,0.08)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] border border-[#D4E4E3] shadow-xs">
              <Cake size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-[#2D4A49] tracking-tight">
                  บันทึกจำนวนขนมประจำวัน
                </h1>
                <span className="text-[10px] font-semibold bg-[#E8F3F2] text-[#5A8A88] px-2 py-0.5 rounded-full border border-[#D4E4E3]">
                  สาขา {currentBranch}
                </span>
              </div>
              <p className="text-[11px] text-[#6B8F8E] mt-0.5">
                แบบฟอร์มกรอกจำนวนขนม ผลิตทั้งหมด / Official Line / ขายหน้าร้าน / ยอดขายจริง
              </p>
            </div>
          </div>

          {/* Right: Week Navigator + Save Button + Export Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* Week Navigator */}
            <div className="flex items-center bg-[#E8F3F2] border border-[#D4E4E3] rounded-xl p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5A8A88] hover:bg-white transition-colors"
                title="สัปดาห์ก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1.5 px-3 text-xs font-semibold text-[#2D4A49]">
                <CalendarIcon size={13} className="text-[#5A8A88]" />
                <span>สัปดาห์ที่ {weekStartStr} - {weekEndStr}</span>
              </div>

              <button
                type="button"
                onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5A8A88] hover:bg-white transition-colors"
                title="สัปดาห์ถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-[#5A8A88] hover:bg-[#4A7A78] text-white text-[13px] font-semibold rounded-[10px] px-4 py-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>บันทึกข้อมูล</span>
                </>
              )}
            </button>

            {/* Export Buttons */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] text-[12px] font-medium rounded-[10px] px-3 py-2 transition-colors shadow-xs"
              title="ส่งออกไฟล์ Excel (CSV)"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] text-[12px] font-medium rounded-[10px] px-3 py-2 transition-colors shadow-xs"
              title="พิมพ์รายงาน (PDF)"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">PDF</span>
            </button>

          </div>

        </div>

        {/* 2-Day View Selector Tabs */}
        <div className="mt-4 pt-3 border-t border-[#D4E4E3] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-[#6B8F8E] mr-1">มุมมอง 2 วันต่อหน้า:</span>
            {[
              { idx: 0, label: 'จันทร์ - อังคาร' },
              { idx: 1, label: 'พุธ - พฤหัสฯ' },
              { idx: 2, label: 'ศุกร์ - เสาร์' },
              { idx: 3, label: 'อาทิตย์' },
            ].map(pair => (
              <button
                key={pair.idx}
                type="button"
                onClick={() => {
                  setDayPairIndex(pair.idx);
                  setViewAllDays(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  !viewAllDays && dayPairIndex === pair.idx
                    ? 'bg-[#5A8A88] text-white shadow-xs'
                    : 'bg-[#F0F5F4] text-[#2D4A49] hover:bg-[#E8F3F2] border border-[#D4E4E3]'
                }`}
              >
                {pair.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setViewAllDays(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              viewAllDays
                ? 'bg-[#2D4A49] text-white border-[#2D4A49]'
                : 'bg-white text-[#5A8A88] border-[#D4E4E3] hover:bg-[#E8F3F2]'
            }`}
          >
            <CalendarDays size={13} />
            <span>{viewAllDays ? 'กำลังแสดงครบ 7 วัน' : 'ดูทั้ง 7 วัน'}</span>
          </button>
        </div>

      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-[0_2px_8px_rgba(90,138,136,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            {/* Top Header with Date Groups */}
            <thead>
              <tr className="bg-[#2D4A49] text-white text-[11px] font-bold border-b border-[#1E3A39]">
                <th className="py-2.5 px-3 w-[160px] sticky left-0 z-20 bg-[#2D4A49] border-r border-[#3D6B69]">
                  รายการขนม
                </th>
                {displayedDays.map(day => (
                  <th
                    key={day.dateStr}
                    colSpan={5}
                    className="py-2 px-3 text-center border-r-2 border-[#1E3A39] bg-[#2D4A49]"
                  >
                    วันที่: {day.dayName} ({day.shortDate})
                  </th>
                ))}
              </tr>

              {/* Sub Header for Columns in each Date Group */}
              <tr className="bg-[#3D6B69] text-white text-[10px] font-semibold border-b border-[#2D4A49]">
                <th className="py-2 px-3 sticky left-0 z-20 bg-[#3D6B69] border-r border-[#2D4A49]">
                  เมนู / หมวดหมู่
                </th>
                {displayedDays.map(day => (
                  <React.Fragment key={`sub-${day.dateStr}`}>
                    <th className="py-2 px-1.5 text-right w-[65px]">ทั้งหมด</th>
                    <th className="py-2 px-1.5 text-right w-[65px]">Line</th>
                    <th className="py-2 px-1.5 text-right w-[65px] bg-[#345D5B]">หน้าร้าน</th>
                    <th className="py-2 px-1.5 text-right w-[65px] bg-[#2A4D4B]">ขายได้</th>
                    <th className="py-2 px-2 text-left w-[85px] border-r-2 border-[#2D4A49]">หมายเหตุ</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            {/* Table Body with Categories */}
            <tbody className="divide-y divide-[#F0F5F4] text-xs">
              {categories.map(category => (
                <React.Fragment key={category.name}>
                  {/* Category Header Row */}
                  <tr className="bg-[#E8F3F2] border-y border-[#D4E4E3]">
                    <td 
                      colSpan={1 + displayedDays.length * 5}
                      className="py-2 px-3 font-bold text-[#5A8A88] text-[11px] tracking-wide"
                    >
                      📁 {category.name}
                    </td>
                  </tr>

                  {/* Items in Category */}
                  {category.items.map((item, itemIdx) => (
                    <tr 
                      key={item.id}
                      className={`transition-colors hover:bg-[#E8F3F2]/40 ${
                        itemIdx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFA]'
                      }`}
                    >
                      {/* Item Name (Sticky Left) */}
                      <td className="py-1.5 px-3 font-semibold text-[#2D4A49] bg-[#F0F5F4] border-r border-[#D4E4E3] sticky left-0 z-10 whitespace-nowrap text-[12px]">
                        {item.name}
                      </td>

                      {/* Day Columns */}
                      {displayedDays.map(day => {
                        const rec = records[item.name]?.[day.dateStr] || { totalQty: '', lineQty: '', storeQty: '', soldQty: '', note: '' };
                        const isUnderTarget = rec.soldQty !== '' && rec.storeQty !== '' && Number(rec.soldQty) < Number(rec.storeQty);

                        return (
                          <React.Fragment key={`${item.id}-${day.dateStr}`}>
                            {/* 1. จำนวนขนมทั้งหมด */}
                            <td className="py-1 px-1 text-right">
                              <input
                                type="number"
                                value={rec.totalQty}
                                onChange={(e) => handleChange(item.name, day.dateStr, 'totalQty', e.target.value)}
                                placeholder="0"
                                className="w-full bg-white border border-[#D4E4E3] rounded text-[11px] font-mono text-right px-1.5 py-1 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2]"
                              />
                            </td>

                            {/* 2. Official Line */}
                            <td className="py-1 px-1 text-right">
                              <input
                                type="number"
                                value={rec.lineQty}
                                onChange={(e) => handleChange(item.name, day.dateStr, 'lineQty', e.target.value)}
                                placeholder="0"
                                className="w-full bg-white border border-[#D4E4E3] rounded text-[11px] font-mono text-right px-1.5 py-1 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2]"
                              />
                            </td>

                            {/* 3. ขายหน้าร้าน (Auto / Editable) */}
                            <td className="py-1 px-1 text-right bg-[#F9FBFA]">
                              <input
                                type="number"
                                value={rec.storeQty}
                                onChange={(e) => handleChange(item.name, day.dateStr, 'storeQty', e.target.value)}
                                placeholder="0"
                                className="w-full bg-white border border-[#B8D4D2] rounded text-[11px] font-mono font-semibold text-right px-1.5 py-1 text-[#5A8A88] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2]"
                                title="ขายหน้าร้าน (คำนวณจาก ทั้งหมด - Line)"
                              />
                            </td>

                            {/* 4. ขายได้จริง (Highlight warning if sold < store target) */}
                            <td className={`py-1 px-1 text-right ${isUnderTarget ? 'bg-amber-50' : ''}`}>
                              <input
                                type="number"
                                value={rec.soldQty}
                                onChange={(e) => handleChange(item.name, day.dateStr, 'soldQty', e.target.value)}
                                placeholder="0"
                                className={`w-full border rounded text-[11px] font-mono font-bold text-right px-1.5 py-1 focus:outline-none ${
                                  isUnderTarget
                                    ? 'bg-[#FEF3C7] border-amber-400 text-amber-900 focus:border-amber-600'
                                    : 'bg-white border-[#D4E4E3] text-[#2D4A49] focus:border-[#5A8A88] focus:bg-[#E8F3F2]'
                                }`}
                                title={isUnderTarget ? 'ยอดขายจริงน้อยกว่ายอดที่จัดไว้ขายหน้าร้าน' : 'ยอดขายจริง'}
                              />
                            </td>

                            {/* 5. หมายเหตุ */}
                            <td className="py-1 px-1.5 border-r-2 border-[#D4E4E3]">
                              <input
                                type="text"
                                value={rec.note}
                                onChange={(e) => handleChange(item.name, day.dateStr, 'note', e.target.value)}
                                placeholder="หมายเหตุ"
                                className="w-full bg-white border border-[#D4E4E3] rounded text-[10px] text-left px-1.5 py-1 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2]"
                              />
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}

              {/* SUMMARY ROW */}
              <tr className="bg-[#E8F3F2] text-[#2D4A49] text-[11px] font-bold border-t-2 border-[#B8D4D2]">
                <td className="py-2.5 px-3 sticky left-0 z-10 bg-[#E8F3F2] border-r border-[#D4E4E3] font-bold">
                  รวมจำนวนขนม
                </td>
                {displayedDays.map(day => {
                  const t = dayTotals[day.dateStr] || { totalQty: 0, lineQty: 0, storeQty: 0, soldQty: 0 };
                  return (
                    <React.Fragment key={`tot-${day.dateStr}`}>
                      <td className="py-2.5 px-1.5 text-right font-mono text-[#5A8A88]">
                        {t.totalQty}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-mono text-[#5A8A88]">
                        {t.lineQty}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-mono text-[#5A8A88] font-bold">
                        {t.storeQty}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-mono text-[#2D4A49] font-black">
                        {t.soldQty}
                      </td>
                      <td className="py-2.5 px-2 border-r-2 border-[#D4E4E3] text-[10px] text-[#6B8F8E] font-normal">
                        รวมวัน
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DailyBakeryRecord;
