import React, { useState, useRef } from 'react';
import { RnDReportEntry } from '../types';
import { format } from 'date-fns';
import { ChefHat, Plus, X, Camera, Save, Coffee, Search, Edit } from 'lucide-react';
import { cn } from '../lib/utils';

interface RnDReportProps {
  reports: RnDReportEntry[];
  currentUser: string;
  onSave: (log: Omit<RnDReportEntry, 'id' | 'timestamp'>) => void;
  onUpdate?: (id: string, log: Omit<RnDReportEntry, 'id' | 'timestamp'>) => void;
  onBack: () => void;
}

export function RnDReport({ reports, currentUser, onSave, onUpdate, onBack }: RnDReportProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<{
    date: string;
    menuNameTH: string;
    menuNameEN: string;
    productLooks: string;
    component: string;
    taste: string[];
    flavor: string[];
    tasteResult: string[];
    improvements: string[];
    commenterName: string;
    imageUrls: string[];
  }>({
    date: format(new Date(), 'yyyy-MM-dd'),
    menuNameTH: '',
    menuNameEN: '',
    productLooks: '',
    component: '',
    taste: [''],
    flavor: [''],
    tasteResult: [''],
    improvements: [''],
    commenterName: currentUser || '',
    imageUrls: []
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: File) => {
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
            setFormData(prev => ({ 
              ...prev, 
              imageUrls: [...prev.imageUrls, compressedDataUrl] 
            }));
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, index) => index !== indexToRemove)
    }));
  };

  const updateArrayField = (field: 'taste' | 'flavor' | 'tasteResult' | 'improvements', index: number, value: string) => {
    setFormData(prev => {
      const newArray = [...prev[field]];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
  };

  const addArrayField = (field: 'taste' | 'flavor' | 'tasteResult' | 'improvements') => {
    setFormData(prev => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeArrayField = (field: 'taste' | 'flavor' | 'tasteResult' | 'improvements', indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].length > 1 ? prev[field].filter((_, index) => index !== indexToRemove) : ['']
    }));
  };

  const openEditForm = (report: RnDReportEntry) => {
    setFormData({
      date: report.date,
      menuNameTH: report.menuNameTH,
      menuNameEN: report.menuNameEN,
      productLooks: report.productLooks,
      component: report.component,
      taste: Array.isArray(report.taste) && report.taste.length > 0 ? report.taste : [''],
      flavor: Array.isArray(report.flavor) && report.flavor.length > 0 ? report.flavor : [''],
      tasteResult: Array.isArray(report.tasteResult) && report.tasteResult.length > 0 ? report.tasteResult : [''],
      improvements: Array.isArray(report.improvements) && report.improvements.length > 0 ? report.improvements : [''],
      commenterName: report.commenterName || currentUser,
      imageUrls: report.imageUrls || (report.imageUrl ? [report.imageUrl] : [])
    });
    setEditingId(report.id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddNew = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      menuNameTH: '',
      menuNameEN: '',
      productLooks: '',
      component: '',
      taste: [''],
      flavor: [''],
      tasteResult: [''],
      improvements: [''],
      commenterName: currentUser || '',
      imageUrls: []
    });
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      date: formData.date,
      menuNameTH: formData.menuNameTH,
      menuNameEN: formData.menuNameEN,
      productLooks: formData.productLooks,
      component: formData.component,
      taste: formData.taste.filter(t => t.trim() !== ''),
      flavor: formData.flavor.filter(t => t.trim() !== ''),
      tasteResult: formData.tasteResult.filter(t => t.trim() !== ''),
      improvements: formData.improvements.filter(t => t.trim() !== ''),
      commenterName: formData.commenterName,
      imageUrls: formData.imageUrls,
      recorderName: currentUser
    };

    if (editingId && onUpdate) {
      onUpdate(editingId, payload);
    } else {
      onSave(payload);
    }

    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      menuNameTH: '',
      menuNameEN: '',
      productLooks: '',
      component: '',
      taste: [''],
      flavor: [''],
      tasteResult: [''],
      improvements: [''],
      commenterName: currentUser || '',
      imageUrls: []
    });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const filteredReports = reports.filter(r => 
    r.menuNameTH.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.menuNameEN.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <button onClick={onBack} className="text-slate-500 hover:text-slate-800 font-medium mb-2 flex items-center gap-2">
            ← ย้อนกลับหน้าหลัก
          </button>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <ChefHat className="text-purple-600" size={28} />
            R&D Report (เทสเมนูใหม่)
          </h2>
          <p className="text-slate-500 mt-1">
            เก็บบันทึกข้อมูล ข้อมูลส่วนผสม และรายละเอียดการปรับปรุงเมนูใหม่
          </p>
        </div>
        
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl text-white font-medium shadow-md hover:shadow-lg transition-all"
        >
          <Plus size={20} />
          เพิ่มรายการ R&D
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b border-purple-100 flex justify-between items-center">
            <h3 className="font-bold text-indigo-900 flex items-center gap-2">
              <ChefHat className="text-indigo-600" size={20} />
              {editingId ? 'แก้ไขข้อมูล New Menu' : 'บันทึกข้อมูล New Menu'}
            </h3>
            <button onClick={() => { setIsFormOpen(false); setEditingId(null); }} className="text-slate-400 hover:bg-slate-200 p-1.5 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Group 1: Basic Info */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="font-bold text-slate-700 mb-3 border-b border-slate-200 pb-2">1. ชื่อเมนู (Menu Name)</h4>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">วันที่สร้าง R&D</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อเมนู (ภาษาไทย) *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ฮันนี่โทสต์ชาไทย"
                    value={formData.menuNameTH}
                    onChange={e => setFormData({ ...formData, menuNameTH: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อเมนู (ภาษาอังกฤษ) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Thai Tea Honey Toast"
                    value={formData.menuNameEN}
                    onChange={e => setFormData({ ...formData, menuNameEN: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div className="pt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">ภาพประกอบเมนู (ภาพถ่าย)</label>
                  
                  {formData.imageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-3">
                      {formData.imageUrls.map((img, idx) => (
                        <div key={idx} className="relative inline-block">
                          <img src={img} alt={`Menu preview ${idx + 1}`} className="w-24 h-24 object-cover rounded-xl border border-slate-200" />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute -top-2 -right-2 bg-white text-red-500 shadow-md rounded-full p-1 border border-slate-100 hover:bg-slate-50"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-16 flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:bg-slate-50 cursor-pointer transition-colors text-slate-500"
                  >
                    <Plus size={20} />
                    <Camera size={20} />
                    <span className="text-sm font-medium">เพิ่มรูปภาพ</span>
                    <input 
                      type="file" 
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload}
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Menu Info */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="font-bold text-slate-700 mb-3 border-b border-slate-200 pb-2">2. ข้อมูลเมนู (Menu Information)</h4>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">2.1 รูปลักษณ์ (Product Looks)</label>
                  <textarea
                    rows={2}
                    placeholder="ลักษณะภายนอก, การจัดจาน, สีสัน"
                    value={formData.productLooks}
                    onChange={e => setFormData({ ...formData, productLooks: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">2.2 ส่วนประกอบ (Component)</label>
                  <textarea
                    rows={2}
                    placeholder="วัตถุดิบหลักและส่วนผสม"
                    value={formData.component}
                    onChange={e => setFormData({ ...formData, component: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">2.3 รสชาติ (Taste)</label>
                      <button type="button" onClick={() => addArrayField('taste')} className="text-purple-600 hover:text-purple-800 p-0.5"><Plus size={16} /></button>
                    </div>
                    <div className="space-y-2">
                      {formData.taste.map((item, index) => (
                        <div key={`taste-${index}`} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="เช่น หวานนำ, เปรี้ยวน้อย"
                            value={item}
                            onChange={e => updateArrayField('taste', index, e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                          {formData.taste.length > 1 && (
                            <button type="button" onClick={() => removeArrayField('taste', index)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">2.4 กลิ่น (Flavor)</label>
                      <button type="button" onClick={() => addArrayField('flavor')} className="text-purple-600 hover:text-purple-800 p-0.5"><Plus size={16} /></button>
                    </div>
                    <div className="space-y-2">
                      {formData.flavor.map((item, index) => (
                        <div key={`flavor-${index}`} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="เช่น หอมกลิ่นคั่ว, หอมเนย"
                            value={item}
                            onChange={e => updateArrayField('flavor', index, e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                          {formData.flavor.length > 1 && (
                            <button type="button" onClick={() => removeArrayField('flavor', index)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 3: Tasting & Improvments */}
              <div className="md:col-span-2 bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3 border-b border-indigo-200 pb-2">
                  <h4 className="font-bold text-indigo-900">3. ข้อมูลจากการชิม (Taste Result) และการปรับปรุง</h4>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="text-sm font-bold text-indigo-700 whitespace-nowrap">ผู้ทดสอบ/ให้ความเห็น:</label>
                    <input
                      type="text"
                      required
                      placeholder="ชื่อผู้เทสชิม"
                      value={formData.commenterName}
                      onChange={e => setFormData({ ...formData, commenterName: e.target.value })}
                      className="w-full sm:w-48 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">ผลจากการชิม (Taste Result)</label>
                      <button type="button" onClick={() => addArrayField('tasteResult')} className="text-indigo-600 hover:text-indigo-800 p-0.5"><Plus size={16} /></button>
                    </div>
                    <div className="space-y-2">
                      {formData.tasteResult.map((item, index) => (
                        <div key={`tasteResult-${index}`} className="flex items-start gap-2">
                          <textarea
                            required={index === 0}
                            rows={2}
                            placeholder="ข้อคิดเห็นและฟีดแบคทั้งหมดจากการชิม"
                            value={item}
                            onChange={e => updateArrayField('tasteResult', index, e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                          />
                          {formData.tasteResult.length > 1 && (
                            <button type="button" onClick={() => removeArrayField('tasteResult', index)} className="text-slate-400 hover:text-red-500 mt-2"><X size={16} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">สิ่งที่ต้องปรับปรุง (Improvements)</label>
                      <button type="button" onClick={() => addArrayField('improvements')} className="text-indigo-600 hover:text-indigo-800 p-0.5"><Plus size={16} /></button>
                    </div>
                    <div className="space-y-2">
                      {formData.improvements.map((item, index) => (
                        <div key={`improvements-${index}`} className="flex items-start gap-2">
                          <textarea
                            required={index === 0}
                            rows={2}
                            placeholder="จุดที่ต้องแก้ไข เช่น ลดความหวาน, เพิ่มปริมาณเนื้อสัตว์"
                            value={item}
                            onChange={e => updateArrayField('improvements', index, e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                          />
                          {formData.improvements.length > 1 && (
                            <button type="button" onClick={() => removeArrayField('improvements', index)} className="text-slate-400 hover:text-red-500 mt-2"><X size={16} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-6">
              <button
                type="button"
                onClick={() => { setIsFormOpen(false); setEditingId(null); }}
                className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-2 shadow-md"
              >
                <Save size={18} />
                {editingId ? 'อัปเดต Report' : 'บันทึก Report'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reports List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Coffee size={20} className="text-purple-600" />
            <h3 className="font-bold text-slate-800 text-lg">รายการ R&D ทั้งหมด</h3>
            <span className="bg-purple-100 text-purple-700 font-bold px-2.5 py-0.5 rounded-lg text-sm">
              {filteredReports.length}
            </span>
          </div>
          
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="ค้นหาชื่อเมนู..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all"
            />
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          </div>
        </div>
        
        {filteredReports.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredReports.map(report => (
              <div key={report.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Photo & Basic info */}
                  <div className="md:w-1/3 flex flex-col gap-4">
                    {report.imageUrls && report.imageUrls.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <img src={report.imageUrls[0]} alt={report.menuNameEN} className="w-full h-48 object-cover rounded-xl border border-slate-200" />
                        {report.imageUrls.length > 1 && (
                          <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
                            {report.imageUrls.slice(1).map((img, idx) => (
                              <img key={idx} src={img} alt={`Preview ${idx+2}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200 shrink-0" />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : report.imageUrl ? (
                      <img src={report.imageUrl} alt={report.menuNameEN} className="w-full h-48 object-cover rounded-xl border border-slate-200" />
                    ) : (
                      <div className="w-full h-48 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                        <Coffee size={32} className="mb-2 opacity-50" />
                        <span className="text-sm">ไม่มีรูปภาพ</span>
                      </div>
                    )}
                    
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-xl font-bold text-slate-800">{report.menuNameTH}</h4>
                          <div className="text-sm text-slate-500 font-medium mb-3">{report.menuNameEN}</div>
                        </div>
                        <button
                          onClick={() => openEditForm(report)}
                          className="p-2 text-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 bg-white p-3 rounded-xl border border-slate-200">
                        <div className="flex flex-col gap-1">
                          <span className="uppercase text-[10px] text-slate-400">วันที่ทดสอบ</span>
                          <span className="text-slate-700">{format(new Date(report.date), 'dd/MM/yyyy')}</span>
                        </div>
                        <div className="flex flex-col gap-1 text-right">
                          <span className="uppercase text-[10px] text-slate-400">ผู้บันทึก</span>
                          <span className="text-slate-700">{report.recorderName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Details Data */}
                  <div className="md:w-2/3 flex flex-col gap-4">
                    
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <h5 className="font-bold text-sm text-indigo-900 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                        ข้อมูลเมนู (Menu Info)
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">รูปลักษณ์</span>
                          <p className="text-sm text-slate-700">{report.productLooks || '-'}</p>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">ส่วนประกอบ</span>
                          <p className="text-sm text-slate-700">{report.component || '-'}</p>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">รสชาติ (Taste)</span>
                          {Array.isArray(report.taste) ? (
                            <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                              {report.taste.map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-700">{report.taste || '-'}</p>
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">กลิ่น (Flavor)</span>
                          {Array.isArray(report.flavor) ? (
                            <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                              {report.flavor.map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-700">{report.flavor || '-'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                        <h5 className="font-bold text-sm text-blue-900 mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                            ผลจากการชิม
                          </div>
                          {report.commenterName && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                              โดย: {report.commenterName}
                            </span>
                          )}
                        </h5>
                        {Array.isArray(report.tasteResult) ? (
                          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                            {report.tasteResult.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        ) : (
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{report.tasteResult}</p>
                        )}
                      </div>
                      
                      <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
                        <h5 className="font-bold text-sm text-amber-900 mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          สิ่งที่ต้องปรับปรุง
                        </h5>
                        {Array.isArray(report.improvements) ? (
                          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                            {report.improvements.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        ) : (
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{report.improvements}</p>
                        )}
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
              <ChefHat className="text-slate-300" size={32} />
            </div>
            <h4 className="text-slate-800 font-bold mb-1">ยังไม่มีประวัติ R&D Report</h4>
            <p className="text-slate-500 text-sm">เพิ่มรายการแรกของคุณเพื่อเริ่มเก็บข้อมูลเทสเมนูใหม่</p>
          </div>
        )}
      </div>
    </div>
  );
}
