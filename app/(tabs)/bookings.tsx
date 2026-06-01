import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCustomerBookings } from '@/hooks/useCustomerBookings';
import type { Booking } from '@/lib/api';
import { THEME } from '@/lib/theme';
import { format, parseISO, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { router } from 'expo-router';
import { CalendarIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmée',
  pending: 'En attente',
  cancelled: 'Annulée',
  completed: 'Terminée',
};

const STATUS_CLASS: Record<string, string> = {
  confirmed: 'border-green-500 bg-green-100 dark:bg-green-900/30',
  pending: 'border-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
  cancelled: 'border-destructive/50 bg-destructive/10',
  completed: '',
};

const STATUS_TEXT_CLASS: Record<string, string> = {
  confirmed: 'text-green-700 dark:text-green-300',
  pending: 'text-yellow-700 dark:text-yellow-300',
  cancelled: 'text-destructive',
  completed: 'text-muted-foreground',
};

const DEPOSIT_STATUS: Record<string, string> = {
  scheduled: 'Acompte à venir',
  paid: 'Payé',
  captured: 'Payé',
  failed: 'Échec paiement',
  cancelled: 'Annulé',
};

function isArchivedBooking(booking: Booking): boolean {
  if (booking.status === 'cancelled' || booking.status === 'completed') return true;
  return parseISO(booking.local_date) < startOfDay(new Date());
}

export default function BookingsScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useCustomerBookings();
  const [showArchived, setShowArchived] = React.useState(false);
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center text-destructive">{error.message}</Text>
      </View>
    );
  }

  const bookings = data?.bookings ?? [];
  const activeBookings = bookings.filter((b) => !isArchivedBooking(b));
  const archivedBookings = bookings.filter(isArchivedBooking);
  const displayed = showArchived ? bookings : activeBookings;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pt-4 pb-8 gap-3"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
      <View className="flex-row items-center justify-between py-2">
        <Text variant="h3" className="text-foreground">
          Mes réservations
        </Text>
        {archivedBookings.length > 0 && (
          <Pressable onPress={() => setShowArchived((v) => !v)} className="active:opacity-60 py-1 pl-3">
            <Text className="text-sm text-muted-foreground">
              {showArchived ? 'Actives seulement' : `Historique (${archivedBookings.length})`}
            </Text>
          </Pressable>
        )}
      </View>

      {displayed.length === 0 && (
        <View className="mt-16 items-center gap-3">
          <CalendarIcon size={40} color={colors.mutedForeground} />
          <Text className="text-muted-foreground">
            {bookings.length === 0 ? 'Aucune réservation pour le moment' : 'Aucune réservation à venir'}
          </Text>
        </View>
      )}

      {displayed.map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
    </ScrollView>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const item = booking.booking_line_items[0];
  const deposit = booking.deposit_summary;

  const dateLabel = format(parseISO(booking.local_date), 'EEEE d MMMM yyyy', { locale: fr });
  const start = booking.local_start_time.slice(0, 5).replace(':', 'h');
  const end = booking.local_end_time.slice(0, 5).replace(':', 'h');
  const depositDue = deposit.next_due_at
    ? format(parseISO(deposit.next_due_at), "d MMM à HH'h'mm", { locale: fr })
    : null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/booking/[id]', params: { id: booking.id, bookingJson: JSON.stringify(booking) } })}
      className="active:opacity-75">
      <Card className={`gap-0 py-0 ${booking.status === 'cancelled' ? 'opacity-60' : ''}`}>
        <CardHeader className="flex-row items-center justify-between py-4">
          <View className="flex-1 gap-0.5">
            <CardTitle className="text-base">{item?.resource_title ?? 'Salle'}</CardTitle>
            <Text className="text-xs text-muted-foreground">{booking.booking_number}</Text>
          </View>
          <Badge
            variant="outline"
            className={STATUS_CLASS[booking.status] ?? ''}>
            <Text className={`text-xs font-medium ${STATUS_TEXT_CLASS[booking.status] ?? 'text-foreground'}`}>
              {STATUS_LABEL[booking.status] ?? booking.status}
            </Text>
          </Badge>
        </CardHeader>

        <Separator />

        <CardContent className="py-4 gap-1">
          <Text className="capitalize text-foreground">{dateLabel}</Text>
          <Text className="text-muted-foreground">{start} → {end}</Text>

          {deposit.has_deposit && (
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-sm text-foreground">
                {item ? `${item.quoted_unit_price} €` : '—'}
              </Text>
              <View className="items-end">
                <Text className="text-xs text-muted-foreground">
                  {DEPOSIT_STATUS[deposit.overall_status] ?? deposit.overall_status}
                </Text>
                {depositDue && deposit.overall_status === 'scheduled' && (
                  <Text className="text-xs text-muted-foreground">Échéance : {depositDue}</Text>
                )}
              </View>
            </View>
          )}
        </CardContent>
      </Card>
    </Pressable>
  );
}
