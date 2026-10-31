import type { PushRegistrationResult } from '@/types/push';

export type { PushRegistrationResult };

export function configureNotificationHandler() {
  return;
}

export function enablePushNotifications(): Promise<PushRegistrationResult> {
  return Promise.resolve({
    status: 'unsupported',
    message: 'Los avisos push están disponibles en Android.',
  });
}

export function disablePushNotifications(): Promise<void> {
  return Promise.resolve();
}

export function observePushTokenChanges(): () => void {
  return () => undefined;
}

export function observePushResponses(
  _onOpen: (data: Record<string, unknown>) => void
): () => void {
  return () => undefined;
}
