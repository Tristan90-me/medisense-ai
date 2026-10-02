// Step 2 of login (backend/controllers/authController.js's verifyOtp).
// rememberDays: 14 is sent unconditionally for now (equivalent to always
// checking "remember this device") — a visible toggle for it is a Phase 6
// UI nicety, not a foundation-layer concern.
import { useState } from 'react';
import {
  Text, Pressable, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import GlassCard from '../../components/GlassCard';
import FormField from '../../components/FormField';
import { useAuthStore } from '../../store/authStore';
import * as authApi from '../../api/auth.api';
import { authStyles as styles } from './authStyles';

const schema = z.object({
  otp: z.string().trim().length(6, 'Enter the 6-digit code').regex(/^\d+$/, 'Code must be numeric'),
});

export default function VerifyOtpScreen({ route, navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const email = route.params?.email;
  const setAuth = useAuthStore((s) => s.setAuth);
  const setDeviceToken = useAuthStore((s) => s.setDeviceToken);
  const [submitError, setSubmitError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  const {
    control, handleSubmit, formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { otp: '' },
  });

  const onSubmit = async ({ otp }) => {
    setSubmitError(null);
    setLoading(true);
    try {
      const res = await authApi.verifyOtp({ email, otp, rememberDays: 14 });
      if (res.deviceToken) setDeviceToken(res.deviceToken);
      setAuth(res.user, res.token);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResent(false);
    try {
      await authApi.resendOtp(email);
      setResent(true);
    } catch {
      // Deliberately silent on failure here too — resendOtp always
      // responds 200 regardless (see backend), so a network-level failure
      // is the only realistic error and isn't worth surfacing over the
      // existing form error state.
    }
  };

  const gradientColors = theme.mode === 'dark'
    ? [theme.palette.slate[950], theme.palette.blue[900]]
    : [theme.palette.blue[50], theme.palette.slate[50]];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 60 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.brand, { color: theme.colors.foreground, fontSize: theme.fontSize['2xl'] }]}>Enter your code</Text>
        <Text style={{ color: theme.colors.mutedForeground }}>We sent a 6-digit code to {email}.</Text>

        <GlassCard domain="health" intensity="strong" style={styles.card}>
          <FormField
            control={control}
            name="otp"
            label="Verification code"
            error={errors.otp?.message}
            keyboardType="number-pad"
            maxLength={6}
            theme={theme}
          />

          {submitError ? <Text style={[styles.error, { color: theme.colors.destructive }]}>{submitError}</Text> : null}
          {resent ? <Text style={{ color: theme.domain.nutrition, fontSize: 13, marginBottom: 8 }}>A new code has been sent.</Text> : null}

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
            style={[styles.submit, { backgroundColor: theme.colors.primary, opacity: loading ? 0.6 : 1 }]}
          >
            <Text style={{ color: theme.colors.primaryForeground, fontWeight: '700' }}>
              {loading ? 'Verifying…' : 'Verify & sign in'}
            </Text>
          </Pressable>

          <Pressable onPress={resend} style={styles.linkButton}>
            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Resend code</Text>
          </Pressable>
        </GlassCard>

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.footerLink}>
          <Text style={{ color: theme.colors.mutedForeground }}>Back to sign in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
