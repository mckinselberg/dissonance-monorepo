import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Color3,
  Color4,
  Mesh,
  MeshBuilder,
} from '@babylonjs/core';
import { GameLoop } from '@dissonance/engine';
import { HeightmapTerrain, type ITerrain } from '@dissonance/world';
import { PlayerController, FlightController } from '@dissonance/player';
import {
  decodeHeightmapPng,
  HeightmapSampler,
  originFromBoundingBox,
  latLonToWorld,
  parseGeoJsonTrails,
  parseGpxTrack,
  type HeightmapContract,
  type GeoPolyline,
  type UtmCoordinate,
} from '@dissonance/geo';

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

// Position is only meaningful within a given level's own coordinate space
// (horizontalScale differs between levels), so it's saved per level key.
// Player mode only — the orbit camera's "position" is a derived value
// (target + radius/alpha/beta), not something meaningful to restore the
// same way.
type SavedPosition = { x: number; y: number; z: number };

function positionStorageKey(levelKey: string): string {
  return `trail-viewer:position:${levelKey}`;
}

function loadSavedPosition(levelKey: string): SavedPosition | null {
  const raw = localStorage.getItem(positionStorageKey(levelKey));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number' && typeof parsed?.z === 'number') {
      return parsed;
    }
  } catch {
    // ignore malformed/corrupt localStorage value, fall back to spawn point
  }
  return null;
}

function savePosition(levelKey: string, pos: SavedPosition): void {
  localStorage.setItem(positionStorageKey(levelKey), JSON.stringify(pos));
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

async function main() {
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.55, 0.65, 0.78, 1);

  const light = new HemisphericLight('light', new Vector3(0.3, 1, 0.2), scene);
  light.intensity = 0.9;

  const levelKey = currentLevelKey();
  const level = LEVELS[levelKey];

  // Mutable — level 1 exposes live HUD sliders that rebuild the terrain
  // and trail/GPX overlays with new scale values (see the scale-tuning
  // section below). Every other read of "the current scale" in this
  // function goes through these two variables, not level.* directly, so a
  // live rescale stays consistent everywhere.
  let hScale = level.horizontalScale;
  let vExag = level.verticalExaggeration;

  const { contract, pngBytes } = await loadHeightmap();
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

  const terrainToggle = document.getElementById('toggle-terrain') as HTMLInputElement;
  const osmToggle = document.getElementById('toggle-osm') as HTMLInputElement;
  const gpxToggle = document.getElementById('toggle-gpx') as HTMLInputElement;
  const readout = document.getElementById('readout') as HTMLDivElement;
  const levelLabel = document.getElementById('level-label') as HTMLDivElement;
  levelLabel.textContent = level.label;

  terrainToggle.addEventListener('change', () => terrain.setVisible(terrainToggle.checked));
  osmToggle.addEventListener('change', () => setMeshesEnabled(trailMeshes, osmToggle.checked));
  gpxToggle.addEventListener('change', () => setMeshesEnabled(gpxMeshes, gpxToggle.checked));

  const gotoLat = document.getElementById('goto-lat') as HTMLInputElement;
  const gotoLon = document.getElementById('goto-lon') as HTMLInputElement;
  const gotoButton = document.getElementById('goto-button') as HTMLButtonElement;
  const resetPositionButton = document.getElementById('reset-position-button') as HTMLButtonElement;

  // Fly Mode has no bounds clamping, so it's easy to end up saved somewhere
  // far outside the DEM's real footprint (nothing but sky, a distant sliver
  // of terrain). This drops the saved position for the current level and
  // reloads back to the recorded hike's trailhead.
  //
  // location.reload() fires beforeunload/pagehide on the page being torn
  // down *before* the new one loads — saveNow (registered on those events
  // below) would otherwise immediately re-persist the still-in-memory
  // stranded position and undo the removeItem a moment later. Unregistering
  // both first prevents that race.
  resetPositionButton.addEventListener('click', () => {
    window.removeEventListener('beforeunload', saveNow);
    window.removeEventListener('pagehide', saveNow);
    localStorage.removeItem(positionStorageKey(levelKey));
    location.reload();
  });

  if (level.cameraMode === 'orbit') {
    // The original Phase 3/4 validation view — free orbit over the whole
    // model, no player/collision involved.
    const worldWidth = (contract.bbox.maxX - contract.bbox.minX) * level.horizontalScale;
    const orbitCamera = new ArcRotateCamera('orbitCamera', -Math.PI / 2, Math.PI / 3, worldWidth * 0.7, Vector3.Zero(), scene);
    orbitCamera.attachControl(canvas, true);
    orbitCamera.lowerRadiusLimit = 20;
    orbitCamera.upperRadiusLimit = worldWidth * 2;
    orbitCamera.wheelPrecision = 8;
    orbitCamera.panningSensibility = 50;
    orbitCamera.maxZ = level.farClip;
    scene.activeCamera = orbitCamera;

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

    const gameLoop = new GameLoop(engine, () => {
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
  const saved = loadSavedPosition(levelKey);
  const spawnPoint = gpxTrack[0]?.points[0];
  const spawnReal = spawnPoint ? latLonToWorld(spawnPoint, origin) : { x: 0, z: 0 };
  const spawnRenderX = saved?.x ?? spawnReal.x * hScale;
  const spawnRenderZ = saved?.z ?? spawnReal.z * hScale;
  const spawnGroundY = terrain.getHeightAt(spawnRenderX, spawnRenderZ);
  // Y is a placeholder — PlayerController.update() overwrites it with
  // groundY + its own (scale-adjusted) eye height on the very first frame.
  const startPosition = new Vector3(spawnRenderX, spawnGroundY, spawnRenderZ);

  const player = new PlayerController(scene, startPosition, { scale: level.playerScale, farClip: level.farClip });
  player.setTerrain(terrain);

  // Fast air travel — a free-fly camera for covering this real-world-scale
  // map quickly, alongside walking. Both controllers stay alive
  // simultaneously (rather than being created/destroyed on toggle) so
  // switching back and forth is instant and position carries over cleanly.
  const flight = new FlightController(scene, startPosition.clone(), { farClip: level.farClip, speed: level.flightSpeed });

  type ActiveMode = 'walk' | 'fly';
  let activeMode: ActiveMode = 'walk';
  scene.activeCamera = player.camera;

  const flyToggleRow = document.getElementById('fly-toggle-row') as HTMLLabelElement;
  const flyToggle = document.getElementById('toggle-fly') as HTMLInputElement;
  flyToggleRow.style.display = 'block';

  flyToggle.addEventListener('change', () => {
    if (flyToggle.checked) {
      flight.setPosition(player.getPosition());
      flight.camera.rotation.copyFrom(player.camera.rotation);
      flight.clearLookDelta();
      activeMode = 'fly';
      scene.activeCamera = flight.camera;
    } else {
      // Land at the same lat/long the flight camera was over, on the
      // ground — not wherever it was hovering. Y here is computed
      // immediately (not left to next-frame correction) so there's no
      // possibility of a mid-air position being visible even for one frame.
      const flightPos = flight.getPosition();
      const groundY = terrain.getHeightAt(flightPos.x, flightPos.z);
      player.setPosition(new Vector3(flightPos.x, groundY, flightPos.z));
      player.camera.rotation.copyFrom(flight.camera.rotation);
      player.clearLookDelta();
      activeMode = 'walk';
      scene.activeCamera = player.camera;
    }
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
    const hValue = document.getElementById('scale-horizontal-value') as HTMLSpanElement;
    const vValue = document.getElementById('scale-vertical-value') as HTMLSpanElement;
    scaleTuning.style.display = 'block';
    hSlider.value = String(hScale);
    vSlider.value = String(vExag);
    hValue.textContent = String(hScale);
    vValue.textContent = String(vExag);

    const rebuildWorld = (newHScale: number, newVExag: number) => {
      const activeCamera = activeMode === 'fly' ? flight : player;
      const beforePos = activeCamera.getPosition();
      const beforeGroundY = terrain.getHeightAt(beforePos.x, beforePos.z);
      const heightAboveGround = beforePos.y - beforeGroundY;
      const realX = beforePos.x / hScale;
      const realZ = beforePos.z / hScale;

      terrain.dispose();
      trailMeshes.forEach((m) => m.dispose());
      gpxMeshes.forEach((m) => m.dispose());

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
      terrain.setVisible(terrainToggle.checked);
      setMeshesEnabled(trailMeshes, osmToggle.checked);
      setMeshesEnabled(gpxMeshes, gpxToggle.checked);
      player.setTerrain(terrain);

      const newRenderX = realX * hScale;
      const newRenderZ = realZ * hScale;
      const newGroundY = terrain.getHeightAt(newRenderX, newRenderZ);
      if (activeMode === 'fly') {
        flight.setPosition(new Vector3(newRenderX, newGroundY + heightAboveGround, newRenderZ));
      } else {
        player.setPosition(new Vector3(newRenderX, newGroundY, newRenderZ));
      }
    };

    hSlider.addEventListener('input', () => { hValue.textContent = hSlider.value; });
    vSlider.addEventListener('input', () => { vValue.textContent = vSlider.value; });
    // Rebuild on release (change), not on every drag tick — regenerating a
    // 700-subdivision mesh plus both trail overlays isn't cheap enough to
    // do smoothly on every intermediate slider value.
    hSlider.addEventListener('change', () => rebuildWorld(parseFloat(hSlider.value), vExag));
    vSlider.addEventListener('change', () => rebuildWorld(hScale, parseFloat(vSlider.value)));
  }

  gotoButton.addEventListener('click', () => {
    const lat = parseFloat(gotoLat.value);
    const lon = parseFloat(gotoLon.value);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    const real = latLonToWorld({ lat, lon }, origin);
    const renderX = real.x * hScale;
    const renderZ = real.z * hScale;
    const groundY = terrain.getHeightAt(renderX, renderZ);
    if (activeMode === 'fly') {
      // Hover well above ground so the destination is actually visible,
      // rather than dropping you right at ground level facing who-knows-where.
      flight.setPosition(new Vector3(renderX, groundY + 50, renderZ));
    } else {
      player.setPosition(new Vector3(renderX, groundY, renderZ));
    }
  });

  const SAVE_INTERVAL_SECONDS = 2;
  let timeSinceSave = 0;
  const saveNow = () => {
    const pos = activeMode === 'fly' ? flight.getPosition() : player.getPosition();
    savePosition(levelKey, { x: pos.x, y: pos.y, z: pos.z });
  };
  window.addEventListener('beforeunload', saveNow);
  window.addEventListener('pagehide', saveNow);

  const gameLoop = new GameLoop(engine, (dt) => {
    if (activeMode === 'fly') {
      flight.update(dt);
    } else {
      player.update(dt);
    }
    const pos = activeMode === 'fly' ? flight.getPosition() : player.getPosition();
    const groundY = terrain.getHeightAt(pos.x, pos.z);
    const controlsHint = activeMode === 'fly'
      ? 'click canvas to look around, WASD to fly, space/ctrl up/down, shift to boost'
      : 'click canvas to look around, WASD to move, shift to run';
    readout.textContent =
      `${activeMode}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})\n` +
      `ground below: ${groundY.toFixed(1)}m\n` +
      controlsHint;
    scene.render();

    timeSinceSave += dt;
    if (timeSinceSave >= SAVE_INTERVAL_SECONDS) {
      timeSinceSave = 0;
      saveNow();
    }
  });
  gameLoop.start();
}

main();
