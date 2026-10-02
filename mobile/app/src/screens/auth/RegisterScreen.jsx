// Registration is link-based email verification (backend/controllers/
// authController.js's register sends a verify link, not an OTP), so there's
// no in-app "enter the code" step here — just a "check your email" state
// with a resend action. The link itself opens the web app's /verify-email
// page (CLIENT_URL), a known rough edge for mobile-only dev/testing until a
// deep link or an OTP-based email-verify path is added.
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
import * as authApi from '../../api/auth.api';
import { authStyles as styles } from './authStyles';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function RegisterScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [submitError, setSubmitError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState(null);

  const {
    control, handleSubmit, formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (values) => {
    setSubmitError(null);
    setLoading(true);
    try {
      await authApi.register(values);
      setRegisteredEmail(values.email);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resend = () => {
    if (registeredEmail) authApi.resendVerification(registeredEmail).catch(() => {});
  };

  const gradientColors = theme.mode === 'dark'
    ? [theme.palette.slate[950], theme.palette.slate[900]]
    : [theme.palette.lime[50], theme.palette.slate[50]];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 60 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.brand, { color: theme.colors.foreground, fontSize: theme.fontSize['2xl'] }]}>Create your account</Text>

        {registeredEmail ? (
          <GlassCard domain="nutrition" intensity="strong" style={styles.card}>
            <Text style={[styles.heading, { color: theme.colors.foreground, fontSize: theme.fontSize.lg }]}>Check your email</Text>
            <Text style={{ color: theme.colors.mutedForeground, lineHeight: 20 }}>
              We sent a verification link to {registeredEmail}. Open it to activate your account, then come back and sign in.
            </Text>
            <Pressable onPress={resend} style={styles.linkButton}>
              <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Resend email</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={[styles.submit, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
            >
              <Text style={{ color: theme.colors.primaryForeground, fontWeight: '700' }}>Back to sign in</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <GlassCard domain="nutrition" intensity="strong" style={styles.card}>
            <FormField control={control} name="name" label="Name" error={errors.name?.message} theme={theme} />
            <FormField control={control} name="email" label="Email" error={errors.email?.message} keyboardType="email-address" autoCapitalize="none" theme={theme} />
            <FormField control={control} name="password" label="Password" error={errors.password?.message} secureTextEntry theme={theme} />

            {submitError ? <Text style={[styles.error, { color: theme.colors.destructive }]}>{submitError}</Text> : null}

            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={loading}
              style={[styles.submit, { backgroundColor: theme.colors.primary, opacity: loading ? 0.6 : 1 }]}
            >
              <Text style={{ color: theme.colors.primaryForeground, fontWeight: '700' }}>
                {loading ? 'Creating account…' : 'Create account'}
              </Text>
            </Pressable>
          </GlassCard>
        )}

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.footerLink}>
          <Text style={{ color: theme.colors.mutedForeground }}>
            Already have an account? <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
