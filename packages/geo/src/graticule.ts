import type { LatLon, UtmBoundingBox } from './projection';
import { utmToLatLon } from './projection';

export type GraticuleAxis = 'lat' | 'lon';

// One graticule line: a constant-lat or constant-lon line, sampled through
// the projection (see graticuleLines) rather than drawn as a two-point
// straight line.
export type GraticuleLine = {
  axis: GraticuleAxis;
  value: number; // the snapped lat (axis: 'lat') or lon (axis: 'lon') this line runs along
  points: LatLon[];
};

// Snaps to the smallest set of multiples of `interval` covering [min, max],
// e.g. snappedRange(40.7431, 40.7582, 0.001) -> [40.744, 40.745, ..., 40.758].
// Returns [] if the range is narrower than one interval and straddles no
// multiple of it.
function snappedRange(min: number, max: number, interval: number): number[] {
  const values: number[] = [];
  const start = Math.ceil(min / interval) * interval;
  for (let v = start; v <= max + 1e-9; v += interval) {
    // Guards against float drift (e.g. 40.744000000000005) so downstream
    // consumers (manifest keys, on-screen labels) see clean round values.
    values.push(Math.round(v / interval) * interval);
  }
  return values;
}

// Generates a WGS84 graticule (lat/lon grid) covering a UTM bounding box.
// The box's corners are reprojected to lat/lon and their axis-aligned
// bounding rectangle is used as the coverage area — a safe superset of the
// (possibly slightly rotated, at this projection) true UTM box, which just
// means graticule lines may run a hair past the terrain's actual edge.
//
// Each line is sampled at `samples` points across the perpendicular extent
// rather than drawn corner-to-corner, so callers that project through a
// nonlinear transform (UTM) get a curve, not a chord — visible kinks there
// indicate a projection bug, which is the whole point of this overlay.
export function graticuleLines(bbox: UtmBoundingBox, intervalDeg: number, samples: number): GraticuleLine[] {
  const corners: LatLon[] = [
    utmToLatLon({ x: bbox.minX, y: bbox.minZ }),
    utmToLatLon({ x: bbox.maxX, y: bbox.minZ }),
    utmToLatLon({ x: bbox.minX, y: bbox.maxZ }),
    utmToLatLon({ x: bbox.maxX, y: bbox.maxZ }),
  ];
  const lats = corners.map((c) => c.lat);
  const lons = corners.map((c) => c.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const sampleAcross = (from: number, to: number, i: number): number =>
    samples === 1 ? from : from + (to - from) * (i / (samples - 1));

  const lines: GraticuleLine[] = [];
  for (const lat of snappedRange(minLat, maxLat, intervalDeg)) {
    const points: LatLon[] = [];
    for (let i = 0; i < samples; i++) {
      points.push({ lat, lon: sampleAcross(minLon, maxLon, i) });
    }
    lines.push({ axis: 'lat', value: lat, points });
  }
  for (const lon of snappedRange(minLon, maxLon, intervalDeg)) {
    const points: LatLon[] = [];
    for (let i = 0; i < samples; i++) {
      points.push({ lat: sampleAcross(minLat, maxLat, i), lon });
    }
    lines.push({ axis: 'lon', value: lon, points });
  }
  return lines;
}
