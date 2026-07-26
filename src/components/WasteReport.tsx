import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Ingredient, WasteLogEntry } from '../types';
import { format } from 'date-fns';
import { Trash2, Plus, X, Upload, Save, AlertTriangle, AlertCircle, Camera, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface WasteReportProps {
  department: 'Bar' | 'Bakery';
  ingredients: Ingredient[];
  wasteLogs: WasteLogEntry[];
  currentUser: string;
  onSave: (log: Omit<WasteLogEntry, 'id' | 'timestamp'>) => void;
  onUpdate?: (id: string, updates: Partial<WasteLogEntry>) => void;
  onBack: () => void;
}

export function WasteReport({ department, ingredients, wasteLogs, currentUser, onSave, onUpdate, onBack }: WasteReportProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<WasteLogEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ cause: '', solution: '' });
  const [formData, setFormData] = useState<{
    date: string;
    ingredientId: string;
    quantity: number;
    cause: string;
    solution: string;
    imageUrl: string;
  }>({
    date: format(new Date(), 'yyyy-MM-dd'),
    ingredientId: '',
    quantity: 1,
    cause: '',
    solution: '',
    imageUrl: ''
  });
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
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
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setFormData(prev => ({ ...prev, imageUrl: compressedDataUrl }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const selectedUnit = useMemo(() => {
    if (department === 'Bakery') {
      const id = formData.ingredientId;
      const matchType = bakeryOptions.types?.find(t => t.id === id);
      const matchTarget = bakeryOptions.targets?.find(t => t.id === id);
      const matchMenu = bakeryOptions.menus?.find(t => t.id === id);
      if (matchType) return matchType.unit;
      if (matchTarget) return matchTarget.unit;
      if (matchMenu) return matchMenu.unit;
    }
    const ingredient = ingredients.find(i => i.id === formData.ingredientId);
    return ingredient?.unit || '-';
  }, [formData.ingredientId, department, bakeryOptions, ingredients]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let id = formData.ingredientId;
    let name = '';
    let unit = '-';

    if (department === 'Bakery') {
      const matchType = bakeryOptions.types?.find(t => t.id === id);
      const matchTarget = bakeryOptions.targets?.find(t => t.id === id);
      const matchMenu = bakeryOptions.menus?.find(t => t.id === id);

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
        const ingredient = ingredients.find(i => i.id === id);
        if (ingredient) {
          name = ingredient.name;
          unit = ingredient.unit;
        }
      }
    } else {
      const ingredient = ingredients.find(i => i.id === id);
      if (!ingredient) return;
      name = ingredient.name;
      unit = ingredient.unit;
    }

    if (!name) return;

    onSave({
      date: formData.date,
      department,
      ingredientId: id,
      ingredientName: name,
      quantity: formData.quantity,
      unit: unit,
      cause: formData.cause,
      solution: formData.solution,
      imageUrl: formData.imageUrl,
      recorderName: currentUser
    });

    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      ingredientId: '',
      quantity: 1,
      cause: '',
      solution: '',
      imageUrl: ''
    });
    setIsFormOpen(false);
  };

  const selectedIngredient = ingredients.find(i => i.id === formData.ingredientId);

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
          onClick={() => setIsFormOpen(true)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium shadow-md hover:shadow-lg transition-all ${
            department === 'Bar' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
          }`}
        >
          <Plus size={20} />
          เพิ่มรายการของเสีย
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-xl shadow-xl border border-slate-200/80 overflow-hidden mb-8 max-w-3xl mx-auto animate-in zoom-in-95 duration-200">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200/60 flex justify-between items-center">
            <h3 className="font-bold text-[14px] text-slate-800 flex items-center gap-1.5">
              <AlertTriangle className="text-amber-500" size={16} />
              บันทึกของเสียใหม่ (New Waste Entry)
            </h3>
            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-md transition-colors cursor-pointer">
              <X size={16} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">วันที่ (Date)</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-orange-500/25 outline-none font-medium transition-all"
                  />
                </div>
                
                <div>
                  {department === 'Bakery' ? (
                    <>
                      <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">รายการสัญจรจากแผนงานเบเกอรี่ (Bakery Product)</label>
                      <select
                        required
                        value={formData.ingredientId}
                        onChange={e => setFormData({ ...formData, ingredientId: e.target.value })}
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
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">รายการ (Item)</label>
                      <select
                        required
                        value={formData.ingredientId}
                        onChange={e => setFormData({ ...formData, ingredientId: e.target.value })}
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
                    <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">จำนวนที่เสีย</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      value={formData.quantity}
                      onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-orange-500/25 outline-none font-bold font-mono transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">หน่วยนับ</label>
                    <input
                      type="text"
                      readOnly
                      value={selectedUnit}
                      className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs md:text-sm text-slate-600 font-bold text-center cursor-not-allowed uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">สาเหตุ (Cause)</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="ระบุสาเหตุที่ชัดเจน เช่น หมดอายุ, ตกหล่น, ชำรุด"
                    value={formData.cause}
                    onChange={e => setFormData({ ...formData, cause: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-orange-500/25 outline-none resize-none transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-1">วิธีแก้ไขปัญหา (Solution / Action taken)</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="วิธีการที่ใช้แก้ไขปัญหาในครั้งนี้"
                    value={formData.solution}
                    onChange={e => setFormData({ ...formData, solution: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-orange-500/25 outline-none resize-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <label className="block text-[11px] font-extrabold text-slate-500 tracking-wider uppercase mb-2.5 flex items-center gap-1.5">
                📷 แนบรูปภาพของเสีย (ออฟชั่น)
              </label>
              
              {formData.imageUrl ? (
                <div className="relative inline-block border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm group">
                  <img src={formData.imageUrl} alt="Waste preview" className="w-28 h-28 object-cover" />
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, imageUrl: '' })}
                      className="bg-white/95 hover:bg-white text-red-600 shadow-md rounded-lg px-2 py-1 text-[10px] font-bold transition-all flex items-center gap-0.5 active:scale-95 duration-150 cursor-pointer"
                    >
                      <X size={12} /> ลบรูปภาพ
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, imageUrl: '' })}
                    className="absolute -top-1 -right-1 bg-red-500 text-white shadow-md rounded-full p-1 hover:bg-red-700 transition-colors md:hidden"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-row gap-3 items-stretch">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 max-w-[160px] py-2.5 px-3 border border-dashed border-amber-300 rounded-xl bg-amber-50/15 hover:bg-amber-50/30 cursor-pointer transition-all text-amber-800 flex flex-col items-center justify-center gap-1 outline-none group hover:scale-[1.01] active:scale-95 duration-150 focus-within:ring-2 focus-within:ring-amber-500/30"
                  >
                    <div className="p-1.5 bg-amber-100 rounded-full text-amber-600 group-hover:bg-amber-200/70 transition-colors flex items-center justify-center">
                      <Camera size={16} />
                    </div>
                    <span className="text-[11px] font-black text-center">ถ่ายภาพโดยตรง</span>
                    <span className="text-[9.5px] text-amber-600/70 font-semibold">คลิกเพื่อใช้งานกล้อง</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 max-w-[160px] py-2.5 px-3 border border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100/60 cursor-pointer transition-all text-slate-700 flex flex-col items-center justify-center gap-1 outline-none group hover:scale-[1.01] active:scale-95 duration-150 focus-within:ring-2 focus-within:ring-slate-500/30"
                  >
                    <div className="p-1.5 bg-slate-150 rounded-full text-slate-500 group-hover:bg-slate-200 transition-colors flex items-center justify-center">
                      <Upload size={16} />
                    </div>
                    <span className="text-[11px] font-black text-center">อัปโหลดรูปภาพ</span>
                    <span className="text-[9.5px] text-slate-500/70 font-semibold">อัปโหลดไฟล์ในเครื่อง</span>
                  </button>
                </div>
              )}

              <input 
                type="file" 
                accept="image/*"
                capture="environment"
                className="hidden" 
                ref={cameraInputRef} 
                onChange={handleImageUpload}
              />
              <input 
                type="file" 
                accept="image/*"
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleImageUpload}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-1.5 text-slate-500 font-bold hover:bg-slate-100 rounded-lg text-xs md:text-sm transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4.5 py-1.5 bg-slate-800 text-white font-bold hover:bg-slate-900 rounded-lg text-xs md:text-sm transition-colors flex items-center gap-1.5 shadow-sm hover:shadow active:scale-95 duration-150 cursor-pointer"
              >
                <Save size={15} />
                บันทึกรายการของเสีย
              </button>
            </div>
          </form>
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
                onClick={() => setSelectedLog(log)}
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
      {selectedLog && (
        <div 
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-slate-800">รายละเอียดรายการของเสีย</h3>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                {selectedLog.imageUrl && (
                  <div className="w-full md:w-1/3 shrink-0">
                    <img 
                      src={selectedLog.imageUrl} 
                      alt="Waste item" 
                      className="w-full h-auto aspect-square object-cover rounded-xl border border-slate-200 cursor-zoom-in" 
                      onClick={() => setSelectedImage(selectedLog.imageUrl || null)}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-4">
                  <div>
                    <h4 className="text-xl font-bold text-slate-800">{selectedLog.ingredientName}</h4>
                    <div className="text-slate-500 font-medium flex items-center gap-2 mt-1">
                      <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-md">
                        เสียหาย: {selectedLog.quantity} {selectedLog.unit}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl">
                    <div>
                      <span className="text-slate-500 block mb-1">วันที่บันทึก</span>
                      <span className="font-semibold text-slate-800">{format(new Date(selectedLog.date), 'dd/MM/yyyy')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">ผู้บันทึก</span>
                      <span className="font-semibold text-slate-800">{selectedLog.recorderName}</span>
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
                      className="w-full bg-white border border-orange-200 rounded-lg p-2 text-slate-700 outline-none focus:ring-2 focus:ring-orange-500/50 min-h-[80px]"
                    />
                  ) : (
                    <p className="text-slate-700 whitespace-pre-wrap">{selectedLog.cause}</p>
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
                      className="w-full bg-white border border-blue-200 rounded-lg p-2 text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[80px]"
                    />
                  ) : (
                    <p className="text-slate-700 whitespace-pre-wrap">{selectedLog.solution}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
              {isEditing ? (
                <>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={() => {
                      if (onUpdate) {
                        onUpdate(selectedLog.id, editFormData);
                        setSelectedLog({ ...selectedLog, ...editFormData });
                        setIsEditing(false);
                      }
                    }}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
                  >
                    บันทึก
                  </button>
                </>
              ) : (
                <>
                  {onUpdate && (
                    <button 
                      onClick={() => {
                        setEditFormData({ cause: selectedLog.cause, solution: selectedLog.solution });
                        setIsEditing(true);
                      }}
                      className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Edit2 size={16} />
                      แก้ไข
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedLog(null)}
                    className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
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
