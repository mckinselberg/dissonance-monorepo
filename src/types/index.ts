export type ExperienceMode = 'radio' | 'ps1';
export type DepartureTime = 'afternoon' | 'dusk';
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
}

export interface RunProfile {
  departureTime: DepartureTime;
  startingLightLevel: number;
  daylightDecayRate: number;
  startingFogDensity: number;
  runDurationSeconds: number;
}

export interface BodyState {
  breathLoad: number;   // 0..1
  adrenaline: number;  // 0..1
}

export interface PursuerModel {
  distance: number;
  state: PursuerState;
  aggression: number;  // 0..1
  isHidden: boolean;   // pursuer has lost line of sight
}

export interface GameConfig {
  experienceMode: ExperienceMode;
  departureTime: DepartureTime;
}
