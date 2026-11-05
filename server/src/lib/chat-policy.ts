export interface ChatPolicyConfig {
  cooldownSeconds: number;
  emergencyCooldownSeconds: number;
  maxStoredUnlocks: number;
}

export interface CooldownResult {
  allowed: boolean;
  consumeUnlock?: boolean;
  nextAllowedAt?: number;
  message?: string;
}

export function calculateCooldownMs(
  configValue: unknown,
  defaultSeconds: number
): number {
  return Math.max(1, Number(configValue) || defaultSeconds) * 1000;
}

export function computeStoredUnlocks(
  unlocks: unknown,
  maxStored: number
): number {
  return Math.min(maxStored, Math.max(0, Math.floor(Number(unlocks) || 0)));
}

export function checkEmergencyCooldown(
  lastEmergencyAt: number,
  now: number,
  emergencyCooldownMs: number
): CooldownResult {
  if (!lastEmergencyAt || now - lastEmergencyAt >= emergencyCooldownMs) {
    return { allowed: true };
  }
  return {
    allowed: false,
    nextAllowedAt: lastEmergencyAt + emergencyCooldownMs,
    message:
      'La alerta de emergencia ya fue usada. Puedes volver a usarla en unos minutos.',
  };
}

export function checkNormalCooldown(
  lastMessageAt: number,
  now: number,
  cooldownMs: number,
  storedUnlocks: number
): CooldownResult {
  if (!lastMessageAt || now - lastMessageAt >= cooldownMs) {
    return { allowed: true };
  }
  if (storedUnlocks < 1) {
    return {
      allowed: false,
      nextAllowedAt: lastMessageAt + cooldownMs,
      message: `Espera ${Math.ceil(
        (cooldownMs - (now - lastMessageAt)) / 1000
      )} s o desbloquea un envío.`,
    };
  }
  return { allowed: true, consumeUnlock: true };
}

export function applyUnlockConsumption(
  storedUnlocks: number,
  consume: boolean
): number {
  return consume ? Math.max(0, storedUnlocks - 1) : storedUnlocks;
}
