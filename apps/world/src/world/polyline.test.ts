import { describe, expect, it } from 'vitest';
import { buildCumulativeDistances, pointAtDistance, sampleAtSpacing } from './polyline';

describe('buildCumulativeDistances', () => {
  it('accumulates straight-line segment lengths', () => {
    const points = [{ x: 0, z: 0 }, { x: 3, z: 4 }, { x: 3, z: 14 }];
    expect(buildCumulativeDistances(points)).toEqual([0, 5, 15]);
  });

  it('returns [0] for a single point', () => {
    expect(buildCumulativeDistances([{ x: 5, z: 5 }])).toEqual([0]);
  });
});

describe('pointAtDistance', () => {
  const points = [{ x: 0, z: 0 }, { x: 0, z: 10 }, { x: 10, z: 10 }];
  const cumulative = buildCumulativeDistances(points);

  it('interpolates mid-segment', () => {
    const sample = pointAtDistance(points, cumulative, 5);
    expect(sample.x).toBeCloseTo(0);
    expect(sample.z).toBeCloseTo(5);
  });

  it('crosses into the second segment past the first vertex', () => {
    const sample = pointAtDistance(points, cumulative, 15);
    expect(sample.x).toBeCloseTo(5);
    expect(sample.z).toBeCloseTo(10);
  });

  it('clamps below zero to the start', () => {
    const sample = pointAtDistance(points, cumulative, -5);
    expect(sample.x).toBeCloseTo(0);
    expect(sample.z).toBeCloseTo(0);
  });

  it('clamps past the end to the last vertex', () => {
    const sample = pointAtDistance(points, cumulative, 999);
    expect(sample.x).toBeCloseTo(10);
    expect(sample.z).toBeCloseTo(10);
  });

  it('reports tangent heading per segment (atan2(dx, dz))', () => {
    // First segment travels +Z only: heading 0.
    expect(pointAtDistance(points, cumulative, 5).headingRadians).toBeCloseTo(0);
    // Second segment travels +X only: heading pi/2.
    expect(pointAtDistance(points, cumulative, 15).headingRadians).toBeCloseTo(Math.PI / 2);
  });

  it('handles a single-point path without throwing', () => {
    const single = [{ x: 2, z: 3 }];
    const sample = pointAtDistance(single, buildCumulativeDistances(single), 10);
    expect(sample).toEqual({ x: 2, z: 3, headingRadians: 0 });
  });
});

describe('sampleAtSpacing', () => {
  it('returns [] for a zero-length path', () => {
    const points = [{ x: 1, z: 1 }, { x: 1, z: 1 }];
    expect(sampleAtSpacing(points, buildCumulativeDistances(points), 5)).toEqual([]);
  });

  it('always includes the exact final vertex', () => {
    const points = [{ x: 0, z: 0 }, { x: 0, z: 22 }];
    const cumulative = buildCumulativeDistances(points);
    const samples = sampleAtSpacing(points, cumulative, 5);
    const last = samples[samples.length - 1];
    expect(last.x).toBeCloseTo(0);
    expect(last.z).toBeCloseTo(22);
  });

  it('spaces samples evenly along a straight run', () => {
    const points = [{ x: 0, z: 0 }, { x: 0, z: 20 }];
    const samples = sampleAtSpacing(points, buildCumulativeDistances(points), 5);
    expect(samples.map((s) => s.z)).toEqual([0, 5, 10, 15, 20]);
  });
});
