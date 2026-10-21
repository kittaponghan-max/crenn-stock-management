import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Ingredient } from '../types';

export interface ObsoleteIngredientRecord {
  id: string;
  is_active: boolean;
  inactive_reason?: string;
  inactive_at?: string;
}

export type ObsoleteIngredientsMap = Record<string, ObsoleteIngredientRecord>;

export const OBSOLETE_STORAGE_KEY = 'cafe_obsolete_ingredients';
export const OBSOLETE_CHANGE_EVENT = 'obsolete_ingredients_changed';

export const SCHEMA_MISSING_MESSAGE = 
  'กรุณาเพิ่มคอลัมน์ต่อไปนี้ใน Supabase ตาราง ingredients:\n' +
  '· is_active : boolean, default: true\n' +
  '· inactive_reason : text, nullable\n' +
  '· inactive_at : timestamp, nullable';

/**
 * Get current obsolete map from localStorage
 */
export function getObsoleteMap(): ObsoleteIngredientsMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(OBSOLETE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading obsolete ingredients:', e);
  }
  return {};
}

/**
 * Checks whether an ingredient is active (not obsolete).
 * Priority:
 * 1. Local storage override (if present)
 * 2. ingredient.is_active field from Supabase (if present)
 * 3. Default: true
 */
export function isIngredientActive(
  ingredient: { id: string; is_active?: boolean },
  map?: ObsoleteIngredientsMap
): boolean {
  if (!ingredient || !ingredient.id) return false;
  const currentMap = map || getObsoleteMap();
  const override = currentMap[ingredient.id];
  if (override !== undefined) {
    return Boolean(override.is_active);
  }
  return ingredient.is_active !== false;
}

/**
 * Persist obsolete status to localStorage and dispatch custom event.
 */
export function setLocalObsoleteStatus(
  id: string,
  isActive: boolean,
  reason?: string
): ObsoleteIngredientsMap {
  const map = getObsoleteMap();
  map[id] = {
    id,
    is_active: isActive,
    inactive_reason: isActive ? undefined : (reason?.trim() || undefined),
    inactive_at: isActive ? undefined : new Date().toISOString()
  };
  try {
    localStorage.setItem(OBSOLETE_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OBSOLETE_CHANGE_EVENT, { detail: map }));
  }
  return map;
}

/**
 * Attempt to update Supabase. If columns are missing (error 42703), return schemaMissing: true.
 */
export async function syncObsoleteToSupabase(
  id: string,
  isActive: boolean,
  reason?: string
): Promise<{ success: boolean; schemaMissing: boolean }> {
  if (!supabase) return { success: false, schemaMissing: false };

  try {
    const updatePayload: Record<string, any> = {
      is_active: isActive,
      inactive_reason: isActive ? null : (reason?.trim() || null),
      inactive_at: isActive ? null : new Date().toISOString()
    };

    const { error } = await supabase
      .from('ingredients')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('is_active')) {
        return { success: false, schemaMissing: true };
      }
      console.warn('Supabase update obsolete error:', error);
      return { success: false, schemaMissing: false };
    }

    return { success: true, schemaMissing: false };
  } catch (err: any) {
    if (err?.code === '42703' || err?.message?.includes('column') || err?.message?.includes('is_active')) {
      return { success: false, schemaMissing: true };
    }
    return { success: false, schemaMissing: false };
  }
}

/**
 * React Hook that provides the latest obsolete map and keeps it synchronized across tabs/components.
 */
export function useObsoleteIngredients(): ObsoleteIngredientsMap {
  const [obsoleteMap, setObsoleteMap] = useState<ObsoleteIngredientsMap>(() => getObsoleteMap());

  useEffect(() => {
    const handleUpdate = () => {
      setObsoleteMap(getObsoleteMap());
    };

    window.addEventListener(OBSOLETE_CHANGE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(OBSOLETE_CHANGE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return obsoleteMap;
}
