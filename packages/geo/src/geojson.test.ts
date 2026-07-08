import { describe, expect, it } from 'vitest';
import { parseGeoJsonTrails } from './geojson';

describe('parseGeoJsonTrails', () => {
  it('parses a LineString feature, swapping [lon, lat] into {lat, lon} and carrying tags through', () => {
    const geojson = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { name: 'Crest Trail', highway: 'footway', 'osmc:symbol': 'blue:blue:blue_bar' },
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [-74.2815606, 40.7458338],
              [-74.2818162, 40.7460236],
            ] as [number, number][],
          },
        },
      ],
    };

    const [polyline] = parseGeoJsonTrails(geojson);
    expect(polyline.source).toBe('osm');
    expect(polyline.points).toEqual([
      { lat: 40.7458338, lon: -74.2815606 },
      { lat: 40.7460236, lon: -74.2818162 },
    ]);
    expect(polyline.tags).toEqual({
      name: 'Crest Trail',
      highway: 'footway',
      'osmc:symbol': 'blue:blue:blue_bar',
    });
  });

  it('splits a MultiLineString feature into one polyline per line, sharing the same tags', () => {
    const geojson = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { name: 'Rahway Trail (White);River Trail' },
          geometry: {
            type: 'MultiLineString' as const,
            coordinates: [
              [[-74.30, 40.72], [-74.29, 40.73]],
              [[-74.28, 40.74], [-74.27, 40.75]],
            ] as [number, number][][],
          },
        },
      ],
    };

    const polylines = parseGeoJsonTrails(geojson);
    expect(polylines).toHaveLength(2);
    expect(polylines[0].points).toHaveLength(2);
    expect(polylines[1].points[0]).toEqual({ lat: 40.74, lon: -74.28 });
    expect(polylines[0].tags).toEqual(polylines[1].tags);
  });

  it('skips features with null geometry and omits tags when there are no string properties', () => {
    const geojson = {
      type: 'FeatureCollection' as const,
      features: [
        { type: 'Feature' as const, properties: null, geometry: null },
        {
          type: 'Feature' as const,
          properties: { tracktype: 1 },
          geometry: { type: 'LineString' as const, coordinates: [[-74, 40], [-74.1, 40.1]] as [number, number][] },
        },
      ],
    };

    const polylines = parseGeoJsonTrails(geojson);
    expect(polylines).toHaveLength(1);
    expect(polylines[0].tags).toBeUndefined();
  });
});
