export type AttendanceType = 'check_in' | 'check_out';

export type AttendanceStatus = 'on_time' | 'late' | 'early_out' | 'completed';

export type AttendanceMode = 'auto' | 'manual';

export type OtMultiplier = 1.5 | 2 | 3;

export type DayOfWeekKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type ShiftScheduleType = 'standard' | 'flexible' | 'overtime';

export type OvertimeEdgeRule = 'ignore' | 'count_ot';

export type OvertimeCalculationMode = 'step' | 'actual';

export type EmployeeShiftAssignmentMode = 'branch_default' | 'template' | 'weekly' | 'custom';

export interface ShiftTemplate {
  id: string;
  name: string;
  scheduleType: ShiftScheduleType;
  checkInTime: string;             // HH:mm
  checkOutTime: string;            // HH:mm
  breakMinutes: number;            // ช่วงเวลาพัก (นาที)
  workMinutes: number;             // เวลาทำงานสุทธิ (นาที)
  graceMinutes: number;            // อนุโลมสายได้ (นาที)
  // Check-in / Check-out scan windows (อ้างอิงจากตารางเวลา)
  checkInBeforeMinutes: number;    // ช่วงเวลาเช็คอินก่อนเริ่มงาน (นาที)
  checkInAfterMinutes: number;     // ช่วงเวลาเช็คอินหลังเริ่มงาน (นาที)
  checkOutBeforeMinutes: number;   // ช่วงเวลาเช็คเอาท์ก่อนเลิกงาน (นาที)
  checkOutAfterMinutes: number;    // ช่วงเวลาเช็คเอาท์หลังเลิกงาน (นาที)
  isOvertimeSchedule: boolean;     // ตั้งเป็นตารางเวลาล่วงเวลา (คิดเวลาทำงานเป็น OT)
  // Overtime calculation rules (การตั้งค่าล่วงเวลา)
  earlyInRule: OvertimeEdgeRule;         // เข้าเร็วกว่ากำหนด: 'ignore' | 'count_ot'
  earlyInThresholdMinutes: number;       // เกณฑ์เข้าเร็วกว่ากำหนด (นาที)
  earlyInMinOtMinutes: number;           // ระยะเวลาล่วงเวลาขั้นต่ำเมื่อเข้าเร็ว (นาที)
  lateOutRule: OvertimeEdgeRule;         // ออกช้ากว่ากำหนด: 'ignore' | 'count_ot'
  lateOutThresholdMinutes: number;       // เกณฑ์ออกช้ากว่ากำหนด (นาที)
  lateOutMinOtMinutes: number;           // ระยะเวลาล่วงเวลาขั้นต่ำเมื่อออกช้า (นาที)
  otCalculationMode: OvertimeCalculationMode; // 'actual' | 'step'
  otStepMinutes: number;                 // คิดโอทีทุกๆ กี่นาที (0 = ไม่คิดโอที, ใช้เมื่อ mode = 'step')
  otMultiplier: OtMultiplier;            // ชนิด OT: 1.5 | 2 | 3 เท่า
  color?: string;
}

export interface HolidayOtOverride {
  id: string;
  date: string;       // YYYY-MM-DD
  label: string;
  otMultiplier: OtMultiplier;
}

export interface EmployeeShiftConfig {
  userId?: string;
  userName: string;
  userRole?: string;
  shiftStartTime: string; // HH:mm
  shiftEndTime: string;   // HH:mm
  graceMinutes: number;
  otStepMinutes: number;  // คิดโอที ทุกๆ กี่นาที (0 = ไม่คิดโอที)
  ignored?: boolean;      // ไม่ต้อง monitor เวลาเข้า-ออกงาน
  // Flexible assignment & OT multiplier extensions (backward-compatible)
  assignmentMode?: EmployeeShiftAssignmentMode;
  shiftTemplateId?: string;
  weeklySchedule?: Partial<Record<DayOfWeekKey, string>>; // DayOfWeekKey -> templateId | 'OFF'
  otMultiplier?: OtMultiplier;       // Override OT type: 1.5 | 2 | 3 (optional)
  dayOffOtMultiplier?: OtMultiplier; // OT type when working on a weekly 'OFF' day
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
  defaultOtMultiplier?: OtMultiplier; // branch default OT rate (1.5 | 2 | 3)
  shiftTemplates?: ShiftTemplate[];
  holidayOverrides?: HolidayOtOverride[];
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
  otMultiplier?: OtMultiplier; // ชนิด OT (1.5 | 2 | 3 เท่า)
  shiftName?: string;   // ชื่อกะงานที่ใช้ประเมินในวันนั้น
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
