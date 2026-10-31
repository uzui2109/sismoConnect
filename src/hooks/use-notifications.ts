import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import {
  markNotificationsRead,
  subscribeToNotifications,
  type InboxNotification,
} from '@/services/notifications';

export function useNotifications() {
  const { user, isConfigured, isLocalGuest } = useAuth();
  const enabled = isConfigured && user !== null && !isLocalGuest;
  const uid = enabled && user ? user.uid : null;
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToNotifications(
      uid,
      (items) => {
        setNotifications(items);
        setLoading(false);
        setError(null);
      },
      (listenError) => {
        setError(listenError.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid]);

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    setBusy(true);
    try {
      await markNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    } finally {
      setBusy(false);
    }
  }, [uid]);

  const markRead = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await markNotificationsRead([id]);
      setNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item))
      );
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    enabled,
    notifications,
    unread: notifications.filter((item) => !item.read).length,
    loading,
    error,
    busy,
    markAllRead,
    markRead,
  };
}
