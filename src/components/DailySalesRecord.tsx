import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Plus, 
  X, 
  RefreshCw,
  Pencil,
  Check
} from 'lucide-react';
import { format, eachDayOfInterval, parseISO, isAfter, addMonths, subMonths } from 'date-fns';
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
  notes: string[];
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

// Day name abbreviations in Thai
const DAY_ABBREV: Record<number, string> = {
  0: 'อา.',
  1: 'จ.',
  2: 'อ.',
  3: 'พ.',
  4: 'พฤ.',
  5: 'ศ.',
  6: 'ส.',
};

// Format compact date cell e.g. "จ. 28/09"
const formatDateCell = (d: Date): string => {
  const abbrev = DAY_ABBREV[d.getDay()] || '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${abbrev} ${dd}/${mm}`;
};

// Branch-specific default date range helper
const getDefaultDateRange = (branchName: string) => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const cutoffDay = branchName === 'Bangkok' ? 28 : 25;

  let startMonth = currentMonth;
  let startYear = currentYear;

  if (currentDay < cutoffDay) {
    startMonth = currentMonth - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear = currentYear - 1;
    }
  }

  const start = new Date(startYear, startMonth, cutoffDay);
  const end = new Date(
    startMonth === 11 ? startYear + 1 : startYear,
    startMonth === 11 ? 0 : startMonth + 1,
    cutoffDay
  );
  return { start, end };
};

export function DailySalesRecord({ user, branch = 'Rayong', onNavigate }: DailySalesRecordProps) {
  const currentBranch = branch || user?.branch || 'Rayong';
  const recorderName = user?.name || 'Admin';

  // Admin / Authorized check for custom date range editing
  const canEditDate = useMemo(() => {
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
  
  // Applied date range
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [tableExistsWarning, setTableExistsWarning] = useState<string | null>(null);

  // Active adding note index and text
  const [activeNoteInputIdx, setActiveNoteInputIdx] = useState<number | null>(null);
  const [newNoteText, setNewNoteText] = useState<string>('');

  // Active editing note state
  const [editingNote, setEditingNote] = useState<{
    rowIndex: number;
    noteIndex: number;
    text: string;
  } | null>(null);

  // Export dropdown state and outside click
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    if (isExportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportOpen]);

  // Generate displayed days from appliedRange
  const displayedDays = useMemo(() => {
    try {
      const start = parseISO(appliedRange.start);
      const end = parseISO(appliedRange.end);
      
      const effectiveStart = isAfter(start, end) ? end : start;
      const effectiveEnd = isAfter(start, end) ? start : end;
      
      const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
      return days.map(d => {
        return {
          dateStr: format(d, 'yyyy-MM-dd'),
          displayLabel: formatDateCell(d),
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
    
    // Default empty rows
    const initialRows: DailySalesRow[] = displayedDays.map(w => ({
      date: w.dateStr,
      dayLabel: w.displayLabel,
      openingCash: '',
      transfer: '',
      cash: '',
      creditCard: '',
      totalRevenue: '',
      closingCash: '',
      notes: [],
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
            if (item.date) {
              let notesArr: string[] = [];
              if (Array.isArray(item.notes)) {
                notesArr = item.notes;
              } else if (typeof item.note === 'string' && item.note.trim()) {
                notesArr = item.note.split('\n').filter(Boolean);
              }
              loadedMap[item.date] = { ...item, notes: notesArr };
            }
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
            let notesArr: string[] = [];
            if (typeof rec.note === 'string' && rec.note.trim()) {
              notesArr = rec.note.split('\n').map((s: string) => s.trim()).filter(Boolean);
            }
            loadedMap[rec.date] = {
              date: rec.date,
              openingCash: rec.opening_cash === null || rec.opening_cash === undefined ? '' : Math.round(Number(rec.opening_cash)),
              transfer: rec.transfer === null || rec.transfer === undefined ? '' : Math.round(Number(rec.transfer)),
              cash: rec.cash === null || rec.cash === undefined ? '' : Math.round(Number(rec.cash)),
              creditCard: rec.credit_card === null || rec.credit_card === undefined ? '' : Number(rec.credit_card),
              totalRevenue: rec.total_revenue === null || rec.total_revenue === undefined ? '' : Math.round(Number(rec.total_revenue)),
              closingCash: rec.closing_cash === null || rec.closing_cash === undefined ? '' : Math.round(Number(rec.closing_cash)),
              notes: notesArr,
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
          notes: found.notes || [],
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

  // Handle cell value change
  const handleChange = (index: number, field: keyof DailySalesRow, rawValue: string) => {
    setRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === 'creditCard') {
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

  // Add a note to a row
  const handleAddNote = (rowIndex: number, noteText: string) => {
    const text = noteText.trim();
    if (!text) {
      setActiveNoteInputIdx(null);
      setNewNoteText('');
      return;
    }

    setRows(prev => {
      const updated = [...prev];
      const currentNotes = updated[rowIndex].notes || [];
      updated[rowIndex] = {
        ...updated[rowIndex],
        notes: [...currentNotes, text],
      };
      return updated;
    });

    setActiveNoteInputIdx(null);
    setNewNoteText('');
  };

  // Delete a note from a row
  const handleDeleteNote = (rowIndex: number, noteIndex: number) => {
    if (editingNote && editingNote.rowIndex === rowIndex && editingNote.noteIndex === noteIndex) {
      setEditingNote(null);
    }
    setRows(prev => {
      const updated = [...prev];
      const currentNotes = [...(updated[rowIndex].notes || [])];
      currentNotes.splice(noteIndex, 1);
      updated[rowIndex] = {
        ...updated[rowIndex],
        notes: currentNotes,
      };
      return updated;
    });
  };

  // Start editing a note
  const startEditNote = (rowIndex: number, noteIndex: number, currentText: string) => {
    setActiveNoteInputIdx(null);
    setNewNoteText('');
    setEditingNote({
      rowIndex,
      noteIndex,
      text: currentText,
    });
  };

  // Save edited note
  const saveEditNote = () => {
    if (!editingNote) return;
    const trimmed = editingNote.text.trim();
    const { rowIndex, noteIndex } = editingNote;

    if (!trimmed) {
      // If emptied out, delete note
      handleDeleteNote(rowIndex, noteIndex);
    } else {
      setRows(prev => {
        const updated = [...prev];
        if (!updated[rowIndex]) return prev;
        const currentNotes = [...(updated[rowIndex].notes || [])];
        if (currentNotes[noteIndex] !== undefined) {
          currentNotes[noteIndex] = trimmed;
          updated[rowIndex] = {
            ...updated[rowIndex],
            notes: currentNotes,
          };
        }
        return updated;
      });
    }
    setEditingNote(null);
  };

  // Cancel editing note
  const cancelEditNote = () => {
    setEditingNote(null);
  };

  // Auto-expand textarea helper
  const autoExpand = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(24, el.scrollHeight)}px`;
  };

  // Period Navigation (< and > buttons)
  const handleNavigatePeriod = (direction: 'prev' | 'next') => {
    try {
      const currentStart = parseISO(appliedRange.start);
      const currentEnd = parseISO(appliedRange.end);
      
      const newStart = direction === 'next' ? addMonths(currentStart, 1) : subMonths(currentStart, 1);
      const newEnd = direction === 'next' ? addMonths(currentEnd, 1) : subMonths(currentEnd, 1);
      
      const sStr = format(newStart, 'yyyy-MM-dd');
      const eStr = format(newEnd, 'yyyy-MM-dd');
      
      setStartDateStr(sStr);
      setEndDateStr(eStr);
      setAppliedRange({ start: sStr, end: eStr });
    } catch (e) {
      console.error('Period navigation error', e);
    }
  };

  // Save to Supabase and LocalStorage
  const executeSave = async () => {
    setIsSaving(true);
    setShowConfirmModal(false);
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
          .filter(r => r.openingCash !== '' || r.totalRevenue !== '' || r.transfer !== '' || r.cash !== '' || r.creditCard !== '' || r.closingCash !== '' || (r.notes && r.notes.length > 0))
          .map(r => ({
            date: r.date,
            branch: currentBranch,
            opening_cash: r.openingCash === '' ? 0 : Math.round(Number(r.openingCash)),
            transfer: r.transfer === '' ? 0 : Math.round(Number(r.transfer)),
            cash: r.cash === '' ? 0 : Math.round(Number(r.cash)),
            credit_card: r.creditCard === '' ? 0 : Number(Number(r.creditCard).toFixed(2)),
            total_revenue: r.totalRevenue === '' ? 0 : Math.round(Number(r.totalRevenue)),
            closing_cash: r.closingCash === '' ? 0 : Math.round(Number(r.closingCash)),
            note: (r.notes || []).join('\n'),
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
              message: 'บันทึกข้อมูลสำเร็จ',
            });

            // 3. Record to audit_logs
            try {
              const logId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
              const timestamp = new Date().toISOString();
              const action = 'บันทึกยอดขายประจำวัน';
              const details = `บันทึกยอดขาย ช่วง ${summaryDateRangeLabel} จำนวน ${recordsToUpsert.length} วัน (สาขา ${currentBranch})`;

              const newLog = {
                id: logId,
                timestamp,
                userEmail: recorderName,
                userRole: user?.role || 'Staff',
                action,
                details,
              };

              const branchKey = `cafe-audit-logs-${currentBranch}`;
              try {
                const cachedLogs = JSON.parse(localStorage.getItem(branchKey) || '[]');
                localStorage.setItem(branchKey, JSON.stringify([newLog, ...cachedLogs].slice(0, 150)));
              } catch (e) {}

              try {
                const globalLogs = JSON.parse(localStorage.getItem('cafe-audit-logs') || '[]');
                localStorage.setItem('cafe-audit-logs', JSON.stringify([newLog, ...globalLogs].slice(0, 150)));
              } catch (e) {}

              await supabase.from('audit_logs').insert({
                id: logId,
                branch: currentBranch,
                timestamp,
                user_email: recorderName,
                user_role: user?.role || 'Staff',
                action,
                details,
              });
            } catch (logErr) {
              console.warn('Audit log recording error:', logErr);
            }
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
        message: 'บันทึกข้อมูลสำเร็จ (ออฟไลน์โหมด)',
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
      'เงินโอน (บาท)',
      'เงินสด (บาท)',
      'บัตรเครดิต (บาท)',
      'รายรับรวม (บาท)',
      'เงินในลิ้นชักตอนปิดร้าน (บาท)',
      'หมายเหตุ',
    ];

    const csvRows = [headers.join(',')];

    rows.forEach(r => {
      const notesJoined = (r.notes || []).join('; ');
      const row = [
        `"${r.dayLabel}"`,
        r.openingCash !== '' ? Math.round(Number(r.openingCash)) : 0,
        r.transfer !== '' ? Math.round(Number(r.transfer)) : 0,
        r.cash !== '' ? Math.round(Number(r.cash)) : 0,
        r.creditCard !== '' ? Number(r.creditCard).toFixed(2) : '0.00',
        r.totalRevenue !== '' ? Math.round(Number(r.totalRevenue)) : 0,
        r.closingCash !== '' ? Math.round(Number(r.closingCash)) : 0,
        `"${notesJoined.replace(/"/g, '""')}"`,
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

  // Summary calculations based on displayed rows
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

  // Date range label
  const summaryDateRangeLabel = useMemo(() => {
    if (displayedDays.length === 0) return '';
    const first = displayedDays[0].rawDate;
    const last = displayedDays[displayedDays.length - 1].rawDate;
    const firstStr = format(first, 'd MMM yyyy', { locale: th });
    const lastStr = format(last, 'd MMM yyyy', { locale: th });
    return `${firstStr} – ${lastStr}`;
  }, [displayedDays]);

  // Apply new date range from inputs
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
          <div className="flex items-center gap-2 text-xs font-semibold">
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
              คอลัมน์ในตาราง daily_sales_records: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[9px]">date, branch, opening_cash, transfer, cash, credit_card, total_revenue, closing_cash, note, recorded_by, created_at</code>
            </p>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PAGE HEADER CARD (FIX 3: Clean 2-row Layout)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-2xl border border-[#D4E4E3] p-4 sm:p-5 shadow-[0_2px_8px_rgba(90,138,136,0.08)]">
        {/* ROW 1: Title block (left) + Period Navigation (right) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 w-full">
          
          {/* LEFT: Title, Badge & Subtitle */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] border border-[#D4E4E3]/50 shadow-xs shrink-0 p-2">
              <BookOpen size={18} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center">
                <h1 className="text-[15px] font-[700] text-[#2D4A49] tracking-tight leading-tight">
                  บันทึกยอดขายประจำวัน
                </h1>
                <span className="text-[10px] font-[600] text-[#5A8A88] bg-[#E8F3F2] px-[7px] py-[2px] rounded-[5px] border border-[#D4E4E3] ml-1.5 whitespace-nowrap">
                  สาขา {currentBranch}
                </span>
              </div>
              <p className="text-[11px] text-[#6B8F8E] mt-0.5">
                บันทึกยอดรายรับและเงินสดประจำวัน
              </p>
            </div>
          </div>

          {/* RIGHT: [<] Period label [>] (Change 6) */}
          <div className="flex items-center gap-1.5 self-start md:self-auto">
            <button
              type="button"
              onClick={() => handleNavigatePeriod('prev')}
              className="w-[30px] h-[30px] rounded-[8px] bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              title="ช่วงเวลาก่อนหน้า"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="text-[11px] font-[600] text-[#2D4A49] bg-[#E8F3F2] px-3 py-[6px] rounded-[8px] border border-[#D4E4E3]/40 whitespace-nowrap shadow-2xs">
              ช่วง: {summaryDateRangeLabel}
            </span>

            <button
              type="button"
              onClick={() => handleNavigatePeriod('next')}
              className="w-[30px] h-[30px] rounded-[8px] bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              title="ช่วงเวลาถัดไป"
            >
              <ChevronRight size={14} />
            </button>
          </div>

        </div>

        {/* DIVIDER BETWEEN ROW 1 AND ROW 2 */}
        <div className="h-[1px] bg-[#F0F5F4] my-3 w-full" />

        {/* ROW 2: Date inputs (left, admin only) + Action buttons (right) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full">
          {/* LEFT: Admin Date Pickers (FIX 3 & Change 7) */}
          {canEditDate ? (
            <form onSubmit={handleApplyRange} className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
              <span className="text-[11px] text-[#6B8F8E] whitespace-nowrap">เริ่มต้น:</span>
              <input
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="bg-white border border-[#D4E4E3] rounded-[8px] px-2 py-1 text-[11px] text-[#2D4A49] w-[125px] sm:w-[130px] h-[32px] focus:outline-none focus:border-[#5A8A88]"
              />

              <span className="text-[11px] text-[#6B8F8E] whitespace-nowrap ml-0.5 sm:ml-0">สิ้นสุด:</span>
              <input
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="bg-white border border-[#D4E4E3] rounded-[8px] px-2 py-1 text-[11px] text-[#2D4A49] w-[125px] sm:w-[130px] h-[32px] focus:outline-none focus:border-[#5A8A88]"
              />

              <button
                type="submit"
                className="bg-[#5A8A88] hover:bg-[#4A7A78] text-white text-[11px] font-[600] rounded-[8px] px-2.5 py-[6px] h-[32px] transition-colors cursor-pointer shadow-xs flex items-center gap-1 shrink-0"
              >
                <RefreshCw size={11} />
                <span>ดูช่วงนี้</span>
              </button>
            </form>
          ) : (
            <div />
          )}

          {/* RIGHT: Action Buttons (Save + Export Dropdown) */}
          <div className="flex items-center gap-1.5 ml-auto relative">
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] sm:text-[12px] font-[600] rounded-[8px] px-3.5 py-[6px] h-[32px] transition-all shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Save size={13} />
              <span>บันทึกข้อมูล</span>
            </button>

            {/* Export Dropdown (Excel + PDF) */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setIsExportOpen(!isExportOpen)}
                className="flex items-center gap-1 bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] text-[#2D4A49] text-[11px] font-[500] rounded-[8px] px-2.5 py-[6px] h-[32px] transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                title="ส่งออกข้อมูล (Excel, PDF)"
              >
                <Download size={13} className="text-[#5A8A88]" />
                <span>ส่งออก</span>
                <ChevronDown size={11} className={`text-[#5A8A88] transition-transform duration-150 ${isExportOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportOpen && (
                <div className="absolute right-0 mt-1.5 w-36 bg-white rounded-xl shadow-lg border border-[#D4E4E3] py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportOpen(false);
                      handleExportExcel();
                    }}
                    className="w-full px-3 py-2 text-left text-[11px] font-medium text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download size={13} className="text-[#5A8A88]" />
                    <span>Excel (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportOpen(false);
                      window.print();
                    }}
                    className="w-full px-3 py-2 text-left text-[11px] font-medium text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Printer size={13} className="text-[#5A8A88]" />
                    <span>พิมพ์ PDF</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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

          {/* Frozen Sticky Header (Change 1: Full Visibility & Wrapping) */}
          <thead className="sticky top-0 z-10 bg-[#2D4A49]">
            <tr className="bg-[#2D4A49] text-white text-[9px] font-[600] border-b border-[#1E3A39]">
              <th 
                style={{ height: 'auto', minHeight: '40px', padding: '6px 4px', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center', verticalAlign: 'middle', lineHeight: 1.3 }}
                className="sticky top-0 bg-[#2D4A49]"
              >
                วันที่
              </th>
              <th 
                style={{ height: 'auto', minHeight: '40px', padding: '6px 4px', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center', verticalAlign: 'middle', lineHeight: 1.3 }}
                className="sticky top-0 bg-[#2D4A49]"
              >
                ลิ้นชักตั้งต้น
              </th>
              <th 
                style={{ height: 'auto', minHeight: '40px', padding: '6px 4px', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center', verticalAlign: 'middle', lineHeight: 1.3 }}
                className="sticky top-0 bg-[#2D4A49]"
              >
                เงินโอน
              </th>
              <th 
                style={{ height: 'auto', minHeight: '40px', padding: '6px 4px', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center', verticalAlign: 'middle', lineHeight: 1.3 }}
                className="sticky top-0 bg-[#2D4A49]"
              >
                เงินสด
              </th>
              <th 
                style={{ height: 'auto', minHeight: '40px', padding: '6px 4px', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center', verticalAlign: 'middle', lineHeight: 1.3 }}
                className="sticky top-0 bg-[#2D4A49]"
              >
                บัตรเครดิต
              </th>
              <th 
                style={{ height: 'auto', minHeight: '40px', padding: '6px 4px', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center', verticalAlign: 'middle', lineHeight: 1.3 }}
                className="sticky top-0 bg-[#2D4A49] bg-[#243d3c]"
              >
                รายรับรวม
              </th>
              <th 
                style={{ height: 'auto', minHeight: '40px', padding: '6px 4px', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center', verticalAlign: 'middle', lineHeight: 1.3 }}
                className="sticky top-0 bg-[#2D4A49]"
              >
                ลิ้นชักปิดร้าน
              </th>
              <th 
                style={{ height: 'auto', minHeight: '40px', padding: '6px 4px', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center', verticalAlign: 'middle', lineHeight: 1.3 }}
                className="sticky top-0 bg-[#2D4A49]"
              >
                หมายเหตุ
              </th>
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
                  {/* 1. วันที่ (Compact Abbreviation "จ. 28/09") */}
                  <td 
                    style={{
                      backgroundColor: dayColor.bg,
                      color: dayColor.text,
                      fontWeight: dayColor.fontWeight,
                      fontSize: '9px',
                    }}
                    className="py-1.5 px-1 text-center border-r border-[#D4E4E3] whitespace-nowrap align-middle"
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

                  {/* 6. รายรับรวม (Integer only) */}
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

                  {/* 8. หมายเหตุ (Multi-notes system & Auto Word-wrap with Inline Edit) */}
                  <td className="py-1 px-1.5 align-top">
                    <div className="space-y-1">
                      {/* Notes list */}
                      {row.notes && row.notes.length > 0 && (
                        <div className="space-y-0.5">
                          {row.notes.map((noteItem, nIdx) => {
                            const isEditingThisNote = editingNote !== null && editingNote.rowIndex === index && editingNote.noteIndex === nIdx;

                            if (isEditingThisNote) {
                              return (
                                <div 
                                  key={nIdx}
                                  className="flex items-start gap-1 text-[9px] text-[#2D4A49] leading-tight w-full my-0.5"
                                >
                                  <span className="text-[#5A8A88] shrink-0 mt-1">•</span>
                                  <textarea
                                    autoFocus
                                    rows={1}
                                    ref={(el) => { if (el) autoExpand(el); }}
                                    value={editingNote.text}
                                    onInput={(e) => autoExpand(e.target as HTMLTextAreaElement)}
                                    onChange={(e) => setEditingNote(prev => prev ? { ...prev, text: e.target.value } : null)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        saveEditNote();
                                      } else if (e.key === 'Escape') {
                                        cancelEditNote();
                                      }
                                    }}
                                    onBlur={() => {
                                      setTimeout(() => {
                                        if (editingNote) saveEditNote();
                                      }, 150);
                                    }}
                                    placeholder="แก้ไขหมายเหตุ..."
                                    style={{
                                      resize: 'none',
                                      overflow: 'hidden',
                                      minHeight: '24px',
                                      lineHeight: '1.4',
                                      padding: '2px 5px',
                                      fontSize: '9px',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}
                                    className="flex-1 bg-white border border-[#5A8A88] rounded-[4px] text-left text-[#2D4A49] focus:outline-none focus:ring-1 focus:ring-[#5A8A88]"
                                  />
                                  <button
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      saveEditNote();
                                    }}
                                    title="บันทึกการแก้ไข"
                                    className="text-[#22C55E] bg-[#DCFCE7] hover:bg-[#BBF7D0] p-1 rounded-[3px] cursor-pointer shrink-0 transition-colors mt-0.5"
                                  >
                                    <Check size={10} />
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      cancelEditNote();
                                    }}
                                    title="ยกเลิก"
                                    className="text-[#EF4444] bg-[#FEE2E2] hover:bg-[#FECACA] p-1 rounded-[3px] cursor-pointer shrink-0 transition-colors mt-0.5"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div 
                                key={nIdx}
                                className="flex items-start gap-1 text-[9px] text-[#2D4A49] leading-tight group rounded-[3px] p-0.5 -mx-0.5 transition-colors"
                              >
                                <span className="text-[#5A8A88] shrink-0">•</span>
                                <span 
                                  onClick={() => startEditNote(index, nIdx, noteItem)}
                                  title="คลิกเพื่อแก้ไขหมายเหตุ"
                                  className="flex-1 break-words whitespace-pre-wrap cursor-pointer rounded-[3px] px-0.5 py-[1px] hover:bg-[#E8F3F2] hover:text-[#5A8A88] transition-colors"
                                >
                                  {noteItem}
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => startEditNote(index, nIdx, noteItem)}
                                    className="text-[#A8BCBB] hover:text-[#5A8A88] hover:bg-[#E8F3F2] p-0.5 rounded-[3px] cursor-pointer transition-colors"
                                    title="แก้ไขหมายเหตุ"
                                  >
                                    <Pencil size={10} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(index, nIdx)}
                                    className="text-[#A8BCBB] hover:text-[#EF4444] hover:bg-[#FEE2E2] p-0.5 rounded-[3px] cursor-pointer transition-colors"
                                    title="ลบหมายเหตุนี้"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Adding Note Textarea or "+ เพิ่มหมายเหตุ" button */}
                      {activeNoteInputIdx === index ? (
                        <div className="mt-1">
                          <textarea
                            autoFocus
                            rows={1}
                            value={newNoteText}
                            onInput={(e) => autoExpand(e.target as HTMLTextAreaElement)}
                            onChange={(e) => setNewNoteText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddNote(index, newNoteText);
                              } else if (e.key === 'Escape') {
                                setActiveNoteInputIdx(null);
                                setNewNoteText('');
                              }
                            }}
                            onBlur={() => {
                              if (newNoteText.trim()) {
                                handleAddNote(index, newNoteText);
                              } else {
                                setActiveNoteInputIdx(null);
                              }
                            }}
                            placeholder="พิมพ์หมายเหตุ (กด Enter เพื่อบันทึก)..."
                            style={{
                              resize: 'none',
                              overflow: 'hidden',
                              minHeight: '24px',
                              lineHeight: '1.4',
                              padding: '3px 5px',
                              fontSize: '9px',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                            className="w-full bg-white border border-[#5A8A88] rounded-[4px] text-left text-[#2D4A49] focus:outline-none focus:bg-[#E8F3F2]"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNote(null);
                            setActiveNoteInputIdx(index);
                            setNewNoteText('');
                          }}
                          className="flex items-center gap-0.5 text-[8px] text-[#5A8A88] hover:text-[#2D4A49] cursor-pointer pt-0.5 transition-colors"
                        >
                          <Plus size={10} className="text-[#5A8A88]" />
                          <span>เพิ่มหมายเหตุ</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Sticky Frozen Summary Row */}
          <tfoot className="sticky bottom-0 z-10 bg-[#E8F3F2]">
            <tr 
              style={{ background: '#E8F3F2', borderTop: '2px solid #5A8A88' }}
              className="text-[#2D4A49] text-[9px] font-[700] shadow-xs"
            >
              {/* 1. Date range label */}
              <td className="py-2 px-1 text-center border-r border-[#D4E4E3] font-[700] text-[#2D4A49] whitespace-nowrap sticky bottom-0 bg-[#E8F3F2]">
                รวม ({displayedDays.length} วัน)
              </td>

              {/* 2. เงินในลิ้นชักตั้งต้น */}
              <td className="py-2 px-1 text-right font-mono text-[#5A8A88] sticky bottom-0 bg-[#E8F3F2]">
                {totals.opening > 0 ? Math.round(totals.opening).toLocaleString('th-TH') : '0'}
              </td>

              {/* 3. เงินโอน */}
              <td className="py-2 px-1 text-right font-mono text-[#5A8A88] sticky bottom-0 bg-[#E8F3F2]">
                {totals.transfer > 0 ? Math.round(totals.transfer).toLocaleString('th-TH') : '0'}
              </td>

              {/* 4. เงินสด */}
              <td className="py-2 px-1 text-right font-mono text-[#5A8A88] sticky bottom-0 bg-[#E8F3F2]">
                {totals.cash > 0 ? Math.round(totals.cash).toLocaleString('th-TH') : '0'}
              </td>

              {/* 5. บัตรเครดิต */}
              <td className="py-2 px-1 text-right font-mono text-[#5A8A88] sticky bottom-0 bg-[#E8F3F2]">
                {totals.credit > 0 
                  ? totals.credit.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                  : '0.00'}
              </td>

              {/* 6. รายรับรวม */}
              <td className="py-2 px-1 text-right font-mono text-[#2D4A49] font-[800] sticky bottom-0 bg-[#E8F3F2]">
                {totals.revenue > 0 ? Math.round(totals.revenue).toLocaleString('th-TH') : '0'}
              </td>

              {/* 7. เงินในลิ้นชักตอนปิดร้าน */}
              <td className="py-2 px-1 text-right font-mono text-[#5A8A88] sticky bottom-0 bg-[#E8F3F2]">
                {totals.closing > 0 ? Math.round(totals.closing).toLocaleString('th-TH') : '0'}
              </td>

              {/* 8. หมายเหตุ */}
              <td className="py-2 px-1.5 text-left text-[9px] text-[#6B8F8E] font-normal sticky bottom-0 bg-[#E8F3F2]">
                ยอดรวมประจำรอบ
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SAVE CONFIRMATION MODAL
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showConfirmModal && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 200 }}
          className="flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div 
            style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px 24px',
              maxWidth: '340px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            className="animate-in zoom-in-95 duration-200"
          >
            {/* Top icon */}
            <div 
              style={{ width: '56px', height: '56px', background: '#E8F3F2', borderRadius: '50%' }}
              className="flex items-center justify-center mx-auto text-[#5A8A88]"
            >
              <Save size={24} />
            </div>

            {/* Title */}
            <h3 
              style={{ fontSize: '16px', fontWeight: 700, color: '#2D4A49' }}
              className="text-center mt-3"
            >
              ยืนยันการบันทึกข้อมูล
            </h3>

            {/* Summary info */}
            <div className="text-center mt-2 space-y-1">
              <p style={{ fontSize: '12px', color: '#6B8F8E' }}>
                ช่วงวันที่: <span className="font-semibold text-[#2D4A49]">{summaryDateRangeLabel}</span>
              </p>
              <p style={{ fontSize: '12px', color: '#6B8F8E' }}>
                จำนวน: <span className="font-semibold text-[#2D4A49]">{displayedDays.length} วัน</span> | สาขา: <span className="font-semibold text-[#2D4A49]">{currentBranch}</span>
              </p>
              <p style={{ fontSize: '12px', color: '#6B8F8E' }}>
                บันทึกโดย: <span className="font-semibold text-[#2D4A49]">{recorderName}</span>
              </p>
            </div>

            {/* Warning note */}
            <p 
              style={{ fontSize: '11px', color: '#A8BCBB' }}
              className="text-center mt-2.5"
            >
              ข้อมูลที่บันทึกแล้วสามารถแก้ไขได้ภายหลัง
            </p>

            {/* Action buttons */}
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{
                  background: '#F0F5F4',
                  color: '#6B8F8E',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
                className="flex-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={executeSave}
                disabled={isSaving}
                style={{
                  background: '#5A8A88',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
                className="flex-1 hover:bg-[#4A7A78] transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>✅ บันทึก</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DailySalesRecord;
