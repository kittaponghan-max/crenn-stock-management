import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';
import { STANDARD_CLASSES } from './tokens';

export interface StandardTableCardProps {
  children: React.ReactNode;
  maxHeightClassName?: string;
  className?: string;
}

export const StandardTableCard: React.FC<StandardTableCardProps> = ({
  children,
  maxHeightClassName,
  className,
}) => (
  <div className={cn(STANDARD_CLASSES.tableCard, className)}>
    <div className={cn('overflow-x-auto scrollbar-thin', maxHeightClassName && `overflow-y-auto ${maxHeightClassName}`)}>
      {children}
    </div>
  </div>
);

export interface StandardTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  fixedLayout?: boolean;
}

export const StandardTable: React.FC<StandardTableProps> = ({
  fixedLayout = false,
  className,
  children,
  ...rest
}) => (
  <table
    className={cn(
      'w-full text-left border-collapse',
      fixedLayout && 'table-fixed',
      className
    )}
    {...rest}
  >
    {children}
  </table>
);

export interface StandardTheadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  sticky?: boolean;
}

export const StandardThead: React.FC<StandardTheadProps> = ({
  sticky = true,
  className,
  children,
  ...rest
}) => (
  <thead
    className={cn(
      sticky && 'sticky top-0 z-20 shadow-2xs',
      className
    )}
    {...rest}
  >
    {children}
  </thead>
);

export interface StandardHeaderRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  level?: 'primary' | 'secondary';
}

export const StandardHeaderRow: React.FC<StandardHeaderRowProps> = ({
  level = 'primary',
  className,
  children,
  ...rest
}) => (
  <tr
    className={cn(
      level === 'primary'
        ? STANDARD_CLASSES.tableHeadPrimaryRow
        : STANDARD_CLASSES.tableHeadSubRow,
      className
    )}
    {...rest}
  >
    {children}
  </tr>
);

export interface StandardThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

export const StandardTh: React.FC<StandardThProps> = ({
  align = 'left',
  className,
  children,
  ...rest
}) => (
  <th
    className={cn(
      STANDARD_CLASSES.tableHeadCell,
      align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
      className
    )}
    {...rest}
  >
    {children}
  </th>
);

export const StandardTbody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  children,
  ...rest
}) => (
  <tbody className={cn(STANDARD_CLASSES.tableBody, className)} {...rest}>
    {children}
  </tbody>
);

export const StandardTr: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  className,
  children,
  ...rest
}) => (
  <tr className={cn(STANDARD_CLASSES.tableRow, className)} {...rest}>
    {children}
  </tr>
);

export interface StandardTdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
  numeric?: boolean;
}

export const StandardTd: React.FC<StandardTdProps> = ({
  align = 'left',
  numeric = false,
  className,
  children,
  ...rest
}) => (
  <td
    className={cn(
      STANDARD_CLASSES.tableCell,
      align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
      numeric && 'tabular-nums',
      className
    )}
    {...rest}
  >
    {children}
  </td>
);

export interface StandardTableEmptyProps {
  colSpan: number;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const StandardTableEmpty: React.FC<StandardTableEmptyProps> = ({
  colSpan,
  title,
  description,
  icon,
  action,
}) => (
  <tr>
    <td colSpan={colSpan} className="p-10 text-center">
      <div className="flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center mb-2.5">
          {icon || <Inbox size={22} />}
        </div>
        <p className="text-[13px] font-bold text-[#2D4A49]">{title}</p>
        {description && (
          <p className="text-[11px] text-[#6B8F8E] mt-1 max-w-md mx-auto">
            {description}
          </p>
        )}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </td>
  </tr>
);
