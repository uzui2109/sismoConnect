import * as Haptics from 'expo-haptics';

/**
 * Thin wrapper so screens never branch on platform for haptic feedback.
 * Every call is fire-and-forget: the browser has no vibration API, so the
 * unsupported case resolves silently instead of throwing.
 */
function safe(task: () => Promise<unknown>) {
  void task().catch(() => {});
}

export const haptics = {
  tap() {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  select() {
    safe(() => Haptics.selectionAsync());
  },
  success() {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning() {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  error() {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
};