import { DarkTheme, DefaultTheme } from 'expo-router';
import { Platform } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Expo Router's ThemeProvider drives status bar and default screen colours on
 * native, and CSS background on web.
 */
export function navigationTheme(isDark: boolean) {
  const base = isDark ? DarkTheme : DefaultTheme;
  const scheme = isDark ? Colors.dark : Colors.light;

  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: scheme.primary,
      background: scheme.background,
      card: scheme.surface,
      text: scheme.text,
      border: scheme.outlineVariant,
      notification: scheme.error,
    },
  };
}

/**
 * MD3 elevation, tuned for Android. `boxShadow` replaces the deprecated
 * `shadow*` props on React Native 0.76+ and also works on react-native-web.
 */
export const elevation = Platform.select({
  android: { elevation: 2, boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.12)' },
  default: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.12)' },
});

export const elevationHigh = Platform.select({
  android: { elevation: 8, boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.2)' },
  default: { boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.2)' },
});