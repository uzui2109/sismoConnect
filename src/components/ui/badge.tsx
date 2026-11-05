import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

type Props = {
  label: string;
  color: string;
  onDarkBackground?: boolean;
};

/** Small pill used for magnitude, alert level and status tags. */
export function Badge({ label, color, onDarkBackground }: Props) {
  const textColor = onDarkBackground ? '#FFFFFF' : color;

  return (
    <View style={[styles.badge, { backgroundColor: `${color}24`, borderColor: `${color}59` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText style={[styles.label, { color: textColor }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});