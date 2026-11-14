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
  getEmployeeBirthDate,
  getEmployeeQuotaForYear,
  parseBirthMonthDay,
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

  // Branch matching helper (declared before all useMemo hooks to avoid TDZ ReferenceError)
  const isBranchMatch = (itemBranch?: string, targetBranch?: string) => {
    if (!targetBranch || targetBranch === 'all' || targetBranch === 'ALL') return true;
    if (!itemBranch) return false;
    const b = itemBranch.toLowerCase();
    const t = targetBranch.toLowerCase();
    if (t === 'rayong' || t.includes('ระยอง')) return b.includes('rayong') || b.includes('ระยอง');
    if (t === 'bangkok' || t.includes('กรุงเทพ')) return b.includes('bangkok') || b.includes('กรุงเทพ');
    return b === t;
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
                      avatar: u.avatar,
                      birthDate: u.birthDate || u.birth_date || '',
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
          birthDate: user.birthDate || user.birth_date || '',
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
        birthDate: emp.birthDate || emp.birth_date,
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
        const matchesBranch = !r.userBranch || isBranchMatch(r.userBranch, empBranch);
        const matchesYear =
          selectedYear === 'all' ||
          (r.fromDate && r.fromDate.startsWith(selectedYear)) ||
          (r.toDate && r.toDate.startsWith(selectedYear));

        if (matchesEmployee && matchesBranch && matchesYear && r.status === 'Approved') {
          const type = `${r.leaveType || ''} ${r.leaveTypeName || ''}`.toLowerCase();
          const days = r.totalDays !== undefined && r.totalDays !== null ? Number(r.totalDays) : 1;
          const safeDays = Number.isFinite(days) && days >= 0 ? days : 0;
          if (type.includes('birthday') || type.includes('วันเกิด')) birthdayUsed += safeDays;
          else if (type.includes('sick') || type.includes('ป่วย')) sickUsed += safeDays;
          else if (type.includes('personal') || type.includes('กิจ')) personalUsed += safeDays;
          else if (type.includes('vacation') || type.includes('พักร้อน') || type.includes('annual')) vacationUsed += safeDays;
          else if (type.includes('maternity') || type.includes('คลอด')) maternityUsed += safeDays;
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

  // Approver role check: strictly Admin, Owner, Co-founder, and Branch Manager only
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

  // Update status (Approve / Reject) — recalculates employeeQuotas reactively upon Approved
  const handleUpdateStatus = async (id: string, newStatus: 'Approved' | 'Rejected') => {
    if (!canApproveLeave || isPersonalMode) return;
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
        const { error } = await supabase
          .from('leave_requests')
          .update({ status: newStatus })
          .eq('id', id);
        if (error) {
          console.warn('Supabase update leave_requests status error:', error);
        }
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

  // Filtered leave records for table and history
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return leaveRecords.filter(r => {
      const matchesSearch =
        (r.userName || '').toLowerCase().includes(q) ||
        (r.leaveTypeName || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q);

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

  // Leave Request Approval Queue (คำขออนุมัติวันลา): Pending requests (any date) + upcoming Approved requests
  const approvalQueueLeaves = useMemo(() => {
    const filtered = leaveRecords.filter(r => {
      if (!isBranchMatch(r.userBranch, selectedBranch)) return false;

      if (selectedYear !== 'all') {
        const matchesYear =
          (r.fromDate && r.fromDate.startsWith(selectedYear)) ||
          (r.toDate && r.toDate.startsWith(selectedYear));
        if (!matchesYear) return false;
      }

      const matchesRealEmployee = staffAccounts.length === 0 || staffAccounts.some(s =>
        s.name?.toLowerCase().trim() === r.userName?.toLowerCase().trim()
      );
      if (!matchesRealEmployee) return false;

      if (r.status === 'Pending') return true;
      if (r.status === 'Approved' && r.fromDate >= todayStr) return true;
      return false;
    });

    // Pending requests first, then chronological by fromDate
    return filtered.sort((a, b) => {
      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
      if (a.status !== 'Pending' && b.status === 'Pending') return 1;
      return (a.fromDate || '').localeCompare(b.fromDate || '');
    });
  }, [leaveRecords, todayStr, selectedBranch, selectedYear, staffAccounts]);

  const displayApprovalQueueLeaves = isPersonalActive ? myUpcomingLeaves : approvalQueueLeaves;

  // Unique branch staff birthdays mapped from Annual Leave Quotas / user profiles
  const branchStaffBirthdays = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string; role: string; branch: string; month: number; day: number; birthDate: string }> = [];

    staffAccounts.forEach((emp) => {
      const empBranch = emp.branch || 'Rayong';
      if (!isBranchMatch(empBranch, selectedBranch)) return;
      const empName = (emp.name || '').trim();
      if (!empName) return;

      const dedupeKey = `${empName.toLowerCase()}__${empBranch.toLowerCase()}`;
      if (seen.has(dedupeKey)) return;

      const birthDate = getEmployeeBirthDate(quotasByYear, {
        id: emp.id,
        name: empName,
        branch: empBranch,
        birthDate: emp.birthDate || emp.birth_date,
      });
      const md = parseBirthMonthDay(birthDate);
      if (!md) return;

      seen.add(dedupeKey);
      list.push({
        id: emp.id || dedupeKey,
        name: empName,
        role: emp.role || 'Staff',
        branch: empBranch,
        month: md.month,
        day: md.day,
        birthDate,
      });
    });

    return list;
  }, [staffAccounts, selectedBranch, quotasByYear]);

  // Calendar matrix generator for current month (includes leaves & employee birthdays)
  const calendarDays = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dayNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
      leaveItems: LeaveRecord[];
      birthdayItems: Array<{ id: string; name: string; role: string; branch: string; birthDate: string }>;
    }> = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ dayNum: 0, dateStr: '', isCurrentMonth: false, leaveItems: [], birthdayItems: [] });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const leavesOnThisDay = leaveRecords.filter(r =>
        r.fromDate <= dateStr &&
        r.toDate >= dateStr &&
        r.status !== 'Rejected' &&
        isBranchMatch(r.userBranch, selectedBranch)
      );
      const birthdaysOnThisDay = branchStaffBirthdays.filter(b =>
        (b.month === month + 1 && b.day === d) ||
        (b.month === 2 && b.day === 29 && month + 1 === 2 && daysInMonth === 28 && d === 28)
      );

      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        leaveItems: leavesOnThisDay,
        birthdayItems: birthdaysOnThisDay,
      });
    }

    return days;
  }, [selectedMonth, leaveRecords, selectedBranch, branchStaffBirthdays]);

  // Selected day details for Calendar & Attendance panel
  const selectedDayDetails = useMemo(() => {
    if (!selectedDateFilter) return null;
    const foundCell = calendarDays.find(c => c.isCurrentMonth && c.dateStr === selectedDateFilter);
    if (foundCell) {
      return {
        dateStr: foundCell.dateStr,
        leaveItems: foundCell.leaveItems,
        birthdayItems: foundCell.birthdayItems,
      };
    }

    const parts = selectedDateFilter.split('-');
    const yrNum = parseInt(parts[0], 10);
    const moNum = parseInt(parts[1], 10);
    const dyNum = parseInt(parts[2], 10);
    const daysInMo = !isNaN(yrNum) && !isNaN(moNum) ? new Date(yrNum, moNum, 0).getDate() : 31;

    const leaveItems = leaveRecords.filter(r =>
      r.fromDate <= selectedDateFilter &&
      r.toDate >= selectedDateFilter &&
      r.status !== 'Rejected' &&
      isBranchMatch(r.userBranch, selectedBranch)
    );
    const birthdayItems = !isNaN(moNum) && !isNaN(dyNum)
      ? branchStaffBirthdays.filter(b =>
          (b.month === moNum && b.day === dyNum) ||
          (b.month === 2 && b.day === 29 && moNum === 2 && daysInMo === 28 && dyNum === 28)
        )
      : [];

    return { dateStr: selectedDateFilter, leaveItems, birthdayItems };
  }, [selectedDateFilter, calendarDays, leaveRecords, selectedBranch, branchStaffBirthdays]);

  // Current branch display label
  const currentBranchLabel = useMemo(() => {
    if (selectedBranch === 'Rayong' || selectedBranch.includes('ระยอง')) return 'สาขาระยอง (Rayong)';
    if (selectedBranch === 'Bangkok' || selectedBranch.includes('กรุงเทพ')) return 'สาขากรุงเทพฯ (Bangkok)';
    return 'ทุกสาขา (All Branches)';
  }, [selectedBranch]);

  const monthYearLabel = selectedMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 md:space-y-6 pb-20">
      
      {/* ── HEADER BANNER CARD (Aligned with Inventory Dashboard Typography) ── */}
      <div className="bg-gradient-to-r from-white to-[#EAF2F1] rounded-2xl p-4 md:p-5 shadow-xs border border-[#D4E4E3]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          
          {/* Left: Icon + Title + Badges + Subtitle */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-white text-[#5A8A88] flex items-center justify-center text-xl md:text-2xl font-bold border border-[#D4E4E3] shrink-0 shadow-xs">
              {isPersonalMode ? '👤' : '📊'}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight whitespace-nowrap">
                  {isPersonalMode ? 'Personnel Leave' : 'Leave Dashboard'}
                </h1>
                <span className="text-[10px] sm:text-[11px] font-bold text-[#5A8A88] bg-[#5A8A88]/15 px-2 py-0.5 rounded-md whitespace-nowrap">
                  {isPersonalMode ? 'ภาพรวมการลาส่วนตัว' : 'ภาพรวมการลาของทีม'}
                </span>
                <span className="text-[11px] sm:text-xs font-semibold text-[#2D4A49] bg-white px-2.5 py-0.5 rounded-full border border-[#D4E4E3] whitespace-nowrap flex items-center gap-1 shadow-2xs">
                  <span>📍</span>
                  <span>{currentBranchLabel}</span>
                </span>
              </div>
              <p className="text-xs md:text-sm text-[#6B8F8E] font-medium mt-1 truncate sm:whitespace-normal">
                {isPersonalMode 
                  ? `ติดตามการลาล่วงหน้า สถิติวันลาคงเหลือ และประวัติการลาส่วนบุคคลของ ${user?.name || 'พนักงาน'} (${currentBranchLabel})`
                  : `ติดตามการลาล่วงหน้า สถิติวันลาคงเหลือของพนักงาน และปฏิทินการลาใน${currentBranchLabel}`
                }
              </p>
            </div>
          </div>

          {/* Right: Year Filter & Action Button */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-stretch sm:self-auto justify-end">
            
            {/* Year Filter Tool */}
            <div className="flex items-center gap-1.5 bg-white border border-[#D4E4E3] rounded-full px-3 py-1.5 shadow-xs hover:border-[#5A8A88] transition-colors">
              <CalendarIcon size={13} className="text-[#5A8A88] shrink-0" />
              <span className="text-[11px] font-semibold text-[#6B8F8E] whitespace-nowrap">ปี:</span>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="text-[11px] font-semibold text-[#2D4A49] bg-transparent focus:outline-none cursor-pointer"
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
                className="px-3.5 py-1.5 rounded-full bg-[#2D4A49] hover:bg-[#203635] text-white text-[11px] font-semibold shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap active:scale-[0.98]"
              >
                <Plus size={14} className="shrink-0" />
                <span>ทำรายการลาหยุด (Leave Request)</span>
              </button>
            )}

          </div>

        </div>
      </div>

      {/* ── 1. TOP KPI SUMMARY CARDS (Aligned with HomeScreen KPI Typography) ── */}
      <div className="w-full overflow-x-auto custom-scrollbar pb-0.5">
        <div className="grid grid-cols-4 gap-2 sm:gap-2.5 md:gap-3 min-w-[520px] sm:min-w-0">
          
          {/* Card 1: On Leave Today / Personal Status Today */}
          <div className="bg-white border border-amber-200/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-3.5 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <span className="text-[11px] sm:text-[11.5px] lg:text-[12px] font-bold text-amber-800 block truncate">
                  {isPersonalActive ? 'สถานะการลาวันนี้' : 'พนักงานที่ลาวันนี้'}
                </span>
                <span className="text-[9px] sm:text-[9.5px] lg:text-[10px] text-[#6B8F8E] font-medium block truncate mt-0.5">
                  {isPersonalActive ? 'สถานะประจำวัน' : 'อัปเดตวันลาล่าสุด'}
                </span>
              </div>
              <div className={`w-6 h-6 sm:w-6.5 sm:h-6.5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center shrink-0 text-xs sm:text-sm ${
                isPersonalActive 
                  ? (displayTodayLeaves.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')
                  : 'bg-amber-50 text-amber-600'
              }`}>
                {isPersonalActive ? (displayTodayLeaves.length > 0 ? '🤒' : '✨') : '🤒'}
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline">
              <span className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-slate-800 leading-none">
                {isPersonalActive 
                  ? (displayTodayLeaves.length > 0 ? 'ลาหยุด' : 'ปกติ')
                  : displayTodayLeaves.length
                }
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium ml-1">
                {isPersonalActive ? (displayTodayLeaves.length > 0 ? '' : '(ทำงาน)') : 'คน'}
              </span>
            </div>
            <p className="text-[8.5px] sm:text-[9.5px] text-amber-600 font-medium mt-1 sm:mt-1.5 truncate">
              {isPersonalActive
                ? (displayTodayLeaves.length > 0 ? displayTodayLeaves[0].leaveTypeName : 'คุณปฏิบัติงานตามปกติ')
                : (displayTodayLeaves.length > 0 ? displayTodayLeaves.map(l => l.userName).join(', ') : 'ไม่มีพนักงานลาในวันนี้')
              }
            </p>
            <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full ${isPersonalActive && displayTodayLeaves.length === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                style={{ width: isPersonalActive ? '100%' : `${Math.min(100, displayTodayLeaves.length * 25)}%` }} 
              />
            </div>
          </div>

          {/* Card 2: Upcoming Leaves */}
          <div className="bg-white border border-[#D4E4E3] rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-3.5 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <span className="text-[11px] sm:text-[11.5px] lg:text-[12px] font-bold text-[#2D4A49] block truncate">
                  {isPersonalActive ? 'การลาล่วงหน้าของคุณ' : 'การลาล่วงหน้า'}
                </span>
                <span className="text-[9px] sm:text-[9.5px] lg:text-[10px] text-[#6B8F8E] font-medium block truncate mt-0.5">
                  ตารางวันลาถัดไป
                </span>
              </div>
              <div className="w-6 h-6 sm:w-6.5 sm:h-6.5 lg:w-7 lg:h-7 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center shrink-0 text-xs sm:text-sm">
                🏖️
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline">
              <span className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-[#5A8A88] leading-none">{displayUpcomingLeaves.length}</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium ml-1">รายการ</span>
            </div>
            <p className="text-[8.5px] sm:text-[9.5px] text-[#5A8A88] font-medium mt-1 sm:mt-1.5 truncate">
              {displayUpcomingLeaves.length > 0 
                ? `ลาล่วงหน้าตั้งแต่ ${displayUpcomingLeaves[0].fromDate}` 
                : (isPersonalActive ? 'คุณไม่มีรายการลาล่วงหน้า' : 'ไม่มีรายการลาล่วงหน้า')
              }
            </p>
            <div className="w-full bg-[#E8F3F2] h-1 rounded-full mt-2 overflow-hidden">
              <div className="bg-[#5A8A88] h-full rounded-full" style={{ width: `${Math.min(100, displayUpcomingLeaves.length * 20)}%` }} />
            </div>
          </div>

          {/* Card 3: Pending Approvals */}
          <div className="bg-white border border-orange-200/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-3.5 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <span className="text-[11px] sm:text-[11.5px] lg:text-[12px] font-bold text-orange-700 block truncate">
                  {isPersonalActive ? 'คำขอรออนุมัติของคุณ' : 'คำขอรออนุมัติ'}
                </span>
                <span className="text-[9px] sm:text-[9.5px] lg:text-[10px] text-[#6B8F8E] font-medium block truncate mt-0.5">
                  รอพิจารณาอนุมัติ
                </span>
              </div>
              <div className="w-6 h-6 sm:w-6.5 sm:h-6.5 lg:w-7 lg:h-7 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 text-xs sm:text-sm">
                ⏳
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline">
              <span className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-orange-600 leading-none">{displayPendingCount}</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium ml-1">คำขอ</span>
            </div>
            <p className="text-[8.5px] sm:text-[9.5px] text-orange-600 font-medium mt-1 sm:mt-1.5 truncate">
              {displayPendingCount > 0 
                ? (isPersonalActive ? 'รอผู้จัดการพิจารณาอนุมัติ' : 'รอผู้จัดการดำเนินการอนุมัติ') 
                : (isPersonalActive ? 'ไม่มีคำขอที่รออนุมัติ' : 'พิจารณาครบทุกรายการแล้ว')
              }
            </p>
            <div className="w-full bg-orange-100 h-1 rounded-full mt-2 overflow-hidden">
              <div className="bg-orange-500 h-full rounded-full" style={{ width: `${Math.min(100, displayPendingCount * 33)}%` }} />
            </div>
          </div>

          {/* Card 4: Total Requests */}
          <div className="bg-white border border-purple-200/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-3.5 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <span className="text-[11px] sm:text-[11.5px] lg:text-[12px] font-bold text-purple-800 block truncate">
                  {isPersonalActive ? 'คำขอทั้งหมดของคุณ' : 'คำขอทั้งหมดในระบบ'}
                </span>
                <span className="text-[9px] sm:text-[9.5px] lg:text-[10px] text-[#6B8F8E] font-medium block truncate mt-0.5">
                  ประวัติคำขอลาสะสม
                </span>
              </div>
              <div className="w-6 h-6 sm:w-6.5 sm:h-6.5 lg:w-7 lg:h-7 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 text-xs sm:text-sm">
                📋
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline">
              <span className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-purple-700 leading-none">{displayTotalRequestsCount}</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium ml-1">รายการ</span>
            </div>
            <p className="text-[8.5px] sm:text-[9.5px] text-purple-600 font-medium mt-1 sm:mt-1.5 truncate">
              {selectedYear === 'all' 
                ? (isPersonalActive ? 'ประวัติคำขอทั้งหมดของคุณ' : 'ครอบคลุมทุกปีในระบบ') 
                : `ประจำปี ${selectedYear}`
              }
            </p>
            <div className="w-full bg-purple-100 h-1 rounded-full mt-2 overflow-hidden">
              <div className="bg-purple-600 h-full rounded-full" style={{ width: '85%' }} />
            </div>
          </div>

        </div>
      </div>

      {/* ── 2. MAIN TWO-COLUMN SECTION (Calendar & Leave Request Approval) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        
        {/* LEFT 7-COLUMNS: Interactive Monthly Calendar */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-4 md:p-5 border border-[#D4E4E3] shadow-xs space-y-4">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon size={16} className="text-[#5A8A88] shrink-0" />
              <h2 className="text-[13px] sm:text-[14px] font-bold text-slate-800 tracking-tight">
                Calendar & Attendance <span className="text-[11px] sm:text-[12px] text-slate-400 font-medium">(ปฏิทินการลาในทีม)</span>
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
                <ChevronLeft size={15} />
              </button>
              
              <span className="text-[12px] sm:text-[13px] font-bold text-[#2D4A49] min-w-[115px] text-center capitalize">
                {monthYearLabel}
              </span>

              <button
                type="button"
                onClick={() => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="p-1.5 rounded-lg hover:bg-[#E8F3F2] text-[#5A8A88] transition-colors cursor-pointer"
                title="เดือนถัดไป"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] sm:text-[11px] text-slate-400 py-0.5">
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
                  <div key={idx} className="min-h-[78px] rounded-xl bg-slate-50/50 border border-slate-100 p-1 opacity-30 select-none" />
                );
              }

              const hasLeaves = cell.leaveItems.length > 0;
              const hasPending = cell.leaveItems.some(item => item.status === 'Pending');
              const hasApproved = cell.leaveItems.some(item => item.status === 'Approved');
              const hasBirthdays = cell.birthdayItems.length > 0;
              const isSelected = selectedDateFilter === cell.dateStr;
              const isToday = cell.dateStr === todayStr;

              const cellSurfaceClass = isSelected
                ? 'bg-[#2D4A49] text-white border-[#2D4A49] shadow-md ring-2 ring-[#5A8A88]/40'
                : hasPending && hasApproved
                ? `bg-gradient-to-br from-amber-50 to-emerald-50 border-amber-300 text-slate-800 hover:brightness-95 ${isToday ? 'ring-2 ring-[#5A8A88]' : ''}`
                : hasPending
                ? `bg-amber-50/90 border-amber-300 text-amber-950 hover:bg-amber-100/75 ${isToday ? 'ring-2 ring-[#5A8A88]' : ''}`
                : hasApproved
                ? `bg-emerald-50/90 border-emerald-300 text-emerald-950 hover:bg-emerald-100/75 ${isToday ? 'ring-2 ring-[#5A8A88]' : ''}`
                : isToday
                ? 'bg-[#E8F3F2] border-[#5A8A88] text-[#2D4A49] font-bold'
                : hasBirthdays
                ? 'bg-pink-50/75 border-pink-200 text-pink-950 hover:bg-pink-100/70'
                : 'bg-white border-[#D4E4E3]/80 hover:bg-[#F4F9F8] text-slate-700';

              const badges: Array<{ key: string; kind: 'birthday' | 'pending' | 'approved'; label: string; title: string }> = [
                ...cell.birthdayItems.map((b, bIdx) => ({
                  key: `bday-${b.id}-${bIdx}`,
                  kind: 'birthday' as const,
                  label: `🎂 ${b.name.split(' ')[0]}`,
                  title: `วันเกิด: ${b.name} (${b.role})`,
                })),
                ...cell.leaveItems.map((item, lIdx) => ({
                  key: `leave-${item.id}-${lIdx}`,
                  kind: item.status === 'Approved' ? ('approved' as const) : ('pending' as const),
                  label: `${item.status === 'Approved' ? '✓' : '⏳'} ${item.userName.split(' ')[0]}`,
                  title: `${item.userName}: ${item.leaveTypeName} (${item.status === 'Approved' ? 'อนุมัติแล้ว' : 'รออนุมัติ'})`,
                })),
              ];

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
                  className={`min-h-[78px] rounded-xl p-1.5 flex flex-col justify-between text-left transition-all border cursor-pointer relative overflow-hidden ${cellSurfaceClass}`}
                >
                  <div className="flex items-center justify-between w-full gap-0.5">
                    <span className={`text-[11px] font-bold leading-none ${
                      isSelected
                        ? 'text-white'
                        : isToday
                        ? 'text-[#5A8A88]'
                        : hasPending && !hasApproved
                        ? 'text-amber-800'
                        : hasApproved && !hasPending
                        ? 'text-emerald-800'
                        : 'text-slate-700'
                    }`}>
                      {cell.dayNum}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {hasPending && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-amber-500'}`} title="มีคำขอรออนุมัติ" />
                      )}
                      {hasApproved && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`} title="มีรายการอนุมัติแล้ว" />
                      )}
                      {isToday && (
                        <span className="text-[9px] px-1 bg-[#5A8A88] text-white rounded font-semibold leading-tight">วันนี้</span>
                      )}
                    </div>
                  </div>

                  {/* Birthday & Leave Status Badges */}
                  {badges.length > 0 && (
                    <div className="space-y-0.5 w-full mt-1">
                      {badges.slice(0, 2).map((badge) => (
                        <div
                          key={badge.key}
                          className={`text-[9px] px-1 py-0.5 rounded truncate font-semibold leading-tight ${
                            isSelected
                              ? badge.kind === 'birthday'
                                ? 'bg-pink-400/30 text-white'
                                : badge.kind === 'approved'
                                ? 'bg-emerald-400/30 text-emerald-100'
                                : 'bg-amber-400/30 text-amber-100'
                              : badge.kind === 'birthday'
                              ? 'bg-pink-100 text-pink-800 border border-pink-200/70'
                              : badge.kind === 'approved'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/70'
                              : 'bg-amber-100 text-amber-800 border border-amber-200/70'
                          }`}
                          title={badge.title}
                        >
                          <span className="truncate">{badge.label}</span>
                        </div>
                      ))}
                      {badges.length > 2 && (
                        <p className={`text-[8px] font-bold leading-tight ${
                          isSelected ? 'text-emerald-200' : hasPending ? 'text-amber-700' : hasApproved ? 'text-emerald-700' : 'text-pink-700'
                        }`}>
                          +{badges.length - 2} รายการ
                        </p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar Status Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-100 text-[10px] sm:text-[11px] text-[#6B8F8E]">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300 inline-block" />
              อนุมัติแล้ว (Approved)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300 inline-block" />
              รออนุมัติ (Pending)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded bg-pink-100 border border-pink-200 inline-block" />
              🎂 วันเกิดพนักงาน (Birthday)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded bg-[#E8F3F2] border border-[#5A8A88] inline-block" />
              วันนี้ (Today)
            </span>
          </div>

          {/* Selected Date Detail Drawer */}
          {selectedDayDetails && (
            <div className="p-3 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-[#D4E4E3]/70 pb-2">
                <span className="text-[11px] sm:text-xs font-bold text-[#2D4A49] flex items-center gap-1.5">
                  <span>📅</span>
                  <span>
                    รายละเอียดวันที่{' '}
                    {new Date(`${selectedDayDetails.dateStr}T00:00:00`).toLocaleDateString('th-TH', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    <span className="text-[#5A8A88] font-semibold">({selectedDayDetails.dateStr})</span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDateFilter(null)}
                  className="text-[10px] text-rose-600 hover:underline cursor-pointer font-bold shrink-0"
                >
                  ล้างตัวกรองวันที่
                </button>
              </div>

              {selectedDayDetails.birthdayItems.length === 0 && selectedDayDetails.leaveItems.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-1">
                  ไม่มีรายการลาหยุดหรือวันเกิดพนักงานในวันที่ {selectedDayDetails.dateStr}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {/* Birthdays on Selected Date */}
                  {selectedDayDetails.birthdayItems.map((b) => (
                    <div
                      key={`detail-bday-${b.id}`}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-pink-50 border border-pink-200 text-[11px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs shrink-0">🎂</span>
                        <span className="font-bold text-pink-900 truncate">วันเกิดของ {b.name}</span>
                        <span className="text-[9.5px] font-semibold text-pink-700 bg-white/80 px-1.5 py-0.5 rounded border border-pink-200/70 shrink-0">
                          {b.role}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-pink-700 shrink-0">Happy Birthday!</span>
                    </div>
                  ))}

                  {/* Leaves on Selected Date */}
                  {selectedDayDetails.leaveItems.map((item) => (
                    <div
                      key={`detail-leave-${item.id}`}
                      className={`p-2 rounded-lg border text-[11px] space-y-1 ${
                        item.status === 'Approved'
                          ? 'bg-emerald-50/70 border-emerald-200'
                          : 'bg-amber-50/70 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-[#2D4A49] truncate">{item.userName}</span>
                          <span className="text-[9.5px] font-semibold text-[#5A8A88] bg-white px-1.5 py-0.5 rounded border border-[#D4E4E3] shrink-0">
                            {item.leaveTypeName}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold shrink-0 ${
                          item.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {item.status === 'Approved' ? '✅ อนุมัติแล้ว' : '⏳ รออนุมัติ'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
                        <span>
                          🗓️ {item.fromDate === item.toDate ? item.fromDate : `${item.fromDate} ถึง ${item.toDate}`} ({item.totalDays} วัน)
                        </span>
                        <span className="text-slate-500 truncate max-w-[260px]" title={item.description}>
                          เหตุผล: {item.description || '-'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* RIGHT 5-COLUMNS: Leave Request Approval (คำขออนุมัติวันลา) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-4 md:p-5 border border-[#D4E4E3] shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-amber-500 shrink-0" />
                <h2 className="text-[13px] sm:text-[14px] font-bold text-slate-800 tracking-tight">
                  คำขออนุมัติวันลา{' '}
                  <span className="text-[11px] sm:text-[12px] text-slate-400 font-medium">
                    (Leave Request Approval)
                  </span>
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F3F2] text-[#5A8A88] shrink-0">
                {displayApprovalQueueLeaves.length} รายการ
              </span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {displayApprovalQueueLeaves.length === 0 ? (
                <div className="text-center py-10 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-9 h-9 rounded-xl bg-white text-slate-400 mx-auto flex items-center justify-center text-base mb-2 shadow-2xs border border-slate-200">
                    🏖️
                  </div>
                  <p className="text-[11px] font-bold text-slate-700">
                    {isPersonalActive ? 'คุณไม่มีรายการลาล่วงหน้า' : 'ไม่มีคำขออนุมัติวันลาในขณะนี้'}
                  </p>
                  <p className="text-[10px] text-[#6B8F8E] mt-1 max-w-xs mx-auto">
                    {isPersonalActive
                      ? `คุณ (${user?.name || 'พนักงาน'}) ยังไม่มีรายการยื่นคำขอลาล่วงหน้าในระบบ`
                      : `พนักงานใน${currentBranchLabel}ยังไม่มีคำขออนุมัติวันลาหรือการลาล่วงหน้าในระบบ`
                    }
                  </p>
                </div>
              ) : (
                displayApprovalQueueLeaves.map((record) => (
                  <div
                    key={record.id}
                    className="p-2.5 sm:p-3 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl space-y-2 hover:border-[#5A8A88] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#5A8A88] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                          {record.userName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] sm:text-xs font-bold text-[#2D4A49] leading-snug truncate">{record.userName}</p>
                          <p className="text-[9.5px] sm:text-[10px] text-[#6B8F8E]">สาขา {record.userBranch}</p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        record.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {record.status === 'Approved' ? '✅ อนุมัติแล้ว' : '⏳ รออนุมัติ'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-[#D4E4E3]/60">
                      <span className="font-semibold text-slate-700">
                        🗓️ {record.fromDate} ถึง {record.toDate}
                      </span>
                      <span className="font-bold text-[#5A8A88]">
                        ({record.totalDays} วัน)
                      </span>
                    </div>

                    <p className="text-[10px] sm:text-[11px] text-slate-600 truncate bg-slate-50 px-2 py-1 rounded">
                      <span className="font-semibold text-slate-700">{record.leaveTypeName}:</span> {record.description || '-'}
                    </p>

                    {/* Approve / Reject Controls for Authorized Roles Only (Admin, Owner, Co-founder, Branch Manager) */}
                    {!isPersonalActive && record.status === 'Pending' && (
                      canApproveLeave ? (
                        <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-[#D4E4E3]/60">
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(record.id, 'Rejected')}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="ไม่อนุมัติคำขอลา"
                          >
                            <X size={12} />
                            <span>ไม่อนุมัติ (Reject)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(record.id, 'Approved')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                            title="อนุมัติการลาและหักวันลาคงเหลือทันที"
                          >
                            <Check size={12} />
                            <span>อนุมัติ (Approve)</span>
                          </button>
                        </div>
                      ) : (
                        <div className="pt-1.5 border-t border-[#D4E4E3]/60 text-right">
                          <span className="text-[9.5px] sm:text-[10px] text-[#6B8F8E] font-medium">
                            🔒 เฉพาะ Admin, Owner, Co-founder และ Branch Manager เท่านั้นที่มีสิทธิ์อนุมัติ
                          </span>
                        </div>
                      )
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-[10px] text-[#6B8F8E]">
              💡 แสดงเฉพาะพนักงานจริงตามบัญชีผู้ใช้ของสาขาที่เลือก (เมื่ออนุมัติแล้วระบบจะหักวันลาคงเหลือทันที)
            </p>
          </div>
        </div>

      </div>

      {/* ── 3. EMPLOYEE LEAVE QUOTAS & REMAINING BALANCE SECTION (Real Accounts Only) ── */}
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-[#D4E4E3] shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Users size={16} className="text-[#5A8A88] shrink-0" />
            <div>
              <h2 className="text-[13px] sm:text-[14px] font-bold text-slate-800 tracking-tight">
                {isPersonalActive ? 'สิทธิ์วันลาคงเหลือส่วนบุคคล' : 'สิทธิ์วันลาคงเหลือของพนักงานรายบุคคล'}{' '}
                <span className="text-[11px] sm:text-[12px] text-slate-400 font-medium">
                  {isPersonalActive ? '(Your Leave Quotas & Balances)' : '(Employee Leave Quotas & Balances)'}
                </span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-[#6B8F8E] mt-0.5">
                {isPersonalActive 
                  ? `สรุปสิทธิ์วันลาคงเหลือแยกตามประเภท (ลาพักร้อน, ลาพักประจำวันเกิด, ลากิจ, ลาป่วย) ประจำปี ${activeQuotaYear} ของคุณ (${user?.name || 'พนักงาน'})`
                  : `สรุปสิทธิ์คงเหลือแยกตามประเภท (ลาพักร้อน, ลาพักประจำวันเกิด, ลากิจ, ลาป่วย) ประจำปี ${activeQuotaYear} ของพนักงานจริงใน${currentBranchLabel} (${filteredEmployeeQuotas.length} คน)`
                }
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#E8F3F2] border border-[#D4E4E3] text-[10px] sm:text-[11px] font-bold text-[#2D4A49] shrink-0 self-start sm:self-auto">
            ปี {activeQuotaYear} (พ.ศ. {parseInt(activeQuotaYear, 10) + 543})
          </span>
        </div>

        {/* Real Staff Cards Grid */}
        {filteredEmployeeQuotas.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-xs font-bold text-slate-700">
              {isPersonalMode && isCurrentUserIgnored
                ? 'บัญชีของคุณถูกตั้งค่าเป็น Ignore (ไม่ต้องติดตามวันลาประจำปี)'
                : 'ไม่พบบัญชีพนักงานที่ติดตามวันลาในสาขานี้'}
            </p>
            <p className="text-[10px] sm:text-[11px] text-[#6B8F8E] mt-1">
              {isPersonalMode && isCurrentUserIgnored
                ? `สำหรับปี ${activeQuotaYear} บัญชีนี้ไม่ต้องติดตามโควต้าวันลา (สามารถปรับแก้ได้ที่ User Security Settings)`
                : 'สามารถตรวจสอบรายชื่อหรือสถานะ Ignore ได้ที่เมนู "User Security Settings -> ตั้งค่าวันลาประจำปี"'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredEmployeeQuotas.map((emp) => {
              const isOwnAccount = isCurrentUser(emp.name);
              return (
                <div 
                  key={emp.id} 
                  className={`rounded-2xl p-3.5 space-y-3 transition-shadow ${
                    isOwnAccount 
                      ? 'bg-[#F0F7F6] border-2 border-[#5A8A88] shadow-xs' 
                      : 'bg-[#F8FCFC] border border-[#D4E4E3] hover:shadow-xs'
                  }`}
                >
                  
                  {/* Staff Header */}
                  <div className="flex items-center gap-2.5 border-b border-[#D4E4E3]/60 pb-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs shrink-0 ${
                      isOwnAccount ? 'bg-[#2D4A49] text-white' : 'bg-[#5A8A88] text-white'
                    }`}>
                      {emp.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-xs font-bold text-[#2D4A49] truncate">{emp.name}</h3>
                        {isOwnAccount && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#5A8A88] text-white whitespace-nowrap">
                            ⭐ บัญชีของคุณ
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#5A8A88] font-semibold truncate">{emp.role}</p>
                      <p className="text-[9.5px] text-[#6B8F8E] font-medium">📍 สาขา {emp.branch}</p>
                    </div>
                  </div>

                  {/* Leave Quota Progress Bars */}
                  <div className="space-y-2 text-xs">
                    
                    {/* 1. ลาพักร้อน */}
                    <div>
                      <div className="flex justify-between text-[10.5px] sm:text-[11px] mb-0.5">
                        <span className="font-semibold text-slate-700">🏖️ ลาพักร้อน (Vacation Leave)</span>
                        <span className="font-bold text-emerald-700">{emp.vacationRemaining} / {emp.vacationTotal} วัน</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${emp.vacationTotal > 0 ? Math.min(100, (emp.vacationRemaining / emp.vacationTotal) * 100) : 0}%` }} />
                      </div>
                    </div>

                    {/* 2. ลาพักประจำวันเกิด */}
                    <div>
                      <div className="flex justify-between text-[10.5px] sm:text-[11px] mb-0.5">
                        <span className="font-semibold text-slate-700">🎂 ลาพักประจำวันเกิด (Birthday Leave)</span>
                        <span className="font-bold text-amber-600">{emp.birthdayRemaining} / {emp.birthdayTotal} วัน</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${emp.birthdayTotal > 0 ? Math.min(100, (emp.birthdayRemaining / emp.birthdayTotal) * 100) : 0}%` }} />
                      </div>
                    </div>

                    {/* 3. ลากิจ */}
                    <div>
                      <div className="flex justify-between text-[10.5px] sm:text-[11px] mb-0.5">
                        <span className="font-semibold text-slate-700">💼 ลากิจ (Personal Leave)</span>
                        <span className="font-bold text-purple-700">{emp.personalRemaining} / {emp.personalTotal} วัน</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-purple-600 h-full rounded-full" style={{ width: `${emp.personalTotal > 0 ? Math.min(100, (emp.personalRemaining / emp.personalTotal) * 100) : 0}%` }} />
                      </div>
                    </div>

                    {/* 4. ลาป่วย */}
                    <div>
                      <div className="flex justify-between text-[10.5px] sm:text-[11px] mb-0.5">
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
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-[#D4E4E3] shadow-xs space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-[13px] sm:text-[14px] font-bold text-slate-800 tracking-tight">
              {isPersonalActive ? 'ประวัติการลาของคุณ' : 'ประวัติการลาทั้งหมดของทีม'}{' '}
              <span className="text-[11px] sm:text-[12px] text-slate-400 font-medium">
                {isPersonalActive ? '(Your Leave Requests History)' : '(All Leave Requests History)'}
              </span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#6B8F8E] mt-0.5">
              {isPersonalActive
                ? 'แสดงรายการคำขอลาของคุณในระบบ สามารถกรองตามปี และสถานะได้'
                : 'แสดงรายการคำขอลาทั้งหมดในระบบ สามารถค้นหา กรองตามปี/สาขา และสถานะได้'
              }
            </p>
          </div>

          {/* Search & Comprehensive Filters */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Search Box (Leave Dashboard Only) */}
            {!isPersonalActive && (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อพนักงาน, ชนิดการลา..."
                  className="pl-8 pr-3 py-1.5 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl text-[11px] sm:text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#5A8A88] w-44 sm:w-52"
                />
              </div>
            )}

            {/* Year Filter Tool */}
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="px-2.5 py-1.5 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl text-[11px] sm:text-xs text-[#2D4A49] font-semibold focus:outline-none focus:border-[#5A8A88] cursor-pointer"
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
              className="px-2.5 py-1.5 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl text-[11px] sm:text-xs text-slate-700 font-medium focus:outline-none focus:border-[#5A8A88] cursor-pointer"
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
              <tr className="bg-[#2D4A49] text-white text-[10px] sm:text-[11px] uppercase tracking-wider font-bold">
                <th className="p-2.5 sm:p-3">ชื่อพนักงาน</th>
                <th className="p-2.5 sm:p-3">สาขา</th>
                <th className="p-2.5 sm:p-3">ประเภทการลา</th>
                <th className="p-2.5 sm:p-3">ช่วงวันที่ลา (From - To)</th>
                <th className="p-2.5 sm:p-3 text-center">จำนวนวัน</th>
                <th className="p-2.5 sm:p-3">เหตุผล (Description)</th>
                <th className="p-2.5 sm:p-3 text-center">สถานะ (Status)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4E4E3] text-[11px] sm:text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <div className="py-4 space-y-1">
                      <p className="text-[11px] sm:text-xs font-bold text-slate-600">
                        {isPersonalActive 
                          ? `คุณยังไม่มีประวัติการลาในระบบ (ปี ${selectedYear === 'all' ? 'ทั้งหมด' : selectedYear})`
                          : `ยังไม่มีประวัติการลาในระบบ (ปี ${selectedYear === 'all' ? 'ทั้งหมด' : selectedYear})`
                        }
                      </p>
                      <p className="text-[10px] text-[#6B8F8E]">
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
                    <td className="p-2.5 sm:p-3 font-bold text-[#2D4A49] whitespace-nowrap">
                      {item.userName}
                    </td>
                    <td className="p-2.5 sm:p-3 text-slate-600 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-[#E8F3F2] text-[#5A8A88] text-[10px] font-semibold">
                        {item.userBranch}
                      </span>
                    </td>
                    <td className="p-2.5 sm:p-3 whitespace-nowrap font-medium text-slate-700">
                      {item.leaveTypeName}
                    </td>
                    <td className="p-2.5 sm:p-3 whitespace-nowrap font-medium text-slate-800">
                      📅 {item.fromDate} ถึง {item.toDate}
                    </td>
                    <td className="p-2.5 sm:p-3 text-center font-bold text-[#5A8A88] whitespace-nowrap">
                      {item.totalDays} วัน
                    </td>
                    <td className="p-2.5 sm:p-3 text-slate-600 max-w-xs truncate" title={item.description}>
                      {item.description || '-'}
                    </td>
                    <td className="p-2.5 sm:p-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${
                        item.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        item.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {item.status === 'Pending' ? '⏳ รออนุมัติ' : item.status === 'Approved' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'}
                      </span>
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

