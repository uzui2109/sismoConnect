import { useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useSituationReports } from '@/hooks/use-situation-reports';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { getCountryByCode } from '@/services/countries';
import { SITUATION_ATTRIBUTION } from '@/services/situation';
import type { SituationReport } from '@/types/situation';
import { timeAgo } from '@/utils/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonRow } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';

type Filter = 'all' | 'earthquakes' | 'country';

const ALERT_COLORS: Record<string, string> = {
  red: '#B3261E',
  orange: '#C2600F',
  yellow: '#B8860B',
  green: '#256B3A',
};

export default function ReportsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, loading, refreshing, error, refetch } = useSituationReports();
  const { profile } = useProfile();
  const [filter, setFilter] = useState<Filter>('all');

  const country = getCountryByCode(profile?.countryCode);
  const reports = useMemo(() => {
    const items = data?.reports ?? [];
    if (filter === 'earthquakes') {
      return items.filter((report) => report.kind === 'earthquake' || report.kind === 'tsunami');
    }
    if (filter === 'country') {
      if (!country) return [];
      const target = country.name.trim().toLowerCase();
      return items.filter(
        (report) =>
          report.countryCode === country.code ||
          report.countryName?.trim().toLowerCase() === target
      );
    }
    return items;
  }, [country, data?.reports, filter]);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.two,
          paddingBottom: insets.bottom + Spacing.five,
          maxWidth: MaxContentWidth,
        },
      ]}
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
      }>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          style={[styles.back, { borderColor: theme.outlineVariant }]}>
          <ThemedText type="smallBold">← Volver</ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary">
          {data?.fetchedAt ? `Actualizado ${timeAgo(data.fetchedAt)}` : 'Fuentes oficiales'}
        </ThemedText>
      </View>

      <View style={styles.heading}>
        <ThemedText type="title" style={styles.title}>
          Informes oficiales
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Eventos significativos publicados por GDACS y ReliefWeb. No sustituyen a las
          autoridades locales.
        </ThemedText>
      </View>

      <View style={styles.chips}>
        <Chip label="Todos" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip
          label="Sismos y tsunamis"
          selected={filter === 'earthquakes'}
          onPress={() => setFilter('earthquakes')}
        />
        <Chip
          label={country ? `Mi país · ${country.name}` : 'Mi país'}
          selected={filter === 'country'}
          onPress={() => setFilter('country')}
        />
      </View>

      {data?.stale ? (
        <Card style={{ borderColor: theme.warning }}>
          <ThemedText type="smallBold">Mostrando la última copia disponible</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Una fuente oficial no respondió. Los datos pueden tener unos minutos de retraso.
          </ThemedText>
        </Card>
      ) : null}

      {filter === 'country' && !country ? (
        <EmptyState
          title="Configura tu país"
          description="Añade tu país en el perfil para filtrar los informes que te afectan."
        />
      ) : loading ? (
        <View style={styles.list}>
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonRow key={index} />
          ))}
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void refetch()} />
      ) : reports.length === 0 ? (
        <EmptyState
          title="Sin informes recientes"
          description="Las fuentes oficiales no han publicado informes para este filtro."
        />
      ) : (
        <View style={styles.list}>
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </View>
      )}

      <ThemedText type="small" themeColor="textSecondary" style={styles.credit}>
        {SITUATION_ATTRIBUTION}
      </ThemedText>
    </ScrollView>
  );
}

function ReportCard({ report }: { report: SituationReport }) {
  const theme = useTheme();
  const alertColor = report.alertLevel ? ALERT_COLORS[report.alertLevel] : theme.info;

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.badges}>
          <Badge label={report.source} color={report.source === 'GDACS' ? theme.primary : theme.info} />
          {report.alertLevel ? (
            <Badge label={`Alerta ${report.alertLevel}`} color={alertColor} />
          ) : null}
          {report.magnitude !== null ? (
            <Badge label={`M ${report.magnitude.toFixed(1)}`} color={alertColor} />
          ) : null}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {timeAgo(report.publishedAt)}
        </ThemedText>
      </View>

      <ThemedText type="subtitle" style={styles.cardTitle}>
        {report.title}
      </ThemedText>
      {report.countryName ? (
        <ThemedText type="small" themeColor="textSecondary">
          {report.countryName} · {report.sourceLabel}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {report.sourceLabel}
        </ThemedText>
      )}
      {report.summary ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={5}>
          {report.summary}
        </ThemedText>
      ) : null}

      <Button
        label={`Abrir en ${report.source}`}
        variant="outlined"
        fullWidth={false}
        onPress={() => void Linking.openURL(report.url)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.three,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  back: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heading: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    flex: 1,
  },
  cardTitle: {
    fontSize: 19,
    lineHeight: 24,
  },
  credit: {
    textAlign: 'center',
    marginTop: Spacing.three,
  },
});
