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
    /** Primary text / icons */
    text: '#1A1C1E',
    textSecondary: '#5A5F67',
    /** Screen background */
    background: '#FDFBFF',
    /** Cards, sheets, bars */
    surface: '#F4F1F6',
    surfaceContainer: '#ECE8F0',
    /** Inputs, chips */
    backgroundElement: '#E9E5EC',
    backgroundSelected: '#DCD7E1',
    /** MD3 outlines */
    outline: '#767680',
    outlineVariant: '#CAC5CF',
    /** Brand accent */
    primary: '#B3261E',
    onPrimary: '#FFFFFF',
    primaryContainer: '#F9DEDC',
    onPrimaryContainer: '#410E0B',
    /** Semantic */
    error: '#B3261E',
    onError: '#FFFFFF',
    success: '#2E6B3E',
    warning: '#8A5A00',
    info: '#1B5E8C',
    /** Scrim behind modals */
    scrim: 'rgba(0,0,0,0.45)',
  },
  dark: {
    text: '#E4E2E6',
    textSecondary: '#C4C6D0',
    background: '#0B1120',
    surface: '#141A26',
    surfaceContainer: '#1C2432',
    backgroundElement: '#232C3B',
    backgroundSelected: '#2E3848',
    outline: '#8E9099',
    outlineVariant: '#44474F',
    primary: '#F2B8B5',
    onPrimary: '#601410',
    primaryContainer: '#8C1D18',
    onPrimaryContainer: '#F9DEDC',
    error: '#F2B8B5',
    onError: '#601410',
    success: '#7ED694',
    warning: '#F5C15E',
    info: '#8FCBEE',
    scrim: 'rgba(0,0,0,0.6)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Magnitude → colour. Chosen for perceptual separation across the full
 * range: subtle (green/blue) for routine tremors, amber/orange for felt
 * events, red for damaging ones.
 */
export const QuakeScale = {
  low: { color: '#2E7D8F', label: 'Menor' },
  light: { color: '#2E6B3E', label: 'Ligero' },
  moderate: { color: '#B8860B', label: 'Moderado' },
  strong: { color: '#D2601A', label: 'Fuerte' },
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