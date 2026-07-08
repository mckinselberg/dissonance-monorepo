import { describe, expect, it } from 'vitest';
import {
  latLonToUtm,
  utmToLatLon,
  utmToWorld,
  worldToUtm,
  latLonToWorld,
  originFromBoundingBox,
} from './projection';

describe('latLonToUtm', () => {
  it('maps the central meridian / equator to the projection false easting/northing exactly', () => {
    // Definitional for any Transverse Mercator UTM zone: a point on the
    // zone's central meridian (-75° for zone 18) projects to x = false
    // easting (500000) before any northing offset; on the equator,
    // northern-hemisphere UTM has false northing = 0.
    const { x, y } = latLonToUtm({ lat: 0, lon: -75 });
    expect(x).toBeCloseTo(500000, 3);
    expect(y).toBeCloseTo(0, 3);
  });

  it('matches GDAL/PROJ output for the smr-heightmap.png corner (cross-checked against this repo\'s own QGIS export)', () => {
    // lat/lon is smr-heightmap.png's own upper-left corner, as reported by
    // `gdalinfo` ("Upper Left ... 74d19'26.63"W, 40d45'29.80"N") while
    // building apps/trail-viewer's data pipeline; x/y is that same corner's
    // UTM 18N origin, also from gdalinfo. Cross-checks our proj4-based
    // conversion against an independent PROJ implementation on real project
    // data, not just an internal round-trip. Tolerance is loosened slightly
    // (~0.5m) because the DMS source values are gdalinfo's own display
    // rounding (0.01 arcsecond ~ 0.3m), not full float precision.
    const { x, y } = latLonToUtm({ lat: 40.7582778, lon: -74.3240639 });
    expect(x).toBeCloseTo(557054.680812827893533, 0);
    expect(y).toBeCloseTo(4512144.015870523639023, 0);
  });

  it('round-trips through utmToLatLon', () => {
    const original = { lat: 40.7431565, lon: -74.2926482 };
    const utm = latLonToUtm(original);
    const roundTripped = utmToLatLon(utm);
    expect(roundTripped.lat).toBeCloseTo(original.lat, 8);
    expect(roundTripped.lon).toBeCloseTo(original.lon, 8);
  });
});

describe('world-space origin offset', () => {
  it('centers the bounding box at world (0, 0)', () => {
    const bbox = { minX: 557054.68, minZ: 4507812.46, maxX: 562726.64, maxZ: 4512144.02 };
    const origin = originFromBoundingBox(bbox);

    const worldAtMin = utmToWorld({ x: bbox.minX, y: bbox.minZ }, origin);
    const worldAtMax = utmToWorld({ x: bbox.maxX, y: bbox.maxZ }, origin);

    expect(worldAtMin.x).toBeCloseTo(-(bbox.maxX - bbox.minX) / 2, 6);
    expect(worldAtMin.z).toBeCloseTo(-(bbox.maxZ - bbox.minZ) / 2, 6);
    expect(worldAtMax.x).toBeCloseTo((bbox.maxX - bbox.minX) / 2, 6);
    expect(worldAtMax.z).toBeCloseTo((bbox.maxZ - bbox.minZ) / 2, 6);
  });

  it('worldToUtm inverts utmToWorld', () => {
    const origin = { x: 559890.66, y: 4509978.24 };
    const utm = { x: 560000, y: 4510500 };
    const world = utmToWorld(utm, origin);
    const roundTripped = worldToUtm(world, origin);
    expect(roundTripped.x).toBeCloseTo(utm.x, 9);
    expect(roundTripped.y).toBeCloseTo(utm.y, 9);
  });

  it('latLonToWorld composes projection and origin offset consistently', () => {
    const origin = originFromBoundingBox({
      minX: 557054.68, minZ: 4507812.46, maxX: 562726.64, maxZ: 4512144.02,
    });
    const latLon = { lat: 40.7431565, lon: -74.2926482 };
    const viaHelper = latLonToWorld(latLon, origin);
    const viaSteps = utmToWorld(latLonToUtm(latLon), origin);
    expect(viaHelper).toEqual(viaSteps);
  });
});
