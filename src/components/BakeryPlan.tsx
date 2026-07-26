import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Save, ChevronLeft, ChevronRight, Plus, Trash2, Settings, X, PlusCircle, Check } from 'lucide-react';
import { format, startOfWeek, addWeeks, subWeeks, addDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { BAKERY_PLAN_INITIAL_DATA } from '../bakeryPlanData';
import { supabase } from '../lib/supabase';
import { sendLineNotification } from '../lib/lineNotify';
import { sendDiscordNotification } from '../lib/discordNotify';

interface BakeryPlanProps { branch?: string;
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
        console.error("Failed to fetch bakery settings from Supabase:", err);
      }
    };

    fetchLatestSettings();
  }, []);

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
  }

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
      id: `tmpl-load-mix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      id: `tmpl-load-cut-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
        await supabase.from('bakery_plan_records').upsert({ branch,
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
      console.error('Failed to save bakery plan history', e);
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
      console.error(err);
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
    
    // Choose subtle color themes depending on section
    const theme = {
      mixing: {
        bg: 'bg-amber-50/80',
        text: 'text-amber-900',
        border: 'border-amber-200',
        subBg: 'bg-amber-100/50',
        divider: 'border-l-amber-400'
      },
      cutting: {
        bg: 'bg-emerald-50/80',
        text: 'text-emerald-900',
        border: 'border-emerald-200',
        subBg: 'bg-emerald-100/50',
        divider: 'border-l-emerald-400'
      },
      items: {
        bg: 'bg-sky-50/80',
        text: 'text-sky-900',
        border: 'border-sky-200',
        subBg: 'bg-sky-100/50',
        divider: 'border-l-sky-400'
      }
    }[section];

    return (
      <div className={`overflow-x-auto shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg max-h-[70vh] border-t-2 ${section === 'mixing' ? 'border-amber-400' : section === 'cutting' ? 'border-emerald-400' : 'border-sky-400'}`}>
        <table className="min-w-full divide-y divide-slate-300 relative table-fixed">
          <thead className={`${theme.bg} sticky top-0 z-20 backdrop-blur-sm`}>
            <tr>
              <th scope="col" className={`py-3 pl-3 pr-2 text-left text-sm font-semibold ${theme.text} sticky left-0 z-30 ${theme.bg} border-r border-b ${theme.border} min-w-[200px] w-[200px] max-w-[200px] backdrop-blur-sm`}>
                รายการ
              </th>
              <th scope="col" className={`px-2 py-3 text-center text-sm font-semibold ${theme.text} border-r border-b ${theme.border} sticky left-[200px] z-30 ${theme.bg} min-w-[120px] w-[120px] max-w-[120px] backdrop-blur-sm`}>
                {section === 'cutting' ? 'ตัดจาก' : section === 'items' ? 'เมนู' : 'หน่วย'}
              </th>
              {(section === 'mixing' || section === 'cutting') && (
                <th scope="col" className={`px-2 py-3 text-center text-sm font-semibold ${theme.text} border-r border-b ${theme.border} sticky left-[320px] min-w-[120px] w-[120px] max-w-[120px] z-30 ${theme.bg} backdrop-blur-sm`}>
                {section === 'cutting' ? 'หน่วยต่อสูตร (Unit)' : 'ขนาด'}
              </th>
              )}
              {DAYS.map((day, index) => {
                const dayDate = addDays(currentWeek, index);
                return (
                  <th key={day.key} colSpan={4} className={`px-3 py-3 text-center text-sm ${theme.text} border-r border-b border-l-2 ${theme.border} ${theme.divider}`}>
                    <div className="font-semibold">{day.label}</div>
                    <div className="text-xs font-medium opacity-70 mt-0.5">{format(dayDate, 'd MMM', { locale: th })}</div>
                  </th>
                );
              })}
            </tr>
            <tr className={`${theme.subBg} text-xs text-slate-600`}>
              <th className={`sticky left-0 z-30 ${theme.subBg} border-r border-b ${theme.border} backdrop-blur-sm`}></th>
              <th className={`sticky left-[200px] z-30 ${theme.subBg} border-r border-b ${theme.border} backdrop-blur-sm`}></th>
              {(section === 'mixing' || section === 'cutting') && <th className={`sticky left-[320px] z-30 ${theme.subBg} border-r border-b ${theme.border} backdrop-blur-sm`}></th>}
              {DAYS.map(day => (
                <React.Fragment key={day.key}>
                  <th className={`font-medium px-1 py-2 text-center border-l-2 border-b ${theme.divider} ${theme.border} ${theme.subBg} min-w-[48px]`}>วางแผน</th>
                  <th className={`font-medium px-1 py-2 text-center border-l border-b ${theme.border} ${theme.subBg} min-w-[48px] text-amber-700/80`}>ขอเพิ่ม</th>
                  <th className={`font-medium px-1 py-2 text-center border-l border-b ${theme.border} ${theme.subBg} min-w-[48px] text-emerald-700/80`}>ทำได้</th>
                  <th className={`font-medium px-1 py-2 text-center border-l border-b ${theme.border} ${theme.subBg} min-w-[48px] text-red-700/80`}>ทำเสีย</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {list.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                <td className="whitespace-nowrap py-3 pl-2 pr-3 text-sm font-medium text-slate-900 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                  <div className="flex items-start gap-2">
                    {!isReadOnly && (
                      <button onClick={() => handleDeleteItem(section, item.id)} className="mt-0.5 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100 shrink-0" title="ลบรายการ">
                        <Trash2 size={16} />
                      </button>
                    )}
                    <div className="flex flex-col gap-1 w-full min-w-[140px]">
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
                          className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm font-medium"
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
                          className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm font-medium"
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
                          className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm font-medium"
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
                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm font-medium"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap py-3 px-3 text-sm text-slate-500 border-r border-slate-200 text-center sticky left-[200px] z-10 bg-white group-hover:bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">
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
                      className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm text-center text-slate-600"
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
                      className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm text-center text-slate-600"
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
                      className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm text-center text-slate-600"
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
                      className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm text-center text-slate-600"
                    />
                  )}
                </td>
                {(section === 'mixing' || section === 'cutting') && (
                  <td className="whitespace-nowrap py-3 px-3 text-sm text-slate-500 border-r border-slate-200 text-center sticky left-[320px] z-10 bg-white group-hover:bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">
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
                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm text-center text-slate-600"
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
                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm text-center text-slate-600"
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
                      <td className={`border-l-2 border-b border-r-0 ${theme.divider} ${theme.border} p-0 text-center relative min-w-[48px]`}>
                        <input type="text" value={dData?.p || ''} disabled={isReadOnly} onChange={(e) => handleDataChange(section, item.id, day.key, 'p', e.target.value)} className="w-full h-full min-h-[48px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-amber-500 p-0 m-0 text-sm bg-transparent" />
                      </td>
                      <td className="border-l border-b border-slate-200 p-0 text-center relative min-w-[48px] bg-blue-50/30">
                        <input type="text" value={dData?.a || ''} disabled={isReadOnly} onChange={(e) => handleDataChange(section, item.id, day.key, 'a', e.target.value)} className="w-full h-full min-h-[48px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-amber-500 p-0 m-0 text-sm bg-transparent" />
                      </td>
                      <td className="border-l border-slate-200 p-0 text-center relative min-w-[48px] bg-green-50/30">
                        <input type="text" value={dData?.ac || ''} disabled={isReadOnly} onChange={(e) => handleDataChange(section, item.id, day.key, 'ac', e.target.value)} className="w-full h-full min-h-[48px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-amber-500 p-0 m-0 text-sm bg-transparent font-medium text-green-700" />
                      </td>
                      <td className="border-l border-slate-200 p-0 text-center relative min-w-[48px] bg-red-50/30">
                        <input type="text" value={dData?.w || ''} disabled={isReadOnly} onChange={(e) => handleDataChange(section, item.id, day.key, 'w', e.target.value)} className="w-full h-full min-h-[48px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-amber-500 p-0 m-0 text-sm bg-transparent text-red-600" />
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
            {!isReadOnly && (
              <tr className="bg-slate-50/50">
                <td colSpan={(section === 'mixing' || section === 'cutting') ? 3 : 2} className="py-4 pl-4 sticky left-0 z-10 bg-slate-50/50 border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                  <button onClick={() => handleAddItem(section)} className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-md transition-colors">
                    <Plus size={16} />
                    เพิ่มรายการ
                  </button>
                </td>
                <td colSpan={DAYS.length * 4} className="py-2 bg-slate-50/50"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSalesTable = () => {
    const theme = {
      bg: 'bg-indigo-50/80',
      text: 'text-indigo-900',
      border: 'border-indigo-200',
      subBg: 'bg-indigo-100/50',
      divider: 'border-l-indigo-400'
    };

    return (
      <div className="overflow-x-auto shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg max-h-[70vh] border-t-2 border-indigo-400">
        <table className="min-w-full divide-y divide-slate-300 relative table-fixed">
          <thead className={`${theme.bg} sticky top-0 z-20 backdrop-blur-sm`}>
            <tr>
              <th scope="col" className={`py-3 pl-3 pr-2 text-left text-sm font-semibold ${theme.text} sticky left-0 z-30 ${theme.bg} border-r border-b ${theme.border} min-w-[80px] w-[80px] max-w-[80px] backdrop-blur-sm`}>
                เหลือจากแผน
              </th>
              <th scope="col" className={`py-3 pl-3 pr-2 text-left text-sm font-semibold ${theme.text} sticky left-[80px] z-30 ${theme.bg} min-w-[180px] w-[180px] max-w-[180px] border-r border-b ${theme.border} backdrop-blur-sm`}>
                รายการ
              </th>
              <th scope="col" className={`px-2 py-3 text-left text-sm font-semibold ${theme.text} border-r border-b ${theme.border} sticky left-[260px] z-30 ${theme.bg} min-w-[100px] w-[100px] max-w-[100px] backdrop-blur-sm`}>
                หน่วย
              </th>
              {DAYS.map((day, index) => {
                const dayDate = addDays(currentWeek, index);
                return (
                  <th key={day.key} colSpan={5} className={`px-3 py-3 text-center text-sm ${theme.text} border-r border-b border-l-2 ${theme.border} ${theme.divider}`}>
                    <div className="font-semibold">{day.label}</div>
                    <div className="text-xs font-medium opacity-70 mt-0.5">{format(dayDate, 'd MMM', { locale: th })}</div>
                  </th>
                );
              })}
            </tr>
            <tr className={`${theme.subBg} text-xs text-slate-600`}>
              <th className={`sticky left-0 z-30 ${theme.subBg} border-r border-b ${theme.border} backdrop-blur-sm`}></th>
              <th className={`sticky left-[80px] z-30 ${theme.subBg} border-r border-b ${theme.border} backdrop-blur-sm`}></th>
              <th className={`sticky left-[260px] z-30 ${theme.subBg} border-r border-b ${theme.border} backdrop-blur-sm`}></th>
              {DAYS.map(day => (
                <React.Fragment key={day.key}>
                  <th className={`font-medium px-1 py-2 text-center border-l-2 border-b ${theme.divider} ${theme.border} text-[#475569] ${theme.subBg} min-w-[48px]`}>วางแผน</th>
                  <th className={`font-medium px-1 py-2 text-center border-l border-b ${theme.border} text-[#475569] ${theme.subBg} min-w-[48px]`}>ขอเพิ่ม</th>
                  <th className={`font-bold px-1 py-2 text-center border-l border-b ${theme.border} text-indigo-900 bg-indigo-200/50 min-w-[48px]`}>รวม</th>
                  <th className={`font-medium px-1 py-2 text-center border-l border-b ${theme.border} text-emerald-700 ${theme.subBg} min-w-[48px]`}>ขายได้</th>
                  <th className={`font-medium px-1 py-2 text-center border-l border-b ${theme.border} text-rose-700 ${theme.subBg} min-w-[48px]`}>เหลือ</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {data.sales.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                <td className="whitespace-nowrap py-3 px-2 text-sm font-medium text-slate-500 sticky left-0 z-10 bg-white border-r border-slate-200 max-w-[80px] text-center group-hover:bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">
                  <div className="flex items-center gap-1 justify-center">
                    {!isReadOnly && (
                      <button onClick={() => handleDeleteItem('sales', item.id)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100 shrink-0" title="ลบรายการ">
                        <Trash2 size={16} />
                      </button>
                    )}
                    <input 
                      type="text" 
                      value={item.leftoverPlan || ''} 
                      disabled={isReadOnly}
                      onChange={(e) => handleRowFieldChange('sales', item.id, 'leftoverPlan', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm text-center"
                    />
                  </div>
                </td>
                <td className="whitespace-nowrap py-3 pl-3 pr-2 text-sm font-medium text-slate-900 sticky left-[80px] z-10 bg-white border-r border-slate-200 group-hover:bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">
                  <input 
                    type="text" 
                    value={item.name || ''} 
                    disabled={isReadOnly}
                    placeholder="ชื่อรายการ"
                    onChange={(e) => handleRowFieldChange('sales', item.id, 'name', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm font-medium"
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-500 border-r border-slate-200 text-center sticky left-[260px] z-10 bg-white group-hover:bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">
                  <input 
                    type="text" 
                    value={item.unit || ''} 
                    disabled={isReadOnly}
                    placeholder="หน่วย"
                    onChange={(e) => handleRowFieldChange('sales', item.id, 'unit', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-1 focus:ring-amber-500 p-0 text-sm text-center"
                  />
                </td>
                {DAYS.map(day => {
                  const dData = (item as any)[day.key];
                  return (
                    <React.Fragment key={day.key}>
                      <td className={`border-l-2 border-b border-r-0 ${theme.divider} ${theme.border} p-0 text-center relative min-w-[48px]`}>
                        <input type="text" value={dData?.p || ''} disabled={isReadOnly} onChange={(e) => handleDataChange('sales', item.id, day.key, 'p', e.target.value)} className="w-full h-full min-h-[48px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-amber-500 p-0 m-0 text-sm bg-transparent" />
                      </td>
                      <td className="border-l border-b border-slate-200 p-0 text-center relative min-w-[48px] bg-blue-50/30">
                        <input type="text" value={dData?.a || ''} disabled={isReadOnly} onChange={(e) => handleDataChange('sales', item.id, day.key, 'a', e.target.value)} className="w-full h-full min-h-[48px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-amber-500 p-0 m-0 text-sm bg-transparent" />
                      </td>
                      <td className="border-l border-slate-200 p-0 text-center relative min-w-[48px] bg-slate-100">
                        <input type="text" value={dData?.t || ''} disabled={isReadOnly} onChange={(e) => handleDataChange('sales', item.id, day.key, 't', e.target.value)} className="w-full h-full min-h-[48px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-amber-500 p-0 m-0 text-sm bg-transparent font-medium text-slate-800" />
                      </td>
                      <td className="border-l border-slate-200 p-0 text-center relative min-w-[48px] bg-emerald-50/30">
                        <input type="text" value={dData?.s || ''} disabled={isReadOnly} onChange={(e) => handleDataChange('sales', item.id, day.key, 's', e.target.value)} className="w-full h-full min-h-[48px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-amber-500 p-0 m-0 text-sm bg-transparent text-emerald-700" />
                      </td>
                      <td className="border-l border-slate-200 p-0 text-center relative min-w-[48px] bg-rose-50/30">
                        <input type="text" value={dData?.l || ''} disabled={isReadOnly} onChange={(e) => handleDataChange('sales', item.id, day.key, 'l', e.target.value)} className="w-full h-full min-h-[48px] text-center border-none focus:ring-2 focus:ring-inset focus:ring-amber-500 p-0 m-0 text-sm bg-transparent text-rose-600" />
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
            {!isReadOnly && (
              <tr className="bg-slate-50/50">
                <td colSpan={3} className="py-4 pl-4 sticky left-0 z-10 bg-slate-50/50 border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                  <button onClick={() => handleAddItem('sales')} className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-md transition-colors">
                    <Plus size={16} />
                    เพิ่มรายการ
                  </button>
                </td>
                <td colSpan={DAYS.length * 5 + 1} className="py-2 bg-slate-50/50"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2 rounded-lg">
            <CalendarIcon className="text-amber-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">แผนงาน Bakery</h2>
            <p className="text-sm text-slate-500">จัดการแผนการผลิตและการเตรียมงานของเบเกอรี่ ตารางแสดงข้อมูลรายสัปดาห์</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-sm">
              <button disabled={isReadOnly} onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} className={`p-1 rounded transition-colors ${isReadOnly ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-200 text-slate-600'}`}>
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-2 px-3 min-w-[200px] justify-center text-sm font-medium text-slate-700">
                <CalendarIcon className="text-amber-600" size={16} />
                สัปดาห์ที่ {format(currentWeek, 'd MMM', { locale: th })} - {format(addDays(currentWeek, 6), 'd MMM yyyy', { locale: th })}
              </div>
              <button disabled={isReadOnly} onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} className={`p-1 rounded transition-colors ${isReadOnly ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-200 text-slate-600'}`}>
                <ChevronRight size={20} />
              </button>
            </div>
            {lastSaved && (
              <div className="text-[11px] text-slate-500 mt-1">
                Last saved: {format(lastSaved.date, 'dd MMM yyyy HH:mm')} by {lastSaved.user}
              </div>
            )}
          </div>
          {!isReadOnly && (
            <div className="flex items-center gap-2 self-start relative">
              <button 
                onClick={() => setShowConfirmSave(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm ${showSaveSuccess ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
              >
                {showSaveSuccess ? <Check size={20} /> : <Save size={20} />}
                {showSaveSuccess ? 'บันทึกสำเร็จ' : 'บันทึกข้อมูล'}
              </button>
              <button onClick={() => openSettings()} className="p-2 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:text-amber-600 rounded-lg transition-colors shadow-sm" title="ตั้งค่าระบบ">
                <Settings size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto hide-scrollbar">
          <button onClick={() => setActiveTab('production')} className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'production' ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
            แผนการผลิต (Production)
          </button>
          <button onClick={() => setActiveTab('sales')} className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'sales' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
            ยอดจัดจำหน่าย / เหลือจากแผน
          </button>
        </div>

        <div className="p-0 bg-slate-50/50 w-full overflow-hidden">
          <div className="mx-6 mt-6 text-[12.5px] font-bold text-amber-700 bg-amber-50/80 px-3.5 py-2.5 rounded-xl border border-amber-100/75 flex items-center justify-between gap-2 shadow-sm animate-pulse-slow">
            <span className="flex items-center gap-1.5 leading-tight">
              📱 สำหรับมุมมองแท็บเล็ต (Tablet): เลื่อนสไลด์ตารางแผนงานไปทางซ้าย-ขวา เพื่อดูการป้อนข้อมูลแต่ละวันได้ครบถ้วน
            </span>
            <span className="text-[11px] text-amber-600 font-bold bg-white px-2 py-0.5 rounded-md border border-amber-200 shrink-0 hidden sm:inline">
              Swipe Left/Right ↔️
            </span>
          </div>
          {activeTab === 'production' && (
            <div className="p-6 space-y-12">
              <section>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                  <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-sm shadow-sm ring-2 ring-amber-50">1</span>
                    ตี Dough (Mixing)
                  </h3>
                  
                  {!isReadOnly && (
                    <div className="flex items-center gap-2 shadow-sm rounded-lg overflow-hidden border border-amber-200 w-fit">
                      <button 
                        onClick={() => setShowLoadTemplateModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold transition-colors border-r border-amber-200"
                      >
                        <CalendarIcon size={14} />
                        เลือกใช้แผนงาน ({doughTemplates.length}/20)
                      </button>
                      <button 
                        onClick={() => setShowSaveTemplateModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
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
              <section>
                <h3 className="text-lg font-bold text-emerald-900 mb-4 flex items-center gap-2 mt-4">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm shadow-sm ring-2 ring-emerald-50">2</span>
                  ตัด Dough (Cutting)
                </h3>
                {renderStandardTable('cutting', 'ตารางการตัด Dough')}
              </section>
              <section>
                <h3 className="text-lg font-bold text-sky-900 mb-4 flex items-center gap-2 mt-4">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-100 text-sky-700 border border-sky-200 text-sm shadow-sm ring-2 ring-sky-50">3</span>
                  ชิ้น/Unit (Item Output)
                </h3>
                {renderStandardTable('items', 'ตารางผลผลิต (ชิ้น)')}
              </section>
            </div>
          )}
          {activeTab === 'sales' && renderSalesTable()}
        </div>
      </div>
      
      <p className="text-xs text-slate-500 text-center mt-4 mb-8">
        * ข้อมูลในตารางจะถูกบันทึกชั่วคราวขณะใช้งาน กดปุ่มบันทึกข้อมูลเพื่ออัปเดตระบบ
      </p>

      {showConfirmSave && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-2">ยืนยันการบันทึก</h3>
              <p className="text-slate-600 mb-6 text-sm">คุณต้องการอัปเดตข้อมูลแผนงานเข้าสู่ระบบใช่หรือไม่?</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmSave(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={executeSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors shadow-sm"
                >
                  ยืนยันการบันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-semibold text-slate-800">บันทึกเป็นแผนงาน</h3>
              <button onClick={() => setShowSaveTemplateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-200">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อแผนงาน</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  placeholder="เช่น แผนงานช่วง High Season"
                  value={templateNameInput}
                  onChange={e => setTemplateNameInput(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button 
                onClick={() => setShowSaveTemplateModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleSaveTemplate}
                disabled={!templateNameInput.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                บันทึกแผนงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoadTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-semibold text-slate-800">เลือกใช้แผนงาน</h3>
              <button onClick={() => setShowLoadTemplateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-200">
                <X size={18} />
              </button>
            </div>
            <div className="p-2 overflow-y-auto custom-scrollbar">
              {doughTemplates.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  ยังไม่มีแผนงานที่บันทึกไว้
                </div>
              ) : (
                <div className="space-y-1">
                  {doughTemplates.map((template, idx) => (
                    <div key={template.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all gap-2">
                      <span className="font-medium text-sm text-slate-800">{template.name}</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleDeleteTemplate(idx)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          title="ลบแผนงาน"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleLoadTemplate(template)}
                          className="flex items-center justify-center w-full sm:w-auto gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold transition-colors border border-amber-200 rounded-lg"
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
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between gap-4">
              <button 
                onClick={initCreateTemplate}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors border border-amber-200"
              >
                <Plus size={16} />
                สร้างแผนงาน
              </button>
              <button 
                onClick={() => setShowLoadTemplateModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-200 bg-slate-50 gap-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <PlusCircle size={20} className="text-amber-600" />
                สร้างแผนงาน ตี & ตัด Dough
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="ชื่อแผนงาน (เช่น แผนช่วงเทศกาล)"
                  className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm w-64"
                  value={createTemplateName}
                  onChange={e => setCreateTemplateName(e.target.value)}
                />
                <button onClick={() => setShowCreateTemplateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-200">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-0 overflow-y-auto custom-scrollbar flex-1 bg-slate-50 flex flex-col gap-6 pb-6">
              <div className="bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                <div className="px-4 py-3 border-b border-amber-100 flex items-center gap-2 bg-gradient-to-r from-amber-50 to-white">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 text-amber-800 text-xs font-bold ring-2 ring-amber-100">1</span>
                  <h4 className="font-bold text-amber-900 text-sm">รายการ ตี Dough (Mixing)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-[#fcf8f2] shadow-sm border-b border-amber-100">
                      <tr>
                        <th className="p-3 text-[13px] font-bold text-amber-900 min-w-[200px]">รายการ</th>
                        <th className="p-3 text-[13px] font-bold text-center text-amber-900 w-24">หน่วย</th>
                        <th className="p-3 text-[13px] font-bold text-center text-amber-900 w-28">ขนาด</th>
                        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                          <th key={day} className="p-3 text-[13px] font-bold text-center text-amber-900 border-l border-amber-100/50">
                            {day === 'mon' ? 'จันทร์' : day === 'tue' ? 'อังคาร' : day === 'wed' ? 'พุธ' : day === 'thu' ? 'พฤหัสฯ' : day === 'fri' ? 'ศุกร์' : day === 'sat' ? 'เสาร์' : 'อาทิตย์'}
                          </th>
                        ))}
                        <th className="p-3 text-[13px] font-bold text-center text-amber-900 w-12 border-l border-amber-100/50">ลบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {createTemplateItems.map((item, index) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
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
                              className="w-full bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 py-1.5 px-2 text-[13px] text-slate-700 outline-none"
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
                              className="w-full bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 py-1.5 px-2 text-[13px] text-slate-700 outline-none disabled:opacity-50"
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
                              className="w-full bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 py-1.5 px-2 text-[13px] text-slate-700 outline-none disabled:opacity-50"
                            >
                              <option value="">ขนาด</option>
                              {Array.from(new Set(mixingSettings.filter((s:any) => s.name === item.name && s.unit === item.unit).map((s:any) => s.size).filter(Boolean))).map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                            <td key={day} className="p-2 border-l border-slate-100">
                              <input
                                type="number"
                                min="0"
                                className="w-full text-center py-1.5 px-1 bg-white border border-slate-200 rounded-lg hover:border-amber-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-[13px] transition-all"
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
                          <td className="p-2 border-l border-slate-100 text-center">
                            <button
                              onClick={() => {
                                const newItems = [...createTemplateItems];
                                newItems.splice(index, 1);
                                setCreateTemplateItems(newItems);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={11} className="py-3 px-4 border-t border-amber-100/50 bg-amber-50/50">
                          <button 
                            onClick={addCreateTemplateRow} 
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors border border-amber-200/50"
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

              <div className="bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                <div className="px-4 py-3 border-b border-emerald-100 flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-white">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-200 text-emerald-800 text-xs font-bold ring-2 ring-emerald-100">2</span>
                  <h4 className="font-bold text-emerald-900 text-sm">รายการ ตัด Dough (Cutting)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-[#f2fcf7] shadow-sm border-b border-emerald-100">
                      <tr>
                        <th className="p-3 text-[13px] font-bold text-emerald-900 min-w-[200px]">เป้าหมาย</th>
                        <th className="p-3 text-[13px] font-bold text-center text-emerald-900 w-32">Dough ต้นทาง</th>
                        <th className="p-3 text-[13px] font-bold text-center text-emerald-900 w-24">หน่วย</th>
                        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                          <th key={day} className="p-3 text-[13px] font-bold text-center text-emerald-900 border-l border-emerald-100/50">
                            {day === 'mon' ? 'จันทร์' : day === 'tue' ? 'อังคาร' : day === 'wed' ? 'พุธ' : day === 'thu' ? 'พฤหัสฯ' : day === 'fri' ? 'ศุกร์' : day === 'sat' ? 'เสาร์' : 'อาทิตย์'}
                          </th>
                        ))}
                        <th className="p-3 text-[13px] font-bold text-center text-emerald-900 w-12 border-l border-emerald-100/50">ลบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {createTemplateCuttingItems.map((item, index) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
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
                              className="w-full bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 py-1.5 px-2 text-[13px] text-slate-700 outline-none"
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
                              className="w-full bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 py-1.5 px-2 text-[13px] text-slate-700 outline-none disabled:opacity-50"
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
                              className="w-full text-center bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 text-[13px] text-slate-500 outline-none select-none"
                            />
                          </td>
                          {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                            <td key={day} className="p-2 border-l border-slate-100">
                              <input
                                type="number"
                                min="0"
                                className="w-full text-center py-1.5 px-1 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-[13px] transition-all"
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
                          <td className="p-2 border-l border-slate-100 text-center">
                            <button
                              onClick={() => {
                                const newItems = [...createTemplateCuttingItems];
                                newItems.splice(index, 1);
                                setCreateTemplateCuttingItems(newItems);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={11} className="py-3 px-4 border-t border-emerald-100/50 bg-emerald-50/50">
                          <button 
                            onClick={addCreateTemplateCuttingRow} 
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors border border-emerald-200/50"
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

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowCreateTemplateModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleSaveCreatedTemplate}
                disabled={!createTemplateName.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-all disabled:opacity-50"
              >
                <Save size={18} />
                บันทึกเป็นแผนงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Settings size={20} className="text-amber-600" />
                ตั้งค่าระบบ (Settings)
              </h3>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-slate-900 mb-3 flex items-center justify-between">
                    <span>1. รายการ ตี Dough (Mixing)</span>
                    <button 
                      onClick={() => {
                        const newId = Date.now().toString();
                        setTempMixingSettings([...tempMixingSettings, { id: newId, name: '', unit: '', size: '' }]);
                      }}
                      className="text-amber-600 hover:text-amber-700 text-xs flex items-center gap-1 font-medium bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded"
                    >
                      <PlusCircle size={14} /> เพิ่มรายการ
                    </button>
                  </h4>
                  <p className="text-xs text-slate-500 mb-4 pb-4 border-b border-slate-100">
                    กำหนดชนิดแป้ง หน่วย และขนาด สำหรับใช้ในแผนงานตี Dough
                  </p>
                  
                  <div className="border border-slate-200 rounded-lg overflow-hidden mb-8">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-medium whitespace-nowrap">
                        <tr>
                          <th className="px-2 py-3 border-b border-slate-200 w-[5%] text-center"></th>
                          <th className="px-2 py-3 border-b border-slate-200">ชนิดแป้ง (Type)</th>
                          <th className="px-2 py-3 border-b border-slate-200">หน่วยต่อสูตร (Unit)</th>
                          <th className="px-2 py-3 border-b border-slate-200">ขนาดต่อสูตร (Size)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tempMixingSettings.map((setting) => (
                          <tr key={setting.id} className="hover:bg-slate-50 flex-col sm:table-row">
                            <td className="px-2 py-2 text-center">
                              <button 
                                onClick={() => setTempMixingSettings(prev => prev.filter(s => s.id !== setting.id))}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="ลบ"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                            <td className="px-2 py-2">
                              <input 
                                type="text"
                                value={setting.name}
                                onChange={(e) => setTempMixingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, name: e.target.value } : s))}
                                className="w-full text-sm border-slate-200 rounded-md focus:ring-amber-500 py-1.5 px-2 bg-white"
                                placeholder="เช่น ครัวซองค์"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input 
                                type="text"
                                value={setting.unit}
                                onChange={(e) => setTempMixingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, unit: e.target.value } : s))}
                                className="w-full text-sm border-slate-200 rounded-md focus:ring-amber-500 py-1.5 px-2 bg-white"
                                placeholder="เช่น Dough"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input 
                                type="text"
                                value={setting.size}
                                onChange={(e) => setTempMixingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, size: e.target.value } : s))}
                                className="w-full text-sm border-slate-200 rounded-md focus:ring-amber-500 py-1.5 px-2 bg-white"
                                placeholder="เช่น 4 kg"
                              />
                            </td>
                          </tr>
                        ))}
                        {tempMixingSettings.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                              ยังไม่มีการตั้งค่า
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="text-sm font-medium text-slate-900 mb-3 flex items-center justify-between">
                    <span>2. รายการ ตัด Dough (Cutting Ratios)</span>
                    <button 
                      onClick={() => {
                        const newId = Date.now().toString();
                        setTempCuttingSettings([...tempCuttingSettings, { id: newId, sourceDough: '', target: '', ratio: 1, unit: '' }]);
                      }}
                      className="text-amber-600 hover:text-amber-700 text-xs flex items-center gap-1 font-medium bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded"
                    >
                      <PlusCircle size={14} /> เพิ่มรายการ
                    </button>
                  </h4>
                  <p className="text-xs text-slate-500 mb-4 pb-4 border-b border-slate-100">
                    กำหนดค่าสัดส่วนการตัด เช่น 1 Dough ตัดเป็น ครัวซองค์ได้กี่ชิ้น
                  </p>
                  
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-medium whitespace-nowrap">
                        <tr>
                          <th className="px-2 py-3 border-b border-slate-200 w-[5%] text-center"></th>
                          <th className="px-2 py-3 border-b border-slate-200">ตัดจาก (Source Dough)</th>
                          <th className="px-2 py-3 border-b border-slate-200">แปลงเป็นรายการ (Target Item)</th>
                          <th className="px-2 py-3 border-b border-slate-200 w-[15%] text-center">จำนวน (Ratio)</th>
                          <th className="px-2 py-3 border-b border-slate-200 w-[15%] text-center">หน่วย (Unit)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tempCuttingSettings.map((setting) => (
                          <tr key={setting.id} className="hover:bg-slate-50 flex-col sm:table-row">
                            <td className="px-2 py-2 text-center">
                              <button 
                                onClick={() => setTempCuttingSettings(prev => prev.filter(s => s.id !== setting.id))}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="ลบ"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                            <td className="px-2 py-2">
                              <select 
                                value={setting.sourceDough}
                                onChange={(e) => setTempCuttingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, sourceDough: e.target.value } : s))}
                                className="w-full text-sm border-slate-200 rounded-md focus:ring-amber-500 py-1.5 px-2 bg-white"
                              >
                                <option value="">เลือกจากรายการที่ตี...</option>
                                {Array.from(new Set(tempMixingSettings.map(m => m.name).filter(Boolean))).map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <input 
                                type="text"
                                value={setting.target}
                                onChange={(e) => setTempCuttingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, target: e.target.value } : s))}
                                className="w-full text-sm border-slate-200 rounded-md focus:ring-amber-500 py-1.5 px-2 bg-white"
                                placeholder="เช่น ครัวซองค์เนยสด"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input 
                                type="number"
                                value={setting.ratio}
                                onChange={(e) => setTempCuttingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, ratio: Number(e.target.value) } : s))}
                                className="w-full text-sm border-slate-200 rounded-md focus:ring-amber-500 py-1.5 px-2 text-center bg-white"
                                min={1}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input 
                                type="text"
                                value={setting.unit}
                                onChange={(e) => setTempCuttingSettings(prev => prev.map(s => s.id === setting.id ? { ...s, unit: e.target.value } : s))}
                                className="w-full text-sm border-slate-200 rounded-md focus:ring-amber-500 py-1.5 px-2 text-center bg-white"
                                placeholder="ชิ้น"
                              />
                            </td>
                          </tr>
                        ))}
                        {tempCuttingSettings.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                              ยังไม่มีการตั้งค่า
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-4 mt-6 border-t border-slate-200">
                  <h4 className="text-sm font-medium text-slate-900 mb-3 flex items-center justify-between">
                    <span>3. ชิ้น/unit (item output)</span>
                    <button 
                      onClick={() => {
                        const newId = Date.now().toString();
                        setTempItemSettings([...tempItemSettings, { id: newId, targetItem: '', menu: '' }]);
                      }}
                      className="text-amber-600 hover:text-amber-700 text-xs flex items-center gap-1 font-medium bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded"
                    >
                      <PlusCircle size={14} /> เพิ่มรายการ
                    </button>
                  </h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden w-full overflow-x-auto">
                    <table className="min-w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-2 py-3 border-b border-slate-200 w-10"></th>
                          <th className="px-2 py-3 border-b border-slate-200">จากรายการ (Target Item)</th>
                          <th className="px-2 py-3 border-b border-slate-200 w-48 text-center">เมนู (Menu)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tempItemSettings.map((setting) => (
                          <tr key={setting.id} className="hover:bg-slate-50 flex-col sm:table-row">
                            <td className="px-2 py-2 text-center">
                              <button 
                                onClick={() => setTempItemSettings(prev => prev.filter(s => s.id !== setting.id))}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="ลบ"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                            <td className="px-2 py-2">
                              <select 
                                value={setting.targetItem}
                                onChange={(e) => setTempItemSettings(prev => prev.map(s => s.id === setting.id ? { ...s, targetItem: e.target.value } : s))}
                                className="w-full text-sm border-slate-200 rounded-md focus:ring-amber-500 py-1.5 px-2 bg-white"
                              >
                                <option value="">เลือกจากรายการที่ตัด...</option>
                                {Array.from(new Set(tempCuttingSettings.map(m => m.target).filter(Boolean))).map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <input 
                                type="text"
                                value={setting.menu}
                                onChange={(e) => setTempItemSettings(prev => prev.map(s => s.id === setting.id ? { ...s, menu: e.target.value } : s))}
                                className="w-full text-sm border-slate-200 rounded-md focus:ring-amber-500 py-1.5 px-2 text-center bg-white"
                                placeholder="เช่น ครัวซองค์เนยสด"
                              />
                            </td>
                          </tr>
                        ))}
                        {tempItemSettings.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                              ยังไม่มีการตั้งค่า
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-4 mt-6 border-t border-slate-200">
                  <h4 className="text-sm font-medium text-slate-900 mb-2">การตั้งค่าอื่นๆ (รอการพัฒนา)</h4>
                  <p className="text-xs text-slate-500">ส่วนนี้สำหรับตั้งค่าการแจ้งเตือน หรือสิทธิ์การเข้าถึงในอนาคต</p>
                </div>
              </div>
            </div>

            {saveSettingsError && (
              <div className="px-6 py-2.5 bg-red-50 text-red-600 text-xs font-semibold border-t border-red-100 flex items-center gap-1.5">
                <span>⚠️ {saveSettingsError}</span>
              </div>
            )}

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 items-center">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                disabled={isSavingSettings}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                ปิด
              </button>
              <button 
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
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
                    <Save size={16} />
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
