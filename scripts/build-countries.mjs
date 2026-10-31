import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourcePath = process.argv[2] ?? resolve(root, 'assets/data/ne_110m_admin_0_countries.geojson');
const outputPath = process.argv[3] ?? resolve(root, 'assets/data/countries-110m.json');

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const countries = [];

function validCode(value) {
  return typeof value === 'string' && /^[A-Z]{2,3}$/.test(value) && value !== '-99'
    ? value
    : null;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

for (const feature of source.features ?? []) {
  const properties = feature.properties ?? {};
  const name = properties.NAME_ES || properties.NAME || properties.ADMIN;
  if (!name || !feature.geometry) continue;

  const code =
    validCode(properties.ISO_A2_EH) ||
    validCode(properties.ISO_A2) ||
    validCode(properties.ISO_A3_EH) ||
    validCode(properties.ISO_A3) ||
    validCode(properties.ADM0_A3) ||
    String(properties.ADM0_A3 ?? name);

  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates
        : [];

  const rings = [];
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const polygon of polygons) {
    const polygonRings = polygon
      .map((ring) =>
        ring
          .filter((point) => Array.isArray(point) && point.length >= 2)
          .map(([lon, lat]) => {
            const safeLon = Math.max(-180, Math.min(180, Number(lon)));
            const safeLat = Math.max(-90, Math.min(90, Number(lat)));
            west = Math.min(west, safeLon);
            south = Math.min(south, safeLat);
            east = Math.max(east, safeLon);
            north = Math.max(north, safeLat);
            return [round(safeLon), round(safeLat)];
          })
      )
      .filter((ring) => ring.length >= 4);

    if (polygonRings.length > 0) rings.push(polygonRings);
  }

  if (rings.length === 0 || !Number.isFinite(west)) continue;

  countries.push({
    code,
    name,
    continent: properties.CONTINENT ?? null,
    bbox: [round(west), round(south), round(east), round(north)],
    polygons: rings,
  });
}

countries.sort((a, b) => a.name.localeCompare(b.name, 'es'));

writeFileSync(
  outputPath,
  JSON.stringify({
    source: 'Natural Earth 1:110m Admin 0 Countries',
    license: 'Public domain',
    generatedAt: new Date().toISOString(),
    countries,
  })
);

console.info(`Wrote ${countries.length} countries to ${outputPath}`);
