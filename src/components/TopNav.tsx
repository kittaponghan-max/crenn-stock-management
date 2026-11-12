import React from 'react';
import { TopNavCenterIcons } from './TopNavCenterIcons';
import { UserDropdownMenu } from './UserDropdownMenu';

interface TopNavProps {
  userName?: string;
  userRole?: string;
  userBranch?: string;
  onLogoClick?: () => void;
  onAvatarClick?: () => void;
  onLogout?: () => void;
  onSwitchApp?: () => void;
  hasNotification?: boolean;
  outCount?: number;
  lowCount?: number;
  needPurchasing?: number;
  dbStatus?: 'connected' | 'checking' | 'offline';
  activeTab?: string;
  onNavigate?: (tab: string) => void;
  user?: any;
}

export const TopNav: React.FC<TopNavProps> = ({
  userName = 'User',
  userRole,
  userBranch,
  onLogoClick,
  onAvatarClick,
  onLogout,
  outCount = 0,
  lowCount = 0,
  needPurchasing,
  activeTab = 'home',
  onNavigate,
  user,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#D4E4E3] shadow-xs px-4 py-3 w-full">
      <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto flex items-center justify-between">
        
        {/* Brand Name CRENN */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onLogoClick}
            className="text-left group focus:outline-none cursor-pointer"
          >
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-[0.22em] uppercase leading-none font-sans">
              CRENN
            </h1>
            <p className="text-[9px] text-[#5A8A88] font-bold tracking-widest uppercase mt-0.5">
              Cafe Management
            </p>
          </button>
        </div>

        {/* Center Navigation Icons */}
        <TopNavCenterIcons
          activeTab={activeTab}
          onNavigate={onNavigate || ((tab) => {
            if (tab === 'home' && onLogoClick) onLogoClick();
          })}
          outOfStockCount={outCount}
          needPurchasingCount={needPurchasing !== undefined ? needPurchasing : (outCount + lowCount)}
          user={user}
        />

        {/* Right Action Icons: User Avatar Dropdown */}
        <div className="flex items-center gap-2.5 shrink-0">
          <UserDropdownMenu
            user={user}
            userName={userName}
            userRole={userRole}
            userBranch={userBranch}
            onNavigate={onNavigate}
            onLogout={onLogout}
            onAvatarClick={onAvatarClick}
          />
        </div>

      </div>
    </header>
  );
};

export default TopNav;
