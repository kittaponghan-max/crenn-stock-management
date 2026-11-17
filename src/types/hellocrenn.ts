export type AttendanceType = 'check_in' | 'check_out';

export type AttendanceStatus = 'on_time' | 'late' | 'early_out' | 'completed';

export type AttendanceMode = 'auto' | 'manual';

export interface EmployeeShiftConfig {
  userId?: string;
  userName: string;
  userRole?: string;
  shiftStartTime: string; // HH:mm
  shiftEndTime: string;   // HH:mm
  graceMinutes: number;
  otStepMinutes: number;  // คิดโอที ทุกๆ กี่นาที (0 = ไม่คิดโอที)
}

export interface BranchGeofenceConfig {
  branch: string;
  branchLabel: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  shiftStartTime: string; // HH:mm (branch default)
  shiftEndTime: string;   // HH:mm (branch default)
  graceMinutes: number;   // branch default
  otStepMinutes: number;  // branch default (คิดโอที ทุกๆ กี่นาที)
  employeeShifts?: Record<string, EmployeeShiftConfig>;
  autoCheckinEnabled: boolean;
  autoCheckoutEnabled: boolean;
  isConfigured: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  branch: string;
  date: string;         // YYYY-MM-DD (local date)
  userName: string;
  userRole: string;
  type: AttendanceType;
  recordedAt: string;   // ISO timestamp
  timeDisplay: string;  // HH:mm:ss
  latitude: number;
  longitude: number;
  distanceMeters: number;
  accuracyMeters: number;
  status: AttendanceStatus;
  mode: AttendanceMode;
  otMinutes?: number;   // จำนวนนาที OT ที่คำนวณได้ตอนออกงาน
  note?: string;
}

export interface GpsPositionState {
  status: 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable' | 'error';
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  distanceMeters: number | null;
  withinGeofence: boolean;
  accuracyAcceptable: boolean;
  lastUpdatedAt: string | null;
  errorMessage?: string;
}
