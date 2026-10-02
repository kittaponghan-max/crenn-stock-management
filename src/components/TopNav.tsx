import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, AlertCircle, AlertTriangle, Database } from 'lucide-react';
import { TopNavCenterIcons } from './TopNavCenterIcons';

interface TopNavProps {
  userName?: string;
  userRole?: string;
  onLogoClick?: () => void;
  onAvatarClick?: () => void;
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
  hasNotification = true,
  outCount = 0,
  lowCount = 0,
  needPurchasing,
  dbStatus = 'connected',
  activeTab = 'home',
  onNavigate,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const initial = (userName || 'U').charAt(0).toUpperCase();

  // Close notifications on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const showDot = hasNotification || outCount > 0 || lowCount > 0;

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

        {/* Right Action Icons: Notification Bell + User Avatar */}
        <div className="flex items-center gap-2.5 shrink-0">
          
          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(prev => !prev)}
              className="w-9 h-9 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] text-[#5A8A88] flex items-center justify-center transition-colors relative focus:outline-none shadow-xs cursor-pointer"
              title="การแจ้งเตือน"
            >
              <Bell size={18} />
              {showDot && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-pulse" />
              )}
            </button>

            {/* Notification Popup Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[#D4E4E3] p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">การแจ้งเตือนสต็อก (Alerts)</span>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto text-xs">
                  {outCount > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                      <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">สินค้าหมดสต็อก {outCount} รายการ</p>
                        <p className="text-[11px] text-rose-600 mt-0.5">กรุณาตรวจสอบและสั่งซื้อด่วน</p>
                      </div>
                    </div>
                  )}

                  {lowCount > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
                      <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">สินค้าใกล้หมด {lowCount} รายการ</p>
                        <p className="text-[11px] text-amber-600 mt-0.5">ต่ำกว่าเกณฑ์ขั้นต่ำที่กำหนด</p>
                      </div>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-[#E8F3F2] border border-[#D4E4E3] text-[#476E6C] flex items-start gap-2">
                    <Database size={15} className="text-[#5A8A88] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">ระบบออนไลน์ (Supabase)</p>
                      <p className="text-[11px] text-[#5A8A88] mt-0.5">
                        {dbStatus === 'connected' ? 'เชื่อมต่อฐานข้อมูลเรียบร้อยแล้ว' : 'กำลังเชื่อมต่อหรือออฟไลน์'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

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
