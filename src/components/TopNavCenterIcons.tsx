import React from 'react';
import { 
  Home, 
  Package, 
  ClipboardList, 
  CheckSquare, 
  ShoppingCart, 
  Cake, 
  FlaskConical 
} from 'lucide-react';

export interface TopNavCenterIconsProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
  outOfStockCount?: number;
  needPurchasingCount?: number;
}

export const TopNavCenterIcons: React.FC<TopNavCenterIconsProps> = ({
  activeTab = 'home',
  onNavigate,
  outOfStockCount = 0,
  needPurchasingCount = 0,
}) => {
  const isItemActive = (id: string, currentTab: string) => {
    if (id === 'home') return currentTab === 'home' || currentTab === 'dashboard';
    if (id === 'stock') {
      return ['barStock', 'bakeryStock', 'barDailyCount', 'bakeryDailyCount', 'stock'].includes(currentTab);
    }
    if (id === 'reports') {
      return [
        'logs', 'reports', 'stockSubmitHistory', 'receivingHistory',
        'barReceiving', 'bakeryReceiving', 'barWaste', 'barWasteLog', 'bakeryWasteLog'
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

  const NAV_ITEMS = [
    { id: 'home', label: 'หน้าหลัก', icon: Home, route: 'home', showBadge: false },
    { id: 'stock', label: 'สต็อก', icon: Package, route: 'barStock', showBadge: outOfStockCount > 0 },
    { id: 'reports', label: 'รายงาน', icon: ClipboardList, route: 'logs', showBadge: false },
    { id: 'checkin', label: 'Check-in', icon: CheckSquare, route: 'barChecklist', showBadge: false },
    { id: 'purchasing', label: 'Purchasing', icon: ShoppingCart, route: 'barPurchasing', showBadge: needPurchasingCount > 0 },
    { id: 'bakery', label: 'Bakery', icon: Cake, route: 'bakeryPlan', showBadge: false },
    { id: 'rnd', label: 'R&D', icon: FlaskConical, route: 'rndReport', showBadge: false },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        flex: 1,
        padding: '0 16px',
      }}
      className="hidden md:flex items-center justify-center gap-[4px] flex-1 px-[16px]"
    >
      {NAV_ITEMS.map((item) => {
        const active = isItemActive(item.id, activeTab);
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate?.(item.route)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              padding: '6px 10px',
              borderRadius: '8px',
              minWidth: '48px',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 150ms ease',
              background: active ? '#E8F3F2' : 'transparent',
              color: active ? '#5A8A88' : '#A8BCBB',
              fontWeight: active ? 600 : 400,
            }}
            className={`flex flex-col items-center justify-center py-[6px] px-[10px] rounded-[8px] transition-all duration-150 relative min-w-[48px] cursor-pointer ${
              active
                ? 'bg-[#E8F3F2] text-[#5A8A88] font-semibold'
                : 'text-[#A8BCBB] hover:bg-[#F0F5F4] hover:text-[#5A8A88]'
            }`}
            title={item.label}
          >
            <Icon size={18} strokeWidth={1.5} />
            <span
              style={{
                fontSize: '9px',
                fontWeight: active ? 600 : 400,
                color: active ? '#5A8A88' : '#A8BCBB',
                marginTop: '2px',
                whiteSpace: 'nowrap',
              }}
              className={`block text-[9px] mt-[2px] leading-tight tracking-tight whitespace-nowrap ${
                active ? 'text-[#5A8A88] font-[600]' : 'text-[#A8BCBB] font-[400]'
              }`}
            >
              {item.label}
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
        );
      })}
    </div>
  );
};

export default TopNavCenterIcons;
