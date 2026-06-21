export type {
  WorldPosition,
  MapPlacard,
  CompassReading,
  NearbyLandmark,
  TrailRoute,
} from '@dta/shared-types';

export function bearingBetween(
  from: import('@dta/shared-types').WorldPosition,
  to: import('@dta/shared-types').WorldPosition,
): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const radians = Math.atan2(dx, dz);
  return ((radians * 180) / Math.PI + 360) % 360;
}

export function distanceBetween(
  a: import('@dta/shared-types').WorldPosition,
  b: import('@dta/shared-types').WorldPosition,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function createMapPlacard(
  id: string,
  position: import('@dta/shared-types').WorldPosition,
  routeIdsShown: string[],
  landmarkHints: string[],
): import('@dta/shared-types').MapPlacard {
  return {
    id,
    position,
    routeIdsShown,
    landmarkHints,
    discoveredByPlayer: false,
    grokkedByPlayer: false,
  };
}
