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
    if (id === 'stock') return ['barStock', 'bakeryStock', 'barDailyCount', 'bakeryDailyCount'].includes(currentTab);
    if (id === 'reports') {
      return [
        'logs', 'reports', 'stockSubmitHistory', 'receivingHistory', 'checklistHistory',
        'barReceiving', 'bakeryReceiving', 'barWaste', 'barWasteLog', 'bakeryWasteLog'
      ].includes(currentTab);
    }
    if (id === 'checkin') return ['barChecklist', 'bakeryChecklist'].includes(currentTab);
    if (id === 'purchasing') return ['barPurchasing', 'purchasing'].includes(currentTab);
    if (id === 'bakery') return ['bakeryPlan', 'bakeryPlanHistory'].includes(currentTab);
    if (id === 'rnd') return currentTab === 'rndReport';
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
      className="hidden md:flex items-center justify-center gap-1 lg:gap-1.5 flex-1 px-2 lg:px-4"
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
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 150ms ease',
              minWidth: '48px',
              background: active ? '#E8F3F2' : 'transparent',
              color: active ? '#5A8A88' : '#A8BCBB',
              fontWeight: active ? 600 : 400,
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-2 lg:px-2.5 rounded-lg transition-all duration-150 relative min-w-[44px] lg:min-w-[48px] ${
              active
                ? 'bg-[#E8F3F2] text-[#5A8A88] font-semibold'
                : 'text-[#A8BCBB] hover:bg-[#F0F5F4] hover:text-[#5A8A88]'
            }`}
            title={item.label}
          >
            <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
            <span
              style={{
                fontSize: '9px',
                fontWeight: active ? 600 : 400,
              }}
              className="hidden lg:block text-[9px] mt-0.5 leading-tight tracking-tight"
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
