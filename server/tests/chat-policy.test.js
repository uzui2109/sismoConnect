'use strict';

const assert = require('node:assert');
const {
  calculateCooldownMs,
  computeStoredUnlocks,
  checkEmergencyCooldown,
  checkNormalCooldown,
  applyUnlockConsumption,
} = require('../lib/lib/chat-policy');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL - ${name}: ${err.message}`);
  }
}

const NOW = 1_000_000_000_000;

test('calculateCooldownMs usa el valor de configuración', () => {
  assert.strictEqual(calculateCooldownMs(30, 60), 30_000);
});

test('calculateCooldownMs usa el fallback cuando el valor es inválido', () => {
  assert.strictEqual(calculateCooldownMs(undefined, 60), 60_000);
  assert.strictEqual(calculateCooldownMs(null, 60), 60_000);
  assert.strictEqual(calculateCooldownMs('abc', 60), 60_000);
});

test('calculateCooldownMs trata 0 como "sin configuración" y usa el fallback', () => {
  assert.strictEqual(calculateCooldownMs(0, 60), 60_000);
});

test('calculateCooldownMs clampa negativos al mínimo de 1 segundo', () => {
  assert.strictEqual(calculateCooldownMs(-5, 60), 1_000);
});

test('computeStoredUnlocks clampa al máximo', () => {
  assert.strictEqual(computeStoredUnlocks(5, 1), 1);
  assert.strictEqual(computeStoredUnlocks(1, 1), 1);
});

test('computeStoredUnlocks redondea hacia abajo y no va bajo cero', () => {
  assert.strictEqual(computeStoredUnlocks(2.9, 5), 2);
  assert.strictEqual(computeStoredUnlocks(-3, 5), 0);
  assert.strictEqual(computeStoredUnlocks(null, 5), 0);
  assert.strictEqual(computeStoredUnlocks(undefined, 5), 0);
});

test('checkEmergencyCooldown permite cuando no hay uso previo', () => {
  const r = checkEmergencyCooldown(0, NOW, 600_000);
  assert.strictEqual(r.allowed, true);
});

test('checkEmergencyCooldown permite cuando pasó el cooldown', () => {
  const r = checkEmergencyCooldown(NOW - 700_000, NOW, 600_000);
  assert.strictEqual(r.allowed, true);
});

test('checkEmergencyCooldown deniega dentro del cooldown y da nextAllowedAt', () => {
  const r = checkEmergencyCooldown(NOW - 100_000, NOW, 600_000);
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.nextAllowedAt, NOW - 100_000 + 600_000);
  assert.strictEqual(typeof r.message, 'string');
});

test('checkNormalCooldown permite cuando no hay mensaje previo', () => {
  const r = checkNormalCooldown(0, NOW, 30_000, 0);
  assert.strictEqual(r.allowed, true);
});

test('checkNormalCooldown permite cuando pasó el cooldown', () => {
  const r = checkNormalCooldown(NOW - 40_000, NOW, 30_000, 0);
  assert.strictEqual(r.allowed, true);
});

test('checkNormalCooldown deniega dentro del cooldown sin unlocks', () => {
  const r = checkNormalCooldown(NOW - 10_000, NOW, 30_000, 0);
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.nextAllowedAt, NOW - 10_000 + 30_000);
  assert.strictEqual(r.consumeUnlock, undefined);
});

test('checkNormalCooldown permite con consumo de unlock dentro del cooldown', () => {
  const r = checkNormalCooldown(NOW - 10_000, NOW, 30_000, 1);
  assert.strictEqual(r.allowed, true);
  assert.strictEqual(r.consumeUnlock, true);
});

test('applyUnlockConsumption decrementa cuando se consume', () => {
  assert.strictEqual(applyUnlockConsumption(1, true), 0);
});

test('applyUnlockConsumption no decrementa cuando no se consume', () => {
  assert.strictEqual(applyUnlockConsumption(1, false), 1);
  assert.strictEqual(applyUnlockConsumption(0, true), 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
