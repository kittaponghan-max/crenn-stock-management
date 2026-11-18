import {
  AttendanceStatus,
  AttendanceType,
  BranchGeofenceConfig,
  EmployeeShiftConfig,
} from '../types/hellocrenn';

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Computes great-circle distance in meters between two WGS84 coordinates (Haversine formula).
 */
export const calculateHaversineDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
};

export const formatDistanceMeters = (meters: number | null | undefined): string => {
  if (meters === null || meters === undefined || Number.isNaN(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} ม.`;
  return `${(meters / 1000).toFixed(2)} กม.`;
};

export const getDefaultGeofenceConfig = (branch: string): BranchGeofenceConfig => {
  const isBangkok = branch === 'Bangkok';
  return {
    branch,
    branchLabel: isBangkok ? 'สาขากรุงเทพฯ (Bangkok)' : 'สาขาระยอง (Rayong)',
    // Default branch reference points; Admin can update via "ใช้พิกัดปัจจุบันของฉัน"
    latitude: isBangkok ? 13.756331 : 12.681396,
    longitude: isBangkok ? 100.501765 : 101.281626,
    radiusMeters: 100,
    maxAccuracyMeters: 200,
    shiftStartTime: '08:00',
    shiftEndTime: '17:00',
    graceMinutes: 15,
    otStepMinutes: 30,
    employeeShifts: {},
    autoCheckinEnabled: true,
    autoCheckoutEnabled: false,
    isConfigured: false,
  };
};

const normalizeEmployeeShiftEntry = (
  raw: any,
  keyName: string,
  defaults: {
    shiftStartTime: string;
    shiftEndTime: string;
    graceMinutes: number;
    otStepMinutes: number;
  }
): EmployeeShiftConfig => {
  const grace = Number(raw?.graceMinutes);
  const otStep = Number(raw?.otStepMinutes);
  return {
    userId: typeof raw?.userId === 'string' ? raw.userId : undefined,
    userName:
      typeof raw?.userName === 'string' && raw.userName.trim()
        ? raw.userName.trim()
        : keyName,
    userRole: typeof raw?.userRole === 'string' ? raw.userRole : undefined,
    shiftStartTime:
      typeof raw?.shiftStartTime === 'string' && /^\d{2}:\d{2}$/.test(raw.shiftStartTime)
        ? raw.shiftStartTime
        : defaults.shiftStartTime,
    shiftEndTime:
      typeof raw?.shiftEndTime === 'string' && /^\d{2}:\d{2}$/.test(raw.shiftEndTime)
        ? raw.shiftEndTime
        : defaults.shiftEndTime,
    graceMinutes:
      Number.isFinite(grace) && grace >= 0 ? grace : defaults.graceMinutes,
    otStepMinutes:
      Number.isFinite(otStep) && otStep >= 0 ? otStep : defaults.otStepMinutes,
    ignored: Boolean(raw?.ignored),
  };
};

export const normalizeGeofenceConfig = (
  raw: any,
  branch: string
): BranchGeofenceConfig => {
  const base = getDefaultGeofenceConfig(branch);
  if (!raw || typeof raw !== 'object') return base;

  const lat = Number(raw.latitude);
  const lng = Number(raw.longitude);
  const rad = Number(raw.radiusMeters);
  const maxAcc = Number(raw.maxAccuracyMeters);
  const grace = Number(raw.graceMinutes);
  const otStep = Number(raw.otStepMinutes);

  const shiftStartTime =
    typeof raw.shiftStartTime === 'string' && /^\d{2}:\d{2}$/.test(raw.shiftStartTime)
      ? raw.shiftStartTime
      : base.shiftStartTime;
  const shiftEndTime =
    typeof raw.shiftEndTime === 'string' && /^\d{2}:\d{2}$/.test(raw.shiftEndTime)
      ? raw.shiftEndTime
      : base.shiftEndTime;
  const graceMinutes =
    Number.isFinite(grace) && grace >= 0 ? grace : base.graceMinutes;
  const otStepMinutes =
    Number.isFinite(otStep) && otStep >= 0 ? otStep : base.otStepMinutes;

  const normalizedShifts: Record<string, EmployeeShiftConfig> = {};
  if (raw.employeeShifts && typeof raw.employeeShifts === 'object' && !Array.isArray(raw.employeeShifts)) {
    Object.entries(raw.employeeShifts).forEach(([k, val]) => {
      if (!k || !val || typeof val !== 'object') return;
      const entry = normalizeEmployeeShiftEntry(val, k, {
        shiftStartTime,
        shiftEndTime,
        graceMinutes,
        otStepMinutes,
      });
      normalizedShifts[entry.userName] = entry;
    });
  }

  return {
    branch: raw.branch || branch,
    branchLabel:
      typeof raw.branchLabel === 'string' && raw.branchLabel.trim()
        ? raw.branchLabel
        : base.branchLabel,
    latitude: Number.isFinite(lat) ? lat : base.latitude,
    longitude: Number.isFinite(lng) ? lng : base.longitude,
    radiusMeters: Number.isFinite(rad) && rad >= 10 ? rad : base.radiusMeters,
    maxAccuracyMeters:
      Number.isFinite(maxAcc) && maxAcc >= 20 ? maxAcc : base.maxAccuracyMeters,
    shiftStartTime,
    shiftEndTime,
    graceMinutes,
    otStepMinutes,
    employeeShifts: normalizedShifts,
    autoCheckinEnabled:
      typeof raw.autoCheckinEnabled === 'boolean'
        ? raw.autoCheckinEnabled
        : base.autoCheckinEnabled,
    autoCheckoutEnabled:
      typeof raw.autoCheckoutEnabled === 'boolean'
        ? raw.autoCheckoutEnabled
        : base.autoCheckoutEnabled,
    isConfigured: typeof raw.isConfigured === 'boolean' ? raw.isConfigured : true,
    updatedBy: raw.updatedBy,
    updatedAt: raw.updatedAt,
  };
};

/**
 * Resolves effective shift & OT settings for a specific employee, falling back to branch defaults.
 */
export const resolveEmployeeShift = (
  config: BranchGeofenceConfig,
  userName?: string
): {
  shiftStartTime: string;
  shiftEndTime: string;
  graceMinutes: number;
  otStepMinutes: number;
  isCustom: boolean;
  ignored: boolean;
} => {
  const fallback = {
    shiftStartTime: config.shiftStartTime || '08:00',
    shiftEndTime: config.shiftEndTime || '17:00',
    graceMinutes: config.graceMinutes ?? 15,
    otStepMinutes: config.otStepMinutes ?? 30,
    isCustom: false,
    ignored: false,
  };

  if (!userName || !config.employeeShifts) return fallback;
  const target = userName.trim().toLowerCase();
  const matched =
    config.employeeShifts[userName] ||
    Object.values(config.employeeShifts).find(
      (s) => s.userName.trim().toLowerCase() === target
    );

  if (!matched) return fallback;

  return {
    shiftStartTime: matched.shiftStartTime || fallback.shiftStartTime,
    shiftEndTime: matched.shiftEndTime || fallback.shiftEndTime,
    graceMinutes:
      typeof matched.graceMinutes === 'number' && matched.graceMinutes >= 0
        ? matched.graceMinutes
        : fallback.graceMinutes,
    otStepMinutes:
      typeof matched.otStepMinutes === 'number' && matched.otStepMinutes >= 0
        ? matched.otStepMinutes
        : fallback.otStepMinutes,
    isCustom: true,
    ignored: Boolean(matched.ignored),
  };
};

const parseHHMMToMinutes = (hhmm: string): number => {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  return h * 60 + m;
};

/**
 * Calculates floored OT minutes based on otStepMinutes (e.g. every 30 mins).
 */
export const calculateOtMinutes = (
  now: Date,
  shiftEndTime: string,
  otStepMinutes: number
): number => {
  if (!otStepMinutes || otStepMinutes <= 0) return 0;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = parseHHMMToMinutes(shiftEndTime);
  const extraMinutes = currentMinutes - endMinutes;
  if (extraMinutes < otStepMinutes) return 0;
  return Math.floor(extraMinutes / otStepMinutes) * otStepMinutes;
};

export const formatOtDuration = (otMinutes?: number): string => {
  if (!otMinutes || otMinutes <= 0) return '—';
  if (otMinutes < 60) return `${otMinutes} นาที`;
  const hrs = Math.floor(otMinutes / 60);
  const mins = otMinutes % 60;
  return mins > 0 ? `${hrs} ชม. ${mins} นาที (${otMinutes} น.)` : `${hrs} ชม. (${otMinutes} น.)`;
};

export const evaluateAttendanceStatus = (
  type: AttendanceType,
  now: Date,
  config: BranchGeofenceConfig,
  userName?: string
): { status: AttendanceStatus; diffMinutes: number; otMinutes: number } => {
  const shift = resolveEmployeeShift(config, userName);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (type === 'check_in') {
    const startMinutes = parseHHMMToMinutes(shift.shiftStartTime) + (shift.graceMinutes || 0);
    if (currentMinutes > startMinutes) {
      return {
        status: 'late',
        diffMinutes: currentMinutes - parseHHMMToMinutes(shift.shiftStartTime),
        otMinutes: 0,
      };
    }
    return { status: 'on_time', diffMinutes: 0, otMinutes: 0 };
  }

  const endMinutes = parseHHMMToMinutes(shift.shiftEndTime);
  if (currentMinutes < endMinutes) {
    return {
      status: 'early_out',
      diffMinutes: endMinutes - currentMinutes,
      otMinutes: 0,
    };
  }
  const otMinutes = calculateOtMinutes(now, shift.shiftEndTime, shift.otStepMinutes);
  return { status: 'completed', diffMinutes: 0, otMinutes };
};

export const formatMinutesDuration = (startIso?: string, endIso?: string): string => {
  if (!startIso || !endIso) return '—';
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—';
  const totalMins = Math.floor((end - start) / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hours} ชม. ${String(mins).padStart(2, '0')} นาที`;
};

export const getStatusLabelTH = (status: AttendanceStatus): string => {
  switch (status) {
    case 'on_time':
      return 'ตรงเวลา';
    case 'late':
      return 'มาสาย';
    case 'early_out':
      return 'ออกก่อนเวลา';
    case 'completed':
      return 'ครบเวลาทำงาน';
    default:
      return status;
  }
};
