import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  RefreshCw,
  Info
} from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { th } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

export interface DailySalesRecordProps {
  user?: {
    name: string;
    role?: string;
    branch?: string;
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

  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [rows, setRows] = useState<DailySalesRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [tableExistsWarning, setTableExistsWarning] = useState<string | null>(null);

  // Generate 7 days for the current week (Mon-Sun)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(currentWeek, i);
      const dayName = format(d, 'EEEE', { locale: th });
      const shortDate = format(d, 'dd/MM/yyyy');
      return {
        dateStr: format(d, 'yyyy-MM-dd'),
        displayLabel: `${dayName} (${shortDate})`,
        shortDay: format(d, 'EEE dd MMM', { locale: th }),
      };
    });
  }, [currentWeek]);

  // Load data for the week from Supabase or LocalStorage
  const loadWeekData = useCallback(async () => {
    const dates = weekDays.map(w => w.dateStr);
    const localKey = `daily_sales_${currentBranch}_${dates[0]}`;
    
    // Default empty rows
    const initialRows: DailySalesRow[] = weekDays.map(w => ({
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
              openingCash: rec.opening_cash ?? '',
              totalRevenue: rec.total_revenue ?? '',
              transfer: rec.transfer ?? '',
              cash: rec.cash ?? '',
              creditCard: rec.credit_card ?? '',
              closingCash: rec.closing_cash ?? '',
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
        const t = found.transfer === '' || found.transfer === undefined ? 0 : Number(found.transfer);
        const c = found.cash === '' || found.cash === undefined ? 0 : Number(found.cash);
        const cc = found.creditCard === '' || found.creditCard === undefined ? 0 : Number(found.creditCard);
        const autoTot = (t || c || cc) ? (t + c + cc) : '';
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
  }, [currentBranch, weekDays]);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

  // Handle cell value change
  const handleChange = (index: number, field: keyof DailySalesRow, value: string) => {
    setRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === 'note') {
        row.note = value;
      } else {
        const numVal = value === '' ? '' : Number(value);
        (row as any)[field] = isNaN(numVal as number) ? '' : numVal;

        // Auto calculate totalRevenue if editing transfer, cash, or creditCard
        if (field === 'transfer' || field === 'cash' || field === 'creditCard') {
          const t = field === 'transfer' ? (numVal === '' ? 0 : Number(numVal)) : (row.transfer === '' ? 0 : Number(row.transfer));
          const c = field === 'cash' ? (numVal === '' ? 0 : Number(numVal)) : (row.cash === '' ? 0 : Number(row.cash));
          const cc = field === 'creditCard' ? (numVal === '' ? 0 : Number(numVal)) : (row.creditCard === '' ? 0 : Number(row.creditCard));

          if (t > 0 || c > 0 || cc > 0) {
            row.totalRevenue = t + c + cc;
            row.isAutoCalculated = true;
          } else {
            row.totalRevenue = '';
          }
        } else if (field === 'totalRevenue') {
          row.isAutoCalculated = false;
        }
      }

      updated[index] = row;
      return updated;
    });
  };

  // Save to Supabase and LocalStorage
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);

    const dates = weekDays.map(w => w.dateStr);
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
          .filter(r => r.openingCash !== '' || r.totalRevenue !== '' || r.transfer !== '' || r.cash !== '' || r.creditCard !== '' || r.closingCash !== '' || r.note.trim() !== '')
          .map(r => ({
            date: r.date,
            branch: currentBranch,
            opening_cash: r.openingCash === '' ? 0 : Number(r.openingCash),
            total_revenue: r.totalRevenue === '' ? 0 : Number(r.totalRevenue),
            transfer: r.transfer === '' ? 0 : Number(r.transfer),
            cash: r.cash === '' ? 0 : Number(r.cash),
            credit_card: r.creditCard === '' ? 0 : Number(r.creditCard),
            closing_cash: r.closingCash === '' ? 0 : Number(r.closingCash),
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
        r.openingCash !== '' ? r.openingCash : 0,
        r.totalRevenue !== '' ? r.totalRevenue : 0,
        r.transfer !== '' ? r.transfer : 0,
        r.cash !== '' ? r.cash : 0,
        r.creditCard !== '' ? r.creditCard : 0,
        r.closingCash !== '' ? r.closingCash : 0,
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
      '"รวมทั้งสัปดาห์"',
      sumOpening,
      sumRevenue,
      sumTransfer,
      sumCash,
      sumCredit,
      sumClosing,
      '""',
    ].join(','));

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const startStr = format(weekDays[0].dateStr ? new Date(weekDays[0].dateStr) : currentWeek, 'yyyyMMdd');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Sales_Record_${currentBranch}_${startStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export / Print PDF
  const handlePrint = () => {
    window.print();
  };

  // Calculate totals
  const totals = useMemo(() => {
    let opening = 0;
    let revenue = 0;
    let transfer = 0;
    let cash = 0;
    let credit = 0;
    let closing = 0;

    rows.forEach(r => {
      if (r.openingCash !== '') opening += Number(r.openingCash);
      if (r.totalRevenue !== '') revenue += Number(r.totalRevenue);
      if (r.transfer !== '') transfer += Number(r.transfer);
      if (r.cash !== '') cash += Number(r.cash);
      if (r.creditCard !== '') credit += Number(r.creditCard);
      if (r.closingCash !== '') closing += Number(r.closingCash);
    });

    return { opening, revenue, transfer, cash, credit, closing };
  }, [rows]);

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
              คอลัมน์ที่ต้องสร้างใน Supabase: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">date (text), branch (text), opening_cash (numeric), total_revenue (numeric), transfer (numeric), cash (numeric), credit_card (numeric), closing_cash (numeric), note (text), recorded_by (text), created_at (timestamptz)</code> (Primary key: date, branch)
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
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-[#2D4A49] tracking-tight">
                  บันทึกยอดขายประจำวัน
                </h1>
                <span className="text-[10px] font-semibold bg-[#E8F3F2] text-[#5A8A88] px-2 py-0.5 rounded-full border border-[#D4E4E3]">
                  สาขา {currentBranch}
                </span>
              </div>
              <p className="text-[11px] text-[#6B8F8E] mt-0.5">
                บันทึกยอดรายรับ เงินสด เงินโอน บัตรเครดิต และเงินในลิ้นชักประจำวัน
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
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] text-[12px] font-medium rounded-[10px] px-3 py-2 transition-colors shadow-xs"
              title="พิมพ์รายงาน (PDF)"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">PDF</span>
            </button>

          </div>

        </div>
      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-[0_2px_8px_rgba(90,138,136,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-[#2D4A49] text-white text-[11px] font-semibold border-b border-[#1E3A39]">
                <th className="py-2.5 px-3 text-center w-[130px]">วันที่</th>
                <th className="py-2.5 px-3 text-right w-[130px]">เงินในลิ้นชักตั้งต้น</th>
                <th className="py-2.5 px-3 text-right w-[120px]">รายรับรวม</th>
                <th className="py-2.5 px-3 text-right w-[110px]">เงินโอน</th>
                <th className="py-2.5 px-3 text-right w-[110px]">เงินสด</th>
                <th className="py-2.5 px-3 text-right w-[110px]">บัตรเครดิต</th>
                <th className="py-2.5 px-3 text-right w-[140px]">เงินในลิ้นชักตอนปิดร้าน</th>
                <th className="py-2.5 px-3 text-left">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F5F4] text-xs">
              {rows.map((row, index) => (
                <tr 
                  key={row.date}
                  className={`transition-colors hover:bg-[#E8F3F2]/40 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFA]'
                  }`}
                >
                  {/* Date Column */}
                  <td className="py-2 px-3 text-center bg-[#F0F5F4] border-r border-[#D4E4E3] font-semibold text-[#2D4A49] whitespace-nowrap text-[12px]">
                    {row.dayLabel}
                  </td>

                  {/* 1. เงินในลิ้นชักตั้งต้น */}
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={row.openingCash}
                      onChange={(e) => handleChange(index, 'openingCash', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#D4E4E3] rounded-md text-[12px] font-mono text-right px-2.5 py-1.5 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 2. รายรับรวม (Auto Calculated / Editable) */}
                  <td className="py-1.5 px-2">
                    <div className="relative">
                      <input
                        type="number"
                        value={row.totalRevenue}
                        onChange={(e) => handleChange(index, 'totalRevenue', e.target.value)}
                        placeholder="0.00"
                        className={`w-full border rounded-md text-[12px] font-mono font-semibold text-right px-2.5 py-1.5 transition-colors focus:outline-none focus:border-[#5A8A88] ${
                          row.isAutoCalculated && row.totalRevenue !== ''
                            ? 'bg-[#E8F3F2] border-[#5A8A88] text-[#5A8A88]'
                            : 'bg-white border-[#D4E4E3] text-[#2D4A49] focus:bg-[#E8F3F2]'
                        }`}
                        title={row.isAutoCalculated ? 'คำนวณอัตโนมัติจาก เงินโอน + เงินสด + บัตรเครดิต' : 'ยอดที่ระบุเอง'}
                      />
                    </div>
                  </td>

                  {/* 3. เงินโอน */}
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={row.transfer}
                      onChange={(e) => handleChange(index, 'transfer', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#D4E4E3] rounded-md text-[12px] font-mono text-right px-2.5 py-1.5 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 4. เงินสด */}
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={row.cash}
                      onChange={(e) => handleChange(index, 'cash', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#D4E4E3] rounded-md text-[12px] font-mono text-right px-2.5 py-1.5 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 5. บัตรเครดิต */}
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={row.creditCard}
                      onChange={(e) => handleChange(index, 'creditCard', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#D4E4E3] rounded-md text-[12px] font-mono text-right px-2.5 py-1.5 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 6. เงินในลิ้นชักตอนปิดร้าน */}
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={row.closingCash}
                      onChange={(e) => handleChange(index, 'closingCash', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#D4E4E3] rounded-md text-[12px] font-mono text-right px-2.5 py-1.5 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>

                  {/* 7. หมายเหตุ */}
                  <td className="py-1.5 px-2">
                    <input
                      type="text"
                      value={row.note}
                      onChange={(e) => handleChange(index, 'note', e.target.value)}
                      placeholder="หมายเหตุ..."
                      className="w-full bg-white border border-[#D4E4E3] rounded-md text-[12px] text-left px-2.5 py-1.5 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2] transition-colors"
                    />
                  </td>
                </tr>
              ))}

              {/* SUMMARY ROW */}
              <tr className="bg-[#E8F3F2] text-[#2D4A49] text-[12px] font-bold border-t-2 border-[#B8D4D2]">
                <td className="py-3 px-3 text-center border-r border-[#D4E4E3]">
                  รวมทั้งสัปดาห์
                </td>
                <td className="py-3 px-3 text-right font-mono text-[#5A8A88]">
                  {totals.opening.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-3 text-right font-mono text-[#2D4A49] font-black">
                  {totals.revenue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-3 text-right font-mono text-[#5A8A88]">
                  {totals.transfer.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-3 text-right font-mono text-[#5A8A88]">
                  {totals.cash.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-3 text-right font-mono text-[#5A8A88]">
                  {totals.credit.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-3 text-right font-mono text-[#5A8A88]">
                  {totals.closing.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-3 text-left text-[11px] text-[#6B8F8E] font-normal">
                  ยอดรวม 7 วัน
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
