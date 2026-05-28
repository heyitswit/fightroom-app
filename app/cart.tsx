import { getSessionCookieString } from '@/lib/api';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function CartScreen() {
  const [cookies, setCookies] = React.useState<string | null>(null);

  React.useEffect(() => {
    getSessionCookieString().then(setCookies);
  }, []);

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
      renderLoading={() => (
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator />
        </View>
      )}
    />
  );
}
