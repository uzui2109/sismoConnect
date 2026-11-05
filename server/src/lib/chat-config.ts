export const COOLDOWN_SECONDS = 30;
export const EMERGENCY_COOLDOWN_SECONDS = 600;
export const MAX_STORED_UNLOCKS = 1;

export function toMillis(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function positiveSeconds(value: unknown, fallback: number): number {
  return Math.max(1, Number(value) || fallback);
}
