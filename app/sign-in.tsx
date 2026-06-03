import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/stores/auth';
import { Redirect } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';

export default function SignInScreen() {
  const { jwt, login } = useAuthStore();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (jwt) return <Redirect href="/(tabs)" />;

  async function handleLogin() {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background">
      <View className="flex-1 justify-center gap-6 px-8">
        <View className="gap-1">
          <Text variant="h2" className="text-foreground">
            Fight Room
          </Text>
          <Text className="text-muted-foreground">
            Boxe, lutte, MMA, Art martiaux: Vos studios privés dédiés aux sports de combat.
          </Text>
        </View>

        <View className="gap-3">
          <Input
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            placeholder="Mot de passe"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            returnKeyType="done"
          />

          {error && <Text className="text-sm text-destructive">{error}</Text>}

          <Button onPress={handleLogin} disabled={loading} className="mt-2">
            {loading ? <ActivityIndicator color="white" /> : <Text>Se connecter</Text>}
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
