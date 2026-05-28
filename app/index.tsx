import { useAuthStore } from '@/lib/stores/auth';
import { Redirect } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { jwt, isLoading, initialize } = useAuthStore();

  React.useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={jwt ? '/(tabs)' : '/sign-in'} />;
}
