import { describe, expect, it } from 'vitest';
import { parseGpxTrack } from './gpx';

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MapMyRun">
  <trk>
    <name>3.85mi Hike</name>
    <trkseg>
      <trkpt lat="40.73601898" lon="-74.30496933">
        <ele>112.4</ele>
        <time>2026-07-06T14:00:00Z</time>
      </trkpt>
      <trkpt lat="40.73650000" lon="-74.30400000">
        <ele>115.1</ele>
      </trkpt>
      <trkpt lat="40.73700000" lon="-74.30300000"/>
    </trkseg>
  </trk>
</gpx>`;

describe('parseGpxTrack', () => {
  it('extracts trackpoints in document order with lat/lon/elevation', () => {
    const [track] = parseGpxTrack(SAMPLE_GPX);
    expect(track.source).toBe('gpx');
    expect(track.points).toEqual([
      { lat: 40.73601898, lon: -74.30496933, elevation: 112.4 },
      { lat: 40.7365, lon: -74.304, elevation: 115.1 },
      { lat: 40.737, lon: -74.303 },
    ]);
  });

  it('carries the track name through as a tag', () => {
    const [track] = parseGpxTrack(SAMPLE_GPX);
    expect(track.tags).toEqual({ name: '3.85mi Hike' });
  });

  it('returns an empty array for a GPX file with no trackpoints', () => {
    const empty = `<gpx version="1.1"><trk><name>Empty</name><trkseg></trkseg></trk></gpx>`;
    expect(parseGpxTrack(empty)).toEqual([]);
  });
});
