import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ClipboardList,
  Clock,
  Plus,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LeaveRecord } from '../LeaveRequestModal';
import {
  ExportButton,
  PageHeaderBanner,
  StandardHeaderRow,
  StandardTable,
  StandardTableCard,
  StandardTableEmpty,
  StandardTbody,
  StandardTd,
  StandardTh,
  StandardThead,
  StandardTr,
} from '../ui';

export interface TeamLeaveHistoryProps {
  user?: any;
  isReadOnly?: boolean;
  onOpenLeaveModal?: () => void;
}

const isBranchMatch = (itemBranch?: string, targetBranch?: string) => {
  if (!targetBranch || targetBranch === 'all' || targetBranch === 'ALL') return true;
  if (!itemBranch) return false;
  const b = itemBranch.toLowerCase();
  const t = targetBranch.toLowerCase();
  if (t === 'rayong' || t.includes('ระยอง')) return b.includes('rayong') || b.includes('ระยอง');
  if (t === 'bangkok' || t.includes('กรุงเทพ')) return b.includes('bangkok') || b.includes('กรุงเทพ');
  return b === t;
};

export const TeamLeaveHistory: React.FC<TeamLeaveHistoryProps> = ({
  user,
  isReadOnly = false,
  onOpenLeaveModal,
}) => {
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const exportAreaRef = useRef<HTMLDivElement>(null);

  const selectedBranch = user?.branch || 'Rayong';

  const currentBranchLabel = useMemo(() => {
    if (selectedBranch === 'Rayong' || selectedBranch.includes('ระยอง')) return 'สาขาระยอง (Rayong)';
    if (selectedBranch === 'Bangkok' || selectedBranch.includes('กรุงเทพ')) return 'สาขากรุงเทพฯ (Bangkok)';
    return selectedBranch || 'ทุกสาขา (All Branches)';
  }, [selectedBranch]);

  useEffect(() => {
    let isMounted = true;

    const fetchLeaveHistory = async () => {
      setLoading(true);
      let records: LeaveRecord[] = [];

      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('crenn_leave_requests');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              records = parsed;
            }
          }
        } catch (e) {
          console.error('LocalStorage leave_requests read error:', e);
        }
      }

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('leave_requests')
            .select('*')
            .order('created_at', { ascending: false });

          if (data && !error && data.length > 0) {
            const normalizeStatus = (val: any): 'Pending' | 'Approved' | 'Rejected' => {
              const s = String(val || '').trim().toLowerCase();
              if (s === 'approved') return 'Approved';
              if (s === 'rejected') return 'Rejected';
              return 'Pending';
            };

            const fetchedSupabase: LeaveRecord[] = data.map((item: any) => ({
              id: item.id || `LEAVE-${Date.now()}`,
              leaveType: item.leave_type || 'vacation',
              leaveTypeName: item.leave_type_name || 'ลาพักร้อน (Annual Leave)',
              fromDate: item.from_date || '',
              toDate: item.to_date || '',
              totalDays: item.total_days ?? 1,
              manager: item.manager || 'Admin (ผู้ดูแลระบบ)',
              status: normalizeStatus(item.status),
              description: item.description || '',
              submittedAt: item.submitted_at || '',
              userName: item.user_name || 'Staff',
              userBranch: item.branch || 'Rayong',
            }));

            const map = new Map<string, LeaveRecord>();
            records.forEach((r) => map.set(r.id, { ...r, status: normalizeStatus(r.status) }));
            fetchedSupabase.forEach((r) => map.set(r.id, r));
            records = Array.from(map.values());
          }
        } catch (err) {
          console.warn('Supabase fetch leave_requests error:', err);
        }
      }

      // Filter out synthetic/mock records identically to LeaveDashboard
      const mockNames = [
        'jane bakery manager',
        'bank coffee specialist',
        'somchai jaidee',
        'nattapong staff',
      ];
      records = records.filter((r) => {
        if (!r || !r.id) return false;
        const idUpper = String(r.id).toUpperCase();
        if (idUpper.startsWith('LEAVE-SAMPLE-') || idUpper.startsWith('LEAVE-REAL-')) {
          return false;
        }
        const lowerName = (r.userName || '').toLowerCase().trim();
        if (mockNames.includes(lowerName)) {
          return false;
        }
        return true;
      });

      // Sort newest leave dates / submissions first
      records.sort((a, b) => {
        const aKey = `${a.fromDate || ''}|${a.submittedAt || ''}`;
        const bKey = `${b.fromDate || ''}|${b.submittedAt || ''}`;
        return bKey.localeCompare(aKey);
      });

      if (isMounted) {
        setLeaveRecords(records);
        setLoading(false);
      }
    };

    fetchLeaveHistory();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const branchRecords = useMemo(
    () => leaveRecords.filter((r) => isBranchMatch(r.userBranch, selectedBranch)),
    [leaveRecords, selectedBranch]
  );

  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>(['2024', '2025', '2026', '2027']);
    branchRecords.forEach((r) => {
      if (r.fromDate && r.fromDate.length >= 4) yearsSet.add(r.fromDate.substring(0, 4));
      if (r.toDate && r.toDate.length >= 4) yearsSet.add(r.toDate.substring(0, 4));
    });
    return Array.from(yearsSet).sort().reverse();
  }, [branchRecords]);

  const availableEmployees = useMemo(() => {
    const names = new Set<string>();
    branchRecords.forEach((r) => {
      const name = (r.userName || '').trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'th'));
  }, [branchRecords]);

  const availableLeaveTypes = useMemo(() => {
    const types = new Set<string>();
    branchRecords.forEach((r) => {
      const label = (r.leaveTypeName || r.leaveType || '').trim();
      if (label) types.add(label);
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b, 'th'));
  }, [branchRecords]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return branchRecords.filter((r) => {
      const matchesSearch =
        !q ||
        (r.userName || '').toLowerCase().includes(q) ||
        (r.leaveTypeName || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.manager || '').toLowerCase().includes(q);

      const matchesYear =
        selectedYear === 'all' ||
        (r.fromDate && r.fromDate.startsWith(selectedYear)) ||
        (r.toDate && r.toDate.startsWith(selectedYear));

      const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;

      const leaveLabel = (r.leaveTypeName || r.leaveType || '').trim();
      const matchesLeaveType = selectedLeaveType === 'all' || leaveLabel === selectedLeaveType;

      const empName = (r.userName || '').trim();
      const matchesEmployee = selectedEmployee === 'all' || empName === selectedEmployee;

      return (
        matchesSearch &&
        matchesYear &&
        matchesStatus &&
        matchesLeaveType &&
        matchesEmployee
      );
    });
  }, [
    branchRecords,
    searchQuery,
    selectedYear,
    selectedStatus,
    selectedLeaveType,
    selectedEmployee,
  ]);

  const summary = useMemo(() => {
    let approvedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    let totalDays = 0;
    let approvedDays = 0;

    filteredRecords.forEach((r) => {
      const days = Number(r.totalDays || 0);
      const safeDays = Number.isFinite(days) && days > 0 ? days : 0;
      totalDays += safeDays;
      if (r.status === 'Approved') {
        approvedCount += 1;
        approvedDays += safeDays;
      } else if (r.status === 'Rejected') {
        rejectedCount += 1;
      } else {
        pendingCount += 1;
      }
    });

    return {
      totalCount: filteredRecords.length,
      approvedCount,
      pendingCount,
      rejectedCount,
      totalDays,
      approvedDays,
    };
  }, [filteredRecords]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedStatus !== 'all' ||
    selectedLeaveType !== 'all' ||
    selectedEmployee !== 'all' ||
    selectedYear !== '2026';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedYear('2026');
    setSelectedStatus('all');
    setSelectedLeaveType('all');
    setSelectedEmployee('all');
  };

  const exportRows = useMemo(
    () =>
      filteredRecords.map((item, idx) => ({
        ลำดับ: idx + 1,
        ชื่อพนักงาน: item.userName || '-',
        สาขา: item.userBranch || '-',
        ประเภทการลา: item.leaveTypeName || item.leaveType || '-',
        ตั้งแต่วันที่: item.fromDate || '-',
        ถึงวันที่: item.toDate || '-',
        จำนวนวัน: Number(item.totalDays || 0),
        เหตุผล: item.description || '-',
        ผู้รับแจ้ง: item.manager || '-',
        สถานะ:
          item.status === 'Approved'
            ? 'อนุมัติแล้ว'
            : item.status === 'Rejected'
              ? 'ไม่อนุมัติ'
              : 'รออนุมัติ',
        วันที่ยื่นคำขอ: item.submittedAt || '-',
      })),
    [filteredRecords]
  );

  return (
    <div ref={exportAreaRef} className="w-full max-w-6xl mx-auto space-y-4 md:space-y-6 pb-20">
      {/* Header Banner */}
      <PageHeaderBanner
        variant="main"
        title="ประวัติการลาทั้งหมดของทีม"
        contextLabel="Team Leave History"
        branchLabel={`📍 ${currentBranchLabel}`}
        subtitle={`แสดงประวัติคำขอลาของพนักงานทุกคนใน${currentBranchLabel} สามารถค้นหา และกรองตามพนักงาน ปี ประเภทการลา หรือสถานะได้`}
        icon={<ClipboardList size={22} />}
        actions={
          <>
            <div className="flex items-center gap-1.5 bg-white border border-[#D4E4E3] rounded-full px-3 py-1.5 shadow-xs hover:border-[#5A8A88] transition-colors">
              <CalendarIcon size={13} className="text-[#5A8A88] shrink-0" />
              <span className="text-[11px] font-semibold text-[#6B8F8E] whitespace-nowrap">ปี:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="text-[11px] font-semibold text-[#2D4A49] bg-transparent focus:outline-none cursor-pointer"
                aria-label="กรองตามปี"
              >
                <option value="all">ทุกปี (All Years)</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr} (พ.ศ. {parseInt(yr, 10) + 543})
                  </option>
                ))}
              </select>
            </div>

            <ExportButton
              disabled={filteredRecords.length === 0}
              excelConfig={{
                rows: exportRows,
                fileName: `team-leave-history-${selectedBranch}-${selectedYear}.xlsx`,
                sheetName: 'Team Leave History',
              }}
              pngConfig={{
                targetRef: exportAreaRef,
                fileName: `team-leave-history-${selectedBranch}-${selectedYear}`,
                backgroundColor: '#F0F5F4',
              }}
            />

            {onOpenLeaveModal && !isReadOnly && (
              <button
                type="button"
                data-export-ignore="true"
                onClick={onOpenLeaveModal}
                className="px-3.5 py-1.5 rounded-full bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] font-semibold shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap active:scale-[0.98]"
              >
                <Plus size={14} className="shrink-0" />
                <span>ทำรายการลาหยุด (Leave Request)</span>
              </button>
            )}
          </>
        }
      />

      {/* Summary Strip (4 Single-Elevation Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3">
        <div className="bg-white border border-[#D4E4E3] rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-[#2D4A49]">คำขอลาทั้งหมด</span>
            <ClipboardList size={15} className="text-[#5A8A88] shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums leading-none">
              {summary.totalCount}
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-[#6B8F8E]">รายการ</span>
          </div>
          <p className="text-[10px] text-[#6B8F8E] mt-1.5 tabular-nums">
            รวมระยะเวลาที่ขอทั้งหมด {summary.totalDays} วัน
          </p>
        </div>

        <div className="bg-white border border-emerald-200/80 rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-emerald-800">อนุมัติแล้ว (Approved)</span>
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-700 tabular-nums leading-none">
              {summary.approvedCount}
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-[#6B8F8E]">รายการ</span>
          </div>
          <p className="text-[10px] text-emerald-700/80 mt-1.5 tabular-nums">
            รวมวันลาที่อนุมัติแล้ว {summary.approvedDays} วัน
          </p>
        </div>

        <div className="bg-white border border-amber-200/80 rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-amber-800">รออนุมัติ (Pending)</span>
            <Clock size={15} className="text-amber-600 shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-extrabold text-amber-700 tabular-nums leading-none">
              {summary.pendingCount}
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-[#6B8F8E]">รายการ</span>
          </div>
          <p className="text-[10px] text-amber-700/80 mt-1.5">คำขอที่รอผู้ดูแลตรวจสอบ</p>
        </div>

        <div className="bg-white border border-rose-200/80 rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-rose-800">ไม่อนุมัติ (Rejected)</span>
            <XCircle size={15} className="text-rose-600 shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-extrabold text-rose-700 tabular-nums leading-none">
              {summary.rejectedCount}
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-[#6B8F8E]">รายการ</span>
          </div>
          <p className="text-[10px] text-rose-700/80 mt-1.5">คำขอที่ไม่ได้รับการอนุมัติ</p>
        </div>
      </div>

      {/* Filter Bar + Table Container */}
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-[#D4E4E3] shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div>
            <h2 className="text-[13px] sm:text-[14px] font-bold text-slate-800 tracking-tight">
              ประวัติการลาทั้งหมดของทีม{' '}
              <span className="text-[11px] sm:text-[12px] text-slate-400 font-medium">
                (All Team Leave Requests History)
              </span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#6B8F8E] mt-0.5 tabular-nums">
              แสดงผล {filteredRecords.length} รายการ จากทั้งหมด {branchRecords.length} รายการใน{currentBranchLabel}
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A8A88]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อพนักงาน, ชนิดการลา, เหตุผล..."
                className="h-[32px] pl-8 pr-3 bg-white border border-[#D4E4E3] rounded-[8px] text-[11px] font-medium text-[#2D4A49] placeholder:text-[#A8BCBB] focus:outline-none focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/15 w-52 sm:w-60 shadow-2xs transition-all"
              />
            </div>

            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="h-[32px] px-2.5 bg-white border border-[#D4E4E3] rounded-[8px] text-[11px] text-[#2D4A49] font-medium focus:outline-none focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/15 cursor-pointer shadow-2xs transition-all"
              title="กรองตามชื่อพนักงาน"
            >
              <option value="all">พนักงานทุกคน</option>
              {availableEmployees.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
            </select>

            <select
              value={selectedLeaveType}
              onChange={(e) => setSelectedLeaveType(e.target.value)}
              className="h-[32px] px-2.5 bg-white border border-[#D4E4E3] rounded-[8px] text-[11px] text-[#2D4A49] font-medium focus:outline-none focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/15 cursor-pointer shadow-2xs transition-all"
              title="กรองตามประเภทการลา"
            >
              <option value="all">ทุกประเภทการลา</option>
              {availableLeaveTypes.map((lt) => (
                <option key={lt} value={lt}>
                  {lt}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-[32px] px-2.5 bg-white border border-[#D4E4E3] rounded-[8px] text-[11px] text-[#2D4A49] font-medium focus:outline-none focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/15 cursor-pointer shadow-2xs transition-all"
              title="กรองตามสถานะ"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="Pending">รออนุมัติ</option>
              <option value="Approved">อนุมัติแล้ว</option>
              <option value="Rejected">ไม่อนุมัติ</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-[32px] px-2.5 bg-[#F0F5F4] hover:bg-[#E8F3F2] border border-[#D4E4E3] rounded-[8px] text-[11px] font-medium text-[#2D4A49] flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                title="ล้างตัวกรองทั้งหมด"
              >
                <RotateCcw size={12} className="text-[#5A8A88]" />
                <span>ล้างตัวกรอง</span>
              </button>
            )}
          </div>
        </div>

        {/* Table View */}
        <StandardTableCard>
          <StandardTable>
            <StandardThead>
              <StandardHeaderRow>
                <StandardTh align="center" className="w-10">
                  #
                </StandardTh>
                <StandardTh>ชื่อพนักงาน</StandardTh>
                <StandardTh>สาขา</StandardTh>
                <StandardTh>ประเภทการลา</StandardTh>
                <StandardTh>ช่วงวันที่ลา (From - To)</StandardTh>
                <StandardTh align="center">จำนวนวัน</StandardTh>
                <StandardTh>เหตุผล (Description)</StandardTh>
                <StandardTh>ผู้รับแจ้ง</StandardTh>
                <StandardTh align="center">สถานะ (Status)</StandardTh>
              </StandardHeaderRow>
            </StandardThead>

            <StandardTbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <StandardTr key={`skeleton-${idx}`}>
                    {Array.from({ length: 9 }).map((__, colIdx) => (
                      <StandardTd key={colIdx}>
                        <div className="h-4 bg-[#F0F5F4] rounded animate-pulse" />
                      </StandardTd>
                    ))}
                  </StandardTr>
                ))
              ) : filteredRecords.length === 0 ? (
                <StandardTableEmpty
                  colSpan={9}
                  title={`ยังไม่มีประวัติการลาในระบบ (${selectedYear === 'all' ? 'ทุกปี' : `ปี ${selectedYear}`})`}
                  description={
                    hasActiveFilters
                      ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา ลองปรับตัวกรองหรือกด "ล้างตัวกรอง"'
                      : `พนักงานใน${currentBranchLabel}ยังไม่มีการยื่นคำขอลา สามารถกดปุ่ม "ทำรายการลาหยุด" เพื่อเริ่มสร้างคำขอจริงได้`
                  }
                  action={
                    hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="px-3 py-1.5 rounded-lg bg-[#E8F3F2] hover:bg-[#D8EAE8] text-[#2D4A49] text-[11px] font-semibold cursor-pointer transition-colors"
                      >
                        ล้างตัวกรองทั้งหมด
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                filteredRecords.map((item, idx) => (
                  <StandardTr key={item.id}>
                    <StandardTd align="center" numeric className="text-[#6B8F8E] font-medium">
                      {idx + 1}
                    </StandardTd>
                    <StandardTd className="font-bold text-[#2D4A49] whitespace-nowrap">
                      {item.userName}
                    </StandardTd>
                    <StandardTd className="text-slate-600 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-[#E8F3F2] text-[#5A8A88] text-[10px] font-semibold">
                        {item.userBranch}
                      </span>
                    </StandardTd>
                    <StandardTd className="whitespace-nowrap font-medium text-slate-700">
                      {item.leaveTypeName}
                    </StandardTd>
                    <StandardTd numeric className="whitespace-nowrap font-medium text-slate-800">
                      {item.fromDate} ถึง {item.toDate}
                    </StandardTd>
                    <StandardTd align="center" numeric className="font-bold text-[#5A8A88] whitespace-nowrap">
                      {item.totalDays} วัน
                    </StandardTd>
                    <StandardTd className="text-slate-600 max-w-xs truncate" title={item.description}>
                      {item.description || '-'}
                    </StandardTd>
                    <StandardTd className="text-[#6B8F8E] whitespace-nowrap">
                      {item.manager || '-'}
                    </StandardTd>
                    <StandardTd align="center" className="whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${
                          item.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.status === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.status === 'Approved' ? (
                          <>
                            <CheckCircle2 size={11} />
                            <span>อนุมัติแล้ว</span>
                          </>
                        ) : item.status === 'Rejected' ? (
                          <>
                            <XCircle size={11} />
                            <span>ไม่อนุมัติ</span>
                          </>
                        ) : (
                          <>
                            <Clock size={11} />
                            <span>รออนุมัติ</span>
                          </>
                        )}
                      </span>
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

export default TeamLeaveHistory;
