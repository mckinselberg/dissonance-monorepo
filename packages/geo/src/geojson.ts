import type { GeoPolyline } from './types';

// Minimal local shape — just enough of the GeoJSON spec to read Overpass's
// `out geom` export, without pulling in a full @types/geojson dependency.
type GeoJsonGeometry =
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'MultiLineString'; coordinates: [number, number][][] }
  | { type: string; coordinates: unknown };

type GeoJsonFeature = {
  type: 'Feature';
  properties: Record<string, unknown> | null;
  geometry: GeoJsonGeometry | null;
};

type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
};

function tagsFromProperties(properties: Record<string, unknown> | null): Record<string, string> | undefined {
  if (!properties) return undefined;
  const tags: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'string') tags[key] = value;
  }
  return Object.keys(tags).length > 0 ? tags : undefined;
}

// GeoJSON coordinates are [lon, lat] — the opposite order from the
// {lat, lon} shape the rest of this package uses, so the swap happens
// exactly once, here.
function lineStringToPoints(coordinates: [number, number][]): GeoPolyline['points'] {
  return coordinates.map(([lon, lat, elevation]: number[]) =>
    elevation === undefined ? { lat, lon } : { lat, lon, elevation },
  );
}

export function parseGeoJsonTrails(geojson: GeoJsonFeatureCollection): GeoPolyline[] {
  const polylines: GeoPolyline[] = [];

  for (const feature of geojson.features) {
    if (!feature.geometry) continue;
    const tags = tagsFromProperties(feature.properties);

    if (feature.geometry.type === 'LineString') {
      polylines.push({
        points: lineStringToPoints(feature.geometry.coordinates as [number, number][]),
        source: 'osm',
        tags,
      });
    } else if (feature.geometry.type === 'MultiLineString') {
      for (const line of feature.geometry.coordinates as [number, number][][]) {
        polylines.push({ points: lineStringToPoints(line), source: 'osm', tags });
      }
    }
  }

  return polylines;
}
