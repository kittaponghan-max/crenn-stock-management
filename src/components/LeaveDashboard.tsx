import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  UserCheck, 
  Briefcase, 
  Palmtree, 
  Stethoscope, 
  Baby, 
  FileText, 
  Plus, 
  Building,
  Check,
  X,
  TrendingUp,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LeaveRecord } from './LeaveRequestModal';
import { AppUser } from '../types';
import {
  AnnualLeaveQuotasByYear,
  fetchAnnualLeaveQuotas,
  getEmployeeQuotaForYear,
} from '../utils/leaveQuotas';

export interface LeaveDashboardProps {
  user?: any;
  mode?: 'team' | 'personal';
  onNavigate?: (tab: string) => void;
  onOpenLeaveModal?: () => void;
  isReadOnly?: boolean;
}

interface EmployeeQuotaSummary {
  id: string;
  name: string;
  role: string;
  branch: string;
  avatar: string;
  sickRemaining: number;
  sickTotal: number;
  personalRemaining: number;
  personalTotal: number;
  vacationRemaining: number;
  vacationTotal: number;
  birthdayRemaining: number;
  birthdayTotal: number;
  maternityRemaining: number;
  maternityTotal: number;
  ignored: boolean;
}

export const LeaveDashboard: React.FC<LeaveDashboardProps> = ({
  user,
  mode = 'team',
  onNavigate,
  onOpenLeaveModal,
  isReadOnly = false,
}) => {
  const isPersonalMode = mode === 'personal';

  // Helper to match logged-in user
  const isCurrentUser = (name?: string) => {
    if (!user?.name || !name) return false;
    return name.trim().toLowerCase() === user.name.trim().toLowerCase();
  };
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [staffAccounts, setStaffAccounts] = useState<AppUser[]>([]);
  const [quotasByYear, setQuotasByYear] = useState<AnnualLeaveQuotasByYear>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Fixed strictly to the logged-in account's branch (No branch dropdown selection)
  const selectedBranch = user?.branch || 'Rayong';
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date(2026, 10, 1)); // Default Nov 2026
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  // Helper date calculations
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Fetch Real Staff Accounts, Real Leave Records & Quotas (No Mock-ups)
  const fetchAllLeaveData = async () => {
    setLoading(true);

    // ──────────────────────────────────────────────
    // 1. Fetch Real Staff Accounts from Supabase & LocalStorage
    // ──────────────────────────────────────────────
    let loadedUsers: AppUser[] = [];

    // 1.1 From Supabase app_users table
    if (supabase) {
      try {
        const { data: dbUsers, error: userErr } = await supabase
          .from('app_users')
          .select('*');
        if (dbUsers && !userErr && dbUsers.length > 0) {
          loadedUsers = dbUsers as AppUser[];
        }
      } catch (err) {
        console.warn('Supabase fetch app_users error:', err);
      }
    }

    // 1.2 From LocalStorage keys
    if (typeof window !== 'undefined') {
      const storageKeys = ['app_users', 'cafe-app-users', 'cafe-app-users-Rayong', 'cafe-app-users-Bangkok'];
      for (const key of storageKeys) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((u: any) => {
                if (u && u.name) {
                  const normalizedBranch = u.branch || (key.includes('Bangkok') ? 'Bangkok' : 'Rayong');
                  const alreadyExists = loadedUsers.some(
                    existing => existing.name?.toLowerCase().trim() === u.name?.toLowerCase().trim() &&
                               (existing.branch || '').toLowerCase() === normalizedBranch.toLowerCase()
                  );
                  if (!alreadyExists) {
                    loadedUsers.push({
                      id: u.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                      name: u.name,
                      role: u.role || 'Staff',
                      branch: normalizedBranch,
                      avatar: u.avatar
                    });
                  }
                }
              });
            }
          }
        } catch (e) {
          console.warn('LocalStorage users load error:', e);
        }
      }
    }

    // 1.3 Add active logged-in user if not already in list
    if (user && user.name) {
      const activeUserBranch = user.branch || 'Rayong';
      const exists = loadedUsers.some(
        u => u.name?.toLowerCase().trim() === user.name?.toLowerCase().trim() &&
             (u.branch || '').toLowerCase() === activeUserBranch.toLowerCase()
      );
      if (!exists) {
        loadedUsers.unshift({
          id: user.id || 'current-user',
          name: user.name,
          role: user.role || 'Admin',
          branch: activeUserBranch,
        });
      }
    }

    // 1.4 Fallback default branch staff if empty (strictly matching system accounts)
    if (loadedUsers.length === 0) {
      loadedUsers = [
        { id: 'usr-ry-1', name: 'Sun', role: 'Admin', branch: 'Rayong' },
        { id: 'usr-ry-2', name: 'Branch Manager', role: 'Branch Manager', branch: 'Rayong' },
        { id: 'usr-ry-3', name: 'Barista', role: 'Barista', branch: 'Rayong' },
        { id: 'usr-bk-1', name: 'Admin', role: 'Admin', branch: 'Bangkok' },
        { id: 'usr-bk-2', name: 'Branch Manager', role: 'Branch Manager', branch: 'Bangkok' },
        { id: 'usr-bk-3', name: 'Barista', role: 'Barista', branch: 'Bangkok' },
      ];
    }

    setStaffAccounts(loadedUsers);

    // ──────────────────────────────────────────────
    // 2. Fetch Real Leave Records (Purge All Mock Data)
    // ──────────────────────────────────────────────
    let records: LeaveRecord[] = [];

    // 2.1 Fetch from LocalStorage
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
        console.error(e);
      }
    }

    // 2.2 Fetch leave_requests from Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('leave_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (data && !error && data.length > 0) {
          const fetchedSupabase: LeaveRecord[] = data.map((item: any) => ({
            id: item.id || `LEAVE-${Date.now()}`,
            leaveType: item.leave_type || 'vacation',
            leaveTypeName: item.leave_type_name || 'ลาพักร้อน (Annual Leave)',
            fromDate: item.from_date || '',
            toDate: item.to_date || '',
            totalDays: item.total_days || 1,
            manager: item.manager || 'ผู้จัดการสาขา',
            status: item.status || 'Pending',
            description: item.description || '',
            submittedAt: item.submitted_at || '',
            userName: item.user_name || 'Staff',
            userBranch: item.branch || 'Rayong',
          }));

          const map = new Map<string, LeaveRecord>();
          records.forEach(r => map.set(r.id, r));
          fetchedSupabase.forEach(r => map.set(r.id, r));
          records = Array.from(map.values());
        }
      } catch (err) {
        console.warn('Supabase fetch notice:', err);
      }
    }

    // 2.3 Strictly PURGE all mock-up / synthetic records
    records = records.filter(r => {
      if (!r || !r.id) return false;
      const idUpper = String(r.id).toUpperCase();
      if (idUpper.startsWith('LEAVE-SAMPLE-') || idUpper.startsWith('LEAVE-REAL-')) {
        return false;
      }
      const lowerName = (r.userName || '').toLowerCase().trim();
      const mockNames = ['jane bakery manager', 'bank coffee specialist', 'somchai jaidee', 'nattapong staff'];
      if (mockNames.includes(lowerName)) {
        return false;
      }
      return true;
    });

    // Write back cleaned real records to LocalStorage to permanently wipe old mock data
    try {
      localStorage.setItem('crenn_leave_requests', JSON.stringify(records));
    } catch (e) {
      console.warn(e);
    }

    // Absolutely NO mock fallback records! If 0 real records, records remains []
    setLeaveRecords(records);

    // ──────────────────────────────────────────────
    // 3. Fetch Configured Employee Annual Leave Quotas
    // ──────────────────────────────────────────────
    try {
      const loadedQuotas = await fetchAnnualLeaveQuotas();
      setQuotasByYear(loadedQuotas);
    } catch (e) {
      console.warn('Error loading employee annual leave quotas:', e);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAllLeaveData();
  }, [user]);

  const activeQuotaYear = useMemo(() => {
    if (selectedYear && selectedYear !== 'all') return selectedYear;
    return String(new Date().getFullYear());
  }, [selectedYear]);

  // Compute Employee Leave Quotas reactively from configured annual quotas & approved leaves
  const employeeQuotas = useMemo<EmployeeQuotaSummary[]>(() => {
    return staffAccounts.map((emp) => {
      const empName = emp.name || 'Staff';
      const empRole = emp.role || 'Staff';
      const empBranch = emp.branch || 'Rayong';
      const empId = emp.id || `emp-${empName}-${empBranch}`;

      const configured = getEmployeeQuotaForYear(quotasByYear, activeQuotaYear, {
        id: emp.id,
        name: empName,
        branch: empBranch,
      });

      const sickTotal = configured.sick;
      const personalTotal = configured.personal;
      const vacationTotal = configured.vacation;
      const birthdayTotal = configured.birthday;
      const maternityTotal = 90;

      let sickUsed = 0;
      let personalUsed = 0;
      let vacationUsed = 0;
      let birthdayUsed = 0;
      let maternityUsed = 0;

      leaveRecords.forEach(r => {
        const matchesEmployee = r.userName?.toLowerCase().trim() === empName.toLowerCase().trim();
        const matchesYear =
          selectedYear === 'all' ||
          (r.fromDate && r.fromDate.startsWith(selectedYear)) ||
          (r.toDate && r.toDate.startsWith(selectedYear));

        if (matchesEmployee && matchesYear && r.status === 'Approved') {
          const type = `${r.leaveType || ''} ${r.leaveTypeName || ''}`.toLowerCase();
          const days = Number(r.totalDays || 1);
          if (type.includes('birthday') || type.includes('วันเกิด')) birthdayUsed += days;
          else if (type.includes('sick') || type.includes('ป่วย')) sickUsed += days;
          else if (type.includes('personal') || type.includes('กิจ')) personalUsed += days;
          else if (type.includes('vacation') || type.includes('พักร้อน') || type.includes('annual')) vacationUsed += days;
          else if (type.includes('maternity') || type.includes('คลอด')) maternityUsed += days;
        }
      });

      return {
        id: empId,
        name: empName,
        role: empRole,
        branch: empBranch,
        avatar: (empName.charAt(0) || 'S').toUpperCase(),
        sickRemaining: Math.max(0, sickTotal - sickUsed),
        sickTotal,
        personalRemaining: Math.max(0, personalTotal - personalUsed),
        personalTotal,
        vacationRemaining: Math.max(0, vacationTotal - vacationUsed),
        vacationTotal,
        birthdayRemaining: Math.max(0, birthdayTotal - birthdayUsed),
        birthdayTotal,
        maternityRemaining: Math.max(0, maternityTotal - maternityUsed),
        maternityTotal,
        ignored: Boolean(configured.ignored),
      };
    });
  }, [staffAccounts, leaveRecords, quotasByYear, activeQuotaYear, selectedYear]);

  // Update status (Approve / Reject)
  const handleUpdateStatus = async (id: string, newStatus: 'Approved' | 'Rejected') => {
    if (isReadOnly) return;
    const updated = leaveRecords.map(r => r.id === id ? { ...r, status: newStatus } : r);
    setLeaveRecords(updated);

    // Save to LocalStorage
    try {
      localStorage.setItem('crenn_leave_requests', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    // Save to Supabase
    if (supabase) {
      try {
        await supabase.from('leave_requests').update({ status: newStatus }).eq('id', id);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  // Available Years for Year Filter
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    ['2024', '2025', '2026', '2027'].forEach(y => yearsSet.add(y));
    leaveRecords.forEach(r => {
      if (r.fromDate && r.fromDate.length >= 4) yearsSet.add(r.fromDate.substring(0, 4));
      if (r.toDate && r.toDate.length >= 4) yearsSet.add(r.toDate.substring(0, 4));
    });
    return Array.from(yearsSet).sort().reverse();
  }, [leaveRecords]);

  // Handle changing Year Filter
  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    if (year !== 'all') {
      const yrNum = parseInt(year, 10);
      if (!isNaN(yrNum)) {
        setSelectedMonth(prev => new Date(yrNum, prev.getMonth(), 1));
      }
    }
  };

  // Branch matching helper
  const isBranchMatch = (itemBranch?: string, targetBranch?: string) => {
    if (!targetBranch || targetBranch === 'all' || targetBranch === 'ALL') return true;
    if (!itemBranch) return false;
    const b = itemBranch.toLowerCase();
    const t = targetBranch.toLowerCase();
    if (t === 'rayong' || t.includes('ระยอง')) return b.includes('rayong') || b.includes('ระยอง');
    if (t === 'bangkok' || t.includes('กรุงเทพ')) return b.includes('bangkok') || b.includes('กรุงเทพ');
    return b === t;
  };

  // Filtered leave records for table and history
  const filteredRecords = useMemo(() => {
    return leaveRecords.filter(r => {
      const matchesSearch = 
        r.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.leaveTypeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesBranch = isBranchMatch(r.userBranch, selectedBranch);
      const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;
      
      const matchesYear = selectedYear === 'all' || 
        (r.fromDate && r.fromDate.startsWith(selectedYear)) || 
        (r.toDate && r.toDate.startsWith(selectedYear));

      const matchesDate = !selectedDateFilter || (r.fromDate <= selectedDateFilter && r.toDate >= selectedDateFilter);

      const matchesScope = !isPersonalMode || isCurrentUser(r.userName);

      return matchesSearch && matchesBranch && matchesStatus && matchesYear && matchesDate && matchesScope;
    });
  }, [leaveRecords, searchQuery, selectedBranch, selectedStatus, selectedYear, selectedDateFilter, isPersonalMode, user?.name]);

  // Statistics for KPI Cards
  const todayLeaves = useMemo(() => {
    return leaveRecords.filter(r => 
      r.fromDate <= todayStr && 
      r.toDate >= todayStr && 
      r.status === 'Approved' &&
      isBranchMatch(r.userBranch, selectedBranch)
    );
  }, [leaveRecords, todayStr, selectedBranch]);

  // Advance Leaves (การลาล่วงหน้าของทีม) - filter by real employees & selectedBranch & selectedYear
  const upcomingLeaves = useMemo(() => {
    return leaveRecords.filter(r => {
      const isFuture = r.fromDate > todayStr && r.status !== 'Rejected';
      if (!isFuture) return false;

      // Filter by branch
      if (!isBranchMatch(r.userBranch, selectedBranch)) return false;

      // Filter by year if selectedYear !== 'all'
      if (selectedYear !== 'all') {
        const yr = r.fromDate?.substring(0, 4);
        if (yr !== selectedYear) return false;
      }

      // Ensure employee matches real accounts created in the branch/system
      const matchesRealEmployee = staffAccounts.length === 0 || staffAccounts.some(s => 
        s.name?.toLowerCase().trim() === r.userName?.toLowerCase().trim()
      );

      return matchesRealEmployee;
    });
  }, [leaveRecords, todayStr, selectedBranch, selectedYear, staffAccounts]);

  const pendingCount = useMemo(() => {
    return leaveRecords.filter(r => 
      r.status === 'Pending' && 
      isBranchMatch(r.userBranch, selectedBranch) &&
      (selectedYear === 'all' || (r.fromDate && r.fromDate.startsWith(selectedYear)))
    ).length;
  }, [leaveRecords, selectedBranch, selectedYear]);

  const totalRequestsCount = useMemo(() => {
    return leaveRecords.filter(r => 
      isBranchMatch(r.userBranch, selectedBranch) &&
      (selectedYear === 'all' || (r.fromDate && r.fromDate.startsWith(selectedYear)))
    ).length;
  }, [leaveRecords, selectedBranch, selectedYear]);

  // Personal leaves statistics for logged-in user
  const myTodayLeaves = useMemo(() => {
    return todayLeaves.filter(r => isCurrentUser(r.userName));
  }, [todayLeaves, user?.name]);

  const myUpcomingLeaves = useMemo(() => {
    return upcomingLeaves.filter(r => isCurrentUser(r.userName));
  }, [upcomingLeaves, user?.name]);

  const myPendingCount = useMemo(() => {
    return leaveRecords.filter(r => 
      r.status === 'Pending' && 
      isCurrentUser(r.userName) &&
      (selectedYear === 'all' || (r.fromDate && r.fromDate.startsWith(selectedYear)))
    ).length;
  }, [leaveRecords, user?.name, selectedYear]);

  const myTotalRequestsCount = useMemo(() => {
    return leaveRecords.filter(r => 
      isCurrentUser(r.userName) &&
      (selectedYear === 'all' || (r.fromDate && r.fromDate.startsWith(selectedYear)))
    ).length;
  }, [leaveRecords, user?.name, selectedYear]);

  // Active view statistics
  const isPersonalActive = isPersonalMode;
  const displayTodayLeaves = isPersonalActive ? myTodayLeaves : todayLeaves;
  const displayUpcomingLeaves = isPersonalActive ? myUpcomingLeaves : upcomingLeaves;
  const displayPendingCount = isPersonalActive ? myPendingCount : pendingCount;
  const displayTotalRequestsCount = isPersonalActive ? myTotalRequestsCount : totalRequestsCount;

  // Check if current logged-in user is marked as Ignore for this year
  const isCurrentUserIgnored = useMemo(() => {
    if (!user?.name) return false;
    return employeeQuotas.some(
      emp => isBranchMatch(emp.branch, selectedBranch) && isCurrentUser(emp.name) && emp.ignored
    );
  }, [employeeQuotas, selectedBranch, user?.name]);

  // Filtered employee quotas strictly for tracked (non-ignored) real accounts of the selected branch
  const filteredEmployeeQuotas = useMemo(() => {
    const list = employeeQuotas.filter(emp => !emp.ignored && isBranchMatch(emp.branch, selectedBranch));
    if (isPersonalMode && user?.name) {
      if (isCurrentUserIgnored) return [];
      const mine = list.filter(emp => isCurrentUser(emp.name));
      return mine.length > 0 ? mine : list.slice(0, 1);
    }
    return list;
  }, [employeeQuotas, selectedBranch, isPersonalMode, user?.name, isCurrentUserIgnored]);

  // Calendar matrix generator for current month
  const calendarDays = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days: Array<{ dayNum: number; dateStr: string; isCurrentMonth: boolean; leaveItems: LeaveRecord[] }> = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ dayNum: 0, dateStr: '', isCurrentMonth: false, leaveItems: [] });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const leavesOnThisDay = leaveRecords.filter(r => 
        r.fromDate <= dateStr && 
        r.toDate >= dateStr && 
        r.status !== 'Rejected' &&
        isBranchMatch(r.userBranch, selectedBranch)
      );
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        leaveItems: leavesOnThisDay,
      });
    }

    return days;
  }, [selectedMonth, leaveRecords, selectedBranch]);

  // Check if current user is admin
  const isAdmin = useMemo(() => {
    const role = String(user?.role || '').toLowerCase();
    return role === 'admin' || role === 'owner' || role === 'co-founder';
  }, [user?.role]);

  // Current branch display label
  const currentBranchLabel = useMemo(() => {
    if (selectedBranch === 'Rayong' || selectedBranch.includes('ระยอง')) return 'สาขาระยอง (Rayong)';
    if (selectedBranch === 'Bangkok' || selectedBranch.includes('กรุงเทพ')) return 'สาขากรุงเทพฯ (Bangkok)';
    return 'ทุกสาขา (All Branches)';
  }, [selectedBranch]);

  const monthYearLabel = selectedMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* ── HEADER BANNER CARD ── */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-xs border border-[#D4E4E3] border-t-4 border-t-[#5A8A88]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Icon + Title + Badges + Subtitle */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center text-2xl font-bold border border-[#D4E4E3] shrink-0 shadow-2xs">
              {isPersonalMode ? '👤' : '📊'}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-[#2D4A49] tracking-tight whitespace-nowrap">
                  {isPersonalMode ? 'Personnel Leave' : 'Leave Dashboard'}
                </h1>
                <span className="text-xs font-bold text-[#5A8A88] bg-[#E8F3F2] px-2.5 py-0.5 rounded-full border border-[#D4E4E3]/70 whitespace-nowrap">
                  {isPersonalMode ? 'ภาพรวมการลาส่วนตัว' : 'ภาพรวมการลาของทีม'}
                </span>
                <span className="text-xs font-bold text-[#2D4A49] bg-[#E8F3F2] px-3 py-1 rounded-full border border-[#D4E4E3] whitespace-nowrap flex items-center gap-1.5 shadow-2xs">
                  <span>📍</span>
                  <span>{currentBranchLabel}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium truncate sm:whitespace-normal">
                {isPersonalMode 
                  ? `ติดตามการลาล่วงหน้า สถิติวันลาคงเหลือ และประวัติการลาส่วนบุคคลของ ${user?.name || 'พนักงาน'} (${currentBranchLabel})`
                  : `ติดตามการลาล่วงหน้า สถิติวันลาคงเหลือของพนักงาน และปฏิทินการลาใน${currentBranchLabel}`
                }
              </p>
            </div>
          </div>

          {/* Right: Year Filter & Action Button */}
          <div className="flex flex-wrap items-center gap-3 shrink-0 self-stretch sm:self-auto justify-end">
            
            {/* Year Filter Tool */}
            <div className="flex items-center gap-1.5 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl px-3 py-2 shadow-2xs hover:border-[#5A8A88] transition-colors">
              <CalendarIcon size={14} className="text-[#5A8A88] shrink-0" />
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">ปี:</span>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="text-xs font-bold text-[#2D4A49] bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="all">ทุกปี (All Years)</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>
                    {yr} (พ.ศ. {parseInt(yr, 10) + 543})
                  </option>
                ))}
              </select>
            </div>

            {/* Leave Request Action Button */}
            {onOpenLeaveModal && !isReadOnly && (
              <button
                type="button"
                onClick={onOpenLeaveModal}
                className="px-4 py-2.5 rounded-xl bg-[#2D4A49] hover:bg-[#203635] text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap active:scale-[0.98]"
              >
                <Plus size={16} className="shrink-0" />
                <span>ทำรายการลาหยุด (Leave Request)</span>
              </button>
            )}

          </div>

        </div>
      </div>

      {/* ── 1. TOP KPI SUMMARY CARDS (Guaranteed Single Row Across Screens) ── */}
      <div className="w-full overflow-x-auto pb-1">
        <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-4 min-w-[620px] lg:min-w-0">
          
          {/* Card 1: On Leave Today / Personal Status Today */}
          <div className="bg-white border border-[#D4E4E3] rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  {isPersonalActive ? 'สถานะการลาวันนี้' : 'พนักงานที่ลาวันนี้'}
                </span>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
                  isPersonalActive 
                    ? (displayTodayLeaves.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')
                    : 'bg-amber-50 text-amber-600'
                }`}>
                  {isPersonalActive ? (displayTodayLeaves.length > 0 ? '🤒' : '✨') : '🤒'}
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-800">
                  {isPersonalActive 
                    ? (displayTodayLeaves.length > 0 ? 'ลาหยุด' : 'ปกติ')
                    : displayTodayLeaves.length
                  }
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  {isPersonalActive ? (displayTodayLeaves.length > 0 ? '' : '(ทำงาน)') : 'คน'}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
                {isPersonalActive
                  ? (displayTodayLeaves.length > 0 ? displayTodayLeaves[0].leaveTypeName : 'คุณปฏิบัติงานตามปกติ')
                  : (displayTodayLeaves.length > 0 ? displayTodayLeaves.map(l => l.userName).join(', ') : 'ไม่มีพนักงานลาในวันนี้')
                }
              </p>
            </div>
            <div className="w-full bg-slate-100 h-1 rounded-full mt-3 overflow-hidden">
              <div 
                className={`h-full rounded-full ${isPersonalActive && displayTodayLeaves.length === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                style={{ width: isPersonalActive ? '100%' : `${Math.min(100, displayTodayLeaves.length * 25)}%` }} 
              />
            </div>
          </div>

          {/* Card 2: Upcoming Leaves */}
          <div className="bg-white border border-[#D4E4E3] rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  {isPersonalActive ? 'การลาล่วงหน้าของคุณ' : 'การลาล่วงหน้า'}
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center shrink-0 font-bold text-sm">
                  🏖️
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-[#5A8A88]">{displayUpcomingLeaves.length}</span>
                <span className="text-xs text-slate-500 font-semibold">รายการ</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
                {displayUpcomingLeaves.length > 0 
                  ? `ลาล่วงหน้าตั้งแต่ ${displayUpcomingLeaves[0].fromDate}` 
                  : (isPersonalActive ? 'คุณไม่มีรายการลาล่วงหน้า' : 'ไม่มีรายการลาล่วงหน้า')
                }
              </p>
            </div>
            <div className="w-full bg-[#E8F3F2] h-1 rounded-full mt-3 overflow-hidden">
              <div className="bg-[#5A8A88] h-full rounded-full" style={{ width: `${Math.min(100, displayUpcomingLeaves.length * 20)}%` }} />
            </div>
          </div>

          {/* Card 3: Pending Approvals */}
          <div className="bg-white border border-[#D4E4E3] rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  {isPersonalActive ? 'คำขอรออนุมัติของคุณ' : 'คำขอรออนุมัติ'}
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 font-bold text-sm">
                  ⏳
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-orange-600">{displayPendingCount}</span>
                <span className="text-xs text-slate-500 font-semibold">คำขอ</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
                {displayPendingCount > 0 
                  ? (isPersonalActive ? 'รอผู้จัดการพิจารณาอนุมัติ' : 'รอผู้จัดการดำเนินการอนุมัติ') 
                  : (isPersonalActive ? 'ไม่มีคำขอที่รออนุมัติ' : 'พิจารณาครบทุกรายการแล้ว')
                }
              </p>
            </div>
            <div className="w-full bg-orange-100 h-1 rounded-full mt-3 overflow-hidden">
              <div className="bg-orange-500 h-full rounded-full" style={{ width: `${Math.min(100, displayPendingCount * 33)}%` }} />
            </div>
          </div>

          {/* Card 4: Total Requests */}
          <div className="bg-white border border-[#D4E4E3] rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  {isPersonalActive ? 'คำขอทั้งหมดของคุณ' : 'คำขอทั้งหมดในระบบ'}
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 font-bold text-sm">
                  📋
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-purple-700">{displayTotalRequestsCount}</span>
                <span className="text-xs text-slate-500 font-semibold">รายการ</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
                {selectedYear === 'all' 
                  ? (isPersonalActive ? 'ประวัติคำขอทั้งหมดของคุณ' : 'ครอบคลุมทุกปีในระบบ') 
                  : `ประจำปี ${selectedYear}`
                }
              </p>
            </div>
            <div className="w-full bg-purple-100 h-1 rounded-full mt-3 overflow-hidden">
              <div className="bg-purple-600 h-full rounded-full" style={{ width: '85%' }} />
            </div>
          </div>

        </div>
      </div>

      {/* ── 2. MAIN TWO-COLUMN SECTION (Calendar & Advance Leaves) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT 7-COLUMNS: Interactive Monthly Calendar */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-[#D4E4E3] shadow-xs space-y-4">
          
          <div className="flex items-center justify-between border-b border-[#D4E4E3] pb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon size={18} className="text-[#5A8A88]" />
              <h2 className="text-sm font-bold text-[#2D4A49]">
                Calendar & Attendance <span className="text-xs text-slate-500 font-normal">(ปฏิทินการลาในทีม)</span>
              </h2>
            </div>
            
            {/* Month & Year Navigation */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg hover:bg-[#E8F3F2] text-[#5A8A88] transition-colors cursor-pointer"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>
              
              <span className="text-xs font-bold text-[#2D4A49] min-w-[120px] text-center capitalize">
                {monthYearLabel}
              </span>

              <button
                type="button"
                onClick={() => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="p-1.5 rounded-lg hover:bg-[#E8F3F2] text-[#5A8A88] transition-colors cursor-pointer"
                title="เดือนถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-400 py-1">
            <span>อา (Sun)</span>
            <span>จ (Mon)</span>
            <span>อ (Tue)</span>
            <span>พ (Wed)</span>
            <span>พฤ (Thu)</span>
            <span>ศ (Fri)</span>
            <span>ส (Sat)</span>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return (
                  <div key={idx} className="h-16 rounded-xl bg-slate-50/50 border border-slate-100 p-1 opacity-30 select-none" />
                );
              }

              const hasLeaves = cell.leaveItems.length > 0;
              const isSelected = selectedDateFilter === cell.dateStr;
              const isToday = cell.dateStr === todayStr;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (selectedDateFilter === cell.dateStr) {
                      setSelectedDateFilter(null);
                    } else {
                      setSelectedDateFilter(cell.dateStr);
                    }
                  }}
                  className={`h-16 rounded-xl p-1.5 flex flex-col justify-between text-left transition-all border cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'bg-[#2D4A49] text-white border-[#2D4A49] shadow-md ring-2 ring-[#5A8A88]/30'
                      : isToday
                      ? 'bg-[#E8F3F2] border-[#5A8A88] text-[#2D4A49] font-bold'
                      : hasLeaves
                      ? 'bg-amber-50/60 border-amber-200 text-slate-800 hover:bg-amber-100/60'
                      : 'bg-white border-[#D4E4E3]/80 hover:bg-[#F4F9F8] text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : isToday ? 'text-[#5A8A88]' : 'text-slate-700'}`}>
                      {cell.dayNum}
                    </span>
                    {isToday && (
                      <span className="text-[9px] px-1 bg-[#5A8A88] text-white rounded font-semibold">วันนี้</span>
                    )}
                  </div>

                  {/* Leave Items Indicator Badges */}
                  {hasLeaves && (
                    <div className="space-y-0.5 w-full">
                      {cell.leaveItems.slice(0, 2).map((item, lIdx) => (
                        <div 
                          key={lIdx}
                          className={`text-[9px] px-1 py-0.2 rounded truncate font-medium flex items-center gap-0.5 ${
                              isSelected 
                                ? 'bg-white/20 text-white' 
                                : item.leaveType === 'sick' ? 'bg-rose-100 text-rose-800' :
                                  item.leaveType === 'vacation' ? 'bg-emerald-100 text-emerald-800' :
                                  item.leaveType === 'birthday' ? 'bg-amber-100 text-amber-800' :
                                  'bg-purple-100 text-purple-800'
                            }`}
                          title={`${item.userName}: ${item.leaveTypeName}`}
                        >
                          <span className="truncate">{item.userName.split(' ')[0]}</span>
                        </div>
                      ))}
                      {cell.leaveItems.length > 2 && (
                        <p className={`text-[8px] font-bold leading-tight ${isSelected ? 'text-emerald-300' : 'text-amber-700'}`}>
                          +{cell.leaveItems.length - 2} รายการ
                        </p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDateFilter && (
            <div className="p-2.5 bg-[#E8F3F2] border border-[#D4E4E3] rounded-xl flex items-center justify-between text-xs text-[#2D4A49] font-medium">
              <span>📅 กำลังกรองดูวันลาของวันที่: <strong className="font-bold text-[#5A8A88]">{selectedDateFilter}</strong></span>
              <button
                type="button"
                onClick={() => setSelectedDateFilter(null)}
                className="text-xs text-rose-600 hover:underline cursor-pointer font-bold"
              >
                ล้างตัวกรองวันที่
              </button>
            </div>
          )}

        </div>

        {/* RIGHT 5-COLUMNS: Upcoming & Advance Leaves (การลาล่วงหน้า - Real Employees) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-[#D4E4E3] shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#D4E4E3] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <h2 className="text-sm font-bold text-[#2D4A49]">
                  {isPersonalActive ? 'การลาล่วงหน้าของคุณ' : 'การลาล่วงหน้าของทีม'}{' '}
                  <span className="text-xs text-slate-500 font-normal">
                    {isPersonalActive ? '(Your Advance Leaves)' : '(Advance Leaves)'}
                  </span>
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F3F2] text-[#5A8A88]">
                {displayUpcomingLeaves.length} รายการ
              </span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {displayUpcomingLeaves.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-10 h-10 rounded-2xl bg-white text-slate-400 mx-auto flex items-center justify-center text-lg mb-2 shadow-2xs border border-slate-200">
                    🏖️
                  </div>
                  <p className="text-xs font-bold text-slate-600">
                    {isPersonalActive ? 'คุณไม่มีรายการลาล่วงหน้า' : 'ไม่มีรายการลาล่วงหน้า'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    {isPersonalActive 
                      ? `คุณ (${user?.name || 'พนักงาน'}) ยังไม่มีรายการยื่นคำขอลาล่วงหน้าในระบบ` 
                      : `พนักงานใน${currentBranchLabel}ปฏิบัติงานตามปกติ ยังไม่มีรายการยื่นคำขอลาล่วงหน้าในระบบ`
                    }
                  </p>
                </div>
              ) : (
                displayUpcomingLeaves.map((record) => (
                  <div 
                    key={record.id}
                    className="p-3 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl space-y-2 hover:border-[#5A8A88] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#5A8A88] text-white flex items-center justify-center font-bold text-xs">
                          {record.userName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 leading-tight">{record.userName}</p>
                          <p className="text-[10px] text-slate-400">สาขา {record.userBranch}</p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        record.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {record.status === 'Approved' ? '✅ อนุมัติแล้ว' : '⏳ รออนุมัติ'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-[#D4E4E3]/60">
                      <span className="font-semibold text-slate-700">
                        🗓️ {record.fromDate} ถึง {record.toDate}
                      </span>
                      <span className="font-bold text-[#5A8A88]">
                        ({record.totalDays} วัน)
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 truncate bg-slate-50 p-1.5 rounded">
                      <span className="font-medium text-slate-700">{record.leaveTypeName}:</span> {record.description || '-'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              💡 แสดงเฉพาะพนักงานจริงตามบัญชีผู้ใช้ของสาขาที่เลือก
            </p>
          </div>
        </div>

      </div>

      {/* ── 3. EMPLOYEE LEAVE QUOTAS & REMAINING BALANCE SECTION (Real Accounts Only) ── */}
      <div className="bg-white rounded-2xl p-5 md:p-6 border border-[#D4E4E3] shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D4E4E3] pb-3">
          <div className="flex items-center gap-2.5">
            <Users size={18} className="text-[#5A8A88]" />
            <div>
              <h2 className="text-sm md:text-base font-bold text-[#2D4A49]">
                {isPersonalActive ? 'สิทธิ์วันลาคงเหลือส่วนบุคคล' : 'สิทธิ์วันลาคงเหลือของพนักงานรายบุคคล'}{' '}
                <span className="text-xs text-[#5A8A88] font-normal">
                  {isPersonalActive ? '(Your Leave Quotas & Balances)' : '(Employee Leave Quotas & Balances)'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {isPersonalActive 
                  ? `สรุปสิทธิ์วันลาคงเหลือแยกตามประเภท (ลาพักร้อน, ลาพักประจำวันเกิด, ลากิจ, ลาป่วย) ประจำปี ${activeQuotaYear} ของคุณ (${user?.name || 'พนักงาน'})`
                  : `สรุปสิทธิ์คงเหลือแยกตามประเภท (ลาพักร้อน, ลาพักประจำวันเกิด, ลากิจ, ลาป่วย) ประจำปี ${activeQuotaYear} ของพนักงานจริงใน${currentBranchLabel} (${filteredEmployeeQuotas.length} คน)`
                }
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#E8F3F2] border border-[#D4E4E3] text-[11px] font-bold text-[#2D4A49] shrink-0">
            ปี {activeQuotaYear} (พ.ศ. {parseInt(activeQuotaYear, 10) + 543})
          </span>
        </div>

        {/* Real Staff Cards Grid */}
        {filteredEmployeeQuotas.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-sm font-bold text-slate-600">
              {isPersonalMode && isCurrentUserIgnored
                ? 'บัญชีของคุณถูกตั้งค่าเป็น Ignore (ไม่ต้องติดตามวันลาประจำปี)'
                : 'ไม่พบบัญชีพนักงานที่ติดตามวันลาในสาขานี้'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {isPersonalMode && isCurrentUserIgnored
                ? `สำหรับปี ${activeQuotaYear} บัญชีนี้ไม่ต้องติดตามโควต้าวันลา (สามารถปรับแก้ได้ที่ User Security Settings)`
                : 'สามารถตรวจสอบรายชื่อหรือสถานะ Ignore ได้ที่เมนู "User Security Settings -> ตั้งค่าวันลาประจำปี"'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployeeQuotas.map((emp) => {
              const isOwnAccount = isCurrentUser(emp.name);
              return (
                <div 
                  key={emp.id} 
                  className={`rounded-2xl p-4 space-y-3 transition-shadow ${
                    isOwnAccount 
                      ? 'bg-[#F0F7F6] border-2 border-[#5A8A88] shadow-xs' 
                      : 'bg-[#F8FCFC] border border-[#D4E4E3] hover:shadow-xs'
                  }`}
                >
                  
                  {/* Staff Header */}
                  <div className="flex items-center gap-3 border-b border-[#D4E4E3]/60 pb-2.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-base shadow-xs shrink-0 ${
                      isOwnAccount ? 'bg-[#2D4A49] text-white' : 'bg-[#5A8A88] text-white'
                    }`}>
                      {emp.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-xs font-bold text-slate-800 truncate">{emp.name}</h3>
                        {isOwnAccount && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#5A8A88] text-white whitespace-nowrap">
                            ⭐ บัญชีของคุณ
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#5A8A88] font-semibold truncate">{emp.role}</p>
                      <p className="text-[9px] text-slate-400 font-medium">📍 สาขา {emp.branch}</p>
                    </div>
                  </div>

                  {/* Leave Quota Progress Bars */}
                  <div className="space-y-2 text-xs">
                    
                    {/* 1. ลาพักร้อน */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="font-semibold text-slate-700">🏖️ ลาพักร้อน (Vacation Leave)</span>
                        <span className="font-bold text-emerald-700">{emp.vacationRemaining} / {emp.vacationTotal} วัน</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${emp.vacationTotal > 0 ? Math.min(100, (emp.vacationRemaining / emp.vacationTotal) * 100) : 0}%` }} />
                      </div>
                    </div>

                    {/* 2. ลาพักประจำวันเกิด */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="font-semibold text-slate-700">🎂 ลาพักประจำวันเกิด (Birthday Leave)</span>
                        <span className="font-bold text-amber-600">{emp.birthdayRemaining} / {emp.birthdayTotal} วัน</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${emp.birthdayTotal > 0 ? Math.min(100, (emp.birthdayRemaining / emp.birthdayTotal) * 100) : 0}%` }} />
                      </div>
                    </div>

                    {/* 3. ลากิจ */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="font-semibold text-slate-700">💼 ลากิจ (Personal Leave)</span>
                        <span className="font-bold text-purple-700">{emp.personalRemaining} / {emp.personalTotal} วัน</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-purple-600 h-full rounded-full" style={{ width: `${emp.personalTotal > 0 ? Math.min(100, (emp.personalRemaining / emp.personalTotal) * 100) : 0}%` }} />
                      </div>
                    </div>

                    {/* 4. ลาป่วย */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="font-semibold text-slate-700">🤒 ลาป่วย (Sick Leave)</span>
                        <span className="font-bold text-rose-600">{emp.sickRemaining} / {emp.sickTotal} วัน</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full rounded-full" style={{ width: `${emp.sickTotal > 0 ? Math.min(100, (emp.sickRemaining / emp.sickTotal) * 100) : 0}%` }} />
                      </div>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ── 4. ALL TEAM LEAVE REQUESTS TABLE (HISTORY & APPROVAL) ── */}
      <div className="bg-white rounded-2xl p-5 md:p-6 border border-[#D4E4E3] shadow-xs space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D4E4E3] pb-4">
          <div>
            <h2 className="text-base font-bold text-[#2D4A49]">
              {isPersonalActive ? 'ประวัติการลาของคุณ' : 'ประวัติการลาทั้งหมดของทีม'}{' '}
              <span className="text-xs text-slate-500 font-normal">
                {isPersonalActive ? '(Your Leave Requests History)' : '(All Leave Requests History)'}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isPersonalActive
                ? 'แสดงรายการคำขอลาของคุณในระบบ สามารถกรองตามปี และสถานะได้'
                : 'แสดงรายการคำขอลาทั้งหมดในระบบ สามารถค้นหา กรองตามปี/สาขา/สถานะ และอนุมัติรายการได้'
              }
            </p>
          </div>

          {/* Search & Comprehensive Filters */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Search Box (Leave Dashboard Only) */}
            {!isPersonalActive && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อพนักงาน, ชนิดการลา..."
                  className="pl-8 pr-3 py-1.5 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#5A8A88] w-44 sm:w-52"
                />
              </div>
            )}

            {/* Year Filter Tool */}
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="px-2.5 py-1.5 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl text-xs text-[#2D4A49] font-bold focus:outline-none focus:border-[#5A8A88] cursor-pointer"
              title="กรองตามปี"
            >
              <option value="all">ทุกปี (All Years)</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  ปี {yr} ({parseInt(yr, 10) + 543})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-[#5A8A88] cursor-pointer"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="Pending">รออนุมัติ</option>
              <option value="Approved">อนุมัติแล้ว</option>
              <option value="Rejected">ไม่อนุมัติ</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto rounded-xl border border-[#D4E4E3]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#2D4A49] text-white text-[11px] uppercase tracking-wider font-bold">
                <th className="p-3">ชื่อพนักงาน</th>
                <th className="p-3">สาขา</th>
                <th className="p-3">ประเภทการลา</th>
                <th className="p-3">ช่วงวันที่ลา (From - To)</th>
                <th className="p-3 text-center">จำนวนวัน</th>
                <th className="p-3">เหตุผล (Description)</th>
                <th className="p-3 text-center">สถานะ (Status)</th>
                <th className="p-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4E4E3] text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <div className="py-4 space-y-1">
                      <p className="text-xs font-bold text-slate-600">
                        {isPersonalActive 
                          ? `คุณยังไม่มีประวัติการลาในระบบ (ปี ${selectedYear === 'all' ? 'ทั้งหมด' : selectedYear})`
                          : `ยังไม่มีประวัติการลาในระบบ (ปี ${selectedYear === 'all' ? 'ทั้งหมด' : selectedYear})`
                        }
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {isPersonalActive
                          ? 'คุณยังไม่มีการยื่นคำขอลา สามารถกดปุ่ม "ทำรายการลาหยุด" เพื่อเริ่มสร้างคำขอจริงได้'
                          : `พนักงานใน${currentBranchLabel}ยังไม่มีการยื่นคำขอลา สามารถกดปุ่ม "ทำรายการลาหยุด" เพื่อเริ่มสร้างคำขอจริงได้`
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F4F9F8] transition-colors">
                    <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                      {item.userName}
                    </td>
                    <td className="p-3 text-slate-600 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-[#E8F3F2] text-[#5A8A88] text-[10px] font-semibold">
                        {item.userBranch}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap font-medium text-slate-700">
                      {item.leaveTypeName}
                    </td>
                    <td className="p-3 whitespace-nowrap font-medium text-slate-800">
                      📅 {item.fromDate} ถึง {item.toDate}
                    </td>
                    <td className="p-3 text-center font-bold text-[#5A8A88] whitespace-nowrap">
                      {item.totalDays} วัน
                    </td>
                    <td className="p-3 text-slate-600 max-w-xs truncate" title={item.description}>
                      {item.description || '-'}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-2xs ${
                        item.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        item.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {item.status === 'Pending' ? '⏳ รออนุมัติ' : item.status === 'Approved' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {item.status === 'Pending' && !isReadOnly ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(item.id, 'Approved')}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="อนุมัติการลา"
                          >
                            <Check size={12} />
                            อนุมัติ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(item.id, 'Rejected')}
                            className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="ปฏิเสธคำขอ"
                          >
                            <X size={12} />
                            ไม่อนุมัติ
                          </button>
                        </div>
                      ) : item.status === 'Pending' ? (
                        <span className="text-[10px] text-slate-400 font-medium">รออนุมัติ (ดูอย่างเดียว)</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">เสร็จสิ้น</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};

export default LeaveDashboard;

