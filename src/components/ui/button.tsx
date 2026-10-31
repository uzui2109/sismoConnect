import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';

type Props = {
  label: string;
  /** Optional so the button can be used as a wrapper child (e.g. `Link asChild`). */
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'filled',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  style,
  testID,
}: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const palette = {
    filled: { bg: theme.primary, fg: theme.onPrimary, border: 'transparent' },
    tonal: { bg: theme.backgroundElement, fg: theme.text, border: 'transparent' },
    outlined: { bg: 'transparent', fg: theme.primary, border: theme.outline },
    text: { bg: 'transparent', fg: theme.primary, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      disabled={isDisabled}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'outlined' ? StyleSheet.hairlineWidth * 2 : 0,
          opacity: isDisabled ? 0.45 : pressed ? 0.82 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {icon}
          <ThemedText style={[styles.label, { color: palette.fg }]}>{label}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});