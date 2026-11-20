import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Image as ImageIcon, Loader2, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { STANDARD_CLASSES } from './tokens';

export interface ExcelExportConfig {
  /** Array of flat row objects with Thai/readable column headers as keys */
  rows: Record<string, string | number | boolean | null | undefined>[];
  fileName: string;
  sheetName?: string;
}

export interface PngExportConfig {
  /** Ref to the DOM container to capture as PNG */
  targetRef?: React.RefObject<HTMLElement | null>;
  /** Fallback DOM element id to capture as PNG */
  elementId?: string;
  /** Output file name ('.png' will be appended automatically if missing) */
  fileName: string;
  /** Background color for exported image (default '#FFFFFF') */
  backgroundColor?: string;
  /** Pixel ratio for crisp Retina/HiDPI capture (default 2) */
  pixelRatio?: number;
}

export interface ExportButtonProps {
  /** Custom Excel export handler (optional if excelConfig is provided) */
  onExportExcel?: () => void;
  /** Declarative Excel (.xlsx) export config using SheetJS */
  excelConfig?: ExcelExportConfig;
  /** Custom Image (.png) export handler (optional if pngConfig is provided) */
  onExportPng?: () => void | Promise<void>;
  /** Declarative Image (.png) export config using html-to-image */
  pngConfig?: PngExportConfig;
  /** Custom Print/PDF handler (defaults to window.print()) */
  onExportPrint?: () => void;
  disabled?: boolean;
  label?: string;
  excelLabel?: string;
  pngLabel?: string;
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

let cachedFontEmbedCSS: string | null = null;

async function buildSafeFontEmbedCSS(): Promise<string> {
  if (cachedFontEmbedCSS !== null) {
    return cachedFontEmbedCSS;
  }

  const chunks: string[] = [];
  const sheets = Array.from(document.styleSheets) as CSSStyleSheet[];

  for (const sheet of sheets) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      // Cross-origin stylesheet without CORS header: fetch Google Fonts CSS cleanly without console errors
      if (sheet.href && sheet.href.startsWith('https://fonts.googleapis.com')) {
        try {
          const res = await fetch(sheet.href);
          if (res.ok) {
            chunks.push(await res.text());
          }
        } catch {
          // Ignore network error silently
        }
      }
      continue;
    }

    if (!rules) continue;
    for (const rule of Array.from(rules) as CSSRule[]) {
      if (rule.type === CSSRule.FONT_FACE_RULE) {
        chunks.push(rule.cssText);
      }
    }
  }

  let combinedCss = chunks.join('\n');
  if (combinedCss) {
    const urlMatches = Array.from(combinedCss.matchAll(/url\(["']?(https:\/\/[^"')]+)["']?\)/g));
    const uniqueUrls = Array.from(new Set(urlMatches.map((m) => m[1])));
    await Promise.all(
      uniqueUrls.map(async (fontUrl) => {
        try {
          const res = await fetch(fontUrl);
          if (!res.ok) return;
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          if (dataUrl) {
            combinedCss = combinedCss.split(fontUrl).join(dataUrl);
          }
        } catch {
          // Ignore single font file error silently
        }
      })
    );
  }

  cachedFontEmbedCSS = combinedCss;
  return combinedCss;
}

/**
 * Helper to capture a DOM element cleanly as a high-resolution .png image.
 * Automatically waits for menus/popovers to unmount, syncs live form field values,
 * expands scrollable table containers so wide/long reports are not clipped,
 * embeds fonts safely without CORS SecurityError noise,
 * and skips controls marked with `data-export-ignore="true"` or `.print:hidden`.
 */
export async function exportElementToPng({
  targetRef,
  elementId,
  element,
  fileName,
  backgroundColor = '#FFFFFF',
  pixelRatio = 2,
}: {
  targetRef?: React.RefObject<HTMLElement | null>;
  elementId?: string;
  element?: HTMLElement | null;
  fileName: string;
  backgroundColor?: string;
  pixelRatio?: number;
}): Promise<void> {
  const target =
    element ?? targetRef?.current ?? (elementId ? document.getElementById(elementId) : null);
  if (!target) {
    console.warn('exportElementToPng: target element not found');
    return;
  }

  // Wait two animation frames so newly closed dropdown menus finish unmounting
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  // Track temporary style & attribute overrides so DOM is restored identically
  const styleRestores: Array<() => void> = [];
  const attrRestores: Array<() => void> = [];

  try {
    // 1. Sync live form values into HTML attributes for SVG <foreignObject> fidelity
    const inputs = target.querySelectorAll<HTMLInputElement>('input');
    inputs.forEach((input) => {
      if (input.type === 'checkbox' || input.type === 'radio') {
        const hadChecked = input.hasAttribute('checked');
        if (input.checked) {
          input.setAttribute('checked', 'checked');
        } else {
          input.removeAttribute('checked');
        }
        attrRestores.push(() => {
          if (hadChecked) input.setAttribute('checked', '');
          else input.removeAttribute('checked');
        });
      } else {
        const prevValAttr = input.getAttribute('value');
        input.setAttribute('value', input.value);
        attrRestores.push(() => {
          if (prevValAttr !== null) input.setAttribute('value', prevValAttr);
          else input.removeAttribute('value');
        });
      }
    });

    const textareas = target.querySelectorAll<HTMLTextAreaElement>('textarea');
    textareas.forEach((ta) => {
      const prevText = ta.textContent;
      ta.textContent = ta.value;
      attrRestores.push(() => {
        ta.textContent = prevText;
      });
    });

    const selects = target.querySelectorAll<HTMLSelectElement>('select');
    selects.forEach((sel) => {
      const options = Array.from(sel.options) as HTMLOptionElement[];
      const optionStates = options.map((opt) => ({
        opt,
        hadSelected: opt.hasAttribute('selected'),
      }));
      options.forEach((opt) => {
        if (opt.selected) opt.setAttribute('selected', 'selected');
        else opt.removeAttribute('selected');
      });
      attrRestores.push(() => {
        optionStates.forEach(({ opt, hadSelected }) => {
          if (hadSelected) opt.setAttribute('selected', '');
          else opt.removeAttribute('selected');
        });
      });
    });

    // 2. Temporarily expand scrollable containers so full table width & height are captured
    const candidates = [target, ...Array.from(target.querySelectorAll<HTMLElement>('*'))];
    candidates.forEach((el) => {
      if (el.getAttribute('data-export-ignore') === 'true' || el.classList?.contains('print:hidden')) {
        return;
      }
      const computed = window.getComputedStyle(el);
      const isScrollableX = computed.overflowX === 'auto' || computed.overflowX === 'scroll';
      const isScrollableY = computed.overflowY === 'auto' || computed.overflowY === 'scroll';
      const hasMaxHeight = computed.maxHeight && computed.maxHeight !== 'none';

      if (isScrollableX || isScrollableY || hasMaxHeight) {
        const prevOverflow = el.style.overflow;
        const prevOverflowX = el.style.overflowX;
        const prevOverflowY = el.style.overflowY;
        const prevMaxHeight = el.style.maxHeight;
        const prevWidth = el.style.width;
        const prevScrollLeft = el.scrollLeft;
        const prevScrollTop = el.scrollTop;

        el.style.overflow = 'visible';
        el.style.overflowX = 'visible';
        el.style.overflowY = 'visible';
        if (hasMaxHeight) el.style.maxHeight = 'none';
        if (el.scrollWidth > el.clientWidth) {
          el.style.width = `${el.scrollWidth}px`;
        }
        el.scrollLeft = 0;
        el.scrollTop = 0;

        styleRestores.push(() => {
          el.style.overflow = prevOverflow;
          el.style.overflowX = prevOverflowX;
          el.style.overflowY = prevOverflowY;
          el.style.maxHeight = prevMaxHeight;
          el.style.width = prevWidth;
          el.scrollLeft = prevScrollLeft;
          el.scrollTop = prevScrollTop;
        });
      }
    });

    // Ensure root captures full scrollWidth if wider than viewport
    const contentWidth = Math.max(target.scrollWidth, target.offsetWidth);
    const contentHeight = Math.max(target.scrollHeight, target.offsetHeight);
    const padding = 16;

    // Resolve fonts safely (bypassing html-to-image's noisy CSSStyleSheet.cssRules reader)
    const fontEmbedCSS = await Promise.race([
      buildSafeFontEmbedCSS(),
      new Promise<string>((resolve) => setTimeout(() => resolve(''), 2500)),
    ]);

    const { toPng } = await import('html-to-image');

    const baseOptions = {
      backgroundColor,
      pixelRatio,
      cacheBust: true,
      skipFonts: !fontEmbedCSS,
      fontEmbedCSS,
      width: contentWidth + padding * 2,
      height: contentHeight + padding * 2,
      style: {
        width: `${contentWidth + padding * 2}px`,
        height: `${contentHeight + padding * 2}px`,
        padding: `${padding}px`,
        boxSizing: 'border-box' as const,
        overflow: 'visible',
      },
      filter: (node: Node) => {
        if (node instanceof HTMLElement) {
          if (
            node.getAttribute('data-export-ignore') === 'true' ||
            node.getAttribute('data-print-hidden') === 'true' ||
            node.classList?.contains('print:hidden')
          ) {
            return false;
          }
        }
        return true;
      },
    };

    let dataUrl: string;
    try {
      dataUrl = await toPng(target, baseOptions);
    } catch {
      dataUrl = await toPng(target, { ...baseOptions, skipFonts: true, fontEmbedCSS: '' });
    }

    const baseName = fileName.replace(/\.(xlsx|pdf|png)$/i, '');
    const safeName = `${baseName}.png`;

    const link = document.createElement('a');
    link.download = safeName;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    styleRestores.reverse().forEach((restore) => restore());
    attrRestores.reverse().forEach((restore) => restore());
  }
}

/**
 * Standard Export Button with Excel (.xlsx) + Image (.png) + PDF / Print dropdown menu.
 * Spec: h-[32px], rounded-[8px], text-[11px] font-[500]
 */
export const ExportButton: React.FC<ExportButtonProps> = ({
  onExportExcel,
  excelConfig,
  onExportPng,
  pngConfig,
  onExportPrint,
  disabled = false,
  label = 'ส่งออก',
  excelLabel = 'Excel (.xlsx)',
  pngLabel = 'รูปภาพ (.png)',
  printLabel = 'PDF / พิมพ์',
  title = 'ส่งออกข้อมูล (Excel, รูปภาพ .png, PDF)',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
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
  const canExportPng = Boolean(onExportPng || pngConfig);

  const handleExcelClick = () => {
    setIsOpen(false);
    if (onExportExcel) {
      onExportExcel();
    } else if (excelConfig) {
      exportRowsToXlsx(excelConfig);
    }
  };

  const handlePngClick = async () => {
    setIsOpen(false);
    if (isExportingPng) return;
    setIsExportingPng(true);
    try {
      if (onExportPng) {
        await onExportPng();
      } else if (pngConfig) {
        await exportElementToPng(pngConfig);
      }
    } catch (error) {
      console.warn('Error exporting PNG:', error);
    } finally {
      setIsExportingPng(false);
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
    <div
      className={cn('relative shrink-0', className)}
      ref={menuRef}
      data-export-ignore="true"
    >
      <button
        type="button"
        onClick={() => !disabled && !isExportingPng && setIsOpen((prev) => !prev)}
        disabled={disabled || isExportingPng}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={title}
        className={STANDARD_CLASSES.exportButtonTrigger}
      >
        {isExportingPng ? (
          <Loader2 size={13} className="text-[#5A8A88] shrink-0 animate-spin" />
        ) : (
          <Download size={13} className="text-[#5A8A88] shrink-0" />
        )}
        <span>{isExportingPng ? 'กำลังส่งออก...' : label}</span>
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
          className="absolute right-0 mt-1.5 w-40 bg-white rounded-xl shadow-lg border border-[#D4E4E3] py-1 z-50"
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
          {canExportPng && (
            <button
              type="button"
              role="menuitem"
              onClick={handlePngClick}
              className="w-full px-3 py-2 text-left text-[11px] font-medium text-[#2D4A49] hover:bg-[#E8F3F2] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ImageIcon size={13} className="text-[#5A8A88] shrink-0" />
              <span>{pngLabel}</span>
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

