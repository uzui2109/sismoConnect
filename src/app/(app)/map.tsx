import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, quakeColor, QuakeScale, Radius, Spacing } from '@/constants/theme';
import { aggregateByRegion, USGS_ATTRIBUTION } from '@/services/usgs';
import { useEarthquakes } from '@/hooks/use-earthquakes';
import { useStoredValue } from '@/hooks/use-storage';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import type { FeedWindow, Quake } from '@/types/earthquake';
import { formatMagnitude, pluralize, shortenPlace, timeAgo } from '@/utils/format';
import { CountryFilter } from '@/components/quake/country-filter';
import { QuakeDetailModal } from '@/components/quake/quake-detail-modal';
import { QuakeMap } from '@/components/map/quake-map';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';

const WINDOWS: { key: FeedWindow; label: string }[] = [
  { key: 'all_day', label: '24 horas' },
  { key: 'all_week', label: '7 días' },
];

export default function MapScreen() {
  const theme = useTheme();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const [window, setWindow] = useState<FeedWindow>('all_day');
  const [selected, setSelected] = useState<Quake | null>(null);
  const { value: selectedCountries, setValue: setSelectedCountries } = useStoredValue<string[]>(
    'sismoconnect:country-filter',
    []
  );

  const { data, loading, error, lastUpdated, refetch } = useEarthquakes(window);

  const filtered = useMemo(
    () =>
      selectedCountries.length === 0
        ? data
        : data.filter(
            (quake) =>
              quake.countryCode !== null && selectedCountries.includes(quake.countryCode)
          ),
    [data, selectedCountries]
  );
  const regions = useMemo(() => aggregateByRegion(filtered).slice(0, 8), [filtered]);
  const strongest = useMemo(
    () =>
      filtered.reduce<Quake | null>(
        (best, quake) =>
          !best || (quake.magnitude ?? -1) > (best.magnitude ?? -1) ? quake : best,
        null
      ),
    [filtered]
  );

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.two,
          paddingBottom: insets.bottom + 96,
          maxWidth: MaxContentWidth,
        },
      ]}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Mapa de riesgo
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {lastUpdated ? `Actualizado ${timeAgo(lastUpdated)}` : 'Cargando epicentros…'}
        </ThemedText>
      </View>

      <View style={styles.chips}>
        {WINDOWS.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            selected={window === item.key}
            onPress={() => setWindow(item.key)}
          />
        ))}
      </View>

      <CountryFilter selected={selectedCountries} onChange={setSelectedCountries} />

      {error ? (
        <ErrorState message={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <View style={styles.mapWrap}>
            {loading ? (
              <Skeleton height={280} radius={Radius.lg} />
            ) : (
              <QuakeMap quakes={filtered} selectedId={selected?.id} onSelect={setSelected} />
            )}
          </View>

          <View style={styles.legend}>
            {Object.entries(QuakeScale).map(([key, entry]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: entry.color }]} />
                <ThemedText type="small" themeColor="textSecondary">
                  {entry.label}
                </ThemedText>
              </View>
            ))}
          </View>

          {strongest?.magnitude != null && (
            <Card variant="raised">
              <View style={styles.strongestHeader}>
                <ThemedText type="smallBold">Sismo más fuerte del periodo</ThemedText>
                <Badge
                  label={formatMagnitude(strongest.magnitude)}
                  color={quakeColor(strongest.magnitude, isDark)}
                />
              </View>
              <ThemedText>{shortenPlace(strongest.place)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {timeAgo(strongest.time)} · {strongest.depthKm.toFixed(1)} km de profundidad
              </ThemedText>
            </Card>
          )}

          <View style={styles.section}>
            <ThemedText type="subtitle">Zonas más activas</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Agrupadas por región a partir de los epicentros del periodo seleccionado.
            </ThemedText>
          </View>

          {regions.map((region) => (
            <Card key={region.name} style={styles.regionCard}>
              <View style={styles.regionHeader}>
                <ThemedText style={styles.regionName} numberOfLines={1}>
                  {region.name}
                </ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {pluralize(region.count, 'evento', 'eventos')}
                </ThemedText>
              </View>
              <View style={styles.regionMeta}>
                <ThemedText type="small" themeColor="textSecondary">
                  Máx. {formatMagnitude(region.maxMagnitude)}
                </ThemedText>
                <View style={[styles.swatch, { backgroundColor: quakeColor(region.maxMagnitude, isDark) }]} />
              </View>
            </Card>
          ))}

          <ThemedText type="small" themeColor="textSecondary" style={styles.credit}>
            {USGS_ATTRIBUTION}
          </ThemedText>
        </>
      )}

      <QuakeDetailModal quake={selected} onClose={() => setSelected(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  header: {
    gap: 2,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  mapWrap: {
    height: 300,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  strongestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  section: {
    marginTop: Spacing.two,
    gap: 2,
  },
  regionCard: {
    gap: Spacing.two,
  },
  regionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  regionName: {
    flex: 1,
    fontWeight: '600',
    fontSize: 15,
  },
  regionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  credit: {
    textAlign: 'center',
    marginTop: Spacing.three,
  },
});