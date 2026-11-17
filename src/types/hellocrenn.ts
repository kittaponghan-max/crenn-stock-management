export type AttendanceType = 'check_in' | 'check_out';

export type AttendanceStatus = 'on_time' | 'late' | 'early_out' | 'completed';

export type AttendanceMode = 'auto' | 'manual';

export interface BranchGeofenceConfig {
  branch: string;
  branchLabel: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  shiftStartTime: string; // HH:mm
  shiftEndTime: string;   // HH:mm
  graceMinutes: number;
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
