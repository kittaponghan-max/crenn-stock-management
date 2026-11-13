import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  UserCheck, 
  FileText, 
  CheckCircle2, 
  X, 
  AlertCircle, 
  ChevronDown, 
  Sparkles,
  History,
  Send,
  Info,
  Building,
  Code,
  Copy,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  AnnualLeaveQuotasByYear,
  fetchAnnualLeaveQuotas,
  getEmployeeQuotaForYear,
} from '../utils/leaveQuotas';

export interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userRole?: string;
  userBranch?: string;
}

export interface LeaveRecord {
  id: string;
  leaveType: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  manager: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  description: string;
  submittedAt: string;
  userName: string;
  userBranch: string;
}

interface LeaveQuota {
  id: string;
  nameTh: string;
  nameEn: string;
  emoji: string;
  total: number;
  used: number;
  remaining: number;
  unit: string;
}

const DEFAULT_QUOTAS: Record<string, LeaveQuota> = {
  vacation: {
    id: 'vacation',
    nameTh: 'ลาพักร้อน (Annual Leave)',
    nameEn: 'Annual Leave',
    emoji: '🏖️',
    total: 10,
    used: 0,
    remaining: 10,
    unit: 'วัน',
  },
  birthday: {
    id: 'birthday',
    nameTh: 'ลาพักประจำวันเกิด (Birthday Leave)',
    nameEn: 'Birthday Leave',
    emoji: '🎂',
    total: 1,
    used: 0,
    remaining: 1,
    unit: 'วัน',
  },
  personal: {
    id: 'personal',
    nameTh: 'ลากิจ (Personal Leave)',
    nameEn: 'Personal Leave',
    emoji: '💼',
    total: 6,
    used: 0,
    remaining: 6,
    unit: 'วัน',
  },
  sick: {
    id: 'sick',
    nameTh: 'ลาป่วย (Sick Leave)',
    nameEn: 'Sick Leave',
    emoji: '🤒',
    total: 30,
    used: 0,
    remaining: 30,
    unit: 'วัน',
  },
  maternity: {
    id: 'maternity',
    nameTh: 'ลาคลอด / ทำหมัน (Maternity Leave)',
    nameEn: 'Maternity Leave',
    emoji: '🤱',
    total: 90,
    used: 0,
    remaining: 90,
    unit: 'วัน',
  },
  other: {
    id: 'other',
    nameTh: 'ลาอื่นๆ (Other Leave)',
    nameEn: 'Other Leave',
    emoji: '📝',
    total: 30,
    used: 0,
    remaining: 30,
    unit: 'วัน',
  },
};

const MANAGERS = [
  'Sunny Kumar Singh (ผู้จัดการสาขา)',
  'Admin (ผู้ดูแลระบบ)',
  'HR Manager (ฝ่ายบุคคล)',
  'Kittapong (ผู้จัดการทั่วไป)',
];

const SQL_SCRIPT_STRING = `-- คำสั่ง SQL สำหรับสร้างตาราง leave_requests บน Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id VARCHAR(100) PRIMARY KEY,
    branch VARCHAR(100) NOT NULL DEFAULT 'Rayong',
    user_name VARCHAR(200) NOT NULL,
    leave_type VARCHAR(50) NOT NULL,
    leave_type_name VARCHAR(150) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    total_days INTEGER NOT NULL DEFAULT 1,
    manager VARCHAR(200),
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    description TEXT,
    submitted_at VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on leave_requests" 
ON public.leave_requests FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on leave_requests" 
ON public.leave_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on leave_requests" 
ON public.leave_requests FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on leave_requests" 
ON public.leave_requests FOR DELETE USING (true);`;

export const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({
  isOpen,
  onClose,
  userName = 'User',
  userRole = 'Staff',
  userBranch = 'Rayong',
}) => {
  const [activeTab, setActiveTab] = useState<'form' | 'history' | 'sql'>('form');
  const [leaveType, setLeaveType] = useState<string>('vacation');
  const [fromDate, setFromDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [manager, setManager] = useState<string>(MANAGERS[0]);
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<LeaveRecord[]>([]);
  const [quotasByYear, setQuotasByYear] = useState<AnnualLeaveQuotasByYear>({});
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Load records from Supabase (with LocalStorage fallback)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchRecords = async () => {
      // 1. Load local first as immediate fallback
      let localItems: LeaveRecord[] = [];
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('crenn_leave_requests');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              localItems = parsed;
              if (isMounted) setHistoryList(parsed);
            }
          }
        } catch (e) {
          console.error('Failed to parse local leave requests:', e);
        }
      }

      // 2. Fetch from Supabase if client exists
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('leave_requests')
            .select('*')
            .order('created_at', { ascending: false });

          if (data && !error && data.length > 0 && isMounted) {
            const formatted: LeaveRecord[] = data.map((item: any) => ({
              id: item.id || `LEAVE-${Date.now()}`,
              leaveType: item.leave_type || 'vacation',
              leaveTypeName: item.leave_type_name || 'ลาพักร้อน (Annual Leave)',
              fromDate: item.from_date || '',
              toDate: item.to_date || '',
              totalDays: item.total_days || 1,
              manager: item.manager || MANAGERS[0],
              status: item.status || 'Pending',
              description: item.description || '',
              submittedAt: item.submitted_at || '',
              userName: item.user_name || 'User',
              userBranch: item.branch || 'Rayong',
            }));
            setHistoryList(formatted);
          }
        } catch (err) {
          console.warn('Supabase fetch notice (using local storage):', err);
        }
      }

      // 3. Load configured annual leave quotas
      try {
        const loadedQuotas = await fetchAnnualLeaveQuotas();
        if (isMounted) setQuotasByYear(loadedQuotas);
      } catch (err) {
        console.warn('Error fetching annual leave quotas:', err);
      }
    };

    fetchRecords();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Compute calculated days
  const calculateDays = (start: string, end: string): number => {
    if (!start || !end) return 1;
    const d1 = new Date(start);
    const d2 = new Date(end);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 1;
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  };

  const totalRequestedDays = calculateDays(fromDate, toDate);
  const requestYear = fromDate && fromDate.length >= 4
    ? fromDate.substring(0, 4)
    : String(new Date().getFullYear());
  const userAnnualQuota = getEmployeeQuotaForYear(quotasByYear, requestYear, {
    name: userName,
    branch: userBranch,
  });

  const baseQuota = DEFAULT_QUOTAS[leaveType] || DEFAULT_QUOTAS['vacation'];
  const configuredTotal =
    leaveType === 'vacation' ? userAnnualQuota.vacation :
    leaveType === 'birthday' ? userAnnualQuota.birthday :
    leaveType === 'personal' ? userAnnualQuota.personal :
    leaveType === 'sick' ? userAnnualQuota.sick :
    baseQuota.total;

  const usedDays = historyList.reduce((acc, rec) => {
    if (rec.status !== 'Approved') return acc;
    if ((rec.userName || '').trim().toLowerCase() !== (userName || '').trim().toLowerCase()) return acc;
    const recYear = rec.fromDate?.substring(0, 4) || rec.toDate?.substring(0, 4);
    if (recYear && recYear !== requestYear) return acc;

    const t = `${rec.leaveType || ''} ${rec.leaveTypeName || ''}`.toLowerCase();
    const matchesType =
      (leaveType === 'birthday' && (t.includes('birthday') || t.includes('วันเกิด'))) ||
      (leaveType === 'sick' && (t.includes('sick') || t.includes('ป่วย'))) ||
      (leaveType === 'personal' && (t.includes('personal') || t.includes('กิจ'))) ||
      (leaveType === 'vacation' && (t.includes('vacation') || t.includes('พักร้อน') || t.includes('annual'))) ||
      (leaveType === 'maternity' && (t.includes('maternity') || t.includes('คลอด'))) ||
      (leaveType === 'other' && t.includes('other'));

    return matchesType ? acc + Number(rec.totalDays || 1) : acc;
  }, 0);

  const currentQuota: LeaveQuota = {
    ...baseQuota,
    total: configuredTotal,
    used: usedDays,
    remaining: Math.max(0, configuredTotal - usedDays),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert('กรุณากรอกเหตุผลการลา (Description)');
      return;
    }

    setIsSubmitting(true);

    const now = new Date();
    const formattedDateStr = `${now.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    })} ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;

    const newRecord: LeaveRecord = {
      id: `LEAVE-${Date.now()}`,
      leaveType,
      leaveTypeName: currentQuota.nameTh,
      fromDate,
      toDate,
      totalDays: totalRequestedDays,
      manager,
      status: 'Pending',
      description: description.trim(),
      submittedAt: formattedDateStr,
      userName,
      userBranch: userBranch === 'Rayong' ? 'สาขาระยอง' : 'สาขากรุงเทพฯ',
    };

    // 1. Save to Supabase if connected
    if (supabase) {
      try {
        await supabase.from('leave_requests').insert([{
          id: newRecord.id,
          branch: userBranch,
          user_name: userName,
          leave_type: leaveType,
          leave_type_name: currentQuota.nameTh,
          from_date: fromDate,
          to_date: toDate,
          total_days: totalRequestedDays,
          manager: manager,
          status: 'Pending',
          description: description.trim(),
          submitted_at: formattedDateStr,
        }]);
      } catch (err) {
        console.warn('Supabase insert warning (saved locally):', err);
      }
    }

    // 2. Save to LocalStorage
    const updatedList = [newRecord, ...historyList];
    setHistoryList(updatedList);
    try {
      localStorage.setItem('crenn_leave_requests', JSON.stringify(updatedList));
    } catch (err) {
      console.error(err);
    }

    setIsSubmitting(false);
    setShowSuccessToast(true);
    setDescription('');
    
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);
  };

  const handleCopySql = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(SQL_SCRIPT_STRING);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-[#D4E4E3] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="bg-[#2D4A49] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl shrink-0 border border-white/10">
              🏖️
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold truncate leading-tight">
                ทำรายการลา (Leave Request)
              </h2>
              <p className="text-[11px] text-[#A8BCBB] truncate mt-0.5 font-medium">
                ยื่นคำขอลาหยุดสำหรับพนักงาน • สาขา {userBranch === 'Rayong' ? 'ระยอง' : 'กรุงเทพฯ'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
            title="ปิดหน้าต่าง"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#D4E4E3] bg-[#F4F9F8] px-4 pt-2 gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'form'
                ? 'bg-white text-[#2D4A49] border-t-2 border-[#5A8A88] shadow-xs'
                : 'text-[#6B8F8E] hover:text-[#2D4A49]'
            }`}
          >
            <Send size={14} />
            ยื่นคำขอลา
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-white text-[#2D4A49] border-t-2 border-[#5A8A88] shadow-xs'
                : 'text-[#6B8F8E] hover:text-[#2D4A49]'
            }`}
          >
            <History size={14} />
            ประวัติการลา
            {historyList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#5A8A88] text-white font-bold">
                {historyList.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'sql'
                ? 'bg-white text-[#2D4A49] border-t-2 border-[#5A8A88] shadow-xs'
                : 'text-[#6B8F8E] hover:text-[#2D4A49]'
            }`}
          >
            <Code size={14} />
            คำสั่ง SQL (Supabase)
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {showSuccessToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span>ยื่นคำขอลาเรียบร้อยแล้ว! ระบบได้บันทึกข้อมูลเข้าสู่ระบบเรียบร้อย</span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowSuccessToast(false)}
                className="text-emerald-600 hover:text-emerald-900 cursor-pointer text-xs"
              >
                ปิด
              </button>
            </div>
          )}

          {activeTab === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* 1. Leave Type Selection (เลือกชนิดการลา) */}
              <div>
                <label className="block text-xs font-bold text-[#2D4A49] mb-1.5">
                  Leave Type <span className="text-slate-500 font-normal">(เลือกชนิดการลา)</span> <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="w-full bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/20 appearance-none cursor-pointer pr-10"
                  >
                    {Object.values(DEFAULT_QUOTAS).map((quota) => (
                      <option key={quota.id} value={quota.id}>
                        {quota.emoji} {quota.nameTh}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A8A88] pointer-events-none" />
                </div>
              </div>

              {/* 2. หัวข้อวันลาคงเหลือ (Remaining Leave Days) - Positon: Below Leave Type */}
              <div className="bg-[#E8F3F2] border border-[#D4E4E3] rounded-2xl p-4 shadow-xs relative overflow-hidden transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{currentQuota.emoji}</span>
                    <span className="text-xs font-bold text-[#2D4A49]">
                      หัวข้อวันลาคงเหลือ <span className="text-[#5A8A88] font-normal">({currentQuota.nameEn})</span>
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#5A8A88] text-white shadow-2xs">
                    คงเหลือ {currentQuota.remaining} {currentQuota.unit}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-[#D4E4E3]/60">
                  <div>
                    <p className="text-[10px] text-slate-500 font-medium">สิทธิ์ทั้งหมด</p>
                    <p className="text-sm font-bold text-slate-800">{currentQuota.total} <span className="text-[10px] font-normal text-slate-500">วัน</span></p>
                  </div>
                  <div className="border-x border-[#D4E4E3]/60">
                    <p className="text-[10px] text-slate-500 font-medium">ใช้ไปแล้ว</p>
                    <p className="text-sm font-bold text-rose-600">{currentQuota.used} <span className="text-[10px] font-normal text-slate-500">วัน</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#5A8A88] font-semibold">คงเหลือใช้งาน</p>
                    <p className="text-sm font-black text-[#5A8A88]">{currentQuota.remaining} <span className="text-[10px] font-semibold text-[#5A8A88]">วัน</span></p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2.5">
                  <div className="w-full bg-[#D4E4E3] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#5A8A88] h-full rounded-full transition-all duration-300"
                      style={{ width: `${currentQuota.total > 0 ? Math.min(100, Math.max(0, (currentQuota.remaining / currentQuota.total) * 100)) : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 3. Date Range (From - To) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#2D4A49]">
                    From - To <span className="text-slate-500 font-normal">(ช่วงวันที่ลา)</span> <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-semibold text-[#5A8A88] bg-[#E8F3F2] px-2 py-0.5 rounded-md">
                    รวม {totalRequestedDays} วัน
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 mb-1">ตั้งแต่วันที่ (From)</p>
                    <div className="relative">
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#5A8A88] cursor-pointer"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 mb-1">ถึงวันที่ (To)</p>
                    <div className="relative">
                      <input
                        type="date"
                        value={toDate}
                        min={fromDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#5A8A88] cursor-pointer"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Reporting Manager (ผู้บังคับบัญชา) */}
              <div>
                <label className="block text-xs font-bold text-[#2D4A49] mb-1.5">
                  Reporting Manager <span className="text-slate-500 font-normal">(ผู้บังคับบัญชา / ผู้รับแจ้ง)</span>
                </label>
                <div className="relative">
                  <select
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    className="w-full bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#5A8A88] appearance-none cursor-pointer pr-10"
                  >
                    {MANAGERS.map((m, idx) => (
                      <option key={idx} value={m}>{m}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A8A88] pointer-events-none" />
                </div>
              </div>

              {/* 5. Status (สถานะ) */}
              <div>
                <label className="block text-xs font-bold text-[#2D4A49] mb-1.5">
                  Status <span className="text-slate-500 font-normal">(สถานะคำขอ)</span>
                </label>
                <div className="flex items-center gap-2.5 px-3.5 py-2 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
                  <Clock size={16} className="text-amber-600 shrink-0" />
                  <span>Pending (รอการอนุมัติจากผู้จัดการ)</span>
                </div>
              </div>

              {/* 6. Description (เหตุผลการลา / รายละเอียด) */}
              <div>
                <label className="block text-xs font-bold text-[#2D4A49] mb-1.5">
                  Description <span className="text-slate-500 font-normal">(เหตุผลการลาประกอบ)</span> <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description (ระบุเหตุผลการลา เช่น มีไข้สูงหมอนัดตรวจ, ติดภารกิจทางครอบครัว)..."
                  className="w-full bg-[#F8FCFC] border border-[#D4E4E3] rounded-xl p-3 text-xs text-slate-800 font-normal focus:outline-none focus:border-[#5A8A88] focus:ring-2 focus:ring-[#5A8A88]/20 placeholder:text-slate-400 resize-none"
                  required
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#D4E4E3]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  ยกเลิก (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#2D4A49] hover:bg-[#203635] text-white shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      ยื่นคำขอลา (Submit)
                    </>
                  )}
                </button>
              </div>

            </form>
          ) : activeTab === 'history' ? (
            /* History Tab */
            <div className="space-y-3">
              {historyList.length === 0 ? (
                <div className="text-center py-10 bg-[#F8FCFC] rounded-2xl border border-dashed border-[#D4E4E3] p-6">
                  <div className="w-12 h-12 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center mx-auto mb-2">
                    <History size={20} />
                  </div>
                  <p className="text-xs font-bold text-slate-700">ยังไม่มีประวัติการยื่นคำขอลา</p>
                  <p className="text-[11px] text-slate-400 mt-1">คุณสามารถยื่นคำขอลาใหม่ได้ที่แท็บ "ยื่นคำขอลา"</p>
                </div>
              ) : (
                historyList.map((record) => (
                  <div key={record.id} className="bg-white border border-[#D4E4E3] rounded-2xl p-3.5 shadow-2xs hover:shadow-xs transition-shadow space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E8F3F2] text-[#5A8A88]">
                          {record.leaveTypeName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {record.submittedAt}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        record.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        record.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {record.status === 'Pending' ? '⏳ รออนุมัติ' : record.status === 'Approved' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800 bg-[#F8FCFC] p-2 rounded-xl border border-[#D4E4E3]/50">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-[#5A8A88]" />
                        <span>{record.fromDate} ถึง {record.toDate}</span>
                      </div>
                      <span className="text-[11px] font-bold text-[#5A8A88]">
                        ({record.totalDays} วัน)
                      </span>
                    </div>

                    {record.description && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-700">เหตุผล: </span> {record.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>ผู้รับแจ้ง: {record.manager}</span>
                      <span>{record.userBranch}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* SQL Script Tab */
            <div className="space-y-4">
              <div className="p-3 bg-[#E8F3F2] border border-[#D4E4E3] rounded-2xl flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <Code size={18} className="text-[#5A8A88] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold text-[#2D4A49]">โครงสร้างตาราง `leave_requests`</h3>
                    <p className="text-[11px] text-[#5A8A88] mt-0.5">
                      คัดลอกคำสั่ง SQL ด้านล่างไปรันใน <strong>Supabase Dashboard &gt; SQL Editor</strong> เพื่อสร้างตารางเก็บข้อมูลการลา
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3 py-1.5 rounded-xl bg-[#5A8A88] hover:bg-[#476E6C] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
                >
                  {copiedSql ? (
                    <>
                      <Check size={14} />
                      คัดลอกแล้ว
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      Copy SQL
                    </>
                  )}
                </button>
              </div>

              <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 text-emerald-400 p-4 font-mono text-[11px] leading-relaxed max-h-[320px] overflow-y-auto">
                <pre className="whitespace-pre-wrap select-all">{SQL_SCRIPT_STRING}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestModal;
