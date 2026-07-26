import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Shield, User, Key, Save, X, AlertCircle, Bell, Send, Check, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole } from './LoginForm';
import { AppUser, AppPermissions, PermissionLevel } from '../types';

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
        const saved = localStorage.getItem('role_permissions_templates');
        if (saved) setRoleTemplates(JSON.parse(saved));
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

  // LINE Notify Integration States & Handlers
  const [lineSettings, setLineSettings] = useState<any>({
    token: '',
    enabled: false,
    notifyOnWaste: true,
    notifyOnRnD: true,
    notifyOnStockSubmit: true,
    notifyOnChecklist: true,
    notifyOnReceiving: true,
    notifyOnBakeryPlan: true
  });
  const [isSavingLine, setIsSavingLine] = useState(false);
  const [isTestingLine, setIsTestingLine] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('lineNotifySettings');
    if (saved) {
      try {
        setLineSettings(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSaveLineSettings = async () => {
    setIsSavingLine(true);
    setTestResult(null);
    try {
      localStorage.setItem('lineNotifySettings', JSON.stringify(lineSettings));
      
      // Save to Supabase if available
      if (supabase) {
        const { error } = await supabase.from('app_settings').upsert({ branch,
          setting_key: 'line_notify_settings',
          setting_value: lineSettings
        });
        if (error) {
          throw new Error(error.message);
        }
      }
      alert('บันทึกการตั้งค่า LINE Notify เรียบร้อยแล้ว!');
    } catch (e: any) {
      alert('มีข้อผิดพลาดในการบันทึก: ' + e.message);
    } finally {
      setIsSavingLine(false);
    }
  };

  const handleTestLineNotify = async () => {
    setIsTestingLine(true);
    setTestResult(null);
    try {
      if (!lineSettings.token.trim()) {
        setTestResult({ status: 'error', message: 'กรุณากรอก LINE Notify Token ก่อนทดสอบ' });
        return;
      }

      const response = await fetch('/api/line-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: '\n🔔 ทดสอบการเชื่อมต่อระบบ LINE Notify จากแอปพลิเคชัน Cafe Stock Manager สำเร็จแล้ว!',
          token: lineSettings.token
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTestResult({ status: 'success', message: 'เชื่อมต่อและส่งข้อความทดสอบไปยัง LINE สำเร็จแล้ว!' });
      } else {
        setTestResult({ status: 'error', message: data.error || 'ส่งข้อความไม่สำเร็จ โปรดตรวจสอบว่า Token ถูกต้องหรือไม่' });
      }
    } catch (e: any) {
      setTestResult({ status: 'error', message: e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' });
    } finally {
      setIsTestingLine(false);
    }
  };

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
        console.error(e);
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
        const { error } = await supabase.from('app_users').update(payload).eq('id', editingUser.id);
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
      await supabase.from('app_users').update({ password: passwordForm.password }).eq('id', userId);
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
      alert('Cannot delete the Admin account.');
      return;
    }
    if (confirm(`Are you sure you want to delete user "${name}"?`)) {
      if (supabase) {
        const { error } = await supabase.from('app_users').delete().eq('id', id);
        if (error) {
          console.error('Error deleting user:', error);
          alert('Failed to delete user: ' + error.message);
        } else {
          fetchUsers();
        }
      } else {
        const updatedUsers = users.filter(u => u.id !== id);
        setUsers(updatedUsers);
        localStorage.setItem('cafe-app-users', JSON.stringify(updatedUsers));
      }
    }
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 p-8 text-white relative">
          <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-700 rounded-xl">
                  <Shield size={24} className="text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold">User Security Settings</h2>
              </div>
              <p className="text-slate-300 text-sm max-w-xl">
                จัดการบัญชีผู้ใช้งาน เพิ่ม แก้ไข หรือลบบัญชี รวมถึงกำหนดสิทธิ์การใช้งานแอปพลิเคชัน (Admin Only)
              </p>
            </div>
            {!isFormOpen && (
              <button 
                onClick={() => {
                  setEditingUser(null);
                  const baristaPerms = roleTemplates['Barista'] || DEFAULT_PERMISSIONS;
                  setFormData({ name: '', role: 'Barista', password: '', permissions: { ...DEFAULT_PERMISSIONS, ...baristaPerms } });
                  setIsFormOpen(true);
                }}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm"
              >
                <Plus size={16} />
                เพิ่มผู้ใช้งานใหม่
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl flex items-start gap-3 mb-6">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <p>เพื่อให้ระบบ User Authentication ทำงานได้อย่างถูกต้อง โปรดตรวจสอบว่าตาราง <code>app_users</code> มีอยู่บน Supabase และมีข้อมูลผู้ใช้อย่างน้อย 1 รายการ</p>
              <p className="font-semibold text-blue-900 border-t border-blue-200 pt-2 mt-2">
                * สำคัญ: กรุณาเพิ่มคอลัมน์ <code>permissions</code> (ชนิดข้อมูล <code>jsonb</code>) ในตาราง <code>app_users</code> เพื่อให้สามารถบันทึกสิทธิ์การใช้งานได้ หากไม่มีคอลัมน์นี้จะไม่สามารถเพิ่มผู้ใช้หรือแก้สิทธิ์ได้
              </p>
            </div>
          </div>

          {isFormOpen && (
            <form onSubmit={handleSaveUser} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-800">{editingUser ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}</h3>
                <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
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
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Shield size={18} className="text-blue-600" />
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
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Settings size={14} /> ตั้งค่าเทมเพลต Role
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left bg-white text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="p-3 font-semibold w-full">ฟังก์ชัน</th>
                        <th className="p-3 font-semibold text-center w-20">Hidden</th>
                        <th className="p-3 font-semibold text-center w-20">Review</th>
                        <th className="p-3 font-semibold text-center w-20">Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {APP_FUNCTIONS.map(func => (
                        <tr key={func.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-medium text-slate-800">{func.name}</td>
                          <td className="p-3 text-center">
                            <input 
                              type="radio" 
                              name={`perm_${func.id}`} 
                              checked={formData.permissions[func.id] === 'Hidden'}
                              onChange={() => setFormData({ ...formData, permissions: { ...formData.permissions, [func.id]: 'Hidden' } })}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input 
                              type="radio" 
                              name={`perm_${func.id}`} 
                              checked={formData.permissions[func.id] === 'Review'}
                              onChange={() => setFormData({ ...formData, permissions: { ...formData.permissions, [func.id]: 'Review' } })}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input 
                              type="radio" 
                              name={`perm_${func.id}`} 
                              checked={formData.permissions[func.id] === 'Edit'}
                              onChange={() => setFormData({ ...formData, permissions: { ...formData.permissions, [func.id]: 'Edit' } })}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 font-medium transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-medium transition-colors flex items-center gap-2">
                  <Save size={16} /> บันทึก
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-slate-500 animate-pulse">กำลังโหลดข้อมูล...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                ยังไม่มีข้อมูลผู้ใช้งาน
              </div>
            ) : users.map((user) => (
              <div key={user.id} className="flex flex-col p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-200 transition-all group gap-4 md:gap-0 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{user.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-bold ${
                        user.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.role}
                      </span>
                    </div>
                  </div>
                </div>
                
                {isChangingPassword === user.id ? (
                  <form onSubmit={(e) => handleSavePassword(e, user.id)} className="flex items-center gap-2 w-full md:w-auto">
                    <div className="flex items-center px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-400 line-through shrink-0" title="รหัสผ่านเดิม">
                      {user.password || 'ไม่มีรหัส'}
                    </div>
                    <input
                      type="text"
                      placeholder="New password"
                      required
                      className="flex-1 md:w-40 px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      value={passwordForm.password}
                      onChange={(e) => setPasswordForm({ password: e.target.value })}
                    />
                    <button type="submit" className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors" title="บันทึก">
                      <Save size={16} />
                    </button>
                    <button type="button" onClick={() => setIsChangingPassword(null)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="ยกเลิก">
                      <X size={16} />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setIsChangingPassword(user.id)}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 md:border-transparent md:text-slate-400" 
                      title="เปลี่ยนรหัสผ่าน"
                    >
                      <Key size={18} />
                    </button>
                    <button 
                      onClick={() => openEditForm(user)}
                      className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-200 md:border-transparent md:text-slate-400" 
                      title="แก้ไขข้อมูล"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(user.id, user.name)}
                      className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-slate-200 md:border-transparent md:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed" 
                      title="ลบผู้ใช้งาน"
                      disabled={user.name === 'Admin'}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LINE Notify Integration Card */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 p-8 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white">
              <Bell size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">LINE Notify Integration Settings</h2>
              <p className="text-slate-300 text-sm max-w-xl mt-1">
                ตั้งค่าระบบการแจ้งเตือนยอดการทำงาน สต็อกบาร์ ครัวเบเกอรี่ รายงานของเสีย และเมนู R&D ไปยังกลุ่ม LINE
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>LINE Notify Access Token</span>
                  <a 
                    href="https://notify-bot.line.me/my/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 font-medium text-xs underline"
                  >
                    เข้าสู่ระบบเพื่อขอรับ Token ↗
                  </a>
                </label>
                <input
                  type="password"
                  placeholder="กรอก LINE Notify Access Token..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm"
                  value={lineSettings.token}
                  onChange={(e) => setLineSettings({ ...lineSettings, token: e.target.value })}
                />
              </div>

              {/* Toggle Enable Notification Systems */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <h4 className="font-bold text-slate-800">เปิดใช้งาน LINE Notify</h4>
                  <p className="text-slate-500 text-xs mt-0.5">เปิดหรือปิดการแจ้งเตือนทั้งหมดของแอปพลิเคชัน</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={lineSettings.enabled}
                    onChange={(e) => setLineSettings({ ...lineSettings, enabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Guide Info */}
            <div className="bg-amber-50 text-amber-900 p-5 rounded-2xl border border-amber-200 text-xs space-y-2.5 self-start">
              <h5 className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertCircle size={14} /> วิธีการเชื่อมต่อ LINE Notify
              </h5>
              <ol className="list-decimal list-inside space-y-1.5 text-amber-900 leading-relaxed">
                <li>ไปที่เว็บไซต์ <a href="https://notify-bot.line.me/" target="_blank" rel="noopener noreferrer" className="font-bold underline text-amber-950">LINE Notify</a> และเข้าสู่ระบบ</li>
                <li>ไปที่ <span className="font-semibold">หน้าของฉัน (My Page)</span> แล้วคลิก <span className="font-semibold">ออก Token (Generate token)</span></li>
                <li>ตั้งชื่อบอตผู้ส่ง และเลือกแชตกลุ่มหรือแชตส่วนตัวที่จะแจ้งเตือน</li>
                <li>คัดลอก Token ที่ได้มาวางในช่องทางซ้ายมือ และกดบันทึก</li>
                <li><span className="font-bold text-red-700">*สำคัญที่สุด:</span> คุณต้องดึงบอตชื่อ <span className="font-bold text-slate-900">"LINE Notify"</span> เข้ากลุ่มแชตด้วยจึงจะสารถรับแจ้งเตือนได้</li>
              </ol>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Bell size={18} className="text-emerald-600" />
              หัวข้อรายงานที่ต้องการส่งไป LINE (Notification Subscriptions)
            </h4>

            {/* Select Subscriptions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  checked={lineSettings.notifyOnStockSubmit}
                  onChange={(e) => setLineSettings({ ...lineSettings, notifyOnStockSubmit: e.target.checked })}
                />
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">รายงานนับและส่งยอดคงเหลือสต็อก (Stock Submission)</h5>
                  <p className="text-slate-500 text-xs mt-1">ส่งสรุปสต็อกเมื่อพนักงานบันทึกยอดนับสต็อกบาร์และครัวประจำวัน</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  checked={lineSettings.notifyOnReceiving}
                  onChange={(e) => setLineSettings({ ...lineSettings, notifyOnReceiving: e.target.checked })}
                />
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">การตรวจรับวัตถุดิบ (Raw Material Receiving)</h5>
                  <p className="text-slate-500 text-xs mt-1">ส่งความเคลื่อนไหวเมื่อมีการตรวจรับรับวัตถุดิบนำเข้า บาร์ หรือ ครัว</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  checked={lineSettings.notifyOnChecklist}
                  onChange={(e) => setLineSettings({ ...lineSettings, notifyOnChecklist: e.target.checked })}
                />
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">เช็คลิสต์เตรียมความพร้อมเปิด-ปิดร้าน (Checklists)</h5>
                  <p className="text-slate-500 text-xs mt-1">ส่งรายงานผลการทำ Check-in / Check-out หรืองานเตรียมร้าน</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  checked={lineSettings.notifyOnWaste}
                  onChange={(e) => setLineSettings({ ...lineSettings, notifyOnWaste: e.target.checked })}
                />
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">ของเสีย รายงานขยะ เมล็ดกาแฟสูญเสีย (Waste Logs)</h5>
                  <p className="text-slate-500 text-xs mt-1">ส่งรายงานขยะเมล็ดกาแฟและวัตถุดิบเสียจากฝ่ายบาร์และครัว</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  checked={lineSettings.notifyOnRnD}
                  onChange={(e) => setLineSettings({ ...lineSettings, notifyOnRnD: e.target.checked })}
                />
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">การเทสสูตรและรายงานเมนูใหม่ (R&D Reports)</h5>
                  <p className="text-slate-500 text-xs mt-1">แชร์สูตรพัฒนา รสชาติ การประเมิน และแผนจำหน่ายเมนู R&D</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  checked={lineSettings.notifyOnBakeryPlan}
                  onChange={(e) => setLineSettings({ ...lineSettings, notifyOnBakeryPlan: e.target.checked })}
                />
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">แผนการผลิตและยอดจัดจำหน่ายเบเกอรี่ (Bakery Plan)</h5>
                  <p className="text-slate-500 text-xs mt-1">ส่งสรุปการวางแผนเป้าหมายสัปดาห์ใหม่และยอดขายจริงท้ายสัปดาห์</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse md:flex-row md:items-center justify-between gap-4 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestLineNotify}
                disabled={isTestingLine || !lineSettings.token}
                className="flex items-center gap-2 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                {isTestingLine ? 'กำลังส่งทดสอบ...' : 'ส่งข้อความทดสอบ'}
                <Send size={15} />
              </button>
              
              {testResult && (
                <span className={`text-xs font-semibold ${testResult.status === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {testResult.message}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveLineSettings}
              disabled={isSavingLine}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-70"
            >
              <Save size={16} />
              {isSavingLine ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า LINE Notify'}
            </button>
          </div>
        </div>
      </div>

      {/* Discord Webhook Integration Card */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mt-6">
        <div className="bg-[#5865F2] p-8 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl text-white">
              <Bell size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Discord Webhook Integration Settings</h2>
              <p className="text-[#E3E5E8] text-sm max-w-xl mt-1">
                ตั้งค่าระบบการแจ้งเตือนยอดการทำงาน สต็อกบาร์ ครัวเบเกอรี่ รายงานของเสีย และเมนู R&D ไปยังเซิร์ฟเวอร์ Discord
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Discord Webhook URL</span>
                  <a 
                    href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#5865F2] hover:text-[#4752C4] font-medium text-xs underline"
                  >
                    วิธีการสร้าง Webhook ↗
                  </a>
                </label>
                <input
                  type="password"
                  placeholder="กรอก Discord Webhook URL (https://discord.com/api/webhooks/...)"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5865F2] outline-none font-mono text-sm"
                  value={discordSettings.webhookUrl}
                  onChange={(e) => setDiscordSettings({ ...discordSettings, webhookUrl: e.target.value })}
                />
              </div>

              {/* Toggle Enable Notification Systems */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <h4 className="font-bold text-slate-800">เปิดใช้งาน Discord Notify</h4>
                  <p className="text-slate-500 text-xs mt-0.5">เปิดหรือปิดการแจ้งเตือนทั้งหมดของแอปพลิเคชัน</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={discordSettings.enabled}
                    onChange={(e) => setDiscordSettings({ ...discordSettings, enabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865F2]"></div>
                </label>
              </div>
            </div>

            {/* Guide Info */}
            <div className="bg-blue-50 text-blue-900 p-5 rounded-2xl border border-blue-200 text-xs space-y-2.5 self-start">
              <h5 className="font-bold flex items-center gap-1.5 text-blue-950">
                <AlertCircle size={14} /> วิธีการเชื่อมต่อ Discord Webhook
              </h5>
              <ol className="list-decimal list-inside space-y-1.5 text-blue-900 leading-relaxed">
                <li>ไปที่เซิร์ฟเวอร์ Discord ของคุณ (ต้องมีสิทธิ์จัดการเซิร์ฟเวอร์)</li>
                <li>คลิกขวาที่ช่องแชต(Channel) ที่ต้องการ เลือก <b>แก้ไขช่อง (Edit Channel)</b></li>
                <li>ไปที่เมนู <b>การผสานการทำงาน (Integrations)</b> แล้วคลิกที่ <b>เว็บฮุค (Webhooks)</b></li>
                <li>คลิก <b>สร้างเว็บฮุค (New Webhook)</b> เพื่อสร้างบอตตัวใหม่</li>
                <li>คัดลอก Webhook URL มาวางในช่องทางซ้ายมือ และกดบันทึกการตั้งค่า Discord Notify</li>
              </ol>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Bell size={18} className="text-[#5865F2]" />
              หัวข้อรายงานที่ต้องการส่งไป Discord (Notification Subscriptions)
            </h4>

            {/* Select Subscriptions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-[#5865F2] focus:ring-[#5865F2] w-4 h-4 cursor-pointer"
                  checked={discordSettings.notifyOnStockSubmit}
                  onChange={(e) => setDiscordSettings({ ...discordSettings, notifyOnStockSubmit: e.target.checked })}
                />
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">รายงานนับและส่งยอดคงเหลือสต็อก (Stock Submission)</h5>
                  <p className="text-slate-500 text-xs mt-1">ส่งสรุปสต็อกเมื่อพนักงานบันทึกยอดนับสต็อกบาร์และครัวประจำวัน</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-[#5865F2] focus:ring-[#5865F2] w-4 h-4 cursor-pointer"
                  checked={discordSettings.notifyOnReceiving}
                  onChange={(e) => setDiscordSettings({ ...discordSettings, notifyOnReceiving: e.target.checked })}
                />
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">การตรวจรับวัตถุดิบ (Raw Material Receiving)</h5>
                  <p className="text-slate-500 text-xs mt-1">ส่งความเคลื่อนไหวเมื่อมีการตรวจรับรับวัตถุดิบนำเข้า บาร์ หรือ ครัว</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-[#5865F2] focus:ring-[#5865F2] w-4 h-4 cursor-pointer"
                  checked={discordSettings.notifyOnChecklist}
                  onChange={(e) => setDiscordSettings({ ...discordSettings, notifyOnChecklist: e.target.checked })}
                />
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">เช็คลิสต์เตรียมความพร้อมเปิด-ปิดร้าน (Checklists)</h5>
                  <p className="text-slate-500 text-xs mt-1">ส่งรายงานผลการทำ Check-in / Check-out หรืองานเตรียมร้าน</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-[#5865F2] focus:ring-[#5865F2] w-4 h-4 cursor-pointer"
                  checked={discordSettings.notifyOnWaste}
                  onChange={(e) => setDiscordSettings({ ...discordSettings, notifyOnWaste: e.target.checked })}
                />
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">ของเสีย รายงานขยะ เมล็ดกาแฟสูญเสีย (Waste Logs)</h5>
                  <p className="text-slate-500 text-xs mt-1">ส่งรายงานขยะเมล็ดกาแฟและวัตถุดิบเสียจากฝ่ายบาร์และครัว</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-[#5865F2] focus:ring-[#5865F2] w-4 h-4 cursor-pointer"
                  checked={discordSettings.notifyOnRnD}
                  onChange={(e) => setDiscordSettings({ ...discordSettings, notifyOnRnD: e.target.checked })}
                />
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">การเทสสูตรและรายงานเมนูใหม่ (R&D Reports)</h5>
                  <p className="text-slate-500 text-xs mt-1">แชร์สูตรพัฒนา รสชาติ การประเมิน และแผนจำหน่ายเมนู R&D</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-[#5865F2] focus:ring-[#5865F2] w-4 h-4 cursor-pointer"
                  checked={discordSettings.notifyOnBakeryPlan}
                  onChange={(e) => setDiscordSettings({ ...discordSettings, notifyOnBakeryPlan: e.target.checked })}
                />
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">แผนการผลิตและยอดจัดจำหน่ายเบเกอรี่ (Bakery Plan)</h5>
                  <p className="text-slate-500 text-xs mt-1">ส่งสรุปการวางแผนเป้าหมายสัปดาห์ใหม่และยอดขายจริงท้ายสัปดาห์</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse md:flex-row md:items-center justify-between gap-4 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestDiscordNotify}
                disabled={isTestingDiscord || !discordSettings.webhookUrl}
                className="flex items-center gap-2 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                {isTestingDiscord ? 'กำลังส่งทดสอบ...' : 'ส่งข้อความทดสอบ'}
                <Send size={15} />
              </button>
              
              {discordTestResult && (
                <span className={`text-xs font-semibold ${discordTestResult.status === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {discordTestResult.message}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveDiscordSettings}
              disabled={isSavingDiscord}
              className="flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-70"
            >
              <Save size={16} />
              {isSavingDiscord ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า Discord Notify'}
            </button>
          </div>
        </div>
      </div>

      {/* Role Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Settings className="text-blue-600" />
                ตั้งค่า Role Permissions Template
              </h3>
              <button 
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <label className="block text-sm font-semibold text-slate-700 mb-2">เลือก Role ที่ต้องการบันทึกเทมเพลต</label>
              <select
                className="w-full md:w-1/2 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium shadow-sm"
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

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left bg-white text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="p-3 font-semibold w-full">ฟังก์ชัน</th>
                      <th className="p-3 font-semibold text-center w-20 cursor-pointer hover:text-slate-800" onClick={() => {
                        const newPerms = { ...templateForm };
                        APP_FUNCTIONS.forEach(f => newPerms[f.id] = 'Hidden');
                        setTemplateForm(newPerms);
                      }}>Hidden (All)</th>
                      <th className="p-3 font-semibold text-center w-20 cursor-pointer hover:text-slate-800" onClick={() => {
                        const newPerms = { ...templateForm };
                        APP_FUNCTIONS.forEach(f => newPerms[f.id] = 'Review');
                        setTemplateForm(newPerms);
                      }}>Review (All)</th>
                      <th className="p-3 font-semibold text-center w-20 cursor-pointer hover:text-slate-800" onClick={() => {
                        const newPerms = { ...templateForm };
                        APP_FUNCTIONS.forEach(f => newPerms[f.id] = 'Edit');
                        setTemplateForm(newPerms);
                      }}>Edit (All)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {APP_FUNCTIONS.map(func => (
                      <tr key={func.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-medium text-slate-800">{func.name}</td>
                        <td className="p-3 text-center">
                          <input 
                            type="radio" 
                            name={`tpl_perm_${func.id}`} 
                            checked={templateForm[func.id] === 'Hidden'}
                            onChange={() => setTemplateForm({ ...templateForm, [func.id]: 'Hidden' })}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input 
                            type="radio" 
                            name={`tpl_perm_${func.id}`} 
                            checked={templateForm[func.id] === 'Review'}
                            onChange={() => setTemplateForm({ ...templateForm, [func.id]: 'Review' })}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input 
                            type="radio" 
                            name={`tpl_perm_${func.id}`} 
                            checked={templateForm[func.id] === 'Edit'}
                            onChange={() => setTemplateForm({ ...templateForm, [func.id]: 'Edit' })}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex items-center justify-between gap-3 bg-white rounded-b-3xl">
              <span className="text-xs text-slate-500">
                เมื่อผู้ใช้เลือก Role นี้ในอนาคต สิทธิ์จะถูกปรับตามเทมเพลตนี้อัตโนมัติ
              </span>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsTemplateModalOpen(false)} 
                  className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-bold transition-colors"
                >
                  ปิด
                </button>
                <button 
                  type="button" 
                  onClick={handleSaveRoleTemplate}
                  disabled={isSavingTemplate}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
                >
                  <Save size={18} /> {isSavingTemplate ? 'กำลังบันทึก...' : `บันทึกเทมเพลต ${selectedTemplateRole}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

