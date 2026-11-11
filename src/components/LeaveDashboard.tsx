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

export interface LeaveDashboardProps {
  user?: any;
  onNavigate?: (tab: string) => void;
  onOpenLeaveModal?: () => void;
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
  maternityRemaining: number;
  maternityTotal: number;
}

// Initial mock staff quota list
const MOCK_EMPLOYEE_QUOTAS: EmployeeQuotaSummary[] = [
  {
    id: 'emp-1',
    name: 'Kittapong (Sun)',
    role: 'Admin / Manager',
    branch: 'Rayong',
    avatar: 'S',
    sickRemaining: 28,
    sickTotal: 30,
    personalRemaining: 5,
    personalTotal: 6,
    vacationRemaining: 7,
    vacationTotal: 10,
    maternityRemaining: 90,
    maternityTotal: 90,
  },
  {
    id: 'emp-2',
    name: 'Somchai Jaidee',
    role: 'Barista Leader',
    branch: 'Rayong',
    avatar: 'S',
    sickRemaining: 30,
    sickTotal: 30,
    personalRemaining: 4,
    personalTotal: 6,
    vacationRemaining: 5,
    vacationTotal: 10,
    maternityRemaining: 90,
    maternityTotal: 90,
  },
  {
    id: 'emp-3',
    name: 'Jane Bakery Manager',
    role: 'Chef / Bakery Manager',
    branch: 'Bangkok',
    avatar: 'J',
    sickRemaining: 25,
    sickTotal: 30,
    personalRemaining: 6,
    personalTotal: 6,
    vacationRemaining: 8,
    vacationTotal: 10,
    maternityRemaining: 90,
    maternityTotal: 90,
  },
  {
    id: 'emp-4',
    name: 'Nattapong Staff',
    role: 'Service Staff',
    branch: 'Rayong',
    avatar: 'N',
    sickRemaining: 29,
    sickTotal: 30,
    personalRemaining: 3,
    personalTotal: 6,
    vacationRemaining: 6,
    vacationTotal: 10,
    maternityRemaining: 90,
    maternityTotal: 90,
  },
  {
    id: 'emp-5',
    name: 'Bank Coffee Specialist',
    role: 'Barista',
    branch: 'Bangkok',
    avatar: 'B',
    sickRemaining: 27,
    sickTotal: 30,
    personalRemaining: 6,
    personalTotal: 6,
    vacationRemaining: 9,
    vacationTotal: 10,
    maternityRemaining: 90,
    maternityTotal: 90,
  },
];

export const LeaveDashboard: React.FC<LeaveDashboardProps> = ({
  user,
  onNavigate,
  onOpenLeaveModal,
}) => {
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date(2026, 10, 1)); // Default Nov 2026
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  // Fetch Leave Records from Supabase & LocalStorage
  const fetchAllLeaveData = async () => {
    setLoading(true);
    let records: LeaveRecord[] = [];

    // 1. Fetch from LocalStorage as base
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

    // 2. Fetch from Supabase
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

          // Merge by unique ID
          const map = new Map<string, LeaveRecord>();
          records.forEach(r => map.set(r.id, r));
          fetchedSupabase.forEach(r => map.set(r.id, r));
          records = Array.from(map.values());
        }
      } catch (err) {
        console.warn('Supabase fetch notice:', err);
      }
    }

    // Add some sample data if empty for rich initial dashboard view
    if (records.length === 0) {
      records = [
        {
          id: 'LEAVE-SAMPLE-1',
          leaveType: 'vacation',
          leaveTypeName: 'ลาพักร้อน (Annual Leave)',
          fromDate: '2026-11-15',
          toDate: '2026-11-17',
          totalDays: 3,
          manager: 'Sunny Kumar Singh (ผู้จัดการสาขา)',
          status: 'Approved',
          description: 'พักผ่อนประจำปีกับครอบครัว',
          submittedAt: '10 พ.ย. 69 14:20 น.',
          userName: 'Somchai Jaidee',
          userBranch: 'Rayong',
        },
        {
          id: 'LEAVE-SAMPLE-2',
          leaveType: 'sick',
          leaveTypeName: 'ลาป่วย (Sick Leave)',
          fromDate: '2026-11-11',
          toDate: '2026-11-11',
          totalDays: 1,
          manager: 'Admin (ผู้ดูแลระบบ)',
          status: 'Approved',
          description: 'มีไข้สูงหมอนัดตรวจอาการที่โรงพยาบาล',
          submittedAt: '11 พ.ย. 69 08:00 น.',
          userName: 'Nattapong Staff',
          userBranch: 'Rayong',
        },
        {
          id: 'LEAVE-SAMPLE-3',
          leaveType: 'personal',
          leaveTypeName: 'ลากิจ (Personal Leave)',
          fromDate: '2026-11-20',
          toDate: '2026-11-21',
          totalDays: 2,
          manager: 'Kittapong (ผู้จัดการทั่วไป)',
          status: 'Pending',
          description: 'ไปติดต่อราชการทำบัตรประชาชนและเอกสารที่อำเภอ',
          submittedAt: '11 พ.ย. 69 11:30 น.',
          userName: 'Jane Bakery Manager',
          userBranch: 'Bangkok',
        },
        {
          id: 'LEAVE-SAMPLE-4',
          leaveType: 'vacation',
          leaveTypeName: 'ลาพักร้อน (Annual Leave)',
          fromDate: '2026-12-01',
          toDate: '2026-12-04',
          totalDays: 4,
          manager: 'Sunny Kumar Singh (ผู้จัดการสาขา)',
          status: 'Pending',
          description: 'เดินทางท่องเที่ยวต่างจังหวัดช่วงต้นเดือน',
          submittedAt: '11 พ.ย. 69 15:45 น.',
          userName: 'Bank Coffee Specialist',
          userBranch: 'Bangkok',
        },
      ];
    }

    setLeaveRecords(records);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllLeaveData();
  }, []);

  // Update status (Approve / Reject)
  const handleUpdateStatus = async (id: string, newStatus: 'Approved' | 'Rejected') => {
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

  // Helper date calculations
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Filtered leave records
  const filteredRecords = useMemo(() => {
    return leaveRecords.filter(r => {
      const matchesSearch = 
        r.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.leaveTypeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesBranch = selectedBranch === 'all' || 
        (selectedBranch === 'Rayong' && (r.userBranch.includes('ระยอง') || r.userBranch === 'Rayong')) ||
        (selectedBranch === 'Bangkok' && (r.userBranch.includes('กรุงเทพ') || r.userBranch === 'Bangkok'));

      const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;

      const matchesDate = !selectedDateFilter || (r.fromDate <= selectedDateFilter && r.toDate >= selectedDateFilter);

      return matchesSearch && matchesBranch && matchesStatus && matchesDate;
    });
  }, [leaveRecords, searchQuery, selectedBranch, selectedStatus, selectedDateFilter]);

  // Statistics
  const todayLeaves = useMemo(() => {
    return leaveRecords.filter(r => r.fromDate <= todayStr && r.toDate >= todayStr && r.status === 'Approved');
  }, [leaveRecords, todayStr]);

  const upcomingLeaves = useMemo(() => {
    return leaveRecords.filter(r => r.fromDate > todayStr && r.status !== 'Rejected');
  }, [leaveRecords, todayStr]);

  const pendingCount = useMemo(() => {
    return leaveRecords.filter(r => r.status === 'Pending').length;
  }, [leaveRecords]);

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
      const leavesOnThisDay = leaveRecords.filter(r => r.fromDate <= dateStr && r.toDate >= dateStr && r.status !== 'Rejected');
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        leaveItems: leavesOnThisDay,
      });
    }

    return days;
  }, [selectedMonth, leaveRecords]);

  const monthYearLabel = selectedMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* ── HEADER BANNER ── */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-xs border border-[#D4E4E3] border-t-4 border-t-[#5A8A88] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center text-xl font-bold border border-[#D4E4E3]">
              📊
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-[#2D4A49] tracking-tight">
                Leave Dashboard <span className="text-sm font-bold text-[#5A8A88]">(ภาพรวมการลาของทีม)</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                ติดตามการลาล่วงหน้า สถิติวันลาคงเหลือของพนักงาน และปฏิทินการลาในทีม
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenLeaveModal && (
            <button
              type="button"
              onClick={onOpenLeaveModal}
              className="px-4 py-2.5 rounded-xl bg-[#2D4A49] hover:bg-[#203635] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              ทำรายการลาหยุด (Leave Request)
            </button>
          )}
        </div>
      </div>

      {/* ── 1. TOP KPI SUMMARY CARDS (Inspired by Reference Design) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: On Leave Today */}
        <div className="bg-white border border-[#D4E4E3] rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">พนักงานที่ลาวันนี้</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              🤒
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">{todayLeaves.length}</span>
            <span className="text-xs text-slate-500 font-semibold">คน</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {todayLeaves.length > 0 ? todayLeaves.map(l => l.userName).join(', ') : 'ไม่มีพนักงานลาในวันนี้'}
          </p>
          <div className="w-full bg-amber-100 h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, todayLeaves.length * 25)}%` }} />
          </div>
        </div>

        {/* Card 2: Upcoming Leaves */}
        <div className="bg-white border border-[#D4E4E3] rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">การลาล่วงหน้า</span>
            <div className="w-8 h-8 rounded-xl bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center font-bold">
              🏖️
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#5A8A88]">{upcomingLeaves.length}</span>
            <span className="text-xs text-slate-500 font-semibold">รายการ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {upcomingLeaves.length > 0 ? `ลาล่วงหน้าตั้งแต่ ${upcomingLeaves[0].fromDate}` : 'ไม่มีรายการลาล่วงหน้า'}
          </p>
          <div className="w-full bg-[#E8F3F2] h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-[#5A8A88] h-full rounded-full" style={{ width: `${Math.min(100, upcomingLeaves.length * 20)}%` }} />
          </div>
        </div>

        {/* Card 3: Pending Approvals */}
        <div className="bg-white border border-[#D4E4E3] rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">คำขอรออนุมัติ</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
              ⏳
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-orange-600">{pendingCount}</span>
            <span className="text-xs text-slate-500 font-semibold">คำขอ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {pendingCount > 0 ? 'รอผู้จัดการดำเนินการอนุมัติ' : 'พิจารณาครบทุกรายการแล้ว'}
          </p>
          <div className="w-full bg-orange-100 h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-orange-500 h-full rounded-full" style={{ width: `${Math.min(100, pendingCount * 33)}%` }} />
          </div>
        </div>

        {/* Card 4: Total Requests */}
        <div className="bg-white border border-[#D4E4E3] rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">คำขอทั้งหมดในระบบ</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              📋
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-700">{leaveRecords.length}</span>
            <span className="text-xs text-slate-500 font-semibold">รายการ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            ครอบคลุมทุกประเภทการลาของทีม
          </p>
          <div className="w-full bg-purple-100 h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-purple-600 h-full rounded-full" style={{ width: '85%' }} />
          </div>
        </div>

      </div>

      {/* ── 2. MAIN TWO-COLUMN SECTION (Calendar & Upcoming Leaves) ── */}
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
            
            {/* Month Navigation */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg hover:bg-[#E8F3F2] text-[#5A8A88] transition-colors cursor-pointer"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-[#2D4A49] min-w-[110px] text-center capitalize">
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

        {/* RIGHT 5-COLUMNS: Upcoming & Advance Leaves (การลาล่วงหน้า) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-[#D4E4E3] shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#D4E4E3] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <h2 className="text-sm font-bold text-[#2D4A49]">
                  การลาล่วงหน้าของทีม <span className="text-xs text-slate-500 font-normal">(Advance Leaves)</span>
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F3F2] text-[#5A8A88]">
                {upcomingLeaves.length} รายการ
              </span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {upcomingLeaves.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-500">ไม่มีรายการลาล่วงหน้า</p>
                  <p className="text-[11px] text-slate-400 mt-1">พนักงานทั้งหมดปฏิบัติงานตามปกติ</p>
                </div>
              ) : (
                upcomingLeaves.map((record) => (
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
                          <p className="text-[10px] text-slate-400">{record.userBranch}</p>
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
              💡 ข้อมูลอัปเดตแบบเรียลไทม์จากระบบ Supabase
            </p>
          </div>
        </div>

      </div>

      {/* ── 3. EMPLOYEE LEAVE QUOTAS & REMAINING BALANCE SECTION ── */}
      <div className="bg-white rounded-2xl p-5 md:p-6 border border-[#D4E4E3] shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D4E4E3] pb-3">
          <div className="flex items-center gap-2.5">
            <Users size={18} className="text-[#5A8A88]" />
            <div>
              <h2 className="text-sm md:text-base font-bold text-[#2D4A49]">
                สิทธิ์วันลาคงเหลือของพนักงานรายบุคคล <span className="text-xs text-[#5A8A88] font-normal">(Employee Leave Quotas & Balances)</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                สรุปสิทธิ์คงเหลือแยกตามประเภท (ลาป่วย, ลากิจ, ลาพักร้อน, ลาคลอด) ของบุคลากรในทีม
              </p>
            </div>
          </div>
        </div>

        {/* Staff Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MOCK_EMPLOYEE_QUOTAS.map((emp) => (
            <div key={emp.id} className="bg-[#F8FCFC] border border-[#D4E4E3] rounded-2xl p-4 space-y-3 hover:shadow-xs transition-shadow">
              
              {/* Staff Header */}
              <div className="flex items-center gap-3 border-b border-[#D4E4E3]/60 pb-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#5A8A88] text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                  {emp.avatar}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-800 truncate">{emp.name}</h3>
                  <p className="text-[10px] text-[#5A8A88] font-semibold truncate">{emp.role}</p>
                  <p className="text-[9px] text-slate-400 font-medium">📍 สาขา {emp.branch}</p>
                </div>
              </div>

              {/* Leave Quota Progress Bars */}
              <div className="space-y-2 text-xs">
                
                {/* 1. ลาป่วย */}
                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="font-semibold text-slate-700">🤒 ลาป่วย (Sick Leave)</span>
                    <span className="font-bold text-rose-600">{emp.sickRemaining} / {emp.sickTotal} วัน</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full" style={{ width: `${(emp.sickRemaining / emp.sickTotal) * 100}%` }} />
                  </div>
                </div>

                {/* 2. ลากิจ */}
                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="font-semibold text-slate-700">💼 ลากิจ (Personal Leave)</span>
                    <span className="font-bold text-purple-700">{emp.personalRemaining} / {emp.personalTotal} วัน</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-600 h-full rounded-full" style={{ width: `${(emp.personalRemaining / emp.personalTotal) * 100}%` }} />
                  </div>
                </div>

                {/* 3. ลาพักร้อน */}
                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="font-semibold text-slate-700">🏖️ ลาพักร้อน (Vacation Leave)</span>
                    <span className="font-bold text-emerald-700">{emp.vacationRemaining} / {emp.vacationTotal} วัน</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${(emp.vacationRemaining / emp.vacationTotal) * 100}%` }} />
                  </div>
                </div>

              </div>

            </div>
          ))}
        </div>

      </div>

      {/* ── 4. ALL TEAM LEAVE REQUESTS TABLE (HISTORY & APPROVAL) ── */}
      <div className="bg-white rounded-2xl p-5 md:p-6 border border-[#D4E4E3] shadow-xs space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D4E4E3] pb-4">
          <div>
            <h2 className="text-base font-bold text-[#2D4A49]">
              ประวัติการลาทั้งหมดของทีม <span className="text-xs text-slate-500 font-normal">(All Leave Requests History)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              แสดงรายการคำขอลาทั้งหมดในระบบ สามารถค้นหา กรองข้อมูล และอนุมัติรายการได้
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อพนักงาน, ชนิดการลา..."
                className="pl-8 pr-3 py-1.5 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#5A8A88] w-48 sm:w-60"
              />
            </div>

            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-1.5 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-[#5A8A88] cursor-pointer"
            >
              <option value="all">ทุกสาขา (All Branches)</option>
              <option value="Rayong">สาขาระยอง</option>
              <option value="Bangkok">สาขากรุงเทพฯ</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-[#5A8A88] cursor-pointer"
            >
              <option value="all">ทุกสถานะ (All Status)</option>
              <option value="Pending">รออนุมัติ (Pending)</option>
              <option value="Approved">อนุมัติแล้ว (Approved)</option>
              <option value="Rejected">ไม่อนุมัติ (Rejected)</option>
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
                    ไม่พบรายการข้อมูลการลาที่ตรงตามเงื่อนไข
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
                      {item.status === 'Pending' ? (
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
