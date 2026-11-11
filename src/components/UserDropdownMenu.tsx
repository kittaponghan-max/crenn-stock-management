import React, { useState, useRef, useEffect } from 'react';
import { Shield, LogOut, ChevronDown, Building, History, UserCheck } from 'lucide-react';

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
  onOpenBranchModal?: () => void;
}

export const UserDropdownMenu: React.FC<UserDropdownMenuProps> = ({
  user,
  userName = 'User',
  userRole = 'User',
  userBranch,
  onNavigate,
  onLogout,
  onAvatarClick,
  onOpenBranchModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showBranchInfoModal, setShowBranchInfoModal] = useState(false);
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

  const handleSelectBranchInfo = () => {
    setIsOpen(false);
    if (onOpenBranchModal) {
      onOpenBranchModal();
    } else {
      setShowBranchInfoModal(true);
    }
  };

  const handleSelectLogs = () => {
    setIsOpen(false);
    if (onNavigate) {
      onNavigate('logs');
    }
  };

  const handleSelectLogout = () => {
    setIsOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <>
      <div className="relative inline-block text-left" ref={dropdownRef}>
        {/* User Avatar Button Pill */}
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#D4E4E3] transition-all focus:outline-none shadow-2xs cursor-pointer group select-none"
          title="โปรไฟล์ผู้ใช้"
          aria-expanded={isOpen}
        >
          <div className="w-7 h-7 rounded-full bg-[#5A8A88] text-white flex items-center justify-center text-xs font-black uppercase shadow-2xs shrink-0">
            {initial}
          </div>
          <div className="text-left hidden sm:block min-w-0 max-w-[90px]">
            <p className="text-[11.5px] font-extrabold text-[#2D4A49] leading-tight truncate">
              {displayName}
            </p>
            {displayRole && (
              <p className="text-[9.5px] text-[#5A8A88] font-bold leading-tight uppercase truncate">
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
          <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-[#F4F8F7] rounded-2xl shadow-xl border border-[#D4E4E3] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 p-2">
            {/* Header Summary Card */}
            <div className="px-3.5 py-3 bg-[#E8F3F2]/80 rounded-xl border border-[#D4E4E3]/80 flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-[#5A8A88] text-white flex items-center justify-center font-black text-base uppercase shadow-2xs shrink-0 border-2 border-white">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-[#2D4A49] truncate leading-tight">{displayName}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {displayRole && (
                    <span className="text-[9px] font-bold text-[#5A8A88] bg-white px-2 py-0.5 rounded-full border border-[#D4E4E3] uppercase shadow-2xs">
                      {displayRole}
                    </span>
                  )}
                  <span className="text-[10px] font-semibold text-[#6B8F8E] flex items-center gap-0.5">
                    📍 {branchLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Items List */}
            <div className="space-y-1 bg-white p-1.5 rounded-xl border border-[#D4E4E3]/60 shadow-2xs">
              {/* 1. จัดการบัญชีและความปลอดภัย */}
              <button
                type="button"
                onClick={handleSelectSettings}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-bold text-[#2D4A49] hover:bg-[#E8F3F2] transition-colors cursor-pointer text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center group-hover:bg-[#5A8A88] group-hover:text-white transition-colors shrink-0">
                  <Shield size={14} />
                </div>
                <span className="truncate">จัดการบัญชีและความปลอดภัย</span>
              </button>

              {/* 2. ข้อมูลสาขา */}
              <button
                type="button"
                onClick={handleSelectBranchInfo}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-bold text-[#2D4A49] hover:bg-[#E8F3F2] transition-colors cursor-pointer text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center group-hover:bg-[#5A8A88] group-hover:text-white transition-colors shrink-0">
                  <Building size={14} />
                </div>
                <span className="truncate">ข้อมูลสาขา</span>
              </button>

              {/* 3. ประวัติแก้ไขข้อมูล */}
              <button
                type="button"
                onClick={handleSelectLogs}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-bold text-[#2D4A49] hover:bg-[#E8F3F2] transition-colors cursor-pointer text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center group-hover:bg-[#5A8A88] group-hover:text-white transition-colors shrink-0">
                  <History size={14} />
                </div>
                <span className="truncate">ประวัติแก้ไขข้อมูล</span>
              </button>
            </div>

            {/* Divider */}
            <div className="h-[1px] bg-[#D4E4E3] mx-1 my-1.5" />

            {/* 4. ออกจากระบบ (Logout) */}
            {onLogout && (
              <button
                type="button"
                onClick={handleSelectLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-bold text-[#EF4444] bg-[#FFE4E6]/60 hover:bg-[#FFE4E6] border border-[#FCA5A5]/40 transition-colors cursor-pointer text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-rose-200/80 text-rose-600 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors shrink-0">
                  <LogOut size={14} />
                </div>
                <span className="truncate">ออกจากระบบ</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Internal Branch Info Modal */}
      {showBranchInfoModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center mx-auto border border-[#D4E4E3]">
              <Building size={24} />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-[#2D4A49]">ข้อมูลสาขา (Branch Info)</h3>
              <p className="text-xs text-slate-600 mt-2 font-medium">
                📍 สาขาปัจจุบัน: <span className="font-bold text-[#5A8A88]">{branchLabel}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                ระบบจัดเก็บข้อมูลและประวัติสต็อกแยกตามสาขาเพื่อความถูกต้องของการดำเนินงาน
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBranchInfoModal(false)}
              className="w-full py-2.5 rounded-full bg-[#5A8A88] text-white font-semibold text-xs hover:bg-[#476E6C] transition-colors cursor-pointer"
            >
              ตกลง (OK)
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default UserDropdownMenu;
