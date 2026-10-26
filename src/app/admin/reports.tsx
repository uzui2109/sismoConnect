import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { haptics } from '@/lib/haptics';
import {
  fetchAdminReports,
  moderateReport,
  type AdminReport,
  type ModerationAction,
} from '@/services/moderation';
import { socialErrorMessage } from '@/services/social';
import { timeAgo } from '@/utils/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ThemedText } from '@/components/themed-text';

export default function AdminReportsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!user?.isAdmin) {
        setLoading(false);
        setError('Esta sección es solo para moderación.');
        return;
      }
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        setReports(await fetchAdminReports(filter === 'open' ? 'open' : undefined));
        setError(null);
      } catch (loadError) {
        setError(socialErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, user?.isAdmin]
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function apply(report: AdminReport, action: ModerationAction) {
    setBusyId(report.id);
    try {
      await moderateReport({ reportId: report.id, action });
      setReports((current) =>
        filter === 'open' ? current.filter((item) => item.id !== report.id) : current.map((item) =>
          item.id === report.id ? { ...item, status: 'reviewed' } : item
        )
      );
      haptics.success();
    } catch (actionError) {
      haptics.error();
      Alert.alert('No se pudo aplicar la acción', socialErrorMessage(actionError));
    } finally {
      setBusyId(null);
    }
  }

  function confirm(report: AdminReport, action: ModerationAction, label: string) {
    Alert.alert(label, `¿Aplicar «${label}» a ${report.reportedName}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: label, style: 'destructive', onPress: () => void apply(report, action) },
    ]);
  }

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
          onRefresh={() => void load(true)}
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
        <Badge label={`${reports.length} reportes`} color={theme.warning} />
      </View>

      <View style={styles.heading}>
        <ThemedText type="title" style={styles.title}>
          Moderación
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Revisa reportes de usuarios, mensajes y grupos. Cada acción queda auditada.
        </ThemedText>
      </View>

      <View style={styles.chips}>
        <Chip label="Abiertos" selected={filter === 'open'} onPress={() => setFilter('open')} />
        <Chip label="Todos" selected={filter === 'all'} onPress={() => setFilter('all')} />
      </View>

      {loading ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Cargando reportes…
          </ThemedText>
        </Card>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : reports.length === 0 ? (
        <EmptyState title="Sin reportes" description="No hay reportes pendientes en esta vista." />
      ) : (
        <View style={styles.list}>
          {reports.map((report) => (
            <Card key={report.id} style={styles.card}>
              <View style={styles.row}>
                <Badge label={report.status} color={theme.info} />
                <Badge label={report.reason} color={theme.warning} />
                <ThemedText type="small" themeColor="textSecondary">
                  {timeAgo(report.createdAt)}
                </ThemedText>
              </View>
              <ThemedText type="smallBold">
                {report.reporterName} reportó a {report.reportedName}
              </ThemedText>
              {report.messagePreview ? (
                <Card variant="flat">
                  <ThemedText type="small" themeColor="textSecondary">
                    «{report.messagePreview}»
                  </ThemedText>
                </Card>
              ) : null}
              {report.details ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {report.details}
                </ThemedText>
              ) : null}
              <ThemedText type="code" themeColor="textSecondary">
                {report.targetType} · {report.targetId ?? 'sin objetivo'}
              </ThemedText>

              <View style={styles.actions}>
                <Button
                  label="Revisar"
                  variant="tonal"
                  fullWidth={false}
                  loading={busyId === report.id}
                  onPress={() => void apply(report, 'review')}
                />
                <Button
                  label="Descartar"
                  variant="text"
                  fullWidth={false}
                  disabled={busyId === report.id}
                  onPress={() => void apply(report, 'dismiss')}
                />
                <Button
                  label="Advertir"
                  variant="outlined"
                  fullWidth={false}
                  disabled={busyId === report.id}
                  onPress={() => confirm(report, 'warn', 'Advertir')}
                />
                {report.targetType === 'message' ? (
                  <Button
                    label="Eliminar mensaje"
                    variant="outlined"
                    fullWidth={false}
                    disabled={busyId === report.id}
                    onPress={() => confirm(report, 'delete-message', 'Eliminar mensaje')}
                  />
                ) : null}
                <Button
                  label="Suspender cuenta"
                  variant="outlined"
                  fullWidth={false}
                  disabled={busyId === report.id}
                  onPress={() => confirm(report, 'suspend', 'Suspender cuenta')}
                />
                <Button
                  label="Reactivar cuenta"
                  variant="text"
                  fullWidth={false}
                  disabled={busyId === report.id}
                  onPress={() => confirm(report, 'unsuspend', 'Reactivar cuenta')}
                />
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
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
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
