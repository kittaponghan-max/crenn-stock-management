import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin,
  Clock,
  LogIn,
  LogOut,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceType,
  BranchGeofenceConfig,
} from '../../types/hellocrenn';
import {
  calculateHaversineDistanceMeters,
  formatDistanceMeters,
  getDefaultGeofenceConfig,
  getStatusLabelTH,
  resolveEmployeeShift,
} from '../../utils/gpsUtils';
import {
  fetchApprovedLeaveUsersOnDate,
  fetchBranchAttendanceState,
  getOrCreateDeviceIdentity,
  getSyncedNow,
  loadLocalAttendanceRecords,
  loadLocalGeofenceConfig,
  recordBranchAttendance,
  runMissingAttendanceAlertCheck,
  syncServerTime,
} from '../../utils/attendanceSecurity';
import { toLocalDateStr } from '../ui';

interface GlobalAttendanceReminderProps {
  currentUser: {
    name: string;
    role: string;
    branch: string;
  };
  canScanSelf: boolean;
  onOpenHelloCrenn?: () => void;
}

const parseHHMM = (hhmm: string): number => {
  const [h, m] = (hhmm || '08:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const GlobalAttendanceReminder: React.FC<GlobalAttendanceReminderProps> = ({
  currentUser,
  canScanSelf,
  onOpenHelloCrenn,
}) => {
  const [geofenceConfig, setGeofenceConfig] = useState<BranchGeofenceConfig>(() =>
    loadLocalGeofenceConfig(currentUser.branch || 'Rayong')
  );
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() =>
    loadLocalAttendanceRecords(currentUser.branch || 'Rayong')
  );
  const [isOnApprovedLeave, setIsOnApprovedLeave] = useState<boolean>(false);
  const [now, setNow] = useState<Date>(() => getSyncedNow().date);
  const [dismissedUntilMs, setDismissedUntilMs] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [noteInput, setNoteInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [gpsState, setGpsState] = useState<{
    status: 'idle' | 'locating' | 'ready' | 'error';
    latitude: number | null;
    longitude: number | null;
    distanceMeters: number | null;
    accuracyMeters: number | null;
    withinGeofence: boolean;
    accuracyAcceptable: boolean;
    errorMessage?: string;
  }>({
    status: 'idle',
    latitude: null,
    longitude: null,
    distanceMeters: null,
    accuracyMeters: null,
    withinGeofence: false,
    accuracyAcceptable: false,
  });

  const lastLoadedRef = useRef<string>('');
  const branch = currentUser.branch || 'Rayong';

  const refreshState = useCallback(async () => {
    await syncServerTime(false);
    const { date: syncedDate } = getSyncedNow();
    setNow(syncedDate);

    const state = await fetchBranchAttendanceState(branch);
    setGeofenceConfig(state.geofenceConfig);
    setAttendanceRecords(state.attendanceRecords);

    const todayStr = toLocalDateStr(syncedDate);
    const leaveUsers = await fetchApprovedLeaveUsersOnDate(branch, todayStr);
    setIsOnApprovedLeave(leaveUsers.has((currentUser.name || '').trim().toLowerCase()));

    // Automated missing check-in / check-out Discord alert engine (deduplicated)
    await runMissingAttendanceAlertCheck({
      branch,
      geofenceConfig: state.geofenceConfig,
      attendanceRecords: state.attendanceRecords,
    });
  }, [branch, currentUser.name]);

  // Initial load + 5-minute background refresh & missing-alert check
  useEffect(() => {
    const key = `${branch}:${currentUser.name}`;
    if (lastLoadedRef.current !== key) {
      lastLoadedRef.current = key;
      setGeofenceConfig(getDefaultGeofenceConfig(branch));
      refreshState();
    }

    const syncInterval = setInterval(() => {
      refreshState();
    }, 5 * 60 * 1000);

    const clockInterval = setInterval(() => {
      setNow(getSyncedNow().date);
    }, 30 * 1000);

    return () => {
      clearInterval(syncInterval);
      clearInterval(clockInterval);
    };
  }, [branch, currentUser.name, refreshState]);

  const todayStr = toLocalDateStr(now);
  const myTodayRecords = attendanceRecords.filter(
    (r) =>
      r.date === todayStr &&
      r.branch === branch &&
      r.userName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
  );
  const todayCheckIn = myTodayRecords.find((r) => r.type === 'check_in') || null;
  const todayCheckOut = myTodayRecords.find((r) => r.type === 'check_out') || null;
  const employeeShift = resolveEmployeeShift(geofenceConfig, currentUser.name, now);

  const currentMins = now.getHours() * 60 + now.getMinutes();
  const startMins = parseHHMM(employeeShift.shiftStartTime);
  let endMins = parseHHMM(employeeShift.shiftEndTime);
  let adjCurrentMins = currentMins;
  if (endMins <= startMins) {
    endMins += 24 * 60;
    if (adjCurrentMins < startMins) adjCurrentMins += 24 * 60;
  }

  let pendingType: AttendanceType | null = null;
  let isOverdue = false;
  let reminderTitle = '';
  let reminderSubtitle = '';

  if (
    canScanSelf &&
    !employeeShift.ignored &&
    !employeeShift.isDayOff &&
    !isOnApprovedLeave
  ) {
    if (!todayCheckIn && currentMins >= startMins - 60) {
      pendingType = 'check_in';
      const lateThreshold = startMins + (employeeShift.graceMinutes || 0);
      isOverdue = currentMins > lateThreshold;
      reminderTitle = isOverdue
        ? `เลยเวลาเข้างานแล้ว (${employeeShift.shiftStartTime} น.) — คุณยังไม่ได้สแกน Check-in`
        : `ใกล้ถึงเวลาเข้างาน (${employeeShift.shiftStartTime} น.) — อย่าลืมสแกน Check-in`;
      reminderSubtitle = `กะ: ${employeeShift.shiftName} · อนุโลมสาย ${employeeShift.graceMinutes} นาที`;
    } else if (todayCheckIn && !todayCheckOut && adjCurrentMins >= endMins) {
      pendingType = 'check_out';
      isOverdue = adjCurrentMins >= endMins + 15;
      reminderTitle = `ถึงเวลาเลิกงานแล้ว (${employeeShift.shiftEndTime} น.) — คุณยังไม่ได้สแกน Check-out`;
      reminderSubtitle = `เข้างานเมื่อ ${todayCheckIn.timeDisplay} น. · กดสแกนออกงานได้ทันทีจากหน้านี้`;
    }
  }

  const fetchCurrentGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsState({
        status: 'error',
        latitude: null,
        longitude: null,
        distanceMeters: null,
        accuracyMeters: null,
        withinGeofence: false,
        accuracyAcceptable: false,
        errorMessage: 'อุปกรณ์นี้ไม่รองรับ GPS Location',
      });
      return;
    }

    setGpsState((prev) => ({ ...prev, status: 'locating', errorMessage: undefined }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = calculateHaversineDistanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          geofenceConfig.latitude,
          geofenceConfig.longitude
        );
        const acc = Math.round(pos.coords.accuracy || 0);
        setGpsState({
          status: 'ready',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          distanceMeters: dist,
          accuracyMeters: acc,
          withinGeofence: dist <= geofenceConfig.radiusMeters,
          accuracyAcceptable: acc <= geofenceConfig.maxAccuracyMeters,
        });
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'กรุณาอนุญาตสิทธิ์การเข้าถึงตำแหน่ง (Location) ในเบราว์เซอร์'
            : 'ไม่สามารถดึงพิกัด GPS ได้ กรุณากดลองใหม่อีกครั้ง';
        setGpsState({
          status: 'error',
          latitude: null,
          longitude: null,
          distanceMeters: null,
          accuracyMeters: null,
          withinGeofence: false,
          accuracyAcceptable: false,
          errorMessage: msg,
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [geofenceConfig.latitude, geofenceConfig.longitude, geofenceConfig.radiusMeters, geofenceConfig.maxAccuracyMeters]);

  const handleOpenQuickScan = () => {
    setScanResult(null);
    setNoteInput('');
    setModalOpen(true);
    fetchCurrentGps();
  };

  const handleConfirmQuickScan = async () => {
    if (!pendingType || isSubmitting) return;
    if (
      gpsState.status !== 'ready' ||
      gpsState.latitude === null ||
      gpsState.longitude === null
    ) {
      setScanResult({ type: 'error', message: 'กำลังรอพิกัด GPS หรือไม่พบตำแหน่งปัจจุบัน' });
      return;
    }
    if (!gpsState.withinGeofence) {
      setScanResult({
        type: 'error',
        message: `อยู่นอกรัศมีสาขา (${formatDistanceMeters(gpsState.distanceMeters)} จากกำหนด ${geofenceConfig.radiusMeters} ม.)`,
      });
      return;
    }
    if (!gpsState.accuracyAcceptable) {
      setScanResult({
        type: 'error',
        message: `สัญญาณ GPS คลาดเคลื่อนสูง (±${gpsState.accuracyMeters} ม.) กรุณารีเฟรชพิกัด`,
      });
      return;
    }

    setIsSubmitting(true);
    setScanResult(null);
    try {
      const res = await recordBranchAttendance({
        currentUser: {
          name: currentUser.name,
          role: currentUser.role,
          branch,
        },
        geofenceConfig,
        existingRecords: attendanceRecords,
        type: pendingType,
        mode: 'manual',
        latitude: gpsState.latitude,
        longitude: gpsState.longitude,
        distanceMeters: gpsState.distanceMeters ?? 0,
        accuracyMeters: gpsState.accuracyMeters ?? 0,
        note: noteInput.trim() || undefined,
      });

      setAttendanceRecords(res.nextRecords);

      if (res.record) {
        const actionLabel = pendingType === 'check_in' ? 'เข้างาน' : 'ออกงาน';
        setScanResult({
          type: 'success',
          message: `บันทึก${actionLabel}สำเร็จ เวลา ${res.record.timeDisplay} (${getStatusLabelTH(res.record.status)})`,
        });
        setTimeout(() => {
          setModalOpen(false);
        }, 1600);
      } else {
        setScanResult({
          type: 'error',
          message: 'วันนี้มีการบันทึกเวลารายการนี้ไว้เรียบร้อยแล้ว',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBannerHidden = Date.now() < dismissedUntilMs;

  if (!pendingType || (isBannerHidden && !modalOpen)) {
    return null;
  }

  const deviceInfo = getOrCreateDeviceIdentity();
  const timeDisplayNow = now.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      {!isBannerHidden && (
        <div
          className={`w-full border-b px-4 md:px-6 py-2.5 transition-colors ${
            isOverdue
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-[#E8F3F2] border-[#D4E4E3] text-[#2D4A49]'
          }`}
        >
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isOverdue
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-white text-[#5A8A88] border border-[#D4E4E3]'
                }`}
              >
                {pendingType === 'check_in' ? <LogIn size={14} /> : <LogOut size={14} />}
              </div>
              <div className="min-w-0">
                <p className="text-[11.5px] sm:text-xs font-bold leading-snug tabular-nums">
                  {reminderTitle}
                </p>
                <p
                  className={`text-[10.5px] leading-tight mt-0.5 tabular-nums ${
                    isOverdue ? 'text-amber-800/80' : 'text-[#6B8F8E]'
                  }`}
                >
                  {reminderSubtitle} · เวลาเซิร์ฟเวอร์ {timeDisplayNow} น.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={handleOpenQuickScan}
                className="h-[30px] px-3 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <MapPin size={12} />
                <span>
                  {pendingType === 'check_in' ? 'สแกนเข้างานทันที' : 'สแกนออกงานทันที'}
                </span>
              </button>
              {onOpenHelloCrenn && (
                <button
                  type="button"
                  onClick={onOpenHelloCrenn}
                  className="h-[30px] px-2.5 rounded-[8px] bg-white hover:bg-[#F0F5F4] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  title="เปิด Sub-app Hello, Crenn"
                >
                  <ExternalLink size={11} className="text-[#5A8A88]" />
                  <span className="hidden md:inline">เปิด Hello, Crenn</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setDismissedUntilMs(Date.now() + 30 * 60 * 1000)}
                className="w-[28px] h-[28px] rounded-[7px] hover:bg-black/5 flex items-center justify-center text-[#6B8F8E] transition-colors cursor-pointer"
                title="ซ่อนแจ้งเตือนนี้ 30 นาที"
                aria-label="ซ่อนแจ้งเตือนชั่วคราว"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick 1-Click GPS Check-in / Check-out Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[120] bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ลงเวลาด่วน Hello, Crenn"
        >
          <div className="bg-white rounded-2xl border border-[#D4E4E3] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-[#2D4A49] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={17} className="text-[#E8F3F2]" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold leading-tight">
                    {pendingType === 'check_in'
                      ? 'สแกนเข้างานด่วน (Quick Check-in)'
                      : 'สแกนออกงานด่วน (Quick Check-out)'}
                  </h3>
                  <p className="text-[10px] text-[#D4E4E3] mt-0.5 tabular-nums">
                    {geofenceConfig.branchLabel} · {currentUser.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Server Clock + Device Info */}
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#F8FCFC] border border-[#D4E4E3] text-[11px]">
                <div className="flex items-center gap-1.5 text-[#2D4A49] font-bold tabular-nums">
                  <Clock size={13} className="text-[#5A8A88]" />
                  <span>
                    {now.toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[#6B8F8E] tabular-nums">
                  <ShieldCheck size={13} className="text-[#5A8A88]" />
                  <span>
                    {deviceInfo.deviceShortId} ({deviceInfo.deviceLabel})
                  </span>
                </div>
              </div>

              {/* GPS Status Box */}
              <div className="rounded-xl border border-[#D4E4E3] p-3.5 space-y-2.5 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#6B8F8E]">
                    พิกัด GPS ปัจจุบัน
                  </span>
                  <button
                    type="button"
                    onClick={fetchCurrentGps}
                    className="text-[11px] font-semibold text-[#5A8A88] hover:text-[#2D4A49] flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw
                      size={12}
                      className={gpsState.status === 'locating' ? 'animate-spin' : ''}
                    />
                    <span>อัปเดตพิกัด</span>
                  </button>
                </div>

                {gpsState.status === 'locating' && (
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                    <RefreshCw size={14} className="animate-spin" />
                    กำลังตรวจสอบตำแหน่ง GPS ของคุณ...
                  </p>
                )}

                {gpsState.status === 'ready' && (
                  <div className="space-y-1.5">
                    <p
                      className={`text-xs font-bold flex items-center gap-1.5 ${
                        gpsState.withinGeofence && gpsState.accuracyAcceptable
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {gpsState.withinGeofence && gpsState.accuracyAcceptable ? (
                        <>
                          <CheckCircle2 size={15} />
                          อยู่ในพื้นที่ร้าน พร้อมลงเวลา
                        </>
                      ) : !gpsState.withinGeofence ? (
                        <>
                          <AlertTriangle size={15} />
                          อยู่นอกรัศมีร้าน ({formatDistanceMeters(gpsState.distanceMeters)})
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={15} />
                          สัญญาณ GPS ไม่นิ่ง (±{gpsState.accuracyMeters} ม.)
                        </>
                      )}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[#6B8F8E] tabular-nums pt-1 border-t border-[#F0F5F4]">
                      <span>
                        ระยะห่าง: <strong className="text-[#2D4A49]">{formatDistanceMeters(gpsState.distanceMeters)}</strong> / {geofenceConfig.radiusMeters} ม.
                      </span>
                      <span>แม่นยำ: ±{gpsState.accuracyMeters} ม.</span>
                    </div>
                  </div>
                )}

                {gpsState.status === 'error' && (
                  <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    {gpsState.errorMessage}
                  </p>
                )}
              </div>

              {/* Optional Note */}
              <div>
                <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                  หมายเหตุเพิ่มเติม (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="เช่น เข้ากะเช้า / ปิดร้านเรียบร้อย..."
                  className="w-full h-[34px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs outline-none focus:border-[#5A8A88]"
                />
              </div>

              {scanResult && (
                <div
                  className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    scanResult.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {scanResult.type === 'success' ? (
                    <CheckCircle2 size={15} className="shrink-0" />
                  ) : (
                    <AlertTriangle size={15} className="shrink-0" />
                  )}
                  <span>{scanResult.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-[36px] px-3.5 rounded-[9px] border border-[#D4E4E3] bg-white hover:bg-[#F0F5F4] text-[#2D4A49] text-xs font-semibold cursor-pointer"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  disabled={
                    isSubmitting ||
                    gpsState.status !== 'ready' ||
                    !gpsState.withinGeofence ||
                    !gpsState.accuracyAcceptable
                  }
                  onClick={handleConfirmQuickScan}
                  className="h-[36px] px-4 rounded-[9px] bg-[#2D4A49] hover:bg-[#203635] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {pendingType === 'check_in' ? <LogIn size={14} /> : <LogOut size={14} />}
                  <span>
                    {isSubmitting
                      ? 'กำลังบันทึก...'
                      : pendingType === 'check_in'
                        ? 'ยืนยันสแกนเข้างาน'
                        : 'ยืนยันสแกนออกงาน'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalAttendanceReminder;
