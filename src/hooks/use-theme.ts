import { Colors } from '@/constants/theme';
import { useThemePreference } from '@/hooks/use-theme-preference';

/** Resolved palette for the active colour scheme. */
export function useTheme() {
  const { resolved } = useThemePreference();
  return Colors[resolved];
}

/** `true` when the dark palette is active; useful for magnitude colours. */
export function useIsDark() {
  const { resolved } = useThemePreference();
  return resolved === 'dark';
}