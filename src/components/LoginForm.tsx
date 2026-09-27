import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, MapPin, ChevronDown, Check, X, ShieldAlert, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppUser as TypesAppUser, AppPermissions, Branch } from '../types';

export type UserRole =
  | 'Admin'
  | 'Owner'
  | 'Co-founder'
  | 'Branch Manager'
  | 'Head Baker'
  | 'Senior Baker'
  | 'Junior Baker'
  | 'Barista'
  | 'Barista Assistance'
  | 'Cashier'
  | 'Server/Runner'
  | 'Dishwasher/Cleaner';

interface AppUser extends TypesAppUser {
  role: UserRole;
}

interface LoginFormProps {
  onLogin: (user: { name: string; role: UserRole; permissions?: AppPermissions; branch: Branch }) => void;
}

const BRANCH_OPTIONS: { id: Branch; label: string; subLabel: string }[] = [
  { id: 'Rayong', label: '📍 สาขาระยอง', subLabel: 'Rayong Branch' },
  { id: 'Bangkok', label: '📍 สาขากรุงเทพฯ', subLabel: 'Bangkok Branch' },
];

export function LoginForm({ onLogin }: LoginFormProps) {
  // Stored branch session/state
  const [selectedBranch, setSelectedBranch] = useState<Branch | ''>(() => {
    const saved = sessionStorage.getItem('crenn_selected_branch') || localStorage.getItem('crenn_selected_branch');
    if (saved === 'Rayong' || saved === 'Bangkok') return saved;
    return '';
  });

  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('crenn_remembered_username') || '';
  });
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    return localStorage.getItem('crenn_remember_me') === 'true';
  });

  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  // Check Supabase connection
  useEffect(() => {
    let isMounted = true;
    const checkConnection = async () => {
      if (!supabase) {
        if (isMounted) setSupabaseStatus('disconnected');
        return;
      }
      try {
        const { error } = await supabase.from('app_users').select('id').limit(1);
        if (isMounted) {
          if (!error || error.code === 'PGRST116' || error.code === '42P01') {
            setSupabaseStatus('connected');
          } else {
            // Still reachable if response came back
            setSupabaseStatus(error.message?.includes('Failed to fetch') ? 'disconnected' : 'connected');
          }
        }
      } catch (err) {
        if (isMounted) setSupabaseStatus('disconnected');
      }
    };
    checkConnection();
    return () => {
      isMounted = false;
    };
  }, []);

  // Modals / Bottom sheets
  const [isBranchSheetOpen, setIsBranchSheetOpen] = useState<boolean>(false);
  const [showUserSuggestions, setShowUserSuggestions] = useState<boolean>(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState<boolean>(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState<boolean>(false);

  // Create account form state
  const [newName, setNewName] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('Barista');
  const [newPassword, setNewPassword] = useState<string>('');
  const [createAccountMsg, setCreateAccountMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Fetch users whenever selected branch changes
  useEffect(() => {
    if (!selectedBranch) {
      setUsers([]);
      return;
    }

    // Persist branch selection in session & local storage
    sessionStorage.setItem('crenn_selected_branch', selectedBranch);
    localStorage.setItem('crenn_selected_branch', selectedBranch);

    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      if (supabase) {
        try {
          const { data, error: supaErr } = await supabase
            .from('app_users')
            .select('*')
            .eq('branch', selectedBranch);

          if (supaErr) {
            console.warn('Supabase fetch user error:', supaErr);
            loadFallbackUsers(selectedBranch);
          } else if (data && data.length > 0) {
            setUsers(data as AppUser[]);
          } else {
            // Seed defaults for branch
            const defaultUsers = [
              { name: 'Admin', role: 'Admin', password: 'Administrator', branch: selectedBranch },
              { name: 'Branch Manager', role: 'Branch Manager', password: '1234', branch: selectedBranch },
              { name: 'Barista', role: 'Barista', password: '1234', branch: selectedBranch },
            ];
            const { data: insertedUsers } = await supabase.from('app_users').insert(defaultUsers).select();
            if (insertedUsers && insertedUsers.length > 0) {
              setUsers(insertedUsers as AppUser[]);
            } else {
              loadFallbackUsers(selectedBranch);
            }
          }
        } catch (e) {
          console.warn('Error querying users:', e);
          loadFallbackUsers(selectedBranch);
        }
      } else {
        loadFallbackUsers(selectedBranch);
      }
      setIsLoadingUsers(false);
    };

    const loadFallbackUsers = (branch: Branch) => {
      const saved = localStorage.getItem(`cafe-app-users-${branch}`);
      if (saved) {
        try {
          setUsers(JSON.parse(saved));
          return;
        } catch (e) {
          console.warn('Parse fallback users error', e);
        }
      }
      const defaultUsers: AppUser[] = [
        {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'user-admin',
          name: 'Admin',
          role: 'Admin',
          password: 'Administrator',
          branch,
        },
        {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'user-mgr',
          name: 'Branch Manager',
          role: 'Branch Manager',
          password: '1234',
          branch,
        },
        {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'user-barista',
          name: 'Barista',
          role: 'Barista',
          password: '1234',
          branch,
        },
      ];
      setUsers(defaultUsers);
      localStorage.setItem(`cafe-app-users-${branch}`, JSON.stringify(defaultUsers));
    };

    fetchUsers();
  }, [selectedBranch]);

  // Validation: Login button activates only after all 3 fields are filled
  const isFormValid = Boolean(selectedBranch !== '' && username.trim() !== '' && password.trim() !== '');

  const handleSelectBranch = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsBranchSheetOpen(false);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedBranch) {
      setError('กรุณาเลือกสาขา (Please select a branch)');
      return;
    }

    if (!username.trim()) {
      setError('กรุณากรอก Username (Please enter username)');
      return;
    }

    if (!password) {
      setError('กรุณากรอกรหัสผ่าน (Please enter password)');
      return;
    }

    setIsSubmitting(true);

    // Save or clear remembered username
    if (rememberMe) {
      localStorage.setItem('crenn_remember_me', 'true');
      localStorage.setItem('crenn_remembered_username', username.trim());
    } else {
      localStorage.removeItem('crenn_remember_me');
      localStorage.removeItem('crenn_remembered_username');
    }

    // Match user by name (case-insensitive) or match directly
    const trimmedInput = username.trim().toLowerCase();
    const matchedUser = users.find(
      (u) =>
        u.name.trim().toLowerCase() === trimmedInput ||
        u.id.toLowerCase() === trimmedInput ||
        `${u.name.toLowerCase()} (${u.role.toLowerCase()})` === trimmedInput
    );

    if (!matchedUser) {
      setError('ไม่พบชื่อผู้ใช้นี้ในระบบสาขาที่เลือก (Username not found in selected branch)');
      setIsSubmitting(false);
      return;
    }

    if (matchedUser.password === password) {
      onLogin({
        name: matchedUser.name,
        role: matchedUser.role,
        permissions: matchedUser.permissions,
        branch: selectedBranch,
      });
    } else {
      setError('รหัสผ่านไม่ถูกต้อง (Invalid password)');
      setIsSubmitting(false);
    }
  };

  // Quick account creation handler
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAccountMsg(null);

    const targetBranch = selectedBranch || 'Rayong';
    if (!newName.trim() || !newPassword.trim()) {
      setCreateAccountMsg({ type: 'error', text: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
      return;
    }

    const newUserObj: AppUser = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10),
      name: newName.trim(),
      role: newRole,
      password: newPassword.trim(),
      branch: targetBranch,
    };

    if (supabase) {
      const { data, error: insertErr } = await supabase.from('app_users').insert([newUserObj]).select();
      if (insertErr) {
        console.warn('Create user error in Supabase, using localStorage:', insertErr);
      } else if (data && data.length > 0) {
        newUserObj.id = data[0].id;
      }
    }

    // Update state and local storage
    const updated = [...users, newUserObj];
    setUsers(updated);
    localStorage.setItem(`cafe-app-users-${targetBranch}`, JSON.stringify(updated));

    if (!selectedBranch) {
      setSelectedBranch(targetBranch);
    }
    setUsername(newUserObj.name);
    setPassword(newPassword.trim());
    setCreateAccountMsg({ type: 'success', text: `สร้างบัญชี "${newUserObj.name}" สำเร็จ!` });

    setTimeout(() => {
      setIsCreateAccountOpen(false);
      setCreateAccountMsg(null);
      setNewName('');
      setNewPassword('');
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-0 sm:p-4 bg-gradient-to-b from-[#C5D5D3] to-[#7A9E9C] font-sans antialiased selection:bg-white/30 selection:text-[#2D4A49]">
      {/* Mobile container (375x812 proportion or responsive full view) */}
      <div className="w-full max-w-[390px] min-h-screen sm:min-h-[790px] sm:max-h-[850px] sm:rounded-[40px] bg-gradient-to-b from-[#C5D5D3] to-[#7A9E9C] sm:shadow-2xl sm:shadow-[#436765]/35 sm:border sm:border-white/30 flex flex-col justify-between p-6 sm:p-7 relative overflow-hidden">
        
        {/* Subtle decorative background glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-white/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        {/* HEADER SECTION (top to bottom order) */}
        <div className="flex flex-col items-center pt-2 sm:pt-4 z-10">
          {/* 1. Brand Name — "CRENN" */}
          <h1 className="text-black text-[38px] sm:text-[42px] font-black tracking-widest text-center select-none leading-none">
            CRENN
          </h1>

          {/* 2. White Circle Avatar */}
          <div className="w-[84px] h-[84px] rounded-full bg-white flex items-center justify-center shadow-lg shadow-[#5A8A88]/20 my-4 sm:my-5 transition-transform hover:scale-105 duration-300">
            <User className="w-11 h-11 text-[#7A9E9C]" strokeWidth={1.8} />
          </div>

          {/* 3. Section Label — "MEMBER LOGIN" */}
          <h2 className="text-black text-[15px] font-bold tracking-[0.18em] uppercase text-center">
            MEMBER LOGIN
          </h2>
        </div>

        {/* FORM SECTION */}
        <form onSubmit={handleSubmit} className="w-full space-y-3.5 my-auto py-2 z-10">
          {/* Field 1: Branch Dropdown Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsBranchSheetOpen(true)}
              className="w-full h-[52px] px-5 rounded-full bg-white/85 backdrop-blur-md flex items-center justify-between shadow-sm border border-white/40 hover:bg-white/95 focus:outline-none focus:ring-2 focus:ring-white/60 transition-all text-left group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <MapPin className="w-5 h-5 text-[#7A9E9C] shrink-0" strokeWidth={2} />
                {selectedBranch ? (
                  <span className="text-[#5A8A88] font-bold text-[14px] truncate">
                    {selectedBranch === 'Rayong' ? '📍 สาขาระยอง (Rayong Branch)' : '📍 สาขากรุงเทพฯ (Bangkok Branch)'}
                  </span>
                ) : (
                  <span className="text-gray-400 font-normal text-[14px] truncate">
                    Select Branch / เลือกสาขา
                  </span>
                )}
              </div>
              <ChevronDown className="w-5 h-5 text-[#7A9E9C] shrink-0 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>

          {/* Field 2: Username input */}
          <div className="relative">
            <div className="w-full h-[52px] px-5 rounded-full bg-white/85 backdrop-blur-md flex items-center gap-3 shadow-sm border border-white/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-white/60 transition-all">
              <User className="w-5 h-5 text-[#7A9E9C] shrink-0" strokeWidth={2} />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                onFocus={() => {
                  if (users.length > 0) setShowUserSuggestions(true);
                }}
                placeholder="Username"
                className="w-full bg-transparent outline-none text-[#2D4A49] font-medium text-[14px] placeholder:text-gray-400"
                autoCapitalize="none"
                autoComplete="username"
              />
              {users.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUserSuggestions(!showUserSuggestions)}
                  className="p-1 text-[#7A9E9C] hover:text-[#5A8A88] transition-colors focus:outline-none"
                  title="รายชื่อผู้ใช้ในสาขา"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showUserSuggestions ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* Quick user suggestions popover */}
            {showUserSuggestions && users.length > 0 && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowUserSuggestions(false)}
                />
                <div className="absolute left-0 right-0 top-[58px] z-30 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-white/60 p-2 max-h-48 overflow-y-auto scrollbar-thin animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold text-[#7A9E9C] uppercase tracking-wider">
                    <span>สมาชิกในสาขา ({selectedBranch || 'All'})</span>
                    <button
                      type="button"
                      onClick={() => setShowUserSuggestions(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setUsername(u.name);
                        setShowUserSuggestions(false);
                        setError('');
                      }}
                      className="w-full px-3 py-2 text-left rounded-xl hover:bg-[#C5D5D3]/35 transition-colors flex items-center justify-between text-xs text-[#2D4A49]"
                    >
                      <span className="font-semibold">{u.name}</span>
                      <span className="text-[10px] text-[#5A8A88] bg-[#C5D5D3]/40 px-2 py-0.5 rounded-full font-medium">
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Field 3: Password input */}
          <div className="w-full h-[52px] px-5 rounded-full bg-white/85 backdrop-blur-md flex items-center gap-3 shadow-sm border border-white/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-white/60 transition-all">
            <Lock className="w-5 h-5 text-[#7A9E9C] shrink-0" strokeWidth={2} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="••••••••••"
              className="w-full bg-transparent outline-none text-[#2D4A49] font-medium text-[14px] placeholder:text-gray-400 tracking-[0.15em]"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="p-1 text-[#7A9E9C] hover:text-[#5A8A88] transition-colors focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" strokeWidth={2} />
              ) : (
                <Eye className="w-5 h-5" strokeWidth={2} />
              )}
            </button>
          </div>

          {/* Below fields row: Remember me (Left) & Forgot password (Right) */}
          <div className="flex items-center justify-between px-2 pt-0.5 text-[12px] text-white">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-[#5A8A88] focus:ring-0 focus:ring-offset-0 border-white/60 bg-white/30 cursor-pointer accent-[#5A8A88]"
              />
              <span className="font-normal text-white drop-shadow-sm group-hover:text-white/90">
                Remember me
              </span>
            </label>
            <button
              type="button"
              onClick={() => setIsForgotPasswordOpen(true)}
              className="text-white hover:underline drop-shadow-sm font-normal text-[12px] cursor-pointer"
            >
              Forgot password?
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-4 py-2.5 rounded-full bg-rose-500/20 backdrop-blur-md border border-rose-200/40 text-white text-[12px] text-center font-medium shadow-sm animate-in fade-in duration-200">
              {error}
            </div>
          )}

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className={`w-full h-[52px] rounded-full font-bold text-[16px] tracking-wide transition-all duration-200 flex items-center justify-center ${
              isFormValid
                ? 'bg-white text-[#5A8A88] shadow-lg shadow-[#5A8A88]/30 hover:shadow-xl hover:shadow-[#5A8A88]/40 hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                : 'bg-white/60 text-[#5A8A88]/40 cursor-not-allowed shadow-none'
            }`}
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* FOOTER */}
        <div className="flex flex-col items-center gap-2 pb-1 pt-2 z-10">
          <span className="text-white text-[13px] font-medium drop-shadow-sm">
            Not a member?
          </span>
          <button
            type="button"
            onClick={() => setIsCreateAccountOpen(true)}
            className="w-full h-[48px] rounded-full border border-white text-white font-medium text-[14px] hover:bg-white/10 active:bg-white/20 transition-all flex items-center justify-center cursor-pointer select-none"
          >
            Create account
          </button>

          {/* SUPABASE CONNECTION STATUS (Bottom-most line) */}
          <div className="pt-2 flex items-center justify-center gap-2">
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                supabaseStatus === 'connected'
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : supabaseStatus === 'checking'
                  ? 'bg-amber-300 animate-pulse'
                  : 'bg-rose-400'
              }`}
            />
            <span className="text-[11px] font-semibold tracking-wider text-white/90 drop-shadow-xs uppercase">
              {supabaseStatus === 'connected'
                ? 'SUPABASE CONNECTED'
                : supabaseStatus === 'checking'
                ? 'CONNECTING TO SUPABASE...'
                : 'SUPABASE DISCONNECTED'}
            </span>
          </div>
        </div>
      </div>

      {/* BRANCH DROPDOWN BOTTOM SHEET / MODAL */}
      {isBranchSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsBranchSheetOpen(false)}
          />
          <div className="relative w-full max-w-[390px] bg-white rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl z-10 animate-in slide-in-from-bottom duration-250">
            {/* Handle bar on mobile */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[17px] font-bold text-[#2D4A49]">Select Branch / เลือกสาขา</h3>
                <p className="text-[12px] text-gray-500">เลือกสาขาประจำการเพื่อเข้าสู่ระบบงาน</p>
              </div>
              <button
                type="button"
                onClick={() => setIsBranchSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {BRANCH_OPTIONS.map((branch) => {
                const isSelected = selectedBranch === branch.id;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => handleSelectBranch(branch.id)}
                    className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-[#5A8A88] bg-[#C5D5D3]/25 shadow-sm'
                        : 'border-gray-200 hover:border-[#7A9E9C] hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isSelected ? 'bg-[#5A8A88] text-white' : 'bg-gray-100 text-[#7A9E9C]'
                        }`}
                      >
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <div className={`font-bold text-[15px] ${isSelected ? 'text-[#5A8A88]' : 'text-gray-800'}`}>
                          {branch.label}
                        </div>
                        <div className="text-xs text-gray-500">{branch.subLabel}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#5A8A88] flex items-center justify-center text-white">
                        <Check className="w-4 h-4" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>CRENN Artisan Bakery &amp; Cafe</span>
              <span>2 Active Branches</span>
            </div>
          </div>
        </div>
      )}

      {/* FORGOT PASSWORD MODAL */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsForgotPasswordOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#C5D5D3]/40 flex items-center justify-center text-[#5A8A88]">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-[16px] text-[#2D4A49]">ลืมรหัสผ่าน?</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              หากลืมรหัสผ่านหรือเข้าสู่ระบบไม่ได้ โปรดติดต่อผู้จัดการสาขา (Branch Manager) หรือ Admin เพื่อรีเซ็ตรหัสผ่านของคุณ
            </p>

            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 mb-5 space-y-1.5 text-xs">
              <div className="font-semibold text-[#5A8A88]">Default Logins (หากยังไม่ได้เปลี่ยน):</div>
              <div className="flex justify-between text-gray-600">
                <span>Branch Manager:</span>
                <span className="font-mono font-medium">1234</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Barista:</span>
                <span className="font-mono font-medium">1234</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Admin:</span>
                <span className="font-mono font-medium">Administrator</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsForgotPasswordOpen(false)}
              className="w-full h-11 rounded-full bg-[#5A8A88] text-white font-bold text-xs hover:bg-[#4A7270] transition-colors"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}

      {/* CREATE ACCOUNT MODAL */}
      {isCreateAccountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsCreateAccountOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#C5D5D3]/40 flex items-center justify-center text-[#5A8A88]">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[16px] text-[#2D4A49]">Create Account</h3>
                  <p className="text-[11px] text-gray-500">สร้างบัญชีผู้ใช้ใหม่สำหรับสาขา</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateAccountOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Branch (สาขา)</label>
                <select
                  value={selectedBranch || 'Rayong'}
                  onChange={(e) => setSelectedBranch(e.target.value as Branch)}
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium text-gray-800 outline-none focus:ring-2 focus:ring-[#5A8A88]/30"
                >
                  <option value="Rayong">📍 สาขาระยอง (Rayong Branch)</option>
                  <option value="Bangkok">📍 สาขากรุงเทพฯ (Bangkok Branch)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Username / Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="เช่น Somchai, Barista Beam"
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-[#5A8A88]/30 placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Role (ตำแหน่งงาน)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium text-gray-800 outline-none focus:ring-2 focus:ring-[#5A8A88]/30"
                >
                  <option value="Barista">Barista</option>
                  <option value="Senior Baker">Senior Baker</option>
                  <option value="Junior Baker">Junior Baker</option>
                  <option value="Head Baker">Head Baker</option>
                  <option value="Branch Manager">Branch Manager</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Server/Runner">Server/Runner</option>
                  <option value="Dishwasher/Cleaner">Dishwasher/Cleaner</option>
                  <option value="Admin">Admin</option>
                  <option value="Owner">Owner</option>
                  <option value="Co-founder">Co-founder</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="กำหนดรหัสผ่าน"
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-[#5A8A88]/30 placeholder:text-gray-400"
                />
              </div>

              {createAccountMsg && (
                <div
                  className={`p-2.5 rounded-xl text-center text-xs font-medium ${
                    createAccountMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {createAccountMsg.text}
                </div>
              )}

              <button
                type="submit"
                className="w-full h-11 rounded-full bg-[#5A8A88] text-white font-bold text-xs hover:bg-[#4A7270] transition-colors mt-2"
              >
                บันทึกสร้างบัญชี
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
