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
    fetch('/data/smr-heightmap.json').then((r) => r.json()),
    fetch('/data/smr-heightmap.png'),
  ]);
  const pngBytes = new Uint8Array(await pngResponse.arrayBuffer());
  return { contract, pngBytes };
}

async function loadTrails(): Promise<GeoPolyline[]> {
  const geojson = await fetch('/data/smr-trails.geojson').then((r) => r.json());
  return parseGeoJsonTrails(geojson);
}

async function loadGpxTrack(): Promise<GeoPolyline[]> {
  const gpxXml = await fetch('/data/my-track.gpx').then((r) => r.text());
  return parseGpxTrack(gpxXml);
}

function buildPolylineMeshes(
  scene: Scene,
  polylines: GeoPolyline[],
  terrain: ITerrain,
  origin: UtmCoordinate,
  options: { namePrefix: string; yLift: number; colorFor: (tags?: Record<string, string>) => Color3 },
): Mesh[] {
  const meshes: Mesh[] = [];
  polylines.forEach((polyline, i) => {
    if (polyline.points.length < 2) return;
    const path = polyline.points.map((p) => {
      const world = latLonToWorld(p, origin);
      const y = terrain.getHeightAt(world.x, world.z) + options.yLift;
      return new Vector3(world.x, y, world.z);
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

  const { contract, pngBytes } = await loadHeightmap();
  const origin = originFromBoundingBox(contract.bbox);
  const elevations = decodeHeightmapPng(pngBytes, contract);
  const sampler = new HeightmapSampler(elevations, contract, origin);
  // Denser than the default — at 128 subdivisions each mesh quad spans
  // ~44m, coarse enough that the flat-interpolated mesh surface can sit
  // above the true (bilinear-sampled) DEM height between grid vertices,
  // making correctly-draped trail lines dip below it and disappear in
  // gap-like z-fighting. 384 brings quad size down to ~15m.
  const terrain = new HeightmapTerrain(scene, sampler, contract, origin, { gridResolution: 384 });

  const [trails, gpxTrack] = await Promise.all([loadTrails(), loadGpxTrack()]);
  const trailMeshes = buildPolylineMeshes(scene, trails, terrain, origin, {
    namePrefix: 'osmTrail',
    yLift: OSM_TRAIL_Y_LIFT,
    colorFor: blazeColorFromTags,
  });
  const gpxMeshes = buildPolylineMeshes(scene, gpxTrack, terrain, origin, {
    namePrefix: 'gpxTrack',
    yLift: GPX_TRACK_Y_LIFT,
    colorFor: () => GPX_TRACK_COLOR,
  });

  const terrainToggle = document.getElementById('toggle-terrain') as HTMLInputElement;
  const osmToggle = document.getElementById('toggle-osm') as HTMLInputElement;
  const gpxToggle = document.getElementById('toggle-gpx') as HTMLInputElement;
  const readout = document.getElementById('readout') as HTMLDivElement;

  terrainToggle.addEventListener('change', () => terrain.setVisible(terrainToggle.checked));
  osmToggle.addEventListener('change', () => setMeshesEnabled(trailMeshes, osmToggle.checked));
  gpxToggle.addEventListener('change', () => setMeshesEnabled(gpxMeshes, gpxToggle.checked));

  const worldWidth = contract.bbox.maxX - contract.bbox.minX;
  const camera = new ArcRotateCamera(
    'camera',
    -Math.PI / 2,
    Math.PI / 3,
    worldWidth * 0.7,
    Vector3.Zero(),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 20;
  camera.upperRadiusLimit = worldWidth * 2;
  camera.wheelPrecision = 8;
  camera.panningSensibility = 50;

  const gameLoop = new GameLoop(engine, () => {
    const pos = camera.position;
    const groundY = terrain.getHeightAt(pos.x, pos.z);
    readout.textContent =
      `camera: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})\n` +
      `ground under camera: ${groundY.toFixed(1)}m`;
    scene.render();
  });
  gameLoop.start();
}

main();
