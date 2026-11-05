"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_STORED_UNLOCKS = exports.EMERGENCY_COOLDOWN_SECONDS = exports.COOLDOWN_SECONDS = void 0;
exports.toMillis = toMillis;
exports.positiveSeconds = positiveSeconds;
exports.COOLDOWN_SECONDS = 30;
exports.EMERGENCY_COOLDOWN_SECONDS = 600;
exports.MAX_STORED_UNLOCKS = 1;
function toMillis(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (value && typeof value.toMillis === 'function') {
        const millis = value.toMillis();
        return Number.isFinite(millis) ? millis : 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function positiveSeconds(value, fallback) {
    return Math.max(1, Number(value) || fallback);
}
