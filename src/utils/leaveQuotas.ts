import { supabase } from '../lib/supabase';

export interface EmployeeAnnualLeaveQuota {
  vacation: number; // ลาพักร้อน
  birthday: number; // ลาพักประจำวันเกิด
  personal: number; // ลากิจ
  sick: number;     // ลาป่วย
  ignored?: boolean; // ไม่ติดตามวันลา (Ignore)
  birthDate?: string; // วันเกิดพนักงาน (YYYY-MM-DD)
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

/**
 * Parse month & day (1-based) from YYYY-MM-DD or MM-DD string.
 */
export function parseBirthMonthDay(birthDate?: string | null): { month: number; day: number } | null {
  if (!birthDate || typeof birthDate !== 'string') return null;
  const trimmed = birthDate.trim();
  if (!trimmed) return null;

  const fullMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (fullMatch) {
    const month = parseInt(fullMatch[2], 10);
    const day = parseInt(fullMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { month, day };
    }
  }

  const mdMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})$/);
  if (mdMatch) {
    const month = parseInt(mdMatch[1], 10);
    const day = parseInt(mdMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { month, day };
    }
  }

  return null;
}

/**
 * Normalize YYYY-MM-DD or MM-DD string into canonical 'MM-DD' (day & month only, applies across all years).
 */
export function normalizeBirthMonthDay(birthDate?: string | null): string {
  const md = parseBirthMonthDay(birthDate);
  if (!md) return '';
  return `${String(md.month).padStart(2, '0')}-${String(md.day).padStart(2, '0')}`;
}

/**
 * Returns true if the current date has strictly passed the employee's birthday
 * for the specified quota calendar year (e.g., today > YYYY-MM-DD in that year).
 * On the birthday itself, returns false so birthday leave remains usable that day.
 */
export function isBirthdayPassedInYear(
  birthDate?: string | null,
  year?: string | number,
  referenceDate: Date = new Date()
): boolean {
  const md = parseBirthMonthDay(birthDate);
  if (!md) return false;

  const targetYear = Number(year) || referenceDate.getFullYear();
  const nowYear = referenceDate.getFullYear();

  if (targetYear < nowYear) return true;
  if (targetYear > nowYear) return false;

  const nowMonth = referenceDate.getMonth() + 1;
  const nowDay = referenceDate.getDate();

  // Handle Feb 29 safely in non-leap years
  const daysInTargetMonth = new Date(targetYear, md.month, 0).getDate();
  const effectiveDay = Math.min(md.day, daysInTargetMonth);

  if (nowMonth > md.month) return true;
  if (nowMonth === md.month && nowDay > effectiveDay) return true;
  return false;
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

  const cleanBirthDate = normalizeBirthMonthDay(quota?.birthDate) || undefined;

  return {
    vacation: parseNum(quota?.vacation, DEFAULT_ANNUAL_LEAVE_QUOTA.vacation),
    birthday: parseNum(quota?.birthday, DEFAULT_ANNUAL_LEAVE_QUOTA.birthday),
    personal: parseNum(quota?.personal, DEFAULT_ANNUAL_LEAVE_QUOTA.personal),
    sick: parseNum(quota?.sick, DEFAULT_ANNUAL_LEAVE_QUOTA.sick),
    ignored: Boolean(quota?.ignored),
    ...(cleanBirthDate ? { birthDate: cleanBirthDate } : {}),
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

/**
 * Find the employee's configured birthDate (MM-DD) across explicit emp prop or any year entry in quotasByYear.
 */
export function getEmployeeBirthDate(
  quotasByYear: AnnualLeaveQuotasByYear,
  emp: { id?: string; name?: string; branch?: string; birthDate?: string; birth_date?: string }
): string {
  const direct = normalizeBirthMonthDay(emp.birthDate || emp.birth_date);
  if (direct) return direct;

  const targetName = (emp.name || '').trim().toLowerCase();
  const targetBranch = normalizeBranchKey(emp.branch);
  const compositeKey = `${targetName}__${targetBranch}`;

  const years = Object.keys(quotasByYear || {}).sort().reverse();
  for (const yr of years) {
    const yearMap = quotasByYear[yr];
    if (!yearMap || typeof yearMap !== 'object') continue;

    if (emp.id && yearMap[emp.id]?.birthDate) {
      const normalized = normalizeBirthMonthDay(yearMap[emp.id].birthDate);
      if (normalized) return normalized;
    }
    if (yearMap[compositeKey]?.birthDate) {
      const normalized = normalizeBirthMonthDay(yearMap[compositeKey].birthDate);
      if (normalized) return normalized;
    }
    if (targetName && yearMap[targetName]?.birthDate) {
      const normalized = normalizeBirthMonthDay(yearMap[targetName].birthDate);
      if (normalized) return normalized;
    }
    if (targetName) {
      const matched = Object.values(yearMap).find((entry) => {
        if (!entry?.birthDate || !entry.userName) return false;
        if (entry.userName.trim().toLowerCase() !== targetName) return false;
        if (!targetBranch || !entry.branch) return true;
        return normalizeBranchKey(entry.branch) === targetBranch;
      });
      if (matched?.birthDate) {
        const normalized = normalizeBirthMonthDay(matched.birthDate);
        if (normalized) return normalized;
      }
    }
  }

  return '';
}

export function getEmployeeQuotaForYear(
  quotasByYear: AnnualLeaveQuotasByYear,
  year: string,
  emp: { id?: string; name?: string; branch?: string; birthDate?: string; birth_date?: string }
): EmployeeAnnualLeaveQuota {
  const knownBirthDate = getEmployeeBirthDate(quotasByYear, emp);

  const applyAutoBirthdayRule = (q: EmployeeAnnualLeaveQuota): EmployeeAnnualLeaveQuota => {
    const effectiveBirth = q.birthDate || knownBirthDate || undefined;
    const passed = effectiveBirth ? isBirthdayPassedInYear(effectiveBirth, year) : false;
    return {
      ...q,
      ...(effectiveBirth ? { birthDate: effectiveBirth } : {}),
      birthday: passed ? 0 : q.birthday,
    };
  };

  const yearMap = quotasByYear?.[year];
  if (!yearMap || typeof yearMap !== 'object') {
    return applyAutoBirthdayRule({ ...DEFAULT_ANNUAL_LEAVE_QUOTA });
  }

  // 1. Exact ID match
  if (emp.id && yearMap[emp.id]) {
    return applyAutoBirthdayRule(sanitizeQuotaNumbers(yearMap[emp.id]));
  }

  const targetName = (emp.name || '').trim().toLowerCase();
  const targetBranch = normalizeBranchKey(emp.branch);

  // 2. Fallback composite keys
  const compositeKey = `${targetName}__${targetBranch}`;
  if (yearMap[compositeKey]) {
    return applyAutoBirthdayRule(sanitizeQuotaNumbers(yearMap[compositeKey]));
  }
  if (targetName && yearMap[targetName]) {
    return applyAutoBirthdayRule(sanitizeQuotaNumbers(yearMap[targetName]));
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
      return applyAutoBirthdayRule(sanitizeQuotaNumbers(matchedEntry));
    }
  }

  return applyAutoBirthdayRule({ ...DEFAULT_ANNUAL_LEAVE_QUOTA });
}

export function mergeQuotasByYear(
  base: AnnualLeaveQuotasByYear,
  incoming: AnnualLeaveQuotasByYear
): AnnualLeaveQuotasByYear {
  const merged: AnnualLeaveQuotasByYear = { ...base };
  Object.entries(incoming || {}).forEach(([yr, yearMap]) => {
    if (!yearMap || typeof yearMap !== 'object') return;
    const existingYearMap = merged[yr] || {};
    const nextYearMap: YearLeaveQuotasMap = { ...existingYearMap };
    Object.entries(yearMap).forEach(([empKey, val]) => {
      const prevEntry = existingYearMap[empKey];
      nextYearMap[empKey] = sanitizeQuotaNumbers({
        ...val,
        birthDate: val?.birthDate || prevEntry?.birthDate,
      });
    });
    merged[yr] = nextYearMap;
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
      let { data: tableRows, error: tableErr } = await supabase
        .from(LEAVE_QUOTAS_TABLE)
        .select('id, year, user_id, user_name, branch, birth_date, vacation_days, birthday_days, personal_days, sick_days, is_ignored');

      // Fallback if birth_date column hasn't been added via SQL yet
      if (tableErr && (tableErr.code === '42703' || tableErr.code === 'PGRST204' || tableErr.message?.includes('birth_date'))) {
        const retry = await supabase
          .from(LEAVE_QUOTAS_TABLE)
          .select('id, year, user_id, user_name, branch, vacation_days, birthday_days, personal_days, sick_days, is_ignored');
        tableRows = retry.data as any;
        tableErr = retry.error;
      }

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
            ignored: Boolean(row.is_ignored),
            birthDate: row.birth_date || undefined,
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
  // Ensure auto-birthday-zero rule is normalized across every year before saving
  const normalizedToSave: AnnualLeaveQuotasByYear = {};
  Object.entries(quotasByYear || {}).forEach(([yr, yearMap]) => {
    if (!yearMap || typeof yearMap !== 'object') return;
    normalizedToSave[yr] = {};
    Object.entries(yearMap).forEach(([empKey, rawQ]) => {
      const q = sanitizeQuotaNumbers(rawQ);
      const passed = q.birthDate ? isBirthdayPassedInYear(q.birthDate, yr) : false;
      normalizedToSave[yr][empKey] = {
        ...q,
        birthday: passed ? 0 : q.birthday,
      };
    });
  });

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LEAVE_QUOTAS_STORAGE_KEY, JSON.stringify(normalizedToSave));
    } catch (e) {
      console.warn('LocalStorage write crenn_employee_leave_quotas error:', e);
    }
  }

  if (supabase) {
    let settingsErrorMsg = '';
    let tableErrorMsg = '';

    // 1. Save JSON snapshot to app_settings (includes birthDate reliably)
    try {
      const { error } = await supabase.from('app_settings').upsert(
        {
          branch: 'GLOBAL',
          setting_key: LEAVE_QUOTAS_SETTING_KEY,
          setting_value: normalizedToSave,
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
      const rows = Object.entries(normalizedToSave).flatMap(([yr, yearMap]) =>
        Object.entries(yearMap || {}).map(([empKey, q]) => ({
          id: `${yr}__${empKey}`,
          year: yr,
          user_id: empKey,
          user_name: q.userName || '',
          branch: q.branch || 'Rayong',
          birth_date: q.birthDate || '',
          vacation_days: q.vacation,
          birthday_days: q.birthday,
          personal_days: q.personal,
          sick_days: q.sick,
          is_ignored: Boolean(q.ignored),
          updated_at: nowIso,
        }))
      );

      if (rows.length > 0) {
        let { error: tableErr } = await supabase
          .from(LEAVE_QUOTAS_TABLE)
          .upsert(rows, { onConflict: 'year,user_id' });

        // Fallback retry if birth_date column hasn't been added via SQL yet
        if (tableErr && (tableErr.code === '42703' || tableErr.code === 'PGRST204' || tableErr.message?.includes('birth_date'))) {
          const fallbackRows = rows.map(({ birth_date: _bd, ...rest }) => rest);
          const retryRes = await supabase
            .from(LEAVE_QUOTAS_TABLE)
            .upsert(fallbackRows, { onConflict: 'year,user_id' });
          tableErr = retryRes.error;
        }

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
