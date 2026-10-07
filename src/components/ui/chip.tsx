import { Pressable, StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Optional colour override, used by magnitude filters. */
  accent?: string;
};

export function Chip({ label, selected, onPress, accent }: Props) {
  const theme = useTheme();
  const tint = accent ?? theme.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? tint : theme.surface,
          borderColor: selected ? tint : theme.outlineVariant,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <ThemedText
        style={[styles.label, { color: selected ? theme.onPrimary : theme.textSecondary }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    minHeight: 40,
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});