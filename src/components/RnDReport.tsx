import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { RnDReportEntry } from '../types';
import { format } from 'date-fns';
import { ChefHat, Plus, X, Camera, Save, Coffee, Search, Edit, RefreshCw, Loader2, Calendar, User, Lightbulb, ChevronLeft, Sparkles, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface RnDReportProps {
  reports: RnDReportEntry[];
  currentUser: string;
  onSave: (log: Omit<RnDReportEntry, 'id' | 'timestamp'>) => void;
  onUpdate?: (id: string, log: Omit<RnDReportEntry, 'id' | 'timestamp'>) => void;
  onBack: () => void;
  branch?: 'Rayong' | 'Bangkok';
}

export function RnDReport({ reports, currentUser, onSave, onUpdate, onBack, branch }: RnDReportProps) {
  const currentBranch = branch || (() => {
    try {
      const savedUser = localStorage.getItem('cafe-user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.branch) return parsed.branch;
      }
    } catch (e) {}
    return 'Rayong';
  })();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  
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

  const [records, setRecords] = useState<RnDReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [, setLastFetch] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const query = supabase
        .from('rnd_reports')
        .select('id, timestamp, date, menu_name_th, menu_name_en, product_looks, component, taste, flavor, taste_result, improvements, commenter_name, image_url, image_urls, recorder_name')
        .eq('branch', currentBranch)
        .order('timestamp', { ascending: false });

      const { data, error: fetchErr } = await query.limit(100);

      if (fetchErr) {
        console.error('Error fetching rnd_reports from Supabase:', fetchErr);
        setError(fetchErr.message);
      } else if (data) {
        const safeParseJson = (val: any) => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [String(parsed)];
          } catch (e) {
            return [String(val)];
          }
        };

        const mapped: RnDReportEntry[] = data.map((r: any) => ({
          id: r.id,
          timestamp: r.timestamp,
          date: r.date,
          menuNameTH: r.menu_name_th,
          menuNameEN: r.menu_name_en,
          productLooks: r.product_looks,
          component: r.component,
          taste: safeParseJson(r.taste),
          flavor: safeParseJson(r.flavor),
          tasteResult: safeParseJson(r.taste_result),
          improvements: safeParseJson(r.improvements),
          commenterName: r.commenter_name,
          imageUrl: r.image_url,
          imageUrls: safeParseJson(r.image_urls),
          recorderName: r.recorder_name
        }));
        setRecords(mapped);
      } else {
        setRecords([]);
      }
    } catch (err: any) {
      console.error('Fetch exception in rnd_reports:', err);
      setError(err?.message || 'Error fetching data');
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, [currentBranch]);

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData, currentBranch]);

  // Real-time Supabase subscription
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`realtime-rnd_reports-${currentBranch}-${Math.random().toString(36).substring(2, 7)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rnd_reports'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, currentBranch]);

  // Re-fetch on tab focus / visibilitychange
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

  const effectiveReports = useMemo(() => {
    if (!loading) return records;
    return records.length > 0 ? records : reports;
  }, [records, reports, loading]);

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
      fetchData();
    } else {
      onSave(payload);
      fetchData();
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

  const filteredReports = effectiveReports.filter(r => 
    r.menuNameTH.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.menuNameEN.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] p-5 sm:p-6 overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Left Title */}
          <div className="flex items-center gap-3.5">
            <button 
              onClick={onBack}
              title="ย้อนกลับหน้าหลัก"
              className="p-2.5 hover:bg-[#E8F3F2] text-[#2D4A49] rounded-xl transition-all shadow-xs bg-white border border-[#D4E4E3] cursor-pointer"
            >
              <ChevronLeft size={20} className="text-[#5A8A88]" />
            </button>
            <div className="w-10 h-10 bg-[#E8F3F2] rounded-xl shrink-0 flex items-center justify-center text-[#5A8A88]">
              <ChefHat size={22} className="text-[#5A8A88]" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#2D4A49] flex items-center gap-2 leading-tight">
                รายงาน R&D และพัฒนาเมนู (Menu Development)
              </h2>
              <p className="text-[11px] text-[#6B8F8E] font-medium mt-0.5">
                บันทึกการทดลองรสชาติและพัฒนาสูตรเครื่องดื่ม / เบเกอรี่
              </p>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-56">
              <input
                type="text"
                placeholder="ค้นหาชื่อเมนู..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#D4E4E3] rounded-xl text-[12px] font-medium text-[#2D4A49] placeholder-[#A8BCBB] focus:border-[#5A8A88] outline-none transition-all shadow-xs h-[38px]"
              />
              <Search className="absolute left-3 top-2.5 text-[#5A8A88]" size={16} />
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchData()}
              disabled={loading}
              title="รีเฟรชข้อมูล"
              className="w-[38px] h-[38px] bg-white border border-[#D4E4E3] rounded-xl text-[#5A8A88] hover:bg-[#E8F3F2] transition-colors flex items-center justify-center shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw size={16} className={cn(loading && "animate-spin text-[#5A8A88]")} />
            </button>

            {/* Add New Button */}
            <button
              onClick={handleAddNew}
              className="flex items-center gap-1.5 px-4 h-[38px] bg-[#5A8A88] hover:bg-[#4A7A78] text-white rounded-xl text-[13px] font-bold transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
            >
              <Plus size={16} />
              <span>+ สร้างรายงาน R&D</span>
            </button>
          </div>
        </div>
      </div>

      {/* R&D Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full border border-[#D4E4E3] overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#E8F3F2] px-5 py-4 border-b border-[#D4E4E3] flex justify-between items-center">
              <h3 className="font-bold text-[16px] text-[#2D4A49] flex items-center gap-2">
                <ChefHat className="text-[#5A8A88]" size={20} />
                <span>{editingId ? 'แก้ไขรายงาน R&D' : 'บันทึกรายงาน R&D (Menu Development)'}</span>
              </h3>
              <button 
                onClick={() => { setIsFormOpen(false); setEditingId(null); }} 
                className="w-8 h-8 rounded-lg bg-white/70 hover:bg-white text-[#6B8F8E] hover:text-[#2D4A49] flex items-center justify-center transition-colors cursor-pointer border border-[#D4E4E3]"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Basic Info Box */}
              <div className="bg-[#F8FAF9] p-4 sm:p-5 rounded-xl border border-[#E2EAE9] space-y-4">
                <h4 className="font-bold text-[13px] text-[#2D4A49] border-b border-[#E2EAE9] pb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#5A8A88]" />
                  <span>1. ข้อมูลพื้นฐานของเมนู (Menu Basic Info)</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B8F8E] mb-1">วันที่สร้าง R&D *</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#D4E4E3] rounded-lg text-[13px] font-medium text-[#2D4A49] focus:border-[#5A8A88] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#6B8F8E] mb-1">ชื่อเมนู (ภาษาไทย) *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น มัทฉะยูซุ สปาร์คกลิ้ง"
                      value={formData.menuNameTH}
                      onChange={e => setFormData({ ...formData, menuNameTH: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#D4E4E3] rounded-lg text-[13px] font-medium text-[#2D4A49] focus:border-[#5A8A88] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#6B8F8E] mb-1">ชื่อเมนู (ภาษาอังกฤษ) *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Matcha Yuzu Sparkling"
                      value={formData.menuNameEN}
                      onChange={e => setFormData({ ...formData, menuNameEN: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#D4E4E3] rounded-lg text-[13px] font-medium text-[#2D4A49] focus:border-[#5A8A88] outline-none"
                    />
                  </div>
                </div>

                {/* Photo Upload Zone */}
                <div className="pt-2">
                  <label className="block text-[11px] font-bold text-[#6B8F8E] mb-2">ภาพถ่ายเมนู (Photos)</label>
                  
                  {formData.imageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2.5 mb-3">
                      {formData.imageUrls.map((img, idx) => (
                        <div key={idx} className="relative inline-block group">
                          <img src={img} alt={`Preview ${idx + 1}`} className="w-20 h-20 object-cover rounded-xl border border-[#D4E4E3] shadow-xs" />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute -top-1.5 -right-1.5 bg-white text-[#EF4444] shadow-md rounded-full p-1 border border-[#D4E4E3] hover:bg-[#FEE2E2] cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-16 flex items-center justify-center gap-2 border-2 border-dashed border-[#B8D4D2] rounded-xl bg-[#F8FAF9] hover:bg-[#E8F3F2] cursor-pointer transition-colors text-[#5A8A88]"
                  >
                    <Camera size={18} />
                    <span className="text-[12px] font-bold">+ เพิ่มรูปภาพเมนู</span>
                    <input 
                      type="file" 
                      accept="image/*"
                      multiple
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload}
                    />
                  </div>
                </div>
              </div>

              {/* Menu Details Box */}
              <div className="bg-[#F8FAF9] p-4 sm:p-5 rounded-xl border border-[#E2EAE9] space-y-4">
                <h4 className="font-bold text-[13px] text-[#2D4A49] border-b border-[#E2EAE9] pb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#5A8A88]" />
                  <span>2. ข้อมูลลักษณะและส่วนประกอบ (Details & Component)</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B8F8E] mb-1">รูปลักษณ์ (Product Looks)</label>
                    <textarea
                      rows={2}
                      placeholder="ลักษณะภายนอก สีสัน การจัดตกแต่งแก้ว..."
                      value={formData.productLooks}
                      onChange={e => setFormData({ ...formData, productLooks: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#D4E4E3] rounded-lg text-[13px] text-[#2D4A49] focus:border-[#5A8A88] outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#6B8F8E] mb-1">ส่วนประกอบ (Component)</label>
                    <textarea
                      rows={2}
                      placeholder="วัตถุดิบหลัก สัดส่วน และส่วนผสม..."
                      value={formData.component}
                      onChange={e => setFormData({ ...formData, component: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#D4E4E3] rounded-lg text-[13px] text-[#2D4A49] focus:border-[#5A8A88] outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Taste & Flavor Tags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-[#6B8F8E]">รสชาติ (Taste Tags)</label>
                      <button type="button" onClick={() => addArrayField('taste')} className="text-[#5A8A88] hover:text-[#4A7A78] text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                        <Plus size={14} /> เพิ่มรสชาติ
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {formData.taste.map((item, index) => (
                        <div key={`taste-${index}`} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="เช่น หวานอมเปรี้ยว, กลมกล่อม"
                            value={item}
                            onChange={e => updateArrayField('taste', index, e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-[#D4E4E3] rounded-lg text-[12px] text-[#2D4A49] focus:border-[#5A8A88] outline-none"
                          />
                          {formData.taste.length > 1 && (
                            <button type="button" onClick={() => removeArrayField('taste', index)} className="text-[#A8BCBB] hover:text-[#EF4444] cursor-pointer">
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-[#6B8F8E]">กลิ่น (Flavor Tags)</label>
                      <button type="button" onClick={() => addArrayField('flavor')} className="text-[#5A8A88] hover:text-[#4A7A78] text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                        <Plus size={14} /> เพิ่มกลิ่น
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {formData.flavor.map((item, index) => (
                        <div key={`flavor-${index}`} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="เช่น หอมสดชื่นส้มยูซุ, โทนดอกไม้"
                            value={item}
                            onChange={e => updateArrayField('flavor', index, e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-[#D4E4E3] rounded-lg text-[12px] text-[#2D4A49] focus:border-[#5A8A88] outline-none"
                          />
                          {formData.flavor.length > 1 && (
                            <button type="button" onClick={() => removeArrayField('flavor', index)} className="text-[#A8BCBB] hover:text-[#EF4444] cursor-pointer">
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tasting Results & Improvements */}
              <div className="bg-[#E8F3F2]/60 p-4 sm:p-5 rounded-xl border border-[#B8D4D2] space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#B8D4D2] pb-2">
                  <h4 className="font-bold text-[13px] text-[#2D4A49] flex items-center gap-2">
                    <Sparkles className="text-[#5A8A88]" size={16} />
                    <span>3. ผลจากการทดลองชิมและการพัฒนาต่อ</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold text-[#6B8F8E]">ผู้ประเมินชิม:</label>
                    <input
                      type="text"
                      required
                      placeholder="ชื่อผู้เทส"
                      value={formData.commenterName}
                      onChange={e => setFormData({ ...formData, commenterName: e.target.value })}
                      className="px-2.5 py-1 bg-white border border-[#D4E4E3] rounded-lg text-[12px] font-medium text-[#2D4A49] focus:border-[#5A8A88] outline-none"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-[#6B8F8E]">ผลจากการชิม (Taste Result)</label>
                      <button type="button" onClick={() => addArrayField('tasteResult')} className="text-[#5A8A88] hover:text-[#4A7A78] text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                        <Plus size={14} /> เพิ่มข้อความ
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {formData.tasteResult.map((item, index) => (
                        <div key={`tasteResult-${index}`} className="flex items-start gap-1.5">
                          <textarea
                            required={index === 0}
                            rows={2}
                            placeholder="ฟีดแบคและข้อคิดเห็นจากการชิม..."
                            value={item}
                            onChange={e => updateArrayField('tasteResult', index, e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-[#D4E4E3] rounded-lg text-[12px] text-[#2D4A49] focus:border-[#5A8A88] outline-none resize-none"
                          />
                          {formData.tasteResult.length > 1 && (
                            <button type="button" onClick={() => removeArrayField('tasteResult', index)} className="text-[#A8BCBB] hover:text-[#EF4444] cursor-pointer mt-1">
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-[#6B8F8E]">แนวทางพัฒนาต่อ (Improvements)</label>
                      <button type="button" onClick={() => addArrayField('improvements')} className="text-[#5A8A88] hover:text-[#4A7A78] text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                        <Plus size={14} /> เพิ่มแนวทาง
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {formData.improvements.map((item, index) => (
                        <div key={`improvements-${index}`} className="flex items-start gap-1.5">
                          <textarea
                            required={index === 0}
                            rows={2}
                            placeholder="จุดที่ต้องปรับ เช่น ลดหวาน 10%, ปรับสัดส่วนโซดา..."
                            value={item}
                            onChange={e => updateArrayField('improvements', index, e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-[#D4E4E3] rounded-lg text-[12px] text-[#2D4A49] focus:border-[#5A8A88] outline-none resize-none"
                          />
                          {formData.improvements.length > 1 && (
                            <button type="button" onClick={() => removeArrayField('improvements', index)} className="text-[#A8BCBB] hover:text-[#EF4444] cursor-pointer mt-1">
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-2 flex justify-end gap-2.5 border-t border-[#E2EAE9]">
                <button
                  type="button"
                  onClick={() => { setIsFormOpen(false); setEditingId(null); }}
                  className="px-5 py-2.5 bg-[#F0F5F4] text-[#6B8F8E] hover:text-[#2D4A49] rounded-xl text-[13px] font-semibold hover:bg-[#E2EAE9] transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#5A8A88] hover:bg-[#4A7A78] text-white rounded-xl text-[13px] font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Save size={16} />
                  <span>{editingId ? 'บันทึกการแก้ไข' : 'บันทึกรายงาน R&D'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        {loading && filteredReports.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#D4E4E3] p-12 text-center flex flex-col items-center">
            <Loader2 className="text-[#5A8A88] animate-spin mb-3" size={28} />
            <p className="text-[#6B8F8E] text-[13px] font-medium">กำลังโหลดข้อมูลรายงาน R&D...</p>
          </div>
        ) : filteredReports.length > 0 ? (
          <div className="grid grid-cols-1 gap-5">
            {filteredReports.map(report => (
              <div 
                key={report.id} 
                className="bg-white rounded-2xl border border-[#D4E4E3] shadow-[0_2px_8px_rgba(90,138,136,0.06)] hover:shadow-md transition-all overflow-hidden"
              >
                {/* Card Header */}
                <div className="px-5 py-4 border-b border-[#E2EAE9] bg-white flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg text-[11px] font-bold text-[#2D4A49]">
                      <Calendar size={13} className="text-[#5A8A88]" />
                      <span>{format(new Date(report.date), 'dd/MM/yyyy')}</span>
                    </div>
                    <div>
                      <h4 className="text-[16px] font-bold text-[#2D4A49] leading-tight">
                        {report.menuNameTH}
                      </h4>
                      <div className="text-[12px] italic text-[#7A9E9C] font-medium">
                        {report.menuNameEN}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {report.recorderName && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-[#5A8A88] bg-[#E8F3F2] px-2.5 py-1 rounded-full">
                        <User size={12} />
                        ผู้บันทึก: {report.recorderName}
                      </span>
                    )}
                    <button
                      onClick={() => openEditForm(report)}
                      className="w-8 h-8 rounded-lg bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                      title="แก้ไขรายงาน"
                    >
                      <Edit size={14} />
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-4">
                  <div className="flex flex-col md:flex-row gap-5">
                    {/* Photos Column */}
                    <div className="md:w-1/3 flex flex-col gap-2.5">
                      {report.imageUrls && report.imageUrls.length > 0 ? (
                        <div className="space-y-2">
                          <div 
                            onClick={() => setZoomImageUrl(report.imageUrls![0])}
                            className="relative overflow-hidden rounded-xl border border-[#D4E4E3] cursor-pointer group h-44 bg-[#F8FAF9]"
                          >
                            <img 
                              src={report.imageUrls[0]} 
                              alt={report.menuNameTH} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-medium">
                              คลิกเพื่อดูรูปขยาย
                            </div>
                          </div>
                          {report.imageUrls.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                              {report.imageUrls.slice(1).map((img, idx) => (
                                <img 
                                  key={idx} 
                                  src={img} 
                                  alt={`Thumb ${idx + 2}`} 
                                  onClick={() => setZoomImageUrl(img)}
                                  className="w-14 h-14 object-cover rounded-lg border border-[#D4E4E3] shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ) : report.imageUrl ? (
                        <div 
                          onClick={() => setZoomImageUrl(report.imageUrl!)}
                          className="relative overflow-hidden rounded-xl border border-[#D4E4E3] cursor-pointer group h-44 bg-[#F8FAF9]"
                        >
                          <img 
                            src={report.imageUrl} 
                            alt={report.menuNameTH} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                        </div>
                      ) : (
                        <div className="h-44 rounded-xl border-2 border-dashed border-[#D4E4E3] bg-[#F8FAF9] flex flex-col items-center justify-center text-[#6B8F8E]">
                          <ImageIcon size={28} className="opacity-40 mb-1" />
                          <span className="text-[11px]">ไม่มีรูปภาพ</span>
                        </div>
                      )}
                    </div>

                    {/* Details Column */}
                    <div className="md:w-2/3 flex flex-col gap-3.5">
                      {/* Appearance & Component 2-column sub-cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-[#F8FAF9] border border-[#E2EAE9] rounded-xl p-3">
                          <span className="text-[10px] font-bold text-[#6B8F8E] uppercase tracking-wider block mb-1">
                            ลักษณะภายนอก (Product Looks)
                          </span>
                          <p className="text-[12px] text-[#2D4A49] font-medium leading-relaxed">
                            {report.productLooks || '-'}
                          </p>
                        </div>
                        <div className="bg-[#F8FAF9] border border-[#E2EAE9] rounded-xl p-3">
                          <span className="text-[10px] font-bold text-[#6B8F8E] uppercase tracking-wider block mb-1">
                            ส่วนประกอบหลัก (Component)
                          </span>
                          <p className="text-[12px] text-[#2D4A49] font-medium leading-relaxed">
                            {report.component || '-'}
                          </p>
                        </div>
                      </div>

                      {/* Sensory Evaluation (Taste & Flavor Tags) */}
                      <div className="bg-[#F8FAF9] border border-[#E2EAE9] rounded-xl p-3 space-y-2">
                        <span className="text-[10px] font-bold text-[#6B8F8E] uppercase tracking-wider block">
                          การประเมินรสสัมผัส (Sensory Evaluation)
                        </span>
                        
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-[#6B8F8E] mr-1">รสชาติ:</span>
                          {Array.isArray(report.taste) && report.taste.length > 0 && report.taste[0] ? (
                            report.taste.map((t, i) => (
                              <span key={i} className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E8F3F2] text-[#2D4A49] border border-[#B8D4D2]">
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-[#A8BCBB]">-</span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#E2EAE9]">
                          <span className="text-[11px] font-bold text-[#6B8F8E] mr-1">กลิ่น:</span>
                          {Array.isArray(report.flavor) && report.flavor.length > 0 && report.flavor[0] ? (
                            report.flavor.map((f, i) => (
                              <span key={i} className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E8F3F2] text-[#2D4A49] border border-[#B8D4D2]">
                                {f}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-[#A8BCBB]">-</span>
                          )}
                        </div>
                      </div>

                      {/* Feedback & Improvements */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Taste Result */}
                        <div className="bg-[#F8FAF9] border border-[#E2EAE9] rounded-xl p-3">
                          <div className="text-[10px] font-bold text-[#6B8F8E] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>ผลจากการชิม (Taste Result)</span>
                          </div>
                          {Array.isArray(report.tasteResult) ? (
                            <ul className="text-[12px] text-[#2D4A49] space-y-1">
                              {report.tasteResult.map((res, i) => (
                                <li key={i} className="leading-relaxed flex items-start gap-1.5">
                                  <span className="text-[#5A8A88] font-bold">•</span>
                                  <span>{res}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[12px] text-[#2D4A49] leading-relaxed">{report.tasteResult || '-'}</p>
                          )}
                        </div>

                        {/* Improvements */}
                        <div className="bg-[#FEF3C7]/60 border border-[#FDE68A] rounded-xl p-3">
                          <div className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Lightbulb size={13} className="text-[#D97706]" />
                            <span>แนวทางพัฒนาต่อ (Improvements)</span>
                          </div>
                          {Array.isArray(report.improvements) ? (
                            <ul className="text-[12px] text-[#92400E] space-y-1">
                              {report.improvements.map((imp, i) => (
                                <li key={i} className="leading-relaxed flex items-start gap-1.5">
                                  <span className="text-[#D97706] font-bold">•</span>
                                  <span>{imp}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[12px] text-[#92400E] leading-relaxed">{report.improvements || '-'}</p>
                          )}
                        </div>
                      </div>

                      {/* Commenter footer */}
                      {report.commenterName && (
                        <div className="text-[11px] text-[#6B8F8E] font-medium pt-1">
                          ผู้ประเมิน: <span className="text-[#2D4A49] font-bold">{report.commenterName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#D4E4E3] p-12 text-center">
            <div className="w-16 h-16 bg-[#E8F3F2] rounded-full flex items-center justify-center mx-auto mb-3 text-[#5A8A88]">
              <Coffee size={32} />
            </div>
            <h4 className="text-[16px] font-bold text-[#2D4A49]">ยังไม่มีรายการ R&D Report</h4>
            <p className="text-[12px] text-[#6B8F8E] mt-1 max-w-sm mx-auto">
              {searchTerm ? 'ไม่พบเมนูที่ตรงกับคำค้นหา' : 'เพิ่มรายการแรกของคุณเพื่อเริ่มเก็บข้อมูลสูตรและเทสเมนูใหม่'}
            </p>
          </div>
        )}
      </div>

      {/* Lightbox Image Zoom Modal */}
      {zoomImageUrl && (
        <div 
          onClick={() => setZoomImageUrl(null)}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[200] flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl">
            <img src={zoomImageUrl} alt="Enlarged preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <button
              onClick={() => setZoomImageUrl(null)}
              className="absolute top-4 right-4 bg-black/60 text-white rounded-full p-1.5 hover:bg-black transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
