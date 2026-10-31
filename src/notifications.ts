import { createHash } from 'crypto';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { CALL_OPTIONS, REGION, db, isRecord } from './config';

type NotificationType = 'earthquake' | 'chat' | 'friendRequest' | 'friendAccepted' | 'group';

type NotificationPrefs = {
  earthquakes: boolean;
  social: boolean;
  messages: boolean;
  friends: boolean;
  groups: boolean;
};

type PushInput = {
  uids: string[];
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  dedupeKey?: string;
  pref?: keyof NotificationPrefs;
};

const DEFAULT_PREFS: NotificationPrefs = {
  earthquakes: true,
  social: true,
  messages: true,
  friends: true,
  groups: true,
};

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function prefsFrom(value: unknown): NotificationPrefs {
  const data = isRecord(value) ? value : {};
  return {
    earthquakes: data.earthquakes !== false,
    social: data.social !== false,
    messages: data.messages !== false,
    friends: data.friends !== false,
    groups: data.groups !== false,
  };
}

function partialPrefs(value: unknown): Partial<NotificationPrefs> {
  const data = isRecord(value) ? value : {};
  const next: Partial<NotificationPrefs> = {};
  for (const key of Object.keys(DEFAULT_PREFS) as (keyof NotificationPrefs)[]) {
    if (typeof data[key] === 'boolean') next[key] = data[key] as boolean;
  }
  return next;
}

function requiredUid(request: { auth?: { uid?: string } }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  return uid;
}

async function deliver({ uids, type, title, body, data = {}, dedupeKey, pref }: PushInput) {
  const unique = [...new Set(uids)].filter(Boolean).slice(0, 500);
  if (unique.length === 0) return { sent: 0, inbox: 0 };

  const now = Date.now();
  const tokens: { token: string; uid: string }[] = [];
  let inbox = 0;

  for (const uid of unique) {
    const userRef = db().doc(`users/${uid}`);
    const [userSnap, devicesSnap] = await Promise.all([
      userRef.get(),
      db().collection('pushDevices').where('uid', '==', uid).limit(10).get(),
    ]);
    const user = userSnap.exists ? userSnap.data() ?? {} : {};
    const prefs = prefsFrom(user.notificationPrefs);
    const allowedByPref = pref ? prefs[pref] : true;
    const enabled = user.notificationsEnabled === true && user.suspended !== true && allowedByPref;

    const notificationId = dedupeKey
      ? `notification_${hash(`${uid}:${dedupeKey}`)}`
      : `notification_${hash(`${uid}:${type}:${now}:${title}`)}`;
    const notificationRef = db().doc(`notifications/${notificationId}`);
    if (dedupeKey && (await notificationRef.get()).exists) continue;

    await notificationRef.set({
      uid,
      type,
      title: title.slice(0, 120),
      body: body.slice(0, 500),
      data,
      read: false,
      createdAt: now,
    });
    inbox += 1;

    if (!enabled) continue;
    for (const device of devicesSnap.docs) {
      const token = text(device.get('token'), 4096);
      if (token && device.get('enabled') !== false) tokens.push({ token, uid });
    }
  }

  if (tokens.length === 0) return { sent: 0, inbox };

  const channelId =
    type === 'earthquake' ? 'earthquakes' : type === 'chat' ? 'social' : 'default';
  const stringData = Object.fromEntries(
    Object.entries({ ...data, type }).map(([key, value]) => [key, String(value).slice(0, 500)])
  );

  let sent = 0;
  try {
    const messaging = getMessaging();
    for (let index = 0; index < tokens.length; index += 500) {
      const chunk = tokens.slice(index, index + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: chunk.map((item) => item.token),
        notification: { title: title.slice(0, 120), body: body.slice(0, 500) },
        data: stringData,
        android: {
          priority: 'high',
          notification: { channelId, sound: 'default' },
        },
      });
      sent += response.successCount;

      const invalid = response.responses
        .map((result, resultIndex) => (result.success ? null : chunk[resultIndex]?.token))
        .filter((token): token is string => Boolean(token));
      for (const token of invalid) {
        const matches = await db().collection('pushDevices').where('token', '==', token).get();
        await Promise.all(matches.docs.map((document) => document.ref.delete()));
      }
    }
  } catch (error) {
    console.error('FCM delivery failed', error);
  }

  return { sent, inbox };
}

export const registerPushDevice = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const token = text(data.token, 4096);
  const platform = data.platform === 'ios' ? 'ios' : 'android';
  const deviceId = text(data.deviceId, 128) || hash(token);
  const appVersion = text(data.appVersion, 40) || null;

  if (token.length < 20) throw new HttpsError('invalid-argument', 'Token de notificación inválido.');

  const now = Date.now();
  const deviceRef = db().doc(`pushDevices/${hash(`${uid}:${deviceId}`)}`);
  const existing = await deviceRef.get();

  await deviceRef.set(
    {
      uid,
      token,
      platform,
      deviceId,
      appVersion,
      enabled: true,
      createdAt: existing.exists ? existing.get('createdAt') ?? now : now,
      updatedAt: now,
    },
    { merge: true }
  );
  await db().doc(`users/${uid}`).set(
    { notificationsEnabled: true, updatedAt: now },
    { merge: true }
  );

  return { registered: true, deviceId };
});

export const unregisterPushDevice = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const deviceId = text(data.deviceId, 128);

  if (deviceId) {
    await db().doc(`pushDevices/${hash(`${uid}:${deviceId}`)}`).delete();
  } else {
    const devices = await db().collection('pushDevices').where('uid', '==', uid).get();
    await Promise.all(devices.docs.map((document) => document.ref.delete()));
  }

  const remaining = await db().collection('pushDevices').where('uid', '==', uid).limit(1).get();
  await db().doc(`users/${uid}`).set(
    { notificationsEnabled: !remaining.empty, updatedAt: Date.now() },
    { merge: true }
  );

  return { unregistered: true };
});

export const updateNotificationPrefs = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const current = await db().doc(`users/${uid}`).get();
  const next = { ...prefsFrom(current.get('notificationPrefs')), ...partialPrefs(data) };

  await db().doc(`users/${uid}`).set(
    { notificationPrefs: next, updatedAt: Date.now() },
    { merge: true }
  );
  return next;
});

export const markNotificationsRead = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const ids = Array.isArray(data.ids)
    ? data.ids.filter((value): value is string => typeof value === 'string').slice(0, 100)
    : [];

  if (ids.length === 0) {
    const unread = await db()
      .collection('notifications')
      .where('uid', '==', uid)
      .where('read', '==', false)
      .limit(500)
      .get();
    await Promise.all(unread.docs.map((document) => document.ref.update({ read: true })));
    return { updated: unread.size };
  }

  const updates = await Promise.all(
    ids.map(async (id) => {
      const ref = db().doc(`notifications/${id}`);
      const snapshot = await ref.get();
      if (!snapshot.exists || snapshot.get('uid') !== uid) return 0;
      await ref.update({ read: true });
      return 1;
    })
  );
  let updated = 0;
  for (const value of updates) updated += value;
  return { updated };
});

export const onChatMessageCreated = onDocumentCreated(
  { document: 'chats/{chatId}/messages/{messageId}', region: REGION, maxInstances: 5 },
  async (event) => {
    const message = event.data?.data();
    if (!message) return;
    const senderId = text(message.senderId, 128);
    const chatId = event.params.chatId;
    const [chatSnap, senderSnap] = await Promise.all([
      db().doc(`chats/${chatId}`).get(),
      senderId ? db().doc(`publicProfiles/${senderId}`).get() : Promise.resolve(null),
    ]);
    if (!chatSnap.exists) return;

    const memberIds = Array.isArray(chatSnap.get('memberIds'))
      ? (chatSnap.get('memberIds') as string[])
      : [];
    const recipients = memberIds.filter((uid) => uid !== senderId);
    const senderName = senderSnap?.get('displayName') ?? 'Alguien';
    const chatTitle = text(chatSnap.get('title'), 120) || 'Chat';
    const body = text(message.text, 180) || 'Nuevo mensaje';

    await deliver({
      uids: recipients,
      type: 'chat',
      title: chatTitle,
      body: `${senderName}: ${body}`,
      data: { chatId },
      dedupeKey: `chat:${event.params.messageId}`,
      pref: 'messages',
    });
  }
);

export const onFriendRequestCreated = onDocumentCreated(
  { document: 'friendRequests/{requestId}', region: REGION, maxInstances: 5 },
  async (event) => {
    const request = event.data?.data();
    if (!request || request.status !== 'pending') return;
    const fromUid = text(request.fromUid, 128);
    const toUid = text(request.toUid, 128);
    if (!fromUid || !toUid) return;
    const sender = await db().doc(`publicProfiles/${fromUid}`).get();
    const name = sender.get('displayName') ?? 'Un explorador';

    await deliver({
      uids: [toUid],
      type: 'friendRequest',
      title: 'Nueva solicitud de amistad',
      body: `${name} quiere conectar contigo.`,
      data: { uid: fromUid },
      dedupeKey: `friend-request:${event.params.requestId}`,
      pref: 'friends',
    });
  }
);

export const onFriendRequestUpdated = onDocumentUpdated(
  { document: 'friendRequests/{requestId}', region: REGION, maxInstances: 5 },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || after.status !== 'accepted' || before.status === 'accepted') return;
    const fromUid = text(after.fromUid, 128);
    const toUid = text(after.toUid, 128);
    if (!fromUid || !toUid) return;
    const receiver = await db().doc(`publicProfiles/${toUid}`).get();
    const name = receiver.get('displayName') ?? 'Un explorador';

    await deliver({
      uids: [fromUid],
      type: 'friendAccepted',
      title: 'Solicitud aceptada',
      body: `${name} aceptó tu solicitud de amistad.`,
      data: { uid: toUid },
      dedupeKey: `friend-accepted:${event.params.requestId}`,
      pref: 'friends',
    });
  }
);

type UsgsFeature = {
  id?: string;
  properties?: {
    mag?: number | null;
    place?: string | null;
    time?: number;
    url?: string;
  };
  geometry?: { coordinates?: number[] };
};

export const earthquakePush = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: REGION,
    timeoutSeconds: 120,
    maxInstances: 1,
    retryCount: 0,
  },
  async () => {
    const response = await fetch(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_hour.geojson',
      { headers: { accept: 'application/json', 'user-agent': 'SismoConnect/1.0' } }
    );
    if (!response.ok) throw new Error(`USGS respondió ${response.status}`);

    const payload = (await response.json()) as { features?: UsgsFeature[] };
    const features = Array.isArray(payload.features) ? payload.features : [];
    const alertsSnap = await db().collection('alertas').limit(1000).get();
    const alerts = alertsSnap.docs
      .map((document) => ({ id: document.id, ...document.data() }) as {
        id: string;
        active?: boolean;
        userId?: unknown;
        minMagnitude?: unknown;
        place?: unknown;
      })
      .filter((alert) => alert.active !== false);
    const usersSnap = await db().collection('users').where('notificationsEnabled', '==', true).limit(1000).get();
    const allEnabled = usersSnap.docs.map((document) => document.id);

    for (const feature of features) {
      const quakeId = text(feature.id, 80);
      const magnitude = typeof feature.properties?.mag === 'number' ? feature.properties.mag : null;
      const place = text(feature.properties?.place, 240);
      if (!quakeId || magnitude === null || magnitude < 4.5) continue;

      const marker = db().doc(`system/earthquakePush/${quakeId}`);
      if ((await marker.get()).exists) continue;

      const recipients = new Set<string>();
      for (const alert of alerts) {
        const uid = text(alert.userId, 128);
        const minimum = Number(alert.minMagnitude ?? 0);
        const target = text(alert.place, 120).toLowerCase();
        if (!uid || magnitude < minimum) continue;
        if (target && !place.toLowerCase().includes(target)) continue;
        recipients.add(uid);
      }
      if (magnitude >= 5.5) {
        for (const uid of allEnabled) recipients.add(uid);
      }

      if (recipients.size > 0) {
        await deliver({
          uids: [...recipients],
          type: 'earthquake',
          title: `Sismo M ${magnitude.toFixed(1)}`,
          body: `${place || 'Ubicación sin especificar'} · ${new Date(feature.properties?.time ?? Date.now()).toLocaleString('es')}`,
          data: { quakeId, url: text(feature.properties?.url, 500) },
          dedupeKey: `quake:${quakeId}`,
          pref: 'earthquakes',
        });
      }

      await marker.set({ quakeId, magnitude, place, processedAt: Date.now() });
    }
  }
);

export async function notifyGroupJoined(uid: string, chatId: string, chatTitle: string) {
  return deliver({
    uids: [uid],
    type: 'group',
    title: 'Te uniste a un grupo',
    body: `Ya formas parte de ${chatTitle}.`,
    data: { chatId },
    pref: 'groups',
  });
}
