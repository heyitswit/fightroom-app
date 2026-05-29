import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';

export { ErrorBoundary } from 'expo-router';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
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
