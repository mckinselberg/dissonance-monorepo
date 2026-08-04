// Shared flat-XZ (render-space meters) polyline math — cumulative distance,
// point-at-arbitrary-distance, and fixed-spacing sampling. Extracted from
// UtilityCorridors.ts's private samplePolylineAtSpacing once a second real
// consumer (vehicle/RoadNetwork.ts's continuous point-at-distance queries)
// needed the same shape, per CLAUDE.md's "reuse before extracting" rule.
// ui/RouteReplay.tsx independently reimplements the same cumulative-
// distance/interpolate shape over haversine lat/lon distances for an
// unrelated dev scrubbing tool — deliberately left alone here (different
// metric, different feature, noted not fixed).

export type PlanarPoint = { x: number; z: number };

export type PolylineSample = { x: number; z: number; headingRadians: number };

export function buildCumulativeDistances(points: readonly PlanarPoint[]): number[] {
  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  }
  return cumulative;
}

function headingAtSegment(points: readonly PlanarPoint[], segIndex: number): number {
  return Math.atan2(
    points[segIndex + 1].x - points[segIndex].x,
    points[segIndex + 1].z - points[segIndex].z,
  );
}

// Interpolated position + tangent heading at an arbitrary distance along the
// path (clamped to [0, total length]). Stateless — rescans from the start
// each call, which is fine for the short authored polylines this repo uses
// (a handful to a few dozen vertices); callers walking incrementally forward
// every frame (e.g. a vehicle driving) don't need a persisted segment index
// at this scale.
export function pointAtDistance(
  points: readonly PlanarPoint[],
  cumulative: readonly number[],
  distance: number,
): PolylineSample {
  if (points.length === 0) return { x: 0, z: 0, headingRadians: 0 };
  if (points.length === 1) return { x: points[0].x, z: points[0].z, headingRadians: 0 };
  const total = cumulative[cumulative.length - 1];
  const clamped = Math.max(0, Math.min(distance, total));
  let segIndex = 0;
  while (segIndex < cumulative.length - 2 && cumulative[segIndex + 1] < clamped) segIndex++;
  const segLength = cumulative[segIndex + 1] - cumulative[segIndex];
  const t = segLength === 0 ? 0 : (clamped - cumulative[segIndex]) / segLength;
  return {
    x: points[segIndex].x + (points[segIndex + 1].x - points[segIndex].x) * t,
    z: points[segIndex].z + (points[segIndex + 1].z - points[segIndex].z) * t,
    headingRadians: headingAtSegment(points, segIndex),
  };
}

// Walks the path at a fixed step distance, returning evenly spaced points
// plus each one's tangent heading. Always includes the path's exact final
// vertex so the last span isn't stretched past the authored path's end.
export function sampleAtSpacing(
  points: readonly PlanarPoint[],
  cumulative: readonly number[],
  spacing: number,
): PolylineSample[] {
  const total = cumulative[cumulative.length - 1] ?? 0;
  if (total === 0) return [];
  const samples: PolylineSample[] = [];
  for (let dist = 0; dist <= total; dist += spacing) {
    samples.push(pointAtDistance(points, cumulative, dist));
  }
  const last = points[points.length - 1];
  const lastSample = samples[samples.length - 1];
  if (!lastSample || Math.hypot(lastSample.x - last.x, lastSample.z - last.z) > 0.01) {
    samples.push(pointAtDistance(points, cumulative, total));
  }
  return samples;
}
