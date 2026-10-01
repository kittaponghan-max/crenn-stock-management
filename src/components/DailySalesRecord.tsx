import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BookOpen, 
  Save, 
  Download, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Info,
  Calendar,
  Lock,
  RefreshCw
} from 'lucide-react';
import { format, eachDayOfInterval, parseISO, isAfter } from 'date-fns';
import { th } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { AppPermissions } from '../types';

export interface DailySalesRecordProps {
  user?: {
    name: string;
    role?: string;
    branch?: string;
    permissions?: AppPermissions;
  } | null;
  branch?: string;
  onNavigate?: (tab: string) => void;
}

export interface DailySalesRow {
  date: string; // YYYY-MM-DD
  dayLabel: string;
  openingCash: number | '';
  transfer: number | '';
  cash: number | '';
  creditCard: number | '';
  totalRevenue: number | '';
  closingCash: number | '';
  note: string;
  isAutoCalculated?: boolean;
}

// Day color configurations (soft pastel)
const DAY_COLORS: Record<number, { bg: string; text: string; fontWeight: number }> = {
  0: { bg: '#FEF2F2', text: '#991B1B', fontWeight: 700 }, // Sunday (soft red, bolder)
  1: { bg: '#FFFBEB', text: '#92400E', fontWeight: 600 }, // Monday (soft yellow)
  2: { bg: '#FFF1F2', text: '#9F1239', fontWeight: 600 }, // Tuesday (soft pink)
  3: { bg: '#F0FDF4', text: '#14532D', fontWeight: 600 }, // Wednesday (soft green)
  4: { bg: '#EFF6FF', text: '#1E3A8A', fontWeight: 600 }, // Thursday (soft blue)
  5: { bg: '#F5F3FF', text: '#4C1D95', fontWeight: 600 }, // Friday (soft purple)
  6: { bg: '#FFF7ED', text: '#7C2D12', fontWeight: 600 }, // Saturday (soft orange)
};

// Branch-specific default date range helper
const getDefaultDateRange = (branchName: string) => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  if (branchName === 'Rayong') {
    // 25th to 25th of next month
    let startMonth = currentMonth;
    let startYear = currentYear;

    if (currentDay < 25) {
      startMonth = currentMonth - 1;
      if (startMonth < 0) {
        startMonth = 11;
        startYear = currentYear - 1;
      }
    }

    const start = new Date(startYear, startMonth, 25);
    const end = new Date(
      startMonth === 11 ? startYear + 1 : startYear,
      startMonth === 11 ? 0 : startMonth + 1,
      25
    );
    return { start, end };
  }

  if (branchName === 'Bangkok') {
    // 28th to 28th of next month
    let startMonth = currentMonth;
    let startYear = currentYear;

    if (currentDay < 28) {
      startMonth = currentMonth - 1;
      if (startMonth < 0) {
        startMonth = 11;
        startYear = currentYear - 1;
      }
    }

    const start = new Date(startYear, startMonth, 28);
    const end = new Date(
      startMonth === 11 ? startYear + 1 : startYear,
      startMonth === 11 ? 0 : startMonth + 1,
      28
    );
    return { start, end };
  }

  // Fallback: 25th to 25th
  let startMonth = currentMonth;
  let startYear = currentYear;
  if (currentDay < 25) {
    startMonth = currentMonth - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear = currentYear - 1;
    }
  }
  const start = new Date(startYear, startMonth, 25);
  const end = new Date(
    startMonth === 11 ? startYear + 1 : startYear,
    startMonth === 11 ? 0 : startMonth + 1,
    25
  );
  return { start, end };
};

export function DailySalesRecord({ user, branch = 'Rayong', onNavigate }: DailySalesRecordProps) {
  const currentBranch = branch || user?.branch || 'Rayong';
  const recorderName = user?.name || 'Admin';

  // Admin check for editable date range
  const isAdmin = useMemo(() => {
    const role = (user?.role || '').toUpperCase();
    return (
      role === 'ADMIN' || 
      role === 'CO-FOUNDER' || 
      role === 'OWNER' || 
      user?.permissions?.canEditDateRange === true
    );
  }, [user]);

  // Initial date range based on branch
  const initialRange = useMemo(() => getDefaultDateRange(currentBranch), [currentBranch]);
  const [startDateStr, setStartDateStr] = useState<string>(() => format(initialRange.start, 'yyyy-MM-dd'));
  const [endDateStr, setEndDateStr] = useState<string>(() => format(initialRange.end, 'yyyy-MM-dd'));
  
  // Applied date range (triggers re-load)
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>({
    start: format(initialRange.start, 'yyyy-MM-dd'),
    end: format(initialRange.end, 'yyyy-MM-dd'),
  });

  // When branch changes, reset to branch default
  useEffect(() => {
    const range = getDefaultDateRange(currentBranch);
    const s = format(range.start, 'yyyy-MM-dd');
    const e = format(range.end, 'yyyy-MM-dd');
    setStartDateStr(s);
    setEndDateStr(e);
    setAppliedRange({ start: s, end: e });
  }, [currentBranch]);

  const [rows, setRows] = useState<DailySalesRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [tableExistsWarning, setTableExistsWarning] = useState<string | null>(null);

  // Generate displayed days from appliedRange
  const displayedDays = useMemo(() => {
    try {
      const start = parseISO(appliedRange.start);
      const end = parseISO(appliedRange.end);
      
      const effectiveStart = isAfter(start, end) ? end : start;
      const effectiveEnd = isAfter(start, end) ? start : end;
      
      const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
      return days.map(d => {
        const dayName = format(d, 'EEEE', { locale: th });
        const shortDate = format(d, 'dd/MM/yyyy');
        return {
          dateStr: format(d, 'yyyy-MM-dd'),
          displayLabel: `${dayName} (${shortDate})`,
          rawDate: d,
          dayOfWeek: d.getDay(),
        };
      });
    } catch (e) {
      console.error('Error generating days interval', e);
      return [];
    }
  }, [appliedRange]);

  // Load data for the displayed days from Supabase or LocalStorage
  const loadData = useCallback(async () => {
    if (displayedDays.length === 0) return;

    const dates = displayedDays.map(w => w.dateStr);
    const localKey = `daily_sales_${currentBranch}_${dates[0]}`;
    
    // Default empty rows with new column order
    const initialRows: DailySalesRow[] = displayedDays.map(w => ({
      date: w.dateStr,
      dayLabel: w.displayLabel,
      openingCash: '',
      transfer: '',
      cash: '',
      creditCard: '',
      totalRevenue: '',
      closingCash: '',
      note: '',
      isAutoCalculated: true,
    }));

    let loadedMap: Record<string, Partial<DailySalesRow>> = {};

    // 1. Try LocalStorage
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item.date) loadedMap[item.date] = item;
          });
        }
      }
    } catch (e) {
      console.error('Failed reading local storage for daily sales', e);
    }

    // 2. Try Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('daily_sales_records')
          .select('*')
          .eq('branch', currentBranch)
          .in('date', dates);

        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            setTableExistsWarning('กรุณาสร้างตาราง daily_sales_records ใน Supabase ก่อนใช้งาน (ระบบกำลังบันทึกข้อมูลไว้ในเครื่องชั่วคราว)');
          } else {
            console.warn('Supabase query daily_sales_records error:', error.message);
          }
        } else if (data && data.length > 0) {
          setTableExistsWarning(null);
          data.forEach((rec: any) => {
            loadedMap[rec.date] = {
              date: rec.date,
              openingCash: rec.opening_cash === null || rec.opening_cash === undefined ? '' : Math.round(Number(rec.opening_cash)),
              transfer: rec.transfer === null || rec.transfer === undefined ? '' : Math.round(Number(rec.transfer)),
              cash: rec.cash === null || rec.cash === undefined ? '' : Math.round(Number(rec.cash)),
              creditCard: rec.credit_card === null || rec.credit_card === undefined ? '' : Number(rec.credit_card),
              totalRevenue: rec.total_revenue === null || rec.total_revenue === undefined ? '' : Math.round(Number(rec.total_revenue)),
              closingCash: rec.closing_cash === null || rec.closing_cash === undefined ? '' : Math.round(Number(rec.closing_cash)),
              note: rec.note ?? '',
            };
          });
        }
      } catch (err: any) {
        console.warn('Supabase error:', err);
      }
    }

    // Merge into rows
    const merged = initialRows.map(row => {
      const found = loadedMap[row.date];
      if (found) {
        const t = found.transfer === '' || found.transfer === undefined ? 0 : Math.round(Number(found.transfer));
        const c = found.cash === '' || found.cash === undefined ? 0 : Math.round(Number(found.cash));
        const cc = found.creditCard === '' || found.creditCard === undefined ? 0 : Number(found.creditCard);
        const autoTot = (t || c || cc) ? Math.round(t + c + cc) : '';
        const rev = found.totalRevenue !== undefined && found.totalRevenue !== '' ? found.totalRevenue : autoTot;
        
        return {
          ...row,
          ...found,
          totalRevenue: rev,
          isAutoCalculated: found.totalRevenue === undefined || found.totalRevenue === '' || found.totalRevenue === autoTot,
        };
      }
      return row;
    });

    setRows(merged);
  }, [currentBranch, displayedDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-expand textarea helper
  const autoExpand = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(28, el.scrollHeight)}px`;
  };

  // Handle cell value change
  const handleChange = (index: number, field: keyof DailySalesRow, rawValue: string) => {
    setRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === 'note') {
        row.note = rawValue;
      } else if (field === 'creditCard') {
        const numVal = rawValue === '' ? '' : parseFloat(rawValue);
        row.creditCard = (numVal === '' || isNaN(numVal)) ? '' : numVal;
      } else {
        const numVal = rawValue === '' ? '' : parseInt(rawValue, 10);
        (row as any)[field] = (numVal === '' || isNaN(numVal)) ? '' : numVal;
      }

      // Auto calculate totalRevenue if editing transfer, cash, or creditCard
      if (field === 'transfer' || field === 'cash' || field === 'creditCard') {
        const t = row.transfer === '' ? 0 : Number(row.transfer);
        const c = row.cash === '' ? 0 : Number(row.cash);
        const cc = row.creditCard === '' ? 0 : Number(row.creditCard);

        if (t > 0 || c > 0 || cc > 0) {
          row.totalRevenue = Math.round(t + c + cc);
          row.isAutoCalculated = true;
        } else {
          row.totalRevenue = '';
        }
      } else if (field === 'totalRevenue') {
        row.isAutoCalculated = false;
      }

      updated[index] = row;
      return updated;
    });
  };

  // Save to Supabase and LocalStorage
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);

    const dates = displayedDays.map(w => w.dateStr);
    const localKey = `daily_sales_${currentBranch}_${dates[0]}`;

    // 1. Save to LocalStorage
    try {
      localStorage.setItem(localKey, JSON.stringify(rows));
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }

    // 2. Save to Supabase
    if (supabase) {
      try {
        const recordsToUpsert = rows
          .filter(r => r.openingCash !== '' || r.totalRevenue !== '' || r.transfer !== '' || r.cash !== '' || r.creditCard !== '' || r.closingCash !== '' || (r.note && r.note.trim() !== ''))
          .map(r => ({
            date: r.date,
            branch: currentBranch,
            opening_cash: r.openingCash === '' ? 0 : Math.round(Number(r.openingCash)),
            transfer: r.transfer === '' ? 0 : Math.round(Number(r.transfer)),
            cash: r.cash === '' ? 0 : Math.round(Number(r.cash)),
            credit_card: r.creditCard === '' ? 0 : Number(Number(r.creditCard).toFixed(2)),
            total_revenue: r.totalRevenue === '' ? 0 : Math.round(Number(r.totalRevenue)),
            closing_cash: r.closingCash === '' ? 0 : Math.round(Number(r.closingCash)),
            note: r.note || '',
            recorded_by: recorderName,
            created_at: new Date().toISOString(),
          }));

        if (recordsToUpsert.length > 0) {
          const { error } = await supabase
            .from('daily_sales_records')
            .upsert(recordsToUpsert, { onConflict: 'date,branch' });

          if (error) {
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
              setTableExistsWarning('กรุณาสร้างตาราง daily_sales_records ใน Supabase ก่อนใช้งาน');
              setSaveStatus({
                type: 'info',
                message: 'บันทึกลงในเครื่องเรียบร้อยแล้ว (ยังไม่มีตาราง daily_sales_records ใน Supabase)',
              });
            } else {
              throw error;
            }
          } else {
            setTableExistsWarning(null);
            setSaveStatus({
              type: 'success',
              message: 'บันทึกข้อมูลยอดขายประจำวันสำเร็จเรียบร้อย',
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

  // Export to CSV / Excel (with new column order)
  const handleExportExcel = () => {
    const headers = [
      'วันที่',
      'เงินในลิ้นชักตั้งต้น (บาท)',
      'เงินโอน (บาท)',
      'เงินสด (บาท)',
      'บัตรเครดิต (บาท)',
      'รายรับรวม (บาท)',
      'เงินในลิ้นชักตอนปิดร้าน (บาท)',
      'หมายเหตุ',
    ];

    const csvRows = [headers.join(',')];

    rows.forEach(r => {
      const row = [
        `"${r.dayLabel}"`,
        r.openingCash !== '' ? Math.round(Number(r.openingCash)) : 0,
        r.transfer !== '' ? Math.round(Number(r.transfer)) : 0,
        r.cash !== '' ? Math.round(Number(r.cash)) : 0,
        r.creditCard !== '' ? Number(r.creditCard).toFixed(2) : '0.00',
        r.totalRevenue !== '' ? Math.round(Number(r.totalRevenue)) : 0,
        r.closingCash !== '' ? Math.round(Number(r.closingCash)) : 0,
        `"${(r.note || '').replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(','));
    });

    // Summary row
    const sumOpening = rows.reduce((s, r) => s + (Number(r.openingCash) || 0), 0);
    const sumTransfer = rows.reduce((s, r) => s + (Number(r.transfer) || 0), 0);
    const sumCash = rows.reduce((s, r) => s + (Number(r.cash) || 0), 0);
    const sumCredit = rows.reduce((s, r) => s + (Number(r.creditCard) || 0), 0);
    const sumRevenue = rows.reduce((s, r) => s + (Number(r.totalRevenue) || 0), 0);
    const sumClosing = rows.reduce((s, r) => s + (Number(r.closingCash) || 0), 0);

    csvRows.push([
      `"รวม ${summaryDateRangeLabel}"`,
      Math.round(sumOpening),
      Math.round(sumTransfer),
      Math.round(sumCash),
      sumCredit.toFixed(2),
      Math.round(sumRevenue),
      Math.round(sumClosing),
      '""',
    ].join(','));

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const startStr = displayedDays[0]?.dateStr?.replace(/-/g, '') || 'range';
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Sales_${currentBranch}_${startStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Summary calculations based strictly on displayed rows (new order)
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        opening: acc.opening + (r.openingCash !== '' ? Number(r.openingCash) : 0),
        transfer: acc.transfer + (r.transfer !== '' ? Number(r.transfer) : 0),
        cash: acc.cash + (r.cash !== '' ? Number(r.cash) : 0),
        credit: acc.credit + (r.creditCard !== '' ? Number(r.creditCard) : 0),
        revenue: acc.revenue + (r.totalRevenue !== '' ? Number(r.totalRevenue) : 0),
        closing: acc.closing + (r.closingCash !== '' ? Number(r.closingCash) : 0),
      }),
      { opening: 0, transfer: 0, cash: 0, credit: 0, revenue: 0, closing: 0 }
    );
  }, [rows]);

  // Date range label for header and summary
  const summaryDateRangeLabel = useMemo(() => {
    if (displayedDays.length === 0) return '';
    const first = displayedDays[0].rawDate;
    const last = displayedDays[displayedDays.length - 1].rawDate;
    const firstStr = format(first, 'd MMM yyyy', { locale: th });
    const lastStr = format(last, 'd MMM yyyy', { locale: th });
    return `${firstStr} – ${lastStr}`;
  }, [displayedDays]);

  // Apply new date range on button click
  const handleApplyRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDateStr || !endDateStr) return;
    setAppliedRange({
      start: startDateStr,
      end: endDateStr,
    });
  };

  return (
    <div className="space-y-3.5">
      {/* Toast Notification */}
      {saveStatus && (
        <div className={`p-3 rounded-xl border flex items-center justify-between shadow-md transition-all ${
          saveStatus.type === 'success' 
            ? 'bg-[#E8F3F2] border-[#5A8A88] text-[#2D4A49]' 
            : saveStatus.type === 'error'
            ? 'bg-rose-50 border-rose-300 text-rose-800'
            : 'bg-amber-50 border-amber-300 text-amber-800'
        }`}>
          <div className="flex items-center gap-2 text-xs font-medium">
            {saveStatus.type === 'success' && <CheckCircle2 size={15} className="text-[#5A8A88] shrink-0" />}
            {saveStatus.type === 'error' && <AlertCircle size={15} className="text-rose-600 shrink-0" />}
            {saveStatus.type === 'info' && <Info size={15} className="text-amber-600 shrink-0" />}
            <span>{saveStatus.message}</span>
          </div>
        </div>
      )}

      {/* Warning banner if Supabase table is missing */}
      {tableExistsWarning && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
          <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">{tableExistsWarning}</p>
            <p className="text-[10px] text-amber-700 mt-0.5">
              คอลัมน์ในตาราง daily_sales_records: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[9px]">date (text), branch (text), opening_cash (numeric), transfer (numeric), cash (numeric), credit_card (numeric), total_revenue (numeric), closing_cash (numeric), note (text), recorded_by (text), created_at (timestamptz)</code>
            </p>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PAGE HEADER CARD (Simplified Layout, Always-on Date Range)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-2xl border border-[#D4E4E3] p-4 sm:p-5 shadow-[0_2px_8px_rgba(90,138,136,0.08)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          
          {/* Left: Title & Branch Badge */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] border border-[#D4E4E3] shadow-xs shrink-0">
              <BookOpen size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[16px] font-[700] text-[#2D4A49] tracking-tight">
                  บันทึกยอดขายประจำวัน
                </h1>
                <span className="text-[10px] font-[600] text-[#5A8A88] bg-[#E8F3F2] px-2 py-[2px] rounded-[6px] border border-[#D4E4E3]">
                  สาขา {currentBranch}
                </span>
              </div>
              <p className="text-[11px] text-[#6B8F8E] mt-0.5">
                บันทึกยอดรายรับและเงินสดประจำวัน
              </p>
            </div>
          </div>

          {/* Right: Date Range Label */}
          <div className="text-right">
            <span className="text-[12px] font-[700] text-[#2D4A49] bg-[#F0F5F4] px-3 py-1.5 rounded-lg border border-[#D4E4E3] inline-block">
              ช่วง: {summaryDateRangeLabel}
            </span>
          </div>

        </div>

        {/* Date Pickers Form + Action Buttons */}
        <form 
          onSubmit={handleApplyRange}
          className="mt-3.5 pt-3 border-t border-[#D4E4E3] flex flex-wrap items-center justify-between gap-2.5"
        >
          {/* Start Date & End Date Inputs */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-[#F0F5F4] px-2.5 py-1 rounded-lg border border-[#D4E4E3]">
              <Calendar size={13} className="text-[#5A8A88]" />
              <label className="text-[11px] font-medium text-[#2D4A49]">เริ่มต้น:</label>
              <input
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                readOnly={!isAdmin}
                className={`bg-white border rounded px-2 py-1 text-[11px] text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] ${
                  !isAdmin ? 'cursor-not-allowed bg-slate-50 opacity-90 border-[#D4E4E3]' : 'border-[#5A8A88]'
                }`}
                title={!isAdmin ? 'เฉพาะ Admin เท่านั้นที่สามารถเปลี่ยนช่วงวันที่ได้' : 'เลือกวันที่เริ่มต้น'}
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#F0F5F4] px-2.5 py-1 rounded-lg border border-[#D4E4E3]">
              <Calendar size={13} className="text-[#5A8A88]" />
              <label className="text-[11px] font-medium text-[#2D4A49]">สิ้นสุด:</label>
              <input
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                readOnly={!isAdmin}
                className={`bg-white border rounded px-2 py-1 text-[11px] text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] ${
                  !isAdmin ? 'cursor-not-allowed bg-slate-50 opacity-90 border-[#D4E4E3]' : 'border-[#5A8A88]'
                }`}
                title={!isAdmin ? 'เฉพาะ Admin เท่านั้นที่สามารถเปลี่ยนช่วงวันที่ได้' : 'เลือกวันที่สิ้นสุด'}
              />
            </div>

            {!isAdmin && (
              <span className="flex items-center gap-1 text-[10px] text-[#6B8F8E]">
                <Lock size={11} className="text-[#6B8F8E]" />
                (ช่วงวันเริ่มต้นตามรอบสาขา)
              </span>
            )}

            {/* Apply Button */}
            {isAdmin && (
              <button
                type="submit"
                className="bg-[#5A8A88] hover:bg-[#4A7A78] text-white text-[11px] font-[600] rounded-[8px] px-3.5 py-1.5 transition-colors cursor-pointer shadow-xs flex items-center gap-1"
              >
                <RefreshCw size={11} />
                <span>ดูช่วงนี้</span>
              </button>
            )}
          </div>

          {/* Action Buttons: Save + Excel + PDF */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-[#5A8A88] hover:bg-[#4A7A78] text-white text-[12px] font-[600] rounded-[8px] px-3.5 py-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Save size={13} />
                  <span>บันทึกข้อมูล</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1 bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] text-[12px] font-[500] rounded-[8px] px-2.5 py-1.5 transition-colors shadow-xs cursor-pointer"
              title="ส่งออกไฟล์ Excel (CSV)"
            >
              <Download size={12} />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1 bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] text-[12px] font-[500] rounded-[8px] px-2.5 py-1.5 transition-colors shadow-xs cursor-pointer"
              title="พิมพ์รายงาน (PDF)"
            >
              <Printer size={12} />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </form>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          TABLE CARD (Zero horizontal scroll on 768px, Sticky Header & Summary)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div 
        style={{
          maxHeight: 'calc(100vh - 280px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
        }}
        className="bg-white rounded-xl border border-[#D4E4E3] shadow-[0_2px_8px_rgba(90,138,136,0.06)] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#A8BCBB] [&::-webkit-scrollbar-thumb]:rounded-[3px] hover:[&::-webkit-scrollbar-thumb]:bg-[#7A9E9C]"
      >
        <table 
          style={{ tableLayout: 'fixed', width: '100%' }} 
          className="w-full text-left border-collapse"
        >
          <colgroup><col style={{ width: '100px' }} /><col style={{ width: '85px' }} /><col style={{ width: '72px' }} /><col style={{ width: '72px' }} /><col style={{ width: '78px' }} /><col style={{ width: '82px' }} /><col style={{ width: '90px' }} /><col style={{ width: 'auto' }} /></colgroup>

          {/* Frozen Sticky Header (Change 2) */}
          <thead className="sticky top-0 z-10 bg-[#2D4A49]">
            <tr className="bg-[#2D4A49] text-white text-[9px] font-[600] border-b border-[#1E3A39]">
              <th className="py-2 px-1.5 text-center sticky top-0 bg-[#2D4A49]">วันที่</th>
              <th className="py-2 px-1 text-right sticky top-0 bg-[#2D4A49]">ลิ้นชักตั้งต้น</th>
              <th className="py-2 px-1 text-right sticky top-0 bg-[#2D4A49]">เงินโอน</th>
              <th className="py-2 px-1 text-right sticky top-0 bg-[#2D4A49]">เงินสด</th>
              <th className="py-2 px-1 text-right sticky top-0 bg-[#2D4A49]">บัตรเครดิต</th>
              <th className="py-2 px-1 text-right sticky top-0 bg-[#2D4A49] bg-[#243d3c]">รายรับรวม</th>
              <th className="py-2 px-1 text-right sticky top-0 bg-[#2D4A49]">ลิ้นชักปิดร้าน</th>
              <th className="py-2 px-2 text-left sticky top-0 bg-[#2D4A49]">หมายเหตุ</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#F0F5F4] text-[9px]">
            {rows.map((row, index) => {
              const dayOfWeek = displayedDays[index]?.dayOfWeek ?? new Date(row.date).getDay();
              const dayColor = DAY_COLORS[dayOfWeek] || { bg: '#F0F5F4', text: '#2D4A49', fontWeight: 600 };

              return (
                <tr 
                  key={row.date}
                  className={`transition-colors hover:bg-[#E8F3F2]/40 align-top ${
                    index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFA]'
                  }`}
                  style={{ minHeight: '32px' }}
                >
                  {/* 1. วันที่ (Change 3: Pastel Day Color) */}
                  <td 
                    style={{
                      backgroundColor: dayColor.bg,
                      color: dayColor.text,
                      fontWeight: dayColor.fontWeight,
                      fontSize: '9px',
                    }}
                    className="py-1.5 px-1.5 text-center border-r border-[#D4E4E3] whitespace-nowrap align-middle"
                  >
                    {row.dayLabel}
                  </td>

                  {/* 2. เงินในลิ้นชักตั้งต้น (Integer only) */}
                  <td className="py-1 px-1 align-top">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row.openingCash === '' ? '' : row.openingCash}
                      onChange={(e) => handleChange(index, 'openingCash', e.target.value)}
                      placeholder="0"
                      style={{ padding: '3px 5px', height: '28px', fontSize: '9px' }}
                      className="w-full bg-white border border-[#D4E4E3] rounded-[4px] font-[400] font-mono text-right text-[#2D4A49] placeholder-[#A8BCBB] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 3. เงินโอน (Integer only) */}
                  <td className="py-1 px-1 align-top">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row.transfer === '' ? '' : row.transfer}
                      onChange={(e) => handleChange(index, 'transfer', e.target.value)}
                      placeholder="0"
                      style={{ padding: '3px 5px', height: '28px', fontSize: '9px' }}
                      className="w-full bg-white border border-[#D4E4E3] rounded-[4px] font-[400] font-mono text-right text-[#2D4A49] placeholder-[#A8BCBB] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 4. เงินสด (Integer only) */}
                  <td className="py-1 px-1 align-top">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row.cash === '' ? '' : row.cash}
                      onChange={(e) => handleChange(index, 'cash', e.target.value)}
                      placeholder="0"
                      style={{ padding: '3px 5px', height: '28px', fontSize: '9px' }}
                      className="w-full bg-white border border-[#D4E4E3] rounded-[4px] font-[400] font-mono text-right text-[#2D4A49] placeholder-[#A8BCBB] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 5. บัตรเครดิต (2 decimal places) */}
                  <td className="py-1 px-1 align-top">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.creditCard === '' ? '' : row.creditCard}
                      onChange={(e) => handleChange(index, 'creditCard', e.target.value)}
                      placeholder="0.00"
                      style={{ padding: '3px 5px', height: '28px', fontSize: '9px' }}
                      className="w-full bg-white border border-[#D4E4E3] rounded-[4px] font-[400] font-mono text-right text-[#2D4A49] placeholder-[#A8BCBB] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 6. รายรับรวม (MOVED HERE after Credit Card, Integer only) */}
                  <td className="py-1 px-1 align-top">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row.totalRevenue === '' ? '' : row.totalRevenue}
                      onChange={(e) => handleChange(index, 'totalRevenue', e.target.value)}
                      placeholder="0"
                      style={{ padding: '3px 5px', height: '28px', fontSize: '9px' }}
                      className={`w-full border rounded-[4px] font-[400] font-mono text-right placeholder-[#A8BCBB] transition-colors focus:outline-none focus:border-[#5A8A88] ${
                        row.isAutoCalculated && row.totalRevenue !== ''
                          ? 'bg-[#E8F3F2] border-[#5A8A88] text-[#5A8A88] font-[600]'
                          : 'bg-white border-[#D4E4E3] text-[#2D4A49] focus:bg-[#E8F3F2]'
                      }`}
                      title={row.isAutoCalculated ? 'คำนวณอัตโนมัติจาก เงินโอน + เงินสด + บัตรเครดิต' : 'ยอดที่ระบุเอง'}
                    />
                  </td>

                  {/* 7. เงินในลิ้นชักตอนปิดร้าน (Integer only) */}
                  <td className="py-1 px-1 align-top">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row.closingCash === '' ? '' : row.closingCash}
                      onChange={(e) => handleChange(index, 'closingCash', e.target.value)}
                      placeholder="0"
                      style={{ padding: '3px 5px', height: '28px', fontSize: '9px' }}
                      className="w-full bg-white border border-[#D4E4E3] rounded-[4px] font-[400] font-mono text-right text-[#2D4A49] placeholder-[#A8BCBB] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 8. หมายเหตุ (Change 2: Auto-expanding Textarea, 9px) */}
                  <td className="py-1 px-1.5 align-top">
                    <textarea
                      rows={1}
                      value={row.note}
                      onInput={(e) => autoExpand(e.target as HTMLTextAreaElement)}
                      onChange={(e) => handleChange(index, 'note', e.target.value)}
                      placeholder="หมายเหตุ..."
                      style={{
                        resize: 'none',
                        overflow: 'hidden',
                        minHeight: '28px',
                        lineHeight: '1.4',
                        padding: '3px 5px',
                        fontSize: '9px',
                        transition: 'height 100ms ease',
                      }}
                      className="w-full bg-white border border-[#D4E4E3] rounded-[4px] text-left text-[#2D4A49] placeholder-[#A8BCBB] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2]"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Sticky Frozen Summary Row (Change 2 & Change 4) */}
          <tfoot className="sticky bottom-0 z-10 bg-[#E8F3F2]">
            <tr 
              style={{ background: '#E8F3F2', borderTop: '2px solid #5A8A88' }}
              className="text-[#2D4A49] text-[9px] font-[700] shadow-xs"
            >
              {/* 1. Date range label */}
              <td className="py-2 px-1.5 text-left border-r border-[#D4E4E3] font-[700] text-[#2D4A49] whitespace-nowrap sticky bottom-0 bg-[#E8F3F2]">
                รวม {summaryDateRangeLabel}
              </td>

              {/* 2. เงินในลิ้นชักตั้งต้น (Integer) */}
              <td className="py-2 px-1 text-right font-mono text-[#5A8A88] sticky bottom-0 bg-[#E8F3F2]">
                {totals.opening > 0 ? Math.round(totals.opening).toLocaleString('th-TH') : '0'}
              </td>

              {/* 3. เงินโอน (Integer) */}
              <td className="py-2 px-1 text-right font-mono text-[#5A8A88] sticky bottom-0 bg-[#E8F3F2]">
                {totals.transfer > 0 ? Math.round(totals.transfer).toLocaleString('th-TH') : '0'}
              </td>

              {/* 4. เงินสด (Integer) */}
              <td className="py-2 px-1 text-right font-mono text-[#5A8A88] sticky bottom-0 bg-[#E8F3F2]">
                {totals.cash > 0 ? Math.round(totals.cash).toLocaleString('th-TH') : '0'}
              </td>

              {/* 5. บัตรเครดิต (2 decimal places) */}
              <td className="py-2 px-1 text-right font-mono text-[#5A8A88] sticky bottom-0 bg-[#E8F3F2]">
                {totals.credit > 0 
                  ? totals.credit.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                  : '0.00'}
              </td>

              {/* 6. รายรับรวม (Integer, bold) */}
              <td className="py-2 px-1 text-right font-mono text-[#2D4A49] font-[800] sticky bottom-0 bg-[#E8F3F2]">
                {totals.revenue > 0 ? Math.round(totals.revenue).toLocaleString('th-TH') : '0'}
              </td>

              {/* 7. เงินในลิ้นชักตอนปิดร้าน (Integer) */}
              <td className="py-2 px-1 text-right font-mono text-[#5A8A88] sticky bottom-0 bg-[#E8F3F2]">
                {totals.closing > 0 ? Math.round(totals.closing).toLocaleString('th-TH') : '0'}
              </td>

              {/* 8. หมายเหตุ */}
              <td className="py-2 px-2 text-left text-[9px] text-[#6B8F8E] font-normal sticky bottom-0 bg-[#E8F3F2]">
                รวม {displayedDays.length} วัน
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default DailySalesRecord;
