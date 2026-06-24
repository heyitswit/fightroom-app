import { useFriendRequests } from '@/hooks/useFriends';
import { useAuthStore } from '@/lib/stores/auth';
import { THEME } from '@/lib/theme';
import { Tabs, router } from 'expo-router';
import { CalendarIcon, HomeIcon, UsersIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  const { jwt } = useAuthStore();

  // Monté ici pour que le polling des demandes tourne dans toute l'app
  // (pas seulement sur l'écran Amis) et alimente la pastille de l'onglet.
  const requests = useFriendRequests();
  const incomingCount = requests.data?.incoming?.length ?? 0;

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
          title: 'Lieux',
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
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Amis',
          tabBarIcon: ({ color, size }) => <UsersIcon color={color} size={size} />,
          tabBarBadge: incomingCount > 0 ? incomingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary },
        }}
      />
    </Tabs>
  );
}
