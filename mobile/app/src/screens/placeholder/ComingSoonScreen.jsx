// Stands in for every tab's real screen until Phase 6 builds them, so the
// navigation shell is fully runnable now. Deliberately built with GlassCard
// + a domain tint, so the Liquid Glass direction is visible from the very
// first screen rather than only appearing once real screens land.
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import GlassCard from '../../components/GlassCard';

export default function ComingSoonScreen({ title, icon, domain }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const gradientColors = theme.mode === 'dark'
    ? [theme.palette.slate[950], theme.palette.slate[900]]
    : [theme.palette.slate[50], theme.palette.blue[50]];

  return (
    <View style={styles.flex}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <View style={[styles.content, { paddingTop: insets.top + 24 }]}>
        <GlassCard domain={domain} style={styles.card}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.title, { color: theme.colors.foreground, fontSize: theme.fontSize.lg }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.mutedForeground, fontSize: theme.fontSize.sm }]}>
            Coming in Phase 6.
          </Text>
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', alignItems: 'center' },
  icon: { fontSize: 32, marginBottom: 8 },
  title: { fontWeight: '700' },
  subtitle: { marginTop: 4 },
});
