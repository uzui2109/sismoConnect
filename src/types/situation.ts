export type SituationReportSource = 'GDACS' | 'ReliefWeb';

export type SituationReport = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: SituationReportSource;
  sourceLabel: string;
  kind: 'earthquake' | 'tsunami' | 'disaster';
  countryCode: string | null;
  countryName: string | null;
  latitude: number | null;
  longitude: number | null;
  magnitude: number | null;
  alertLevel: 'green' | 'yellow' | 'orange' | 'red' | null;
  publishedAt: number;
  updatedAt: number;
};

export type SituationFeed = {
  reports: SituationReport[];
  fetchedAt: number;
  stale: boolean;
  sources: {
    gdacs: 'ok' | 'error';
    reliefweb: 'ok' | 'error';
  };
};
