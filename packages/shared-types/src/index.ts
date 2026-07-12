// ── Core game types ──────────────────────────────────────────────────────────

export type ExperienceMode = 'radio' | 'ps1' | 'ps2' | 'ps3';
export type DepartureTime = 'afternoon' | 'dusk' | 'night';
export type WeatherMode = 'clear' | 'windy';
export type PursuerState = 'far' | 'near' | 'close' | 'caught';

export interface ExperienceProfile {
  mode: ExperienceMode;
  treeCount: number;
  fogDensity: number;
  drawDistance: number;
  ambientIntensity: number;
  visualNoise: number;
  audioLoFiAmount: number;
  fogColor: { r: number; g: number; b: number };
  skyColor: { r: number; g: number; b: number };
  // Selects between the original tuned look ('genesis') and the overcast
  // forest color/lighting pass from docs/dissonance-forest-color-handoff.md
  // ('overcast'). Only consulted by modes that have an overcast variant
  // wired up (currently ps3 only) — omit or set 'genesis' to keep a mode's
  // original values untouched.
  lookVariant?: 'genesis' | 'overcast';
}

export interface RunProfile {
  departureTime: DepartureTime;
  startingLightLevel: number;
  daylightDecayRate: number;
  startingFogDensity: number;
  runDurationSeconds: number;
}

export interface BodyState {
  breathLoad: number;  // 0..1
  adrenaline: number;  // 0..1
}

export interface PursuerModel {
  distance: number;
  state: PursuerState;
  aggression: number;  // 0..1
  isHidden: boolean;
}

export interface GameConfig {
  experienceMode: ExperienceMode;
  departureTime: DepartureTime;
  trailId?: string;
}

// ── World / Navigation types ──────────────────────────────────────────────────

export type WorldPosition = { x: number; y: number; z: number };

export type MapPlacard = {
  id: string;
  position: WorldPosition;
  routeIdsShown: string[];
  landmarkHints: string[];
  discoveredByPlayer: boolean;
  grokkedByPlayer: boolean;
};

export type CompassReading = {
  bearingDegrees: number;
  nearbyLandmarks: NearbyLandmark[];
};

export type NearbyLandmark = {
  name: string;
  bearingDegrees: number;
  distanceMeters: number;
};

export type TrailRoute = {
  id: string;
  name: string;
  waypoints: WorldPosition[];
  totalLengthMeters: number;
};

// ── Persistence types ─────────────────────────────────────────────────────────

export type PlayerSaveState = {
  position: WorldPosition;
  distanceTraveledMeters: number;
  sessionCount: number;
  savedAt: number;
  discoveredPlacardIds: string[];
  knownRouteIds: string[];
};

// ── Input types ───────────────────────────────────────────────────────────────

export type MovementInputSource = 'keyboard' | 'controller' | 'treadmill' | 'simulation';

export type MovementInputState = {
  source: MovementInputSource;
  forwardAmount: number;   // -1..1
  turnAmount: number;      // -1..1
  runAmount: number;       // 0..1
  pauseRequested: boolean;
};
