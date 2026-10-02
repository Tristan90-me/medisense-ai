// Step 1 of login: email+password. The backend always answers with either
// { step: 'done', token, user } (trusted device, deviceToken skips OTP) or
// { step: 'otp' } (a code was emailed) — see backend/controllers/authController.js.
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
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPendingEmail = useAuthStore((s) => s.setPendingEmail);
  const deviceToken = useAuthStore((s) => s.deviceToken);
  const [submitError, setSubmitError] = useState(null);
  const [loading, setLoading] = useState(false);

  const {
    control, handleSubmit, formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values) => {
    setSubmitError(null);
    setLoading(true);
    try {
      const res = await authApi.login({ ...values, deviceToken });
      if (res.step === 'done') {
        setAuth(res.user, res.token);
      } else {
        setPendingEmail(values.email);
        navigation.navigate('VerifyOtp', { email: values.email });
      }
    } catch (err) {
      const data = err.response?.data;
      setSubmitError(
        data?.code === 'EMAIL_NOT_VERIFIED'
          ? 'Please verify your email before logging in. Check your inbox for the verification link.'
          : data?.message || 'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const gradientColors = theme.mode === 'dark'
    ? [theme.palette.slate[950], theme.palette.blue[900]]
    : [theme.palette.blue[50], theme.palette.slate[50]];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 60 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.brand, { color: theme.colors.foreground, fontSize: theme.fontSize['2xl'] }]}>MediSense</Text>
        <Text style={{ color: theme.colors.mutedForeground }}>Symptoms, fitness, and nutrition — one place.</Text>

        <GlassCard domain="health" intensity="strong" style={styles.card}>
          <Text style={[styles.heading, { color: theme.colors.foreground, fontSize: theme.fontSize.lg }]}>Welcome back</Text>

          <FormField control={control} name="email" label="Email" error={errors.email?.message} keyboardType="email-address" autoCapitalize="none" theme={theme} />
          <FormField control={control} name="password" label="Password" error={errors.password?.message} secureTextEntry theme={theme} />

          {submitError ? <Text style={[styles.error, { color: theme.colors.destructive }]}>{submitError}</Text> : null}

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
            style={[styles.submit, { backgroundColor: theme.colors.primary, opacity: loading ? 0.6 : 1 }]}
          >
            <Text style={{ color: theme.colors.primaryForeground, fontWeight: '700' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Text>
          </Pressable>
        </GlassCard>

        <Pressable onPress={() => navigation.navigate('Register')} style={styles.footerLink}>
          <Text style={{ color: theme.colors.mutedForeground }}>
            Don&apos;t have an account? <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Sign up</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
