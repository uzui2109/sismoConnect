import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { elevation } from '@/lib/navigation-theme';

type Props = {
  children: ReactNode;
  /** `flat` for list rows, `raised` for standalone cards. */
  variant?: 'flat' | 'raised';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, variant = 'flat', onPress, style }: Props) {
  const theme = useTheme();

  const shared = [
    styles.base,
    {
      backgroundColor: variant === 'raised' ? theme.surfaceContainer : theme.surface,
      borderColor: theme.outlineVariant,
    },
    variant === 'raised' ? elevation : null,
    style,
  ];

  if (!onPress) return <View style={shared}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [...shared, pressed ? styles.pressed : null]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.85,
  },
});