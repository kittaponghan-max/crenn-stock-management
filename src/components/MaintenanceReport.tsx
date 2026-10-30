import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Wrench, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  ChevronLeft, 
  ChevronDown, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Trash2, 
  Edit3, 
  Eye, 
  Camera, 
  Upload, 
  X, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Building, 
  Coffee, 
  Cake, 
  Layers, 
  Phone, 
  User, 
  DollarSign, 
  Sparkles, 
  Database, 
  Copy, 
  Check, 
  RefreshCw, 
  Loader2,
  AlertCircle,
  Tag
} from 'lucide-react';
import { format, isAfter, isBefore, addDays, parseISO, isToday, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { th } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { MaintenanceRecord, MaintenanceType, MaintenanceStatus, Branch } from '../types';
import { supabase } from '../lib/supabase';
import { generateUUID } from '../lib/utils';

interface MaintenanceReportProps {
  currentUser?: string;
  onBack: () => void;
  branch?: Branch;
  isReadOnly?: boolean;
}

// Preset equipment lists for rapid entry
const PRESET_EQUIPMENT: {
  department: 'Bar' | 'Bakery' | 'General';
  category: string;
  name: string;
  codePrefix: string;
}[] = [
  // Bar
  { department: 'Bar', category: 'Coffee Machine', name: 'เครื่องชงกาแฟ Espresso (La Marzocco Linea PB)', codePrefix: 'BAR-ESP-01' },
  { department: 'Bar', category: 'Coffee Grinder', name: 'เครื่องบดกาแฟหลัก Main Grinder (Mazzer Robur S)', codePrefix: 'BAR-GRD-01' },
  { department: 'Bar', category: 'Coffee Grinder', name: 'เครื่องบดกาแฟ Single Origin (Mahlkönig EK43)', codePrefix: 'BAR-GRD-02' },
  { department: 'Bar', category: 'Water Filtration', name: 'เครื่องกรองน้ำระบบ RO (RO Water Filtration)', codePrefix: 'BAR-RO-01' },
  { department: 'Bar', category: 'Ice Maker', name: 'เครื่องทำน้ำแข็ง (Hoshizaki Ice Maker)', codePrefix: 'BAR-ICE-01' },
  { department: 'Bar', category: 'Refrigeration', name: 'ตู้เย็นใต้เคาน์เตอร์บาร์ (Under-counter Chiller)', codePrefix: 'BAR-REF-01' },
  { department: 'Bar', category: 'Refrigeration', name: 'ตู้แช่แข็งบาร์ (Bar Deep Freezer)', codePrefix: 'BAR-FRZ-01' },
  { department: 'Bar', category: 'Blender', name: 'เครื่องปั่นสมูทตี้ (Vitamix The Quiet One)', codePrefix: 'BAR-BLN-01' },
  { department: 'Bar', category: 'Water Boiler', name: 'เครื่องต้มน้ำร้อน / ดริปกาแฟ (Hot Water Boiler)', codePrefix: 'BAR-BOIL-01' },
  { department: 'Bar', category: 'Dishwasher', name: 'เครื่องล้างแก้วอัตโนมัติ (Glass Washer)', codePrefix: 'BAR-WSH-01' },

  // Bakery
  { department: 'Bakery', category: 'Oven', name: 'เตาอบไฟฟ้าหลัก Deck Oven (Sveba Dahlen / Salva)', codePrefix: 'BAK-OVN-01' },
  { department: 'Bakery', category: 'Oven', name: 'เตาอบลมร้อน Convection Oven (Unox Bakerlux)', codePrefix: 'BAK-OVN-02' },
  { department: 'Bakery', category: 'Mixer', name: 'เครื่องตีแป้ง Planetary Mixer 20L (Hobart / Spar)', codePrefix: 'BAK-MIX-01' },
  { department: 'Bakery', category: 'Mixer', name: 'เครื่องนวดแป้งเกลียว Spiral Mixer (Sinmag)', codePrefix: 'BAK-MIX-02' },
  { department: 'Bakery', category: 'Sheeter', name: 'เครื่องรีดแป้งพาย / ครัวซองต์ (Dough Sheeter)', codePrefix: 'BAK-SHT-01' },
  { department: 'Bakery', category: 'Proofer', name: 'ตู้หมักแป้งควบคุมอุณหภูมิ (Proofer Cabinet)', codePrefix: 'BAK-PRF-01' },
  { department: 'Bakery', category: 'Refrigeration', name: 'ตู้แช่แข็งวัตถุดิบครัว Deep Freezer (-20°C)', codePrefix: 'BAK-FRZ-01' },
  { department: 'Bakery', category: 'Refrigeration', name: 'ตู้แช่เย็น 4 ประตู Chiller (0°C - 4°C)', codePrefix: 'BAK-REF-01' },
  { department: 'Bakery', category: 'Slicer', name: 'เครื่องหั่นขนมปัง (Bread Slicer Machine)', codePrefix: 'BAK-SLC-01' },
  { department: 'Bakery', category: 'Ventilation', name: 'ระบบฮูดดูดควันและระบายอากาศ (Exhaust Hood)', codePrefix: 'BAK-EXH-01' },

  // General / Facility
  { department: 'General', category: 'HVAC / AC', name: 'เครื่องปรับอากาศโซนบาร์และลูกค้า (AC 36,000 BTU)', codePrefix: 'FAC-AC-01' },
  { department: 'General', category: 'HVAC / AC', name: 'เครื่องปรับอากาศห้องเบเกอรี่ (AC 24,000 BTU)', codePrefix: 'FAC-AC-02' },
  { department: 'General', category: 'Water Pump', name: 'ปั๊มน้ำอัตโนมัติแรงดันคงที่ (Water Booster Pump)', codePrefix: 'FAC-PMP-01' },
  { department: 'General', category: 'Drainage', name: 'ถังดักไขมันสเตนเลสและท่อน้ำทิ้ง (Grease Trap)', codePrefix: 'FAC-GRS-01' },
  { department: 'General', category: 'POS & Network', name: 'ระบบ POS เครื่องพิมพ์ใบเสร็จและอินเทอร์เน็ต', codePrefix: 'FAC-POS-01' },
  { department: 'General', category: 'Safety', name: 'ถังดับเพลิงและระบบไฟฉุกเฉิน (Fire Safety)', codePrefix: 'FAC-SEC-01' }
];

const MAINTENANCE_TYPE_CONFIG: Record<MaintenanceType, { label: string; sub: string; bg: string; text: string; border: string }> = {
  Preventive: { label: 'PM บำรุงรักษาเชิงป้องกัน', sub: 'Preventive', bg: 'bg-[#E8F3F2]', text: 'text-[#2D4A49]', border: 'border-[#5A8A88]' },
  Repair: { label: 'ซ่อมแซมแก้ไข', sub: 'Corrective', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300' },
  Inspection: { label: 'ตรวจเช็คสภาพ', sub: 'Inspection', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  Calibration: { label: 'ปรับเทียบ / ตั้งค่า', sub: 'Calibration', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  PartReplacement: { label: 'เปลี่ยนอะไหล่ตามรอบ', sub: 'Replacement', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' }
};

const STATUS_CONFIG: Record<MaintenanceStatus, { label: string; badgeClass: string; dotColor: string }> = {
  Completed: { label: 'เสร็จสิ้นเรียบร้อย', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500' },
  Pending: { label: 'รอดำเนินการ / อะไหล่', badgeClass: 'bg-amber-50 text-amber-800 border-amber-300', dotColor: 'bg-amber-500' },
  Scheduled: { label: 'มีนัดหมายล่วงหน้า', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200', dotColor: 'bg-blue-500' }
};

export const MaintenanceReport: React.FC<MaintenanceReportProps> = ({
  currentUser = 'Admin',
  onBack,
  branch,
  isReadOnly = false
}) => {
  const currentBranch: Branch = branch || (() => {
    try {
      const savedUser = localStorage.getItem('cafe-user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.branch) return parsed.branch;
      }
    } catch {}
    return 'Rayong';
  })();

  // Core Data State
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingLocalStorage, setIsUsingLocalStorage] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<Branch | 'All'>(currentBranch);
  const [departmentFilter, setDepartmentFilter] = useState<'All' | 'Bar' | 'Bakery' | 'General'>('All');
  const [typeFilter, setTypeFilter] = useState<MaintenanceType | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | 'All'>('All');
  const [dateFilter, setDateFilter] = useState<'All' | 'Today' | '7Days' | 'ThisMonth' | 'Custom'>('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<MaintenanceRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<MaintenanceRecord | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields State
  const [formData, setFormData] = useState<{
    date: string;
    time: string;
    branch: Branch;
    department: 'Bar' | 'Bakery' | 'General';
    equipmentName: string;
    equipmentCode: string;
    category: string;
    maintenanceType: MaintenanceType;
    status: MaintenanceStatus;
    details: string;
    partsReplaced: string;
    cost: number | '';
    performedBy: 'Internal' | 'Vendor';
    technicianName: string;
    contactNumber: string;
    nextServiceDate: string;
    notes: string;
    imageUrls: string[];
  }>({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    branch: currentBranch,
    department: 'Bar',
    equipmentName: '',
    equipmentCode: '',
    category: 'Coffee Machine',
    maintenanceType: 'Preventive',
    status: 'Completed',
    details: '',
    partsReplaced: '',
    cost: '',
    performedBy: 'Internal',
    technicianName: '',
    contactNumber: '',
    nextServiceDate: '',
    notes: '',
    imageUrls: []
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to sync to LocalStorage
  const saveToLocalStorage = useCallback((data: MaintenanceRecord[]) => {
    try {
      localStorage.setItem(`cafe-maintenance-records-${currentBranch}`, JSON.stringify(data));
      localStorage.setItem('cafe-maintenance-records-all', JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [currentBranch]);

  // Load from LocalStorage
  const loadFromLocalStorage = useCallback((): MaintenanceRecord[] => {
    try {
      const branchKey = `cafe-maintenance-records-${currentBranch}`;
      const saved = localStorage.getItem(branchKey) || localStorage.getItem('cafe-maintenance-records-all');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('LocalStorage load error:', e);
    }
    return [];
  }, [currentBranch]);

  // Fetch from Supabase with LocalStorage fallback
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    let supabaseSuccess = false;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('maintenance_records')
          .select('*')
          .order('date', { ascending: false })
          .order('timestamp', { ascending: false });

        if (!error && data) {
          const mapped: MaintenanceRecord[] = data.map((r: any) => ({
            id: r.id,
            timestamp: r.timestamp || r.created_at || new Date().toISOString(),
            date: r.date || format(new Date(), 'yyyy-MM-dd'),
            time: r.time || '',
            branch: r.branch || currentBranch,
            department: r.department || 'Bar',
            equipmentName: r.equipment_name || r.equipmentName || '',
            equipmentCode: r.equipment_code || r.equipmentCode || '',
            category: r.category || 'General',
            maintenanceType: r.maintenance_type || r.maintenanceType || 'Preventive',
            status: r.status || 'Completed',
            details: r.details || '',
            partsReplaced: r.parts_replaced || r.partsReplaced || '',
            cost: typeof r.cost === 'number' ? r.cost : parseFloat(r.cost) || 0,
            performedBy: r.performed_by || r.performedBy || 'Internal',
            technicianName: r.technician_name || r.technicianName || '',
            contactNumber: r.contact_number || r.contactNumber || '',
            nextServiceDate: r.next_service_date || r.nextServiceDate || '',
            imageUrl: r.image_url || r.imageUrl || '',
            imageUrls: Array.isArray(r.image_urls) ? r.image_urls : (r.image_url ? [r.image_url] : []),
            recorderName: r.recorder_name || r.recorderName || 'Unknown',
            notes: r.notes || ''
          }));

          setRecords(mapped);
          saveToLocalStorage(mapped);
          setIsUsingLocalStorage(false);
          supabaseSuccess = true;
        } else {
          console.warn('Supabase query error for maintenance_records, using localStorage:', error?.message);
        }
      } catch (err) {
        console.warn('Supabase fetch exception for maintenance_records:', err);
      }
    }

    if (!supabaseSuccess) {
      const local = loadFromLocalStorage();
      setRecords(local);
      setIsUsingLocalStorage(true);
    }

    setLoading(false);
    setLastRefreshed(new Date());
  }, [currentBranch, saveToLocalStorage, loadFromLocalStorage]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Handle Photo compression & upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 900;
          const MAX_HEIGHT = 900;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', 0.65);
          setFormData(prev => ({
            ...prev,
            imageUrls: [...prev.imageUrls, compressed]
          }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== idx)
    }));
  };

  // Open Form for Adding New Record
  const openNewForm = () => {
    setEditingRecord(null);
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
      branch: currentBranch,
      department: 'Bar',
      equipmentName: '',
      equipmentCode: '',
      category: 'Coffee Machine',
      maintenanceType: 'Preventive',
      status: 'Completed',
      details: '',
      partsReplaced: '',
      cost: '',
      performedBy: 'Internal',
      technicianName: '',
      contactNumber: '',
      nextServiceDate: '',
      notes: '',
      imageUrls: []
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Form for Editing Record
  const openEditForm = (rec: MaintenanceRecord) => {
    setEditingRecord(rec);
    setFormData({
      date: rec.date,
      time: rec.time || format(new Date(), 'HH:mm'),
      branch: rec.branch,
      department: rec.department,
      equipmentName: rec.equipmentName,
      equipmentCode: rec.equipmentCode || '',
      category: rec.category,
      maintenanceType: rec.maintenanceType,
      status: rec.status,
      details: rec.details,
      partsReplaced: rec.partsReplaced || '',
      cost: rec.cost !== undefined ? rec.cost : '',
      performedBy: rec.performedBy,
      technicianName: rec.technicianName || '',
      contactNumber: rec.contactNumber || '',
      nextServiceDate: rec.nextServiceDate || '',
      notes: rec.notes || '',
      imageUrls: rec.imageUrls && rec.imageUrls.length > 0 ? rec.imageUrls : (rec.imageUrl ? [rec.imageUrl] : [])
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  // Handle Preset Select
  const handleSelectPreset = (preset: typeof PRESET_EQUIPMENT[0]) => {
    setFormData(prev => ({
      ...prev,
      department: preset.department,
      category: preset.category,
      equipmentName: preset.name,
      equipmentCode: prev.equipmentCode ? prev.equipmentCode : preset.codePrefix
    }));
  };

  // Save Record (Insert / Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipmentName.trim()) {
      setFormError('กรุณาระบุชื่อเครื่องมือหรืออุปกรณ์');
      return;
    }
    if (!formData.details.trim()) {
      setFormError('กรุณาระบุรายละเอียดการตรวจเช็คหรือการบำรุงรักษา');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    const costNum = typeof formData.cost === 'number' ? formData.cost : parseFloat(String(formData.cost)) || 0;
    const nowIso = new Date().toISOString();

    const recordToSave: MaintenanceRecord = {
      id: editingRecord ? editingRecord.id : generateUUID(),
      timestamp: editingRecord ? editingRecord.timestamp : nowIso,
      date: formData.date || format(new Date(), 'yyyy-MM-dd'),
      time: formData.time,
      branch: formData.branch,
      department: formData.department,
      equipmentName: formData.equipmentName.trim(),
      equipmentCode: formData.equipmentCode.trim(),
      category: formData.category.trim() || 'General',
      maintenanceType: formData.maintenanceType,
      status: formData.status,
      details: formData.details.trim(),
      partsReplaced: formData.partsReplaced.trim(),
      cost: costNum,
      performedBy: formData.performedBy,
      technicianName: formData.technicianName.trim(),
      contactNumber: formData.contactNumber.trim(),
      nextServiceDate: formData.nextServiceDate || undefined,
      imageUrl: formData.imageUrls[0] || '',
      imageUrls: formData.imageUrls,
      recorderName: editingRecord ? editingRecord.recorderName : currentUser,
      notes: formData.notes.trim()
    };

    let updatedList: MaintenanceRecord[] = [];
    if (editingRecord) {
      updatedList = records.map(r => r.id === editingRecord.id ? recordToSave : r);
    } else {
      updatedList = [recordToSave, ...records];
    }

    // Try Supabase first
    if (supabase) {
      try {
        const payload = {
          id: recordToSave.id,
          date: recordToSave.date,
          time: recordToSave.time,
          branch: recordToSave.branch,
          department: recordToSave.department,
          equipment_name: recordToSave.equipmentName,
          equipment_code: recordToSave.equipmentCode,
          category: recordToSave.category,
          maintenance_type: recordToSave.maintenanceType,
          status: recordToSave.status,
          details: recordToSave.details,
          parts_replaced: recordToSave.partsReplaced,
          cost: recordToSave.cost,
          performed_by: recordToSave.performedBy,
          technician_name: recordToSave.technicianName,
          contact_number: recordToSave.contactNumber,
          next_service_date: recordToSave.nextServiceDate || null,
          image_url: recordToSave.imageUrl,
          image_urls: recordToSave.imageUrls,
          recorder_name: recordToSave.recorderName,
          notes: recordToSave.notes,
          timestamp: recordToSave.timestamp
        };

        const { error } = await supabase
          .from('maintenance_records')
          .upsert(payload);

        if (error) {
          console.warn('Supabase upsert failed, saving locally:', error.message);
          setIsUsingLocalStorage(true);
        } else {
          setIsUsingLocalStorage(false);
        }
      } catch (err) {
        console.warn('Supabase upsert exception, saving locally:', err);
        setIsUsingLocalStorage(true);
      }
    }

    setRecords(updatedList);
    saveToLocalStorage(updatedList);

    if (viewingRecord && viewingRecord.id === recordToSave.id) {
      setViewingRecord(recordToSave);
    }

    setIsSaving(false);
    setIsFormOpen(false);
    setEditingRecord(null);
  };

  // Delete Record
  const confirmDelete = async () => {
    if (!recordToDelete) return;

    const id = recordToDelete.id;
    const updated = records.filter(r => r.id !== id);

    if (supabase) {
      try {
        await supabase.from('maintenance_records').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete error:', err);
      }
    }

    setRecords(updated);
    saveToLocalStorage(updated);

    if (viewingRecord && viewingRecord.id === id) {
      setViewingRecord(null);
    }
    setRecordToDelete(null);
  };

  // Filtered Records Calculation
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      // Branch
      if (selectedBranch !== 'All' && rec.branch !== selectedBranch) return false;
      // Department
      if (departmentFilter !== 'All' && rec.department !== departmentFilter) return false;
      // Type
      if (typeFilter !== 'All' && rec.maintenanceType !== typeFilter) return false;
      // Status
      if (statusFilter !== 'All' && rec.status !== statusFilter) return false;

      // Date Filter
      if (dateFilter === 'Today') {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        if (rec.date !== todayStr) return false;
      } else if (dateFilter === '7Days') {
        const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
        if (rec.date < sevenDaysAgo) return false;
      } else if (dateFilter === 'ThisMonth') {
        const startMonthStr = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        const endMonthStr = format(endOfMonth(new Date()), 'yyyy-MM-dd');
        if (rec.date < startMonthStr || rec.date > endMonthStr) return false;
      } else if (dateFilter === 'Custom') {
        if (customStartDate && rec.date < customStartDate) return false;
        if (customEndDate && rec.date > customEndDate) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = rec.equipmentName.toLowerCase().includes(q);
        const matchCode = (rec.equipmentCode || '').toLowerCase().includes(q);
        const matchTech = (rec.technicianName || '').toLowerCase().includes(q);
        const matchDetails = rec.details.toLowerCase().includes(q);
        const matchCategory = rec.category.toLowerCase().includes(q);
        const matchParts = (rec.partsReplaced || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchTech && !matchDetails && !matchCategory && !matchParts) {
          return false;
        }
      }

      return true;
    });
  }, [records, selectedBranch, departmentFilter, typeFilter, statusFilter, dateFilter, customStartDate, customEndDate, searchQuery]);

  // Statistics KPI
  const stats = useMemo(() => {
    const totalCount = filteredRecords.length;
    const completedCount = filteredRecords.filter(r => r.status === 'Completed').length;
    const pendingCount = filteredRecords.filter(r => r.status === 'Pending').length;
    const scheduledCount = filteredRecords.filter(r => r.status === 'Scheduled').length;
    const totalCost = filteredRecords.reduce((sum, r) => sum + (r.cost || 0), 0);

    // Upcoming next service within 30 days
    const today = new Date();
    const thirtyDaysLater = addDays(today, 30);
    const todayStr = format(today, 'yyyy-MM-dd');
    const thirtyDaysStr = format(thirtyDaysLater, 'yyyy-MM-dd');

    const upcomingDueList = records.filter(r => {
      if (!r.nextServiceDate) return false;
      return r.nextServiceDate >= todayStr && r.nextServiceDate <= thirtyDaysStr;
    });

    const overdueList = records.filter(r => {
      if (!r.nextServiceDate) return false;
      return r.nextServiceDate < todayStr && r.status !== 'Completed';
    });

    return {
      totalCount,
      completedCount,
      pendingCount,
      scheduledCount,
      totalCost,
      upcomingDueCount: upcomingDueList.length,
      overdueCount: overdueList.length,
      upcomingDueList,
      overdueList
    };
  }, [filteredRecords, records]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) return;

    const exportRows = filteredRecords.map((r, i) => ({
      'ลำดับ': i + 1,
      'วันที่': r.date,
      'เวลา': r.time || '-',
      'สาขา': r.branch,
      'แผนก': r.department === 'Bar' ? 'บาร์' : r.department === 'Bakery' ? 'เบเกอรี่' : 'ส่วนกลาง',
      'ชื่ออุปกรณ์/เครื่องมือ': r.equipmentName,
      'รหัสอุปกรณ์': r.equipmentCode || '-',
      'หมวดหมู่': r.category,
      'ประเภทงาน': MAINTENANCE_TYPE_CONFIG[r.maintenanceType]?.label || r.maintenanceType,
      'สถานะ': STATUS_CONFIG[r.status]?.label || r.status,
      'รายละเอียดการทำงาน': r.details,
      'อะไหล่ที่เปลี่ยน': r.partsReplaced || '-',
      'ค่าใช้จ่าย (บาท)': r.cost || 0,
      'ผู้ดำเนินงาน': r.performedBy === 'Internal' ? 'ทีมงานภายใน' : 'ช่างบริการภายนอก',
      'ชื่อช่าง / บริษัท': r.technicianName || '-',
      'เบอร์ติดต่อ': r.contactNumber || '-',
      'กำหนดรอบถัดไป': r.nextServiceDate || '-',
      'ผู้บันทึก': r.recorderName,
      'หมายเหตุ': r.notes || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Maintenance');

    const fileName = `CRENN_Maintenance_${selectedBranch}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // SQL schema definition for user copy-paste
  const sqlSchemaScript = `-- Run this in Supabase SQL Editor to enable Cloud Sync for Maintenance Records:
CREATE TABLE IF NOT EXISTS public.maintenance_records (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    time TEXT,
    branch TEXT NOT NULL DEFAULT 'Rayong',
    department TEXT NOT NULL DEFAULT 'Bar',
    equipment_name TEXT NOT NULL,
    equipment_code TEXT,
    category TEXT NOT NULL DEFAULT 'General',
    maintenance_type TEXT NOT NULL DEFAULT 'Preventive',
    status TEXT NOT NULL DEFAULT 'Completed',
    details TEXT NOT NULL,
    parts_replaced TEXT,
    cost NUMERIC DEFAULT 0,
    performed_by TEXT DEFAULT 'Internal',
    technician_name TEXT,
    contact_number TEXT,
    next_service_date DATE,
    image_url TEXT,
    image_urls JSONB DEFAULT '[]'::jsonb,
    recorder_name TEXT,
    notes TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

-- Allow public access for anon key
CREATE POLICY "Allow public all access on maintenance_records" 
ON public.maintenance_records 
FOR ALL 
USING (true) 
WITH CHECK (true);`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlSchemaScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F4F8F7] text-slate-800 pb-16 font-sans">
      
      {/* ── 1. HEADER CARD ── */}
      <div className="bg-white border-b border-[#D4E4E3] shadow-2xs sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Title & Back */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 rounded-xl bg-[#E8F3F2] hover:bg-[#D4E4E3] text-[#2D4A49] flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              title="กลับหน้าหลัก"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#2D4A49] text-white flex items-center justify-center shadow-xs">
                <Wrench size={19} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-[#2D4A49] leading-tight">
                    รายงานการบำรุงรักษาเครื่องมือและอุปกรณ์
                  </h1>
                  <span className="text-[10px] font-semibold text-[#5A8A88] bg-[#E8F3F2] px-2 py-0.5 rounded-md border border-[#D4E4E3]">
                    {selectedBranch === 'All' ? 'ทุกสาขา' : `สาขา ${selectedBranch}`}
                  </span>
                </div>
                <p className="text-[11px] text-[#6B8F8E]">
                  บันทึกประวัติการตรวจเช็ค, ซ่อมแซม, PM และเปลี่ยนอะไหล่เครื่องมือในร้าน
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sync status */}
            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                isUsingLocalStorage 
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
              title="ดูการเชื่อมต่อฐานข้อมูล Supabase"
            >
              <Database size={13} />
              <span>{isUsingLocalStorage ? 'โหมด Local (คลิกตั้งค่า DB)' : 'Supabase Cloud Sync'}</span>
            </button>

            {/* Refresh */}
            <button
              type="button"
              onClick={fetchRecords}
              disabled={loading}
              className="w-8 h-8 rounded-lg bg-[#E8F3F2] hover:bg-[#D4E4E3] text-[#2D4A49] flex items-center justify-center transition-colors cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Export Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
              className="text-[11px] font-bold text-[#2D4A49] bg-white hover:bg-[#E8F3F2] border border-[#D4E4E3] px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-40 cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>ส่งออก Excel</span>
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={() => window.print()}
              className="text-[11px] font-bold text-[#2D4A49] bg-white hover:bg-[#E8F3F2] border border-[#D4E4E3] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Printer size={14} className="text-[#5A8A88]" />
              <span className="hidden sm:inline">พิมพ์</span>
            </button>

            {/* Add Record (Primary) */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={openNewForm}
                className="text-[12px] font-bold text-white bg-[#5A8A88] hover:bg-[#476E6C] px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>บันทึกซ่อมบำรุง</span>
              </button>
            )}
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-4">

        {/* ── 2. UPCOMING / OVERDUE ALERT BANNER ── */}
        {(stats.overdueCount > 0 || stats.upcomingDueCount > 0) && (
          <div className="bg-white border border-[#D4E4E3] rounded-xl p-3.5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </span>
              <div>
                <p className="text-xs font-bold text-[#2D4A49]">
                  การแจ้งเตือนรอบการบำรุงรักษาอุปกรณ์ (Maintenance Schedule)
                </p>
                <p className="text-[11px] text-[#6B8F8E]">
                  {stats.overdueCount > 0 && (
                    <span className="text-rose-600 font-semibold mr-2">
                      ⚠️ เกินกำหนดซ่อมบำรุง {stats.overdueCount} รายการ
                    </span>
                  )}
                  {stats.upcomingDueCount > 0 && (
                    <span className="text-amber-700">
                      ⏰ ครบกำหนดใน 30 วันข้างหน้า {stats.upcomingDueCount} รายการ
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('Pending');
                  setDateFilter('All');
                }}
                className="text-[11px] font-bold text-[#5A8A88] hover:text-[#2D4A49] underline cursor-pointer"
              >
                ดูรายการค้าง
              </button>
            </div>
          </div>
        )}

        {/* ── 3. KPI OVERVIEW CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Card 1: Total */}
          <div className="bg-white rounded-xl p-3.5 border border-[#D4E4E3] shadow-2xs">
            <div className="flex items-center justify-between text-[#6B8F8E]">
              <span className="text-[11px] font-semibold">งานซ่อมบำรุงทั้งหมด</span>
              <Wrench size={15} className="text-[#5A8A88]" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-[#2D4A49] leading-none">
                {stats.totalCount}
              </span>
              <span className="text-[10px] text-slate-400">ครั้ง</span>
            </div>
          </div>

          {/* Card 2: Completed */}
          <div className="bg-white rounded-xl p-3.5 border border-[#D4E4E3] shadow-2xs">
            <div className="flex items-center justify-between text-[#6B8F8E]">
              <span className="text-[11px] font-semibold">เสร็จสิ้นเรียบร้อย</span>
              <CheckCircle2 size={15} className="text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-600 leading-none">
                {stats.completedCount}
              </span>
              <span className="text-[10px] text-slate-400">รายการ</span>
            </div>
          </div>

          {/* Card 3: Pending */}
          <div className="bg-white rounded-xl p-3.5 border border-[#D4E4E3] shadow-2xs">
            <div className="flex items-center justify-between text-[#6B8F8E]">
              <span className="text-[11px] font-semibold">รอดำเนินการ / อะไหล่</span>
              <Clock size={15} className="text-amber-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-amber-600 leading-none">
                {stats.pendingCount}
              </span>
              <span className="text-[10px] text-slate-400">รายการ</span>
            </div>
          </div>

          {/* Card 4: Total Expense */}
          <div className="bg-white rounded-xl p-3.5 border border-[#D4E4E3] shadow-2xs">
            <div className="flex items-center justify-between text-[#6B8F8E]">
              <span className="text-[11px] font-semibold">รวมค่าใช้จ่ายรอบนี้</span>
              <DollarSign size={15} className="text-[#5A8A88]" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-[#2D4A49] leading-none">
                ฿{stats.totalCost.toLocaleString('th-TH')}
              </span>
              <span className="text-[10px] text-slate-400">บาท</span>
            </div>
          </div>
        </div>

        {/* ── 4. FILTER CONTROLS BAR ── */}
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-[#D4E4E3] shadow-2xs space-y-3">
          
          {/* Top Filter Row: Search & Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
            
            {/* Search Box */}
            <div className="lg:col-span-4 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่ออุปกรณ์, รหัส, ช่าง, รายละเอียด..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-[#F4F8F7] border border-[#D4E4E3] rounded-lg text-slate-800 focus:outline-none focus:border-[#5A8A88] focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Branch Selector */}
            <div className="lg:col-span-2">
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value as any)}
                className="w-full py-2 px-2.5 text-xs bg-[#F4F8F7] border border-[#D4E4E3] rounded-lg text-[#2D4A49] font-medium focus:outline-none focus:border-[#5A8A88]"
              >
                <option value="All">ทุกสาขา (All Branches)</option>
                <option value="Rayong">สาขา Rayong</option>
                <option value="Bangkok">สาขา Bangkok</option>
              </select>
            </div>

            {/* Department Filter */}
            <div className="lg:col-span-2">
              <select
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value as any)}
                className="w-full py-2 px-2.5 text-xs bg-[#F4F8F7] border border-[#D4E4E3] rounded-lg text-[#2D4A49] font-medium focus:outline-none focus:border-[#5A8A88]"
              >
                <option value="All">ทุกแผนก (All Depts)</option>
                <option value="Bar">☕ บาร์ (Bar)</option>
                <option value="Bakery">🍳 ครัว / เบเกอรี่ (Bakery)</option>
                <option value="General">🏢 ส่วนกลาง / อาคาร (Facility)</option>
              </select>
            </div>

            {/* Maintenance Type Filter */}
            <div className="lg:col-span-2">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
                className="w-full py-2 px-2.5 text-xs bg-[#F4F8F7] border border-[#D4E4E3] rounded-lg text-[#2D4A49] font-medium focus:outline-none focus:border-[#5A8A88]"
              >
                <option value="All">ทุกประเภทงาน (All Types)</option>
                <option value="Preventive">PM บำรุงรักษาเชิงป้องกัน</option>
                <option value="Repair">ซ่อมแซมแก้ไข</option>
                <option value="Inspection">ตรวจเช็คสภาพ</option>
                <option value="Calibration">ปรับเทียบ / ตั้งค่า</option>
                <option value="PartReplacement">เปลี่ยนอะไหล่ตามรอบ</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="lg:col-span-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="w-full py-2 px-2.5 text-xs bg-[#F4F8F7] border border-[#D4E4E3] rounded-lg text-[#2D4A49] font-medium focus:outline-none focus:border-[#5A8A88]"
              >
                <option value="All">ทุกสถานะ (All Status)</option>
                <option value="Completed">เสร็จสิ้นเรียบร้อย</option>
                <option value="Pending">รอดำเนินการ / อะไหล่</option>
                <option value="Scheduled">มีนัดหมายล่วงหน้า</option>
              </select>
            </div>

          </div>

          {/* Quick Date Range Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-semibold text-[#6B8F8E] mr-1">ช่วงเวลา:</span>
            {[
              { id: 'All', label: 'ทั้งหมด' },
              { id: 'Today', label: 'วันนี้' },
              { id: '7Days', label: '7 วันล่าสุด' },
              { id: 'ThisMonth', label: 'เดือนนี้' },
              { id: 'Custom', label: 'กำหนดเอง' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDateFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  dateFilter === tab.id
                    ? 'bg-[#2D4A49] text-white font-bold shadow-2xs'
                    : 'bg-[#F4F8F7] hover:bg-[#E8F3F2] text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}

            {dateFilter === 'Custom' && (
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="py-0.5 px-2 text-xs bg-[#F4F8F7] border border-[#D4E4E3] rounded text-slate-700"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="py-0.5 px-2 text-xs bg-[#F4F8F7] border border-[#D4E4E3] rounded text-slate-700"
                />
              </div>
            )}

            {(searchQuery || selectedBranch !== currentBranch || departmentFilter !== 'All' || typeFilter !== 'All' || statusFilter !== 'All' || dateFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedBranch(currentBranch);
                  setDepartmentFilter('All');
                  setTypeFilter('All');
                  setStatusFilter('All');
                  setDateFilter('All');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 ml-auto cursor-pointer"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>

        </div>

        {/* ── 5. RECORDS TABLE / CARDS ── */}
        <div className="bg-white rounded-xl border border-[#D4E4E3] shadow-2xs overflow-hidden">
          
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 size={28} className="animate-spin text-[#5A8A88]" />
              <p className="text-xs">กำลังโหลดข้อมูลการบำรุงรักษา...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Wrench size={32} className="mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">ไม่พบบันทึกการซ่อมบำรุงตามเงื่อนไขที่เลือก</p>
              <p className="text-xs text-slate-400">
                กดปุ่ม "+ บันทึกซ่อมบำรุง" เพื่อเริ่มต้นบันทึกข้อมูลเครื่องมือหรืออุปกรณ์
              </p>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={openNewForm}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#5A8A88] hover:bg-[#476E6C] px-3.5 py-1.5 rounded-lg shadow-xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>เพิ่มรายการแรก</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1E5A7A] text-white text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3.5 w-28">วันที่ / เวลา</th>
                    <th className="py-3 px-3 w-24">สาขา / แผนก</th>
                    <th className="py-3 px-3 min-w-[200px]">อุปกรณ์ / รหัสเครื่อง</th>
                    <th className="py-3 px-3 w-36">ประเภทงาน</th>
                    <th className="py-3 px-3 min-w-[220px]">รายละเอียดการซ่อมบำรุง</th>
                    <th className="py-3 px-3 w-28 text-right">ค่าใช้จ่าย</th>
                    <th className="py-3 px-3 w-32">ผู้ดูแล / ช่าง</th>
                    <th className="py-3 px-3 w-28 text-center">สถานะ</th>
                    <th className="py-3 px-3 w-24 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredRecords.map(rec => {
                    const typeCfg = MAINTENANCE_TYPE_CONFIG[rec.maintenanceType] || MAINTENANCE_TYPE_CONFIG.Preventive;
                    const statusCfg = STATUS_CONFIG[rec.status] || STATUS_CONFIG.Completed;
                    const hasPhotos = rec.imageUrls && rec.imageUrls.length > 0;

                    return (
                      <tr 
                        key={rec.id}
                        className="hover:bg-[#F0F5F4]/60 transition-colors"
                      >
                        {/* Date & Time */}
                        <td className="py-3 px-3.5 align-top whitespace-nowrap">
                          <p className="font-bold text-[#2D4A49]">{rec.date}</p>
                          <p className="text-[10px] text-[#6B8F8E] mt-0.5">{rec.time || 'ไม่ระบุเวลา'}</p>
                          {rec.nextServiceDate && (
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-[#5A8A88] font-medium" title="รอบถัดไป">
                              <Calendar size={10} />
                              <span>ถัดไป: {rec.nextServiceDate}</span>
                            </div>
                          )}
                        </td>

                        {/* Branch / Department */}
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <span className="inline-block text-[10px] font-bold text-[#5A8A88] bg-[#E8F3F2] px-1.5 py-0.5 rounded border border-[#D4E4E3]">
                            {rec.branch}
                          </span>
                          <p className="text-[10px] font-semibold text-slate-600 mt-1 flex items-center gap-1">
                            {rec.department === 'Bar' ? <Coffee size={11} className="text-amber-700" /> : rec.department === 'Bakery' ? <Cake size={11} className="text-rose-600" /> : <Building size={11} className="text-slate-600" />}
                            <span>{rec.department === 'Bar' ? 'บาร์' : rec.department === 'Bakery' ? 'เบเกอรี่' : 'ส่วนกลาง'}</span>
                          </p>
                        </td>

                        {/* Equipment Name & Code */}
                        <td className="py-3 px-3 align-top">
                          <p className="font-bold text-[#2D4A49] leading-snug">
                            {rec.equipmentName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#6B8F8E]">
                            {rec.equipmentCode && (
                              <span className="font-mono bg-slate-100 text-slate-700 px-1 rounded">
                                {rec.equipmentCode}
                              </span>
                            )}
                            <span>{rec.category}</span>
                          </div>
                        </td>

                        {/* Type of Maintenance */}
                        <td className="py-3 px-3 align-top">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeCfg.bg} ${typeCfg.text} ${typeCfg.border}`}>
                            <span>{typeCfg.label}</span>
                          </span>
                        </td>

                        {/* Details & Parts */}
                        <td className="py-3 px-3 align-top">
                          <p className="text-slate-800 line-clamp-2 leading-relaxed">
                            {rec.details}
                          </p>
                          {rec.partsReplaced && (
                            <p className="text-[10px] text-amber-700 mt-0.5 flex items-center gap-1">
                              <Tag size={10} />
                              <span className="font-semibold">อะไหล่:</span> {rec.partsReplaced}
                            </p>
                          )}
                          {hasPhotos && (
                            <button
                              type="button"
                              onClick={() => setViewingRecord(rec)}
                              className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#5A8A88] font-bold hover:underline"
                            >
                              <Camera size={11} />
                              <span>ดูรูปถ่าย ({rec.imageUrls?.length})</span>
                            </button>
                          )}
                        </td>

                        {/* Cost */}
                        <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                          {rec.cost && rec.cost > 0 ? (
                            <span className="font-bold text-[#2D4A49]">
                              ฿{rec.cost.toLocaleString('th-TH')}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </td>

                        {/* Technician */}
                        <td className="py-3 px-3 align-top">
                          <p className="font-semibold text-slate-700 truncate">
                            {rec.technicianName || (rec.performedBy === 'Internal' ? 'ทีมงานภายใน' : 'ช่างบริการ')}
                          </p>
                          {rec.contactNumber && (
                            <p className="text-[10px] text-[#6B8F8E] flex items-center gap-1 mt-0.5">
                              <Phone size={10} />
                              <span>{rec.contactNumber}</span>
                            </p>
                          )}
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            บันทึกโดย: {rec.recorderName}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
                            <span>{statusCfg.label}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setViewingRecord(rec)}
                              className="p-1.5 text-slate-500 hover:text-[#2D4A49] hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              title="ดูรายละเอียดฉบับเต็ม"
                            >
                              <Eye size={14} />
                            </button>

                            {!isReadOnly && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditForm(rec)}
                                  className="p-1.5 text-[#5A8A88] hover:text-[#2D4A49] hover:bg-[#E8F3F2] rounded-md transition-colors cursor-pointer"
                                  title="แก้ไขข้อมูล"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRecordToDelete(rec)}
                                  className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                  title="ลบรายการ"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer info */}
          <div className="bg-[#F8FAF9] px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#6B8F8E] flex-wrap gap-2">
            <span>แสดง {filteredRecords.length} จากทั้งหมด {records.length} รายการ</span>
            <span>อัปเดตล่าสุด: {format(lastRefreshed, 'd MMM yyyy HH:mm น.', { locale: th })}</span>
          </div>

        </div>

      </div>

      {/* ── 6. FORM MODAL (ADD / EDIT) ── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D4E4E3] w-full max-w-2xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="bg-[#2D4A49] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench size={18} className="text-[#8FB3B1]" />
                <h3 className="font-bold text-sm sm:text-base">
                  {editingRecord ? 'แก้ไขบันทึกการบำรุงรักษา' : 'บันทึกการซ่อมบำรุงรักษาเครื่องมือ / อุปกรณ์'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-300 hover:text-white p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Quick Preset Selector for New Records */}
              {!editingRecord && (
                <div className="bg-[#F4F8F7] border border-[#D4E4E3] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-[#2D4A49] flex items-center gap-1">
                      <Sparkles size={12} className="text-amber-500" />
                      เลือกอุปกรณ์ด่วน (Quick Preset) หรือพิมพ์เองด้านล่าง:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {PRESET_EQUIPMENT.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`text-[10px] px-2 py-1 rounded-md border text-left transition-colors cursor-pointer ${
                          formData.equipmentName === preset.name
                            ? 'bg-[#2D4A49] text-white border-[#2D4A49] font-bold'
                            : 'bg-white hover:bg-[#E8F3F2] text-[#2D4A49] border-[#D4E4E3]'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 1: Date, Time, Branch, Dept */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">วันที่ทำรายการ *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full py-1.5 px-2 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">เวลา</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                    className="w-full py-1.5 px-2 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">สาขา *</label>
                  <select
                    value={formData.branch}
                    onChange={e => setFormData({ ...formData, branch: e.target.value as any })}
                    className="w-full py-1.5 px-2 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  >
                    <option value="Rayong">Rayong</option>
                    <option value="Bangkok">Bangkok</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">แผนก *</label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value as any })}
                    className="w-full py-1.5 px-2 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  >
                    <option value="Bar">☕ บาร์ (Bar)</option>
                    <option value="Bakery">🍳 ครัว / เบเกอรี่ (Bakery)</option>
                    <option value="General">🏢 ส่วนกลาง (Facility)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Equipment Name & Code & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">
                    ชื่อเครื่องมือ / อุปกรณ์ *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น เครื่องชงกาแฟ La Marzocco Linea PB"
                    value={formData.equipmentName}
                    onChange={e => setFormData({ ...formData, equipmentName: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">
                    รหัสเครื่อง / Serial
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น BAR-ESP-01"
                    value={formData.equipmentCode}
                    onChange={e => setFormData({ ...formData, equipmentCode: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">
                    หมวดหมู่
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น Espresso Machine"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  />
                </div>
              </div>

              {/* Row 3: Maintenance Type & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">
                    ประเภทการบำรุงรักษา *
                  </label>
                  <select
                    value={formData.maintenanceType}
                    onChange={e => setFormData({ ...formData, maintenanceType: e.target.value as any })}
                    className="w-full py-1.5 px-2.5 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  >
                    <option value="Preventive">PM บำรุงรักษาเชิงป้องกัน (Preventive)</option>
                    <option value="Repair">ซ่อมแซมแก้ไขเมื่อชำรุด (Corrective Repair)</option>
                    <option value="Inspection">ตรวจเช็คสภาพประจำรอบ (Routine Inspection)</option>
                    <option value="Calibration">ปรับเทียบมาตรฐาน / ตั้งค่า (Calibration)</option>
                    <option value="PartReplacement">เปลี่ยนอะไหล่ตามรอบ (Part Replacement)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">
                    สถานะการทำงาน *
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full py-1.5 px-2.5 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  >
                    <option value="Completed">เสร็จสิ้นเรียบร้อย (Completed)</option>
                    <option value="Pending">รอดำเนินการ / รออะไหล่ (Pending)</option>
                    <option value="Scheduled">มีนัดหมายล่วงหน้า (Scheduled)</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Work Details (Required) */}
              <div>
                <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">
                  รายละเอียดการบำรุงรักษา / อาการที่พบและวิธีแก้ไข *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="เช่น ทำการล้าง Descale หัวชงทั้ง 2 หัว, เปลี่ยนยางซีล Gasket, เช็คแรงดันบอยเลอร์ 9 bar, ล้างตะกรันถังน้ำ..."
                  value={formData.details}
                  onChange={e => setFormData({ ...formData, details: e.target.value })}
                  className="w-full py-2 px-2.5 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                />
              </div>

              {/* Row 5: Parts Replaced & Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-8">
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">
                    อะไหล่หรือชิ้นส่วนที่เปลี่ยน (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ยางซีลหัวชง 2 ชิ้น, Shower Screen 2 แผ่น"
                    value={formData.partsReplaced}
                    onChange={e => setFormData({ ...formData, partsReplaced: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">
                    ค่าใช้จ่าย (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    className="w-full py-1.5 px-2.5 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  />
                </div>
              </div>

              {/* Row 6: Performed By, Tech Name, Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">ผู้ดำเนินงาน</label>
                  <select
                    value={formData.performedBy}
                    onChange={e => setFormData({ ...formData, performedBy: e.target.value as any })}
                    className="w-full py-1.5 px-2 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  >
                    <option value="Internal">ทีมงานภายในร้าน (Internal)</option>
                    <option value="Vendor">ช่างผู้ให้บริการภายนอก (Vendor)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">ชื่อช่าง / บริษัทบริการ</label>
                  <input
                    type="text"
                    placeholder="เช่น ช่างเอก / บจก. พีเอส คอฟฟี่"
                    value={formData.technicianName}
                    onChange={e => setFormData({ ...formData, technicianName: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">เบอร์ติดต่อช่าง</label>
                  <input
                    type="text"
                    placeholder="เช่น 081-234-5678"
                    value={formData.contactNumber}
                    onChange={e => setFormData({ ...formData, contactNumber: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  />
                </div>
              </div>

              {/* Row 7: Next Due Date & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">
                    วันที่กำหนดบำรุงรักษาครั้งถัดไป
                  </label>
                  <input
                    type="date"
                    value={formData.nextServiceDate}
                    onChange={e => setFormData({ ...formData, nextServiceDate: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  />
                </div>
                <div className="sm:col-span-7">
                  <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">หมายเหตุเพิ่มเติม</label>
                  <input
                    type="text"
                    placeholder="เช่น นัดล้างแอร์รอบถัดไปอีก 3 เดือน"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full py-1.5 px-2.5 text-xs border border-[#D4E4E3] rounded-lg focus:outline-none focus:border-[#5A8A88]"
                  />
                </div>
              </div>

              {/* Row 8: Photos & Bill Attachment */}
              <div>
                <label className="block text-[11px] font-bold text-[#2D4A49] mb-1">
                  รูปถ่ายก่อน-หลังการซ่อม / ใบเสร็จรับเงิน (บีบอัดอัตโนมัติ)
                </label>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-[#2D4A49] bg-[#E8F3F2] hover:bg-[#D4E4E3] px-3 py-1.5 rounded-lg border border-[#D4E4E3] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera size={14} className="text-[#5A8A88]" />
                    <span>แนบรูปภาพ / ถ่ายภาพ</span>
                  </button>
                  <span className="text-[10px] text-slate-400">
                    แนบได้หลายภาพ (รูปจะถูกปรับขนาดให้ประหยัดเนื้อที่)
                  </span>
                </div>

                {/* Photo Previews */}
                {formData.imageUrls.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap p-2 bg-[#F4F8F7] rounded-xl border border-[#D4E4E3]">
                    {formData.imageUrls.map((url, idx) => (
                      <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shadow-2xs">
                        <img
                          src={url}
                          alt="preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#5A8A88] hover:bg-[#476E6C] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingRecord ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ── 7. VIEW DETAIL MODAL ── */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D4E4E3] w-full max-w-xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="bg-[#1E5A7A] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench size={17} className="text-[#8FB3B1]" />
                <h3 className="font-bold text-sm">รายละเอียดการบำรุงรักษา</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="text-slate-300 hover:text-white p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              
              {/* Header Box */}
              <div className="bg-[#F4F8F7] rounded-xl p-3.5 border border-[#D4E4E3]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-[#5A8A88] bg-[#E8F3F2] px-1.5 py-0.5 rounded border border-[#D4E4E3] mr-1.5">
                      สาขา {viewingRecord.branch}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      แผนก: {viewingRecord.department === 'Bar' ? 'บาร์' : viewingRecord.department === 'Bakery' ? 'เบเกอรี่' : 'ส่วนกลาง'}
                    </span>
                    <h2 className="text-base font-bold text-[#2D4A49] mt-1">
                      {viewingRecord.equipmentName}
                    </h2>
                    {viewingRecord.equipmentCode && (
                      <p className="text-[11px] text-slate-500 font-mono">
                        รหัสเครื่อง: {viewingRecord.equipmentCode}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CONFIG[viewingRecord.status]?.badgeClass}`}>
                    {STATUS_CONFIG[viewingRecord.status]?.label}
                  </span>
                </div>
              </div>

              {/* Grid detail */}
              <div className="grid grid-cols-2 gap-3 bg-white">
                <div>
                  <span className="text-[10px] text-[#6B8F8E] font-semibold block">วันที่ดำเนินการ:</span>
                  <p className="font-bold text-[#2D4A49]">{viewingRecord.date} {viewingRecord.time && `(${viewingRecord.time} น.)`}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B8F8E] font-semibold block">ประเภทงาน:</span>
                  <p className="font-bold text-[#2D4A49]">{MAINTENANCE_TYPE_CONFIG[viewingRecord.maintenanceType]?.label}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B8F8E] font-semibold block">ผู้ปฏิบัติงาน / ช่าง:</span>
                  <p className="font-bold text-[#2D4A49]">
                    {viewingRecord.technicianName || (viewingRecord.performedBy === 'Internal' ? 'ทีมงานภายใน' : 'ช่างภายนอก')}
                  </p>
                  {viewingRecord.contactNumber && (
                    <p className="text-[10px] text-[#5A8A88] font-medium">โทร: {viewingRecord.contactNumber}</p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-[#6B8F8E] font-semibold block">ค่าใช้จ่ายรวม:</span>
                  <p className="font-bold text-emerald-700 text-sm">
                    {viewingRecord.cost && viewingRecord.cost > 0 ? `฿${viewingRecord.cost.toLocaleString('th-TH')} บาท` : 'ไม่มีค่าใช้จ่าย'}
                  </p>
                </div>
              </div>

              {/* Details Content */}
              <div>
                <span className="text-[10px] text-[#6B8F8E] font-semibold block mb-1">รายละเอียดงานบำรุงรักษา:</span>
                <div className="bg-[#F8FAF9] p-3 rounded-lg border border-slate-100 text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {viewingRecord.details}
                </div>
              </div>

              {/* Parts Replaced */}
              {viewingRecord.partsReplaced && (
                <div>
                  <span className="text-[10px] text-[#6B8F8E] font-semibold block mb-1">อะไหล่ที่เปลี่ยน:</span>
                  <p className="text-amber-800 font-medium bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    {viewingRecord.partsReplaced}
                  </p>
                </div>
              )}

              {/* Next Due Date & Notes */}
              {(viewingRecord.nextServiceDate || viewingRecord.notes) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {viewingRecord.nextServiceDate && (
                    <div className="bg-[#E8F3F2] p-2.5 rounded-lg border border-[#D4E4E3]">
                      <span className="text-[10px] text-[#5A8A88] font-semibold block">กำหนดรอบถัดไป:</span>
                      <p className="font-bold text-[#2D4A49]">{viewingRecord.nextServiceDate}</p>
                    </div>
                  )}
                  {viewingRecord.notes && (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-semibold block">หมายเหตุ:</span>
                      <p className="text-slate-700">{viewingRecord.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Images */}
              {viewingRecord.imageUrls && viewingRecord.imageUrls.length > 0 && (
                <div>
                  <span className="text-[10px] text-[#6B8F8E] font-semibold block mb-1.5">รูปภาพประกอบ:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {viewingRecord.imageUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt="maintenance"
                        onClick={() => setLightboxImage(url)}
                        className="w-full h-24 object-cover rounded-lg border border-slate-200 shadow-2xs hover:opacity-90 cursor-pointer"
                      />
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-400 text-right pt-2 border-t border-slate-100">
                ผู้บันทึก: {viewingRecord.recorderName}
              </p>

              {/* Modal footer buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 text-xs font-semibold text-[#2D4A49] bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>พิมพ์ใบงานนี้</span>
                </button>

                <div className="flex items-center gap-2">
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        const rec = viewingRecord;
                        setViewingRecord(null);
                        openEditForm(rec);
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#5A8A88] hover:bg-[#476E6C] rounded-lg flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Edit3 size={13} />
                      <span>แก้ไข</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewingRecord(null)}
                    className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    ปิด
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ── 8. LIGHTBOX IMAGE MODAL ── */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={lightboxImage}
              alt="zoom"
              className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg font-bold"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── 9. DELETE CONFIRMATION MODAL ── */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3">
          <div className="bg-white rounded-2xl shadow-xl border border-rose-200 w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={20} />
            </div>
            <div className="text-center">
              <h4 className="font-bold text-slate-800 text-sm">ยืนยันการลบรายการซ่อมบำรุงนี้?</h4>
              <p className="text-xs text-slate-500 mt-1">
                {recordToDelete.equipmentName} ({recordToDelete.date})
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs cursor-pointer"
              >
                ลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 10. SUPABASE SQL SETUP HELPER MODAL ── */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D4E4E3] w-full max-w-xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="bg-[#2D4A49] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database size={17} className="text-[#8FB3B1]" />
                <h3 className="font-bold text-sm">การตั้งค่าฐานข้อมูล Supabase (Cloud Sync)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="text-slate-300 hover:text-white p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="bg-[#E8F3F2] p-3 rounded-xl border border-[#D4E4E3] text-[#2D4A49] leading-relaxed">
                <p className="font-bold mb-1">💡 ระบบทำงานได้ทันทีด้วย Dual-Storage:</p>
                <p className="text-[11px] text-[#6B8F8E]">
                  ปัจจุบันข้อมูลบันทึกได้อย่างสมบูรณ์แบบทั้งในเบราว์เซอร์ (LocalStorage) และเตรียมพร้อมสำหรับ Supabase หากต้องการให้ข้อมูลเชื่อมต่อ Cloud ทุกเครื่องพร้อมกัน เพียงนำคำสั่ง SQL ด้านล่างไปวางที่ <strong>Supabase Dashboard &gt; SQL Editor</strong> แล้วกด Run:
                </p>
              </div>

              <div className="relative">
                <pre className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-[10px] leading-relaxed overflow-x-auto max-h-56">
                  {sqlSchemaScript}
                </pre>
                <button
                  type="button"
                  onClick={copySqlToClipboard}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedSql ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{copiedSql ? 'คัดลอกแล้ว!' : 'คัดลอก SQL'}</span>
                </button>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowSqlModal(false)}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#5A8A88] hover:bg-[#476E6C] rounded-lg cursor-pointer"
                >
                  เข้าใจแล้ว
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
