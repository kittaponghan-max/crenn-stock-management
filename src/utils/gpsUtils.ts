import {
  AttendanceStatus,
  AttendanceType,
  BranchGeofenceConfig,
  DayOfWeekKey,
  EmployeeShiftConfig,
  HolidayOtOverride,
  OtMultiplier,
  ShiftTemplate,
} from '../types/hellocrenn';

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

export const DAY_OF_WEEK_LIST: Array<{
  key: DayOfWeekKey;
  shortLabel: string;
  label: string;
  jsDay: number;
}> = [
  { key: 'mon', shortLabel: 'จ.', label: 'จันทร์', jsDay: 1 },
  { key: 'tue', shortLabel: 'อ.', label: 'อังคาร', jsDay: 2 },
  { key: 'wed', shortLabel: 'พ.', label: 'พุธ', jsDay: 3 },
  { key: 'thu', shortLabel: 'พฤ.', label: 'พฤหัสบดี', jsDay: 4 },
  { key: 'fri', shortLabel: 'ศ.', label: 'ศุกร์', jsDay: 5 },
  { key: 'sat', shortLabel: 'ส.', label: 'เสาร์', jsDay: 6 },
  { key: 'sun', shortLabel: 'อา.', label: 'อาทิตย์', jsDay: 0 },
];

export const OT_MULTIPLIER_OPTIONS: Array<{
  value: OtMultiplier;
  shortLabel: string;
  label: string;
  description: string;
}> = [
  {
    value: 1.5,
    shortLabel: '1.5 เท่า',
    label: 'OT 1.5 เท่า',
    description: 'ล่วงเวลาในวันทำงานปกติ (หลังเลิกงาน / เข้าก่อนเวลา)',
  },
  {
    value: 2,
    shortLabel: '2 เท่า',
    label: 'OT 2 เท่า',
    description: 'ทำงานในวันหยุดประจำสัปดาห์ / วันหยุดพิเศษ',
  },
  {
    value: 3,
    shortLabel: '3 เท่า',
    label: 'OT 3 เท่า',
    description: 'ล่วงเวลาในวันหยุดประจำสัปดาห์ / วันหยุดนักขัตฤกษ์',
  },
];

export const normalizeOtMultiplier = (val: any, fallback: OtMultiplier = 1.5): OtMultiplier => {
  const num = Number(val);
  if (num === 1.5 || num === 2 || num === 3) return num;
  return fallback;
};

export const getDayOfWeekKey = (date: Date = new Date()): DayOfWeekKey => {
  const d = date.getDay();
  switch (d) {
    case 1:
      return 'mon';
    case 2:
      return 'tue';
    case 3:
      return 'wed';
    case 4:
      return 'thu';
    case 5:
      return 'fri';
    case 6:
      return 'sat';
    default:
      return 'sun';
  }
};

const toDateYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getOtTypeLabel = (multiplier?: number | null): string => {
  const norm = normalizeOtMultiplier(multiplier, 1.5);
  if (norm === 2) return 'OT 2 เท่า';
  if (norm === 3) return 'OT 3 เท่า';
  return 'OT 1.5 เท่า';
};

export const getOtTypeShortBadge = (multiplier?: number | null): string => {
  const norm = normalizeOtMultiplier(multiplier, 1.5);
  return `${norm}x`;
};

const parseHHMMToMinutes = (hhmm: string): number => {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  return h * 60 + m;
};

export const computeShiftWorkMinutes = (
  checkInTime: string,
  checkOutTime: string,
  breakMinutes: number = 60
): number => {
  const start = parseHHMMToMinutes(checkInTime || '08:00');
  let end = parseHHMMToMinutes(checkOutTime || '17:00');
  if (end <= start) end += 24 * 60; // overnight shift support
  const gross = end - start;
  return Math.max(0, gross - Math.max(0, Number(breakMinutes) || 0));
};

export const createDefaultShiftTemplate = (overrides?: Partial<ShiftTemplate>): ShiftTemplate => {
  const checkInTime = overrides?.checkInTime || '08:00';
  const checkOutTime = overrides?.checkOutTime || '17:00';
  const breakMinutes = overrides?.breakMinutes ?? 60;
  const workMinutes =
    overrides?.workMinutes ?? computeShiftWorkMinutes(checkInTime, checkOutTime, breakMinutes);

  return {
    id: overrides?.id || 'tpl_default',
    name: overrides?.name || 'Default (ค่ามาตรฐานสาขา)',
    scheduleType: overrides?.scheduleType || 'standard',
    checkInTime,
    checkOutTime,
    breakMinutes,
    workMinutes,
    graceMinutes: overrides?.graceMinutes ?? 15,
    checkInBeforeMinutes: overrides?.checkInBeforeMinutes ?? 60,
    checkInAfterMinutes: overrides?.checkInAfterMinutes ?? 60,
    checkOutBeforeMinutes: overrides?.checkOutBeforeMinutes ?? 5,
    checkOutAfterMinutes: overrides?.checkOutAfterMinutes ?? 240,
    isOvertimeSchedule: Boolean(overrides?.isOvertimeSchedule),
    earlyInRule: overrides?.earlyInRule || 'ignore',
    earlyInThresholdMinutes: overrides?.earlyInThresholdMinutes ?? 0,
    earlyInMinOtMinutes: overrides?.earlyInMinOtMinutes ?? 30,
    lateOutRule: overrides?.lateOutRule || 'count_ot',
    lateOutThresholdMinutes: overrides?.lateOutThresholdMinutes ?? 0,
    lateOutMinOtMinutes: overrides?.lateOutMinOtMinutes ?? 30,
    otCalculationMode: overrides?.otCalculationMode || 'step',
    otStepMinutes: overrides?.otStepMinutes ?? 30,
    otMultiplier: normalizeOtMultiplier(overrides?.otMultiplier, 1.5),
    color: overrides?.color || '#5A8A88',
  };
};

export const normalizeShiftTemplate = (
  raw: any,
  fallbackDefaults?: {
    checkInTime?: string;
    checkOutTime?: string;
    graceMinutes?: number;
    otStepMinutes?: number;
    otMultiplier?: OtMultiplier;
  }
): ShiftTemplate => {
  const checkInTime =
    typeof raw?.checkInTime === 'string' && /^\d{2}:\d{2}$/.test(raw.checkInTime)
      ? raw.checkInTime
      : fallbackDefaults?.checkInTime || '08:00';
  const checkOutTime =
    typeof raw?.checkOutTime === 'string' && /^\d{2}:\d{2}$/.test(raw.checkOutTime)
      ? raw.checkOutTime
      : fallbackDefaults?.checkOutTime || '17:00';
  const breakMinutes = Number.isFinite(Number(raw?.breakMinutes))
    ? Math.max(0, Number(raw.breakMinutes))
    : 60;
  const computedWork = computeShiftWorkMinutes(checkInTime, checkOutTime, breakMinutes);
  const workMinutes =
    raw?.scheduleType === 'flexible' && Number.isFinite(Number(raw?.workMinutes))
      ? Math.max(0, Number(raw.workMinutes))
      : computedWork;

  return {
    id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id.trim() : `tpl_${Date.now()}`,
    name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : 'กะงานมาตรฐาน',
    scheduleType:
      raw?.scheduleType === 'flexible' || raw?.scheduleType === 'overtime'
        ? raw.scheduleType
        : 'standard',
    checkInTime,
    checkOutTime,
    breakMinutes,
    workMinutes,
    graceMinutes: Number.isFinite(Number(raw?.graceMinutes))
      ? Math.max(0, Number(raw.graceMinutes))
      : fallbackDefaults?.graceMinutes ?? 15,
    checkInBeforeMinutes: Number.isFinite(Number(raw?.checkInBeforeMinutes))
      ? Math.max(0, Number(raw.checkInBeforeMinutes))
      : 60,
    checkInAfterMinutes: Number.isFinite(Number(raw?.checkInAfterMinutes))
      ? Math.max(0, Number(raw.checkInAfterMinutes))
      : 60,
    checkOutBeforeMinutes: Number.isFinite(Number(raw?.checkOutBeforeMinutes))
      ? Math.max(0, Number(raw.checkOutBeforeMinutes))
      : 5,
    checkOutAfterMinutes: Number.isFinite(Number(raw?.checkOutAfterMinutes))
      ? Math.max(0, Number(raw.checkOutAfterMinutes))
      : 240,
    isOvertimeSchedule: Boolean(raw?.isOvertimeSchedule || raw?.scheduleType === 'overtime'),
    earlyInRule: raw?.earlyInRule === 'count_ot' ? 'count_ot' : 'ignore',
    earlyInThresholdMinutes: Number.isFinite(Number(raw?.earlyInThresholdMinutes))
      ? Math.max(0, Number(raw.earlyInThresholdMinutes))
      : 0,
    earlyInMinOtMinutes: Number.isFinite(Number(raw?.earlyInMinOtMinutes))
      ? Math.max(0, Number(raw.earlyInMinOtMinutes))
      : 30,
    lateOutRule: raw?.lateOutRule === 'ignore' ? 'ignore' : 'count_ot',
    lateOutThresholdMinutes: Number.isFinite(Number(raw?.lateOutThresholdMinutes))
      ? Math.max(0, Number(raw.lateOutThresholdMinutes))
      : 0,
    lateOutMinOtMinutes: Number.isFinite(Number(raw?.lateOutMinOtMinutes))
      ? Math.max(0, Number(raw.lateOutMinOtMinutes))
      : 30,
    otCalculationMode: raw?.otCalculationMode === 'actual' ? 'actual' : 'step',
    otStepMinutes: Number.isFinite(Number(raw?.otStepMinutes))
      ? Math.max(0, Number(raw.otStepMinutes))
      : fallbackDefaults?.otStepMinutes ?? 30,
    otMultiplier: normalizeOtMultiplier(raw?.otMultiplier, fallbackDefaults?.otMultiplier ?? 1.5),
    color: typeof raw?.color === 'string' && raw.color.trim() ? raw.color : '#5A8A88',
  };
};

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
    defaultOtMultiplier: 1.5,
    shiftTemplates: [
      createDefaultShiftTemplate({
        id: 'tpl_default',
        name: 'Default (ค่ามาตรฐานสาขา)',
        checkInTime: '08:00',
        checkOutTime: '17:00',
        breakMinutes: 60,
        graceMinutes: 15,
        otStepMinutes: 30,
        otMultiplier: 1.5,
      }),
    ],
    holidayOverrides: [],
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

  let weeklySchedule: Partial<Record<DayOfWeekKey, string>> | undefined = undefined;
  if (raw?.weeklySchedule && typeof raw.weeklySchedule === 'object') {
    const cleanWeekly: Partial<Record<DayOfWeekKey, string>> = {};
    DAY_OF_WEEK_LIST.forEach((d) => {
      const v = raw.weeklySchedule[d.key];
      if (typeof v === 'string' && v.trim()) {
        cleanWeekly[d.key] = v.trim();
      }
    });
    if (Object.keys(cleanWeekly).length > 0) {
      weeklySchedule = cleanWeekly;
    }
  }

  const assignmentMode =
    raw?.assignmentMode === 'template' ||
    raw?.assignmentMode === 'weekly' ||
    raw?.assignmentMode === 'custom' ||
    raw?.assignmentMode === 'branch_default'
      ? raw.assignmentMode
      : weeklySchedule
        ? 'weekly'
        : typeof raw?.shiftTemplateId === 'string' && raw.shiftTemplateId.trim()
          ? 'template'
          : undefined;

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
    assignmentMode,
    shiftTemplateId:
      typeof raw?.shiftTemplateId === 'string' && raw.shiftTemplateId.trim()
        ? raw.shiftTemplateId.trim()
        : undefined,
    weeklySchedule,
    otMultiplier:
      raw?.otMultiplier !== undefined && raw?.otMultiplier !== null
        ? normalizeOtMultiplier(raw.otMultiplier)
        : undefined,
    dayOffOtMultiplier:
      raw?.dayOffOtMultiplier !== undefined && raw?.dayOffOtMultiplier !== null
        ? normalizeOtMultiplier(raw.dayOffOtMultiplier, 2)
        : undefined,
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
  const defaultOtMultiplier = normalizeOtMultiplier(raw.defaultOtMultiplier, 1.5);

  let shiftTemplates: ShiftTemplate[] = [];
  if (Array.isArray(raw.shiftTemplates) && raw.shiftTemplates.length > 0) {
    shiftTemplates = raw.shiftTemplates
      .filter((t: any) => t && typeof t === 'object')
      .map((t: any) =>
        normalizeShiftTemplate(t, {
          checkInTime: shiftStartTime,
          checkOutTime: shiftEndTime,
          graceMinutes,
          otStepMinutes,
          otMultiplier: defaultOtMultiplier,
        })
      );
  }
  if (shiftTemplates.length === 0) {
    shiftTemplates = [
      createDefaultShiftTemplate({
        id: 'tpl_default',
        name: 'Default (ค่ามาตรฐานสาขา)',
        checkInTime: shiftStartTime,
        checkOutTime: shiftEndTime,
        breakMinutes: 60,
        graceMinutes,
        otStepMinutes,
        otMultiplier: defaultOtMultiplier,
      }),
    ];
  }

  const holidayOverrides: HolidayOtOverride[] = Array.isArray(raw.holidayOverrides)
    ? raw.holidayOverrides
        .filter((h: any) => h && typeof h.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.date))
        .map((h: any, idx: number) => ({
          id: typeof h.id === 'string' && h.id.trim() ? h.id : `hol_${idx}_${h.date}`,
          date: h.date,
          label: typeof h.label === 'string' && h.label.trim() ? h.label.trim() : 'วันหยุดพิเศษ',
          otMultiplier: normalizeOtMultiplier(h.otMultiplier, 3),
        }))
    : [];

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
    defaultOtMultiplier,
    shiftTemplates,
    holidayOverrides,
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

export interface ResolvedEmployeeShift {
  shiftStartTime: string;
  shiftEndTime: string;
  graceMinutes: number;
  otStepMinutes: number;
  otMultiplier: OtMultiplier;
  shiftName: string;
  shiftTemplateId?: string;
  scheduleType: 'standard' | 'flexible' | 'overtime';
  breakMinutes: number;
  workMinutes: number;
  earlyInRule: 'ignore' | 'count_ot';
  earlyInThresholdMinutes: number;
  earlyInMinOtMinutes: number;
  lateOutRule: 'ignore' | 'count_ot';
  lateOutThresholdMinutes: number;
  lateOutMinOtMinutes: number;
  otCalculationMode: 'step' | 'actual';
  isOvertimeSchedule: boolean;
  isDayOff: boolean;
  isHolidayOverride: boolean;
  holidayLabel?: string;
  isCustom: boolean;
  ignored: boolean;
}

/**
 * Resolves effective shift & OT settings for a specific employee on a given date,
 * supporting weekly schedules, reusable shift templates, custom per-employee overrides,
 * and holiday OT multiplier overrides while remaining 100% compatible with legacy entries.
 */
export const resolveEmployeeShift = (
  config: BranchGeofenceConfig,
  userName?: string,
  targetDate: Date = new Date()
): ResolvedEmployeeShift => {
  const defaultTemplate =
    config.shiftTemplates?.find((t) => t.id === 'tpl_default') || config.shiftTemplates?.[0];
  const baseMultiplier = normalizeOtMultiplier(
    config.defaultOtMultiplier ?? defaultTemplate?.otMultiplier,
    1.5
  );

  const dateYMD = toDateYMD(targetDate);
  const holidayOverride = config.holidayOverrides?.find((h) => h.date === dateYMD);

  const buildFromTemplate = (
    tpl: ShiftTemplate,
    opts: { isCustom: boolean; ignored: boolean; empOtMultiplier?: OtMultiplier; isDayOff?: boolean }
  ): ResolvedEmployeeShift => {
    const resolvedMultiplier = holidayOverride
      ? holidayOverride.otMultiplier
      : opts.empOtMultiplier
        ? normalizeOtMultiplier(opts.empOtMultiplier, tpl.otMultiplier)
        : normalizeOtMultiplier(tpl.otMultiplier, baseMultiplier);

    return {
      shiftStartTime: tpl.checkInTime,
      shiftEndTime: tpl.checkOutTime,
      graceMinutes: tpl.graceMinutes,
      otStepMinutes: tpl.otStepMinutes,
      otMultiplier: resolvedMultiplier,
      shiftName: holidayOverride ? `${tpl.name} (${holidayOverride.label})` : tpl.name,
      shiftTemplateId: tpl.id,
      scheduleType: tpl.scheduleType,
      breakMinutes: tpl.breakMinutes,
      workMinutes: tpl.workMinutes,
      earlyInRule: tpl.earlyInRule,
      earlyInThresholdMinutes: tpl.earlyInThresholdMinutes,
      earlyInMinOtMinutes: tpl.earlyInMinOtMinutes,
      lateOutRule: tpl.lateOutRule,
      lateOutThresholdMinutes: tpl.lateOutThresholdMinutes,
      lateOutMinOtMinutes: tpl.lateOutMinOtMinutes,
      otCalculationMode: tpl.otCalculationMode,
      isOvertimeSchedule: tpl.isOvertimeSchedule || tpl.scheduleType === 'overtime',
      isDayOff: Boolean(opts.isDayOff),
      isHolidayOverride: Boolean(holidayOverride),
      holidayLabel: holidayOverride?.label,
      isCustom: opts.isCustom,
      ignored: opts.ignored,
    };
  };

  const fallback: ResolvedEmployeeShift = {
    shiftStartTime: config.shiftStartTime || defaultTemplate?.checkInTime || '08:00',
    shiftEndTime: config.shiftEndTime || defaultTemplate?.checkOutTime || '17:00',
    graceMinutes: config.graceMinutes ?? defaultTemplate?.graceMinutes ?? 15,
    otStepMinutes: config.otStepMinutes ?? defaultTemplate?.otStepMinutes ?? 30,
    otMultiplier: holidayOverride ? holidayOverride.otMultiplier : baseMultiplier,
    shiftName: holidayOverride
      ? `${defaultTemplate?.name || 'กะมาตรฐานสาขา'} (${holidayOverride.label})`
      : defaultTemplate?.name || 'กะมาตรฐานสาขา',
    shiftTemplateId: defaultTemplate?.id,
    scheduleType: defaultTemplate?.scheduleType || 'standard',
    breakMinutes: defaultTemplate?.breakMinutes ?? 60,
    workMinutes:
      defaultTemplate?.workMinutes ??
      computeShiftWorkMinutes(config.shiftStartTime || '08:00', config.shiftEndTime || '17:00', 60),
    earlyInRule: defaultTemplate?.earlyInRule || 'ignore',
    earlyInThresholdMinutes: defaultTemplate?.earlyInThresholdMinutes ?? 0,
    earlyInMinOtMinutes: defaultTemplate?.earlyInMinOtMinutes ?? 30,
    lateOutRule: defaultTemplate?.lateOutRule || 'count_ot',
    lateOutThresholdMinutes: defaultTemplate?.lateOutThresholdMinutes ?? 0,
    lateOutMinOtMinutes: defaultTemplate?.lateOutMinOtMinutes ?? 30,
    otCalculationMode: defaultTemplate?.otCalculationMode || 'step',
    isOvertimeSchedule: Boolean(defaultTemplate?.isOvertimeSchedule),
    isDayOff: false,
    isHolidayOverride: Boolean(holidayOverride),
    holidayLabel: holidayOverride?.label,
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

  const isIgnored = Boolean(matched.ignored);
  const templates = config.shiftTemplates || [];

  // 1. Weekly schedule mode (e.g., Mon-Fri Bar shift, Sat Bar shift, Sun OFF)
  if (matched.assignmentMode === 'weekly' && matched.weeklySchedule) {
    const dayKey = getDayOfWeekKey(targetDate);
    const assigned = matched.weeklySchedule[dayKey];
    if (assigned === 'OFF') {
      const offRate = holidayOverride
        ? holidayOverride.otMultiplier
        : normalizeOtMultiplier(matched.dayOffOtMultiplier ?? matched.otMultiplier, 2);
      return {
        ...fallback,
        otMultiplier: offRate,
        shiftName: holidayOverride ? `วันหยุด (${holidayOverride.label})` : 'วันหยุดประจำสัปดาห์ (ทำงานคิด OT)',
        isOvertimeSchedule: true,
        isDayOff: true,
        isHolidayOverride: Boolean(holidayOverride),
        holidayLabel: holidayOverride?.label,
        isCustom: true,
        ignored: isIgnored,
      };
    }
    if (assigned && assigned !== 'BRANCH_DEFAULT') {
      const dayTpl = templates.find((t) => t.id === assigned);
      if (dayTpl) {
        return buildFromTemplate(dayTpl, {
          isCustom: true,
          ignored: isIgnored,
          empOtMultiplier: matched.otMultiplier,
        });
      }
    }
  }

  // 2. Single template assignment mode
  if (
    (matched.assignmentMode === 'template' || (!matched.assignmentMode && matched.shiftTemplateId)) &&
    matched.shiftTemplateId &&
    matched.shiftTemplateId !== 'BRANCH_DEFAULT'
  ) {
    const tpl = templates.find((t) => t.id === matched.shiftTemplateId);
    if (tpl) {
      return buildFromTemplate(tpl, {
        isCustom: tpl.id !== defaultTemplate?.id || Boolean(matched.otMultiplier),
        ignored: isIgnored,
        empOtMultiplier: matched.otMultiplier,
      });
    }
  }

  // 3. Branch default mode with optional OT multiplier override
  if (matched.assignmentMode === 'branch_default') {
    return {
      ...fallback,
      otMultiplier: holidayOverride
        ? holidayOverride.otMultiplier
        : matched.otMultiplier
          ? normalizeOtMultiplier(matched.otMultiplier, baseMultiplier)
          : fallback.otMultiplier,
      isCustom: Boolean(matched.otMultiplier),
      ignored: isIgnored,
    };
  }

  // 4. Custom override / legacy custom employee entry
  const resolvedStart = matched.shiftStartTime || fallback.shiftStartTime;
  const resolvedEnd = matched.shiftEndTime || fallback.shiftEndTime;
  const resolvedGrace =
    typeof matched.graceMinutes === 'number' && matched.graceMinutes >= 0
      ? matched.graceMinutes
      : fallback.graceMinutes;
  const resolvedStep =
    typeof matched.otStepMinutes === 'number' && matched.otStepMinutes >= 0
      ? matched.otStepMinutes
      : fallback.otStepMinutes;

  const isDiffFromDefault =
    resolvedStart !== fallback.shiftStartTime ||
    resolvedEnd !== fallback.shiftEndTime ||
    resolvedGrace !== fallback.graceMinutes ||
    resolvedStep !== fallback.otStepMinutes ||
    Boolean(matched.otMultiplier);

  return {
    ...fallback,
    shiftStartTime: resolvedStart,
    shiftEndTime: resolvedEnd,
    graceMinutes: resolvedGrace,
    otStepMinutes: resolvedStep,
    otMultiplier: holidayOverride
      ? holidayOverride.otMultiplier
      : matched.otMultiplier
        ? normalizeOtMultiplier(matched.otMultiplier, fallback.otMultiplier)
        : fallback.otMultiplier,
    shiftName: isDiffFromDefault ? 'กะกำหนดเอง (Custom)' : fallback.shiftName,
    workMinutes: computeShiftWorkMinutes(resolvedStart, resolvedEnd, fallback.breakMinutes),
    isCustom: isDiffFromDefault,
    ignored: isIgnored,
  };
};

/**
 * Legacy helper: Computes floored OT minutes based on otStepMinutes (e.g. every 30 mins).
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

const applyOtRoundingRule = (
  rawExtraMinutes: number,
  thresholdMinutes: number,
  minOtMinutes: number,
  mode: 'step' | 'actual',
  otStepMinutes: number
): number => {
  const afterThreshold = rawExtraMinutes - Math.max(0, thresholdMinutes || 0);
  if (afterThreshold <= 0) return 0;

  if (mode === 'actual') {
    const minReq = Math.max(0, minOtMinutes || 0);
    return afterThreshold >= minReq ? afterThreshold : 0;
  }

  // 'step' mode
  if (!otStepMinutes || otStepMinutes <= 0) return 0;
  const effectiveMin = Math.max(minOtMinutes || 0, otStepMinutes);
  if (afterThreshold < effectiveMin) return 0;
  return Math.floor(afterThreshold / otStepMinutes) * otStepMinutes;
};

/**
 * Full OT calculation supporting:
 * - Overtime-only schedule / Day-off work
 * - Early check-in OT (with threshold & min duration)
 * - Late check-out OT (with threshold & min duration)
 * - Both 'actual' (like screenshot 2) and 'step' rounding modes
 * - Flexible / overnight shift support
 */
export const calculateShiftOtMinutes = (params: {
  checkOutDate: Date;
  checkInDate?: Date | null;
  shift: ResolvedEmployeeShift;
}): number => {
  const { checkOutDate, checkInDate, shift } = params;

  if (shift.otCalculationMode === 'step' && (!shift.otStepMinutes || shift.otStepMinutes <= 0)) {
    return 0;
  }

  // Overtime-only schedule or working on scheduled Day Off: count total worked minutes as OT
  if (shift.isOvertimeSchedule || shift.isDayOff) {
    if (!checkInDate || Number.isNaN(checkInDate.getTime())) return 0;
    const grossWorked = Math.max(
      0,
      Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 60000)
    );
    const deductibleBreak =
      grossWorked > 300 && shift.breakMinutes > 0 ? Math.min(shift.breakMinutes, grossWorked) : 0;
    const netWorked = Math.max(0, grossWorked - deductibleBreak);
    return applyOtRoundingRule(
      netWorked,
      shift.lateOutThresholdMinutes,
      shift.lateOutMinOtMinutes,
      shift.otCalculationMode,
      shift.otStepMinutes
    );
  }

  // Flexible schedule: OT is extra minutes beyond target workMinutes
  if (shift.scheduleType === 'flexible' && checkInDate && !Number.isNaN(checkInDate.getTime())) {
    const grossWorked = Math.max(
      0,
      Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 60000)
    );
    const deductibleBreak =
      grossWorked > shift.workMinutes + shift.breakMinutes ? shift.breakMinutes : 0;
    const netWorked = Math.max(0, grossWorked - deductibleBreak);
    const extraMinutes = netWorked - shift.workMinutes;
    if (shift.lateOutRule === 'ignore') return 0;
    return applyOtRoundingRule(
      extraMinutes,
      shift.lateOutThresholdMinutes,
      shift.lateOutMinOtMinutes,
      shift.otCalculationMode,
      shift.otStepMinutes
    );
  }

  let totalOt = 0;

  // 1. Early check-in OT (if configured)
  if (shift.earlyInRule === 'count_ot' && checkInDate && !Number.isNaN(checkInDate.getTime())) {
    const checkInMins = checkInDate.getHours() * 60 + checkInDate.getMinutes();
    const startMins = parseHHMMToMinutes(shift.shiftStartTime);
    const earlyMins = startMins - checkInMins;
    totalOt += applyOtRoundingRule(
      earlyMins,
      shift.earlyInThresholdMinutes,
      shift.earlyInMinOtMinutes,
      shift.otCalculationMode,
      shift.otStepMinutes
    );
  }

  // 2. Late check-out OT (if configured)
  if (shift.lateOutRule === 'count_ot') {
    const startMins = parseHHMMToMinutes(shift.shiftStartTime);
    let endMins = parseHHMMToMinutes(shift.shiftEndTime);
    let currentMins = checkOutDate.getHours() * 60 + checkOutDate.getMinutes();
    if (endMins <= startMins) {
      // overnight shift
      endMins += 24 * 60;
      if (currentMins < startMins) currentMins += 24 * 60;
    }
    const extraMins = currentMins - endMins;
    totalOt += applyOtRoundingRule(
      extraMins,
      shift.lateOutThresholdMinutes,
      shift.lateOutMinOtMinutes,
      shift.otCalculationMode,
      shift.otStepMinutes
    );
  }

  return totalOt;
};

export const formatOtDuration = (otMinutes?: number): string => {
  if (!otMinutes || otMinutes <= 0) return '—';
  if (otMinutes < 60) return `${otMinutes} นาที`;
  const hrs = Math.floor(otMinutes / 60);
  const mins = otMinutes % 60;
  return mins > 0 ? `${hrs} ชม. ${mins} นาที (${otMinutes} น.)` : `${hrs} ชม. (${otMinutes} น.)`;
};

export const formatOtHours = (otMinutes?: number): string => {
  if (!otMinutes || otMinutes <= 0) return '0.00 ชม.';
  return `${(otMinutes / 60).toFixed(2)} ชม.`;
};

export interface OtTypeBucket {
  multiplier: OtMultiplier;
  label: string;
  minutes: number;
  hours: number;
  count: number;
}

export const summarizeOtByMultiplier = (
  items: Array<{ otMinutes: number; otMultiplier?: OtMultiplier }>
): {
  byType: Record<OtMultiplier, OtTypeBucket>;
  orderedTypes: OtTypeBucket[];
  totalMinutes: number;
  totalHours: number;
} => {
  const byType: Record<OtMultiplier, OtTypeBucket> = {
    1.5: { multiplier: 1.5, label: 'OT 1.5 เท่า', minutes: 0, hours: 0, count: 0 },
    2: { multiplier: 2, label: 'OT 2 เท่า', minutes: 0, hours: 0, count: 0 },
    3: { multiplier: 3, label: 'OT 3 เท่า', minutes: 0, hours: 0, count: 0 },
  };

  let totalMinutes = 0;

  items.forEach((item) => {
    const mins = Number(item.otMinutes) || 0;
    if (mins <= 0) return;
    const mult = normalizeOtMultiplier(item.otMultiplier, 1.5);
    byType[mult].minutes += mins;
    byType[mult].count += 1;
    totalMinutes += mins;
  });

  ([1.5, 2, 3] as OtMultiplier[]).forEach((m) => {
    byType[m].hours = Number((byType[m].minutes / 60).toFixed(2));
  });

  return {
    byType,
    orderedTypes: [byType[1.5], byType[2], byType[3]],
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
  };
};

export const evaluateAttendanceStatus = (
  type: AttendanceType,
  now: Date,
  config: BranchGeofenceConfig,
  userName?: string,
  checkInDate?: Date | null
): {
  status: AttendanceStatus;
  diffMinutes: number;
  otMinutes: number;
  otMultiplier: OtMultiplier;
  shiftName: string;
} => {
  const shift = resolveEmployeeShift(config, userName, now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (type === 'check_in') {
    if (shift.isOvertimeSchedule || shift.isDayOff || shift.scheduleType === 'flexible') {
      return {
        status: 'on_time',
        diffMinutes: 0,
        otMinutes: 0,
        otMultiplier: shift.otMultiplier,
        shiftName: shift.shiftName,
      };
    }
    const startMinutes = parseHHMMToMinutes(shift.shiftStartTime) + (shift.graceMinutes || 0);
    if (currentMinutes > startMinutes) {
      return {
        status: 'late',
        diffMinutes: currentMinutes - parseHHMMToMinutes(shift.shiftStartTime),
        otMinutes: 0,
        otMultiplier: shift.otMultiplier,
        shiftName: shift.shiftName,
      };
    }
    return {
      status: 'on_time',
      diffMinutes: 0,
      otMinutes: 0,
      otMultiplier: shift.otMultiplier,
      shiftName: shift.shiftName,
    };
  }

  // Check-out
  if (!shift.isOvertimeSchedule && !shift.isDayOff && shift.scheduleType === 'standard') {
    const startMins = parseHHMMToMinutes(shift.shiftStartTime);
    let endMins = parseHHMMToMinutes(shift.shiftEndTime);
    let adjCurrent = currentMinutes;
    if (endMins <= startMins) {
      endMins += 24 * 60;
      if (adjCurrent < startMins) adjCurrent += 24 * 60;
    }
    if (adjCurrent < endMins) {
      // Early out, though early-in OT might still exist if configured
      const otMinutes = calculateShiftOtMinutes({ checkOutDate: now, checkInDate, shift });
      return {
        status: 'early_out',
        diffMinutes: endMins - adjCurrent,
        otMinutes,
        otMultiplier: shift.otMultiplier,
        shiftName: shift.shiftName,
      };
    }
  }

  const otMinutes = calculateShiftOtMinutes({ checkOutDate: now, checkInDate, shift });
  return {
    status: 'completed',
    diffMinutes: 0,
    otMinutes,
    otMultiplier: shift.otMultiplier,
    shiftName: shift.shiftName,
  };
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
