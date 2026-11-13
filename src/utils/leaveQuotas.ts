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
export const LEAVE_QUOTAS_TABLE = 'employee_leave_quotas';

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
    // 1. Fetch from app_settings (cloud JSON backup)
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('branch, setting_value')
        .eq('setting_key', LEAVE_QUOTAS_SETTING_KEY);

      if (!error && data && data.length > 0) {
        let cloudMerged: AnnualLeaveQuotasByYear = {};
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
        }
      }
    } catch (e) {
      console.warn('Supabase fetch app_settings employee_leave_quotas error:', e);
    }

    // 2. Fetch directly from normalized employee_leave_quotas table (authoritative relational records)
    try {
      const { data: tableRows, error: tableErr } = await supabase
        .from(LEAVE_QUOTAS_TABLE)
        .select('id, year, user_id, user_name, branch, vacation_days, birthday_days, personal_days, sick_days');

      if (!tableErr && Array.isArray(tableRows) && tableRows.length > 0) {
        const fromTable: AnnualLeaveQuotasByYear = {};
        tableRows.forEach((row: any) => {
          if (!row?.year || !row?.user_id) return;
          const yr = String(row.year);
          const empKey = String(row.user_id);
          if (!fromTable[yr]) fromTable[yr] = {};
          fromTable[yr][empKey] = sanitizeQuotaNumbers({
            vacation: row.vacation_days,
            birthday: row.birthday_days,
            personal: row.personal_days,
            sick: row.sick_days,
            userName: row.user_name || undefined,
            branch: row.branch || undefined,
          });
        });

        if (Object.keys(fromTable).length > 0) {
          result = mergeQuotasByYear(result, fromTable);
        }
      }
    } catch (e) {
      console.warn('Supabase fetch employee_leave_quotas table notice:', e);
    }

    if (typeof window !== 'undefined' && Object.keys(result).length > 0) {
      try {
        localStorage.setItem(LEAVE_QUOTAS_STORAGE_KEY, JSON.stringify(result));
      } catch (e) {
        console.warn(e);
      }
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
    let settingsErrorMsg = '';
    let tableErrorMsg = '';

    // 1. Save JSON snapshot to app_settings
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
        settingsErrorMsg = error.message;
      }
    } catch (err: any) {
      settingsErrorMsg = err?.message || 'app_settings save failed';
    }

    // 2. Save normalized rows to employee_leave_quotas table
    try {
      const nowIso = new Date().toISOString();
      const rows: Array<{
        id: string;
        year: string;
        user_id: string;
        user_name: string;
        branch: string;
        vacation_days: number;
        birthday_days: number;
        personal_days: number;
        sick_days: number;
        updated_at: string;
      }> = [];

      Object.entries(quotasByYear || {}).forEach(([yr, yearMap]) => {
        if (!yearMap || typeof yearMap !== 'object') return;
        Object.entries(yearMap).forEach(([empKey, rawQ]) => {
          const q = sanitizeQuotaNumbers(rawQ);
          rows.push({
            id: `${yr}__${empKey}`,
            year: yr,
            user_id: empKey,
            user_name: q.userName || '',
            branch: q.branch || 'Rayong',
            vacation_days: q.vacation,
            birthday_days: q.birthday,
            personal_days: q.personal,
            sick_days: q.sick,
            updated_at: nowIso,
          });
        });
      });

      if (rows.length > 0) {
        const { error: tableErr } = await supabase
          .from(LEAVE_QUOTAS_TABLE)
          .upsert(rows, { onConflict: 'year,user_id' });
        if (tableErr) {
          tableErrorMsg = tableErr.message;
        }
      }
    } catch (err: any) {
      tableErrorMsg = err?.message || 'employee_leave_quotas table save failed';
    }

    if (tableErrorMsg && settingsErrorMsg) {
      return { success: false, error: tableErrorMsg || settingsErrorMsg };
    }
    if (tableErrorMsg) {
      return {
        success: false,
        error: `กรุณา Run SQL setup_employee_leave_quotas.sql บน Supabase (${tableErrorMsg})`,
      };
    }
    return { success: true };
  }

  return { success: true };
}
