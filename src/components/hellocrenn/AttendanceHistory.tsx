import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  History,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AttendanceRecord, BranchGeofenceConfig, OtMultiplier } from '../../types/hellocrenn';
import {
  formatDistanceMeters,
  formatOtDuration,
  formatOtHours,
  getOtTypeLabel,
  getStatusLabelTH,
  normalizeOtMultiplier,
  resolveEmployeeShift,
  summarizeOtByMultiplier,
} from '../../utils/gpsUtils';
import {
  PageHeaderBanner,
  DateRangeFilter,
  StandardDropdown,
  ExportButton,
  exportRowsToXlsx,
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
  normalizeDateRange,
  formatThaiNumericDate,
} from '../ui';

interface AttendanceHistoryProps {
  records: AttendanceRecord[];
  currentBranch: string;
  geofenceConfig?: BranchGeofenceConfig;
}

type RangeId = 'today' | '7d' | '30d' | 'custom';

const getOtBadgeClass = (multiplier: OtMultiplier): string => {
  if (multiplier === 3) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (multiplier === 2) return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-[#E8F3F2] text-[#2D4A49] border-[#D4E4E3]';
};

export const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({
  records,
  currentBranch,
  geofenceConfig,
}) => {
  const getDaysAgoStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return toLocalDateStr(d);
  };

  const todayStr = toLocalDateStr();
  const [activeRange, setActiveRange] = useState<RangeId>('30d');
  const [startDate, setStartDate] = useState<string>(getDaysAgoStr(30));
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [showStaffOtBreakdown, setShowStaffOtBreakdown] = useState<boolean>(true);
  const exportAreaRef = useRef<HTMLDivElement>(null);

  const handleRangeChange = (rangeId: RangeId) => {
    setActiveRange(rangeId);
    const today = toLocalDateStr();
    if (rangeId === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (rangeId === '7d') {
      setStartDate(getDaysAgoStr(7));
      setEndDate(today);
    } else if (rangeId === '30d') {
      setStartDate(getDaysAgoStr(30));
      setEndDate(today);
    }
  };

  const handleDateChange = (s: string, e: string) => {
    const changedField = s !== startDate ? 'start' : 'end';
    const norm = normalizeDateRange(s, e, changedField);
    setStartDate(norm.startDate);
    setEndDate(norm.endDate);
  };

  const resolveRecordOtMultiplier = useCallback(
    (rec: AttendanceRecord): OtMultiplier => {
      if (rec.otMultiplier !== undefined && rec.otMultiplier !== null) {
        return normalizeOtMultiplier(rec.otMultiplier);
      }
      if (geofenceConfig) {
        const dt = new Date(rec.recordedAt);
        const validDate = !Number.isNaN(dt.getTime()) ? dt : new Date();
        return resolveEmployeeShift(geofenceConfig, rec.userName, validDate).otMultiplier;
      }
      return 1.5;
    },
    [geofenceConfig]
  );

  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => r.branch === currentBranch)
      .filter((r) => r.date >= startDate && r.date <= endDate)
      .filter((r) => (typeFilter === 'ALL' ? true : r.type === typeFilter))
      .filter((r) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.trim().toLowerCase();
        return (
          r.userName.toLowerCase().includes(q) ||
          r.userRole.toLowerCase().includes(q) ||
          (r.shiftName || '').toLowerCase().includes(q) ||
          (r.note || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }, [records, currentBranch, startDate, endDate, typeFilter, searchTerm]);

  const summary = useMemo(() => {
    const checkIns = filteredRecords.filter((r) => r.type === 'check_in');
    const onTime = checkIns.filter((r) => r.status === 'on_time').length;
    const late = checkIns.filter((r) => r.status === 'late').length;
    const autoCount = filteredRecords.filter((r) => r.mode === 'auto').length;
    return {
      total: filteredRecords.length,
      onTime,
      late,
      autoCount,
    };
  }, [filteredRecords]);

  const otRecords = useMemo(
    () =>
      filteredRecords.filter(
        (r) => r.type === 'check_out' && (r.otMinutes ?? 0) > 0
      ),
    [filteredRecords]
  );

  const otSummary = useMemo(
    () =>
      summarizeOtByMultiplier(
        otRecords.map((r) => ({
          otMinutes: r.otMinutes ?? 0,
          otMultiplier: resolveRecordOtMultiplier(r),
        }))
      ),
    [otRecords, resolveRecordOtMultiplier]
  );

  const employeeOtBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        userName: string;
        userRole: string;
        minutes15: number;
        minutes2: number;
        minutes3: number;
        totalMinutes: number;
        otDays: number;
      }
    >();

    otRecords.forEach((rec) => {
      const mins = rec.otMinutes ?? 0;
      if (mins <= 0) return;
      const key = rec.userName.trim().toLowerCase();
      const mult = resolveRecordOtMultiplier(rec);
      const existing = map.get(key) || {
        userName: rec.userName,
        userRole: rec.userRole,
        minutes15: 0,
        minutes2: 0,
        minutes3: 0,
        totalMinutes: 0,
        otDays: 0,
      };
      if (mult === 2) existing.minutes2 += mins;
      else if (mult === 3) existing.minutes3 += mins;
      else existing.minutes15 += mins;
      existing.totalMinutes += mins;
      existing.otDays += 1;
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [otRecords, resolveRecordOtMultiplier]);

  const typeOptions = [
    { value: 'ALL', label: 'ทุกประเภท', count: records.filter((r) => r.branch === currentBranch).length },
    { value: 'check_in', label: 'เข้างาน (Check-in)' },
    { value: 'check_out', label: 'ออกงาน (Check-out)' },
  ];

  const handleExportExcel = () => {
    const rows = filteredRecords.map((r) => {
      const hasOt = r.type === 'check_out' && (r.otMinutes ?? 0) > 0;
      const otMult = hasOt ? resolveRecordOtMultiplier(r) : null;
      return {
        วันที่: formatThaiNumericDate(r.date),
        เวลา: r.timeDisplay,
        สาขา: r.branch,
        พนักงาน: r.userName,
        ตำแหน่ง: r.userRole,
        กะงาน: r.shiftName || '-',
        ประเภท: r.type === 'check_in' ? 'เข้างาน' : 'ออกงาน',
        วิธีสแกน: r.mode === 'auto' ? 'Auto GPS' : 'Manual',
        สถานะ: getStatusLabelTH(r.status),
        'ชนิด OT': otMult ? getOtTypeLabel(otMult) : '-',
        'OT (ชั่วโมง)': r.type === 'check_out' ? Number(((r.otMinutes ?? 0) / 60).toFixed(2)) : 0,
        'OT (นาที)': r.type === 'check_out' ? (r.otMinutes ?? 0) : 0,
        'ระยะห่าง (ม.)': r.distanceMeters,
        'ความคลาดเคลื่อน GPS (ม.)': r.accuracyMeters,
        พิกัด: `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}`,
        หมายเหตุ: r.note || '',
      };
    });
    exportRowsToXlsx({
      rows,
      fileName: `Hello_Crenn_Attendance_${currentBranch}_${startDate}_to_${endDate}`,
      sheetName: 'Attendance',
    });
  };

  return (
    <div ref={exportAreaRef} className="space-y-4">
      <PageHeaderBanner
        variant="sub"
        icon={<History size={18} />}
        title="ประวัติเวลาเข้า-ออกงาน (Attendance History)"
        branchLabel={`สาขา: ${currentBranch}`}
        subtitle="ตรวจสอบบันทึกเวลาเข้า-ออกงานและสรุปชั่วโมง OT แยกตามชนิด (1.5 เท่า / 2 เท่า / 3 เท่า) พร้อมส่งออก Excel / .png / PDF"
        actions={
          <ExportButton
            disabled={filteredRecords.length === 0}
            onExportExcel={handleExportExcel}
            pngConfig={{
              targetRef: exportAreaRef,
              fileName: `Hello_Crenn_Attendance_${currentBranch}_${startDate}_to_${endDate}`,
              backgroundColor: '#F0F5F4',
            }}
            onExportPrint={() => window.print()}
          />
        }
        toolbar={
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 w-full">
            <DateRangeFilter
              options={[
                { id: 'today', label: 'วันนี้' },
                { id: '7d', label: '7 วัน' },
                { id: '30d', label: '30 วัน' },
                { id: 'custom', label: 'กำหนดเอง' },
              ]}
              activeRange={activeRange}
              onRangeChange={handleRangeChange}
              customRangeId="custom"
              startDate={startDate}
              endDate={endDate}
              onDateChange={handleDateChange}
              rangeSummary={`${formatThaiNumericDate(startDate)} – ${formatThaiNumericDate(endDate)}`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[190px] flex-1 sm:flex-initial">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B8F8E] pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาชื่อพนักงาน, ตำแหน่ง หรือกะ..."
                  className="w-full h-[32px] pl-8 pr-3 rounded-[8px] bg-[#F8FCFC] border border-[#D4E4E3] text-[#2D4A49] text-[11px] outline-none focus:border-[#5A8A88]"
                />
              </div>
              <StandardDropdown
                options={typeOptions}
                value={typeFilter}
                onChange={setTypeFilter}
                leadingIcon={<Filter size={12} />}
                align="right"
                ariaLabel="กรองประเภทการลงเวลา"
              />
            </div>
          </div>
        }
      />

      {/* Compact Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#D4E4E3] p-3.5">
          <span className="text-[11px] text-[#6B8F8E] block">รายการในช่วงที่เลือก</span>
          <span className="text-xl font-bold text-[#2D4A49] tabular-nums font-mono mt-1 block">
            {summary.total}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-[#D4E4E3] p-3.5">
          <span className="text-[11px] text-[#6B8F8E] block">เข้างานตรงเวลา</span>
          <span className="text-xl font-bold text-emerald-700 tabular-nums font-mono mt-1 block">
            {summary.onTime}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-[#D4E4E3] p-3.5">
          <span className="text-[11px] text-[#6B8F8E] block">มาสาย</span>
          <span className="text-xl font-bold text-amber-700 tabular-nums font-mono mt-1 block">
            {summary.late}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-[#D4E4E3] p-3.5">
          <span className="text-[11px] text-[#6B8F8E] block">สแกนแบบ Auto GPS</span>
          <span className="text-xl font-bold text-[#5A8A88] tabular-nums font-mono mt-1 block">
            {summary.autoCount}
          </span>
        </div>
      </div>

      {/* Overtime Summary by Multiplier (1.5x / 2x / 3x) */}
      <section className="bg-white rounded-2xl border border-[#D4E4E3] p-4 shadow-[0_2px_8px_rgba(90,138,136,0.05)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Timer size={15} className="text-[#5A8A88]" />
            <h3 className="text-xs font-bold text-[#2D4A49]">
              สรุปชั่วโมงโอทีแยกตามชนิด (Overtime Summary)
            </h3>
            <span className="text-[11px] text-[#6B8F8E] tabular-nums">
              · รวมทั้งหมด{' '}
              <strong className="text-[#2D4A49] font-mono">
                {formatOtHours(otSummary.totalMinutes)}
              </strong>{' '}
              ({otRecords.length} ครั้ง)
            </span>
          </div>

          {employeeOtBreakdown.length > 0 && (
            <button
              type="button"
              onClick={() => setShowStaffOtBreakdown((prev) => !prev)}
              className="h-[28px] px-2.5 rounded-lg bg-[#F0F5F4] hover:bg-[#E8F3F2] border border-[#D4E4E3] text-[#2D4A49] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Users size={12} className="text-[#5A8A88]" />
              <span>สรุปรายพนักงาน ({employeeOtBreakdown.length} คน)</span>
              {showStaffOtBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {otSummary.orderedTypes.map((bucket) => (
            <div
              key={bucket.multiplier}
              className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between ${getOtBadgeClass(
                bucket.multiplier
              )}`}
            >
              <div>
                <div className="text-xs font-bold">{bucket.label}</div>
                <div className="text-[10.5px] opacity-80 tabular-nums mt-0.5">
                  {bucket.count > 0
                    ? `${bucket.count} รายการ · ${formatOtDuration(bucket.minutes)}`
                    : 'ยังไม่มีรายการในช่วงนี้'}
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-bold font-mono tabular-nums">
                  {formatOtHours(bucket.minutes)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {showStaffOtBreakdown && employeeOtBreakdown.length > 0 && (
          <div className="pt-2 border-t border-[#E8F3F2]">
            <StandardTableCard>
              <StandardTable minWidthClassName="min-w-[700px]">
                <StandardThead>
                  <StandardHeaderRow>
                    <StandardTh>พนักงาน</StandardTh>
                    <StandardTh align="right">OT 1.5 เท่า</StandardTh>
                    <StandardTh align="right">OT 2 เท่า</StandardTh>
                    <StandardTh align="right">OT 3 เท่า</StandardTh>
                    <StandardTh align="right">รวม OT ทั้งหมด</StandardTh>
                    <StandardTh align="right">จำนวนวันมี OT</StandardTh>
                  </StandardHeaderRow>
                </StandardThead>
                <StandardTbody>
                  {employeeOtBreakdown.map((item) => (
                    <StandardTr key={item.userName}>
                      <StandardTd>
                        <span className="font-bold text-[#2D4A49]">{item.userName}</span>
                        {item.userRole && (
                          <span className="text-[10.5px] text-[#6B8F8E] ml-1.5">
                            ({item.userRole})
                          </span>
                        )}
                      </StandardTd>
                      <StandardTd align="right" className="font-mono tabular-nums">
                        {item.minutes15 > 0 ? (
                          <span className="font-semibold text-[#2D4A49]">
                            {formatOtHours(item.minutes15)}
                          </span>
                        ) : (
                          <span className="text-[#A8BCBB]">—</span>
                        )}
                      </StandardTd>
                      <StandardTd align="right" className="font-mono tabular-nums">
                        {item.minutes2 > 0 ? (
                          <span className="font-semibold text-amber-800">
                            {formatOtHours(item.minutes2)}
                          </span>
                        ) : (
                          <span className="text-[#A8BCBB]">—</span>
                        )}
                      </StandardTd>
                      <StandardTd align="right" className="font-mono tabular-nums">
                        {item.minutes3 > 0 ? (
                          <span className="font-semibold text-rose-700">
                            {formatOtHours(item.minutes3)}
                          </span>
                        ) : (
                          <span className="text-[#A8BCBB]">—</span>
                        )}
                      </StandardTd>
                      <StandardTd align="right" className="font-mono tabular-nums font-bold text-emerald-700">
                        {formatOtHours(item.totalMinutes)}
                      </StandardTd>
                      <StandardTd align="right" className="font-mono tabular-nums text-[#6B8F8E]">
                        {item.otDays} ครั้ง
                      </StandardTd>
                    </StandardTr>
                  ))}
                </StandardTbody>
              </StandardTable>
            </StandardTableCard>
          </div>
        )}
      </section>

      <StandardTableCard>
        <StandardTable minWidthClassName="min-w-[960px]">
          <StandardThead>
            <StandardHeaderRow>
              <StandardTh>วันที่</StandardTh>
              <StandardTh>เวลา</StandardTh>
              <StandardTh>พนักงาน / กะงาน</StandardTh>
              <StandardTh>ประเภท</StandardTh>
              <StandardTh>รูปแบบ</StandardTh>
              <StandardTh align="right">ระยะห่าง</StandardTh>
              <StandardTh>พิกัด GPS</StandardTh>
              <StandardTh>สถานะ</StandardTh>
              <StandardTh align="right">OT (ชนิด & ชั่วโมง)</StandardTh>
              <StandardTh>หมายเหตุ</StandardTh>
            </StandardHeaderRow>
          </StandardThead>
          <StandardTbody>
            {filteredRecords.length === 0 ? (
              <StandardTableEmpty
                colSpan={10}
                icon={<Clock size={20} />}
                title="ไม่พบประวัติการลงเวลาในช่วงที่เลือก"
                description="ลองปรับช่วงวันที่หรือคำค้นหาเพื่อดูรายการย้อนหลัง"
              />
            ) : (
              filteredRecords.map((rec) => {
                const hasOt = rec.type === 'check_out' && (rec.otMinutes ?? 0) > 0;
                const otMult = hasOt ? resolveRecordOtMultiplier(rec) : null;
                return (
                  <StandardTr key={rec.id}>
                    <StandardTd className="tabular-nums font-medium">
                      {formatThaiNumericDate(rec.date)}
                    </StandardTd>
                    <StandardTd className="font-mono tabular-nums font-semibold">
                      {rec.timeDisplay}
                    </StandardTd>
                    <StandardTd>
                      <div className="font-semibold text-[#2D4A49]">{rec.userName}</div>
                      <div className="text-[10px] text-[#6B8F8E]">
                        {rec.userRole}
                        {rec.shiftName ? ` · ${rec.shiftName}` : ''}
                      </div>
                    </StandardTd>
                    <StandardTd>
                      <span
                        className={
                          rec.type === 'check_in'
                            ? 'font-semibold text-[#2D4A49]'
                            : 'font-semibold text-[#5A8A88]'
                        }
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
                    <StandardTd className="font-mono tabular-nums text-[10.5px] text-[#6B8F8E]">
                      {rec.latitude.toFixed(5)}, {rec.longitude.toFixed(5)}
                    </StandardTd>
                    <StandardTd nowrap>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap ${
                          rec.status === 'on_time' || rec.status === 'completed'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {rec.status === 'on_time' || rec.status === 'completed' ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <AlertTriangle size={12} />
                        )}
                        {getStatusLabelTH(rec.status)}
                      </span>
                    </StandardTd>
                    <StandardTd align="right" nowrap>
                      {hasOt && otMult ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10.5px] font-bold whitespace-nowrap shrink-0 ${getOtBadgeClass(
                                otMult
                              )}`}
                            >
                              {getOtTypeLabel(otMult)}
                            </span>
                            <span className="font-mono tabular-nums font-bold text-emerald-700 whitespace-nowrap">
                              +{formatOtHours(rec.otMinutes)}
                            </span>
                          </div>
                          <span className="text-[10.5px] text-[#6B8F8E] tabular-nums whitespace-nowrap">
                            {formatOtDuration(rec.otMinutes)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#A8BCBB]">—</span>
                      )}
                    </StandardTd>
                    <StandardTd className="text-[#6B8F8E] max-w-[180px] truncate">
                      {rec.note || '—'}
                    </StandardTd>
                  </StandardTr>
                );
              })
            )}
          </StandardTbody>
        </StandardTable>
      </StandardTableCard>
    </div>
  );
};
