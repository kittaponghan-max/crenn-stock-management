import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  History,
  Settings2,
  CalendarClock,
  Coffee,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sendDiscordNotification } from '../../lib/discordNotify';
import { generateUUID } from '../../lib/utils';
import { PagePermission } from '../../utils/permissions';
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
  formatOtHours,
  getDefaultGeofenceConfig,
  getOtTypeLabel,
  getStatusLabelTH,
  normalizeGeofenceConfig,
} from '../../utils/gpsUtils';
import { toLocalDateStr, formatThaiNumericDate } from '../ui';
import { AttendanceDashboard } from './AttendanceDashboard';
import { AttendanceScanner } from './AttendanceScanner';
import { AttendanceHistory } from './AttendanceHistory';
import { GeofenceSettings } from './GeofenceSettings';
import { ShiftSettings } from './ShiftSettings';

interface HelloCrennAppProps {
  currentUser: {
    name: string;
    role: string;
    branch: string;
  };
  onSwitchToCafe: () => void;
  onSwitchToProdCalc?: () => void;
  onSwitchToLeavePortal?: () => void;
  onLogout: () => void;
  canEditGeofence?: boolean;
  isReadOnly?: boolean;
  tabPermissions?: {
    dashboard?: PagePermission;
    scan: PagePermission;
    history: PagePermission;
    settings: PagePermission;
  };
}

const getGeofenceStorageKey = (branch: string) => `hellocrenn-geofence-${branch}`;
const getAttendanceStorageKey = (branch: string) => `hellocrenn-attendance-${branch}`;

export function HelloCrennApp({
  currentUser,
  onSwitchToCafe,
  onSwitchToProdCalc,
  onSwitchToLeavePortal,
  onLogout,
  canEditGeofence = false,
  isReadOnly = false,
  tabPermissions,
}: HelloCrennAppProps) {
  const roleUpper = (currentUser.role || '').toUpperCase().trim();
  const isDefaultAdminRole =
    roleUpper === 'CO-FOUNDER' ||
    roleUpper === 'COFOUNDER' ||
    roleUpper === 'ADMIN' ||
    roleUpper === 'OWNER';

  const effectivePerms = {
    dashboard: tabPermissions?.dashboard ?? (isDefaultAdminRole ? 'edit' : 'hidden'),
    scan: tabPermissions?.scan ?? 'edit',
    history: tabPermissions?.history ?? 'edit',
    settings: tabPermissions?.settings ?? (canEditGeofence ? 'edit' : 'read'),
  };

  type HelloCrennTab = 'dashboard' | 'scan' | 'history' | 'settings' | 'shifts';

  const [currentTab, setCurrentTab] = useState<HelloCrennTab>(() => {
    if (effectivePerms.dashboard !== 'hidden') return 'dashboard';
    if (effectivePerms.scan !== 'hidden') return 'scan';
    if (effectivePerms.history !== 'hidden') return 'history';
    return 'settings';
  });

  useEffect(() => {
    if (currentTab === 'dashboard' && effectivePerms.dashboard === 'hidden') {
      setCurrentTab(
        effectivePerms.scan !== 'hidden'
          ? 'scan'
          : effectivePerms.history !== 'hidden'
            ? 'history'
            : 'settings'
      );
    } else if (currentTab === 'scan' && effectivePerms.scan === 'hidden') {
      setCurrentTab(
        effectivePerms.dashboard !== 'hidden'
          ? 'dashboard'
          : effectivePerms.history !== 'hidden'
            ? 'history'
            : 'settings'
      );
    } else if (currentTab === 'history' && effectivePerms.history === 'hidden') {
      setCurrentTab(
        effectivePerms.dashboard !== 'hidden'
          ? 'dashboard'
          : effectivePerms.scan !== 'hidden'
            ? 'scan'
            : 'settings'
      );
    } else if (
      (currentTab === 'settings' || currentTab === 'shifts') &&
      effectivePerms.settings === 'hidden'
    ) {
      setCurrentTab(
        effectivePerms.dashboard !== 'hidden'
          ? 'dashboard'
          : effectivePerms.scan !== 'hidden'
            ? 'scan'
            : 'history'
      );
    }
  }, [
    currentTab,
    effectivePerms.dashboard,
    effectivePerms.scan,
    effectivePerms.history,
    effectivePerms.settings,
  ]);
  const [dbStatus, setDbStatus] = useState<'connected' | 'checking' | 'offline'>(
    supabase ? 'checking' : 'offline'
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scanMenuOpen, setScanMenuOpen] = useState(false);
  const [mobileScanMenuOpen, setMobileScanMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const scanMenuRef = useRef<HTMLDivElement>(null);
  const mobileScanMenuRef = useRef<HTMLDivElement>(null);
  const scanHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScanHoverTimer = () => {
    if (scanHoverTimerRef.current) {
      clearTimeout(scanHoverTimerRef.current);
      scanHoverTimerRef.current = null;
    }
  };

  const scheduleCloseScanMenu = () => {
    clearScanHoverTimer();
    scanHoverTimerRef.current = setTimeout(() => {
      setScanMenuOpen(false);
    }, 160);
  };

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
      if (scanMenuRef.current && !scanMenuRef.current.contains(e.target as Node)) {
        setScanMenuOpen(false);
      }
      if (mobileScanMenuRef.current && !mobileScanMenuRef.current.contains(e.target as Node)) {
        setMobileScanMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
        setScanMenuOpen(false);
        setMobileScanMenuOpen(false);
      }
    };
    if (userMenuOpen || scanMenuOpen || mobileScanMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen, scanMenuOpen, mobileScanMenuOpen]);

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
            .in('setting_key', [
              'hellocrenn_geofence_config',
              'hellocrenn_attendance_logs',
              'hellocrenn_shift_config',
            ]),
        ]);

        if (!isMounted) return;

        const hasTableConnection = !geoTableRes.error || !logsTableRes.error;
        const hasSettingsConnection = !settingsRes.error;
        if (!hasTableConnection && !hasSettingsConnection) {
          setDbStatus('offline');
          return;
        }
        setDbStatus('connected');

        const settingsList = (!settingsRes.error && Array.isArray(settingsRes.data))
          ? settingsRes.data
          : [];
        const shiftSettingsRow = settingsList.find(
          (r: any) => r.setting_key === 'hellocrenn_shift_config'
        );
        const geoSettingsRow = settingsList.find(
          (r: any) => r.setting_key === 'hellocrenn_geofence_config'
        );
        const logsSettingsRow = settingsList.find(
          (r: any) => r.setting_key === 'hellocrenn_attendance_logs'
        );

        const shiftExtras = (shiftSettingsRow?.setting_value ||
          geoSettingsRow?.setting_value ||
          null) as Record<string, any> | null;

        // 1. Resolve Geofence + Shift Config (branch_geofences merged with app_settings shift extensions)
        if (!geoTableRes.error && geoTableRes.data) {
          const r = geoTableRes.data as any;
          const mergedEmployeeShifts = (() => {
            const baseShifts =
              r.employee_shifts && typeof r.employee_shifts === 'object'
                ? r.employee_shifts
                : {};
            const extraShifts =
              shiftExtras?.employeeShifts && typeof shiftExtras.employeeShifts === 'object'
                ? shiftExtras.employeeShifts
                : null;
            if (!extraShifts) return baseShifts;
            const shiftUpdatedAt = shiftExtras?.updatedAt ? new Date(shiftExtras.updatedAt).getTime() : 0;
            const tableUpdatedAt = r.updated_at ? new Date(r.updated_at).getTime() : 0;
            if (shiftUpdatedAt >= tableUpdatedAt) {
              return extraShifts;
            }
            const merged: Record<string, any> = { ...baseShifts };
            Object.entries(baseShifts).forEach(([k, v]: [string, any]) => {
              const ext = extraShifts[k];
              if (ext && typeof ext === 'object') {
                merged[k] = { ...ext, ...v };
              }
            });
            return merged;
          })();

          const normalized = normalizeGeofenceConfig(
            {
              branch: r.branch,
              branchLabel: r.branch_label,
              latitude: r.latitude,
              longitude: r.longitude,
              radiusMeters: r.radius_meters,
              maxAccuracyMeters: r.max_accuracy_meters,
              shiftStartTime: shiftExtras?.shiftStartTime || r.shift_start_time,
              shiftEndTime: shiftExtras?.shiftEndTime || r.shift_end_time,
              graceMinutes: shiftExtras?.graceMinutes ?? r.grace_minutes,
              otStepMinutes: shiftExtras?.otStepMinutes ?? r.ot_step_minutes,
              defaultOtMultiplier: shiftExtras?.defaultOtMultiplier,
              shiftTemplates: shiftExtras?.shiftTemplates,
              holidayOverrides: shiftExtras?.holidayOverrides,
              employeeShifts: mergedEmployeeShifts,
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
        } else if (geoSettingsRow?.setting_value || shiftSettingsRow?.setting_value) {
          const combined = {
            ...(geoSettingsRow?.setting_value || {}),
            ...(shiftSettingsRow?.setting_value || {}),
          };
          const normalized = normalizeGeofenceConfig(combined, currentUser.branch);
          setGeofenceConfig(normalized);
          try {
            localStorage.setItem(getGeofenceStorageKey(currentUser.branch), JSON.stringify(normalized));
          } catch {}
        } else if (!settingsRes.error) {
          setGeofenceConfig(getDefaultGeofenceConfig(currentUser.branch));
        }

        // 2. Resolve Attendance Records (authoritative attendance_logs table enriched with otMultiplier & shiftName from app_settings)
        if (!logsTableRes.error && Array.isArray(logsTableRes.data)) {
          const metaById = new Map<string, any>();
          const metaByComposite = new Map<string, any>();
          const backupList = Array.isArray(logsSettingsRow?.setting_value)
            ? (logsSettingsRow.setting_value as AttendanceRecord[])
            : [];
          backupList.forEach((b) => {
            if (!b) return;
            if (b.id) metaById.set(b.id, b);
            metaByComposite.set(
              `${b.date}|${String(b.userName || '').trim().toLowerCase()}|${b.type}`,
              b
            );
          });

          const mapped: AttendanceRecord[] = logsTableRes.data.map((r: any) => {
            const dateStr = typeof r.date === 'string' ? r.date.slice(0, 10) : String(r.date);
            const compKey = `${dateStr}|${String(r.user_name || '').trim().toLowerCase()}|${r.type}`;
            const meta = metaById.get(r.id) || metaByComposite.get(compKey);
            return {
              id: r.id,
              branch: r.branch,
              date: dateStr,
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
              otMultiplier: meta?.otMultiplier,
              shiftName: meta?.shiftName,
              note: r.note || undefined,
            };
          });
          setAttendanceRecords(mapped);
          try {
            localStorage.setItem(getAttendanceStorageKey(currentUser.branch), JSON.stringify(mapped));
          } catch {}
        } else if (logsSettingsRow?.setting_value && Array.isArray(logsSettingsRow.setting_value)) {
          setAttendanceRecords(logsSettingsRow.setting_value as AttendanceRecord[]);
          try {
            localStorage.setItem(
              getAttendanceStorageKey(currentUser.branch),
              JSON.stringify(logsSettingsRow.setting_value)
            );
          } catch {}
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
      if (isReadOnly || effectivePerms.scan !== 'edit') return null;

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

      const todayCheckInRec = attendanceRecords.find(
        (r) =>
          r.date === dateStr &&
          r.branch === currentUser.branch &&
          r.userName.toLowerCase() === currentUser.name.toLowerCase() &&
          r.type === 'check_in'
      );
      const checkInDateObj = todayCheckInRec ? new Date(todayCheckInRec.recordedAt) : null;
      const validCheckInDate =
        checkInDateObj && !Number.isNaN(checkInDateObj.getTime()) ? checkInDateObj : null;

      const evalResult = evaluateAttendanceStatus(
        payload.type,
        now,
        geofenceConfig,
        currentUser.name,
        validCheckInDate
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
        otMultiplier: evalResult.otMultiplier,
        shiftName: evalResult.shiftName,
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
        // Save to dedicated attendance_logs table (existing columns only) + app_settings backup
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
          ? `\n⏱️ ${getOtTypeLabel(evalResult.otMultiplier)}: ${formatOtHours(evalResult.otMinutes)} (${formatOtDuration(evalResult.otMinutes)})`
          : '';
      sendDiscordNotification(
        `📍 **[Hello, Crenn — ลงเวลา${typeLabel} · สาขา ${currentUser.branch}]**\n` +
          `👤 พนักงาน: ${currentUser.name} (${currentUser.role}) · กะ: ${evalResult.shiftName}\n` +
          `🗓️ วันที่: ${formatThaiNumericDate(dateStr)} เวลา ${timeDisplay}\n` +
          `📡 รูปแบบ: ${modeLabel} | ระยะห่างร้าน: ${formatDistanceMeters(payload.distanceMeters)} (±${payload.accuracyMeters} ม.)\n` +
          `✅ สถานะ: ${getStatusLabelTH(evalResult.status)}` +
          otLine +
          (payload.note ? `\n📝 หมายเหตุ: ${payload.note}` : ''),
        'notifyOnHelloCrennCheckin'
      );

      return newRecord;
    },
    [attendanceRecords, currentUser.branch, currentUser.name, currentUser.role, effectivePerms.scan, geofenceConfig, isReadOnly]
  );

  const handleSaveGeofenceConfig = async (nextConfig: BranchGeofenceConfig) => {
    if (isReadOnly || effectivePerms.settings !== 'edit') return;
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
        [
          {
            branch: currentUser.branch,
            setting_key: 'hellocrenn_geofence_config',
            setting_value: enriched,
          },
          {
            branch: currentUser.branch,
            setting_key: 'hellocrenn_shift_config',
            setting_value: {
              defaultOtMultiplier: enriched.defaultOtMultiplier ?? 1.5,
              shiftTemplates: enriched.shiftTemplates || [],
              holidayOverrides: enriched.holidayOverrides || [],
              shiftStartTime: enriched.shiftStartTime,
              shiftEndTime: enriched.shiftEndTime,
              graceMinutes: enriched.graceMinutes,
              otStepMinutes: enriched.otStepMinutes ?? 30,
              employeeShifts: enriched.employeeShifts || {},
              updatedAt: enriched.updatedAt,
              updatedBy: enriched.updatedBy,
            },
          },
        ],
        { onConflict: 'branch,setting_key' }
      );
    }

    const customStaffCount = Object.keys(enriched.employeeShifts || {}).length;
    const templateCount = (enriched.shiftTemplates || []).length;
    const defaultOtLabel = getOtTypeLabel(enriched.defaultOtMultiplier ?? 1.5);
    const otRuleLabel =
      enriched.otStepMinutes && enriched.otStepMinutes > 0
        ? `คิดโอทีทุก ${enriched.otStepMinutes} นาที (${defaultOtLabel})`
        : `ไม่คิดโอทีอัตโนมัติ (${defaultOtLabel})`;

    // Non-blocking Discord Notification synced 1:1 with User Security Setting
    sendDiscordNotification(
      `🛰️ **[Hello, Crenn — อัปเดตพิกัดสาขาและกะงาน · สาขา ${currentUser.branch}]**\n` +
        `👤 ผู้ตั้งค่า: ${currentUser.name}\n` +
        `📌 พิกัดร้าน: ${enriched.latitude.toFixed(6)}, ${enriched.longitude.toFixed(6)} (รัศมี ${enriched.radiusMeters} ม.)\n` +
        `⏰ กะมาตรฐาน: ${enriched.shiftStartTime} – ${enriched.shiftEndTime} น. (อนุโลมสาย ${enriched.graceMinutes} นาที | ${otRuleLabel})\n` +
        `📅 ตารางเวลากะงาน: ${templateCount} รูปแบบ | ผูกกะพนักงาน: ${customStaffCount} คน\n` +
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

  const scanSubItems: Array<{
    id: 'dashboard' | 'scan';
    label: string;
    description: string;
    emoji: string;
  }> = [
    ...(effectivePerms.dashboard !== 'hidden'
      ? [
          {
            id: 'dashboard' as const,
            label: 'สแกนเวลา (ภาพรวมพนักงาน · Admin)',
            description: 'ดูสถานะเข้า-ออกงานและโอทีของพนักงานทุกคน',
            emoji: '📊',
          },
        ]
      : []),
    ...(effectivePerms.scan !== 'hidden'
      ? [
          {
            id: 'scan' as const,
            label: 'สแกนเวลาตนเอง (My GPS Check-in)',
            description: 'สแกน GPS และดูสรุปเวลาทำงานเฉพาะของคุณ',
            emoji: '📍',
          },
        ]
      : []),
  ];

  const isScanGroupActive = currentTab === 'dashboard' || currentTab === 'scan';

  const singleNavItems: Array<{
    id: 'history' | 'shifts' | 'settings';
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  }> = [
    ...(effectivePerms.history !== 'hidden'
      ? [{ id: 'history' as const, label: 'ประวัติเข้า-ออก', icon: History }]
      : []),
    ...(effectivePerms.settings !== 'hidden'
      ? [
          { id: 'shifts' as const, label: 'กะงาน & โอที', icon: CalendarClock },
          { id: 'settings' as const, label: 'พิกัดสาขา', icon: Settings2 },
        ]
      : []),
  ];

  const defaultHomeTab: HelloCrennTab =
    effectivePerms.dashboard !== 'hidden'
      ? 'dashboard'
      : effectivePerms.scan !== 'hidden'
        ? 'scan'
        : effectivePerms.history !== 'hidden'
          ? 'history'
          : 'settings';

  const isScanReadOnly = isReadOnly || effectivePerms.scan === 'read';
  const canModifyGeofence =
    !isReadOnly &&
    (canEditGeofence || effectivePerms.settings === 'edit') &&
    effectivePerms.settings === 'edit';

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
              onClick={() => setCurrentTab(defaultHomeTab)}
              className="text-left group focus:outline-none cursor-pointer"
              title="กลับหน้าหลัก (Hello, Crenn)"
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
            {scanSubItems.length > 0 && (
              <div
                ref={scanMenuRef}
                className="relative overflow-visible"
                onMouseEnter={() => {
                  clearScanHoverTimer();
                  setScanMenuOpen(true);
                }}
                onMouseLeave={scheduleCloseScanMenu}
              >
                <button
                  type="button"
                  onClick={() => setScanMenuOpen((prev) => !prev)}
                  className={`flex flex-col items-center justify-center gap-[2px] px-[12px] py-[6px] rounded-lg min-w-[68px] cursor-pointer relative transition-all duration-150 ${
                    isScanGroupActive || scanMenuOpen
                      ? 'bg-[#E8F3F2] text-[#5A8A88]'
                      : 'text-[#A8BCBB] hover:bg-[#F0F5F4] hover:text-[#5A8A88]'
                  }`}
                  title="สแกนเวลา"
                  aria-expanded={scanMenuOpen}
                  aria-haspopup="menu"
                  aria-current={isScanGroupActive ? 'page' : undefined}
                >
                  <MapPin size={18} strokeWidth={1.5} />
                  <span
                    className={`text-[9px] leading-none whitespace-nowrap mt-[1px] flex items-center gap-[2px] ${
                      isScanGroupActive || scanMenuOpen ? 'font-semibold text-[#5A8A88]' : 'font-normal'
                    }`}
                  >
                    สแกนเวลา
                    <ChevronDown
                      size={7}
                      className={`transition-transform duration-150 shrink-0 ${
                        scanMenuOpen ? 'rotate-180 text-[#5A8A88]' : 'text-current opacity-60'
                      }`}
                    />
                  </span>
                </button>

                {scanMenuOpen && (
                  <div
                    role="menu"
                    onMouseEnter={clearScanHoverTimer}
                    onMouseLeave={scheduleCloseScanMenu}
                    className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 min-w-[270px] bg-white rounded-2xl shadow-xl border border-[#D4E4E3] p-2 z-[100] animate-in fade-in zoom-in-95 duration-150"
                  >
                    {/* Invisible hover bridge */}
                    <div className="absolute -top-3 left-0 right-0 h-3 bg-transparent" aria-hidden="true" />
                    <div className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-[#5A8A88] uppercase tracking-wider select-none">
                      ระบบลงเวลา (Attendance)
                    </div>
                    <div className="space-y-1">
                      {scanSubItems.map((sub) => {
                        const isSubActive = currentTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setCurrentTab(sub.id);
                              setScanMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 cursor-pointer text-left group select-none ${
                              isSubActive
                                ? 'bg-[#E8F3F2] text-[#2D4A49] font-bold shadow-xs'
                                : 'text-slate-700 hover:bg-[#F0F5F4] hover:text-[#1E3A3A] font-medium'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 flex-1 min-w-0 pr-1">
                              <span className="text-sm shrink-0 leading-none mt-0.5">{sub.emoji}</span>
                              <div className="min-w-0 flex-1">
                                <span className="block text-[12px] text-[#2D4A49] leading-tight">
                                  {sub.label}
                                </span>
                                <span className="block text-[10px] font-normal text-[#6B8F8E] mt-0.5 leading-tight">
                                  {sub.description}
                                </span>
                              </div>
                            </div>
                            {isSubActive ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88] shrink-0 ml-2" />
                            ) : (
                              <ChevronRight
                                size={13}
                                className="text-slate-300 group-hover:text-[#5A8A88] transition-colors shrink-0 ml-2"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {singleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCurrentTab(item.id);
                    setScanMenuOpen(false);
                  }}
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

                  {onSwitchToLeavePortal && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSwitchToLeavePortal();
                      }}
                      className="w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-xs text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88] font-normal transition-all duration-100 cursor-pointer text-left group select-none"
                    >
                      <div className="flex items-center gap-[10px] min-w-0">
                        <span className="text-[14px] shrink-0 leading-none">🗓️</span>
                        <span className="truncate text-[12px]">สลับไป Leave Portal</span>
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onSwitchToCafe}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8F3F2] hover:bg-[#D8EAE8] border border-[#5A8A88] text-[#2D4A49] transition-colors focus:outline-none shadow-xs text-xs font-bold cursor-pointer whitespace-nowrap"
              title="สลับไปยังระบบ Cafe Management System"
            >
              <Coffee size={13} className="text-[#5A8A88]" />
              <span>Cafe Management</span>
            </button>
            {onSwitchToProdCalc && (
              <button
                type="button"
                onClick={onSwitchToProdCalc}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EEF6FB] hover:bg-[#DDF0F8] border border-[#5BA4C8] text-[#1E5A7A] transition-colors focus:outline-none shadow-xs text-xs font-bold cursor-pointer whitespace-nowrap"
                title="เปิดแอปพลิเคชัน ProdCalc (คำนวณต้นทุนการผลิต)"
              >
                <span className="text-sm">🧮</span>
                <span>ProdCalc</span>
              </button>
            )}
            {onSwitchToLeavePortal && (
              <button
                type="button"
                onClick={onSwitchToLeavePortal}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F4FBF9] hover:bg-[#E1F3EE] border border-[#3D7A6E] text-[#1F4E45] transition-colors focus:outline-none shadow-xs text-xs font-bold cursor-pointer whitespace-nowrap"
                title="เปิดแอปพลิเคชัน Leave Portal (ระบบบริหารจัดการการลา)"
              >
                <span className="text-sm">🗓️</span>
                <span>Leave Portal</span>
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
        {currentTab === 'dashboard' && effectivePerms.dashboard !== 'hidden' && (
          <AttendanceDashboard
            currentBranch={currentUser.branch}
            geofenceConfig={geofenceConfig}
            attendanceRecords={attendanceRecords}
            canScanSelf={effectivePerms.scan !== 'hidden'}
            onOpenSelfScan={() => setCurrentTab('scan')}
            canEditGeofence={canModifyGeofence}
            onOpenGeofenceSettings={
              effectivePerms.settings !== 'hidden' ? () => setCurrentTab('settings') : undefined
            }
            onOpenShiftSettings={
              effectivePerms.settings !== 'hidden' ? () => setCurrentTab('shifts') : undefined
            }
          />
        )}

        {currentTab === 'scan' && effectivePerms.scan !== 'hidden' && (
          <AttendanceScanner
            currentUser={currentUser}
            geofenceConfig={geofenceConfig}
            attendanceRecords={attendanceRecords}
            onRecordAttendance={handleRecordAttendance}
            onOpenGeofenceSettings={
              effectivePerms.settings !== 'hidden' ? () => setCurrentTab('settings') : undefined
            }
            canEditGeofence={canModifyGeofence}
            isReadOnly={isScanReadOnly}
          />
        )}

        {currentTab === 'history' && effectivePerms.history !== 'hidden' && (
          <AttendanceHistory
            records={attendanceRecords}
            currentBranch={currentUser.branch}
            geofenceConfig={geofenceConfig}
          />
        )}

        {currentTab === 'shifts' && effectivePerms.settings !== 'hidden' && (
          <ShiftSettings
            config={geofenceConfig}
            canEdit={canModifyGeofence}
            onSaveConfig={handleSaveGeofenceConfig}
            onOpenGeofenceSettings={() => setCurrentTab('settings')}
          />
        )}

        {currentTab === 'settings' && effectivePerms.settings !== 'hidden' && (
          <GeofenceSettings
            config={geofenceConfig}
            canEdit={canModifyGeofence}
            onSaveConfig={handleSaveGeofenceConfig}
            onOpenShiftSettings={() => setCurrentTab('shifts')}
          />
        )}
      </main>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MOBILE BOTTOM NAVIGATION */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="md:hidden fixed bottom-3 left-4 right-4 z-40" ref={mobileScanMenuRef}>
        <div className="relative bg-white/95 border border-[#D4E4E3] backdrop-blur-md shadow-[0_8px_24px_rgba(45,74,73,0.16)] rounded-2xl p-1 flex items-center justify-around gap-1">
          {scanSubItems.length > 0 && (
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setMobileScanMenuOpen((prev) => !prev)}
                className={`w-full py-1.5 rounded-xl text-[9.5px] flex flex-col items-center gap-0.5 transition-all cursor-pointer whitespace-nowrap ${
                  isScanGroupActive || mobileScanMenuOpen
                    ? 'bg-[#E8F3F2] text-[#5A8A88] font-semibold'
                    : 'text-[#A8BCBB] hover:text-[#5A8A88]'
                }`}
                aria-expanded={mobileScanMenuOpen}
                aria-haspopup="menu"
              >
                <MapPin size={16} strokeWidth={1.5} />
                <span className="flex items-center gap-0.5">
                  สแกนเวลา
                  <ChevronUp
                    size={9}
                    className={`transition-transform duration-150 ${
                      mobileScanMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </span>
              </button>

              {mobileScanMenuOpen && (
                <div
                  role="menu"
                  className="absolute bottom-[calc(100%+10px)] left-0 w-[265px] bg-white rounded-2xl shadow-xl border border-[#D4E4E3] p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                  <div className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-[#5A8A88] uppercase tracking-wider select-none">
                    ระบบลงเวลา (Attendance)
                  </div>
                  <div className="space-y-1">
                    {scanSubItems.map((sub) => {
                      const isSubActive = currentTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setCurrentTab(sub.id);
                            setMobileScanMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer text-left ${
                            isSubActive
                              ? 'bg-[#E8F3F2] text-[#2D4A49] font-bold'
                              : 'text-slate-700 hover:bg-[#F0F5F4] font-medium'
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0 pr-1">
                            <span className="text-sm shrink-0 leading-none mt-0.5">{sub.emoji}</span>
                            <div className="min-w-0">
                              <span className="block text-[12px] leading-tight">{sub.label}</span>
                              <span className="block text-[10px] font-normal text-[#6B8F8E] mt-0.5 leading-tight">
                                {sub.description}
                              </span>
                            </div>
                          </div>
                          {isSubActive ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5A8A88] shrink-0 ml-2" />
                          ) : (
                            <ChevronRight size={13} className="text-slate-300 shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {singleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCurrentTab(item.id);
                  setMobileScanMenuOpen(false);
                }}
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
