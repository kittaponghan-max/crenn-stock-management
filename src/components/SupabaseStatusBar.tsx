import React from 'react';
import { Loader2 } from 'lucide-react';

export interface SupabaseStatusBarProps {
  dbStatus?: 'connected' | 'checking' | 'offline';
  onSwitchApp?: () => void;
}

export const SupabaseStatusBar: React.FC<SupabaseStatusBarProps> = ({
  dbStatus = 'connected',
  onSwitchApp,
}) => {
  return (
    <section className="w-full relative bg-white/80 backdrop-blur-xs border-b border-[#D4E4E3] shadow-xs px-4 md:px-6 lg:px-8 py-2 z-10 shrink-0">
      <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto flex items-center justify-between text-xs min-h-[32px]">
        {/* Left: ProdCalc Button (replacing Database Status text) */}
        <div className="flex items-center gap-2">
          {onSwitchApp && (
            <button
              type="button"
              onClick={onSwitchApp}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EEF6FB] hover:bg-[#DDF0F8] border border-[#5BA4C8] text-[#1E5A7A] transition-colors focus:outline-none shadow-xs text-xs font-bold cursor-pointer"
              title="เปิดแอปพลิเคชัน ProdCalc (คำนวณต้นทุนการผลิต)"
            >
              <span className="text-sm">🧮</span>
              <span>ProdCalc</span>
            </button>
          )}
        </div>

        {/* Right: Supabase Status indicator */}
        <div className="flex items-center gap-1.5 font-semibold text-[11px]">
          {dbStatus === 'connected' && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E] shadow-[0_0_6px_#22C55E]"></span>
              </span>
              <span className="text-emerald-700">Supabase ● Connected</span>
            </>
          )}

          {dbStatus === 'checking' && (
            <>
              <Loader2 size={12} className="animate-spin text-amber-500" />
              <span className="text-amber-700">Supabase ● Connecting...</span>
            </>
          )}

          {dbStatus === 'offline' && (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span className="text-rose-700">Supabase ● Disconnected (Offline)</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default SupabaseStatusBar;
