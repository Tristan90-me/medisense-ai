// Ports frontend/src/components/ErrorBoundary.jsx's behavior (catch, log,
// friendly fallback with a reset action). Class components can't use hooks,
// so the themed fallback UI is a small function component the class renders;
// the boundary itself stays a class since React requires
// getDerivedStateFromError/componentDidCatch on one.
import { Component } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

function Fallback({ onReset }) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.foreground, fontSize: theme.fontSize.xl }]}>
        Something went wrong
      </Text>
      <Text style={[styles.body, { color: theme.colors.mutedForeground, fontSize: theme.fontSize.sm }]}>
        MediSense ran into an unexpected error. Your data is safe.
      </Text>
      <Pressable
        onPress={onReset}
        style={[styles.button, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.full }]}
      >
        <Text style={{ color: theme.colors.primaryForeground, fontWeight: '600' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('MediSense mobile error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <Fallback onReset={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32,
  },
  title: { fontWeight: '700' },
  body: { textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  button: { paddingHorizontal: 24, paddingVertical: 12 },
});
