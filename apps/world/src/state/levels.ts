export type LevelConfig = {
  label: string;
  gridResolution: number;
  verticalExaggeration: number;
  horizontalScale: number;
  playerScale: number;
  // Babylon's camera far-clip defaults to 10000 units — fine for level 1's
  // true ~5.7km world, but level 2's world is scaled up past that.
  farClip: number;
  cameraMode: 'player' | 'orbit';
  // FlightController's own default (30 m/s) is tuned for level 1's true
  // ~5.7km world — at level 2's 7x-bigger world, the same speed covers a
  // proportionally smaller fraction of the map, so it's scaled up by the
  // same horizontalScale to keep fly-mode traversal feeling comparable.
  flightSpeed: number;
};

// Three ways of looking at the same data:
// - Level 1: Y-only exaggeration. Distorts real slope angles (steeper than
//   reality), so the player is shrunk to compensate and still feel
//   proportionate against the now-much-steeper terrain.
// - Level 2: uniform X/Y/Z scale. True slope angles preserved (nothing
//   gets steeper than reality) — the world is just bigger, which by
//   itself makes an unscaled player relatively smaller/slower.
// - Level 3: the original Phase 3/4 validation view — true scale, no
//   player at all, just a free orbit camera over the whole model.
export const LEVELS: Record<string, LevelConfig> = {
  '1': {
    label: 'Level 1: exaggerated relief, shrunk player',
    gridResolution: 700,
    verticalExaggeration: 10,
    horizontalScale: 1,
    playerScale: 0.1,
    farClip: 10000,
    cameraMode: 'player',
    flightSpeed: 30,
  },
  // gridResolution bumped to partially offset horizontalScale stretching
  // each mesh quad ~7x wider once rendered (700 alone would make ~57m
  // quads — coarse enough up close to visibly diverge from getHeightAt's
  // precise DEM sampling; 1000 brings that down to ~40m, still coarser
  // than level 1 but less extreme). farClip raised well past the ~40km
  // rendered world diagonal so distant terrain doesn't just vanish.
  '2': {
    label: 'Level 2: uniform 7x world scale',
    gridResolution: 1000,
    verticalExaggeration: 7,
    horizontalScale: 7,
    playerScale: 1,
    farClip: 60000,
    cameraMode: 'player',
    flightSpeed: 210,
  },
  '3': {
    label: 'Level 3: true scale, orbit view',
    gridResolution: 700,
    verticalExaggeration: 1,
    horizontalScale: 1,
    playerScale: 1,
    farClip: 10000,
    cameraMode: 'orbit',
    flightSpeed: 30,
  },
};

export function currentLevelKey(): string {
  const key = new URLSearchParams(location.search).get('level') ?? '1';
  return key in LEVELS ? key : '1';
}
