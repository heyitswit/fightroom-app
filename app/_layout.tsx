import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { useAuthStore } from '@/lib/stores/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { AppState } from 'react-native';

export { ErrorBoundary } from 'expo-router';

const queryClient = new QueryClient();

function SessionWatcher() {
  const revalidate = useAuthStore((s) => s.revalidate);
  const initialized = useAuthStore((s) => s.initialized);
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && initialized) revalidate();
    });
    return () => sub.remove();
  }, [revalidate, initialized]);
  return null;
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
        <SessionWatcher />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen
            name="booking/index"
            options={{ title: 'Réserver', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="booking/confirm"
            options={{ title: 'Confirmer', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="cart"
            options={{ title: 'Paiement', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="booking/[id]"
            options={{ title: 'Réservation', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="venue/[slug]"
            options={({ route }) => ({
              title: (route.params as { slug?: string })?.slug
                ?.split('-')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ') ?? 'Salles',
              headerBackTitle: 'Retour',
            })}
          />
          <Stack.Screen
            name="webview"
            options={({ route }) => ({
              title: (route.params as { title?: string })?.title ?? '',
              headerBackTitle: 'Retour',
            })}
          />
        </Stack>
        <PortalHost />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
