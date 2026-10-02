// Bottom tabs with a translucent glass background (React Navigation's
// documented pattern: absolute-positioned tabBarStyle + a custom
// tabBarBackground) plus the QuickLogFab overlaid on top. Every tab is a
// ComingSoonScreen placeholder until Phase 6 builds the real screens.
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeProvider';
import QuickLogFab from '../components/QuickLogFab';
import ComingSoonScreen from '../screens/placeholder/ComingSoonScreen';

const Tab = createBottomTabNavigator();

const TAB_SCREENS = [
  {
    name: 'Today', title: 'Today', icon: '🏠', domain: 'health',
  },
  {
    name: 'Health', title: 'Health', icon: '🩺', domain: 'health',
  },
  {
    name: 'Fitness', title: 'Fitness', icon: '🏋️', domain: 'fitness',
  },
  {
    name: 'Nutrition', title: 'Nutrition', icon: '🥗', domain: 'nutrition',
  },
  {
    name: 'Profile', title: 'Profile', icon: '👤', domain: 'achievement',
  },
];

export default function MainTabNavigator() {
  const theme = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => {
          const meta = TAB_SCREENS.find((s) => s.name === route.name);
          return {
            headerShown: false,
            tabBarActiveTintColor: theme.domain[meta.domain],
            tabBarInactiveTintColor: theme.colors.mutedForeground,
            tabBarStyle: {
              position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0,
            },
            tabBarBackground: () => (
              <BlurView
                intensity={theme.blurIntensity.strong}
                tint={theme.mode === 'dark' ? 'dark' : 'light'}
                style={{ flex: 1 }}
              />
            ),
            tabBarIcon: () => <Text style={{ fontSize: 20 }}>{meta.icon}</Text>,
            tabBarLabel: meta.title,
          };
        }}
      >
        {TAB_SCREENS.map((s) => (
          <Tab.Screen key={s.name} name={s.name}>
            {() => <ComingSoonScreen title={s.title} icon={s.icon} domain={s.domain} />}
          </Tab.Screen>
        ))}
      </Tab.Navigator>
      <QuickLogFab onAction={(key) => console.log('quick-log action (Phase 6 target):', key)} />
    </View>
  );
}
