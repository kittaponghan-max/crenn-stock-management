import React from 'react';

interface LogoProps {
  className?: string;
  textClassName?: string;
  showSubtitle?: boolean;
}

export function Logo({ className = '', textClassName = '', showSubtitle = true }: LogoProps) {
  return (
    <div className={`flex flex-col items-center justify-center bg-[#c5d0ce] ${className}`}>
      <span 
        className={`font-serif tracking-[0.1em] text-[#1a1a1a] leading-none ${textClassName}`} 
        style={{ fontFamily: '"Playfair Display", "Didot", "Bodoni MT", "Times New Roman", serif' }}
      >
        CRENN
      </span>
      {showSubtitle && (
        <span className="text-[#1a1a1a] text-[10px] tracking-widest uppercase mt-2 opacity-80" style={{ fontFamily: '"Inter", sans-serif' }}>
          Artisan Bakery &amp; Cafe
        </span>
      )}
    </div>
  );
}
