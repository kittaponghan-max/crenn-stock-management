import React, { useState, useEffect, useCallback } from 'react';
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
  CheckCircle2,
  RotateCcw,
  Globe
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
  maintenanceReport: PagePermission;

  // ประวัติ
  history_edit: PagePermission;
  history_checkin: PagePermission;
  history_stock: PagePermission;
  history_receiving: PagePermission;
  history_bakery: PagePermission;

  // Admin
  userSettings: PagePermission;
  canEditDateRange: boolean;

  // Add-ons / Applications
  prodcalc: PagePermission;

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
      maintenanceReport: 'edit',
      history_edit: 'edit',
      history_checkin: 'edit',
      history_stock: 'edit',
      history_receiving: 'edit',
      history_bakery: 'edit',
      userSettings: 'edit',
      canEditDateRange: true,
      prodcalc: 'edit'
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
      maintenanceReport: 'edit',
      history_edit: 'edit',
      history_checkin: 'edit',
      history_stock: 'edit',
      history_receiving: 'edit',
      history_bakery: 'edit',
      userSettings: 'hidden',
      canEditDateRange: false,
      prodcalc: 'hidden'
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
      maintenanceReport: 'read',
      history_edit: 'read',
      history_checkin: 'read',
      history_stock: 'read',
      history_receiving: 'read',
      history_bakery: 'read',
      userSettings: 'hidden',
      canEditDateRange: false,
      prodcalc: 'hidden'
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
      maintenanceReport: 'read',
      history_edit: 'read',
      history_checkin: 'read',
      history_stock: 'read',
      history_receiving: 'read',
      history_bakery: 'hidden',
      userSettings: 'hidden',
      canEditDateRange: false,
      prodcalc: 'hidden'
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
    maintenanceReport: 'read',
    history_edit: 'read',
    history_checkin: 'read',
    history_stock: 'read',
    history_receiving: 'read',
    history_bakery: 'read',
    userSettings: 'hidden',
    canEditDateRange: false,
    prodcalc: 'hidden'
  };
};

export const normalizePermissions = (raw: any, role: string, customDefaults?: UserPermissions): UserPermissions => {
  const defaults = customDefaults || applyRoleDefaults(role);
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
    dashboard: toLevel(parsed.dashboard !== undefined ? parsed.dashboard : (parsed.dashboardBar || parsed.dashboardBakery), defaults.dashboard),
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
    maintenanceReport: toLevel(parsed.maintenanceReport, defaults.maintenanceReport),

    history_edit: toLevel(parsed.history_edit !== undefined ? parsed.history_edit : parsed.historyLogs, defaults.history_edit),
    history_checkin: toLevel(parsed.history_checkin !== undefined ? parsed.history_checkin : parsed.historyChecklist, defaults.history_checkin),
    history_stock: toLevel(parsed.history_stock !== undefined ? parsed.history_stock : parsed.historyLogs, defaults.history_stock),
    history_receiving: toLevel(parsed.history_receiving !== undefined ? parsed.history_receiving : parsed.historyReceiving, defaults.history_receiving),
    history_bakery: toLevel(parsed.history_bakery !== undefined ? parsed.history_bakery : parsed.historyBakery, defaults.history_bakery),

    userSettings: toLevel(parsed.userSettings !== undefined ? parsed.userSettings : parsed.adminTools, defaults.userSettings),
    canEditDateRange: typeof parsed.canEditDateRange === 'boolean' ? parsed.canEditDateRange : defaults.canEditDateRange,
    prodcalc: toLevel(parsed.prodcalc !== undefined ? parsed.prodcalc : (parsed.ProdCalc || parsed.prodCalc), defaults.prodcalc || 'hidden')
  };
};

export const buildSavePermissions = (perms: UserPermissions) => {
  const toLegacy = (lvl: PagePermission) => lvl === 'edit' ? 'Edit' : lvl === 'read' ? 'Review' : 'Hidden';
  return {
    ...perms,
    // Modern standard lowercase permissions
    dashboard: perms.dashboard,
    dailySales: perms.dailySales,
    dailyBakery: perms.dailyBakery,
    bar_stock: perms.bar_stock,
    bar_receiving: perms.bar_receiving,
    bar_stockcount: perms.bar_stockcount,
    bar_waste: perms.bar_waste,
    bar_checkin: perms.bar_checkin,
    bar_coffeeWaste: perms.bar_coffeeWaste,
    kitchen_stock: perms.kitchen_stock,
    kitchen_receiving: perms.kitchen_receiving,
    kitchen_stockcount: perms.kitchen_stockcount,
    kitchen_waste: perms.kitchen_waste,
    kitchen_checkin: perms.kitchen_checkin,
    bakeryPlan: perms.bakeryPlan,
    purchasing: perms.purchasing,
    rndReport: perms.rndReport,
    maintenanceReport: perms.maintenanceReport,
    history_edit: perms.history_edit,
    history_checkin: perms.history_checkin,
    history_stock: perms.history_stock,
    history_receiving: perms.history_receiving,
    history_bakery: perms.history_bakery,
    userSettings: perms.userSettings,
    canEditDateRange: !!perms.canEditDateRange,
    prodcalc: perms.prodcalc || 'hidden',

    // Legacy fields for backward compatibility
    dailyRecord: perms.dailySales,
    dashboardBar: toLegacy(perms.dashboard),
    dashboardBakery: toLegacy(perms.dashboard),
    stockTableBar: toLegacy(perms.bar_stock),
    stockTableBakery: toLegacy(perms.kitchen_stock),
    barReceiving: toLegacy(perms.bar_receiving),
    bakeryReceiving: toLegacy(perms.kitchen_receiving),
    dailyStockCountBar: toLegacy(perms.bar_stockcount),
    dailyStockCountBakery: toLegacy(perms.kitchen_stockcount),
    checklistsBar: toLegacy(perms.bar_checkin),
    checklistsBakery: toLegacy(perms.kitchen_checkin),
    purchasingReport: toLegacy(perms.purchasing),
    historyLogs: toLegacy(perms.history_edit),
    historyChecklist: toLegacy(perms.history_checkin),
    historyWaste: toLegacy(perms.bar_coffeeWaste || perms.bar_waste),
    historyReceiving: toLegacy(perms.history_receiving),
    historyBakery: toLegacy(perms.history_bakery),
    manageIngredients: (perms.bar_stock === 'edit' || perms.kitchen_stock === 'edit') ? 'Edit' : 'Hidden',
    adminTools: toLegacy(perms.userSettings),
    ProdCalc: toLegacy(perms.prodcalc || 'hidden')
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
      { key: 'bar_stock', name: 'สรุป Stock บาร์', icon: '📦' },
      { key: 'bar_receiving', name: 'รายงานตรวจรับวัตถุดิบ บาร์', icon: '📦' },
      { key: 'bar_stockcount', name: 'รายงานตรวจนับสต็อก บาร์', icon: '📋' },
      { key: 'bar_waste', name: 'รายงาน Waste/ของเสีย บาร์', icon: '🗑️' },
      { key: 'bar_checkin', name: 'Check-in & Check-out บาร์', icon: '✅' },
      { key: 'bar_coffeeWaste', name: 'รายงาน Waste เมล็ดกาแฟ', icon: '☕' },
    ]
  },
  {
    id: 'kitchen',
    name: 'GROUP 3: 🍳 วัตถุดิบครัว (Kitchen / Bakery)',
    items: [
      { key: 'kitchen_stock', name: 'สรุป Stock ครัว', icon: '📦' },
      { key: 'kitchen_receiving', name: 'รายงานตรวจรับวัตถุดิบ ครัว', icon: '📦' },
      { key: 'kitchen_stockcount', name: 'รายงานตรวจนับสต็อก ครัว', icon: '📋' },
      { key: 'kitchen_waste', name: 'รายงาน Waste/ของเสีย ครัว', icon: '🗑️' },
      { key: 'kitchen_checkin', name: 'Check-in & Check-out ครัว', icon: '✅' },
      { key: 'bakeryPlan', name: 'แผนงาน Bakery', icon: '🧁' },
    ]
  },
  {
    id: 'reports',
    name: 'GROUP 4: 📊 รายงานรวม (Reports)',
    items: [
      { key: 'purchasing', name: 'Purchasing (สั่งซื้อวัตถุดิบ)', icon: '🛒' },
      { key: 'rndReport', name: 'R&D Report (เทสเมนูใหม่)', icon: '🔬' },
      { key: 'maintenanceReport', name: 'รายงานบำรุงรักษาเครื่องมือ (Maintenance)', icon: '🔧' },
    ]
  },
  {
    id: 'history',
    name: 'GROUP 5: 🕐 ประวัติย้อนหลัง (History)',
    items: [
      { key: 'history_edit', name: 'ประวัติการแก้ไขข้อมูล (Audit Logs)', icon: '🕐' },
      { key: 'history_checkin', name: 'ประวัติ Check-in & Check-out', icon: '🕐' },
      { key: 'history_stock', name: 'ประวัตินับสต็อก', icon: '🕐' },
      { key: 'history_receiving', name: 'ประวัติการรับวัตถุดิบ', icon: '🕐' },
      { key: 'history_bakery', name: 'ประวัติแผนงาน Bakery', icon: '🕐' },
    ]
  },
  {
    id: 'admin',
    name: 'GROUP 6: ⚙️ Admin & Add-on Apps',
    items: [
      { key: 'userSettings', name: 'User Security Settings (ตั้งค่าสิทธิ์และบัญชีผู้ใช้)', icon: '👤' },
      { key: 'prodcalc', name: 'คำนวณต้นทุนการผลิต (ProdCalc)', icon: '🧮' },
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
  { id: 'adminTools', name: 'ตั้งค่าผู้ดูแลระบบ (Admin Only)' },
  { id: 'prodcalc' as any, name: 'คำนวณต้นทุนการผลิต (ProdCalc)' }
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
  adminTools: 'Hidden',
  prodcalc: 'Hidden'
};

interface UserSettingsProps {
  branch?: string;
  currentUser?: { name: string; role: UserRole | string; permissions?: AppPermissions | any; branch?: string };
  user?: { name: string; role: UserRole | string; permissions?: AppPermissions | any; branch?: string };
  onCurrentUserUpdated?: (user: { name: string; role: UserRole; permissions?: AppPermissions }) => void;
  onNavigate?: (tab: any) => void;
}

export function UserSettings(props: UserSettingsProps) {
  const isAuthorized = (): boolean => {
    if (!props.user && !props.currentUser) return false;
    const u = props.currentUser || props.user;
    if (!u) return false;

    // Roles that can always access
    const adminRoles = [
      'ADMIN',
      'CO-FOUNDER',
      'OWNER',
    ];
    const userRole = (u.role || '').toUpperCase();
    if (adminRoles.includes(userRole)) {
      return true;
    }

    // Explicit permission granted
    if (
      (u.permissions as any)?.userSettings === 'edit' ||
      (u.permissions as any)?.adminTools === 'Edit'
    ) {
      return true;
    }

    return false;
  };

  if (!isAuthorized()) {
    return (
      <div style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: '#FAF8F5',
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#FEE2E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          fontSize: 24,
        }}>
          🔒
        </div>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#2D4A49',
          marginBottom: 8,
        }}>
          ไม่มีสิทธิ์เข้าถึงหน้านี้
        </div>
        <div style={{
          fontSize: 13,
          color: '#6B8F8E',
          maxWidth: 360,
          lineHeight: 1.6,
          marginBottom: 24,
        }}>
          หน้านี้สำหรับผู้ดูแลระบบเท่านั้น
          กรุณาติดต่อ Admin หรือ Co-founder
          หากต้องการเข้าถึง
        </div>
        <button
          onClick={() => props.onNavigate?.('home')}
          style={{
            background: '#5A8A88',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  return <UserSettingsContent {...props} />;
}

function UserSettingsContent({ currentUser, onCurrentUserUpdated, branch, onNavigate, user }: UserSettingsProps) {
  const initialBranch = branch || user?.branch || currentUser?.branch || 'Rayong';
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(initialBranch);

  useEffect(() => {
    const active = branch || user?.branch || currentUser?.branch;
    if (active) {
      setSelectedBranchFilter(active);
    }
  }, [branch, user?.branch, currentUser?.branch]);

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
    avatar: string;
    permissions: UserPermissions;
  }>({
    name: '',
    role: 'Barista' as UserRole,
    password: '',
    avatar: '',
    permissions: applyRoleDefaults('Barista')
  });
  
  const [passwordForm, setPasswordForm] = useState({
    password: ''
  });

  const [roleTemplates, setRoleTemplates] = useState<Record<string, UserPermissions>>({});
  const [availableBranchTemplates, setAvailableBranchTemplates] = useState<{ branch: string; data: Record<string, UserPermissions> }[]>([]);
  const [syncAcrossAllBranches, setSyncAcrossAllBranches] = useState(true);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplateRole, setSelectedTemplateRole] = useState<UserRole>('Barista');
  const [templateForm, setTemplateForm] = useState<UserPermissions>(() => applyRoleDefaults('Barista'));
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const getRoleDefaults = useCallback((role: string): UserPermissions => {
    if (roleTemplates[role]) {
      return roleTemplates[role];
    }
    const foundKey = Object.keys(roleTemplates).find(k => k.toLowerCase() === (role || '').toLowerCase());
    if (foundKey && roleTemplates[foundKey]) {
      return roleTemplates[foundKey];
    }
    return applyRoleDefaults(role);
  }, [roleTemplates]);

  // ━━━━ QUICK PRESET HANDLERS ━━━━
  const handlePresetAll = (level: PagePermission) => {
    setIsUserFormDirty(true);
    const allKeys: (keyof UserPermissions)[] = [
      'dashboard', 'dailySales', 'dailyBakery',
      'bar_stock', 'bar_receiving', 'bar_stockcount', 'bar_waste', 'bar_checkin', 'bar_coffeeWaste',
      'kitchen_stock', 'kitchen_receiving', 'kitchen_stockcount', 'kitchen_waste', 'kitchen_checkin', 'bakeryPlan',
      'purchasing', 'rndReport', 'maintenanceReport',
      'history_edit', 'history_checkin', 'history_stock', 'history_receiving', 'history_bakery',
      'userSettings', 'prodcalc'
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
    const roleDefaults = getRoleDefaults(formData.role);
    setFormData(prev => ({ ...prev, permissions: roleDefaults }));
  };

  // ━━━━ QUICK PRESET HANDLERS FOR ROLE TEMPLATE MODAL ━━━━
  const handleTemplatePresetAll = (level: PagePermission) => {
    const allKeys: (keyof UserPermissions)[] = [
      'dashboard', 'dailySales', 'dailyBakery',
      'bar_stock', 'bar_receiving', 'bar_stockcount', 'bar_waste', 'bar_checkin', 'bar_coffeeWaste',
      'kitchen_stock', 'kitchen_receiving', 'kitchen_stockcount', 'kitchen_waste', 'kitchen_checkin', 'bakeryPlan',
      'purchasing', 'rndReport', 'maintenanceReport',
      'history_edit', 'history_checkin', 'history_stock', 'history_receiving', 'history_bakery',
      'userSettings', 'prodcalc'
    ];
    const updated: any = { ...templateForm };
    allKeys.forEach(k => { updated[k] = level; });
    setTemplateForm(updated);
  };

  const handleTemplatePresetBarFull = () => {
    const barKeys: (keyof UserPermissions)[] = ['bar_stock', 'bar_receiving', 'bar_stockcount', 'bar_waste', 'bar_checkin', 'bar_coffeeWaste'];
    const updated: any = { ...templateForm };
    barKeys.forEach(k => { updated[k] = 'edit'; });
    setTemplateForm(updated);
  };

  const handleTemplatePresetKitchenFull = () => {
    const kitchenKeys: (keyof UserPermissions)[] = ['kitchen_stock', 'kitchen_receiving', 'kitchen_stockcount', 'kitchen_waste', 'kitchen_checkin', 'bakeryPlan', 'dailyBakery'];
    const updated: any = { ...templateForm };
    kitchenKeys.forEach(k => { updated[k] = 'edit'; });
    setTemplateForm(updated);
  };

  const handleTemplatePresetBarOnly = () => {
    const barKeys: (keyof UserPermissions)[] = ['bar_stock', 'bar_receiving', 'bar_stockcount', 'bar_waste', 'bar_checkin', 'bar_coffeeWaste'];
    const kitchenKeys: (keyof UserPermissions)[] = ['kitchen_stock', 'kitchen_receiving', 'kitchen_stockcount', 'kitchen_waste', 'kitchen_checkin', 'bakeryPlan', 'dailyBakery'];
    const updated: any = { ...templateForm };
    barKeys.forEach(k => { updated[k] = 'edit'; });
    kitchenKeys.forEach(k => { updated[k] = 'hidden'; });
    setTemplateForm(updated);
  };

  const handleTemplatePresetKitchenOnly = () => {
    const barKeys: (keyof UserPermissions)[] = ['bar_stock', 'bar_receiving', 'bar_stockcount', 'bar_waste', 'bar_checkin', 'bar_coffeeWaste'];
    const kitchenKeys: (keyof UserPermissions)[] = ['kitchen_stock', 'kitchen_receiving', 'kitchen_stockcount', 'kitchen_waste', 'kitchen_checkin', 'bakeryPlan', 'dailyBakery'];
    const updated: any = { ...templateForm };
    kitchenKeys.forEach(k => { updated[k] = 'edit'; });
    barKeys.forEach(k => { updated[k] = 'hidden'; });
    setTemplateForm(updated);
  };

  // Fetch role templates with comprehensive cross-branch support
  const fetchRoleTemplates = async () => {
    let resolvedTemplates: Record<string, UserPermissions> | null = null;
    const branchesFound: { branch: string; data: Record<string, UserPermissions> }[] = [];

    if (supabase) {
      try {
        // Fetch all role_permissions_templates rows across all branches
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('setting_key', 'role_permissions_templates');

        if (!error && data && data.length > 0) {
          data.forEach((row: any) => {
            if (row.setting_value && typeof row.setting_value === 'object') {
              branchesFound.push({
                branch: row.branch || 'Rayong',
                data: row.setting_value
              });
            }
          });

          // Priority 1: Current selected branch filter
          const targetBranch = selectedBranchFilter !== 'ALL' ? selectedBranchFilter : (branch || 'Rayong');
          if (targetBranch) {
            const currentMatch = data.find((r: any) => r.branch === targetBranch && r.setting_value);
            if (currentMatch && typeof currentMatch.setting_value === 'object') {
              resolvedTemplates = currentMatch.setting_value;
            }
          }

          // Priority 2: GLOBAL branch
          if (!resolvedTemplates) {
            const globalMatch = data.find((r: any) => (r.branch === 'GLOBAL' || r.branch === 'Global') && r.setting_value);
            if (globalMatch && typeof globalMatch.setting_value === 'object') {
              resolvedTemplates = globalMatch.setting_value;
            }
          }

          // Priority 3: Any branch with valid template data
          if (!resolvedTemplates) {
            const anyMatch = data.find((r: any) => r.setting_value && Object.keys(r.setting_value).length > 0);
            if (anyMatch && typeof anyMatch.setting_value === 'object') {
              resolvedTemplates = anyMatch.setting_value;
            }
          }
        }
      } catch (e) {
        console.warn('fetchRoleTemplates error:', e);
      }
    }

    setAvailableBranchTemplates(branchesFound);

    // Fallback to local storage
    if (!resolvedTemplates) {
      const activeBr = selectedBranchFilter !== 'ALL' ? selectedBranchFilter : (branch || 'Rayong');
      const saved = (activeBr ? localStorage.getItem(`role_permissions_templates_${activeBr}`) : null) ||
                    localStorage.getItem('role_permissions_templates') || 
                    localStorage.getItem('role_permissions_templates_global');
      if (saved) {
        try {
          resolvedTemplates = JSON.parse(saved);
        } catch (e) {
          console.warn('LocalStorage read role_permissions_templates error:', e);
        }
      }
    }

    if (resolvedTemplates) {
      setRoleTemplates(resolvedTemplates);
    }
  };

  // Save role template with cross-branch synchronization and deployment to all matching accounts
  const handleSaveRoleTemplate = async () => {
    setIsSavingTemplate(true);
    const newSavePerms = buildSavePermissions(templateForm);
    const updatedTemplates = { ...roleTemplates, [selectedTemplateRole]: templateForm };
    
    const normalizedSelectedRole = (selectedTemplateRole || '').toLowerCase().trim();
    
    // Update local users state for all accounts with matching role
    const updatedUsersList = users.map(u => {
      const uRole = (u.role || '').toLowerCase().trim();
      if (uRole === normalizedSelectedRole) {
        return {
          ...u,
          permissions: newSavePerms
        };
      }
      return u;
    });

    if (supabase) {
      try {
        const branchesToUpdate = new Set<string>(['GLOBAL', 'Rayong', selectedBranchFilter !== 'ALL' ? selectedBranchFilter : 'Rayong']);

        // If sync across all branches is enabled, query all active branches
        if (syncAcrossAllBranches) {
          try {
            const { data: userBranches } = await supabase.from('app_users').select('branch');
            if (userBranches) {
              userBranches.forEach(u => { if (u.branch) branchesToUpdate.add(u.branch); });
            }
            const { data: settingsBranches } = await supabase.from('app_settings').select('branch');
            if (settingsBranches) {
              settingsBranches.forEach(s => { if (s.branch) branchesToUpdate.add(s.branch); });
            }
          } catch (be) {
            console.warn('Could not query all branches list:', be);
          }
        }

        const upsertPayload = Array.from(branchesToUpdate).map(b => ({ 
          branch: b,
          setting_key: 'role_permissions_templates',
          setting_value: updatedTemplates
        }));

        const { error } = await supabase.from('app_settings').upsert(upsertPayload);
        if (error) {
          console.warn('Error saving role template to supabase:', error.message);
        }

        // Deploy template permissions directly to all matching user accounts in Supabase app_users table
        try {
          const { data: dbUsers } = await supabase.from('app_users').select('id, role');
          if (dbUsers) {
            const matchingDbUsers = dbUsers.filter(u => (u.role || '').toLowerCase().trim() === normalizedSelectedRole);
            for (const tu of matchingDbUsers) {
              await supabase
                .from('app_users')
                .update({ permissions: newSavePerms })
                .eq('id', tu.id);
            }
          }
        } catch (dbErr) {
          console.warn('Error deploying role template to app_users table:', dbErr);
        }

        // Update cloud permissions map backup in app_settings
        try {
          const { data: existingSettings } = await supabase
            .from('app_settings')
            .select('setting_value')
            .eq('setting_key', 'user_permissions_map')
            .single();
          
          const currentMap = (existingSettings && existingSettings.setting_value) || {};
          updatedUsersList.forEach(u => {
            if ((u.role || '').toLowerCase().trim() === normalizedSelectedRole) {
              currentMap[u.id] = newSavePerms;
              currentMap[u.name] = newSavePerms;
            }
          });

          const activeBr = selectedBranchFilter !== 'ALL' ? selectedBranchFilter : 'Rayong';
          await supabase
            .from('app_settings')
            .upsert({
              branch: activeBr,
              setting_key: 'user_permissions_map',
              setting_value: currentMap
            });
        } catch (mapErr) {
          console.warn('Cloud user_permissions_map update error:', mapErr);
        }
      } catch (err: any) {
        console.warn('Supabase role template error:', err);
      }
    }
    
    // Save to local storage backups for all matching users
    updatedUsersList.forEach(u => {
      if ((u.role || '').toLowerCase().trim() === normalizedSelectedRole) {
        try {
          localStorage.setItem(`cafe_user_permissions_${u.id}`, JSON.stringify(newSavePerms));
          localStorage.setItem(`cafe_user_permissions_${u.name}`, JSON.stringify(newSavePerms));
        } catch (e) {
          console.warn(e);
        }
      }
    });

    localStorage.setItem('role_permissions_templates', JSON.stringify(updatedTemplates));
    localStorage.setItem('role_permissions_templates_global', JSON.stringify(updatedTemplates));
    if (selectedBranchFilter !== 'ALL') {
      localStorage.setItem(`role_permissions_templates_${selectedBranchFilter}`, JSON.stringify(updatedTemplates));
    }

    setUsers(updatedUsersList);
    const activeBr = selectedBranchFilter !== 'ALL' ? selectedBranchFilter : 'Rayong';
    localStorage.setItem(`cafe-app-users-${activeBr}`, JSON.stringify(updatedUsersList));
    localStorage.setItem('cafe-app-users', JSON.stringify(updatedUsersList));
    localStorage.setItem('app_users', JSON.stringify(updatedUsersList));

    // Update current active user if role matches
    if (currentUser && (currentUser.role || '').toLowerCase().trim() === normalizedSelectedRole && onCurrentUserUpdated) {
      onCurrentUserUpdated({
        name: currentUser.name,
        role: currentUser.role as UserRole,
        permissions: newSavePerms as any
      });
    }

    setRoleTemplates(updatedTemplates);
    setIsSavingTemplate(false);

    const affectedCount = updatedUsersList.filter(u => (u.role || '').toLowerCase().trim() === normalizedSelectedRole).length;
    setUserSaveStatus({
      type: 'success',
      message: `บันทึก Default Authority สำหรับตำแหน่ง "${selectedTemplateRole}" และอัปเดตสิทธิ์ไปยังบัญชีผู้ใช้อย่างถูกต้องครบถ้วนแล้ว (${affectedCount} บัญชี)`
    });
    setIsTemplateModalOpen(false);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    const activeBranch = selectedBranchFilter;

    // Get locally saved backup for active branch
    let localSavedUsers: AppUser[] = [];
    try {
      const savedBranch = activeBranch !== 'ALL' ? localStorage.getItem(`cafe-app-users-${activeBranch}`) : null;
      const savedGlobal = localStorage.getItem('cafe-app-users');
      if (savedBranch) {
        localSavedUsers = JSON.parse(savedBranch);
      } else if (savedGlobal) {
        const parsed = JSON.parse(savedGlobal);
        if (Array.isArray(parsed)) {
          localSavedUsers = activeBranch === 'ALL' 
            ? parsed 
            : parsed.filter((u: any) => u.branch === activeBranch);
        }
      }
    } catch (e) {
      console.warn(e);
    }

    if (supabase) {
      try {
        let query = supabase.from('app_users').select('*');
        if (activeBranch && activeBranch !== 'ALL') {
          query = query.eq('branch', activeBranch);
        }
        const { data, error } = await query;

        // Fetch cloud backup from app_settings if available
        let cloudPermissionsMap: Record<string, any> = {};
        try {
          const { data: settingsData } = await supabase
            .from('app_settings')
            .select('setting_value')
            .eq('setting_key', 'user_permissions_map')
            .single();
          if (settingsData && settingsData.setting_value) {
            cloudPermissionsMap = settingsData.setting_value;
          }
        } catch (settingsErr) {
          console.warn('Could not fetch cloud user_permissions_map:', settingsErr);
        }

        if (!error && data) {
          const merged = (data as AppUser[]).map(dbUser => {
            const localUser = localSavedUsers.find(u => u.id === dbUser.id || u.name === dbUser.name);
            let userSpecificSaved: any = null;
            try {
              const uSaved = localStorage.getItem(`cafe_user_permissions_${dbUser.id}`) || localStorage.getItem(`cafe_user_permissions_${dbUser.name}`);
              if (uSaved) userSpecificSaved = JSON.parse(uSaved);
            } catch (e) {
              console.warn(e);
            }

            const perms = dbUser.permissions || cloudPermissionsMap[dbUser.id] || cloudPermissionsMap[dbUser.name] || userSpecificSaved || localUser?.permissions;
            const normalizedPerms = normalizePermissions(perms, dbUser.role, getRoleDefaults(dbUser.role));
            return {
              ...dbUser,
              permissions: normalizedPerms
            };
          });
          setUsers(merged);
          if (activeBranch && activeBranch !== 'ALL') {
            localStorage.setItem(`cafe-app-users-${activeBranch}`, JSON.stringify(merged));
          }
          localStorage.setItem('cafe-app-users', JSON.stringify(merged));
          localStorage.setItem('app_users', JSON.stringify(merged));
        } else {
          setUsers(localSavedUsers);
        }
      } catch (err) {
        console.warn('Error fetching users from Supabase:', err);
        setUsers(localSavedUsers);
      }
    } else {
      // Offline mock data
      if (localSavedUsers.length > 0) {
        setUsers(localSavedUsers);
      } else {
        const defaultUsers: AppUser[] = [
          { id: '1', name: 'Admin', role: 'Admin', branch: activeBranch },
          { id: '2', name: 'Branch Manager', role: 'Branch Manager', branch: activeBranch },
          { id: '3', name: 'Barista', role: 'Barista', branch: activeBranch }
        ];
        setUsers(defaultUsers);
        if (activeBranch && activeBranch !== 'ALL') {
          localStorage.setItem(`cafe-app-users-${activeBranch}`, JSON.stringify(defaultUsers));
        }
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    fetchRoleTemplates();
  }, [selectedBranchFilter]);

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

    const targetUserId = editingUser ? editingUser.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));

    const targetBranch = selectedBranchFilter !== 'ALL'
      ? selectedBranchFilter
      : (branch || user?.branch || currentUser?.branch || 'Rayong');

    const payload: any = {
      id: targetUserId,
      name: formData.name.trim(),
      role: formData.role,
      avatar: formData.avatar ? formData.avatar.trim() : undefined,
      image: formData.avatar ? formData.avatar.trim() : undefined,
      permissions: savePerms,
      branch: targetBranch
    };

    if (!editingUser) {
      payload.password = formData.password;
    }

    let isSuccess = false;
    let errorMessage = '';

    // 1. Save to Supabase
    if (supabase) {
      try {
        if (editingUser) {
          const { error: updateError } = await supabase
            .from('app_users')
            .update({
              name: payload.name,
              role: payload.role,
              avatar: payload.avatar,
              image: payload.image,
              permissions: payload.permissions,
              ...(payload.branch ? { branch: payload.branch } : {})
            })
            .eq('id', editingUser.id);
          
          if (updateError) {
            console.warn('Supabase update app_users error:', updateError);
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

        // 2. Cloud Backup of permissions in app_settings (ensures permissions persist even if app_users column missing)
        try {
          const { data: existingSettings } = await supabase
            .from('app_settings')
            .select('setting_value')
            .eq('setting_key', 'user_permissions_map')
            .single();
          
          const currentMap = (existingSettings && existingSettings.setting_value) || {};
          currentMap[payload.id] = savePerms;
          currentMap[payload.name] = savePerms;

          await supabase
            .from('app_settings')
            .upsert({
              branch: targetBranch,
              setting_key: 'user_permissions_map',
              setting_value: currentMap
            });
        } catch (cloudBackupErr) {
          console.warn('Cloud permissions map backup notice:', cloudBackupErr);
        }

        // 3. Record to Supabase audit_logs
        try {
          const logId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
          await supabase.from('audit_logs').insert({
            id: logId,
            branch: targetBranch,
            timestamp: new Date().toISOString(),
            user_email: currentUser?.name || 'Admin',
            user_role: currentUser?.role || 'Admin',
            action: editingUser ? 'UPDATE_USER_PERMISSIONS' : 'CREATE_USER',
            details: `${editingUser ? 'แก้ไขผู้ใช้และสิทธิ์การเข้าถึง' : 'เพิ่มผู้ใช้งานใหม่'}: ${formData.name} (${formData.role}) [สาขา: ${targetBranch}]`
          });
        } catch (logErr) {
          console.warn('Audit log recording error:', logErr);
        }
      } catch (err: any) {
        console.error('Error saving user to Supabase:', err);
        errorMessage = err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Supabase';
      }
    }

    // 4. Always save user-specific permissions to LocalStorage for instant and reliable persistence
    try {
      localStorage.setItem(`cafe_user_permissions_${payload.id}`, JSON.stringify(savePerms));
      localStorage.setItem(`cafe_user_permissions_${payload.name}`, JSON.stringify(savePerms));
    } catch (e) {
      console.warn(e);
    }

    // 5. Update local state and localStorage
    let updatedUsers = [...users];
    if (editingUser) {
      updatedUsers = updatedUsers.map(u => u.id === editingUser.id ? { ...u, ...payload } : u);
    } else {
      updatedUsers.push({ ...payload });
    }
    setUsers(updatedUsers);
    localStorage.setItem(`cafe-app-users-${targetBranch}`, JSON.stringify(updatedUsers));
    localStorage.setItem('cafe-app-users', JSON.stringify(updatedUsers));
    localStorage.setItem('app_users', JSON.stringify(updatedUsers));

    // 6. Check if we just updated the currently logged in user
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
        message: `บันทึกลงในเครื่องเรียบร้อยแล้ว (พบข้อผิดพลาดบนคลาวด์: ${errorMessage})`
      });
    } else {
      setUserSaveStatus({
        type: 'success',
        message: `บันทึกข้อมูลและสิทธิ์การเข้าถึงของ "${formData.name}" (${targetBranch}) สำเร็จเรียบร้อย`
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
      setFormData({ name: '', role: 'Barista', password: '', avatar: '', permissions: defaultPerms });
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
    const activeBr = selectedBranchFilter !== 'ALL' ? selectedBranchFilter : 'Rayong';
    localStorage.setItem(`cafe-app-users-${activeBr}`, JSON.stringify(updatedUsers));
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
    const activeBr = selectedBranchFilter !== 'ALL' ? selectedBranchFilter : 'Rayong';
    localStorage.setItem(`cafe-app-users-${activeBr}`, JSON.stringify(updatedUsers));
    localStorage.setItem('cafe-app-users', JSON.stringify(updatedUsers));
    localStorage.setItem('app_users', JSON.stringify(updatedUsers));
    setUserToDelete(null);
  };

  const openEditForm = (user: AppUser) => {
    setEditingUser(user);
    // Retrieve existing permissions from user object or local backup
    let existingPermissions = user.permissions;
    if (!existingPermissions) {
      try {
        const uSaved = localStorage.getItem(`cafe_user_permissions_${user.id}`) || localStorage.getItem(`cafe_user_permissions_${user.name}`);
        if (uSaved) existingPermissions = JSON.parse(uSaved);
      } catch (e) {
        console.warn(e);
      }
    }
    const normalized = normalizePermissions(existingPermissions, user.role);
    setFormData({
      name: user.name,
      role: user.role as UserRole,
      password: '',
      avatar: user.avatar || user.image || '',
      permissions: normalized
    });
    setIsUserFormDirty(false);
    setJustSavedUser(false);
    setUserSaveStatus(null);
    setActiveModalTab('general');
    setIsFormOpen(true);
  };

  // Helper for generating member avatar gradient backgrounds matching reference design
  const getAvatarGradient = (name: string, index: number = 0) => {
    const gradients = [
      'linear-gradient(135deg, #1E3D52 0%, #2D4A49 100%)', // Crenn Teal
      'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)', // Ocean Blue
      'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', // Purple
      'linear-gradient(135deg, #D97706 0%, #B45309 100%)', // Amber
      'linear-gradient(135deg, #059669 0%, #047857 100%)', // Emerald
      'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)', // Rose
      'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)', // Indigo
    ];
    let charCodeSum = 0;
    for (let i = 0; i < (name || '').length; i++) {
      charCodeSum += name.charCodeAt(i);
    }
    return gradients[(charCodeSum + index) % gradients.length];
  };

  // Helper for role badge styling with single-line whitespace discipline
  const renderRoleBadge = (role: string) => {
    const r = (role || '').toUpperCase();
    const badgeStyle = "whitespace-nowrap max-w-full truncate inline-flex items-center justify-center font-bold tracking-[0.04em] uppercase px-1.5 py-0.5 rounded-[5px] text-[9px] sm:text-[9.5px] leading-tight";
    
    if (r === 'ADMIN' || r === 'OWNER' || r === 'CO-FOUNDER' || r === 'COFOUNDER') {
      return (
        <span className={`bg-[#2D4A49] text-white shadow-2xs ${badgeStyle}`}>
          {role}
        </span>
      );
    }
    if (r === 'BRANCH MANAGER') {
      return (
        <span className={`bg-[#E8F3F2] text-[#5A8A88] border border-[#B8D4D2] ${badgeStyle}`}>
          {role}
        </span>
      );
    }
    return (
      <span className={`bg-[#F0F5F4] text-[#6B8F8E] border border-[#D4E4E3] ${badgeStyle}`}>
        {role}
      </span>
    );
  };

  // Helper for sorting users by official position hierarchy
  const getRoleRank = (role: string): number => {
    const r = (role || '').toUpperCase().trim();
    if (r === 'CO-FOUNDER' || r === 'COFOUNDER') return 1;
    if (r === 'OWNER') return 2;
    if (r === 'ADMIN') return 3;
    if (r === 'BRANCH MANAGER' || r === 'BRANCHMANAGER') return 4;
    if (r === 'HEAD BAKER') return 5;
    if (r === 'SENIOR BAKER') return 6;
    if (r === 'JUNIOR BAKER' || r === 'BAKER') return 7;
    if (r === 'BARISTA') return 8;
    if (r === 'BARISTA ASSISTANCE' || r === 'BARISTA ASSISTANT') return 9;
    if (r === 'CASHIER') return 10;
    if (r === 'SERVER/RUNNER' || r === 'SERVER' || r === 'RUNNER') return 11;
    if (r === 'DISHWASHER/CLEANER' || r === 'CLEANER' || r === 'DISHWASHER') return 12;
    return 99;
  };

  const sortedUsers = [...users].sort((a, b) => {
    const rankA = getRoleRank(a.role);
    const rankB = getRoleRank(b.role);
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name, 'th');
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
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
              <h2 className="text-[17px] font-bold text-white tracking-[0.01em] leading-tight">
                User Security Settings
              </h2>
              <p className="text-[11px] text-white/70 leading-relaxed mt-1 max-w-xl">
                จัดการบัญชีผู้ใช้งาน เพิ่ม แก้ไข หรือลบบัญชี รวมถึงกำหนดสิทธิ์การใช้งานแอปพลิเคชัน (Admin Only)
              </p>
            </div>
          </div>

          {!isFormOpen && (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 w-full sm:w-auto">
              {/* ปุ่ม Setting สำหรับ ตั้งค่า Default ของ Authority ตามตำแหน่ง */}
              <button 
                type="button"
                onClick={() => {
                  const role = 'Barista';
                  setSelectedTemplateRole(role);
                  const cur = roleTemplates[role] || applyRoleDefaults(role);
                  setTemplateForm({ ...cur });
                  setIsTemplateModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 bg-white/15 hover:bg-white/25 border-[1.5px] border-white/40 text-white text-[11px] font-semibold px-3 py-2 rounded-lg transition-all cursor-pointer shadow-xs shrink-0 w-full sm:w-auto"
                title="ตั้งค่า Default ของ Authority ตามตำแหน่ง"
              >
                <Settings size={14} className="text-white" />
                <span>ตั้งค่า Default ตามตำแหน่ง</span>
              </button>

              <button 
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  const defaultPerms = getRoleDefaults('Barista');
                  setFormData({ name: '', role: 'Barista', password: '', avatar: '', permissions: defaultPerms });
                  setIsUserFormDirty(false);
                  setJustSavedUser(false);
                  setUserSaveStatus(null);
                  setActiveModalTab('general');
                  setIsFormOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 bg-white/15 hover:bg-white/25 border-[1.5px] border-white/40 text-white text-[11px] font-semibold px-3.5 py-2 rounded-lg transition-all cursor-pointer shadow-xs shrink-0 w-full sm:w-auto"
              >
                <Plus size={14} className="text-white" />
                <span>เพิ่มผู้ใช้งานใหม่</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* User Form Card (Add/Edit) */}
      {isFormOpen && (
        <form onSubmit={handleSaveUser} className="bg-white border border-[#D4E4E3] rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(45,74,73,0.1)] animate-in fade-in zoom-in-95 duration-200">
          {/* Header Card with Centered Profile Avatar & Badge Icon matching image_e9eedba6.png */}
          <div className="relative pt-2 pb-5 mb-5 border-b border-[#E2EAE9] flex flex-col items-center text-center">
            <button 
              type="button" 
              onClick={() => setIsFormOpen(false)} 
              className="absolute top-0 right-0 w-8 h-8 rounded-full text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Avatar Circle Container with Yellow Badge Pencil Icon */}
            <div className="relative mb-3 group">
              <div 
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-white shadow-[0_4px_16px_rgba(45,74,73,0.18)] flex items-center justify-center transition-transform duration-200"
                style={{
                  background: (formData.avatar || editingUser?.avatar || editingUser?.image) ? '#F0F5F4' : getAvatarGradient(formData.name || 'User')
                }}
              >
                {formData.avatar ? (
                  <img 
                    src={formData.avatar} 
                    alt={formData.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (editingUser?.avatar || editingUser?.image) ? (
                  <img 
                    src={editingUser.avatar || editingUser.image} 
                    alt={formData.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-wider font-sans select-none drop-shadow-sm">
                    {formData.name ? formData.name.charAt(0) : 'U'}
                  </span>
                )}
              </div>

              {/* Edit Pencil Badge Icon */}
              <button
                type="button"
                onClick={() => {
                  setActiveModalTab('general');
                  setTimeout(() => {
                    const avatarInput = document.getElementById('user-avatar-input');
                    if (avatarInput) avatarInput.focus();
                  }, 50);
                }}
                className="absolute bottom-0 right-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#F59E0B] hover:bg-[#D97706] text-white border-2 border-white shadow-md flex items-center justify-center transition-all cursor-pointer hover:scale-110 z-10"
                title="คลิกเพื่อตั้งค่า/วาง URL รูปภาพโปรไฟล์"
              >
                <Pencil size={13} />
              </button>
            </div>

            {/* Large User Name & Role/Email Subtitle */}
            <h3 className="font-extrabold text-[17px] sm:text-[19px] text-[#2D4A49] leading-tight tracking-tight">
              {formData.name || (editingUser ? editingUser.name : 'เพิ่มผู้ใช้งานใหม่')}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap justify-center">
              {renderRoleBadge(formData.role)}
              <span className="text-[11px] text-[#6B8F8E] font-medium">
                {formData.name ? `${formData.name.toLowerCase().replace(/\s+/g, '')}@crenn.cafe` : 'member@crenn.cafe'}
              </span>
            </div>
          </div>

          {/* Tab Navigation inside Edit Modal */}
          <div className="flex items-center gap-1.5 mb-4 p-1 bg-[#F0F5F4] rounded-xl border border-[#D4E4E3] w-fit">
            <button
              type="button"
              onClick={() => setActiveModalTab('general')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
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
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">Username</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] focus:border-[#5A8A88] outline-none text-[11px] text-[#2D4A49] bg-white transition-all font-medium"
                    value={formData.name}
                    onChange={(e) => {
                      setIsUserFormDirty(true);
                      setFormData(prev => ({ ...prev, name: e.target.value }));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">Role</label>
                  <select
                    className="w-full px-3 py-2 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] focus:border-[#5A8A88] outline-none bg-white text-[11px] font-medium text-[#2D4A49] transition-all cursor-pointer"
                    value={formData.role}
                    onChange={(e) => {
                      setIsUserFormDirty(true);
                      const newRole = e.target.value as UserRole;
                      const roleDefaults = getRoleDefaults(newRole);
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
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">URL รูปภาพโปรไฟล์ (Avatar)</label>
                  <input
                    id="user-avatar-input"
                    type="url"
                    placeholder="https://example.com/avatar.png (ใส่ URL รูปภาพโปรไฟล์)"
                    className="w-full px-3 py-2 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] focus:border-[#5A8A88] outline-none text-[11px] text-[#2D4A49] bg-white transition-all font-mono"
                    value={formData.avatar}
                    onChange={(e) => {
                      setIsUserFormDirty(true);
                      setFormData(prev => ({ ...prev, avatar: e.target.value }));
                    }}
                  />
                </div>
                {!editingUser && (
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">Password</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] focus:border-[#5A8A88] outline-none text-[11px] text-[#2D4A49] bg-white transition-all font-mono"
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
              <div className="max-h-[70vh] overflow-y-auto p-1 space-y-3.5 rounded-xl custom-scrollbar">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.id} className="bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-2xs">
                    <div className="bg-[#F0F5F4] px-3.5 py-1.5 text-[10px] font-bold text-[#5A8A88] uppercase tracking-[0.08em] border-b border-[#D4E4E3]">
                      {group.name}
                    </div>
                    <div className="divide-y divide-[#F0F5F4]">
                      {group.items.map((item) => {
                        const rawVal = formData.permissions?.[item.key];
                        const currentVal: PagePermission = (rawVal === 'edit' || rawVal === 'Edit') ? 'edit' : (rawVal === 'read' || rawVal === 'Read' || rawVal === 'Review') ? 'read' : 'hidden';
                        return (
                          <div 
                            key={item.key} 
                            className="flex items-center justify-between px-3.5 py-2 min-h-[40px] hover:bg-[#FAFDFD] transition-colors gap-2"
                          >
                            <div className="flex items-center gap-2 text-[11px] font-medium text-[#2D4A49]">
                              <span className="text-[13px] shrink-0">{item.icon}</span>
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
                                className={`text-[10px] sm:text-[11px] rounded-[6px] px-2.5 py-1 transition-all cursor-pointer ${
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
                                className={`text-[10px] sm:text-[11px] rounded-[6px] px-2.5 py-1 transition-all cursor-pointer ${
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
                                className={`text-[10px] sm:text-[11px] rounded-[6px] px-2.5 py-1 transition-all cursor-pointer ${
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
                        <div className="flex items-center justify-between px-3.5 py-2 min-h-[40px] hover:bg-[#FAFDFD] transition-colors gap-2 bg-[#FBFDFD]">
                          <div className="flex items-center gap-2 text-[11px] font-medium text-[#2D4A49]">
                            <span className="text-[13px] shrink-0">📅</span>
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
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs pt-3 mt-4 border-t border-[#D4E4E3] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 z-10">
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
                className="px-3.5 py-1.5 text-[11px] font-medium text-[#6B8F8E] bg-white border border-[#D4E4E3] rounded-lg hover:bg-[#F0F5F4] transition-colors cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                disabled={isSavingUser}
                className={`flex items-center justify-center gap-1.5 text-white text-[11px] font-semibold rounded-[8px] px-4 py-1.5 min-h-[34px] min-w-[160px] transition-all shadow-2xs cursor-pointer ${
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
        {/* Section header row with Branch Selector Tabs */}
        <div className="flex items-center justify-between mb-3 px-1 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Users size={16} className="text-[#5A8A88]" />
            <h3 className="text-[13px] font-bold text-[#2D4A49]">
              รายชื่อผู้ใช้งาน
            </h3>

            {/* Interactive Branch Filter Tabs */}
            <div className="flex items-center gap-1 bg-[#E8F3F2] p-1 rounded-lg border border-[#D4E4E3] ml-1">
              <button
                type="button"
                onClick={() => setSelectedBranchFilter('Rayong')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  selectedBranchFilter === 'Rayong'
                    ? 'bg-[#2D4A49] text-white shadow-2xs'
                    : 'text-[#5A8A88] hover:bg-[#D4E4E3]/50'
                }`}
              >
                สาขา ระยอง
              </button>
              <button
                type="button"
                onClick={() => setSelectedBranchFilter('Bangkok')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  selectedBranchFilter === 'Bangkok'
                    ? 'bg-[#2D4A49] text-white shadow-2xs'
                    : 'text-[#5A8A88] hover:bg-[#D4E4E3]/50'
                }`}
              >
                สาขา Bangkok
              </button>
              <button
                type="button"
                onClick={() => setSelectedBranchFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  selectedBranchFilter === 'ALL'
                    ? 'bg-[#2D4A49] text-white shadow-2xs'
                    : 'text-[#5A8A88] hover:bg-[#D4E4E3]/50'
                }`}
              >
                ทั้งหมด
              </button>
            </div>
          </div>

          <span className="bg-[#E8F3F2] text-[#5A8A88] text-[10px] font-semibold px-2 py-0.5 rounded-md border border-[#D4E4E3]">
            {users.length} ผู้ใช้งาน {selectedBranchFilter !== 'ALL' ? `(สาขา ${selectedBranchFilter === 'Rayong' ? 'ระยอง' : selectedBranchFilter})` : '(ทุกสาขา)'}
          </span>
        </div>

        {/* User cards grid matching image_fc94ed14.png */}
        <div>
          {isLoading ? (
            <div className="text-center py-12 text-[11px] text-[#6B8F8E] bg-white rounded-2xl border border-[#D4E4E3] animate-pulse">
              กำลังโหลดข้อมูล...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-[11px] text-[#6B8F8E] bg-white rounded-2xl border border-[#D4E4E3] border-dashed">
              ยังไม่มีข้อมูลผู้ใช้งาน
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-3.5">
              {sortedUsers.map((user, idx) => (
                <div 
                  key={user.id} 
                  className="bg-white rounded-xl sm:rounded-2xl border border-[#D4E4E3] p-3.5 sm:p-4 flex flex-col items-center text-center shadow-[0_2px_8px_rgba(90,138,136,0.06)] hover:shadow-[0_6px_18px_rgba(90,138,136,0.12)] hover:border-[#B8D4D2] transition-all duration-200 group relative"
                >
                  {/* Top: Circular Member Photo Avatar */}
                  <div className="relative mb-2.5 shrink-0">
                    <div 
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 sm:border-3 border-white shadow-[0_3px_12px_rgba(45,74,73,0.14)] flex items-center justify-center transition-transform duration-200 group-hover:scale-105 cursor-pointer"
                      style={{
                        background: (user.avatar || user.image) ? '#F0F5F4' : getAvatarGradient(user.name, idx)
                      }}
                      onClick={() => openEditForm(user)}
                      title={`คลิกเพื่อแก้ไขโปรไฟล์ ${user.name}`}
                    >
                      {user.avatar || user.image ? (
                        <img 
                          src={user.avatar || user.image} 
                          alt={user.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl sm:text-2xl font-extrabold text-white tracking-wider uppercase drop-shadow-md select-none font-sans">
                          {user.name ? user.name.charAt(0) : 'U'}
                        </span>
                      )}
                    </div>

                    {/* Active Status Dot */}
                    <span 
                      className="absolute bottom-0 right-0 w-3 h-3 bg-[#22C55E] border-2 border-white rounded-full z-10 shadow-2xs" 
                      title="Active Member (Online)"
                    />
                  </div>

                  {/* 1. Account Name */}
                  <h4 className="font-extrabold text-[13px] sm:text-[14px] text-[#2D4A49] leading-tight tracking-tight mb-0.5 truncate max-w-full">
                    {user.name}
                  </h4>

                  {user.branch && (
                    <span className="text-[9px] font-semibold text-[#5A8A88] bg-[#E8F3F2] px-1.5 py-0.5 rounded border border-[#D4E4E3] mb-1.5">
                      📍 สาขา {user.branch === 'Rayong' ? 'ระยอง' : user.branch}
                    </span>
                  )}

                  {/* 2. Position / Role */}
                  <div className="mb-2.5">
                    {renderRoleBadge(user.role)}
                  </div>

                  {/* 3. Action Buttons (password, edit, delete) */}
                  <div className="w-full pt-2 border-t border-[#E2EAE9] mt-auto">
                    {isChangingPassword === user.id ? (
                      <form onSubmit={(e) => handleSavePassword(e, user.id)} className="flex flex-col gap-1.5 w-full animate-in fade-in zoom-in-95 duration-150">
                        <input
                          type="text"
                          placeholder="รหัสผ่านใหม่"
                          required
                          autoFocus
                          className="w-full px-2 py-1 border border-[#D4E4E3] rounded-md focus:ring-2 focus:ring-[#5A8A88] outline-none text-[10px] text-[#2D4A49] bg-white font-mono text-center"
                          value={passwordForm.password}
                          onChange={(e) => setPasswordForm({ password: e.target.value })}
                        />
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            type="submit" 
                            className="flex-1 py-1 bg-[#5A8A88] hover:bg-[#4d7775] text-white rounded-md transition-colors cursor-pointer text-[10px] font-bold flex items-center justify-center gap-1"
                          >
                            <Save size={11} />
                            <span>บันทึก</span>
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setIsChangingPassword(null)} 
                            className="px-2 py-1 text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#E8F3F2] rounded-md transition-colors cursor-pointer text-[10px]" 
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-center gap-1 bg-[#F0F5F4]/70 p-1 rounded-lg border border-[#D4E4E3]/70">
                        {/* Password Key Button */}
                        <button 
                          onClick={() => setIsChangingPassword(user.id)}
                          className="p-1.5 text-[#5A8A88] hover:bg-white hover:text-[#2D4A49] hover:shadow-2xs rounded-md transition-all cursor-pointer flex items-center justify-center" 
                          title="แก้ไขรหัสผ่าน"
                        >
                          <Key size={13} />
                        </button>

                        {/* Edit Pencil Button */}
                        <button 
                          onClick={() => openEditForm(user)}
                          className="p-1.5 text-[#5A8A88] hover:bg-white hover:text-[#2D4A49] hover:shadow-2xs rounded-md transition-all cursor-pointer flex items-center justify-center" 
                          title="แก้ไขข้อมูลและสิทธิ์"
                        >
                          <Pencil size={13} />
                        </button>

                        {/* Delete Trash Button */}
                        <button 
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          className="p-1.5 text-[#EF4444] hover:bg-rose-50 hover:text-rose-600 rounded-md transition-all disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed flex items-center justify-center" 
                          title="ลบผู้ใช้งาน"
                          disabled={user.name === 'Admin'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
          className="p-4 sm:p-5 text-white"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/15 border border-white/20 rounded-xl flex items-center justify-center text-[#E8F3F2]">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-white">Discord Webhook Integration Settings</h3>
              <p className="text-white/70 text-[11px] max-w-xl mt-0.5">
                ตั้งค่าระบบการแจ้งเตือนยอดการทำงาน สต็อกบาร์ ครัวเบเกอรี่ รายงานของเสีย และเมนู R&D ไปยังเซิร์ฟเวอร์ Discord
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1 flex items-center justify-between">
                  <span>Discord Webhook URL</span>
                  <a 
                    href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#5A8A88] hover:text-[#2D4A49] font-medium text-[10px] underline"
                  >
                    วิธีการสร้าง Webhook ↗
                  </a>
                </label>
                <input
                  type="password"
                  placeholder="กรอก Discord Webhook URL (https://discord.com/api/webhooks/...)"
                  className="w-full px-3 py-1.5 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] focus:border-[#5A8A88] outline-none font-mono text-[11px] text-[#2D4A49] bg-white"
                  value={discordSettings.webhookUrl}
                  onChange={(e) => setDiscordSettings({ ...discordSettings, webhookUrl: e.target.value })}
                />
              </div>

              {/* Toggle Enable Notification Systems */}
              <div className="flex items-center justify-between p-3 bg-[#F0F5F4] rounded-xl border border-[#D4E4E3]">
                <div>
                  <h4 className="font-bold text-[11px] text-[#2D4A49]">เปิดใช้งาน Discord Notify</h4>
                  <p className="text-[#6B8F8E] text-[10px] mt-0.5">เปิดหรือปิดการแจ้งเตือนทั้งหมดของแอปพลิเคชัน</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={discordSettings.enabled}
                    onChange={(e) => setDiscordSettings({ ...discordSettings, enabled: e.target.checked })}
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5A8A88]"></div>
                </label>
              </div>
            </div>

            {/* Guide Info */}
            <div className="bg-[#E8F3F2] text-[#2D4A49] p-3.5 rounded-xl border border-[#D4E4E3] text-[11px] space-y-1.5 self-start">
              <h5 className="font-bold flex items-center gap-1 text-[#2D4A49] text-[11px]">
                <AlertCircle size={13} className="text-[#5A8A88]" /> วิธีการเชื่อมต่อ Discord Webhook
              </h5>
              <ol className="list-decimal list-inside space-y-0.5 text-[#476E6C] leading-relaxed text-[10px]">
                <li>ไปที่เซิร์ฟเวอร์ Discord ของคุณ (ต้องมีสิทธิ์จัดการเซิร์ฟเวอร์)</li>
                <li>คลิกขวาที่ช่องแชต เลือก <b>แก้ไขช่อง (Edit Channel)</b></li>
                <li>ไปที่ <b>Integrations</b> แล้วคลิกที่ <b>Webhooks</b></li>
                <li>คลิก <b>สร้างเว็บฮุค (New Webhook)</b></li>
                <li>คัดลอก Webhook URL มาวางและกดบันทึก</li>
              </ol>
            </div>
          </div>

          <div className="border-t border-[#E2EAE9] pt-4">
            <h4 className="font-semibold text-[11px] text-[#2D4A49] mb-2.5 flex items-center gap-1.5">
              <Bell size={14} className="text-[#5A8A88]" />
              หัวข้อรายงานที่ต้องการส่งไป Discord (Notification Subscriptions)
            </h4>

            {/* Subscriptions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { id: 'notifyOnStockSubmit', title: 'รายงานนับและส่งยอดคงเหลือสต็อก (Stock Submission)', desc: 'ส่งสรุปสต็อกเมื่อพนักงานบันทึกยอดนับสต็อกบาร์และครัวประจำวัน' },
                { id: 'notifyOnReceiving', title: 'การตรวจรับวัตถุดิบ (Raw Material Receiving)', desc: 'ส่งความเคลื่อนไหวเมื่อมีการตรวจรับรับวัตถุดิบนำเข้า บาร์ หรือ ครัว' },
                { id: 'notifyOnChecklist', title: 'เช็คลิสต์เตรียมความพร้อมเปิด-ปิดร้าน (Checklists)', desc: 'ส่งรายงานผลการทำ Check-in / Check-out หรืองานเตรียมร้าน' },
                { id: 'notifyOnWaste', title: 'ของเสีย รายงานขยะ เมล็ดกาแฟสูญเสีย (Waste Logs)', desc: 'ส่งรายงานขยะเมล็ดกาแฟและวัตถุดิบเสียจากฝ่ายบาร์และครัว' },
                { id: 'notifyOnRnD', title: 'การเทสสูตรและรายงานเมนูใหม่ (R&D Reports)', desc: 'แชร์สูตรพัฒนา รสชาติ การประเมิน และแผนจำหน่ายเมนู R&D' },
                { id: 'notifyOnBakeryPlan', title: 'แผนการผลิตและยอดจัดจำหน่ายเบเกอรี่ (Bakery Plan)', desc: 'ส่งสรุปการวางแผนเป้าหมายสัปดาห์ใหม่และยอดขายจริงท้ายสัปดาห์' },
              ].map(sub => (
                <label key={sub.id} className="flex items-start gap-2.5 p-2.5 bg-white hover:bg-[#F0F5F4] border border-[#D4E4E3] rounded-xl cursor-pointer transition-colors shadow-2xs">
                  <input 
                    type="checkbox" 
                    className="mt-0.5 rounded text-[#5A8A88] focus:ring-[#5A8A88] w-3.5 h-3.5 cursor-pointer accent-[#5A8A88]"
                    checked={(discordSettings as any)[sub.id]}
                    onChange={(e) => setDiscordSettings({ ...discordSettings, [sub.id]: e.target.checked })}
                  />
                  <div>
                    <h5 className="font-bold text-[#2D4A49] text-[11px]">{sub.title}</h5>
                    <p className="text-[#6B8F8E] text-[10px] mt-0.5 leading-tight">{sub.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E2EAE9] pt-3.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestDiscordNotify}
                disabled={isTestingDiscord || !discordSettings.webhookUrl}
                className="flex items-center gap-1.5 border border-[#D4E4E3] hover:bg-[#F0F5F4] bg-white text-[#2D4A49] px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Send size={12} className="text-[#5A8A88]" />
                <span>{isTestingDiscord ? 'กำลังส่งทดสอบ...' : 'ส่งข้อความทดสอบ'}</span>
              </button>
              
              {discordTestResult && (
                <span className={`text-[11px] font-semibold ${discordTestResult.status === 'success' ? 'text-emerald-600' : 'text-[#EF4444]'}`}>
                  {discordTestResult.message}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveDiscordSettings}
              disabled={isSavingDiscord}
              className="flex items-center justify-center gap-1.5 bg-[#5A8A88] hover:bg-[#4d7775] text-white px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-all shadow-xs disabled:opacity-70 cursor-pointer"
            >
              <Save size={13} />
              <span>{isSavingDiscord ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า Discord Notify'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-[#D4E4E3]">
            <h3 className="text-[13px] font-bold text-[#2D4A49] mb-1.5">ยืนยันการลบผู้ใช้งาน</h3>
            <p className="text-[11px] text-[#6B8F8E] mb-4 leading-relaxed">
              คุณแน่ใจหรือไม่ที่จะลบผู้ใช้งาน <span className="font-bold text-[#2D4A49]">"{userToDelete.name}"</span> ออกจากระบบ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-3 py-1.5 text-[11px] font-medium text-[#6B8F8E] hover:bg-[#F0F5F4] border border-[#D4E4E3] rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-3 py-1.5 bg-[#EF4444] hover:bg-red-600 text-white rounded-lg transition-colors text-[11px] font-semibold cursor-pointer shadow-xs"
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
            <div className="flex items-center justify-between p-4 border-b border-[#E2EAE9]">
              <h3 className="text-[14px] font-bold text-[#2D4A49] flex items-center gap-2">
                <Settings className="text-[#5A8A88]" size={16} />
                ตั้งค่า Default ของ Authority ตามตำแหน่ง (Role Template)
              </h3>
              <button 
                onClick={() => setIsTemplateModalOpen(false)}
                className="w-7 h-7 rounded-lg text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-3.5 border-b border-[#E2EAE9] bg-[#F0F5F4] space-y-2.5">
              {/* Row 1: Role select and Global Presets */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-[11px] font-bold text-[#2D4A49] shrink-0">
                    เลือกตำแหน่ง (Role):
                  </label>
                  <select
                    className="px-2.5 py-1.5 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] outline-none bg-white text-[11px] font-semibold text-[#2D4A49] shadow-2xs cursor-pointer min-w-[160px]"
                    value={selectedTemplateRole}
                    onChange={(e) => {
                      const role = e.target.value as UserRole;
                      setSelectedTemplateRole(role);
                      const cur = roleTemplates[role] || applyRoleDefaults(role);
                      setTemplateForm({ ...cur });
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

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-[#2D4A49]">เลือกทั้งหมด:</span>
                  <button
                    type="button"
                    onClick={() => handleTemplatePresetAll('read')}
                    className="bg-white border border-[#D4E4E3] text-[#10B981] hover:text-emerald-700 text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer"
                  >
                    Read ทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTemplatePresetAll('edit')}
                    className="bg-white border border-[#D4E4E3] text-[#5A8A88] hover:text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer"
                  >
                    Edit ทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTemplatePresetAll('hidden')}
                    className="bg-white border border-[#D4E4E3] text-[#6B8F8E] hover:text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer"
                  >
                    Hidden ทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const def = applyRoleDefaults(selectedTemplateRole);
                      setTemplateForm({ ...def });
                    }}
                    className="flex items-center gap-1 bg-white border border-[#D4E4E3] text-[#6B8F8E] hover:text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer"
                    title="รีเซ็ตเป็นค่ามาตรฐานระบบ"
                  >
                    <RotateCcw size={11} />
                    <span>รีเซ็ตมาตรฐาน</span>
                  </button>
                </div>
              </div>

              {/* Row 1.5: Cross-Branch Authority Control Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-[#E8F3F2] rounded-lg border border-[#B8D4D2]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Globe size={13} className="text-[#5A8A88]" />
                  <span className="text-[11px] font-bold text-[#2D4A49]">ดึง Authority ข้ามสาขา:</span>
                  <select
                    className="px-2 py-1 bg-white border border-[#B8D4D2] rounded text-[11px] text-[#2D4A49] font-medium outline-none cursor-pointer"
                    defaultValue=""
                    onChange={(e) => {
                      const sourceBranch = e.target.value;
                      if (!sourceBranch) return;
                      const found = availableBranchTemplates.find(b => b.branch === sourceBranch);
                      if (found && found.data) {
                        const cur = found.data[selectedTemplateRole] || applyRoleDefaults(selectedTemplateRole);
                        setTemplateForm({ ...cur });
                        setRoleTemplates(prev => ({ ...prev, ...found.data }));
                      }
                      e.target.value = '';
                    }}
                  >
                    <option value="" disabled>-- เลือกสาขาต้นทางเพื่อดึงข้อมูล --</option>
                    {availableBranchTemplates.length > 0 ? (
                      availableBranchTemplates.map(b => (
                        <option key={b.branch} value={b.branch}>
                          สาขา: {b.branch} {b.branch === branch ? '(สาขาปัจจุบัน)' : ''}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Rayong">สาขา: Rayong</option>
                        <option value="GLOBAL">สาขา: GLOBAL (ส่วนกลาง)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-[#2D4A49] cursor-pointer" title="บันทึกการตั้งค่านี้ไปยังทุกสาขาพร้อมกัน">
                    <input
                      type="checkbox"
                      checked={syncAcrossAllBranches}
                      onChange={(e) => setSyncAcrossAllBranches(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-[#5A8A88] accent-[#5A8A88] cursor-pointer"
                    />
                    <span>ซิงค์ข้ามทุกสาขา (Sync All Branches)</span>
                  </label>
                  <button
                    type="button"
                    onClick={fetchRoleTemplates}
                    className="flex items-center gap-1 px-2 py-1 bg-white border border-[#B8D4D2] text-[#5A8A88] hover:text-[#2D4A49] rounded text-[10px] sm:text-[11px] font-medium hover:bg-[#FAFDFD] transition-colors cursor-pointer"
                    title="รีเฟรชข้อมูล Authority จากทุกสาขา"
                  >
                    <RotateCcw size={10} />
                    <span>รีเฟรช</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Quick Presets (บาร์ full, ครัว full, บาร์ only, ครัว only) */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#D4E4E3]/70">
                <span className="text-[11px] font-bold text-[#2D4A49]">ปรับสิทธิ์ด่วน:</span>
                <button
                  type="button"
                  onClick={handleTemplatePresetBarFull}
                  className="bg-white border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer shadow-2xs"
                >
                  🍹 บาร์ Full
                </button>
                <button
                  type="button"
                  onClick={handleTemplatePresetKitchenFull}
                  className="bg-white border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer shadow-2xs"
                >
                  🍳 ครัว Full
                </button>
                <button
                  type="button"
                  onClick={handleTemplatePresetBarOnly}
                  className="bg-white border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer shadow-2xs"
                >
                  บาร์ Only
                </button>
                <button
                  type="button"
                  onClick={handleTemplatePresetKitchenOnly}
                  className="bg-white border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium rounded-[6px] px-2.5 py-1 hover:bg-[#E8F3F2] transition-colors cursor-pointer shadow-2xs"
                >
                  ครัว Only
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 custom-scrollbar">
              <div className="bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-xs">
                <table className="w-full text-left bg-white text-[11px]">
                  <thead>
                    <tr className="bg-[#E8F3F2] border-b border-[#D4E4E3] text-[#2D4A49]">
                      <th className="p-2 font-bold w-full text-[11px]">ฟังก์ชันระบบ</th>
                      <th className="p-2 font-bold text-center w-20 text-[11px]">Read</th>
                      <th className="p-2 font-bold text-center w-20 text-[11px]">Edit</th>
                      <th className="p-2 font-bold text-center w-20 text-[11px]">Hidden</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F5F4]">
                    {PERMISSION_GROUPS.map(group => (
                      <React.Fragment key={group.id}>
                        <tr className="bg-[#F8FAF9] border-y border-[#E2EAE9]">
                          <td colSpan={4} className="px-3 py-1 font-bold text-[10px] text-[#2D4A49] uppercase tracking-[0.05em]">
                            {group.name}
                          </td>
                        </tr>
                        {group.items.map(func => (
                          <tr key={func.key} className="hover:bg-[#F8FAFA] transition-colors">
                            <td className="p-2 pl-4 font-medium text-[#2D4A49] flex items-center gap-2 text-[11px]">
                              <span className="text-[12px]">{func.icon}</span>
                              <span>{func.name}</span>
                            </td>
                            <td className="p-2 text-center">
                              <label className="inline-flex items-center justify-center cursor-pointer p-0.5">
                                <input 
                                  type="radio" 
                                  name={`tpl_perm_${func.key}`} 
                                  checked={templateForm[func.key] === 'read'}
                                  onChange={() => setTemplateForm(prev => ({ ...prev, [func.key]: 'read' }))}
                                  className="w-3.5 h-3.5 accent-[#10B981] cursor-pointer"
                                />
                              </label>
                            </td>
                            <td className="p-2 text-center">
                              <label className="inline-flex items-center justify-center cursor-pointer p-0.5">
                                <input 
                                  type="radio" 
                                  name={`tpl_perm_${func.key}`} 
                                  checked={templateForm[func.key] === 'edit'}
                                  onChange={() => setTemplateForm(prev => ({ ...prev, [func.key]: 'edit' }))}
                                  className="w-3.5 h-3.5 accent-[#5A8A88] cursor-pointer"
                                />
                              </label>
                            </td>
                            <td className="p-2 text-center">
                              <label className="inline-flex items-center justify-center cursor-pointer p-0.5">
                                <input 
                                  type="radio" 
                                  name={`tpl_perm_${func.key}`} 
                                  checked={templateForm[func.key] === 'hidden'}
                                  onChange={() => setTemplateForm(prev => ({ ...prev, [func.key]: 'hidden' }))}
                                  className="w-3.5 h-3.5 accent-[#6B8F8E] cursor-pointer"
                                />
                              </label>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* Special Option: canEditDateRange */}
                    <tr className="bg-[#F8FAF9] border-t border-[#E2EAE9]">
                      <td colSpan={4} className="p-2.5">
                        <label className="flex items-center gap-2 text-[11px] font-semibold text-[#2D4A49] cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={!!templateForm.canEditDateRange}
                            onChange={(e) => setTemplateForm(prev => ({ ...prev, canEditDateRange: e.target.checked }))}
                            className="w-3.5 h-3.5 rounded text-[#5A8A88] accent-[#5A8A88] cursor-pointer"
                          />
                          <span>📅 อนุญาตให้เลือกช่วงวันที่ข้ามสัปดาห์ (Date Range)</span>
                        </label>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3.5 border-t border-[#E2EAE9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
              <span className="text-[10px] sm:text-[11px] text-[#6B8F8E]">
                * สิทธิ์จะถูกบันทึกเป็นค่า Default และอัปเดตไปยังทุกบัญชีตำแหน่ง "{selectedTemplateRole}" ในระบบทันที ({users.filter(u => (u.role || '').toLowerCase().trim() === (selectedTemplateRole || '').toLowerCase().trim()).length} บัญชี)
              </span>
              <div className="flex gap-2 self-end sm:self-auto">
                <button 
                  type="button" 
                  onClick={() => setIsTemplateModalOpen(false)} 
                  className="px-3.5 py-1.5 text-[11px] font-medium text-[#6B8F8E] bg-white border border-[#D4E4E3] rounded-lg hover:bg-[#F0F5F4] transition-colors cursor-pointer"
                >
                  ปิด
                </button>
                <button 
                  type="button" 
                  onClick={handleSaveRoleTemplate}
                  disabled={isSavingTemplate}
                  className="px-3.5 py-1.5 bg-[#5A8A88] hover:bg-[#4d7775] text-white text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-70 cursor-pointer"
                >
                  {isSavingTemplate ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{isSavingTemplate ? 'กำลังบันทึกและอัปเดตบัญชี...' : `บันทึก Default & ปรับใช้กับทุกบัญชี (${users.filter(u => (u.role || '').toLowerCase().trim() === (selectedTemplateRole || '').toLowerCase().trim()).length})`}</span>
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
