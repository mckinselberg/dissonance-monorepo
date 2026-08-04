import type { Vector3 } from '@babylonjs/core';

// Shared by BulkForestSystem and TrailsideForestSystem's thin-instance
// distance culling — see either system's own comment for why thin instances
// need this at all (Babylon frustum-culls on one aggregate bounding box per
// mesh, never per instance).
export const CULL_UPDATE_INTERVAL_SECONDS = 0.25;

export function filterWithinRadius(positions: Vector3[], camera: Vector3 | null, radius: number): Vector3[] {
  if (!camera || !Number.isFinite(radius)) return positions;
  const radiusSq = radius * radius;
  return positions.filter((p) => {
    const dx = p.x - camera.x;
    const dz = p.z - camera.z;
    return dx * dx + dz * dz <= radiusSq;
  });
}

// Reference-equality, not deep-equality: `positions` is always a fresh
// Array.prototype.filter() output over a cached, stable source array (only
// replaced wholesale on reposition/rebuild), so the same visible set always
// produces the same Vector3 references in the same order when nothing has
// moved in or out of range between two throttle ticks. Callers use this to
// skip the setPlacements re-upload (and the shadow-map refresh that comes
// with it) when culling had nothing new to apply.
export function sameVisibleSet(a: Vector3[], b: Vector3[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
