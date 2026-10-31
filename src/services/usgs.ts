<<<<<<< HEAD
import { getCountryAt } from '@/services/countries';
=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
import type { FeedWindow, MagnitudeFilter, Quake, RegionAggregate } from '@/types/earthquake';

const FEED_BASE = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary';

/** Public-domain US government data: no key, no attribution requirement. */
export const USGS_ATTRIBUTION = 'Datos: USGS Earthquake Hazards Program';

/**
 * USGS names its feeds `{magnitude}_{window}.geojson` (e.g. `2.5_day.geojson`)
 * or `all_{window}.geojson`. `FeedWindow` carries the `all_` prefix, so it has
 * to be dropped before composing a magnitude feed.
 *
 * Unknown paths answer HTTP 200 with a `404 File Not Found` text body, which is
 * why the response is validated as JSON before it is trusted.
 */
export function feedUrl(window: FeedWindow, minMagnitude?: number): string {
  const slug = window.replace(/^all_/, '');

  if (minMagnitude !== undefined) {
    return `${FEED_BASE}/${minMagnitude.toFixed(1)}_${slug}.geojson`;
  }
  return `${FEED_BASE}/all_${slug}.geojson`;
}

/**
 * Only the fields we read. Declaring them here keeps the parser honest even
 * though the feed carries ~30 properties per feature.
 */
type RawProperties = {
  mag: number | null;
  place: string | null;
  time: number;
  updated: number;
  url: string;
  tsunami: 0 | 1;
  felt: number | null;
  alert: string | null;
  status: string;
  sig?: number;
  magType: string | null;
  type: string;
<<<<<<< HEAD
  mmi?: number | null;
  cdi?: number | null;
  net?: string | null;
  nst?: number | null;
=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
};

type RawFeature = {
  id: string;
  properties: RawProperties;
  geometry: { coordinates: [number, number, number] } | null;
};

type RawCollection = {
  features: RawFeature[];
};

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalize(feature: RawFeature): Quake | null {
  const { properties, geometry } = feature;

  // Skip anything we cannot place on a map.
  if (!geometry?.coordinates || geometry.coordinates.length < 3) return null;
  if (properties.type !== 'earthquake') return null;

  const [longitude, latitude, depth] = geometry.coordinates;
<<<<<<< HEAD
  const safeLatitude = toNumber(latitude, 0);
  const safeLongitude = toNumber(longitude, 0);
  const country = getCountryAt(safeLatitude, safeLongitude);
=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46

  return {
    id: feature.id,
    magnitude: typeof properties.mag === 'number' ? properties.mag : null,
    place: properties.place?.trim() || 'Ubicación desconocida',
    time: toNumber(properties.time, 0),
    updated: toNumber(properties.updated, 0),
    depthKm: toNumber(depth, 0),
<<<<<<< HEAD
    longitude: safeLongitude,
    latitude: safeLatitude,
=======
    longitude: toNumber(longitude, 0),
    latitude: toNumber(latitude, 0),
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
    url: properties.url,
    tsunami: properties.tsunami === 1 ? 1 : 0,
    felt: typeof properties.felt === 'number' ? properties.felt : null,
    alert: (['green', 'yellow', 'orange', 'red'] as const).includes(
      properties.alert as 'green'
    )
      ? (properties.alert as Quake['alert'])
      : null,
    status: properties.status ?? 'automatic',
    magnitudeType: properties.magType ?? null,
<<<<<<< HEAD
    countryCode: country?.code ?? null,
    countryName: country?.name ?? null,
    durationSeconds: null,
    durationSource: null,
    mmi: typeof properties.mmi === 'number' ? properties.mmi : null,
    cdi: typeof properties.cdi === 'number' ? properties.cdi : null,
    significance: typeof properties.sig === 'number' ? properties.sig : null,
    network: properties.net?.trim() || null,
    stationCount: typeof properties.nst === 'number' ? properties.nst : null,
=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
  };
}

/**
 * USGS caps responses at HTTP 429 when polled aggressively, and serves each
 * feed from a 60s cache. `signal` lets callers abandon the request on unmount.
 */
export async function fetchQuakes(
  window: FeedWindow = 'all_day',
  options: { minMagnitude?: number; signal?: AbortSignal } = {}
): Promise<Quake[]> {
  const { minMagnitude, signal } = options;
  const response = await fetch(feedUrl(window, minMagnitude), { signal });

  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? 'USGS está limitando las peticiones. Espera un momento.'
        : `USGS respondió ${response.status}`
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const body = await response.text();

  let data: RawCollection;
  try {
    if (!contentType.includes('json')) throw new Error('unexpected content type');
    data = JSON.parse(body) as RawCollection;
    if (!Array.isArray(data?.features)) throw new Error('missing features');
  } catch {
    throw new Error('USGS devolvió una respuesta no válida. Intenta de nuevo.');
  }

  return data.features
    .map(normalize)
    .filter((quake): quake is Quake => quake !== null)
    .sort((a, b) => b.time - a.time);
}

const MAGNITUDE_FLOORS: Record<Exclude<MagnitudeFilter, 'all'>, number> = {
  light: 2.5,
  moderate: 4,
  strong: 5,
  major: 6,
};

/**
 * The summary feed returns at most ~100 events per window, so filtering happens
 * on the client: switching a chip is instant and never spends a request.
 */
export function matchesMagnitude(quake: Quake, filter: MagnitudeFilter): boolean {
  if (filter === 'all') return true;
  if (quake.magnitude === null) return false;
  return quake.magnitude >= MAGNITUDE_FLOORS[filter];
}

/**
 * USGS `place` strings end with the administrative region, e.g.
 * "50km NNE of Tsukuba, Japan". Grouping on that suffix turns hundreds of
 * events into a ranked list of the currently active areas.
 */
export function aggregateByRegion(quakes: Quake[]): RegionAggregate[] {
  const buckets = new Map<string, RegionAggregate>();

  for (const quake of quakes) {
    const parts = quake.place.split(',');
    const name = (parts.length > 1 ? parts.slice(-1)[0] : parts[0]).trim();
    const existing = buckets.get(name);

    if (!existing) {
      buckets.set(name, {
        name,
        count: 1,
        energy: quake.magnitude ?? 0,
        maxMagnitude: quake.magnitude,
        latitude: quake.latitude,
        longitude: quake.longitude,
      });
      continue;
    }

    existing.count += 1;
    existing.energy += quake.magnitude ?? 0;
    if (quake.magnitude !== null) {
      existing.maxMagnitude =
        existing.maxMagnitude === null
          ? quake.magnitude
          : Math.max(existing.maxMagnitude, quake.magnitude);
    }
  }

  return [...buckets.values()].sort((a, b) => b.count - a.count);
}