import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { STANDARD_CLASSES } from './tokens';

export interface ExcelExportConfig {
  /** Array of flat row objects with Thai/readable column headers as keys */
  rows: Record<string, string | number | boolean | null | undefined>[];
  fileName: string;
  sheetName?: string;
}

export interface ExportButtonProps {
  /** Custom Excel export handler (optional if excelConfig is provided) */
  onExportExcel?: () => void;
  /** Declarative Excel (.xlsx) export config using SheetJS */
  excelConfig?: ExcelExportConfig;
  /** Custom Print/PDF handler (defaults to window.print()) */
  onExportPrint?: () => void;
  disabled?: boolean;
  label?: string;
  excelLabel?: string;
  printLabel?: string;
  title?: string;
  className?: string;
}

/**
 * Helper to generate and download a UTF-8 safe .xlsx workbook.
 */
export function exportRowsToXlsx({
  rows,
  fileName,
  sheetName = 'Report',
}: ExcelExportConfig): void {
  const safeName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, safeName);
}

/**
 * Standard Export Button with Excel (.xlsx) + PDF / Print dropdown menu.
 * Spec: h-[32px], rounded-[8px], text-[11px] font-[500]
 */
export const ExportButton: React.FC<ExportButtonProps> = ({
  onExportExcel,
  excelConfig,
  onExportPrint,
  disabled = false,
  label = 'ส่งออก',
  excelLabel = 'Excel (.xlsx)',
  printLabel = 'PDF / พิมพ์',
  title = 'ส่งออกข้อมูล (Excel, PDF)',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const canExportExcel = Boolean(onExportExcel || excelConfig);

  const handleExcelClick = () => {
    setIsOpen(false);
    if (onExportExcel) {
      onExportExcel();
    } else if (excelConfig) {
      exportRowsToXlsx(excelConfig);
    }
  };

  const handlePrintClick = () => {
    setIsOpen(false);
    if (onExportPrint) {
      onExportPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className={cn('relative shrink-0', className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={title}
        className={STANDARD_CLASSES.exportButtonTrigger}
      >
        <Download size={13} className="text-[#5A8A88] shrink-0" />
        <span>{label}</span>
        <ChevronDown
          size={11}
          className={cn(
            'text-[#5A8A88] transition-transform duration-150 shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-36 bg-white rounded-xl shadow-lg border border-[#D4E4E3] py-1 z-50"
        >
          {canExportExcel && (
            <button
              type="button"
              role="menuitem"
              onClick={handleExcelClick}
              className="w-full px-3 py-2 text-left text-[11px] font-medium text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download size={13} className="text-[#5A8A88] shrink-0" />
              <span>{excelLabel}</span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={handlePrintClick}
            className="w-full px-3 py-2 text-left text-[11px] font-medium text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Printer size={13} className="text-[#5A8A88] shrink-0" />
            <span>{printLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportButton;
