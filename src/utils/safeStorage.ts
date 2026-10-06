/**
 * Safe LocalStorage Utility
 * Provides automatic quota management, stale cache eviction, and in-memory fallback.
 */

// In-memory fallback map for active session
const memoryStorage = new Map<string, string>();

/**
 * Clean up low-priority / bulky cache entries from localStorage to free up space.
 */
export function freeUpLocalStorageSpace(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    let freed = false;

    // 1. Remove duplicate non-prefixed keys if branch-prefixed versions exist
    const duplicateKeys = [
      'cafe-audit-logs',
      'cafe-receiving-records',
      'cafe-checklist-records',
      'cafe-waste-logs',
      'cafe-rnd-reports',
      'bakeryPlanHistory',
      'cafe-stock-record',
      'cafe-ingredients-v4'
    ];

    for (const key of duplicateKeys) {
      if (localStorage.getItem(key)) {
        try {
          localStorage.removeItem(key);
          freed = true;
        } catch (e) {}
      }
    }

    // 2. Prune bulky images inside waste logs and rnd reports
    const keysToInspect: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keysToInspect.push(k);
    }

    for (const key of keysToInspect) {
      if (key.startsWith('cafe-waste-logs') || key.startsWith('cafe-rnd-reports')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw && (raw.includes('data:image') || raw.length > 80000)) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              // Strip data URLs and keep only last 25 items
              const trimmed = parsed.slice(0, 25).map((item: any) => ({
                ...item,
                imageUrl: item.imageUrl && item.imageUrl.startsWith('data:image') ? undefined : item.imageUrl,
                imageUrls: undefined,
              }));
              localStorage.setItem(key, JSON.stringify(trimmed));
              freed = true;
            }
          }
        } catch (e) {
          try { localStorage.removeItem(key); freed = true; } catch (err) {}
        }
      }

      // 3. Prune audit logs down to 20 most recent entries
      if (key.startsWith('cafe-audit-logs')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw && raw.length > 40000) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              localStorage.setItem(key, JSON.stringify(parsed.slice(0, 20)));
              freed = true;
            }
          }
        } catch (e) {
          try { localStorage.removeItem(key); freed = true; } catch (err) {}
        }
      }

      // 4. Prune old daily_sales_ and daily_bakery_ cache keys
      if (key.startsWith('daily_sales_') || key.startsWith('daily_bakery_')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw && raw.length > 50000) {
            localStorage.removeItem(key);
            freed = true;
          }
        } catch (e) {}
      }
    }

    return freed;
  } catch (err) {
    console.warn('Error during freeUpLocalStorageSpace:', err);
    return false;
  }
}

/**
 * Safely set item in localStorage with quota-exceeded recovery and in-memory fallback.
 */
export function safeLocalStorageSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;

  // Always keep in memoryStorage for reliable fallback in current session
  memoryStorage.set(key, value);

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    const isQuotaError = 
      err?.name === 'QuotaExceededError' || 
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014 ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('quota'));

    if (isQuotaError) {
      console.warn(`LocalStorage quota exceeded while saving "${key}". Evicting stale cache...`);
      freeUpLocalStorageSpace();

      try {
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        // More aggressive cleanup: remove non-essential cache keys
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k !== key && k !== 'cafe-user' && !k.startsWith('cafe_bakery_items')) {
              keysToRemove.push(k);
            }
          }
          // Remove up to 10 keys
          for (let i = 0; i < Math.min(keysToRemove.length, 10); i++) {
            localStorage.removeItem(keysToRemove[i]);
          }
          localStorage.setItem(key, value);
          return true;
        } catch (finalErr) {
          console.warn(`LocalStorage full. Retaining in memory for "${key}".`);
          return false;
        }
      }
    } else {
      console.warn(`Unable to write "${key}" to localStorage:`, err?.message || err);
      return false;
    }
  }
}

/**
 * Safely get item from localStorage with memoryStorage fallback.
 */
export function safeLocalStorageGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = localStorage.getItem(key);
    if (value !== null) {
      memoryStorage.set(key, value);
      return value;
    }
  } catch (err) {
    console.warn(`Error reading "${key}" from localStorage:`, err);
  }

  return memoryStorage.get(key) || null;
}

/**
 * Safely remove item from localStorage and memoryStorage.
 */
export function safeLocalStorageRemoveItem(key: string): void {
  memoryStorage.delete(key);
  try {
    localStorage.removeItem(key);
  } catch (e) {}
}
