import React from 'react';
import { TopNavCenterIcons } from './TopNavCenterIcons';

interface TopNavProps {
  userName?: string;
  userRole?: string;
  onLogoClick?: () => void;
  onAvatarClick?: () => void;
  onSwitchApp?: () => void;
  hasNotification?: boolean;
  outCount?: number;
  lowCount?: number;
  needPurchasing?: number;
  dbStatus?: 'connected' | 'checking' | 'offline';
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  userName = 'User',
  userRole,
  onLogoClick,
  onAvatarClick,
  outCount = 0,
  lowCount = 0,
  needPurchasing,
  activeTab = 'home',
  onNavigate,
}) => {
  const initial = (userName || 'U').charAt(0).toUpperCase();

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
        />

        {/* Right Action Icons: User Avatar */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* User Avatar Pill */}
          <button
            type="button"
            onClick={onAvatarClick}
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#D4E4E3] transition-colors focus:outline-none shadow-xs cursor-pointer"
            title="โปรไฟล์ผู้ใช้"
          >
            <div className="w-7 h-7 rounded-full bg-[#5A8A88] text-white flex items-center justify-center text-xs font-bold uppercase">
              {initial}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-[11px] font-bold text-slate-800 leading-tight">
                {userName}
              </p>
              {userRole && (
                <p className="text-[9px] text-[#5A8A88] font-semibold leading-tight capitalize">
                  {userRole}
                </p>
              )}
            </div>
          </button>
        </div>

      </div>
    </header>
  );
};

export default TopNav;
