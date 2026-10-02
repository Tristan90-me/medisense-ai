// Foundational "liquid glass" surface — real native blur (expo-blur) plus a
// translucent fill, a 1px light-catching border, and an optional faint
// domain tint (see theme/tokens.js's domainTint). This is the one place
// glass compositing logic lives; every glass panel in the app should use
// this rather than hand-rolling BlurView + overlays per screen.
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeProvider';

// domain: optional 'health' | 'fitness' | 'nutrition' | 'achievement' — a
// faint contextual color wash so e.g. a fitness card reads subtly warm.
// intensity: 'subtle' | 'medium' | 'strong' blur strength.
export default function GlassCard({
  children, domain, intensity = 'medium', radius: radiusProp, style, contentStyle,
}) {
  const theme = useTheme();
  const cardRadius = radiusProp ?? theme.radius.lg;
  const tintColor = domain ? theme.domainTint[domain] : null;

  return (
    <View style={[{ borderRadius: cardRadius, overflow: 'hidden' }, style]}>
      <BlurView
        intensity={theme.blurIntensity[intensity]}
        tint={theme.mode === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.glass.surface }]} />
      {tintColor ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} /> : null}
      <View
        style={[StyleSheet.absoluteFill, { borderWidth: 1, borderRadius: cardRadius, borderColor: theme.glass.border }]}
        pointerEvents="none"
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
});
