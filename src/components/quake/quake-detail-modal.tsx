import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Radius, Spacing , quakeColor, quakeLevel, QuakeScale } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { Badge } from '@/components/ui/badge';
import { ThemedText } from '@/components/themed-text';
import type { Quake } from '@/types/earthquake';
import {
  formatCoordinates,
  formatDateTime,
  formatDepth,
  formatDuration,
  formatFelt,
  formatMagnitude,
  formatUtc,
  shortenPlace,
  timeAgo,
} from '@/utils/format';

type Props = {
  quake: Quake | null;
  onClose: () => void;
  onOpenUsgs?: (id: string) => void;
};

const ALERT_LABELS: Record<string, string> = {
  green: 'Sin alerta',
  yellow: 'Alerta amarilla',
  orange: 'Alerta naranja',
  red: 'Alerta roja',
};

export function QuakeDetailModal({ quake, onClose, onOpenUsgs }: Props) {
  const theme = useTheme();
  const isDark = useIsDark();
  const color = quakeColor(quake?.magnitude ?? null, isDark);

  return (
    <Modal
      visible={quake !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: theme.scrim }]} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.background, borderColor: theme.outlineVariant },
        ]}>
        <View style={[styles.grabber, { backgroundColor: theme.outlineVariant }]} />

        {quake && (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View style={[styles.magnitudeTile, { backgroundColor: color }]}>
                <ThemedText style={styles.magnitudeValue} onDarkBackground>
                  {quake.magnitude === null ? '—' : quake.magnitude.toFixed(1)}
                </ThemedText>
                <ThemedText style={styles.magnitudeLabel} onDarkBackground>
                  {QuakeScale[quakeLevel(quake.magnitude)].label}
                </ThemedText>
              </View>

              <View style={styles.headerText}>
                <ThemedText type="subtitle" style={styles.title}>
                  {shortenPlace(quake.place)}
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  {formatMagnitude(quake.magnitude)} · {quake.magnitudeType ?? '—'}
                </ThemedText>
              </View>
            </View>

            <View style={styles.badges}>
              {quake.alert && (
                <Badge label={ALERT_LABELS[quake.alert] ?? quake.alert} color={color} />
              )}
              {quake.tsunami === 1 && <Badge label="Maremoto" color={theme.info} />}
              {quake.status !== 'reviewed' && <Badge label="Revisión automática" color={theme.warning} />}
            </View>

            <DetailRow
              label="Fecha y hora (tu hora local)"
              value={formatDateTime(quake.time)}
            />
            <DetailRow label="Hora UTC" value={formatUtc(quake.time)} />
            <DetailRow label="Última revisión" value={timeAgo(quake.updated)} />
            <DetailRow label="Profundidad" value={formatDepth(quake.depthKm)} />
            <DetailRow
              label="Coordenadas"
              value={formatCoordinates(quake.latitude, quake.longitude)}
            />
            <DetailRow label="País" value={quake.countryName ?? 'Sin país'} />
            <DetailRow
              label="Duración"
              value={formatDuration(quake.durationSeconds, quake.durationSource)}
            />
            {quake.mmi !== null && (
              <DetailRow label="Intensidad instrumental" value={`MMI ${quake.mmi.toFixed(1)}`} />
            )}
            {quake.cdi !== null && (
              <DetailRow label="Intensidad comunitaria" value={`CDI ${quake.cdi.toFixed(1)}`} />
            )}
            {quake.significance !== null && (
              <DetailRow label="Significancia USGS" value={String(quake.significance)} />
            )}
            {quake.network && <DetailRow label="Red sísmica" value={quake.network.toUpperCase()} />}
            {quake.stationCount !== null && (
              <DetailRow label="Estaciones" value={String(quake.stationCount)} />
            )}
            {formatFelt(quake.felt) && <DetailRow label="Reportes" value={formatFelt(quake.felt)!} />}
            <DetailRow label="Identificador" value={quake.id} mono />

            <View style={styles.scale}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Escala de magnitud
              </ThemedText>
              {Object.entries(QuakeScale).map(([key, entry]) => (
                <View key={key} style={styles.scaleRow}>
                  <View style={[styles.swatch, { backgroundColor: entry.color }]} />
                  <ThemedText type="small">{entry.label}</ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir detalle en USGS"
                onPress={() => {
                  haptics.tap();
                  void Linking.openURL(quake.url);
                  onOpenUsgs?.(quake.id);
                }}
                style={({ pressed }) => [
                  styles.link,
                  { borderColor: theme.outline, opacity: pressed ? 0.8 : 1 },
                ]}>
                <ThemedText type="linkPrimary">Ver en USGS</ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar detalle"
                onPress={() => {
                  haptics.tap();
                  onClose();
                }}
                style={({ pressed }) => [styles.link, { opacity: pressed ? 0.8 : 1 }]}>
                <ThemedText themeColor="textSecondary">Cerrar</ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type={mono ? 'code' : 'default'} style={styles.detailValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  grabber: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: Spacing.two,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  header: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  magnitudeTile: {
    width: 76,
    height: 76,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  magnitudeValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  magnitudeLabel: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  detailRow: {
    gap: 2,
    paddingVertical: Spacing.one,
  },
  detailValue: {
    fontWeight: '500',
  },
  scale: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  scaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  link: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'transparent',
    minHeight: 44,
    justifyContent: 'center',
  },
});