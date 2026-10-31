const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact "hace 3 min" style label used across the feed. */
export function timeAgo(epochMs: number, now = Date.now()): string {
  const diff = Math.max(0, now - epochMs);

  if (diff < MINUTE) return 'ahora mismo';
  if (diff < HOUR) return `hace ${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY) return `hace ${Math.floor(diff / HOUR)} h`;
  if (diff < 7 * DAY) return `hace ${Math.floor(diff / DAY)} d`;
  return formatDate(epochMs);
}

export function formatDate(epochMs: number): string {
  const date = new Date(epochMs);
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatTime(epochMs: number): string {
  return new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(epochMs));
}

export function formatDateTime(epochMs: number): string {
  return `${formatDate(epochMs)} · ${formatTime(epochMs)}`;
}

export function formatUtc(epochMs: number): string {
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(epochMs));
}

/** "M 4.5" — the label shown next to every event. */
export function formatMagnitude(magnitude: number | null): string {
  return magnitude === null ? 'M —' : `M ${magnitude.toFixed(1)}`;
}

export function formatDepth(depthKm: number): string {
  return `${depthKm.toFixed(1)} km`;
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const ns = latitude >= 0 ? 'N' : 'S';
  const ew = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(2)}° ${ns}, ${Math.abs(longitude).toFixed(2)}° ${ew}`;
}

export function formatFelt(felt: number | null): string | null {
  return felt === null || felt === 0 ? null : `${felt} persona${felt === 1 ? '' : 's'}`;
}

export function formatDuration(seconds: number | null, source: string | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return 'Duración no disponible';
  }
  const rounded = seconds >= 10 ? Math.round(seconds) : Math.round(seconds * 10) / 10;
  return `${rounded} s${source ? ` · ${source}` : ''}`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Strips the "NNkm DIR of " prefix so the place reads as a location. */
export function shortenPlace(place: string): string {
  return place.replace(/^\d+\s*km\s+[NSEW]{1,3}\s+of\s+/i, '');
}