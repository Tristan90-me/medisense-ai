// Resolved from assets/design-tokens.json (rem converted at 16px). Numbers are RN dp.
export const palette = {
  blue: { 50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD', 400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8', 800: '#1E40AF', 900: '#1E3A8A' },
  violet: { 50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 300: '#C4B5FD', 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9', 800: '#5B21B6', 900: '#4C1D95' },
  emerald: { 50: '#ECFDF5', 100: '#D1FAE5', 500: '#10B981', 600: '#059669', 700: '#047857' },
  green: { 50: '#F0FDF4', 500: '#22C55E', 600: '#16A34A', 700: '#117E39' },
  amber: { 50: '#FFFBEB', 500: '#F59E0B', 600: '#D97706', 700: '#A45904' },
  red: { 50: '#FEF2F2', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C' },
  slate: { 50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1', 400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155', 800: '#1E293B', 900: '#0F172A', 950: '#0F2744' },
  // New for mobile: energetic accent for fitness screens (health/diagnosis keep Clinical Calm blue)
  orange: { 50: '#FFF7ED', 500: '#F97316', 600: '#EA580C', 700: '#C2410C' },
  white: '#FFFFFF',
};

export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 };
export const fontSize = { xs: 11, sm: 13, base: 15, lg: 18, xl: 22, '2xl': 30, '3xl': 40 };
export const radius = { none: 0, sm: 6, default: 8, md: 10, lg: 14, xl: 18, full: 9999 };
export const duration = { fast: 150, normal: 220, slow: 360 };

export const semantic = {
  light: {
    background: palette.slate[50],
    foreground: palette.slate[950],
    card: palette.white,
    cardForeground: palette.slate[950],
    primary: palette.blue[600],
    primaryForeground: palette.white,
    secondary: palette.violet[500],
    muted: palette.slate[100],
    mutedForeground: palette.slate[600],
    accent: palette.emerald[500],
    energy: palette.orange[500],
    destructive: palette.red[600],
    border: palette.slate[200],
    ring: palette.blue[500],
  },
  dark: {
    background: palette.slate[950],
    foreground: palette.slate[50],
    card: palette.slate[900],
    cardForeground: palette.slate[50],
    primary: palette.blue[400],
    primaryForeground: palette.slate[950],
    secondary: palette.violet[400],
    muted: palette.slate[800],
    mutedForeground: palette.slate[400],
    accent: palette.emerald[500],
    energy: palette.orange[500],
    destructive: palette.red[600],
    border: palette.slate[800],
    ring: palette.blue[500],
  },
};

export const severity = {
  low: { color: palette.green[500], bg: palette.green[50], fg: palette.green[700] },
  moderate: { color: palette.amber[500], bg: palette.amber[50], fg: palette.amber[700] },
  high: { color: palette.red[500], bg: palette.red[50], fg: palette.red[700] },
  critical: { color: palette.violet[500], bg: palette.violet[50], fg: palette.violet[600] },
};
