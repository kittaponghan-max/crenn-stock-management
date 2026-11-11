import React, { useState, useRef, useEffect } from 'react';
import { Shield, LogOut, ChevronDown } from 'lucide-react';

export interface UserDropdownMenuProps {
  user?: {
    name?: string;
    role?: string;
    branch?: string;
    username?: string;
  } | null;
  userName?: string;
  userRole?: string;
  userBranch?: string;
  onNavigate?: (tab: string) => void;
  onLogout?: () => void;
  onAvatarClick?: () => void;
}

export const UserDropdownMenu: React.FC<UserDropdownMenuProps> = ({
  user,
  userName = 'User',
  userRole = 'User',
  userBranch,
  onNavigate,
  onLogout,
  onAvatarClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = user?.name || userName || 'User';
  const displayRole = user?.role || userRole || '';
  const branchVal = user?.branch || userBranch || 'Rayong';
  const branchLabel = branchVal === 'Rayong' ? 'ระยอง' : 'กรุงเทพฯ';
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectSettings = () => {
    setIsOpen(false);
    if (onNavigate) {
      onNavigate('userSettings');
    } else if (onAvatarClick) {
      onAvatarClick();
    }
  };

  const handleSelectLogout = () => {
    setIsOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* User Avatar Button Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#D4E4E3] transition-all focus:outline-none shadow-xs cursor-pointer group"
        title="โปรไฟล์ผู้ใช้"
        aria-expanded={isOpen}
      >
        <div className="w-7 h-7 rounded-full bg-[#5A8A88] text-white flex items-center justify-center text-xs font-bold uppercase shadow-2xs shrink-0">
          {initial}
        </div>
        <div className="text-left hidden sm:block min-w-0 max-w-[90px]">
          <p className="text-[11px] font-bold text-slate-800 leading-tight truncate">
            {displayName}
          </p>
          {displayRole && (
            <p className="text-[9px] text-[#5A8A88] font-semibold leading-tight capitalize truncate">
              {displayRole}
            </p>
          )}
        </div>
        <ChevronDown
          size={13}
          className={`text-[#5A8A88] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu List */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-[#D4E4E3] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header Summary */}
          <div className="px-3.5 py-3 bg-gradient-to-r from-[#F0F5F4] to-[#E8F3F2] border-b border-[#D4E4E3] flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#5A8A88] text-white flex items-center justify-center font-bold text-sm uppercase shadow-2xs shrink-0 border border-white">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-slate-800 truncate">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {displayRole && (
                  <span className="text-[9px] font-bold text-[#5A8A88] bg-white px-1.5 py-0.5 rounded border border-[#D4E4E3] uppercase">
                    {displayRole}
                  </span>
                )}
                <span className="text-[9.5px] font-medium text-slate-500">
                  📍 {branchLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Menu Items List */}
          <div className="p-1.5 space-y-0.5 bg-white">
            <button
              type="button"
              onClick={handleSelectSettings}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-[#2D4A49] hover:bg-[#F0F5F4] transition-colors cursor-pointer text-left group"
            >
              <div className="w-6.5 h-6.5 rounded-lg bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center group-hover:bg-[#5A8A88] group-hover:text-white transition-colors shrink-0">
                <Shield size={13} />
              </div>
              <span className="truncate">จัดการบัญชีและความปลอดภัย</span>
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={handleSelectLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left group"
              >
                <div className="w-6.5 h-6.5 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors shrink-0">
                  <LogOut size={13} />
                </div>
                <span>ออกจากระบบ</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDropdownMenu;
