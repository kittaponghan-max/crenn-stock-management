import { supabase } from '../lib/supabase';
import { sendDiscordNotification, normalizeDiscordSettings } from '../lib/discordNotify';
import { generateUUID } from '../lib/utils';
import {
  AttendanceMode,
  AttendanceRecord,
  AttendanceType,
  BranchGeofenceConfig,
  EmployeeShiftConfig,
} from '../types/hellocrenn';
import {
  evaluateAttendanceStatus,
  formatDistanceMeters,
  formatOtDuration,
  formatOtHours,
  getDefaultGeofenceConfig,
  getOtTypeLabel,
  getStatusLabelTH,
  normalizeGeofenceConfig,
  resolveEmployeeShift,
} from './gpsUtils';
import { toLocalDateStr, formatThaiNumericDate } from '../components/ui';

export const getGeofenceStorageKey = (branch: string) => `hellocrenn-geofence-${branch}`;
export const getAttendanceStorageKey = (branch: string) => `hellocrenn-attendance-${branch}`;

const DEVICE_ID_STORAGE_KEY = 'crenn_device_id_v1';
const DEVICE_ID_COOKIE_KEY = 'crenn_did';
const CLOCK_DRIFT_WARN_SECONDS = 120; // >= 2 minutes discrepancy flagged

// =========================================================================
// 1. PERSISTENT DEVICE IDENTITY & LABEL
// =========================================================================

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${name}=`));
    if (!match) return null;
    const val = decodeURIComponent(match.split('=').slice(1).join('='));
    return val && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
};

const writeCookie = (name: string, value: string): void => {
  if (typeof document === 'undefined') return;
  try {
    const maxAge = 60 * 60 * 24 * 365 * 2; // 2 years
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const secureAttr = isHttps ? '; Secure; SameSite=None' : '; SameSite=Lax';
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/${secureAttr}`;
  } catch {
    // Ignore cookie write failure in restricted contexts
  }
};

export const getDeviceShortId = (deviceId?: string): string => {
  if (!deviceId) return 'DEV-UNKNOWN';
  const clean = deviceId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `DEV-${clean.slice(0, 6) || 'DEVICE'}`;
};

export const getDeviceLabel = (): string => {
  if (typeof navigator === 'undefined') return 'Unknown Device';
  const ua = navigator.userAgent || '';

  let os = 'Desktop';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Line\//i.test(ua)) browser = 'LINE In-App';
  else if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/CriOS/i.test(ua)) browser = 'Chrome';
  else if (/FxiOS|Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome|Chromium/i.test(ua)) browser = 'Safari';

  return `${browser} · ${os}`;
};

export const getOrCreateDeviceIdentity = (): {
  deviceId: string;
  deviceShortId: string;
  deviceLabel: string;
} => {
  let id: string | null = null;

  if (typeof window !== 'undefined') {
    try {
      const fromLocal = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (fromLocal && fromLocal.trim()) id = fromLocal.trim();
    } catch {}

    if (!id) {
      try {
        const fromSession = sessionStorage.getItem(DEVICE_ID_STORAGE_KEY);
        if (fromSession && fromSession.trim()) id = fromSession.trim();
      } catch {}
    }

    if (!id) {
      id = readCookie(DEVICE_ID_COOKIE_KEY);
    }

    if (!id) {
      id = generateUUID();
    }

    try {
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    } catch {}
    try {
      sessionStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    } catch {}
    writeCookie(DEVICE_ID_COOKIE_KEY, id);
  } else {
    id = generateUUID();
  }

  return {
    deviceId: id,
    deviceShortId: getDeviceShortId(id),
    deviceLabel: getDeviceLabel(),
  };
};

// =========================================================================
// 2. SERVER TIME SYNCHRONIZATION (ANTI-CLOCK-TAMPERING)
// =========================================================================

let cachedServerOffsetMs = 0;
let cachedTimeSource: 'server' | 'supabase' | 'client' = 'client';
let lastSyncEpochMs = 0;
let inflightSyncPromise: Promise<{
  timeSource: 'server' | 'supabase' | 'client';
  clockOffsetSec: number;
  hasClockDrift: boolean;
}> | null = null;

const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs = 3000
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const syncServerTime = async (
  force = false
): Promise<{
  timeSource: 'server' | 'supabase' | 'client';
  clockOffsetSec: number;
  hasClockDrift: boolean;
}> => {
  const nowClient = Date.now();
  if (!force && cachedTimeSource !== 'client' && nowClient - lastSyncEpochMs < 30000) {
    const clockOffsetSec = Math.round(cachedServerOffsetMs / 1000);
    return {
      timeSource: cachedTimeSource,
      clockOffsetSec,
      hasClockDrift: Math.abs(clockOffsetSec) >= CLOCK_DRIFT_WARN_SECONDS,
    };
  }

  if (inflightSyncPromise && !force) {
    return inflightSyncPromise;
  }

  const runSync = async () => {
    // 1. Primary: Express /api/time endpoint
    try {
      const t0 = Date.now();
      const res = await fetchWithTimeout('/api/time', { method: 'GET', cache: 'no-store' }, 3000);
      const t1 = Date.now();
      if (res.ok) {
        const data = await res.json();
        const epochMs = Number(data?.epochMs);
        if (Number.isFinite(epochMs) && epochMs > 1700000000000) {
          const rttMid = (t0 + t1) / 2;
          cachedServerOffsetMs = epochMs - rttMid;
          cachedTimeSource = 'server';
          lastSyncEpochMs = t1;
          const clockOffsetSec = Math.round(cachedServerOffsetMs / 1000);
          return {
            timeSource: cachedTimeSource,
            clockOffsetSec,
            hasClockDrift: Math.abs(clockOffsetSec) >= CLOCK_DRIFT_WARN_SECONDS,
          };
        }
      }
    } catch {
      // Fallback to HTTP Date header check below
    }

    // 2. Fallback: same-origin HEAD Date header (works on reverse proxies / CDN if /api/time unavailable)
    try {
      const t0 = Date.now();
      const res = await fetchWithTimeout('/', { method: 'HEAD', cache: 'no-store' }, 2500);
      const t1 = Date.now();
      const dateHdr = res.headers.get('date');
      if (dateHdr) {
        const parsed = Date.parse(dateHdr);
        if (Number.isFinite(parsed) && parsed > 1700000000000) {
          const rttMid = (t0 + t1) / 2;
          cachedServerOffsetMs = parsed - rttMid;
          cachedTimeSource = 'server';
          lastSyncEpochMs = t1;
          const clockOffsetSec = Math.round(cachedServerOffsetMs / 1000);
          return {
            timeSource: cachedTimeSource,
            clockOffsetSec,
            hasClockDrift: Math.abs(clockOffsetSec) >= CLOCK_DRIFT_WARN_SECONDS,
          };
        }
      }
    } catch {
      // Offline or blocked
    }

    // 3. Final fallback: keep last known offset if we ever synced, or client clock
    const clockOffsetSec = Math.round(cachedServerOffsetMs / 1000);
    return {
      timeSource: cachedTimeSource,
      clockOffsetSec,
      hasClockDrift:
        cachedTimeSource !== 'client' && Math.abs(clockOffsetSec) >= CLOCK_DRIFT_WARN_SECONDS,
    };
  };

  inflightSyncPromise = runSync().finally(() => {
    inflightSyncPromise = null;
  });
  return inflightSyncPromise;
};

export const getSyncedNow = (): {
  date: Date;
  timeSource: 'server' | 'supabase' | 'client';
  clockOffsetSec: number;
  hasClockDrift: boolean;
} => {
  const epochMs = Date.now() + cachedServerOffsetMs;
  const clockOffsetSec = Math.round(cachedServerOffsetMs / 1000);
  const hasClockDrift =
    cachedTimeSource !== 'client' && Math.abs(clockOffsetSec) >= CLOCK_DRIFT_WARN_SECONDS;
  return {
    date: new Date(epochMs),
    timeSource: cachedTimeSource,
    clockOffsetSec,
    hasClockDrift,
  };
};

// =========================================================================
// 3. DUPLICATE DEVICE DETECTION (ANTI-BUDDY-PUNCHING)
// =========================================================================

export interface SharedDeviceRecordInfo {
  deviceShortId: string;
  deviceLabel?: string;
  otherUsers: string[];
  allUsers: string[];
}

export interface SharedDeviceDayAlert {
  branch: string;
  date: string;
  deviceId: string;
  deviceShortId: string;
  deviceLabel?: string;
  users: string[];
}

export const analyzeDeviceSharing = (
  records: AttendanceRecord[]
): {
  sharedByRecordId: Map<string, SharedDeviceRecordInfo>;
  alerts: SharedDeviceDayAlert[];
} => {
  const groupMap = new Map<
    string,
    {
      branch: string;
      date: string;
      deviceId: string;
      deviceLabel?: string;
      records: AttendanceRecord[];
      usersMap: Map<string, string>;
    }
  >();

  records.forEach((rec) => {
    if (!rec.deviceId) return;
    const key = `${rec.branch}|${rec.date}|${rec.deviceId}`;
    let group = groupMap.get(key);
    if (!group) {
      group = {
        branch: rec.branch,
        date: rec.date,
        deviceId: rec.deviceId,
        deviceLabel: rec.deviceLabel,
        records: [],
        usersMap: new Map<string, string>(),
      };
      groupMap.set(key, group);
    }
    group.records.push(rec);
    if (!group.deviceLabel && rec.deviceLabel) {
      group.deviceLabel = rec.deviceLabel;
    }
    const cleanName = (rec.userName || '').trim();
    if (cleanName) {
      const lower = cleanName.toLowerCase();
      if (!group.usersMap.has(lower)) {
        group.usersMap.set(lower, cleanName);
      }
    }
  });

  const sharedByRecordId = new Map<string, SharedDeviceRecordInfo>();
  const alerts: SharedDeviceDayAlert[] = [];

  groupMap.forEach((group) => {
    if (group.usersMap.size <= 1) return;
    const allUsers = Array.from(group.usersMap.values());
    const shortId = getDeviceShortId(group.deviceId);
    alerts.push({
      branch: group.branch,
      date: group.date,
      deviceId: group.deviceId,
      deviceShortId: shortId,
      deviceLabel: group.deviceLabel,
      users: allUsers,
    });

    group.records.forEach((rec) => {
      const ownLower = (rec.userName || '').trim().toLowerCase();
      const otherUsers = allUsers.filter((u) => u.toLowerCase() !== ownLower);
      sharedByRecordId.set(rec.id, {
        deviceShortId: rec.deviceShortId || shortId,
        deviceLabel: rec.deviceLabel || group.deviceLabel,
        otherUsers,
        allUsers,
      });
    });
  });

  alerts.sort((a, b) => b.date.localeCompare(a.date));
  return { sharedByRecordId, alerts };
};

// =========================================================================
// 4. SHARED BRANCH STATE LOADER & ATTENDANCE RECORDER
// =========================================================================

export const loadLocalGeofenceConfig = (branch: string): BranchGeofenceConfig => {
  try {
    const saved = localStorage.getItem(getGeofenceStorageKey(branch));
    if (saved) return normalizeGeofenceConfig(JSON.parse(saved), branch);
  } catch {}
  return getDefaultGeofenceConfig(branch);
};

export const loadLocalAttendanceRecords = (branch: string): AttendanceRecord[] => {
  try {
    const saved = localStorage.getItem(getAttendanceStorageKey(branch));
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

export const fetchBranchAttendanceState = async (
  branch: string
): Promise<{
  geofenceConfig: BranchGeofenceConfig;
  attendanceRecords: AttendanceRecord[];
  dbConnected: boolean;
}> => {
  const localConfig = loadLocalGeofenceConfig(branch);
  const localRecords = loadLocalAttendanceRecords(branch);

  if (!supabase) {
    return {
      geofenceConfig: localConfig,
      attendanceRecords: localRecords,
      dbConnected: false,
    };
  }

  try {
    const [geoTableRes, logsTableRes, settingsRes] = await Promise.all([
      supabase.from('branch_geofences').select('*').eq('branch', branch).maybeSingle(),
      supabase
        .from('attendance_logs')
        .select('*')
        .eq('branch', branch)
        .order('recorded_at', { ascending: false })
        .limit(1000),
      supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .eq('branch', branch)
        .in('setting_key', [
          'hellocrenn_geofence_config',
          'hellocrenn_attendance_logs',
          'hellocrenn_shift_config',
        ]),
    ]);

    const hasTableConnection = !geoTableRes.error || !logsTableRes.error;
    const hasSettingsConnection = !settingsRes.error;
    if (!hasTableConnection && !hasSettingsConnection) {
      return {
        geofenceConfig: localConfig,
        attendanceRecords: localRecords,
        dbConnected: false,
      };
    }

    const settingsList =
      !settingsRes.error && Array.isArray(settingsRes.data) ? settingsRes.data : [];
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

    let resolvedConfig = localConfig;
    if (!geoTableRes.error && geoTableRes.data) {
      const r = geoTableRes.data as any;
      const mergedEmployeeShifts = (() => {
        const baseShifts =
          r.employee_shifts && typeof r.employee_shifts === 'object' ? r.employee_shifts : {};
        const extraShifts =
          shiftExtras?.employeeShifts && typeof shiftExtras.employeeShifts === 'object'
            ? shiftExtras.employeeShifts
            : null;
        if (!extraShifts) return baseShifts;
        const shiftUpdatedAt = shiftExtras?.updatedAt
          ? new Date(shiftExtras.updatedAt).getTime()
          : 0;
        const tableUpdatedAt = r.updated_at ? new Date(r.updated_at).getTime() : 0;
        if (shiftUpdatedAt >= tableUpdatedAt) return extraShifts;

        const merged: Record<string, any> = { ...baseShifts };
        Object.entries(baseShifts).forEach(([k, v]: [string, any]) => {
          const ext = extraShifts[k];
          if (ext && typeof ext === 'object') {
            merged[k] = { ...ext, ...v };
          }
        });
        return merged;
      })();

      resolvedConfig = normalizeGeofenceConfig(
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
        branch
      );
      try {
        localStorage.setItem(getGeofenceStorageKey(branch), JSON.stringify(resolvedConfig));
      } catch {}
    } else if (geoSettingsRow?.setting_value || shiftSettingsRow?.setting_value) {
      const combined = {
        ...(geoSettingsRow?.setting_value || {}),
        ...(shiftSettingsRow?.setting_value || {}),
      };
      resolvedConfig = normalizeGeofenceConfig(combined, branch);
      try {
        localStorage.setItem(getGeofenceStorageKey(branch), JSON.stringify(resolvedConfig));
      } catch {}
    } else if (!settingsRes.error) {
      resolvedConfig = getDefaultGeofenceConfig(branch);
    }

    let resolvedRecords = localRecords;
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

      resolvedRecords = logsTableRes.data.map((r: any) => {
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
          deviceId: meta?.deviceId || r.device_id || undefined,
          deviceShortId:
            meta?.deviceShortId ||
            (r.device_id ? getDeviceShortId(r.device_id) : undefined),
          deviceLabel: meta?.deviceLabel || r.device_label || undefined,
          timeSource: meta?.timeSource || r.time_source || undefined,
          clockOffsetSec:
            typeof meta?.clockOffsetSec === 'number' ? meta.clockOffsetSec : undefined,
          suspiciousFlags: Array.isArray(meta?.suspiciousFlags)
            ? meta.suspiciousFlags
            : undefined,
        };
      });
      try {
        localStorage.setItem(getAttendanceStorageKey(branch), JSON.stringify(resolvedRecords));
      } catch {}
    } else if (
      logsSettingsRow?.setting_value &&
      Array.isArray(logsSettingsRow.setting_value)
    ) {
      resolvedRecords = logsSettingsRow.setting_value as AttendanceRecord[];
      try {
        localStorage.setItem(getAttendanceStorageKey(branch), JSON.stringify(resolvedRecords));
      } catch {}
    }

    return {
      geofenceConfig: resolvedConfig,
      attendanceRecords: resolvedRecords,
      dbConnected: true,
    };
  } catch {
    return {
      geofenceConfig: localConfig,
      attendanceRecords: localRecords,
      dbConnected: false,
    };
  }
};

export interface RecordAttendanceInput {
  currentUser: {
    name: string;
    role: string;
    branch: string;
  };
  geofenceConfig: BranchGeofenceConfig;
  existingRecords: AttendanceRecord[];
  type: AttendanceType;
  mode: AttendanceMode;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  accuracyMeters: number;
  note?: string;
}

export const recordBranchAttendance = async (
  input: RecordAttendanceInput
): Promise<{
  record: AttendanceRecord | null;
  nextRecords: AttendanceRecord[];
  duplicateDeviceUsers: string[];
  hasClockDrift: boolean;
}> => {
  const { currentUser, geofenceConfig, existingRecords } = input;

  // Always force-sync server clock right before recording attendance
  await syncServerTime(true);
  const { date: now, timeSource, clockOffsetSec, hasClockDrift } = getSyncedNow();
  const dateStr = toLocalDateStr(now);
  const timeDisplay = now.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const alreadyRecorded = existingRecords.some(
    (r) =>
      r.date === dateStr &&
      r.branch === currentUser.branch &&
      r.userName.toLowerCase() === currentUser.name.toLowerCase() &&
      r.type === input.type
  );
  if (alreadyRecorded) {
    return {
      record: null,
      nextRecords: existingRecords,
      duplicateDeviceUsers: [],
      hasClockDrift,
    };
  }

  const todayCheckInRec = existingRecords.find(
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
    input.type,
    now,
    geofenceConfig,
    currentUser.name,
    validCheckInDate
  );

  const device = getOrCreateDeviceIdentity();
  const otherDeviceUsers = Array.from(
    new Set(
      existingRecords
        .filter(
          (r) =>
            r.branch === currentUser.branch &&
            r.date === dateStr &&
            r.deviceId &&
            r.deviceId === device.deviceId &&
            r.userName.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()
        )
        .map((r) => r.userName.trim())
    )
  );

  const suspiciousFlags: string[] = [];
  if (otherDeviceUsers.length > 0) suspiciousFlags.push('shared_device');
  if (hasClockDrift) suspiciousFlags.push('clock_drift');

  const newRecord: AttendanceRecord = {
    id: generateUUID(),
    branch: currentUser.branch,
    date: dateStr,
    userName: currentUser.name,
    userRole: currentUser.role,
    type: input.type,
    recordedAt: now.toISOString(),
    timeDisplay,
    latitude: input.latitude,
    longitude: input.longitude,
    distanceMeters: input.distanceMeters,
    accuracyMeters: input.accuracyMeters,
    status: evalResult.status,
    mode: input.mode,
    otMinutes: evalResult.otMinutes,
    otMultiplier: evalResult.otMultiplier,
    shiftName: evalResult.shiftName,
    note: input.note,
    deviceId: device.deviceId,
    deviceShortId: device.deviceShortId,
    deviceLabel: device.deviceLabel,
    timeSource,
    clockOffsetSec,
    suspiciousFlags: suspiciousFlags.length > 0 ? suspiciousFlags : undefined,
  };

  const nextRecords = [newRecord, ...existingRecords].slice(0, 1500);

  try {
    localStorage.setItem(
      getAttendanceStorageKey(currentUser.branch),
      JSON.stringify(nextRecords)
    );
  } catch {}

  if (supabase) {
    // Save to dedicated attendance_logs table (core columns guaranteed on all schema versions) + full metadata in app_settings
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
  const typeLabel = input.type === 'check_in' ? 'เข้างาน (Check-in)' : 'ออกงาน (Check-out)';
  const modeLabel = input.mode === 'auto' ? 'Auto GPS' : 'Manual GPS';
  const otLine =
    input.type === 'check_out' && evalResult.otMinutes > 0
      ? `\n⏱️ ${getOtTypeLabel(evalResult.otMultiplier)}: ${formatOtHours(evalResult.otMinutes)} (${formatOtDuration(evalResult.otMinutes)})`
      : '';
  const timeSyncLabel =
    timeSource === 'server' ? 'เวลาเซิร์ฟเวอร์' : 'เวลาอุปกรณ์';
  const deviceLine = `\n📱 อุปกรณ์: ${device.deviceShortId} (${device.deviceLabel}) · ${timeSyncLabel}`;
  const sharedDeviceWarning =
    otherDeviceUsers.length > 0
      ? `\n🚨 **แจ้งเตือนความปลอดภัย (Shared Device):** อุปกรณ์ \`${device.deviceShortId}\` ถูกใช้สแกนให้พนักงานหลายคนในวันนี้ (ซ้ำกับ: ${otherDeviceUsers.join(', ')})`
      : '';
  const clockDriftWarning = hasClockDrift
    ? `\n⚠️ **พบเวลาเครื่องคลาดเคลื่อน:** นาฬิกาในเครื่องพนักงานต่างจากเซิร์ฟเวอร์ ${Math.round(Math.abs(clockOffsetSec) / 60)} นาที (ระบบยึดเวลาเซิร์ฟเวอร์จริงแล้ว)`
    : '';

  sendDiscordNotification(
    `📍 **[Hello, Crenn — ลงเวลา${typeLabel} · สาขา ${currentUser.branch}]**\n` +
      `👤 พนักงาน: ${currentUser.name} (${currentUser.role}) · กะ: ${evalResult.shiftName}\n` +
      `🗓️ วันที่: ${formatThaiNumericDate(dateStr)} เวลา ${timeDisplay}\n` +
      `📡 รูปแบบ: ${modeLabel} | ระยะห่างร้าน: ${formatDistanceMeters(input.distanceMeters)} (±${input.accuracyMeters} ม.)\n` +
      `✅ สถานะ: ${getStatusLabelTH(evalResult.status)}` +
      otLine +
      deviceLine +
      (input.note ? `\n📝 หมายเหตุ: ${input.note}` : '') +
      sharedDeviceWarning +
      clockDriftWarning,
    'notifyOnHelloCrennCheckin'
  );

  // If duplicate device detected & missing/security alert flag enabled separately while check-in alert is off, notify security channel too
  if (otherDeviceUsers.length > 0) {
    try {
      const savedDiscord = localStorage.getItem('discordNotifySettings');
      if (savedDiscord) {
        const ds = normalizeDiscordSettings(JSON.parse(savedDiscord));
        if (!ds.notifyOnHelloCrennCheckin && ds.notifyOnHelloCrennMissingAlert) {
          sendDiscordNotification(
            `🚨 **[Hello, Crenn — แจ้งเตือนความปลอดภัยอุปกรณ์ · สาขา ${currentUser.branch}]**\n` +
              `📱 อุปกรณ์ \`${device.deviceShortId}\` (${device.deviceLabel}) ถูกใช้ลงเวลาซ้ำในวันเดียวกัน (${formatThaiNumericDate(dateStr)})\n` +
              `👥 พนักงานที่ใช้เครื่องนี้: ${[...otherDeviceUsers, currentUser.name].join(', ')}`,
            'notifyOnHelloCrennMissingAlert'
          );
        }
      }
    } catch {}
  }

  return {
    record: newRecord,
    nextRecords,
    duplicateDeviceUsers: otherDeviceUsers,
    hasClockDrift,
  };
};

// =========================================================================
// 5. APPROVED LEAVE LOOKUP & AUTOMATED MISSING CHECK-IN/OUT DISCORD ALERTS
// =========================================================================

const isBranchEqual = (a?: string, b?: string): boolean => {
  if (!a || !b) return true;
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (bl === 'rayong' || bl.includes('ระยอง')) return al.includes('rayong') || al.includes('ระยอง');
  if (bl === 'bangkok' || bl.includes('กรุงเทพ')) return al.includes('bangkok') || al.includes('กรุงเทพ');
  return al === bl;
};

export const fetchApprovedLeaveUsersOnDate = async (
  branch: string,
  dateStr: string
): Promise<Set<string>> => {
  const result = new Set<string>();

  const considerRecord = (raw: {
    userName?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    branch?: string;
  }) => {
    const status = String(raw.status || '').trim().toLowerCase();
    if (status !== 'approved') return;
    if (!raw.userName || !raw.fromDate) return;
    if (!isBranchEqual(raw.branch, branch)) return;
    const fromD = String(raw.fromDate).slice(0, 10);
    const toD = String(raw.toDate || raw.fromDate).slice(0, 10);
    if (fromD <= dateStr && dateStr <= toD) {
      result.add(raw.userName.trim().toLowerCase());
    }
  };

  try {
    const saved = localStorage.getItem('crenn_leave_requests');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) =>
          considerRecord({
            userName: item.userName || item.user_name,
            status: item.status,
            fromDate: item.fromDate || item.from_date,
            toDate: item.toDate || item.to_date,
            branch: item.userBranch || item.branch,
          })
        );
      }
    }
  } catch {}

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('user_name, status, from_date, to_date, branch')
        .lte('from_date', dateStr)
        .gte('to_date', dateStr);
      if (!error && Array.isArray(data)) {
        data.forEach((item: any) =>
          considerRecord({
            userName: item.user_name,
            status: item.status,
            fromDate: item.from_date,
            toDate: item.to_date,
            branch: item.branch,
          })
        );
      }
    } catch {}
  }

  return result;
};

const parseHHMM = (hhmm: string): number => {
  const [h, m] = (hhmm || '08:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const getMissingAlertStorageKey = (branch: string) =>
  `hellocrenn_missing_alerts_v1_${branch}`;

const loadBranchStaffForAlerts = async (
  branch: string
): Promise<Array<{ name: string; role: string }>> => {
  const map = new Map<string, { name: string; role: string }>();
  const register = (u: any) => {
    if (!u || !u.name) return;
    const name = String(u.name).trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { name, role: u.role ? String(u.role) : 'Staff' });
    }
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('name, role, branch')
        .eq('branch', branch);
      if (!error && Array.isArray(data)) data.forEach(register);
    } catch {}
  }

  if (typeof window !== 'undefined') {
    [`cafe-app-users-${branch}`, 'cafe-app-users', 'app_users'].forEach((sk) => {
      try {
        const raw = localStorage.getItem(sk);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed
            .filter((u: any) => !u.branch || u.branch === branch)
            .forEach(register);
        }
      } catch {}
    });
  }

  return Array.from(map.values());
};

export const runMissingAttendanceAlertCheck = async (params: {
  branch: string;
  geofenceConfig: BranchGeofenceConfig;
  attendanceRecords: AttendanceRecord[];
}): Promise<void> => {
  const { branch, geofenceConfig, attendanceRecords } = params;
  if (typeof window === 'undefined') return;

  // Check if Discord Notify + missing attendance alerts are enabled
  try {
    const savedDiscord = localStorage.getItem('discordNotifySettings');
    if (!savedDiscord) return;
    const settings = normalizeDiscordSettings(JSON.parse(savedDiscord));
    if (!settings.enabled || !settings.webhookUrl.trim() || !settings.notifyOnHelloCrennMissingAlert) {
      return;
    }
  } catch {
    return;
  }

  await syncServerTime(false);
  const { date: now } = getSyncedNow();
  const todayStr = toLocalDateStr(now);
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const [staffList, leaveUsers] = await Promise.all([
    loadBranchStaffForAlerts(branch),
    fetchApprovedLeaveUsersOnDate(branch, todayStr),
  ]);

  // Also include employees configured explicitly in employeeShifts
  const staffMap = new Map<string, { name: string; role: string }>();
  staffList.forEach((s) => staffMap.set(s.name.toLowerCase(), s));
  (Object.values(geofenceConfig.employeeShifts ?? {}) as EmployeeShiftConfig[]).forEach((s) => {
    if (!s?.userName) return;
    const k = s.userName.trim().toLowerCase();
    if (!staffMap.has(k)) {
      staffMap.set(k, { name: s.userName.trim(), role: s.userRole || 'Staff' });
    }
  });

  if (staffMap.size === 0) return;

  // Read existing sent alert keys from localStorage & Supabase app_settings to prevent duplicate Discord pings across devices
  let sentByDate: Record<string, string[]> = {};
  try {
    const rawLocal = localStorage.getItem(getMissingAlertStorageKey(branch));
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed && typeof parsed === 'object') sentByDate = parsed;
    }
  } catch {}

  if (supabase) {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('branch', branch)
        .eq('setting_key', 'hellocrenn_missing_alerts_sent')
        .maybeSingle();
      if (data?.setting_value && typeof data.setting_value === 'object') {
        const cloudObj = data.setting_value as Record<string, string[]>;
        Object.entries(cloudObj).forEach(([dt, arr]) => {
          if (!Array.isArray(arr)) return;
          const merged = new Set([...(sentByDate[dt] || []), ...arr]);
          sentByDate[dt] = Array.from(merged);
        });
      }
    } catch {}
  }

  const alreadySentSet = new Set<string>(sentByDate[todayStr] || []);
  const todayRecords = attendanceRecords.filter(
    (r) => r.branch === branch && r.date === todayStr
  );

  const missingCheckIns: Array<{ name: string; role: string; shiftStart: string; alertKey: string }> = [];
  const missingCheckOuts: Array<{ name: string; role: string; shiftEnd: string; checkInTime: string; alertKey: string }> = [];

  staffMap.forEach((emp) => {
    const lower = emp.name.toLowerCase();
    if (leaveUsers.has(lower)) return;

    const shift = resolveEmployeeShift(geofenceConfig, emp.name, now);
    if (shift.ignored || shift.isDayOff || shift.isOvertimeSchedule) return;

    const empRecs = todayRecords.filter((r) => r.userName.trim().toLowerCase() === lower);
    const checkIn = empRecs.find((r) => r.type === 'check_in');
    const checkOut = empRecs.find((r) => r.type === 'check_out');

    const startMins = parseHHMM(shift.shiftStartTime);
    let endMins = parseHHMM(shift.shiftEndTime);
    let adjCurrent = currentMins;
    if (endMins <= startMins) {
      endMins += 24 * 60;
      if (adjCurrent < startMins) adjCurrent += 24 * 60;
    }

    // 1. Missing Check-in: grace + 15 minutes past shift start (min 15 mins after start)
    const checkInAlertThreshold = startMins + Math.max(15, (shift.graceMinutes || 0) + 15);
    if (!checkIn && currentMins >= checkInAlertThreshold) {
      const alertKey = `missing_in:${lower}`;
      if (!alreadySentSet.has(alertKey)) {
        missingCheckIns.push({
          name: emp.name,
          role: emp.role,
          shiftStart: shift.shiftStartTime,
          alertKey,
        });
      }
    }

    // 2. Missing Check-out: 30 minutes past shift end (and employee checked in today)
    const checkOutAlertThreshold = endMins + 30;
    if (checkIn && !checkOut && adjCurrent >= checkOutAlertThreshold) {
      const alertKey = `missing_out:${lower}`;
      if (!alreadySentSet.has(alertKey)) {
        missingCheckOuts.push({
          name: emp.name,
          role: emp.role,
          shiftEnd: shift.shiftEndTime,
          checkInTime: checkIn.timeDisplay,
          alertKey,
        });
      }
    }
  });

  if (missingCheckIns.length === 0 && missingCheckOuts.length === 0) return;

  // Record sent keys (keep last 7 days only) before firing Discord to avoid duplicate sends across open tabs
  const newKeys = [
    ...missingCheckIns.map((x) => x.alertKey),
    ...missingCheckOuts.map((x) => x.alertKey),
  ];
  const updatedTodayKeys = Array.from(new Set([...alreadySentSet, ...newKeys]));
  const prunedSentByDate: Record<string, string[]> = { [todayStr]: updatedTodayKeys };
  Object.keys(sentByDate)
    .sort()
    .slice(-6)
    .forEach((k) => {
      if (k !== todayStr) prunedSentByDate[k] = sentByDate[k];
    });

  try {
    localStorage.setItem(getMissingAlertStorageKey(branch), JSON.stringify(prunedSentByDate));
  } catch {}

  if (supabase) {
    try {
      await supabase.from('app_settings').upsert(
        {
          branch,
          setting_key: 'hellocrenn_missing_alerts_sent',
          setting_value: prunedSentByDate,
        },
        { onConflict: 'branch,setting_key' }
      );
    } catch {}
  }

  const timeNowStr = now.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const sections: string[] = [];
  if (missingCheckIns.length > 0) {
    const lines = missingCheckIns
      .map((m) => `• **${m.name}** (${m.role}) — กะเริ่ม ${m.shiftStart} น.`)
      .join('\n');
    sections.push(`🔸 **ยังไม่สแกนเข้างาน (Check-in):**\n${lines}`);
  }
  if (missingCheckOuts.length > 0) {
    const lines = missingCheckOuts
      .map(
        (m) =>
          `• **${m.name}** (${m.role}) — เข้างาน ${m.checkInTime} · เลิกกะ ${m.shiftEnd} น.`
      )
      .join('\n');
    sections.push(`🔹 **ยังไม่สแกนออกงานหลังเลิกกะ (Check-out):**\n${lines}`);
  }

  await sendDiscordNotification(
    `⏰ **[Hello, Crenn — แจ้งเตือนลืมลงเวลา · สาขา ${branch}]**\n` +
      `🗓️ วันที่: ${formatThaiNumericDate(todayStr)} · ตรวจสอบเมื่อ ${timeNowStr} น.\n\n` +
      sections.join('\n\n') +
      `\n\n💡 ระบบคัดกรองพนักงานที่ได้รับอนุมัติการลา/วันหยุด/Ignore ออกแล้ว`,
    'notifyOnHelloCrennMissingAlert'
  );
};
