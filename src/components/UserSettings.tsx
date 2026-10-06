import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Shield, 
  User, 
  Key, 
  Save, 
  X, 
  AlertCircle, 
  Bell, 
  Send, 
  Users, 
  Settings,
  Pencil,
  BookOpen,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole } from './LoginForm';
import { AppUser, AppPermissions } from '../types';

export type PagePermission = 'read' | 'edit' | 'hidden';

export interface UserPermissions {
  // General
  dashboard: PagePermission;
  dailySales: PagePermission;
  dailyBakery: PagePermission;

  // บาร์ (Bar)
  bar_stock: PagePermission;
  bar_receiving: PagePermission;
  bar_stockcount: PagePermission;
  bar_waste: PagePermission;
  bar_checkin: PagePermission;
  bar_coffeeWaste: PagePermission;

  // ครัว (Kitchen/Bakery)
  kitchen_stock: PagePermission;
  kitchen_receiving: PagePermission;
  kitchen_stockcount: PagePermission;
  kitchen_waste: PagePermission;
  kitchen_checkin: PagePermission;
  bakeryPlan: PagePermission;

  // รายงานรวม
  purchasing: PagePermission;
  rndReport: PagePermission;

  // ประวัติ
  history_edit: PagePermission;
  history_checkin: PagePermission;
  history_stock: PagePermission;
  history_receiving: PagePermission;
  history_bakery: PagePermission;

  // Admin
  userSettings: PagePermission;
  canEditDateRange: boolean;

  [key: string]: any;
}

export const applyRoleDefaults = (role: string): UserPermissions => {
  const r = (role || '').toUpperCase();
  if (r === 'CO-FOUNDER' || r === 'ADMIN' || r === 'OWNER') {
    return {
      dashboard: 'edit',
      dailySales: 'edit',
      dailyBakery: 'edit',
      bar_stock: 'edit',
      bar_receiving: 'edit',
      bar_stockcount: 'edit',
      bar_waste: 'edit',
      bar_checkin: 'edit',
      bar_coffeeWaste: 'edit',
      kitchen_stock: 'edit',
      kitchen_receiving: 'edit',
      kitchen_stockcount: 'edit',
      kitchen_waste: 'edit',
      kitchen_checkin: 'edit',
      bakeryPlan: 'edit',
      purchasing: 'edit',
      rndReport: 'edit',
      history_edit: 'edit',
      history_checkin: 'edit',
      history_stock: 'edit',
      history_receiving: 'edit',
      history_bakery: 'edit',
      userSettings: 'edit',
      canEditDateRange: true
    };
  }
  if (r === 'BRANCH MANAGER') {
    return {
      dashboard: 'edit',
      dailySales: 'edit',
      dailyBakery: 'edit',
      bar_stock: 'edit',
      bar_receiving: 'edit',
      bar_stockcount: 'edit',
      bar_waste: 'edit',
      bar_checkin: 'edit',
      bar_coffeeWaste: 'edit',
      kitchen_stock: 'edit',
      kitchen_receiving: 'edit',
      kitchen_stockcount: 'edit',
      kitchen_waste: 'edit',
      kitchen_checkin: 'edit',
      bakeryPlan: 'edit',
      purchasing: 'edit',
      rndReport: 'edit',
      history_edit: 'edit',
      history_checkin: 'edit',
      history_stock: 'edit',
      history_receiving: 'edit',
      history_bakery: 'edit',
      userSettings: 'hidden',
      canEditDateRange: false
    };
  }
  if (r === 'SENIOR BAKER' || r === 'HEAD BAKER') {
    return {
      dashboard: 'read',
      dailySales: 'hidden',
      dailyBakery: 'edit',
      bar_stock: 'hidden',
      bar_receiving: 'hidden',
      bar_stockcount: 'hidden',
      bar_waste: 'hidden',
      bar_checkin: 'hidden',
      bar_coffeeWaste: 'hidden',
      kitchen_stock: 'edit',
      kitchen_receiving: 'edit',
      kitchen_stockcount: 'edit',
      kitchen_waste: 'edit',
      kitchen_checkin: 'edit',
      bakeryPlan: 'edit',
      purchasing: 'read',
      rndReport: 'edit',
      history_edit: 'read',
      history_checkin: 'read',
      history_stock: 'read',
      history_receiving: 'read',
      history_bakery: 'read',
      userSettings: 'hidden',
      canEditDateRange: false
    };
  }
  if (r === 'BARISTA' || r === 'BARISTA ASSISTANCE') {
    return {
      dashboard: 'read',
      dailySales: 'hidden',
      dailyBakery: 'read',
      bar_stock: 'edit',
      bar_receiving: 'edit',
      bar_stockcount: 'edit',
      bar_waste: 'edit',
      bar_checkin: 'edit',
      bar_coffeeWaste: 'edit',
      kitchen_stock: 'hidden',
      kitchen_receiving: 'hidden',
      kitchen_stockcount: 'hidden',
      kitchen_waste: 'hidden',
      kitchen_checkin: 'hidden',
      bakeryPlan: 'hidden',
      purchasing: 'read',
      rndReport: 'read',
      history_edit: 'read',
      history_checkin: 'read',
      history_stock: 'read',
      history_receiving: 'read',
      history_bakery: 'hidden',
      userSettings: 'hidden',
      canEditDateRange: false
    };
  }
  // BAKER / JUNIOR BAKER / STAFF / CASHIER / SERVER / CLEANER:
  return {
    dashboard: 'read',
    dailySales: 'hidden',
    dailyBakery: 'read',
    bar_stock: 'hidden',
    bar_receiving: 'hidden',
    bar_stockcount: 'hidden',
    bar_waste: 'hidden',
    bar_checkin: 'hidden',
    bar_coffeeWaste: 'hidden',
    kitchen_stock: 'read',
    kitchen_receiving: 'read',
    kitchen_stockcount: 'read',
    kitchen_waste: 'read',
    kitchen_checkin: 'read',
    bakeryPlan: 'read',
    purchasing: 'hidden',
    rndReport: 'hidden',
    history_edit: 'read',
    history_checkin: 'read',
    history_stock: 'read',
    history_receiving: 'read',
    history_bakery: 'read',
    userSettings: 'hidden',
    canEditDateRange: false
  };
};

export const normalizePermissions = (raw: any, role: string): UserPermissions => {
  const defaults = applyRoleDefaults(role);
  if (!raw) return defaults;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return defaults;
    }
  }
  if (typeof parsed !== 'object' || parsed === null) return defaults;
  
  const toLevel = (val: any, fallback: PagePermission): PagePermission => {
    if (val === 'edit' || val === 'Edit') return 'edit';
    if (val === 'read' || val === 'Read' || val === 'Review') return 'read';
    if (val === 'hidden' || val === 'Hidden') return 'hidden';
    return fallback;
  };

  return {
    dashboard: toLevel(parsed.dashboard !== undefined ? parsed.dashboard : parsed.dashboardBar, defaults.dashboard),
    dailySales: toLevel(parsed.dailySales !== undefined ? parsed.dailySales : parsed.dailyRecord, defaults.dailySales),
    dailyBakery: toLevel(parsed.dailyBakery !== undefined ? parsed.dailyBakery : parsed.dailyRecord, defaults.dailyBakery),

    bar_stock: toLevel(parsed.bar_stock !== undefined ? parsed.bar_stock : parsed.stockTableBar, defaults.bar_stock),
    bar_receiving: toLevel(parsed.bar_receiving !== undefined ? parsed.bar_receiving : parsed.barReceiving, defaults.bar_receiving),
    bar_stockcount: toLevel(parsed.bar_stockcount !== undefined ? parsed.bar_stockcount : parsed.dailyStockCountBar, defaults.bar_stockcount),
    bar_waste: toLevel(parsed.bar_waste !== undefined ? parsed.bar_waste : (parsed.historyWaste || parsed.wasteReport), defaults.bar_waste),
    bar_checkin: toLevel(parsed.bar_checkin !== undefined ? parsed.bar_checkin : parsed.checklistsBar, defaults.bar_checkin),
    bar_coffeeWaste: toLevel(parsed.bar_coffeeWaste !== undefined ? parsed.bar_coffeeWaste : parsed.historyWaste, defaults.bar_coffeeWaste),

    kitchen_stock: toLevel(parsed.kitchen_stock !== undefined ? parsed.kitchen_stock : parsed.stockTableBakery, defaults.kitchen_stock),
    kitchen_receiving: toLevel(parsed.kitchen_receiving !== undefined ? parsed.kitchen_receiving : parsed.bakeryReceiving, defaults.kitchen_receiving),
    kitchen_stockcount: toLevel(parsed.kitchen_stockcount !== undefined ? parsed.kitchen_stockcount : parsed.dailyStockCountBakery, defaults.kitchen_stockcount),
    kitchen_waste: toLevel(parsed.kitchen_waste !== undefined ? parsed.kitchen_waste : parsed.wasteReport, defaults.kitchen_waste),
    kitchen_checkin: toLevel(parsed.kitchen_checkin !== undefined ? parsed.kitchen_checkin : parsed.checklistsBakery, defaults.kitchen_checkin),
    bakeryPlan: toLevel(parsed.bakeryPlan, defaults.bakeryPlan),

    purchasing: toLevel(parsed.purchasing !== undefined ? parsed.purchasing : parsed.purchasingReport, defaults.purchasing),
    rndReport: toLevel(parsed.rndReport, defaults.rndReport),

    history_edit: toLevel(parsed.history_edit !== undefined ? parsed.history_edit : parsed.historyLogs, defaults.history_edit),
    history_checkin: toLevel(parsed.history_checkin !== undefined ? parsed.history_checkin : parsed.historyChecklist, defaults.history_checkin),
    history_stock: toLevel(parsed.history_stock !== undefined ? parsed.history_stock : parsed.historyLogs, defaults.history_stock),
    history_receiving: toLevel(parsed.history_receiving !== undefined ? parsed.history_receiving : parsed.historyReceiving, defaults.history_receiving),
    history_bakery: toLevel(parsed.history_bakery !== undefined ? parsed.history_bakery : parsed.bakeryPlan, defaults.history_bakery),

    userSettings: toLevel(parsed.userSettings !== undefined ? parsed.userSettings : parsed.adminTools, defaults.userSettings),
    canEditDateRange: typeof parsed.canEditDateRange === 'boolean' ? parsed.canEditDateRange : defaults.canEditDateRange,

    ...parsed
  };
};

export const buildSavePermissions = (perms: UserPermissions) => {
  const toLegacy = (lvl: PagePermission) => lvl === 'edit' ? 'Edit' : lvl === 'read' ? 'Review' : 'Hidden';
  return {
    ...perms,
    dailySales: perms.dailySales,
    dailyBakery: perms.dailyBakery,
    dailyRecord: perms.dailySales,
    dashboardBar: toLegacy(perms.dashboard),
    dashboardBakery: toLegacy(perms.dashboard),
    stockTableBar: toLegacy(perms.bar_stock),
    stockTableBakery: toLegacy(perms.kitchen_stock),
    bakeryPlan: toLegacy(perms.bakeryPlan),
    barReceiving: toLegacy(perms.bar_receiving),
    bakeryReceiving: toLegacy(perms.kitchen_receiving),
    dailyStockCountBar: toLegacy(perms.bar_stockcount),
    dailyStockCountBakery: toLegacy(perms.kitchen_stockcount),
    checklistsBar: toLegacy(perms.bar_checkin),
    checklistsBakery: toLegacy(perms.kitchen_checkin),
    rndReport: toLegacy(perms.rndReport),
    purchasingReport: toLegacy(perms.purchasing),
    historyLogs: toLegacy(perms.history_edit),
    historyChecklist: toLegacy(perms.history_checkin),
    historyWaste: toLegacy(perms.bar_coffeeWaste || perms.bar_waste),
    historyReceiving: toLegacy(perms.history_receiving),
    manageIngredients: (perms.bar_stock === 'edit' || perms.kitchen_stock === 'edit') ? 'Edit' : 'Hidden',
    adminTools: toLegacy(perms.userSettings),
    canEditDateRange: !!perms.canEditDateRange
  };
};

interface PermissionGroup {
  id: string;
  name: string;
  items: {
    key: keyof UserPermissions;
    name: string;
    icon: string;
  }[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'general',
    name: 'GROUP 1: ทั่วไป (General)',
    items: [
      { key: 'dashboard', name: 'หน้าหลัก / Dashboard', icon: '🏠' },
      { key: 'dailySales', name: 'บันทึกยอดขายประจำวัน (Daily Sales)', icon: '📖' },
      { key: 'dailyBakery', name: 'บันทึกจำนวนขนมประจำวัน (Daily Bakery)', icon: '🧁' },
    ]
  },
  {
    id: 'bar',
    name: 'GROUP 2: 🍹 วัตถุดิบบาร์ (Bar)',
    items: [
      { key: 'bar_stock', name: 'Stock บาร์', icon: '📦' },
      { key: 'bar_receiving', name: 'รับวัตถุดิบ (บาร์)', icon: '📦' },
      { key: 'bar_stockcount', name: 'นับสต็อก (บาร์)', icon: '📋' },
      { key: 'bar_waste', name: 'Waste/ของเสีย (บาร์)', icon: '🗑️' },
      { key: 'bar_checkin', name: 'Check-in บาร์', icon: '✅' },
      { key: 'bar_coffeeWaste', name: 'Waste เมล็ดกาแฟ', icon: '☕' },
    ]
  },
  {
    id: 'kitchen',
    name: 'GROUP 3: 🍳 วัตถุดิบครัว (Kitchen)',
    items: [
      { key: 'kitchen_stock', name: 'Stock ครัว', icon: '📦' },
      { key: 'kitchen_receiving', name: 'รับวัตถุดิบ (ครัว)', icon: '📦' },
      { key: 'kitchen_stockcount', name: 'นับสต็อก (ครัว)', icon: '📋' },
      { key: 'kitchen_waste', name: 'Waste/ของเสีย (ครัว)', icon: '🗑️' },
      { key: 'kitchen_checkin', name: 'Check-in ครัว', icon: '✅' },
      { key: 'bakeryPlan', name: 'แผนงาน Bakery', icon: '🧁' },
    ]
  },
  {
    id: 'reports',
    name: 'GROUP 4: 📊 รายงานรวม',
    items: [
      { key: 'purchasing', name: 'Purchasing (สั่งซื้อ)', icon: '🛒' },
      { key: 'rndReport', name: 'R&D Report', icon: '🔬' },
    ]
  },
  {
    id: 'history',
    name: 'GROUP 5: 🕐 ประวัติย้อนหลัง',
    items: [
      { key: 'history_edit', name: 'ประวัติการแก้ไขข้อมูล', icon: '🕐' },
      { key: 'history_checkin', name: 'ประวัติ Check-in', icon: '🕐' },
      { key: 'history_stock', name: 'ประวัตินับสต็อก', icon: '🕐' },
      { key: 'history_receiving', name: 'ประวัติรับวัตถุดิบ', icon: '🕐' },
      { key: 'history_bakery', name: 'ประวัติ Bakery', icon: '🕐' },
    ]
  },
  {
    id: 'admin',
    name: 'GROUP 6: ⚙️ Admin',
    items: [
      { key: 'userSettings', name: 'User Settings', icon: '👤' },
    ]
  }
];

const APP_FUNCTIONS: { id: keyof AppPermissions; name: string }[] = [
  { id: 'dashboardBar', name: 'สรุปภาพรวมสต็อก บาร์ (Dashboard Bar)' },
  { id: 'dashboardBakery', name: 'สรุปภาพรวมสต็อก ครัว (Dashboard Bakery)' },
  { id: 'stockTableBar', name: 'บันทึกสต็อกบาร์ (Stock Table Bar)' },
  { id: 'stockTableBakery', name: 'บันทึกสต็อกครัว (Stock Table Bakery)' },
  { id: 'bakeryPlan', name: 'แผนงาน Bakery' },
  { id: 'barReceiving', name: 'รายงานตรวจรับวัตถุดิบ บาร์ (Receiving)' },
  { id: 'bakeryReceiving', name: 'รายงานตรวจรับวัตถุดิบ ครัว (Receiving)' },
  { id: 'dailyStockCountBar', name: 'รายงานนับสต็อกบาร์รายวัน' },
  { id: 'dailyStockCountBakery', name: 'รายงานนับสต็อกครัวรายวัน' },
  { id: 'checklistsBar', name: 'เช็คลิสต์เตรียมความพร้อม บาร์' },
  { id: 'checklistsBakery', name: 'เช็คลิสต์เตรียมความพร้อม ครัว' },
  { id: 'rndReport', name: 'R&D Report (เทสเมนูใหม่)' },
  { id: 'purchasingReport', name: 'สรุปยอดสั่งซื้อ (Purchasing)' },
  { id: 'historyLogs', name: 'ประวัติการแก้ไขข้อมูล (Audit Logs)' },
  { id: 'historyChecklist', name: 'ประวัติ Check-in & Check-out' },
  { id: 'historyWaste', name: 'รายงาน Waste เมล็ดกาแฟ' },
  { id: 'historyReceiving', name: 'ประวัติการรับวัตถุดิบ' },
  { id: 'manageIngredients', name: 'จัดการรายการวัตถุดิบ' },
  { id: 'adminTools', name: 'ตั้งค่าผู้ดูแลระบบ (Admin Only)' }
];

const DEFAULT_PERMISSIONS: AppPermissions = {
  dashboardBar: 'Edit',
  dashboardBakery: 'Edit',
  stockTableBar: 'Edit',
  stockTableBakery: 'Edit',
  bakeryPlan: 'Edit',
  barReceiving: 'Edit',
  bakeryReceiving: 'Edit',
  dailyStockCountBar: 'Edit',
  dailyStockCountBakery: 'Edit',
  checklistsBar: 'Edit',
  checklistsBakery: 'Edit',
  rndReport: 'Edit',
  purchasingReport: 'Edit',
  historyLogs: 'Edit',
  historyChecklist: 'Edit',
  historyWaste: 'Edit',
  historyReceiving: 'Edit',
  manageIngredients: 'Edit',
  adminTools: 'Hidden'
};

interface UserSettingsProps {
  branch?: string;
  currentUser?: { name: string; role: UserRole; permissions?: AppPermissions };
  onCurrentUserUpdated?: (user: { name: string; role: UserRole; permissions?: AppPermissions }) => void;
}

export function UserSettings({ currentUser, onCurrentUserUpdated, branch }: UserSettingsProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'general' | 'permissions'>('general');
  const [isChangingPassword, setIsChangingPassword] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<{id: string, name: string} | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // User save status & dirty tracking (matches DailyBakeryRecord)
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [justSavedUser, setJustSavedUser] = useState(false);
  const [isUserFormDirty, setIsUserFormDirty] = useState(false);
  const [userSaveStatus, setUserSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [formData, setFormData] = useState<{
    name: string;
    role: UserRole;
    password: string;
    permissions: UserPermissions;
  }>({
    name: '',
    role: 'Barista' as UserRole,
    password: '',
    permissions: applyRoleDefaults('Barista')
  });
  
  const [passwordForm, setPasswordForm] = useState({
    password: ''
  });

  const [roleTemplates, setRoleTemplates] = useState<Record<string, AppPermissions>>({});
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplateRole, setSelectedTemplateRole] = useState<UserRole>('Barista');
  const [templateForm, setTemplateForm] = useState<AppPermissions>(DEFAULT_PERMISSIONS);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // ━━━━ QUICK PRESET HANDLERS ━━━━
  const handlePresetAll = (level: PagePermission) => {
    setIsUserFormDirty(true);
    const allKeys: (keyof UserPermissions)[] = [
      'dashboard', 'dailySales', 'dailyBakery',
      'bar_stock', 'bar_receiving', 'bar_stockcount', 'bar_waste', 'bar_checkin', 'bar_coffeeWaste',
      'kitchen_stock', 'kitchen_receiving', 'kitchen_stockcount', 'kitchen_waste', 'kitchen_checkin', 'bakeryPlan',
      'purchasing', 'rndReport',
      'history_edit', 'history_checkin', 'history_stock', 'history_receiving', 'history_bakery',
      'userSettings'
    ];
    const updated: any = { ...formData.permissions };
    allKeys.forEach(k => {
      updated[k] = level;
    });
    setFormData(prev => ({ ...prev, permissions: updated }));
  };

  const handlePresetBarFull = () => {
    setIsUserFormDirty(true);
    const barKeys: (keyof UserPermissions)[] = ['bar_stock', 'bar_receiving', 'bar_stockcount', 'bar_waste', 'bar_checkin', 'bar_coffeeWaste'];
    const updated: any = { ...formData.permissions };
    barKeys.forEach(k => { updated[k] = 'edit'; });
    setFormData(prev => ({ ...prev, permissions: updated }));
  };

  const handlePresetKitchenFull = () => {
    setIsUserFormDirty(true);
    const kitchenKeys: (keyof UserPermissions)[] = ['kitchen_stock', 'kitchen_receiving', 'kitchen_stockcount', 'kitchen_waste', 'kitchen_checkin', 'bakeryPlan', 'dailyBakery'];
    const updated: any = { ...formData.permissions };
    kitchenKeys.forEach(k => { updated[k] = 'edit'; });
    setFormData(prev => ({ ...prev, permissions: updated }));
  };

  const handlePresetBarOnly = () => {
    setIsUserFormDirty(true);
    const barKeys: (keyof UserPermissions)[] = ['bar_stock', 'bar_receiving', 'bar_stockcount', 'bar_waste', 'bar_checkin', 'bar_coffeeWaste'];
    const kitchenKeys: (keyof UserPermissions)[] = ['kitchen_stock', 'kitchen_receiving', 'kitchen_stockcount', 'kitchen_waste', 'kitchen_checkin', 'bakeryPlan', 'dailyBakery'];
    const updated: any = { ...formData.permissions };
    barKeys.forEach(k => { updated[k] = 'edit'; });
    kitchenKeys.forEach(k => { updated[k] = 'hidden'; });
    setFormData(prev => ({ ...prev, permissions: updated }));
  };

  const handlePresetKitchenOnly = () => {
    setIsUserFormDirty(true);
    const barKeys: (keyof UserPermissions)[] = ['bar_stock', 'bar_receiving', 'bar_stockcount', 'bar_waste', 'bar_checkin', 'bar_coffeeWaste'];
    const kitchenKeys: (keyof UserPermissions)[] = ['kitchen_stock', 'kitchen_receiving', 'kitchen_stockcount', 'kitchen_waste', 'kitchen_checkin', 'bakeryPlan', 'dailyBakery'];
    const updated: any = { ...formData.permissions };
    kitchenKeys.forEach(k => { updated[k] = 'edit'; });
    barKeys.forEach(k => { updated[k] = 'hidden'; });
    setFormData(prev => ({ ...prev, permissions: updated }));
  };

  const handlePresetReset = () => {
    setIsUserFormDirty(true);
    const roleDefaults = applyRoleDefaults(formData.role);
    setFormData(prev => ({ ...prev, permissions: roleDefaults }));
  };

  const fetchRoleTemplates = async () => {
    if (supabase) {
      const { data, error } = await supabase.from('app_settings').select('setting_value').eq('setting_key', 'role_permissions_templates').eq('branch', branch).single();
      if (!error && data) {
        setRoleTemplates(data.setting_value);
      } else {
        const { data: fallbackData, error: fallbackError } = await supabase.from('app_settings').select('setting_value').eq('setting_key', 'role_permissions_templates').limit(1).single();
        if (!fallbackError && fallbackData) {
          setRoleTemplates(fallbackData.setting_value);
        } else {
          const saved = localStorage.getItem('role_permissions_templates');
          if (saved) setRoleTemplates(JSON.parse(saved));
        }
      }
    } else {
      const saved = localStorage.getItem('role_permissions_templates');
      if (saved) setRoleTemplates(JSON.parse(saved));
    }
  };

  const handleSaveRoleTemplate = async () => {
    setIsSavingTemplate(true);
    const updatedTemplates = { ...roleTemplates, [selectedTemplateRole]: templateForm };
    
    if (supabase) {
      const { error } = await supabase.from('app_settings').upsert({ branch,
        setting_key: 'role_permissions_templates',
        setting_value: updatedTemplates
      });
      if (error) {
        alert('Error saving role template: ' + error.message);
        setIsSavingTemplate(false);
        return;
      }
    }
    
    localStorage.setItem('role_permissions_templates', JSON.stringify(updatedTemplates));
    setRoleTemplates(updatedTemplates);
    setIsSavingTemplate(false);
    alert(`บันทึก Role Template สำหรับ ${selectedTemplateRole} เรียบร้อยแล้ว`);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    if (supabase) {
      try {
        let query = supabase.from('app_users').select('*');
        if (branch) {
          query = query.eq('branch', branch);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          setUsers(data as AppUser[]);
        } else {
          // Fallback check if users exist without branch filter
          const { data: allData, error: allError } = await supabase.from('app_users').select('*');
          if (!allError && allData && allData.length > 0) {
            setUsers(allData as AppUser[]);
          } else {
            const saved = localStorage.getItem('cafe-app-users');
            if (saved) setUsers(JSON.parse(saved));
          }
        }
      } catch (err) {
        console.warn('Error fetching users from Supabase:', err);
        const saved = localStorage.getItem('cafe-app-users');
        if (saved) setUsers(JSON.parse(saved));
      }
    } else {
      // Offline mock data
      const saved = localStorage.getItem('cafe-app-users');
      if (saved) {
        setUsers(JSON.parse(saved));
      } else {
        const defaultUsers: AppUser[] = [
          { id: '1', name: 'Admin', role: 'Admin' },
          { id: '2', name: 'Branch Manager', role: 'Branch Manager' },
          { id: '3', name: 'Barista', role: 'Barista' }
        ];
        setUsers(defaultUsers);
        localStorage.setItem('cafe-app-users', JSON.stringify(defaultUsers));
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    fetchRoleTemplates();
  }, []);

  // Discord Notify Integration States & Handlers
  const [discordSettings, setDiscordSettings] = useState<any>({
    webhookUrl: '',
    enabled: false,
    notifyOnWaste: true,
    notifyOnRnD: true,
    notifyOnStockSubmit: true,
    notifyOnChecklist: true,
    notifyOnReceiving: true,
    notifyOnBakeryPlan: true
  });
  const [isSavingDiscord, setIsSavingDiscord] = useState(false);
  const [isTestingDiscord, setIsTestingDiscord] = useState(false);
  const [discordTestResult, setDiscordTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('discordNotifySettings');
    if (saved) {
      try {
        setDiscordSettings(JSON.parse(saved));
      } catch (e) {
        console.warn(e);
      }
    }
  }, []);

  const handleSaveDiscordSettings = async () => {
    setIsSavingDiscord(true);
    setDiscordTestResult(null);
    try {
      localStorage.setItem('discordNotifySettings', JSON.stringify(discordSettings));
      
      // Save to Supabase if available
      if (supabase) {
        const { error } = await supabase.from('app_settings').upsert({ branch,
          setting_key: 'discord_notify_settings',
          setting_value: discordSettings
        });
        if (error) {
          throw new Error(error.message);
        }
      }
      alert('บันทึกการตั้งค่า Discord Notify เรียบร้อยแล้ว!');
    } catch (e: any) {
      alert('มีข้อผิดพลาดในการบันทึก: ' + e.message);
    } finally {
      setIsSavingDiscord(false);
    }
  };

  const handleTestDiscordNotify = async () => {
    setIsTestingDiscord(true);
    setDiscordTestResult(null);
    try {
      if (!discordSettings.webhookUrl.trim()) {
        setDiscordTestResult({ status: 'error', message: 'กรุณากรอก Discord Webhook URL ก่อนทดสอบ' });
        return;
      }

      const response = await fetch(discordSettings.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: '\n🔔 ทดสอบการเชื่อมต่อระบบ Discord จากแอปพลิเคชัน Cafe Stock Manager สำเร็จแล้ว!'
        })
      });

      if (response.ok) {
        setDiscordTestResult({ status: 'success', message: 'เชื่อมต่อและส่งข้อความทดสอบไปยัง Discord สำเร็จแล้ว!' });
      } else {
        setDiscordTestResult({ status: 'error', message: `ส่งข้อความไม่สำเร็จ Status: ${response.status}` });
      }
    } catch (e: any) {
      setDiscordTestResult({ status: 'error', message: e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' });
    } finally {
      setIsTestingDiscord(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || (!editingUser && !formData.password.trim())) {
      setUserSaveStatus({
        type: 'error',
        message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน'
      });
      return;
    }

    setIsSavingUser(true);
    setUserSaveStatus(null);

    const savePerms = buildSavePermissions(formData.permissions as UserPermissions);

    const payload: any = {
      name: formData.name.trim(),
      role: formData.role,
      permissions: savePerms
    };

    if (branch) {
      payload.branch = branch;
    }

    if (!editingUser) {
      payload.password = formData.password;
    }

    let isSuccess = false;
    let errorMessage = '';

    if (supabase) {
      try {
        if (editingUser) {
          const { error: updateError } = await supabase
            .from('app_users')
            .update(payload)
            .eq('id', editingUser.id);
          
          if (updateError) {
            console.warn('Supabase update user error:', updateError);
            errorMessage = updateError.message;
          } else {
            isSuccess = true;
          }
        } else {
          const { data: insertData, error: insertError } = await supabase
            .from('app_users')
            .insert(payload)
            .select();
          
          if (insertError) {
            console.warn('Supabase insert user error:', insertError);
            errorMessage = insertError.message;
          } else {
            isSuccess = true;
            if (insertData && insertData[0]) {
              payload.id = insertData[0].id;
            }
          }
        }

        // Record to Supabase audit_logs
        try {
          const logId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
          await supabase.from('audit_logs').insert({
            id: logId,
            branch: branch || 'Bangkok',
            timestamp: new Date().toISOString(),
            user_email: currentUser?.name || 'Admin',
            user_role: currentUser?.role || 'Admin',
            action: editingUser ? 'UPDATE_USER_PERMISSIONS' : 'CREATE_USER',
            details: `${editingUser ? 'แก้ไขผู้ใช้และสิทธิ์การเข้าถึง' : 'เพิ่มผู้ใช้งานใหม่'}: ${formData.name} (${formData.role})`
          });
        } catch (logErr) {
          console.warn('Audit log recording error:', logErr);
        }
      } catch (err: any) {
        console.error('Error saving user to Supabase:', err);
        errorMessage = err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Supabase';
      }
    }

    // Always update local state and localStorage to guarantee offline & instant persistence
    let updatedUsers = [...users];
    if (editingUser) {
      updatedUsers = updatedUsers.map(u => u.id === editingUser.id ? { ...u, ...payload } : u);
    } else {
      const id = payload.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));
      updatedUsers.push({ id, ...payload });
    }
    setUsers(updatedUsers);
    localStorage.setItem('cafe-app-users', JSON.stringify(updatedUsers));
    localStorage.setItem('app_users', JSON.stringify(updatedUsers));

    // Check if we just updated the currently logged in user
    if (editingUser && currentUser && (currentUser.name === editingUser.name || currentUser.name === payload.name) && onCurrentUserUpdated) {
      onCurrentUserUpdated({
        name: payload.name,
        role: payload.role,
        permissions: payload.permissions
      });
    }

    setIsSavingUser(false);
    setJustSavedUser(true);
    setIsUserFormDirty(false);

    if (errorMessage && !isSuccess && supabase) {
      setUserSaveStatus({
        type: 'error',
        message: `บันทึกลงในเครื่องเรียบร้อยแล้ว (เกิดปัญหาบนเซิร์ฟเวอร์: ${errorMessage})`
      });
    } else {
      setUserSaveStatus({
        type: 'success',
        message: `บันทึกข้อมูลและสิทธิ์การเข้าถึงของ "${formData.name}" สำเร็จเรียบร้อย`
      });
    }

    setTimeout(() => {
      setJustSavedUser(false);
    }, 2500);

    setTimeout(() => {
      setIsFormOpen(false);
      setEditingUser(null);
      setActiveModalTab('general');
      setUserSaveStatus(null);
      const defaultPerms = applyRoleDefaults('Barista');
      setFormData({ name: '', role: 'Barista', password: '', permissions: defaultPerms });
      fetchUsers();
    }, 1200);
  };

  const handleSavePassword = async (e: React.FormEvent, userId: string) => {
    e.preventDefault();
    if (!passwordForm.password.trim()) {
      alert('Password cannot be empty');
      return;
    }

    if (supabase) {
      await supabase.from('app_users').update({ password: passwordForm.password }).eq('id', userId);
    }
    const updatedUsers = users.map(u => u.id === userId ? { ...u, password: passwordForm.password } : u);
    setUsers(updatedUsers);
    localStorage.setItem('cafe-app-users', JSON.stringify(updatedUsers));
    localStorage.setItem('app_users', JSON.stringify(updatedUsers));

    setIsChangingPassword(null);
    setPasswordForm({ password: '' });
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (name === 'Admin') {
      return;
    }
    setUserToDelete({ id, name });
  };
  
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    const { id } = userToDelete;
    
    if (supabase) {
      const { error } = await supabase.from('app_users').delete().eq('id', id);
      if (error) {
        console.warn('Error deleting user:', error);
      } else {
        fetchUsers();
      }
    }
    const updatedUsers = users.filter(u => u.id !== id);
    setUsers(updatedUsers);
    localStorage.setItem('cafe-app-users', JSON.stringify(updatedUsers));
    localStorage.setItem('app_users', JSON.stringify(updatedUsers));
    setUserToDelete(null);
  };

  const openEditForm = (user: AppUser) => {
    setEditingUser(user);
    const existingPermissions = user.permissions || {};
    const normalized = normalizePermissions(existingPermissions, user.role);
    setFormData({
      name: user.name,
      role: user.role as UserRole,
      password: '',
      permissions: normalized
    });
    setIsUserFormDirty(false);
    setJustSavedUser(false);
    setUserSaveStatus(null);
    setActiveModalTab('general');
    setIsFormOpen(true);
  };

  // Helper for role badge styling
  const renderRoleBadge = (role: string) => {
    const r = role.toUpperCase();
    if (r === 'ADMIN' || r === 'OWNER' || r === 'CO-FOUNDER') {
      return (
        <span className="bg-[#2D4A49] text-white text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-[5px] shadow-2xs">
          {role}
        </span>
      );
    }
    if (r === 'BRANCH MANAGER') {
      return (
        <span className="bg-[#E8F3F2] text-[#5A8A88] border border-[#B8D4D2] text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-[5px]">
          {role}
        </span>
      );
    }
    return (
      <span className="bg-[#F0F5F4] text-[#6B8F8E] border border-[#D4E4E3] text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-[5px]">
        {role}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PAGE HEADER CARD
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #2D4A49 0%, #3D6B69 100%)'
        }}
        className="rounded-2xl p-6 text-white shadow-[0_4px_16px_rgba(45,74,73,0.15)] border border-[#2D4A49]"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            {/* Icon badge */}
            <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-[#E8F3F2] shrink-0">
              <Shield size={22} className="text-[#C5D5D3]" />
            </div>

            {/* Title & Subtitle */}
            <div>
              <h2 className="text-[20px] font-[800] text-white tracking-[0.01em] leading-tight">
                User Security Settings
              </h2>
              <p className="text-[11px] text-white/70 leading-relaxed mt-1.5 max-w-xl">
                จัดการบัญชีผู้ใช้งาน เพิ่ม แก้ไข หรือลบบัญชี รวมถึงกำหนดสิทธิ์การใช้งานแอปพลิเคชัน (Admin Only)
              </p>
            </div>
          </div>

          {!isFormOpen && (
            <button 
              onClick={() => {
                setEditingUser(null);
                const defaultPerms = applyRoleDefaults('Barista');
                setFormData({ name: '', role: 'Barista', password: '', permissions: defaultPerms });
                setIsUserFormDirty(false);
                setJustSavedUser(false);
                setUserSaveStatus(null);
                setActiveModalTab('general');
                setIsFormOpen(true);
              }}
              className="flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 border-[1.5px] border-white/40 text-white text-[13px] font-semibold px-4 py-2.5 rounded-[10px] transition-all cursor-pointer shadow-xs shrink-0 w-full sm:w-auto"
            >
              <Plus size={16} className="text-white" />
              <span>เพิ่มผู้ใช้งานใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* User Form Card (Add/Edit) */}
      {isFormOpen && (
        <form onSubmit={handleSaveUser} className="bg-white border border-[#D4E4E3] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(90,138,136,0.08)] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E2EAE9]">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[16px] text-[#2D4A49]">
                {editingUser ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}
              </h3>
              {editingUser && renderRoleBadge(editingUser.role)}
            </div>
            <button 
              type="button" 
              onClick={() => setIsFormOpen(false)} 
              className="w-7 h-7 rounded-lg text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab Navigation inside Edit/Add Modal */}
          <div className="flex items-center gap-2 mb-5 p-1 bg-[#F0F5F4] rounded-xl border border-[#D4E4E3] w-fit">
            <button
              type="button"
              onClick={() => setActiveModalTab('general')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeModalTab === 'general'
                  ? 'bg-[#5A8A88] text-white shadow-xs'
                  : 'text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#E8F3F2]'
              }`}
            >
              <User size={13} />
              <span>ข้อมูลทั่วไป</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('permissions')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeModalTab === 'permissions'
                  ? 'bg-[#5A8A88] text-white shadow-xs'
                  : 'text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#E8F3F2]'
              }`}
            >
              <Shield size={13} />
              <span>สิทธิ์การเข้าถึง</span>
            </button>
          </div>

          {/* TAB 1 — ข้อมูลทั่วไป */}
          {activeModalTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#2D4A49] mb-1">Username</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3.5 py-2 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] focus:border-[#5A8A88] outline-none text-xs text-[#2D4A49] bg-white transition-all"
                    value={formData.name}
                    onChange={(e) => {
                      setIsUserFormDirty(true);
                      setFormData(prev => ({ ...prev, name: e.target.value }));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2D4A49] mb-1">Role</label>
                  <select
                    className="w-full px-3.5 py-2 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] focus:border-[#5A8A88] outline-none bg-white text-xs text-[#2D4A49] transition-all cursor-pointer"
                    value={formData.role}
                    onChange={(e) => {
                      setIsUserFormDirty(true);
                      const newRole = e.target.value as UserRole;
                      const roleDefaults = applyRoleDefaults(newRole);
                      setFormData(prev => ({ 
                        ...prev, 
                        role: newRole,
                        permissions: roleDefaults
                      }));
                    }}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Owner">Owner</option>
                    <option value="Co-founder">Co-founder</option>
                    <option value="Branch Manager">Branch Manager</option>
                    <option value="Head Baker">Head Baker</option>
                    <option value="Senior Baker">Senior Baker</option>
                    <option value="Junior Baker">Junior Baker</option>
                    <option value="Barista">Barista</option>
                    <option value="Barista Assistance">Barista Assistance</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Server/Runner">Server/Runner</option>
                    <option value="Dishwasher/Cleaner">Dishwasher/Cleaner</option>
                  </select>
                </div>
                {!editingUser && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-[#2D4A49] mb-1">Password</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3.5 py-2 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] focus:border-[#5A8A88] outline-none text-xs text-[#2D4A49] bg-white transition-all font-mono"
                      value={formData.password}
                      onChange={(e) => {
                        setIsUserFormDirty(true);
                        setFormData(prev => ({ ...prev, password: e.target.value }));
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2 — สิทธิ์การเข้าถึง (Permissions) */}
          {activeModalTab === 'permissions' && (
            <div className="space-y-4">
              {/* Quick Preset Buttons */}
              <div className="p-3 bg-[#F0F5F4] rounded-xl border border-[#D4E4E3] space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-[#2D4A49]">เลือกทั้งหมด:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handlePresetAll('read')}
                      className="bg-white border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer"
                    >
                      Read ทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetAll('edit')}
                      className="bg-white border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer"
                    >
                      Edit ทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={handlePresetReset}
                      className="bg-white border border-[#D4E4E3] text-[#6B8F8E] hover:text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-[#D4E4E3]/60">
                  <button
                    type="button"
                    onClick={handlePresetBarFull}
                    className="bg-white border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer"
                  >
                    🍹 บาร์ Full
                  </button>
                  <button
                    type="button"
                    onClick={handlePresetKitchenFull}
                    className="bg-white border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer"
                  >
                    🍳 ครัว Full
                  </button>
                  <button
                    type="button"
                    onClick={handlePresetBarOnly}
                    className="bg-white border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer"
                  >
                    บาร์ Only
                  </button>
                  <button
                    type="button"
                    onClick={handlePresetKitchenOnly}
                    className="bg-white border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer"
                  >
                    ครัว Only
                  </button>
                </div>
              </div>

              {/* Permission List Container */}
              <div className="max-h-[70vh] overflow-y-auto p-1 space-y-4 rounded-xl custom-scrollbar">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.id} className="bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-2xs">
                    <div className="bg-[#F0F5F4] px-3.5 py-2 text-[11px] font-bold text-[#5A8A88] uppercase tracking-[0.08em] border-b border-[#D4E4E3]">
                      {group.name}
                    </div>
                    <div className="divide-y divide-[#F0F5F4]">
                      {group.items.map((item) => {
                        const currentVal = formData.permissions[item.key] || 'hidden';
                        return (
                          <div 
                            key={item.key} 
                            className="flex items-center justify-between px-3.5 py-2.5 min-h-[44px] hover:bg-[#FAFDFD] transition-colors gap-2"
                          >
                            <div className="flex items-center gap-2 text-[12px] font-medium text-[#2D4A49]">
                              <span className="text-[14px] shrink-0">{item.icon}</span>
                              <span>{item.name}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {/* READ button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsUserFormDirty(true);
                                  setFormData(prev => ({
                                    ...prev,
                                    permissions: { ...prev.permissions, [item.key]: 'read' }
                                  }));
                                }}
                                className={`text-[11px] rounded-[6px] px-3 py-1 transition-all cursor-pointer ${
                                  currentVal === 'read'
                                    ? 'bg-[#E8F3F2] border border-[#5A8A88] text-[#5A8A88] font-bold shadow-2xs'
                                    : 'bg-white border border-[#D4E4E3] text-[#6B8F8E] font-medium hover:bg-[#F0F5F4]'
                                }`}
                              >
                                Read
                              </button>
                              {/* EDIT button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsUserFormDirty(true);
                                  setFormData(prev => ({
                                    ...prev,
                                    permissions: { ...prev.permissions, [item.key]: 'edit' }
                                  }));
                                }}
                                className={`text-[11px] rounded-[6px] px-3 py-1 transition-all cursor-pointer ${
                                  currentVal === 'edit'
                                    ? 'bg-[#5A8A88] border border-[#5A8A88] text-white font-bold shadow-2xs'
                                    : 'bg-white border border-[#D4E4E3] text-[#6B8F8E] font-medium hover:bg-[#F0F5F4]'
                                }`}
                              >
                                Edit
                              </button>
                              {/* HIDDEN button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsUserFormDirty(true);
                                  setFormData(prev => ({
                                    ...prev,
                                    permissions: { ...prev.permissions, [item.key]: 'hidden' }
                                  }));
                                }}
                                className={`text-[11px] rounded-[6px] px-3 py-1 transition-all cursor-pointer ${
                                  currentVal === 'hidden'
                                    ? 'bg-[#2D4A49] border border-[#2D4A49] text-white font-bold shadow-2xs'
                                    : 'bg-white border border-[#D4E4E3] text-[#6B8F8E] font-medium hover:bg-[#F0F5F4]'
                                }`}
                              >
                                Hidden
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Extra item for Group 6 (Admin): กำหนดช่วงวันที่ยอดขายเอง */}
                      {group.id === 'admin' && (
                        <div className="flex items-center justify-between px-3.5 py-2.5 min-h-[44px] hover:bg-[#FAFDFD] transition-colors gap-2 bg-[#FBFDFD]">
                          <div className="flex items-center gap-2 text-[12px] font-medium text-[#2D4A49]">
                            <span className="text-[14px] shrink-0">📅</span>
                            <div>
                              <span>กำหนดช่วงวันที่ยอดขายเอง</span>
                              <p className="text-[10px] text-[#6B8F8E]">อนุญาตให้ผู้ใช้กำหนดวันเริ่ม-สิ้นสุด ในหน้าบันทึกยอดขายประจำวัน</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input 
                              type="checkbox" 
                              checked={!!formData.permissions.canEditDateRange}
                              onChange={(e) => {
                                setIsUserFormDirty(true);
                                setFormData(prev => ({ 
                                  ...prev, 
                                  permissions: { 
                                    ...prev.permissions, 
                                    canEditDateRange: e.target.checked 
                                  } 
                                }));
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5A8A88]"></div>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sticky Bottom Actions */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs pt-3 mt-5 border-t border-[#D4E4E3] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 z-10">
            <div className="flex-1 min-h-[20px]">
              {userSaveStatus && (
                <div className={`text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in duration-200 ${
                  userSaveStatus.type === 'success' ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {userSaveStatus.type === 'success' ? (
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle size={13} className="text-amber-600 shrink-0" />
                  )}
                  <span className="truncate">{userSaveStatus.message}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <button 
                type="button" 
                disabled={isSavingUser}
                onClick={() => {
                  setIsFormOpen(false);
                  setIsUserFormDirty(false);
                  setUserSaveStatus(null);
                }} 
                className="px-4 py-2 text-xs font-medium text-[#6B8F8E] bg-white border border-[#D4E4E3] rounded-lg hover:bg-[#F0F5F4] transition-colors cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                disabled={isSavingUser}
                className={`flex items-center justify-center gap-1.5 text-white text-[11px] font-medium rounded-[8px] px-4 py-2 min-h-[34px] min-w-[170px] transition-all shadow-2xs cursor-pointer ${
                  isSavingUser
                    ? 'bg-[#5A8A88] cursor-wait opacity-90'
                    : justSavedUser
                      ? 'bg-[#10B981] hover:bg-[#059669]'
                      : isUserFormDirty
                        ? 'bg-[#1E3A39] hover:bg-[#162D2C] ring-2 ring-amber-400/70'
                        : 'bg-[#2D4A49] hover:bg-[#203635]'
                }`}
              >
                {isSavingUser ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : justSavedUser ? (
                  <>
                    <CheckCircle2 size={13} className="text-white" />
                    <span>บันทึกสำเร็จ</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>บันทึกสิทธิ์การเข้าถึง</span>
                    {isUserFormDirty && (
                      <span 
                        className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" 
                        title="มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก" 
                      />
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          USER LIST SECTION
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div>
        {/* Section header row */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#5A8A88]" />
            <h3 className="text-[14px] font-bold text-[#2D4A49]">
              รายชื่อผู้ใช้งาน
            </h3>
          </div>
          <span className="bg-[#E8F3F2] text-[#5A8A88] text-[11px] font-semibold px-2.5 py-0.5 rounded-md border border-[#D4E4E3]">
            {users.length} ผู้ใช้งาน
          </span>
        </div>

        {/* User cards list */}
        <div className="space-y-2.5">
          {isLoading ? (
            <div className="text-center py-10 text-xs text-[#6B8F8E] bg-white rounded-2xl border border-[#D4E4E3] animate-pulse">
              กำลังโหลดข้อมูล...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-10 text-xs text-[#6B8F8E] bg-white rounded-2xl border border-[#D4E4E3] border-dashed">
              ยังไม่มีข้อมูลผู้ใช้งาน
            </div>
          ) : users.map((user) => (
            <div 
              key={user.id} 
              className="bg-white rounded-xl border border-[#D4E4E3] p-3.5 sm:px-4 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_1px_4px_rgba(90,138,136,0.06)] hover:shadow-[0_4px_12px_rgba(90,138,136,0.12)] hover:border-[#B8D4D2] hover:bg-[#FAFCFC] transition-all duration-150 group"
            >
              {/* User Info Left */}
              <div className="flex items-center gap-3.5">
                {/* Avatar circle */}
                <div className="w-10 h-10 rounded-full bg-[#E8F3F2] border-[1.5px] border-[#D4E4E3] flex items-center justify-center shrink-0">
                  {user.name ? (
                    <span className="text-[16px] font-bold text-[#5A8A88] uppercase">
                      {user.name.charAt(0)}
                    </span>
                  ) : (
                    <User size={18} className="text-[#5A8A88]" />
                  )}
                </div>

                {/* Name and Role */}
                <div>
                  <h4 className="font-bold text-[14px] text-[#2D4A49] leading-tight">
                    {user.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    {renderRoleBadge(user.role)}
                  </div>
                </div>
              </div>
              
              {/* Action Buttons Right */}
              {isChangingPassword === user.id ? (
                <form onSubmit={(e) => handleSavePassword(e, user.id)} className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center px-2.5 py-1.5 bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg text-xs text-[#6B8F8E] line-through shrink-0" title="รหัสผ่านเดิม">
                    {user.password || 'ไม่มีรหัส'}
                  </div>
                  <input
                    type="text"
                    placeholder="รหัสผ่านใหม่"
                    required
                    className="flex-1 sm:w-36 px-2.5 py-1.5 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] outline-none text-xs text-[#2D4A49] bg-white font-mono"
                    value={passwordForm.password}
                    onChange={(e) => setPasswordForm({ password: e.target.value })}
                  />
                  <button 
                    type="submit" 
                    className="p-2 bg-[#5A8A88] hover:bg-[#4d7775] text-white rounded-lg transition-colors cursor-pointer shadow-xs" 
                    title="บันทึก"
                  >
                    <Save size={14} />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsChangingPassword(null)} 
                    className="p-2 text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#E8F3F2] rounded-lg transition-colors cursor-pointer" 
                    title="ยกเลิก"
                  >
                    <X size={14} />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  {/* Key button */}
                  <button 
                    onClick={() => setIsChangingPassword(user.id)}
                    className="p-2 text-[#5A8A88] hover:bg-[#E8F3F2] rounded-[7px] transition-all cursor-pointer" 
                    title="แก้ไขรหัสผ่าน"
                  >
                    <Key size={15} />
                  </button>

                  {/* Edit button */}
                  <button 
                    onClick={() => openEditForm(user)}
                    className="p-2 text-[#5A8A88] hover:bg-[#E8F3F2] rounded-[7px] transition-all cursor-pointer" 
                    title="แก้ไขข้อมูล"
                  >
                    <Pencil size={15} />
                  </button>

                  {/* Delete button */}
                  <button 
                    onClick={() => handleDeleteUser(user.id, user.name)}
                    className="p-2 text-[#EF4444] hover:bg-[#FEE2E2] rounded-[7px] transition-all disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed" 
                    title="ลบผู้ใช้งาน"
                    disabled={user.name === 'Admin'}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          DISCORD INTEGRATION CARD
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,138,136,0.08)] border border-[#D4E4E3] overflow-hidden mt-6">
        <div 
          style={{
            background: 'linear-gradient(135deg, #2D4A49 0%, #3D6B69 100%)'
          }}
          className="p-5 sm:p-6 text-white"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 border border-white/20 rounded-xl flex items-center justify-center text-[#E8F3F2]">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-white">Discord Webhook Integration Settings</h3>
              <p className="text-white/70 text-xs max-w-xl mt-0.5">
                ตั้งค่าระบบการแจ้งเตือนยอดการทำงาน สต็อกบาร์ ครัวเบเกอรี่ รายงานของเสีย และเมนู R&D ไปยังเซิร์ฟเวอร์ Discord
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2D4A49] mb-1.5 flex items-center justify-between">
                  <span>Discord Webhook URL</span>
                  <a 
                    href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#5A8A88] hover:text-[#2D4A49] font-medium text-xs underline"
                  >
                    วิธีการสร้าง Webhook ↗
                  </a>
                </label>
                <input
                  type="password"
                  placeholder="กรอก Discord Webhook URL (https://discord.com/api/webhooks/...)"
                  className="w-full px-3.5 py-2 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] focus:border-[#5A8A88] outline-none font-mono text-xs text-[#2D4A49] bg-white"
                  value={discordSettings.webhookUrl}
                  onChange={(e) => setDiscordSettings({ ...discordSettings, webhookUrl: e.target.value })}
                />
              </div>

              {/* Toggle Enable Notification Systems */}
              <div className="flex items-center justify-between p-3.5 bg-[#F0F5F4] rounded-xl border border-[#D4E4E3]">
                <div>
                  <h4 className="font-bold text-xs text-[#2D4A49]">เปิดใช้งาน Discord Notify</h4>
                  <p className="text-[#6B8F8E] text-[11px] mt-0.5">เปิดหรือปิดการแจ้งเตือนทั้งหมดของแอปพลิเคชัน</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={discordSettings.enabled}
                    onChange={(e) => setDiscordSettings({ ...discordSettings, enabled: e.target.checked })}
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5A8A88]"></div>
                </label>
              </div>
            </div>

            {/* Guide Info */}
            <div className="bg-[#E8F3F2] text-[#2D4A49] p-4 rounded-xl border border-[#D4E4E3] text-xs space-y-2 self-start">
              <h5 className="font-bold flex items-center gap-1.5 text-[#2D4A49]">
                <AlertCircle size={14} className="text-[#5A8A88]" /> วิธีการเชื่อมต่อ Discord Webhook
              </h5>
              <ol className="list-decimal list-inside space-y-1 text-[#476E6C] leading-relaxed text-[11px]">
                <li>ไปที่เซิร์ฟเวอร์ Discord ของคุณ (ต้องมีสิทธิ์จัดการเซิร์ฟเวอร์)</li>
                <li>คลิกขวาที่ช่องแชต เลือก <b>แก้ไขช่อง (Edit Channel)</b></li>
                <li>ไปที่ <b>Integrations</b> แล้วคลิกที่ <b>Webhooks</b></li>
                <li>คลิก <b>สร้างเว็บฮุค (New Webhook)</b></li>
                <li>คัดลอก Webhook URL มาวางและกดบันทึก</li>
              </ol>
            </div>
          </div>

          <div className="border-t border-[#E2EAE9] pt-5">
            <h4 className="font-semibold text-xs text-[#2D4A49] mb-3 flex items-center gap-2">
              <Bell size={15} className="text-[#5A8A88]" />
              หัวข้อรายงานที่ต้องการส่งไป Discord (Notification Subscriptions)
            </h4>

            {/* Subscriptions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {[
                { id: 'notifyOnStockSubmit', title: 'รายงานนับและส่งยอดคงเหลือสต็อก (Stock Submission)', desc: 'ส่งสรุปสต็อกเมื่อพนักงานบันทึกยอดนับสต็อกบาร์และครัวประจำวัน' },
                { id: 'notifyOnReceiving', title: 'การตรวจรับวัตถุดิบ (Raw Material Receiving)', desc: 'ส่งความเคลื่อนไหวเมื่อมีการตรวจรับรับวัตถุดิบนำเข้า บาร์ หรือ ครัว' },
                { id: 'notifyOnChecklist', title: 'เช็คลิสต์เตรียมความพร้อมเปิด-ปิดร้าน (Checklists)', desc: 'ส่งรายงานผลการทำ Check-in / Check-out หรืองานเตรียมร้าน' },
                { id: 'notifyOnWaste', title: 'ของเสีย รายงานขยะ เมล็ดกาแฟสูญเสีย (Waste Logs)', desc: 'ส่งรายงานขยะเมล็ดกาแฟและวัตถุดิบเสียจากฝ่ายบาร์และครัว' },
                { id: 'notifyOnRnD', title: 'การเทสสูตรและรายงานเมนูใหม่ (R&D Reports)', desc: 'แชร์สูตรพัฒนา รสชาติ การประเมิน และแผนจำหน่ายเมนู R&D' },
                { id: 'notifyOnBakeryPlan', title: 'แผนการผลิตและยอดจัดจำหน่ายเบเกอรี่ (Bakery Plan)', desc: 'ส่งสรุปการวางแผนเป้าหมายสัปดาห์ใหม่และยอดขายจริงท้ายสัปดาห์' },
              ].map(sub => (
                <label key={sub.id} className="flex items-start gap-2.5 p-3 bg-white hover:bg-[#F0F5F4] border border-[#D4E4E3] rounded-xl cursor-pointer transition-colors shadow-2xs">
                  <input 
                    type="checkbox" 
                    className="mt-0.5 rounded text-[#5A8A88] focus:ring-[#5A8A88] w-4 h-4 cursor-pointer accent-[#5A8A88]"
                    checked={(discordSettings as any)[sub.id]}
                    onChange={(e) => setDiscordSettings({ ...discordSettings, [sub.id]: e.target.checked })}
                  />
                  <div>
                    <h5 className="font-bold text-[#2D4A49] text-xs">{sub.title}</h5>
                    <p className="text-[#6B8F8E] text-[11px] mt-0.5">{sub.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E2EAE9] pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestDiscordNotify}
                disabled={isTestingDiscord || !discordSettings.webhookUrl}
                className="flex items-center gap-1.5 border border-[#D4E4E3] hover:bg-[#F0F5F4] bg-white text-[#2D4A49] px-3.5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Send size={13} className="text-[#5A8A88]" />
                <span>{isTestingDiscord ? 'กำลังส่งทดสอบ...' : 'ส่งข้อความทดสอบ'}</span>
              </button>
              
              {discordTestResult && (
                <span className={`text-xs font-semibold ${discordTestResult.status === 'success' ? 'text-emerald-600' : 'text-[#EF4444]'}`}>
                  {discordTestResult.message}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveDiscordSettings}
              disabled={isSavingDiscord}
              className="flex items-center justify-center gap-1.5 bg-[#5A8A88] hover:bg-[#4d7775] text-white px-5 py-2 rounded-lg text-xs font-semibold transition-all shadow-xs disabled:opacity-70 cursor-pointer"
            >
              <Save size={14} />
              <span>{isSavingDiscord ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า Discord Notify'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-[#D4E4E3]">
            <h3 className="text-base font-bold text-[#2D4A49] mb-1.5">ยืนยันการลบผู้ใช้งาน</h3>
            <p className="text-xs text-[#6B8F8E] mb-5 leading-relaxed">
              คุณแน่ใจหรือไม่ที่จะลบผู้ใช้งาน <span className="font-bold text-[#2D4A49]">"{userToDelete.name}"</span> ออกจากระบบ?
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-[#6B8F8E] hover:bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-4 py-2 bg-[#EF4444] hover:bg-red-600 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer shadow-xs"
              >
                ลบผู้ใช้งาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-[#D4E4E3] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#E2EAE9]">
              <h3 className="text-[16px] font-bold text-[#2D4A49] flex items-center gap-2">
                <Settings className="text-[#5A8A88]" size={18} />
                ตั้งค่า Role Permissions Template
              </h3>
              <button 
                onClick={() => setIsTemplateModalOpen(false)}
                className="w-7 h-7 rounded-lg text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 border-b border-[#E2EAE9] bg-[#F0F5F4]">
              <label className="block text-xs font-semibold text-[#2D4A49] mb-1.5">เลือก Role ที่ต้องการบันทึกเทมเพลต</label>
              <select
                className="w-full sm:w-1/2 px-3 py-2 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] outline-none bg-white text-xs font-medium text-[#2D4A49] shadow-2xs"
                value={selectedTemplateRole}
                onChange={(e) => {
                  const role = e.target.value as UserRole;
                  setSelectedTemplateRole(role);
                  setTemplateForm(roleTemplates[role] || DEFAULT_PERMISSIONS);
                }}
              >
                <option value="Admin">Admin</option>
                <option value="Owner">Owner</option>
                <option value="Co-founder">Co-founder</option>
                <option value="Branch Manager">Branch Manager</option>
                <option value="Head Baker">Head Baker</option>
                <option value="Senior Baker">Senior Baker</option>
                <option value="Junior Baker">Junior Baker</option>
                <option value="Barista">Barista</option>
                <option value="Barista Assistance">Barista Assistance</option>
                <option value="Cashier">Cashier</option>
                <option value="Server/Runner">Server/Runner</option>
                <option value="Dishwasher/Cleaner">Dishwasher/Cleaner</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-xs">
                <table className="w-full text-left bg-white text-xs">
                  <thead>
                    <tr className="bg-[#E8F3F2] border-b border-[#D4E4E3] text-[#2D4A49]">
                      <th className="p-2.5 font-bold w-full">ฟังก์ชัน</th>
                      <th className="p-2.5 font-bold text-center w-20 cursor-pointer hover:text-[#5A8A88]" onClick={() => {
                        const newPerms = { ...templateForm };
                        APP_FUNCTIONS.forEach(f => newPerms[f.id] = 'Hidden');
                        setTemplateForm(newPerms);
                      }}>Hidden (All)</th>
                      <th className="p-2.5 font-bold text-center w-20 cursor-pointer hover:text-[#5A8A88]" onClick={() => {
                        const newPerms = { ...templateForm };
                        APP_FUNCTIONS.forEach(f => newPerms[f.id] = 'Review');
                        setTemplateForm(newPerms);
                      }}>Review (All)</th>
                      <th className="p-2.5 font-bold text-center w-20 cursor-pointer hover:text-[#5A8A88]" onClick={() => {
                        const newPerms = { ...templateForm };
                        APP_FUNCTIONS.forEach(f => newPerms[f.id] = 'Edit');
                        setTemplateForm(newPerms);
                      }}>Edit (All)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F5F4]">
                    {APP_FUNCTIONS.map(func => (
                      <tr key={func.id} className="hover:bg-[#F8FAFA] transition-colors">
                        <td className="p-2.5 font-medium text-[#2D4A49]">{func.name}</td>
                        <td className="p-2.5 text-center">
                          <input 
                            type="radio" 
                            name={`tpl_perm_${func.id}`} 
                            checked={templateForm[func.id] === 'Hidden'}
                            onChange={() => setTemplateForm({ ...templateForm, [func.id]: 'Hidden' })}
                            className="w-4 h-4 accent-[#5A8A88] cursor-pointer"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input 
                            type="radio" 
                            name={`tpl_perm_${func.id}`} 
                            checked={templateForm[func.id] === 'Review'}
                            onChange={() => setTemplateForm({ ...templateForm, [func.id]: 'Review' })}
                            className="w-4 h-4 accent-[#10B981] cursor-pointer"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input 
                            type="radio" 
                            name={`tpl_perm_${func.id}`} 
                            checked={templateForm[func.id] === 'Edit'}
                            onChange={() => setTemplateForm({ ...templateForm, [func.id]: 'Edit' })}
                            className="w-4 h-4 accent-[#5A8A88] cursor-pointer"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-[#E2EAE9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
              <span className="text-[11px] text-[#6B8F8E]">
                เมื่อผู้ใช้เลือก Role นี้ในอนาคต สิทธิ์จะถูกปรับตามเทมเพลตนี้อัตโนมัติ
              </span>
              <div className="flex gap-2 self-end sm:self-auto">
                <button 
                  type="button" 
                  onClick={() => setIsTemplateModalOpen(false)} 
                  className="px-4 py-2 text-xs font-medium text-[#6B8F8E] bg-white border border-[#D4E4E3] rounded-lg hover:bg-[#F0F5F4] transition-colors cursor-pointer"
                >
                  ปิด
                </button>
                <button 
                  type="button" 
                  onClick={handleSaveRoleTemplate}
                  disabled={isSavingTemplate}
                  className="px-4 py-2 bg-[#5A8A88] hover:bg-[#4d7775] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-70 cursor-pointer"
                >
                  <Save size={14} /> {isSavingTemplate ? 'กำลังบันทึก...' : `บันทึกเทมเพลต ${selectedTemplateRole}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserSettings;
