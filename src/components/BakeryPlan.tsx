import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Save, ChevronLeft, ChevronRight, Plus, Trash2, Settings, X, PlusCircle, Check } from 'lucide-react';
import { format, startOfWeek, addWeeks, subWeeks, addDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { BAKERY_PLAN_INITIAL_DATA } from '../bakeryPlanData';
import { supabase } from '../lib/supabase';
import { sendLineNotification } from '../lib/lineNotify';
import { sendDiscordNotification } from '../lib/discordNotify';

interface BakeryPlanProps { 
  branch?: string;
  isReadOnly?: boolean;
  historyData?: any;
  historyWeek?: Date;
  onSave?: (weekLabel: string) => void;
}

const DAYS = [
  { key: 'mon', label: 'จันทร์' },
  { key: 'tue', label: 'อังคาร' },
  { key: 'wed', label: 'พุธ' },
  { key: 'thu', label: 'พฤหัสบดี' },
  { key: 'fri', label: 'ศุกร์' },
  { key: 'sat', label: 'เสาร์' },
  { key: 'sun', label: 'อาทิตย์' }
];

export function BakeryPlan({ isReadOnly = false, historyData, historyWeek, onSave, branch }: BakeryPlanProps) {
  const [data, setData] = useState(() => {
    if (historyData) return historyData;
    const saved = localStorage.getItem('bakeryPlanData');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return BAKERY_PLAN_INITIAL_DATA;
  });
  const [activeTab, setActiveTab] = useState<'production' | 'sales'>('production');
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);
  const [currentWeek, setCurrentWeek] = useState(() => {
    if (historyWeek) return historyWeek;
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });
  const [lastSaved, setLastSaved] = useState<{ date: Date; user: string } | null>(() => {
    const saved = localStorage.getItem('bakeryPlanLastSaved');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date) {
            return { date: new Date(parsed.date), user: parsed.user || 'Admin' };
        }
      } catch(e) {}
    }
    return null;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mixingSettings, setMixingSettings] = useState<{ id: string; name: string; unit: string; size: string; }[]>(() => {
    const saved = localStorage.getItem('bakeryMixingSettings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    const oldSaved = localStorage.getItem('bakeryConversionSettings');
    if (oldSaved) {
       try { 
         const old = JSON.parse(oldSaved);
         // Ensure unique items for mixing based on name/unit/size
         const deduped: any[] = [];
         old.forEach((s: any) => {
           if (!deduped.find(d => d.name === s.name && d.unit === s.source)) {
             deduped.push({ id: s.id + '-m', name: s.name, unit: s.source, size: s.size });
           }
         });
         return deduped.length > 0 ? deduped : [];
       } catch (e) {}
    }
    return [
      { id: '1', name: 'ครัวซองค์', unit: 'Dough', size: '4 kg' },
      { id: '2', name: 'ชีสเค้ก BB', unit: 'ก้อน', size: '2 ปอนด์' },
    ];
  });

  const [cuttingSettings, setCuttingSettings] = useState<{ id: string; sourceDough: string; target: string; ratio: number; unit: string; }[]>(() => {
    const saved = localStorage.getItem('bakeryCuttingSettings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    const oldSaved = localStorage.getItem('bakeryConversionSettings');
    if (oldSaved) {
       try { 
         const old = JSON.parse(oldSaved);
         return old.filter((s: any) => s.target).map((s: any) => ({
           id: s.id + '-c', sourceDough: s.name, target: s.target, ratio: s.ratio, unit: s.unit
         }));
       } catch (e) {}
    }
    return [
      { id: '1', sourceDough: 'ครัวซองค์', target: 'ครัวซองค์เนยสด', ratio: 34, unit: 'ชิ้น' },
      { id: '2', sourceDough: 'ครัวซองค์', target: 'ครัวซองค์ช็อคโกแลต', ratio: 40, unit: 'ชิ้น' },
    ];
  });

  const [itemSettings, setItemSettings] = useState<{ id: string; targetItem: string; menu: string; }[]>(() => {
    const saved = localStorage.getItem('bakeryItemSettings');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved); 
        // Migrate old settings if they have 'unit' instead of 'menu'
        return parsed.map((s: any) => ({
          ...s,
          menu: s.menu || s.unit || ''
        }));
      } catch (e) {}
    }
    return [];
  });

  const [tempMixingSettings, setTempMixingSettings] = useState(mixingSettings);
  const [tempCuttingSettings, setTempCuttingSettings] = useState(cuttingSettings);
  const [tempItemSettings, setTempItemSettings] = useState(itemSettings);

  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSettingsError, setSaveSettingsError] = useState<string | null>(null);

  const [doughTemplates, setDoughTemplates] = useState<{ id: string, name: string, mixingData: any[] }[]>(() => {
    const saved = localStorage.getItem('bakeryDoughTemplates');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [showLoadTemplateModal, setShowLoadTemplateModal] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [createTemplateName, setCreateTemplateName] = useState('');
  const [createTemplateItems, setCreateTemplateItems] = useState<any[]>([]);
  const [createTemplateCuttingItems, setCreateTemplateCuttingItems] = useState<any[]>([]);

  const initCreateTemplate = () => {
    setCreateTemplateItems([{
      id: `tmpl-mix-${Date.now()}`,
      name: '',
      unit: '',
      size: '',
      mon: { p: '' }, tue: { p: '' }, wed: { p: '' }, thu: { p: '' },
      fri: { p: '' }, sat: { p: '' }, sun: { p: '' },
    }]);
    setCreateTemplateCuttingItems([{
      id: `tmpl-cut-${Date.now()}`,
      name: '',
      sourceDough: '',
      unit: '',
      mon: { p: '' }, tue: { p: '' }, wed: { p: '' }, thu: { p: '' },
      fri: { p: '' }, sat: { p: '' }, sun: { p: '' },
    }]);
    setCreateTemplateName('');
    setShowCreateTemplateModal(true);
    setShowLoadTemplateModal(false);
  };

  const addCreateTemplateRow = () => {
    setCreateTemplateItems([...createTemplateItems, {
      id: `tmpl-mix-${Date.now()}`,
      name: '',
      unit: '',
      size: '',
      mon: { p: '' }, tue: { p: '' }, wed: { p: '' }, thu: { p: '' },
      fri: { p: '' }, sat: { p: '' }, sun: { p: '' },
    }]);
  };

  const addCreateTemplateCuttingRow = () => {
    setCreateTemplateCuttingItems([...createTemplateCuttingItems, {
      id: `tmpl-cut-${Date.now()}`,
      name: '',
      sourceDough: '',
      unit: '',
      mon: { p: '' }, tue: { p: '' }, wed: { p: '' }, thu: { p: '' },
      fri: { p: '' }, sat: { p: '' }, sun: { p: '' },
    }]);
  };

  const handleSaveCreatedTemplate = () => {
    if (!createTemplateName.trim()) return;
    if (doughTemplates.length >= 20) {
      alert('บันทึกแผนงานได้สูงสุด 20 แผนงานเท่านั้น');
      return;
    }
    
    // Map back to have a, ac, w as ''
    const mixingData = createTemplateItems.map((row: any) => ({
      ...row,
      mon: { ...row.mon, a: '', ac: '', w: '' },
      tue: { ...row.tue, a: '', ac: '', w: '' },
      wed: { ...row.wed, a: '', ac: '', w: '' },
      thu: { ...row.thu, a: '', ac: '', w: '' },
      fri: { ...row.fri, a: '', ac: '', w: '' },
      sat: { ...row.sat, a: '', ac: '', w: '' },
      sun: { ...row.sun, a: '', ac: '', w: '' },
    }));

    const cuttingData = createTemplateCuttingItems.map((row: any) => ({
      ...row,
      mon: { ...row.mon, a: '', ac: '', w: '' },
      tue: { ...row.tue, a: '', ac: '', w: '' },
      wed: { ...row.wed, a: '', ac: '', w: '' },
      thu: { ...row.thu, a: '', ac: '', w: '' },
      fri: { ...row.fri, a: '', ac: '', w: '' },
      sat: { ...row.sat, a: '', ac: '', w: '' },
      sun: { ...row.sun, a: '', ac: '', w: '' },
    }));

    const newTemplate = { id: Date.now().toString(), name: createTemplateName, mixingData, cuttingData };
    saveDoughTemplates([...doughTemplates, newTemplate]);
    setShowCreateTemplateModal(false);
  };

  // Fetch settings from Supabase on mount
  useEffect(() => {
    const fetchLatestSettings = async () => {
      if (!supabase) return;
      try {
        const { data: dbSettings, error } = await supabase.from('app_settings').select('*').eq('branch', branch);
        if (error) throw error;
        if (dbSettings && dbSettings.length > 0) {
          dbSettings.forEach((setting: any) => {
            if (setting.setting_key === 'bakery_mixing_settings') {
              const parsed = setting.setting_value;
              setMixingSettings(parsed);
              setTempMixingSettings(parsed);
              localStorage.setItem('bakeryMixingSettings', JSON.stringify(parsed));
            } else if (setting.setting_key === 'bakery_cutting_settings') {
              const parsed = setting.setting_value;
              setCuttingSettings(parsed);
              setTempCuttingSettings(parsed);
              localStorage.setItem('bakeryCuttingSettings', JSON.stringify(parsed));
            } else if (setting.setting_key === 'bakery_item_settings') {
              const parsed = setting.setting_value;
              setItemSettings(parsed);
              setTempItemSettings(parsed);
              localStorage.setItem('bakeryItemSettings', JSON.stringify(parsed));
            } else if (setting.setting_key === 'bakery_dough_templates') {
              const parsed = setting.setting_value;
              setDoughTemplates(parsed);
              localStorage.setItem('bakeryDoughTemplates', JSON.stringify(parsed));
            }
          });
        }
      } catch (err) {
        console.warn("Failed to fetch bakery settings from Supabase:", err);
      }
    };

    fetchLatestSettings();
  }, [branch]);

  const saveDoughTemplates = async (newTemplates: { id: string, name: string, mixingData: any[] }[]) => {
    if (newTemplates.length > 20) {
      alert('บันทึกแผนงานได้สูงสุด 20 แผนงานเท่านั้น');
      return;
    }
    setDoughTemplates(newTemplates);
    localStorage.setItem('bakeryDoughTemplates', JSON.stringify(newTemplates));
    if (supabase) {
      await supabase.from('app_settings').upsert([
        { 
          branch, setting_key: 'bakery_dough_templates', 
          setting_value: newTemplates,
          updated_at: new Date().toISOString() 
        }
      ], { onConflict: 'setting_key,branch' });
    }
  };

  const handleSaveTemplate = () => {
    if (!templateNameInput.trim()) return;
    if (doughTemplates.length >= 20) {
      alert('บันทึกแผนงานได้สูงสุด 20 แผนงานเท่านั้น กรุณาลบแผนงานเก่าออกก่อนตกลง');
      return;
    }
    
    // Copy only the planned ('p') values, clear actuals
    const mixingData = data.mixing.map((row: any) => ({
      ...row,
      tue: { ...row.tue, a: '', ac: '', w: '' },
      wed: { ...row.wed, a: '', ac: '', w: '' },
      thu: { ...row.thu, a: '', ac: '', w: '' },
      fri: { ...row.fri, a: '', ac: '', w: '' },
      sat: { ...row.sat, a: '', ac: '', w: '' },
      sun: { ...row.sun, a: '', ac: '', w: '' },
      mon: { ...row.mon, a: '', ac: '', w: '' },
    }));

    const cuttingData = data.cutting.map((row: any) => ({
      ...row,
      tue: { ...row.tue, a: '', ac: '', w: '' },
      wed: { ...row.wed, a: '', ac: '', w: '' },
      thu: { ...row.thu, a: '', ac: '', w: '' },
      fri: { ...row.fri, a: '', ac: '', w: '' },
      sat: { ...row.sat, a: '', ac: '', w: '' },
      sun: { ...row.sun, a: '', ac: '', w: '' },
      mon: { ...row.mon, a: '', ac: '', w: '' },
    }));

    const newTemplate = { id: Date.now().toString(), name: templateNameInput, mixingData, cuttingData };
    saveDoughTemplates([...doughTemplates, newTemplate]);
    setShowSaveTemplateModal(false);
    setTemplateNameInput('');
  };

  const handleDeleteTemplate = (index: number) => {
    if (window.confirm('คุณต้องการลบแผนงานนี้ใช่หรือไม่?')) {
      const newTemplates = [...doughTemplates];
      newTemplates.splice(index, 1);
      saveDoughTemplates(newTemplates);
    }
  };

  const handleLoadTemplate = (template: any) => {
    const templateMixingData = template.mixingData || [];
    const templateCuttingData = template.cuttingData || [];
    
    // Process Mixing
    const newDataMixing = data.mixing.map((currentRow: any) => {
      // Find matching row by name and unit and size (id might differ if created from scratch)
      const templateRow = templateMixingData.find((r: any) => 
        (r.id === currentRow.id) || (r.name && r.name === currentRow.name && r.unit === currentRow.unit && r.size === currentRow.size)
      );
      if (templateRow) {
        return {
          ...currentRow,
          tue: { ...currentRow.tue, p: templateRow.tue?.p || '' },
          wed: { ...currentRow.wed, p: templateRow.wed?.p || '' },
          thu: { ...currentRow.thu, p: templateRow.thu?.p || '' },
          fri: { ...currentRow.fri, p: templateRow.fri?.p || '' },
          sat: { ...currentRow.sat, p: templateRow.sat?.p || '' },
          sun: { ...currentRow.sun, p: templateRow.sun?.p || '' },
          mon: { ...currentRow.mon, p: templateRow.mon?.p || '' },
        };
      }
      return currentRow;
    });

    // Add rows from template that didn't match existing data
    const newTemplateRows = templateMixingData.filter((r: any) => 
      !newDataMixing.some((c: any) => 
        (r.id === c.id) || (r.name && r.name === c.name && r.unit === c.unit && r.size === c.size)
      )
    ).filter((r:any) => r.name); // only add if name is set

    const rowsToAdd = newTemplateRows.map((r: any) => ({
      id: `tmpl-load-mix-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: r.name,
      unit: r.unit,
      size: r.size,
      note: '',
      tue: { p: r.tue?.p || '', a: '', ac: '', w: '' },
      wed: { p: r.wed?.p || '', a: '', ac: '', w: '' },
      thu: { p: r.thu?.p || '', a: '', ac: '', w: '' },
      fri: { p: r.fri?.p || '', a: '', ac: '', w: '' },
      sat: { p: r.sat?.p || '', a: '', ac: '', w: '' },
      sun: { p: r.sun?.p || '', a: '', ac: '', w: '' },
      mon: { p: r.mon?.p || '', a: '', ac: '', w: '' },
    }));

    // Process Cutting
    const newDataCutting = data.cutting.map((currentRow: any) => {
      const templateRow = templateCuttingData.find((r: any) => 
        (r.id === currentRow.id) || (r.name && r.name === currentRow.name && r.sourceDough === currentRow.sourceDough && r.unit === currentRow.unit)
      );
      if (templateRow) {
        return {
          ...currentRow,
          tue: { ...currentRow.tue, p: templateRow.tue?.p || '' },
          wed: { ...currentRow.wed, p: templateRow.wed?.p || '' },
          thu: { ...currentRow.thu, p: templateRow.thu?.p || '' },
          fri: { ...currentRow.fri, p: templateRow.fri?.p || '' },
          sat: { ...currentRow.sat, p: templateRow.sat?.p || '' },
          sun: { ...currentRow.sun, p: templateRow.sun?.p || '' },
          mon: { ...currentRow.mon, p: templateRow.mon?.p || '' },
        };
      }
      return currentRow;
    });

    const newCuttingRows = templateCuttingData.filter((r: any) => 
      !newDataCutting.some((c: any) => 
        (r.id === c.id) || (r.name && r.name === c.name && r.sourceDough === c.sourceDough && r.unit === c.unit)
      )
    ).filter((r:any) => r.name);

    const cuttingRowsToAdd = newCuttingRows.map((r: any) => ({
      id: `tmpl-load-cut-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: r.name,
      sourceDough: r.sourceDough,
      unit: r.unit,
      note: '',
      tue: { p: r.tue?.p || '', a: '', ac: '', w: '' },
      wed: { p: r.wed?.p || '', a: '', ac: '', w: '' },
      thu: { p: r.thu?.p || '', a: '', ac: '', w: '' },
      fri: { p: r.fri?.p || '', a: '', ac: '', w: '' },
      sat: { p: r.sat?.p || '', a: '', ac: '', w: '' },
      sun: { p: r.sun?.p || '', a: '', ac: '', w: '' },
      mon: { p: r.mon?.p || '', a: '', ac: '', w: '' },
    }));

    setData({ 
      ...data, 
      mixing: [...newDataMixing, ...rowsToAdd],
      cutting: [...newDataCutting, ...cuttingRowsToAdd]
    });
    setShowLoadTemplateModal(false);
  };

  const executeSave = async () => {
    const now = new Date();
    const userData = { date: now.toISOString(), user: 'Admin' };
    localStorage.setItem('bakeryPlanData', JSON.stringify(data));
    localStorage.setItem('bakeryPlanLastSaved', JSON.stringify(userData));
    setLastSaved({ date: now, user: 'Admin' });
    
    // Save to history (up to 8 weeks)
    try {
      const historyStr = localStorage.getItem('bakeryPlanHistory');
      let history = historyStr ? JSON.parse(historyStr) : [];
      const weekKey = format(currentWeek, 'yyyy-MM-dd');
      
      const newRecord = {
        weekKey,
        weekLabel: `${format(currentWeek, 'd MMM', { locale: th })} - ${format(addDays(currentWeek, 6), 'd MMM yyyy', { locale: th })}`,
        savedAt: now.toISOString(),
        user: 'Admin',
        data: data
      };
      
      // Update existing week or add new
      const existingIndex = history.findIndex((h: any) => h.weekKey === weekKey);
      if (existingIndex >= 0) {
        history[existingIndex] = newRecord;
      } else {
        history.unshift(newRecord);
      }
      
      // Keep only last 24
      history = history.slice(0, 24);
      localStorage.setItem('bakeryPlanHistory', JSON.stringify(history));

      if (supabase) {
        await supabase.from('bakery_plan_records').upsert({ 
          branch,
          week_key: newRecord.weekKey,
          week_label: newRecord.weekLabel,
          saved_at: newRecord.savedAt,
          user_name: newRecord.user,
          plan_data: newRecord.data
        }, { onConflict: 'week_key,branch' });
      }

      // LINE Notification
      sendLineNotification(
        `\n🍞 [แผนงานเบเกอรี่ (Bakery Plan) - อัปเดตสัปดาห์ใหม่]\n` +
        `👤 ผู้บันทึก: Admin\n` +
        `📅 ช่วงเวลา: ${newRecord.weekLabel}\n` +
        `✅ สถานะ: บันทึกเข้าสู่ฐานข้อมูลระบบสต็อกและการผลิตเรียบร้อยแล้ว`,
        'notifyOnBakeryPlan'
      );

      // Discord Notification
      sendDiscordNotification(
        `🍞 **[แผนงานเบเกอรี่ (Bakery Plan) - อัปเดตสัปดาห์ใหม่]**\n` +
        `👤 ผู้บันทึก: Admin\n` +
        `📅 ช่วงเวลา: ${newRecord.weekLabel}\n` +
        `✅ สถานะ: บันทึกเข้าสู่ฐานข้อมูลระบบสต็อกและการผลิตเรียบร้อยแล้ว`,
        'notifyOnBakeryPlan'
      );
    } catch (e) {
      console.warn('Failed to save bakery plan history', e);
    }
    
    if (onSave) {
      onSave(`${format(currentWeek, 'd MMM', { locale: th })} - ${format(addDays(currentWeek, 6), 'd MMM yyyy', { locale: th })}`);
    }
    
    setShowConfirmSave(false);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const openSettings = () => {
    setTempMixingSettings(mixingSettings);
    setTempCuttingSettings(cuttingSettings);
    setTempItemSettings(itemSettings);
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSaveSettingsError(null);
    try {
      setMixingSettings(tempMixingSettings);
      setCuttingSettings(tempCuttingSettings);
      setItemSettings(tempItemSettings);

      localStorage.setItem('bakeryMixingSettings', JSON.stringify(tempMixingSettings));
      localStorage.setItem('bakeryCuttingSettings', JSON.stringify(tempCuttingSettings));
      localStorage.setItem('bakeryItemSettings', JSON.stringify(tempItemSettings));

      if (supabase) {
        const { error } = await supabase.from('app_settings').upsert([
          { 
            branch, setting_key: 'bakery_mixing_settings', 
            setting_value: tempMixingSettings,
            updated_at: new Date().toISOString() 
          },
          { 
            branch, setting_key: 'bakery_cutting_settings', 
            setting_value: tempCuttingSettings,
            updated_at: new Date().toISOString() 
          },
          { 
            branch, setting_key: 'bakery_item_settings', 
            setting_value: tempItemSettings,
            updated_at: new Date().toISOString() 
          }
        ]);
        
        if (error) {
          console.warn("Failed to save settings to Supabase, but saved locally:", error);
        } else {
          try {
            await supabase.from('audit_logs').insert({
              id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
              timestamp: new Date().toISOString(),
              user_email: 'Admin',
              user_role: 'Admin',
              action: 'อัปเดตการตั้งค่าสัดส่วนเบเกอรี่',
              details: `แก้ไขสูตรผสมโด และการตั้งค่า Loss ใน Supabase คลาวด์เรียบร้อย`
            });
          } catch (e) {}
        }
      }
      setIsSettingsOpen(false);
    } catch (err: any) {
      console.warn(err);
      setSaveSettingsError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddItem = (section: keyof typeof data) => {
    const newItem = {
      id: `new-${Date.now()}`,
      name: '',
      unit: '',
    } as any;
    
    if (section === 'sales') {
      newItem.leftoverPlan = '';
      DAYS.forEach(d => {
        newItem[d.key] = { p: '', a: '', t: '', s: '', l: '' };
      });
    } else {
      newItem.note = '';
      DAYS.forEach(d => {
        newItem[d.key] = { p: '', a: '', ac: '', w: '' };
      });
    }

    setData(prev => ({
      ...prev,
      [section]: [...(prev[section] as any[]), newItem]
    }));
  };

  const handleDeleteItem = (section: keyof typeof data, id: string) => {
    setData(prev => ({
      ...prev,
      [section]: (prev[section] as any[]).filter((item: any) => item.id !== id)
    }));
  };

  const handleRowFieldChange = (section: keyof typeof data, id: string, field: string, value: string) => {
    setData(prev => ({
      ...prev,
      [section]: (prev[section] as any[]).map((item: any) => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const handleDataChange = (section: keyof typeof data, id: string, day: string, field: string, value: string) => {
    setData(prev => {
      const sectionData = prev[section] as any[];
      return {
        ...prev,
        [section]: sectionData.map(item => {
          if (item.id === id) {
            return {
              ...item,
              [day]: {
                ...item[day],
                [field]: value
              }
            };
          }
          return item;
        })
      };
    });
  };

  const renderStandardTable = (section: 'mixing' | 'cutting' | 'items', title: string) => {
    const list = data[section];
    
    return (
      <div className="overflow-x-auto shadow-xs rounded-xl border border-[#D4E4E3] border-t-2 border-t-[#5A8A88] max-h-[70vh] bg-white">
        <table className="min-w-full divide-y divide-[#D4E4E3] relative table-fixed">
          <thead className="bg-[#E8F3F2] sticky top-0 z-20 backdrop-blur-xs">
            <tr>
              <th scope="col" className="py-3 pl-3 pr-2 text-left text-[13px] font-bold text-[#2D4A49] sticky left-0 z-30 bg-[#E8F3F2] border-r border-b border-[#D4E4E3] min-w-[140px] md:min-w-[200px] w-[140px] md:w-[200px] max-w-[140px] md:max-w-[200px] backdrop-blur-xs">
                รายการ
              </th>
              <th scope="col" className="px-2 py-3 text-center text-[13px] font-bold text-[#2D4A49] border-r border-b border-[#D4E4E3] sticky left-[140px] md:left-[200px] z-30 bg-[#E8F3F2] min-w-[90px] md:min-w-[120px] w-[90px] md:w-[120px] max-w-[90px] md:max-w-[120px] backdrop-blur-xs">
                {section === 'cutting' ? 'ตัดจาก' : section === 'items' ? 'เมนู' : 'หน่วย'}
              </th>
              {(section === 'mixing' || section === 'cutting') && (
                <th scope="col" className="hidden md:table-cell px-2 py-3 text-center text-[13px] font-bold text-[#2D4A49] border-r border-b border-[#D4E4E3] md:sticky md:left-[320px] min-w-[120px] w-[120px] max-w-[120px] z-30 bg-[#E8F3F2] backdrop-blur-xs">
                  {section === 'cutting' ? 'หน่วยต่อสูตร (Unit)' : 'ขนาด'}
                </th>
              )}
              {DAYS.map((day, index) => {
                const dayDate = addDays(currentWeek, index);
                return (
                  <th key={day.key} colSpan={4} className="px-3 py-2.5 text-center text-[13px] text-[#2D4A49] border-r border-b border-l-2 border-[#D4E4E3] border-l-[#B8D4D2]">
                    <div className="font-bold">{day.label}</div>
                    <div className="text-[11px] font-medium text-[#6B8F8E] mt-0.5">{format(dayDate, 'd MMM', { locale: th })}</div>
                  </th>
                );
              })}
            </tr>
            <tr className="bg-[#F8FAF9] text-[11px] text-[#6B8F8E]">
              <th className="sticky left-0 z-30 bg-[#F8FAF9] border-r border-b border-[#D4E4E3] backdrop-blur-xs"></th>
              <th className="sticky left-[140px] md:left-[200px] z-30 bg-[#F8FAF9] border-r border-b border-[#D4E4E3] backdrop-blur-xs"></th>
              {(section === 'mixing' || section === 'cutting') && <th className="hidden md:table-cell md:sticky md:left-[320px] z-30 bg-[#F8FAF9] border-r border-b border-[#D4E4E3] backdrop-blur-xs"></th>}
              {DAYS.map(day => (
                <React.Fragment key={day.key}>
                  <th className="font-semibold px-1 py-1.5 text-center border-l-2 border-b border-l-[#B8D4D2] border-[#D4E4E3] bg-[#F8FAF9] text-[#2D4A49] min-w-[48px]">วางแผน</th>
                  <th className="font-semibold px-1 py-1.5 text-center border-l border-b border-[#D4E4E3] bg-[#FEF3C7]/40 text-[#D97706] min-w-[48px]">ขอเพิ่ม</th>
                  <th className="font-semibold px-1 py-1.5 text-center border-l border-b border-[#D4E4E3] bg-[#DCFCE7]/40 text-[#16A34A] min-w-[48px]">ทำได้</th>
                  <th className="font-semibold px-1 py-1.5 text-center border-l border-b border-[#D4E4E3] bg-[#FEE2E2]/40 text-[#EF4444] min-w-[48px]">ทำเสีย</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D4E4E3] bg-white">
            {list.map((item) => (
              <tr key={item.id} className="hover:bg-[#F0F5F4]/60 transition-colors group">
                <td className="whitespace-nowrap py-2.5 pl-2 pr-3 text-[13px] font-medium text-[#2D4A49] sticky left-0 z-10 bg-white group-hover:bg-[#F8FAF9] border-r border-[#D4E4E3] shadow-[1px_0_0_0_#D4E4E3] min-w-[140px] md:min-w-[200px] w-[140px] md:w-[200px] max-w-[140px] md:max-w-[200px]">
                  <div className="flex items-start gap-2">
                    {!isReadOnly && (
                      <button onClick={() => handleDeleteItem(section, item.id)} className="mt-0.5 p-1 text-[#6B8F8E] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer" title="ลบรายการ">
                        <Trash2 size={15} />
                      </button>
                    )}
                    <div className="flex flex-col gap-1 w-full min-w-[110px]">
                      {section === 'mixing' ? (
                        <select 
                          value={item.name} 
                          disabled={isReadOnly}
                          onChange={(e) => {
                             const newName = e.target.value;
                             const options = mixingSettings.filter(s => s.name === newName);
                             let updates: any = { name: newName };
                             if (options.length > 0) {
                               const firstOpt = options[0];
                               updates.unit = firstOpt.unit;
                               updates.size = firstOpt.size || '';
                             } else {
                               updates.unit = '';
                               updates.size = '';
                             }
                             setData(prev => ({
                               ...prev,
                               mixing: prev.mixing.map((it: any) => it.id === item.id ? { ...it, ...updates } : it)
                             }));
                          }}
                          className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] font-medium text-[#2D4A49] outline-none"
                        >
                          <option value="">เลือกชนิดแป้ง...</option>
                          {Array.from(new Set(mixingSettings.map(s => s.name).filter(Boolean))).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : section === 'cutting' ? (
                        <select
                          value={item.name}
                          disabled={isReadOnly}
                          onChange={(e) => {
                             const newName = e.target.value;
                             const options = cuttingSettings.filter(s => s.target === newName);
                             let updates: any = { name: newName };
                             if (options.length > 0) {
                               const firstOpt = options[0];
                               updates.sourceDough = firstOpt.sourceDough;
                               const mix = mixingSettings.find(m => m.name === firstOpt.sourceDough);
                               updates.unit = mix ? mix.unit : '';
                             } else {
                               updates.sourceDough = '';
                               updates.unit = '';
                             }
                             setData(prev => ({
                               ...prev,
                               cutting: prev.cutting.map((it: any) => it.id === item.id ? { ...it, ...updates } : it)
                             }));
                          }}
                          className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] font-medium text-[#2D4A49] outline-none"
                        >
                          <option value="">เลือกเป้าหมาย...</option>
                          {Array.from(new Set(cuttingSettings.map(s => s.target).filter(Boolean))).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : section === 'items' ? (
                        <select
                          value={item.name}
                          disabled={isReadOnly}
                          onChange={(e) => {
                             const newName = e.target.value;
                             const options = itemSettings.filter(s => s.targetItem === newName);
                             let updates: any = { name: newName };
                             if (options.length > 0) {
                               updates.unit = options[0].menu;
                             } else {
                               updates.unit = '';
                             }
                             setData(prev => ({
                               ...prev,
                               items: prev.items.map((it: any) => it.id === item.id ? { ...it, ...updates } : it)
                             }));
                          }}
                          className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] font-medium text-[#2D4A49] outline-none"
                        >
                          <option value="">เลือกรายการผลผลิต...</option>
                          {Array.from(new Set(itemSettings.map(s => s.targetItem).filter(Boolean))).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex flex-col gap-1 w-full">
                          <input 
                            type="text" 
                            value={item.name} 
                            disabled={isReadOnly}
                            placeholder="ชื่อรายการ"
                            onChange={(e) => handleRowFieldChange(section, item.id, 'name', e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] font-medium text-[#2D4A49] outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap py-2.5 px-3 text-[13px] text-[#6B8F8E] border-r border-[#D4E4E3] text-center sticky left-[140px] md:left-[200px] z-10 bg-white group-hover:bg-[#F8FAF9] shadow-[1px_0_0_0_#D4E4E3] min-w-[90px] md:min-w-[120px] w-[90px] md:w-[120px] max-w-[90px] md:max-w-[120px]">
                  {section === 'mixing' ? (
                    <select
                      value={item.unit}
                      disabled={isReadOnly}
                      onChange={(e) => {
                         const newUnit = e.target.value;
                         const option = mixingSettings.find(s => s.name === item.name && s.unit === newUnit);
                         let updates: any = { unit: newUnit };
                         if (option) {
                           updates.size = option.size || '';
                         }
                         setData(prev => ({
                           ...prev,
                           mixing: prev.mixing.map((it: any) => it.id === item.id ? { ...it, ...updates } : it)
                         }));
                      }}
                      className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] text-center text-[#2D4A49] outline-none"
                    >
                      <option value="">เลือกหน่วย...</option>
                      {Array.from(new Set(mixingSettings.filter(s => s.name === item.name).map(s => s.unit).filter(Boolean))).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : section === 'cutting' ? (
                    <select
                      value={item.sourceDough || ''}
                      disabled={isReadOnly}
                      onChange={(e) => {
                         const newSource = e.target.value;
                         let updates: any = { sourceDough: newSource };
                         const mix = mixingSettings.find(m => m.name === newSource);
                         if (mix) {
                           updates.unit = mix.unit || '';
                         } else {
                           updates.unit = '';
                         }
                         setData(prev => ({
                           ...prev,
                           cutting: prev.cutting.map((it: any) => it.id === item.id ? { ...it, ...updates } : it)
                         }));
                      }}
                      className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] text-center text-[#2D4A49] outline-none"
                    >
                      <option value="">เลือก Dough...</option>
                      {Array.from(new Set(cuttingSettings.filter(s => s.target === item.name).map(s => s.sourceDough).filter(Boolean))).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : section === 'items' ? (
                    <select
                      value={item.unit || ''}
                      disabled={isReadOnly}
                      onChange={(e) => handleRowFieldChange(section, item.id, 'unit', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] text-center text-[#2D4A49] outline-none"
                    >
                      <option value="">เลือกเมนู...</option>
                      {Array.from(new Set(itemSettings.filter(s => s.targetItem === item.name).map(s => s.menu).filter(Boolean))).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      value={item.unit} 
                      disabled={isReadOnly}
                      placeholder="หน่วย"
                      onChange={(e) => handleRowFieldChange(section, item.id, 'unit', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] text-center text-[#2D4A49] outline-none"
                    />
                  )}
                </td>
                {(section === 'mixing' || section === 'cutting') && (
                  <td className="whitespace-nowrap py-2.5 px-3 text-[13px] text-[#6B8F8E] border-r border-[#D4E4E3] text-center hidden md:table-cell md:sticky md:left-[320px] z-10 bg-white group-hover:bg-[#F8FAF9] shadow-[1px_0_0_0_#D4E4E3]">
                    {section === 'mixing' ? (
                      <select
                        value={item.size || ''}
                        disabled={isReadOnly}
                        onChange={(e) => {
                           const newSize = e.target.value;
                           setData(prev => ({
                             ...prev,
                             mixing: prev.mixing.map((it: any) => it.id === item.id ? { ...it, size: newSize } : it)
                           }));
                        }}
                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] text-center text-[#2D4A49] outline-none"
                      >
                        <option value="">เลือกขนาด...</option>
                        {Array.from(new Set(mixingSettings.filter(s => s.name === item.name && s.unit === item.unit).map(s => s.size).filter(Boolean))).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : section === 'cutting' ? (
                      <select
                        value={item.unit || ''}
                        disabled={isReadOnly}
                        onChange={(e) => handleRowFieldChange(section, item.id, 'unit', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] text-center text-[#2D4A49] outline-none"
                      >
                        <option value="">เลือกหน่วย...</option>
                        {Array.from(new Set(mixingSettings.filter(s => s.name === item.sourceDough).map(s => s.unit).filter(Boolean))).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : null}
                  </td>
                )}
                {DAYS.map(day => {
                  const dData = (item as any)[day.key];
                  return (
                    <React.Fragment key={day.key}>
                      <td className="border-l-2 border-b border-r-0 border-l-[#B8D4D2] border-[#D4E4E3] p-0 text-center relative min-w-[48px]">
                        <input type="text" value={dData?.p || ''} disabled={isReadOnly} onChange={(e) => handleDataChange(section, item.id, day.key, 'p', e.target.value)} className="w-full h-full min-h-[44px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-[#5A8A88] p-0 m-0 text-[13px] bg-transparent text-[#2D4A49] outline-none" />
                      </td>
                      <td className="border-l border-b border-[#D4E4E3] p-0 text-center relative min-w-[48px] bg-[#FEF3C7]/20">
                        <input type="text" value={dData?.a || ''} disabled={isReadOnly} onChange={(e) => handleDataChange(section, item.id, day.key, 'a', e.target.value)} className="w-full h-full min-h-[44px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-[#F59E0B] p-0 m-0 text-[13px] bg-transparent text-[#B45309] font-medium outline-none" />
                      </td>
                      <td className="border-l border-b border-[#D4E4E3] p-0 text-center relative min-w-[48px] bg-[#DCFCE7]/20">
                        <input type="text" value={dData?.ac || ''} disabled={isReadOnly} onChange={(e) => handleDataChange(section, item.id, day.key, 'ac', e.target.value)} className="w-full h-full min-h-[44px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-[#22C55E] p-0 m-0 text-[13px] bg-transparent font-bold text-[#15803D] outline-none" />
                      </td>
                      <td className="border-l border-b border-[#D4E4E3] p-0 text-center relative min-w-[48px] bg-[#FEE2E2]/20">
                        <input type="text" value={dData?.w || ''} disabled={isReadOnly} onChange={(e) => handleDataChange(section, item.id, day.key, 'w', e.target.value)} className="w-full h-full min-h-[44px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-[#EF4444] p-0 m-0 text-[13px] bg-transparent font-medium text-[#DC2626] outline-none" />
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
            {!isReadOnly && (
              <tr className="bg-[#F8FAF9]">
                <td colSpan={2} className="md:hidden py-3 pl-4 sticky left-0 z-10 bg-[#F8FAF9] border-r border-[#D4E4E3] shadow-[1px_0_0_0_#D4E4E3]">
                  <button onClick={() => handleAddItem(section)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5A8A88] hover:text-[#4A7876] hover:bg-[#E8F3F2] px-3 py-1.5 rounded-lg border border-[#D4E4E3] transition-colors bg-white shadow-xs cursor-pointer">
                    <Plus size={14} className="text-[#5A8A88]" />
                    เพิ่มรายการ
                  </button>
                </td>
                <td colSpan={(section === 'mixing' || section === 'cutting') ? 3 : 2} className="hidden md:table-cell py-3 pl-4 sticky left-0 z-10 bg-[#F8FAF9] border-r border-[#D4E4E3] shadow-[1px_0_0_0_#D4E4E3]">
                  <button onClick={() => handleAddItem(section)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5A8A88] hover:text-[#4A7876] hover:bg-[#E8F3F2] px-3 py-1.5 rounded-lg border border-[#D4E4E3] transition-colors bg-white shadow-xs cursor-pointer">
                    <Plus size={14} className="text-[#5A8A88]" />
                    เพิ่มรายการ
                  </button>
                </td>
                <td colSpan={DAYS.length * 4} className="py-2 bg-[#F8FAF9]"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSalesTable = () => {
    return (
      <div className="overflow-x-auto shadow-xs rounded-xl border border-[#D4E4E3] border-t-2 border-t-[#5A8A88] max-h-[70vh] bg-white">
        <table className="min-w-full divide-y divide-[#D4E4E3] relative table-fixed">
          <thead className="bg-[#E8F3F2] sticky top-0 z-20 backdrop-blur-xs">
            <tr>
              <th scope="col" className="py-3 pl-3 pr-2 text-center text-[12px] md:text-[13px] font-bold text-[#2D4A49] sticky left-0 z-30 bg-[#E8F3F2] border-r border-b border-[#D4E4E3] min-w-[70px] w-[70px] max-w-[70px] backdrop-blur-xs">
                เหลือจากแผน
              </th>
              <th scope="col" className="py-3 pl-3 pr-2 text-left text-[12px] md:text-[13px] font-bold text-[#2D4A49] sticky left-[70px] z-30 bg-[#E8F3F2] min-w-[140px] md:min-w-[180px] w-[140px] md:w-[180px] max-w-[140px] md:max-w-[180px] border-r border-b border-[#D4E4E3] backdrop-blur-xs">
                รายการ
              </th>
              <th scope="col" className="hidden md:table-cell px-2 py-3 text-left text-[12px] md:text-[13px] font-bold text-[#2D4A49] border-r border-b border-[#D4E4E3] md:sticky md:left-[250px] z-30 bg-[#E8F3F2] min-w-[100px] w-[100px] max-w-[100px] backdrop-blur-xs">
                หน่วย
              </th>
              {DAYS.map((day, index) => {
                const dayDate = addDays(currentWeek, index);
                return (
                  <th key={day.key} colSpan={5} className="px-3 py-2.5 text-center text-[13px] text-[#2D4A49] border-r border-b border-l-2 border-[#D4E4E3] border-l-[#B8D4D2]">
                    <div className="font-bold">{day.label}</div>
                    <div className="text-[11px] font-medium text-[#6B8F8E] mt-0.5">{format(dayDate, 'd MMM', { locale: th })}</div>
                  </th>
                );
              })}
            </tr>
            <tr className="bg-[#F8FAF9] text-[11px] text-[#6B8F8E]">
              <th className="sticky left-0 z-30 bg-[#F8FAF9] border-r border-b border-[#D4E4E3] backdrop-blur-xs"></th>
              <th className="sticky left-[70px] z-30 bg-[#F8FAF9] border-r border-b border-[#D4E4E3] backdrop-blur-xs"></th>
              <th className="hidden md:table-cell md:sticky md:left-[250px] z-30 bg-[#F8FAF9] border-r border-b border-[#D4E4E3] backdrop-blur-xs"></th>
              {DAYS.map(day => (
                <React.Fragment key={day.key}>
                  <th className="font-semibold px-1 py-1.5 text-center border-l-2 border-b border-l-[#B8D4D2] border-[#D4E4E3] text-[#2D4A49] bg-[#F8FAF9] min-w-[48px]">วางแผน</th>
                  <th className="font-semibold px-1 py-1.5 text-center border-l border-b border-[#D4E4E3] text-[#D97706] bg-[#FEF3C7]/40 min-w-[48px]">ขอเพิ่ม</th>
                  <th className="font-bold px-1 py-1.5 text-center border-l border-b border-[#D4E4E3] text-[#5A8A88] bg-[#E8F3F2] min-w-[48px]">รวม</th>
                  <th className="font-semibold px-1 py-1.5 text-center border-l border-b border-[#D4E4E3] text-[#16A34A] bg-[#DCFCE7]/40 min-w-[48px]">ขายได้</th>
                  <th className="font-semibold px-1 py-1.5 text-center border-l border-b border-[#D4E4E3] text-[#EF4444] bg-[#FEE2E2]/40 min-w-[48px]">เหลือ</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D4E4E3] bg-white">
            {data.sales.map((item) => (
              <tr key={item.id} className="hover:bg-[#F0F5F4]/60 transition-colors group">
                <td className="whitespace-nowrap py-2.5 px-2 text-[13px] font-medium text-[#6B8F8E] sticky left-0 z-10 bg-white border-r border-[#D4E4E3] min-w-[70px] w-[70px] max-w-[70px] text-center group-hover:bg-[#F8FAF9] shadow-[1px_0_0_0_#D4E4E3]">
                  <div className="flex items-center gap-1 justify-center">
                    {!isReadOnly && (
                      <button onClick={() => handleDeleteItem('sales', item.id)} className="p-1 text-[#6B8F8E] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer" title="ลบรายการ">
                        <Trash2 size={15} />
                      </button>
                    )}
                    <input 
                      type="text" 
                      value={item.leftoverPlan || ''} 
                      disabled={isReadOnly}
                      onChange={(e) => handleRowFieldChange('sales', item.id, 'leftoverPlan', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] text-center text-[#2D4A49] outline-none"
                    />
                  </div>
                </td>
                <td className="whitespace-nowrap py-2.5 pl-3 pr-2 text-[13px] font-medium text-[#2D4A49] sticky left-[70px] z-10 bg-white border-r border-[#D4E4E3] group-hover:bg-[#F8FAF9] shadow-[1px_0_0_0_#D4E4E3] min-w-[140px] md:min-w-[180px] w-[140px] md:w-[180px] max-w-[140px] md:max-w-[180px]">
                  <input 
                    type="text" 
                    value={item.name || ''} 
                    disabled={isReadOnly}
                    placeholder="ชื่อรายการ"
                    onChange={(e) => handleRowFieldChange('sales', item.id, 'name', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] font-medium text-[#2D4A49] outline-none"
                  />
                </td>
                <td className="hidden md:table-cell whitespace-nowrap px-3 py-2.5 text-[13px] text-[#6B8F8E] border-r border-[#D4E4E3] text-center md:sticky md:left-[250px] z-10 bg-white group-hover:bg-[#F8FAF9] shadow-[1px_0_0_0_#D4E4E3]">
                  <input 
                    type="text" 
                    value={item.unit || ''} 
                    disabled={isReadOnly}
                    placeholder="หน่วย"
                    onChange={(e) => handleRowFieldChange('sales', item.id, 'unit', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#5A8A88] p-0 text-[13px] text-center text-[#2D4A49] outline-none"
                  />
                </td>
                {DAYS.map(day => {
                  const dData = (item as any)[day.key];
                  return (
                    <React.Fragment key={day.key}>
                      <td className="border-l-2 border-b border-r-0 border-l-[#B8D4D2] border-[#D4E4E3] p-0 text-center relative min-w-[48px]">
                        <input type="text" value={dData?.p || ''} disabled={isReadOnly} onChange={(e) => handleDataChange('sales', item.id, day.key, 'p', e.target.value)} className="w-full h-full min-h-[44px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-[#5A8A88] p-0 m-0 text-[13px] bg-transparent text-[#2D4A49] outline-none" />
                      </td>
                      <td className="border-l border-b border-[#D4E4E3] p-0 text-center relative min-w-[48px] bg-[#FEF3C7]/20">
                        <input type="text" value={dData?.a || ''} disabled={isReadOnly} onChange={(e) => handleDataChange('sales', item.id, day.key, 'a', e.target.value)} className="w-full h-full min-h-[44px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-[#F59E0B] p-0 m-0 text-[13px] bg-transparent text-[#B45309] font-medium outline-none" />
                      </td>
                      <td className="border-l border-b border-[#D4E4E3] p-0 text-center relative min-w-[48px] bg-[#E8F3F2]/50">
                        <input type="text" value={dData?.t || ''} disabled={isReadOnly} onChange={(e) => handleDataChange('sales', item.id, day.key, 't', e.target.value)} className="w-full h-full min-h-[44px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-[#5A8A88] p-0 m-0 text-[13px] bg-transparent font-bold text-[#2D4A49] outline-none" />
                      </td>
                      <td className="border-l border-b border-[#D4E4E3] p-0 text-center relative min-w-[48px] bg-[#DCFCE7]/20">
                        <input type="text" value={dData?.s || ''} disabled={isReadOnly} onChange={(e) => handleDataChange('sales', item.id, day.key, 's', e.target.value)} className="w-full h-full min-h-[44px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-[#22C55E] p-0 m-0 text-[13px] bg-transparent font-bold text-[#15803D] outline-none" />
                      </td>
                      <td className="border-l border-b border-[#D4E4E3] p-0 text-center relative min-w-[48px] bg-[#FEE2E2]/20">
                        <input type="text" value={dData?.l || ''} disabled={isReadOnly} onChange={(e) => handleDataChange('sales', item.id, day.key, 'l', e.target.value)} className="w-full h-full min-h-[44px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-[#EF4444] p-0 m-0 text-[13px] bg-transparent font-bold text-[#DC2626] outline-none" />
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
            {!isReadOnly && (
              <tr className="bg-[#F8FAF9]">
                <td colSpan={2} className="md:hidden py-3 pl-4 sticky left-0 z-10 bg-[#F8FAF9] border-r border-[#D4E4E3] shadow-[1px_0_0_0_#D4E4E3]">
                  <button onClick={() => handleAddItem('sales')} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5A8A88] hover:text-[#4A7876] hover:bg-[#E8F3F2] px-3 py-1.5 rounded-lg border border-[#D4E4E3] transition-colors bg-white shadow-xs cursor-pointer">
                    <Plus size={14} className="text-[#5A8A88]" />
                    เพิ่มรายการ
                  </button>
                </td>
                <td colSpan={3} className="hidden md:table-cell py-3 pl-4 sticky left-0 z-10 bg-[#F8FAF9] border-r border-[#D4E4E3] shadow-[1px_0_0_0_#D4E4E3]">
                  <button onClick={() => handleAddItem('sales')} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5A8A88] hover:text-[#4A7876] hover:bg-[#E8F3F2] px-3 py-1.5 rounded-lg border border-[#D4E4E3] transition-colors bg-white shadow-xs cursor-pointer">
                    <Plus size={14} className="text-[#5A8A88]" />
                    เพิ่มรายการ
                  </button>
                </td>
                <td colSpan={DAYS.length * 5 + 1} className="py-2 bg-[#F8FAF9]"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── HEADER CARD ───────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 sm:p-6 rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3]">
        <div className="flex items-center gap-3.5">
          <div className="bg-[#E8F3F2] p-2.5 rounded-xl shrink-0 text-[#5A8A88] flex items-center justify-center">
            <CalendarIcon className="text-[#5A8A88]" size={22} />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-[#2D4A49] leading-tight">แผนงาน Bakery</h2>
            <p className="text-[11px] sm:text-[12px] text-[#6B8F8E] mt-0.5">จัดการแผนการผลิตและการเตรียมงานของเบเกอรี่ ตารางแสดงข้อมูลรายสัปดาห์</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 w-full lg:w-auto">
          <div className="flex flex-col items-center w-full sm:w-auto">
            <div className="flex items-center justify-between w-full sm:w-auto gap-2 bg-[#F0F5F4] p-1.5 rounded-xl border border-[#D4E4E3] shadow-xs">
              <button 
                disabled={isReadOnly} 
                onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} 
                className={`p-2 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer ${isReadOnly ? 'text-[#7A9E9C] cursor-not-allowed opacity-40' : 'hover:bg-white text-[#2D4A49] active:scale-95'}`}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-2 px-2.5 sm:px-3 text-[12px] sm:text-[13px] font-semibold text-[#2D4A49] whitespace-nowrap">
                <CalendarIcon className="text-[#5A8A88] shrink-0" size={15} />
                <span>สัปดาห์ที่ {format(currentWeek, 'd MMM', { locale: th })} - {format(addDays(currentWeek, 6), 'd MMM yyyy', { locale: th })}</span>
              </div>
              <button 
                disabled={isReadOnly} 
                onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} 
                className={`p-2 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer ${isReadOnly ? 'text-[#7A9E9C] cursor-not-allowed opacity-40' : 'hover:bg-white text-[#2D4A49] active:scale-95'}`}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            {lastSaved && (
              <div className="text-[11px] text-[#6B8F8E] mt-1.5">
                Last saved: {format(lastSaved.date, 'dd MMM yyyy HH:mm')} by {lastSaved.user}
              </div>
            )}
          </div>
          {!isReadOnly && (
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button 
                onClick={() => setShowConfirmSave(true)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-[13px] transition-all shadow-xs cursor-pointer active:scale-95 ${showSaveSuccess ? 'bg-[#22C55E] hover:bg-[#16A34A] text-white' : 'bg-[#5A8A88] hover:bg-[#4A7876] text-white'}`}
              >
                {showSaveSuccess ? <Check size={18} /> : <Save size={18} />}
                <span>{showSaveSuccess ? 'บันทึกสำเร็จ' : 'บันทึกข้อมูล'}</span>
              </button>
              <button 
                onClick={() => openSettings()} 
                className="p-2.5 text-[#6B8F8E] bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] hover:text-[#5A8A88] rounded-xl transition-colors shadow-xs cursor-pointer" 
                title="ตั้งค่าระบบ"
              >
                <Settings size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── TABS & TABLE CONTAINER ───────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] overflow-hidden">
        <div className="flex border-b border-[#D4E4E3] overflow-x-auto hide-scrollbar bg-white">
          <button 
            onClick={() => setActiveTab('production')} 
            className={`px-6 py-3.5 text-[13px] font-bold whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'production' ? 'text-[#5A8A88] border-b-2 border-[#5A8A88] bg-[#E8F3F2]/50' : 'text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#F0F5F4]'}`}
          >
            แผนการผลิต (Production)
          </button>
          <button 
            onClick={() => setActiveTab('sales')} 
            className={`px-6 py-3.5 text-[13px] font-bold whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'sales' ? 'text-[#5A8A88] border-b-2 border-[#5A8A88] bg-[#E8F3F2]/50' : 'text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#F0F5F4]'}`}
          >
            ยอดจัดจำหน่าย / เหลือจากแผน
          </button>
        </div>

        <div className="p-0 bg-[#F0F5F4]/40 w-full overflow-hidden">
          <div className="mx-4 sm:mx-6 mt-5 text-[12px] font-semibold text-[#2D4A49] bg-[#E8F3F2] px-4 py-2.5 rounded-xl border border-[#B8D4D2] flex items-center justify-between gap-2 shadow-xs">
            <span className="flex items-center gap-1.5 leading-tight">
              📱 สำหรับมุมมองแท็บเล็ต (Tablet): เลื่อนสไลด์ตารางแผนงานไปทางซ้าย-ขวา เพื่อดูการป้อนข้อมูลแต่ละวันได้ครบถ้วน
            </span>
            <span className="text-[11px] text-[#5A8A88] font-bold bg-white px-2.5 py-0.5 rounded-md border border-[#D4E4E3] shrink-0 hidden sm:inline">
              Swipe Left/Right ↔️
            </span>
          </div>
          {activeTab === 'production' && (
            <div className="p-4 sm:p-6 space-y-10">
              {/* ── SECTION 1: MIXING ───────────────────────── */}
              <section>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3.5 gap-3">
                  <h3 className="text-[16px] font-bold text-[#2D4A49] flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#E8F3F2] text-[#5A8A88] border border-[#B8D4D2] text-[12px] font-bold shadow-xs">1</span>
                    ตี Dough (Mixing)
                  </h3>
                  
                  {!isReadOnly && (
                    <div className="flex items-center rounded-xl overflow-hidden border border-[#D4E4E3] shadow-xs w-fit">
                      <button 
                        onClick={() => setShowLoadTemplateModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E8F3F2] hover:bg-[#B8D4D2] text-[#5A8A88] text-[12px] font-semibold transition-colors border-r border-[#D4E4E3] cursor-pointer"
                      >
                        <CalendarIcon size={14} />
                        เลือกใช้แผนงาน ({doughTemplates.length}/20)
                      </button>
                      <button 
                        onClick={() => setShowSaveTemplateModal(true)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#5A8A88] hover:bg-[#4A7876] text-white text-[12px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                        disabled={doughTemplates.length >= 20}
                      >
                        <Save size={14} />
                        บันทึกเป็นแผนงาน
                      </button>
                    </div>
                  )}
                </div>
                {renderStandardTable('mixing', 'ตารางการตี Dough')}
              </section>

              {/* ── SECTION 2: CUTTING ───────────────────────── */}
              <section>
                <h3 className="text-[16px] font-bold text-[#2D4A49] mb-3.5 flex items-center gap-2.5 mt-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#E8F3F2] text-[#5A8A88] border border-[#B8D4D2] text-[12px] font-bold shadow-xs">2</span>
                  ตัด Dough (Cutting)
                </h3>
                {renderStandardTable('cutting', 'ตารางการตัด Dough')}
              </section>

              {/* ── SECTION 3: ITEMS ───────────────────────── */}
              <section>
                <h3 className="text-[16px] font-bold text-[#2D4A49] mb-3.5 flex items-center gap-2.5 mt-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#E8F3F2] text-[#5A8A88] border border-[#B8D4D2] text-[12px] font-bold shadow-xs">3</span>
                  ชิ้น/Unit (Item Output)
                </h3>
                {renderStandardTable('items', 'ตารางผลผลิต (ชิ้น)')}
              </section>
            </div>
          )}
          {activeTab === 'sales' && (
            <div className="p-4 sm:p-6">
              {renderSalesTable()}
            </div>
          )}
        </div>
      </div>
      
      <p className="text-[12px] text-[#6B8F8E] text-center mt-3 mb-6">
        * ข้อมูลในตารางจะถูกบันทึกชั่วคราวขณะใช้งาน กดปุ่มบันทึกข้อมูลเพื่ออัปเดตระบบ
      </p>

      {/* ── CONFIRM SAVE MODAL ───────────────────────── */}
      {showConfirmSave && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => setShowConfirmSave(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-[#D4E4E3] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-[#E8F3F2] text-[#5A8A88] rounded-full flex items-center justify-center mx-auto mb-3.5">
                <Save size={26} />
              </div>
              <h3 className="text-[16px] font-bold text-[#2D4A49] mb-1.5">ยืนยันการบันทึก</h3>
              <p className="text-[#6B8F8E] mb-5 text-[13px]">คุณต้องการอัปเดตข้อมูลแผนงานเข้าสู่ระบบใช่หรือไม่?</p>
              <div className="flex gap-2.5 justify-center">
                <button
                  type="button"
                  onClick={() => setShowConfirmSave(false)}
                  className="flex-1 px-4 py-2.5 text-[12px] font-semibold text-[#6B8F8E] hover:text-[#2D4A49] bg-[#F0F5F4] hover:bg-[#E2EAE9] rounded-xl transition-colors border border-[#D4E4E3] cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={executeSave}
                  className="flex-1 px-4 py-2.5 text-[12px] font-semibold text-white bg-[#5A8A88] hover:bg-[#4A7876] rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  ยืนยันการบันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SAVE TEMPLATE MODAL ───────────────────────── */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => setShowSaveTemplateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden border border-[#D4E4E3] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#D4E4E3] bg-[#F8FAF9]">
              <h3 className="text-[15px] font-bold text-[#2D4A49]">บันทึกเป็นแผนงาน</h3>
              <button onClick={() => setShowSaveTemplateModal(false)} className="text-[#6B8F8E] hover:text-[#2D4A49] transition-colors p-1 rounded-lg hover:bg-[#E8F3F2] cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#6B8F8E] mb-1.5">ชื่อแผนงาน</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-white border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88]/15 focus:border-[#5A8A88] outline-none text-[13px] text-[#2D4A49] shadow-xs"
                  placeholder="เช่น แผนงานช่วง High Season"
                  value={templateNameInput}
                  onChange={e => setTemplateNameInput(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="p-4 border-t border-[#D4E4E3] bg-[#F8FAF9] flex justify-end gap-2.5">
              <button 
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="px-4 py-2 text-[12px] font-semibold text-[#6B8F8E] hover:text-[#2D4A49] bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                type="button"
                onClick={handleSaveTemplate}
                disabled={!templateNameInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#5A8A88] hover:bg-[#4A7876] text-white text-[12px] font-bold rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Save size={15} />
                บันทึกแผนงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOAD TEMPLATE MODAL ───────────────────────── */}
      {showLoadTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => setShowLoadTemplateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-[#D4E4E3] animate-in zoom-in-95 duration-200 max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#D4E4E3] bg-[#F8FAF9]">
              <h3 className="text-[15px] font-bold text-[#2D4A49]">เลือกใช้แผนงาน</h3>
              <button onClick={() => setShowLoadTemplateModal(false)} className="text-[#6B8F8E] hover:text-[#2D4A49] transition-colors p-1 rounded-lg hover:bg-[#E8F3F2] cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-3 overflow-y-auto custom-scrollbar">
              {doughTemplates.length === 0 ? (
                <div className="p-6 text-center text-[#6B8F8E] text-[13px] bg-[#F8FAF9] rounded-xl border border-[#D4E4E3]">
                  ยังไม่มีแผนงานที่บันทึกไว้
                </div>
              ) : (
                <div className="space-y-1.5">
                  {doughTemplates.map((template, idx) => (
                    <div key={template.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl hover:bg-[#F0F5F4] border border-[#D4E4E3] transition-all gap-2">
                      <span className="font-semibold text-[13px] text-[#2D4A49]">{template.name}</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleDeleteTemplate(idx)}
                          className="p-1.5 text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                          title="ลบแผนงาน"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleLoadTemplate(template)}
                          className="flex items-center justify-center w-full sm:w-auto gap-1.5 px-3 py-1.5 bg-[#E8F3F2] hover:bg-[#B8D4D2] text-[#5A8A88] text-[12px] font-semibold transition-colors border border-[#D4E4E3] rounded-lg cursor-pointer"
                        >
                          <Check size={14} />
                          เลือกใช้
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[#D4E4E3] bg-[#F8FAF9] flex justify-between gap-3">
              <button 
                onClick={initCreateTemplate}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-[#5A8A88] bg-[#E8F3F2] hover:bg-[#B8D4D2] rounded-lg transition-colors border border-[#D4E4E3] cursor-pointer"
              >
                <Plus size={15} />
                สร้างแผนงาน
              </button>
              <button 
                onClick={() => setShowLoadTemplateModal(false)}
                className="px-4 py-2 text-[12px] font-semibold text-[#6B8F8E] hover:text-[#2D4A49] bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] rounded-lg transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE TEMPLATE MODAL ───────────────────────── */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => setShowCreateTemplateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden border border-[#D4E4E3] animate-in zoom-in-95 duration-200 max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-[#D4E4E3] bg-[#F8FAF9] gap-3">
              <h3 className="text-[16px] font-bold text-[#2D4A49] flex items-center gap-2">
                <PlusCircle size={18} className="text-[#5A8A88]" />
                สร้างแผนงาน ตี & ตัด Dough
              </h3>
              <div className="flex items-center gap-2.5">
                <input
                  type="text"
                  placeholder="ชื่อแผนงาน (เช่น แผนช่วงเทศกาล)"
                  className="px-3 py-1.5 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88]/15 focus:border-[#5A8A88] outline-none text-[13px] text-[#2D4A49] w-64 bg-white shadow-xs"
                  value={createTemplateName}
                  onChange={e => setCreateTemplateName(e.target.value)}
                />
                <button onClick={() => setShowCreateTemplateModal(false)} className="text-[#6B8F8E] hover:text-[#2D4A49] transition-colors p-1 rounded-lg hover:bg-[#E8F3F2] cursor-pointer">
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <div className="p-0 overflow-y-auto custom-scrollbar flex-1 bg-[#F0F5F4]/40 flex flex-col gap-5 p-4">
              <div className="bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 border-b border-[#D4E4E3] flex items-center gap-2 bg-[#E8F3F2]">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white text-[#5A8A88] text-[11px] font-bold border border-[#B8D4D2]">1</span>
                  <h4 className="font-bold text-[#2D4A49] text-[13px]">รายการ ตี Dough (Mixing)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-[#F8FAF9] border-b border-[#D4E4E3]">
                      <tr>
                        <th className="p-2.5 text-[12px] font-bold text-[#2D4A49] min-w-[200px]">รายการ</th>
                        <th className="p-2.5 text-[12px] font-bold text-center text-[#2D4A49] w-24">หน่วย</th>
                        <th className="p-2.5 text-[12px] font-bold text-center text-[#2D4A49] w-28">ขนาด</th>
                        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                          <th key={day} className="p-2.5 text-[12px] font-bold text-center text-[#2D4A49] border-l border-[#D4E4E3]">
                            {day === 'mon' ? 'จันทร์' : day === 'tue' ? 'อังคาร' : day === 'wed' ? 'พุธ' : day === 'thu' ? 'พฤหัสฯ' : day === 'fri' ? 'ศุกร์' : day === 'sat' ? 'เสาร์' : 'อาทิตย์'}
                          </th>
                        ))}
                        <th className="p-2.5 text-[12px] font-bold text-center text-[#2D4A49] w-12 border-l border-[#D4E4E3]">ลบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F5F4]">
                      {createTemplateItems.map((item, index) => (
                        <tr key={item.id} className="hover:bg-[#F8FAF9] transition-colors">
                          <td className="p-2">
                            <select
                              value={item.name}
                              onChange={(e) => {
                                const newItems = [...createTemplateItems];
                                newItems[index].name = e.target.value;
                                newItems[index].unit = '';
                                newItems[index].size = '';
                                setCreateTemplateItems(newItems);
                              }}
                              className="w-full bg-white border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-2 text-[12px] text-[#2D4A49] outline-none"
                            >
                              <option value="">-- เลือกชนิดแป้ง --</option>
                              {Array.from(new Set(mixingSettings.map((s: any) => s.name).filter(Boolean))).map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={item.unit}
                              onChange={(e) => {
                                const newItems = [...createTemplateItems];
                                newItems[index].unit = e.target.value;
                                newItems[index].size = '';
                                setCreateTemplateItems(newItems);
                              }}
                              disabled={!item.name}
                              className="w-full bg-white border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-2 text-[12px] text-[#2D4A49] outline-none disabled:opacity-50"
                            >
                              <option value="">หน่วย</option>
                              {Array.from(new Set(mixingSettings.filter((s:any) => s.name === item.name).map((s:any) => s.unit).filter(Boolean))).map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={item.size}
                              onChange={(e) => {
                                const newItems = [...createTemplateItems];
                                newItems[index].size = e.target.value;
                                setCreateTemplateItems(newItems);
                              }}
                              disabled={!item.unit}
                              className="w-full bg-white border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-2 text-[12px] text-[#2D4A49] outline-none disabled:opacity-50"
                            >
                              <option value="">ขนาด</option>
                              {Array.from(new Set(mixingSettings.filter((s:any) => s.name === item.name && s.unit === item.unit).map((s:any) => s.size).filter(Boolean))).map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                            <td key={day} className="p-2 border-l border-[#D4E4E3]">
                              <input
                                type="number"
                                min="0"
                                className="w-full text-center py-1.5 px-1 bg-white border border-[#D4E4E3] rounded-lg hover:border-[#5A8A88] focus:border-[#5A8A88] focus:ring-1 focus:ring-[#5A8A88] outline-none text-[12px] text-[#2D4A49] transition-all"
                                placeholder="-"
                                value={item[day as keyof typeof item]?.p || ''}
                                onChange={(e) => {
                                  const newItems = [...createTemplateItems];
                                  const dayData = { ...newItems[index][day as keyof typeof item], p: e.target.value };
                                  newItems[index] = { ...newItems[index], [day]: dayData };
                                  setCreateTemplateItems(newItems);
                                }}
                              />
                            </td>
                          ))}
                          <td className="p-2 border-l border-[#D4E4E3] text-center">
                            <button
                              onClick={() => {
                                const newItems = [...createTemplateItems];
                                newItems.splice(index, 1);
                                setCreateTemplateItems(newItems);
                              }}
                              className="p-1.5 text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors inline-flex cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={11} className="py-2.5 px-4 border-t border-[#D4E4E3] bg-[#F8FAF9]">
                          <button 
                            onClick={addCreateTemplateRow} 
                            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5A8A88] bg-[#E8F3F2] hover:bg-[#B8D4D2] px-3 py-1.5 rounded-lg transition-colors border border-[#D4E4E3] cursor-pointer"
                          >
                            <Plus size={14} />
                            เพิ่มรายการตี Dough
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 border-b border-[#D4E4E3] flex items-center gap-2 bg-[#E8F3F2]">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white text-[#5A8A88] text-[11px] font-bold border border-[#B8D4D2]">2</span>
                  <h4 className="font-bold text-[#2D4A49] text-[13px]">รายการ ตัด Dough (Cutting)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-[#F8FAF9] border-b border-[#D4E4E3]">
                      <tr>
                        <th className="p-2.5 text-[12px] font-bold text-[#2D4A49] min-w-[200px]">เป้าหมาย</th>
                        <th className="p-2.5 text-[12px] font-bold text-center text-[#2D4A49] w-32">Dough ต้นทาง</th>
                        <th className="p-2.5 text-[12px] font-bold text-center text-[#2D4A49] w-24">หน่วย</th>
                        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                          <th key={day} className="p-2.5 text-[12px] font-bold text-center text-[#2D4A49] border-l border-[#D4E4E3]">
                            {day === 'mon' ? 'จันทร์' : day === 'tue' ? 'อังคาร' : day === 'wed' ? 'พุธ' : day === 'thu' ? 'พฤหัสฯ' : day === 'fri' ? 'ศุกร์' : day === 'sat' ? 'เสาร์' : 'อาทิตย์'}
                          </th>
                        ))}
                        <th className="p-2.5 text-[12px] font-bold text-center text-[#2D4A49] w-12 border-l border-[#D4E4E3]">ลบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F5F4]">
                      {createTemplateCuttingItems.map((item, index) => (
                        <tr key={item.id} className="hover:bg-[#F8FAF9] transition-colors">
                          <td className="p-2">
                            <select
                              value={item.name}
                              onChange={(e) => {
                                const newName = e.target.value;
                                const options = cuttingSettings.filter(s => s.target === newName);
                                const newItems = [...createTemplateCuttingItems];
                                newItems[index].name = newName;
                                if (options.length > 0) {
                                  const firstOpt = options[0];
                                  newItems[index].sourceDough = firstOpt.sourceDough || '';
                                  const mix = mixingSettings.find(m => m.name === firstOpt.sourceDough);
                                  newItems[index].unit = mix ? mix.unit : '';
                                } else {
                                  newItems[index].sourceDough = '';
                                  newItems[index].unit = '';
                                }
                                setCreateTemplateCuttingItems(newItems);
                              }}
                              className="w-full bg-white border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-2 text-[12px] text-[#2D4A49] outline-none"
                            >
                              <option value="">-- เลือกเป้าหมาย --</option>
                              {Array.from(new Set(cuttingSettings.map((s: any) => s.target).filter(Boolean))).map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={item.sourceDough}
                              onChange={(e) => {
                                const newSource = e.target.value;
                                const newItems = [...createTemplateCuttingItems];
                                newItems[index].sourceDough = newSource;
                                const mix = mixingSettings.find(m => m.name === newSource);
                                if (mix) {
                                  newItems[index].unit = mix.unit;
                                } else {
                                  newItems[index].unit = '';
                                }
                                setCreateTemplateCuttingItems(newItems);
                              }}
                              disabled={!item.name}
                              className="w-full bg-white border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-2 text-[12px] text-[#2D4A49] outline-none disabled:opacity-50"
                            >
                              <option value="">เลือก Dough...</option>
                              {Array.from(new Set(cuttingSettings.filter(s => s.target === item.name).map(s => s.sourceDough).filter(Boolean))).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.unit}
                              readOnly
                              placeholder="-"
                              className="w-full text-center bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg py-1.5 px-2 text-[12px] text-[#6B8F8E] outline-none select-none"
                            />
                          </td>
                          {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                            <td key={day} className="p-2 border-l border-[#D4E4E3]">
                              <input
                                type="number"
                                min="0"
                                className="w-full text-center py-1.5 px-1 bg-white border border-[#D4E4E3] rounded-lg hover:border-[#5A8A88] focus:border-[#5A8A88] focus:ring-1 focus:ring-[#5A8A88] outline-none text-[12px] text-[#2D4A49] transition-all"
                                placeholder="-"
                                value={item[day as keyof typeof item]?.p || ''}
                                onChange={(e) => {
                                  const newItems = [...createTemplateCuttingItems];
                                  const dayData = { ...newItems[index][day as keyof typeof item], p: e.target.value };
                                  newItems[index] = { ...newItems[index], [day]: dayData };
                                  setCreateTemplateCuttingItems(newItems);
                                }}
                              />
                            </td>
                          ))}
                          <td className="p-2 border-l border-[#D4E4E3] text-center">
                            <button
                              onClick={() => {
                                const newItems = [...createTemplateCuttingItems];
                                newItems.splice(index, 1);
                                setCreateTemplateCuttingItems(newItems);
                              }}
                              className="p-1.5 text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors inline-flex cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={11} className="py-2.5 px-4 border-t border-[#D4E4E3] bg-[#F8FAF9]">
                          <button 
                            onClick={addCreateTemplateCuttingRow} 
                            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5A8A88] bg-[#E8F3F2] hover:bg-[#B8D4D2] px-3 py-1.5 rounded-lg transition-colors border border-[#D4E4E3] cursor-pointer"
                          >
                            <Plus size={14} />
                            เพิ่มรายการตัด Dough
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#D4E4E3] bg-[#F8FAF9] flex justify-end gap-2.5">
              <button 
                onClick={() => setShowCreateTemplateModal(false)}
                className="px-4 py-2 text-[12px] font-semibold text-[#6B8F8E] hover:text-[#2D4A49] bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleSaveCreatedTemplate}
                disabled={!createTemplateName.trim()}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#5A8A88] hover:bg-[#4A7876] text-white text-[12px] font-bold rounded-lg transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Save size={16} />
                บันทึกเป็นแผนงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL ───────────────────────── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-[#D4E4E3] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#D4E4E3] bg-[#F8FAF9]">
              <h3 className="text-[16px] font-bold text-[#2D4A49] flex items-center gap-2">
                <Settings size={18} className="text-[#5A8A88]" />
                ตั้งค่าระบบ (Settings)
              </h3>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#E8F3F2] rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar bg-[#F0F5F4]/30">
              {/* 1. Mixing Settings */}
              <div className="bg-white p-5 rounded-xl border border-[#D4E4E3] shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[14px] font-bold text-[#2D4A49]">1. รายการ ตี Dough (Mixing)</h4>
                  <button 
                    onClick={() => {
                      const newId = Date.now().toString();
                      setTempMixingSettings([...tempMixingSettings, { id: newId, name: '', unit: '', size: '' }]);
                    }}
                    className="text-[#5A8A88] hover:text-[#4A7876] text-[12px] flex items-center gap-1 font-semibold bg-[#E8F3F2] hover:bg-[#B8D4D2] px-2.5 py-1 rounded-lg border border-[#D4E4E3] cursor-pointer"
                  >
                    <PlusCircle size={14} /> เพิ่มรายการ
                  </button>
                </div>
                <p className="text-[11px] text-[#6B8F8E] mb-4 pb-3 border-b border-[#D4E4E3]">
                  กำหนดชนิดแป้ง หน่วย และขนาด สำหรับใช้ในแผนงานตี Dough
                </p>
                
                <div className="border border-[#D4E4E3] rounded-xl overflow-hidden">
                  <table className="w-full text-[12px] text-left">
                    <thead className="bg-[#F8FAF9] text-[#2D4A49] font-semibold whitespace-nowrap">
                      <tr>
                        <th className="px-2 py-2.5 border-b border-[#D4E4E3] w-[5%] text-center"></th>
                        <th className="px-3 py-2.5 border-b border-[#D4E4E3]">ชนิดแป้ง (Type)</th>
                        <th className="px-3 py-2.5 border-b border-[#D4E4E3]">หน่วยต่อสูตร (Unit)</th>
                        <th className="px-3 py-2.5 border-b border-[#D4E4E3]">ขนาดต่อสูตร (Size)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F5F4]">
                      {tempMixingSettings.map((setting) => (
                        <tr key={setting.id} className="hover:bg-[#F8FAF9]">
                          <td className="px-2 py-2 text-center">
                            <button 
                              onClick={() => setTempMixingSettings(prev => prev.filter(s => s.id !== setting.id))}
                              className="p-1 text-[#EF4444] hover:bg-[#FEE2E2] rounded transition-colors cursor-pointer"
                              title="ลบ"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="text" 
                              value={setting.name}
                              onChange={(e) => setTempMixingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, name: e.target.value } : s))}
                              className="w-full text-[12px] text-[#2D4A49] border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-2 bg-white outline-none"
                              placeholder="เช่น ครัวซองค์"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="text" 
                              value={setting.unit}
                              onChange={(e) => setTempMixingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, unit: e.target.value } : s))}
                              className="w-full text-[12px] text-[#2D4A49] border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-2 bg-white outline-none"
                              placeholder="เช่น Dough"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="text" 
                              value={setting.size}
                              onChange={(e) => setTempMixingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, size: e.target.value } : s))}
                              className="w-full text-[12px] text-[#2D4A49] border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-2 bg-white outline-none"
                              placeholder="เช่น 4 kg"
                            />
                          </td>
                        </tr>
                      ))}
                      {tempMixingSettings.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-[#6B8F8E]">
                            ยังไม่มีการตั้งค่า
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Cutting Ratios */}
              <div className="bg-white p-5 rounded-xl border border-[#D4E4E3] shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[14px] font-bold text-[#2D4A49]">2. รายการ ตัด Dough (Cutting Ratios)</h4>
                  <button 
                    onClick={() => {
                      const newId = Date.now().toString();
                      setTempCuttingSettings([...tempCuttingSettings, { id: newId, sourceDough: '', target: '', ratio: 1, unit: '' }]);
                    }}
                    className="text-[#5A8A88] hover:text-[#4A7876] text-[12px] flex items-center gap-1 font-semibold bg-[#E8F3F2] hover:bg-[#B8D4D2] px-2.5 py-1 rounded-lg border border-[#D4E4E3] cursor-pointer"
                  >
                    <PlusCircle size={14} /> เพิ่มรายการ
                  </button>
                </div>
                <p className="text-[11px] text-[#6B8F8E] mb-4 pb-3 border-b border-[#D4E4E3]">
                  กำหนดค่าสัดส่วนการตัด เช่น 1 Dough ตัดเป็น ครัวซองค์ได้กี่ชิ้น
                </p>
                
                <div className="border border-[#D4E4E3] rounded-xl overflow-hidden">
                  <table className="w-full text-[12px] text-left">
                    <thead className="bg-[#F8FAF9] text-[#2D4A49] font-semibold whitespace-nowrap">
                      <tr>
                        <th className="px-2 py-2.5 border-b border-[#D4E4E3] w-[5%] text-center"></th>
                        <th className="px-3 py-2.5 border-b border-[#D4E4E3]">ตัดจาก (Source Dough)</th>
                        <th className="px-3 py-2.5 border-b border-[#D4E4E3]">แปลงเป็นรายการ (Target Item)</th>
                        <th className="px-3 py-2.5 border-b border-[#D4E4E3] w-[15%] text-center">จำนวน (Ratio)</th>
                        <th className="px-3 py-2.5 border-b border-[#D4E4E3] w-[15%] text-center">หน่วย (Unit)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F5F4]">
                      {tempCuttingSettings.map((setting) => (
                        <tr key={setting.id} className="hover:bg-[#F8FAF9]">
                          <td className="px-2 py-2 text-center">
                            <button 
                              onClick={() => setTempCuttingSettings(prev => prev.filter(s => s.id !== setting.id))}
                              className="p-1 text-[#EF4444] hover:bg-[#FEE2E2] rounded transition-colors cursor-pointer"
                              title="ลบ"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <select 
                              value={setting.sourceDough}
                              onChange={(e) => setTempCuttingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, sourceDough: e.target.value } : s))}
                              className="w-full text-[12px] text-[#2D4A49] border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-2 bg-white outline-none"
                            >
                              <option value="">เลือกจากรายการที่ตี...</option>
                              {Array.from(new Set(tempMixingSettings.map(m => m.name).filter(Boolean))).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="text" 
                              value={setting.target}
                              onChange={(e) => setTempCuttingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, target: e.target.value } : s))}
                              className="w-full text-[12px] text-[#2D4A49] border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-2 bg-white outline-none"
                              placeholder="เช่น ครัวซองค์เนยสด"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="number" 
                              value={setting.ratio}
                              onChange={(e) => setTempCuttingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, ratio: Number(e.target.value) } : s))}
                              className="w-full text-[12px] text-[#2D4A49] border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-2 text-center bg-white outline-none"
                              min={1}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="text" 
                              value={setting.unit}
                              onChange={(e) => setTempCuttingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, unit: e.target.value } : s))}
                              className="w-full text-[12px] text-[#2D4A49] border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-2 text-center bg-white outline-none"
                              placeholder="ชิ้น"
                            />
                          </td>
                        </tr>
                      ))}
                      {tempCuttingSettings.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-[#6B8F8E]">
                            ยังไม่มีการตั้งค่า
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Item Output Settings */}
              <div className="bg-white p-5 rounded-xl border border-[#D4E4E3] shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[14px] font-bold text-[#2D4A49]">3. ชิ้น/unit (item output)</h4>
                  <button 
                    onClick={() => {
                      const newId = Date.now().toString();
                      setTempItemSettings([...tempItemSettings, { id: newId, targetItem: '', menu: '' }]);
                    }}
                    className="text-[#5A8A88] hover:text-[#4A7876] text-[12px] flex items-center gap-1 font-semibold bg-[#E8F3F2] hover:bg-[#B8D4D2] px-2.5 py-1 rounded-lg border border-[#D4E4E3] cursor-pointer"
                  >
                    <PlusCircle size={14} /> เพิ่มรายการ
                  </button>
                </div>
                <p className="text-[11px] text-[#6B8F8E] mb-4 pb-3 border-b border-[#D4E4E3]">
                  กำหนดการแปลงจากรายการที่ตัด (Target Item) ไปเป็นชื่อเมนู (Menu)
                </p>
                
                <div className="border border-[#D4E4E3] rounded-xl overflow-hidden w-full overflow-x-auto">
                  <table className="w-full text-[12px] text-left">
                    <thead className="bg-[#F8FAF9] text-[#2D4A49] font-semibold whitespace-nowrap">
                      <tr>
                        <th className="px-2 py-2.5 border-b border-[#D4E4E3] w-[5%] min-w-[48px] text-center"></th>
                        <th className="px-3 py-2.5 border-b border-[#D4E4E3] w-[48%] min-w-[200px]">จากรายการ (Target Item)</th>
                        <th className="px-3 py-2.5 border-b border-[#D4E4E3] w-[47%] min-w-[200px]">เมนู (Menu)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F5F4]">
                      {tempItemSettings.map((setting) => (
                        <tr key={setting.id} className="hover:bg-[#F8FAF9]">
                          <td className="px-2 py-2 text-center w-[5%] min-w-[48px]">
                            <button 
                              onClick={() => setTempItemSettings(prev => prev.filter(s => s.id !== setting.id))}
                              className="p-1 text-[#EF4444] hover:bg-[#FEE2E2] rounded transition-colors cursor-pointer"
                              title="ลบ"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <select 
                              value={setting.targetItem}
                              onChange={(e) => setTempItemSettings(prev => prev.map(s => s.id === setting.id ? { ...s, targetItem: e.target.value } : s))}
                              className="w-full text-[12px] text-[#2D4A49] border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-3 bg-white outline-none"
                            >
                              <option value="">เลือกจากรายการที่ตัด...</option>
                              {Array.from(new Set(tempCuttingSettings.map(m => m.target).filter(Boolean))).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="text" 
                              value={setting.menu}
                              onChange={(e) => setTempItemSettings(prev => prev.map(s => s.id === setting.id ? { ...s, menu: e.target.value } : s))}
                              className="w-full text-[12px] text-[#2D4A49] border border-[#D4E4E3] rounded-lg focus:border-[#5A8A88] py-1.5 px-3 bg-white outline-none"
                              placeholder="เช่น ครัวซองค์เนยสด"
                            />
                          </td>
                        </tr>
                      ))}
                      {tempItemSettings.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-[#6B8F8E]">
                            ยังไม่มีการตั้งค่า
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Other Settings Note */}
              <div className="bg-white p-5 rounded-xl border border-[#D4E4E3] shadow-xs">
                <h4 className="text-[14px] font-bold text-[#2D4A49] mb-1">การตั้งค่าอื่นๆ (รอการพัฒนา)</h4>
                <p className="text-[11px] text-[#6B8F8E]">ส่วนนี้สำหรับตั้งค่าการแจ้งเตือน หรือสิทธิ์การเข้าถึงในอนาคต</p>
              </div>
            </div>

            {saveSettingsError && (
              <div className="px-6 py-2.5 bg-[#FEE2E2] text-[#EF4444] text-[12px] font-semibold border-t border-[#D4E4E3] flex items-center gap-1.5">
                <span>⚠️ {saveSettingsError}</span>
              </div>
            )}

            <div className="p-4 border-t border-[#D4E4E3] bg-[#F8FAF9] flex justify-end gap-2.5 items-center">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                disabled={isSavingSettings}
                className="px-4 py-2 text-[12px] font-semibold text-[#6B8F8E] hover:text-[#2D4A49] bg-white border border-[#D4E4E3] rounded-lg hover:bg-[#F0F5F4] transition-colors disabled:opacity-50 cursor-pointer"
              >
                ปิด
              </button>
              <button 
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="px-5 py-2 text-[12px] font-semibold text-white bg-[#5A8A88] hover:bg-[#4A7876] rounded-lg transition-colors flex items-center gap-2 shadow-xs disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSavingSettings ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    กำลังบันทึกและซิงก์ข้อมูล...
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    บันทึกการตั้งค่า
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
