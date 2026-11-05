import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextType =
  | 'default'
  | 'title'
  | 'small'
  | 'smallBold'
  | 'subtitle'
  | 'link'
  | 'linkPrimary'
  | 'code'
  | 'display'
  | 'headline';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
  /** Force white text, e.g. on top of a colour-filled magnitude tile. */
  onDarkBackground?: boolean;
};

export function ThemedText({
  style,
  type = 'default',
  themeColor,
  onDarkBackground,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  const typeStyle = TYPE_STYLES[type];

  return (
    <Text
      style={[
        styles.base,
        onDarkBackground ? { color: '#FFFFFF' } : { color: theme[themeColor ?? 'text'] },
        typeStyle,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {},
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },
  headline: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  link: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  linkPrimary: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});

const TYPE_STYLES: Record<ThemedTextType, TextStyle> = {
  default: styles.body,
  title: styles.title,
  subtitle: styles.subtitle,
  small: styles.small,
  smallBold: styles.smallBold,
  display: styles.display,
  headline: styles.headline,
  link: styles.link,
  linkPrimary: styles.linkPrimary,
  code: styles.code,
};