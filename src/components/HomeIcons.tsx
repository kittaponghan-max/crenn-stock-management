import React from 'react';

// 1. Sinkronisasi (Sync) Icon
export const SyncIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Clipboard / tablet body */}
    <rect x="12" y="10" width="24" height="30" rx="3" fill="#3B82F6" opacity="0.15" />
    <rect x="10" y="8" width="24" height="32" rx="4" fill="#FFFFFF" stroke="#0D9488" strokeWidth="2.2" strokeLinejoin="round" />
    <rect x="15" y="5" width="14" height="6" rx="2" fill="#0D9488" />
    <circle cx="22" cy="7" r="1.5" fill="#FFFFFF" />
    
    {/* Page content lines */}
    <line x1="16" y1="16" x2="28" y2="16" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="21" x2="25" y2="21" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
    
    {/* Looping sync arrows in green / teal badge */}
    <circle cx="28" cy="29" r="11" fill="#10B981" />
    <circle cx="28" cy="29" r="9" fill="#047857" />
    
    {/* Sync circular arrow paths */}
    <path 
      d="M24.5 27.5A4 4 0 0 1 31.5 26.5L32.8 25M32.8 25V28M32.8 25H29.8" 
      stroke="#FFFFFF" 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
    <path 
      d="M31.5 30.5A4 4 0 0 1 24.5 31.5L23.2 33M23.2 33V30M23.2 33H26.2" 
      stroke="#FFFFFF" 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
  </svg>
);

// 2. Material Request Icon (Document with folded corner & red circular question mark badge)
export const MaterialRequestIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Sheet of paper */}
    <path 
      d="M13 8C13 6.89543 13.8954 6 15 6H27L35 14V38C35 39.1046 34.1046 40 33 40H15C13.8954 40 13 39.1046 13 38V8Z" 
      fill="#FFFFFF" 
      stroke="#047857" 
      strokeWidth="2.2" 
      strokeLinejoin="round" 
    />
    {/* Folded corner */}
    <path 
      d="M27 6V13C27 13.5523 27.4477 14 28 14H35" 
      fill="#D1FAE5" 
      stroke="#047857" 
      strokeWidth="2.2" 
      strokeLinejoin="round" 
    />
    {/* Content lines */}
    <line x1="18" y1="18" x2="24" y2="18" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="18" y1="23" x2="30" y2="23" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
    <line x1="18" y1="28" x2="26" y2="28" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
    
    {/* Red question mark circle badge */}
    <circle cx="31" cy="32" r="8.5" fill="#EF4444" stroke="#DC2626" strokeWidth="1.5" />
    <text 
      x="31" 
      y="36" 
      textAnchor="middle" 
      fill="#FFFFFF" 
      fontSize="12" 
      fontWeight="900" 
      fontFamily="system-ui, -apple-system, sans-serif"
    >?</text>
  </svg>
);

// 3. Stock Opname Icon (Stacked warm cardboard boxes with tape)
export const StockOpnameIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Bottom left box */}
    <rect x="6" y="24" width="17" height="15" rx="1.5" fill="#FBBF24" stroke="#78350F" strokeWidth="1.8" />
    <path d="M6 31H23" stroke="#D97706" strokeWidth="1.5" strokeDasharray="2 2" />
    {/* Tape */}
    <rect x="12" y="24" width="5" height="15" fill="#F59E0B" opacity="0.6" stroke="#B45309" strokeWidth="1.2" />

    {/* Bottom right box */}
    <rect x="23" y="22" width="19" height="17" rx="1.5" fill="#F59E0B" stroke="#78350F" strokeWidth="1.8" />
    <path d="M23 29H42" stroke="#B45309" strokeWidth="1.5" strokeDasharray="2 2" />
    {/* Tape */}
    <rect x="30" y="22" width="5" height="17" fill="#D97706" opacity="0.5" stroke="#92400E" strokeWidth="1.2" />

    {/* Top box */}
    <rect x="14" y="11" width="17" height="14" rx="1.5" fill="#FDE68A" stroke="#78350F" strokeWidth="1.8" />
    <path d="M14 17H31" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="2 2" />
    {/* Tape */}
    <rect x="20" y="11" width="5" height="14" fill="#FBBF24" opacity="0.7" stroke="#B45309" strokeWidth="1.2" />
  </svg>
);

// 4. Purchase Order Tracker Icon (Delivery truck with green location pin)
export const PurchaseOrderTrackerIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Truck cargo body */}
    <rect x="8" y="20" width="20" height="16" rx="2" fill="#FFFFFF" stroke="#0F766E" strokeWidth="2" />
    <line x1="8" y1="28" x2="28" y2="28" stroke="#CCFBF1" strokeWidth="1.5" />
    <line x1="18" y1="20" x2="18" y2="36" stroke="#0F766E" strokeWidth="1.5" />

    {/* Truck cab */}
    <path 
      d="M28 25H35L39 30V36H28V25Z" 
      fill="#2DD4BF" 
      stroke="#0F766E" 
      strokeWidth="2" 
      strokeLinejoin="round" 
    />
    {/* Cab window */}
    <path d="M30 27H34L37 30H30V27Z" fill="#E0F2FE" stroke="#0F766E" strokeWidth="1.2" />

    {/* Front bumper & headlight */}
    <rect x="38" y="32" width="2" height="3" fill="#F59E0B" />

    {/* Wheels */}
    <circle cx="14" cy="37" r="4.5" fill="#1E293B" stroke="#0F766E" strokeWidth="1.5" />
    <circle cx="14" cy="37" r="1.8" fill="#94A3B8" />

    <circle cx="34" cy="37" r="4.5" fill="#1E293B" stroke="#0F766E" strokeWidth="1.5" />
    <circle cx="34" cy="37" r="1.8" fill="#94A3B8" />

    {/* GPS Location Pin Marker */}
    <g transform="translate(18, 4)">
      <path 
        d="M10 0C5.58 0 2 3.58 2 8C2 13.5 10 20 10 20C10 20 18 13.5 18 8C18 3.58 14.42 0 10 0Z" 
        fill="#84CC16" 
        stroke="#4D7C0F" 
        strokeWidth="1.8" 
      />
      <circle cx="10" cy="8" r="3.2" fill="#FFFFFF" />
    </g>
  </svg>
);

// 5. Penerimaan Barang Icon (Cardboard box with vibrant green checkmark badge)
export const PenerimaanBarangIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Isometric Cardboard Box */}
    <g transform="translate(2, 4)">
      {/* Box Top */}
      <path d="M22 6L35 12L22 18L9 12L22 6Z" fill="#FDE68A" stroke="#B45309" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Box Left Side */}
      <path d="M9 12L22 18V33L9 27V12Z" fill="#F59E0B" stroke="#B45309" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Box Right Side */}
      <path d="M22 18L35 12V27L22 33V18Z" fill="#D97706" stroke="#B45309" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Flap seam */}
      <line x1="22" y1="6" x2="22" y2="18" stroke="#B45309" strokeWidth="1.5" />
      {/* Tape on top */}
      <path d="M19 7.5L25 10.5L22 12L16 9L19 7.5Z" fill="#FEF3C7" opacity="0.8" />
    </g>

    {/* Green circular check badge on bottom right */}
    <circle cx="34" cy="33" r="8.5" fill="#10B981" stroke="#047857" strokeWidth="1.8" />
    <path 
      d="M30 33L32.8 35.8L38 30.5" 
      stroke="#FFFFFF" 
      strokeWidth="2.4" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
  </svg>
);

// 6. Pengeluaran Barang Icon (Hand trolley/cart with packages)
export const PengeluaranBarangIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Hand truck / trolley frame */}
    {/* Handle and vertical frame */}
    <path 
      d="M10 12L16 12L16 34L35 34" 
      stroke="#047857" 
      strokeWidth="2.4" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
    <path d="M16 22L34 22" stroke="#047857" strokeWidth="1.5" strokeOpacity="0.4" />

    {/* Stacked Box 1 (Bottom) */}
    <rect x="18" y="24" width="15" height="10" rx="1.5" fill="#F59E0B" stroke="#78350F" strokeWidth="1.6" />
    <line x1="25.5" y1="24" x2="25.5" y2="34" stroke="#B45309" strokeWidth="1.5" />
    <line x1="21" y1="29" x2="30" y2="29" stroke="#78350F" strokeWidth="1" strokeDasharray="1.5 1.5" />

    {/* Stacked Box 2 (Top) */}
    <rect x="20" y="15" width="12" height="9" rx="1.2" fill="#FBBF24" stroke="#78350F" strokeWidth="1.6" />
    <line x1="26" y1="15" x2="26" y2="24" stroke="#B45309" strokeWidth="1.5" />

    {/* Trolley Wheels */}
    <circle cx="16" cy="37" r="3.5" fill="#334155" stroke="#047857" strokeWidth="1.5" />
    <circle cx="16" cy="37" r="1.2" fill="#94A3B8" />

    <circle cx="33" cy="37" r="3.5" fill="#334155" stroke="#047857" strokeWidth="1.5" />
    <circle cx="33" cy="37" r="1.2" fill="#94A3B8" />
  </svg>
);

// 7. Procurement Tracker Icon (Workflow: cart -> invoice -> coin)
export const ProcurementTrackerIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* 1. Shopping cart (top left) */}
    <g transform="translate(6, 8)">
      <path 
        d="M1 2H4L6.5 12H13L15 6H5" 
        stroke="#0D9488" 
        strokeWidth="1.8" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <circle cx="7.5" cy="14" r="1.5" fill="#0D9488" />
      <circle cx="12.5" cy="14" r="1.5" fill="#0D9488" />
    </g>

    {/* Arrow from cart to invoice */}
    <path 
      d="M22 15L25 15C26 15 27 16 27 17L27 21" 
      stroke="#10B981" 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeDasharray="2 2"
    />
    <path d="M25.5 20L27 22L28.5 20" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

    {/* 2. Invoice document (bottom left) */}
    <g transform="translate(8, 24)">
      <rect x="1" y="2" width="13" height="16" rx="1.5" fill="#FFFFFF" stroke="#0F766E" strokeWidth="1.8" />
      <line x1="4" y1="6" x2="11" y2="6" stroke="#14B8A6" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4" y1="10" x2="9" y2="10" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4" y1="13" x2="8" y2="13" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round" />
    </g>

    {/* Arrow from invoice to coin */}
    <path 
      d="M23 32H28" 
      stroke="#10B981" 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeDasharray="2 2"
    />
    <path d="M26.5 30L29 32L26.5 34" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

    {/* 3. Golden coin (bottom right) */}
    <g transform="translate(30, 24)">
      <circle cx="8" cy="10" r="8" fill="#F59E0B" stroke="#B45309" strokeWidth="1.8" />
      <circle cx="8" cy="10" r="6.2" fill="#FDE68A" />
      <text 
        x="8" 
        y="13.5" 
        textAnchor="middle" 
        fill="#92400E" 
        fontSize="10" 
        fontWeight="bold" 
        fontFamily="system-ui, -apple-system, sans-serif"
      >$</text>
    </g>
  </svg>
);