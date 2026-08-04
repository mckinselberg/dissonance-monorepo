import type { PrecipitationMode, WeatherMode } from '@dissonance/shared-types';
import type { ActiveMode } from './movement';

// Everything a level-1/2 session might want to survive a reload — position,
// look direction, which traversal mode was active, and the live-tuned
// scale/water/camera-height/atmosphere sliders. Saved per level key, since
// position and scale are only meaningful within a given level's own
// coordinate space. orbitX/Y/Z/Alpha/Beta/Radius are the level-3 (orbit)
// equivalent — orbit's own position field above doesn't apply to it (an
// ArcRotateCamera's "position" is a derived value of target+radius/alpha/
// beta), but orbit sessions don't autosave any of this the way player mode
// does; these fields only ever get written by the Copy/Load View mechanism
// below (see THREADS.md's "View snapshot / Copy-Paste Views" thread).
export type SavedSettings = {
  environmentProfileId?: string;
  x?: number;
  y?: number;
  z?: number;
  rotationX?: number;
  rotationY?: number;
  activeMode?: ActiveMode;
  hScale?: number;
  vExag?: number;
  waterLevel?: number;
  cameraHeightOffset?: number;
  timeOfDay?: number;
  fogDensity?: number;
  fogColor?: string;
  overcast?: boolean;
  weatherMode?: WeatherMode;
  precipitationMode?: PrecipitationMode;
  starCount?: number;
  cloudCount?: number;
  cloudColor?: string;
  cloudOpacity?: number;
  treeRegionRadius?: number;
  trailsideHScale?: number;
  trailsideVScale?: number;
  trailsideCount?: number;
  bulkForestHScale?: number;
  bulkForestVScale?: number;
  bulkForestCount?: number;
  bulkForestRadius?: number;
  waterColor?: string;
  starColor?: string;
  skyDayColor?: string;
  skyNightColor?: string;
  terrainLowColor?: string;
  terrainHighColor?: string;
  sunTint?: string;
  windowTintColor?: string;
  windowGlow?: number;
  vegetationCullRadius?: number;
  // Collected Lineglass part ids (state/lineglass.ts) — drives which of the
  // grid/GPX/OSM geo-reference toggles start unlocked on reload. A list of
  // stable ids, not a count, so a specific part is never re-awarded twice.
  lineglassPartIds?: string[];
  hudVisible?: boolean;
  worldBounded?: boolean;
  // Toggles section checkboxes (state/visibility.ts). grid/gpx/osm are
  // combined with Lineglass unlock state on restore — see the createLineglassSignals
  // call site — so a saved `true` only takes effect once that layer is unlocked.
  terrainVisible?: boolean;
  osmVisible?: boolean;
  gpxVisible?: boolean;
  waterVisible?: boolean;
  cloudsVisible?: boolean;
  gridVisible?: boolean;
  mountainsVisible?: boolean;
  powerLinesVisible?: boolean;
  mechDogVisible?: boolean;
  masterMuted?: boolean;
  windVolume?: number;
  footstepMuted?: boolean;
  breathMuted?: boolean;
  orbitTargetX?: number;
  orbitTargetY?: number;
  orbitTargetZ?: number;
  orbitAlpha?: number;
  orbitBeta?: number;
  orbitRadius?: number;
};

function settingsStorageKey(levelKey: string): string {
  return `trail-viewer:settings:${levelKey}`;
}

export const DEFAULT_SEED_VIEW_NAME = 'dissonance boulevard concept art 4 nighttime';
export const ENVIRONMENT_SEED_SESSION_KEY = 'dissonance:environment-seed:v1';

export function seedSettingsFromView(options: {
  levelKey: string;
  views: ReadonlyArray<SavedSettings & { level: string; name?: string }>;
  viewName?: string;
  overwrite?: boolean;
  local?: Pick<Storage, 'getItem' | 'setItem'>;
  session?: Pick<Storage, 'setItem'>;
}): boolean {
  const local = options.local ?? localStorage;
  const key = settingsStorageKey(options.levelKey);
  if (!options.overwrite && local.getItem(key) !== null) return false;
  const viewName = options.viewName ?? DEFAULT_SEED_VIEW_NAME;
  const view = options.views.find((candidate) => candidate.level === options.levelKey && candidate.name === viewName);
  if (!view) return false;
  const { level: _level, name: _name, ...settings } = view;
  local.setItem(key, JSON.stringify(settings));
  (options.session ?? sessionStorage).setItem(ENVIRONMENT_SEED_SESSION_KEY, JSON.stringify({
    levelKey: options.levelKey,
    viewName,
    environmentProfileId: settings.environmentProfileId ?? null,
  }));
  return true;
}

export function loadSavedSettings(levelKey: string): SavedSettings {
  const raw = localStorage.getItem(settingsStorageKey(levelKey));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {}; // ignore malformed/corrupt localStorage value, fall back to defaults
  }
}

export function saveSettings(levelKey: string, settings: SavedSettings): void {
  localStorage.setItem(settingsStorageKey(levelKey), JSON.stringify(settings));
}
