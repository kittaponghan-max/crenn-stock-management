import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { STANDARD_CLASSES } from './tokens';

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface StandardDropdownProps<T extends string = string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Optional inline label before trigger (e.g. "ผู้จัดจำหน่าย:") */
  label?: string;
  placeholder?: string;
  leadingIcon?: React.ReactNode;
  disabled?: boolean;
  align?: 'left' | 'right';
  triggerClassName?: string;
  menuClassName?: string;
  ariaLabel?: string;
}

export function StandardDropdown<T extends string = string>({
  options,
  value,
  onChange,
  label,
  placeholder = 'เลือกรายการ',
  leadingIcon,
  disabled = false,
  align = 'left',
  triggerClassName,
  menuClassName,
  ariaLabel,
}: StandardDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  return (
    <div className="inline-flex items-center gap-1.5">
      {label && (
        <span className="text-[11px] font-medium text-[#6B8F8E] whitespace-nowrap">
          {label}
        </span>
      )}
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={ariaLabel || label || placeholder}
          className={cn(
            STANDARD_CLASSES.dropdownTrigger,
            'min-w-[140px] max-w-[240px]',
            isOpen ? STANDARD_CLASSES.dropdownTriggerOpen : 'hover:bg-[#F0F5F4]',
            disabled && 'opacity-50 cursor-not-allowed',
            triggerClassName
          )}
        >
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            {(selectedOption?.icon || leadingIcon) && (
              <span className="text-[#5A8A88] shrink-0">
                {selectedOption?.icon || leadingIcon}
              </span>
            )}
            <span className="truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            {typeof selectedOption?.count === 'number' && (
              <span className="text-[10px] text-[#6B8F8E] tabular-nums shrink-0">
                ({selectedOption.count})
              </span>
            )}
          </span>
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
            role="listbox"
            className={cn(
              'absolute top-[calc(100%+4px)] w-[220px] sm:w-[250px]',
              align === 'right' ? 'right-0' : 'left-0',
              STANDARD_CLASSES.dropdownMenu,
              menuClassName
            )}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    STANDARD_CLASSES.dropdownItem,
                    isSelected
                      ? STANDARD_CLASSES.dropdownItemActive
                      : STANDARD_CLASSES.dropdownItemInactive,
                    opt.disabled && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <span className="flex items-center gap-1.5 min-w-0 pr-2">
                    {opt.icon && (
                      <span className="text-[#5A8A88] shrink-0">{opt.icon}</span>
                    )}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {typeof opt.count === 'number' && (
                      <span
                        className={cn(
                          'text-[9px] rounded px-1.5 py-0.5 tabular-nums',
                          isSelected
                            ? 'bg-white text-[#5A8A88] font-semibold'
                            : 'bg-[#F0F5F4] text-[#6B8F8E]'
                        )}
                      >
                        {opt.count}
                      </span>
                    )}
                    {isSelected && <Check size={12} className="text-[#5A8A88]" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Standard Tailwind class helper for native <select> elements when a native picker is preferred.
 */
export const STANDARD_NATIVE_SELECT_CLASS =
  'h-[32px] px-2.5 bg-white border border-[#D4E4E3] rounded-[8px] text-[11px] font-medium text-[#2D4A49] focus:outline-none focus:border-[#5A8A88] cursor-pointer';

export default StandardDropdown;
