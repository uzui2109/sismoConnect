import { useEffect } from 'react';
import { router, type Href } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';
import {
  configureNotificationHandler,
  observePushResponses,
  observePushTokenChanges,
} from '@/services/push';

export function useNotificationObserver() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    configureNotificationHandler();
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
