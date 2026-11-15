import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { STANDARD_CLASSES } from './tokens';

export interface PageHeaderBannerProps {
  /** 'main' = Main Dashboard Header (Inventory, Leave); 'sub' = Operational / Report Sub-page Header */
  variant?: 'main' | 'sub';
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Optional contextual tag next to title (e.g. "ภาพรวมการลาของทีม") */
  contextLabel?: string;
  /** Optional branch label (e.g. "สาขาระยอง (Rayong)") */
  branchLabel?: string;
  /** Optional back handler for 'sub' variant */
  onBack?: () => void;
  /** Right-side controls in Row 1 (filters, CTA buttons, or period navigation) */
  actions?: React.ReactNode;
  /** Optional Row 2 toolbar separated by hairline divider (primarily for 'sub' variant) */
  toolbar?: React.ReactNode;
  className?: string;
}

export const PageHeaderBanner: React.FC<PageHeaderBannerProps> = ({
  variant = 'sub',
  title,
  subtitle,
  icon,
  contextLabel,
  branchLabel,
  onBack,
  actions,
  toolbar,
  className,
}) => {
  if (variant === 'main') {
    return (
      <section className={cn(STANDARD_CLASSES.headerMainCard, className)}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            {icon && (
              <div className={STANDARD_CLASSES.headerMainIconBox}>
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className={cn(STANDARD_CLASSES.headerMainTitle, 'whitespace-nowrap')}>
                  {title}
                </h1>
                {contextLabel && (
                  <span className="text-[10px] sm:text-[11px] font-bold text-[#5A8A88] bg-[#5A8A88]/15 px-2 py-0.5 rounded-md whitespace-nowrap">
                    {contextLabel}
                  </span>
                )}
                {branchLabel && (
                  <span className="text-[11px] sm:text-xs font-semibold text-[#2D4A49] bg-white px-2.5 py-0.5 rounded-full border border-[#D4E4E3] whitespace-nowrap">
                    {branchLabel}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className={cn(STANDARD_CLASSES.headerMainSubtitle, 'truncate sm:whitespace-normal')}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-stretch sm:self-auto justify-end">
              {actions}
            </div>
          )}
        </div>

        {toolbar && (
          <>
            <div className={STANDARD_CLASSES.headerDivider} />
            <div className="flex items-center justify-between gap-2 w-full flex-wrap">
              {toolbar}
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className={cn(STANDARD_CLASSES.headerSubCard, className)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              title="ย้อนกลับ"
              aria-label="ย้อนกลับ"
              className={STANDARD_CLASSES.headerSubBackBtn}
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
          )}
          {icon && (
            <div className={STANDARD_CLASSES.headerSubIconBox}>
              {icon}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className={STANDARD_CLASSES.headerSubTitle}>{title}</h1>
              {contextLabel && (
                <span className={STANDARD_CLASSES.headerSubBadge}>{contextLabel}</span>
              )}
              {branchLabel && (
                <span className={STANDARD_CLASSES.headerSubBadge}>{branchLabel}</span>
              )}
            </div>
            {subtitle && (
              <p className={cn(STANDARD_CLASSES.headerSubSubtitle, 'truncate')}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-1.5 self-start md:self-auto shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>

      {toolbar && (
        <>
          <div className={STANDARD_CLASSES.headerDivider} />
          <div className="flex items-center justify-between gap-2 w-full pt-0.5 flex-wrap">
            {toolbar}
          </div>
        </>
      )}
    </section>
  );
};

export default PageHeaderBanner;
