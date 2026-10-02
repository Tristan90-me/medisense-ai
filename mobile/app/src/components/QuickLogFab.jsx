// Floating quick-log action button, overlaid on the tab navigator (see
// navigation/MainTabNavigator.jsx). Phase 5 builds the interaction/motion;
// each action's onPress is a placeholder until Phase 6 gives it a real
// destination (meal/workout/water logging, symptom check-in screens).
//
// Each action button gets its OWN shared value (not one shared progress
// value read by all four) so they can be staggered independently via
// withDelay — deriving a per-button stagger from a single shared progress
// inside useAnimatedStyle would mean re-triggering a spring on every frame
// that shared value changes, which is a broken pattern in Reanimated.
import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import GlassCard from './GlassCard';

const ACTIONS = [
  {
    key: 'checkin', label: 'Check-in', icon: '🩺', domain: 'health',
  },
  {
    key: 'water', label: 'Log Water', icon: '💧', domain: 'nutrition',
  },
  {
    key: 'meal', label: 'Log Meal', icon: '🍽️', domain: 'nutrition',
  },
  {
    key: 'workout', label: 'Log Workout', icon: '🏋️', domain: 'fitness',
  },
];

const SPRING = { damping: 15, stiffness: 180 };

export default function QuickLogFab({ onAction }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);
  const p0 = useSharedValue(0);
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);
  const p3 = useSharedValue(0);
  const progresses = [p0, p1, p2, p3];

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const next = !open;
    setOpen(next);
    rotation.value = withSpring(next ? 1 : 0, SPRING);
    progresses.forEach((p, i) => {
      const delay = next ? i * 40 : (progresses.length - 1 - i) * 30;
      p.value = withDelay(delay, withSpring(next ? 1 : 0, SPRING));
    });
  };

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 45}deg` }],
  }));

  return (
    <View
      style={[styles.wrapper, { bottom: insets.bottom + 78 }]}
      pointerEvents="box-none"
    >
      {open && <Pressable style={StyleSheet.absoluteFill} onPress={toggle} />}

      {ACTIONS.map((action, i) => (
        <ActionButton
          key={action.key}
          action={action}
          index={i}
          progress={progresses[i]}
          theme={theme}
          onPress={() => { toggle(); onAction?.(action.key); }}
        />
      ))}

      <Pressable onPress={toggle} accessibilityLabel="Quick log">
        <Animated.View style={fabStyle}>
          <GlassCard domain="fitness" intensity="strong" radius={999} contentStyle={styles.fabContent}>
            <Text style={[styles.fabPlus, { color: theme.colors.foreground }]}>+</Text>
          </GlassCard>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function ActionButton({
  action, index, progress, theme, onPress,
}) {
  const distance = (index + 1) * 62;
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: -distance * progress.value },
      { scale: 0.7 + 0.3 * progress.value },
    ],
  }));

  return (
    <Animated.View style={[styles.actionWrapper, style]}>
      <Pressable onPress={onPress} style={styles.actionRow}>
        <View style={[styles.actionLabel, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSize.sm, fontWeight: '600' }}>
            {action.label}
          </Text>
        </View>
        <GlassCard domain={action.domain} intensity="strong" radius={999} contentStyle={styles.actionButtonContent}>
          <Text style={styles.actionIcon}>{action.icon}</Text>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const CIRCLE = 52;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute', right: 20, alignItems: 'flex-end',
  },
  fabContent: {
    width: CIRCLE, height: CIRCLE, padding: 0, alignItems: 'center', justifyContent: 'center',
  },
  fabPlus: { fontSize: 28, fontWeight: '300', lineHeight: 30 },
  actionWrapper: { position: 'absolute', right: 0, bottom: 0 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionLabel: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  actionButtonContent: {
    width: 44, height: 44, padding: 0, alignItems: 'center', justifyContent: 'center',
  },
  actionIcon: { fontSize: 18 },
});
