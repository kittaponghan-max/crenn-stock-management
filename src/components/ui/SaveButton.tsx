import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import { STANDARD_CLASSES } from './tokens';

export interface SaveButtonProps {
  onClick: () => void | Promise<void>;
  isSaving?: boolean;
  isDirty?: boolean;
  justSaved?: boolean;
  disabled?: boolean;
  /** Default: "บันทึกข้อมูล" */
  label?: string;
  /** Default: "กำลังบันทึก..." */
  savingLabel?: string;
  /** Default: "บันทึกสำเร็จ" */
  savedLabel?: string;
  dirtyTooltip?: string;
  className?: string;
}

/**
 * Standard 4-State Save Button (Normal -> Dirty -> Saving -> Saved)
 * Spec: h-[32px], rounded-[8px], text-[11px] sm:text-[12px] font-[600]
 */
export const SaveButton: React.FC<SaveButtonProps> = ({
  onClick,
  isSaving = false,
  isDirty = false,
  justSaved = false,
  disabled = false,
  label = 'บันทึกข้อมูล',
  savingLabel = 'กำลังบันทึก...',
  savedLabel = 'บันทึกสำเร็จ',
  dirtyTooltip = 'มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก',
  className,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving || disabled}
      aria-busy={isSaving}
      className={cn(
        STANDARD_CLASSES.saveButtonBase,
        justSaved
          ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-400/50'
          : isDirty
            ? 'bg-[#1E3A39] hover:bg-[#162D2C] ring-2 ring-amber-400/70'
            : 'bg-[#2D4A49] hover:bg-[#203635]',
        isSaving && 'cursor-wait',
        className
      )}
    >
      {isSaving ? (
        <>
          <Loader2 size={13} className="animate-spin shrink-0" />
          <span>{savingLabel}</span>
        </>
      ) : justSaved ? (
        <>
          <CheckCircle2 size={13} className="text-white shrink-0" />
          <span>{savedLabel}</span>
        </>
      ) : (
        <>
          <Save size={13} className="shrink-0" />
          <span>{label}</span>
          {isDirty && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5 shrink-0"
              title={dirtyTooltip}
            />
          )}
        </>
      )}
    </button>
  );
};

/**
 * Browser beforeunload guard when a form/table has unsaved edits.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}

/**
 * Reusable 4-state save controller with automatic "justSaved" reset timer
 * and optional browser unsaved-changes guard.
 */
export function useSaveState(options?: {
  savedDurationMs?: number;
  enableUnloadGuard?: boolean;
}) {
  const savedDurationMs = options?.savedDurationMs ?? 2500;
  const enableUnloadGuard = options?.enableUnloadGuard ?? true;

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const timerRef = useRef<number | null>(null);

  useUnsavedChangesGuard(enableUnloadGuard && isDirty);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setJustSaved(false);
  }, []);

  const runSave = useCallback(
    async <T,>(saveFn: () => Promise<T>): Promise<T> => {
      setIsSaving(true);
      try {
        const result = await saveFn();
        setIsDirty(false);
        setJustSaved(true);
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          setJustSaved(false);
        }, savedDurationMs);
        return result;
      } finally {
        setIsSaving(false);
      }
    },
    [savedDurationMs]
  );

  return {
    isDirty,
    setIsDirty,
    isSaving,
    justSaved,
    markDirty,
    runSave,
  };
}

export default SaveButton;
