import { AttendanceStatus, AttendanceType, BranchGeofenceConfig } from '../types/hellocrenn';

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
    autoCheckinEnabled: true,
    autoCheckoutEnabled: false,
    isConfigured: false,
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

  return {
    branch: raw.branch || branch,
    branchLabel: typeof raw.branchLabel === 'string' && raw.branchLabel.trim() ? raw.branchLabel : base.branchLabel,
    latitude: Number.isFinite(lat) ? lat : base.latitude,
    longitude: Number.isFinite(lng) ? lng : base.longitude,
    radiusMeters: Number.isFinite(rad) && rad >= 10 ? rad : base.radiusMeters,
    maxAccuracyMeters: Number.isFinite(maxAcc) && maxAcc >= 20 ? maxAcc : base.maxAccuracyMeters,
    shiftStartTime: typeof raw.shiftStartTime === 'string' && /^\d{2}:\d{2}$/.test(raw.shiftStartTime)
      ? raw.shiftStartTime
      : base.shiftStartTime,
    shiftEndTime: typeof raw.shiftEndTime === 'string' && /^\d{2}:\d{2}$/.test(raw.shiftEndTime)
      ? raw.shiftEndTime
      : base.shiftEndTime,
    graceMinutes: Number.isFinite(grace) && grace >= 0 ? grace : base.graceMinutes,
    autoCheckinEnabled: typeof raw.autoCheckinEnabled === 'boolean' ? raw.autoCheckinEnabled : base.autoCheckinEnabled,
    autoCheckoutEnabled: typeof raw.autoCheckoutEnabled === 'boolean' ? raw.autoCheckoutEnabled : base.autoCheckoutEnabled,
    isConfigured: typeof raw.isConfigured === 'boolean' ? raw.isConfigured : true,
    updatedBy: raw.updatedBy,
    updatedAt: raw.updatedAt,
  };
};

const parseHHMMToMinutes = (hhmm: string): number => {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  return h * 60 + m;
};

export const evaluateAttendanceStatus = (
  type: AttendanceType,
  now: Date,
  config: BranchGeofenceConfig
): { status: AttendanceStatus; diffMinutes: number } => {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (type === 'check_in') {
    const startMinutes = parseHHMMToMinutes(config.shiftStartTime) + (config.graceMinutes || 0);
    if (currentMinutes > startMinutes) {
      return { status: 'late', diffMinutes: currentMinutes - parseHHMMToMinutes(config.shiftStartTime) };
    }
    return { status: 'on_time', diffMinutes: 0 };
  }

  const endMinutes = parseHHMMToMinutes(config.shiftEndTime);
  if (currentMinutes < endMinutes) {
    return { status: 'early_out', diffMinutes: endMinutes - currentMinutes };
  }
  return { status: 'completed', diffMinutes: 0 };
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
