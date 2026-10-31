import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp();
}

export const REGION = 'us-central1';

export const CALL_OPTIONS = {
  region: REGION,
  maxInstances: 5,
  enforceAppCheck: false,
};

export const HTTP_OPTIONS = {
  region: REGION,
  maxInstances: 5,
  cors: false,
};

export const COOLDOWN_SECONDS = 30;
export const EMERGENCY_COOLDOWN_SECONDS = 600;
export const MAX_STORED_UNLOCKS = 1;
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_DISPLAY_NAME = 60;
export const MAX_BIO = 280;
export const MAX_GROUP_TITLE = 60;
export const MAX_GROUP_DESCRIPTION = 280;

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'soporte',
  'support',
  'sismoconnect',
  'system',
  'sistema',
  'moderator',
  'moderador',
  'root',
  'firebase',
  'usgs',
]);

export function db() {
  return getFirestore();
}

export function pairId(a: string, b: string): string {
  return [a, b].sort().join('_');
}

export function toMillis(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
}

export function normalizeUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
