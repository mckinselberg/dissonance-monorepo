import { describe, expect, it } from 'vitest';
import { graticuleLines } from './graticule';
import { utmToLatLon } from './projection';

// Real smr-heightmap.json bbox (see apps/trail-viewer/public/data/smr-heightmap.json).
const SMR_BBOX = { minX: 557054.6808128278, minZ: 4507812.4582184944, maxX: 562726.6367121894, maxZ: 4512144.015870524 };

describe('graticuleLines', () => {
  it('produces lat/lon values snapped to multiples of the interval', () => {
    const interval = 0.001;
    const lines = graticuleLines(SMR_BBOX, interval, 4);

    const latLines = lines.filter((l) => l.axis === 'lat');
    const lonLines = lines.filter((l) => l.axis === 'lon');
    expect(latLines.length).toBeGreaterThan(0);
    expect(lonLines.length).toBeGreaterThan(0);

    for (const line of lines) {
      const multiple = line.value / interval;
      expect(multiple).toBeCloseTo(Math.round(multiple), 6);
    }
  });

  it('covers the bounding box corners (values fall within the reprojected lat/lon extent)', () => {
    const interval = 0.001;
    const corners = [
      utmToLatLon({ x: SMR_BBOX.minX, y: SMR_BBOX.minZ }),
      utmToLatLon({ x: SMR_BBOX.maxX, y: SMR_BBOX.minZ }),
      utmToLatLon({ x: SMR_BBOX.minX, y: SMR_BBOX.maxZ }),
      utmToLatLon({ x: SMR_BBOX.maxX, y: SMR_BBOX.maxZ }),
    ];
    const minLat = Math.min(...corners.map((c) => c.lat));
    const maxLat = Math.max(...corners.map((c) => c.lat));
    const minLon = Math.min(...corners.map((c) => c.lon));
    const maxLon = Math.max(...corners.map((c) => c.lon));

    const lines = graticuleLines(SMR_BBOX, interval, 4);
    for (const line of lines.filter((l) => l.axis === 'lat')) {
      expect(line.value).toBeGreaterThanOrEqual(minLat);
      expect(line.value).toBeLessThanOrEqual(maxLat);
    }
    for (const line of lines.filter((l) => l.axis === 'lon')) {
      expect(line.value).toBeGreaterThanOrEqual(minLon);
      expect(line.value).toBeLessThanOrEqual(maxLon);
    }
  });

  it('samples each line at the requested point count, holding the line axis constant', () => {
    const lines = graticuleLines(SMR_BBOX, 0.002, 8);
    for (const line of lines) {
      expect(line.points).toHaveLength(8);
      if (line.axis === 'lat') {
        expect(line.points.every((p) => p.lat === line.value)).toBe(true);
        // Longitude should vary across the sampled points (not a degenerate line).
        expect(new Set(line.points.map((p) => p.lon)).size).toBeGreaterThan(1);
      } else {
        expect(line.points.every((p) => p.lon === line.value)).toBe(true);
        expect(new Set(line.points.map((p) => p.lat)).size).toBeGreaterThan(1);
      }
    }
  });

  it('returns no lines when the bbox is narrower than one interval and straddles no multiple', () => {
    // A tiny box (~11m) picked to sit strictly between two 0.1-degree
    // multiples (~11km apart at this latitude), so no grid line crosses it.
    const tinyBbox = { minX: 560000.01, minZ: 4510000.01, maxX: 560000.02, maxZ: 4510000.02 };
    const lines = graticuleLines(tinyBbox, 0.1, 4);
    expect(lines).toEqual([]);
  });

  it('falls back to the start point when samples = 1', () => {
    const lines = graticuleLines(SMR_BBOX, 0.001, 1);
    for (const line of lines) {
      expect(line.points).toHaveLength(1);
    }
  });
});
