import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, MapPin, ChevronDown, Database, Loader2, AlertTriangle, Coffee, Sparkles } from 'lucide-react';
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

export function LoginForm({ onLogin }: LoginFormProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | ''>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [infoModal, setInfoModal] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);

  // Supabase read-only connection status
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  // Supabase status listener (READ-ONLY)
  useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      setSupabaseStatus('disconnected');
      return;
    }

    setSupabaseStatus('connecting');

    // READ connection status via supabase.auth.getSession()
    supabase.auth.getSession()
      .then(({ error: sessionError }) => {
        if (!isMounted) return;
        if (sessionError) {
          console.warn('Supabase getSession status check:', sessionError);
          setSupabaseStatus('disconnected');
        } else {
          setSupabaseStatus('connected');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Supabase status check failed:', err);
        setSupabaseStatus('disconnected');
      });

    // Also observe connection state changes via onAuthStateChange
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      if (!isMounted) return;
      setSupabaseStatus('connected');
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Fetch users when a branch is selected
  useEffect(() => {
    if (!selectedBranch) {
      setUsers([]);
      return;
    }

    let isMounted = true;

    const fetchUsers = async () => {
      if (supabase) {
        try {
          const { data, error: queryError } = await supabase
            .from('app_users')
            .select('*')
            .eq('branch', selectedBranch);

          if (!isMounted) return;

          if (queryError) {
            console.warn('Supabase fetch users error:', queryError);
            loadFallbackUsers();
          } else if (data && data.length > 0) {
            setUsers(data as AppUser[]);
          } else {
            // Seed default users for this branch if empty
            const defaultUsers = [
              { name: 'Admin', role: 'Admin', password: 'Administrator', branch: selectedBranch },
              { name: 'Branch Manager', role: 'Branch Manager', password: '1234', branch: selectedBranch },
              { name: 'Barista', role: 'Barista', password: '1234', branch: selectedBranch }
            ];
            const { data: insertedUsers } = await supabase
              .from('app_users')
              .insert(defaultUsers)
              .select();

            if (!isMounted) return;

            if (insertedUsers && insertedUsers.length > 0) {
              setUsers(insertedUsers as AppUser[]);
            } else {
              loadFallbackUsers();
            }
          }
        } catch (err) {
          console.warn('Error querying users:', err);
          if (isMounted) loadFallbackUsers();
        }
      } else {
        loadFallbackUsers();
      }
    };

    const loadFallbackUsers = () => {
      const saved = localStorage.getItem(`cafe-app-users-${selectedBranch}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setUsers(parsed);
        } catch {
          setUsers([]);
        }
      } else {
        const defaultUsers: AppUser[] = [
          {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
            name: 'Admin',
            role: 'Admin',
            password: 'Administrator',
            branch: selectedBranch
          },
          {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
            name: 'Branch Manager',
            role: 'Branch Manager',
            password: '1234',
            branch: selectedBranch
          },
          {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
            name: 'Barista',
            role: 'Barista',
            password: '1234',
            branch: selectedBranch
          }
        ];
        setUsers(defaultUsers);
        localStorage.setItem(`cafe-app-users-${selectedBranch}`, JSON.stringify(defaultUsers));
      }
    };

    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, [selectedBranch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedBranch) {
      setError('กรุณาเลือกสาขา (Please select a branch)');
      return;
    }

    if (!username.trim()) {
      setError('กรุณากรอกหรือเลือกชื่อผู้ใช้ (Please enter username)');
      return;
    }

    if (!password) {
      setError('กรุณากรอกรหัสผ่าน (Please enter password)');
      return;
    }

    setIsSubmitting(true);

    const query = username.trim().toLowerCase();
    const matchedUser = users.find(
      (u) =>
        u.name.toLowerCase() === query ||
        u.role.toLowerCase() === query ||
        `${u.name} (${u.role})`.toLowerCase() === query ||
        u.id === username.trim()
    );

    if (!matchedUser) {
      setError('ไม่พบบัญชีผู้ใช้ในสาขานี้ (User not found in this branch)');
      setIsSubmitting(false);
      return;
    }

    if (matchedUser.password === password) {
      if (rememberMe) {
        localStorage.setItem('crenn-last-branch', selectedBranch);
        localStorage.setItem('crenn-last-username', matchedUser.name);
      }
      onLogin({
        name: matchedUser.name,
        role: matchedUser.role,
        permissions: matchedUser.permissions,
        branch: selectedBranch
      });
    } else {
      setError('รหัสผ่านไม่ถูกต้อง (Invalid password)');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full font-sans select-none overflow-x-hidden bg-gradient-to-b from-[#C5D5D3] to-[#7A9E9C] md:bg-white xl:bg-[#EEF4F3] xl:flex xl:items-center xl:justify-center xl:p-8">
      
      {/* Outer Card Frame for Wide PC (xl: 1440px+) */}
      <div className="w-full xl:max-w-[1280px] min-h-screen xl:min-h-[760px] xl:max-h-[920px] xl:rounded-[32px] xl:shadow-[0_20px_60px_rgba(45,74,73,0.12)] xl:overflow-hidden flex flex-col md:flex-row bg-white">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* TABLET / PC: LEFT BRAND PANEL (md: 45%, lg: 40%) */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="hidden md:flex md:w-[45%] lg:w-[40%] bg-gradient-to-b from-[#2D4A49] to-[#3D6B69] text-white flex-col justify-between p-8 lg:p-12 xl:p-14 relative overflow-hidden shrink-0 shadow-[4px_0_16px_rgba(0,0,0,0.12)]">
          {/* Background decorative watermark */}
          <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-white/5 pointer-events-none blur-2xl"></div>
          <div className="absolute -left-12 -bottom-12 w-64 h-64 rounded-full bg-[#7A9E9C]/20 pointer-events-none blur-xl"></div>

          {/* Top brand header */}
          <div className="flex items-center gap-2 z-10">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Coffee size={18} className="text-white" />
            </div>
            <span className="text-white/80 text-xs font-semibold tracking-wider uppercase">
              CRENN Management
            </span>
          </div>

          {/* Center brand content */}
          <div className="flex flex-col items-center text-center my-auto py-8 z-10">
            {/* Decorative teal circle shape */}
            <div className="w-24 h-24 lg:w-28 lg:h-28 rounded-full bg-[#7A9E9C]/25 border border-white/20 flex items-center justify-center mb-6 shadow-lg backdrop-blur-md relative">
              <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-white flex items-center justify-center shadow-md">
                <User size={36} className="text-[#5A8A88]" strokeWidth={2.4} />
              </div>
              <Sparkles size={16} className="text-[#C5D5D3] absolute top-2 right-2 animate-pulse" />
            </div>

            <h1 className="text-white font-black tracking-[0.25em] text-[48px] lg:text-[56px] xl:text-[64px] uppercase leading-none drop-shadow-sm">
              CRENN
            </h1>
            <p className="text-white/80 font-medium text-[16px] lg:text-[18px] tracking-wide mt-3 max-w-[280px] lg:max-w-[320px]">
              Cafe Management System
            </p>
            <div className="w-12 h-1 bg-[#C5D5D3] rounded-full mt-4 opacity-75"></div>
          </div>

          {/* Supabase status at bottom of left panel */}
          <div className="z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/80 font-medium">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-white/80" />
              <span>Database Status</span>
            </div>

            <div className="flex items-center gap-1.5">
              {supabaseStatus === 'connected' && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
                  </span>
                  <span className="text-[11px] font-semibold text-white tracking-wide">Connected</span>
                </>
              )}
              {supabaseStatus === 'connecting' && (
                <>
                  <Loader2 size={12} className="animate-spin text-[#EAB308]" />
                  <span className="text-[11px] font-semibold text-[#EAB308] tracking-wide">Connecting...</span>
                </>
              )}
              {supabaseStatus === 'disconnected' && (
                <>
                  <span className="inline-flex rounded-full h-2 w-2 bg-[#EF4444]"></span>
                  <span className="text-[11px] font-semibold text-red-300 tracking-wide">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* RIGHT PANEL (TABLET/PC: 55%/60%) OR FULL MOBILE VIEW */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="w-full md:w-[55%] lg:w-[60%] min-h-screen xl:min-h-0 flex flex-col justify-between items-center bg-gradient-to-b from-[#C5D5D3] to-[#7A9E9C] md:bg-white lg:bg-[#F7FAFA] relative lg:py-10 xl:p-12">
          
          {/* Main form card container */}
          <div className="w-full max-w-[360px] md:max-w-[420px] lg:max-w-[460px] xl:max-w-[480px] h-full flex flex-col justify-between items-center px-6 pt-8 pb-20 md:py-10 lg:p-10 xl:p-12 lg:bg-white lg:rounded-[24px] lg:shadow-[0_8px_32px_rgba(45,74,73,0.08)] my-auto z-10 transition-all">
            
            {/* HEADER SECTION (Mobile: Top Brand | Tablet/PC: Centered Login Label) */}
            <div className="w-full flex flex-col items-center shrink-0 mb-4 md:mb-6">
              {/* Mobile Brand Name — CRENN (32px, bold, white, tracking wide) */}
              <h1 className="md:hidden text-white text-center font-bold uppercase leading-none tracking-[0.25em] text-[32px] mb-2 drop-shadow-xs">
                CRENN
              </h1>

              {/* White Circle Avatar */}
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white md:bg-[#E8F3F2] rounded-full flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.06)] md:shadow-inner mb-3 transition-all">
                <User size={32} className="text-[#7A9E9C] md:text-[#5A8A88]" strokeWidth={2.4} />
              </div>

              {/* Section Label — MEMBER LOGIN */}
              <h2 className="text-white md:text-[#2D4A49] font-bold uppercase text-center tracking-[0.18em] text-[14px] md:text-[16px] leading-tight">
                MEMBER LOGIN
              </h2>
              <p className="hidden md:block text-[#6B8F8E] text-[13px] font-medium mt-1">
                เข้าสู่ระบบเพื่อจัดการสต็อกและวัตถุดิบ
              </p>
            </div>

            {/* FORM FIELDS (Branch -> Username -> Password) */}
            <form onSubmit={handleSubmit} className="w-full space-y-3.5 my-auto py-1">
              
              {/* Field 1: Branch Dropdown */}
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MapPin size={18} className="text-[#7A9E9C] md:text-[#5A8A88] shrink-0" />
                </div>
                <select
                  value={selectedBranch}
                  onChange={(e) => {
                    setSelectedBranch(e.target.value as Branch);
                    setUsername('');
                    setError('');
                    setShowUserDropdown(false);
                  }}
                  className="w-full pl-11 pr-11 h-[48px] xl:h-[52px] rounded-full bg-white/85 md:bg-slate-50 text-slate-800 md:text-[#2D4A49] border border-white/60 md:border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A9E9C]/30 focus:border-[#7A9E9C] text-[15px] xl:text-[16px] font-medium transition-all appearance-none cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                >
                  <option value="" disabled className="text-slate-400">
                    Select Branch / เลือกสาขา
                  </option>
                  <option value="Rayong" className="text-slate-800">
                    📍 สาขาระยอง (Rayong Branch)
                  </option>
                  <option value="Bangkok" className="text-slate-800">
                    📍 สาขากรุงเทพฯ (Bangkok Branch)
                  </option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#7A9E9C] md:text-[#5A8A88]">
                  <ChevronDown size={18} />
                </div>
              </div>

              {/* Field 2: Username */}
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={18} className="text-[#7A9E9C] md:text-[#5A8A88] shrink-0" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  onFocus={() => {
                    if (users.length > 0) setShowUserDropdown(true);
                  }}
                  placeholder="Username"
                  list="users-suggestions"
                  autoComplete="off"
                  className="w-full pl-11 pr-11 h-[48px] xl:h-[52px] rounded-full bg-white/85 md:bg-slate-50 text-slate-800 md:text-[#2D4A49] placeholder-slate-400 md:placeholder-slate-400/80 border border-white/60 md:border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A9E9C]/30 focus:border-[#7A9E9C] text-[15px] xl:text-[16px] font-medium transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                />
                {users.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#7A9E9C] md:text-[#5A8A88] hover:opacity-80 focus:outline-none transition-colors"
                    title="Select user"
                  >
                    <ChevronDown size={18} className={`transition-transform duration-200 ${showUserDropdown ? 'rotate-180' : ''}`} />
                  </button>
                )}

                <datalist id="users-suggestions">
                  {users.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.role}
                    </option>
                  ))}
                </datalist>

                {/* Quick dropdown for user selection */}
                {showUserDropdown && users.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] bg-white rounded-2xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto py-1 divide-y divide-slate-100">
                    {users.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setUsername(u.name);
                          setShowUserDropdown(false);
                          setError('');
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#F0F5F4] flex items-center justify-between text-xs text-slate-800 transition-colors"
                      >
                        <span className="font-semibold text-slate-800">{u.name}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-[#5A8A88] font-medium">
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Field 3: Password */}
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={18} className="text-[#7A9E9C] md:text-[#5A8A88] shrink-0" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  className="w-full pl-11 pr-11 h-[48px] xl:h-[52px] rounded-full bg-white/85 md:bg-slate-50 text-slate-800 md:text-[#2D4A49] placeholder-slate-400 border border-white/60 md:border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A9E9C]/30 focus:border-[#7A9E9C] text-[15px] xl:text-[16px] font-medium tracking-wider transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#7A9E9C] md:text-[#5A8A88] hover:opacity-80 focus:outline-none transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Row below fields: Remember me + Forgot password */}
              <div className="flex items-center justify-between px-2 pt-0.5 text-[12px] md:text-[13px]">
                {/* Left: Remember me checkbox */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-white md:text-[#2D4A49]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border border-white/70 md:border-slate-300 text-[#5A8A88] focus:ring-0 focus:ring-offset-0 bg-white/30 md:bg-white cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>

                {/* Right: Forgot password link */}
                <button
                  type="button"
                  onClick={() =>
                    setInfoModal(
                      'กรุณาติดต่อผู้ดูแลระบบ (Admin) หรือผู้จัดการสาขาเพื่อขอรีเซ็ตรหัสผ่าน\n\nPlease contact Admin or Branch Manager to reset password.'
                    )
                  }
                  className="text-white md:text-[#5A8A88] hover:underline font-medium focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-rose-600 bg-white md:bg-rose-50 border border-rose-200 text-xs font-semibold py-2 px-4 rounded-full text-center shadow-xs animate-pulse">
                  {error}
                </div>
              )}

              {/* LOGIN BUTTON */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-[48px] xl:h-[52px] px-6 rounded-full bg-white md:bg-[#5A8A88] text-[#5A8A88] md:text-white font-bold text-[15px] xl:text-[16px] shadow-[0_6px_20px_rgba(90,138,136,0.35)] hover:shadow-[0_8px_24px_rgba(90,138,136,0.45)] hover:bg-white/95 md:hover:bg-[#4a7573] active:scale-[0.99] transition-all duration-200 focus:outline-none cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? 'Logging in...' : 'Login'}
                </button>
              </div>
            </form>

            {/* FOOTER */}
            <div className="w-full flex flex-col items-center gap-1.5 shrink-0 mt-4">
              <span className="text-white md:text-[#6B8F8E] text-[13px] font-normal tracking-wide">
                Not a member?
              </span>
              <button
                type="button"
                onClick={() =>
                  setInfoModal(
                    'กรุณาติดต่อฝ่ายบุคคลหรือผู้จัดการเพื่อขอรับสิทธิ์เข้าใช้งานระบบ\n\nPlease contact HR or Branch Manager to request an account.'
                  )
                }
                className="border border-white md:border-[#5A8A88] text-white md:text-[#5A8A88] bg-transparent rounded-full px-6 py-2 text-[13px] font-semibold hover:bg-white/10 md:hover:bg-[#E8F3F2] active:scale-95 transition-all focus:outline-none tracking-wide cursor-pointer"
              >
                Create account
              </button>
            </div>

          </div>

          {/* MOBILE ONLY: SUPABASE STATUS BAR (bottom-most, fixed) */}
          <aside
            aria-label="Database Status"
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center bg-black/25 backdrop-blur-md border-t border-white/10 py-2 px-4"
          >
            <div className="flex items-center gap-1.5 text-white text-[11px] font-medium tracking-wide">
              <Database size={12} className="text-white shrink-0 mr-1" />

              {supabaseStatus === 'connected' && (
                <>
                  <span className="relative flex h-2 w-2 mr-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E] shadow-[0_0_8px_#22C55E]"></span>
                  </span>
                  <span>Supabase &nbsp;●&nbsp; Connected</span>
                </>
              )}

              {supabaseStatus === 'connecting' && (
                <>
                  <Loader2 size={12} className="animate-spin text-[#EAB308] mr-1 shrink-0" />
                  <span className="relative flex h-2 w-2 mr-1">
                    <span className="inline-flex rounded-full h-2 w-2 bg-[#EAB308] animate-pulse"></span>
                  </span>
                  <span>Supabase &nbsp;●&nbsp; Connecting...</span>
                </>
              )}

              {supabaseStatus === 'disconnected' && (
                <>
                  <span className="inline-flex rounded-full h-2 w-2 bg-[#EF4444] shadow-[0_0_8px_#EF4444] mr-1 shrink-0"></span>
                  <AlertTriangle size={12} className="text-red-300 mr-1 shrink-0" />
                  <span>Supabase &nbsp;●&nbsp; Disconnected</span>
                </>
              )}
            </div>
          </aside>

          {/* Info Modal / Notice Popup for Forgot Password / Create Account */}
          {infoModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
              <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center mx-auto">
                  <User size={24} />
                </div>
                <div className="text-slate-700 text-xs font-medium whitespace-pre-line leading-relaxed">
                  {infoModal}
                </div>
                <button
                  type="button"
                  onClick={() => setInfoModal(null)}
                  className="w-full py-2.5 px-4 rounded-full bg-[#5A8A88] text-white font-semibold text-xs hover:bg-[#4a7573] transition-colors focus:outline-none cursor-pointer"
                >
                  รับทราบ (OK)
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
