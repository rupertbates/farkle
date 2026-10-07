import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { booleanCodec, enumCodec, usePersistedState } from '../usePersistedState';

describe('usePersistedState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts at the default when nothing is stored', () => {
    const { result } = renderHook(() => usePersistedState('key', true, booleanCodec));
    expect(result.current[0]).toBe(true);
  });

  it('restores a previously stored boolean value', () => {
    window.localStorage.setItem('key', 'false');
    const { result } = renderHook(() => usePersistedState('key', true, booleanCodec));
    expect(result.current[0]).toBe(false);
  });

  it('treats any non-"true" stored string as false, not the default', () => {
    window.localStorage.setItem('key', 'garbage');
    const { result } = renderHook(() => usePersistedState('key', true, booleanCodec));
    expect(result.current[0]).toBe(false);
  });

  it('persists updates (plain value and updater function) to localStorage', () => {
    const { result } = renderHook(() => usePersistedState('key', true, booleanCodec));

    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem('key')).toBe('false');

    act(() => result.current[1]((prev) => !prev));
    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem('key')).toBe('true');
  });

  it('falls back to the default for an unrecognized enum value', () => {
    window.localStorage.setItem('key', 'bogus');
    const codec = enumCodec(['easy', 'normal', 'hard'] as const);
    const { result } = renderHook(() => usePersistedState('key', 'normal', codec));
    expect(result.current[0]).toBe('normal');
  });

  it('restores and persists a valid enum value', () => {
    window.localStorage.setItem('key', 'hard');
    const codec = enumCodec(['easy', 'normal', 'hard'] as const);
    const { result } = renderHook(() => usePersistedState('key', 'normal', codec));
    expect(result.current[0]).toBe('hard');

    act(() => result.current[1]('easy'));
    expect(result.current[0]).toBe('easy');
    expect(window.localStorage.getItem('key')).toBe('easy');
  });
});
