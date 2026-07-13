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
import { PlayerController } from '@dissonance/player';
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
  '1': { label: 'Level 1: exaggerated relief, shrunk player', gridResolution: 700, verticalExaggeration: 10, horizontalScale: 1, playerScale: 0.1, farClip: 10000, cameraMode: 'player' },
  // gridResolution bumped to partially offset horizontalScale stretching
  // each mesh quad ~7x wider once rendered (700 alone would make ~57m
  // quads — coarse enough up close to visibly diverge from getHeightAt's
  // precise DEM sampling; 1000 brings that down to ~40m, still coarser
  // than level 1 but less extreme). farClip raised well past the ~40km
  // rendered world diagonal so distant terrain doesn't just vanish.
  '2': { label: 'Level 2: uniform 7x world scale', gridResolution: 1000, verticalExaggeration: 7, horizontalScale: 7, playerScale: 1, farClip: 60000, cameraMode: 'player' },
  '3': { label: 'Level 3: true scale, orbit view', gridResolution: 700, verticalExaggeration: 1, horizontalScale: 1, playerScale: 1, farClip: 10000, cameraMode: 'orbit' },
};

function currentLevelConfig(): LevelConfig {
  const key = new URLSearchParams(location.search).get('level') ?? '1';
  return LEVELS[key] ?? LEVELS['1'];
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

  const level = currentLevelConfig();

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
  const terrain = new HeightmapTerrain(scene, sampler, contract, origin, {
    gridResolution: level.gridResolution,
    verticalExaggeration: level.verticalExaggeration,
    horizontalScale: level.horizontalScale,
  });

  const [trails, gpxTrack] = await Promise.all([loadTrails(), loadGpxTrack()]);
  const trailMeshes = buildPolylineMeshes(scene, trails, terrain, origin, {
    namePrefix: 'osmTrail',
    yLift: OSM_TRAIL_Y_LIFT,
    horizontalScale: level.horizontalScale,
    colorFor: blazeColorFromTags,
  });
  const gpxMeshes = buildPolylineMeshes(scene, gpxTrack, terrain, origin, {
    namePrefix: 'gpxTrack',
    yLift: GPX_TRACK_Y_LIFT,
    horizontalScale: level.horizontalScale,
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
  // rather than an arbitrary bbox-center point that might not sit on a trail.
  const spawnPoint = gpxTrack[0]?.points[0];
  const spawnReal = spawnPoint ? latLonToWorld(spawnPoint, origin) : { x: 0, z: 0 };
  const spawnRenderX = spawnReal.x * level.horizontalScale;
  const spawnRenderZ = spawnReal.z * level.horizontalScale;
  const spawnGroundY = terrain.getHeightAt(spawnRenderX, spawnRenderZ);
  // Y is a placeholder — PlayerController.update() overwrites it with
  // groundY + its own (scale-adjusted) eye height on the very first frame.
  const startPosition = new Vector3(spawnRenderX, spawnGroundY, spawnRenderZ);

  const player = new PlayerController(scene, startPosition, { scale: level.playerScale, farClip: level.farClip });
  player.setTerrain(terrain);
  scene.activeCamera = player.camera;

  const gameLoop = new GameLoop(engine, (dt) => {
    player.update(dt);
    const pos = player.getPosition();
    const groundY = terrain.getHeightAt(pos.x, pos.z);
    readout.textContent =
      `player: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})\n` +
      `ground under player: ${groundY.toFixed(1)}m\n` +
      `click canvas to look around, WASD to move, shift to run`;
    scene.render();
  });
  gameLoop.start();
}

main();
