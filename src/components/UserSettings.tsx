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
  BookOpen
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole } from './LoginForm';
import { AppUser, AppPermissions } from '../types';

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
  const [isChangingPassword, setIsChangingPassword] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<{id: string, name: string} | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    role: 'Barista' as UserRole,
    password: '',
    permissions: DEFAULT_PERMISSIONS
  });
  
  const [passwordForm, setPasswordForm] = useState({
    password: ''
  });

  const [roleTemplates, setRoleTemplates] = useState<Record<string, AppPermissions>>({});
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplateRole, setSelectedTemplateRole] = useState<UserRole>('Barista');
  const [templateForm, setTemplateForm] = useState<AppPermissions>(DEFAULT_PERMISSIONS);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

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
      const { data, error } = await supabase.from('app_users').select('*').eq('branch', branch);
      if (!error && data) {
        setUsers(data as AppUser[]);
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
      alert('Please fill out all required fields');
      return;
    }

    const payload: any = {
      branch,
      name: formData.name.trim(),
      role: formData.role,
      permissions: formData.permissions
    };

    if (!editingUser) {
      payload.password = formData.password;
    }

    if (supabase) {
      if (editingUser) {
        const { error } = await supabase.from('app_users').update(payload).eq('id', editingUser.id).eq('branch', branch);
        if (error) {
          alert('Error updating user: ' + error.message);
          return;
        }
      } else {
        const { error } = await supabase.from('app_users').insert(payload);
        if (error) {
          alert('Error adding user: ' + error.message);
          return;
        }
      }
      fetchUsers();
    } else {
      // LocalStorage logic
      let updatedUsers = [...users];
      if (editingUser) {
        updatedUsers = updatedUsers.map(u => u.id === editingUser.id ? { ...u, ...payload } : u);
      } else {
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));
        updatedUsers.push({ id, ...payload });
      }
      setUsers(updatedUsers);
      localStorage.setItem('cafe-app-users', JSON.stringify(updatedUsers));
    }
    
    // Check if we just updated the currently logged in user
    if (editingUser && currentUser && currentUser.name === editingUser.name && onCurrentUserUpdated) {
        onCurrentUserUpdated({
            name: payload.name,
            role: payload.role,
            permissions: payload.permissions
        });
    }

    setEditingUser(null);
    setIsFormOpen(false);
    const baristaPerms = roleTemplates['Barista'] || DEFAULT_PERMISSIONS;
    setFormData({ name: '', role: 'Barista', password: '', permissions: { ...DEFAULT_PERMISSIONS, ...baristaPerms } });
  };

  const handleSavePassword = async (e: React.FormEvent, userId: string) => {
    e.preventDefault();
    if (!passwordForm.password.trim()) {
      alert('Password cannot be empty');
      return;
    }

    if (supabase) {
      await supabase.from('app_users').update({ password: passwordForm.password }).eq('id', userId).eq('branch', branch);
    } else {
      const updatedUsers = users.map(u => u.id === userId ? { ...u, password: passwordForm.password } : u);
      setUsers(updatedUsers);
      localStorage.setItem('cafe-app-users', JSON.stringify(updatedUsers));
    }

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
      const { error } = await supabase.from('app_users').delete().eq('id', id).eq('branch', branch);
      if (error) {
        console.warn('Error deleting user:', error);
      } else {
        fetchUsers();
      }
    } else {
      const updatedUsers = users.filter(u => u.id !== id);
      setUsers(updatedUsers);
      localStorage.setItem('cafe-app-users', JSON.stringify(updatedUsers));
    }
    setUserToDelete(null);
  };

  const openEditForm = (user: AppUser) => {
    setEditingUser(user);
    const existingPermissions = user.permissions || {};
    setFormData({
      name: user.name,
      role: user.role as UserRole,
      password: '',
      permissions: {
        ...DEFAULT_PERMISSIONS,
        ...existingPermissions,
        adminTools: (existingPermissions as AppPermissions).adminTools || (user.role === 'Admin' ? 'Edit' : 'Hidden')
      }
    });
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
                const baristaPerms = roleTemplates['Barista'] || DEFAULT_PERMISSIONS;
                setFormData({ name: '', role: 'Barista', password: '', permissions: { ...DEFAULT_PERMISSIONS, ...baristaPerms } });
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

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          WARNING / INFO BANNER
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-[#FFFBEB] border border-[#FDE68A] border-l-[4px] border-l-[#F59E0B] rounded-xl p-3.5 sm:p-4 flex items-start gap-3 shadow-xs">
        <AlertCircle size={16} className="text-[#F59E0B] shrink-0 mt-0.5" />
        <div className="text-[12px] text-[#92400E] leading-relaxed">
          <p>
            เพื่อให้ระบบ User Authentication ทำงานได้อย่างถูกต้อง โปรดตรวจสอบว่าตาราง <code className="bg-amber-100/80 text-[#92400E] font-mono px-1.5 py-0.5 rounded text-[11px]">app_users</code> มีอยู่บน Supabase และมีข้อมูลผู้ใช้อย่างน้อย 1 รายการ
          </p>
          <p className="font-semibold text-[#92400E] mt-2 pt-2 border-t border-amber-200/60">
            * สำคัญ: กรุณาเพิ่มคอลัมน์ <code className="bg-amber-100/80 text-[#92400E] font-mono px-1.5 py-0.5 rounded text-[11px]">permissions</code> (ชนิดข้อมูล <code className="bg-amber-100/80 text-[#92400E] font-mono px-1.5 py-0.5 rounded text-[11px]">jsonb</code>) ในตาราง <code className="bg-amber-100/80 text-[#92400E] font-mono px-1.5 py-0.5 rounded text-[11px]">app_users</code> เพื่อให้สามารถบันทึกสิทธิ์การใช้งานได้ หากไม่มีคอลัมน์นี้จะไม่สามารถเพิ่มผู้ใช้หรือแก้สิทธิ์ได้
          </p>
        </div>
      </div>

      {/* User Form Card (Add/Edit) */}
      {isFormOpen && (
        <form onSubmit={handleSaveUser} className="bg-white border border-[#D4E4E3] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(90,138,136,0.08)] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E2EAE9]">
            <h3 className="font-bold text-[16px] text-[#2D4A49]">
              {editingUser ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}
            </h3>
            <button 
              type="button" 
              onClick={() => setIsFormOpen(false)} 
              className="w-7 h-7 rounded-lg text-[#6B8F8E] hover:text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#2D4A49] mb-1">Username</label>
              <input
                type="text"
                required
                className="w-full px-3.5 py-2 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] focus:border-[#5A8A88] outline-none text-xs text-[#2D4A49] bg-white transition-all"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D4A49] mb-1">Role</label>
              <select
                className="w-full px-3.5 py-2 border border-[#D4E4E3] rounded-lg focus:ring-2 focus:ring-[#5A8A88] focus:border-[#5A8A88] outline-none bg-white text-xs text-[#2D4A49] transition-all cursor-pointer"
                value={formData.role}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  const rolePerms = roleTemplates[newRole];
                  setFormData({ 
                    ...formData, 
                    role: newRole,
                    permissions: rolePerms ? { ...DEFAULT_PERMISSIONS, ...rolePerms } : DEFAULT_PERMISSIONS
                  });
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
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-[#E2EAE9] pt-5">
            <div className="flex items-center justify-between mb-3.5">
              <h4 className="font-bold text-[#2D4A49] text-sm flex items-center gap-2">
                <Shield size={16} className="text-[#5A8A88]" />
                สิทธิ์การใช้งาน (Function Permissions)
              </h4>
              <button 
                type="button" 
                onClick={() => {
                  const perms = roleTemplates[formData.role] || DEFAULT_PERMISSIONS;
                  setSelectedTemplateRole(formData.role);
                  setTemplateForm(perms);
                  setIsTemplateModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#5A8A88] hover:text-[#2D4A49] bg-[#E8F3F2] hover:bg-[#D4E4E3] border border-[#B8D4D2] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Settings size={13} /> ตั้งค่าเทมเพลต Role
              </button>
            </div>
            <div className="bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-xs">
              <table className="w-full text-left bg-white text-xs">
                <thead>
                  <tr className="bg-[#E8F3F2] border-b border-[#D4E4E3] text-[#2D4A49]">
                    <th className="p-2.5 font-bold w-full">ฟังก์ชัน</th>
                    <th className="p-2.5 font-bold text-center w-20">Hidden</th>
                    <th className="p-2.5 font-bold text-center w-20">Review</th>
                    <th className="p-2.5 font-bold text-center w-20">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F5F4]">
                  {APP_FUNCTIONS.map(func => (
                    <tr key={func.id} className="hover:bg-[#F8FAFA] transition-colors">
                      <td className="p-2.5 font-medium text-[#2D4A49]">{func.name}</td>
                      <td className="p-2.5 text-center">
                        <input 
                          type="radio" 
                          name={`perm_${func.id}`} 
                          checked={formData.permissions[func.id] === 'Hidden'}
                          onChange={() => setFormData({ ...formData, permissions: { ...formData.permissions, [func.id]: 'Hidden' } })}
                          className="w-4 h-4 accent-[#5A8A88] cursor-pointer"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <input 
                          type="radio" 
                          name={`perm_${func.id}`} 
                          checked={formData.permissions[func.id] === 'Review'}
                          onChange={() => setFormData({ ...formData, permissions: { ...formData.permissions, [func.id]: 'Review' } })}
                          className="w-4 h-4 accent-[#10B981] cursor-pointer"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <input 
                          type="radio" 
                          name={`perm_${func.id}`} 
                          checked={formData.permissions[func.id] === 'Edit'}
                          onChange={() => setFormData({ ...formData, permissions: { ...formData.permissions, [func.id]: 'Edit' } })}
                          className="w-4 h-4 accent-[#5A8A88] cursor-pointer"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: สิทธิ์การเข้าถึง Daily Record (Admin/CO-FOUNDER only) */}
          {(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.role?.toUpperCase() === 'CO-FOUNDER' || currentUser?.role?.toUpperCase() === 'OWNER') && (
            <div className="mt-5 p-3.5 bg-[#F0F5F4] border border-[#D4E4E3] rounded-xl">
              <h4 className="font-bold text-[#2D4A49] text-xs flex items-center gap-1.5 mb-2">
                <BookOpen size={14} className="text-[#5A8A88]" />
                สิทธิ์การเข้าถึง Daily Record
              </h4>
              <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-[#D4E4E3]">
                <div>
                  <p className="text-xs font-semibold text-[#2D4A49]">สามารถกำหนดช่วงวันที่เองได้</p>
                  <p className="text-[11px] text-[#6B8F8E]">อนุญาตให้ผู้ใช้กำหนดวันเริ่ม-สิ้นสุด ในหน้าบันทึกยอดขายประจำวัน</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={!!formData.permissions.canEditDateRange}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      permissions: { 
                        ...formData.permissions, 
                        canEditDateRange: e.target.checked 
                      } 
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5A8A88]"></div>
                </label>
              </div>
            </div>
          )}
          
          <div className="mt-5 flex justify-end gap-2.5">
            <button 
              type="button" 
              onClick={() => setIsFormOpen(false)} 
              className="px-4 py-2 text-xs font-medium text-[#6B8F8E] bg-white border border-[#D4E4E3] rounded-lg hover:bg-[#F0F5F4] transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 bg-[#5A8A88] hover:bg-[#4d7775] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save size={14} /> บันทึก
            </button>
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
