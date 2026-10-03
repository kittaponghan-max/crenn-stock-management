import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  FolderPlus,
  Check
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
  
  // View mode: '1day' | '2days' | '3days' | '7days'
  const [viewMode, setViewMode] = useState<'1day' | '2days' | '3days' | '7days'>('2days');
  const [activeChunkIdx, setActiveChunkIdx] = useState<number>(0);

  // Dynamic Bakery Items state (persisted in LocalStorage)
  const [bakeryItems, setBakeryItems] = useState<BakeryItemDef[]>(() => {
    try {
      const saved = localStorage.getItem(`cafe_bakery_items_${currentBranch}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_BAKERY_ITEMS;
  });

  // Save items to LocalStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(`cafe_bakery_items_${currentBranch}`, JSON.stringify(bakeryItems));
    } catch (e) {}
  }, [bakeryItems, currentBranch]);

  // Modals / Dialogs state for Items & Categories management
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; name: string; category: string } | null>(null);
  const [editingCat, setEditingCat] = useState<{ oldName: string; newName: string } | null>(null);

  // Form input states for modals
  const [newItemName, setNewItemName] = useState('');
  const [newItemCat, setNewItemCat] = useState('');
  const [newCatName, setNewCatName] = useState('');

  // Export dropdown state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Data state: records[itemName][dateStr] = BakeryDayRecord
  const [records, setRecords] = useState<Record<string, Record<string, BakeryDayRecord>>>({});
  const originalRecordsRef = useRef<Record<string, Record<string, BakeryDayRecord>>>({});
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

  // Categories list
  const categories = useMemo(() => {
    const cats: { name: string; items: BakeryItemDef[] }[] = [];
    bakeryItems.forEach(item => {
      let found = cats.find(c => c.name === item.category);
      if (!found) {
        found = { name: item.category, items: [] };
        cats.push(found);
      }
      found.items.push(item);
    });
    return cats;
  }, [bakeryItems]);

  // Determine displayed days based on viewMode & activeChunkIdx
  const displayedDays = useMemo(() => {
    if (viewMode === '7days') return weekDays;
    
    if (viewMode === '1day') {
      const idx = Math.min(Math.max(0, activeChunkIdx), 6);
      return [weekDays[idx]];
    }

    if (viewMode === '2days') {
      const startIdx = activeChunkIdx * 2;
      return weekDays.slice(startIdx, Math.min(startIdx + 2, 7));
    }

    if (viewMode === '3days') {
      const startIdx = activeChunkIdx * 3;
      return weekDays.slice(startIdx, Math.min(startIdx + 3, 7));
    }

    return weekDays;
  }, [weekDays, viewMode, activeChunkIdx]);

  // Reset activeChunkIdx when viewMode changes to prevent out of bounds
  useEffect(() => {
    setActiveChunkIdx(0);
  }, [viewMode]);

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
    originalRecordsRef.current = JSON.parse(JSON.stringify(loaded));
  }, [currentBranch, weekDays]);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

  // Handle cell value change
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

  // ━━━━ CATEGORY & ITEM MANAGEMENT FUNCTIONS ━━━━

  // Add Item
  const handleAddItem = (categoryName?: string) => {
    setNewItemCat(categoryName || (categories[0]?.name || 'ครัวซอง & เดนิส'));
    setNewItemName('');
    setShowAddItemModal(true);
  };

  const confirmAddItem = () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    const cat = newItemCat.trim() || 'เบเกอรี่ทั่วไป';
    const newId = `custom-${Date.now()}`;
    const newItem: BakeryItemDef = { id: newId, name: trimmed, category: cat };

    setBakeryItems(prev => [...prev, newItem]);
    setShowAddItemModal(false);
    setNewItemName('');
  };

  // Edit Item Name / Category
  const startEditItem = (item: BakeryItemDef) => {
    setEditingItem({ id: item.id, name: item.name, category: item.category });
  };

  const saveEditItem = () => {
    if (!editingItem) return;
    const trimmed = editingItem.name.trim();
    if (!trimmed) return;

    setBakeryItems(prev => prev.map(i => {
      if (i.id === editingItem.id) {
        // If name changed, rename key in records too
        if (i.name !== trimmed) {
          setRecords(prevRecs => {
            const updated = { ...prevRecs };
            if (updated[i.name]) {
              updated[trimmed] = updated[i.name];
              delete updated[i.name];
            }
            return updated;
          });
        }
        return { ...i, name: trimmed, category: editingItem.category };
      }
      return i;
    }));

    setEditingItem(null);
  };

  // Delete Item
  const handleDeleteItem = (itemId: string, itemName: string) => {
    if (window.confirm(`คุณต้องการลบรายการ "${itemName}" ออกจากระบบใช่หรือไม่?`)) {
      setBakeryItems(prev => prev.filter(i => i.id !== itemId));
    }
  };

  // Add Category
  const handleAddCategory = () => {
    setNewCatName('');
    setShowAddCatModal(true);
  };

  const confirmAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    // Add dummy item under new category to create it
    const newId = `cat-item-${Date.now()}`;
    const newItem: BakeryItemDef = { id: newId, name: `รายการใหม่ (${trimmed})`, category: trimmed };

    setBakeryItems(prev => [...prev, newItem]);
    setShowAddCatModal(false);
    setNewCatName('');
  };

  // Edit Category Name
  const startEditCategory = (catName: string) => {
    setEditingCat({ oldName: catName, newName: catName });
  };

  const saveEditCategory = () => {
    if (!editingCat) return;
    const oldN = editingCat.oldName;
    const newN = editingCat.newName.trim();
    if (!newN || oldN === newN) {
      setEditingCat(null);
      return;
    }

    setBakeryItems(prev => prev.map(i => {
      if (i.category === oldN) {
        return { ...i, category: newN };
      }
      return i;
    }));

    setEditingCat(null);
  };

  // Delete Category
  const handleDeleteCategory = (catName: string) => {
    if (window.confirm(`คุณต้องการลบหมวดหมู่ "${catName}" และรายการขนมทั้งหมดในหมวดนี้ใช่หรือไม่?`)) {
      setBakeryItems(prev => prev.filter(i => i.category !== catName));
    }
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

    // 2. Compute granular changes for audit log
    const changes: Array<{
      itemName: string;
      date: string;
      dayLabel: string;
      field: string;
      oldVal: string;
      newVal: string;
      unit?: string;
    }> = [];

    let hasExistingRecord = false;

    Object.entries(records).forEach(([itemName, dateMap]) => {
      const origItemMap = originalRecordsRef.current[itemName] || {};
      weekDays.forEach(day => {
        const d = day.dateStr;
        const currentDayRec = dateMap[d] || { totalQty: '', lineQty: '', storeQty: '', soldQty: '', note: '' };
        const origDayRec = origItemMap[d] || { totalQty: '', lineQty: '', storeQty: '', soldQty: '', note: '' };

        const origHasData = 
          origDayRec.totalQty !== '' ||
          origDayRec.lineQty !== '' ||
          origDayRec.storeQty !== '' ||
          origDayRec.soldQty !== '' ||
          (origDayRec.note && origDayRec.note.trim() !== '');

        if (origHasData) {
          hasExistingRecord = true;
        }

        const compareField = (
          fieldName: string,
          oldV: string | number | undefined,
          newV: string | number | undefined,
          unit = 'ชิ้น'
        ) => {
          const cleanOld = oldV === undefined || oldV === null || oldV === '' ? '' : String(oldV);
          const cleanNew = newV === undefined || newV === null || newV === '' ? '' : String(newV);
          if (cleanOld !== cleanNew) {
            changes.push({
              itemName,
              date: d,
              dayLabel: `${day.shortDate} (${day.dayName})`,
              field: fieldName,
              oldVal: cleanOld ? String(cleanOld) : '-',
              newVal: cleanNew ? String(cleanNew) : '-',
              unit,
            });
          }
        };

        compareField('ยอดส่ง (Total)', origDayRec.totalQty, currentDayRec.totalQty);
        compareField('หน้าร้าน (Line)', origDayRec.lineQty, currentDayRec.lineQty);
        compareField('ในสต็อก (Store)', origDayRec.storeQty, currentDayRec.storeQty);
        compareField('ขายได้ (Sold)', origDayRec.soldQty, currentDayRec.soldQty);

        const oldNote = (origDayRec.note || '').trim();
        const newNote = (currentDayRec.note || '').trim();
        if (oldNote !== newNote) {
          changes.push({
            itemName,
            date: d,
            dayLabel: `${day.shortDate} (${day.dayName})`,
            field: 'หมายเหตุ',
            oldVal: oldNote || '-',
            newVal: newNote || '-',
          });
        }
      });
    });

    const weekStartStr = weekDays[0] ? weekDays[0].shortDate : '';
    const weekEndStr = weekDays[6] ? weekDays[6].shortDate : '';
    const weekRangeText = `${weekStartStr} - ${weekEndStr}`;

    const action = hasExistingRecord && changes.length > 0
      ? 'แก้ไขข้อมูลจำนวนขนมประจำวัน'
      : 'บันทึกจำนวนขนมประจำวัน';

    const summaryText = changes.length > 0
      ? `${action} สัปดาห์ ${weekRangeText} (${changes.length} รายการเปลี่ยนแปลง - สาขา ${currentBranch})`
      : `${action} สัปดาห์ ${weekRangeText} (สาขา ${currentBranch})`;

    const auditPayload = {
      summary: summaryText,
      changes,
      branch: currentBranch,
      weekRange: weekRangeText
    };

    const logId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();
    const details = JSON.stringify(auditPayload);

    const newLog = {
      id: logId,
      timestamp,
      userEmail: recorderName,
      userRole: user?.role || 'Staff',
      action,
      details,
      branch: currentBranch as any
    };

    // Save to LocalStorage audit logs
    const branchKey = `cafe-audit-logs-${currentBranch}`;
    try {
      const cachedLogs = JSON.parse(localStorage.getItem(branchKey) || '[]');
      localStorage.setItem(branchKey, JSON.stringify([newLog, ...cachedLogs].slice(0, 150)));
    } catch (e) {}

    try {
      const globalLogs = JSON.parse(localStorage.getItem('cafe-audit-logs') || '[]');
      localStorage.setItem('cafe-audit-logs', JSON.stringify([newLog, ...globalLogs].slice(0, 150)));
    } catch (e) {}

    // 3. Save to Supabase
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

            // Record to Supabase audit_logs
            try {
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
        message: 'บันทึกลงในเครื่องเรียบร้อยแล้ว (ออฟไลน์โหมด)',
      });
    }

    // Update baseline snapshot after save
    originalRecordsRef.current = JSON.parse(JSON.stringify(records));

    setIsSaving(false);
    setTimeout(() => {
      setSaveStatus(null);
    }, 4000);
  };

  // Export to CSV / Excel
  const handleExportExcel = () => {
    const headers = ['หมวดหมู่', 'รายการ'];
    
    weekDays.forEach(w => {
      headers.push(`${w.shortDate} - ทั้งหมด`);
      headers.push(`${w.shortDate} - Official Line`);
      headers.push(`${w.shortDate} - ขายหน้าร้าน`);
      headers.push(`${w.shortDate} - ขายได้จริง`);
      headers.push(`${w.shortDate} - หมายเหตุ`);
    });

    const csvRows = [headers.join(',')];

    bakeryItems.forEach(item => {
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

  // Calculate day totals for displayed days
  const dayTotals = useMemo(() => {
    const totals: Record<string, { totalQty: number; lineQty: number; storeQty: number; soldQty: number }> = {};
    displayedDays.forEach(day => {
      let total = 0;
      let line = 0;
      let store = 0;
      let sold = 0;
      bakeryItems.forEach(item => {
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
  }, [displayedDays, records, bakeryItems]);

  const weekStartStr = format(currentWeek, 'd MMM yyyy', { locale: th });
  const weekEndStr = format(addDays(currentWeek, 6), 'd MMM yyyy', { locale: th });

  // Period Label for Header
  const summaryDateRangeLabel = `${weekStartStr} - ${weekEndStr}`;

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
              คอลัมน์ที่ต้องสร้างใน Supabase: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">date (text), branch (text), item_name (text), total_qty (numeric), line_qty (numeric), store_qty (numeric), sold_qty (numeric), note (text), recorded_by (text), created_at (timestamptz)</code>
            </p>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PAGE HEADER CARD (Matches DailySalesRecord Layout & Style)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-2xl border border-[#D4E4E3] p-4 sm:p-5 shadow-[0_2px_8px_rgba(90,138,136,0.08)]">
        
        {/* ROW 1: Title block (left) + Period Navigation (right) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 w-full">
          
          {/* LEFT: Title, Badge & Subtitle */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] border border-[#D4E4E3]/50 shadow-xs shrink-0 p-2">
              <Cake size={18} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center">
                <h1 className="text-[15px] font-[700] text-[#2D4A49] tracking-tight leading-tight">
                  บันทึกจำนวนขนมประจำวัน
                </h1>
                <span className="text-[10px] font-[600] text-[#5A8A88] bg-[#E8F3F2] px-[7px] py-[2px] rounded-[5px] border border-[#D4E4E3] ml-1.5 whitespace-nowrap">
                  สาขา {currentBranch}
                </span>
              </div>
              <p className="text-[11px] text-[#6B8F8E] mt-0.5">
                แบบฟอร์มกรอกจำนวนขนม ผลิตทั้งหมด / Official Line / ขายหน้าร้าน / ยอดขายจริง
              </p>
            </div>
          </div>

          {/* RIGHT: Period Navigation [<] สัปดาห์... [>] */}
          <div className="flex items-center gap-1.5 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}
              className="w-[30px] h-[30px] rounded-[8px] bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              title="สัปดาห์ก่อนหน้า"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="text-[11px] font-[600] text-[#2D4A49] bg-[#E8F3F2] px-3 py-[6px] rounded-[8px] border border-[#D4E4E3]/40 whitespace-nowrap shadow-2xs">
              สัปดาห์: {summaryDateRangeLabel}
            </span>

            <button
              type="button"
              onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}
              className="w-[30px] h-[30px] rounded-[8px] bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              title="สัปดาห์ถัดไป"
            >
              <ChevronRight size={14} />
            </button>
          </div>

        </div>

        {/* DIVIDER BETWEEN ROW 1 AND ROW 2 */}
        <div className="h-[1px] bg-[#F0F5F4] my-3 w-full" />

        {/* ROW 2: View Mode Controls (left) + Actions (right) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 w-full">
          
          {/* LEFT: View Mode Selectors (1 - 3 วัน / 7 วัน) & Manage Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-[#6B8F8E] mr-0.5">มุมมองประจำวัน:</span>
            
            {/* View Mode Tabs: 1 วัน, 2 วัน, 3 วัน, 7 วัน */}
            <div className="flex items-center gap-1 bg-[#F0F5F4] p-0.5 rounded-[8px] border border-[#D4E4E3]">
              <button
                type="button"
                onClick={() => setViewMode('1day')}
                className={`px-2.5 py-1 rounded-[6px] text-[11px] font-[600] transition-colors cursor-pointer ${
                  viewMode === '1day'
                    ? 'bg-[#5A8A88] text-white shadow-xs'
                    : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                1 วัน
              </button>
              <button
                type="button"
                onClick={() => setViewMode('2days')}
                className={`px-2.5 py-1 rounded-[6px] text-[11px] font-[600] transition-colors cursor-pointer ${
                  viewMode === '2days'
                    ? 'bg-[#5A8A88] text-white shadow-xs'
                    : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                2 วัน
              </button>
              <button
                type="button"
                onClick={() => setViewMode('3days')}
                className={`px-2.5 py-1 rounded-[6px] text-[11px] font-[600] transition-colors cursor-pointer ${
                  viewMode === '3days'
                    ? 'bg-[#5A8A88] text-white shadow-xs'
                    : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                3 วัน
              </button>
              <button
                type="button"
                onClick={() => setViewMode('7days')}
                className={`px-2.5 py-1 rounded-[6px] text-[11px] font-[600] transition-colors cursor-pointer ${
                  viewMode === '7days'
                    ? 'bg-[#2D4A49] text-white shadow-xs'
                    : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                ดูทั้ง 7 วัน
              </button>
            </div>

            {/* Chunk selector buttons for 1-3 days */}
            {viewMode === '1day' && (
              <div className="flex items-center gap-1 flex-wrap ml-1">
                {weekDays.map((d, i) => (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setActiveChunkIdx(i)}
                    className={`px-2 py-1 rounded-[6px] text-[10px] font-semibold transition-all cursor-pointer ${
                      activeChunkIdx === i
                        ? 'bg-[#E8F3F2] text-[#5A8A88] border border-[#5A8A88]'
                        : 'bg-white text-[#6B8F8E] border border-[#D4E4E3] hover:bg-[#F0F5F4]'
                    }`}
                  >
                    {d.shortDay}
                  </button>
                ))}
              </div>
            )}

            {viewMode === '2days' && (
              <div className="flex items-center gap-1 flex-wrap ml-1">
                {[
                  { idx: 0, label: 'จ.-อ.' },
                  { idx: 1, label: 'พ.-พฤ.' },
                  { idx: 2, label: 'ศ.-ส.' },
                  { idx: 3, label: 'อา.' },
                ].map(chunk => (
                  <button
                    key={chunk.idx}
                    type="button"
                    onClick={() => setActiveChunkIdx(chunk.idx)}
                    className={`px-2 py-1 rounded-[6px] text-[10px] font-semibold transition-all cursor-pointer ${
                      activeChunkIdx === chunk.idx
                        ? 'bg-[#E8F3F2] text-[#5A8A88] border border-[#5A8A88]'
                        : 'bg-white text-[#6B8F8E] border border-[#D4E4E3] hover:bg-[#F0F5F4]'
                    }`}
                  >
                    {chunk.label}
                  </button>
                ))}
              </div>
            )}

            {viewMode === '3days' && (
              <div className="flex items-center gap-1 flex-wrap ml-1">
                {[
                  { idx: 0, label: 'จ.-พ.' },
                  { idx: 1, label: 'พฤ.-ส.' },
                  { idx: 2, label: 'อา.' },
                ].map(chunk => (
                  <button
                    key={chunk.idx}
                    type="button"
                    onClick={() => setActiveChunkIdx(chunk.idx)}
                    className={`px-2 py-1 rounded-[6px] text-[10px] font-semibold transition-all cursor-pointer ${
                      activeChunkIdx === chunk.idx
                        ? 'bg-[#E8F3F2] text-[#5A8A88] border border-[#5A8A88]'
                        : 'bg-white text-[#6B8F8E] border border-[#D4E4E3] hover:bg-[#F0F5F4]'
                    }`}
                  >
                    {chunk.label}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Manage Category/Item buttons */}
            <div className="flex items-center gap-1 ml-auto md:ml-2">
              <button
                type="button"
                onClick={handleAddCategory}
                className="flex items-center gap-1 bg-[#E8F3F2] hover:bg-[#D4E4E3] text-[#5A8A88] text-[11px] font-[600] rounded-[8px] px-2.5 py-[6px] h-[32px] border border-[#D4E4E3] transition-colors cursor-pointer whitespace-nowrap"
                title="เพิ่มกลุ่มรายการขนมใหม่"
              >
                <FolderPlus size={13} />
                <span className="hidden sm:inline">+ หมวดหมู่</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddItem()}
                className="flex items-center gap-1 bg-[#E8F3F2] hover:bg-[#D4E4E3] text-[#5A8A88] text-[11px] font-[600] rounded-[8px] px-2.5 py-[6px] h-[32px] border border-[#D4E4E3] transition-colors cursor-pointer whitespace-nowrap"
                title="เพิ่มรายการขนมใหม่"
              >
                <Plus size={13} />
                <span>+ เพิ่มขนม</span>
              </button>
            </div>

          </div>

          {/* RIGHT: Action Buttons (Save + Export Dropdown - Matches DailySalesRecord) */}
          <div className="flex items-center gap-1.5 ml-auto relative">
            
            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] sm:text-[12px] font-[600] rounded-[8px] px-3.5 py-[6px] h-[32px] transition-all shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
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

            {/* Export Dropdown (Matches DailySalesRecord) */}
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
                    <span>PDF / พิมพ์</span>
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-[0_2px_8px_rgba(90,138,136,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            
            {/* Top Header with Date Groups */}
            <thead>
              <tr className="bg-[#2D4A49] text-white text-[11px] font-bold border-b border-[#1E3A39]">
                <th className="py-2.5 px-3 w-[220px] min-w-[200px] sticky left-0 z-20 bg-[#2D4A49] border-r border-[#3D6B69]">
                  <div className="flex items-center justify-between">
                    <span>รายการขนม</span>
                    <button
                      type="button"
                      onClick={() => handleAddItem()}
                      className="text-[10px] bg-[#3D6B69] hover:bg-[#5A8A88] text-white px-2 py-0.5 rounded transition-colors"
                      title="เพิ่มรายการขนม"
                    >
                      + เพิ่ม
                    </button>
                  </div>
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
                    <th className="py-2 px-2 text-left w-[110px] border-r-2 border-[#2D4A49]">หมายเหตุ</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            {/* Table Body with Categories */}
            <tbody className="divide-y divide-[#F0F5F4] text-xs">
              {categories.map(category => (
                <React.Fragment key={category.name}>
                  
                  {/* Category Header Row (With Edit/Delete/Add Item Actions) */}
                  <tr className="bg-[#E8F3F2] border-y border-[#D4E4E3] group/cat">
                    <td 
                      colSpan={1 + displayedDays.length * 5}
                      className="py-2 px-3 font-bold text-[#5A8A88] text-[11px] tracking-wide"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>📁 {category.name}</span>
                          <span className="text-[10px] font-normal text-[#6B8F8E] bg-white/70 px-1.5 py-0.2 rounded-full">
                            ({category.items.length} รายการ)
                          </span>
                          
                          {/* Category Edit & Delete buttons */}
                          <div className="flex items-center gap-1 opacity-70 group-hover/cat:opacity-100 transition-opacity ml-1">
                            <button
                              type="button"
                              onClick={() => startEditCategory(category.name)}
                              className="p-1 hover:bg-white text-[#5A8A88] rounded transition-colors"
                              title="แก้ไขชื่อหมวดหมู่"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(category.name)}
                              className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                              title="ลบหมวดหมู่นี้"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddItem(category.name)}
                          className="text-[10px] font-semibold bg-white/80 hover:bg-white text-[#5A8A88] px-2 py-0.5 rounded border border-[#D4E4E3] transition-colors"
                        >
                          + เพิ่มรายการในหมวดนี้
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Items in Category */}
                  {category.items.map((item, itemIdx) => (
                    <tr 
                      key={item.id}
                      className={`transition-colors hover:bg-[#E8F3F2]/40 group/item ${
                        itemIdx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFA]'
                      }`}
                    >
                      {/* Item Name (Sticky Left with Action Buttons) */}
                      <td className="py-1.5 px-3 font-semibold text-[#2D4A49] bg-[#F0F5F4] border-r border-[#D4E4E3] sticky left-0 z-10 whitespace-nowrap text-[11px]">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate max-w-[150px]" title={item.name}>
                            {item.name}
                          </span>

                          {/* Item Edit & Delete Action Buttons */}
                          <div className="flex items-center gap-0.5 opacity-60 group-hover/item:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditItem(item)}
                              className="p-1 hover:bg-white text-[#5A8A88] rounded transition-colors"
                              title="แก้ไขชื่อรายการ"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id, item.name)}
                              className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                              title="ลบรายการนี้"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
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

                            {/* 5. หมายเหตุ (With Quick Clear/Edit Button) */}
                            <td className="py-1 px-1 border-r-2 border-[#D4E4E3]">
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  value={rec.note}
                                  onChange={(e) => handleChange(item.name, day.dateStr, 'note', e.target.value)}
                                  placeholder="หมายเหตุ"
                                  className="w-full bg-white border border-[#D4E4E3] rounded text-[10px] text-left px-1.5 py-1 text-[#2D4A49] pr-5 focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2]"
                                />
                                {rec.note && (
                                  <button
                                    type="button"
                                    onClick={() => handleChange(item.name, day.dateStr, 'note', '')}
                                    className="absolute right-1 text-[#6B8F8E] hover:text-rose-600 transition-colors p-0.5 cursor-pointer"
                                    title="ลบหมายเหตุ"
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
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

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          MODALS FOR MANAGING ITEMS & CATEGORIES
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      {/* 1. Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-[#D4E4E3] overflow-hidden">
            <div className="bg-[#2D4A49] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Plus size={16} />
                <span>เพิ่มรายการขนมใหม่</span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddItemModal(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2D4A49] mb-1">
                  หมวดหมู่ขนม
                </label>
                <input
                  type="text"
                  value={newItemCat}
                  onChange={(e) => setNewItemCat(e.target.value)}
                  placeholder="เช่น ครัวซอง & เดนิส, เค้ก"
                  className="w-full bg-[#F8FAFA] border border-[#D4E4E3] rounded-lg px-3 py-2 text-xs text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2D4A49] mb-1">
                  ชื่อรายการขนมใหม่
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="เช่น พายแอปเปิ้ล, คุกกี้แมคคาเดเมีย"
                  className="w-full bg-[#F8FAFA] border border-[#D4E4E3] rounded-lg px-3 py-2 text-xs text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-white"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#6B8F8E] hover:bg-[#F0F5F4] transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={confirmAddItem}
                  disabled={!newItemName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5A8A88] hover:bg-[#4A7A78] text-white transition-colors disabled:opacity-50"
                >
                  บันทึกรายการ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Add Category Modal */}
      {showAddCatModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-[#D4E4E3] overflow-hidden">
            <div className="bg-[#2D4A49] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <FolderPlus size={16} />
                <span>เพิ่มกลุ่มรายการขนม (หมวดหมู่ใหม่)</span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddCatModal(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2D4A49] mb-1">
                  ชื่อกลุ่ม / หมวดหมู่ขนมใหม่
                </label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="เช่น ขนมปังสด, พาสทรี้สด, เครื่องดื่มร้อน"
                  className="w-full bg-[#F8FAFA] border border-[#D4E4E3] rounded-lg px-3 py-2 text-xs text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-white"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#6B8F8E] hover:bg-[#F0F5F4] transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={confirmAddCategory}
                  disabled={!newCatName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5A8A88] hover:bg-[#4A7A78] text-white transition-colors disabled:opacity-50"
                >
                  บันทึกหมวดหมู่
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-[#D4E4E3] overflow-hidden">
            <div className="bg-[#2D4A49] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Pencil size={16} />
                <span>แก้ไขชื่อรายการขนม</span>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingItem(null)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2D4A49] mb-1">
                  หมวดหมู่
                </label>
                <input
                  type="text"
                  value={editingItem.category}
                  onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                  className="w-full bg-[#F8FAFA] border border-[#D4E4E3] rounded-lg px-3 py-2 text-xs text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2D4A49] mb-1">
                  ชื่อรายการขนม
                </label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full bg-[#F8FAFA] border border-[#D4E4E3] rounded-lg px-3 py-2 text-xs text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-white"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#6B8F8E] hover:bg-[#F0F5F4] transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={saveEditItem}
                  disabled={!editingItem.name.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5A8A88] hover:bg-[#4A7A78] text-white transition-colors disabled:opacity-50"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Edit Category Modal */}
      {editingCat && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-[#D4E4E3] overflow-hidden">
            <div className="bg-[#2D4A49] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Pencil size={16} />
                <span>แก้ไขชื่อกลุ่ม / หมวดหมู่ขนม</span>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingCat(null)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2D4A49] mb-1">
                  ชื่อหมวดหมู่ขนม
                </label>
                <input
                  type="text"
                  value={editingCat.newName}
                  onChange={(e) => setEditingCat({ ...editingCat, newName: e.target.value })}
                  className="w-full bg-[#F8FAFA] border border-[#D4E4E3] rounded-lg px-3 py-2 text-xs text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-white"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCat(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#6B8F8E] hover:bg-[#F0F5F4] transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={saveEditCategory}
                  disabled={!editingCat.newName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#5A8A88] hover:bg-[#4A7A78] text-white transition-colors disabled:opacity-50"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default DailyBakeryRecord;
