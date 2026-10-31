import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { ThemedText } from '@/components/themed-text';

type Props = {
  total: number;
  strongestMagnitude: number | null;
  countries: number;
  updatedLabel: string;
  onOpenReports: () => void;
};

export function MonitorHero({
  total,
  strongestMagnitude,
  countries,
  updatedLabel,
  onOpenReports,
}: Props) {
  return (
    <LinearGradient
      colors={['#07182D', '#0B4F8A', '#0E7490']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}>
      <View style={styles.topRow}>
        <View style={styles.heading}>
          <ThemedText style={styles.eyebrow} onDarkBackground>
            MONITOR SÍSMICO
          </ThemedText>
          <ThemedText style={styles.title} onDarkBackground>
            Actividad en tiempo real
          </ThemedText>
          <ThemedText style={styles.subtitle} onDarkBackground>
            {updatedLabel}
          </ThemedText>
        </View>
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <ThemedText style={styles.liveLabel} onDarkBackground>
            EN VIVO
          </ThemedText>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="Eventos 24 h" value={String(total)} />
        <Stat
          label="Mayor magnitud"
          value={strongestMagnitude === null ? '—' : strongestMagnitude.toFixed(1)}
        />
        <Stat label="Países" value={String(countries)} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir informes oficiales"
        onPress={() => {
          haptics.tap();
          onOpenReports();
        }}
        style={({ pressed }) => [styles.action, { opacity: pressed ? 0.8 : 1 }]}>
        <ThemedText type="smallBold" style={styles.actionText} onDarkBackground>
          Ver informes oficiales
        </ThemedText>
        <ThemedText type="smallBold" style={styles.actionArrow} onDarkBackground>
          →
        </ThemedText>
      </Pressable>
    </LinearGradient>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.statValue} onDarkBackground>
        {value}
      </ThemedText>
      <ThemedText style={styles.statLabel} onDarkBackground>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.four,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  heading: {
    flex: 1,
    gap: Spacing.one,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.72)',
  },
  title: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.76)',
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#5EEAD4',
  },
  liveLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#D7FFF9',
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    gap: 2,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
  },
  action: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  actionText: {
    color: '#FFFFFF',
  },
  actionArrow: {
    color: '#5EEAD4',
  },
});
