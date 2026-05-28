import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useBookingDetail } from '@/hooks/useBookingDetail';
import type { Booking, Netcode } from '@/lib/api';
import * as Clipboard from 'expo-clipboard';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLocalSearchParams } from 'expo-router';
import { LockIcon } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

export default function BookingDetailScreen() {
  const { id, bookingJson } = useLocalSearchParams<{ id: string; bookingJson: string }>();
  const booking: Booking | null = React.useMemo(() => {
    try { return JSON.parse(bookingJson); } catch { return null; }
  }, [bookingJson]);

  const { data, isLoading, error } = useBookingDetail(id);

  const item = booking?.booking_line_items[0];
  const deposit = booking?.deposit_summary;
  const dateLabel = booking
    ? format(parseISO(booking.local_date), 'EEEE d MMMM yyyy', { locale: fr })
    : '';
  const start = booking?.local_start_time.slice(0, 5).replace(':', 'h') ?? '';
  const end = booking?.local_end_time.slice(0, 5).replace(':', 'h') ?? '';

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 pt-4 pb-10 gap-4">
      {/* Résumé */}
      {booking && (
        <Card className="gap-0 py-0">
          <CardHeader className="py-4">
            <CardTitle>{item?.resource_title}</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="py-4 gap-1.5">
            <Text className="capitalize text-foreground">{dateLabel}</Text>
            <Text className="text-muted-foreground">{start} → {end}</Text>
            {deposit?.has_deposit && (
              <Text className="text-sm text-muted-foreground mt-1">
                Acompte {deposit.total_amount} €
                {deposit.overall_status === 'scheduled' && deposit.next_due_at
                  ? ` · échéance ${format(parseISO(deposit.next_due_at), 'd MMM', { locale: fr })}`
                  : ` · ${deposit.overall_status}`}
              </Text>
            )}
          </CardContent>
        </Card>
      )}

      {/* Codes d'accès */}
      <View className="gap-3">
        <Text variant="h3" className="text-foreground">Codes d'accès</Text>

        {isLoading && (
          <View className="items-center py-8">
            <ActivityIndicator />
          </View>
        )}

        {error && (
          <Card className="border-destructive/30 bg-destructive/10 py-4">
            <CardContent>
              <Text className="text-sm text-destructive">{error.message}</Text>
            </CardContent>
          </Card>
        )}

        {data?.netcodes.map((netcode) => (
          <NetcodeCard key={netcode.id} netcode={netcode} />
        ))}

        {data?.netcodes.length === 0 && (
          <Card className="py-4">
            <CardContent>
              <Text className="text-center text-muted-foreground">Codes disponibles le jour J</Text>
            </CardContent>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

function NetcodeCard({ netcode }: { netcode: Netcode }) {
  const [copied, setCopied] = React.useState(false);
  const numericCode = netcode.code.split(' + ')[0];
  const suffix = netcode.code.split(' + ')[1];
  const from = format(parseISO(netcode.effective_from), "HH'h'mm");
  const until = format(parseISO(netcode.effective_until), "HH'h'mm");
  const isActive = netcode.status === 'active';

  async function handleCopy() {
    await Clipboard.setStringAsync(numericCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex-row items-center justify-between py-3">
        <View className="flex-row items-center gap-2 flex-1">
          <LockIcon size={15} color="#6b7280" />
          <Text className="text-sm font-medium text-foreground flex-1" numberOfLines={1}>
            {netcode.device_name}
          </Text>
        </View>
        <Badge
          variant="outline"
          className={isActive ? 'border-green-500 bg-green-100 dark:bg-green-900/30' : ''}>
          <Text className={`text-xs font-medium ${isActive ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`}>
            {isActive ? 'Actif' : netcode.status}
          </Text>
        </Badge>
      </CardHeader>

      <Separator />

      <CardContent className="py-4 gap-3">
        <Pressable onPress={handleCopy} className="active:opacity-70">
          <View className="rounded-lg bg-muted px-4 py-5 items-center gap-1">
            <Text className="text-4xl font-bold tracking-widest text-foreground">
              {numericCode}
            </Text>
            {suffix && (
              <Text className="text-sm text-muted-foreground">puis {suffix}</Text>
            )}
            <Text className="text-xs text-muted-foreground mt-1">
              {copied ? '✓ Copié !' : 'Appuyer pour copier'}
            </Text>
          </View>
        </Pressable>
        <Text className="text-xs text-center text-muted-foreground">
          Valide {from} → {until}
        </Text>
      </CardContent>
    </Card>
  );
}
