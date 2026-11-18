import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  UserCheck,
  CalendarPlus,
  Coffee,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PagePermission } from '../../utils/permissions';
import { LeaveDashboard } from '../LeaveDashboard';
import { LeaveRequestModal } from '../LeaveRequestModal';

interface LeavePortalAppProps {
  currentUser: {
    name: string;
    role: string;
    branch: string;
    permissions?: any;
  };
  onSwitchToCafe: () => void;
  onSwitchToProdCalc?: () => void;
  onSwitchToHelloCrenn?: () => void;
  onLogout: () => void;
  isReadOnly?: boolean;
  tabPermissions?: {
    leaveDashboard: PagePermission;
    personnelLeave: PagePermission;
  };
}

export function LeavePortalApp({
  currentUser,
  onSwitchToCafe,
  onSwitchToProdCalc,
  onSwitchToHelloCrenn,
  onLogout,
  isReadOnly = false,
  tabPermissions,
}: LeavePortalAppProps) {
  const effectivePerms = {
    leaveDashboard: tabPermissions?.leaveDashboard ?? 'edit',
    personnelLeave: tabPermissions?.personnelLeave ?? 'edit',
  };

  type LeavePortalTab = 'leaveDashboard' | 'personnelLeave';

  const defaultTab: LeavePortalTab =
    effectivePerms.leaveDashboard !== 'hidden' ? 'leaveDashboard' : 'personnelLeave';

  const [currentTab, setCurrentTab] = useState<LeavePortalTab>(defaultTab);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (currentTab === 'leaveDashboard' && effectivePerms.leaveDashboard === 'hidden') {
      if (effectivePerms.personnelLeave !== 'hidden') {
        setCurrentTab('personnelLeave');
      }
    } else if (currentTab === 'personnelLeave' && effectivePerms.personnelLeave === 'hidden') {
      if (effectivePerms.leaveDashboard !== 'hidden') {
        setCurrentTab('leaveDashboard');
      }
    }
  }, [currentTab, effectivePerms.leaveDashboard, effectivePerms.personnelLeave]);

  const [dbStatus, setDbStatus] = useState<'connected' | 'checking' | 'offline'>(
    supabase ? 'checking' : 'offline'
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!supabase) {
      setDbStatus('offline');
      return;
    }
    let isMounted = true;
    setDbStatus('checking');

    const checkConnection = async () => {
      try {
        const { error } = await supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .limit(1);
        if (!isMounted) return;
        setDbStatus(error ? 'offline' : 'connected');
      } catch {
        if (isMounted) setDbStatus('offline');
      }
    };

    checkConnection();
    return () => {
      isMounted = false;
    };
  }, [currentUser.branch]);

  const branchLabel =
    currentUser.branch === 'Rayong'
      ? 'สาขาระยอง (Rayong)'
      : currentUser.branch === 'Bangkok'
        ? 'สาขากรุงเทพฯ (Bangkok)'
        : currentUser.branch;

  const userInitial = (currentUser.name || 'U').charAt(0).toUpperCase();

  const canSubmitLeave =
    !isReadOnly &&
    (effectivePerms.leaveDashboard === 'edit' || effectivePerms.personnelLeave === 'edit');

  const isCurrentTabReadOnly =
    isReadOnly ||
    (currentTab === 'leaveDashboard'
      ? effectivePerms.leaveDashboard !== 'edit'
      : effectivePerms.personnelLeave !== 'edit');

  const navItems: Array<{
    id: LeavePortalTab;
    label: string;
    mobileLabel: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  }> = [
    ...(effectivePerms.leaveDashboard !== 'hidden'
      ? [
          {
            id: 'leaveDashboard' as const,
            label: 'Leave Dashboard',
            mobileLabel: 'ภาพรวมทีม',
            icon: BarChart3,
          },
        ]
      : []),
    ...(effectivePerms.personnelLeave !== 'hidden'
      ? [
          {
            id: 'personnelLeave' as const,
            label: 'Personnel Leave',
            mobileLabel: 'การลาของฉัน',
            icon: UserCheck,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#F0F5F4] text-[#2D4A49] font-sans pb-24 md:pb-12">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ROW 1: TOP NAVIGATION BAR (Matches Main App TopNav & DESIGN_STANDARD §8) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#D4E4E3] shadow-xs px-4 py-3 w-full">
        <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto flex items-center justify-between">
          {/* Left: Brand Wordmark CRENN + Sub-App Label */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentTab(defaultTab)}
              className="text-left group focus:outline-none cursor-pointer"
              title="กลับหน้าหลัก (Leave Portal)"
            >
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-[0.22em] uppercase leading-none font-sans">
                CRENN
              </h1>
              <p className="text-[9px] text-[#5A8A88] font-bold tracking-widest uppercase mt-0.5">
                Leave Portal · Time Off
              </p>
            </button>
          </div>

          {/* Center: Icon-Above-Label Navigation Tabs */}
          <nav
            aria-label="เมนูหลัก Leave Portal"
            className="hidden md:flex items-center justify-center gap-1 flex-1 px-2"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex flex-col items-center justify-center gap-[2px] px-[12px] py-[6px] rounded-lg min-w-[68px] cursor-pointer relative transition-all duration-150 ${
                    isActive
                      ? 'bg-[#E8F3F2] text-[#5A8A88]'
                      : 'text-[#A8BCBB] hover:bg-[#F0F5F4] hover:text-[#5A8A88]'
                  }`}
                  title={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={1.5} />
                  <span
                    className={`text-[9px] leading-none whitespace-nowrap mt-[1px] ${
                      isActive ? 'font-semibold text-[#5A8A88]' : 'font-normal'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}

            {canSubmitLeave && (
              <button
                type="button"
                onClick={() => setShowLeaveModal(true)}
                className="flex flex-col items-center justify-center gap-[2px] px-[12px] py-[6px] rounded-lg min-w-[68px] cursor-pointer relative transition-all duration-150 text-[#A8BCBB] hover:bg-[#F0F5F4] hover:text-[#5A8A88]"
                title="ยื่นคำขอลาหยุดงาน"
              >
                <CalendarPlus size={18} strokeWidth={1.5} />
                <span className="text-[9px] leading-none whitespace-nowrap mt-[1px] font-normal">
                  ยื่นคำขอลา
                </span>
              </button>
            )}
          </nav>

          {/* Right: User Avatar Pill + Dropdown Menu */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative inline-block text-left select-none" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#D4E4E3] transition-colors focus:outline-none shadow-xs cursor-pointer"
                title="โปรไฟล์ผู้ใช้"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <div className="w-7 h-7 rounded-full bg-[#5A8A88] text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                  {userInitial}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">
                    {currentUser.name}
                  </p>
                  {currentUser.role && (
                    <p className="text-[9px] text-[#5A8A88] font-semibold leading-tight capitalize">
                      {currentUser.role}
                    </p>
                  )}
                </div>
                <ChevronDown
                  size={12}
                  className={`text-[#5A8A88] transition-transform duration-200 shrink-0 ${
                    userMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-[225px] bg-white border border-[#D4E4E3] rounded-[12px] p-1.5 shadow-[0_8px_24px_rgba(45,74,73,0.12)] z-[200] animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="px-3 py-2 rounded-lg bg-[#F8FCFC] border border-[#D4E4E3]/60 mb-1">
                    <p className="text-[11px] font-bold text-[#2D4A49] truncate">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-[#6B8F8E] truncate mt-0.5">
                      📍 {branchLabel}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSwitchToCafe();
                    }}
                    className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
                  >
                    <div className="flex items-center gap-[10px] min-w-0">
                      <span className="text-[14px] shrink-0 leading-none">☕</span>
                      <span className="truncate text-[12px]">สลับไป Cafe Management</span>
                    </div>
                    <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
                  </button>

                  {onSwitchToProdCalc && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSwitchToProdCalc();
                      }}
                      className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
                    >
                      <div className="flex items-center gap-[10px] min-w-0">
                        <span className="text-[14px] shrink-0 leading-none">🧮</span>
                        <span className="truncate text-[12px]">สลับไป ProdCalc</span>
                      </div>
                      <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
                    </button>
                  )}

                  {onSwitchToHelloCrenn && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSwitchToHelloCrenn();
                      }}
                      className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
                    >
                      <div className="flex items-center gap-[10px] min-w-0">
                        <span className="text-[14px] shrink-0 leading-none">📍</span>
                        <span className="truncate text-[12px]">สลับไป Hello, Crenn</span>
                      </div>
                      <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
                    </button>
                  )}

                  <div className="h-[1px] bg-[#D4E4E3] mx-2 my-1" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
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
          </div>
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ROW 2: SECONDARY STATUS & APP SWITCHER BAR */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="w-full relative bg-white/80 backdrop-blur-xs border-b border-[#D4E4E3] shadow-xs px-4 md:px-6 lg:px-8 py-2 z-10 shrink-0">
        <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto flex items-center justify-between text-xs min-h-[32px] gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onSwitchToCafe}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#5A8A88] text-[#2D4A49] transition-colors focus:outline-none shadow-xs text-xs font-bold cursor-pointer whitespace-nowrap"
              title="สลับไปยังระบบ Cafe Management System"
            >
              <Coffee size={13} className="text-[#5A8A88]" />
              <span>Cafe Management</span>
            </button>

            {onSwitchToProdCalc && (
              <button
                type="button"
                onClick={onSwitchToProdCalc}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EEF6FB] hover:bg-[#DDF0F8] border border-[#5BA4C8] text-[#1E5A7A] transition-colors focus:outline-none shadow-xs text-xs font-bold cursor-pointer whitespace-nowrap"
                title="เปิดแอปพลิเคชัน ProdCalc (คำนวณต้นทุนการผลิต)"
              >
                <span className="text-sm">🧮</span>
                <span>ProdCalc</span>
              </button>
            )}

            {onSwitchToHelloCrenn && (
              <button
                type="button"
                onClick={onSwitchToHelloCrenn}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#5A8A88] text-[#2D4A49] transition-colors focus:outline-none shadow-xs text-xs font-bold cursor-pointer whitespace-nowrap"
                title="เปิดแอปพลิเคชัน Hello, Crenn (GPS ลงเวลาเข้า-ออกงานอัตโนมัติ)"
              >
                <span className="text-sm">📍</span>
                <span>Hello, Crenn</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 font-semibold text-[11px]">
            {dbStatus === 'connected' && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E] shadow-[0_0_6px_#22C55E]"></span>
                </span>
                <span className="text-emerald-700">Supabase ● Connected</span>
              </>
            )}

            {dbStatus === 'checking' && (
              <>
                <Loader2 size={12} className="animate-spin text-amber-500" />
                <span className="text-amber-700">Supabase ● Connecting...</span>
              </>
            )}

            {dbStatus === 'offline' && (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span className="text-rose-700">Supabase ● Disconnected (Offline)</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MAIN CONTAINER (Aligned to max-w-6xl grid) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <main className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {currentTab === 'leaveDashboard' && effectivePerms.leaveDashboard !== 'hidden' && (
          <LeaveDashboard
            key={`team-${refreshKey}`}
            user={currentUser}
            mode="team"
            isReadOnly={isCurrentTabReadOnly}
            onOpenLeaveModal={() => setShowLeaveModal(true)}
          />
        )}

        {currentTab === 'personnelLeave' && effectivePerms.personnelLeave !== 'hidden' && (
          <LeaveDashboard
            key={`personal-${refreshKey}`}
            user={currentUser}
            mode="personal"
            isReadOnly={isCurrentTabReadOnly}
            onOpenLeaveModal={() => setShowLeaveModal(true)}
          />
        )}
      </main>

      {/* Leave Request Modal */}
      <LeaveRequestModal
        isOpen={showLeaveModal && canSubmitLeave}
        onClose={() => {
          setShowLeaveModal(false);
          setRefreshKey((prev) => prev + 1);
        }}
        userName={currentUser.name || 'User'}
        userRole={currentUser.role || 'Staff'}
        userBranch={currentUser.branch || 'Rayong'}
      />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MOBILE BOTTOM NAVIGATION */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="md:hidden fixed bottom-3 left-4 right-4 z-40">
        <div className="bg-white/95 border border-[#D4E4E3] backdrop-blur-md shadow-[0_8px_24px_rgba(45,74,73,0.16)] rounded-2xl p-1 flex items-center justify-around gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentTab(item.id)}
                className={`flex-1 py-1.5 rounded-xl text-[9.5px] flex flex-col items-center gap-0.5 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#E8F3F2] text-[#5A8A88] font-semibold'
                    : 'text-[#A8BCBB] hover:text-[#5A8A88]'
                }`}
              >
                <Icon size={16} strokeWidth={1.5} />
                <span>{item.mobileLabel}</span>
              </button>
            );
          })}

          {canSubmitLeave && (
            <button
              type="button"
              onClick={() => setShowLeaveModal(true)}
              className="flex-1 py-1.5 rounded-xl text-[9.5px] flex flex-col items-center gap-0.5 transition-all cursor-pointer whitespace-nowrap text-[#A8BCBB] hover:text-[#5A8A88]"
            >
              <CalendarPlus size={16} strokeWidth={1.5} />
              <span>ยื่นคำขอลา</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LeavePortalApp;
