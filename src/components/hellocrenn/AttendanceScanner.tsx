import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  RefreshCw,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import {
  AttendanceMode,
  AttendanceRecord,
  AttendanceType,
  BranchGeofenceConfig,
  GpsPositionState,
  OtMultiplier,
} from '../../types/hellocrenn';
import {
  calculateHaversineDistanceMeters,
  calculateShiftOtMinutes,
  formatDistanceMeters,
  formatMinutesDuration,
  formatOtDuration,
  formatOtHours,
  getOtTypeLabel,
  getStatusLabelTH,
  resolveEmployeeShift,
} from '../../utils/gpsUtils';
import {
  PageHeaderBanner,
  StandardTableCard,
  StandardTable,
  StandardThead,
  StandardHeaderRow,
  StandardTh,
  StandardTbody,
  StandardTr,
  StandardTd,
  StandardTableEmpty,
  toLocalDateStr,
  formatThaiNumericDate,
} from '../ui';

interface AttendanceScannerProps {
  currentUser: {
    name: string;
    role: string;
    branch: string;
  };
  geofenceConfig: BranchGeofenceConfig;
  attendanceRecords: AttendanceRecord[];
  onRecordAttendance: (payload: {
    type: AttendanceType;
    mode: AttendanceMode;
    latitude: number;
    longitude: number;
    distanceMeters: number;
    accuracyMeters: number;
    note?: string;
  }) => Promise<AttendanceRecord | null>;
  onOpenGeofenceSettings?: () => void;
  canEditGeofence?: boolean;
  isReadOnly?: boolean;
}

export const AttendanceScanner: React.FC<AttendanceScannerProps> = ({
  currentUser,
  geofenceConfig,
  attendanceRecords,
  onRecordAttendance,
  onOpenGeofenceSettings,
  canEditGeofence = false,
  isReadOnly = false,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [autoModeActive, setAutoModeActive] = useState<boolean>(geofenceConfig.autoCheckinEnabled);
  const [noteInput, setNoteInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  const [gps, setGps] = useState<GpsPositionState>({
    status: 'idle',
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    distanceMeters: null,
    withinGeofence: false,
    accuracyAcceptable: false,
    lastUpdatedAt: null,
  });

  const autoTriggeredKeyRef = useRef<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    setAutoModeActive(geofenceConfig.autoCheckinEnabled);
  }, [geofenceConfig.autoCheckinEnabled]);

  // Live clock (1s)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = toLocalDateStr(now);

  const myTodayRecords = attendanceRecords
    .filter(
      (r) =>
        r.date === todayStr &&
        r.branch === currentUser.branch &&
        r.userName.toLowerCase() === currentUser.name.toLowerCase()
    )
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

  const todayCheckIn = myTodayRecords.find((r) => r.type === 'check_in') || null;
  const todayCheckOut = myTodayRecords.find((r) => r.type === 'check_out') || null;

  const employeeShift = resolveEmployeeShift(geofenceConfig, currentUser.name, now);

  // Dynamically calculate OT aligned with this employee's configured shift, OT rules & multiplier
  const isOtEnabled =
    employeeShift.otCalculationMode === 'actual' ||
    employeeShift.otStepMinutes > 0 ||
    employeeShift.isOvertimeSchedule ||
    employeeShift.isDayOff;
  const otReferenceDate = todayCheckOut
    ? new Date(todayCheckOut.recordedAt)
    : todayCheckIn
      ? now
      : null;
  const checkInDateObj = todayCheckIn ? new Date(todayCheckIn.recordedAt) : null;
  const validCheckInDate =
    checkInDateObj && !Number.isNaN(checkInDateObj.getTime()) ? checkInDateObj : null;

  const computedOtMinutes =
    todayCheckIn &&
    isOtEnabled &&
    otReferenceDate &&
    !Number.isNaN(otReferenceDate.getTime())
      ? calculateShiftOtMinutes({
          checkOutDate: otReferenceDate,
          checkInDate: validCheckInDate,
          shift: employeeShift,
        })
      : 0;
  const activeOtMultiplier: OtMultiplier =
    todayCheckOut?.otMultiplier ?? employeeShift.otMultiplier;
  const isLiveOtAccruing = Boolean(todayCheckIn && !todayCheckOut && isOtEnabled);
  const workDurationText = todayCheckIn
    ? formatMinutesDuration(
        todayCheckIn.recordedAt,
        todayCheckOut?.recordedAt ?? now.toISOString()
      )
    : '—';

  const updateGpsFromCoords = (coords: GeolocationCoordinates) => {
    const distanceMeters = calculateHaversineDistanceMeters(
      coords.latitude,
      coords.longitude,
      geofenceConfig.latitude,
      geofenceConfig.longitude
    );
    const accuracyMeters = Math.round(coords.accuracy || 0);
    const withinGeofence = distanceMeters <= geofenceConfig.radiusMeters;
    const accuracyAcceptable = accuracyMeters <= geofenceConfig.maxAccuracyMeters;

    setGps({
      status: 'ready',
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyMeters,
      distanceMeters,
      withinGeofence,
      accuracyAcceptable,
      lastUpdatedAt: new Date().toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    });
  };

  const handleGpsError = (err: GeolocationPositionError) => {
    let status: GpsPositionState['status'] = 'error';
    let message = 'ไม่สามารถระบุตำแหน่ง GPS ได้';
    if (err.code === err.PERMISSION_DENIED) {
      status = 'denied';
      message = 'เบราว์เซอร์ยังไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง GPS กรุณาเปิดสิทธิ์ Location';
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      status = 'unavailable';
      message = 'ไม่พบสัญญาณ GPS ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
    } else if (err.code === err.TIMEOUT) {
      status = 'error';
      message = 'การดึงพิกัด GPS ใช้เวลานานเกินกำหนด กรุณากดรีเฟรชพิกัด';
    }
    setGps((prev) => ({
      ...prev,
      status,
      errorMessage: message,
    }));
  };

  const requestManualRefresh = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGps((prev) => ({
        ...prev,
        status: 'unavailable',
        errorMessage: 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ Geolocation API',
      }));
      return;
    }
    setGps((prev) => ({ ...prev, status: 'locating', errorMessage: undefined }));
    navigator.geolocation.getCurrentPosition(
      (pos) => updateGpsFromCoords(pos.coords),
      (err) => handleGpsError(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Continuous GPS watch for Auto Check-in / real-time geofence distance
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGps((prev) => ({
        ...prev,
        status: 'unavailable',
        errorMessage: 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ Geolocation API',
      }));
      return;
    }

    setGps((prev) => ({ ...prev, status: 'locating', errorMessage: undefined }));

    navigator.geolocation.getCurrentPosition(
      (pos) => updateGpsFromCoords(pos.coords),
      (err) => handleGpsError(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => updateGpsFromCoords(pos.coords),
      (err) => handleGpsError(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [
    geofenceConfig.latitude,
    geofenceConfig.longitude,
    geofenceConfig.radiusMeters,
    geofenceConfig.maxAccuracyMeters,
  ]);

  // Auto GPS Check-in / Check-out Effect
  useEffect(() => {
    if (isReadOnly || isSubmitting || !autoModeActive || employeeShift.ignored) return;
    if (gps.status !== 'ready' || gps.latitude === null || gps.longitude === null) return;
    if (!gps.withinGeofence || !gps.accuracyAcceptable) return;

    // Determine whether Auto Check-in or Auto Check-out should trigger
    let targetType: AttendanceType | null = null;
    if (!todayCheckIn && geofenceConfig.autoCheckinEnabled) {
      targetType = 'check_in';
    } else if (
      todayCheckIn &&
      !todayCheckOut &&
      geofenceConfig.autoCheckoutEnabled
    ) {
      const [endH, endM] = employeeShift.shiftEndTime.split(':').map(Number);
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const shiftEndMins = (endH || 17) * 60 + (endM || 0);
      if (currentMins >= shiftEndMins) {
        targetType = 'check_out';
      }
    }

    if (!targetType) return;

    const triggerKey = `${todayStr}:${currentUser.name}:${targetType}`;
    if (autoTriggeredKeyRef.current === triggerKey) return;
    autoTriggeredKeyRef.current = triggerKey;

    const runAutoSubmit = async () => {
      setIsSubmitting(true);
      try {
        const created = await onRecordAttendance({
          type: targetType!,
          mode: 'auto',
          latitude: gps.latitude!,
          longitude: gps.longitude!,
          distanceMeters: gps.distanceMeters ?? 0,
          accuracyMeters: gps.accuracyMeters ?? 0,
        });
        if (created) {
          setFeedbackBanner({
            type: 'success',
            message:
              targetType === 'check_in'
                ? `Auto GPS Check-in สำเร็จ เวลา ${created.timeDisplay} (${getStatusLabelTH(created.status)})`
                : `Auto GPS Check-out สำเร็จ เวลา ${created.timeDisplay}`,
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    };

    runAutoSubmit();
  }, [
    isReadOnly,
    isSubmitting,
    autoModeActive,
    gps,
    todayCheckIn,
    todayCheckOut,
    geofenceConfig.autoCheckinEnabled,
    geofenceConfig.autoCheckoutEnabled,
    employeeShift.shiftEndTime,
    employeeShift.ignored,
    todayStr,
    currentUser.name,
    now,
    onRecordAttendance,
  ]);

  const handleManualAction = async (type: AttendanceType) => {
    if (isReadOnly || isSubmitting) return;
    if (gps.status !== 'ready' || gps.latitude === null || gps.longitude === null) {
      setFeedbackBanner({
        type: 'error',
        message: 'ไม่พบพิกัด GPS ปัจจุบัน กรุณากดอัปเดตพิกัดก่อนลงเวลา',
      });
      return;
    }
    if (!gps.withinGeofence) {
      setFeedbackBanner({
        type: 'error',
        message: `อยู่นอกพื้นที่ร้าน (ห่าง ${formatDistanceMeters(gps.distanceMeters)} จากรัศมีที่กำหนด ${geofenceConfig.radiusMeters} ม.)`,
      });
      return;
    }
    if (!gps.accuracyAcceptable) {
      setFeedbackBanner({
        type: 'error',
        message: `สัญญาณ GPS มีความคลาดเคลื่อนสูง (±${gps.accuracyMeters} ม.) เกินค่าที่กำหนด ${geofenceConfig.maxAccuracyMeters} ม. กรุณารอสัญญาณหรือย้ายไปจุดที่โล่งขึ้น`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await onRecordAttendance({
        type,
        mode: 'manual',
        latitude: gps.latitude,
        longitude: gps.longitude,
        distanceMeters: gps.distanceMeters ?? 0,
        accuracyMeters: gps.accuracyMeters ?? 0,
        note: noteInput.trim() || undefined,
      });
      if (created) {
        setNoteInput('');
        setFeedbackBanner({
          type: 'success',
          message:
            type === 'check_in'
              ? `บันทึกเวลาเข้างานสำเร็จ เวลา ${created.timeDisplay} (${getStatusLabelTH(created.status)})`
              : `บันทึกเวลาออกงานสำเร็จ เวลา ${created.timeDisplay} (${getStatusLabelTH(created.status)})`,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute radial visualizer position (normalized inside SVG radar)
  const radarPoint = (() => {
    if (gps.distanceMeters === null) return { x: 100, y: 100, clampedRatio: 0 };
    const maxDisplayDist = Math.max(geofenceConfig.radiusMeters * 1.8, 150);
    const ratio = Math.min(gps.distanceMeters / maxDisplayDist, 0.92);
    // Deterministic angle from lat/lng delta so marker reflects directional offset cleanly
    const dy = (gps.latitude ?? geofenceConfig.latitude) - geofenceConfig.latitude;
    const dx = (gps.longitude ?? geofenceConfig.longitude) - geofenceConfig.longitude;
    const angle = dx === 0 && dy === 0 ? -Math.PI / 4 : Math.atan2(-dy, dx);
    const maxPx = 76;
    return {
      x: 100 + Math.cos(angle) * ratio * maxPx,
      y: 100 + Math.sin(angle) * ratio * maxPx,
      clampedRatio: ratio,
    };
  })();

  const storeRingRadiusPx = (() => {
    const maxDisplayDist = Math.max(geofenceConfig.radiusMeters * 1.8, 150);
    return Math.round((geofenceConfig.radiusMeters / maxDisplayDist) * 76);
  })();

  const canCheckIn =
    !isReadOnly &&
    !isSubmitting &&
    !todayCheckIn &&
    gps.status === 'ready' &&
    gps.withinGeofence &&
    gps.accuracyAcceptable;

  const canCheckOut =
    !isReadOnly &&
    !isSubmitting &&
    !!todayCheckIn &&
    !todayCheckOut &&
    gps.status === 'ready' &&
    gps.withinGeofence &&
    gps.accuracyAcceptable;

  const timeString = now.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="space-y-4">
      <PageHeaderBanner
        variant="sub"
        icon={<Navigation size={18} />}
        title="สแกนเวลาตนเอง (GPS Auto Check-in)"
        branchLabel={geofenceConfig.branchLabel}
        subtitle={`กะ: ${employeeShift.shiftName} (${employeeShift.shiftStartTime} – ${employeeShift.shiftEndTime} น.) · อนุโลมสาย ${employeeShift.graceMinutes} นาที · ${
          isOtEnabled
            ? `${getOtTypeLabel(employeeShift.otMultiplier)} (${
                employeeShift.otCalculationMode === 'actual'
                  ? 'นับนาทีจริง'
                  : `ทุก ${employeeShift.otStepMinutes} นาที`
              })`
            : 'ไม่คิด OT'
        } · รัศมี ${geofenceConfig.radiusMeters} ม.`}
        actions={
          <div className="flex items-center gap-2">
            <div className="h-[32px] px-3 rounded-[8px] bg-[#E8F3F2] border border-[#D4E4E3] flex items-center gap-1.5 text-[11px] font-bold text-[#2D4A49] tabular-nums">
              <Clock size={13} className="text-[#5A8A88]" />
              <span>{formatThaiNumericDate(todayStr)}</span>
              <span className="text-[#5A8A88]">·</span>
              <span className="font-mono">{timeString}</span>
            </div>
            <button
              type="button"
              onClick={requestManualRefresh}
              className="h-[32px] px-3 rounded-[8px] bg-white hover:bg-[#F0F5F4] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="รีเฟรชพิกัด GPS ปัจจุบัน"
            >
              <RefreshCw size={13} className={gps.status === 'locating' ? 'animate-spin text-[#5A8A88]' : 'text-[#5A8A88]'} />
              <span>รีเฟรช GPS</span>
            </button>
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2 text-[11px] text-[#2D4A49]">
              <Radio size={14} className={autoModeActive ? 'text-emerald-600' : 'text-[#6B8F8E]'} />
              <span className="font-semibold">โหมด Auto Check-in เมื่อเข้าพื้นที่ร้าน:</span>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => setAutoModeActive((prev) => !prev)}
                className={`h-[26px] px-2.5 rounded-[7px] text-[11px] font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
                  autoModeActive
                    ? 'bg-[#5A8A88] text-white border-[#5A8A88]'
                    : 'bg-[#F0F5F4] text-[#6B8F8E] border-[#D4E4E3]'
                }`}
              >
                {autoModeActive ? 'เปิดใช้งานอยู่' : 'ปิดไว้ (สแกนด้วยตนเอง)'}
              </button>
            </div>

            {employeeShift.ignored && (
              <div className="flex items-center gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                <AlertTriangle size={13} className="shrink-0" />
                <span>บัญชีนี้ถูกตั้งค่าเป็น Ignore (ปิด Auto GPS และไม่ต้อง Monitor เวลาเข้า-ออกงาน)</span>
              </div>
            )}

            {!geofenceConfig.isConfigured && (
              <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                <AlertTriangle size={13} className="shrink-0" />
                <span>กำลังใช้พิกัดอ้างอิงเริ่มต้นของสาขา</span>
                {canEditGeofence && onOpenGeofenceSettings && (
                  <button
                    type="button"
                    onClick={onOpenGeofenceSettings}
                    className="underline font-bold hover:text-amber-900 cursor-pointer ml-1"
                  >
                    ตั้งค่าพิกัดจริง
                  </button>
                )}
              </div>
            )}
          </div>
        }
      />

      {feedbackBanner && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-medium ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : feedbackBanner.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-[#E8F3F2] border-[#D4E4E3] text-[#2D4A49]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={16} className="shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer shrink-0"
          >
            ปิด
          </button>
        </div>
      )}

      {/* 2-Column Balanced Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Live GPS Geofence & Scan Controls */}
        <section className="lg:col-span-7 bg-white rounded-2xl border border-[#D4E4E3] p-5 shadow-[0_2px_8px_rgba(90,138,136,0.06)] flex flex-col justify-between space-y-5">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Technical Radial Geofence Visualizer */}
            <div className="shrink-0 flex flex-col items-center">
              <svg
                viewBox="0 0 200 200"
                className="w-44 h-44 rounded-full bg-[#F8FCFC] border border-[#D4E4E3]"
                role="img"
                aria-label="แผนภาพระยะห่างจากพิกัดสาขา"
              >
                {/* Outer reference ring */}
                <circle cx="100" cy="100" r="82" fill="none" stroke="#D4E4E3" strokeDasharray="3 3" strokeWidth="1" />
                {/* Crosshair axes */}
                <line x1="100" y1="14" x2="100" y2="186" stroke="#E8F3F2" strokeWidth="1" />
                <line x1="14" y1="100" x2="186" y2="100" stroke="#E8F3F2" strokeWidth="1" />
                {/* Allowed geofence radius circle */}
                <circle
                  cx="100"
                  cy="100"
                  r={storeRingRadiusPx}
                  fill={gps.withinGeofence ? 'rgba(16, 185, 129, 0.12)' : 'rgba(90, 138, 136, 0.10)'}
                  stroke={gps.withinGeofence ? '#10B981' : '#5A8A88'}
                  strokeWidth="1.75"
                />
                {/* Store anchor point */}
                <circle cx="100" cy="100" r="4.5" fill="#2D4A49" />
                <text x="100" y="91" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#2D4A49">
                  สาขา
                </text>
                {/* Employee live GPS point */}
                {gps.status === 'ready' && (
                  <>
                    <line
                      x1="100"
                      y1="100"
                      x2={radarPoint.x}
                      y2={radarPoint.y}
                      stroke={gps.withinGeofence ? '#059669' : '#E11D48'}
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={radarPoint.x}
                      cy={radarPoint.y}
                      r="6"
                      fill={gps.withinGeofence ? '#10B981' : '#E11D48'}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                  </>
                )}
              </svg>
              <span className="text-[10px] text-[#6B8F8E] mt-2 tabular-nums">
                รัศมีอนุญาต: {geofenceConfig.radiusMeters} ม.
              </span>
            </div>

            {/* Live GPS Metrics */}
            <div className="flex-1 w-full space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-[#6B8F8E]">สถานะสัญญาณ GPS ปัจจุบัน</p>
                <div className="mt-1 flex items-center gap-2">
                  {gps.status === 'locating' && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700">
                      <RefreshCw size={15} className="animate-spin" /> กำลังค้นหาพิกัด GPS...
                    </span>
                  )}
                  {gps.status === 'ready' && gps.withinGeofence && gps.accuracyAcceptable && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                      <CheckCircle2 size={16} /> อยู่ในพื้นที่สาขา พร้อมลงเวลา
                    </span>
                  )}
                  {gps.status === 'ready' && gps.withinGeofence && !gps.accuracyAcceptable && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700">
                      <AlertTriangle size={16} /> ความแม่นยำ GPS ต่ำเกินไป (±{gps.accuracyMeters} ม.)
                    </span>
                  )}
                  {gps.status === 'ready' && !gps.withinGeofence && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-rose-700">
                      <AlertTriangle size={16} /> อยู่นอกพื้นที่ที่กำหนด
                    </span>
                  )}
                  {(gps.status === 'denied' || gps.status === 'unavailable' || gps.status === 'error') && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-rose-700">
                      <AlertTriangle size={16} /> ไม่สามารถรับพิกัด GPS
                    </span>
                  )}
                </div>
                {gps.errorMessage && (
                  <p className="text-[11px] text-rose-600 mt-1">{gps.errorMessage}</p>
                )}
              </div>

              {/* Clean Metric Grid (No nested bordered card stack — hairline divider grid) */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3 border-t border-[#E8F3F2] text-xs">
                <div>
                  <span className="text-[10.5px] text-[#6B8F8E] block">ระยะห่างจากสาขา</span>
                  <span
                    className={`font-bold text-base tabular-nums font-mono ${
                      gps.distanceMeters === null
                        ? 'text-slate-400'
                        : gps.withinGeofence
                          ? 'text-emerald-700'
                          : 'text-rose-600'
                    }`}
                  >
                    {formatDistanceMeters(gps.distanceMeters)}
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#6B8F8E] block">ความคลาดเคลื่อน GPS</span>
                  <span className="font-bold text-base text-[#2D4A49] tabular-nums font-mono">
                    {gps.accuracyMeters !== null ? `±${gps.accuracyMeters} ม.` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#6B8F8E] block">พิกัดของคุณ</span>
                  <span className="text-[11px] font-medium text-[#2D4A49] tabular-nums font-mono">
                    {gps.latitude !== null && gps.longitude !== null
                      ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#6B8F8E] block">อัปเดตล่าสุด</span>
                  <span className="text-[11px] font-medium text-[#2D4A49] tabular-nums font-mono">
                    {gps.lastUpdatedAt || '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Note & Action Buttons */}
          <div className="pt-4 border-t border-[#E8F3F2] space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#2D4A49] mb-1">
                หมายเหตุเพิ่มเติม (ถ้ามี)
              </label>
              <input
                type="text"
                disabled={isReadOnly || (!!todayCheckIn && !!todayCheckOut)}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="เช่น เข้ากะเช้าช่วยเตรียมเบเกอรี่ / ออกตรวจสาขา..."
                className="w-full h-[36px] px-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs outline-none focus:border-[#5A8A88] disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={!canCheckIn}
                onClick={() => handleManualAction('check_in')}
                className="h-[42px] px-4 rounded-xl bg-[#2D4A49] hover:bg-[#203635] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <LogIn size={15} />
                <span>
                  {todayCheckIn
                    ? `เข้างานแล้ว (${todayCheckIn.timeDisplay})`
                    : 'สแกนเข้างาน (Check-in)'}
                </span>
              </button>

              <button
                type="button"
                disabled={!canCheckOut}
                onClick={() => handleManualAction('check_out')}
                className="h-[42px] px-4 rounded-xl bg-[#5A8A88] hover:bg-[#497573] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <LogOut size={15} />
                <span>
                  {todayCheckOut
                    ? `ออกงานแล้ว (${todayCheckOut.timeDisplay})`
                    : 'สแกนออกงาน (Check-out)'}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Right: Today's Personal Attendance Card */}
        <section className="lg:col-span-5 bg-white rounded-2xl border border-[#D4E4E3] p-5 shadow-[0_2px_8px_rgba(90,138,136,0.06)] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8F3F2] pb-3">
              <div>
                <h2 className="text-[14px] font-bold text-[#2D4A49]">สรุปเวลาทำงานวันนี้ของคุณ</h2>
                <p className="text-[11px] text-[#6B8F8E] mt-0.5">
                  {currentUser.name} · {currentUser.role}
                </p>
              </div>
              <ShieldCheck size={18} className="text-[#5A8A88]" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-[#F0F5F4]">
                <div>
                  <p className="text-[11px] text-[#6B8F8E]">เวลาเข้างาน (Check-in)</p>
                  <p className="text-lg font-bold text-[#2D4A49] tabular-nums font-mono mt-0.5">
                    {todayCheckIn ? todayCheckIn.timeDisplay : '— : — : —'}
                  </p>
                </div>
                <div className="text-right">
                  {todayCheckIn ? (
                    <>
                      <span
                        className={`text-xs font-bold ${
                          todayCheckIn.status === 'late' ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {getStatusLabelTH(todayCheckIn.status)}
                      </span>
                      <p className="text-[10.5px] text-[#6B8F8E] mt-0.5 tabular-nums">
                        {todayCheckIn.mode === 'auto' ? 'Auto GPS' : 'Manual'} · {formatDistanceMeters(todayCheckIn.distanceMeters)}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">ยังไม่สแกนเข้างาน</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[#F0F5F4]">
                <div>
                  <p className="text-[11px] text-[#6B8F8E]">เวลาออกงาน (Check-out)</p>
                  <p className="text-lg font-bold text-[#2D4A49] tabular-nums font-mono mt-0.5">
                    {todayCheckOut ? todayCheckOut.timeDisplay : '— : — : —'}
                  </p>
                </div>
                <div className="text-right">
                  {todayCheckOut ? (
                    <>
                      <span
                        className={`text-xs font-bold ${
                          todayCheckOut.status === 'early_out' ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {getStatusLabelTH(todayCheckOut.status)}
                      </span>
                      <p className="text-[10.5px] text-[#6B8F8E] mt-0.5 tabular-nums">
                        {todayCheckOut.mode === 'auto' ? 'Auto GPS' : 'Manual'} · {formatDistanceMeters(todayCheckOut.distanceMeters)}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">
                      {todayCheckIn ? 'กำลังปฏิบัติงาน' : 'รอเข้างาน'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 pb-2 border-b border-[#F0F5F4]">
                <div>
                  <span className="text-xs font-semibold text-[#6B8F8E] block">ระยะเวลาทำงานรวมวันนี้</span>
                  {todayCheckIn && !todayCheckOut && (
                    <span className="text-[10px] text-[#6B8F8E]">กำลังนับเวลาทำงานแบบ Real-time</span>
                  )}
                </div>
                <span className="text-sm font-bold text-[#2D4A49] tabular-nums font-mono">
                  {workDurationText}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs font-semibold text-[#5A8A88] block">
                    โอที (OT) · {getOtTypeLabel(activeOtMultiplier)}
                  </span>
                  <span className="text-[10.5px] text-[#6B8F8E]">
                    {isOtEnabled
                      ? `${employeeShift.shiftName} · ${
                          employeeShift.isOvertimeSchedule || employeeShift.isDayOff
                            ? 'คิดเวลาทำงานเป็น OT'
                            : `เลิก ${employeeShift.shiftEndTime} น.`
                        } · ${
                          employeeShift.otCalculationMode === 'actual'
                            ? 'นับตามเวลาจริง'
                            : `คิดทุก ${employeeShift.otStepMinutes} นาที`
                        }`
                      : `${employeeShift.shiftName} · ไม่คิดโอที`}
                  </span>
                </div>
                <div className="text-right">
                  {!todayCheckIn ? (
                    <span className="text-sm font-bold text-slate-400 tabular-nums font-mono">—</span>
                  ) : !isOtEnabled ? (
                    <span className="text-xs font-medium text-slate-400">ไม่คิดโอที</span>
                  ) : computedOtMinutes > 0 ? (
                    <>
                      <span className="text-sm font-bold text-emerald-700 tabular-nums font-mono block">
                        +{formatOtHours(computedOtMinutes)}
                      </span>
                      <span className="text-[10px] text-[#6B8F8E] tabular-nums">
                        {formatOtDuration(computedOtMinutes)} ·{' '}
                        {isLiveOtAccruing ? 'สะสมขณะปฏิบัติงาน' : getOtTypeLabel(activeOtMultiplier)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-bold text-[#6B8F8E] tabular-nums font-mono block">
                        0.00 ชม.
                      </span>
                      <span className="text-[10px] text-[#6B8F8E]">
                        {isLiveOtAccruing
                          ? employeeShift.isOvertimeSchedule || employeeShift.isDayOff
                            ? 'กำลังสะสม OT'
                            : `เริ่มนับหลัง ${employeeShift.shiftEndTime} น.`
                          : 'ไม่เข้าเกณฑ์โอที'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="text-[10.5px] text-[#6B8F8E] pt-3 border-t border-[#E8F3F2] mt-4 leading-relaxed">
            หมายเหตุ: การสแกนอัตโนมัติ (Auto GPS) จะทำงานทันทีเมื่อเปิดหน้านี้และอยู่ในรัศมีสาขาที่กำหนด พร้อมอัปเดตประวัติไปยังระบบหลักแบบ Real-time
          </p>
        </section>
      </div>

      {/* Today's Personal Check-in Log Table (Strictly filtered to currentUser) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-[#2D4A49]">
            ประวัติการสแกนเวลาของคุณวันนี้ — {currentUser.name}
          </h3>
          <span className="text-[11px] text-[#6B8F8E] tabular-nums">
            ทั้งหมด {myTodayRecords.length} รายการ
          </span>
        </div>

        <StandardTableCard>
          <StandardTable>
            <StandardThead>
              <StandardHeaderRow>
                <StandardTh>เวลา</StandardTh>
                <StandardTh>ประเภท</StandardTh>
                <StandardTh>วิธีสแกน</StandardTh>
                <StandardTh align="right">ระยะห่าง</StandardTh>
                <StandardTh>สถานะ</StandardTh>
                <StandardTh align="right">โอที (OT)</StandardTh>
              </StandardHeaderRow>
            </StandardThead>
            <StandardTbody>
              {myTodayRecords.length === 0 ? (
                <StandardTableEmpty
                  colSpan={6}
                  icon={<MapPin size={20} />}
                  title="คุณยังไม่มีรายการสแกนเวลาในวันนี้"
                  description="เมื่อคุณเข้าสู่พื้นที่สาขา ระบบ Auto GPS หรือการกดสแกนจะบันทึกและแสดงผลเฉพาะของคุณที่นี่"
                />
              ) : (
                myTodayRecords.map((rec) => {
                  const recDate = new Date(rec.recordedAt);
                  const recOtMinutes =
                    rec.type === 'check_out' && isOtEnabled && !Number.isNaN(recDate.getTime())
                      ? calculateShiftOtMinutes({
                          checkOutDate: recDate,
                          checkInDate: validCheckInDate,
                          shift: employeeShift,
                        })
                      : 0;
                  const recOtMult = rec.otMultiplier ?? employeeShift.otMultiplier;
                  return (
                    <StandardTr key={rec.id}>
                      <StandardTd className="font-mono tabular-nums font-semibold">
                        {rec.timeDisplay}
                      </StandardTd>
                      <StandardTd>
                        <span
                          className={`font-semibold ${
                            rec.type === 'check_in' ? 'text-[#2D4A49]' : 'text-[#5A8A88]'
                          }`}
                        >
                          {rec.type === 'check_in' ? 'เข้างาน' : 'ออกงาน'}
                        </span>
                      </StandardTd>
                      <StandardTd className="text-[#6B8F8E]">
                        {rec.mode === 'auto' ? 'Auto GPS' : 'Manual'}
                      </StandardTd>
                      <StandardTd align="right" className="font-mono tabular-nums">
                        {formatDistanceMeters(rec.distanceMeters)}
                      </StandardTd>
                      <StandardTd>
                        <span
                          className={`font-semibold ${
                            rec.status === 'on_time' || rec.status === 'completed'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {getStatusLabelTH(rec.status)}
                        </span>
                      </StandardTd>
                      <StandardTd align="right" className="font-mono tabular-nums">
                        {rec.type === 'check_out' ? (
                          !isOtEnabled ? (
                            <span className="text-slate-400">ไม่คิดโอที</span>
                          ) : recOtMinutes > 0 ? (
                            <span className="font-bold text-emerald-700">
                              {getOtTypeLabel(recOtMult)} · +{formatOtHours(recOtMinutes)}
                            </span>
                          ) : (
                            <span className="text-[#6B8F8E]">0.00 ชม.</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </StandardTd>
                    </StandardTr>
                  );
                })
              )}
            </StandardTbody>
          </StandardTable>
        </StandardTableCard>
      </div>
    </div>
  );
};
