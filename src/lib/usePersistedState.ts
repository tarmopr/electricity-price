"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_PREFIX = "eprice_";

/**
 * A hook that behaves like useState but persists the value in localStorage.
 * Falls back to the default value if localStorage is unavailable or the
 * stored value is invalid.
 *
 * Only runs the localStorage read/write on the client side.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const storageKey = `${STORAGE_PREFIX}${key}`;

  // Initialize with default value (SSR-safe), then hydrate from localStorage
  const [value, setValueInternal] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        const parsed = JSON.parse(stored) as T;
        // For primitives, guard against type mismatch (e.g. stored string for a boolean key).
        // Allow null through — it is a valid stored value for nullable state slots (e.g. number | null).
        const defaultType = typeof defaultValue;
        const parsedType = typeof parsed;
        const typeMismatch =
          defaultType !== 'object' && // skip check for object/null defaults
          parsed !== null &&           // null is always a valid stored value
          parsedType !== defaultType;
        if (!typeMismatch) {
          setValueInternal(parsed);
        }
      }
    } catch {
      // localStorage unavailable or invalid JSON — keep default
    }
    setHydrated(true);
  }, [storageKey]);

  // Persist to localStorage whenever value changes (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // localStorage full or unavailable — silently fail
    }
  }, [storageKey, value, hydrated]);

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValueInternal(newValue);
    },
    []
  );

  return [value, setValue, hydrated];
}
