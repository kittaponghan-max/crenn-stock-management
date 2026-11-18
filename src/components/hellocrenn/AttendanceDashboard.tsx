import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Clock,
  Search,
  MapPin,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Timer,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  AttendanceRecord,
  BranchGeofenceConfig,
  EmployeeShiftConfig,
} from '../../types/hellocrenn';
import {
  calculateOtMinutes,
  formatDistanceMeters,
  formatMinutesDuration,
  formatOtDuration,
  getStatusLabelTH,
  resolveEmployeeShift,
} from '../../utils/gpsUtils';
import {
  PageHeaderBanner,
  StandardDropdown,
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

interface BranchStaffMember {
  id?: string;
  name: string;
  role: string;
}

type StatusFilter = 'ALL' | 'CHECKED_IN' | 'LATE' | 'NOT_SCANNED' | 'HAS_OT' | 'IGNORED';

interface AttendanceDashboardProps {
  currentBranch: string;
  geofenceConfig: BranchGeofenceConfig;
  attendanceRecords: AttendanceRecord[];
  canScanSelf?: boolean;
  onOpenSelfScan?: () => void;
  canEditGeofence?: boolean;
  onOpenGeofenceSettings?: () => void;
}

export const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({
  currentBranch,
  geofenceConfig,
  attendanceRecords,
  canScanSelf = false,
  onOpenSelfScan,
  canEditGeofence = false,
  onOpenGeofenceSettings,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [staffMembers, setStaffMembers] = useState<BranchStaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Live clock (1s) for real-time work duration & accrued OT display
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load branch staff from Supabase app_users + LocalStorage fallback
  useEffect(() => {
    let isMounted = true;
    const branch = currentBranch || geofenceConfig.branch || 'Rayong';

    const loadStaff = async () => {
      setLoadingStaff(true);
      const foundMap = new Map<string, BranchStaffMember>();

      const register = (u: any) => {
        if (!u || !u.name) return;
        const name = String(u.name).trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!foundMap.has(key)) {
          foundMap.set(key, {
            id: u.id ? String(u.id) : undefined,
            name,
            role: u.role ? String(u.role) : 'Staff',
          });
        }
      };

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('app_users')
            .select('id, name, role, branch')
            .eq('branch', branch);
          if (!error && Array.isArray(data)) {
            data.forEach(register);
          }
        } catch (err) {
          console.warn('AttendanceDashboard load staff error:', err);
        }
      }

      if (typeof window !== 'undefined') {
        const storageKeys = [`cafe-app-users-${branch}`, 'cafe-app-users', 'app_users'];
        storageKeys.forEach((sk) => {
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

      if (isMounted) {
        setStaffMembers(Array.from(foundMap.values()));
        setLoadingStaff(false);
      }
    };

    loadStaff();
    return () => {
      isMounted = false;
    };
  }, [currentBranch, geofenceConfig.branch]);

  const todayStr = toLocalDateStr(now);
  const timeString = now.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const todayBranchRecords = useMemo(() => {
    return attendanceRecords.filter(
      (r) => r.date === todayStr && r.branch === currentBranch
    );
  }, [attendanceRecords, todayStr, currentBranch]);

  // Build unified employee overview rows
  const employeeRows = useMemo(() => {
    const map = new Map<string, BranchStaffMember>();

    staffMembers.forEach((m) => {
      map.set(m.name.trim().toLowerCase(), m);
    });

    const shiftEntries = Object.values(
      geofenceConfig.employeeShifts ?? {}
    ) as EmployeeShiftConfig[];
    shiftEntries.forEach((s) => {
      if (!s || !s.userName) return;
      const key = s.userName.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: s.userId,
          name: s.userName.trim(),
          role: s.userRole || 'Staff',
        });
      }
    });

    todayBranchRecords.forEach((rec) => {
      if (!rec.userName) return;
      const key = rec.userName.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: rec.userName.trim(),
          role: rec.userRole || 'Staff',
        });
      }
    });

    const rows = Array.from(map.values()).map((emp) => {
      const key = emp.name.trim().toLowerCase();
      const empRecords = todayBranchRecords.filter(
        (r) => r.userName.trim().toLowerCase() === key
      );
      const checkIn = empRecords.find((r) => r.type === 'check_in') || null;
      const checkOut = empRecords.find((r) => r.type === 'check_out') || null;
      const shift = resolveEmployeeShift(geofenceConfig, emp.name);

      // Compute OT accurately using the employee's configured shift & OT step rule
      let otMinutes = 0;
      let isLiveOt = false;
      if (shift.otStepMinutes > 0) {
        if (checkOut) {
          const checkOutDate = new Date(checkOut.recordedAt);
          if (!Number.isNaN(checkOutDate.getTime())) {
            otMinutes = calculateOtMinutes(
              checkOutDate,
              shift.shiftEndTime,
              shift.otStepMinutes
            );
          } else {
            otMinutes = checkOut.otMinutes ?? 0;
          }
        } else if (checkIn) {
          otMinutes = calculateOtMinutes(
            now,
            shift.shiftEndTime,
            shift.otStepMinutes
          );
          isLiveOt = true;
        }
      }

      const workDurationDisplay = checkIn
        ? checkOut
          ? formatMinutesDuration(checkIn.recordedAt, checkOut.recordedAt)
          : formatMinutesDuration(checkIn.recordedAt, now.toISOString())
        : '—';

      const statusGroup: 'not_scanned' | 'working' | 'checked_out' = !checkIn
        ? 'not_scanned'
        : checkOut
          ? 'checked_out'
          : 'working';

      return {
        emp,
        shift,
        checkIn,
        checkOut,
        otMinutes,
        isLiveOt,
        workDurationDisplay,
        statusGroup,
      };
    });

    // Sort: checked-in / working / checked-out first (by most recent activity), then not scanned alphabetically
    return rows.sort((a, b) => {
      const aScore = a.checkIn ? (a.checkOut ? 1 : 2) : 0;
      const bScore = b.checkIn ? (b.checkOut ? 1 : 2) : 0;
      if (aScore !== bScore) return bScore - aScore;
      return a.emp.name.localeCompare(b.emp.name, 'th');
    });
  }, [staffMembers, geofenceConfig, todayBranchRecords, now]);

  const monitoredRows = useMemo(
    () => employeeRows.filter((r) => !r.shift.ignored),
    [employeeRows]
  );
  const ignoredRows = useMemo(
    () => employeeRows.filter((r) => r.shift.ignored),
    [employeeRows]
  );

  const summary = useMemo(() => {
    const totalStaff = monitoredRows.length;
    const checkedInRows = monitoredRows.filter((r) => r.checkIn !== null);
    const onTimeCount = checkedInRows.filter((r) => r.checkIn?.status === 'on_time').length;
    const lateCount = checkedInRows.filter((r) => r.checkIn?.status === 'late').length;
    const workingCount = monitoredRows.filter((r) => r.statusGroup === 'working').length;
    const checkedOutCount = monitoredRows.filter((r) => r.statusGroup === 'checked_out').length;
    const notScannedCount = monitoredRows.filter((r) => r.statusGroup === 'not_scanned').length;
    const otRows = monitoredRows.filter((r) => r.otMinutes > 0);
    const totalOtMinutes = otRows.reduce((acc, r) => acc + r.otMinutes, 0);

    return {
      totalStaff,
      checkedInCount: checkedInRows.length,
      onTimeCount,
      lateCount,
      workingCount,
      checkedOutCount,
      notScannedCount,
      otStaffCount: otRows.length,
      totalOtMinutes,
      ignoredCount: ignoredRows.length,
    };
  }, [monitoredRows, ignoredRows.length]);

  const filteredRows = useMemo(() => {
    return employeeRows
      .filter((r) => {
        if (statusFilter === 'IGNORED') return r.shift.ignored;
        if (r.shift.ignored) return false;
        if (statusFilter === 'CHECKED_IN') return r.checkIn !== null;
        if (statusFilter === 'LATE') return r.checkIn?.status === 'late';
        if (statusFilter === 'NOT_SCANNED') return r.checkIn === null;
        if (statusFilter === 'HAS_OT') return r.otMinutes > 0;
        return true;
      })
      .filter((r) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.trim().toLowerCase();
        return (
          r.emp.name.toLowerCase().includes(q) ||
          r.emp.role.toLowerCase().includes(q)
        );
      });
  }, [employeeRows, statusFilter, searchTerm]);

  const filterOptions: Array<{ value: StatusFilter; label: string; count?: number }> = [
    { value: 'ALL', label: 'พนักงานที่ Monitor ทั้งหมด', count: summary.totalStaff },
    { value: 'CHECKED_IN', label: 'สแกนเข้างานแล้ว', count: summary.checkedInCount },
    { value: 'LATE', label: 'มาสายวันนี้', count: summary.lateCount },
    { value: 'NOT_SCANNED', label: 'ยังไม่สแกนเข้างาน', count: summary.notScannedCount },
    { value: 'HAS_OT', label: 'มีโอทีวันนี้', count: summary.otStaffCount },
    ...(summary.ignoredCount > 0
      ? [{ value: 'IGNORED' as const, label: 'ไม่ต้อง Monitor (Ignore)', count: summary.ignoredCount }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <PageHeaderBanner
        variant="sub"
        icon={<Users size={18} />}
        title="สแกนเวลา · ภาพรวมพนักงานทุกคน (Admin Dashboard)"
        branchLabel={geofenceConfig.branchLabel}
        subtitle={`ติดตามสถานะเข้า-ออกงาน เวลาทำงานจริง และคำนวณ OT รายบุคคลของพนักงานทุกคนในสาขา`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-[32px] px-3 rounded-[8px] bg-[#E8F3F2] border border-[#D4E4E3] flex items-center gap-1.5 text-[11px] font-bold text-[#2D4A49] tabular-nums">
              <Clock size={13} className="text-[#5A8A88]" />
              <span>{formatThaiNumericDate(todayStr)}</span>
              <span className="text-[#5A8A88]">·</span>
              <span className="font-mono">{timeString}</span>
            </div>
            {canScanSelf && onOpenSelfScan && (
              <button
                type="button"
                onClick={onOpenSelfScan}
                className="h-[32px] px-3 rounded-[8px] bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <MapPin size={13} />
                <span>สแกนเวลาตนเอง</span>
              </button>
            )}
            {canEditGeofence && onOpenGeofenceSettings && (
              <button
                type="button"
                onClick={onOpenGeofenceSettings}
                className="h-[32px] px-3 rounded-[8px] bg-white hover:bg-[#F0F5F4] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Settings2 size={13} className="text-[#5A8A88]" />
                <span>ตั้งค่ากะ & OT</span>
              </button>
            )}
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B8F8E] pointer-events-none"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาชื่อพนักงาน หรือตำแหน่ง..."
                className="w-full h-[32px] pl-8 pr-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-xs outline-none focus:border-[#5A8A88]"
              />
            </div>

            <div className="flex items-center gap-2">
              <StandardDropdown
                label="สถานะ:"
                options={filterOptions}
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as StatusFilter)}
                align="right"
              />
            </div>
          </div>
        }
      />

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-[#D4E4E3] p-4 shadow-[0_2px_8px_rgba(90,138,136,0.05)]">
          <div className="flex items-center justify-between text-[11px] text-[#6B8F8E]">
            <span>เช็คอินแล้ววันนี้</span>
            <CheckCircle2 size={14} className="text-[#5A8A88]" />
          </div>
          <p className="text-xl font-bold text-[#2D4A49] tabular-nums font-mono mt-1">
            {summary.checkedInCount} <span className="text-xs font-normal text-[#6B8F8E]">/ {summary.totalStaff} คน</span>
          </p>
          <p className="text-[10.5px] text-[#6B8F8E] mt-1 tabular-nums">
            ยังไม่สแกน {summary.notScannedCount} คน
            {summary.ignoredCount > 0 ? ` · Ignore ${summary.ignoredCount} คน` : ''}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#D4E4E3] p-4 shadow-[0_2px_8px_rgba(90,138,136,0.05)]">
          <div className="flex items-center justify-between text-[11px] text-[#6B8F8E]">
            <span>ตรงเวลา / มาสาย</span>
            <AlertTriangle size={14} className={summary.lateCount > 0 ? 'text-amber-600' : 'text-emerald-600'} />
          </div>
          <p className="text-xl font-bold text-emerald-700 tabular-nums font-mono mt-1">
            {summary.onTimeCount}{' '}
            <span className="text-xs font-bold text-amber-700">· สาย {summary.lateCount}</span>
          </p>
          <p className="text-[10.5px] text-[#6B8F8E] mt-1">ประเมินตามกะแต่ละบุคคล</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#D4E4E3] p-4 shadow-[0_2px_8px_rgba(90,138,136,0.05)]">
          <div className="flex items-center justify-between text-[11px] text-[#6B8F8E]">
            <span>กำลังปฏิบัติงาน / ออกงานแล้ว</span>
            <LogOut size={14} className="text-[#5A8A88]" />
          </div>
          <p className="text-xl font-bold text-[#2D4A49] tabular-nums font-mono mt-1">
            {summary.workingCount}{' '}
            <span className="text-xs font-normal text-[#6B8F8E]">/ ออกแล้ว {summary.checkedOutCount}</span>
          </p>
          <p className="text-[10.5px] text-[#6B8F8E] mt-1">อัปเดตสถานะแบบ Real-time</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#D4E4E3] p-4 shadow-[0_2px_8px_rgba(90,138,136,0.05)]">
          <div className="flex items-center justify-between text-[11px] text-[#6B8F8E]">
            <span>โอที (OT) สะสมวันนี้</span>
            <Timer size={14} className="text-[#5A8A88]" />
          </div>
          <p className="text-xl font-bold text-[#5A8A88] tabular-nums font-mono mt-1">
            {summary.totalOtMinutes > 0 ? formatOtDuration(summary.totalOtMinutes) : '0 นาที'}
          </p>
          <p className="text-[10.5px] text-[#6B8F8E] mt-1 tabular-nums">
            พนักงานที่มี OT {summary.otStaffCount} คน
          </p>
        </div>
      </div>

      {/* Staff Attendance Overview Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-[#2D4A49]">
            ตารางสรุปเวลาเข้า-ออกงานและโอทีพนักงานวันนี้ — {geofenceConfig.branchLabel}
          </h3>
          <span className="text-[11px] text-[#6B8F8E] tabular-nums">
            {loadingStaff
              ? 'กำลังโหลดรายชื่อพนักงาน...'
              : `แสดง ${filteredRows.length} จาก ${statusFilter === 'IGNORED' ? summary.ignoredCount : summary.totalStaff} คน`}
          </span>
        </div>

        <StandardTableCard>
          <StandardTable>
            <StandardThead>
              <StandardHeaderRow>
                <StandardTh>พนักงาน / กะงาน</StandardTh>
                <StandardTh>สถานะปัจจุบัน</StandardTh>
                <StandardTh>เวลาเข้างาน (Check-in)</StandardTh>
                <StandardTh>เวลาออกงาน (Check-out)</StandardTh>
                <StandardTh>เวลาทำงาน</StandardTh>
                <StandardTh align="right">โอที (OT)</StandardTh>
              </StandardHeaderRow>
            </StandardThead>
            <StandardTbody>
              {filteredRows.length === 0 ? (
                <StandardTableEmpty
                  colSpan={6}
                  icon={<Users size={20} />}
                  title="ไม่พบข้อมูลพนักงานตามเงื่อนไขที่เลือก"
                  description="ลองล้างคำค้นหา หรือเปลี่ยนตัวกรองสถานะเพื่อดูรายชื่อพนักงานทั้งหมดในสาขา"
                />
              ) : (
                filteredRows.map(({ emp, shift, checkIn, checkOut, otMinutes, isLiveOt, workDurationDisplay, statusGroup }) => (
                  <StandardTr key={emp.name}>
                    <StandardTd>
                      <div className="font-bold text-[#2D4A49]">{emp.name}</div>
                      <div className="text-[10.5px] text-[#6B8F8E]">
                        {emp.role} · กะ {shift.shiftStartTime}–{shift.shiftEndTime} น.{' '}
                        <span className="text-[#5A8A88]">
                          ({shift.isCustom ? 'เฉพาะคน' : 'สาขา'})
                        </span>
                      </div>
                    </StandardTd>

                    <StandardTd>
                      {shift.ignored ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          ไม่ต้อง Monitor (Ignore)
                        </span>
                      ) : statusGroup === 'not_scanned' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-slate-300" />
                          ยังไม่สแกนเข้างาน
                        </span>
                      ) : statusGroup === 'working' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          กำลังปฏิบัติงาน
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A8A88]">
                          <span className="w-2 h-2 rounded-full bg-[#5A8A88]" />
                          ออกงานแล้ว
                        </span>
                      )}
                    </StandardTd>

                    <StandardTd>
                      {checkIn ? (
                        <div>
                          <div className="font-mono tabular-nums font-bold text-[#2D4A49]">
                            {checkIn.timeDisplay}
                          </div>
                          <div className="text-[10.5px] mt-0.5">
                            <span
                              className={`font-semibold ${
                                checkIn.status === 'late' ? 'text-amber-700' : 'text-emerald-700'
                              }`}
                            >
                              {getStatusLabelTH(checkIn.status)}
                            </span>
                            <span className="text-[#6B8F8E]">
                              {' '}· {checkIn.mode === 'auto' ? 'Auto' : 'Manual'} · {formatDistanceMeters(checkIn.distanceMeters)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </StandardTd>

                    <StandardTd>
                      {checkOut ? (
                        <div>
                          <div className="font-mono tabular-nums font-bold text-[#2D4A49]">
                            {checkOut.timeDisplay}
                          </div>
                          <div className="text-[10.5px] mt-0.5">
                            <span
                              className={`font-semibold ${
                                checkOut.status === 'early_out' ? 'text-amber-700' : 'text-emerald-700'
                              }`}
                            >
                              {getStatusLabelTH(checkOut.status)}
                            </span>
                            <span className="text-[#6B8F8E]">
                              {' '}· {checkOut.mode === 'auto' ? 'Auto' : 'Manual'} · {formatDistanceMeters(checkOut.distanceMeters)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {checkIn ? 'รอออกงาน' : '—'}
                        </span>
                      )}
                    </StandardTd>

                    <StandardTd>
                      <div className="font-mono tabular-nums font-semibold text-[#2D4A49]">
                        {workDurationDisplay}
                      </div>
                      {statusGroup === 'working' && (
                        <div className="text-[10px] text-[#6B8F8E]">กำลังนับเวลา</div>
                      )}
                    </StandardTd>

                    <StandardTd align="right">
                      {!checkIn ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : shift.otStepMinutes <= 0 ? (
                        <div>
                          <span className="text-xs text-slate-400">ไม่คิดโอที</span>
                        </div>
                      ) : (
                        <div>
                          <div
                            className={`font-mono tabular-nums font-bold ${
                              otMinutes > 0 ? 'text-emerald-700' : 'text-[#6B8F8E]'
                            }`}
                          >
                            {otMinutes > 0 ? `+${formatOtDuration(otMinutes)}` : '0 นาที'}
                          </div>
                          <div className="text-[10px] text-[#6B8F8E]">
                            {isLiveOt ? 'สะสมขณะนี้ · ' : ''}ทุก {shift.otStepMinutes} น. (หลัง {shift.shiftEndTime})
                          </div>
                        </div>
                      )}
                    </StandardTd>
                  </StandardTr>
                ))
              )}
            </StandardTbody>
          </StandardTable>
        </StandardTableCard>
      </div>
    </div>
  );
};

export default AttendanceDashboard;
