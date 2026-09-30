import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  Package, 
  ClipboardList, 
  CheckSquare, 
  ShoppingCart, 
  Cake, 
  ChefHat, 
  MoreHorizontal,
  ChevronUp,
  ChevronRight, 
  Building
} from 'lucide-react';
import { Branch } from '../types';
import { UserRole } from './LoginForm';

export interface BottomNavProps {
  activeTab: string;
  onNavigate: (tab: any) => void;
  onLogout: () => void;
  user: {
    name: string;
    role: UserRole;
    branch?: Branch;
  };
}

interface SubMenuItem {
  route?: string;
  label: string;
  emoji: string;
  action?: () => void;
  isDanger?: boolean;
}

interface SubMenuGroup {
  title?: string;
  items: SubMenuItem[];
}

interface NavTabConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties; className?: string }>;
  hasDropdown: boolean;
  dropdownWidth?: string;
  alignmentClass?: string;
  groups?: SubMenuGroup[];
}

export function BottomNav({ activeTab, onNavigate, onLogout, user }: BottomNavProps) {
  const [openTab, setOpenTab] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const bottomNavRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = (delay = 220) => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpenTab(null);
    }, delay);
  };

  // Close on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (!bottomNavRef.current?.contains(e.target as Node)) {
        setOpenTab(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenTab(null);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const isTabActive = (tabId: string) => {
    if (tabId === 'home') return activeTab === 'home' || activeTab === 'dashboard';
    if (tabId === 'stock') return activeTab === 'barStock' || activeTab === 'bakeryStock';
    if (tabId === 'reports') {
      return [
        'barReceiving', 'bakeryReceiving', 'barDailyCount', 'bakeryDailyCount',
        'barWasteLog', 'bakeryWasteLog', 'barWaste', 'logs', 'stockSubmitHistory', 'receivingHistory'
      ].includes(activeTab);
    }
    if (tabId === 'checkin') return activeTab === 'barChecklist' || activeTab === 'bakeryChecklist' || activeTab === 'checklistHistory';
    if (tabId === 'purchasing') return activeTab === 'barPurchasing';
    if (tabId === 'bakery') return activeTab === 'bakeryPlan' || activeTab === 'bakeryPlanHistory';
    if (tabId === 'rnd') return activeTab === 'rndReport';
    if (tabId === 'more') return activeTab === 'userSettings';
    return false;
  };

  const NAV_TABS: NavTabConfig[] = [
    { 
      id: 'home', 
      label: 'หน้าหลัก', 
      icon: Home, 
      hasDropdown: false 
    },
    { 
      id: 'stock', 
      label: 'สต็อก', 
      icon: Package, 
      hasDropdown: true,
      dropdownWidth: 'min-w-[220px]',
      alignmentClass: 'left-0 sm:left-1/2 sm:-translate-x-1/2',
      groups: [
        {
          items: [
            { route: 'barStock', label: 'สรุป Stock บาร์', emoji: '📦' },
            { route: 'bakeryStock', label: 'สรุป Stock ครัว', emoji: '🍳' },
          ],
        },
      ],
    },
    { 
      id: 'reports', 
      label: 'รายงาน', 
      icon: ClipboardList, 
      hasDropdown: true,
      dropdownWidth: 'min-w-[240px]',
      alignmentClass: 'left-1/2 -translate-x-1/2',
      groups: [
        {
          title: 'รายงานประจำวัน',
          items: [
            { route: 'barReceiving', label: 'รับวัตถุดิบ (บาร์)', emoji: '📦' },
            { route: 'bakeryReceiving', label: 'รับวัตถุดิบ (ครัว)', emoji: '📦' },
            { route: 'barDailyCount', label: 'นับสต็อก (บาร์)', emoji: '📋' },
            { route: 'bakeryDailyCount', label: 'นับสต็อก (ครัว)', emoji: '📋' },
            { route: 'barWasteLog', label: 'Waste/ของเสีย (บาร์)', emoji: '🗑️' },
            { route: 'bakeryWasteLog', label: 'Waste/ของเสีย (ครัว)', emoji: '🗑️' },
            { route: 'barWaste', label: 'Waste เมล็ดกาแฟ', emoji: '☕' },
          ],
        },
        {
          title: 'ประวัติย้อนหลัง',
          items: [
            { route: 'logs', label: 'ประวัติการแก้ไขข้อมูล', emoji: '🕐' },
            { route: 'stockSubmitHistory', label: 'ประวัตินับสต็อก', emoji: '🕐' },
            { route: 'receivingHistory', label: 'ประวัติรับวัตถุดิบ', emoji: '🕐' },
          ],
        },
      ],
    },
    { 
      id: 'checkin', 
      label: 'Check-in', 
      icon: CheckSquare, 
      hasDropdown: true,
      dropdownWidth: 'min-w-[240px]',
      alignmentClass: 'left-1/2 -translate-x-1/2',
      groups: [
        {
          items: [
            { route: 'barChecklist', label: 'Check-in & Check-out (บาร์)', emoji: '✅' },
            { route: 'bakeryChecklist', label: 'Check-in & Check-out (ครัว)', emoji: '✅' },
            { route: 'checklistHistory', label: 'ประวัติ Check-in & Check-out', emoji: '🕐' },
          ],
        },
      ],
    },
    { 
      id: 'purchasing', 
      label: 'Purchasing', 
      icon: ShoppingCart, 
      hasDropdown: false 
    },
    { 
      id: 'bakery', 
      label: 'Bakery', 
      icon: Cake, 
      hasDropdown: true,
      dropdownWidth: 'min-w-[230px]',
      alignmentClass: 'right-[-20px] left-auto sm:left-1/2 sm:-translate-x-1/2',
      groups: [
        {
          items: [
            { route: 'bakeryPlan', label: 'แผนงาน Bakery', emoji: '🧁' },
            { route: 'bakeryPlanHistory', label: 'ประวัติแผนงาน Bakery', emoji: '🕐' },
          ],
        },
      ],
    },
    { 
      id: 'rnd', 
      label: 'R&D', 
      icon: ChefHat, 
      hasDropdown: false 
    },
    { 
      id: 'more', 
      label: 'เพิ่มเติม', 
      icon: MoreHorizontal, 
      hasDropdown: true,
      dropdownWidth: 'min-w-[220px]',
      alignmentClass: 'right-0 left-auto sm:left-1/2 sm:-translate-x-1/2',
      groups: [
        {
          items: [
            { route: 'userSettings', label: 'ตั้งค่า / Settings', emoji: '⚙️' },
            { label: 'โปรไฟล์ผู้ใช้', emoji: '👤', action: () => { setOpenTab(null); setShowProfileModal(true); } },
            { label: 'ข้อมูลสาขา', emoji: '🏪', action: () => { setOpenTab(null); setShowBranchModal(true); } },
            { route: 'logs', label: 'ประวัติแก้ไขข้อมูล', emoji: '🕐' },
          ],
        },
        {
          items: [
            { label: 'ออกจากระบบ (Logout)', emoji: '🚪', isDanger: true, action: () => { setOpenTab(null); onLogout(); } },
          ],
        },
      ],
    },
  ];

  const handleTabClick = (tab: NavTabConfig) => {
    if (tab.hasDropdown) {
      setOpenTab((prev) => (prev === tab.id ? null : tab.id));
    } else {
      setOpenTab(null);
      if (tab.id === 'home') onNavigate('home');
      else if (tab.id === 'purchasing') onNavigate('barPurchasing');
      else if (tab.id === 'rnd') onNavigate('rndReport');
    }
  };

  const handleTabMouseEnter = (tab: NavTabConfig) => {
    clearCloseTimer();
    if (tab.hasDropdown) {
      setOpenTab(tab.id);
    } else {
      setOpenTab(null);
    }
  };

  const handleTabMouseLeave = (tab: NavTabConfig) => {
    if (tab.hasDropdown) {
      scheduleClose(220);
    }
  };

  const handleDropdownMouseEnter = () => {
    clearCloseTimer();
  };

  const handleDropdownMouseLeave = () => {
    scheduleClose(200);
  };

  const handleNavigateSubItem = (tab: string) => {
    clearCloseTimer();
    setOpenTab(null);
    onNavigate(tab);
  };

  return (
    <>
      {/* Fixed Bottom Navigation Bar */}
      <nav 
        ref={bottomNavRef}
        aria-label="Main Navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          overflow: 'visible',
          background: '#FFFFFF',
          borderTop: '1px solid #D4E4E3',
          paddingTop: '8px',
          paddingBottom: '8px',
        }}
        className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-[#D4E4E3] shadow-lg select-none py-2 overflow-visible"
      >
        <div 
          style={{ overflow: 'visible' }}
          className="max-w-xl mx-auto flex items-center justify-around px-2 relative"
        >
          {NAV_TABS.map(tab => {
            const Icon = tab.icon;
            const active = isTabActive(tab.id);
            const isOpen = openTab === tab.id;

            return (
              <div 
                key={tab.id}
                style={{ position: 'relative' }}
                className="relative shrink-0"
              >
                <button
                  type="button"
                  onClick={() => handleTabClick(tab)}
                  onMouseEnter={() => handleTabMouseEnter(tab)}
                  onMouseLeave={() => handleTabMouseLeave(tab)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '42px',
                    padding: '4px 6px',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 150ms ease',
                    background: active || isOpen ? '#E8F3F2' : 'transparent',
                    border: 'none',
                    outline: 'none',
                  }}
                  className={`flex flex-col items-center justify-center min-w-[42px] sm:min-w-[52px] py-1 px-1.5 sm:px-2 rounded-full transition-all select-none shrink-0 relative ${
                    active || isOpen
                      ? 'bg-[#E8F3F2] shadow-xs'
                      : 'hover:bg-[#F0F5F4]'
                  }`}
                  aria-expanded={isOpen}
                  aria-haspopup={tab.hasDropdown}
                >
                  <div className="relative flex items-center justify-center">
                    <Icon 
                      size={18} 
                      strokeWidth={active || isOpen ? 2.5 : 2} 
                      style={{ color: active || isOpen ? '#5A8A88' : '#A8BCBB' }}
                    />
                    {tab.hasDropdown && (
                      <ChevronUp 
                        size={8} 
                        style={{
                          position: 'absolute',
                          top: '-4px',
                          right: '-6px',
                          color: isOpen ? '#5A8A88' : '#A8BCBB',
                          transform: isOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 150ms ease, color 150ms ease',
                        }}
                      />
                    )}
                  </div>
                  <span 
                    style={{
                      fontSize: '10px',
                      marginTop: '2px',
                      lineHeight: 1.1,
                      fontWeight: active || isOpen ? 700 : 500,
                      color: active || isOpen ? '#5A8A88' : '#A8BCBB',
                      whiteSpace: 'nowrap',
                    }}
                    className={`text-[10px] mt-0.5 leading-tight tracking-tight whitespace-nowrap ${
                      active || isOpen ? 'text-[#5A8A88] font-bold' : 'text-[#A8BCBB] font-medium'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>

                {/* Dropdown menu opening UPWARD */}
                {isOpen && tab.groups && (
                  <div
                    onMouseEnter={handleDropdownMouseEnter}
                    onMouseLeave={handleDropdownMouseLeave}
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 6px)',
                      maxHeight: '70vh',
                      overflowY: 'auto',
                      background: '#FFFFFF',
                      border: '1px solid #D4E4E3',
                      borderRadius: '12px',
                      padding: '6px',
                      boxShadow: '0 -8px 24px rgba(45,74,73,0.12)',
                      zIndex: 200,
                    }}
                    className={`absolute bottom-[calc(100%+6px)] ${tab.alignmentClass || 'left-1/2 -translate-x-1/2'} ${tab.dropdownWidth || 'min-w-[220px]'} bg-white border border-[#D4E4E3] rounded-[12px] p-1.5 shadow-[-8px_24px_rgba(45,74,73,0.12)] z-[200] max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150`}
                  >
                    {/* Invisible hover bridge to prevent mouseleave between button and upward menu */}
                    <div 
                      className="absolute -bottom-3 left-0 right-0 h-3 bg-transparent" 
                      aria-hidden="true" 
                    />

                    {tab.groups.map((group, groupIdx) => (
                      <React.Fragment key={groupIdx}>
                        {groupIdx > 0 && (
                          <div 
                            style={{
                              height: '1px',
                              background: '#D4E4E3',
                              margin: '4px 8px',
                            }}
                            className="h-[1px] bg-[#D4E4E3] mx-2 my-1" 
                          />
                        )}
                        {group.title && (
                          <div
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              color: '#A8BCBB',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              padding: '6px 12px 2px',
                            }}
                            className="text-[10px] font-semibold text-[#A8BCBB] uppercase tracking-[0.08em] px-3 pt-1.5 pb-0.5 select-none"
                          >
                            {group.title}
                          </div>
                        )}
                        <div className="space-y-0.5">
                          {group.items.map((subItem) => {
                            const isSubActive = subItem.route ? activeTab === subItem.route : false;
                            return (
                              <button
                                key={subItem.route || subItem.label}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (subItem.action) {
                                    subItem.action();
                                  } else if (subItem.route) {
                                    handleNavigateSubItem(subItem.route);
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  width: '100%',
                                  padding: '9px 12px',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  transition: 'all 100ms ease',
                                  textAlign: 'left',
                                  background: isSubActive ? '#E8F3F2' : 'transparent',
                                  color: isSubActive ? '#5A8A88' : subItem.isDanger ? '#E11D48' : '#2D4A49',
                                  fontSize: '12px',
                                  fontWeight: isSubActive ? 500 : 400,
                                  border: 'none',
                                  outline: 'none',
                                }}
                                className={`w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs transition-all duration-100 cursor-pointer text-left group select-none ${
                                  isSubActive
                                    ? 'bg-[#E8F3F2] text-[#5A8A88] font-medium'
                                    : subItem.isDanger
                                    ? 'text-rose-600 hover:bg-rose-50 font-medium'
                                    : 'text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal'
                                }`}
                              >
                                <div className="flex items-center gap-[10px] min-w-0">
                                  <span className="text-[14px] shrink-0 leading-none">{subItem.emoji}</span>
                                  <span className="truncate text-[12px]">{subItem.label}</span>
                                </div>
                                {isSubActive ? (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88] shrink-0 ml-2" />
                                ) : (
                                  <ChevronRight 
                                    size={13} 
                                    className="text-[#7A9E9C] group-hover:text-[#5A8A88] transition-colors shrink-0 ml-2 opacity-60 group-hover:opacity-100" 
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center font-bold text-2xl mx-auto shadow-xs border-2 border-[#D4E4E3]">
              {user.name.charAt(0)}
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-800">{user.name}</h3>
              <p className="text-xs font-semibold text-[#5A8A88] mt-0.5">{user.role}</p>
              <p className="text-[11px] text-slate-400 mt-1">สาขา: {user.branch === 'Rayong' ? 'ระยอง' : 'กรุงเทพฯ'}</p>
            </div>
            <div className="pt-2 space-y-2">
              <button
                onClick={() => { setShowProfileModal(false); onNavigate('userSettings'); }}
                className="w-full py-2.5 rounded-full bg-[#E8F3F2] text-[#476E6C] font-semibold text-xs hover:bg-[#D8EAE8] transition-colors"
              >
                จัดการบัญชีและความปลอดภัย
              </button>
              <button
                onClick={() => { setShowProfileModal(false); onLogout(); }}
                className="w-full py-2.5 rounded-full bg-rose-50 text-rose-600 font-semibold text-xs hover:bg-rose-100 transition-colors"
              >
                ออกจากระบบ
              </button>
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-full py-2 rounded-full text-slate-400 font-medium text-xs hover:text-slate-600 transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Info Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center mx-auto">
              <Building size={24} />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-800">ข้อมูลสาขา (Branch Info)</h3>
              <p className="text-xs text-slate-600 mt-2 font-medium">
                📍 สาขาปัจจุบัน: <span className="font-bold text-[#5A8A88]">{user.branch === 'Rayong' ? 'สาขาระยอง (Rayong)' : 'สาขากรุงเทพฯ (Bangkok)'}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                ระบบจัดเก็บข้อมูลและประวัติสต็อกแยกตามสาขาเพื่อความถูกต้องของการดำเนินงาน
              </p>
            </div>
            <button
              onClick={() => setShowBranchModal(false)}
              className="w-full py-2.5 rounded-full bg-[#5A8A88] text-white font-semibold text-xs hover:bg-[#476E6C] transition-colors"
            >
              ตกลง (OK)
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default BottomNav;
