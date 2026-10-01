import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  BookOpen, 
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
  CalendarRange,
  Lock,
  Calendar
} from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, eachDayOfInterval, parseISO, isAfter } from 'date-fns';
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
  totalRevenue: number | '';
  transfer: number | '';
  cash: number | '';
  creditCard: number | '';
  closingCash: number | '';
  note: string;
  isAutoCalculated?: boolean;
}

export function DailySalesRecord({ user, branch = 'Rayong', onNavigate }: DailySalesRecordProps) {
  const currentBranch = branch || user?.branch || 'Rayong';
  const recorderName = user?.name || 'Admin';

  // Admin permission check
  const isAdmin = useMemo(() => {
    const role = (user?.role || '').toUpperCase();
    return (
      role === 'ADMIN' || 
      role === 'CO-FOUNDER' || 
      role === 'OWNER' || 
      user?.permissions?.canEditDateRange === true
    );
  }, [user]);

  // Date range modes: 'week' or 'custom'
  const [isCustomRangeMode, setIsCustomRangeMode] = useState<boolean>(false);
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  // Custom date picker states
  const [customStartDate, setCustomStartDate] = useState<string>(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(() => format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6), 'yyyy-MM-dd'));
  const [activeCustomRange, setActiveCustomRange] = useState<{ start: string; end: string } | null>(null);

  const [rows, setRows] = useState<DailySalesRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [tableExistsWarning, setTableExistsWarning] = useState<string | null>(null);

  // Generate displayed days based on mode (Week or Custom Range)
  const displayedDays = useMemo(() => {
    if (isCustomRangeMode && activeCustomRange) {
      try {
        const start = parseISO(activeCustomRange.start);
        const end = parseISO(activeCustomRange.end);
        
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
          };
        });
      } catch (e) {
        console.error('Error generating custom range days', e);
      }
    }

    // Default 7 days of the week (Mon-Sun)
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(currentWeek, i);
      const dayName = format(d, 'EEEE', { locale: th });
      const shortDate = format(d, 'dd/MM/yyyy');
      return {
        dateStr: format(d, 'yyyy-MM-dd'),
        displayLabel: `${dayName} (${shortDate})`,
        rawDate: d,
      };
    });
  }, [isCustomRangeMode, activeCustomRange, currentWeek]);

  // Load data for the displayed days from Supabase or LocalStorage
  const loadData = useCallback(async () => {
    if (displayedDays.length === 0) return;

    const dates = displayedDays.map(w => w.dateStr);
    const localKey = `daily_sales_${currentBranch}_${dates[0]}`;
    
    // Default empty rows
    const initialRows: DailySalesRow[] = displayedDays.map(w => ({
      date: w.dateStr,
      dayLabel: w.displayLabel,
      openingCash: '',
      totalRevenue: '',
      transfer: '',
      cash: '',
      creditCard: '',
      closingCash: '',
      note: '',
      isAutoCalculated: true,
    }));

    let loadedMap: Record<string, Partial<DailySalesRow>> = {};

    // 1. Try LocalStorage first
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
              totalRevenue: rec.total_revenue === null || rec.total_revenue === undefined ? '' : Math.round(Number(rec.total_revenue)),
              transfer: rec.transfer === null || rec.transfer === undefined ? '' : Math.round(Number(rec.transfer)),
              cash: rec.cash === null || rec.cash === undefined ? '' : Math.round(Number(rec.cash)),
              creditCard: rec.credit_card === null || rec.credit_card === undefined ? '' : Number(rec.credit_card),
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
    el.style.height = `${Math.max(32, el.scrollHeight)}px`;
  };

  // Handle cell value change (Change 3: Integer parsing vs Float for CC)
  const handleChange = (index: number, field: keyof DailySalesRow, rawValue: string) => {
    setRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === 'note') {
        row.note = rawValue;
      } else if (field === 'creditCard') {
        // Keep 2 decimal places for credit card
        const numVal = rawValue === '' ? '' : parseFloat(rawValue);
        row.creditCard = (numVal === '' || isNaN(numVal)) ? '' : numVal;
      } else {
        // Integer only for openingCash, transfer, cash, closingCash, totalRevenue
        const numVal = rawValue === '' ? '' : parseInt(rawValue, 10);
        (row as any)[field] = (numVal === '' || isNaN(numVal)) ? '' : numVal;
      }

      // Auto calculate totalRevenue if editing transfer, cash, or creditCard
      if (field === 'transfer' || field === 'cash' || field === 'creditCard') {
        const t = row.transfer === '' ? 0 : Number(row.transfer);
        const c = row.cash === '' ? 0 : Number(row.cash);
        const cc = row.creditCard === '' ? 0 : Number(row.creditCard);

        if (t > 0 || c > 0 || cc > 0) {
          // Total revenue is formatted as integer or sum
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
            total_revenue: r.totalRevenue === '' ? 0 : Math.round(Number(r.totalRevenue)),
            transfer: r.transfer === '' ? 0 : Math.round(Number(r.transfer)),
            cash: r.cash === '' ? 0 : Math.round(Number(r.cash)),
            credit_card: r.creditCard === '' ? 0 : Number(Number(r.creditCard).toFixed(2)),
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

  // Export to CSV / Excel
  const handleExportExcel = () => {
    const headers = [
      'วันที่',
      'เงินในลิ้นชักตั้งต้น (บาท)',
      'รายรับรวม (บาท)',
      'เงินโอน (บาท)',
      'เงินสด (บาท)',
      'บัตรเครดิต (บาท)',
      'เงินในลิ้นชักตอนปิดร้าน (บาท)',
      'หมายเหตุ',
    ];

    const csvRows = [headers.join(',')];

    rows.forEach(r => {
      const row = [
        `"${r.dayLabel}"`,
        r.openingCash !== '' ? Math.round(Number(r.openingCash)) : 0,
        r.totalRevenue !== '' ? Math.round(Number(r.totalRevenue)) : 0,
        r.transfer !== '' ? Math.round(Number(r.transfer)) : 0,
        r.cash !== '' ? Math.round(Number(r.cash)) : 0,
        r.creditCard !== '' ? Number(r.creditCard).toFixed(2) : '0.00',
        r.closingCash !== '' ? Math.round(Number(r.closingCash)) : 0,
        `"${(r.note || '').replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(','));
    });

    // Summary row
    const sumOpening = rows.reduce((s, r) => s + (Number(r.openingCash) || 0), 0);
    const sumRevenue = rows.reduce((s, r) => s + (Number(r.totalRevenue) || 0), 0);
    const sumTransfer = rows.reduce((s, r) => s + (Number(r.transfer) || 0), 0);
    const sumCash = rows.reduce((s, r) => s + (Number(r.cash) || 0), 0);
    const sumCredit = rows.reduce((s, r) => s + (Number(r.creditCard) || 0), 0);
    const sumClosing = rows.reduce((s, r) => s + (Number(r.closingCash) || 0), 0);

    csvRows.push([
      `"รวม ${summaryDateRangeLabel}"`,
      Math.round(sumOpening),
      Math.round(sumRevenue),
      Math.round(sumTransfer),
      Math.round(sumCash),
      sumCredit.toFixed(2),
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

  // Change 5: Summary calculations based strictly on displayed rows
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        opening: acc.opening + (r.openingCash !== '' ? Number(r.openingCash) : 0),
        revenue: acc.revenue + (r.totalRevenue !== '' ? Number(r.totalRevenue) : 0),
        transfer: acc.transfer + (r.transfer !== '' ? Number(r.transfer) : 0),
        cash: acc.cash + (r.cash !== '' ? Number(r.cash) : 0),
        credit: acc.credit + (r.creditCard !== '' ? Number(r.creditCard) : 0),
        closing: acc.closing + (r.closingCash !== '' ? Number(r.closingCash) : 0),
      }),
      { opening: 0, revenue: 0, transfer: 0, cash: 0, credit: 0, closing: 0 }
    );
  }, [rows]);

  // Date range label for header and summary
  const summaryDateRangeLabel = useMemo(() => {
    if (displayedDays.length === 0) return '';
    const first = displayedDays[0].rawDate;
    const last = displayedDays[displayedDays.length - 1].rawDate;
    const firstStr = format(first, 'd MMM', { locale: th });
    const lastStr = format(last, 'd MMM yyyy', { locale: th });
    return `${firstStr} - ${lastStr}`;
  }, [displayedDays]);

  const weekStartStr = format(currentWeek, 'd MMM', { locale: th });
  const weekEndStr = format(addDays(currentWeek, 6), 'd MMM yyyy', { locale: th });

  // Handle apply custom range
  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStartDate || !customEndDate) return;
    setActiveCustomRange({
      start: customStartDate,
      end: customEndDate,
    });
  };

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
              คอลัมน์ในตาราง daily_sales_records: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">date (text), branch (text), opening_cash (numeric), total_revenue (numeric), transfer (numeric), cash (numeric), credit_card (numeric), closing_cash (numeric), note (text), recorded_by (text), created_at (timestamptz)</code>
            </p>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HEADER CARD
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-2xl border border-[#D4E4E3] p-5 shadow-[0_2px_8px_rgba(90,138,136,0.08)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Title & Branch Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] border border-[#D4E4E3] shadow-xs shrink-0">
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

          {/* Right: Date Range Control + Save Button + Export Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* MODE 1: Week Navigator (Default) */}
            {!isCustomRangeMode && (
              <div className="flex items-center bg-[#E8F3F2] border border-[#D4E4E3] rounded-xl p-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5A8A88] hover:bg-white transition-colors cursor-pointer"
                  title="สัปดาห์ก่อนหน้า"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-1.5 px-3 text-[12px] font-[500] text-[#2D4A49]">
                  <CalendarIcon size={13} className="text-[#5A8A88]" />
                  <span>สัปดาห์ที่ {weekStartStr} - {weekEndStr}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5A8A88] hover:bg-white transition-colors cursor-pointer"
                  title="สัปดาห์ถัดไป"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Change 4: Admin Toggle for Custom Date Range */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (!isCustomRangeMode) {
                    setIsCustomRangeMode(true);
                    setActiveCustomRange({ start: customStartDate, end: customEndDate });
                  } else {
                    setIsCustomRangeMode(false);
                    setActiveCustomRange(null);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-[500] border transition-all cursor-pointer shadow-xs ${
                  isCustomRangeMode
                    ? 'bg-[#2D4A49] text-white border-[#2D4A49]'
                    : 'bg-[#F0F5F4] text-[#5A8A88] border-[#D4E4E3] hover:bg-[#E8F3F2]'
                }`}
                title="กำหนดช่วงวันที่เอง (Admin Only)"
              >
                <CalendarRange size={13} />
                <span>{isCustomRangeMode ? 'กลับสู่โหมดสัปดาห์' : 'กำหนดช่วงวันที่เอง'}</span>
              </button>
            )}

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-[#5A8A88] hover:bg-[#4A7A78] text-white text-[12px] font-[600] rounded-[10px] px-4 py-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
              className="flex items-center gap-1.5 bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] text-[12px] font-[500] rounded-[10px] px-3 py-2 transition-colors shadow-xs cursor-pointer"
              title="ส่งออกไฟล์ Excel (CSV)"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] text-[12px] font-[500] rounded-[10px] px-3 py-2 transition-colors shadow-xs cursor-pointer"
              title="พิมพ์รายงาน (PDF)"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">PDF</span>
            </button>

          </div>

        </div>

        {/* MODE 2: Admin Custom Date Range Form (when toggle is ON) */}
        {isCustomRangeMode && isAdmin && (
          <form 
            onSubmit={handleApplyCustomRange}
            className="mt-4 pt-3.5 border-t border-[#D4E4E3] flex items-center gap-3 flex-wrap animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2D4A49]">
              <Lock size={13} className="text-[#5A8A88]" />
              <span>ช่วงวันที่กำหนดเอง:</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] text-[#6B8F8E]">วันที่เริ่มต้น</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-[#5A8A88] rounded-[8px] px-3 py-1.5 text-[12px] text-[#2D4A49] focus:outline-none focus:ring-1 focus:ring-[#5A8A88]"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] text-[#6B8F8E]">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-[#5A8A88] rounded-[8px] px-3 py-1.5 text-[12px] text-[#2D4A49] focus:outline-none focus:ring-1 focus:ring-[#5A8A88]"
              />
            </div>

            <button
              type="submit"
              className="bg-[#5A8A88] hover:bg-[#4A7A78] text-white text-[12px] font-[600] rounded-[8px] px-4 py-1.5 transition-colors cursor-pointer shadow-xs"
            >
              ดูช่วงนี้
            </button>
          </form>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          TABLE CARD (Change 2: Tablet View + Auto-expand)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-[0_2px_8px_rgba(90,138,136,0.06)]">
        <div className="w-full overflow-x-auto">
          <table 
            style={{ tableLayout: 'fixed' }} 
            className="w-full text-left border-collapse min-w-[780px]"
          >
            {/* Column Width Specifications */}
            <colgroup>
              <col style={{ width: '130px' }} /> {/* วันที่ */}
              <col style={{ width: '110px' }} /> {/* เงินในลิ้นชักตั้งต้น */}
              <col style={{ width: '100px' }} /> {/* รายรับรวม */}
              <col style={{ width: '90px' }} />  {/* เงินโอน */}
              <col style={{ width: '90px' }} />  {/* เงินสด */}
              <col style={{ width: '95px' }} />  {/* บัตรเครดิต */}
              <col style={{ width: '115px' }} /> {/* เงินในลิ้นชักตอนปิดร้าน */}
              <col style={{ minWidth: '80px', width: 'auto' }} /> {/* หมายเหตุ */}
            </colgroup>

            {/* Table Header */}
            <thead>
              <tr className="bg-[#2D4A49] text-white text-[11px] font-[600] border-b border-[#1E3A39]">
                <th className="py-2.5 px-3 text-center">วันที่</th>
                <th className="py-2.5 px-2 text-right">เงินในลิ้นชักตั้งต้น</th>
                <th className="py-2.5 px-2 text-right">รายรับรวม</th>
                <th className="py-2.5 px-2 text-right">เงินโอน</th>
                <th className="py-2.5 px-2 text-right">เงินสด</th>
                <th className="py-2.5 px-2 text-right">บัตรเครดิต</th>
                <th className="py-2.5 px-2 text-right">เงินในลิ้นชักตอนปิดร้าน</th>
                <th className="py-2.5 px-3 text-left">หมายเหตุ</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[#F0F5F4] text-xs">
              {rows.map((row, index) => (
                <tr 
                  key={row.date}
                  className={`transition-colors hover:bg-[#E8F3F2]/40 items-start align-top ${
                    index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFA]'
                  }`}
                  style={{ minHeight: '40px' }}
                >
                  {/* Date Column */}
                  <td className="py-2.5 px-3 text-center bg-[#F0F5F4] border-r border-[#D4E4E3] font-[600] text-[#2D4A49] whitespace-nowrap text-[11px] align-top">
                    {row.dayLabel}
                  </td>

                  {/* 1. เงินในลิ้นชักตั้งต้น (Integer only) */}
                  <td className="py-1.5 px-1.5 align-top">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row.openingCash === '' ? '' : row.openingCash}
                      onChange={(e) => handleChange(index, 'openingCash', e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-[#D4E4E3] rounded-[6px] text-[12px] font-[400] font-mono text-right px-2 py-1.5 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 2. รายรับรวม (Integer only, Auto Calculated / Editable) */}
                  <td className="py-1.5 px-1.5 align-top">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row.totalRevenue === '' ? '' : row.totalRevenue}
                      onChange={(e) => handleChange(index, 'totalRevenue', e.target.value)}
                      placeholder="0"
                      className={`w-full border rounded-[6px] text-[12px] font-[400] font-mono text-right px-2 py-1.5 transition-colors focus:outline-none focus:border-[#5A8A88] ${
                        row.isAutoCalculated && row.totalRevenue !== ''
                          ? 'bg-[#E8F3F2] border-[#5A8A88] text-[#5A8A88] font-[600]'
                          : 'bg-white border-[#D4E4E3] text-[#2D4A49] focus:bg-[#E8F3F2]'
                      }`}
                      title={row.isAutoCalculated ? 'คำนวณอัตโนมัติจาก เงินโอน + เงินสด + บัตรเครดิต' : 'ยอดที่ระบุเอง'}
                    />
                  </td>

                  {/* 3. เงินโอน (Integer only) */}
                  <td className="py-1.5 px-1.5 align-top">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row.transfer === '' ? '' : row.transfer}
                      onChange={(e) => handleChange(index, 'transfer', e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-[#D4E4E3] rounded-[6px] text-[12px] font-[400] font-mono text-right px-2 py-1.5 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 4. เงินสด (Integer only) */}
                  <td className="py-1.5 px-1.5 align-top">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row.cash === '' ? '' : row.cash}
                      onChange={(e) => handleChange(index, 'cash', e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-[#D4E4E3] rounded-[6px] text-[12px] font-[400] font-mono text-right px-2 py-1.5 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 5. บัตรเครดิต (2 decimal places) */}
                  <td className="py-1.5 px-1.5 align-top">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.creditCard === '' ? '' : row.creditCard}
                      onChange={(e) => handleChange(index, 'creditCard', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#D4E4E3] rounded-[6px] text-[12px] font-[400] font-mono text-right px-2 py-1.5 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 6. เงินในลิ้นชักตอนปิดร้าน (Integer only) */}
                  <td className="py-1.5 px-1.5 align-top">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row.closingCash === '' ? '' : row.closingCash}
                      onChange={(e) => handleChange(index, 'closingCash', e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-[#D4E4E3] rounded-[6px] text-[12px] font-[400] font-mono text-right px-2 py-1.5 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 7. หมายเหตุ (Change 2: Auto-expanding Textarea) */}
                  <td className="py-1.5 px-2 align-top">
                    <textarea
                      rows={1}
                      value={row.note}
                      onInput={(e) => autoExpand(e.target as HTMLTextAreaElement)}
                      onChange={(e) => handleChange(index, 'note', e.target.value)}
                      placeholder="หมายเหตุ..."
                      style={{
                        resize: 'none',
                        overflow: 'hidden',
                        minHeight: '32px',
                        lineHeight: '1.4',
                        transition: 'height 100ms ease',
                      }}
                      className="w-full bg-white border border-[#D4E4E3] rounded-[6px] text-[11px] text-left p-[5px_8px] text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2]"
                    />
                  </td>
                </tr>
              ))}

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  SUMMARY ROW (Change 5: Dynamic calculation & label)
                  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              <tr 
                style={{ background: '#E8F3F2', borderTop: '2px solid #5A8A88' }}
                className="text-[#2D4A49] text-[12px] font-[700]"
              >
                {/* Dynamic Label */}
                <td className="py-3 px-3 text-left border-r border-[#D4E4E3] font-[700] text-[#2D4A49] whitespace-nowrap">
                  รวม {summaryDateRangeLabel}
                </td>

                {/* 1. เงินในลิ้นชักตั้งต้น (Integer) */}
                <td className="py-3 px-2 text-right font-mono text-[#5A8A88]">
                  {totals.opening > 0 ? Math.round(totals.opening).toLocaleString('th-TH') : '0'}
                </td>

                {/* 2. รายรับรวม (Integer) */}
                <td className="py-3 px-2 text-right font-mono text-[#2D4A49] font-[800]">
                  {totals.revenue > 0 ? Math.round(totals.revenue).toLocaleString('th-TH') : '0'}
                </td>

                {/* 3. เงินโอน (Integer) */}
                <td className="py-3 px-2 text-right font-mono text-[#5A8A88]">
                  {totals.transfer > 0 ? Math.round(totals.transfer).toLocaleString('th-TH') : '0'}
                </td>

                {/* 4. เงินสด (Integer) */}
                <td className="py-3 px-2 text-right font-mono text-[#5A8A88]">
                  {totals.cash > 0 ? Math.round(totals.cash).toLocaleString('th-TH') : '0'}
                </td>

                {/* 5. บัตรเครดิต (2 decimal places) */}
                <td className="py-3 px-2 text-right font-mono text-[#5A8A88]">
                  {totals.credit > 0 
                    ? totals.credit.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                    : '0.00'}
                </td>

                {/* 6. เงินในลิ้นชักตอนปิดร้าน (Integer) */}
                <td className="py-3 px-2 text-right font-mono text-[#5A8A88]">
                  {totals.closing > 0 ? Math.round(totals.closing).toLocaleString('th-TH') : '0'}
                </td>

                {/* 7. หมายเหตุ column in summary */}
                <td className="py-3 px-3 text-left text-[11px] text-[#6B8F8E] font-normal">
                  ยอดรวม {displayedDays.length} วัน
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DailySalesRecord;
