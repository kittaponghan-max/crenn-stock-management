import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, 
  BookOpen,
  Package, 
  ClipboardList, 
  CheckSquare, 
  ShoppingCart, 
  Cake, 
  FlaskConical,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

export interface TopNavCenterIconsProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
  outOfStockCount?: number;
  needPurchasingCount?: number;
}

interface SubMenuItem {
  route: string;
  label: string;
  emoji: string;
}

interface SubMenuGroup {
  title?: string;
  items: SubMenuItem[];
}

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties; className?: string }>;
  route: string;
  showBadge: boolean;
  hasDropdown: boolean;
  dropdownWidth?: string;
  dropdownAlignment?: 'left' | 'center' | 'right';
  groups?: SubMenuGroup[];
}

export const TopNavCenterIcons: React.FC<TopNavCenterIconsProps> = ({
  activeTab = 'home',
  onNavigate,
  outOfStockCount = 0,
  needPurchasingCount = 0,
}) => {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
      setOpenDropdownId(null);
    }, delay);
  };

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      clearCloseTimer();
    };
  }, []);

  const isItemActive = (id: string, currentTab: string) => {
    if (id === 'home') return currentTab === 'home' || currentTab === 'dashboard';
    if (id === 'dailyrecord') {
      return ['dailySales', 'dailyBakery'].includes(currentTab);
    }
    if (id === 'stock') {
      return ['barStock', 'bakeryStock', 'stock'].includes(currentTab);
    }
    if (id === 'reports') {
      return [
        'logs', 'reports', 'stockSubmitHistory', 'receivingHistory',
        'barReceiving', 'bakeryReceiving', 'barDailyCount', 'bakeryDailyCount',
        'barWaste', 'barWasteLog', 'bakeryWasteLog'
      ].includes(currentTab);
    }
    if (id === 'checkin') {
      return ['barChecklist', 'bakeryChecklist', 'checklistHistory', 'checkin'].includes(currentTab);
    }
    if (id === 'purchasing') {
      return ['barPurchasing', 'purchasing'].includes(currentTab);
    }
    if (id === 'bakery') {
      return ['bakeryPlan', 'bakeryPlanHistory', 'bakery'].includes(currentTab);
    }
    if (id === 'rnd') {
      return ['rndReport', 'rnd'].includes(currentTab);
    }
    return currentTab === id;
  };

  const NAV_ITEMS: NavItemConfig[] = [
    {
      id: 'home',
      label: 'หน้าหลัก',
      icon: Home,
      route: 'home',
      showBadge: false,
      hasDropdown: false,
    },
    {
      id: 'dailyrecord',
      label: 'Daily Rec.',
      icon: BookOpen,
      route: 'dailySales',
      showBadge: false,
      hasDropdown: true,
      dropdownWidth: 'min-w-[260px] w-auto',
      dropdownAlignment: 'left',
      groups: [
        {
          items: [
            {
              route: 'dailySales',
              label: 'บันทึกยอดขายประจำวัน',
              emoji: '💰'
            },
            {
              route: 'dailyBakery',
              label: 'บันทึกจำนวนขนมประจำวัน',
              emoji: '🧁'
            },
          ],
        },
      ],
    },
    {
      id: 'stock',
      label: 'สต็อก',
      icon: Package,
      route: 'barStock',
      showBadge: outOfStockCount > 0,
      hasDropdown: true,
      dropdownWidth: 'min-w-[240px] w-auto',
      dropdownAlignment: 'left',
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
      route: 'logs',
      showBadge: false,
      hasDropdown: true,
      dropdownWidth: 'min-w-[280px] w-auto',
      dropdownAlignment: 'center',
      groups: [
        {
          title: 'รายงานประจำวัน',
          items: [
            { route: 'barReceiving', label: 'รายงานตรวจรับวัตถุดิบ (บาร์)', emoji: '📦' },
            { route: 'bakeryReceiving', label: 'รายงานตรวจรับวัตถุดิบ (ครัว)', emoji: '📦' },
            { route: 'barDailyCount', label: 'รายงานตรวจนับสต็อก (บาร์)', emoji: '📋' },
            { route: 'bakeryDailyCount', label: 'รายงานตรวจนับสต็อก (ครัว)', emoji: '📋' },
            { route: 'barWasteLog', label: 'รายงาน Waste/ของเสีย (บาร์)', emoji: '🗑️' },
            { route: 'bakeryWasteLog', label: 'รายงาน Waste/ของเสีย (ครัว)', emoji: '🗑️' },
            { route: 'barWaste', label: 'รายงาน Waste เมล็ดกาแฟ', emoji: '☕' },
          ],
        },
        {
          title: 'ประวัติย้อนหลัง',
          items: [
            { route: 'logs', label: 'ประวัติการแก้ไขข้อมูล', emoji: '🕐' },
            { route: 'stockSubmitHistory', label: 'ประวัติรายงานนับสต็อก', emoji: '🕐' },
            { route: 'receivingHistory', label: 'ประวัติการรับวัตถุดิบ', emoji: '🕐' },
          ],
        },
      ],
    },
    {
      id: 'checkin',
      label: 'Check-in',
      icon: CheckSquare,
      route: 'barChecklist',
      showBadge: false,
      hasDropdown: true,
      dropdownWidth: 'min-w-[280px] w-auto',
      dropdownAlignment: 'center',
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
      route: 'barPurchasing',
      showBadge: needPurchasingCount > 0,
      hasDropdown: false,
    },
    {
      id: 'bakery',
      label: 'Bakery',
      icon: Cake,
      route: 'bakeryPlan',
      showBadge: false,
      hasDropdown: true,
      dropdownWidth: 'min-w-[280px] w-auto',
      dropdownAlignment: 'right',
      groups: [
        {
          items: [
            { route: 'bakeryPlan', label: 'แผนงาน Bakery', emoji: '🧁' },
            { route: 'bakeryPlanHistory', label: 'ประวัติแผนงาน Bakery (24 สัปดาห์)', emoji: '🕐' },
          ],
        },
      ],
    },
    {
      id: 'rnd',
      label: 'R&D',
      icon: FlaskConical,
      route: 'rndReport',
      showBadge: false,
      hasDropdown: false,
    },
  ];

  const handleTabClick = (item: NavItemConfig) => {
    if (item.hasDropdown) {
      setOpenDropdownId((prev) => (prev === item.id ? null : item.id));
    } else {
      setOpenDropdownId(null);
      onNavigate?.(item.route);
    }
  };

  const handleTabMouseEnter = (item: NavItemConfig) => {
    clearCloseTimer();
    setHoveredId(item.id);
    if (item.hasDropdown) {
      setOpenDropdownId(item.id);
    } else {
      setOpenDropdownId(null);
    }
  };

  const handleTabMouseLeave = (item: NavItemConfig) => {
    setHoveredId(null);
    if (item.hasDropdown) {
      scheduleClose(220);
    }
  };

  const handleDropdownMouseEnter = () => {
    clearCloseTimer();
  };

  const handleDropdownMouseLeave = () => {
    scheduleClose(200);
  };

  const handleNavigateSubItem = (route: string) => {
    clearCloseTimer();
    setOpenDropdownId(null);
    onNavigate?.(route);
  };

  const getDropdownStyle = (item: NavItemConfig): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      top: 'calc(100% + 4px)',
      zIndex: 100,
      minWidth: '260px',
      boxShadow: '0 8px 24px rgba(45,74,73,0.12)',
    };

    if (item.dropdownAlignment === 'left') {
      return {
        ...baseStyle,
        left: 0,
        right: 'auto',
        transform: 'none',
      };
    }
    if (item.dropdownAlignment === 'right') {
      return {
        ...baseStyle,
        right: 0,
        left: 'auto',
        transform: 'none',
      };
    }
    return {
      ...baseStyle,
      left: '50%',
      transform: 'translateX(-50%)',
    };
  };

  return (
    <div
      ref={containerRef}
      className="hidden md:flex items-center justify-center gap-[2px] flex-1 px-[8px] relative overflow-visible"
    >
      {NAV_ITEMS.map((item) => {
        const active = isItemActive(item.id, activeTab);
        const isOpen = openDropdownId === item.id;
        const hovered = hoveredId === item.id;
        const Icon = item.icon;

        let bg = 'transparent';
        let color = '#A8BCBB';
        if (active || isOpen) {
          bg = '#E8F3F2';
          color = '#5A8A88';
        } else if (hovered) {
          bg = '#F0F5F4';
          color = '#5A8A88';
        }

        return (
          <div key={item.id} className="relative overflow-visible">
            <button
              type="button"
              onClick={() => handleTabClick(item)}
              onMouseEnter={() => handleTabMouseEnter(item)}
              onMouseLeave={() => handleTabMouseLeave(item)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                padding: '6px 8px',
                borderRadius: '8px',
                minWidth: '40px',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 150ms ease',
                background: bg,
                border: 'none',
                outline: 'none',
              }}
              className={`flex flex-col items-center justify-center gap-[2px] px-[8px] py-[6px] rounded-lg min-w-[40px] cursor-pointer relative transition-all duration-150 ${
                active || isOpen
                  ? 'bg-[#E8F3F2]'
                  : 'hover:bg-[#F0F5F4]'
              }`}
              title={item.label}
              aria-expanded={isOpen}
              aria-haspopup={item.hasDropdown}
            >
              <Icon 
                size={18} 
                strokeWidth={1.5} 
                style={{
                  color: color,
                  transition: 'color 150ms ease',
                }}
              />
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: active || isOpen ? 600 : 400,
                  color: color,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  marginTop: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  maxWidth: '52px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: 'color 150ms ease',
                }}
                className={`text-[9px] leading-none whitespace-nowrap flex items-center gap-[2px] max-w-[52px] truncate ${
                  active || isOpen ? 'font-semibold text-[#5A8A88]' : 'font-normal text-[#A8BCBB]'
                }`}
              >
                {item.label}
                {item.hasDropdown && (
                  <ChevronDown 
                    size={7} 
                    className={`transition-transform duration-150 shrink-0 ${isOpen ? 'rotate-180 text-[#5A8A88]' : 'text-current opacity-60'}`} 
                  />
                )}
              </span>
              {item.showBadge && (
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    backgroundColor: '#EF4444',
                    borderRadius: '50%',
                    border: '1.5px solid #FFFFFF',
                    position: 'absolute',
                    top: '4px',
                    right: '6px',
                  }}
                  className="absolute top-[4px] right-[6px] w-[7px] h-[7px] bg-[#EF4444] rounded-full border-[1.5px] border-white pointer-events-none"
                />
              )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && item.groups && (
              <div
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleDropdownMouseLeave}
                style={getDropdownStyle(item)}
                className={`absolute top-[calc(100%+4px)] ${
                  item.dropdownAlignment === 'left'
                    ? 'left-0'
                    : item.dropdownAlignment === 'right'
                    ? 'right-0'
                    : 'left-1/2 -translate-x-1/2'
                } ${item.dropdownWidth || 'min-w-[260px] w-auto'} bg-white rounded-2xl shadow-xl border border-[#D4E4E3] p-2 z-[100] animate-in fade-in zoom-in-95 duration-150 max-h-[80vh] overflow-y-auto`}
              >
                {/* Invisible hover bridge to prevent mouseleave between button and menu */}
                <div 
                  className="absolute -top-3 left-0 right-0 h-3 bg-transparent" 
                  aria-hidden="true" 
                />

                {item.groups.map((group, groupIdx) => (
                  <div key={groupIdx} className={groupIdx > 0 ? 'mt-2 pt-2 border-t border-[#E2EAE9]' : ''}>
                    {group.title && (
                      <div className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-[#5A8A88] uppercase tracking-wider select-none">
                        {group.title}
                      </div>
                    )}
                    <div className="space-y-1">
                      {group.items.map((subItem) => {
                        const isSubActive = activeTab === subItem.route;
                        return (
                          <button
                            key={subItem.route}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigateSubItem(subItem.route);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 cursor-pointer text-left group select-none ${
                              isSubActive
                                ? 'bg-[#E8F3F2] text-[#2D4A49] font-bold shadow-xs'
                                : 'text-slate-700 hover:bg-[#F0F5F4] hover:text-[#1E3A3A] font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-1">
                              <span className="text-sm shrink-0 leading-none">{subItem.emoji}</span>
                              <span className="whitespace-normal break-words text-[12px] text-[#2D4A49] flex-1 text-left leading-tight">
                                {subItem.label}
                              </span>
                            </div>
                            {isSubActive ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88] shrink-0 ml-2" />
                            ) : (
                              <ChevronRight size={13} className="text-slate-300 group-hover:text-[#5A8A88] transition-colors shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TopNavCenterIcons;
