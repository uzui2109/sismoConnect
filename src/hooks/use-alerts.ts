import { where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import {
  addDocument,
  deleteDocument,
  subscribeToCollection,
  updateDocument,
  type FirestoreDocument,
} from '@/services/firestore';

const ALERTS_COLLECTION = 'alertas';

export type AlertRecord = {
  id: string;
  userId: string;
  minMagnitude: number;
  place: string;
  active: boolean;
  createdAt: number;
};

const EMPTY_ALERTS: AlertRecord[] = [];

function toAlert(document: FirestoreDocument): AlertRecord {
  return {
    id: document.id,
    userId: String(document.userId ?? ''),
    minMagnitude: Number(document.minMagnitude ?? 0),
    place: typeof document.place === 'string' ? document.place : '',
    active: document.active !== false,
    createdAt: Number(document.createdAt ?? 0),
  };
}

/**
 * User-defined magnitude alerts stored in Firestore. The list is kept in sync
 * in real time: `subscribeToCollection` returns the `onSnapshot` unsubscribe
 * function, which this hook returns from its effect as the cleanup.
 *
 * Only a real Firebase session can reach Firestore (security rules reject
 * everyone else), so the local guest session stays disabled.
 */
export function useFirestoreAlerts() {
  const { user, isConfigured, isLocalGuest } = useAuth();

  // The feed remembers which uid it belongs to so a sign-out or account switch
  // shows the loading/empty state instead of the previous user's alerts.
  const [feed, setFeed] = useState<{ uid: string; alerts: AlertRecord[] } | null>(null);
  const [failure, setFailure] = useState<{ uid: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const enabled = isConfigured && user !== null && !isLocalGuest;
  const uid = enabled && user ? user.uid : null;

  useEffect(() => {
    if (uid === null) return;

    const unsubscribe = subscribeToCollection(
      ALERTS_COLLECTION,
      (documents) => {
        setFeed({
          uid,
          alerts: documents
            .map(toAlert)
            .filter((alert) => alert.userId === uid)
            .sort((a, b) => b.createdAt - a.createdAt),
        });
        setFailure(null);
      },
      (listenerError) => {
        console.error(listenerError);
        setFailure({ uid, message: 'No se pudieron escuchar las alertas de Firestore.' });
      },
      [where('userId', '==', uid)]
    );

    return unsubscribe;
  }, [uid]);

  const addAlert = useCallback(
    async (input: { minMagnitude: number; place: string }) => {
      if (uid === null) throw new Error('Se necesita una sesión activa para guardar alertas.');

      setBusy(true);
      try {
        await addDocument(ALERTS_COLLECTION, {
          userId: uid,
          minMagnitude: input.minMagnitude,
          place: input.place.trim(),
          active: true,
          createdAt: Date.now(),
        });
      } finally {
        setBusy(false);
      }
    },
    [uid]
  );

  const toggleAlert = useCallback(async (alert: AlertRecord) => {
    setBusy(true);
    try {
      await updateDocument(ALERTS_COLLECTION, alert.id, { active: !alert.active });
    } finally {
      setBusy(false);
    }
  }, []);

  const removeAlert = useCallback(async (alert: AlertRecord) => {
    setBusy(true);
    try {
      await deleteDocument(ALERTS_COLLECTION, alert.id);
    } finally {
      setBusy(false);
    }
  }, []);

  const alerts = feed !== null && feed.uid === uid ? feed.alerts : EMPTY_ALERTS;
  const loading = uid !== null && (feed === null || feed.uid !== uid) && failure?.uid !== uid;
  const error = failure !== null && failure.uid === uid ? failure.message : null;

  return useMemo(
    () => ({ enabled, alerts, loading, error, busy, addAlert, toggleAlert, removeAlert }),
    [enabled, alerts, loading, error, busy, addAlert, toggleAlert, removeAlert]
  );
}
