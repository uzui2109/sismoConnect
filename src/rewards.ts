import { createVerify } from 'node:crypto';

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';

import {
  CALL_OPTIONS,
  HTTP_OPTIONS,
  MAX_STORED_UNLOCKS,
  db,
  isRecord,
} from './config';

const VERIFIER_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const KEY_CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_SSV_AGE_MS = 15 * 60 * 1000;

type KeyCache = { fetchedAt: number; keys: Map<string, string> };
let keyCache: KeyCache | null = null;

async function getVerifierKeys(): Promise<Map<string, string>> {
  if (keyCache && Date.now() - keyCache.fetchedAt < KEY_CACHE_MS) return keyCache.keys;

  const response = await fetch(VERIFIER_KEYS_URL, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`No se pudieron obtener las claves SSV (${response.status}).`);
  const payload = (await response.json()) as {
    keys?: Array<{ keyId?: number | string; pem?: string }>;
  };
  const keys = new Map<string, string>();
  for (const key of payload.keys ?? []) {
    if (key.pem && key.keyId !== undefined) keys.set(String(key.keyId), key.pem);
  }
  if (keys.size === 0) throw new Error('La respuesta de claves SSV está vacía.');
  keyCache = { fetchedAt: Date.now(), keys };
  return keys;
}

function decodeSignature(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function verifySignature(pem: string, message: string, signature: Buffer): boolean {
  try {
    const verifier = createVerify('sha256');
    verifier.update(message);
    verifier.end();
    if (verifier.verify(pem, signature)) return true;
  } catch {
    // Some AdMob signatures use IEEE P1363 instead of the default DER encoding.
  }

  try {
    const verifier = createVerify('sha256');
    verifier.update(message);
    verifier.end();
    return verifier.verify({ key: pem, dsaEncoding: 'ieee-p1363' }, signature);
  } catch {
    return false;
  }
}

function timestampToMillis(value: string | null): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric > 1e12 ? numeric : numeric * 1000;
}

export const admobSsv = onRequest(HTTP_OPTIONS, async (request, response) => {
  if (request.method !== 'GET') {
    response.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const url = new URL(request.url, 'https://ssv.invalid');
    const params = url.searchParams;
    const signatureParam = params.get('signature');
    const keyId = params.get('key_id');
    const transactionId = params.get('transaction_id') ?? '';
    const userId = params.get('user_id') ?? '';
    const timestamp = timestampToMillis(params.get('timestamp'));
    const adUnit = params.get('ad_unit') ?? '';
    const rewardAmount = Number(params.get('reward_amount') ?? 0);
    const rewardItem = params.get('reward_item') ?? '';

    if (!signatureParam || !keyId || !transactionId) {
      response.status(400).send('Bad Request');
      return;
    }
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(transactionId)) {
      response.status(400).send('Bad Request');
      return;
    }
    if (!userId || !/^[A-Za-z0-9_-]{1,200}$/.test(userId)) {
      console.warn('SSV sin user_id válido; se ignora.', { transactionId });
      response.status(200).send('OK');
      return;
    }
    if (!timestamp || Math.abs(Date.now() - timestamp) > MAX_SSV_AGE_MS) {
      console.warn('SSV con timestamp fuera de ventana.', { transactionId });
      response.status(403).send('Forbidden');
      return;
    }

    const configuredUnits = [
      process.env.ADMOB_REWARDED_UNIT_ID,
      process.env.ADMOB_REWARDED_UNIT_ID_ANDROID,
    ].filter((value): value is string => Boolean(value));
    if (configuredUnits.length > 0 && !configuredUnits.includes(adUnit)) {
      console.warn('SSV para una unidad no configurada.', { transactionId, adUnit });
      response.status(403).send('Forbidden');
      return;
    }

    const keys = await getVerifierKeys();
    const pem = keys.get(String(keyId));
    if (!pem) {
      response.status(403).send('Unknown key');
      return;
    }

    const rawQuery = url.search.startsWith('?') ? url.search.slice(1) : url.search;
    const unsignedQuery = rawQuery
      .split('&')
      .filter((part) => !part.startsWith('signature='))
      .join('&');
    const signature = decodeSignature(signatureParam);

    if (!verifySignature(pem, unsignedQuery, signature)) {
      console.warn('SSV con firma inválida.', { transactionId, keyId });
      response.status(403).send('Invalid signature');
      return;
    }

    const now = Date.now();
    const rewardRef = db().doc(`admobRewards/${transactionId}`);
    const userRef = db().doc(`users/${userId}`);

    const result = await db().runTransaction(async (tx) => {
      const [rewardSnap, userSnap] = await Promise.all([tx.get(rewardRef), tx.get(userRef)]);
      if (rewardSnap.exists) return { duplicate: true, applied: false };

      if (!userSnap.exists) {
        tx.set(rewardRef, {
          uid: userId,
          transactionId,
          rewardAmount: Number.isFinite(rewardAmount) ? rewardAmount : 0,
          rewardItem,
          adUnit,
          applied: false,
          reason: 'missing-user',
          createdAt: now,
        });
        return { duplicate: false, applied: false };
      }

      const current = Math.min(
        MAX_STORED_UNLOCKS,
        Math.max(0, Math.floor(Number(userSnap.get('unlocks')) || 0))
      );
      const next = Math.min(MAX_STORED_UNLOCKS, current + 1);
      const applied = next > current;
      tx.set(userRef, { unlocks: next, updatedAt: now }, { merge: true });
      tx.set(rewardRef, {
        uid: userId,
        transactionId,
        rewardAmount: Number.isFinite(rewardAmount) ? rewardAmount : 0,
        rewardItem,
        adUnit,
        applied,
        reason: applied ? 'granted' : 'already-has-unlock',
        createdAt: now,
      });
      return { duplicate: false, applied };
    });

    console.info('SSV procesado.', {
      transactionId,
      uid: userId,
      duplicate: result.duplicate,
      applied: result.applied,
    });
    response.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando SSV.', error);
    response.status(500).send('Internal Server Error');
  }
});

export const rewardState = onCall(CALL_OPTIONS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  const userSnap = await db().doc(`users/${uid}`).get();
  if (!userSnap.exists) return { unlocks: 0, lastMessageAt: 0, lastEmergencyAt: 0 };
  return {
    unlocks: Math.min(
      MAX_STORED_UNLOCKS,
      Math.max(0, Math.floor(Number(userSnap.get('unlocks')) || 0))
    ),
    lastMessageAt: Number(userSnap.get('lastMessageAt')) || 0,
    lastEmergencyAt: Number(userSnap.get('lastEmergencyAt')) || 0,
  };
});

export const emergencyState = onCall(CALL_OPTIONS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  const data = isRecord(request.data) ? request.data : {};
  const chatId = typeof data.chatId === 'string' ? data.chatId : '';
  if (!chatId) throw new HttpsError('invalid-argument', 'Chat inválido.');

  const [userSnap, configSnap] = await Promise.all([
    db().doc(`users/${uid}`).get(),
    db().doc('config/chat').get(),
  ]);
  const lastEmergencyAt = Number(userSnap.get('lastEmergencyAt')) || 0;
  const seconds = Math.max(
    1,
    Number(configSnap.get('emergencyCooldownSeconds')) || 600
  );
  return {
    lastEmergencyAt,
    nextAllowedAt: lastEmergencyAt + seconds * 1000,
  };
});
