import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, quakeColor, QuakeScale, Radius, Spacing } from '@/constants/theme';
import { useEarthquakes } from '@/hooks/use-earthquakes';
import { useStoredValue, useViewedHistory } from '@/hooks/use-storage';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { matchesMagnitude, USGS_ATTRIBUTION } from '@/services/usgs';
import type { MagnitudeFilter, Quake } from '@/types/earthquake';
import { pluralize, timeAgo } from '@/utils/format';
import { CountryFilter } from '@/components/quake/country-filter';
import { MonitorHero } from '@/components/quake/monitor-hero';
import { QuakeDetailModal } from '@/components/quake/quake-detail-modal';
import { QuakeRow } from '@/components/quake/quake-row';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonRow } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';

const FILTERS: { key: MagnitudeFilter; label: string; threshold: number }[] = [
  { key: 'all', label: 'Todos', threshold: 0 },
  { key: 'light', label: 'M2.5+', threshold: 2.5 },
  { key: 'moderate', label: 'M4+', threshold: 4 },
  { key: 'strong', label: 'M5+', threshold: 5 },
  { key: 'major', label: 'M6+', threshold: 6 },
];

export default function MonitorScreen() {
  const theme = useTheme();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const { data, loading, refreshing, error, lastUpdated, refetch } = useEarthquakes('all_day');
  const { viewed, remember } = useViewedHistory();
  const { value: selectedCountries, setValue: setSelectedCountries } = useStoredValue<string[]>(
    'sismoconnect:country-filter',
    []
  );

  const [filter, setFilter] = useState<MagnitudeFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Quake | null>(null);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((quake) => {
      if (!matchesMagnitude(quake, filter)) return false;
      if (
        selectedCountries.length > 0 &&
        (!quake.countryCode || !selectedCountries.includes(quake.countryCode))
      ) {
        return false;
      }
      return (
        !term ||
        quake.place.toLowerCase().includes(term) ||
        (quake.countryName?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [data, filter, search, selectedCountries]);

  const strongest = useMemo(
    () =>
      data.reduce<Quake | null>((top, quake) => {
        if (quake.magnitude === null) return top;
        if (!top || top.magnitude === null) return quake;
        return quake.magnitude > top.magnitude ? quake : top;
      }, null),
    [data]
  );

  const countryCount = useMemo(
    () => new Set(data.map((quake) => quake.countryCode).filter(Boolean)).size,
    [data]
  );

  function open(quake: Quake) {
    setSelected(quake);
    remember(quake.id);
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <MonitorHero
          total={data.length}
          strongestMagnitude={strongest?.magnitude ?? null}
          countries={countryCount}
          updatedLabel={lastUpdated ? `Actualizado ${timeAgo(lastUpdated)}` : 'Cargando actividad…'}
          onOpenReports={() => router.push('/reports' as Href)}
        />

        {strongest?.magnitude != null && strongest.magnitude >= 5 && (
          <View style={[styles.alert, { backgroundColor: theme.primaryContainer }]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimaryContainer }}>
              Sismo de {strongest.magnitude.toFixed(1)} detectado
            </ThemedText>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir notificaciones"
          onPress={() => router.push('/notifications' as Href)}
          style={({ pressed }) => [
            styles.quickLink,
            {
              backgroundColor: theme.surface,
              borderColor: theme.outlineVariant,
              opacity: pressed ? 0.8 : 1,
            },
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            Notificaciones
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Historial de avisos y actividad
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.controls}>
        <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.outlineVariant }]}>
          <TextInput
            accessibilityLabel="Buscar por lugar"
            placeholder="Buscar por lugar…"
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <View style={styles.chips}>
          {FILTERS.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              selected={filter === item.key}
              accent={
                item.key === 'all' ? undefined : quakeColor(item.threshold - 0.1, isDark)
              }
              onPress={() => setFilter(item.key)}
            />
          ))}
        </View>

        <CountryFilter selected={selectedCountries} onChange={setSelectedCountries} />
      </View>

      {loading ? (
<<<<<<< HEAD
        <View style={[styles.list, styles.scrollContainer]}>
=======
        <View style={styles.list}>
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonRow key={index} />
          ))}
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void refetch()} />
      ) : (
        <SectionList
<<<<<<< HEAD
          style={[styles.scrollContainer, { minHeight: 0 }]}
=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
          sections={[{ key: 'all', data: visible }]}
          keyExtractor={(quake) => quake.id}
          contentContainerStyle={[
            styles.list,
<<<<<<< HEAD
            { paddingBottom: insets.bottom + 96, maxWidth: MaxContentWidth, flexGrow: 1 },
=======
            { paddingBottom: insets.bottom + 96, maxWidth: MaxContentWidth },
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
          ]}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={() => (
            <View style={styles.sectionHeader}>
              <ThemedText type="small" themeColor="textSecondary">
                {pluralize(visible.length, 'evento', 'eventos')} · últimas 24 h
              </ThemedText>
            </View>
          )}
          renderItem={({ item }) => (
            <QuakeRow quake={item} dimmed={viewed.includes(item.id)} onPress={() => open(item)} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                haptics.select();
                void refetch();
              }}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          ListEmptyComponent={
            <EmptyState
              title="Sin resultados"
              description={
                search
                  ? `Ningún sismo coincide con «${search}».`
                  : selectedCountries.length > 0
                    ? 'No hay sismos en los países seleccionados durante las últimas 24 horas.'
                    : 'No hay sismos que cumplan este filtro en las últimas 24 horas.'
              }
            />
          }
          ListFooterComponent={
            visible.length > 0 ? (
              <View style={styles.footer}>
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
                <ThemedText type="small" themeColor="textSecondary" style={styles.credit}>
                  {USGS_ATTRIBUTION}
                </ThemedText>
              </View>
            ) : null
          }
        />
      )}

      <QuakeDetailModal quake={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  headerText: {
    gap: 2,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  alert: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    marginTop: Spacing.two,
  },
  quickLinks: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  quickLink: {
    flex: 1,
    minHeight: 58,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  controls: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  search: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    fontSize: 16,
    paddingVertical: Spacing.three,
    minHeight: 48,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  list: {
    paddingHorizontal: Spacing.four,
    alignSelf: 'center',
    width: '100%',
  },
<<<<<<< HEAD
  scrollContainer: {
    flex: 1,
    minHeight: 0,
  },
=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
  sectionHeader: {
    paddingBottom: Spacing.two,
  },
  footer: {
    marginTop: Spacing.four,
    gap: Spacing.three,
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
  credit: {
    textAlign: 'center',
  },
});