import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OpenMapsButton } from '@/components/OpenMapsButton';
import { Text } from '@/components/ui/text';
import { useVenues } from '@/hooks/useRooms';
import { type Room } from '@/lib/api';
import { router, useLocalSearchParams } from 'expo-router';
import { Building2, LucideIcon, Octagon, Shield, Swords, Target } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

const ROOM_ICONS: Record<string, LucideIcon> = {
  Ring: Swords,
  Percussions: Target,
  Octogone: Octagon,
  Dojo: Shield,
};

export default function VenueScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: venues, isLoading, error } = useVenues();

  const venue = venues?.find((v) => v.slug === slug);

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

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 pt-4 pb-8 gap-4">
      {venue && <OpenMapsButton venue={venue} />}
      {venue?.rooms.map((room) => (
        <RoomCard key={room.id} room={room} />
      ))}
    </ScrollView>
  );
}

function RoomCard({ room }: { room: Room }) {
  const Icon = ROOM_ICONS[room.name] ?? Building2;
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/booking', params: { roomId: room.id, roomName: room.name } })
      }
      disabled={!room.available}
      className="active:opacity-75">
      <Card className={`gap-2 py-5 ${!room.available ? 'opacity-50' : ''}`}>
        <CardHeader className="gap-2 pb-0">
          <Icon size={32} color="#fb4c10" />
          <CardTitle className="text-xl">{room.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>
            {room.available ? 'Location horaire · 1h minimum' : 'Bientôt disponible'}
          </CardDescription>
        </CardContent>
      </Card>
    </Pressable>
  );
}
