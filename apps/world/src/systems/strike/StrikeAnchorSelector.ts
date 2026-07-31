import { Vector3 } from '@babylonjs/core';
import type { LocationEntry } from '../../world/LocationProps';

export interface StrikeAnchor {
  id: string;
  position: Vector3;
  patrolDroneRef: string;
  losProbeOffset: Vector3;
  eligible: boolean;
  weight: number;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededUnit(seed: number, salt: string): number {
  let value = (seed ^ hashString(salt)) >>> 0;
  value += 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export function buildStrikeAnchors(
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  getHeightAt: (x: number, z: number) => number,
): StrikeAnchor[] {
  const anchors: StrikeAnchor[] = [];
  const ids = new Set<string>();
  for (const location of locations) {
    if (!location.strikeAnchors) continue;
    const origin = toRenderXZ(location.latLong[0], location.latLong[1]);
    for (const definition of location.strikeAnchors) {
      if (ids.has(definition.id)) throw new Error(`Duplicate strike anchor id "${definition.id}".`);
      ids.add(definition.id);
      const x = origin.x + definition.local[0] * horizontalScale;
      const z = origin.z + definition.local[1] * horizontalScale;
      anchors.push({
        id: definition.id,
        position: new Vector3(x, getHeightAt(x, z), z),
        patrolDroneRef: definition.patrolDroneRef,
        losProbeOffset: new Vector3(...definition.losProbeOffset),
        eligible: definition.eligible,
        weight: Math.max(0, definition.weight ?? 1),
      });
    }
  }
  return anchors;
}

export function selectStrikeAnchor(
  anchors: StrikeAnchor[],
  runSeed: number,
  restoredAnchorId?: string,
): StrikeAnchor {
  const eligible = anchors.filter((anchor) => anchor.eligible && anchor.weight > 0);
  if (eligible.length === 0) throw new Error('At least one eligible strike anchor is required.');
  const restored = eligible.find((anchor) => anchor.id === restoredAnchorId);
  if (restored) return restored;
  const totalWeight = eligible.reduce((sum, anchor) => sum + anchor.weight, 0);
  let cursor = seededUnit(runSeed, 'strike-anchor') * totalWeight;
  for (const anchor of eligible) {
    cursor -= anchor.weight;
    if (cursor <= 0) return anchor;
  }
  return eligible[eligible.length - 1];
}
