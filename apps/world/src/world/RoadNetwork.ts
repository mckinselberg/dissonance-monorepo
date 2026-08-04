import { Mesh, MeshBuilder, Vector3 } from '@babylonjs/core';
import type { PBRMaterial, Scene } from '@babylonjs/core';
import type { LocationEntry } from './LocationProps';
import { buildCumulativeDistances, nearestPointOnPolyline, pointAtDistance, sampleAtSpacing, type PlanarPoint } from './polyline';
import { texturedMaterial, CITY_KIT_TEXTURE_BASE, TEXTURES_BASE } from './texturedMaterial';
import type { ReplayRoute } from '../ui/RouteReplay';

// How finely the authored road path is resampled before building the ribbon
// mesh — denser than a corridor's pole spacing since this is a continuous
// surface draped on terrain, not discrete placements.
const ROAD_SAMPLE_SPACING_M = 3;
const ROAD_Y_LIFT_M = 0.05;
// Fraction of widthMeters that's paved; the remainder splits into two dirt
// shoulders (one per side) — reads closer to the reference photo (worn
// pavement with leaf litter/dirt encroaching at the margins) than an
// edge-to-edge single material would.
const ASPHALT_WIDTH_RATIO = 0.65;
// Real-world meters per texture repeat — matches FalloutShelterEntrance's
// forest-ground-04 tiling reference (textureScale 3 on a ~6m mound). Applied
// per-axis from each ribbon's own measured width/length so a much longer or
// wider road doesn't need its own hand-tuned constant.
const TEXTURE_METERS_PER_TILE = 2;

export interface RoadPositionSample {
  x: number;
  y: number;
  z: number;
  headingRadians: number;
}

export interface RoadPullOff {
  id: string;
  distanceMeters: number;
}

export interface RoadHandle {
  readonly locationId: string;
  readonly totalLengthMeters: number;
  readonly widthMeters: number;
  readonly pullOffs: RoadPullOff[];
  positionAtDistance(distanceMeters: number): RoadPositionSample;
  // Render-space query point in, real-meters distances out — same
  // convention as positionAtDistance/totalLengthMeters. lateralDistanceMeters
  // is how far (x, z) is from the road centerline; compare against
  // widthMeters / 2 to decide "on the road surface" (T28 on-foot exposure).
  nearestPointOnRoad(x: number, z: number): { distanceAlongMeters: number; lateralDistanceMeters: number };
}

export interface RoadNetworkHandle {
  getRoad(locationId: string): RoadHandle | null;
  setVisible(visible: boolean): void;
  dispose(): void;
}

function tileScale(widthMeters: number, lengthMeters: number): { u: number; v: number } {
  return {
    u: Math.max(1, widthMeters / TEXTURE_METERS_PER_TILE),
    v: Math.max(1, lengthMeters / TEXTURE_METERS_PER_TILE),
  };
}

function makeAsphaltMaterial(scene: Scene, widthMeters: number, lengthMeters: number): PBRMaterial {
  // Albedo-only asset on disk (no normal/ORM companion for this specific
  // variant — see texturedMaterial.ts's optional-map handling) — reads flat
  // up close but is the same texture CompositeLocations' boulevard streets
  // already use, so it stays visually consistent across the app.
  return texturedMaterial(
    scene,
    'roadAsphalt',
    { albedo: `${CITY_KIT_TEXTURE_BASE}T_Concrete_Asphalt_BaseColor.png` },
    tileScale(widthMeters, lengthMeters),
  );
}

function makeShoulderMaterial(scene: Scene, widthMeters: number, lengthMeters: number): PBRMaterial {
  // Same forest-ground-04 diffuse+normal set the terrain itself and the
  // fallout shelter's earth cover already use — the shoulders blend into
  // the surrounding ground rather than reading as a third, unrelated asset.
  return texturedMaterial(
    scene,
    'roadShoulder',
    {
      albedo: `${TEXTURES_BASE}forest-ground-04/forest_ground_04_diff_512.jpg`,
      normal: `${TEXTURES_BASE}forest-ground-04/forest_ground_04_nor_gl_512.png`,
    },
    tileScale(widthMeters, lengthMeters),
  );
}

// Builds the three parallel ribbons (dirt shoulder / asphalt / dirt
// shoulder) that make up one road's surface, sharing one dense resample of
// the centerline so all three stay perfectly aligned and grounded together.
function buildRoadRibbons(
  scene: Scene,
  name: string,
  renderPath: PlanarPoint[],
  cumulative: number[],
  widthRender: number,
  verticalExaggeration: number,
  getHeightAt: (x: number, z: number) => number,
  asphaltMaterial: PBRMaterial,
  shoulderMaterial: PBRMaterial,
): Mesh[] {
  const dense = sampleAtSpacing(renderPath, cumulative, ROAD_SAMPLE_SPACING_M);
  const halfWidth = widthRender / 2;
  const asphaltHalfWidth = halfWidth * ASPHALT_WIDTH_RATIO;

  const left: Vector3[] = [];
  const asphaltLeft: Vector3[] = [];
  const asphaltRight: Vector3[] = [];
  const right: Vector3[] = [];
  for (const sample of dense) {
    const perpX = Math.cos(sample.headingRadians);
    const perpZ = -Math.sin(sample.headingRadians);
    const y = getHeightAt(sample.x, sample.z) + ROAD_Y_LIFT_M * verticalExaggeration;
    const at = (offset: number) => new Vector3(sample.x + perpX * offset, y, sample.z + perpZ * offset);
    left.push(at(-halfWidth));
    asphaltLeft.push(at(-asphaltHalfWidth));
    asphaltRight.push(at(asphaltHalfWidth));
    right.push(at(halfWidth));
  }

  const asphalt = MeshBuilder.CreateRibbon(
    `${name}_asphalt`, { pathArray: [asphaltLeft, asphaltRight], sideOrientation: Mesh.DOUBLESIDE }, scene,
  );
  asphalt.material = asphaltMaterial;
  asphalt.receiveShadows = true;

  const shoulderLeft = MeshBuilder.CreateRibbon(
    `${name}_shoulderLeft`, { pathArray: [left, asphaltLeft], sideOrientation: Mesh.DOUBLESIDE }, scene,
  );
  shoulderLeft.material = shoulderMaterial;
  shoulderLeft.receiveShadows = true;

  const shoulderRight = MeshBuilder.CreateRibbon(
    `${name}_shoulderRight`, { pathArray: [asphaltRight, right], sideOrientation: Mesh.DOUBLESIDE }, scene,
  );
  shoulderRight.material = shoulderMaterial;
  shoulderRight.receiveShadows = true;

  return [asphalt, shoulderLeft, shoulderRight];
}

// Resolves a road's centerline in render-space meters from whichever of
// `road.path`/`road.routeFile` is present — see LocationProps.ts's own
// comment on the two sources. Returns null (with a console.warn) rather
// than throwing so one misconfigured road doesn't take the whole world down.
function resolveRenderPath(
  location: LocationEntry,
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  replayRoutes: readonly ReplayRoute[],
): PlanarPoint[] | null {
  const road = location.road;
  if (!road) return null;
  if (road.routeFile) {
    const route = replayRoutes.find((candidate) => candidate.id === road.routeFile);
    if (!route) {
      console.warn(`[RoadNetwork] "${location.name}" references routeFile "${road.routeFile}", which isn't in routes/index.json`);
      return null;
    }
    return route.points.map((point) => toRenderXZ(point.lat, point.lon));
  }
  if (road.path) {
    const anchor = toRenderXZ(location.latLong[0], location.latLong[1]);
    return road.path.map(([localX, localZ]) => ({
      x: anchor.x + localX * horizontalScale,
      z: anchor.z + localZ * horizontalScale,
    }));
  }
  console.warn(`[RoadNetwork] "${location.name}" has a road with neither routeFile nor path, skipping`);
  return null;
}

// Reads locations.json entries' `road` field and builds one drivable,
// textured road surface per authored road, draped on terrain the same way
// UtilityCorridors.ts places poles. positionAtDistance is the live query
// vehicle/VehicleSession.ts drives the vehicle mesh/camera from every frame;
// it stays a plain function over the resampled path rather than a mesh
// lookup so it works identically before any road mesh exists.
export function loadRoadNetwork(
  scene: Scene,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  verticalExaggeration: number,
  getHeightAt: (x: number, z: number) => number,
  replayRoutes: readonly ReplayRoute[],
): RoadNetworkHandle {
  const meshes: Mesh[] = [];
  const materials: PBRMaterial[] = [];
  const roads = new Map<string, RoadHandle>();

  for (const location of locations) {
    if (!location.road) continue;
    const renderPath = resolveRenderPath(location, toRenderXZ, horizontalScale, replayRoutes);
    if (!renderPath || renderPath.length < 2) {
      if (renderPath) console.warn(`[RoadNetwork] "${location.name}" road has fewer than two points, skipping`);
      continue;
    }
    const cumulative = buildCumulativeDistances(renderPath);
    const totalLengthMeters = cumulative[cumulative.length - 1] / horizontalScale;

    const asphaltMaterial = makeAsphaltMaterial(scene, location.road.widthMeters * ASPHALT_WIDTH_RATIO, totalLengthMeters);
    const shoulderMaterial = makeShoulderMaterial(
      scene, location.road.widthMeters * (1 - ASPHALT_WIDTH_RATIO) / 2, totalLengthMeters,
    );
    materials.push(asphaltMaterial, shoulderMaterial);

    meshes.push(...buildRoadRibbons(
      scene,
      `road_${location.id}`,
      renderPath,
      cumulative,
      location.road.widthMeters * horizontalScale,
      verticalExaggeration,
      getHeightAt,
      asphaltMaterial,
      shoulderMaterial,
    ));

    const pullOffs: RoadPullOff[] = (location.road.pullOffs ?? []).map((pullOff) => ({
      id: pullOff.id,
      distanceMeters: pullOff.distanceMeters,
    }));

    roads.set(location.id, {
      locationId: location.id,
      totalLengthMeters,
      widthMeters: location.road.widthMeters,
      pullOffs,
      positionAtDistance(distanceMeters: number): RoadPositionSample {
        const sample = pointAtDistance(renderPath, cumulative, distanceMeters * horizontalScale);
        return {
          x: sample.x,
          y: getHeightAt(sample.x, sample.z),
          z: sample.z,
          headingRadians: sample.headingRadians,
        };
      },
      nearestPointOnRoad(x: number, z: number) {
        const projection = nearestPointOnPolyline(renderPath, cumulative, x, z);
        return {
          distanceAlongMeters: projection.distanceAlong / horizontalScale,
          lateralDistanceMeters: projection.lateralDistance / horizontalScale,
        };
      },
    });
  }

  return {
    getRoad: (locationId: string) => roads.get(locationId) ?? null,
    setVisible(visible: boolean) {
      meshes.forEach((mesh) => mesh.setEnabled(visible));
    },
    dispose() {
      meshes.forEach((mesh) => mesh.dispose(false, true));
      materials.forEach((material) => material.dispose());
    },
  };
}
