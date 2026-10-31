export type Coordinate = [number, number];

export type Ring = Coordinate[];

export type Polygon = Ring[];

export type MultiPolygon = Polygon[];

export type Country = {
  code: string;
  name: string;
  continent: string | null;
  bbox: [number, number, number, number];
  polygons: MultiPolygon;
};
