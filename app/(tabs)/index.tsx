import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { ROOMS } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth';
import { router } from 'expo-router';
import { LogOutIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

const ROOM_ICONS: Record<string, string> = {
  Ring: '🥊',
  Percussions: '🥋',
  Octogone: '⬡',
};

export default function HomeScreen() {
  const { customer, logout } = useAuthStore();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 pt-4 pb-8 gap-4">
      <View className="flex-row items-center justify-between py-2">
        <View>
          <Text variant="h3" className="text-foreground">
            Salles
          </Text>
          {customer && (
            <Text className="text-sm text-muted-foreground">
              {customer.first_name} {customer.last_name}
            </Text>
          )}
        </View>
        <Button variant="ghost" size="icon" onPress={logout} className="rounded-full">
          <LogOutIcon size={18} color="#6b7280" />
        </Button>
      </View>

      {ROOMS.map((room) => (
        <RoomCard key={room.name} room={room} />
      ))}
    </ScrollView>
  );
}

function RoomCard({ room }: { room: (typeof ROOMS)[number] }) {
  function handlePress() {
    if (!room.available || !room.id) return;
    router.push({ pathname: '/booking', params: { roomId: room.id, roomName: room.name } });
  }

  return (
    <Pressable onPress={handlePress} disabled={!room.available} className="active:opacity-75">
      <Card className={`gap-2 py-5 ${!room.available ? 'opacity-50' : ''}`}>
        <CardHeader className="gap-2 pb-0">
          <Text className="text-3xl">{ROOM_ICONS[room.name] ?? '🏟'}</Text>
          <CardTitle className="text-xl">{room.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>
            {room.available ? 'Location horaire · 1h min · Paris' : 'Bientôt disponible'}
          </CardDescription>
        </CardContent>
      </Card>
    </Pressable>
  );
}
