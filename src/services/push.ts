import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';

import { getFirebaseFunctions } from '@/lib/firebase';
import type { PushRegistrationResult } from '@/types/push';

const DEVICE_KEY = 'sismoconnect:push-device-id';
const ENABLED_KEY = 'sismoconnect:push-enabled';

export type { PushRegistrationResult };

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

async function deviceId(): Promise<string> {
  const stored = await AsyncStorage.getItem(DEVICE_KEY);
  if (stored) return stored;
  const next = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_KEY, next);
  return next;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Avisos generales',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('earthquakes', {
    name: 'Sismos y emergencias',
    description: 'Avisos de sismos según tus alertas guardadas.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#B3261E',
  });
  await Notifications.setNotificationChannelAsync('social', {
    name: 'Mensajes y comunidad',
    description: 'Mensajes, solicitudes de amistad y grupos.',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function enablePushNotifications(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { status: 'unsupported', message: 'Los avisos push están disponibles en Android.' };
  }
  if (!Device.isDevice) {
    return {
      status: 'unsupported',
      message: 'Los avisos push necesitan un dispositivo físico y una development build.',
    };
  }

  try {
    await ensureAndroidChannel();
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted
      ? current
      : await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      return {
        status: 'denied',
        message: 'Activa las notificaciones de SismoConnect en los ajustes del sistema.',
      };
    }

    const token = await Notifications.getDevicePushTokenAsync();
    const value = typeof token.data === 'string' ? token.data : '';
    if (!value) {
      return {
        status: 'unsupported',
        message: 'No se pudo obtener el token FCM. Usa una development build con google-services.json.',
      };
    }

    const callable = httpsCallable<
      { token: string; platform: string; deviceId: string; appVersion: string | null },
      { registered: boolean }
    >(getFirebaseFunctions(), 'registerPushDevice');
    await callable({
      token: value,
      platform: Platform.OS,
      deviceId: await deviceId(),
      appVersion: Constants.expoConfig?.version ?? null,
    });
    await AsyncStorage.setItem(ENABLED_KEY, 'true');

    return { status: 'granted' };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'No se pudieron activar los avisos. Comprueba la development build.',
    };
  }
}

export async function disablePushNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  const callable = httpsCallable<{ deviceId: string }, { unregistered: boolean }>(
    getFirebaseFunctions(),
    'unregisterPushDevice'
  );
  await callable({ deviceId: await deviceId() });
  await AsyncStorage.setItem(ENABLED_KEY, 'false');
}

export function observePushTokenChanges(): () => void {
  if (Platform.OS === 'web') return () => undefined;

  const subscription = Notifications.addPushTokenListener((token) => {
    const value = typeof token.data === 'string' ? token.data : '';
    if (!value) return;
    void AsyncStorage.getItem(ENABLED_KEY)
      .then(async (enabled) => {
        if (enabled !== 'true') return;
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) return;
        const callable = httpsCallable<
          { token: string; platform: string; deviceId: string; appVersion: string | null },
          { registered: boolean }
        >(getFirebaseFunctions(), 'registerPushDevice');
        await callable({
          token: value,
          platform: Platform.OS,
          deviceId: await deviceId(),
          appVersion: Constants.expoConfig?.version ?? null,
        });
      })
      .catch(() => undefined);
  });

  return () => subscription.remove();
}

export function observePushResponses(
  onOpen: (data: Record<string, unknown>) => void
): () => void {
  if (Platform.OS === 'web') return () => undefined;

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onOpen(response.notification.request.content.data as Record<string, unknown>);
  });

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      onOpen(response.notification.request.content.data as Record<string, unknown>);
    }
  });

  return () => subscription.remove();
}
