import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  History,
  Settings2,
  Coffee,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sendDiscordNotification } from '../../lib/discordNotify';
import { generateUUID } from '../../lib/utils';
import {
  AttendanceMode,
  AttendanceRecord,
  AttendanceType,
  BranchGeofenceConfig,
} from '../../types/hellocrenn';
import {
  evaluateAttendanceStatus,
  formatDistanceMeters,
  formatOtDuration,
  getDefaultGeofenceConfig,
  getStatusLabelTH,
  normalizeGeofenceConfig,
} from '../../utils/gpsUtils';
import { toLocalDateStr, formatThaiNumericDate } from '../ui';
import { AttendanceScanner } from './AttendanceScanner';
import { AttendanceHistory } from './AttendanceHistory';
import { GeofenceSettings } from './GeofenceSettings';

interface HelloCrennAppProps {
  currentUser: {
    name: string;
    role: string;
    branch: string;
  };
  onSwitchToCafe: () => void;
  onSwitchToProdCalc?: () => void;
  onLogout: () => void;
  canEditGeofence?: boolean;
  isReadOnly?: boolean;
}

const getGeofenceStorageKey = (branch: string) => `hellocrenn-geofence-${branch}`;
const getAttendanceStorageKey = (branch: string) => `hellocrenn-attendance-${branch}`;

export function HelloCrennApp({
  currentUser,
  onSwitchToCafe,
  onSwitchToProdCalc,
  onLogout,
  canEditGeofence = false,
  isReadOnly = false,
}: HelloCrennAppProps) {
  const [currentTab, setCurrentTab] = useState<'scan' | 'history' | 'settings'>('scan');
  const [dbStatus, setDbStatus] = useState<'connected' | 'checking' | 'offline'>(
    supabase ? 'checking' : 'offline'
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [geofenceConfig, setGeofenceConfig] = useState<BranchGeofenceConfig>(() => {
    try {
      const saved = localStorage.getItem(getGeofenceStorageKey(currentUser.branch));
      if (saved) return normalizeGeofenceConfig(JSON.parse(saved), currentUser.branch);
    } catch {}
    return getDefaultGeofenceConfig(currentUser.branch);
  });

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem(getAttendanceStorageKey(currentUser.branch));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  // Load geofence config and attendance logs from dedicated Supabase tables (with app_settings fallback)
  useEffect(() => {
    if (!supabase) {
      setDbStatus('offline');
      return;
    }

    let isMounted = true;
    setDbStatus('checking');

    const loadFromSupabase = async () => {
      try {
        const [geoTableRes, logsTableRes, settingsRes] = await Promise.all([
          supabase
            .from('branch_geofences')
            .select('*')
            .eq('branch', currentUser.branch)
            .maybeSingle(),
          supabase
            .from('attendance_logs')
            .select('*')
            .eq('branch', currentUser.branch)
            .order('recorded_at', { ascending: false })
            .limit(1000),
          supabase
            .from('app_settings')
            .select('setting_key, setting_value')
            .eq('branch', currentUser.branch)
            .in('setting_key', ['hellocrenn_geofence_config', 'hellocrenn_attendance_logs']),
        ]);

        if (!isMounted) return;

        const hasTableConnection = !geoTableRes.error || !logsTableRes.error;
        const hasSettingsConnection = !settingsRes.error;
        if (!hasTableConnection && !hasSettingsConnection) {
          setDbStatus('offline');
          return;
        }
        setDbStatus('connected');

        // 1. Resolve Geofence Config (authoritative table first, fallback app_settings)
        if (!geoTableRes.error && geoTableRes.data) {
          const r = geoTableRes.data as any;
          const normalized = normalizeGeofenceConfig(
            {
              branch: r.branch,
              branchLabel: r.branch_label,
              latitude: r.latitude,
              longitude: r.longitude,
              radiusMeters: r.radius_meters,
              maxAccuracyMeters: r.max_accuracy_meters,
              shiftStartTime: r.shift_start_time,
              shiftEndTime: r.shift_end_time,
              graceMinutes: r.grace_minutes,
              otStepMinutes: r.ot_step_minutes,
              employeeShifts: r.employee_shifts,
              autoCheckinEnabled: r.auto_checkin_enabled,
              autoCheckoutEnabled: r.auto_checkout_enabled,
              isConfigured: r.is_configured,
              updatedBy: r.updated_by,
              updatedAt: r.updated_at,
            },
            currentUser.branch
          );
          setGeofenceConfig(normalized);
          try {
            localStorage.setItem(getGeofenceStorageKey(currentUser.branch), JSON.stringify(normalized));
          } catch {}
        } else if (!settingsRes.error && settingsRes.data) {
          const geoRow = settingsRes.data.find((r: any) => r.setting_key === 'hellocrenn_geofence_config');
          if (geoRow?.setting_value) {
            const normalized = normalizeGeofenceConfig(geoRow.setting_value, currentUser.branch);
            setGeofenceConfig(normalized);
            try {
              localStorage.setItem(getGeofenceStorageKey(currentUser.branch), JSON.stringify(normalized));
            } catch {}
          } else {
            setGeofenceConfig(getDefaultGeofenceConfig(currentUser.branch));
          }
        }

        // 2. Resolve Attendance Records (authoritative attendance_logs table first, fallback app_settings)
        if (!logsTableRes.error && Array.isArray(logsTableRes.data)) {
          const mapped: AttendanceRecord[] = logsTableRes.data.map((r: any) => ({
            id: r.id,
            branch: r.branch,
            date: typeof r.date === 'string' ? r.date.slice(0, 10) : String(r.date),
            userName: r.user_name,
            userRole: r.user_role || '',
            type: r.type,
            recordedAt: r.recorded_at,
            timeDisplay: r.time_display,
            latitude: Number(r.latitude),
            longitude: Number(r.longitude),
            distanceMeters: Number(r.distance_meters || 0),
            accuracyMeters: Number(r.accuracy_meters || 0),
            status: r.status,
            mode: r.mode,
            otMinutes: Number(r.ot_minutes || 0),
            note: r.note || undefined,
          }));
          setAttendanceRecords(mapped);
          try {
            localStorage.setItem(getAttendanceStorageKey(currentUser.branch), JSON.stringify(mapped));
          } catch {}
        } else if (!settingsRes.error && settingsRes.data) {
          const logsRow = settingsRes.data.find((r: any) => r.setting_key === 'hellocrenn_attendance_logs');
          if (logsRow?.setting_value && Array.isArray(logsRow.setting_value)) {
            setAttendanceRecords(logsRow.setting_value as AttendanceRecord[]);
            try {
              localStorage.setItem(
                getAttendanceStorageKey(currentUser.branch),
                JSON.stringify(logsRow.setting_value)
              );
            } catch {}
          }
        }
      } catch {
        if (isMounted) setDbStatus('offline');
      }
    };

    loadFromSupabase();
    return () => {
      isMounted = false;
    };
  }, [currentUser.branch]);

  const handleRecordAttendance = useCallback(
    async (payload: {
      type: AttendanceType;
      mode: AttendanceMode;
      latitude: number;
      longitude: number;
      distanceMeters: number;
      accuracyMeters: number;
      note?: string;
    }): Promise<AttendanceRecord | null> => {
      if (isReadOnly) return null;

      const now = new Date();
      const dateStr = toLocalDateStr(now);
      const timeDisplay = now.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const alreadyRecorded = attendanceRecords.some(
        (r) =>
          r.date === dateStr &&
          r.branch === currentUser.branch &&
          r.userName.toLowerCase() === currentUser.name.toLowerCase() &&
          r.type === payload.type
      );
      if (alreadyRecorded) return null;

      const evalResult = evaluateAttendanceStatus(
        payload.type,
        now,
        geofenceConfig,
        currentUser.name
      );

      const newRecord: AttendanceRecord = {
        id: generateUUID(),
        branch: currentUser.branch,
        date: dateStr,
        userName: currentUser.name,
        userRole: currentUser.role,
        type: payload.type,
        recordedAt: now.toISOString(),
        timeDisplay,
        latitude: payload.latitude,
        longitude: payload.longitude,
        distanceMeters: payload.distanceMeters,
        accuracyMeters: payload.accuracyMeters,
        status: evalResult.status,
        mode: payload.mode,
        otMinutes: evalResult.otMinutes,
        note: payload.note,
      };

      const nextRecords = [newRecord, ...attendanceRecords].slice(0, 1500);
      setAttendanceRecords(nextRecords);

      try {
        localStorage.setItem(
          getAttendanceStorageKey(currentUser.branch),
          JSON.stringify(nextRecords)
        );
      } catch {}

      if (supabase) {
        // Save to dedicated attendance_logs table + app_settings backup
        try {
          await supabase.from('attendance_logs').upsert(
            {
              id: newRecord.id,
              branch: newRecord.branch,
              date: newRecord.date,
              user_name: newRecord.userName,
              user_role: newRecord.userRole,
              type: newRecord.type,
              recorded_at: newRecord.recordedAt,
              time_display: newRecord.timeDisplay,
              latitude: newRecord.latitude,
              longitude: newRecord.longitude,
              distance_meters: newRecord.distanceMeters,
              accuracy_meters: newRecord.accuracyMeters,
              status: newRecord.status,
              mode: newRecord.mode,
              ot_minutes: newRecord.otMinutes ?? 0,
              note: newRecord.note || null,
            },
            { onConflict: 'branch,date,user_name,type' }
          );
        } catch (err) {
          console.warn('Supabase attendance_logs table save note:', err);
        }

        try {
          await supabase.from('app_settings').upsert(
            {
              branch: currentUser.branch,
              setting_key: 'hellocrenn_attendance_logs',
              setting_value: nextRecords,
            },
            { onConflict: 'branch,setting_key' }
          );
        } catch (err) {
          console.warn('Supabase attendance app_settings note:', err);
        }
      }

      // Non-blocking Discord Notification synced 1:1 with User Security Setting
      const typeLabel = payload.type === 'check_in' ? 'เข้างาน (Check-in)' : 'ออกงาน (Check-out)';
      const modeLabel = payload.mode === 'auto' ? 'Auto GPS' : 'Manual GPS';
      const otLine =
        payload.type === 'check_out' && evalResult.otMinutes > 0
          ? `\n⏱️ โอที (OT): ${formatOtDuration(evalResult.otMinutes)}`
          : '';
      sendDiscordNotification(
        `📍 **[Hello, Crenn — ลงเวลา${typeLabel} · สาขา ${currentUser.branch}]**\n` +
          `👤 พนักงาน: ${currentUser.name} (${currentUser.role})\n` +
          `🗓️ วันที่: ${formatThaiNumericDate(dateStr)} เวลา ${timeDisplay}\n` +
          `📡 รูปแบบ: ${modeLabel} | ระยะห่างร้าน: ${formatDistanceMeters(payload.distanceMeters)} (±${payload.accuracyMeters} ม.)\n` +
          `✅ สถานะ: ${getStatusLabelTH(evalResult.status)}` +
          otLine +
          (payload.note ? `\n📝 หมายเหตุ: ${payload.note}` : ''),
        'notifyOnHelloCrennCheckin'
      );

      return newRecord;
    },
    [attendanceRecords, currentUser.branch, currentUser.name, currentUser.role, geofenceConfig, isReadOnly]
  );

  const handleSaveGeofenceConfig = async (nextConfig: BranchGeofenceConfig) => {
    if (!canEditGeofence) return;
    const enriched: BranchGeofenceConfig = {
      ...nextConfig,
      branch: currentUser.branch,
      updatedBy: currentUser.name,
      updatedAt: new Date().toISOString(),
    };

    setGeofenceConfig(enriched);
    try {
      localStorage.setItem(getGeofenceStorageKey(currentUser.branch), JSON.stringify(enriched));
    } catch {}

    if (supabase) {
      try {
        await supabase.from('branch_geofences').upsert(
          {
            branch: enriched.branch,
            branch_label: enriched.branchLabel,
            latitude: enriched.latitude,
            longitude: enriched.longitude,
            radius_meters: enriched.radiusMeters,
            max_accuracy_meters: enriched.maxAccuracyMeters,
            shift_start_time: enriched.shiftStartTime,
            shift_end_time: enriched.shiftEndTime,
            grace_minutes: enriched.graceMinutes,
            ot_step_minutes: enriched.otStepMinutes ?? 30,
            employee_shifts: enriched.employeeShifts || {},
            auto_checkin_enabled: enriched.autoCheckinEnabled,
            auto_checkout_enabled: enriched.autoCheckoutEnabled,
            is_configured: enriched.isConfigured,
            updated_by: enriched.updatedBy,
            updated_at: enriched.updatedAt,
          },
          { onConflict: 'branch' }
        );
      } catch (err) {
        console.warn('Supabase branch_geofences table save note:', err);
      }

      await supabase.from('app_settings').upsert(
        {
          branch: currentUser.branch,
          setting_key: 'hellocrenn_geofence_config',
          setting_value: enriched,
        },
        { onConflict: 'branch,setting_key' }
      );
    }

    const customStaffCount = Object.keys(enriched.employeeShifts || {}).length;
    const otRuleLabel =
      enriched.otStepMinutes && enriched.otStepMinutes > 0
        ? `คิดโอทีทุก ${enriched.otStepMinutes} นาที`
        : 'ไม่คิดโอทีอัตโนมัติ';

    // Non-blocking Discord Notification synced 1:1 with User Security Setting
    sendDiscordNotification(
      `🛰️ **[Hello, Crenn — อัปเดตพิกัดสาขาและกะงาน · สาขา ${currentUser.branch}]**\n` +
        `👤 ผู้ตั้งค่า: ${currentUser.name}\n` +
        `📌 พิกัดร้าน: ${enriched.latitude.toFixed(6)}, ${enriched.longitude.toFixed(6)} (รัศมี ${enriched.radiusMeters} ม.)\n` +
        `⏰ กะงานมาตรฐาน: ${enriched.shiftStartTime} – ${enriched.shiftEndTime} น. (อนุโลมสาย ${enriched.graceMinutes} นาที | ${otRuleLabel})\n` +
        `👥 กะงานเฉพาะรายบุคคล: ${customStaffCount} คน\n` +
        `🤖 Auto Check-in: ${enriched.autoCheckinEnabled ? 'เปิด' : 'ปิด'} | Auto Check-out: ${enriched.autoCheckoutEnabled ? 'เปิด' : 'ปิด'}`,
      'notifyOnHelloCrennGeofence'
    );
  };

  const branchLabel =
    currentUser.branch === 'Rayong'
      ? 'สาขาระยอง (Rayong)'
      : currentUser.branch === 'Bangkok'
        ? 'สาขากรุงเทพฯ (Bangkok)'
        : currentUser.branch;

  const userInitial = (currentUser.name || 'U').charAt(0).toUpperCase();

  const navItems: Array<{
    id: 'scan' | 'history' | 'settings';
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  }> = [
    { id: 'scan', label: 'สแกนลงเวลา', icon: MapPin },
    { id: 'history', label: 'ประวัติเข้า-ออก', icon: History },
    { id: 'settings', label: 'ตั้งค่าพิกัดสาขา', icon: Settings2 },
  ];

  return (
    <div className="min-h-screen bg-[#F0F5F4] text-[#2D4A49] font-sans pb-24 md:pb-12">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ROW 1: TOP NAVIGATION BAR (Matches Main App TopNav & DESIGN_STANDARD §8) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#D4E4E3] shadow-xs px-4 py-3 w-full">
        <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto flex items-center justify-between">
          {/* Left: Brand Wordmark CRENN + Sub-App Label */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentTab('scan')}
              className="text-left group focus:outline-none cursor-pointer"
              title="กลับหน้าสแกนลงเวลา (Hello, Crenn)"
            >
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-[0.22em] uppercase leading-none font-sans">
                CRENN
              </h1>
              <p className="text-[9px] text-[#5A8A88] font-bold tracking-widest uppercase mt-0.5">
                Hello, Crenn · GPS Time
              </p>
            </button>
          </div>

          {/* Center: Icon-Above-Label Navigation Tabs */}
          <nav
            aria-label="เมนูหลัก Hello, Crenn"
            className="hidden md:flex items-center justify-center gap-1 flex-1 px-2"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex flex-col items-center justify-center gap-[2px] px-[12px] py-[6px] rounded-lg min-w-[68px] cursor-pointer relative transition-all duration-150 ${
                    isActive
                      ? 'bg-[#E8F3F2] text-[#5A8A88]'
                      : 'text-[#A8BCBB] hover:bg-[#F0F5F4] hover:text-[#5A8A88]'
                  }`}
                  title={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={1.5} />
                  <span
                    className={`text-[9px] leading-none whitespace-nowrap mt-[1px] ${
                      isActive ? 'font-semibold text-[#5A8A88]' : 'font-normal'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right: User Avatar Pill + Dropdown Menu */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative inline-block text-left select-none" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#D4E4E3] transition-colors focus:outline-none shadow-xs cursor-pointer"
                title="โปรไฟล์ผู้ใช้"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <div className="w-7 h-7 rounded-full bg-[#5A8A88] text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                  {userInitial}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">
                    {currentUser.name}
                  </p>
                  {currentUser.role && (
                    <p className="text-[9px] text-[#5A8A88] font-semibold leading-tight capitalize">
                      {currentUser.role}
                    </p>
                  )}
                </div>
                <ChevronDown
                  size={12}
                  className={`text-[#5A8A88] transition-transform duration-200 shrink-0 ${
                    userMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-[225px] bg-white border border-[#D4E4E3] rounded-[12px] p-1.5 shadow-[0_8px_24px_rgba(45,74,73,0.12)] z-[200] animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="px-3 py-2 rounded-lg bg-[#F8FCFC] border border-[#D4E4E3]/60 mb-1">
                    <p className="text-[11px] font-bold text-[#2D4A49] truncate">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-[#6B8F8E] truncate mt-0.5">
                      📍 {branchLabel}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSwitchToCafe();
                    }}
                    className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
                  >
                    <div className="flex items-center gap-[10px] min-w-0">
                      <span className="text-[14px] shrink-0 leading-none">☕</span>
                      <span className="truncate text-[12px]">สลับไป Cafe Management</span>
                    </div>
                    <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
                  </button>

                  {onSwitchToProdCalc && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSwitchToProdCalc();
                      }}
                      className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
                    >
                      <div className="flex items-center gap-[10px] min-w-0">
                        <span className="text-[14px] shrink-0 leading-none">🧮</span>
                        <span className="truncate text-[12px]">สลับไป ProdCalc</span>
                      </div>
                      <ChevronRight size={13} className="text-[#A8BCBB] group-hover:text-[#5A8A88] shrink-0 ml-2 transition-colors" />
                    </button>
                  )}

                  <div className="h-[1px] bg-[#D4E4E3] mx-2 my-1" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-rose-600 hover:bg-rose-50 font-medium transition-all duration-100 cursor-pointer text-left group select-none"
                  >
                    <div className="flex items-center gap-[10px] min-w-0">
                      <span className="text-[14px] shrink-0 leading-none">🚪</span>
                      <span className="truncate text-[12px]">ออกจากระบบ (Logout)</span>
                    </div>
                    <ChevronRight size={13} className="text-rose-400 group-hover:text-rose-600 shrink-0 ml-2 transition-colors" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ROW 2: SECONDARY STATUS & APP SWITCHER BAR */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="w-full relative bg-white/80 backdrop-blur-xs border-b border-[#D4E4E3] shadow-xs px-4 md:px-6 lg:px-8 py-2 z-10 shrink-0">
        <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto flex items-center justify-between text-xs min-h-[32px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSwitchToCafe}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#5A8A88] text-[#2D4A49] transition-colors focus:outline-none shadow-xs text-xs font-bold cursor-pointer"
              title="สลับไปยังระบบ Cafe Management System"
            >
              <Coffee size={13} className="text-[#5A8A88]" />
              <span>Cafe Management</span>
            </button>
            {onSwitchToProdCalc && (
              <button
                type="button"
                onClick={onSwitchToProdCalc}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EEF6FB] hover:bg-[#DDF0F8] border border-[#5BA4C8] text-[#1E5A7A] transition-colors focus:outline-none shadow-xs text-xs font-bold cursor-pointer"
                title="เปิดแอปพลิเคชัน ProdCalc (คำนวณต้นทุนการผลิต)"
              >
                <span className="text-sm">🧮</span>
                <span>ProdCalc</span>
              </button>
            )}
          </div>

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

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MAIN CONTAINER (Aligned to max-w-6xl grid) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <main className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {currentTab === 'scan' && (
          <AttendanceScanner
            currentUser={currentUser}
            geofenceConfig={geofenceConfig}
            attendanceRecords={attendanceRecords}
            onRecordAttendance={handleRecordAttendance}
            onOpenGeofenceSettings={() => setCurrentTab('settings')}
            canEditGeofence={canEditGeofence}
            isReadOnly={isReadOnly}
          />
        )}

        {currentTab === 'history' && (
          <AttendanceHistory records={attendanceRecords} currentBranch={currentUser.branch} />
        )}

        {currentTab === 'settings' && (
          <GeofenceSettings
            config={geofenceConfig}
            canEdit={canEditGeofence}
            onSaveConfig={handleSaveGeofenceConfig}
          />
        )}
      </main>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MOBILE BOTTOM NAVIGATION */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="md:hidden fixed bottom-3 left-4 right-4 z-40">
        <div className="bg-white/95 border border-[#D4E4E3] backdrop-blur-md shadow-[0_8px_24px_rgba(45,74,73,0.16)] rounded-2xl p-1 flex items-center justify-around gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentTab(item.id)}
                className={`flex-1 py-1.5 rounded-xl text-[9.5px] flex flex-col items-center gap-0.5 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#E8F3F2] text-[#5A8A88] font-semibold'
                    : 'text-[#A8BCBB] hover:text-[#5A8A88]'
                }`}
              >
                <Icon size={16} strokeWidth={1.5} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default HelloCrennApp;
