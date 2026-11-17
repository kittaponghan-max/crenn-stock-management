import React, { useState, useMemo } from 'react';
import { History, Search, Filter, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AttendanceRecord } from '../../types/hellocrenn';
import { formatDistanceMeters, getStatusLabelTH } from '../../utils/gpsUtils';
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
}

type RangeId = 'today' | '7d' | '30d' | 'custom';

export const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({
  records,
  currentBranch,
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

  const typeOptions = [
    { value: 'ALL', label: 'ทุกประเภท', count: records.filter((r) => r.branch === currentBranch).length },
    { value: 'check_in', label: 'เข้างาน (Check-in)' },
    { value: 'check_out', label: 'ออกงาน (Check-out)' },
  ];

  const handleExportExcel = () => {
    const rows = filteredRecords.map((r) => ({
      วันที่: formatThaiNumericDate(r.date),
      เวลา: r.timeDisplay,
      สาขา: r.branch,
      พนักงาน: r.userName,
      ตำแหน่ง: r.userRole,
      ประเภท: r.type === 'check_in' ? 'เข้างาน' : 'ออกงาน',
      วิธีสแกน: r.mode === 'auto' ? 'Auto GPS' : 'Manual',
      สถานะ: getStatusLabelTH(r.status),
      'ระยะห่าง (ม.)': r.distanceMeters,
      'ความคลาดเคลื่อน GPS (ม.)': r.accuracyMeters,
      พิกัด: `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}`,
      หมายเหตุ: r.note || '',
    }));
    exportRowsToXlsx({
      rows,
      fileName: `Hello_Crenn_Attendance_${currentBranch}_${startDate}_to_${endDate}`,
      sheetName: 'Attendance',
    });
  };

  return (
    <div className="space-y-4">
      <PageHeaderBanner
        variant="sub"
        icon={<History size={18} />}
        title="ประวัติเวลาเข้า-ออกงาน (Attendance History)"
        branchLabel={`สาขา: ${currentBranch}`}
        subtitle="ตรวจสอบบันทึกเวลาเข้า-ออกงานด้วยพิกัด GPS ย้อนหลัง พร้อมส่งออกเป็นไฟล์ Excel / PDF"
        actions={
          <ExportButton
            disabled={filteredRecords.length === 0}
            onExportExcel={handleExportExcel}
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
                  placeholder="ค้นหาชื่อพนักงาน หรือตำแหน่ง..."
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

      <StandardTableCard>
        <StandardTable>
          <StandardThead>
            <StandardHeaderRow>
              <StandardTh>วันที่</StandardTh>
              <StandardTh>เวลา</StandardTh>
              <StandardTh>พนักงาน</StandardTh>
              <StandardTh>ประเภท</StandardTh>
              <StandardTh>รูปแบบ</StandardTh>
              <StandardTh align="right">ระยะห่าง</StandardTh>
              <StandardTh>พิกัด GPS</StandardTh>
              <StandardTh>สถานะ</StandardTh>
              <StandardTh>หมายเหตุ</StandardTh>
            </StandardHeaderRow>
          </StandardThead>
          <StandardTbody>
            {filteredRecords.length === 0 ? (
              <StandardTableEmpty
                colSpan={9}
                icon={<Clock size={20} />}
                title="ไม่พบประวัติการลงเวลาในช่วงที่เลือก"
                description="ลองปรับช่วงวันที่หรือคำค้นหาเพื่อดูรายการย้อนหลัง"
              />
            ) : (
              filteredRecords.map((rec) => (
                <StandardTr key={rec.id}>
                  <StandardTd className="tabular-nums font-medium">
                    {formatThaiNumericDate(rec.date)}
                  </StandardTd>
                  <StandardTd className="font-mono tabular-nums font-semibold">
                    {rec.timeDisplay}
                  </StandardTd>
                  <StandardTd>
                    <div className="font-semibold text-[#2D4A49]">{rec.userName}</div>
                    <div className="text-[10px] text-[#6B8F8E]">{rec.userRole}</div>
                  </StandardTd>
                  <StandardTd>
                    <span className={rec.type === 'check_in' ? 'font-semibold text-[#2D4A49]' : 'font-semibold text-[#5A8A88]'}>
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
                  <StandardTd>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
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
                  <StandardTd className="text-[#6B8F8E] max-w-[180px] truncate">
                    {rec.note || '—'}
                  </StandardTd>
                </StandardTr>
              ))
            )}
          </StandardTbody>
        </StandardTable>
      </StandardTableCard>
    </div>
  );
};
