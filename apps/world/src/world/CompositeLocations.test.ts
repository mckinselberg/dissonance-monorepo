import { readFileSync } from 'node:fs';
import { latLonToUtm } from '@dissonance/geo';
import { describe, expect, it } from 'vitest';
import type { LocationEntry } from './LocationProps';
import {
  compositeGradeHeightAt,
  compositeObstacleClearanceAt,
} from './CompositeLocations';

describe('compositeGradeHeightAt', () => {
  it('uses the authored compound plane inside its grade pad only', () => {
    const locations: LocationEntry[] = [{
      id: 'graded-fixture',
      name: 'graded fixture',
      latLong: [0, 0],
      compound: {
        cellMeters: 1,
        placements: [{ asset: 'street-2lane', grid: [0, 0] }],
      },
    }];
    const heightAt = (x: number, z: number) => 10 + x * x * 0.5 + z * z * 0.25;

    expect(heightAt(1, 1)).toBe(10.75);
    expect(compositeGradeHeightAt(
      locations, () => ({ x: 0, z: 0 }), 2, heightAt, 1, 1,
    )).toBeCloseTo(10);
    expect(compositeGradeHeightAt(
      locations, () => ({ x: 0, z: 0 }), 2, heightAt, 7, 0,
    )).toBeNull();
  });

  it('keeps the authored Boulevard terminal clear of compound obstacles', () => {
    const authoredLocations = JSON.parse(readFileSync(
      new URL('../../public/data/locations.json', import.meta.url),
      'utf8',
    )) as LocationEntry[];
    const boulevard = authoredLocations.find((location) => location.id === 'dissonance-boulevard-2');
    const terminal = authoredLocations.find(
      (location) => location.id === 'public-sanitation-terminal-01',
    );
    if (!boulevard || !terminal) throw new Error('Expected authored Boulevard terminal fixtures.');
    const origin = latLonToUtm({ lat: boulevard.latLong[0], lon: boulevard.latLong[1] });
    const toRenderXZ = (lat: number, lon: number) => {
      const projected = latLonToUtm({ lat, lon });
      return { x: projected.x - origin.x, z: projected.y - origin.y };
    };
    const position = toRenderXZ(terminal.latLong[0], terminal.latLong[1]);

    expect(compositeObstacleClearanceAt(
      authoredLocations, toRenderXZ, 1, position.x, position.z,
    )).toBeGreaterThan(0.55);
  });
});
