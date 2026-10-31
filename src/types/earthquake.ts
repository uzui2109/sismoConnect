/** One earthquake as returned by the USGS GeoJSON summary feeds. */
export type Quake = {
  /** GeoJSON feature id, e.g. `us7000abcd`. Stable across revisions. */
  id: string;
  /** Magnitude, or null when USGS has not computed one yet. */
  magnitude: number | null;
  /** Free-text location, e.g. "50km NNE of Tsukuba, Japan". */
  place: string;
  /** Epoch milliseconds of origin. */
  time: number;
  /** Epoch milliseconds of the last revision. */
  updated: number;
  /** Hypocentre depth in km (GeoJSON coordinates[2]). */
  depthKm: number;
  longitude: number;
  latitude: number;
  /** Public USGS detail page for this event. */
  url: string;
  /** 1 when the event is flagged as tsunami-relevant. */
  tsunami: 0 | 1;
  /** Number of "felt" reports, or null. */
  felt: number | null;
  /** PAGER alert level. */
  alert: 'green' | 'yellow' | 'orange' | 'red' | null;
  /** USGS review status. */
  status: string;
  /** Magnitude scale used, e.g. `mb`, `ml`, `mww`. */
  magnitudeType: string | null;
  /** Country resolved offline from the epicentre coordinates. */
  countryCode: string | null;
  countryName: string | null;
  /** Only present when the source publishes a reliable duration. */
  durationSeconds: number | null;
  durationSource: string | null;
  /** Maximum instrumental intensity, when USGS has computed it. */
  mmi: number | null;
  /** Community decimal intensity, when reported. */
  cdi: number | null;
  /** USGS significance score. */
  significance: number | null;
  /** Contributing seismic network, e.g. `us`, `ak`. */
  network: string | null;
  /** Number of stations used in the solution. */
  stationCount: number | null;
};

/** Magnitude range bucket used by the filters and the map legend. */
export type MagnitudeFilter = 'all' | 'light' | 'moderate' | 'strong' | 'major';

export type FeedWindow = 'all_day' | 'all_week';

export type RegionAggregate = {
  /** Region name parsed out of the USGS `place` string. */
  name: string;
  count: number;
  /** Sum of magnitudes, used to rank how active a region is. */
  energy: number;
  maxMagnitude: number | null;
  latitude: number;
  longitude: number;
};