import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { STANDARD_CLASSES } from './tokens';

/**
 * Formats a Date into local YYYY-MM-DD (prevents UTC offset drift).
 */
export function toLocalDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Ensures start <= end; if start > end, snaps the adjusted bound cleanly.
 */
export function normalizeDateRange(
  startDate: string,
  endDate: string,
  changedField: 'start' | 'end'
): { startDate: string; endDate: string } {
  if (!startDate || !endDate) return { startDate, endDate };
  if (startDate > endDate) {
    return changedField === 'start'
      ? { startDate, endDate: startDate }
      : { startDate: endDate, endDate };
  }
  return { startDate, endDate };
}

/**
 * Formats YYYY-MM-DD as dd/MM/yyyy for Thai dashboard labels.
 */
export function formatThaiNumericDate(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

export interface DateRangeOption<T extends string = string> {
  id: T;
  label: string;
}

export interface DateRangeFilterProps<T extends string = string> {
  options: DateRangeOption<T>[];
  activeRange: T;
  onRangeChange: (rangeId: T) => void;
  /** Value identifying the custom date-picker option (e.g. 'custom' or 'Custom') */
  customRangeId?: T;
  startDate?: string;
  endDate?: string;
  onDateChange?: (start: string, end: string) => void;
  onApplyCustom?: () => void;
  applyLabel?: string;
  rangeSummary?: string;
  label?: string;
  className?: string;
}

/**
 * Standard Quick-Range Tabs + Validated Custom Date Picker Bar
 * Spec: h-[32px], text-[11px], rounded-[8px]
 */
export function DateRangeFilter<T extends string = string>({
  options,
  activeRange,
  onRangeChange,
  customRangeId,
  startDate = '',
  endDate = '',
  onDateChange,
  onApplyCustom,
  applyLabel = 'ดูข้อมูล',
  rangeSummary,
  label,
  className,
}: DateRangeFilterProps<T>) {
  const showCustomInputs = customRangeId !== undefined && activeRange === customRangeId;
  const isCustomValid = Boolean(startDate && endDate && startDate <= endDate);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {label && (
          <span className="text-[11px] font-medium text-[#6B8F8E] whitespace-nowrap">
            {label}
          </span>
        )}
        <div className={STANDARD_CLASSES.dateTabGroup}>
          {options.map((opt) => {
            const isActive = opt.id === activeRange;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onRangeChange(opt.id)}
                className={isActive ? STANDARD_CLASSES.dateTabActive : STANDARD_CLASSES.dateTabInactive}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {rangeSummary && (
          <span className="text-[11px] text-[#6B8F8E] flex items-center gap-1 tabular-nums">
            <Calendar size={12} className="text-[#5A8A88] shrink-0" />
            <span>{rangeSummary}</span>
          </span>
        )}
      </div>

      {showCustomInputs && onDateChange && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#F0F5F4]">
          <span className="text-[11px] font-medium text-[#6B8F8E]">ตั้งแต่:</span>
          <input
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => {
              const next = normalizeDateRange(e.target.value, endDate, 'start');
              onDateChange(next.startDate, next.endDate);
            }}
            className={STANDARD_CLASSES.dateInput}
          />
          <span className="text-[11px] font-medium text-[#6B8F8E]">ถึง:</span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => {
              const next = normalizeDateRange(startDate, e.target.value, 'end');
              onDateChange(next.startDate, next.endDate);
            }}
            className={STANDARD_CLASSES.dateInput}
          />
          {onApplyCustom && (
            <button
              type="button"
              onClick={onApplyCustom}
              disabled={!isCustomValid}
              className={cn(
                'flex items-center gap-1.5 h-[32px] text-[11px] font-[600] rounded-[8px] px-3 transition-colors cursor-pointer',
                isCustomValid
                  ? 'bg-[#5A8A88] text-white hover:bg-[#476E6C] shadow-xs'
                  : 'bg-[#D4E4E3] text-slate-400 cursor-not-allowed'
              )}
            >
              <Search size={12} />
              <span>{applyLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export interface PeriodNavigatorProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  prevTitle?: string;
  nextTitle?: string;
  className?: string;
}

/**
 * Standard Period Navigator ([<] ช่วงวันที่ [>]) for weekly/monthly operational sheets.
 */
export const PeriodNavigator: React.FC<PeriodNavigatorProps> = ({
  label,
  onPrev,
  onNext,
  prevTitle = 'ช่วงก่อนหน้า',
  nextTitle = 'ช่วงถัดไป',
  className,
}) => (
  <div className={cn('flex items-center gap-1.5', className)}>
    <button
      type="button"
      onClick={onPrev}
      title={prevTitle}
      aria-label={prevTitle}
      className={STANDARD_CLASSES.periodArrowBtn}
    >
      <ChevronLeft size={14} />
    </button>
    <span className={STANDARD_CLASSES.periodBadge}>{label}</span>
    <button
      type="button"
      onClick={onNext}
      title={nextTitle}
      aria-label={nextTitle}
      className={STANDARD_CLASSES.periodArrowBtn}
    >
      <ChevronRight size={14} />
    </button>
  </div>
);

export default DateRangeFilter;
