import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, AlertCircle, AlertTriangle, Database } from 'lucide-react';
import { TopNavCenterIcons } from './TopNavCenterIcons';

interface TopNavProps {
  userName?: string;
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
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: '56px',
        paddingLeft: '20px',
        paddingRight: '20px',
        background: '#FFFFFF',
        borderBottom: '1px solid #E2EAE9',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
      className="w-full h-[56px] px-[20px] bg-white border-b border-[#E2EAE9] sticky top-0 z-50 flex items-center justify-between"
    >
      {/* LEFT — Brand block */}
      <div
        onClick={onLogoClick}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '1px',
        }}
        className={`flex flex-col items-start gap-[1px] select-none shrink-0 ${onLogoClick ? 'cursor-pointer' : ''}`}
      >
        <span
          style={{
            fontSize: '20px',
            fontWeight: 800,
            color: '#1E3A3A',
            letterSpacing: '0.02em',
            lineHeight: 1.1,
          }}
          className="text-[20px] font-[800] text-[#1E3A3A] tracking-[0.02em] leading-[1.1]"
        >
          CRENN
        </span>
        <span
          style={{
            fontSize: '8px',
            fontWeight: 500,
            color: '#7A9E9C',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            lineHeight: 1,
            marginTop: '1px',
          }}
          className="text-[8px] font-[500] text-[#7A9E9C] tracking-[0.18em] uppercase leading-[1] mt-[1px]"
        >
          CAFE MANAGEMENT
        </span>
      </div>

      {/* CENTER — Navigation Icons */}
      <TopNavCenterIcons
        activeTab={activeTab}
        onNavigate={onNavigate || ((tab) => {
          if (tab === 'home' && onLogoClick) onLogoClick();
        })}
        outOfStockCount={outCount}
        needPurchasingCount={needPurchasing !== undefined ? needPurchasing : (outCount + lowCount)}
      />

      {/* RIGHT — Icon group */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
        className="flex items-center gap-[8px] shrink-0"
      >
        {/* BELL BUTTON */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#F0F5F4',
              border: '1px solid #E2EAE9',
              cursor: 'pointer',
              position: 'relative',
              flexShrink: 0,
            }}
            className="w-[36px] h-[36px] rounded-full bg-[#F0F5F4] border border-[#E2EAE9] flex items-center justify-center cursor-pointer relative hover:bg-[#E8F3F2] transition-colors focus:outline-none shrink-0"
            title="การแจ้งเตือน"
          >
            <Bell size={16} strokeWidth={1.5} className="text-[#5A8A88]" />
            {showDot && (
              <span
                style={{
                  position: 'absolute',
                  top: '7px',
                  right: '7px',
                  width: '7px',
                  height: '7px',
                  background: '#EF4444',
                  borderRadius: '50%',
                  border: '1.5px solid #FFFFFF',
                }}
                className="absolute top-[7px] right-[7px] w-[7px] h-[7px] bg-[#EF4444] rounded-full border-[1.5px] border-white pointer-events-none"
              />
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

        {/* AVATAR PILL */}
        <button
          type="button"
          onClick={onAvatarClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: '#F0F5F4',
            border: '1px solid #E2EAE9',
            borderRadius: '9999px',
            padding: '3px 10px 3px 3px',
            cursor: 'pointer',
          }}
          className="flex items-center gap-[6px] bg-[#F0F5F4] border border-[#E2EAE9] rounded-full py-[3px] pr-[10px] pl-[3px] cursor-pointer hover:bg-[#E8F3F2] transition-colors focus:outline-none"
          title="โปรไฟล์ผู้ใช้"
        >
          {/* Avatar circle */}
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#5A8A88',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            className="w-[28px] h-[28px] rounded-full bg-[#5A8A88] flex items-center justify-center shrink-0"
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#FFFFFF',
                textTransform: 'uppercase',
              }}
              className="text-[12px] font-[600] text-white uppercase"
            >
              {initial}
            </span>
          </div>

          {/* Day label */}
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#2D4A49',
              whiteSpace: 'nowrap',
            }}
            className="text-[12px] font-[500] text-[#2D4A49] whitespace-nowrap"
          >
            {dayLabel}
          </span>
        </button>
      </div>
    </header>
  );
};

export default TopNav;
