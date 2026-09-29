import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, AlertCircle, AlertTriangle, Database } from 'lucide-react';

interface TopNavProps {
  userName?: string;
  onLogoClick?: () => void;
  onAvatarClick?: () => void;
  hasNotification?: boolean;
  outCount?: number;
  lowCount?: number;
  dbStatus?: 'connected' | 'checking' | 'offline';
}

export const TopNav: React.FC<TopNavProps> = ({
  userName = 'User',
  onLogoClick,
  onAvatarClick,
  hasNotification = true,
  outCount = 0,
  lowCount = 0,
  dbStatus = 'connected',
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const initial = (userName || 'U').charAt(0).toUpperCase();
  const dayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short' });

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
    <header className="w-full h-[56px] px-6 bg-white border-b border-[#E2EAE9] sticky top-0 z-50 flex items-center justify-between">
      {/* LEFT SECTION */}
      <div
        onClick={onLogoClick}
        className={`flex flex-col items-start gap-[1px] select-none ${onLogoClick ? 'cursor-pointer' : ''}`}
      >
        <span className="text-[18px] font-extrabold text-[#1E3A3A] tracking-[0.05em] leading-[1.1]">
          CRENN
        </span>
        <span className="text-[8px] font-medium text-[#7A9E9C] tracking-[0.2em] uppercase leading-none">
          CAFE MANAGEMENT
        </span>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex items-center gap-2">
        {/* ELEMENT 1 — Bell notification button */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(prev => !prev)}
            className="w-[36px] h-[36px] rounded-full bg-[#F0F5F4] border border-[#E2EAE9] flex items-center justify-center cursor-pointer relative hover:bg-[#E8F3F2] transition-colors focus:outline-none"
            title="การแจ้งเตือน"
          >
            <Bell size={16} strokeWidth={1.5} className="text-[#5A8A88]" />
            {showDot && (
              <span className="absolute top-[6px] right-[6px] w-[7px] h-[7px] bg-[#EF4444] rounded-full border-[1.5px] border-white pointer-events-none" />
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
                  className="text-slate-400 hover:text-slate-600 focus:outline-none"
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

        {/* ELEMENT 2 — Avatar + Day pill */}
        <button
          type="button"
          onClick={onAvatarClick}
          className="flex items-center gap-[6px] bg-[#F0F5F4] border border-[#E2EAE9] rounded-full py-[3px] pr-[10px] pl-[3px] cursor-pointer hover:bg-[#E8F3F2] transition-colors focus:outline-none"
          title="โปรไฟล์ผู้ใช้"
        >
          {/* Avatar circle */}
          <div className="w-[28px] h-[28px] rounded-full bg-[#5A8A88] flex items-center justify-center shrink-0">
            <span className="text-[12px] font-semibold text-white uppercase">
              {initial}
            </span>
          </div>

          {/* Day label */}
          <span className="text-[12px] font-medium text-[#2D4A49]">
            {dayLabel}
          </span>
        </button>
      </div>
    </header>
  );
};

export default TopNav;
