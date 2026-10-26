import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { getFirebaseFirestore, getFirebaseFunctions } from '@/lib/firebase';
import { toMillis } from '@/services/social';

export type InboxNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  read: boolean;
  createdAt: number;
};

function notificationFromData(id: string, data: DocumentData): InboxNotification {
  return {
    id,
    type: typeof data.type === 'string' ? data.type : 'general',
    title: typeof data.title === 'string' ? data.title : 'Aviso',
    body: typeof data.body === 'string' ? data.body : '',
    data:
      data.data && typeof data.data === 'object'
        ? Object.fromEntries(
            Object.entries(data.data as Record<string, unknown>).map(([key, value]) => [
              key,
              String(value),
            ])
          )
        : {},
    read: data.read === true,
    createdAt: toMillis(data.createdAt),
  };
}

export function subscribeToNotifications(
  uid: string,
  onData: (items: InboxNotification[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    query(
      collection(getFirebaseFirestore(), 'notifications'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    ),
    (snapshot) => onData(snapshot.docs.map((document) => notificationFromData(document.id, document.data()))),
    (error) => onError?.(error)
  );
}

export async function markNotificationsRead(ids?: string[]) {
  const callable = httpsCallable<{ ids?: string[] }, { updated: number }>(
    getFirebaseFunctions(),
    'markNotificationsRead'
  );
  const result = await callable(ids ? { ids } : {});
  return result.data;
}
