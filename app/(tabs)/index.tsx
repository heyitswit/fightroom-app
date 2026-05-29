import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useVenues } from '@/hooks/useRooms';
import { type Venue } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth';
import { router } from 'expo-router';
import { LogOutIcon } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, ScrollView, View } from 'react-native';

const TILE = 256;
const ZOOM = 15;


function OsmMap({ lat, lng, height = 130 }: { lat: number; lng: number; height?: number }) {
  const n = Math.pow(2, ZOOM);
  const xFrac = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFrac = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const cx = Math.floor(xFrac);
  const cy = Math.floor(yFrac);
  const px = (xFrac - cx) * TILE;
  const py = (yFrac - cy) * TILE;
  const cardWidth = Dimensions.get('window').width - 32;
  const left = cardWidth / 2 - (TILE + px);
  const top = height / 2 - (TILE + py);

  const tiles: { x: number; y: number; key: string }[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      tiles.push({ x, y, key: `${dx}-${dy}` });
    }
  }

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left, top, width: TILE * 3, height: TILE * 3, flexDirection: 'row', flexWrap: 'wrap' }}>
        {tiles.map((t) => (
          <Image
            key={t.key}
            source={{ uri: `https://a.basemaps.cartocdn.com/rastertiles/voyager/${ZOOM}/${t.x}/${t.y}.png` }}
            style={{ width: TILE, height: TILE }}
          />
        ))}
      </View>
      {/* marker */}
      <View style={{ position: 'absolute', left: cardWidth / 2 - 5, top: height / 2 - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#fb4c10', borderWidth: 2, borderColor: 'white' }} />
    </View>
  );
}

export default function HomeScreen() {
  const { customer, logout } = useAuthStore();
  const { data: venues, isLoading, error } = useVenues();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 pt-4 pb-8 gap-4">
      <View className="flex-row items-center justify-between py-2">
        <View>
          <Text variant="h3" className="text-foreground">
            Lieux
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

      {isLoading && (
        <View className="mt-8 items-center">
          <ActivityIndicator />
        </View>
      )}

      {error && <Text className="text-center text-destructive">{error.message}</Text>}

      {venues?.map((venue) => (
        <VenueCard key={venue.slug} venue={venue} />
      ))}
    </ScrollView>
  );
}

function VenueCard({ venue }: { venue: Venue }) {
  const hasCoords = venue.latitude !== null && venue.longitude !== null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/venue/[slug]' as never, params: { slug: venue.slug } })}
      className="active:opacity-75">
      <Card className="overflow-hidden py-0 gap-0">
        {hasCoords && <OsmMap lat={venue.latitude!} lng={venue.longitude!} />}
        <CardHeader className="gap-1 py-4">
          <CardTitle className="text-xl">{venue.name}</CardTitle>
          <CardDescription>
            {venue.rooms.length} salle{venue.rooms.length > 1 ? 's' : ''} · Location horaire
            {venue.address ? ` · ${venue.address}` : ''}
          </CardDescription>
        </CardHeader>
      </Card>
    </Pressable>
  );
}
