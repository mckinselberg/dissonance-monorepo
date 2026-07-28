import {
  Engine,
  Scene,
  ArcRotateCamera,
  FreeCamera,
  HemisphericLight,
  Vector3,
  Color3,
  Color4,
  Mesh,
  MeshBuilder,
  DefaultRenderingPipeline,
} from '@babylonjs/core';
import { GameLoop } from '@dissonance/engine';
import {
  HeightmapTerrain,
  WaterPlane,
  defaultWaterLevel,
  DriftingClouds,
  Sun,
  sunHeightForHour,
  StarField,
  ForestFire,
  WeatherSystem,
  MountainRing,
  type ITerrain,
  type TreePoint,
  type FoliageSwaySource,
} from '@dissonance/world';
import { PlayerController, FlightController, DriveController } from '@dissonance/player';
import { AmbientAudio, AudioEngine, HeartbeatAudio, TrailPlayerAudio } from '@dissonance/audio';
import type { WeatherMode } from '@dissonance/shared-types';
import { preventAccidentalClose } from '@dissonance/utils';
import {
  decodeHeightmapPng,
  HeightmapSampler,
  originFromBoundingBox,
  latLonToWorld,
  worldToLatLon,
  parseGeoJsonTrails,
  parseGpxTrack,
  graticuleLines,
  type HeightmapContract,
  type GeoPolyline,
  type UtmCoordinate,
  type GraticuleLine,
} from '@dissonance/geo';
import { render } from 'preact';
import type { JSX } from 'preact';
import { signal, effect } from '@preact/signals';
import { createAtmosphereSignals } from './state/atmosphere';
import { createMovementSignals, type ActiveMode } from './state/movement';
import { createScaleTuningSignals } from './state/scaleTuning';
import { createTrailsideScatterSignals } from './state/trailsideScatter';
import { createBulkForestScatterSignals } from './state/bulkForestScatter';
import { scatterLocationProps, type LocationEntry } from './world/LocationProps';
import { loadCompositeLocations } from './world/CompositeLocations';
import { loadUtilityCorridors } from './world/UtilityCorridors';
import { createVisibilitySignals } from './state/visibility';
import { createAudioSignals } from './state/audio';
import { AtmosphereRow, SliderRow } from './ui/AtmosphereRow';
import { VisibilityToggles, ToggleLabel } from './ui/VisibilityToggles';
import { MovementRow } from './ui/MovementRow';
import { ScaleTuningRow } from './ui/ScaleTuningRow';
import { ViewToolsRow, type SavedView } from './ui/ViewToolsRow';
import { GotoRow } from './ui/GotoRow';
import { RouteRecorder, type RouteSample } from './ui/RouteRecorder';
import { RouteReplay, parseRouteDocument, type ReplayRoute } from './ui/RouteReplay';
import { Section } from './ui/Section';
import { AudioRow } from './ui/AudioRow';
import { loadHeroTreeInstances, type HeroTreeInstancesHandle } from './world/HeroTreeInstances';

const OSM_TRAIL_Y_LIFT = 0.5;
// Slightly higher than the OSM trails so the recorded track sits visibly on
// top of them instead of z-fighting where the two coincide.
const GPX_TRACK_Y_LIFT = 0.7;
const GPX_TRACK_COLOR = new Color3(1.0, 0.1, 0.1);

// Ported from dont-turn-around's MountainRing (@dissonance/world) to mask
// the DEM's rectangular edge — without it the terrain just stops and the
// void beyond reads as falling off the edge of a cube. DTA's ring is a
// fixed-size circle around a ~340-unit-radius world; this DEM is
// real-world-scale, rescalable (H-scale/V-exagg sliders), and rectangular,
// so the ring uses MountainRing's 'rectangle' shape hugging the DEM's own
// bbox (see mountainRingOptions below) instead of a circle — a circle here
// would either leave a large gap along the flat edges (if sized to clear
// the corners) or clip through the corners (if sized to hug the edges),
// since this bbox's aspect ratio isn't square. Rebuilt alongside the
// terrain in rebuildWorld whenever hScale/vExag change.
// Real (unscaled) meters the ring's base sits below the DEM's lowest point,
// so it never floats above the terrain it's meant to be a backdrop for.
const MOUNTAIN_BASE_MARGIN_M = 50;
// Dark blue-grey distant-silhouette tone — reuses DTA's ps3-mode color
// (its most naturalistic profile) rather than tying to the terrain/sky
// color pickers, which is more churn than this needs right now.
const MOUNTAIN_NEAR_COLOR = new Color3(0.06, 0.066, 0.095);

// Three-tier slope-blended ground material (see HeightmapTerrain's
// slopeTextures option) — flat/mid/steep, blended by DEM-derived slope,
// not external land-cover data (this dataset has none).
const TERRAIN_TEXTURES_BASE = `${import.meta.env.BASE_URL}textures/`;
const TERRAIN_SLOPE_TEXTURES = {
  flat: {
    diffuseUrl: `${TERRAIN_TEXTURES_BASE}forest-ground-04/forest_ground_04_diff_512.jpg`,
    normalUrl: `${TERRAIN_TEXTURES_BASE}forest-ground-04/forest_ground_04_nor_gl_512.png`,
  },
  mid: {
    diffuseUrl: `${TERRAIN_TEXTURES_BASE}rocky-terrain-02/rocky_terrain_02_diff_512.jpg`,
    normalUrl: `${TERRAIN_TEXTURES_BASE}rocky-terrain-02/rocky_terrain_02_nor_gl_512.png`,
  },
  steep: {
    diffuseUrl: `${TERRAIN_TEXTURES_BASE}marble-cliff-03/marble_cliff_03_diff_512.jpg`,
    normalUrl: `${TERRAIN_TEXTURES_BASE}marble-cliff-03/marble_cliff_03_nor_gl_512.png`,
  },
};

// Highest of the three drape lifts — the grid is a measurement layer that
// should read as sitting "above" both trail layers, not fighting either for
// z-order where they cross.
const GRID_Y_LIFT = 0.9;
// ~111m lat / ~84m lon at 40.7°N. Must match (or cleanly derive from) the
// placement-manifest cell interval once that lands in packages/geo.
const GRID_INTERVAL_DEG = 0.001;
// Sampled through the projection rather than drawn as 2-point lines — at
// SMR's scale the curvature is sub-visual, but sampling is itself the
// validation (a kinked/skewed line here would mean a projection bug).
const GRID_LINE_SAMPLES = 64;
const GRID_LINE_COLOR = new Color3(0.4, 0.75, 0.8);
const GRID_LINE_ALPHA = 0.35;

type LevelConfig = {
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
const LEVELS: Record<string, LevelConfig> = {
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

function currentLevelKey(): string {
  const key = new URLSearchParams(location.search).get('level') ?? '1';
  return key in LEVELS ? key : '1';
}

// Fly and Drive are unconditionally available in this POC — no unlock gate
// exists yet. Design intent for whatever game eventually grows out of this
// viewer: these read naturally as *fast travel skills the player unlocks*
// rather than default abilities, e.g. gated behind reaching a landmark or
// finding an item. Not built now — a real unlock system needs persistence
// (packages/persistence is still a stub) and a reason to gate progression
// at all, neither of which exists yet.
// (ActiveMode itself lives in state/movement.ts, alongside its signal.)

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
  hudVisible?: boolean;
  worldBounded?: boolean;
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

function loadSavedSettings(levelKey: string): SavedSettings {
  const raw = localStorage.getItem(settingsStorageKey(levelKey));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {}; // ignore malformed/corrupt localStorage value, fall back to defaults
  }
}

function saveSettings(levelKey: string, settings: SavedSettings): void {
  localStorage.setItem(settingsStorageKey(levelKey), JSON.stringify(settings));
}

// OSM's osmc:symbol format is "waycolor:symbolcolor:symboltext" (e.g.
// "blue:blue:blue_bar") — only the leading waycolor is used here, which is
// enough for a POC "does this roughly match the real blaze" visual check.
const BLAZE_COLORS: Record<string, Color3> = {
  blue: new Color3(0.25, 0.45, 1.0),
  red: new Color3(1.0, 0.25, 0.2),
  white: new Color3(1, 1, 1),
  yellow: new Color3(1.0, 0.9, 0.2),
  green: new Color3(0.25, 0.8, 0.3),
  orange: new Color3(1.0, 0.55, 0.1),
};
const NEUTRAL_TRAIL_COLOR = new Color3(0.8, 0.75, 0.6);

function blazeColorFromTags(tags?: Record<string, string>): Color3 {
  const symbol = tags?.['osmc:symbol'];
  const primary = symbol?.split(':')[0]?.toLowerCase();
  if (primary && BLAZE_COLORS[primary]) return BLAZE_COLORS[primary];
  return NEUTRAL_TRAIL_COLOR;
}

async function loadHeightmap(): Promise<{ contract: HeightmapContract; pngBytes: Uint8Array }> {
  const [contract, pngResponse] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/smr-heightmap.json`).then((r) => r.json()),
    fetch(`${import.meta.env.BASE_URL}data/smr-heightmap.png`),
  ]);
  const pngBytes = new Uint8Array(await pngResponse.arrayBuffer());
  return { contract, pngBytes };
}

async function loadTrails(): Promise<GeoPolyline[]> {
  const geojson = await fetch(`${import.meta.env.BASE_URL}data/smr-trails.geojson`).then((r) => r.json());
  return parseGeoJsonTrails(geojson);
}

async function loadGpxTrack(): Promise<GeoPolyline[]> {
  const gpxXml = await fetch(`${import.meta.env.BASE_URL}data/my-track.gpx`).then((r) => r.text());
  return parseGpxTrack(gpxXml);
}

// Curated, committed alternative to pasting Copy View's clipboard output by
// hand — see ViewToolsRow's own comment. Same shape Copy View produces,
// plus a human-readable "name". Edited directly by Dan; not written by the
// app. Lives in public/data/ (fetched at runtime) rather than a static
// import from docs/ — consistent with every other data file this app loads
// (heightmap, trails, gpx track), and means editing it doesn't require a
// rebuild to see reflected, just a page reload.
async function loadSavedViews(): Promise<SavedView[]> {
  return fetch(`${import.meta.env.BASE_URL}data/views.json`).then((r) => r.json());
}

// Landmark manifest (T21's proposed landmarks.geojson, in JSON-array form
// for now) — named real-world points, optionally tagged with which
// LocationProps prop types to thin-instance there. Grows by hand for now,
// same as views.json.
async function loadLocations(): Promise<LocationEntry[]> {
  return fetch(`${import.meta.env.BASE_URL}data/locations.json`).then((r) => r.json());
}

type RouteManifestEntry = { name: string; file: string };

async function loadReplayRoutes(): Promise<ReplayRoute[]> {
  const manifestResponse = await fetch(`${import.meta.env.BASE_URL}data/routes/index.json`);
  if (!manifestResponse.ok) throw new Error(`Could not load route index (${manifestResponse.status}).`);
  const manifest = await manifestResponse.json() as RouteManifestEntry[];
  return Promise.all(manifest.map(async ({ name, file }) => {
    const response = await fetch(`${import.meta.env.BASE_URL}data/routes/${encodeURIComponent(file)}`);
    if (!response.ok) throw new Error(`Could not load route "${file}" (${response.status}).`);
    const route = parseRouteDocument(await response.json(), file);
    return { ...route, id: file, name };
  }));
}

function buildPolylineMeshes(
  scene: Scene,
  polylines: GeoPolyline[],
  terrain: ITerrain,
  origin: UtmCoordinate,
  options: {
    namePrefix: string;
    yLift: number;
    horizontalScale: number;
    colorFor: (tags?: Record<string, string>) => Color3;
  },
): Mesh[] {
  const meshes: Mesh[] = [];
  polylines.forEach((polyline, i) => {
    if (polyline.points.length < 2) return;
    const path = polyline.points.map((p) => {
      // latLonToWorld returns real (unscaled) meters; scale to match the
      // terrain's rendered space before asking it for a height there.
      const real = latLonToWorld(p, origin);
      const renderX = real.x * options.horizontalScale;
      const renderZ = real.z * options.horizontalScale;
      const y = terrain.getHeightAt(renderX, renderZ) + options.yLift;
      return new Vector3(renderX, y, renderZ);
    });
    const lines = MeshBuilder.CreateLines(`${options.namePrefix}_${i}`, { points: path }, scene);
    lines.color = options.colorFor(polyline.tags);
    meshes.push(lines);
  });
  return meshes;
}

function setMeshesEnabled(meshes: Mesh[], enabled: boolean): void {
  meshes.forEach((m) => m.setEnabled(enabled));
}

// Coalesces rapid-fire calls (e.g. every 'input' tick while dragging a
// slider) into one trailing call after activity stops — used for the
// trailside scatter's H/V-scale + count sliders, which commit live on
// 'input' (so dragging previews) rather than waiting for 'change' (mouse
// release), but shouldn't rebuild the scatter on every single tick.
function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

// Same drape path as buildPolylineMeshes (project -> scale -> getHeightAt +
// lift), kept separate because every grid line shares one visual treatment
// and GraticuleLine has no tags/elevation metadata to branch on.
function buildGridMeshes(
  scene: Scene,
  lines: GraticuleLine[],
  terrain: ITerrain,
  origin: UtmCoordinate,
  horizontalScale: number,
): Mesh[] {
  return lines.map((line, i) => {
    const path = line.points.map((p) => {
      const real = latLonToWorld(p, origin);
      const renderX = real.x * horizontalScale;
      const renderZ = real.z * horizontalScale;
      const y = terrain.getHeightAt(renderX, renderZ) + GRID_Y_LIFT;
      return new Vector3(renderX, y, renderZ);
    });
    const mesh = MeshBuilder.CreateLines(`grid_${line.axis}_${i}`, { points: path }, scene);
    mesh.color = GRID_LINE_COLOR;
    mesh.alpha = GRID_LINE_ALPHA;
    return mesh;
  });
}

// Covers the black screen during initial load and during the several
// reload()/href navigations this app does on purpose (Load View,
// reset-position, the saved-views dropdown) — hidden once the scene is
// actually ready to render, right before each branch's gameLoop.start().
function hideLoadingOverlay(): void {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

async function main() {
  const removeAccidentalCloseGuard = preventAccidentalClose();

  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);

  const levelKey = currentLevelKey();
  const level = LEVELS[levelKey];
  const savedSettings = loadSavedSettings(levelKey);

  // Not persisted anywhere (no SavedSettings fields for these) — session-only,
  // same as before. Shared by both orbit and player mode.
  const visibility = createVisibilitySignals();

  // Atmosphere-row pilot (see docs/THREADS.md) — these 6 signals back the
  // Preact-rendered #atmosphere-root panel mounted further down.
  const atmosphere = createAtmosphereSignals({
    timeOfDay: savedSettings.timeOfDay ?? 12,
    fogDensity: savedSettings.fogDensity ?? 0,
    fogColor: savedSettings.fogColor ?? '#8ca6c7',
    overcast: savedSettings.overcast ?? false,
    starCount: savedSettings.starCount ?? 800,
    cloudCount: savedSettings.cloudCount ?? 16,
    cloudColor: savedSettings.cloudColor ?? '#e6e6eb',
    cloudOpacity: savedSettings.cloudOpacity ?? 0.75,
    waterColor: savedSettings.waterColor ?? '#0d2e3d',
    starColor: savedSettings.starColor ?? '#ffffff',
    skyDayColor: savedSettings.skyDayColor ?? '#8ca6c7',
    skyNightColor: savedSettings.skyNightColor ?? '#050814',
    terrainLowColor: savedSettings.terrainLowColor ?? '#241c12',
    terrainHighColor: savedSettings.terrainHighColor ?? '#8c8c85',
    sunTint: savedSettings.sunTint ?? '#ffffff',
    windowTintColor: savedSettings.windowTintColor ?? '#ffffff',
    windowGlow: savedSettings.windowGlow ?? 0,
  });

  // Ported from dont-turn-around (@dissonance/audio) — AmbientAudio and
  // HeartbeatAudio are already fully generic (no ExperienceProfile/DTA
  // coupling), reused as-is. TrailPlayerAudio is a decoupled sibling of
  // DTA's PlayerAudio: same breath-handling logic, but calls
  // AudioEngine.playTrailStep() (open dirt/gravel) instead of
  // playForestStep() for footsteps. All three construct with zero args
  // (matches DTA's own Game.ts constructor pattern) — real playback only
  // starts once the Enable Audio button fires a genuine user gesture
  // (browsers require this for AudioContext unlock; trail-viewer has no
  // menu/start-screen gesture to piggyback on the way DTA's "Begin" button
  // does, hence the dedicated button — see index.html).
  const audio = createAudioSignals({
    masterMuted: savedSettings.masterMuted ?? false,
    windVolume: savedSettings.windVolume ?? 0.7,
    footstepMuted: savedSettings.footstepMuted ?? false,
    breathMuted: savedSettings.breathMuted ?? false,
  });
  const ambientAudio = new AmbientAudio();
  const heartbeatAudio = new HeartbeatAudio();
  const trailPlayerAudio = new TrailPlayerAudio();
  AudioEngine.setMuted(audio.masterMuted.value);
  trailPlayerAudio.setFootstepMuted(audio.footstepMuted.value);
  trailPlayerAudio.setBreathMuted(audio.breathMuted.value);
  let audioStarted = false;

  const light = new HemisphericLight('light', new Vector3(0.3, 1, 0.2), scene);
  const sun = new Sun(scene, {
    hour: atmosphere.timeOfDay.value,
    castShadows: true,
    // Sun's optional flare sprites currently live on Babylon's asset CDN.
    // Leave the local sun disc enabled, but do not make runtime CDN requests.
    lensFlare: false,
    colorTint: Color3.FromHexString(atmosphere.sunTint.value),
  });
  // StarField's default radius (3000) assumed nothing else in the scene
  // would ever be farther than that from the camera — true for DTA's small
  // fixed-size world, false here once the mountain ring/terrain can sit tens
  // of thousands of units out at higher H-scale. A star numerically nearer
  // than the mountain silhouette in front of it wins the depth test and
  // punches through, so pin the dome just inside the camera's own far-clip
  // plane instead — nothing renders beyond maxZ anyway, so this guarantees
  // stars are always the farthest thing on screen, whatever hScale is set to.
  const STAR_RADIUS = level.farClip * 0.95;
  let stars = new StarField(scene, {
    count: atmosphere.starCount.value,
    color: Color3.FromHexString(atmosphere.starColor.value),
    radius: STAR_RADIUS,
  });
  effect(() => {
    stars.setColor(Color3.FromHexString(atmosphere.starColor.value));
  });
  effect(() => {
    sun.setColorTint(Color3.FromHexString(atmosphere.sunTint.value));
  });

  // Overcast dims both the sun and the ambient fill — a real overcast sky
  // is heavily diffused light (soft, flat, no strong directional shadow),
  // not just "clouds added on top" while the lighting stays sunny.
  const OVERCAST_DIMMING = 0.6;
  // Ambient fill dims at night too (Sun's own directional light already
  // does this internally) — a bright hemispheric fill at midnight would
  // fight the dark sky/sun color instead of reading as night. sun.setTimeOfDay
  // always resets light.intensity to an absolute value first, so the *=
  // below is safe to run more than once for the same hour/overcast pair —
  // it never compounds.
  const applyTimeOfDay = (hour: number) => {
    sun.setTimeOfDay(hour);
    const dayFactor = Math.max(0, sunHeightForHour(hour));
    const overcastFactor = atmosphere.overcast.value ? OVERCAST_DIMMING : 1;
    sun.light.intensity *= overcastFactor;
    light.intensity = (0.15 + dayFactor * 0.4) * overcastFactor;
    const skyNight = Color3.FromHexString(atmosphere.skyNightColor.value).toColor4(1);
    const skyDay = Color3.FromHexString(atmosphere.skyDayColor.value).toColor4(1);
    scene.clearColor = Color4.Lerp(skyNight, skyDay, dayFactor);
    stars.setNightFactor(1 - dayFactor);
    ambientAudio.setNightLevel(1 - dayFactor);
  };
  // Reads atmosphere.overcast.value too (inside applyTimeOfDay), so this
  // effect also re-runs on an overcast toggle — the overcast checkbox's own
  // commit handler below only needs to trigger rebuildClouds(), not repeat
  // this call itself.
  effect(() => applyTimeOfDay(atmosphere.timeOfDay.value));

  scene.fogMode = Scene.FOGMODE_EXP2;
  effect(() => {
    scene.fogDensity = atmosphere.fogDensity.value;
  });
  effect(() => {
    scene.fogColor = Color3.FromHexString(atmosphere.fogColor.value);
  });

  const { contract, pngBytes } = await loadHeightmap();
  // Mutable via signals — level 1 exposes live HUD sliders that rebuild the
  // terrain and trail/GPX overlays with new scale values (see the
  // scale-tuning section below). Every other read of "the current scale" in
  // this function goes through these signals, not level.* directly, so a
  // live rescale stays consistent everywhere. Exist for every level (not
  // just level 1) — only the slider UI itself is level-1-gated.
  const scaleTuning = createScaleTuningSignals({
    hScale: savedSettings.hScale ?? level.horizontalScale,
    vExag: savedSettings.vExag ?? level.verticalExaggeration,
    waterLevel: savedSettings.waterLevel ?? defaultWaterLevel(contract),
  });
  const origin = originFromBoundingBox(contract.bbox);
  const elevations = decodeHeightmapPng(pngBytes, contract);
  const sampler = new HeightmapSampler(elevations, contract, origin);
  // getHeightAt (used for player collision + trail draping) samples the
  // ORIGINAL fine-resolution DEM directly, but the rendered mesh only has
  // vertices every (width/gridResolution) meters and linearly interpolates
  // between them — so wherever real terrain curves between two mesh
  // vertices, the coarse rendered surface can drift from the true DEM
  // height there, and verticalExaggeration multiplies that drift right
  // along with the real relief. 700 (~= the DEM's own 733px width) keeps
  // one mesh quad roughly per DEM pixel, so there's almost no gap left
  // between vertices for the two to diverge across, however high the
  // exaggeration goes.
  let terrain = new HeightmapTerrain(scene, sampler, contract, origin, {
    gridResolution: level.gridResolution,
    verticalExaggeration: scaleTuning.vExag.value,
    horizontalScale: scaleTuning.hScale.value,
    lowElevationColor: Color3.FromHexString(atmosphere.terrainLowColor.value),
    highElevationColor: Color3.FromHexString(atmosphere.terrainHighColor.value),
    slopeTextures: TERRAIN_SLOPE_TEXTURES,
  });

  // Stand-in water: the DEM has no tagged lake/river geometry to trace (see
  // WaterPlane's own comment), so this is a flat plane at a configurable
  // elevation rather than a real water body traced from OSM data.
  const water = new WaterPlane(scene, contract, origin, {
    level: scaleTuning.waterLevel.value,
    verticalExaggeration: scaleTuning.vExag.value,
    horizontalScale: scaleTuning.hScale.value,
    color: Color3.FromHexString(atmosphere.waterColor.value),
    // WaterMaterial's historical default bump map is remote. The core water
    // surface remains usable without it and the viewer stays fully local.
    bumpTextureUrl: null,
  });
  water.addToRenderList(terrain.getMesh());
  effect(() => {
    water.setColor(Color3.FromHexString(atmosphere.waterColor.value));
  });

  // Scattered once in real (unscaled) world space, independent of hScale/
  // vExag, so a rescale re-renders the same forest instead of re-rolling
  // different tree positions. World space is centered on the bbox (see
  // originFromBoundingBox/utmToWorld — origin = bbox center, so real world
  // X/Z each span [-width/2, width/2]). Skips low-elevation ground near the
  // waterline: there's no land-use data in this dataset to distinguish
  // actual forest from the built-up flat area visible near the coast (see
  // smr-trails.geojson — trail lines only, no polygons), so elevation is a
  // simple stand-in for "this is probably slope, not town."
  // Candidate pool feeds ForestFire (via treePointsInRegion below) and caps
  // the "Bulk forest count" slider — 8000 was a guessed-not-measured
  // ceiling; raised well past it (matching TREE_CANDIDATE_COUNT) so that
  // slider can actually be dragged into the range needed to find the real
  // one — watch the FPS readout while doing that, don't trust this number
  // until it's been through that.
  const MAX_TREE_COUNT = 30000;
  const TREE_CANDIDATE_COUNT = 30000;
  const TREE_CLEARANCE_ABOVE_WATER = 20;
  const realWidth = contract.bbox.maxX - contract.bbox.minX;
  const realDepth = contract.bbox.maxZ - contract.bbox.minZ;

  // Fly/Drive have no collision or bounds of their own (see their "no
  // collision" comments) — it's easy to wander straight off the edge of
  // the loaded DEM into the featureless void beyond it (the same problem
  // the reset-position button exists to recover from). This clamps X/Z to
  // the DEM's actual rectangular bbox extent every frame when enabled.
  // PlayerController already has a boundary mechanism of its own
  // (setWorldBoundaryRadius, used for DTA's mountain ring) but it's
  // circular and FlightController/DriveController don't have an
  // equivalent at all — done here app-locally instead of extending the
  // shared player package for a rectangular case it doesn't need yet.
  const worldBounded = signal(savedSettings.worldBounded ?? false);

  // Ported directly from dont-turn-around (@dissonance/world) rather than
  // rebuilt — it's already fully decoupled from ExperienceProfile/DTA's
  // world scale (the Scene param is unused, kept only for future particle
  // systems), so unlike Sun/DriftingClouds/StarField this needed no
  // trail-viewer-local sibling. update() runs every frame in both game
  // loops below to keep its internal gust dynamics alive for future
  // consumers (e.g. tree sway, ambient wind audio — neither exists in this
  // app yet); the driftSpeed bump on cloud rebuild below reads the toggle
  // directly rather than the live windIntensity, since clouds only rebuild
  // occasionally (density/overcast/windy changes) and windIntensity ramps in
  // over ~2.5s (see WeatherSystem.update) — reading it at one rebuild moment
  // would usually show almost no change right when the toggle is flipped.
  const weatherMode = signal<WeatherMode>(savedSettings.weatherMode ?? 'clear');
  const weatherSystem = new WeatherSystem(scene);
  weatherSystem.setMode(weatherMode.value);
  // Wind audio already runs weatherSystem's live windIntensity through the
  // user-facing "Wind vol" slider (see the ambientAudio.setWeatherIntensity
  // calls below); foliage sway read weatherSystem directly instead, so
  // muting/lowering Wind vol changed what you heard with no visible change
  // in how hard the trees moved. This wraps the same weatherSystem for
  // FoliageSwayPlugin consumers so "Wind vol" reads as one master wind-
  // strength knob — audible and visible together — not just an audio gain.
  const visualWindSource: FoliageSwaySource = {
    getWindIntensity: () => weatherSystem.getWindIntensity() * audio.windVolume.value,
    getWindTime: () => weatherSystem.getWindTime(),
  };

  const clampToWorldBounds = (controller: { getPosition(): Vector3; setPosition(pos: Vector3): void }) => {
    if (!worldBounded.value) return;
    const pos = controller.getPosition();
    const maxX = (realWidth / 2) * scaleTuning.hScale.value;
    const maxZ = (realDepth / 2) * scaleTuning.hScale.value;
    const clampedX = Math.max(-maxX, Math.min(maxX, pos.x));
    const clampedZ = Math.max(-maxZ, Math.min(maxZ, pos.z));
    if (clampedX !== pos.x || clampedZ !== pos.z) {
      controller.setPosition(new Vector3(clampedX, pos.y, clampedZ));
    }
  };
  const treePoints: TreePoint[] = [];
  for (let i = 0; i < TREE_CANDIDATE_COUNT; i++) {
    const x = (Math.random() - 0.5) * realWidth;
    const z = (Math.random() - 0.5) * realDepth;
    const groundY = sampler.sampleHeight({ x, z });
    treePoints.push({ x, z, groundY });
  }
  // Consolidates the ForestFire candidate pool toward the map's center
  // instead of covering the whole bbox corner-to-corner — a real forest
  // reads as a region, not a uniform carpet over the entire DEM. Filters the
  // same cached candidate pool rather than regenerating it, so this stays
  // stable across a rescale. No HUD slider of its own anymore (see the
  // removed "Thin-instance tree radius" control); "Bulk forest radius"
  // reuses treeRegionRadiusMax for its own, separate range below.
  const treeRegionRadiusMax = Math.hypot(realWidth, realDepth) / 2;
  const defaultTreeRegionRadius = treeRegionRadiusMax * 0.4;
  const treeRegionRadius = signal(savedSettings.treeRegionRadius ?? defaultTreeRegionRadius);
  // WaterPlane is a freely tunable visual stand-in, not mapped hydrology.
  // Raising it must not erase the forest candidate pool or lock the count
  // controls. Keep vegetation's shoreline threshold stable.
  const forestWaterline = defaultWaterLevel(contract);
  const isForestEligible = (point: TreePoint) =>
    point.groundY >= forestWaterline + TREE_CLEARANCE_ABOVE_WATER;
  const treePointsInRegion = () =>
    treePoints.filter(
      (p) => Math.hypot(p.x, p.z) <= treeRegionRadius.value
        && isForestEligible(p),
    );

  // Trailside (spread along the GPX/OSM trail corridor) and bulk forest
  // (the rest of the region) are each their own signal group — visually
  // separate clusters the user should be able to size independently rather
  // than incidentally coupled because they're both "trees". Trailside's
  // default count of 60 is intentionally conservative — see
  // rebuildTrailsideScatter's own comment on why a full-trail scatter's
  // triangle budget needs care.
  const trailsideScale = createTrailsideScatterSignals({
    hScale: savedSettings.trailsideHScale ?? 1,
    vScale: savedSettings.trailsideVScale ?? 1,
    count: savedSettings.trailsideCount ?? 60,
  });
  // Bulk/non-trail-adjacent forest — real (decimated) trees scattered over
  // their own independent candidate disc (createBulkEligibleCandidatePositions
  // below, sized by bulkForestRadius, not treePointsInRegion), so the bulk of
  // the forest reads as the same species as the hero/trailside real trees
  // instead of a procedural art style. Own signal group, same reasoning as
  // trailsideScale: this governs a visually distinct cluster the user should
  // be able to size independently.
  const bulkForestScale = createBulkForestScatterSignals({
    hScale: savedSettings.bulkForestHScale ?? 1,
    vScale: savedSettings.bulkForestVScale ?? 1,
    count: savedSettings.bulkForestCount ?? 200,
  });
  // Its own disc (bulkForestRadius), independent of treeRegionRadius/
  // treePointsInRegion — the region-radius pool now only feeds ForestFire,
  // so bulk forest generating its own candidates keeps it fully decoupled
  // from that tier's session-fixed radius.
  const bulkForestRadius = signal(savedSettings.bulkForestRadius ?? defaultTreeRegionRadius);
  const bulkForestPlacedCount = signal(0);
  // Stable string hash (FNV-1a) — gives each species its own seed salt so
  // multiple calls at the SAME radius (dominant tree + every understory
  // species below) don't draw the same deterministic sequence. Without
  // this, every call's leading N accepted points were identical regardless
  // of which species asked, since the seed depended only on radius — the
  // understory props were landing exactly on top of the dominant tree (and
  // each other), reading as floating/embedded rather than freestanding.
  const hashSeed = (label: string): number => {
    let h = 0x811c9dc5;
    for (let i = 0; i < label.length; i++) {
      h ^= label.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  };
  const createBulkEligibleCandidatePositions = (count: number, radius: number, seedSalt: number): TreePoint[] => {
    if (count <= 0 || radius <= 0) return [];
    let state = ((Math.round(radius * 10) ^ 0x9e3779b9) ^ seedSalt) >>> 0;
    const random = () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    const positions: TreePoint[] = [];
    const maxAttempts = Math.max(1_000, count * 16);
    for (let attempt = 0; attempt < maxAttempts && positions.length < count; attempt++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const point = { x, z, groundY: sampler.sampleHeight({ x, z }) };
      if (isForestEligible(point)) positions.push(point);
    }
    return positions;
  };
  const bulkForestPoints = () =>
    createBulkEligibleCandidatePositions(bulkForestScale.count.value, bulkForestRadius.value, hashSeed('tree_small_02_scatter'));
  // Real (unscaled) points -> render space, same conversion HeightmapTerrain/
  // WaterPlane use (X/Z by hScale, Y by vExag, groundY already sampled once
  // at candidate-generation time). Shared by the dominant scatter tree and
  // the understory mix below.
  const toRenderPositions = (points: TreePoint[]): Vector3[] =>
    points.map((p) => {
      const x = p.x * scaleTuning.hScale.value;
      const z = p.z * scaleTuning.hScale.value;
      return new Vector3(x, p.groundY * scaleTuning.vExag.value, z);
    });
  const bulkForestPositions = (): Vector3[] => toRenderPositions(bulkForestPoints());

  const BULK_FOREST_URL = `${import.meta.env.BASE_URL}models/tree-small-02-scatter/tree_small_02_scatter_preview.glb`;
  let bulkForest: HeroTreeInstancesHandle | null = null;
  try {
    const positions = bulkForestPositions();
    bulkForest = await loadHeroTreeInstances(
      scene,
      BULK_FOREST_URL,
      positions,
      scaleTuning.hScale.value * bulkForestScale.hScale.value,
      scaleTuning.hScale.value * bulkForestScale.vScale.value,
      sun.getShadowGenerator(),
      visualWindSource,
    );
    bulkForestPlacedCount.value = positions.length;
    console.info(
      `[BulkForest] loaded ${positions.length} thin-instanced tree_small_02_scatter(s), ${bulkForest.triangleCount.toLocaleString()} tris each`,
    );
  } catch (error) {
    bulkForestPlacedCount.value = 0;
    console.error('[BulkForest] failed to load bulk forest tree', error);
  }

  // Prototype: sparse understory variety mixed into the bulk tier, same
  // weighted-species pattern as HERO_ASSETS/trailside (independent random
  // draw per species, sized as a fraction of the dominant tree's own count)
  // — but using assets that already exist at a real-world scatter-tier tri
  // budget (dead-tree-trunk-02/tree-stump-01, both already decimated-enough
  // to have shipped as HERO_ASSETS' own understory props) rather than
  // full-detail saplings, since bulk forest runs at 10x+ hero-grove's
  // instance count. Fractions are deliberately small and easy to retune —
  // no new asset authoring, just budget: at a count of 2250 this adds
  // ~110 extra instances (~1.8M tris) on top of the dominant tree's own
  // ~17M, for real silhouette variety instead of one repeated clone.
  const BULK_UNDERSTORY_ASSETS = [
    {
      label: 'tree_stump_01',
      url: `${import.meta.env.BASE_URL}models/tree-stump-01/tree_stump_01_preview.glb`,
      fraction: 0.03,
    },
    {
      label: 'dead_tree_trunk_02',
      url: `${import.meta.env.BASE_URL}models/dead-tree-trunk-02/dead_tree_trunk_02_preview.glb`,
      fraction: 0.02,
    },
  ] as const;
  const bulkUnderstoryCount = (fraction: number) => Math.round(bulkForestScale.count.value * fraction);
  const bulkUnderstoryPositions = (label: string, fraction: number): Vector3[] =>
    toRenderPositions(
      createBulkEligibleCandidatePositions(bulkUnderstoryCount(fraction), bulkForestRadius.value, hashSeed(label)),
    );

  const bulkUnderstoryClusters: Array<{ label: string; fraction: number; handle: HeroTreeInstancesHandle }> = [];
  await Promise.all(
    BULK_UNDERSTORY_ASSETS.map(async ({ label, url, fraction }) => {
      try {
        const positions = bulkUnderstoryPositions(label, fraction);
        const handle = await loadHeroTreeInstances(
          scene,
          url,
          positions,
          scaleTuning.hScale.value * bulkForestScale.hScale.value,
          scaleTuning.hScale.value * bulkForestScale.vScale.value,
          sun.getShadowGenerator(),
          visualWindSource,
        );
        bulkUnderstoryClusters.push({ label, fraction, handle });
        console.info(`[BulkForest] loaded ${positions.length} thin-instanced ${label}(s) as understory`);
      } catch (error) {
        console.error(`[BulkForest] failed to load ${label} understory cluster`, error);
      }
    }),
  );

  const repositionBulkForest = () => {
    const positions = bulkForestPositions();
    if (!bulkForest) {
      bulkForestPlacedCount.value = 0;
    } else {
      bulkForestPlacedCount.value = positions.length;
      bulkForest.setPlacements(
        positions,
        scaleTuning.hScale.value * bulkForestScale.hScale.value,
        scaleTuning.hScale.value * bulkForestScale.vScale.value,
      );
    }
    for (const { label, fraction, handle } of bulkUnderstoryClusters) {
      handle.setPlacements(
        bulkUnderstoryPositions(label, fraction),
        scaleTuning.hScale.value * bulkForestScale.hScale.value,
        scaleTuning.hScale.value * bulkForestScale.vScale.value,
      );
    }
  };
  const repositionBulkForestDebounced = debounce(repositionBulkForest, 200);

  // Same technique as @dissonance/world's CloudSystem (a decoupled sibling,
  // DriftingClouds — CloudSystem's sizes/altitudes are hardcoded to DTA's
  // ~800-unit world and gated behind its ExperienceProfile, neither of
  // which fits this real-world-scale DEM viewer). Sized in real meters,
  // then converted the same way terrain/water are: X/Z by horizontalScale,
  // Y by verticalExaggeration.
  // Overcast reads from atmosphere.overcast.value rather than taking a
  // parameter — it's a scene-wide toggle, not something callers pick per
  // call, same as `contract`/`hScale` already being closed over here.
  const cloudOptionsFor = (currentHScale: number, currentVExag: number, count: number) => ({
    count: atmosphere.overcast.value ? Math.max(count, 60) : count,
    spread: (contract.bbox.maxX - contract.bbox.minX) * currentHScale * 1.3,
    altitudeMin:
      (atmosphere.overcast.value ? contract.elevation.max + 150 : contract.elevation.max + 250) * currentVExag,
    altitudeMax:
      (atmosphere.overcast.value ? contract.elevation.max + 220 : contract.elevation.max + 450) * currentVExag,
    diameterMin: (atmosphere.overcast.value ? 600 : 300) * currentHScale,
    diameterMax: (atmosphere.overcast.value ? 1400 : 800) * currentHScale,
    driftSpeed: (weatherMode.value === 'windy' ? 15 : 5) * currentHScale,
    // Manually controlled (Sky section's color picker + opacity slider) —
    // overcast used to auto-shift these too, but now that there's direct
    // user control it no longer overrides color/alpha, only the
    // count/altitude/diameter density feel above.
    color: Color3.FromHexString(atmosphere.cloudColor.value),
    alpha: atmosphere.cloudOpacity.value,
  });
  let clouds = new DriftingClouds(
    scene,
    cloudOptionsFor(scaleTuning.hScale.value, scaleTuning.vExag.value, atmosphere.cloudCount.value),
  );
  clouds.getMeshes().forEach((m) => water.addToRenderList(m));
  water.addToRenderList(sun.getMesh());

  // Cloud positions/sizes are baked in at construction (unlike water's cheap
  // setScale), so both a scale change and the cloud-density slider rebuild
  // them from scratch. Shared so the two call sites (H/V-scale rebuild,
  // cloud-density slider) don't duplicate the dispose/recreate/render-list
  // dance.
  const rebuildClouds = () => {
    clouds.getMeshes().forEach((m) => water.removeFromRenderList(m));
    clouds.dispose();
    clouds = new DriftingClouds(
      scene,
      cloudOptionsFor(scaleTuning.hScale.value, scaleTuning.vExag.value, atmosphere.cloudCount.value),
    );
    clouds.getMeshes().forEach((m) => water.addToRenderList(m));
    clouds.setVisible(visibility.clouds.value);
  };

  // Rectangle, not circle: hugs the same maxX/maxZ rectangle clampToWorldBounds
  // uses (the DEM's actual bbox, rendered-space) so the ring sits right at
  // the terrain's real edge on every side, corners included — no gap where
  // the terrain just stops and the void behind it used to show through. This
  // is independent of whether "Bounded world" (the movement clamp) is on;
  // that toggle only affects walking past the edge, not where the ring sits.
  // halfWidth/halfDepth scale by hScale like everything else horizontal
  // (clouds' spread, water's extent); bottomY/heightScale scale by vExag
  // like everything vertical (clouds' altitude, terrain's own elevation) —
  // so the ring stays proportionate to the terrain across both sliders
  // independently, not just at their default combination.
  const mountainRingOptions = (currentHScale: number, currentVExag: number) => ({
    shape: 'rectangle' as const,
    halfWidth: (realWidth / 2) * currentHScale,
    halfDepth: (realDepth / 2) * currentHScale,
    bottomY: (contract.elevation.min - MOUNTAIN_BASE_MARGIN_M) * currentVExag,
    heightScale: currentVExag,
    nearColor: MOUNTAIN_NEAR_COLOR,
  });
  let mountains = new MountainRing(scene, mountainRingOptions(scaleTuning.hScale.value, scaleTuning.vExag.value));
  const rebuildMountains = () => {
    mountains.dispose();
    mountains = new MountainRing(scene, mountainRingOptions(scaleTuning.hScale.value, scaleTuning.vExag.value));
    mountains.setVisible(visibility.mountains.value);
  };

  const [trails, gpxTrack, savedViews, locations, replayRoutes] = await Promise.all([
    loadTrails(),
    loadGpxTrack(),
    loadSavedViews(),
    loadLocations(),
    loadReplayRoutes(),
  ]);
  let trailMeshes = buildPolylineMeshes(scene, trails, terrain, origin, {
    namePrefix: 'osmTrail',
    yLift: OSM_TRAIL_Y_LIFT,
    horizontalScale: scaleTuning.hScale.value,
    colorFor: blazeColorFromTags,
  });
  let gpxMeshes = buildPolylineMeshes(scene, gpxTrack, terrain, origin, {
    namePrefix: 'gpxTrack',
    yLift: GPX_TRACK_Y_LIFT,
    horizontalScale: scaleTuning.hScale.value,
    colorFor: () => GPX_TRACK_COLOR,
  });
  // Generated once from the heightmap's real (unscaled) UTM bbox — the
  // lat/lon line values themselves don't depend on hScale/vExag, only the
  // meshes built from them do (see rebuildWorld below).
  const gridLines = graticuleLines(contract.bbox, GRID_INTERVAL_DEG, GRID_LINE_SAMPLES);
  let gridMeshes = buildGridMeshes(scene, gridLines, terrain, origin, scaleTuning.hScale.value);

  const readout = document.getElementById('readout') as HTMLDivElement;
  const levelLabel = document.getElementById('level-label') as HTMLDivElement;
  levelLabel.textContent = level.label;

  // All toggle checkboxes in one place — visibility (7) + Overcast (was in
  // AtmosphereRow) + Bounded world (was in MovementRow, player-mode only).
  // Grid instead of one-per-line: that stacked layout was the whole reason
  // this pass started (see THREADS.md). VisibilityToggles returns a
  // Fragment, so its <label> children land as direct grid-item siblings of
  // the Overcast/Bounded-world labels below — one flat grid, not nested.
  render(
    <Section title='Toggles'>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: '10px' }}>
        <VisibilityToggles
          signals={visibility}
          onTerrainCommit={(checked) => terrain.setVisible(checked)}
          onOsmCommit={(checked) => setMeshesEnabled(trailMeshes, checked)}
          onGpxCommit={(checked) => setMeshesEnabled(gpxMeshes, checked)}
          onWaterCommit={(checked) => water.setVisible(checked)}
          onCloudsCommit={(checked) => clouds.setVisible(checked)}
          onGridCommit={(checked) => setMeshesEnabled(gridMeshes, checked)}
          onMountainsCommit={(checked) => mountains.setVisible(checked)}
        />
        <ToggleLabel label='Overcast' signal={atmosphere.overcast} onCommit={() => rebuildClouds()} />
        {/* Not a ToggleLabel — weatherMode is 'clear'|'windy', not a plain
            boolean signal, so it needs its own checked/onChange conversion
            rather than ToggleLabel's Signal<boolean> contract. */}
        <label>
          <input
            type='checkbox'
            checked={weatherMode.value === 'windy'}
            onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
              weatherMode.value = e.currentTarget.checked ? 'windy' : 'clear';
              weatherSystem.setMode(weatherMode.value);
              rebuildClouds();
            }}
          />{' '}
          Windy
        </label>
        {level.cameraMode !== 'orbit' && (
          <ToggleLabel label='Bounded world' signal={worldBounded} onCommit={() => {}} />
        )}
        {/* utilityCorridors (boulevard power line) only loads in the
            non-orbit path, same as compositeLocations' buildings — gated
            here rather than through VisibilityToggles' shared, orbit-safe
            prop contract. */}
        {level.cameraMode !== 'orbit' && (
          <ToggleLabel
            label='Power lines'
            signal={visibility.powerLines}
            onCommit={(checked) => utilityCorridors.setVisible(checked)}
          />
        )}
      </div>
    </Section>,
    document.getElementById('toggles-root') as HTMLDivElement,
  );

  // World — level-1-only scale-tuning (H-scale/V-exagg/water-level) plus
  // tree count, which (unlike H/V/water) applies on every level, so it
  // mounts unconditionally while ScaleTuningRow stays gated beneath it.
  // Mounted into its own root (right after Toggles in index.html's DOM
  // order) so "what the terrain looks like" controls read as one group,
  // even though the underlying signals (created earlier) and the rebuild
  // logic they trigger stay exactly where they were.
  render(
    <Section title='World'>
      <div style={{ marginTop: '6px', color: '#9cf', fontWeight: 700 }}>Trailside trees (full-detail GLBs)</div>
      <SliderRow
        label='Trailside H-scale'
        signal={trailsideScale.hScale}
        min={0.25}
        max={3}
        step={0.25}
        suffix='x'
        format={(v) => v.toFixed(2)}
        commitOn='input'
        onCommit={() => rebuildTrailsideScatterDebounced()}
      />
      <SliderRow
        label='Trailside V-scale'
        signal={trailsideScale.vScale}
        min={0.25}
        max={3}
        step={0.25}
        suffix='x'
        format={(v) => v.toFixed(2)}
        commitOn='input'
        onCommit={() => rebuildTrailsideScatterDebounced()}
      />
      <SliderRow
        label='Trailside count'
        signal={trailsideScale.count}
        min={0}
        max={600}
        step={10}
        format={(v) => v.toFixed(0)}
        commitOn='input'
        onCommit={() => rebuildTrailsideScatterDebounced()}
      />
      <div style={{ marginTop: '10px', color: '#9cf', fontWeight: 700 }}>Bulk forest (decimated high-def GLB)</div>
      <SliderRow
        label='Bulk forest H-scale'
        signal={bulkForestScale.hScale}
        min={0.25}
        max={3}
        step={0.25}
        suffix='x'
        format={(v) => v.toFixed(2)}
        commitOn='input'
        onCommit={() => repositionBulkForestDebounced()}
      />
      <SliderRow
        label='Bulk forest V-scale'
        signal={bulkForestScale.vScale}
        min={0.25}
        max={3}
        step={0.25}
        suffix='x'
        format={(v) => v.toFixed(2)}
        commitOn='input'
        onCommit={() => repositionBulkForestDebounced()}
      />
      <SliderRow
        label='Bulk forest radius'
        signal={bulkForestRadius}
        min={0}
        max={treeRegionRadiusMax}
        step={treeRegionRadiusMax / 100}
        suffix='m'
        format={(v) => v.toFixed(0)}
        commitOn='input'
        onCommit={() => repositionBulkForestDebounced()}
      />
      <SliderRow
        label='Bulk forest count'
        signal={bulkForestScale.count}
        min={0}
        // Never derive this range from the current pool: radius=0 made
        // max=0 and physically prevented this recovery control from moving.
        max={MAX_TREE_COUNT}
        step={50}
        format={(v) => `${v.toFixed(0)} requested / ${bulkForestPlacedCount.value.toFixed(0)} placed`}
        commitOn='input'
        onCommit={(value) => {
          if (value > 0 && bulkForestRadius.value === 0) {
            bulkForestRadius.value = defaultTreeRegionRadius;
          }
          repositionBulkForestDebounced();
        }}
      />
      {levelKey === '1' && (
        <ScaleTuningRow
          signals={scaleTuning}
          waterMin={contract.elevation.min}
          waterMax={contract.elevation.max}
          waterStep={(contract.elevation.max - contract.elevation.min) / 200}
          onScaleCommit={() => rebuildWorld(scaleTuning.hScale.value, scaleTuning.vExag.value)}
          atmosphere={atmosphere}
          onWaterColorCommit={(value) => water.setColor(Color3.FromHexString(value))}
          onTerrainColorCommit={() => rebuildWorld(scaleTuning.hScale.value, scaleTuning.vExag.value)}
          onWindowTintCommit={() => rebuildWorld(scaleTuning.hScale.value, scaleTuning.vExag.value)}
        />
      )}
    </Section>,
    document.getElementById('world-root') as HTMLDivElement,
  );

  // Default off — the grid is a measurement layer, not something every
  // session should pay rendering cost for unless explicitly enabled.
  setMeshesEnabled(gridMeshes, visibility.grid.value);

  // Sky controls — mounted here (before the orbit early-return below)
  // rather than alongside movement-mode/camera-height, since time-of-day/
  // fog/stars/clouds all render in orbit mode (level 3) too, unlike
  // Walk/Fly/Drive which orbit has no equivalent of. Preact-rendered pilot
  // (see docs/THREADS.md); commit handlers below mirror the dispose/
  // recreate bodies the old change-listeners used 1:1.
  render(
    <Section title='Sky'>
      <AtmosphereRow
        signals={atmosphere}
        onStarCountCommit={() => {
          stars.dispose();
          stars = new StarField(scene, {
            count: atmosphere.starCount.value,
            color: Color3.FromHexString(atmosphere.starColor.value),
            radius: STAR_RADIUS,
          });
          stars.setNightFactor(1 - Math.max(0, sunHeightForHour(atmosphere.timeOfDay.value)));
        }}
        onCloudCountCommit={() => rebuildClouds()}
        onCloudColorCommit={() => rebuildClouds()}
        onCloudOpacityCommit={() => rebuildClouds()}
      />
    </Section>,
    document.getElementById('atmosphere-root') as HTMLDivElement,
  );

  render(
    <Section title='Audio'>
      <AudioRow
        signals={audio}
        showPlayerControls={level.cameraMode !== 'orbit'}
        onMasterMutedCommit={(muted) => AudioEngine.setMuted(muted)}
        onWindVolumeInput={() => {}}
        onFootstepMutedCommit={(muted) => trailPlayerAudio.setFootstepMuted(muted)}
        onBreathMutedCommit={(muted) => trailPlayerAudio.setBreathMuted(muted)}
      />
    </Section>,
    document.getElementById('audio-root') as HTMLDivElement,
  );

  // Real playback only starts from here — a genuine click, satisfying the
  // browser's AudioContext-unlock gesture requirement (see the block near
  // audio/ambientAudio's construction above for why trail-viewer needs its
  // own dedicated button rather than piggybacking a menu gesture the way
  // DTA's Game.start() does).
  const audioToggleButton = document.getElementById('toggle-audio-button') as HTMLButtonElement;
  audioToggleButton.addEventListener('click', async () => {
    if (audioStarted) return;
    audioStarted = true;
    audioToggleButton.textContent = '🔊 Audio on';
    audioToggleButton.disabled = true;
    await AudioEngine.start();
    ambientAudio.start();
    heartbeatAudio.start();
    if (level.cameraMode !== 'orbit') trailPlayerAudio.start();
  });

  const hudToggleButton = document.getElementById('toggle-hud-button') as HTMLButtonElement;
  const uiPanel = document.getElementById('ui') as HTMLDivElement;
  let hudVisible = savedSettings.hudVisible ?? true;
  const applyHudVisible = () => {
    uiPanel.style.display = hudVisible ? 'block' : 'none';
  };
  applyHudVisible();
  hudToggleButton.addEventListener('click', () => {
    hudVisible = !hudVisible;
    applyHudVisible();
    // persistSettings (and the position/mode state it reads) doesn't apply
    // in orbit mode — see SavedSettings' own comment on why.
    if (level.cameraMode !== 'orbit') persistSettings();
  });

  // Unregisters app-owned unload hooks right before a reload/navigate:
  // autosave in player mode plus the accidental-close guard. reload()/href
  // fire beforeunload/pagehide on the page being torn down *before* the new
  // one loads; persistSettings would otherwise immediately re-persist the
  // current in-memory state and clobber whatever was just written.
  const unregisterBeforeNavigate = () => {
    removeAccidentalCloseGuard();
    if (level.cameraMode !== 'orbit') {
      window.removeEventListener('beforeunload', persistSettings);
      window.removeEventListener('pagehide', persistSettings);
    }
  };
  document.querySelectorAll<HTMLAnchorElement>('#level-links a').forEach((link) => {
    link.addEventListener('click', () => unregisterBeforeNavigate());
  });

  if (level.cameraMode === 'orbit') {
    // The original Phase 3/4 validation view — free orbit over the whole
    // model, no player/collision involved. Orbit doesn't autosave (see
    // SavedSettings' comment), but a loaded view snapshot writes these same
    // fields into localStorage, so restoring them here if present is what
    // makes "Load View" work for level 3.
    const worldWidth = (contract.bbox.maxX - contract.bbox.minX) * level.horizontalScale;
    const orbitCamera = new ArcRotateCamera(
      'orbitCamera',
      savedSettings.orbitAlpha ?? -Math.PI / 2,
      savedSettings.orbitBeta ?? Math.PI / 3,
      savedSettings.orbitRadius ?? worldWidth * 0.7,
      new Vector3(savedSettings.orbitTargetX ?? 0, savedSettings.orbitTargetY ?? 0, savedSettings.orbitTargetZ ?? 0),
      scene,
    );
    orbitCamera.attachControl(canvas, true);
    orbitCamera.lowerRadiusLimit = 20;
    orbitCamera.upperRadiusLimit = worldWidth * 2;
    orbitCamera.wheelPrecision = 8;
    orbitCamera.panningSensibility = 50;
    orbitCamera.maxZ = level.farClip;
    scene.activeCamera = orbitCamera;

    render(
      <Section title='Navigation & Views'>
        <ViewToolsRow
          buildSnapshot={() => ({
            level: levelKey,
            orbitTargetX: orbitCamera.target.x,
            orbitTargetY: orbitCamera.target.y,
            orbitTargetZ: orbitCamera.target.z,
            orbitAlpha: orbitCamera.alpha,
            orbitBeta: orbitCamera.beta,
            orbitRadius: orbitCamera.radius,
            hScale: scaleTuning.hScale.value,
            vExag: scaleTuning.vExag.value,
            waterLevel: scaleTuning.waterLevel.value,
            timeOfDay: atmosphere.timeOfDay.value,
            fogDensity: atmosphere.fogDensity.value,
            fogColor: atmosphere.fogColor.value,
            overcast: atmosphere.overcast.value,
            starCount: atmosphere.starCount.value,
            cloudCount: atmosphere.cloudCount.value,
            cloudColor: atmosphere.cloudColor.value,
            cloudOpacity: atmosphere.cloudOpacity.value,
            waterColor: atmosphere.waterColor.value,
            starColor: atmosphere.starColor.value,
            skyDayColor: atmosphere.skyDayColor.value,
            skyNightColor: atmosphere.skyNightColor.value,
            terrainLowColor: atmosphere.terrainLowColor.value,
            terrainHighColor: atmosphere.terrainHighColor.value,
            sunTint: atmosphere.sunTint.value,
            windowTintColor: atmosphere.windowTintColor.value,
            windowGlow: atmosphere.windowGlow.value,
            treeRegionRadius: treeRegionRadius.value,
            trailsideHScale: trailsideScale.hScale.value,
            trailsideVScale: trailsideScale.vScale.value,
            trailsideCount: trailsideScale.count.value,
            bulkForestHScale: bulkForestScale.hScale.value,
            bulkForestVScale: bulkForestScale.vScale.value,
            bulkForestCount: bulkForestScale.count.value,
            bulkForestRadius: bulkForestRadius.value,
            weatherMode: weatherMode.value,
            masterMuted: audio.masterMuted.value,
            windVolume: audio.windVolume.value,
            footstepMuted: audio.footstepMuted.value,
            breathMuted: audio.breathMuted.value,
          })}
          levelKey={levelKey}
          validLevelKeys={Object.keys(LEVELS)}
          saveSettings={saveSettings}
          onBeforeNavigate={unregisterBeforeNavigate}
          savedViews={savedViews}
        />
        <GotoRow
          onGo={(lat, lon) => {
            const real = latLonToWorld({ lat, lon }, origin);
            const renderX = real.x * level.horizontalScale;
            const renderZ = real.z * level.horizontalScale;
            const groundY = terrain.getHeightAt(renderX, renderZ);
            // Re-centers the orbit pivot on the target point, keeping
            // current alpha/beta/radius (viewing angle/zoom) unchanged.
            orbitCamera.target = new Vector3(renderX, groundY, renderZ);
          }}
          getCurrentLatLon={() => {
            const pos = orbitCamera.position;
            const real = { x: pos.x / level.horizontalScale, z: pos.z / level.horizontalScale };
            return worldToLatLon(real, origin);
          }}
          locations={locations}
        />
        <RouteRecorder
          storageKey='trail-viewer.route-recorder.v1'
          getCurrentSample={() => {
            const pos = orbitCamera.position;
            const real = { x: pos.x / level.horizontalScale, z: pos.z / level.horizontalScale };
            const latLon = worldToLatLon(real, origin);
            return {
              ...latLon,
              heightmap: sampler.sampleHeight(real),
              worldX: real.x,
              worldZ: real.z,
            } satisfies RouteSample;
          }}
        />
        <RouteReplay
          routes={replayRoutes}
          onSeek={({ lat, lon }) => {
            const real = latLonToWorld({ lat, lon }, origin);
            const renderX = real.x * level.horizontalScale;
            const renderZ = real.z * level.horizontalScale;
            orbitCamera.target = new Vector3(renderX, terrain.getHeightAt(renderX, renderZ), renderZ);
          }}
        />
      </Section>,
      document.getElementById('mode-controls-root') as HTMLDivElement,
    );

    const gameLoop = new GameLoop(engine, (dt) => {
      clouds.update(dt);
      weatherSystem.update(dt, (windIntensity) => {
        ambientAudio.setWeatherIntensity(windIntensity * audio.windVolume.value);
      });
      const pos = orbitCamera.position;
      const groundY = terrain.getHeightAt(pos.x, pos.z);
      readout.textContent =
        `camera: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})\n` +
        `ground under camera: ${groundY.toFixed(1)}m\n` +
        `fps: ${engine.getFps().toFixed(0)}\n` +
        `left-drag to orbit, scroll to zoom, right-drag to pan`;
      scene.render();
    });
    hideLoadingOverlay();
    gameLoop.start();
    return;
  }

  // Spawn at the recorded hike's own starting point — a real trailhead,
  // rather than an arbitrary bbox-center point that might not sit on a trail
  // — unless a saved position exists for this level from a previous visit.
  const spawnPoint = gpxTrack[0]?.points[0];
  const spawnReal = spawnPoint ? latLonToWorld(spawnPoint, origin) : { x: 0, z: 0 };
  const spawnRenderX = savedSettings.x ?? spawnReal.x * scaleTuning.hScale.value;
  const spawnRenderZ = savedSettings.z ?? spawnReal.z * scaleTuning.hScale.value;
  const spawnGroundY = terrain.getHeightAt(spawnRenderX, spawnRenderZ);
  // Y is a placeholder — PlayerController.update() overwrites it with
  // groundY + its own (scale-adjusted) eye height on the very first frame.
  const startPosition = new Vector3(spawnRenderX, spawnGroundY, spawnRenderZ);

  const player = new PlayerController(scene, startPosition, { scale: level.playerScale, farClip: level.farClip });
  player.setTerrain(terrain);

  // Fast air travel — a free-fly camera for covering this real-world-scale
  // map quickly, alongside walking. All three controllers stay alive
  // simultaneously (rather than being created/destroyed on toggle) so
  // switching between them is instant and position carries over cleanly.
  const flight = new FlightController(scene, startPosition.clone(), {
    farClip: level.farClip,
    speed: level.flightSpeed,
  });

  // Same idea as Fly, but grounded — WASD at flight-grade speed with Y
  // snapped to the terrain every frame, for players who want to cover
  // ground quickly without losing their footing on the map.
  const drive = new DriveController(scene, startPosition.clone(), {
    farClip: level.farClip,
    speed: level.flightSpeed,
    scale: level.playerScale,
  });
  drive.setTerrain(terrain);

  // Conservative bloom-only pass — added so the city kit's emissive window
  // tint (see atmosphere.windowTintColor/windowGlow, CompositeLocations.ts)
  // actually reads as a glowing window rather than a flat bright rectangle;
  // also softens the street lamps' existing emissive globes the same way.
  // scene.cameras already holds player/flight/drive by this point (each
  // camera self-registers on construction) — no per-controller wiring
  // needed. Every other pipeline feature (FXAA, grain, DoF, vignette,
  // chromatic aberration) stays off; this is scoped to bloom alone.
  const bloomPipeline = new DefaultRenderingPipeline('bloomPipeline', true, scene, scene.cameras);
  bloomPipeline.bloomEnabled = true;
  bloomPipeline.bloomThreshold = 0.65;
  bloomPipeline.bloomWeight = 0.4;
  bloomPipeline.bloomKernel = 64;
  bloomPipeline.bloomScale = 0.5;

  // Autosave never restored look direction even before the Copy/Load View
  // mechanism existed (only position) — a real gap, since "the same spot,
  // facing the default direction" isn't the same view at all. Applied to
  // all three controllers so whichever mode ends up active (see
  // switchMode's own restore below) already has the right look direction.
  if (savedSettings.rotationX !== undefined && savedSettings.rotationY !== undefined) {
    const savedRotation = new Vector3(savedSettings.rotationX, savedSettings.rotationY, 0);
    player.camera.rotation.copyFrom(savedRotation);
    flight.camera.rotation.copyFrom(savedRotation);
    drive.camera.rotation.copyFrom(savedRotation);
  }

  // Counts are lower for the understory/deadfall props than the tree
  // canopy — a real forest floor has far fewer stumps and dead trunks
  // underfoot than it has live trees overhead.
  const HERO_ASSETS = [
    {
      label: 'tree_small_02',
      url: `${import.meta.env.BASE_URL}models/tree-small-02/tree_small_02_preview.glb`,
      count: 100,
    },
    {
      label: 'pine_sapling_medium',
      url: `${import.meta.env.BASE_URL}models/pine-sapling-medium/pine_sapling_medium_preview.glb`,
      count: 8,
    },
    {
      label: 'fir_sapling_medium',
      url: `${import.meta.env.BASE_URL}models/fir-sapling-medium/fir_sapling_medium_preview.glb`,
      count: 8,
    },
    {
      label: 'dead_tree_trunk_02',
      url: `${import.meta.env.BASE_URL}models/dead-tree-trunk-02/dead_tree_trunk_02_preview.glb`,
      count: 6,
    },
    {
      label: 'tree_stump_01',
      url: `${import.meta.env.BASE_URL}models/tree-stump-01/tree_stump_01_preview.glb`,
      count: 8,
    },
  ] as const;

  const HERO_WEIGHT_TOTAL = HERO_ASSETS.reduce((sum, asset) => sum + asset.count, 0);

  // Spread along both sides of the recorded GPX track (the red line) AND
  // the yellow-blazed OSM trails, instead of clustered in one spot — reuses
  // HERO_ASSETS' per-species counts as MIX WEIGHTS (not absolute counts) so
  // the trailside cluster keeps the same species proportions, scaled by the
  // user-facing "Trailside count" slider instead of a fixed total.
  //
  // Segments are computed once, in real (unscaled) meters, same convention
  // as buildPolylineMeshes — trailTotalLength stays fixed even as hScale
  // changes, only the final render-space conversion below depends on it.
  // Total triangle cost scales with the count slider alone, which is
  // exactly the "watch the FPS readout and find the real ceiling" pattern
  // this app already uses for candidate-pool-backed sliders — see
  // MAX_TREE_COUNT's own comment. Default count (60, see trailsideScale's
  // creation above) is intentionally conservative.
  type TrailSegment = { ax: number; az: number; bx: number; bz: number; length: number; start: number };
  const trailSegments: TrailSegment[] = [];
  let trailTotalLength = 0;
  const addTrailCorridor = (polylines: GeoPolyline[]) => {
    for (const polyline of polylines) {
      const realPoints = polyline.points.map((p) => latLonToWorld(p, origin));
      for (let i = 0; i < realPoints.length - 1; i++) {
        const a = realPoints[i];
        const b = realPoints[i + 1];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        if (length <= 0) continue;
        trailSegments.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, length, start: trailTotalLength });
        trailTotalLength += length;
      }
    }
  };
  addTrailCorridor(gpxTrack);
  // smr-trails.geojson carries no osmc:symbol tag at all (blazeColorFromTags
  // falls back to NEUTRAL_TRAIL_COLOR for all 473 features, every OSM trail
  // currently renders the same neutral tan regardless of real blaze color)
  // — but several way segments DO encode it in the name text instead, e.g.
  // "Lenape Trail (Yellow)", "Lenape Yellow Blaze", "Yellow/Red Blaze".
  // Matching on osmc:symbol too costs nothing and covers datasets that do
  // have it.
  addTrailCorridor(
    trails.filter((polyline) => {
      const primary = polyline.tags?.['osmc:symbol']?.split(':')[0]?.toLowerCase();
      if (primary === 'yellow') return true;
      return !!polyline.tags?.name?.toLowerCase().includes('yellow');
    }),
  );

  const TRAILSIDE_MIN_OFFSET = 3;
  const TRAILSIDE_MAX_OFFSET = 14;
  const trailsidePositions = (count: number): Vector3[] => {
    const positions: Vector3[] = [];
    if (trailTotalLength <= 0) return positions;
    for (let i = 0; i < count; i++) {
      const d = Math.random() * trailTotalLength;
      const seg =
        trailSegments.find((s) => d >= s.start && d < s.start + s.length) ?? trailSegments[trailSegments.length - 1];
      const t = (d - seg.start) / seg.length;
      const px = seg.ax + (seg.bx - seg.ax) * t;
      const pz = seg.az + (seg.bz - seg.az) * t;
      // Unit tangent along the segment, rotated 90 degrees in the XZ plane
      // to get the side-to-side offset direction ("both sides" of the trail).
      const dirX = (seg.bx - seg.ax) / seg.length;
      const dirZ = (seg.bz - seg.az) / seg.length;
      const side = Math.random() < 0.5 ? -1 : 1;
      const offset = (TRAILSIDE_MIN_OFFSET + Math.random() * (TRAILSIDE_MAX_OFFSET - TRAILSIDE_MIN_OFFSET)) * side;
      const realX = px - dirZ * offset;
      const realZ = pz + dirX * offset;
      const x = realX * scaleTuning.hScale.value;
      const z = realZ * scaleTuning.hScale.value;
      positions.push(new Vector3(x, terrain.getHeightAt(x, z), z));
    }
    return positions;
  };

  const trailsideSpeciesCount = (weight: number) =>
    Math.round(trailsideScale.count.value * (weight / HERO_WEIGHT_TOTAL));

  const trailsideClusters: Array<{ weight: number; handle: HeroTreeInstancesHandle }> = [];
  await Promise.all(
    HERO_ASSETS.map(async ({ label, url, count: weight }) => {
      try {
        const handle = await loadHeroTreeInstances(
          scene,
          url,
          trailsidePositions(trailsideSpeciesCount(weight)),
          scaleTuning.hScale.value * trailsideScale.hScale.value,
          scaleTuning.hScale.value * trailsideScale.vScale.value,
          sun.getShadowGenerator(),
          visualWindSource,
        );
        trailsideClusters.push({ weight, handle });
        console.info(
          `[TrailsideScatter] loaded ${trailsideSpeciesCount(weight)} thin-instanced ${label}(s) along the trail`,
        );
      } catch (error) {
        console.error(`[TrailsideScatter] failed to load ${label} along the trail`, error);
      }
    }),
  );

  const rebuildTrailsideScatter = () => {
    for (const { weight, handle } of trailsideClusters) {
      handle.setPlacements(
        trailsidePositions(trailsideSpeciesCount(weight)),
        scaleTuning.hScale.value * trailsideScale.hScale.value,
        scaleTuning.hScale.value * trailsideScale.vScale.value,
      );
    }
  };
  const rebuildTrailsideScatterDebounced = debounce(rebuildTrailsideScatter, 200);

  // Landmark manifest (locations.json) — crude primitive placeholder props
  // (LocationProps.ts) thin-instanced at named real-world coordinates, one
  // prop type per THREADS.md T22 asset-queue/picnic-grounds/stairway/
  // creek-corridor mention that doesn't have an authored asset yet. Meant
  // to be swapped for real assets later; the placement mechanism itself
  // (this block) won't need to change when that happens.
  const locationToRenderXZ = (lat: number, lon: number) => {
    const real = latLonToWorld({ lat, lon }, origin);
    return { x: real.x * scaleTuning.hScale.value, z: real.z * scaleTuning.hScale.value };
  };
  let locationProps = scatterLocationProps(
    scene,
    locations,
    locationToRenderXZ,
    (x, z) => terrain.getHeightAt(x, z),
    sun.getShadowGenerator(),
  );
  let compositeLocations = await loadCompositeLocations(
    scene,
    locations,
    locationToRenderXZ,
    scaleTuning.hScale.value,
    scaleTuning.vExag.value,
    (x, z) => terrain.getHeightAt(x, z),
    Color3.FromHexString(atmosphere.windowTintColor.value),
    atmosphere.windowGlow.value,
    sun.getShadowGenerator(),
  );
  // Same rectangle clampToWorldBounds/mountainRingOptions already treat as
  // "the edge of the world" (realWidth/realDepth, DEM bbox centered on
  // origin) — a corridor with `extendToWorldBounds: true` stretches its two
  // open ends out to this same box instead of stopping at its authored
  // coordinates.
  const utilityCorridorWorldBounds = () => ({
    minX: -(realWidth / 2) * scaleTuning.hScale.value,
    maxX: (realWidth / 2) * scaleTuning.hScale.value,
    minZ: -(realDepth / 2) * scaleTuning.hScale.value,
    maxZ: (realDepth / 2) * scaleTuning.hScale.value,
  });
  let utilityCorridors = loadUtilityCorridors(
    scene,
    locations,
    locationToRenderXZ,
    scaleTuning.hScale.value,
    scaleTuning.vExag.value,
    (x, z) => terrain.getHeightAt(x, z),
    utilityCorridorWorldBounds(),
    sun.getShadowGenerator(),
  );
  utilityCorridors.setVisible(visibility.powerLines.value);
  // Buildings (compositeLocations) deliberately don't feed this yet — a
  // circle collider is a poor fit for a rectangular building footprint
  // (either clips corners or blocks well outside the flat walls); scoped
  // down to props+poles for now, buildings/Drive-mode collision are a
  // follow-up (Dan, 2026-07-27).
  const applyPlayerColliders = () => {
    player.setColliders([...locationProps.colliders, ...utilityCorridors.colliders]);
  };
  applyPlayerColliders();
  const rebuildLocationProps = () => {
    locationProps.dispose();
    locationProps = scatterLocationProps(
      scene,
      locations,
      locationToRenderXZ,
      (x, z) => terrain.getHeightAt(x, z),
      sun.getShadowGenerator(),
    );
    compositeLocations.dispose();
    void loadCompositeLocations(
      scene,
      locations,
      locationToRenderXZ,
      scaleTuning.hScale.value,
      scaleTuning.vExag.value,
      (x, z) => terrain.getHeightAt(x, z),
      Color3.FromHexString(atmosphere.windowTintColor.value),
      atmosphere.windowGlow.value,
      sun.getShadowGenerator(),
    )
      .then((next) => {
        compositeLocations = next;
      })
      .catch((error) => {
        console.error('[CompositeLocations] failed to rebuild', error);
      });
    utilityCorridors.dispose();
    utilityCorridors = loadUtilityCorridors(
      scene,
      locations,
      locationToRenderXZ,
      scaleTuning.hScale.value,
      scaleTuning.vExag.value,
      (x, z) => terrain.getHeightAt(x, z),
      utilityCorridorWorldBounds(),
      sun.getShadowGenerator(),
    );
    utilityCorridors.setVisible(visibility.powerLines.value);
    applyPlayerColliders();
  };

  // Forest fire game mechanic — press F to ignite the nearest tree; fire
  // spreads through neighboring trees over time. Reuses treePointsInRegion()
  // (not the full candidate pool), so it can't ignite trees outside that
  // region — treeRegionRadius has no live HUD control anymore, so this pool
  // is fixed for the session once built.
  let forestFire = new ForestFire(scene, treePointsInRegion(), {
    horizontalScale: scaleTuning.hScale.value,
    verticalExaggeration: scaleTuning.vExag.value,
  });
  const igniteAtActiveController = () => {
    const pos = controllers[movement.activeMode.value].getPosition();
    forestFire.ignite(pos.x / scaleTuning.hScale.value, pos.z / scaleTuning.hScale.value);
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') igniteAtActiveController();
  });

  // Extra lift on top of both grounded controllers' own (scale-adjusted)
  // eye height — levels with a shrunk player (playerScale < 1) otherwise
  // put the camera uncomfortably close to the ground.
  const movement = createMovementSignals({
    activeMode: 'walk',
    cameraHeightOffset: savedSettings.cameraHeightOffset ?? 1.5,
  });
  player.setHeightOffset(movement.cameraHeightOffset.value);
  drive.setHeightOffset(movement.cameraHeightOffset.value);

  // Structural shape shared by all three controllers — lets mode-switching
  // logic below treat them uniformly instead of branching per mode.
  type TraversalController = {
    readonly camera: FreeCamera;
    update(dt: number): void;
    getPosition(): Vector3;
    setPosition(pos: Vector3): void;
    clearLookDelta(): void;
  };
  const controllers: Record<ActiveMode, TraversalController> = { walk: player, fly: flight, drive };
  scene.activeCamera = player.camera;

  const switchMode = (newMode: ActiveMode) => {
    if (newMode === movement.activeMode.value) return;
    const from = controllers[movement.activeMode.value];
    const to = controllers[newMode];
    const pos = from.getPosition();
    if (newMode === 'fly') {
      // Hover right where the previous controller left off.
      to.setPosition(pos);
    } else {
      // Landing (Walk/Drive are both grounded) — snap to the terrain at
      // this XZ immediately rather than leaving a mid-air position visible
      // even for one frame.
      const groundY = terrain.getHeightAt(pos.x, pos.z);
      to.setPosition(new Vector3(pos.x, groundY, pos.z));
    }
    to.camera.rotation.copyFrom(from.camera.rotation);
    to.clearLookDelta();
    movement.activeMode.value = newMode;
    scene.activeCamera = to.camera;
  };

  // Restore whichever mode was active last session, if any.
  const validModes: ActiveMode[] = ['walk', 'fly', 'drive'];
  if (savedSettings.activeMode && validModes.includes(savedSettings.activeMode)) {
    switchMode(savedSettings.activeMode);
  }

  // Live scale tuning — level 1 only. Rebuilds the terrain mesh and both
  // trail overlays from scratch with new scale values, preserving the
  // active camera's real-world lat/long (and, for fly mode, its height
  // above ground) across the rebuild so changing a slider doesn't strand
  // you somewhere unrelated to where you were. hScale/vExag/waterLevel
  // signals exist for every level (see scaleTuning's own comment) — only
  // this rebuild function and the slider UI below are level-1-gated.
  const rebuildWorld = (newHScale: number, newVExag: number) => {
    const activeController = controllers[movement.activeMode.value];
    const beforePos = activeController.getPosition();
    const beforeGroundY = terrain.getHeightAt(beforePos.x, beforePos.z);
    const heightAboveGround = beforePos.y - beforeGroundY;
    const realX = beforePos.x / scaleTuning.hScale.value;
    const realZ = beforePos.z / scaleTuning.hScale.value;

    water.removeFromRenderList(terrain.getMesh());
    terrain.dispose();
    trailMeshes.forEach((m) => m.dispose());
    gpxMeshes.forEach((m) => m.dispose());
    gridMeshes.forEach((m) => m.dispose());

    scaleTuning.hScale.value = newHScale;
    scaleTuning.vExag.value = newVExag;

    terrain = new HeightmapTerrain(scene, sampler, contract, origin, {
      gridResolution: level.gridResolution,
      verticalExaggeration: scaleTuning.vExag.value,
      horizontalScale: scaleTuning.hScale.value,
      lowElevationColor: Color3.FromHexString(atmosphere.terrainLowColor.value),
      highElevationColor: Color3.FromHexString(atmosphere.terrainHighColor.value),
      slopeTextures: TERRAIN_SLOPE_TEXTURES,
    });
    trailMeshes = buildPolylineMeshes(scene, trails, terrain, origin, {
      namePrefix: 'osmTrail',
      yLift: OSM_TRAIL_Y_LIFT,
      horizontalScale: scaleTuning.hScale.value,
      colorFor: blazeColorFromTags,
    });
    gpxMeshes = buildPolylineMeshes(scene, gpxTrack, terrain, origin, {
      namePrefix: 'gpxTrack',
      yLift: GPX_TRACK_Y_LIFT,
      horizontalScale: scaleTuning.hScale.value,
      colorFor: () => GPX_TRACK_COLOR,
    });
    gridMeshes = buildGridMeshes(scene, gridLines, terrain, origin, scaleTuning.hScale.value);
    terrain.setVisible(visibility.terrain.value);
    setMeshesEnabled(trailMeshes, visibility.osm.value);
    setMeshesEnabled(gpxMeshes, visibility.gpx.value);
    setMeshesEnabled(gridMeshes, visibility.grid.value);
    player.setTerrain(terrain);
    drive.setTerrain(terrain);
    water.setScale(scaleTuning.hScale.value, scaleTuning.vExag.value, scaleTuning.waterLevel.value);
    water.addToRenderList(terrain.getMesh());
    rebuildTrailsideScatter();
    rebuildLocationProps();

    rebuildClouds();
    rebuildMountains();

    // Positions are cached (treePoints), so this just re-scatters the same
    // candidate points at the new scale rather than re-rolling placement.
    repositionBulkForest();
    forestFire.setScale(scaleTuning.hScale.value, scaleTuning.vExag.value);

    const newRenderX = realX * scaleTuning.hScale.value;
    const newRenderZ = realZ * scaleTuning.hScale.value;
    const newGroundY = terrain.getHeightAt(newRenderX, newRenderZ);
    if (movement.activeMode.value === 'fly') {
      activeController.setPosition(new Vector3(newRenderX, newGroundY + heightAboveGround, newRenderZ));
    } else {
      activeController.setPosition(new Vector3(newRenderX, newGroundY, newRenderZ));
    }
    persistSettings();
  };

  // Unlike H-scale/V-exagg (rebuildWorld, above — an expensive dispose/
  // recreate), moving the water plane doesn't touch terrain geometry at all
  // — just its own position — so this updates live on every drag tick.
  // hScale/vExag are peeked (not tracked) so this effect only re-runs on a
  // waterLevel change; rebuildWorld's own water.setScale call already
  // covers the hScale/vExag-changed case.
  effect(() => {
    water.setScale(scaleTuning.hScale.peek(), scaleTuning.vExag.peek(), scaleTuning.waterLevel.value);
  });

  render(
    <>
      <Section title='Movement'>
        <MovementRow
          signals={movement}
          onModeChange={(mode) => {
            switchMode(mode);
            persistSettings();
          }}
          onCameraHeightInput={(value) => {
            player.setHeightOffset(value);
            drive.setHeightOffset(value);
          }}
        />
      </Section>
      <Section title='Navigation & Views'>
        <ViewToolsRow
          buildSnapshot={() => {
            const activeCamera = controllers[movement.activeMode.value].camera;
            const pos = controllers[movement.activeMode.value].getPosition();
            return {
              level: levelKey,
              activeMode: movement.activeMode.value,
              x: pos.x,
              y: pos.y,
              z: pos.z,
              rotationX: activeCamera.rotation.x,
              rotationY: activeCamera.rotation.y,
              hScale: scaleTuning.hScale.value,
              vExag: scaleTuning.vExag.value,
              waterLevel: scaleTuning.waterLevel.value,
              cameraHeightOffset: movement.cameraHeightOffset.value,
              timeOfDay: atmosphere.timeOfDay.value,
              fogDensity: atmosphere.fogDensity.value,
              fogColor: atmosphere.fogColor.value,
              overcast: atmosphere.overcast.value,
              starCount: atmosphere.starCount.value,
              cloudCount: atmosphere.cloudCount.value,
              cloudColor: atmosphere.cloudColor.value,
              cloudOpacity: atmosphere.cloudOpacity.value,
              waterColor: atmosphere.waterColor.value,
              starColor: atmosphere.starColor.value,
              skyDayColor: atmosphere.skyDayColor.value,
              skyNightColor: atmosphere.skyNightColor.value,
              terrainLowColor: atmosphere.terrainLowColor.value,
              terrainHighColor: atmosphere.terrainHighColor.value,
              sunTint: atmosphere.sunTint.value,
              windowTintColor: atmosphere.windowTintColor.value,
              windowGlow: atmosphere.windowGlow.value,
              treeRegionRadius: treeRegionRadius.value,
              trailsideHScale: trailsideScale.hScale.value,
              trailsideVScale: trailsideScale.vScale.value,
              trailsideCount: trailsideScale.count.value,
              bulkForestHScale: bulkForestScale.hScale.value,
              bulkForestVScale: bulkForestScale.vScale.value,
              bulkForestCount: bulkForestScale.count.value,
              bulkForestRadius: bulkForestRadius.value,
              weatherMode: weatherMode.value,
              masterMuted: audio.masterMuted.value,
              windVolume: audio.windVolume.value,
              footstepMuted: audio.footstepMuted.value,
              breathMuted: audio.breathMuted.value,
            };
          }}
          levelKey={levelKey}
          validLevelKeys={Object.keys(LEVELS)}
          saveSettings={saveSettings}
          onBeforeNavigate={unregisterBeforeNavigate}
          savedViews={savedViews}
        />
        <GotoRow
          onGo={(lat, lon) => {
            const real = latLonToWorld({ lat, lon }, origin);
            const renderX = real.x * scaleTuning.hScale.value;
            const renderZ = real.z * scaleTuning.hScale.value;
            const groundY = terrain.getHeightAt(renderX, renderZ);
            const activeController = controllers[movement.activeMode.value];
            if (movement.activeMode.value === 'fly') {
              // Hover well above ground so the destination is actually
              // visible, rather than dropping you right at ground level
              // facing who-knows-where.
              activeController.setPosition(new Vector3(renderX, groundY + 50, renderZ));
            } else {
              activeController.setPosition(new Vector3(renderX, groundY, renderZ));
            }
          }}
          getCurrentLatLon={() => {
            const pos = controllers[movement.activeMode.value].getPosition();
            const real = { x: pos.x / scaleTuning.hScale.value, z: pos.z / scaleTuning.hScale.value };
            return worldToLatLon(real, origin);
          }}
          onResetPosition={() => {
            // Fly Mode has no bounds clamping, so it's easy to end up saved
            // somewhere far outside the DEM's real footprint (nothing but
            // sky, a distant sliver of terrain). This drops just the saved
            // position for the current level (keeping scale/water/camera-
            // height tuning intact) and reloads back to the recorded hike's
            // trailhead.
            unregisterBeforeNavigate();
            const withoutPosition = loadSavedSettings(levelKey);
            delete withoutPosition.x;
            delete withoutPosition.y;
            delete withoutPosition.z;
            saveSettings(levelKey, withoutPosition);
            location.reload();
          }}
          locations={locations}
        />
        <RouteRecorder
          storageKey='trail-viewer.route-recorder.v1'
          getCurrentSample={() => {
            const pos = controllers[movement.activeMode.value].getPosition();
            const real = { x: pos.x / scaleTuning.hScale.value, z: pos.z / scaleTuning.hScale.value };
            const latLon = worldToLatLon(real, origin);
            return {
              ...latLon,
              heightmap: sampler.sampleHeight(real),
              worldX: real.x,
              worldZ: real.z,
            } satisfies RouteSample;
          }}
        />
        <RouteReplay
          routes={replayRoutes}
          onSeek={({ lat, lon }) => {
            const real = latLonToWorld({ lat, lon }, origin);
            const renderX = real.x * scaleTuning.hScale.value;
            const renderZ = real.z * scaleTuning.hScale.value;
            const groundY = terrain.getHeightAt(renderX, renderZ);
            const activeController = controllers[movement.activeMode.value];
            const y = movement.activeMode.value === 'fly' ? groundY + 5 : groundY;
            activeController.setPosition(new Vector3(renderX, y, renderZ));
          }}
        />
      </Section>
    </>,
    document.getElementById('mode-controls-root') as HTMLDivElement,
  );

  const SAVE_INTERVAL_SECONDS = 2;
  let timeSinceSave = 0;
  const persistSettings = () => {
    const activeCamera = controllers[movement.activeMode.value].camera;
    const pos = controllers[movement.activeMode.value].getPosition();
    saveSettings(levelKey, {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      rotationX: activeCamera.rotation.x,
      rotationY: activeCamera.rotation.y,
      activeMode: movement.activeMode.value,
      hScale: scaleTuning.hScale.value,
      vExag: scaleTuning.vExag.value,
      waterLevel: scaleTuning.waterLevel.value,
      cameraHeightOffset: movement.cameraHeightOffset.value,
      timeOfDay: atmosphere.timeOfDay.value,
      fogDensity: atmosphere.fogDensity.value,
      fogColor: atmosphere.fogColor.value,
      overcast: atmosphere.overcast.value,
      starCount: atmosphere.starCount.value,
      cloudCount: atmosphere.cloudCount.value,
      cloudColor: atmosphere.cloudColor.value,
      cloudOpacity: atmosphere.cloudOpacity.value,
      waterColor: atmosphere.waterColor.value,
      starColor: atmosphere.starColor.value,
      skyDayColor: atmosphere.skyDayColor.value,
      skyNightColor: atmosphere.skyNightColor.value,
      terrainLowColor: atmosphere.terrainLowColor.value,
      terrainHighColor: atmosphere.terrainHighColor.value,
      sunTint: atmosphere.sunTint.value,
      windowTintColor: atmosphere.windowTintColor.value,
      windowGlow: atmosphere.windowGlow.value,
      treeRegionRadius: treeRegionRadius.value,
      trailsideHScale: trailsideScale.hScale.value,
      trailsideVScale: trailsideScale.vScale.value,
      trailsideCount: trailsideScale.count.value,
      bulkForestHScale: bulkForestScale.hScale.value,
      bulkForestVScale: bulkForestScale.vScale.value,
      bulkForestCount: bulkForestScale.count.value,
      bulkForestRadius: bulkForestRadius.value,
      weatherMode: weatherMode.value,
      hudVisible,
      worldBounded: worldBounded.value,
      masterMuted: audio.masterMuted.value,
      windVolume: audio.windVolume.value,
      footstepMuted: audio.footstepMuted.value,
      breathMuted: audio.breathMuted.value,
    });
  };
  window.addEventListener('beforeunload', persistSettings);
  window.addEventListener('pagehide', persistSettings);

  const gameLoop = new GameLoop(engine, (dt) => {
    controllers[movement.activeMode.value].update(dt);
    clampToWorldBounds(controllers[movement.activeMode.value]);
    clouds.update(dt);
    weatherSystem.update(dt, (windIntensity) => {
      ambientAudio.setWeatherIntensity(windIntensity * audio.windVolume.value);
    });
    forestFire.update(dt);

    // Breath/footsteps: PlayerController (walk) is the only controller with
    // a BreathSystem — Fly/Drive are deliberately simpler traversal tools
    // with no breath/adrenaline (see their own file comments) — so this
    // only runs while walking, and stops footsteps immediately otherwise.
    const breathReadout = document.getElementById('breath-load-value');
    if (movement.activeMode.value === 'walk') {
      const breathLoad = player.breath.getLoad();
      trailPlayerAudio.updateBreath(breathLoad);
      trailPlayerAudio.updateFootsteps(player.getSpeed());
      if (breathReadout) breathReadout.textContent = `${Math.round(breathLoad * 100)}%`;
    } else {
      trailPlayerAudio.updateFootsteps(0);
      if (breathReadout) breathReadout.textContent = '—';
    }

    const pos = controllers[movement.activeMode.value].getPosition();
    const groundY = terrain.getHeightAt(pos.x, pos.z);
    const real = { x: pos.x / scaleTuning.hScale.value, z: pos.z / scaleTuning.hScale.value };
    const latLon = worldToLatLon(real, origin);
    const controlsHint =
      movement.activeMode.value === 'fly'
        ? 'click canvas to look around, WASD to fly, space/ctrl up/down, shift to boost'
        : movement.activeMode.value === 'drive'
          ? 'click canvas to look around, WASD to drive, shift to boost'
          : 'click canvas to look around, WASD to move, shift to run';
    readout.textContent =
      `${movement.activeMode.value}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})\n` +
      `lat/lon: ${latLon.lat.toFixed(6)}, ${latLon.lon.toFixed(6)}\n` +
      `ground below: ${groundY.toFixed(1)}m\n` +
      `fps: ${engine.getFps().toFixed(0)}\n` +
      controlsHint;
    scene.render();

    timeSinceSave += dt;
    if (timeSinceSave >= SAVE_INTERVAL_SECONDS) {
      timeSinceSave = 0;
      persistSettings();
    }
  });
  hideLoadingOverlay();
  gameLoop.start();
}

main();
