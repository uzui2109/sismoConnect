import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
  containerStyle?: ViewStyle;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, containerStyle, style, ...rest },
  ref
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>

      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.error : focused ? theme.primary : theme.outlineVariant,
            borderWidth: focused || error ? 2 : StyleSheet.hairlineWidth * 2,
          },
        ]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={theme.textSecondary}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          style={[styles.input, { color: theme.text }, style]}
          {...rest}
        />
      </View>

      {error ? (
        <ThemedText type="small" style={{ color: theme.error }}>
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  inputRow: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    minHeight: 56,
  },
  input: {
    fontSize: 16,
    paddingVertical: Spacing.three,
  },
});