import { useEffect } from 'react';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';

import { useAuth } from '@/providers/auth-provider';
import {
  configureNotificationHandler,
  observePushResponses,
  observePushTokenChanges,
} from '@/services/push';

const isExpoGo = Constants.appOwnership === 'expo';

export function useNotificationObserver() {
  const { user } = useAuth();

  useEffect(() => {
    if (isExpoGo) {
      console.warn('[Push Warning] Observer de notificaciones desactivado en Expo Go');
      return;
    }
    if (!user) return;
    void configureNotificationHandler();
    const stopTokenChanges = observePushTokenChanges();
    const stopResponses = observePushResponses((data) => {
      const chatId = typeof data.chatId === 'string' ? data.chatId : null;
      const uid = typeof data.uid === 'string' ? data.uid : null;
      if (chatId) {
        router.push({ pathname: '/chat/[chatId]', params: { chatId } });
      } else if (uid) {
        router.push({ pathname: '/user/[uid]', params: { uid } });
      } else if (data.type === 'earthquake' || data.quakeId) {
        router.push('/reports' as Href);
      }
    });
    return () => {
      stopTokenChanges();
      stopResponses();
    };
  }, [user]);
}
