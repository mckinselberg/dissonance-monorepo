import {
  Color3,
  Matrix,
  MeshBuilder,
  Quaternion,
  Vector3,
} from '@babylonjs/core';
import type { Mesh, Scene, ShadowGenerator } from '@babylonjs/core';
import type { Collider } from '@dissonance/world';
import type { LocationEntry } from './LocationProps';
import { buildUtilityPole } from './LocationProps';

// T26/T27's real starting point (see THREADS.md's 2026-07-27 T7-substrate
// resolution) — placement stays the runtime/data-hybrid pattern every other
// module in this file's neighborhood already uses (locations.json + a
// procedural template mesh, thin-instanced), not the offline manifest the
// parked scatter-placement-prompt-v1.md proposed. Its pole-height/sag/span
// numbers are kept here as plain geometry defaults, not an endorsement of
// that doc's architecture.
const POLE_HEIGHT_M = 10;
const WIRE_ATTACH_HEIGHT_M = POLE_HEIGHT_M - 0.6; // just under the crossarm
const SAG_RATIO = 0.035; // fraction of span length the wire dips at midspan
const SAMPLES_PER_SPAN = 8;
// Vertical stagger between wires on the same pole (distribution-line style)
// — sidesteps needing the crossarm's own left/right orientation to line up
// with a lateral wire offset; a small height difference reads as "more than
// one wire" without that extra correctness risk.
const WIRE_HEIGHT_STAGGER_M = 0.4;
// Flat, unlit — matches the OSM-trail/grid-overlay line convention already
// used in main.tsx's buildPolylineMeshes/buildGridMeshes ("silhouette-first"
// per T13's own visual-identity note), not a real conductor shader.
const WIRE_COLOR = new Color3(0.05, 0.05, 0.05);
// Pole base diameter (buildUtilityPole) is 0.35, plus a little buffer —
// same reasoning as LocationProps' PROP_COLLISION_RADII, a coarse "don't
// walk through the pole" circle, not a tight hitbox. Scales with
// horizontalScale, same as the pole mesh's own XZ scale.
const POLE_COLLISION_RADIUS_M = 0.4;

export interface UtilityCorridorsHandle {
  // One collider per placed pole — see LocationPropsHandle's matching field
  // for why this travels with the handle instead of being re-derived.
  colliders: Collider[];
  setVisible(visible: boolean): void;
  dispose(): void;
}

export type WorldBoundsRender = { minX: number; maxX: number; minZ: number; maxZ: number };

type CorridorPole = { x: number; z: number; headingRadians: number };

// How far (t >= 0) a ray from `origin` in `direction` can travel before
// exiting `bounds` — the standard slab method. `origin` is assumed to
// already be inside bounds (true here: it's always a point on a corridor
// anchored at a real location), so exactly one of each axis's two crossings
// is ahead of the ray; Math.max picks that one, and the ray's true exit is
// whichever axis it reaches first (Math.min of the two).
function rayExitDistance(
  origin: { x: number; z: number },
  direction: { x: number; z: number },
  bounds: WorldBoundsRender,
): number {
  let tExit = Infinity;
  if (direction.x !== 0) {
    const tx1 = (bounds.minX - origin.x) / direction.x;
    const tx2 = (bounds.maxX - origin.x) / direction.x;
    tExit = Math.min(tExit, Math.max(tx1, tx2));
  }
  if (direction.z !== 0) {
    const tz1 = (bounds.minZ - origin.z) / direction.z;
    const tz2 = (bounds.maxZ - origin.z) / direction.z;
    tExit = Math.min(tExit, Math.max(tz1, tz2));
  }
  return Number.isFinite(tExit) ? Math.max(0, tExit) : 0;
}

// Pushes a render-space path's open ends outward along their own existing
// direction until each hits the loaded DEM's real bounding box — "the edge
// of the world" clampToWorldBounds/MountainRing already treat as the map's
// hard edge (main.tsx). Interior points are untouched; a 2-point straight
// corridor becomes a straight line spanning the whole map, exactly as
// authored, just longer.
function extendPathToWorldBounds(
  path: Array<{ x: number; z: number }>,
  bounds: WorldBoundsRender,
): Array<{ x: number; z: number }> {
  if (path.length < 2) return path;
  const extended = [...path];

  const first = path[0];
  const second = path[1];
  const backDir = { x: first.x - second.x, z: first.z - second.z };
  const backDist = rayExitDistance(first, backDir, bounds);
  extended[0] = { x: first.x + backDir.x * backDist, z: first.z + backDir.z * backDist };

  const last = path[path.length - 1];
  const secondLast = path[path.length - 2];
  const forwardDir = { x: last.x - secondLast.x, z: last.z - secondLast.z };
  const forwardDist = rayExitDistance(last, forwardDir, bounds);
  extended[extended.length - 1] = { x: last.x + forwardDir.x * forwardDist, z: last.z + forwardDir.z * forwardDist };

  return extended;
}

// Walks an arbitrary polyline (in render-space meters) at a fixed step
// distance, returning evenly spaced points plus each one's tangent heading.
// Always includes the path's exact final vertex so the last span isn't
// stretched past the authored corridor's end.
function samplePolylineAtSpacing(path: Array<{ x: number; z: number }>, spacing: number): CorridorPole[] {
  const cumulative: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
  }
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return [];

  const headingAt = (segIndex: number) => Math.atan2(
    path[segIndex + 1].x - path[segIndex].x,
    path[segIndex + 1].z - path[segIndex].z,
  );

  const points: CorridorPole[] = [];
  let segIndex = 0;
  for (let dist = 0; dist <= total; dist += spacing) {
    while (segIndex < cumulative.length - 2 && cumulative[segIndex + 1] < dist) segIndex++;
    const segLength = cumulative[segIndex + 1] - cumulative[segIndex];
    const t = segLength === 0 ? 0 : (dist - cumulative[segIndex]) / segLength;
    points.push({
      x: path[segIndex].x + (path[segIndex + 1].x - path[segIndex].x) * t,
      z: path[segIndex].z + (path[segIndex + 1].z - path[segIndex].z) * t,
      headingRadians: headingAt(segIndex),
    });
  }
  const last = path[path.length - 1];
  const lastPoint = points[points.length - 1];
  if (!lastPoint || Math.hypot(lastPoint.x - last.x, lastPoint.z - last.z) > 0.01) {
    points.push({ x: last.x, z: last.z, headingRadians: headingAt(cumulative.length - 2) });
  }
  return points;
}

// Reads locations.json entries' `corridor` field and builds one thin-
// instanced pole row + a sagging multi-wire line mesh per corridor — same
// "template mesh, thin-instance the placements" split as CompositeLocations'
// glTF loader and LocationProps' prop scatter, just for a spline rather than
// a compound grid or a single jittered point.
export function loadUtilityCorridors(
  scene: Scene,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  verticalExaggeration: number,
  getHeightAt: (x: number, z: number) => number,
  worldBoundsRender?: WorldBoundsRender,
  shadowGenerator?: ShadowGenerator,
): UtilityCorridorsHandle {
  const poleMatrices: Matrix[] = [];
  const wireMeshes: Mesh[] = [];
  const colliders: Collider[] = [];

  for (const location of locations) {
    if (!location.corridor) continue;
    const anchor = toRenderXZ(location.latLong[0], location.latLong[1]);
    let renderPath = location.corridor.path.map(([localX, localZ]) => ({
      x: anchor.x + localX * horizontalScale,
      z: anchor.z + localZ * horizontalScale,
    }));
    if (location.corridor.extendToWorldBounds) {
      if (worldBoundsRender) {
        renderPath = extendPathToWorldBounds(renderPath, worldBoundsRender);
      } else {
        console.warn(`[UtilityCorridors] "${location.name}" wants extendToWorldBounds but no world bounds were passed in`);
      }
    }

    const poles = samplePolylineAtSpacing(renderPath, location.corridor.poleSpacingMeters * horizontalScale);
    if (poles.length < 2) {
      console.warn(`[UtilityCorridors] "${location.name}" corridor too short to place any poles`);
      continue;
    }

    const groundYs = poles.map((pole) => getHeightAt(pole.x, pole.z));
    for (let i = 0; i < poles.length; i++) {
      poleMatrices.push(Matrix.Compose(
        new Vector3(horizontalScale, verticalExaggeration, horizontalScale),
        Quaternion.FromEulerAngles(0, poles[i].headingRadians, 0),
        new Vector3(poles[i].x, groundYs[i], poles[i].z),
      ));
      colliders.push({ x: poles[i].x, z: poles[i].z, radius: POLE_COLLISION_RADIUS_M * horizontalScale });
    }

    const lines: Vector3[][] = [];
    for (let w = 0; w < location.corridor.wireCount; w++) {
      const heightOffset = location.corridor.wireCount === 1
        ? 0
        : (w - (location.corridor.wireCount - 1) / 2) * WIRE_HEIGHT_STAGGER_M * verticalExaggeration;
      const wirePoints: Vector3[] = [];
      for (let i = 0; i < poles.length; i++) {
        const attachY = groundYs[i] + WIRE_ATTACH_HEIGHT_M * verticalExaggeration + heightOffset;
        if (i === 0) {
          wirePoints.push(new Vector3(poles[i].x, attachY, poles[i].z));
          continue;
        }
        const prevAttachY = groundYs[i - 1] + WIRE_ATTACH_HEIGHT_M * verticalExaggeration + heightOffset;
        const spanLength = Math.hypot(poles[i].x - poles[i - 1].x, poles[i].z - poles[i - 1].z);
        const sag = SAG_RATIO * spanLength;
        for (let s = 1; s <= SAMPLES_PER_SPAN; s++) {
          const t = s / SAMPLES_PER_SPAN;
          const x = poles[i - 1].x + (poles[i].x - poles[i - 1].x) * t;
          const z = poles[i - 1].z + (poles[i].z - poles[i - 1].z) * t;
          const straightY = prevAttachY + (attachY - prevAttachY) * t;
          const y = straightY - sag * 4 * t * (1 - t);
          wirePoints.push(new Vector3(x, y, z));
        }
      }
      lines.push(wirePoints);
    }
    const wireMesh = MeshBuilder.CreateLineSystem(`utilityWires_${location.name}`, { lines }, scene);
    wireMesh.color = WIRE_COLOR;
    wireMeshes.push(wireMesh);
    console.info(`[UtilityCorridors] placed ${poles.length} poles / ${location.corridor.wireCount} wires for "${location.name}"`);
  }

  const poleTemplate = buildUtilityPole(scene);
  poleTemplate.receiveShadows = true;
  if (poleMatrices.length > 0) {
    poleTemplate.thinInstanceAdd(poleMatrices, true);
    shadowGenerator?.addShadowCaster(poleTemplate);
  } else {
    poleTemplate.setEnabled(false);
  }

  return {
    colliders,
    setVisible(visible: boolean) {
      poleTemplate.setEnabled(visible && poleMatrices.length > 0);
      wireMeshes.forEach((mesh) => mesh.setEnabled(visible));
    },
    dispose() {
      // false/true: skip the (already-null) parent-hierarchy walk, do
      // dispose the material — same leak-on-rebuild fix CompositeLocations'
      // own dispose() applies, for the same reason (this rebuilds on every
      // hScale/vExag slider commit).
      poleTemplate.dispose(false, true);
      wireMeshes.forEach((mesh) => mesh.dispose());
    },
  };
}
