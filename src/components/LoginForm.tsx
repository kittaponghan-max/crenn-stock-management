import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, MapPin, ChevronDown, Database, Loader2, AlertTriangle, X } from 'lucide-react';
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
    <div
      className="h-[100dvh] w-full flex flex-col justify-between items-center relative overflow-hidden font-sans select-none"
      style={{
        background: 'linear-gradient(180deg, #C5D5D3 0%, #7A9E9C 100%)'
      }}
    >
      {/* Centered Mobile Container (Fitted within 1 viewport, 375x812 ratio or smaller screens) */}
      <div className="w-full max-w-[375px] h-full flex flex-col justify-between items-center px-6 pt-5 pb-14 mx-auto z-10">
        
        {/* HEADER SECTION (top to bottom) */}
        <div className="w-full flex flex-col items-center shrink-0">
          {/* 1. Brand Name — CRENN */}
          <h1
            className="text-black text-center font-black uppercase leading-none tracking-[0.25em]"
            style={{
              fontSize: 'clamp(28px, 6vh, 38px)',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}
          >
            CRENN
          </h1>

          {/* 2. White Circle Avatar */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.06)] my-2 sm:my-3">
            <User size={30} className="text-[#7A9E9C] sm:w-8 sm:h-8" strokeWidth={2.2} />
          </div>

          {/* 3. Section Label — MEMBER LOGIN */}
          <h2
            className="text-black font-bold uppercase text-center tracking-[0.15em] text-[13px] sm:text-[14px]"
            style={{
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}
          >
            MEMBER LOGIN
          </h2>
        </div>

        {/* FORM FIELDS (semi-transparent white, rounded pill inputs) */}
        <form onSubmit={handleSubmit} className="w-full space-y-2.5 sm:space-y-3 my-auto py-1">
          
          {/* Field 1: Branch Dropdown */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <MapPin size={17} className="text-[#7A9E9C] shrink-0" />
            </div>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value as Branch);
                setUsername('');
                setError('');
                setShowUserDropdown(false);
              }}
              className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-full bg-white/80 backdrop-blur-sm text-slate-800 border border-white/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A9E9C]/30 focus:border-white text-[13px] font-medium transition-all appearance-none cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
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
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#7A9E9C]">
              <ChevronDown size={17} />
            </div>
          </div>

          {/* Field 2: Username */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <User size={17} className="text-[#7A9E9C] shrink-0" />
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
              className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-full bg-white/80 backdrop-blur-sm text-slate-800 placeholder-slate-400/90 border border-white/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A9E9C]/30 focus:border-white text-[13px] font-medium transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            />
            {users.length > 0 && (
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#7A9E9C] hover:text-[#5A8A88] focus:outline-none transition-colors"
                title="Select user"
              >
                <ChevronDown size={16} className={`transition-transform duration-200 ${showUserDropdown ? 'rotate-180' : ''}`} />
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
              <div className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-white/80 max-h-44 overflow-y-auto py-1 divide-y divide-slate-100">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setUsername(u.name);
                      setShowUserDropdown(false);
                      setError('');
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-[#7A9E9C]/10 flex items-center justify-between text-xs text-slate-800 transition-colors"
                  >
                    <span className="font-semibold text-slate-800">{u.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Field 3: Password */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Lock size={17} className="text-[#7A9E9C] shrink-0" />
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
              className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-full bg-white/80 backdrop-blur-sm text-slate-800 placeholder-slate-400 border border-white/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A9E9C]/30 focus:border-white text-[13px] font-medium tracking-wider transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#7A9E9C] hover:text-[#5A8A88] focus:outline-none transition-colors"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {/* Row below fields */}
          <div className="flex items-center justify-between px-2 pt-0.5 text-[11px] sm:text-[12px]">
            {/* Left: Remember me checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-white">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border border-white/70 text-[#5A8A88] focus:ring-0 focus:ring-offset-0 bg-white/30 cursor-pointer"
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
              className="text-white hover:text-white/80 font-medium underline-offset-2 hover:underline focus:outline-none"
            >
              Forgot password?
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-rose-600 bg-white/95 backdrop-blur-sm border border-rose-200 text-[11px] font-semibold py-1.5 px-3 rounded-full text-center shadow-sm animate-pulse">
              {error}
            </div>
          )}

          {/* LOGIN BUTTON */}
          <div className="pt-1.5 sm:pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 sm:py-3 px-6 rounded-full bg-white text-[#5A8A88] font-bold text-[14px] sm:text-[15px] shadow-[0_4px_16px_rgba(90,138,136,0.35)] hover:shadow-[0_6px_20px_rgba(90,138,136,0.5)] hover:bg-white/95 active:scale-[0.99] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>

        {/* FOOTER */}
        <div className="w-full flex flex-col items-center gap-1.5 shrink-0 my-1">
          <span className="text-white text-[12px] font-normal tracking-wide">
            Not a member?
          </span>
          <button
            type="button"
            onClick={() =>
              setInfoModal(
                'กรุณาติดต่อฝ่ายบุคคลหรือผู้จัดการเพื่อขอรับสิทธิ์เข้าใช้งานระบบ\n\nPlease contact HR or Branch Manager to request an account.'
              )
            }
            className="border border-white text-white bg-transparent rounded-full px-6 py-1.5 text-[12px] font-semibold hover:bg-white/10 active:bg-white/20 transition-all focus:outline-none tracking-wide"
          >
            Create account
          </button>
        </div>

      </div>

      {/* SUPABASE STATUS BAR (bottom-most, fixed) */}
      <aside
        aria-label="Database Status"
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center border-t border-white/10"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          padding: '6px 14px'
        }}
      >
        <div className="flex items-center gap-1.5 text-white text-[11px] font-medium tracking-wide">
          {/* White database icon on left */}
          <Database size={12} className="text-white shrink-0 mr-1" />

          {/* STATE 1 — Connected */}
          {supabaseStatus === 'connected' && (
            <>
              <span className="relative flex h-2 w-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E] shadow-[0_0_8px_#22C55E]"></span>
              </span>
              <span>Supabase &nbsp;●&nbsp; Connected</span>
            </>
          )}

          {/* STATE 2 — Connecting */}
          {supabaseStatus === 'connecting' && (
            <>
              <Loader2 size={12} className="animate-spin text-[#EAB308] mr-1 shrink-0" />
              <span className="relative flex h-2 w-2 mr-1">
                <span className="inline-flex rounded-full h-2 w-2 bg-[#EAB308] animate-pulse"></span>
              </span>
              <span>Supabase &nbsp;●&nbsp; Connecting...</span>
            </>
          )}

          {/* STATE 3 — Disconnected */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-[#7A9E9C]/15 text-[#5A8A88] flex items-center justify-center mx-auto">
              <User size={24} />
            </div>
            <div className="text-slate-700 text-xs font-medium whitespace-pre-line leading-relaxed">
              {infoModal}
            </div>
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              className="w-full py-2.5 px-4 rounded-full bg-[#5A8A88] text-white font-semibold text-xs hover:bg-[#4d7775] transition-colors focus:outline-none"
            >
              รับทราบ (OK)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
