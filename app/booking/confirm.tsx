import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { confirmSelection } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function ConfirmScreen() {
  const { roomId, roomName, startAt, endAt, durationMinutes } =
    useLocalSearchParams<{
      roomId: string;
      roomName: string;
      startAt: string;
      endAt: string;
      durationMinutes: string;
    }>();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [price, setPrice] = React.useState<number | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<string | null>(null);

  const start = parseISO(startAt);
  const end = parseISO(endAt);
  const durationH = Math.round(Number(durationMinutes) / 60);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await confirmSelection(roomId, startAt, endAt, Number(durationMinutes));
      setPrice(res.booking_cart_item.quoted_unit_price);
      setExpiresAt(res.booking_cart_item.expires_at);
      setConfirmed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la réservation');
    } finally {
      setLoading(false);
    }
  }

  function handlePay() {
    router.push('/cart');
  }

  return (
    <View className="flex-1 bg-background px-4 pt-6 gap-6">
      <Card className="gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>{roomName}</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="py-4 gap-3">
          <Row label="Date" value={format(start, 'EEEE d MMMM yyyy', { locale: fr })} />
          <Row label="Horaire" value={`${format(start, "HH'h'mm")} → ${format(end, "HH'h'mm")}`} />
          <Row label="Durée" value={`${durationH}h`} />
          {price !== null && <Row label="Prix" value={`${price} €`} />}
        </CardContent>
      </Card>

      {error && <Text className="text-center text-destructive">{error}</Text>}

      {!confirmed ? (
        <Button onPress={handleConfirm} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text>Confirmer la réservation</Text>}
        </Button>
      ) : (
        <View className="gap-3">
          <Card className="border-green-500 bg-green-50 py-4 dark:bg-green-900/20">
            <CardContent>
              <Text className="text-center text-green-700 dark:text-green-300">
                Réservation confirmée
                {expiresAt
                  ? ` — panier réservé jusqu'à ${format(parseISO(expiresAt), "HH'h'mm")}`
                  : ''}
              </Text>
            </CardContent>
          </Card>
          <Button onPress={handlePay}>
            <Text>Payer sur fightroom.fr</Text>
          </Button>
          <Button variant="outline" onPress={() => router.replace('/(tabs)')}>
            <Text>Retour aux salles</Text>
          </Button>
        </View>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-muted-foreground">{label}</Text>
      <Text className="font-medium text-foreground">{value}</Text>
    </View>
  );
}
