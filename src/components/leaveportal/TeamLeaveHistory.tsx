import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Calendar as CalendarIcon,
  CheckCircle2,
  ClipboardList,
  Clock,
  Plus,
  RotateCcw,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sendDiscordNotification } from '../../lib/discordNotify';
import {
  LeaveRecord,
  encodeCancelledDescription,
  mapSupabaseLeaveRow,
  normalizeLocalLeaveRecord,
} from '../LeaveRequestModal';
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
  const [cancelTarget, setCancelTarget] = useState<LeaveRecord | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);
  const exportAreaRef = useRef<HTMLDivElement>(null);

  const selectedBranch = user?.branch || 'Rayong';

  const canApproveLeave = useMemo(() => {
    if (isReadOnly) return false;
    const role = String(user?.role || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    return (
      role === 'admin' ||
      role === 'owner' ||
      role === 'co founder' ||
      role === 'cofounder' ||
      role === 'branch manager' ||
      role === 'branchmanager'
    );
  }, [user?.role, isReadOnly]);

  const canCancelRecord = (item: LeaveRecord) => {
    if (isReadOnly || item.status !== 'Approved') return false;
    const isOwn =
      !!user?.name &&
      !!item.userName &&
      item.userName.trim().toLowerCase() === user.name.trim().toLowerCase();
    return canApproveLeave || isOwn;
  };

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
              records = parsed.map(normalizeLocalLeaveRecord);
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
            const fetchedSupabase: LeaveRecord[] = data.map((item: any) =>
              mapSupabaseLeaveRow(item, 'Admin (ผู้ดูแลระบบ)', 'Staff')
            );

            const map = new Map<string, LeaveRecord>();
            records.forEach((r) => map.set(r.id, normalizeLocalLeaveRecord(r)));
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
        (r.manager || '').toLowerCase().includes(q) ||
        (r.cancelReason || '').toLowerCase().includes(q) ||
        (r.cancelledBy || '').toLowerCase().includes(q);

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
    let cancelledCount = 0;
    let totalDays = 0;
    let approvedDays = 0;
    let cancelledDays = 0;

    filteredRecords.forEach((r) => {
      const days = Number(r.totalDays || 0);
      const safeDays = Number.isFinite(days) && days > 0 ? days : 0;
      totalDays += safeDays;
      if (r.status === 'Approved') {
        approvedCount += 1;
        approvedDays += safeDays;
      } else if (r.status === 'Rejected') {
        rejectedCount += 1;
      } else if (r.status === 'Cancelled') {
        cancelledCount += 1;
        cancelledDays += safeDays;
      } else {
        pendingCount += 1;
      }
    });

    return {
      totalCount: filteredRecords.length,
      approvedCount,
      pendingCount,
      rejectedCount,
      cancelledCount,
      totalDays,
      approvedDays,
      cancelledDays,
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

  const handleOpenCancelModal = (record: LeaveRecord) => {
    if (!canCancelRecord(record)) return;
    setCancelTarget(record);
    setCancelReasonInput('');
    setCancelError(null);
  };

  const handleCloseCancelModal = () => {
    if (isCancelling) return;
    setCancelTarget(null);
    setCancelReasonInput('');
    setCancelError(null);
  };

  const handleConfirmCancel = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cancelTarget || isCancelling) return;

    const reason = cancelReasonInput.trim();
    if (!reason) {
      setCancelError('กรุณาระบุเหตุผลในการยกเลิกคำขอลา');
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    const now = new Date();
    const cancelledAt = `${now.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    })} ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
    const cancelledBy = user?.name || 'Admin';
    const nowIso = now.toISOString();

    try {
      if (supabase) {
        const { error: primaryErr } = await supabase
          .from('leave_requests')
          .update({
            status: 'Cancelled',
            cancel_reason: reason,
            cancelled_by: cancelledBy,
            cancelled_at: cancelledAt,
            updated_at: nowIso,
          })
          .eq('id', cancelTarget.id);

        if (primaryErr) {
          const msg = String(primaryErr.message || '').toLowerCase();
          const code = String((primaryErr as any).code || '');
          const isMissingColumn =
            code === '42703' ||
            code === 'PGRST204' ||
            msg.includes('cancel_reason') ||
            msg.includes('cancelled_by') ||
            msg.includes('cancelled_at') ||
            msg.includes('schema cache') ||
            msg.includes('column');

          if (isMissingColumn) {
            const fallbackDescription = encodeCancelledDescription(
              cancelTarget.description || '',
              reason,
              cancelledBy,
              cancelledAt
            );
            const { error: fallbackErr } = await supabase
              .from('leave_requests')
              .update({
                status: 'Cancelled',
                description: fallbackDescription,
                updated_at: nowIso,
              })
              .eq('id', cancelTarget.id);

            if (fallbackErr) {
              throw new Error(fallbackErr.message || 'ไม่สามารถบันทึกการยกเลิกบน Supabase ได้');
            }
          } else {
            throw new Error(primaryErr.message || 'ไม่สามารถบันทึกการยกเลิกบน Supabase ได้');
          }
        }
      }

      const applyCancelToRecord = (r: LeaveRecord): LeaveRecord =>
        r.id === cancelTarget.id
          ? {
              ...r,
              status: 'Cancelled',
              cancelReason: reason,
              cancelledBy,
              cancelledAt,
            }
          : r;

      const updatedRecords = leaveRecords.map(applyCancelToRecord);
      setLeaveRecords(updatedRecords);

      if (typeof window !== 'undefined') {
        try {
          const existingRaw = localStorage.getItem('crenn_leave_requests');
          const existingList: LeaveRecord[] = existingRaw
            ? (JSON.parse(existingRaw) as any[]).map(normalizeLocalLeaveRecord)
            : [];
          const mergedMap = new Map<string, LeaveRecord>();
          existingList.forEach((r) => {
            if (r && r.id) mergedMap.set(r.id, applyCancelToRecord(r));
          });
          updatedRecords.forEach((r) => {
            if (r && r.id) mergedMap.set(r.id, r);
          });
          localStorage.setItem(
            'crenn_leave_requests',
            JSON.stringify(Array.from(mergedMap.values()))
          );
        } catch (storageErr) {
          console.error('LocalStorage cancel update error:', storageErr);
        }
      }

      sendDiscordNotification(
        `🚫 **[ยกเลิกคำขอลาที่อนุมัติแล้ว - คืนสิทธิ์วันลา]**\n` +
          `👤 พนักงาน: ${cancelTarget.userName || '-'}\n` +
          `🏷️ ประเภท: ${cancelTarget.leaveTypeName || cancelTarget.leaveType}\n` +
          `📅 วันที่: ${cancelTarget.fromDate} ถึง ${cancelTarget.toDate} (${cancelTarget.totalDays} วัน)\n` +
          `🔄 คืนสิทธิ์วันลา: +${cancelTarget.totalDays} วัน\n` +
          `📝 เหตุผลที่ยกเลิก: ${reason}\n` +
          `✍️ ยกเลิกโดย: ${cancelledBy}`,
        'notifyOnLeaveApproval'
      );

      const refundedDays = Number(cancelTarget.totalDays || 1);
      const targetName = cancelTarget.userName || 'พนักงาน';
      const targetTypeName = cancelTarget.leaveTypeName || cancelTarget.leaveType;
      setCancelSuccessMsg(
        `ยกเลิกรายการลาของ ${targetName} เรียบร้อยแล้ว และคืนสิทธิ์ "${targetTypeName}" จำนวน ${refundedDays} วันเรียบร้อย`
      );
      setCancelTarget(null);
      setCancelReasonInput('');
      setCancelError(null);
    } catch (err: any) {
      setCancelError(err?.message || 'เกิดข้อผิดพลาดในการยกเลิกคำขอลา');
    } finally {
      setIsCancelling(false);
    }
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
              : item.status === 'Cancelled'
                ? 'ยกเลิกแล้ว (Cancelled)'
                : 'รออนุมัติ',
        เหตุผลที่ยกเลิก: item.cancelReason || '-',
        ยกเลิกโดย: item.cancelledBy || '-',
        วันที่ยกเลิก: item.cancelledAt || '-',
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

      {cancelSuccessMsg && (
        <div
          data-export-ignore="true"
          className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 size={17} className="text-emerald-600 shrink-0" />
            <span>{cancelSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setCancelSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 text-xs font-bold shrink-0 cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* Summary Strip (5 Single-Elevation Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 md:gap-3">
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

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-700">ยกเลิกแล้ว (Cancelled)</span>
            <Ban size={15} className="text-slate-500 shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-700 tabular-nums leading-none">
              {summary.cancelledCount}
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-[#6B8F8E]">รายการ</span>
          </div>
          <p className="text-[10px] text-emerald-700/90 font-medium mt-1.5 tabular-nums">
            คืนสิทธิ์วันลาแล้ว {summary.cancelledDays} วัน
          </p>
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
              <option value="Cancelled">ยกเลิกแล้ว (Cancelled)</option>
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
                <StandardTh align="center" data-export-ignore="true">
                  จัดการ
                </StandardTh>
              </StandardHeaderRow>
            </StandardThead>

            <StandardTbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <StandardTr key={`skeleton-${idx}`}>
                    {Array.from({ length: 10 }).map((__, colIdx) => (
                      <StandardTd key={colIdx}>
                        <div className="h-4 bg-[#F0F5F4] rounded animate-pulse" />
                      </StandardTd>
                    ))}
                  </StandardTr>
                ))
              ) : filteredRecords.length === 0 ? (
                <StandardTableEmpty
                  colSpan={10}
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
                    <StandardTd className="text-slate-600 max-w-xs" title={item.description}>
                      <div className="truncate">{item.description || '-'}</div>
                      {item.status === 'Cancelled' && (
                        <div className="mt-1 p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] space-y-0.5 whitespace-normal">
                          <div className="font-semibold text-rose-700 break-words">
                            เหตุผลที่ยกเลิก: {item.cancelReason || '-'}
                          </div>
                          <div className="text-slate-500">
                            Cancel โดย: <span className="font-bold text-slate-700">{item.cancelledBy || 'Admin'}</span>
                            {item.cancelledAt ? ` · ${item.cancelledAt}` : ''}
                          </div>
                        </div>
                      )}
                    </StandardTd>
                    <StandardTd className="text-[#6B8F8E] whitespace-nowrap">
                      {item.manager || '-'}
                    </StandardTd>
                    <StandardTd align="center" className="whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${
                            item.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'Rejected'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : item.status === 'Cancelled'
                                  ? 'bg-slate-100 text-slate-700 border border-slate-300'
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
                          ) : item.status === 'Cancelled' ? (
                            <>
                              <Ban size={11} />
                              <span>ยกเลิกแล้ว (Cancelled)</span>
                            </>
                          ) : (
                            <>
                              <Clock size={11} />
                              <span>รออนุมัติ</span>
                            </>
                          )}
                        </span>
                        {item.status === 'Cancelled' && (
                          <span className="text-[9.5px] text-slate-500 font-medium">
                            โดย {item.cancelledBy || 'Admin'} · คืนสิทธิ์ {item.totalDays} วัน
                          </span>
                        )}
                      </div>
                    </StandardTd>
                    <StandardTd align="center" className="whitespace-nowrap" data-export-ignore="true">
                      {item.status === 'Approved' && canCancelRecord(item) ? (
                        <button
                          type="button"
                          onClick={() => handleOpenCancelModal(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-colors cursor-pointer"
                          title="ยกเลิกคำขอลาที่อนุมัติแล้วและคืนสิทธิ์วันลา"
                        >
                          <Ban size={12} />
                          <span>Cancel</span>
                        </button>
                      ) : item.status === 'Cancelled' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                          คืนสิทธิ์แล้ว
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[11px]">-</span>
                      )}
                    </StandardTd>
                  </StandardTr>
                ))
              )}
            </StandardTbody>
          </StandardTable>
        </StandardTableCard>
      </div>

      {/* Cancel Approved Leave Modal */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={handleCloseCancelModal}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-[#D4E4E3] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#2D4A49] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-rose-500/20 text-rose-200 border border-rose-400/30 flex items-center justify-center shrink-0">
                  <Ban size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold leading-tight truncate">
                    ยกเลิกคำขอลา (Cancel Leave)
                  </h3>
                  <p className="text-[11px] text-[#A8BCBB] truncate mt-0.5">
                    ยกเลิกรายการที่อนุมัติแล้วและคืนสิทธิ์วันลาให้พนักงาน
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCancelModal}
                disabled={isCancelling}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                title="ปิดหน้าต่าง"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="p-5 space-y-4">
              <div className="bg-[#F8FCFC] border border-[#D4E4E3] rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#2D4A49]">{cancelTarget.userName}</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#E8F3F2] text-[#5A8A88] text-[10px] font-semibold">
                    {cancelTarget.userBranch}
                  </span>
                </div>
                <div className="text-slate-700 font-medium">{cancelTarget.leaveTypeName}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-[#D4E4E3]/60">
                  <span>
                    📅 {cancelTarget.fromDate} ถึง {cancelTarget.toDate}
                  </span>
                  <span className="font-bold text-[#5A8A88] tabular-nums">
                    {cancelTarget.totalDays} วัน
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium leading-relaxed">
                เมื่อยืนยันการ Cancel ระบบจะเปลี่ยนสถานะรายการนี้เป็น{' '}
                <span className="font-bold">ยกเลิกแล้ว (Cancelled)</span> และ{' '}
                <span className="font-bold">
                  คืนสิทธิ์ {cancelTarget.leaveTypeName} จำนวน {cancelTarget.totalDays} วัน
                </span>{' '}
                กลับคืนให้ {cancelTarget.userName} ทันที
              </div>

              {cancelError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-500 shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#2D4A49] mb-1.5">
                  เหตุผลในการยกเลิก (Cancel Reason) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={cancelReasonInput}
                  onChange={(e) => {
                    setCancelReasonInput(e.target.value);
                    if (cancelError) setCancelError(null);
                  }}
                  placeholder="ระบุเหตุผลในการ Cancel เช่น พนักงานกลับมาทำงานตามปกติ, เลื่อนวันลา, ลงวันลาผิด..."
                  className="w-full bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/20 placeholder:text-slate-400 resize-none"
                  required
                  autoFocus
                />
                <p className="text-[10px] text-[#6B8F8E] mt-1.5">
                  ผู้ดำเนินการยกเลิก: <span className="font-bold text-[#2D4A49]">{user?.name || 'Admin'}</span>
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#D4E4E3]">
                <button
                  type="button"
                  onClick={handleCloseCancelModal}
                  disabled={isCancelling}
                  className="h-[34px] px-3.5 rounded-[8px] text-xs font-medium text-[#6B8F8E] bg-white hover:bg-[#F0F5F4] border border-[#D4E4E3] transition-colors cursor-pointer disabled:opacity-50"
                >
                  ปิด
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="h-[34px] px-4 rounded-[8px] text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Ban size={13} />
                  <span>{isCancelling ? 'กำลังยกเลิก...' : 'ยืนยัน Cancel และคืนสิทธิ์'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamLeaveHistory;
