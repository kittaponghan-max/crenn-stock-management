import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Ingredient, WasteLogEntry } from '../types';
import { format } from 'date-fns';
import { Trash2, Plus, X, Upload, Save, AlertTriangle, AlertCircle, Camera, Edit2, CheckCircle2, Loader2 } from 'lucide-react';
import { cn, generateUUID } from '../lib/utils';

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

  // Always resolve the freshest log from wasteLogs state
  const activeSelectedLog = useMemo(() => {
    if (!selectedLog) return null;
    return wasteLogs.find(l => l.id === selectedLog.id) || selectedLog;
  }, [selectedLog, wasteLogs]);

  // Keep editFormData strictly in sync with the selected item and reset edit mode on item change
  useEffect(() => {
    if (selectedLog) {
      const current = wasteLogs.find(l => l.id === selectedLog.id) || selectedLog;
      setEditFormData({
        cause: current.cause || '',
        solution: current.solution || ''
      });
      setIsEditing(false);
    }
  }, [selectedLog?.id]);

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
    return wasteLogs
      .filter(log => log.department === department || (department === 'Bakery' && log.department === 'Kitchen'))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [wasteLogs, department]);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <button onClick={onBack} className="text-slate-500 hover:text-slate-800 font-medium mb-2 flex items-center gap-2">
            ← ย้อนกลับหน้าหลัก
          </button>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Trash2 className={department === 'Bar' ? 'text-red-500' : 'text-orange-500'} size={28} />
            รายงานบันทึกของเสีย ({department === 'Bar' ? 'บาร์' : 'ครัว'})
          </h2>
          <p className="text-slate-500 mt-1">
            บันทึกและตรวจสอบประวัติวัตถุดิบ/สินค้าที่เสียหาย
          </p>
        </div>
        
        <button
          onClick={handleOpenForm}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium shadow-md hover:shadow-lg transition-all cursor-pointer ${
            department === 'Bar' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
          }`}
        >
          <Plus size={20} />
          เพิ่มรายการของเสีย
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden mb-8 max-w-4xl mx-auto animate-in zoom-in-95 duration-200">
          <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200/80 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertTriangle className={department === 'Bar' ? 'text-red-500' : 'text-amber-500'} size={18} />
              <h3 className="font-bold text-sm sm:text-base text-slate-800">
                บันทึกของเสียใหม่ (New Waste Entry)
              </h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 ml-1">
                {wasteItems.length} รายการ
              </span>
            </div>
            <button 
              type="button" 
              onClick={handleCloseForm} 
              className="text-slate-400 hover:bg-slate-200 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
            {/* Common Date Header & Quick Add */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-600 tracking-wider uppercase min-w-max">
                  📅 วันที่ (Date):
                </label>
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500/25 outline-none transition-all shadow-sm"
                />
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-all cursor-pointer ${
                  department === 'Bar' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                <Plus size={15} />
                เพิ่มรายการของเสีย
              </button>
            </div>

            {/* List of Items */}
            <div className="space-y-4">
              {wasteItems.map((item, index) => {
                const itemUnit = getItemUnit(item.ingredientId);
                return (
                  <div 
                    key={item.tempId} 
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-slate-300 transition-all relative"
                  >
                    {/* Item Card Header */}
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                          department === 'Bar' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          รายการที่ {index + 1}
                        </span>
                        <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                          (สาเหตุและวิธีแก้ไขปัญหาแยกเฉพาะรายการนี้)
                        </span>
                      </div>

                      {wasteItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.tempId)}
                          className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          title="ลบรายการนี้"
                        >
                          <Trash2 size={14} />
                          <span>ลบรายการนี้</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Item selection, quantity, and photo */}
                      <div className="space-y-3">
                        <div>
                          {department === 'Bakery' ? (
                            <>
                              <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">
                                รายการสัญจรจากแผนงานเบเกอรี่ (Bakery Product) <span className="text-red-500">*</span>
                              </label>
                              <select
                                required
                                value={item.ingredientId}
                                onChange={e => handleItemChange(item.tempId, 'ingredientId', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-amber-50/30 border border-amber-300/80 rounded-lg focus:ring-2 focus:ring-orange-500/25 outline-none text-xs md:text-sm font-semibold text-slate-800 transition-all cursor-pointer"
                              >
                                <option value="" className="text-slate-500 font-bold">--เลือก ชนิดแป้ง, รายการ, หรือ เมนู--</option>
                                
                                {bakeryOptions.types && bakeryOptions.types.length > 0 && (
                                  <optgroup label="🥖 ชนิดแป้ง (Type)" className="font-bold text-[11.5px] text-amber-700 bg-amber-50/40">
                                    {bakeryOptions.types.map(opt => (
                                      <option key={opt.id} value={opt.id} className="text-slate-800 font-medium text-xs">
                                        {opt.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}

                                {bakeryOptions.targets && bakeryOptions.targets.length > 0 && (
                                  <optgroup label="🥞 รายการ (Target Item)" className="font-bold text-[11.5px] text-emerald-700 bg-emerald-50/40">
                                    {bakeryOptions.targets.map(opt => (
                                      <option key={opt.id} value={opt.id} className="text-slate-800 font-medium text-xs">
                                        {opt.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}

                                {bakeryOptions.menus && bakeryOptions.menus.length > 0 && (
                                  <optgroup label="🧁 เมนู (Menu)" className="font-bold text-[11.5px] text-blue-700 bg-blue-50/40">
                                    {bakeryOptions.menus.map(opt => (
                                      <option key={opt.id} value={opt.id} className="text-slate-800 font-medium text-xs">
                                        {opt.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}

                                {deptIngredients && deptIngredients.length > 0 && (
                                  <optgroup label="📦 วัตถุดิบในครัว/เบเกอรี่ (Ingredients)" className="font-bold text-[11.5px] text-slate-700 bg-slate-100/70">
                                    {deptIngredients.map(ing => (
                                      <option key={ing.id} value={ing.id} className="text-slate-800 font-medium text-xs">
                                        {ing.name} {ing.brand ? `(${ing.brand})` : ''}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </>
                          ) : (
                            <>
                              <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">
                                รายการ (Item) <span className="text-red-500">*</span>
                              </label>
                              <select
                                required
                                value={item.ingredientId}
                                onChange={e => handleItemChange(item.tempId, 'ingredientId', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/25 outline-none text-xs md:text-sm font-semibold text-slate-800 transition-all cursor-pointer"
                              >
                                <option value="" className="text-slate-500">-- เลือกรายการ --</option>
                                {deptIngredients.map(ing => (
                                  <option key={ing.id} value={ing.id} className="text-xs">{ing.name} {ing.brand ? `(${ing.brand})` : ''}</option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">
                              จำนวนที่เสีย <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              required
                              min="0.01"
                              step="any"
                              value={item.quantity}
                              onChange={e => handleItemChange(item.tempId, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-orange-500/25 outline-none font-bold font-mono transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">
                              หน่วยนับ
                            </label>
                            <input
                              type="text"
                              readOnly
                              value={itemUnit}
                              className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs md:text-sm text-slate-600 font-bold text-center cursor-not-allowed uppercase"
                            />
                          </div>
                        </div>

                        {/* Photo attachment for this item */}
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1.5 flex items-center gap-1.5">
                            📷 แนบรูปภาพของเสีย (ออฟชั่น)
                          </label>
                          
                          {item.imageUrl ? (
                            <div className="relative inline-block border border-slate-200 rounded-xl overflow-hidden shadow-sm group">
                              <img src={item.imageUrl} alt="Waste preview" className="w-24 h-24 object-cover" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemImage(item.tempId)}
                                  className="bg-white/95 hover:bg-white text-red-600 shadow-md rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 duration-150 cursor-pointer"
                                >
                                  <X size={13} /> ลบรูป
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveItemImage(item.tempId)}
                                className="absolute -top-1 -right-1 bg-red-500 text-white shadow-md rounded-full p-1 hover:bg-red-700 transition-colors md:hidden cursor-pointer"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-row gap-2 items-stretch">
                              <button
                                type="button"
                                onClick={() => document.getElementById(`camera-input-${item.tempId}`)?.click()}
                                className="flex-1 py-2 px-2.5 border border-dashed border-amber-300 rounded-xl bg-amber-50/20 hover:bg-amber-50/50 cursor-pointer transition-all text-amber-800 flex items-center justify-center gap-1.5 outline-none hover:scale-[1.01] active:scale-95 duration-150"
                              >
                                <Camera size={14} className="text-amber-600" />
                                <span className="text-[11px] font-bold">ถ่ายภาพ</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => document.getElementById(`file-input-${item.tempId}`)?.click()}
                                className="flex-1 py-2 px-2.5 border border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-all text-slate-700 flex items-center justify-center gap-1.5 outline-none hover:scale-[1.01] active:scale-95 duration-150"
                              >
                                <Upload size={14} className="text-slate-500" />
                                <span className="text-[11px] font-bold">อัปโหลดรูป</span>
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
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">
                            สาเหตุ (Cause)
                          </label>
                          <textarea
                            rows={3}
                            placeholder="ระบุสาเหตุ เช่น หมดอายุ, ตกหล่น, ชำรุด, อบไหม้ (หรือใส่ -)"
                            value={item.cause}
                            onChange={e => handleItemChange(item.tempId, 'cause', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-orange-500/25 outline-none resize-none transition-all"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">
                            วิธีแก้ไขปัญหา (Solution / Action Taken) <span className="text-slate-400 font-normal text-[10px]">(ไม่บังคับ)</span>
                          </label>
                          <textarea
                            rows={3}
                            placeholder="วิธีการที่ใช้แก้ไขปัญหาในครั้งนี้ (หากไม่มีสามารถเว้นว่างได้)"
                            value={item.solution}
                            onChange={e => handleItemChange(item.tempId, 'solution', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-orange-500/25 outline-none resize-none transition-all"
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
              className={`w-full py-3 border-2 border-dashed rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow ${
                department === 'Bar'
                  ? 'border-red-200 bg-red-50/30 text-red-600 hover:bg-red-50/60 hover:border-red-400'
                  : 'border-orange-200 bg-orange-50/30 text-orange-600 hover:bg-orange-50/60 hover:border-orange-400'
              }`}
            >
              <Plus size={18} />
              <span>เพิ่มรายการของเสียอีกรายการ (+ Add Another Item)</span>
            </button>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs md:text-sm text-red-700 font-bold">
                <AlertCircle size={18} className="text-red-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-slate-100 pt-4">
              <div className="text-xs font-bold text-slate-500">
                รวมทั้งหมด <span className="text-slate-800 font-black">{wasteItems.length}</span> รายการ
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  disabled={isSaving}
                  className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl text-xs md:text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-5 py-2.5 text-white font-bold rounded-xl text-xs md:text-sm transition-all flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    department === 'Bar' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-900'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>กำลังบันทึกข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
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
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-sm text-emerald-800 font-bold shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800">
            <X size={18} />
          </button>
        </div>
      )}

      {/* History List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <Trash2 size={18} className="text-slate-500" />
          <h3 className="font-bold text-slate-800">ประวัติบันทึกของเสียล่าสุด</h3>
        </div>
        
        {deptLogs.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {deptLogs.map(log => (
              <div 
                key={log.id} 
                className="p-4 sm:p-6 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => handleOpenLogDetail(log)}
              >
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                  {log.imageUrl ? (
                    <img 
                      src={log.imageUrl} 
                      alt="Waste item" 
                      className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-xl border border-slate-200 shrink-0 bg-slate-100 cursor-zoom-in hover:opacity-90" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(log.imageUrl || null);
                      }}
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                      <Trash2 className="text-slate-300" size={32} />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-lg font-bold text-slate-800 truncate">{log.ingredientName}</h4>
                        <div className="text-sm font-medium text-slate-500 mt-1">
                          จำนวน: <span className="text-red-600 font-bold">{log.quantity} {log.unit}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                          {format(new Date(log.date), 'dd/MM/yyyy')}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          ผู้บันทึก: {log.recorderName}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">สาเหตุ</span>
                        <p className="text-sm text-slate-700 line-clamp-2">{log.cause}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">วิธีการแก้ไขปัญหา</span>
                        <p className="text-sm text-slate-700 line-clamp-2">{log.solution}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="text-slate-300" size={32} />
            </div>
            <h4 className="text-slate-800 font-bold mb-1">ยังไม่มีประวัติของเสีย</h4>
            <p className="text-slate-500 text-sm">บันทึกของเสียเมื่อมีสินค้าที่เสียหาย</p>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-transparent rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors z-10"
              title="ปิด"
            >
              <X size={24} />
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

      {/* Detail Modal */}
      {activeSelectedLog && (
        <div 
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={handleCloseLogDetail}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-slate-800">รายละเอียดรายการของเสีย</h3>
              <button 
                onClick={handleCloseLogDetail}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                {activeSelectedLog.imageUrl && (
                  <div className="w-full md:w-1/3 shrink-0">
                    <img 
                      src={activeSelectedLog.imageUrl} 
                      alt="Waste item" 
                      className="w-full h-auto aspect-square object-cover rounded-xl border border-slate-200 cursor-zoom-in" 
                      onClick={() => setSelectedImage(activeSelectedLog.imageUrl || null)}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-4">
                  <div>
                    <h4 className="text-xl font-bold text-slate-800">{activeSelectedLog.ingredientName}</h4>
                    <div className="text-slate-500 font-medium flex items-center gap-2 mt-1">
                      <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-md">
                        เสียหาย: {activeSelectedLog.quantity} {activeSelectedLog.unit}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl">
                    <div>
                      <span className="text-slate-500 block mb-1">วันที่บันทึก</span>
                      <span className="font-semibold text-slate-800">{format(new Date(activeSelectedLog.date), 'dd/MM/yyyy')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">ผู้บันทึก</span>
                      <span className="font-semibold text-slate-800">{activeSelectedLog.recorderName}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
                  <span className="text-sm font-bold text-orange-800 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={16} /> สาเหตุที่เสียหาย
                  </span>
                  {isEditing ? (
                    <textarea 
                      value={editFormData.cause}
                      onChange={(e) => setEditFormData({ ...editFormData, cause: e.target.value })}
                      placeholder="ระบุสาเหตุที่เสียหาย"
                      className="w-full bg-white border border-orange-200 rounded-lg p-2.5 text-slate-700 outline-none focus:ring-2 focus:ring-orange-500/50 min-h-[80px] text-sm"
                    />
                  ) : (
                    <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{activeSelectedLog.cause || '-'}</p>
                  )}
                </div>
                
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                  <span className="text-sm font-bold text-blue-800 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <Save size={16} /> วิธีการแก้ไขปัญหา
                  </span>
                  {isEditing ? (
                    <textarea 
                      value={editFormData.solution}
                      onChange={(e) => setEditFormData({ ...editFormData, solution: e.target.value })}
                      placeholder="ระบุวิธีการแก้ไขปัญหา"
                      className="w-full bg-white border border-blue-200 rounded-lg p-2.5 text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[80px] text-sm"
                    />
                  ) : (
                    <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{activeSelectedLog.solution || '-'}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
              {isEditing ? (
                <>
                  <button 
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
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
                      className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Edit2 size={16} />
                      แก้ไข
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={handleCloseLogDetail}
                    className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
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
