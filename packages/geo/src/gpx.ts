import type { GeoPolyline } from './types';

// A hand-rolled extractor rather than a general XML parser — GPX trkpt
// structure is simple and fixed enough (lat/lon attributes, optional <ele>
// child) that a full XML dependency isn't justified for this one shape.
const TRKPT_RE = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
const ATTR_RE = (name: string) => new RegExp(`${name}="(-?[\\d.]+)"`);
const ELE_RE = /<ele>(-?[\d.]+)<\/ele>/;
const NAME_RE = /<trk>[\s\S]*?<name>([^<]*)<\/name>/;

export function parseGpxTrack(gpxXml: string): GeoPolyline[] {
  const points: GeoPolyline['points'] = [];

  for (const match of gpxXml.matchAll(TRKPT_RE)) {
    const attrs = match[1];
    const body = match[2] ?? '';
    const lat = attrs.match(ATTR_RE('lat'))?.[1];
    const lon = attrs.match(ATTR_RE('lon'))?.[1];
    if (lat === undefined || lon === undefined) continue;

    const ele = body.match(ELE_RE)?.[1];
    points.push(
      ele === undefined
        ? { lat: parseFloat(lat), lon: parseFloat(lon) }
        : { lat: parseFloat(lat), lon: parseFloat(lon), elevation: parseFloat(ele) },
    );
  }

  if (points.length === 0) return [];

  const name = gpxXml.match(NAME_RE)?.[1];
  return [{ points, source: 'gpx', tags: name ? { name } : undefined }];
}
