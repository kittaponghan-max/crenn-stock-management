import { supabase } from '../lib/supabase';

export interface EmployeeAnnualLeaveQuota {
  vacation: number; // ลาพักร้อน
  birthday: number; // ลาพักประจำวันเกิด
  personal: number; // ลากิจ
  sick: number;     // ลาป่วย
  userName?: string;
  branch?: string;
}

export type YearLeaveQuotasMap = Record<string, EmployeeAnnualLeaveQuota>;
export type AnnualLeaveQuotasByYear = Record<string, YearLeaveQuotasMap>;

export const DEFAULT_ANNUAL_LEAVE_QUOTA: EmployeeAnnualLeaveQuota = {
  vacation: 10,
  birthday: 1,
  personal: 6,
  sick: 30,
};

export const LEAVE_QUOTAS_STORAGE_KEY = 'crenn_employee_leave_quotas';
export const LEAVE_QUOTAS_SETTING_KEY = 'employee_leave_quotas';

export const STANDARD_LEAVE_QUOTA_YEARS = ['2024', '2025', '2026', '2027'];

export function normalizeBranchKey(branch?: string): string {
  if (!branch) return '';
  const b = branch.trim().toLowerCase();
  if (b === 'rayong' || b.includes('ระยอง')) return 'rayong';
  if (b === 'bangkok' || b.includes('กรุงเทพ')) return 'bangkok';
  return b;
}

export function sanitizeQuotaNumbers(
  quota?: Partial<EmployeeAnnualLeaveQuota> | null
): EmployeeAnnualLeaveQuota {
  const parseNum = (val: unknown, fallback: number): number => {
    if (val === undefined || val === null || val === '') return fallback;
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0) return fallback;
    return num;
  };

  return {
    vacation: parseNum(quota?.vacation, DEFAULT_ANNUAL_LEAVE_QUOTA.vacation),
    birthday: parseNum(quota?.birthday, DEFAULT_ANNUAL_LEAVE_QUOTA.birthday),
    personal: parseNum(quota?.personal, DEFAULT_ANNUAL_LEAVE_QUOTA.personal),
    sick: parseNum(quota?.sick, DEFAULT_ANNUAL_LEAVE_QUOTA.sick),
    ...(quota?.userName ? { userName: quota.userName } : {}),
    ...(quota?.branch ? { branch: quota.branch } : {}),
  };
}

export function getEmployeeQuotaKey(emp: {
  id?: string;
  name?: string;
  branch?: string;
}): string {
  if (emp.id && emp.id.trim()) return emp.id.trim();
  const normName = (emp.name || '').trim().toLowerCase();
  const normBranch = normalizeBranchKey(emp.branch);
  return `${normName}__${normBranch}`;
}

export function getEmployeeQuotaForYear(
  quotasByYear: AnnualLeaveQuotasByYear,
  year: string,
  emp: { id?: string; name?: string; branch?: string }
): EmployeeAnnualLeaveQuota {
  const yearMap = quotasByYear?.[year];
  if (!yearMap || typeof yearMap !== 'object') {
    return { ...DEFAULT_ANNUAL_LEAVE_QUOTA };
  }

  // 1. Exact ID match
  if (emp.id && yearMap[emp.id]) {
    return sanitizeQuotaNumbers(yearMap[emp.id]);
  }

  const targetName = (emp.name || '').trim().toLowerCase();
  const targetBranch = normalizeBranchKey(emp.branch);

  // 2. Fallback composite keys
  const compositeKey = `${targetName}__${targetBranch}`;
  if (yearMap[compositeKey]) {
    return sanitizeQuotaNumbers(yearMap[compositeKey]);
  }
  if (targetName && yearMap[targetName]) {
    return sanitizeQuotaNumbers(yearMap[targetName]);
  }

  // 3. Metadata match inside entries (handles regenerated IDs in local fallback)
  if (targetName) {
    const matchedEntry = Object.values(yearMap).find((entry) => {
      if (!entry || !entry.userName) return false;
      const entryName = entry.userName.trim().toLowerCase();
      if (entryName !== targetName) return false;
      if (!targetBranch || !entry.branch) return true;
      return normalizeBranchKey(entry.branch) === targetBranch;
    });
    if (matchedEntry) {
      return sanitizeQuotaNumbers(matchedEntry);
    }
  }

  return { ...DEFAULT_ANNUAL_LEAVE_QUOTA };
}

export function mergeQuotasByYear(
  base: AnnualLeaveQuotasByYear,
  incoming: AnnualLeaveQuotasByYear
): AnnualLeaveQuotasByYear {
  const merged: AnnualLeaveQuotasByYear = { ...base };
  Object.entries(incoming || {}).forEach(([yr, yearMap]) => {
    if (!yearMap || typeof yearMap !== 'object') return;
    merged[yr] = {
      ...(merged[yr] || {}),
      ...yearMap,
    };
  });
  return merged;
}

export async function fetchAnnualLeaveQuotas(): Promise<AnnualLeaveQuotasByYear> {
  let result: AnnualLeaveQuotasByYear = {};

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LEAVE_QUOTAS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          result = parsed;
        }
      }
    } catch (e) {
      console.warn('LocalStorage read crenn_employee_leave_quotas error:', e);
    }
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('branch, setting_value')
        .eq('setting_key', LEAVE_QUOTAS_SETTING_KEY);

      if (!error && data && data.length > 0) {
        let cloudMerged: AnnualLeaveQuotasByYear = {};
        // Merge non-GLOBAL first, then GLOBAL takes precedence
        data
          .filter((r: any) => r.branch !== 'GLOBAL' && r.setting_value && typeof r.setting_value === 'object')
          .forEach((r: any) => {
            cloudMerged = mergeQuotasByYear(cloudMerged, r.setting_value);
          });
        const globalRow = data.find(
          (r: any) => (r.branch === 'GLOBAL' || r.branch === 'Global') && r.setting_value && typeof r.setting_value === 'object'
        );
        if (globalRow) {
          cloudMerged = mergeQuotasByYear(cloudMerged, globalRow.setting_value);
        }

        if (Object.keys(cloudMerged).length > 0) {
          result = mergeQuotasByYear(result, cloudMerged);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(LEAVE_QUOTAS_STORAGE_KEY, JSON.stringify(result));
            } catch (e) {
              console.warn(e);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Supabase fetch employee_leave_quotas error:', e);
    }
  }

  return result;
}

export async function saveAnnualLeaveQuotas(
  quotasByYear: AnnualLeaveQuotasByYear
): Promise<{ success: boolean; error?: string }> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LEAVE_QUOTAS_STORAGE_KEY, JSON.stringify(quotasByYear));
    } catch (e) {
      console.warn('LocalStorage write crenn_employee_leave_quotas error:', e);
    }
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('app_settings').upsert(
        {
          branch: 'GLOBAL',
          setting_key: LEAVE_QUOTAS_SETTING_KEY,
          setting_value: quotasByYear,
        },
        { onConflict: 'branch,setting_key' }
      );
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Supabase save failed' };
    }
  }

  return { success: true };
}
