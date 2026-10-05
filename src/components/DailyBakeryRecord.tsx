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
  Check,
  Upload,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { th } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

export interface DailyBakeryRecordProps {
  user?: {
    name: string;
    role?: string;
    branch?: string;
  } | null;
  branch?: string;
  onNavigate?: (tab: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  registerSaveHandler?: (handler: {
    hasUnsavedChanges: () => boolean;
    handleSave: () => Promise<boolean>;
    handleDiscard: () => void;
  }) => void;
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

export function DailyBakeryRecord({ 
  user, 
  branch = 'Rayong', 
  onNavigate,
  onDirtyChange,
  registerSaveHandler 
}: DailyBakeryRecordProps) {
  const currentBranch = branch || user?.branch || 'Rayong';
  const recorderName = user?.name || 'Admin';

  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  // View mode: '1day' | '2days' | '3days'
  const [viewMode, setViewMode] = useState<'1day' | '2days' | '3days'>('2days');
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

  // Delete Confirmation Modals state (replaces window.confirm)
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string } | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<{ name: string; count: number } | null>(null);

  // Excel Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    items: { category: string; name: string }[];
    importMode: 'append' | 'replace';
  } | null>(null);

  // Form input states for modals
  const [newItemName, setNewItemName] = useState('');
  const [newItemCat, setNewItemCat] = useState('');
  const [newCatName, setNewCatName] = useState('');

  // Baseline snapshots for tracking unsaved changes
  const originalItemsRef = useRef<BakeryItemDef[]>([]);
  useEffect(() => {
    if (originalItemsRef.current.length === 0 && bakeryItems.length > 0) {
      originalItemsRef.current = JSON.parse(JSON.stringify(bakeryItems));
    }
  }, [bakeryItems]);

  // Cell Note Management state (Matches DailySalesRecord)
  const [activeNoteCell, setActiveNoteCell] = useState<{ itemName: string; dateStr: string } | null>(null);
  const [editingNoteCell, setEditingNoteCell] = useState<{ itemName: string; dateStr: string; noteIndex: number; text: string } | null>(null);
  const [newCellNoteText, setNewCellNoteText] = useState<string>('');

  // Auto-expand textarea helper
  const autoExpand = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(24, el.scrollHeight)}px`;
  };

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

  // Reset activeChunkIdx when viewMode changes
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
    if (originalItemsRef.current.length === 0 && bakeryItems.length > 0) {
      originalItemsRef.current = JSON.parse(JSON.stringify(bakeryItems));
    }
  }, [currentBranch, weekDays, bakeryItems]);

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

  // ━━━━ CELL NOTE MANAGEMENT FUNCTIONS (Matches DailySalesRecord) ━━━━

  // Add note to cell
  const handleAddCellNote = (itemName: string, dateStr: string, noteText: string) => {
    const text = noteText.trim();
    if (!text) {
      setActiveNoteCell(null);
      setNewCellNoteText('');
      return;
    }

    setRecords(prev => {
      const itemMap = { ...(prev[itemName] || {}) };
      const currentRec = { ...(itemMap[dateStr] || { totalQty: '', lineQty: '', storeQty: '', soldQty: '', note: '' }) };
      const currentNotes = (currentRec.note || '').split('\n').map(s => s.trim()).filter(Boolean);
      
      currentRec.note = [...currentNotes, text].join('\n');
      itemMap[dateStr] = currentRec;

      return {
        ...prev,
        [itemName]: itemMap
      };
    });

    setActiveNoteCell(null);
    setNewCellNoteText('');
  };

  // Delete note from cell
  const handleDeleteCellNote = (itemName: string, dateStr: string, noteIndex: number) => {
    if (editingNoteCell && editingNoteCell.itemName === itemName && editingNoteCell.dateStr === dateStr && editingNoteCell.noteIndex === noteIndex) {
      setEditingNoteCell(null);
    }

    setRecords(prev => {
      const itemMap = { ...(prev[itemName] || {}) };
      const currentRec = { ...(itemMap[dateStr] || { totalQty: '', lineQty: '', storeQty: '', soldQty: '', note: '' }) };
      const currentNotes = (currentRec.note || '').split('\n').map(s => s.trim()).filter(Boolean);
      currentNotes.splice(noteIndex, 1);
      
      currentRec.note = currentNotes.join('\n');
      itemMap[dateStr] = currentRec;

      return {
        ...prev,
        [itemName]: itemMap
      };
    });
  };

  // Start editing a cell note
  const startEditCellNote = (itemName: string, dateStr: string, noteIndex: number, currentText: string) => {
    setActiveNoteCell(null);
    setNewCellNoteText('');
    setEditingNoteCell({
      itemName,
      dateStr,
      noteIndex,
      text: currentText,
    });
  };

  // Save edited cell note
  const saveEditCellNote = () => {
    if (!editingNoteCell) return;
    const trimmed = editingNoteCell.text.trim();
    const { itemName, dateStr, noteIndex } = editingNoteCell;

    if (!trimmed) {
      handleDeleteCellNote(itemName, dateStr, noteIndex);
    } else {
      setRecords(prev => {
        const itemMap = { ...(prev[itemName] || {}) };
        const currentRec = { ...(itemMap[dateStr] || { totalQty: '', lineQty: '', storeQty: '', soldQty: '', note: '' }) };
        const currentNotes = (currentRec.note || '').split('\n').map(s => s.trim()).filter(Boolean);
        
        if (currentNotes[noteIndex] !== undefined) {
          currentNotes[noteIndex] = trimmed;
          currentRec.note = currentNotes.join('\n');
          itemMap[dateStr] = currentRec;
        }

        return {
          ...prev,
          [itemName]: itemMap
        };
      });
    }

    setEditingNoteCell(null);
  };

  // Cancel editing cell note
  const cancelEditCellNote = () => {
    setEditingNoteCell(null);
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

  // Delete Item (replaces window.confirm with Custom React Modal)
  const handleDeleteItem = (itemId: string, itemName: string) => {
    setDeletingItem({ id: itemId, name: itemName });
  };

  const confirmDeleteItem = () => {
    if (!deletingItem) return;
    setBakeryItems(prev => prev.filter(i => i.id !== deletingItem.id));
    setDeletingItem(null);
  };

  // Add Category
  const handleAddCategory = () => {
    setNewCatName('');
    setShowAddCatModal(true);
  };

  const confirmAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
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

  // Delete Category (replaces window.confirm with Custom React Modal)
  const handleDeleteCategory = (catName: string) => {
    const count = bakeryItems.filter(i => i.category === catName).length;
    setDeletingCategory({ name: catName, count });
  };

  const confirmDeleteCategory = () => {
    if (!deletingCategory) return;
    setBakeryItems(prev => prev.filter(i => i.category !== deletingCategory.name));
    setDeletingCategory(null);
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
        setIsSaving(false);
        return false;
      }
    } else {
      setSaveStatus({
        type: 'success',
        message: 'บันทึกลงในเครื่องเรียบร้อยแล้ว (ออฟไลน์โหมด)',
      });
    }

    // Update baseline snapshot after save
    originalRecordsRef.current = JSON.parse(JSON.stringify(records));
    originalItemsRef.current = JSON.parse(JSON.stringify(bakeryItems));

    setIsSaving(false);
    setTimeout(() => {
      setSaveStatus(null);
    }, 4000);
    return true;
  };

  // ━━━━ UNSAVED CHANGES & DISCARD HANDLERS ━━━━

  // Discard changes and revert to last saved baseline
  const handleDiscard = useCallback(() => {
    if (originalRecordsRef.current) {
      setRecords(JSON.parse(JSON.stringify(originalRecordsRef.current)));
    }
    if (originalItemsRef.current && originalItemsRef.current.length > 0) {
      setBakeryItems(JSON.parse(JSON.stringify(originalItemsRef.current)));
      try {
        localStorage.setItem(`cafe_bakery_items_${currentBranch}`, JSON.stringify(originalItemsRef.current));
      } catch (e) {}
    }
    setActiveNoteCell(null);
    setEditingNoteCell(null);
    setEditingItem(null);
    setEditingCat(null);
    setDeletingItem(null);
    setDeletingCategory(null);
    setImportPreview(null);
  }, [currentBranch]);

  // Check if there are unsaved changes
  const checkHasUnsavedChanges = useCallback(() => {
    // 1. Check items list changes
    const origItems = originalItemsRef.current;
    if (origItems && origItems.length > 0) {
      if (origItems.length !== bakeryItems.length) return true;
      for (let i = 0; i < bakeryItems.length; i++) {
        if (
          bakeryItems[i].id !== origItems[i]?.id ||
          bakeryItems[i].name !== origItems[i]?.name ||
          bakeryItems[i].category !== origItems[i]?.category
        ) {
          return true;
        }
      }
    }

    // 2. Check record cell values and notes
    const origRecs = originalRecordsRef.current || {};
    const allItems = new Set([...Object.keys(records), ...Object.keys(origRecs)]);
    for (const item of allItems) {
      const curItemMap = records[item] || {};
      const origItemMap = origRecs[item] || {};
      const allDates = new Set([...Object.keys(curItemMap), ...Object.keys(origItemMap)]);
      for (const d of allDates) {
        const c = curItemMap[d] || { totalQty: '', lineQty: '', storeQty: '', soldQty: '', note: '' };
        const o = origItemMap[d] || { totalQty: '', lineQty: '', storeQty: '', soldQty: '', note: '' };
        if (
          String(c.totalQty ?? '') !== String(o.totalQty ?? '') ||
          String(c.lineQty ?? '') !== String(o.lineQty ?? '') ||
          String(c.storeQty ?? '') !== String(o.storeQty ?? '') ||
          String(c.soldQty ?? '') !== String(o.soldQty ?? '') ||
          String(c.note ?? '').trim() !== String(o.note ?? '').trim()
        ) {
          return true;
        }
      }
    }

    return false;
  }, [bakeryItems, records]);

  const isDirty = useMemo(() => {
    return checkHasUnsavedChanges();
  }, [checkHasUnsavedChanges, records, bakeryItems]);

  // Notify parent of dirty status changes
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  // Register save and discard handlers with parent
  useEffect(() => {
    if (registerSaveHandler) {
      registerSaveHandler({
        hasUnsavedChanges: () => checkHasUnsavedChanges(),
        handleSave: async () => {
          return await handleSave();
        },
        handleDiscard: () => {
          handleDiscard();
        },
      });
    }
  }, [registerSaveHandler, checkHasUnsavedChanges, handleDiscard, records, bakeryItems]);

  // Browser beforeunload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (checkHasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [checkHasUnsavedChanges]);

  // ━━━━ EXCEL IMPORT HANDLERS ━━━━

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        alert('ไม่พบแผ่นงาน (Sheet) ในไฟล์ Excel ที่เลือก');
        return;
      }
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

      if (!rows || rows.length === 0) {
        alert('ไม่พบข้อมูลในไฟล์ Excel ที่เลือก');
        return;
      }

      let catCol = -1;
      let itemCol = -1;
      let startRow = 0;

      // Scan first 5 rows for header row
      for (let r = 0; r < Math.min(rows.length, 5); r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;
        row.forEach((cell, colIdx) => {
          const str = String(cell || '').toLowerCase().trim();
          if (str.includes('หมวด') || str.includes('category') || str.includes('กลุ่ม') || str.includes('group')) {
            catCol = colIdx;
            startRow = r + 1;
          }
          if (str.includes('รายการ') || str.includes('ขนม') || str.includes('name') || str.includes('item') || str.includes('เมนู') || str.includes('ชื่อ')) {
            itemCol = colIdx;
            startRow = r + 1;
          }
        });
        if (itemCol !== -1) break;
      }

      // If no explicit header recognized
      if (itemCol === -1) {
        startRow = 0;
        const firstDataRow = rows[0] || [];
        if (firstDataRow.length >= 2) {
          catCol = 0;
          itemCol = 1;
        } else {
          catCol = -1;
          itemCol = 0;
        }
      }

      const parsed: { category: string; name: string }[] = [];
      let currentCat = 'เบเกอรี่ทั่วไป';

      for (let r = startRow; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row) || row.length === 0) continue;

        const rawCat = catCol !== -1 ? String(row[catCol] || '').trim() : '';
        const rawName = itemCol !== -1 ? String(row[itemCol] || '').trim() : '';

        if (rawCat && !rawCat.includes('หมวดหมู่') && !rawCat.includes('category')) {
          currentCat = rawCat;
        }

        if (
          rawName && 
          !rawName.includes('รายการขนม') && 
          !rawName.includes('item name') && 
          !rawName.includes('เมนู') &&
          rawName !== 'รายการ'
        ) {
          parsed.push({
            category: rawCat || currentCat || 'เบเกอรี่ทั่วไป',
            name: rawName,
          });
        }
      }

      if (parsed.length === 0) {
        alert('ไม่พบรายการขนมในไฟล์ Excel ที่สามารถนำเข้าได้ กรุณาตรวจสอบหัวตาราง (เช่น หมวดหมู่, รายการขนม)');
        return;
      }

      setImportPreview({
        fileName: file.name,
        items: parsed,
        importMode: 'append',
      });
    } catch (err: any) {
      console.error('Excel parse error:', err);
      alert(`เกิดข้อผิดพลาดในการอ่านไฟล์ Excel: ${err.message || 'รูปแบบไฟล์ไม่ถูกต้อง'}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const confirmImportExcel = () => {
    if (!importPreview) return;

    const { items, importMode } = importPreview;

    if (importMode === 'replace') {
      const newItemsList: BakeryItemDef[] = items.map((it, idx) => ({
        id: `import-${Date.now()}-${idx}`,
        name: it.name,
        category: it.category,
      }));
      setBakeryItems(newItemsList);
      setSaveStatus({
        type: 'success',
        message: `นำเข้ารายการขนมใหม่ ${newItemsList.length} รายการ (แทนที่รายการเดิม) สำเร็จ`,
      });
    } else {
      // Append mode: only add items whose name doesn't already exist
      const existingNames = new Set(bakeryItems.map(b => b.name.trim().toLowerCase()));
      const toAdd: BakeryItemDef[] = [];

      items.forEach((it, idx) => {
        const key = it.name.trim().toLowerCase();
        if (!existingNames.has(key)) {
          existingNames.add(key);
          toAdd.push({
            id: `import-${Date.now()}-${idx}`,
            name: it.name.trim(),
            category: it.category.trim() || 'เบเกอรี่ทั่วไป',
          });
        }
      });

      if (toAdd.length === 0) {
        setSaveStatus({
          type: 'info',
          message: 'รายการขนมทั้งหมดในไฟล์มีอยู่ในระบบอยู่แล้ว (ไม่มีรายการใหม่)',
        });
      } else {
        setBakeryItems(prev => [...prev, ...toAdd]);
        setSaveStatus({
          type: 'success',
          message: `เพิ่มรายการขนมใหม่ ${toAdd.length} รายการ จาก Excel เรียบร้อยแล้ว`,
        });
      }
    }

    setImportPreview(null);
  };

  const handleDownloadSampleExcel = () => {
    const sampleData = [
      ['หมวดหมู่', 'รายการขนม'],
      ['ครัวซอง & เดนิส', 'ครัวซอง เนยสด'],
      ['ครัวซอง & เดนิส', 'อัลมอนด์'],
      ['ครัวซอง & เดนิส', 'แฮมชีส'],
      ['เค้ก', 'เค้กช็อกโกแลตหน้านิ่ม'],
      ['เค้ก', 'ชีสเค้กหน้าไหม้'],
      ['ขนมปังสด', 'ขนมปังเนยสด'],
      ['ขนมปังสด', 'ขนมปังกระเทียมครีมชีส'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายการขนม');
    XLSX.writeFile(wb, 'Bakery_Items_Template.xlsx');
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

        {/* ROW 2: View Mode + Date Chunk Selector + Save + Export (ALL IN ONE ROW) */}
        <div className="flex items-center justify-between gap-2 w-full pt-0.5 flex-wrap sm:flex-nowrap">
          
          {/* LEFT: View Mode Tabs + Date Chunk Selector on SAME ROW */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
            <span className="text-[11px] font-medium text-[#6B8F8E] whitespace-nowrap">มุมมอง:</span>
            
            {/* View Mode Tabs: 1วัน, 2วัน, 3วัน */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-[#F0F5F4] p-0.5 rounded-[8px] border border-[#D4E4E3]">
              <button
                type="button"
                onClick={() => setViewMode('1day')}
                className={`px-2 py-1 rounded-[6px] text-[10px] sm:text-[11px] font-[600] transition-colors cursor-pointer ${
                  viewMode === '1day'
                    ? 'bg-[#5A8A88] text-white shadow-xs'
                    : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                1วัน
              </button>
              <button
                type="button"
                onClick={() => setViewMode('2days')}
                className={`px-2 py-1 rounded-[6px] text-[10px] sm:text-[11px] font-[600] transition-colors cursor-pointer ${
                  viewMode === '2days'
                    ? 'bg-[#5A8A88] text-white shadow-xs'
                    : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                2วัน
              </button>
              <button
                type="button"
                onClick={() => setViewMode('3days')}
                className={`px-2 py-1 rounded-[6px] text-[10px] sm:text-[11px] font-[600] transition-colors cursor-pointer ${
                  viewMode === '3days'
                    ? 'bg-[#5A8A88] text-white shadow-xs'
                    : 'text-[#2D4A49] hover:bg-white'
                }`}
              >
                3วัน
              </button>
            </div>

            {/* Chunk / Day selector buttons on SAME ROW */}
            {viewMode === '1day' && (
              <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap sm:flex-nowrap">
                {weekDays.map((d, i) => (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setActiveChunkIdx(i)}
                    className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-[6px] text-[10px] font-semibold transition-all cursor-pointer ${
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
              <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap sm:flex-nowrap">
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
                    className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-[6px] text-[10px] font-semibold transition-all cursor-pointer ${
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
              <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap sm:flex-nowrap">
                {[
                  { idx: 0, label: 'จ.-พ.' },
                  { idx: 1, label: 'พฤ.-ส.' },
                  { idx: 2, label: 'อา.' },
                ].map(chunk => (
                  <button
                    key={chunk.idx}
                    type="button"
                    onClick={() => setActiveChunkIdx(chunk.idx)}
                    className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-[6px] text-[10px] font-semibold transition-all cursor-pointer ${
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

          </div>

          {/* RIGHT: Action Buttons (Save + Import + Export Dropdown - On SAME ROW) */}
          <div className="flex items-center gap-1.5 ml-auto relative shrink-0">
            
            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-1.5 text-white text-[11px] sm:text-[12px] font-[600] rounded-[8px] px-3.5 py-[6px] h-[32px] transition-all shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap ${
                isDirty 
                  ? 'bg-[#1E3A39] hover:bg-[#162D2C] ring-2 ring-amber-400/70' 
                  : 'bg-[#2D4A49] hover:bg-[#203635]'
              }`}
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
                  {isDirty && (
                    <span 
                      className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" 
                      title="มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก" 
                    />
                  )}
                </>
              )}
            </button>

            {/* Import Excel Button & Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] text-[#2D4A49] text-[11px] font-[500] rounded-[8px] px-2.5 py-[6px] h-[32px] transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
              title="นำเข้ารายการขนมจากไฟล์ Excel (.xlsx, .xls, .csv)"
            >
              <Upload size={13} className="text-[#5A8A88]" />
              <span>นำเข้า</span>
            </button>

            {/* Export Dropdown */}
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
        <div>
          <table className="w-full text-left border-collapse table-fixed">
            
            {/* Top Header with Date Groups */}
            <thead>
              <tr className="bg-[#2D4A49] text-white text-[11px] font-bold border-b border-[#1E3A39]">
                <th className="py-2.5 px-2 sm:px-3 w-[22%] sm:w-[20%] sticky left-0 z-20 bg-[#2D4A49] border-r border-[#3D6B69]">
                  <div className="flex items-center justify-between">
                    <span className="truncate">รายการขนม</span>
                    <button
                      type="button"
                      onClick={() => handleAddItem()}
                      className="text-[10px] bg-[#3D6B69] hover:bg-[#5A8A88] text-white px-1.5 py-0.5 rounded transition-colors flex items-center gap-0.5 cursor-pointer shrink-0"
                      title="เพิ่มรายการขนม"
                    >
                      <Plus size={10} />
                      <span className="hidden sm:inline">เพิ่ม</span>
                    </button>
                  </div>
                </th>
                {displayedDays.map(day => (
                  <th
                    key={day.dateStr}
                    colSpan={5}
                    className="py-2 px-1 text-center border-r-2 border-[#1E3A39] bg-[#2D4A49] text-[10px] sm:text-[11px] truncate"
                  >
                    วันที่: {day.dayName} ({day.shortDate})
                  </th>
                ))}
              </tr>

              {/* Sub Header for Columns in each Date Group */}
              <tr className="bg-[#3D6B69] text-white text-[9px] sm:text-[10px] font-semibold border-b border-[#2D4A49]">
                <th className="py-2 px-2 sm:px-3 sticky left-0 z-20 bg-[#3D6B69] border-r border-[#2D4A49]">
                  เมนู / หมวดหมู่
                </th>
                {displayedDays.map(day => (
                  <React.Fragment key={`sub-${day.dateStr}`}>
                    <th className="py-1.5 px-0.5 text-right w-[12%] sm:w-[13%] truncate">ทั้งหมด</th>
                    <th className="py-1.5 px-0.5 text-right w-[12%] sm:w-[13%] truncate">Line</th>
                    <th className="py-1.5 px-0.5 text-right w-[12%] sm:w-[13%] bg-[#345D5B] truncate">หน้าร้าน</th>
                    <th className="py-1.5 px-0.5 text-right w-[12%] sm:w-[13%] bg-[#2A4D4B] truncate">ขายได้</th>
                    <th className="py-1.5 px-1 text-left w-[32%] sm:w-[28%] border-r-2 border-[#2D4A49] truncate">หมายเหตุ</th>
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
                              className="p-1 hover:bg-white text-[#5A8A88] rounded transition-colors cursor-pointer"
                              title="แก้ไขชื่อหมวดหมู่"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(category.name)}
                              className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors cursor-pointer"
                              title="ลบหมวดหมู่นี้"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddItem(category.name)}
                          className="text-[10px] font-semibold bg-white/80 hover:bg-white text-[#5A8A88] px-2 py-0.5 rounded border border-[#D4E4E3] transition-colors cursor-pointer"
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
                              className="p-1 hover:bg-white text-[#5A8A88] rounded transition-colors cursor-pointer"
                              title="แก้ไขชื่อรายการ"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id, item.name)}
                              className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors cursor-pointer"
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
                        
                        // Parse note items list
                        const noteList = (rec.note || '').split('\n').map(s => s.trim()).filter(Boolean);
                        const isAddingNoteToThisCell = activeNoteCell && activeNoteCell.itemName === item.name && activeNoteCell.dateStr === day.dateStr;

                        return (
                          <React.Fragment key={`${item.id}-${day.dateStr}`}>
                            {/* 1. จำนวนขนมทั้งหมด */}
                            <td className="py-1 px-1 text-right align-top">
                              <input
                                type="number"
                                value={rec.totalQty}
                                onChange={(e) => handleChange(item.name, day.dateStr, 'totalQty', e.target.value)}
                                placeholder="0"
                                className="w-full bg-white border border-[#D4E4E3] rounded text-[11px] font-mono text-right px-1.5 py-1 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2]"
                              />
                            </td>

                            {/* 2. Official Line */}
                            <td className="py-1 px-1 text-right align-top">
                              <input
                                type="number"
                                value={rec.lineQty}
                                onChange={(e) => handleChange(item.name, day.dateStr, 'lineQty', e.target.value)}
                                placeholder="0"
                                className="w-full bg-white border border-[#D4E4E3] rounded text-[11px] font-mono text-right px-1.5 py-1 text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] focus:bg-[#E8F3F2]"
                              />
                            </td>

                            {/* 3. ขายหน้าร้าน (Auto / Editable) */}
                            <td className="py-1 px-1 text-right bg-[#F9FBFA] align-top">
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
                            <td className={`py-1 px-1 text-right align-top ${isUnderTarget ? 'bg-amber-50' : ''}`}>
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

                            {/* 5. หมายเหตุ (Identical Note UI & Logic to DailySalesRecord) */}
                            <td className="py-1 px-1.5 border-r-2 border-[#D4E4E3] align-top w-[110px]">
                              <div className="flex flex-col gap-1 min-h-[28px] justify-center">
                                
                                {/* Existing notes list */}
                                {noteList.length > 0 && (
                                  <div className="flex flex-col gap-0.5">
                                    {noteList.map((noteItem, nIdx) => {
                                      const isEditingThisNote = editingNoteCell && 
                                        editingNoteCell.itemName === item.name && 
                                        editingNoteCell.dateStr === day.dateStr && 
                                        editingNoteCell.noteIndex === nIdx;

                                      if (isEditingThisNote) {
                                        return (
                                          <div key={nIdx} className="flex items-start gap-1 mt-0.5">
                                            <textarea
                                              autoFocus
                                              rows={1}
                                              value={editingNoteCell.text}
                                              onInput={(e) => autoExpand(e.target as HTMLTextAreaElement)}
                                              onChange={(e) => setEditingNoteCell({ ...editingNoteCell, text: e.target.value })}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                  e.preventDefault();
                                                  saveEditCellNote();
                                                } else if (e.key === 'Escape') {
                                                  cancelEditCellNote();
                                                }
                                              }}
                                              style={{
                                                resize: 'none',
                                                overflow: 'hidden',
                                                minHeight: '24px',
                                                lineHeight: '1.3',
                                                padding: '3px 4px',
                                                fontSize: '9px',
                                              }}
                                              className="w-full bg-white border border-[#5A8A88] rounded-[4px] text-left text-[#2D4A49] focus:outline-none"
                                            />
                                            <button
                                              type="button"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                saveEditCellNote();
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
                                                cancelEditCellNote();
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
                                            onClick={() => startEditCellNote(item.name, day.dateStr, nIdx, noteItem)}
                                            title="คลิกเพื่อแก้ไขหมายเหตุ"
                                            className="flex-1 break-words whitespace-pre-wrap cursor-pointer rounded-[3px] px-0.5 py-[1px] hover:bg-[#E8F3F2] hover:text-[#5A8A88] transition-colors"
                                          >
                                            {noteItem}
                                          </span>
                                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                              type="button"
                                              onClick={() => startEditCellNote(item.name, day.dateStr, nIdx, noteItem)}
                                              className="text-[#A8BCBB] hover:text-[#5A8A88] hover:bg-[#E8F3F2] p-0.5 rounded-[3px] cursor-pointer transition-colors"
                                              title="แก้ไขหมายเหตุ"
                                            >
                                              <Pencil size={10} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteCellNote(item.name, day.dateStr, nIdx)}
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
                                {isAddingNoteToThisCell ? (
                                  <div className="mt-0.5">
                                    <textarea
                                      autoFocus
                                      rows={1}
                                      value={newCellNoteText}
                                      onInput={(e) => autoExpand(e.target as HTMLTextAreaElement)}
                                      onChange={(e) => setNewCellNoteText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault();
                                          handleAddCellNote(item.name, day.dateStr, newCellNoteText);
                                        } else if (e.key === 'Escape') {
                                          setActiveNoteCell(null);
                                          setNewCellNoteText('');
                                        }
                                      }}
                                      onBlur={() => {
                                        if (newCellNoteText.trim()) {
                                          handleAddCellNote(item.name, day.dateStr, newCellNoteText);
                                        } else {
                                          setActiveNoteCell(null);
                                        }
                                      }}
                                      placeholder="พิมพ์หมายเหตุ (กด Enter เพื่อบันทึก)..."
                                      style={{
                                        resize: 'none',
                                        overflow: 'hidden',
                                        minHeight: '24px',
                                        lineHeight: '1.3',
                                        padding: '3px 4px',
                                        fontSize: '9px',
                                      }}
                                      className="w-full bg-white border border-[#5A8A88] rounded-[4px] text-left text-[#2D4A49] focus:outline-none focus:bg-[#E8F3F2]"
                                    />
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingNoteCell(null);
                                      setActiveNoteCell({ itemName: item.name, dateStr: day.dateStr });
                                      setNewCellNoteText('');
                                    }}
                                    className="flex items-center gap-0.5 text-[8px] text-[#5A8A88] hover:text-[#2D4A49] cursor-pointer pt-0.5 transition-colors"
                                  >
                                    <Plus size={10} className="text-[#5A8A88]" />
                                    <span>เพิ่มหมายเหตุ</span>
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

      {/* 5. Delete Item Confirmation Modal (replaces window.confirm) */}
      {deletingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[110] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-rose-100 overflow-hidden">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
                <Trash2 size={22} />
              </div>
              <h3 className="text-sm font-bold text-[#2D4A49] mb-1">ยืนยันการลบรายการขนม</h3>
              <p className="text-xs text-[#6B8F8E] mb-4">
                คุณต้องการลบรายการ <span className="font-semibold text-rose-600">"{deletingItem.name}"</span> ออกจากระบบใช่หรือไม่?
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-[#6B8F8E] hover:bg-[#F0F5F4] transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteItem}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs"
                >
                  ยืนยันการลบ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Delete Category Confirmation Modal (replaces window.confirm) */}
      {deletingCategory && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[110] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-rose-100 overflow-hidden">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
                <Trash2 size={22} />
              </div>
              <h3 className="text-sm font-bold text-[#2D4A49] mb-1">ยืนยันการลบหมวดหมู่ขนม</h3>
              <p className="text-xs text-[#6B8F8E] mb-4">
                คุณต้องการลบหมวดหมู่ <span className="font-semibold text-rose-600">"{deletingCategory.name}"</span> และรายการขนมทั้งหมด ({deletingCategory.count} รายการ) ในหมวดนี้ใช่หรือไม่?
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingCategory(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-[#6B8F8E] hover:bg-[#F0F5F4] transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCategory}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs"
                >
                  ยืนยันการลบหมวดหมู่
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Excel Import Preview Modal */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[110] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-[#D4E4E3] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#2D4A49] text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-bold text-sm">
                <FileSpreadsheet size={18} className="text-[#A8BCBB]" />
                <span>นำเข้ารายการขนมจาก Excel</span>
              </div>
              <button 
                type="button" 
                onClick={() => setImportPreview(null)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="bg-[#F0F5F4] p-3 rounded-xl border border-[#D4E4E3] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#2D4A49] flex items-center gap-1.5">
                    <span>📄 {importPreview.fileName}</span>
                  </div>
                  <div className="text-[11px] text-[#5A8A88] mt-0.5">
                    พบ {importPreview.items.length} รายการ (ใน {new Set(importPreview.items.map(i => i.category)).size} หมวดหมู่)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleExcel}
                  className="text-[10px] text-[#5A8A88] hover:text-[#2D4A49] underline cursor-pointer"
                >
                  โหลดไฟล์ตัวอย่าง (.xlsx)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2D4A49] mb-1.5">
                  รูปแบบการนำเข้า
                </label>
                <div className="space-y-1.5 text-xs text-[#2D4A49]">
                  <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-[#D4E4E3] hover:bg-[#F8FAFA]">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importPreview.importMode === 'append'}
                      onChange={() => setImportPreview({ ...importPreview, importMode: 'append' })}
                      className="text-[#5A8A88] focus:ring-[#5A8A88]"
                    />
                    <div>
                      <span className="font-semibold">นำเข้าเพิ่มจากรายการเดิม</span>
                      <span className="text-[#6B8F8E] text-[11px] block">(เพิ่มเฉพาะรายการใหม่ ไม่เพิ่มรายการที่ชื่อซ้ำในระบบ)</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-[#D4E4E3] hover:bg-[#F8FAFA]">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importPreview.importMode === 'replace'}
                      onChange={() => setImportPreview({ ...importPreview, importMode: 'replace' })}
                      className="text-[#5A8A88] focus:ring-[#5A8A88]"
                    />
                    <div>
                      <span className="font-semibold text-rose-700">แทนที่รายการขนมเดิมทั้งหมด</span>
                      <span className="text-[#6B8F8E] text-[11px] block">(ลบรายการเดิมออกแล้วแทนที่ด้วยรายการจากไฟล์นี้)</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2D4A49] mb-1">
                  ตัวอย่างรายการที่พบ ({importPreview.items.length} รายการ)
                </label>
                <div className="max-h-48 overflow-y-auto border border-[#D4E4E3] rounded-lg divide-y divide-[#F0F5F4] bg-[#F8FAFA]">
                  {importPreview.items.map((it, idx) => (
                    <div key={idx} className="p-2 px-3 flex items-center justify-between text-xs">
                      <span className="font-medium text-[#2D4A49] truncate mr-2">{it.name}</span>
                      <span className="text-[10px] text-[#5A8A88] bg-white px-2 py-0.5 rounded border border-[#D4E4E3] shrink-0">
                        {it.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#D4E4E3] bg-[#F8FAFA] flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#6B8F8E] hover:bg-[#E8F3F2] transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmImportExcel}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#2D4A49] hover:bg-[#203635] text-white transition-colors cursor-pointer shadow-xs"
              >
                ยืนยันการนำเข้า ({importPreview.items.length} รายการ)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default DailyBakeryRecord;
