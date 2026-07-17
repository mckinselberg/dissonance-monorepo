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
  ThinInstanceTrees, ForestFire,
  type ITerrain, type TreePoint,
} from '@dissonance/world';
import { PlayerController, FlightController, DriveController } from '@dissonance/player';
import { preventAccidentalClose } from '@dissonance/utils';
import {
  decodeHeightmapPng,
  HeightmapSampler,
  originFromBoundingBox,
  latLonToWorld,
  parseGeoJsonTrails,
  parseGpxTrack,
  graticuleLines,
  type HeightmapContract,
  type GeoPolyline,
  type UtmCoordinate,
  type GraticuleLine,
} from '@dissonance/geo';
import { render } from 'preact';
import { signal, effect } from '@preact/signals';
import { createAtmosphereSignals } from './state/atmosphere';
import { AtmosphereRow } from './ui/AtmosphereRow';

const OSM_TRAIL_Y_LIFT = 0.5;
// Slightly higher than the OSM trails so the recorded track sits visibly on
// top of them instead of z-fighting where the two coincide.
const GPX_TRACK_Y_LIFT = 0.7;
const GPX_TRACK_COLOR = new Color3(1.0, 0.1, 0.1);

// Highest of the three drape lifts — the grid is a measurement layer that
// should read as sitting "above" both trail layers, not fighting either for
// z-order where they cross.
const GRID_Y_LIFT = 0.9;
// ~111m lat / ~84m lon at 40.7°N. Must match (or cleanly derive from) the
// placement-manifest cell interval once that lands in packages/geo — see
// the handoff prompt (latlong-grid-overlay-prompt-v1.md).
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
type ActiveMode = 'walk' | 'fly' | 'drive';

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
type SavedSettings = {
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
  starCount?: number;
  cloudCount?: number;
  treeCount?: number;
  hudVisible?: boolean;
  worldBounded?: boolean;
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

// Same drape path as buildPolylineMeshes (project -> scale -> getHeightAt +
// lift), kept as a separate function rather than folded into it because a
// GraticuleLine's points are plain LatLon (no tags/elevation/source), so
// there's nothing for options.colorFor to branch on — every grid line is
// the same color.
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

async function main() {
  preventAccidentalClose();

  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);

  const levelKey = currentLevelKey();
  const level = LEVELS[levelKey];
  const savedSettings = loadSavedSettings(levelKey);

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
  });

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
  };
  // Reads atmosphere.overcast.value too (inside applyTimeOfDay), so this
  // effect also re-runs on an overcast toggle — the overcast checkbox's own
  // commit handler below only needs to trigger rebuildClouds(), not repeat
  // this call itself.
  effect(() => applyTimeOfDay(atmosphere.timeOfDay.value));

  scene.fogMode = Scene.FOGMODE_EXP2;
  effect(() => { scene.fogDensity = atmosphere.fogDensity.value; });
  effect(() => { scene.fogColor = Color3.FromHexString(atmosphere.fogColor.value); });

  // Mutable — level 1 exposes live HUD sliders that rebuild the terrain
  // and trail/GPX overlays with new scale values (see the scale-tuning
  // section below). Every other read of "the current scale" in this
  // function goes through these two variables, not level.* directly, so a
  // live rescale stays consistent everywhere.
  let hScale = savedSettings.hScale ?? level.horizontalScale;
  let vExag = savedSettings.vExag ?? level.verticalExaggeration;

  const { contract, pngBytes } = await loadHeightmap();
  let waterLevel = savedSettings.waterLevel ?? defaultWaterLevel(contract);
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
    verticalExaggeration: vExag,
    horizontalScale: hScale,
  });

  // Stand-in water: the DEM has no tagged lake/river geometry to trace (see
  // WaterPlane's own comment), so this is a flat plane at a configurable
  // elevation rather than a real water body traced from OSM data.
  const water = new WaterPlane(scene, contract, origin, {
    level: waterLevel,
    verticalExaggeration: vExag,
    horizontalScale: hScale,
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
  let worldBounded = savedSettings.worldBounded ?? false;
  const clampToWorldBounds = (controller: { getPosition(): Vector3; setPosition(pos: Vector3): void }) => {
    if (!worldBounded) return;
    const pos = controller.getPosition();
    const maxX = (realWidth / 2) * hScale;
    const maxZ = (realDepth / 2) * hScale;
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
    if (groundY < waterLevel + TREE_CLEARANCE_ABOVE_WATER) continue;
    treePoints.push({ x, z, groundY });
  }
  const maxTreeCount = Math.min(treePoints.length, MAX_TREE_COUNT);
  // Created here rather than in state/atmosphere.ts's factory — its default
  // depends on maxTreeCount, which is only known now (see AtmosphereRow's
  // props, where this is merged back in alongside the other 6 signals).
  const treeCount = signal(Math.min(savedSettings.treeCount ?? maxTreeCount, maxTreeCount));
  let trees = new ThinInstanceTrees(scene);
  trees.scatter(treePoints.slice(0, treeCount.value), hScale, vExag);
  const rebuildTrees = () => {
    trees.dispose();
    trees = new ThinInstanceTrees(scene);
    trees.scatter(treePoints.slice(0, treeCount.value), hScale, vExag);
    trees.setVisible(treesToggle.checked);
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
    driftSpeed: 5 * currentHScale,
    color: atmosphere.overcast.value ? new Color3(0.55, 0.56, 0.58) : undefined,
    alpha: atmosphere.overcast.value ? 0.95 : undefined,
  });
  let clouds = new DriftingClouds(scene, cloudOptionsFor(hScale, vExag, atmosphere.cloudCount.value));
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
    clouds = new DriftingClouds(scene, cloudOptionsFor(hScale, vExag, atmosphere.cloudCount.value));
    clouds.getMeshes().forEach((m) => water.addToRenderList(m));
    clouds.setVisible(cloudsToggle.checked);
  };

  const [trails, gpxTrack] = await Promise.all([loadTrails(), loadGpxTrack()]);
  let trailMeshes = buildPolylineMeshes(scene, trails, terrain, origin, {
    namePrefix: 'osmTrail',
    yLift: OSM_TRAIL_Y_LIFT,
    horizontalScale: hScale,
    colorFor: blazeColorFromTags,
  });
  let gpxMeshes = buildPolylineMeshes(scene, gpxTrack, terrain, origin, {
    namePrefix: 'gpxTrack',
    yLift: GPX_TRACK_Y_LIFT,
    horizontalScale: hScale,
    colorFor: () => GPX_TRACK_COLOR,
  });

  // Generated once from the heightmap's real (unscaled) UTM bbox — the
  // lat/lon line values themselves don't depend on hScale/vExag, only the
  // meshes built from them do (see rebuildWorld below, which rebuilds
  // gridMeshes from this same `gridLines` array rather than regenerating it).
  const gridLines = graticuleLines(contract.bbox, GRID_INTERVAL_DEG, GRID_LINE_SAMPLES);
  let gridMeshes = buildGridMeshes(scene, gridLines, terrain, origin, hScale);

  const terrainToggle = document.getElementById('toggle-terrain') as HTMLInputElement;
  const osmToggle = document.getElementById('toggle-osm') as HTMLInputElement;
  const gpxToggle = document.getElementById('toggle-gpx') as HTMLInputElement;
  const waterToggle = document.getElementById('toggle-water') as HTMLInputElement;
  const cloudsToggle = document.getElementById('toggle-clouds') as HTMLInputElement;
  const treesToggle = document.getElementById('toggle-trees') as HTMLInputElement;
  const gridToggle = document.getElementById('toggle-grid') as HTMLInputElement;
  const readout = document.getElementById('readout') as HTMLDivElement;
  const levelLabel = document.getElementById('level-label') as HTMLDivElement;
  levelLabel.textContent = level.label;

  // Default off (see gridToggle's unchecked default in index.html) — the
  // grid is a measurement layer, not something a session should always pay
  // rendering cost for.
  setMeshesEnabled(gridMeshes, gridToggle.checked);

  terrainToggle.addEventListener('change', () => terrain.setVisible(terrainToggle.checked));
  osmToggle.addEventListener('change', () => setMeshesEnabled(trailMeshes, osmToggle.checked));
  gpxToggle.addEventListener('change', () => setMeshesEnabled(gpxMeshes, gpxToggle.checked));
  waterToggle.addEventListener('change', () => water.setVisible(waterToggle.checked));
  cloudsToggle.addEventListener('change', () => clouds.setVisible(cloudsToggle.checked));
  treesToggle.addEventListener('change', () => trees.setVisible(treesToggle.checked));
  gridToggle.addEventListener('change', () => setMeshesEnabled(gridMeshes, gridToggle.checked));

  // Atmosphere controls — mounted here (before the orbit early-return
  // below) rather than alongside movement-mode/camera-height, since fog/
  // time-of-day/stars/clouds all render in orbit mode (level 3) too, unlike
  // Walk/Fly/Drive which orbit has no equivalent of. Preact-rendered pilot
  // (see docs/THREADS.md); commit handlers below mirror the dispose/
  // recreate bodies the old change-listeners used 1:1.
  render(
    <AtmosphereRow
      signals={{ ...atmosphere, treeCount }}
      maxTreeCount={maxTreeCount}
      onStarCountCommit={() => {
        stars.dispose();
        stars = new StarField(scene, { count: atmosphere.starCount.value });
        stars.setNightFactor(1 - Math.max(0, sunHeightForHour(atmosphere.timeOfDay.value)));
      }}
      onCloudCountCommit={() => rebuildClouds()}
      onOvercastCommit={() => rebuildClouds()}
      onTreeCountCommit={() => rebuildTrees()}
    />,
    document.getElementById('atmosphere-root') as HTMLDivElement,
  );

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

  // Load View half of the Copy/Load View dev mechanism (see THREADS.md).
  // Writes the pasted snapshot straight into the target level's existing
  // settings-storage key, then reloads (same level) or navigates (a
  // different one) — reuses the restore-on-load path both branches below
  // already have, rather than a second parallel "apply this live" path.
  const loadViewInput = document.getElementById('load-view-input') as HTMLTextAreaElement;
  const loadViewButton = document.getElementById('load-view-button') as HTMLButtonElement;
  loadViewButton.addEventListener('click', () => {
    let snapshot: SavedSettings & { level?: string };
    try {
      snapshot = JSON.parse(loadViewInput.value);
    } catch {
      alert('Could not parse that as JSON.');
      return;
    }
    const targetLevel = snapshot.level;
    if (typeof targetLevel !== 'string' || !(targetLevel in LEVELS)) {
      alert('View JSON is missing a valid "level" field.');
      return;
    }
    const { level: _level, ...rest } = snapshot;
    // Same race as resetPositionButton: reload()/href fire beforeunload/
    // pagehide on the page being torn down *before* the new one loads —
    // persistSettings would otherwise immediately re-persist the current
    // (unrelated) in-memory state and clobber the snapshot we just wrote a
    // moment later. Doesn't apply in orbit mode — persistSettings is never
    // registered there in the first place (see SavedSettings' comment).
    if (level.cameraMode !== 'orbit') {
      window.removeEventListener('beforeunload', persistSettings);
      window.removeEventListener('pagehide', persistSettings);
    }
    saveSettings(targetLevel, rest);
    if (targetLevel === levelKey) {
      location.reload();
    } else {
      location.href = `?level=${targetLevel}`;
    }
  });

  const gotoLat = document.getElementById('goto-lat') as HTMLInputElement;
  const gotoLon = document.getElementById('goto-lon') as HTMLInputElement;
  const gotoButton = document.getElementById('goto-button') as HTMLButtonElement;
  const resetPositionButton = document.getElementById('reset-position-button') as HTMLButtonElement;
  // No meaningful position is ever saved for orbit mode (see SavedSettings'
  // comment) — hide the button there rather than leave it clickable but
  // broken (its handler below reaches into player-mode-only state that
  // orbit's early return means never gets declared).
  if (level.cameraMode === 'orbit') resetPositionButton.style.display = 'none';

  // Fly Mode has no bounds clamping, so it's easy to end up saved somewhere
  // far outside the DEM's real footprint (nothing but sky, a distant sliver
  // of terrain). This drops just the saved position for the current level
  // (keeping scale/water/camera-height tuning intact) and reloads back to
  // the recorded hike's trailhead.
  //
  // location.reload() fires beforeunload/pagehide on the page being torn
  // down *before* the new one loads — persistSettings (registered on those
  // events below) would otherwise immediately re-persist the still-in-memory
  // stranded position and undo this a moment later. Unregistering both first
  // prevents that race.
  resetPositionButton.addEventListener('click', () => {
    window.removeEventListener('beforeunload', persistSettings);
    window.removeEventListener('pagehide', persistSettings);
    const withoutPosition = loadSavedSettings(levelKey);
    delete withoutPosition.x;
    delete withoutPosition.y;
    delete withoutPosition.z;
    saveSettings(levelKey, withoutPosition);
    location.reload();
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

    const copyViewButton = document.getElementById('copy-view-button') as HTMLButtonElement;
    copyViewButton.addEventListener('click', () => {
      const snapshot: SavedSettings & { level: string } = {
        level: levelKey,
        orbitTargetX: orbitCamera.target.x, orbitTargetY: orbitCamera.target.y, orbitTargetZ: orbitCamera.target.z,
        orbitAlpha: orbitCamera.alpha, orbitBeta: orbitCamera.beta, orbitRadius: orbitCamera.radius,
        hScale, vExag, waterLevel,
        timeOfDay: atmosphere.timeOfDay.value, fogDensity: atmosphere.fogDensity.value, fogColor: atmosphere.fogColor.value,
        overcast: atmosphere.overcast.value, starCount: atmosphere.starCount.value, cloudCount: atmosphere.cloudCount.value,
        treeCount: treeCount.value,
      };
      navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      const original = copyViewButton.textContent;
      copyViewButton.textContent = 'Copied!';
      setTimeout(() => { copyViewButton.textContent = original; }, 1200);
    });

    gotoButton.addEventListener('click', () => {
      const lat = parseFloat(gotoLat.value);
      const lon = parseFloat(gotoLon.value);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return;
      const real = latLonToWorld({ lat, lon }, origin);
      const renderX = real.x * level.horizontalScale;
      const renderZ = real.z * level.horizontalScale;
      const groundY = terrain.getHeightAt(renderX, renderZ);
      // Re-centers the orbit pivot on the target point, keeping current
      // alpha/beta/radius (viewing angle/zoom) unchanged.
      orbitCamera.target = new Vector3(renderX, groundY, renderZ);
    });

    const gameLoop = new GameLoop(engine, (dt) => {
      clouds.update(dt);
      const pos = orbitCamera.position;
      const groundY = terrain.getHeightAt(pos.x, pos.z);
      readout.textContent =
        `camera: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})\n` +
        `ground under camera: ${groundY.toFixed(1)}m\n` +
        `left-drag to orbit, scroll to zoom, right-drag to pan`;
      scene.render();
    });
    gameLoop.start();
    return;
  }

  // Spawn at the recorded hike's own starting point — a real trailhead,
  // rather than an arbitrary bbox-center point that might not sit on a trail
  // — unless a saved position exists for this level from a previous visit.
  const spawnPoint = gpxTrack[0]?.points[0];
  const spawnReal = spawnPoint ? latLonToWorld(spawnPoint, origin) : { x: 0, z: 0 };
  const spawnRenderX = savedSettings.x ?? spawnReal.x * hScale;
  const spawnRenderZ = savedSettings.z ?? spawnReal.z * hScale;
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

  const copyViewButton = document.getElementById('copy-view-button') as HTMLButtonElement;
  copyViewButton.addEventListener('click', () => {
    const activeCamera = controllers[activeMode].camera;
    const pos = controllers[activeMode].getPosition();
    const snapshot: SavedSettings & { level: string } = {
      level: levelKey,
      activeMode,
      x: pos.x, y: pos.y, z: pos.z,
      rotationX: activeCamera.rotation.x, rotationY: activeCamera.rotation.y,
      hScale, vExag, waterLevel, cameraHeightOffset,
      timeOfDay: atmosphere.timeOfDay.value, fogDensity: atmosphere.fogDensity.value, fogColor: atmosphere.fogColor.value,
      overcast: atmosphere.overcast.value, starCount: atmosphere.starCount.value, cloudCount: atmosphere.cloudCount.value,
      treeCount: treeCount.value,
    };
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    const original = copyViewButton.textContent;
    copyViewButton.textContent = 'Copied!';
    setTimeout(() => { copyViewButton.textContent = original; }, 1200);
  });

  // Forest fire game mechanic — press F (or the HUD button) to ignite the
  // nearest tree; fire spreads through neighboring trees over time. Reuses
  // the same treePoints the forest was scattered from, rather than any
  // per-instance state on the tree meshes themselves (see ForestFire's own
  // comment on why).
  const forestFire = new ForestFire(scene, treePoints, { horizontalScale: hScale, verticalExaggeration: vExag });
  const igniteFireButton = document.getElementById('ignite-fire-button') as HTMLButtonElement;
  const resetFireButton = document.getElementById('reset-fire-button') as HTMLButtonElement;
  const igniteAtActiveController = () => {
    const pos = controllers[activeMode].getPosition();
    forestFire.ignite(pos.x / hScale, pos.z / hScale);
  };
  igniteFireButton.addEventListener('click', igniteAtActiveController);
  resetFireButton.addEventListener('click', () => forestFire.reset());
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') igniteAtActiveController();
  });

  // Extra lift on top of both grounded controllers' own (scale-adjusted)
  // eye height — levels with a shrunk player (playerScale < 1) otherwise
  // put the camera uncomfortably close to the ground.
  let cameraHeightOffset = savedSettings.cameraHeightOffset ?? 1.5;
  player.setHeightOffset(cameraHeightOffset);
  drive.setHeightOffset(cameraHeightOffset);

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
  let activeMode: ActiveMode = 'walk';
  scene.activeCamera = player.camera;

  const movementModeRow = document.getElementById('movement-mode-row') as HTMLDivElement;
  const movementModeSelect = document.getElementById('movement-mode') as HTMLSelectElement;
  movementModeRow.style.display = 'block';

  const cameraHeightSlider = document.getElementById('camera-height') as HTMLInputElement;
  const cameraHeightValue = document.getElementById('camera-height-value') as HTMLSpanElement;
  cameraHeightSlider.value = String(cameraHeightOffset);
  cameraHeightValue.textContent = cameraHeightOffset.toFixed(1);
  cameraHeightSlider.addEventListener('input', () => {
    cameraHeightOffset = parseFloat(cameraHeightSlider.value);
    cameraHeightValue.textContent = cameraHeightOffset.toFixed(1);
    player.setHeightOffset(cameraHeightOffset);
    drive.setHeightOffset(cameraHeightOffset);
  });

  const worldBoundedToggle = document.getElementById('toggle-world-bounded') as HTMLInputElement;
  worldBoundedToggle.checked = worldBounded;
  worldBoundedToggle.addEventListener('change', () => {
    worldBounded = worldBoundedToggle.checked;
  });

  const switchMode = (newMode: ActiveMode) => {
    if (newMode === activeMode) return;
    const from = controllers[activeMode];
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
    activeMode = newMode;
    scene.activeCamera = to.camera;
  };

  // Restore whichever mode was active last session, if any.
  const validModes: ActiveMode[] = ['walk', 'fly', 'drive'];
  if (savedSettings.activeMode && validModes.includes(savedSettings.activeMode)) {
    switchMode(savedSettings.activeMode);
  }
  movementModeSelect.value = activeMode;

  movementModeSelect.addEventListener('change', () => {
    switchMode(movementModeSelect.value as ActiveMode);
    persistSettings();
  });

  // Live scale tuning — level 1 only. Rebuilds the terrain mesh and both
  // trail overlays from scratch with new scale values, preserving the
  // active camera's real-world lat/long (and, for fly mode, its height
  // above ground) across the rebuild so changing a slider doesn't strand
  // you somewhere unrelated to where you were.
  if (levelKey === '1') {
    const scaleTuning = document.getElementById('scale-tuning') as HTMLDivElement;
    const hSlider = document.getElementById('scale-horizontal') as HTMLInputElement;
    const vSlider = document.getElementById('scale-vertical') as HTMLInputElement;
    const wSlider = document.getElementById('scale-water') as HTMLInputElement;
    const hValue = document.getElementById('scale-horizontal-value') as HTMLSpanElement;
    const vValue = document.getElementById('scale-vertical-value') as HTMLSpanElement;
    const wValue = document.getElementById('scale-water-value') as HTMLSpanElement;
    scaleTuning.style.display = 'block';
    hSlider.value = String(hScale);
    vSlider.value = String(vExag);
    hValue.textContent = String(hScale);
    vValue.textContent = String(vExag);
    // Real elevation range, not the rendered/exaggerated one — WaterPlane
    // takes its level in the same real (unscaled) meters as the DEM.
    wSlider.min = String(contract.elevation.min);
    wSlider.max = String(contract.elevation.max);
    wSlider.step = String((contract.elevation.max - contract.elevation.min) / 200);
    wSlider.value = String(waterLevel);
    wValue.textContent = waterLevel.toFixed(1);

    const rebuildWorld = (newHScale: number, newVExag: number) => {
      const activeController = controllers[activeMode];
      const beforePos = activeController.getPosition();
      const beforeGroundY = terrain.getHeightAt(beforePos.x, beforePos.z);
      const heightAboveGround = beforePos.y - beforeGroundY;
      const realX = beforePos.x / hScale;
      const realZ = beforePos.z / hScale;

      water.removeFromRenderList(terrain.getMesh());
      terrain.dispose();
      trailMeshes.forEach((m) => m.dispose());
      gpxMeshes.forEach((m) => m.dispose());
      gridMeshes.forEach((m) => m.dispose());

      hScale = newHScale;
      vExag = newVExag;

      terrain = new HeightmapTerrain(scene, sampler, contract, origin, {
        gridResolution: level.gridResolution,
        verticalExaggeration: vExag,
        horizontalScale: hScale,
      });
      trailMeshes = buildPolylineMeshes(scene, trails, terrain, origin, {
        namePrefix: 'osmTrail', yLift: OSM_TRAIL_Y_LIFT, horizontalScale: hScale, colorFor: blazeColorFromTags,
      });
      gpxMeshes = buildPolylineMeshes(scene, gpxTrack, terrain, origin, {
        namePrefix: 'gpxTrack', yLift: GPX_TRACK_Y_LIFT, horizontalScale: hScale, colorFor: () => GPX_TRACK_COLOR,
      });
      gridMeshes = buildGridMeshes(scene, gridLines, terrain, origin, hScale);
      terrain.setVisible(terrainToggle.checked);
      setMeshesEnabled(trailMeshes, osmToggle.checked);
      setMeshesEnabled(gpxMeshes, gpxToggle.checked);
      setMeshesEnabled(gridMeshes, gridToggle.checked);
      player.setTerrain(terrain);
      drive.setTerrain(terrain);
      water.setScale(hScale, vExag, waterLevel);
      water.addToRenderList(terrain.getMesh());

      rebuildClouds();

      // Positions are cached (treePoints), so this just re-scatters the
      // same forest at the new scale rather than re-rolling placement.
      rebuildTrees();
      forestFire.setScale(hScale, vExag);

      const newRenderX = realX * hScale;
      const newRenderZ = realZ * hScale;
      const newGroundY = terrain.getHeightAt(newRenderX, newRenderZ);
      if (activeMode === 'fly') {
        activeController.setPosition(new Vector3(newRenderX, newGroundY + heightAboveGround, newRenderZ));
      } else {
        activeController.setPosition(new Vector3(newRenderX, newGroundY, newRenderZ));
      }
      persistSettings();
    };

    hSlider.addEventListener('input', () => { hValue.textContent = hSlider.value; });
    vSlider.addEventListener('input', () => { vValue.textContent = vSlider.value; });
    // Rebuild on release (change), not on every drag tick — regenerating a
    // 700-subdivision mesh plus both trail overlays isn't cheap enough to
    // do smoothly on every intermediate slider value.
    hSlider.addEventListener('change', () => rebuildWorld(parseFloat(hSlider.value), vExag));
    vSlider.addEventListener('change', () => rebuildWorld(hScale, parseFloat(vSlider.value)));

    // Unlike H-scale/V-exagg, moving the water plane doesn't touch terrain
    // geometry at all — just its own position — so this can update live on
    // every drag tick instead of waiting for release.
    wSlider.addEventListener('input', () => {
      waterLevel = parseFloat(wSlider.value);
      wValue.textContent = waterLevel.toFixed(1);
      water.setScale(hScale, vExag, waterLevel);
    });
  }

  gotoButton.addEventListener('click', () => {
    const lat = parseFloat(gotoLat.value);
    const lon = parseFloat(gotoLon.value);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    const real = latLonToWorld({ lat, lon }, origin);
    const renderX = real.x * hScale;
    const renderZ = real.z * hScale;
    const groundY = terrain.getHeightAt(renderX, renderZ);
    const activeController = controllers[activeMode];
    if (activeMode === 'fly') {
      // Hover well above ground so the destination is actually visible,
      // rather than dropping you right at ground level facing who-knows-where.
      activeController.setPosition(new Vector3(renderX, groundY + 50, renderZ));
    } else {
      activeController.setPosition(new Vector3(renderX, groundY, renderZ));
    }
  });

  const SAVE_INTERVAL_SECONDS = 2;
  let timeSinceSave = 0;
  const persistSettings = () => {
    const activeCamera = controllers[activeMode].camera;
    const pos = controllers[activeMode].getPosition();
    saveSettings(levelKey, {
      x: pos.x, y: pos.y, z: pos.z,
      rotationX: activeCamera.rotation.x, rotationY: activeCamera.rotation.y,
      activeMode,
      hScale, vExag, waterLevel,
      cameraHeightOffset,
      timeOfDay: atmosphere.timeOfDay.value, fogDensity: atmosphere.fogDensity.value, fogColor: atmosphere.fogColor.value,
      overcast: atmosphere.overcast.value, starCount: atmosphere.starCount.value, cloudCount: atmosphere.cloudCount.value,
      treeCount: treeCount.value,
      hudVisible, worldBounded,
    });
  };
  window.addEventListener('beforeunload', persistSettings);
  window.addEventListener('pagehide', persistSettings);

  const gameLoop = new GameLoop(engine, (dt) => {
    controllers[activeMode].update(dt);
    clampToWorldBounds(controllers[activeMode]);
    clouds.update(dt);
    forestFire.update(dt);
    const pos = controllers[activeMode].getPosition();
    const groundY = terrain.getHeightAt(pos.x, pos.z);
    const controlsHint = activeMode === 'fly'
      ? 'click canvas to look around, WASD to fly, space/ctrl up/down, shift to boost'
      : activeMode === 'drive'
      ? 'click canvas to look around, WASD to drive, shift to boost'
      : 'click canvas to look around, WASD to move, shift to run';
    readout.textContent =
      `${activeMode}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})\n` +
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
  gameLoop.start();
}

main();
