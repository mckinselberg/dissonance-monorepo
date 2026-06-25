export type {
  WorldPosition,
  MapPlacard,
  CompassReading,
  NearbyLandmark,
  TrailRoute,
} from '@dissonance/shared-types';

export function bearingBetween(
  from: import('@dissonance/shared-types').WorldPosition,
  to: import('@dissonance/shared-types').WorldPosition,
): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const radians = Math.atan2(dx, dz);
  return ((radians * 180) / Math.PI + 360) % 360;
}

export function distanceBetween(
  a: import('@dissonance/shared-types').WorldPosition,
  b: import('@dissonance/shared-types').WorldPosition,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function createMapPlacard(
  id: string,
  position: import('@dissonance/shared-types').WorldPosition,
  routeIdsShown: string[],
  landmarkHints: string[],
): import('@dissonance/shared-types').MapPlacard {
  return {
    id,
    position,
    routeIdsShown,
    landmarkHints,
    discoveredByPlayer: false,
    grokkedByPlayer: false,
  };
}
