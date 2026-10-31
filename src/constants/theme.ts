/**
 * Design tokens for sismoConnect.
 *
 * Android-first: the palette follows Material Design 3 (light + dark) and the
 * `Quake` scale maps a seismic magnitude to a colour that stays legible in both
 * schemes and passes contrast on top of `surface`.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B1B33',
    textSecondary: '#52627A',
    background: '#F7F9FC',
    surface: '#FFFFFF',
    surfaceContainer: '#EEF3FA',
    backgroundElement: '#E7EEF8',
    backgroundSelected: '#D8E5F5',
    outline: '#7A8AA3',
    outlineVariant: '#CDD8E8',
    primary: '#0B4F8A',
    onPrimary: '#FFFFFF',
    primaryContainer: '#D6E8FA',
    onPrimaryContainer: '#062B4D',
    secondary: '#B45309',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#FFF1D6',
    onSecondaryContainer: '#4A2C00',
    error: '#B3261E',
    onError: '#FFFFFF',
    success: '#256B3A',
    warning: '#9A5B00',
    info: '#0B6E99',
    scrim: 'rgba(3,12,25,0.55)',
  },
  dark: {
    text: '#E8EEF8',
    textSecondary: '#A9B8CE',
    background: '#07101F',
    surface: '#0F1B2E',
    surfaceContainer: '#16243A',
    backgroundElement: '#1D2D45',
    backgroundSelected: '#263B58',
    outline: '#8496AE',
    outlineVariant: '#3A4B63',
    primary: '#8FC4F5',
    onPrimary: '#00315C',
    primaryContainer: '#0A3E6B',
    onPrimaryContainer: '#D3E7FF',
    secondary: '#F7C873',
    onSecondary: '#3D2A00',
    secondaryContainer: '#5B3D00',
    onSecondaryContainer: '#FFE2A8',
    error: '#FFB4AB',
    onError: '#690005',
    success: '#86D99B',
    warning: '#F7C873',
    info: '#8ED0F0',
    scrim: 'rgba(0,0,0,0.68)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Magnitude → colour. Blues for routine tremors, amber/orange for felt
 * events, red only for damaging ones.
 */
export const QuakeScale = {
  low: { color: '#2E6F9E', label: 'Menor' },
  light: { color: '#1F5C8C', label: 'Ligero' },
  moderate: { color: '#B8860B', label: 'Moderado' },
  strong: { color: '#C2600F', label: 'Fuerte' },
  major: { color: '#B3261E', label: 'Mayor' },
} as const;

export type QuakeLevel = keyof typeof QuakeScale;

export function quakeLevel(magnitude: number | null): QuakeLevel {
  if (magnitude === null) return 'low';
  if (magnitude < 2.5) return 'low';
  if (magnitude < 4) return 'light';
  if (magnitude < 5) return 'moderate';
  if (magnitude < 6) return 'strong';
  return 'major';
}

export function quakeColor(magnitude: number | null, isDark: boolean): string {
  const level = quakeLevel(magnitude);
  const base = QuakeScale[level].color;
  if (!isDark) return base;
  // Lighten slightly so the mid tones stay visible on a dark surface.
  return level === 'moderate' || level === 'light' ? lighten(base) : base;
}

function lighten(hex: string): string {
  const value = hex.replace('#', '');
  const num = parseInt(value, 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + 42);
  const g = Math.min(255, ((num >> 8) & 0xff) + 42);
  const b = Math.min(255, (num & 0xff) + 42);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  pill: 999,
} as const;

/** Minimum tap target per Material Design guidelines. */
export const HitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * USGS caches every feed for 60s, so polling faster returns identical data
 * and risks a 429. Keep the refresh interval at or above this value.
 */
export const USGS_MIN_REFRESH_MS = 60_000;