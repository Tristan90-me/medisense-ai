import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTheme from './useTheme';

// Builds a matchMedia stub whose `matches` reflects `prefersDark`, and lets
// the test fire a "system theme changed" event via the returned dispatcher.
function stubMatchMedia(prefersDark) {
  const listeners = new Set();
  const mql = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_, handler) => listeners.add(handler),
    removeEventListener: (_, handler) => listeners.delete(handler),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return {
    fireChange: (nextPrefersDark) => {
      mql.matches = nextPrefersDark;
      listeners.forEach((handler) => handler());
    },
  };
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to "system" preference and resolves against the OS setting', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useTheme());

    expect(result.current.preference).toBe('system');
    expect(result.current.effective).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('reads a previously stored preference from localStorage', () => {
    stubMatchMedia(false);
    localStorage.setItem('medisense-theme', 'dark');

    const { result } = renderHook(() => useTheme());

    expect(result.current.preference).toBe('dark');
    expect(result.current.effective).toBe('dark');
  });

  it('setTheme updates preference, persists it, and applies the class', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('dark'));

    expect(result.current.preference).toBe('dark');
    expect(result.current.effective).toBe('dark');
    expect(localStorage.getItem('medisense-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme ignores values outside light/dark/system', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('neon'));

    expect(result.current.preference).toBe('system');
  });

  it('cycleTheme advances light -> dark -> system -> light', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('light'));
    expect(result.current.preference).toBe('light');

    act(() => result.current.cycleTheme());
    expect(result.current.preference).toBe('dark');

    act(() => result.current.cycleTheme());
    expect(result.current.preference).toBe('system');

    act(() => result.current.cycleTheme());
    expect(result.current.preference).toBe('light');
  });

  it('tracks live OS theme changes while preference is "system"', () => {
    const { fireChange } = stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    expect(result.current.effective).toBe('light');

    act(() => fireChange(true));

    expect(result.current.effective).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('stops tracking OS changes once preference is no longer "system"', () => {
    const { fireChange } = stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('light'));
    act(() => fireChange(true));

    // Preference is pinned to 'light', so a system change shouldn't flip it.
    expect(result.current.effective).toBe('light');
  });
});
