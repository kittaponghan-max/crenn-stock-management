import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import { AppUser as TypesAppUser, AppPermissions, Branch } from '../types';

export type UserRole = 'Admin' | 'Owner' | 'Co-founder' | 'Branch Manager' | 'Head Baker' | 'Senior Baker' | 'Junior Baker' | 'Barista' | 'Barista Assistance' | 'Cashier' | 'Server/Runner' | 'Dishwasher/Cleaner';

interface AppUser extends TypesAppUser {
  role: UserRole;
}

interface LoginFormProps {
  onLogin: (user: { name: string; role: UserRole; permissions?: AppPermissions; branch: Branch }) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<Branch>('Bangkok');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'offline'>('checking');

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setDbStatus('checking');
      if (supabase) {
        const { data, error } = await supabase.from('app_users').select('*').eq('branch', selectedBranch);
        if (error) {
          console.error("Supabase Error:", error);
          setDbStatus('offline');
          loadFallbackUsers();
        } else if (data && data.length > 0) {
          setUsers(data as AppUser[]);
          setSelectedUserId(data[0].id);
          setDbStatus('connected');
        } else {
          // No users for this branch in Supabase, seed default users
          const defaultUsers = [
            { name: 'Admin', role: 'Admin', password: 'Administrator', branch: selectedBranch },
            { name: 'Branch Manager', role: 'Branch Manager', password: '1234', branch: selectedBranch },
            { name: 'Barista', role: 'Barista', password: '1234', branch: selectedBranch }
          ];
          const { data: insertedUsers, error: insertError } = await supabase.from('app_users').insert(defaultUsers).select();
          if (insertError) {
            console.error("Error seeding default users:", insertError);
            setDbStatus('offline');
            loadFallbackUsers();
          } else if (insertedUsers) {
            setUsers(insertedUsers as AppUser[]);
            setSelectedUserId(insertedUsers[0].id);
            setDbStatus('connected');
          }
        }
      } else {
        setDbStatus('offline');
        loadFallbackUsers();
      }
      setIsLoading(false);
    };

    const loadFallbackUsers = () => {
      const saved = localStorage.getItem(`cafe-app-users-${selectedBranch}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setUsers(parsed);
        if (parsed.length > 0) setSelectedUserId(parsed[0].id);
      } else {
        const defaultUsers: AppUser[] = [
          { id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)), name: 'Admin', role: 'Admin', password: 'Administrator', branch: selectedBranch },
          { id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)), name: 'Branch Manager', role: 'Branch Manager', password: '1234', branch: selectedBranch },
          { id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)), name: 'Barista', role: 'Barista', password: '1234', branch: selectedBranch }
        ];
        setUsers(defaultUsers);
        setSelectedUserId(defaultUsers[0].id);
        localStorage.setItem(`cafe-app-users-${selectedBranch}`, JSON.stringify(defaultUsers));
      }
    };

    fetchUsers();
  }, [selectedBranch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = users.find(u => u.id === selectedUserId);
    if (!user) {
      setError('User not selected');
      return;
    }

    if (user.password === password) {
      onLogin({
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        branch: selectedBranch
      });
    } else {
      setError('รหัสผ่านไม่ถูกต้อง (Invalid password)');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#c5d0ce] flex items-center justify-center p-4">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-white/40 rounded-2xl mb-4"></div>
          <div className="h-4 w-32 bg-white/40 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#c5d0ce] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 border border-white/20">
        <div className="flex flex-col items-center mb-8">
          <Logo className="mb-2 shadow-sm border border-slate-200/50 rounded-sm px-6 py-4" textClassName="text-4xl" showSubtitle={true} />
          <p className="text-slate-500 mt-2 font-medium text-[14px]">Please sign in to continue</p>
          
          <div className="mt-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200">
            <div className={`w-2 h-2 rounded-full ${
              dbStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
              dbStatus === 'checking' ? 'bg-yellow-400 animate-pulse' : 'bg-slate-400'
            }`}></div>
            <span className="text-[10px] font-medium text-slate-600 uppercase tracking-widest">
              {dbStatus === 'connected' ? 'Supabase Connected' : 
               dbStatus === 'checking' ? 'Connecting...' : 'Local Offline Mode'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[14px] font-semibold text-slate-700 mb-1 ml-1">Branch (สาขา)</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-slate-400 group-focus-within:text-slate-800 transition-colors" />
              </div>
              <select
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white outline-none text-slate-800 text-[14px] appearance-none"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value as Branch)}
              >
                <option value="Bangkok">กรุงเทพ (Bangkok)</option>
                <option value="Rayong">ระยอง (Rayong)</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-slate-700 mb-1 ml-1">Username</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-400 group-focus-within:text-slate-800 transition-colors" />
              </div>
              <select
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white outline-none text-slate-800 text-[14px] appearance-none"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-slate-700 mb-1 ml-1">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-slate-800 transition-colors" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white outline-none text-slate-800 text-[14px]"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 focus:outline-none transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-[14px] text-center bg-red-50 p-3 rounded-xl border border-red-100 font-medium animate-pulse">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-slate-900/10 text-[14px] font-bold text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
