import { useState } from 'react';

/** How to turn a value of `T` into a string for `localStorage` and back. `parse`
 *  returns `null` for any stored string that isn't a recognized value of `T`, which
 *  falls back to the default rather than producing a bogus value. */
export interface PersistedStateCodec<T> {
  parse: (raw: string) => T | null;
  serialize: (value: T) => string;
}

/** A boolean setting codec matching the `stored === 'true'` semantics used
 *  throughout the app: once *something* is stored, it always coerces to a boolean
 *  (only the literal string `'true'` is truthy) rather than falling back to the
 *  default for anything else unrecognized. */
export const booleanCodec: PersistedStateCodec<boolean> = {
  parse: (raw) => raw === 'true',
  serialize: (value) => String(value),
};

/** A codec for a fixed set of allowed string values (e.g. a union-of-string-literals
 *  type) - anything else stored falls back to the default. */
export function enumCodec<T extends string>(allowedValues: readonly T[]): PersistedStateCodec<T> {
  return {
    parse: (raw) => (allowedValues.includes(raw as T) ? (raw as T) : null),
    serialize: (value) => value,
  };
}

function readStored<T>(key: string, defaultValue: T, parse: (raw: string) => T | null): T {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return defaultValue;
    const parsed = parse(stored);
    return parsed === null ? defaultValue : parsed;
  } catch {
    // localStorage can throw in some privacy modes/environments - just fall back silently.
    return defaultValue;
  }
}

function writeStored<T>(key: string, value: T, serialize: (value: T) => string): void {
  try {
    window.localStorage.setItem(key, serialize(value));
  } catch {
    // Ignore storage failures - the setting still works for the rest of this session,
    // it just won't be remembered next time.
  }
}

/**
 * `useState`, but the value is persisted to `localStorage` under `key` and restored
 * on mount - the one mechanism behind every "remember this across reloads" setting in
 * the app (collapsible panel open/closed state, settings toggles, computer skill).
 * The setter accepts a plain value or an updater function, same as `useState`'s.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  codec: PersistedStateCodec<T>,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readStored(key, defaultValue, codec.parse));

  const setPersisted = (next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
      writeStored(key, resolved, codec.serialize);
      return resolved;
    });
  };

  return [value, setPersisted];
}
