import { StyleSheet } from 'react-native';

// Shared verbatim across Login/Register/VerifyOtp — genuinely identical
// layout, unlike controller logic which differs per screen.
export const authStyles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  brand: { fontWeight: '800', marginBottom: 4 },
  card: { marginTop: 24 },
  heading: { fontWeight: '700', marginBottom: 16 },
  submit: {
    marginTop: 8, borderRadius: 999, paddingVertical: 14, alignItems: 'center',
  },
  footerLink: { marginTop: 20, alignItems: 'center' },
  linkButton: { marginTop: 12 },
  error: { fontSize: 13, marginBottom: 8 },
});
