// Shared Controller-wrapped text input for every form in the app (auth
// screens now; onboarding/logging forms in Phase 6). One place to keep
// label/error/input styling consistent.
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Controller } from 'react-hook-form';

export default function FormField({
  control, name, label, error, theme, ...inputProps
}) {
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: theme.colors.mutedForeground }]}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            style={[
              styles.input,
              {
                borderColor: error ? theme.colors.destructive : theme.colors.border,
                color: theme.colors.foreground,
                backgroundColor: theme.glass.surfaceStrong,
              },
            ]}
            placeholderTextColor={theme.colors.mutedForeground}
            {...inputProps}
          />
        )}
      />
      {error ? <Text style={[styles.error, { color: theme.colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  error: { fontSize: 12, marginTop: 4 },
});
