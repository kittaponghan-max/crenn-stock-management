import React from 'react';
import { Database } from 'lucide-react';

export interface SupabaseStatusBarProps {
  dbStatus?: 'connected' | 'checking' | 'offline';
}

export const SupabaseStatusBar: React.FC<SupabaseStatusBarProps> = ({
  dbStatus = 'connected',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingTop: '6px',
        paddingBottom: '6px',
        background: '#FFFFFF',
        borderBottom: '1px solid #E8EFEE',
        position: 'relative',
        zIndex: 40,
        flexShrink: 0,
      }}
      className="w-full bg-white border-b border-[#E8EFEE] px-[20px] py-[6px] flex items-center justify-between relative shrink-0 flex-shrink-0 z-40"
    >
      {/* LEFT — Database Status label */}
      <div className="flex items-center gap-[8px]">
        <Database size={14} className="text-[#6B8F8E]" />
        <span className="text-[12px] font-[400] text-[#6B8F8E]">
          Database Status
        </span>
      </div>

      {/* RIGHT — Connection status */}
      <div className="flex items-center gap-[6px]">
        {dbStatus === 'connected' && (
          <>
            <span className="w-[8px] h-[8px] bg-[#22C55E] rounded-full animate-pulse shrink-0" />
            <span className="text-[12px] font-[500] text-[#2D4A49]">
              Supabase • Connected
            </span>
          </>
        )}

        {dbStatus === 'checking' && (
          <>
            <span className="w-[8px] h-[8px] bg-[#F59E0B] rounded-full animate-pulse shrink-0" />
            <span className="text-[12px] font-[400] text-[#92400E]">
              Supabase • Connecting...
            </span>
          </>
        )}

        {dbStatus === 'offline' && (
          <>
            <span className="w-[8px] h-[8px] bg-[#EF4444] rounded-full shrink-0" />
            <span className="text-[12px] font-[400] text-[#991B1B]">
              Supabase • Disconnected
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default SupabaseStatusBar;
