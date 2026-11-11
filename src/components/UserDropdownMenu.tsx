import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Building } from 'lucide-react';
import { LeaveRequestModal } from './LeaveRequestModal';

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
  onOpenLeaveModal?: () => void;
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
  onOpenLeaveModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBranchInfoModal, setShowBranchInfoModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = user?.name || userName || 'User';
  const displayRole = user?.role || userRole || '';
  const branchVal = user?.branch || userBranch || 'Rayong';
  const branchLabel = branchVal === 'Rayong' ? 'สาขาระยอง (Rayong)' : 'สาขากรุงเทพฯ (Bangkok)';
  const shortBranchLabel = branchVal === 'Rayong' ? 'ระยอง' : 'กรุงเทพฯ';
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

  const handleSelectProfile = () => {
    setIsOpen(false);
    setShowProfileModal(true);
  };

  const handleSelectBranchInfo = () => {
    setIsOpen(false);
    if (onOpenBranchModal) {
      onOpenBranchModal();
    } else {
      setShowBranchInfoModal(true);
    }
  };

  const handleSelectLeaveRequest = () => {
    setIsOpen(false);
    if (onOpenLeaveModal) {
      onOpenLeaveModal();
    } else {
      setShowLeaveModal(true);
    }
    if (onNavigate) {
      onNavigate('leaveRequest');
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
      <div className="relative inline-block text-left select-none" ref={dropdownRef}>
        {/* User Avatar Button Pill (Header) */}
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#D4E4E3] transition-colors focus:outline-none shadow-xs cursor-pointer"
          title="โปรไฟล์ผู้ใช้"
          aria-expanded={isOpen}
        >
          <div className="w-7 h-7 rounded-full bg-[#5A8A88] text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
            {initial}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-[11px] font-bold text-slate-800 leading-tight">
              {displayName}
            </p>
            {displayRole && (
              <p className="text-[9px] text-[#5A8A88] font-semibold leading-tight capitalize">
                {displayRole}
              </p>
            )}
          </div>
          <ChevronDown
            size={12}
            className={`text-[#5A8A88] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown Menu matching "เพิ่มเติม" in BottomNav */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-[220px] sm:w-[230px] bg-white border border-[#D4E4E3] rounded-[12px] p-1.5 shadow-[0_8px_24px_rgba(45,74,73,0.12)] z-[200] max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Group 1: Navigation & Info Items */}
            <div className="space-y-0.5">
              {/* 1. ตั้งค่า / Settings */}
              <button
                type="button"
                onClick={handleSelectSettings}
                className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
              >
                <div className="flex items-center gap-[10px] min-w-0">
                  <span className="text-[14px] shrink-0 leading-none">⚙️</span>
                  <span className="truncate text-[12px]">ตั้งค่า / Settings</span>
                </div>
                <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
              </button>

              {/* 2. โปรไฟล์ผู้ใช้ */}
              <button
                type="button"
                onClick={handleSelectProfile}
                className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
              >
                <div className="flex items-center gap-[10px] min-w-0">
                  <span className="text-[14px] shrink-0 leading-none">👤</span>
                  <span className="truncate text-[12px]">โปรไฟล์ผู้ใช้</span>
                </div>
                <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
              </button>

              {/* 3. ข้อมูลสาขา */}
              <button
                type="button"
                onClick={handleSelectBranchInfo}
                className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
              >
                <div className="flex items-center gap-[10px] min-w-0">
                  <span className="text-[14px] shrink-0 leading-none">🏪</span>
                  <span className="truncate text-[12px]">ข้อมูลสาขา</span>
                </div>
                <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
              </button>

              {/* 4. ทำรายการลา */}
              <button
                type="button"
                onClick={handleSelectLeaveRequest}
                className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
              >
                <div className="flex items-center gap-[10px] min-w-0">
                  <span className="text-[14px] shrink-0 leading-none">🏖️</span>
                  <span className="truncate text-[12px]">ทำรายการลา</span>
                </div>
                <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
              </button>

              {/* 5. ประวัติแก้ไขข้อมูล */}
              <button
                type="button"
                onClick={handleSelectLogs}
                className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
              >
                <div className="flex items-center gap-[10px] min-w-0">
                  <span className="text-[14px] shrink-0 leading-none">🕐</span>
                  <span className="truncate text-[12px]">ประวัติแก้ไขข้อมูล</span>
                </div>
                <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
              </button>
            </div>

            {/* Divider Line */}
            <div className="h-[1px] bg-[#D4E4E3] mx-2 my-1" />

            {/* Group 2: Logout */}
            {onLogout && (
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={handleSelectLogout}
                  className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-rose-600 hover:bg-rose-50 font-medium transition-all duration-100 cursor-pointer text-left group select-none"
                >
                  <div className="flex items-center gap-[10px] min-w-0">
                    <span className="text-[14px] shrink-0 leading-none">🚪</span>
                    <span className="truncate text-[12px]">ออกจากระบบ (Logout)</span>
                  </div>
                  <ChevronRight size={13} className="text-rose-400 group-hover:text-rose-600 shrink-0 ml-2 transition-colors" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Internal User Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center font-bold text-2xl mx-auto shadow-xs border-2 border-[#D4E4E3]">
              {initial}
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-800">{displayName}</h3>
              <p className="text-xs font-semibold text-[#5A8A88] mt-0.5">{displayRole}</p>
              <p className="text-[11px] text-slate-400 mt-1">สาขา: {shortBranchLabel}</p>
            </div>
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => { setShowProfileModal(false); handleSelectSettings(); }}
                className="w-full py-2.5 rounded-full bg-[#E8F3F2] text-[#476E6C] font-semibold text-xs hover:bg-[#D8EAE8] transition-colors cursor-pointer"
              >
                จัดการบัญชีและความปลอดภัย
              </button>
              {onLogout && (
                <button
                  type="button"
                  onClick={() => { setShowProfileModal(false); onLogout(); }}
                  className="w-full py-2.5 rounded-full bg-rose-50 text-rose-600 font-semibold text-xs hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  ออกจากระบบ
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="w-full py-2 rounded-full text-slate-400 font-medium text-xs hover:text-slate-600 transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Internal Leave Request Modal */}
      <LeaveRequestModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        userName={displayName}
        userRole={displayRole}
        userBranch={branchVal}
      />
    </>
  );
};

export default UserDropdownMenu;
