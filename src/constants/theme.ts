/**
 * Design tokens for sismoConnect.
 *
 * Identity: night-blue operational UI. The palette follows Material Design 3
 * (light + dark) with an electric-blue interaction layer, and the `Quake` scale
 * maps a seismic magnitude to a colour that stays legible in both schemes and
 * passes contrast on top of `surface`.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0A1B2E',
    textSecondary: '#55687F',
    background: '#F5F8FC',
    surface: '#FFFFFF',
    surfaceContainer: '#EDF2F9',
    backgroundElement: '#E7EEF8',
    backgroundSelected: '#D5E4F5',
    outline: '#6E819C',
    outlineVariant: '#CBDAF0',
    primary: '#0B4F8A',
    onPrimary: '#FFFFFF',
    primaryContainer: '#D9E9F8',
    onPrimaryContainer: '#072F52',
    secondary: '#B45309',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#FFF1D6',
    onSecondaryContainer: '#4A2C00',
    success: '#1E6B3C',
    warning: '#9A5B00',
    info: '#0B6E99',
    danger: '#C62828',
    onDanger: '#FFFFFF',
    error: '#B3261E',
    onError: '#FFFFFF',
    scrim: 'rgba(4, 16, 32, 0.55)',
  },
  dark: {
    text: '#E9EFF8',
    textSecondary: '#A7B8CF',
    background: '#050D1A',
    surface: '#0D1828',
    surfaceContainer: '#15223C',
    backgroundElement: '#1B2A44',
    backgroundSelected: '#27405F',
    outline: '#8496AE',
    outlineVariant: '#374B66',
    primary: '#8FC4F5',
    onPrimary: '#00315C',
    primaryContainer: '#0A3E6B',
    onPrimaryContainer: '#D3E7FF',
    secondary: '#F7C873',
    onSecondary: '#3D2A00',
    secondaryContainer: '#5B3D00',
    onSecondaryContainer: '#FFE2A8',
    success: '#86D99B',
    warning: '#F7C873',
    info: '#8ED0F0',
    danger: '#FF8A80',
    onDanger: '#690005',
    error: '#FFB4AB',
    onError: '#690005',
    scrim: 'rgba(0, 0, 0, 0.68)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Severity of a seismic alert. Red stays exclusive to the most serious events.
 */
export const QuakeAlert = {
  info: { color: '#2F6FA8', label: 'Sin alerta' },
  warning: { color: '#B8860B', label: 'Alerta amarilla' },
  severe: { color: '#C2600F', label: 'Alerta naranja' },
  danger: { color: '#B3261E', label: 'Alerta roja' },
} as const;

export type QuakeAlertLevel = keyof typeof QuakeAlert;

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