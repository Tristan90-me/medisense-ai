import './global.css';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-3xl font-bold text-primary">MediSense</Text>
        <Text className="mt-2 text-center text-muted-foreground">
          Symptoms, fitness and nutrition in one place.
        </Text>
        <View className="mt-6 rounded-full bg-energy px-5 py-2">
          <Text className="font-semibold text-white">Scaffold ready</Text>
        </View>
      </View>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
