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
} from '@babylonjs/core';
import { GameLoop } from '@dissonance/engine';
import {
  HeightmapTerrain, WaterPlane, defaultWaterLevel, DriftingClouds, Sun, sunHeightForHour, StarField,
  ThinInstanceTrees, ForestFire, WeatherSystem,
  type ITerrain, type TreePoint,
} from '@dissonance/world';
import { PlayerController, FlightController, DriveController } from '@dissonance/player';
import { AmbientAudio, AudioEngine, HeartbeatAudio, TrailPlayerAudio } from '@dissonance/audio';
import type { WeatherMode } from '@dissonance/shared-types';
import {
  decodeHeightmapPng,
  HeightmapSampler,
  originFromBoundingBox,
  latLonToWorld,
  worldToLatLon,
  parseGeoJsonTrails,
  parseGpxTrack,
  type HeightmapContract,
  type GeoPolyline,
  type UtmCoordinate,
} from '@dissonance/geo';
import { render } from 'preact';
import type { JSX } from 'preact';
import { signal, effect } from '@preact/signals';
import { createAtmosphereSignals } from './state/atmosphere';
import { createMovementSignals, type ActiveMode } from './state/movement';
import { createScaleTuningSignals } from './state/scaleTuning';
import { createVisibilitySignals } from './state/visibility';
import { createAudioSignals } from './state/audio';
import { AtmosphereRow } from './ui/AtmosphereRow';
import { VisibilityToggles, ToggleLabel } from './ui/VisibilityToggles';
import { MovementRow } from './ui/MovementRow';
import { ScaleTuningRow } from './ui/ScaleTuningRow';
import { TreeCountRow } from './ui/TreeCountRow';
import { ViewToolsRow, type SavedView } from './ui/ViewToolsRow';
import { GotoRow } from './ui/GotoRow';
import { Section } from './ui/Section';
import { AudioRow } from './ui/AudioRow';

const OSM_TRAIL_Y_LIFT = 0.5;
// Slightly higher than the OSM trails so the recorded track sits visibly on
// top of them instead of z-fighting where the two coincide.
const GPX_TRACK_Y_LIFT = 0.7;
const GPX_TRACK_COLOR = new Color3(1.0, 0.1, 0.1);

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
  '1': { label: 'Level 1: exaggerated relief, shrunk player', gridResolution: 700, verticalExaggeration: 10, horizontalScale: 1, playerScale: 0.1, farClip: 10000, cameraMode: 'player', flightSpeed: 30 },
  // gridResolution bumped to partially offset horizontalScale stretching
  // each mesh quad ~7x wider once rendered (700 alone would make ~57m
  // quads — coarse enough up close to visibly diverge from getHeightAt's
  // precise DEM sampling; 1000 brings that down to ~40m, still coarser
  // than level 1 but less extreme). farClip raised well past the ~40km
  // rendered world diagonal so distant terrain doesn't just vanish.
  '2': { label: 'Level 2: uniform 7x world scale', gridResolution: 1000, verticalExaggeration: 7, horizontalScale: 7, playerScale: 1, farClip: 60000, cameraMode: 'player', flightSpeed: 210 },
  '3': { label: 'Level 3: true scale, orbit view', gridResolution: 700, verticalExaggeration: 1, horizontalScale: 1, playerScale: 1, farClip: 10000, cameraMode: 'orbit', flightSpeed: 30 },
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
  treeCount?: number;
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

function buildPolylineMeshes(
  scene: Scene,
  polylines: GeoPolyline[],
  terrain: ITerrain,
  origin: UtmCoordinate,
  options: { namePrefix: string; yLift: number; horizontalScale: number; colorFor: (tags?: Record<string, string>) => Color3 },
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

// Covers the black screen during initial load and during the several
// reload()/href navigations this app does on purpose (Load View,
// reset-position, the saved-views dropdown) — hidden once the scene is
// actually ready to render, right before each branch's gameLoop.start().
function hideLoadingOverlay(): void {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

async function main() {
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
  // Preact-rendered #atmosphere-root panel mounted further down. treeCount
  // isn't among them; its default depends on maxTreeCount, which isn't
  // known until the tree-candidate pool below is built (see there).
  const atmosphere = createAtmosphereSignals({
    timeOfDay: savedSettings.timeOfDay ?? 12,
    fogDensity: savedSettings.fogDensity ?? 0,
    fogColor: savedSettings.fogColor ?? '#8ca6c7',
    overcast: savedSettings.overcast ?? false,
    starCount: savedSettings.starCount ?? 800,
    cloudCount: savedSettings.cloudCount ?? 16,
    cloudColor: savedSettings.cloudColor ?? '#e6e6eb',
    cloudOpacity: savedSettings.cloudOpacity ?? 0.75,
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
  const sun = new Sun(scene, { hour: atmosphere.timeOfDay.value });
  let stars = new StarField(scene, { count: atmosphere.starCount.value });

  const SKY_DAY = new Color4(0.55, 0.65, 0.78, 1);
  const SKY_NIGHT = new Color4(0.02, 0.03, 0.08, 1);
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
    scene.clearColor = Color4.Lerp(SKY_NIGHT, SKY_DAY, dayFactor);
    stars.setNightFactor(1 - dayFactor);
    ambientAudio.setNightLevel(1 - dayFactor);
  };
  // Reads atmosphere.overcast.value too (inside applyTimeOfDay), so this
  // effect also re-runs on an overcast toggle — the overcast checkbox's own
  // commit handler below only needs to trigger rebuildClouds(), not repeat
  // this call itself.
  effect(() => applyTimeOfDay(atmosphere.timeOfDay.value));

  scene.fogMode = Scene.FOGMODE_EXP2;
  effect(() => { scene.fogDensity = atmosphere.fogDensity.value; });
  effect(() => { scene.fogColor = Color3.FromHexString(atmosphere.fogColor.value); });

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
  });

  // Stand-in water: the DEM has no tagged lake/river geometry to trace (see
  // WaterPlane's own comment), so this is a flat plane at a configurable
  // elevation rather than a real water body traced from OSM data.
  const water = new WaterPlane(scene, contract, origin, {
    level: scaleTuning.waterLevel.value,
    verticalExaggeration: scaleTuning.vExag.value,
    horizontalScale: scaleTuning.hScale.value,
  });
  water.addToRenderList(terrain.getMesh());

  // Scattered once in real (unscaled) world space, independent of hScale/
  // vExag, so a rescale re-renders the same forest instead of re-rolling
  // different tree positions. World space is centered on the bbox (see
  // originFromBoundingBox/utmToWorld — origin = bbox center, so real world
  // X/Z each span [-width/2, width/2]). Skips low-elevation ground near the
  // waterline: there's no land-use data in this dataset to distinguish
  // actual forest from the built-up flat area visible near the coast (see
  // smr-trails.geojson — trail lines only, no polygons), so elevation is a
  // simple stand-in for "this is probably slope, not town."
  // Thin instancing keeps the GPU draw-call cost of *rendering* trees flat
  // regardless of count (a handful of draw calls per template — see
  // ThinInstanceTrees — however many instances ride along), so the real
  // constraint is candidate generation + per-instance matrix upload, which
  // stays cheap even at high counts on integrated graphics. 8000 is a
  // deliberate ceiling picked for that reason (not an incidental one), with
  // some headroom in the candidate pool above it since the elevation filter
  // below discards some fraction of attempts.
  const MAX_TREE_COUNT = 8000;
  const TREE_CANDIDATE_COUNT = 10000;
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
    if (groundY < scaleTuning.waterLevel.value + TREE_CLEARANCE_ABOVE_WATER) continue;
    treePoints.push({ x, z, groundY });
  }
  const maxTreeCount = Math.min(treePoints.length, MAX_TREE_COUNT);
  // Created here rather than in state/atmosphere.ts's factory — its default
  // depends on maxTreeCount, which is only known now (see AtmosphereRow's
  // props, where this is merged back in alongside the other 6 signals).
  const treeCount = signal(Math.min(savedSettings.treeCount ?? maxTreeCount, maxTreeCount));
  let trees = new ThinInstanceTrees(scene);
  trees.scatter(treePoints.slice(0, treeCount.value), scaleTuning.hScale.value, scaleTuning.vExag.value);
  const rebuildTrees = () => {
    trees.dispose();
    trees = new ThinInstanceTrees(scene);
    trees.scatter(treePoints.slice(0, treeCount.value), scaleTuning.hScale.value, scaleTuning.vExag.value);
    trees.setVisible(visibility.trees.value);
  };

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
    altitudeMin: (atmosphere.overcast.value ? contract.elevation.max + 150 : contract.elevation.max + 250) * currentVExag,
    altitudeMax: (atmosphere.overcast.value ? contract.elevation.max + 220 : contract.elevation.max + 450) * currentVExag,
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
  let clouds = new DriftingClouds(scene, cloudOptionsFor(scaleTuning.hScale.value, scaleTuning.vExag.value, atmosphere.cloudCount.value));
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
    clouds = new DriftingClouds(scene, cloudOptionsFor(scaleTuning.hScale.value, scaleTuning.vExag.value, atmosphere.cloudCount.value));
    clouds.getMeshes().forEach((m) => water.addToRenderList(m));
    clouds.setVisible(visibility.clouds.value);
  };

  const [trails, gpxTrack, savedViews] = await Promise.all([loadTrails(), loadGpxTrack(), loadSavedViews()]);
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

  const readout = document.getElementById('readout') as HTMLDivElement;
  const levelLabel = document.getElementById('level-label') as HTMLDivElement;
  levelLabel.textContent = level.label;

  // All toggle checkboxes in one place — visibility (6) + Overcast (was in
  // AtmosphereRow) + Bounded world (was in MovementRow, player-mode only).
  // Grid instead of one-per-line: that stacked layout was the whole reason
  // this pass started (see THREADS.md). VisibilityToggles returns a
  // Fragment, so its <label> children land as direct grid-item siblings of
  // the Overcast/Bounded-world labels below — one flat grid, not nested.
  render(
    <Section title="Toggles">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: '10px' }}>
        <VisibilityToggles
          signals={visibility}
          onTerrainCommit={(checked) => terrain.setVisible(checked)}
          onOsmCommit={(checked) => setMeshesEnabled(trailMeshes, checked)}
          onGpxCommit={(checked) => setMeshesEnabled(gpxMeshes, checked)}
          onWaterCommit={(checked) => water.setVisible(checked)}
          onCloudsCommit={(checked) => clouds.setVisible(checked)}
          onTreesCommit={(checked) => trees.setVisible(checked)}
        />
        <ToggleLabel label="Overcast" signal={atmosphere.overcast} onCommit={() => rebuildClouds()} />
        {/* Not a ToggleLabel — weatherMode is 'clear'|'windy', not a plain
            boolean signal, so it needs its own checked/onChange conversion
            rather than ToggleLabel's Signal<boolean> contract. */}
        <label>
          <input
            type="checkbox"
            checked={weatherMode.value === 'windy'}
            onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
              weatherMode.value = e.currentTarget.checked ? 'windy' : 'clear';
              weatherSystem.setMode(weatherMode.value);
              rebuildClouds();
            }}
          /> Windy
        </label>
        {level.cameraMode !== 'orbit' && (
          <ToggleLabel label="Bounded world" signal={worldBounded} onCommit={() => {}} />
        )}
      </div>
    </Section>,
    document.getElementById('toggles-root') as HTMLDivElement,
  );

  // World — level-1-only scale-tuning (H-scale/V-exagg/water-level) plus
  // tree count, which (unlike H/V/water) applies on every level, so it
  // mounts unconditionally while ScaleTuningRow stays gated beneath it.
  // Tree count moved here from Sky/Atmosphere — it's world/terrain density,
  // not a sky control (see TreeCountRow's own comment). Mounted into its
  // own root (right after Toggles in index.html's DOM order) so "what the
  // terrain looks like" controls read as one group, even though the
  // underlying signals (created earlier) and the rebuild logic they
  // trigger stay exactly where they were.
  render(
    <Section title="World">
      <TreeCountRow signal={treeCount} max={maxTreeCount} onCommit={() => rebuildTrees()} />
      {levelKey === '1' && (
        <ScaleTuningRow
          signals={scaleTuning}
          waterMin={contract.elevation.min}
          waterMax={contract.elevation.max}
          waterStep={(contract.elevation.max - contract.elevation.min) / 200}
          onScaleCommit={() => rebuildWorld(scaleTuning.hScale.value, scaleTuning.vExag.value)}
        />
      )}
    </Section>,
    document.getElementById('world-root') as HTMLDivElement,
  );

  // Sky controls — mounted here (before the orbit early-return below)
  // rather than alongside movement-mode/camera-height, since time-of-day/
  // fog/stars/clouds all render in orbit mode (level 3) too, unlike
  // Walk/Fly/Drive which orbit has no equivalent of. Preact-rendered pilot
  // (see docs/THREADS.md); commit handlers below mirror the dispose/
  // recreate bodies the old change-listeners used 1:1.
  render(
    <Section title="Sky">
      <AtmosphereRow
        signals={atmosphere}
        onStarCountCommit={() => {
          stars.dispose();
          stars = new StarField(scene, { count: atmosphere.starCount.value });
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
    <Section title="Audio">
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
  const applyHudVisible = () => { uiPanel.style.display = hudVisible ? 'block' : 'none'; };
  applyHudVisible();
  hudToggleButton.addEventListener('click', () => {
    hudVisible = !hudVisible;
    applyHudVisible();
    // persistSettings (and the position/mode state it reads) doesn't apply
    // in orbit mode — see SavedSettings' own comment on why.
    if (level.cameraMode !== 'orbit') persistSettings();
  });

  // Unregisters the beforeunload/pagehide autosave listeners right before a
  // reload/navigate — used by both ViewToolsRow's Load View handler and its
  // reset-position button. reload()/href fire beforeunload/pagehide on the
  // page being torn down *before* the new one loads; persistSettings would
  // otherwise immediately re-persist the current (unrelated/stranded)
  // in-memory state and clobber whatever was just written a moment later.
  // A no-op in orbit mode, where persistSettings is never registered in the
  // first place (see SavedSettings' own comment).
  const unregisterAutosave = () => {
    if (level.cameraMode !== 'orbit') {
      window.removeEventListener('beforeunload', persistSettings);
      window.removeEventListener('pagehide', persistSettings);
    }
  };

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
      <Section title="Navigation & Views">
        <ViewToolsRow
          buildSnapshot={() => ({
            level: levelKey,
            orbitTargetX: orbitCamera.target.x, orbitTargetY: orbitCamera.target.y, orbitTargetZ: orbitCamera.target.z,
            orbitAlpha: orbitCamera.alpha, orbitBeta: orbitCamera.beta, orbitRadius: orbitCamera.radius,
            hScale: scaleTuning.hScale.value, vExag: scaleTuning.vExag.value, waterLevel: scaleTuning.waterLevel.value,
            timeOfDay: atmosphere.timeOfDay.value, fogDensity: atmosphere.fogDensity.value, fogColor: atmosphere.fogColor.value,
            overcast: atmosphere.overcast.value, starCount: atmosphere.starCount.value, cloudCount: atmosphere.cloudCount.value,
            cloudColor: atmosphere.cloudColor.value, cloudOpacity: atmosphere.cloudOpacity.value,
            treeCount: treeCount.value, weatherMode: weatherMode.value,
            masterMuted: audio.masterMuted.value, windVolume: audio.windVolume.value,
            footstepMuted: audio.footstepMuted.value, breathMuted: audio.breathMuted.value,
          })}
          levelKey={levelKey}
          validLevelKeys={Object.keys(LEVELS)}
          saveSettings={saveSettings}
          onBeforeNavigate={unregisterAutosave}
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
  const flight = new FlightController(scene, startPosition.clone(), { farClip: level.farClip, speed: level.flightSpeed });

  // Same idea as Fly, but grounded — WASD at flight-grade speed with Y
  // snapped to the terrain every frame, for players who want to cover
  // ground quickly without losing their footing on the map.
  const drive = new DriveController(scene, startPosition.clone(), {
    farClip: level.farClip,
    speed: level.flightSpeed,
    scale: level.playerScale,
  });
  drive.setTerrain(terrain);

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

  // Forest fire game mechanic — press F (or the HUD button) to ignite the
  // nearest tree; fire spreads through neighboring trees over time. Reuses
  // the same treePoints the forest was scattered from, rather than any
  // per-instance state on the tree meshes themselves (see ForestFire's own
  // comment on why).
  const forestFire = new ForestFire(scene, treePoints, { horizontalScale: scaleTuning.hScale.value, verticalExaggeration: scaleTuning.vExag.value });
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

    scaleTuning.hScale.value = newHScale;
    scaleTuning.vExag.value = newVExag;

    terrain = new HeightmapTerrain(scene, sampler, contract, origin, {
      gridResolution: level.gridResolution,
      verticalExaggeration: scaleTuning.vExag.value,
      horizontalScale: scaleTuning.hScale.value,
    });
    trailMeshes = buildPolylineMeshes(scene, trails, terrain, origin, {
      namePrefix: 'osmTrail', yLift: OSM_TRAIL_Y_LIFT, horizontalScale: scaleTuning.hScale.value, colorFor: blazeColorFromTags,
    });
    gpxMeshes = buildPolylineMeshes(scene, gpxTrack, terrain, origin, {
      namePrefix: 'gpxTrack', yLift: GPX_TRACK_Y_LIFT, horizontalScale: scaleTuning.hScale.value, colorFor: () => GPX_TRACK_COLOR,
    });
    terrain.setVisible(visibility.terrain.value);
    setMeshesEnabled(trailMeshes, visibility.osm.value);
    setMeshesEnabled(gpxMeshes, visibility.gpx.value);
    player.setTerrain(terrain);
    drive.setTerrain(terrain);
    water.setScale(scaleTuning.hScale.value, scaleTuning.vExag.value, scaleTuning.waterLevel.value);
    water.addToRenderList(terrain.getMesh());

    rebuildClouds();

    // Positions are cached (treePoints), so this just re-scatters the
    // same forest at the new scale rather than re-rolling placement.
    rebuildTrees();
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
      <Section title="Movement">
        <MovementRow
          signals={movement}
          onModeChange={(mode) => { switchMode(mode); persistSettings(); }}
          onCameraHeightInput={(value) => {
            player.setHeightOffset(value);
            drive.setHeightOffset(value);
          }}
          onIgniteFire={igniteAtActiveController}
          onResetFire={() => forestFire.reset()}
        />
      </Section>
      <Section title="Navigation & Views">
        <ViewToolsRow
          buildSnapshot={() => {
            const activeCamera = controllers[movement.activeMode.value].camera;
            const pos = controllers[movement.activeMode.value].getPosition();
            return {
              level: levelKey,
              activeMode: movement.activeMode.value,
              x: pos.x, y: pos.y, z: pos.z,
              rotationX: activeCamera.rotation.x, rotationY: activeCamera.rotation.y,
              hScale: scaleTuning.hScale.value, vExag: scaleTuning.vExag.value, waterLevel: scaleTuning.waterLevel.value,
              cameraHeightOffset: movement.cameraHeightOffset.value,
              timeOfDay: atmosphere.timeOfDay.value, fogDensity: atmosphere.fogDensity.value, fogColor: atmosphere.fogColor.value,
              overcast: atmosphere.overcast.value, starCount: atmosphere.starCount.value, cloudCount: atmosphere.cloudCount.value,
              cloudColor: atmosphere.cloudColor.value, cloudOpacity: atmosphere.cloudOpacity.value,
              treeCount: treeCount.value, weatherMode: weatherMode.value,
              masterMuted: audio.masterMuted.value, windVolume: audio.windVolume.value,
              footstepMuted: audio.footstepMuted.value, breathMuted: audio.breathMuted.value,
            };
          }}
          levelKey={levelKey}
          validLevelKeys={Object.keys(LEVELS)}
          saveSettings={saveSettings}
          onBeforeNavigate={unregisterAutosave}
          onResetPosition={() => {
            // Fly Mode has no bounds clamping, so it's easy to end up saved
            // somewhere far outside the DEM's real footprint (nothing but
            // sky, a distant sliver of terrain). This drops just the saved
            // position for the current level (keeping scale/water/camera-
            // height tuning intact) and reloads back to the recorded hike's
            // trailhead.
            unregisterAutosave();
            const withoutPosition = loadSavedSettings(levelKey);
            delete withoutPosition.x;
            delete withoutPosition.y;
            delete withoutPosition.z;
            saveSettings(levelKey, withoutPosition);
            location.reload();
          }}
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
      x: pos.x, y: pos.y, z: pos.z,
      rotationX: activeCamera.rotation.x, rotationY: activeCamera.rotation.y,
      activeMode: movement.activeMode.value,
      hScale: scaleTuning.hScale.value, vExag: scaleTuning.vExag.value, waterLevel: scaleTuning.waterLevel.value,
      cameraHeightOffset: movement.cameraHeightOffset.value,
      timeOfDay: atmosphere.timeOfDay.value, fogDensity: atmosphere.fogDensity.value, fogColor: atmosphere.fogColor.value,
      overcast: atmosphere.overcast.value, starCount: atmosphere.starCount.value, cloudCount: atmosphere.cloudCount.value,
      cloudColor: atmosphere.cloudColor.value, cloudOpacity: atmosphere.cloudOpacity.value,
      treeCount: treeCount.value, weatherMode: weatherMode.value,
      hudVisible, worldBounded: worldBounded.value,
      masterMuted: audio.masterMuted.value, windVolume: audio.windVolume.value,
      footstepMuted: audio.footstepMuted.value, breathMuted: audio.breathMuted.value,
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
    const controlsHint = movement.activeMode.value === 'fly'
      ? 'click canvas to look around, WASD to fly, space/ctrl up/down, shift to boost'
      : movement.activeMode.value === 'drive'
      ? 'click canvas to look around, WASD to drive, shift to boost'
      : 'click canvas to look around, WASD to move, shift to run';
    readout.textContent =
      `${movement.activeMode.value}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})\n` +
      `ground below: ${groundY.toFixed(1)}m\n` +
      `fires burning: ${forestFire.activeFireCount} (F to ignite nearest tree)\n` +
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
