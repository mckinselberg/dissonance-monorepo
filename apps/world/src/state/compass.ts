import { bearingBetween, distanceBetween, type CompassReading } from '@dissonance/navigation';

// T28's physical-compass HUD slice (docs/design/world/RURAL-INFRASTRUCTURE.md)
// — first pass wires the previously-unused @dissonance/navigation package
// into a live readout, not the full diegetic pickup/interference item.
//
// Deliberately real (unscaled) meters, not render-space units: bearingBetween
// is scale-invariant (atan2 of a uniformly-scaled dx/dz is the same angle),
// but distanceBetween is not — at level 1's verticalExaggeration (10x) a
// render-space 3D distance would wildly overstate range to any landmark at a
// different elevation. Y is fixed at 0 for both points (a compass reads
// horizontal bearing/range, not the vertical component), and X/Z come in
// already divided by hScale — same "real (unscaled) coordinates" convention
// BulkForestSystem/TrailsideForestSystem already use internally.
const NEARBY_LANDMARK_MAX_DISTANCE_METERS = 2000;
const NEARBY_LANDMARK_MAX_COUNT = 5;

export type CompassLandmarkCandidate = {
  name: string;
  realX: number;
  realZ: number;
};

export function deriveCompassReading(
  playerRealX: number,
  playerRealZ: number,
  playerHeadingRadians: number,
  landmarks: CompassLandmarkCandidate[],
): CompassReading {
  const player = { x: playerRealX, y: 0, z: playerRealZ };
  const bearingDegrees = (((playerHeadingRadians * 180) / Math.PI) % 360 + 360) % 360;
  const nearbyLandmarks = landmarks
    .map((landmark) => {
      const position = { x: landmark.realX, y: 0, z: landmark.realZ };
      return {
        name: landmark.name,
        bearingDegrees: bearingBetween(player, position),
        distanceMeters: distanceBetween(player, position),
      };
    })
    .filter((landmark) => landmark.distanceMeters <= NEARBY_LANDMARK_MAX_DISTANCE_METERS)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, NEARBY_LANDMARK_MAX_COUNT);
  return { bearingDegrees, nearbyLandmarks };
}

const CARDINAL_DIRECTIONS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

export function cardinalDirection(bearingDegrees: number): string {
  const index = Math.round(bearingDegrees / 22.5) % CARDINAL_DIRECTIONS.length;
  return CARDINAL_DIRECTIONS[index];
}
