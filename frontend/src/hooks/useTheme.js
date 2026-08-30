import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'medisense-theme';
const ORDER = ['light', 'dark', 'system'];

const getSystemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

const getStoredPreference = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {}
  return 'system';
};

const resolveEffective = (preference) => (preference === 'system' ? (getSystemPrefersDark() ? 'dark' : 'light') : preference);

const applyEffectiveTheme = (effective) => {
  document.documentElement.classList.toggle('dark', effective === 'dark');
};

// Three-way theme: 'light' | 'dark' | 'system'. `preference` is what the user
// chose (and what's persisted); `effective` is what's actually applied (only
// differs from `preference` when preference === 'system'). When on 'system',
// this also tracks live OS theme changes instead of only resolving once.
const useTheme = () => {
  const [preference, setPreference] = useState(getStoredPreference);
  const [effective, setEffective] = useState(() => resolveEffective(getStoredPreference()));

  useEffect(() => {
    const next = resolveEffective(preference);
    setEffective(next);
    applyEffectiveTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {}
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const next = getSystemPrefersDark() ? 'dark' : 'light';
      setEffective(next);
      applyEffectiveTheme(next);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  const setTheme = useCallback((next) => {
    if (ORDER.includes(next)) setPreference(next);
  }, []);

  const cycleTheme = useCallback(() => {
    setPreference((prev) => ORDER[(ORDER.indexOf(prev) + 1) % ORDER.length]);
  }, []);

  return { preference, effective, setTheme, cycleTheme };
};

export default useTheme;
