// Resolves light/dark (system by default, with a persisted manual override)
// and exposes the full token set from tokens.js as one context value, so
// screens read `useTheme()` instead of importing tokens.js + useColorScheme
// separately everywhere. This is the foundation the Liquid Glass surfaces
// (GlassCard, tab bar, sheets) build on: every glass component reads its
// fill/border/highlight from `theme.glass`, and picks its tint from
// `theme.domainTint[domainName]` rather than hardcoding a color.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  palette, spacing, fontSize, radius, duration, semantic, severity, domain, domainTint, glass,
} from './tokens';

const STORAGE_KEY = 'medisense-mobile-theme-mode'; // 'light' | 'dark' | 'system'

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [modePreference, setModePreference] = useState('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setModePreference(stored);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const setMode = (next) => {
    setModePreference(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const resolvedMode = modePreference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : modePreference;

  const value = useMemo(() => ({
    mode: resolvedMode,
    modePreference,
    setMode,
    loaded,
    colors: semantic[resolvedMode],
    glass: glass[resolvedMode],
    domain: Object.fromEntries(Object.entries(domain).map(([k, v]) => [k, v[resolvedMode]])),
    domainTint,
    blurIntensity: glass.blurIntensity,
    palette,
    spacing,
    fontSize,
    radius,
    duration,
    severity,
  }), [resolvedMode, modePreference, loaded]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
