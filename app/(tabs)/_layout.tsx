import { useAuthStore } from '@/lib/stores/auth';
import { THEME } from '@/lib/theme';
import { Tabs, router } from 'expo-router';
import { CalendarIcon, HomeIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  const { jwt } = useAuthStore();

  React.useEffect(() => {
    if (!jwt) router.replace('/sign-in');
  }, [jwt]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Salles',
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Réservations',
          tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
