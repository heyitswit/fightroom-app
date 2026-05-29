import { getSessionCookieString } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

export default function CartScreen() {
  const [cookies, setCookies] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    getSessionCookieString().then(setCookies);
  }, []);

  function handleNavigationChange(navState: WebViewNavigation) {
    if (navState.url.includes('fightroom.fr/account/bookings')) {
      queryClient.invalidateQueries({ queryKey: ['customer-bookings'] });
      router.replace('/(tabs)/bookings');
    }
  }

  if (cookies === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <WebView
      source={{
        uri: 'https://fightroom.fr/cart',
        headers: { Cookie: cookies },
      }}
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      startInLoadingState
      onNavigationStateChange={handleNavigationChange}
      renderLoading={() => (
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator />
        </View>
      )}
    />
  );
}
