import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { quakeColor, Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { formatMagnitude, shortenPlace } from '@/utils/format';
import type { Quake } from '@/types/earthquake';

type Props = {
  quakes: Quake[];
  selectedId?: string | null;
  onSelect?: (quake: Quake) => void;
};

/**
 * Android implementation. `react-native-maps` is bundled in Expo Go, so this
 * renders without a development build. The web preview uses QuakeMap.web.tsx
 * because react-native-maps has no web renderer.
 */
function QuakeMapImpl({ quakes, selectedId, onSelect }: Props) {
  const theme = useTheme();
  const isDark = useIsDark();

  // Favour the strongest recent event, otherwise fall back to the Pacific rim.
  const focus = quakes.reduce<Quake | null>((best, quake) => {
    if (!best) return quake;
    return (quake.magnitude ?? -1) > (best.magnitude ?? -1) ? quake : best;
  }, null);

  const region: Region = focus
    ? {
        latitude: focus.latitude,
        longitude: focus.longitude,
        latitudeDelta: 60,
        longitudeDelta: 60,
      }
    : { latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 180 };

  return (
    <View style={[styles.container, { borderColor: theme.outlineVariant }]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        mapType={isDark ? 'standard' : 'standard'}
        showsUserLocation={false}
        toolbarEnabled={false}>
        {quakes.map((quake) => {
          const selected = quake.id === selectedId;
          return (
            <Marker
              key={quake.id}
              coordinate={{ latitude: quake.latitude, longitude: quake.longitude }}
              title={`${formatMagnitude(quake.magnitude)} · ${shortenPlace(quake.place)}`}
              description={`Profundidad ${quake.depthKm.toFixed(1)} km`}
              onPress={() => {
                haptics.tap();
                onSelect?.(quake);
              }}
              tracksViewChanges={false}>
              <View
                style={[
                  styles.marker,
                  {
                    backgroundColor: quakeColor(quake.magnitude, isDark),
                    width: selected ? 30 : 20,
                    height: selected ? 30 : 20,
                    borderRadius: selected ? 15 : 10,
                    borderColor: selected ? theme.text : 'transparent',
                  },
                ]}
              />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  marker: {
    borderWidth: 2,
  },
});

export const QuakeMap = memo(QuakeMapImpl);
void Spacing;