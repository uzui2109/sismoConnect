import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing , QuakeScale, quakeColor, quakeLevel } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import type { Quake } from '@/types/earthquake';
import { formatMagnitude, shortenPlace, timeAgo } from '@/utils/format';

type Props = {
  quake: Quake;
  onPress: () => void;
  /** Shown as a left border accent, e.g. when the event is already read. */
  dimmed?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function QuakeRow({ quake, onPress, dimmed, style }: Props) {
  const theme = useTheme();
  const isDark = useIsDark();
  const color = quakeColor(quake.magnitude, isDark);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatMagnitude(quake.magnitude)}, ${shortenPlace(quake.place)}, ${timeAgo(quake.time)}`}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.surface,
          borderColor: theme.outlineVariant,
          opacity: dimmed ? 0.55 : 1,
        },
        style,
      ]}>
      {/* Colour-coded magnitude tile doubles as the severity indicator. */}
      <View style={[styles.magnitude, { backgroundColor: color }]}>
        <ThemedText style={styles.magnitudeValue} onDarkBackground>
          {quake.magnitude === null ? 'â€”' : quake.magnitude.toFixed(1)}
        </ThemedText>
        <ThemedText style={styles.magnitudeScale} onDarkBackground>
          {QuakeScale[quakeLevel(quake.magnitude)].label}
        </ThemedText>
      </View>

      <View style={styles.body}>
        <ThemedText numberOfLines={1} style={styles.place}>
          {shortenPlace(quake.place)}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {timeAgo(quake.time)} Â· {quake.depthKm.toFixed(1)} km de profundidad
        </ThemedText>

        {(quake.tsunami === 1 || quake.felt !== null) && (
          <View style={styles.tags}>
            {quake.tsunami === 1 && (
              <ThemedText type="smallBold" style={{ color: theme.info }}>
                Riesgo de maremoto
              </ThemedText>
            )}
            {quake.felt !== null && quake.felt > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {quake.felt} sintieron
              </ThemedText>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  magnitude: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  magnitudeValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  magnitudeScale: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 10,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  place: {
    fontSize: 15,
    fontWeight: '600',
  },
  tags: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
});