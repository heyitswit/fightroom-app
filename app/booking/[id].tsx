import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OpenMapsButton } from '@/components/OpenMapsButton';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useBookingDetail } from '@/hooks/useBookingDetail';
import { useFriends } from '@/hooks/useFriends';
import { useVenues } from '@/hooks/useRooms';
import { useCreateShare } from '@/hooks/useShares';
import { cancelBooking, fetchCancellationPreview } from '@/lib/api';
import type { Booking, CancellationPreview, Netcode } from '@/lib/api';
import type { SharedBooking } from '@/lib/share-api';
import { DEPOSIT_STATUS } from '@/lib/labels';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { LockIcon, Share2Icon } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

const fmtEur = (n: number) => n.toFixed(2).replace('.', ',');

function fmtDuration(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}min`);
  return parts.join(' ');
}

export default function BookingDetailScreen() {
  const { id, bookingJson } = useLocalSearchParams<{ id: string; bookingJson: string }>();
  const booking: Booking | null = React.useMemo(() => {
    try { return JSON.parse(bookingJson); } catch { return null; }
  }, [bookingJson]);

  const { data, isLoading, error } = useBookingDetail(id);
  const { data: venues } = useVenues();
  const queryClient = useQueryClient();

  const [cancelling, setCancelling] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<CancellationPreview | null>(null);
  const [shareOpen, setShareOpen] = React.useState(false);

  const friends = useFriends();
  const createShare = useCreateShare();

  const item = booking?.booking_line_items[0];
  const deposit = booking?.deposit_summary;
  const dateLabel = booking
    ? format(parseISO(booking.local_date), 'EEEE d MMMM yyyy', { locale: fr })
    : '';
  const start = booking?.local_start_time.slice(0, 5).replace(':', 'h') ?? '';
  const end = booking?.local_end_time.slice(0, 5).replace(':', 'h') ?? '';

  const venue = venues?.find((v) => v.rooms.some((r) => r.id === item?.resource_id));

  async function handleCancel() {
    if (!booking) return;
    setCancelling(true);
    try {
      const p = await fetchCancellationPreview(booking.id);
      if (!p.can_cancel) {
        Alert.alert('Annulation impossible', p.cancellation_policy.block_reason ?? 'Cette réservation ne peut pas être annulée.');
        return;
      }
      setPreview(p);
      setDialogOpen(true);
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de charger les conditions d\'annulation');
    } finally {
      setCancelling(false);
    }
  }

  async function doCancel(withRefund: boolean) {
    if (!booking) return;
    setCancelling(true);
    try {
      await cancelBooking(booking.id, withRefund);
      queryClient.invalidateQueries({ queryKey: ['customer-bookings'] });
      router.back();
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Annulation échouée');
    } finally {
      setCancelling(false);
    }
  }

  // Snapshot of the booking + its access codes to send to a friend.
  function buildSharedBooking(): SharedBooking | null {
    if (!booking || !data) return null;
    return {
      bookingId: booking.id,
      room: item?.resource_title ?? 'Salle',
      date: booking.local_date,
      startTime: booking.local_start_time,
      endTime: booking.local_end_time,
      timeZone: booking.time_zone,
      netcodes: data.netcodes.map((n) => ({
        deviceName: n.device_name,
        code: n.code,
        status: n.status,
        from: n.effective_from,
        until: n.effective_until,
      })),
    };
  }

  function handleShare(toEmail: string, name: string) {
    const sharedBooking = buildSharedBooking();
    if (!sharedBooking) return;
    createShare.mutate(
      { toEmail, booking: sharedBooking },
      {
        onSuccess: () => {
          setShareOpen(false);
          Alert.alert('Partagé', `Codes partagés avec ${name}.`);
        },
        onError: (e) =>
          Alert.alert('Erreur', e instanceof Error ? e.message : 'Partage échoué'),
      }
    );
  }

  const canShare = !!booking && !!data && data.netcodes.length > 0;
  const friendsList = friends.data?.friends ?? [];

  return (
    <>
      <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 pt-4 pb-10 gap-4">
        {/* Summary */}
        {booking && (
          <Card className="gap-0 py-0">
            <CardHeader className="py-4">
              <CardTitle>{item?.resource_title}</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="gap-1.5 py-4">
              <Text className="capitalize text-foreground">{dateLabel}</Text>
              <Text className="text-muted-foreground">
                {start} → {end}
              </Text>
              {deposit?.has_deposit && (
                <Text className="mt-1 text-sm text-muted-foreground">
                  Acompte {deposit.total_amount} €
                  {deposit.overall_status === 'scheduled' && deposit.next_due_at
                    ? ` · échéance ${format(parseISO(deposit.next_due_at), 'd MMM', { locale: fr })}`
                    : ` · ${DEPOSIT_STATUS[deposit.overall_status] ?? deposit.overall_status}`}
                </Text>
              )}
            </CardContent>
          </Card>
        )}

        {venue && <OpenMapsButton venue={venue} />}

        {/* Access codes */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text variant="h3" className="text-foreground">
              Codes d'accès
            </Text>
            {canShare && (
              <Button
                size="sm"
                variant="outline"
                onPress={() => setShareOpen(true)}
                className="flex-row gap-1.5">
                <Share2Icon size={15} color="#6b7280" />
                <Text>Partager</Text>
              </Button>
            )}
          </View>

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

        {booking?.status === 'confirmed' && (
          <Pressable onPress={handleCancel} disabled={cancelling} className="active:opacity-70">
            <View className="items-center rounded-lg border border-destructive/40 px-4 py-3">
              {cancelling ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text className="text-sm font-medium text-destructive">Annuler la réservation</Text>
              )}
            </View>
          </Pressable>
        )}
      </ScrollView>

      {preview && (
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Annuler la réservation ?</AlertDialogTitle>
            </AlertDialogHeader>

            <View className="gap-3">
              <Text className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Détail du remboursement
              </Text>

              <View className="overflow-hidden rounded-lg border border-border">
                <RefundRow
                  label1="Montant de la réservation"
                  value1={`${fmtEur(preview.booking_amount)} €`}
                  label2="Remboursement de base"
                  value2={`${fmtEur(preview.cancellation_policy.base_refund)} €`}
                />
                <View className="border-t border-border">
                  <RefundRow
                    label1="Frais"
                    value1={`${fmtEur(preview.cancellation_policy.fees_total)} €`}
                    label2="Remboursement contractuel"
                    value2={`${fmtEur(preview.contract_refund_amount)} €`}
                  />
                </View>
                <View className="border-t border-border">
                  <RefundRow
                    label1="Pourcentage remboursé"
                    value1={`${preview.cancellation_policy.refund_percent}%`}
                    label2="Avant le début"
                    value2={fmtDuration(preview.cancellation_policy.minutes_until_start)}
                  />
                </View>
              </View>

              <AlertDialogDescription>
                Vous êtes à {fmtDuration(preview.cancellation_policy.minutes_until_start)} du début.
                Remboursement de base de {fmtEur(preview.cancellation_policy.base_refund)} €, moins{' '}
                {fmtEur(preview.cancellation_policy.fees_total)} € de frais, pour un remboursement
                final de {fmtEur(preview.cancellation_policy.refund_final)} €.
              </AlertDialogDescription>
            </View>

            <View className="gap-2 pt-1">
              {preview.can_apply_contract_refund && (
                <AlertDialogAction onPress={() => doCancel(true)}>
                  <Text>Annuler et rembourser {fmtEur(preview.cancellation_policy.refund_final)} €</Text>
                </AlertDialogAction>
              )}
              <AlertDialogAction
                className="bg-destructive border-destructive"
                onPress={() => doCancel(false)}>
                <Text>Annuler sans remboursement</Text>
              </AlertDialogAction>
              <AlertDialogCancel>
                <Text>Garder la réservation</Text>
              </AlertDialogCancel>
            </View>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partager les codes</DialogTitle>
            <DialogDescription>
              Choisissez un ami. Il recevra l'heure et les codes d'accès de cette réservation.
            </DialogDescription>
          </DialogHeader>

          <View className="gap-2">
            {friends.isLoading && (
              <View className="items-center py-4">
                <ActivityIndicator />
              </View>
            )}

            {!friends.isLoading && friendsList.length === 0 && (
              <Text className="py-2 text-center text-sm text-muted-foreground">
                Aucun ami pour l'instant. Ajoutez-en dans l'onglet Amis.
              </Text>
            )}

            {friendsList.map((friend) => (
              <Pressable
                key={friend.requestId}
                disabled={createShare.isPending}
                onPress={() => handleShare(friend.email, friend.name)}
                className="active:opacity-70">
                <View className="flex-row items-center justify-between rounded-lg border border-border px-4 py-3">
                  <View className="flex-1 pr-3">
                    <Text className="font-medium text-foreground">{friend.name}</Text>
                    <Text className="text-xs text-muted-foreground">{friend.email}</Text>
                  </View>
                  {createShare.isPending ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Share2Icon size={16} color="#6b7280" />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RefundRow({
  label1, value1, label2, value2,
}: {
  label1: string; value1: string; label2: string; value2: string;
}) {
  return (
    <View className="flex-row">
      <View className="flex-1 gap-1 border-r border-border p-3">
        <Text className="text-xs uppercase tracking-wide text-muted-foreground">{label1}</Text>
        <Text className="text-base font-semibold text-foreground">{value1}</Text>
      </View>
      <View className="flex-1 gap-1 p-3">
        <Text className="text-xs uppercase tracking-wide text-muted-foreground">{label2}</Text>
        <Text className="text-base font-semibold text-foreground">{value2}</Text>
      </View>
    </View>
  );
}

const NETCODE_STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  authorized: 'Autorisé',
  released: 'Actif',
  scheduled: 'Programmé',
  pending: 'En attente',
  expired: 'Expiré',
  used: 'Utilisé',
  cancelled: 'Annulé',
  revoked: 'Révoqué',
};

const NETCODE_BADGE_CLASS: Record<string, string> = {
  active: 'border-green-500 bg-green-100 dark:bg-green-900/30',
  authorized: 'border-green-500 bg-green-100 dark:bg-green-900/30',
  released: 'border-green-500 bg-green-100 dark:bg-green-900/30',
  scheduled: 'border-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
  pending: 'border-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
};

const NETCODE_TEXT_CLASS: Record<string, string> = {
  active: 'text-green-700 dark:text-green-300',
  authorized: 'text-green-700 dark:text-green-300',
  released: 'text-green-700 dark:text-green-300',
  scheduled: 'text-yellow-700 dark:text-yellow-300',
  pending: 'text-yellow-700 dark:text-yellow-300',
};

function NetcodeCard({ netcode }: { netcode: Netcode }) {
  const [copied, setCopied] = React.useState(false);
  const parts = netcode.code?.split(' + ') ?? [];
  const numericCode = parts[0] ?? null;
  const suffix = parts[1] ?? null;
  const from = format(parseISO(netcode.effective_from), "HH'h'mm");
  const until = format(parseISO(netcode.effective_until), "HH'h'mm");

  async function handleCopy() {
    if (!numericCode) return;
    await Clipboard.setStringAsync(numericCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusLabel = NETCODE_STATUS_LABEL[netcode.status] ?? netcode.status;
  const badgeClass = NETCODE_BADGE_CLASS[netcode.status] ?? '';
  const textClass = NETCODE_TEXT_CLASS[netcode.status] ?? 'text-muted-foreground';

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex-row items-center justify-between py-3">
        <View className="flex-1 flex-row items-center gap-2">
          <LockIcon size={15} color="#6b7280" />
          <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
            {netcode.device_name}
          </Text>
        </View>
        <Badge variant="outline" className={badgeClass}>
          <Text className={`text-xs font-medium ${textClass}`}>
            {statusLabel}
          </Text>
        </Badge>
      </CardHeader>

      <Separator />

      <CardContent className="gap-3 py-4">
        {numericCode ? (
          <Pressable onPress={handleCopy} className="active:opacity-70">
            <View className="items-center gap-1 rounded-lg bg-muted px-4 py-5">
              <Text className="text-4xl font-bold tracking-widest text-foreground">
                {numericCode}
              </Text>
              {suffix && <Text className="text-sm text-muted-foreground">puis {suffix}</Text>}
              <Text className="mt-1 text-xs text-muted-foreground">
                {copied ? '✓ Copié !' : 'Appuyer pour copier'}
              </Text>
            </View>
          </Pressable>
        ) : (
          <View className="items-center rounded-lg bg-muted px-4 py-5">
            <Text className="text-sm text-muted-foreground">Code non disponible</Text>
          </View>
        )}
        <Text className="text-center text-xs text-muted-foreground">
          Valide {from} → {until}
        </Text>
      </CardContent>
    </Card>
  );
}
