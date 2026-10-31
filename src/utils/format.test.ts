import {
  formatCoordinates,
  formatDate,
  formatDateTime,
  formatDepth,
  formatDuration,
  formatFelt,
  formatMagnitude,
  formatTime,
  formatUtc,
  pluralize,
  shortenPlace,
  timeAgo,
} from '@/utils/format';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 25, 18, 0, 0);

describe('timeAgo', () => {
  it('returns "ahora mismo" under a minute', () => {
    expect(timeAgo(NOW, NOW)).toBe('ahora mismo');
    expect(timeAgo(NOW - 59_000, NOW)).toBe('ahora mismo');
  });

  it('uses minutes, hours and days', () => {
    expect(timeAgo(NOW - MINUTE, NOW)).toBe('hace 1 min');
    expect(timeAgo(NOW - 5 * MINUTE, NOW)).toBe('hace 5 min');
    expect(timeAgo(NOW - 3 * HOUR, NOW)).toBe('hace 3 h');
    expect(timeAgo(NOW - 2 * DAY, NOW)).toBe('hace 2 d');
  });

  it('falls back to the formatted date after a week', () => {
    expect(timeAgo(NOW - 8 * DAY, NOW)).toBe(formatDate(NOW - 8 * DAY));
  });
});

describe('format helpers', () => {
  it('formats magnitudes and depths', () => {
    expect(formatMagnitude(null)).toBe('M —');
    expect(formatMagnitude(4.56)).toBe('M 4.6');
    expect(formatDepth(12.34)).toBe('12.3 km');
  });

  it('formats coordinates with hemispheres', () => {
    expect(formatCoordinates(19.4326, -99.1332)).toBe('19.43° N, 99.13° W');
    expect(formatCoordinates(-33.4489, 70.6693)).toBe('33.45° S, 70.67° E');
  });

  it('formats felt reports', () => {
    expect(formatFelt(null)).toBeNull();
    expect(formatFelt(0)).toBeNull();
    expect(formatFelt(1)).toBe('1 persona');
    expect(formatFelt(5)).toBe('5 personas');
  });

  it('formats durations with source and fallback', () => {
    expect(formatDuration(null, 'USGS')).toBe('Duración no disponible');
    expect(formatDuration(0, 'USGS')).toBe('Duración no disponible');
    expect(formatDuration(Number.NaN, null)).toBe('Duración no disponible');
    expect(formatDuration(4.26, 'USGS')).toBe('4.3 s · USGS');
    expect(formatDuration(12.6, null)).toBe('13 s');
  });

  it('pluralizes counts', () => {
    expect(pluralize(1, 'sismo', 'sismos')).toBe('1 sismo');
    expect(pluralize(3, 'sismo', 'sismos')).toBe('3 sismos');
  });

  it('shortens USGS place prefixes', () => {
    expect(shortenPlace('12 km SE of Puebla, Mexico')).toBe('Puebla, Mexico');
    expect(shortenPlace('Puebla, Mexico')).toBe('Puebla, Mexico');
  });

  it('combines date and time', () => {
    expect(formatDateTime(NOW)).toBe(`${formatDate(NOW)} · ${formatTime(NOW)}`);
  });

  it('formats UTC timestamps for cross-checking', () => {
    const value = formatUtc(NOW);
    expect(value).toContain('18:00');
    expect(value).toContain('UTC');
  });
});
