import { Text } from '@/components/ui/text';
import { type Venue } from '@/lib/api';
import { MapPinIcon } from 'lucide-react-native';
import { Linking, Platform, Pressable, View } from 'react-native';

export function OpenMapsButton({ venue }: { venue: Venue }) {
  function openMaps() {
    const query = encodeURIComponent(`Fight Room ${venue.address ?? ''}`);
    const url = Platform.OS === 'ios' ? `maps://?q=${query}` : `geo:0,0?q=${query}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    });
  }

  return (
    <Pressable onPress={openMaps} className="active:opacity-70">
      <View className="flex-row items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <MapPinIcon size={18} color="#fb4c10" />
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground">Ouvrir sur Maps</Text>
          {venue.address ? (
            <Text className="text-xs text-muted-foreground">{venue.address}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
