import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Ingredient, WasteLogEntry } from '../types';
import { format } from 'date-fns';
import { Trash2, Plus, X, Upload, Save, AlertTriangle, AlertCircle, Camera, Edit2, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { cn, generateUUID } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface WasteReportProps {
  department: 'Bar' | 'Bakery';
  ingredients: Ingredient[];
  wasteLogs: WasteLogEntry[];
  currentUser: string;
  onSave: (log: Omit<WasteLogEntry, 'id' | 'timestamp'> | Omit<WasteLogEntry, 'id' | 'timestamp'>[]) => Promise<void> | void;
  onUpdate?: (id: string, updates: Partial<WasteLogEntry>) => Promise<void> | void;
  onBack: () => void;
}

export interface WasteFormItem {
  tempId: string;
  ingredientId: string;
  quantity: number | '';
  cause: string;
  solution: string;
  imageUrl: string;
}

const createNewItem = (): WasteFormItem => ({
  tempId: generateUUID(),
  ingredientId: '',
  quantity: 1,
  cause: '',
  solution: '',
  imageUrl: ''
});

export function WasteReport({ department, ingredients, wasteLogs, currentUser, onSave, onUpdate, onBack }: WasteReportProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<WasteLogEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ cause: '', solution: '' });
  
  const [entryDate, setEntryDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [wasteItems, setWasteItems] = useState<WasteFormItem[]>([createNewItem()]);

  // Reliable data fetching pattern & real-time state
  const [records, setRecords] = useState<WasteLogEntry[]>([]);
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
        .from('waste_logs')
        .select('id, timestamp, date, department, ingredient_id, ingredient_name, quantity, unit, cause, solution, image_url, recorder_name')
        .order('timestamp', { ascending: false });

      if (branch) {
        query = query.eq('branch', branch);
      }

      const { data, error: fetchErr } = await query.limit(150);

      if (fetchErr) {
        console.error('Error fetching waste_logs from Supabase:', fetchErr);
        setError(fetchErr.message);
      } else if (data) {
        const mapped: WasteLogEntry[] = data.map((w: any) => ({
          id: w.id,
          timestamp: w.timestamp,
          date: w.date,
          department: w.department,
          ingredientId: w.ingredient_id,
          ingredientName: w.ingredient_name,
          quantity: typeof w.quantity === 'number' ? w.quantity : parseFloat(w.quantity) || 0,
          unit: w.unit,
          cause: w.cause,
          solution: w.solution,
          imageUrl: w.image_url,
          recorderName: w.recorder_name
        }));
        setRecords(mapped);
      }
    } catch (err: any) {
      console.error('Fetch exception in waste_logs:', err);
      setError(err?.message || 'Error fetching data');
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, []);

  // Initial fetch on mount & re-fetch if department/branch changes
  useEffect(() => {
    fetchData();
  }, [fetchData, department]);

  // Real-time Supabase subscription
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`realtime-waste_logs-${department}-${Math.random().toString(36).substring(2, 7)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waste_logs'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, department]);

  // Re-fetch on tab return / window focus
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

  // Blend fetched records with props fallback
  const effectiveWasteLogs = useMemo(() => {
    if (records.length > 0) return records;
    return wasteLogs;
  }, [records, wasteLogs]);

  // Always resolve the freshest log from wasteLogs state
  const activeSelectedLog = useMemo(() => {
    if (!selectedLog) return null;
    return effectiveWasteLogs.find(l => l.id === selectedLog.id) || selectedLog;
  }, [selectedLog, effectiveWasteLogs]);

  // Keep editFormData strictly in sync with the selected item and reset edit mode on item change
  useEffect(() => {
    if (selectedLog) {
      const current = effectiveWasteLogs.find(l => l.id === selectedLog.id) || selectedLog;
      setEditFormData({
        cause: current.cause || '',
        solution: current.solution || ''
      });
      setIsEditing(false);
    }
  }, [selectedLog?.id, effectiveWasteLogs]);

  const handleOpenLogDetail = (log: WasteLogEntry) => {
    setSelectedLog(log);
    setEditFormData({
      cause: log.cause || '',
      solution: log.solution || ''
    });
    setIsEditing(false);
  };

  const handleCloseLogDetail = () => {
    setSelectedLog(null);
    setIsEditing(false);
    setEditFormData({ cause: '', solution: '' });
  };

  const handleStartEdit = () => {
    const current = activeSelectedLog || selectedLog;
    if (!current) return;
    setEditFormData({
      cause: current.cause || '',
      solution: current.solution || ''
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    const current = activeSelectedLog || selectedLog;
    if (current) {
      setEditFormData({
        cause: current.cause || '',
        solution: current.solution || ''
      });
    }
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    const current = activeSelectedLog || selectedLog;
    if (!current) return;
    const trimmedCause = editFormData.cause.trim();
    const trimmedSolution = editFormData.solution.trim();

    if (!trimmedCause) {
      alert('กรุณาระบุสาเหตุที่เสียหาย');
      return;
    }

    if (onUpdate) {
      await onUpdate(current.id, {
        cause: trimmedCause,
        solution: trimmedSolution
      });
      setSelectedLog(prev => prev ? { ...prev, cause: trimmedCause, solution: trimmedSolution } : null);
      setIsEditing(false);
      await fetchData();
    }
  };

  // Retrieve Bakery configuration options
  const bakeryOptions = useMemo(() => {
    if (department !== 'Bakery') return { types: [], targets: [], menus: [] };

    let mixing: any[] = [];
    let cutting: any[] = [];
    let items: any[] = [];

    try {
      const savedMixing = localStorage.getItem('bakeryMixingSettings');
      mixing = savedMixing ? JSON.parse(savedMixing) : [
        { id: '1', name: 'ครัวซองค์', unit: 'Dough', size: '4 kg' },
        { id: '2', name: 'ชีสเค้ก BB', unit: 'ก้อน', size: '2 ปอนด์' },
      ];
    } catch (e) {
      mixing = [
        { id: '1', name: 'ครัวซองค์', unit: 'Dough', size: '4 kg' },
        { id: '2', name: 'ชีสเค้ก BB', unit: 'ก้อน', size: '2 ปอนด์' },
      ];
    }

    try {
      const savedCutting = localStorage.getItem('bakeryCuttingSettings');
      cutting = savedCutting ? JSON.parse(savedCutting) : [
        { id: '1', sourceDough: 'ครัวซองค์', target: 'ครัวซองค์เนยสด', ratio: 34, unit: 'ชิ้น' },
        { id: '2', sourceDough: 'ครัวซองค์', target: 'ครัวซองค์ช็อคโกแลต', ratio: 40, unit: 'ชิ้น' },
      ];
    } catch (e) {
      cutting = [
        { id: '1', sourceDough: 'ครัวซองค์', target: 'ครัวซองค์เนยสด', ratio: 34, unit: 'ชิ้น' },
        { id: '2', sourceDough: 'ครัวซองค์', target: 'ครัวซองค์ช็อคโกแลต', ratio: 40, unit: 'ชิ้น' },
      ];
    }

    try {
      const savedItems = localStorage.getItem('bakeryItemSettings');
      items = savedItems ? JSON.parse(savedItems) : [];
    } catch (e) {
      items = [];
    }

    const uniqueTypes = Array.from(new Set(mixing.map(m => m.name).filter(Boolean))) as string[];
    const uniqueTargets = Array.from(new Set(cutting.map(c => c.target).filter(Boolean))) as string[];
    const uniqueMenus = Array.from(new Set(items.map((i: any) => i.menu || i.unit).filter(Boolean))) as string[];

    return {
      types: uniqueTypes.map((name, idx) => ({ id: `type-${idx}-${name}`, name, group: 'ชนิดแป้ง (Type)', unit: 'Dough' })),
      targets: uniqueTargets.map((name, idx) => ({ id: `target-${idx}-${name}`, name, group: 'รายการ (Target Item)', unit: 'ชิ้น' })),
      menus: uniqueMenus.map((name, idx) => ({ id: `menu-${idx}-${name}`, name, group: 'เมนู (Menu)', unit: 'ชิ้น' }))
    };
  }, [department]);

  const deptIngredients = useMemo(() => {
    return ingredients
      .filter(ing => ing.department === department || (department === 'Bakery' && ing.department === 'Kitchen') || (!ing.department && department === 'Bar'))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, department]);

  const deptLogs = useMemo(() => {
    return effectiveWasteLogs
      .filter(log => log.department === department || (department === 'Bakery' && log.department === 'Kitchen'))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [effectiveWasteLogs, department]);

  const getItemUnit = (ingredientId: string) => {
    if (!ingredientId) return '-';
    if (department === 'Bakery') {
      const matchType = bakeryOptions.types?.find(t => t.id === ingredientId);
      const matchTarget = bakeryOptions.targets?.find(t => t.id === ingredientId);
      const matchMenu = bakeryOptions.menus?.find(t => t.id === ingredientId);
      if (matchType) return matchType.unit;
      if (matchTarget) return matchTarget.unit;
      if (matchMenu) return matchMenu.unit;
    }
    const ingredient = ingredients.find(i => i.id === ingredientId);
    return ingredient?.unit || '-';
  };

  const resolveItemInfo = (ingredientId: string) => {
    let name = '';
    let unit = 'ชิ้น';

    if (department === 'Bakery') {
      const matchType = bakeryOptions.types?.find(t => t.id === ingredientId);
      const matchTarget = bakeryOptions.targets?.find(t => t.id === ingredientId);
      const matchMenu = bakeryOptions.menus?.find(t => t.id === ingredientId);

      if (matchType) {
        name = matchType.name;
        unit = matchType.unit;
      } else if (matchTarget) {
        name = matchTarget.name;
        unit = matchTarget.unit;
      } else if (matchMenu) {
        name = matchMenu.name;
        unit = matchMenu.unit;
      } else {
        const ingredient = ingredients.find(i => i.id === ingredientId);
        if (ingredient) {
          name = ingredient.name;
          unit = ingredient.unit;
        }
      }
    } else {
      const ingredient = ingredients.find(i => i.id === ingredientId);
      if (ingredient) {
        name = ingredient.name;
        unit = ingredient.unit;
      }
    }

    if (!name) {
      const matchAny = ingredients.find(i => i.id === ingredientId || i.name === ingredientId);
      if (matchAny) {
        name = matchAny.name;
        unit = matchAny.unit || unit;
      } else {
        name = ingredientId;
      }
    }

    return { name, unit };
  };

  const handleAddItem = () => {
    setWasteItems(prev => [...prev, createNewItem()]);
  };

  const handleRemoveItem = (tempId: string) => {
    if (wasteItems.length <= 1) return;
    setWasteItems(prev => prev.filter(i => i.tempId !== tempId));
  };

  const handleItemChange = (tempId: string, field: keyof WasteFormItem, value: any) => {
    setWasteItems(prev => prev.map(item => item.tempId === tempId ? { ...item, [field]: value } : item));
  };

  const handleItemImageUpload = (tempId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600;
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
          setWasteItems(prev => prev.map(item => item.tempId === tempId ? { ...item, imageUrl: compressedDataUrl } : item));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleRemoveItemImage = (tempId: string) => {
    setWasteItems(prev => prev.map(item => item.tempId === tempId ? { ...item, imageUrl: '' } : item));
  };

  const handleOpenForm = () => {
    setFormError(null);
    if (wasteItems.length === 0) {
      setWasteItems([createNewItem()]);
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const entriesToSave: Omit<WasteLogEntry, 'id' | 'timestamp'>[] = [];

    for (let i = 0; i < wasteItems.length; i++) {
      const item = wasteItems[i];
      if (!item.ingredientId) {
        setFormError(`กรุณาเลือกรายการสินค้าสำหรับรายการที่ ${i + 1}`);
        return;
      }
      const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity));
      if (isNaN(qty) || qty <= 0) {
        setFormError(`กรุณาระบุจำนวนที่เสียให้ถูกต้องสำหรับรายการที่ ${i + 1}`);
        return;
      }

      const { name, unit } = resolveItemInfo(item.ingredientId);
      const finalName = name || item.ingredientId;

      entriesToSave.push({
        date: entryDate,
        department,
        ingredientId: item.ingredientId,
        ingredientName: finalName,
        quantity: qty,
        unit: unit || 'ชิ้น',
        cause: item.cause.trim() || '-',
        solution: item.solution.trim() || '-',
        imageUrl: item.imageUrl || undefined,
        recorderName: currentUser
      });
    }

    if (entriesToSave.length === 0) {
      setFormError('กรุณากรอกข้อมูลรายการของเสียอย่างน้อย 1 รายการ');
      return;
    }

    try {
      setIsSaving(true);
      await onSave(entriesToSave);
      await fetchData();
      setSaveSuccessMsg(`บันทึกรายการของเสียสำเร็จ ${entriesToSave.length} รายการ เรียบร้อยแล้ว`);
      setEntryDate(format(new Date(), 'yyyy-MM-dd'));
      setWasteItems([createNewItem()]);
      setIsFormOpen(false);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Failed to save waste report:', err);
      setFormError(`เกิดข้อผิดพลาดในการบันทึก: ${err?.message || 'ไม่สามารถส่งข้อมูลไปยังฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PAGE HEADER (NO BACK BUTTON, SAGE GREEN & RED ACCENT)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Left block */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#FEE2E2] rounded-xl shrink-0 flex items-center justify-center">
            <Trash2 size={20} className="text-[#EF4444]" />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-[#2D4A49]">
              รายงานบันทึกของเสีย ({department === 'Bar' ? 'บาร์' : 'ครัว'})
            </h2>
            <p className="text-[11px] text-[#6B8F8E] mt-0.5">
              บันทึกและตรวจสอบประวัติวัตถุดิบ/สินค้าที่เสียหาย
            </p>
          </div>
        </div>
        
        {/* Right — "+ เพิ่มรายการของเสีย" button */}
        <button
          type="button"
          onClick={handleOpenForm}
          className="flex items-center gap-2 px-[18px] py-[10px] rounded-[10px] text-white text-[12px] font-semibold bg-[#2D4A49] hover:bg-[#1D3A39] shadow-xs hover:shadow transition-all cursor-pointer"
        >
          <Plus size={18} className="text-white" />
          <span>เพิ่มรายการของเสีย</span>
        </button>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          NEW WASTE ENTRY FORM (MODAL / INLINE)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl shadow-xl border border-[#D4E4E3] overflow-hidden mb-6 max-w-4xl mx-auto animate-in zoom-in-95 duration-200">
          <div className="bg-[#F0F5F4] px-5 py-3.5 border-b border-[#D4E4E3] flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-[#EF4444]" size={16} />
              <h3 className="font-bold text-[13px] sm:text-[14px] text-[#2D4A49]">
                บันทึกของเสียใหม่ (New Waste Entry)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F3F2] text-[#5A8A88] border border-[#D4E4E3] ml-1">
                {wasteItems.length} รายการ
              </span>
            </div>
            <button 
              type="button" 
              onClick={handleCloseForm} 
              className="text-[#6B8F8E] hover:bg-[#E8F3F2] hover:text-[#2D4A49] p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
            {/* Common Date Header & Quick Add */}
            <div className="bg-[#F8FAFA] p-3 rounded-xl border border-[#E2EAE9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <label className="text-[11px] font-semibold text-[#6B8F8E] uppercase tracking-wider min-w-max">
                  📅 วันที่ (Date):
                </label>
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-[#D4E4E3] rounded-lg text-[12px] font-semibold text-[#2D4A49] focus:ring-2 focus:ring-[#5A8A88]/20 outline-none transition-all shadow-xs"
                />
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-[#5A8A88] hover:bg-[#4A7A78] shadow-xs transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>เพิ่มรายการของเสีย</span>
              </button>
            </div>

            {/* List of Items */}
            <div className="space-y-3.5">
              {wasteItems.map((item, index) => {
                const itemUnit = getItemUnit(item.ingredientId);
                return (
                  <div 
                    key={item.tempId} 
                    className="p-3.5 sm:p-4 rounded-xl border border-[#D4E4E3] bg-white shadow-xs relative"
                  >
                    {/* Item Card Header */}
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#F0F5F4]">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FEE2E2] text-[#EF4444] border border-[#FECACA]">
                          รายการที่ {index + 1}
                        </span>
                        <span className="text-[11px] text-[#A8BCBB] font-normal hidden sm:inline">
                          (ระบุสาเหตุและวิธีแก้ไขปัญหาแยกเฉพาะรายการนี้)
                        </span>
                      </div>

                      {wasteItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.tempId)}
                          className="flex items-center gap-1 text-[11px] font-medium text-[#EF4444] hover:bg-[#FEE2E2] px-2 py-1 rounded-md transition-colors cursor-pointer"
                          title="ลบรายการนี้"
                        >
                          <Trash2 size={13} />
                          <span>ลบรายการนี้</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* Left: Item selection, quantity, and photo */}
                      <div className="space-y-2.5">
                        <div>
                          {department === 'Bakery' ? (
                            <>
                              <label className="block text-[10px] font-semibold text-[#6B8F8E] tracking-wider uppercase mb-1">
                                รายการสัญจรจากแผนงานเบเกอรี่ (Bakery Product) <span className="text-[#EF4444]">*</span>
                              </label>
                              <select
                                required
                                value={item.ingredientId}
                                onChange={e => handleItemChange(item.tempId, 'ingredientId', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88]/20 outline-none text-[12px] font-medium text-[#2D4A49] transition-all cursor-pointer"
                              >
                                <option value="" className="text-slate-500 font-bold">--เลือก ชนิดแป้ง, รายการ, หรือ เมนู--</option>
                                
                                {bakeryOptions.types && bakeryOptions.types.length > 0 && (
                                  <optgroup label="🥖 ชนิดแป้ง (Type)" className="font-bold text-[11px] text-[#5A8A88]">
                                    {bakeryOptions.types.map(opt => (
                                      <option key={opt.id} value={opt.id} className="text-[#2D4A49]">
                                        {opt.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}

                                {bakeryOptions.targets && bakeryOptions.targets.length > 0 && (
                                  <optgroup label="🥞 รายการ (Target Item)" className="font-bold text-[11px] text-[#22C55E]">
                                    {bakeryOptions.targets.map(opt => (
                                      <option key={opt.id} value={opt.id} className="text-[#2D4A49]">
                                        {opt.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}

                                {bakeryOptions.menus && bakeryOptions.menus.length > 0 && (
                                  <optgroup label="🧁 เมนู (Menu)" className="font-bold text-[11px] text-[#3B82F6]">
                                    {bakeryOptions.menus.map(opt => (
                                      <option key={opt.id} value={opt.id} className="text-[#2D4A49]">
                                        {opt.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}

                                {deptIngredients && deptIngredients.length > 0 && (
                                  <optgroup label="📦 วัตถุดิบในครัว/เบเกอรี่ (Ingredients)" className="font-bold text-[11px] text-[#6B8F8E]">
                                    {deptIngredients.map(ing => (
                                      <option key={ing.id} value={ing.id} className="text-[#2D4A49]">
                                        {ing.name} {ing.brand ? `(${ing.brand})` : ''}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </>
                          ) : (
                            <>
                              <label className="block text-[10px] font-semibold text-[#6B8F8E] tracking-wider uppercase mb-1">
                                รายการ (Item) <span className="text-[#EF4444]">*</span>
                              </label>
                              <select
                                required
                                value={item.ingredientId}
                                onChange={e => handleItemChange(item.tempId, 'ingredientId', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88]/20 outline-none text-[12px] font-medium text-[#2D4A49] transition-all cursor-pointer"
                              >
                                <option value="" className="text-slate-500">-- เลือกรายการ --</option>
                                {deptIngredients.map(ing => (
                                  <option key={ing.id} value={ing.id} className="text-xs">{ing.name} {ing.brand ? `(${ing.brand})` : ''}</option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-[#6B8F8E] tracking-wider uppercase mb-1">
                              จำนวนที่เสีย <span className="text-[#EF4444]">*</span>
                            </label>
                            <input
                              type="number"
                              required
                              min="0.01"
                              step="any"
                              value={item.quantity}
                              onChange={e => handleItemChange(item.tempId, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 bg-white border border-[#D4E4E3] rounded-lg text-[12px] focus:ring-2 focus:ring-[#5A8A88]/20 outline-none font-bold text-[#2D4A49] transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-[#6B8F8E] tracking-wider uppercase mb-1">
                              หน่วยนับ
                            </label>
                            <input
                              type="text"
                              readOnly
                              value={itemUnit}
                              className="w-full px-2.5 py-1.5 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg text-[12px] text-[#6B8F8E] font-semibold text-center cursor-not-allowed uppercase"
                            />
                          </div>
                        </div>

                        {/* Photo attachment for this item */}
                        <div>
                          <label className="block text-[10px] font-semibold text-[#6B8F8E] tracking-wider uppercase mb-1">
                            📷 แนบรูปภาพของเสีย (ไม่บังคับ)
                          </label>
                          
                          {item.imageUrl ? (
                            <div className="relative inline-block border border-[#D4E4E3] rounded-xl overflow-hidden shadow-xs group">
                              <img src={item.imageUrl} alt="Waste preview" className="w-20 h-20 object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemImage(item.tempId)}
                                  className="bg-white text-[#EF4444] rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <X size={12} /> ลบรูป
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-row gap-2 items-stretch">
                              <button
                                type="button"
                                onClick={() => document.getElementById(`camera-input-${item.tempId}`)?.click()}
                                className="flex-1 py-1.5 px-2 border border-dashed border-[#D4E4E3] rounded-lg bg-[#F8FAFA] hover:bg-[#E8F3F2] cursor-pointer transition-all text-[#5A8A88] flex items-center justify-center gap-1.5 text-[11px] font-medium"
                              >
                                <Camera size={13} className="text-[#5A8A88]" />
                                <span>ถ่ายภาพ</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => document.getElementById(`file-input-${item.tempId}`)?.click()}
                                className="flex-1 py-1.5 px-2 border border-dashed border-[#D4E4E3] rounded-lg bg-[#F8FAFA] hover:bg-[#E8F3F2] cursor-pointer transition-all text-[#5A8A88] flex items-center justify-center gap-1.5 text-[11px] font-medium"
                              >
                                <Upload size={13} className="text-[#5A8A88]" />
                                <span>อัปโหลดรูป</span>
                              </button>
                            </div>
                          )}

                          <input 
                            id={`camera-input-${item.tempId}`}
                            type="file" 
                            accept="image/*"
                            capture="environment"
                            className="hidden" 
                            onChange={e => handleItemImageUpload(item.tempId, e)}
                          />
                          <input 
                            id={`file-input-${item.tempId}`}
                            type="file" 
                            accept="image/*"
                            className="hidden" 
                            onChange={e => handleItemImageUpload(item.tempId, e)}
                          />
                        </div>
                      </div>

                      {/* Right: Cause and Solution specific to this item */}
                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-[#6B8F8E] tracking-wider uppercase mb-1">
                            สาเหตุ (Cause)
                          </label>
                          <textarea
                            rows={3}
                            placeholder="ระบุสาเหตุ เช่น หมดอายุ, ตกหล่น, ชำรุด, อบไหม้ (หรือใส่ -)"
                            value={item.cause}
                            onChange={e => handleItemChange(item.tempId, 'cause', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-[#F8FAFA] border border-[#D4E4E3] rounded-lg text-[11px] text-[#2D4A49] focus:ring-2 focus:ring-[#5A8A88]/20 outline-none resize-none transition-all"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-[10px] font-semibold text-[#6B8F8E] tracking-wider uppercase mb-1">
                            วิธีแก้ไขปัญหา (Solution / Action Taken) <span className="text-[#A8BCBB] font-normal">(ไม่บังคับ)</span>
                          </label>
                          <textarea
                            rows={3}
                            placeholder="วิธีการที่ใช้แก้ไขปัญหาในครั้งนี้ (หากไม่มีสามารถเว้นว่างได้)"
                            value={item.solution}
                            onChange={e => handleItemChange(item.tempId, 'solution', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-[#F8FAFA] border border-[#D4E4E3] rounded-lg text-[11px] text-[#2D4A49] focus:ring-2 focus:ring-[#5A8A88]/20 outline-none resize-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add More Items Button */}
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-2.5 border border-dashed border-[#5A8A88] bg-[#E8F3F2]/50 text-[#5A8A88] hover:bg-[#E8F3F2] rounded-xl font-semibold text-[12px] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>เพิ่มรายการของเสียอีกรายการ (+ Add Another Item)</span>
            </button>

            {formError && (
              <div className="p-2.5 bg-[#FEE2E2] border border-[#FECACA] rounded-xl flex items-center gap-2 text-[11px] text-[#EF4444] font-semibold">
                <AlertCircle size={15} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-[#F0F5F4] pt-3">
              <div className="text-[11px] font-medium text-[#6B8F8E]">
                รวมทั้งหมด <span className="text-[#2D4A49] font-bold">{wasteItems.length}</span> รายการ
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  disabled={isSaving}
                  className="px-4 py-2 text-[#6B8F8E] font-medium hover:bg-[#F0F5F4] rounded-lg text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-white font-semibold rounded-lg text-[11px] bg-[#2D4A49] hover:bg-[#1D3A39] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>กำลังบันทึกข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>บันทึกรายการของเสีย ({wasteItems.length} รายการ)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Success Banner */}
      {saveSuccessMsg && (
        <div className="p-3.5 bg-[#DCFCE7] border border-[#BBF7D0] rounded-xl flex items-center justify-between gap-2 text-[12px] text-[#16A34A] font-semibold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#16A34A] shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-[#16A34A] hover:opacity-75">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION CARD: "ประวัติบันทึกของเสียล่าสุด"
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-2xl border border-[#D4E4E3] p-5 shadow-[0_2px_8px_rgba(90,138,136,0.08)]">
        {/* Card header row */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#F0F5F4]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#FEE2E2] flex items-center justify-center shrink-0">
              <Trash2 size={16} className="text-[#EF4444]" />
            </div>
            <h3 className="text-[13px] font-semibold text-[#2D4A49]">
              ประวัติบันทึกของเสียล่าสุด
            </h3>
          </div>

          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            title="รีเฟรชข้อมูล (Sync with Supabase)"
            className="p-2 bg-white border border-[#D4E4E3] rounded-lg text-[#5A8A88] hover:bg-[#E8F3F2] transition-colors disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
          >
            <RefreshCw size={14} className={cn("text-[#5A8A88]", loading && "animate-spin")} />
          </button>
        </div>
        
        {/* Waste Record Cards */}
        {loading && deptLogs.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center">
            <Loader2 className="text-[#5A8A88] animate-spin mb-2" size={24} />
            <p className="text-[#6B8F8E] text-[12px]">กำลังโหลดข้อมูลประวัติของเสียล่าสุด...</p>
          </div>
        ) : deptLogs.length > 0 ? (
          <div className="space-y-3">
            {deptLogs.map(log => (
              <div 
                key={log.id} 
                className="bg-white border border-[#D4E4E3] rounded-xl p-4 shadow-[0_1px_4px_rgba(90,138,136,0.06)] hover:shadow-md hover:bg-[#FAFCFC] transition-all cursor-pointer"
                onClick={() => handleOpenLogDetail(log)}
              >
                <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-4">
                  {/* Left — Image (80px x 80px) */}
                  {log.imageUrl ? (
                    <img 
                      src={log.imageUrl} 
                      alt="Waste item" 
                      className="w-[80px] h-[80px] object-cover rounded-lg border border-[#D4E4E3] shrink-0 bg-[#F0F5F4] cursor-zoom-in hover:opacity-90" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(log.imageUrl || null);
                      }}
                    />
                  ) : (
                    <div className="w-[80px] h-[80px] rounded-lg border border-[#D4E4E3] bg-[#F0F5F4] flex items-center justify-center shrink-0">
                      <Trash2 className="text-[#A8BCBB]" size={24} />
                    </div>
                  )}
                  
                  {/* Right — Content */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1 — Name + Date */}
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <h4 className="text-[13px] font-bold text-[#2D4A49] truncate">
                        {log.ingredientName}
                      </h4>
                      <span className="text-[11px] text-[#6B8F8E] bg-[#F0F5F4] rounded-md px-2 py-0.5 border border-[#E2EAE9]">
                        {format(new Date(log.date), 'dd/MM/yyyy')}
                      </span>
                    </div>

                    {/* Row 2 — Quantity badge + Recorded by */}
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[#6B8F8E]">จำนวน:</span>
                        <span className="text-[12px] font-bold text-[#EF4444] bg-[#FEE2E2] rounded-md px-2 py-0.5 border border-[#FECACA]">
                          {log.quantity} {log.unit}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#A8BCBB]">
                        ผู้บันทึก: {log.recorderName}
                      </span>
                    </div>
                    
                    {/* Row 3 — Detail grid (2 columns) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <div className="bg-[#F8FAFA] border border-[#E2EAE9] rounded-lg p-2.5">
                        <span className="text-[10px] font-semibold text-[#6B8F8E] uppercase tracking-[0.05em] block mb-1">
                          สาเหตุ
                        </span>
                        <p className="text-[11px] text-[#2D4A49] leading-[1.4] line-clamp-2">
                          {log.cause || '-'}
                        </p>
                      </div>
                      <div className="bg-[#F8FAFA] border border-[#E2EAE9] rounded-lg p-2.5">
                        <span className="text-[10px] font-semibold text-[#6B8F8E] uppercase tracking-[0.05em] block mb-1">
                          วิธีการแก้ไขปัญหา
                        </span>
                        <p className="text-[11px] text-[#2D4A49] leading-[1.4] line-clamp-2">
                          {log.solution || '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-14 text-center flex flex-col items-center">
            <div className="w-14 h-14 bg-[#F0F5F4] rounded-full flex items-center justify-center mb-3">
              <AlertCircle className="text-[#A8BCBB]" size={28} />
            </div>
            <h4 className="text-[#2D4A49] font-bold text-[14px] mb-0.5">ยังไม่มีประวัติของเสีย</h4>
            <p className="text-[#6B8F8E] text-[11px]">บันทึกของเสียเมื่อมีสินค้าที่เสียหาย</p>
          </div>
        )}
      </div>

      {/* Enlarged Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-transparent rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors z-10 cursor-pointer"
              title="ปิด"
            >
              <X size={20} />
            </button>
            <img 
              src={selectedImage} 
              alt="Enlarged waste item" 
              className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

      {/* Detail / Edit Modal */}
      {activeSelectedLog && (
        <div 
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={handleCloseLogDetail}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 border border-[#D4E4E3]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[#D4E4E3] px-5 py-3.5 flex items-center justify-between z-10">
              <h3 className="text-[15px] font-bold text-[#2D4A49]">รายละเอียดรายการของเสีย</h3>
              <button 
                onClick={handleCloseLogDetail}
                className="p-1.5 hover:bg-[#F0F5F4] rounded-lg transition-colors text-[#6B8F8E] hover:text-[#2D4A49] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                {activeSelectedLog.imageUrl && (
                  <div className="w-full md:w-1/3 shrink-0">
                    <img 
                      src={activeSelectedLog.imageUrl} 
                      alt="Waste item" 
                      className="w-full h-auto aspect-square object-cover rounded-xl border border-[#D4E4E3] cursor-zoom-in" 
                      onClick={() => setSelectedImage(activeSelectedLog.imageUrl || null)}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="text-[16px] font-bold text-[#2D4A49]">{activeSelectedLog.ingredientName}</h4>
                    <div className="mt-1">
                      <span className="text-[12px] text-[#EF4444] font-bold bg-[#FEE2E2] px-2 py-0.5 rounded-md border border-[#FECACA]">
                        เสียหาย: {activeSelectedLog.quantity} {activeSelectedLog.unit}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-[12px] bg-[#F8FAFA] p-3 rounded-xl border border-[#E2EAE9]">
                    <div>
                      <span className="text-[#6B8F8E] block text-[10px] uppercase font-semibold mb-0.5">วันที่บันทึก</span>
                      <span className="font-semibold text-[#2D4A49]">{format(new Date(activeSelectedLog.date), 'dd/MM/yyyy')}</span>
                    </div>
                    <div>
                      <span className="text-[#6B8F8E] block text-[10px] uppercase font-semibold mb-0.5">ผู้บันทึก</span>
                      <span className="font-semibold text-[#2D4A49]">{activeSelectedLog.recorderName}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="bg-[#F8FAFA] border border-[#E2EAE9] p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-[#EF4444] uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> สาเหตุที่เสียหาย
                  </span>
                  {isEditing ? (
                    <textarea 
                      value={editFormData.cause}
                      onChange={(e) => setEditFormData({ ...editFormData, cause: e.target.value })}
                      placeholder="ระบุสาเหตุที่เสียหาย"
                      className="w-full bg-white border border-[#D4E4E3] rounded-lg p-2 text-[#2D4A49] outline-none focus:ring-2 focus:ring-[#5A8A88]/20 min-h-[70px] text-[12px]"
                    />
                  ) : (
                    <p className="text-[#2D4A49] whitespace-pre-wrap text-[12px] leading-relaxed">{activeSelectedLog.cause || '-'}</p>
                  )}
                </div>
                
                <div className="bg-[#E8F3F2]/50 border border-[#D4E4E3] p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-[#5A8A88] uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <Save size={14} /> วิธีการแก้ไขปัญหา
                  </span>
                  {isEditing ? (
                    <textarea 
                      value={editFormData.solution}
                      onChange={(e) => setEditFormData({ ...editFormData, solution: e.target.value })}
                      placeholder="ระบุวิธีการแก้ไขปัญหา"
                      className="w-full bg-white border border-[#D4E4E3] rounded-lg p-2 text-[#2D4A49] outline-none focus:ring-2 focus:ring-[#5A8A88]/20 min-h-[70px] text-[12px]"
                    />
                  ) : (
                    <p className="text-[#2D4A49] whitespace-pre-wrap text-[12px] leading-relaxed">{activeSelectedLog.solution || '-'}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-[#F0F5F4] border-t border-[#D4E4E3] px-5 py-3 flex justify-end gap-2.5">
              {isEditing ? (
                <>
                  <button 
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2 bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] text-[#6B8F8E] font-medium rounded-lg text-[11px] transition-colors cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-[#5A8A88] hover:bg-[#4A7A78] text-white font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                  >
                    บันทึก
                  </button>
                </>
              ) : (
                <>
                  {onUpdate && (
                    <button 
                      type="button"
                      onClick={handleStartEdit}
                      className="px-4 py-2 bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] text-[#2D4A49] font-medium rounded-lg text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 size={13} />
                      <span>แก้ไข</span>
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={handleCloseLogDetail}
                    className="px-4 py-2 bg-[#D4E4E3] hover:bg-[#C2D8D6] text-[#2D4A49] font-medium rounded-lg text-[11px] transition-colors cursor-pointer"
                  >
                    ปิด
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
