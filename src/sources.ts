import { XMLParser } from 'fast-xml-parser';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { CALL_OPTIONS, db } from './config';

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_DOC = 'system/situationCache';
const GDACS_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH';
const RELIEFWEB_URL = 'https://reliefweb.int/disasters/rss.xml';

type ReportSource = 'GDACS' | 'ReliefWeb';
type AlertLevel = 'green' | 'yellow' | 'orange' | 'red';

type SituationReport = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: ReportSource;
  sourceLabel: string;
  kind: 'earthquake' | 'tsunami' | 'disaster';
  countryCode: string | null;
  countryName: string | null;
  latitude: number | null;
  longitude: number | null;
  magnitude: number | null;
  alertLevel: AlertLevel | null;
  publishedAt: number;
  updatedAt: number;
};

type SourceStatus = 'ok' | 'error';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, max = 600): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function millis(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function alertLevel(value: unknown): AlertLevel | null {
  const normalized = text(value).toLowerCase();
  return normalized === 'green' ||
    normalized === 'yellow' ||
    normalized === 'orange' ||
    normalized === 'red'
    ? normalized
    : null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\[\s*\.\.\.\s*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeHttpsUrl(value: unknown): string | null {
  const url = text(value, 2048);
  return /^https:\/\//i.test(url) ? url : null;
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json, application/rss+xml, application/xml, text/xml',
        'user-agent': 'SismoConnect/1.0 (emergency information aggregator)',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function gdacsReports(payload: unknown): SituationReport[] {
  const features = asArray(record(payload).features);
  const reports: SituationReport[] = [];

  for (const feature of features) {
    const item = record(feature);
    const properties = record(item.properties);
    const geometry = record(item.geometry);
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const urls = record(properties.url);
    const affected = asArray(properties.affectedcountries).map(record);
    const publishedAt = millis(properties.fromdate);
    const url = safeHttpsUrl(urls.report);
    const eventId = text(properties.eventid, 40);
    const episodeId = text(properties.episodeid, 40);
    const title = text(properties.name) || text(properties.description) || 'Evento sísmico';
    const countryName = text(properties.country) || null;
    const countryCode = text(affected[0]?.iso2, 2).toUpperCase() || null;

    if (!url || !eventId || !publishedAt) continue;

    reports.push({
      id: `gdacs-${eventId}-${episodeId || '0'}`,
      title,
      summary:
        stripHtml(text(properties.htmldescription, 1200)) ||
        stripHtml(text(properties.description, 1200)),
      url,
      source: 'GDACS',
      sourceLabel: 'GDACS · Comisión Europea',
      kind: text(properties.eventtype).toUpperCase() === 'TS' ? 'tsunami' : 'earthquake',
      countryCode,
      countryName,
      latitude: optionalNumber(coordinates[1]),
      longitude: optionalNumber(coordinates[0]),
      magnitude: optionalNumber(record(properties.severitydata).severity),
      alertLevel: alertLevel(properties.alertlevel),
      publishedAt,
      updatedAt: millis(properties.datemodified) || publishedAt,
    });
  }

  return reports;
}

function reliefWebReports(payload: string): SituationReport[] {
  const parsed = parser.parse(payload) as Record<string, unknown>;
  const channel = record(record(parsed.rss).channel);
  const reports: SituationReport[] = [];

  for (const raw of asArray(channel.item)) {
    const item = record(raw);
    const title = text(item.title, 240);
    const summaryHtml = text(item.description, 8000);
    const summary = stripHtml(summaryHtml);
    const url = safeHttpsUrl(text(item.link, 2048)) ?? safeHttpsUrl(text(item.guid, 2048));
    const publishedAt = millis(text(item.pubDate, 80));
    const categories = asArray(item.category).map((value) => text(value, 120));
    const searchable = `${title} ${summary} ${categories.join(' ')}`;

    if (!url || !publishedAt) continue;
    if (!/\b(earthquake|tsunami|sismo|terremoto|seismic)\b/i.test(searchable) &&
        !/Glide:\s*(EQ|TS)/i.test(searchable)) {
      continue;
    }

    const countryMatch = summary.match(/Affected countr(?:y|ies):\s*([^.;]+)/i);
    const magnitudeMatch = summary.match(/\bmagnitude\s+(\d+(?:\.\d+)?)/i);
    const kind = /\btsunami\b/i.test(searchable) ? 'tsunami' : 'earthquake';

    reports.push({
      id: `reliefweb-${url.split('/').filter(Boolean).pop() ?? title}`,
      title,
      summary: summary.slice(0, 900),
      url,
      source: 'ReliefWeb',
      sourceLabel: 'ReliefWeb · OCHA',
      kind,
      countryCode: null,
      countryName: countryMatch?.[1]?.trim() || categories[0] || null,
      latitude: null,
      longitude: null,
      magnitude: magnitudeMatch ? Number(magnitudeMatch[1]) : null,
      alertLevel: null,
      publishedAt,
      updatedAt: publishedAt,
    });
  }

  return reports;
}

async function fetchGdacs(): Promise<SituationReport[]> {
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `${GDACS_URL}?eventlist=EQ&fromdate=${from}&todate=${to}&alertlevel=red;orange`;
  return gdacsReports(JSON.parse(await fetchText(url)));
}

async function fetchReliefWeb(): Promise<SituationReport[]> {
  return reliefWebReports(await fetchText(RELIEFWEB_URL));
}

function dedupe(reports: SituationReport[]): SituationReport[] {
  const seen = new Set<string>();
  return reports
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .filter((report) => {
      const day = new Date(report.publishedAt).toISOString().slice(0, 10);
      const key = `${report.countryName ?? ''}|${report.title.toLowerCase()}|${day}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
}

export const getSituationReports = onCall(
  { ...CALL_OPTIONS, timeoutSeconds: 30 },
  async () => {
    const ref = db().doc(CACHE_DOC);
    const snapshot = await ref.get();
    const cached = snapshot.exists ? snapshot.data() ?? {} : {};
    const cachedReports = Array.isArray(cached.reports)
      ? (cached.reports as SituationReport[])
      : [];
    const fetchedAt = typeof cached.fetchedAt === 'number' ? cached.fetchedAt : 0;

    if (cachedReports.length > 0 && Date.now() - fetchedAt < CACHE_TTL_MS) {
      return {
        reports: cachedReports,
        fetchedAt,
        stale: false,
        sources: cached.sources ?? { gdacs: 'ok', reliefweb: 'ok' },
      };
    }

    const [gdacsResult, reliefResult] = await Promise.allSettled([
      fetchGdacs(),
      fetchReliefWeb(),
    ]);
    const gdacs = gdacsResult.status === 'fulfilled' ? gdacsResult.value : [];
    const relief = reliefResult.status === 'fulfilled' ? reliefResult.value : [];
    const sources: Record<'gdacs' | 'reliefweb', SourceStatus> = {
      gdacs: gdacsResult.status === 'fulfilled' ? 'ok' : 'error',
      reliefweb: reliefResult.status === 'fulfilled' ? 'ok' : 'error',
    };
    const reports = dedupe([...gdacs, ...relief]);

    if (reports.length === 0) {
      if (cachedReports.length > 0) {
        return {
          reports: cachedReports,
          fetchedAt,
          stale: true,
          sources,
        };
      }
      throw new HttpsError(
        'unavailable',
        'Las fuentes oficiales no respondieron. Intenta de nuevo en unos minutos.'
      );
    }

    const now = Date.now();
    await ref.set({ reports, fetchedAt: now, sources });
    return { reports, fetchedAt: now, stale: false, sources };
  }
);
