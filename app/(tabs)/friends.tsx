import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import {
  useCancelFriendRequest,
  useFriendRequests,
  useFriends,
  useRemoveFriend,
  useRespondToRequest,
  useSendFriendRequest,
} from '@/hooks/useFriends';
import { useShares } from '@/hooks/useShares';
import type { Friend, FriendRequest, Share } from '@/lib/share-api';
import { THEME } from '@/lib/theme';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as Clipboard from 'expo-clipboard';
import { LockIcon, UsersIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';

export default function FriendsScreen() {
  const queryClient = useQueryClient();
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];

  const friends = useFriends();
  const requests = useFriendRequests();
  const shares = useShares();

  const sendRequest = useSendFriendRequest();
  const respond = useRespondToRequest();
  const cancel = useCancelFriendRequest();
  const remove = useRemoveFriend();

  const [email, setEmail] = React.useState('');

  const refreshing =
    friends.isRefetching || requests.isRefetching || shares.isRefetching;

  function refetchAll() {
    queryClient.invalidateQueries({ queryKey: ['friends'] });
    queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    queryClient.invalidateQueries({ queryKey: ['shares'] });
  }

  function handleAdd() {
    const value = email.trim();
    if (!value) return;
    sendRequest.mutate(value, {
      onSuccess: () => setEmail(''),
      onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : 'Demande échouée'),
    });
  }

  const received = shares.data?.received ?? [];
  const friendsList = friends.data?.friends ?? [];
  const incoming = requests.data?.incoming ?? [];
  const outgoing = requests.data?.outgoing ?? [];

  const loading = friends.isLoading || requests.isLoading || shares.isLoading;
  const apiError = friends.error ?? requests.error ?? shares.error;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pt-4 pb-10 gap-6"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} />}>
      {apiError && (
        <Card className="border-destructive/30 bg-destructive/10 py-4">
          <CardContent>
            <Text className="text-sm text-destructive">
              {apiError instanceof Error ? apiError.message : 'Serveur de partage injoignable'}
            </Text>
          </CardContent>
        </Card>
      )}

      {/* Add a friend */}
      <View className="gap-3">
        <Text variant="h3" className="text-foreground">
          Ajouter un ami
        </Text>
        <View className="flex-row gap-2">
          <Input
            className="flex-1"
            placeholder="Email de l'ami"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={handleAdd}
            returnKeyType="send"
          />
          <Button onPress={handleAdd} disabled={sendRequest.isPending || !email.trim()}>
            {sendRequest.isPending ? <ActivityIndicator color="white" /> : <Text>Inviter</Text>}
          </Button>
        </View>
      </View>

      {/* Received shares */}
      <View className="gap-3">
        <Text variant="h3" className="text-foreground">
          Partages reçus
        </Text>
        {loading && received.length === 0 && (
          <View className="items-center py-6">
            <ActivityIndicator />
          </View>
        )}
        {!loading && received.length === 0 && (
          <Card className="py-4">
            <CardContent>
              <Text className="text-center text-muted-foreground">
                Aucun code partagé avec vous pour le moment
              </Text>
            </CardContent>
          </Card>
        )}
        {received.map((share) => (
          <SharedBookingCard key={share.id} share={share} />
        ))}
      </View>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <View className="gap-3">
          <Text variant="h3" className="text-foreground">
            Demandes reçues
          </Text>
          {incoming.map((req) => (
            <Card key={req.id} className="py-0">
              <CardContent className="flex-row items-center justify-between py-3">
                <View className="flex-1 pr-3">
                  <Text className="font-medium text-foreground">{req.fromName}</Text>
                  <Text className="text-xs text-muted-foreground">{req.fromEmail}</Text>
                </View>
                <View className="flex-row gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={respond.isPending}
                    onPress={() => respond.mutate({ id: req.id, action: 'decline' })}>
                    <Text>Refuser</Text>
                  </Button>
                  <Button
                    size="sm"
                    disabled={respond.isPending}
                    onPress={() => respond.mutate({ id: req.id, action: 'accept' })}>
                    <Text>Accepter</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      {/* Friends list */}
      <View className="gap-3">
        <Text variant="h3" className="text-foreground">
          Mes amis
        </Text>
        {friendsList.length === 0 && !loading && (
          <View className="mt-2 items-center gap-3">
            <UsersIcon size={36} color={colors.mutedForeground} />
            <Text className="text-center text-muted-foreground">
              Ajoutez des amis pour leur partager vos codes d'accès
            </Text>
          </View>
        )}
        {friendsList.map((friend) => (
          <FriendRow key={friend.requestId} friend={friend} onRemove={() => confirmRemove(friend, remove)} />
        ))}
      </View>

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <View className="gap-3">
          <Text variant="h3" className="text-foreground">
            Demandes envoyées
          </Text>
          {outgoing.map((req) => (
            <OutgoingRow key={req.id} req={req} onCancel={() => cancel.mutate(req.id)} pending={cancel.isPending} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function confirmRemove(friend: Friend, remove: ReturnType<typeof useRemoveFriend>) {
  Alert.alert('Retirer cet ami ?', `${friend.name} ne pourra plus voir vos partages.`, [
    { text: 'Annuler', style: 'cancel' },
    {
      text: 'Retirer',
      style: 'destructive',
      onPress: () =>
        remove.mutate(friend.requestId, {
          onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec'),
        }),
    },
  ]);
}

function FriendRow({ friend, onRemove }: { friend: Friend; onRemove: () => void }) {
  return (
    <Card className="py-0">
      <CardContent className="flex-row items-center justify-between py-3">
        <View className="flex-1 pr-3">
          <Text className="font-medium text-foreground">{friend.name}</Text>
          <Text className="text-xs text-muted-foreground">{friend.email}</Text>
        </View>
        <Pressable onPress={onRemove} className="active:opacity-60 py-1 pl-3">
          <Text className="text-sm text-destructive">Retirer</Text>
        </Pressable>
      </CardContent>
    </Card>
  );
}

function OutgoingRow({
  req,
  onCancel,
  pending,
}: {
  req: FriendRequest;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <Card className="py-0">
      <CardContent className="flex-row items-center justify-between py-3">
        <View className="flex-1 pr-3">
          <Text className="text-foreground">{req.toEmail}</Text>
          <Text className="text-xs text-muted-foreground">En attente</Text>
        </View>
        <Pressable onPress={onCancel} disabled={pending} className="active:opacity-60 py-1 pl-3">
          <Text className="text-sm text-muted-foreground">Annuler</Text>
        </Pressable>
      </CardContent>
    </Card>
  );
}

function SharedBookingCard({ share }: { share: Share }) {
  const { booking } = share;
  const dateLabel = (() => {
    try {
      return format(parseISO(booking.date), 'EEEE d MMMM yyyy', { locale: fr });
    } catch {
      return booking.date;
    }
  })();
  const start = booking.startTime.slice(0, 5).replace(':', 'h');
  const end = booking.endTime.slice(0, 5).replace(':', 'h');

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="py-3">
        <CardTitle className="text-base">{booking.room}</CardTitle>
        <Text className="text-xs text-muted-foreground">Partagé par {share.fromName}</Text>
      </CardHeader>
      <Separator />
      <CardContent className="gap-3 py-4">
        <View className="gap-0.5">
          <Text className="capitalize text-foreground">{dateLabel}</Text>
          <Text className="text-muted-foreground">
            {start} → {end}
          </Text>
        </View>
        {booking.netcodes.length === 0 && (
          <Text className="text-sm text-muted-foreground">Codes non disponibles</Text>
        )}
        {booking.netcodes.map((nc, i) => (
          <SharedNetcodeRow key={`${nc.deviceName}-${i}`} netcode={nc} />
        ))}
      </CardContent>
    </Card>
  );
}

function SharedNetcodeRow({
  netcode,
}: {
  netcode: Share['booking']['netcodes'][number];
}) {
  const [copied, setCopied] = React.useState(false);
  const parts = netcode.code?.split(' + ') ?? [];
  const numericCode = parts[0] ?? null;
  const suffix = parts[1] ?? null;

  const fmtTime = (iso: string) => {
    try {
      return format(parseISO(iso), "HH'h'mm");
    } catch {
      return iso;
    }
  };

  async function handleCopy() {
    if (!numericCode) return;
    await Clipboard.setStringAsync(numericCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View className="gap-1.5 rounded-lg border border-border p-3">
      <View className="flex-row items-center gap-2">
        <LockIcon size={14} color="#6b7280" />
        <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
          {netcode.deviceName}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {fmtTime(netcode.from)} → {fmtTime(netcode.until)}
        </Text>
      </View>
      {numericCode ? (
        <Pressable onPress={handleCopy} className="active:opacity-70">
          <View className="items-center gap-1 rounded-lg bg-muted px-4 py-4">
            <Text className="text-3xl font-bold tracking-widest text-foreground">{numericCode}</Text>
            {suffix && <Text className="text-sm text-muted-foreground">puis {suffix}</Text>}
            <Text className="mt-1 text-xs text-muted-foreground">
              {copied ? '✓ Copié !' : 'Appuyer pour copier'}
            </Text>
          </View>
        </Pressable>
      ) : (
        <View className="items-center rounded-lg bg-muted px-4 py-4">
          <Text className="text-sm text-muted-foreground">Code non disponible</Text>
        </View>
      )}
    </View>
  );
}
