/**
 * CRENN Cafe Management - Design Standard Tokens (v1.0)
 * Central source of truth for typography, colors, and component presets.
 */

export const CRENN_FONTS = {
  sans: "'Plus Jakarta Sans', 'Prompt', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const CRENN_COLORS = {
  primaryDark: '#2D4A49',
  primaryDarkHover: '#203635',
  primaryTeal: '#5A8A88',
  primaryTealHover: '#476E6C',
  primaryTealBorder: '#3D6B69',
  mutedTeal: '#6B8F8E',
  mintBg: '#E8F3F2',
  mintGradientTo: '#EAF2F1',
  border: '#D4E4E3',
  surfaceSubtle: '#F8FCFC',
  surfaceMuted: '#F0F5F4',
  surfaceHover: '#F4F9F8',
  pageBg: '#F0F5F4',
  textPrimary: '#1E293B',
  textHeading: '#0F172A',
} as const;

export const STANDARD_CLASSES = {
  // 1. Header Banner - Main Dashboard Pages
  headerMainCard:
    'bg-gradient-to-r from-white to-[#EAF2F1] rounded-2xl p-4 md:p-5 shadow-xs border border-[#D4E4E3]',
  headerMainIconBox:
    'w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-white text-[#5A8A88] flex items-center justify-center border border-[#D4E4E3] shrink-0 shadow-xs',
  headerMainTitle:
    'text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight',
  headerMainSubtitle:
    'text-xs md:text-sm text-[#6B8F8E] font-medium mt-1',
  headerMainControlText:
    'text-[11px] font-semibold',

  // 2. Header Banner - Sub Pages & Reports
  headerSubCard:
    'bg-white rounded-2xl border border-[#D4E4E3] p-4 sm:p-5 shadow-[0_2px_8px_rgba(90,138,136,0.08)]',
  headerSubBackBtn:
    'w-[32px] h-[32px] rounded-[8px] bg-white border border-[#D4E4E3] flex items-center justify-center text-[#5A8A88] hover:bg-[#E8F3F2] transition-colors cursor-pointer shrink-0 shadow-2xs',
  headerSubIconBox:
    'w-9 h-9 rounded-[10px] bg-[#E8F3F2] flex items-center justify-center text-[#5A8A88] border border-[#D4E4E3]/50 shadow-xs shrink-0',
  headerSubTitle:
    'text-[15px] font-[700] text-[#2D4A49] tracking-tight leading-tight',
  headerSubBadge:
    'text-[10px] font-[600] text-[#5A8A88] bg-[#E8F3F2] px-[7px] py-[2px] rounded-[5px] border border-[#D4E4E3] whitespace-nowrap',
  headerSubSubtitle:
    'text-[11px] text-[#6B8F8E] mt-0.5',
  headerDivider:
    'h-[1px] bg-[#F0F5F4] my-3 w-full',

  // 3. Tables (CRENN Table Standard v1.1)
  tableCard:
    'bg-white rounded-xl border border-[#D4E4E3] overflow-hidden shadow-[0_2px_8px_rgba(90,138,136,0.08)]',
  tableHeadPrimaryRow:
    'bg-[#2D4A49] text-white text-[10.5px] sm:text-[11px] font-semibold tracking-wide border-b border-[#1E3A39]',
  tableHeadSubRow:
    'bg-[#3D6B69] text-white text-[10px] font-semibold border-b border-[#2D4A49]',
  tableHeadCell:
    'py-2.5 px-3 border-r border-[#3D6B69]/70 last:border-r-0 align-middle whitespace-nowrap',
  tableHeadCellCompact:
    'py-2 px-2 border-r border-[#3D6B69]/70 last:border-r-0 align-middle whitespace-nowrap',
  tableBody:
    'divide-y divide-[#E4EFEF] text-[11.5px] sm:text-[12px] text-[#2D4A49]',
  tableRow:
    'hover:bg-[#F4F9F8] transition-colors',
  tableCell:
    'py-2.5 px-3 align-middle',
  tableCellCompact:
    'py-2 px-2 align-middle text-[11px] sm:text-[11.5px]',
  tableBadge:
    'inline-flex items-center whitespace-nowrap shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-[6px] border',
  tableActionBtn:
    'h-[28px] px-2.5 rounded-[6px] border text-[10.5px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors',
  tableInput:
    'h-[30px] px-2 rounded-[7px] bg-[#F8FCFC] border border-[#D4E4E3] text-[11px] text-[#2D4A49] outline-none focus:border-[#5A8A88]',

  // 4. Dropdown List
  dropdownTrigger:
    'flex items-center justify-between gap-1.5 bg-white border border-[#D4E4E3] rounded-[8px] px-2.5 py-[6px] h-[32px] text-[11px] font-medium text-[#2D4A49] transition-colors shadow-2xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5A8A88]/40',
  dropdownTriggerOpen:
    'border-[#5A8A88] bg-[#E8F3F2]',
  dropdownMenu:
    'bg-white border border-[#D4E4E3] rounded-xl shadow-lg max-h-[280px] overflow-y-auto z-50 p-1 scrollbar-thin',
  dropdownItem:
    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[11px] transition-colors cursor-pointer text-left',
  dropdownItemActive:
    'bg-[#E8F3F2] text-[#5A8A88] font-semibold',
  dropdownItemInactive:
    'text-[#2D4A49] hover:bg-[#E8F3F2] hover:text-[#5A8A88]',

  // 5. Save Button
  saveButtonBase:
    'flex items-center gap-1.5 text-white text-[11px] sm:text-[12px] font-[600] rounded-[8px] px-3.5 py-[6px] h-[32px] transition-all shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5A8A88]/50',

  // 6. Export Button
  exportButtonTrigger:
    'flex items-center gap-1 bg-white border border-[#D4E4E3] hover:bg-[#F0F5F4] text-[#2D4A49] text-[11px] font-[500] rounded-[8px] px-2.5 py-[6px] h-[32px] transition-colors shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',

  // 7. Date Filter
  dateInput:
    'bg-white border border-[#D4E4E3] rounded-[8px] px-2.5 py-1 h-[32px] text-[11px] text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] tabular-nums',
  dateTabGroup:
    'inline-flex items-center gap-0.5 bg-[#F0F5F4] p-0.5 rounded-[8px] border border-[#D4E4E3]',
  dateTabActive:
    'px-2.5 py-1 rounded-[6px] text-[11px] font-[600] bg-[#5A8A88] text-white shadow-xs cursor-pointer transition-colors whitespace-nowrap',
  dateTabInactive:
    'px-2.5 py-1 rounded-[6px] text-[11px] font-[600] text-[#2D4A49] hover:bg-white cursor-pointer transition-colors whitespace-nowrap',
  periodArrowBtn:
    'w-[30px] h-[30px] rounded-[8px] bg-white border border-[#D4E4E3] hover:bg-[#E8F3F2] text-[#5A8A88] flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0',
  periodBadge:
    'h-[30px] inline-flex items-center text-[11px] font-[600] text-[#2D4A49] bg-[#E8F3F2] px-3 rounded-[8px] border border-[#D4E4E3]/40 whitespace-nowrap shadow-2xs tabular-nums',
} as const;
