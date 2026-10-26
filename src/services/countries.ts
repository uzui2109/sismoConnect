import countryData from '@/assets/data/countries-110m.json';

import type { Country, Ring } from '@/types/country';

type CountryCollection = {
  source: string;
  countries: Country[];
};

const collection = countryData as unknown as CountryCollection;
const countries = collection.countries;
const cache = new Map<string, Country | null>();

function pointInRing(longitude: number, latitude: number, ring: Ring): boolean {
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[previous];
    const crosses =
      y1 > latitude !== y2 > latitude &&
      longitude < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1;

    if (crosses) inside = !inside;
  }

  return inside;
}

function pointInPolygon(longitude: number, latitude: number, country: Country): boolean {
  for (const polygon of country.polygons) {
    const [outer, ...holes] = polygon;
    if (!outer || !pointInRing(longitude, latitude, outer)) continue;
    if (holes.some((hole) => pointInRing(longitude, latitude, hole))) continue;
    return true;
  }

  return false;
}

export function getCountries(): Country[] {
  return countries;
}

export function getCountryByCode(code: string | null | undefined): Country | null {
  if (!code) return null;
  return countries.find((country) => country.code === code) ?? null;
}

export function getCountryAt(latitude: number, longitude: number): Country | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  let result: Country | null = null;
  for (const country of countries) {
    const [west, south, east, north] = country.bbox;
    if (longitude < west || longitude > east || latitude < south || latitude > north) continue;
    if (pointInPolygon(longitude, latitude, country)) {
      result = country;
      break;
    }
  }

  cache.set(key, result);
  return result;
}

export function countryLabel(country: Country | null): string {
  return country?.name ?? 'Sin país';
}
