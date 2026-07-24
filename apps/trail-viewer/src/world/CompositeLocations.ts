import {
  Color3,
  LoadAssetContainerAsync,
  Matrix,
  Mesh,
  PBRMaterial,
  Quaternion,
  Vector3,
  VertexData,
} from '@babylonjs/core';
import type {
  AssetContainer,
  Scene,
  ShadowGenerator,
} from '@babylonjs/core';
import type { LocationEntry } from './LocationProps';
import { buildStreetLamp } from './LocationProps';
import { ensureGltfLoader } from './gltfLoader';

export interface CompositeLocationsHandle {
  dispose(): void;
}

function isKnownAsset(asset: string): boolean {
  return asset in CITY_ASSETS || asset in PROCEDURAL_ASSETS;
}

const CITY_ASSET_BASE = `${import.meta.env.BASE_URL}models/downtown-city-megakit/`;
const CITY_ASSETS: Record<string, string> = {
  'building-small': 'Building_Small_1.gltf',
  'building-medium': 'Building_Medium_2_001.gltf',
  'building-large': 'Building_Large_2.gltf',
  'street-2lane': 'Street_2Lane.gltf',
  'street-tintersection': 'Street_TIntersection.gltf',
  'sidewalk-straight': 'Sidewalk_Straight_3m.gltf',
  'sidewalk-corner': 'Sidewalk_Corner_Flat_3m.gltf',
  bollard: 'Prop_Bollard.gltf',
  planter: 'Prop_Planter_Single.gltf',
  crosswalk: 'Decal_Crosswalk.gltf',
  'crosswalk-wide': 'Decal_Crosswalk_Wide.gltf',
  'manhole-cover': 'Prop_ManholeCover.gltf',
  drain: 'Prop_Drain.gltf',
};

// Procedural (non-glTF) compound assets — built once per type directly in
// Babylon rather than loaded from the city kit, same "template mesh, thin-
// instance the placements" split as CITY_ASSETS' loader, just without the
// AssetContainer step.
const PROCEDURAL_ASSETS: Record<string, (scene: Scene) => Mesh> = {
  'street-lamp': buildStreetLamp,
};

// Position/orientation only — resolved before any terrain sampling, since
// fitting the grading plane (below) needs the compound's own placement
// bounds first. Ground height is assigned in a second pass once the plane
// is known (see ExpandedPlacement).
type PositionedPlacement = {
  asset: string;
  x: number;
  z: number;
  rotationRadians: number;
  // Kept separate (not one isotropic factor) so a placement's footprint
  // spreads with the world's horizontal scale the same way the terrain
  // itself does, while its height tracks verticalExaggeration instead —
  // matching HeroTreeInstances' own H/V-scale separation. Folding
  // horizontalScale into every axis (this file's original approach) made
  // buildings grow taller purely because the world got wider, with no
  // relationship to the dial that's actually supposed to own height.
  scaleXZ: number;
  scaleY: number;
};

type ExpandedPlacement = PositionedPlacement & { groundY: number };

function expandCompoundPositions(
  location: LocationEntry,
  anchor: { x: number; z: number },
  horizontalScale: number,
  verticalExaggeration: number,
): PositionedPlacement[] {
  if (!location.compound) return [];
  const compoundRotation = (location.compound.rotationDegrees ?? 0) * Math.PI / 180;
  const cos = Math.cos(compoundRotation);
  const sin = Math.sin(compoundRotation);
  const expanded: PositionedPlacement[] = [];

  for (const placement of location.compound.placements) {
    const repeat = placement.repeat ?? { count: 1, step: [0, 0] as [number, number] };
    for (let i = 0; i < repeat.count; i++) {
      const gridX = placement.grid[0] + repeat.step[0] * i;
      const gridZ = placement.grid[1] + repeat.step[1] * i;
      const localX = gridX * location.compound.cellMeters;
      const localZ = gridZ * location.compound.cellMeters;
      const scale = placement.scale ?? 1;
      expanded.push({
        asset: placement.asset,
        x: anchor.x + (localX * cos - localZ * sin) * horizontalScale,
        z: anchor.z + (localX * sin + localZ * cos) * horizontalScale,
        rotationRadians: compoundRotation + (placement.rotationDegrees ?? 0) * Math.PI / 180,
        scaleXZ: scale * horizontalScale,
        scaleY: scale * verticalExaggeration,
      });
    }
  }
  return expanded;
}

// Real-meter floor under the compound's own half-extent (converted to
// rendered space below) — keeps a degenerate/tiny compound (bounds
// collapsed near a point) from dividing by ~0. Matches HeightmapTerrain's
// own SLOPE_SAMPLE_OFFSET_METERS in spirit.
const GRADING_MIN_SAMPLE_METERS = 8;

type GradingPlane = { anchorX: number; anchorZ: number; h0: number; gx: number; gz: number };

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

// A flat tangent-plane fit to the DEM, sampled by central difference across
// the compound's own placement bounds (not a fixed offset near the anchor)
// — an asymmetric footprint (this boulevard's cross street reaches ~48m
// past its anchor in -X, ~22m in +X) gets a plane whose samples actually
// bracket it, instead of extrapolating from two points to one side. The
// half-extent is real footprint size, so the sample distance automatically
// stays correct in real meters regardless of horizontalScale — no separate
// unit correction needed beyond the floor's own conversion to rendered
// space. Every placement in one compound reads its ground height off this
// single plane instead of calling getHeightAt independently, so adjacent
// modules (sidewalk-to-sidewalk, sidewalk-to-building) share one smooth
// grade instead of drifting with the DEM's own per-vertex noise. Doesn't
// fix the compound's *edge* meeting the raw terrain — that's what the
// grade pad below is for.
function computeGradingPlane(
  anchorX: number,
  anchorZ: number,
  bounds: Bounds,
  horizontalScale: number,
  getHeightAt: (x: number, z: number) => number,
): GradingPlane {
  const floor = GRADING_MIN_SAMPLE_METERS * horizontalScale;
  const halfX = Math.max((bounds.maxX - bounds.minX) / 2, floor);
  const halfZ = Math.max((bounds.maxZ - bounds.minZ) / 2, floor);
  const h0 = getHeightAt(anchorX, anchorZ);
  const gx = (getHeightAt(anchorX + halfX, anchorZ) - getHeightAt(anchorX - halfX, anchorZ)) / (2 * halfX);
  const gz = (getHeightAt(anchorX, anchorZ + halfZ) - getHeightAt(anchorX, anchorZ - halfZ)) / (2 * halfZ);
  return { anchorX, anchorZ, h0, gx, gz };
}

function planeHeightAt(plane: GradingPlane, x: number, z: number): number {
  return plane.h0 + plane.gx * (x - plane.anchorX) + plane.gz * (z - plane.anchorZ);
}

// Margin beyond the compound's own placement bounds the grade pad extends
// before dropping to its buried base — wide enough that a module's own
// footprint (sidewalk curb, building footing) never pokes past the pad's
// edge. Expressed in real meters, converted to rendered space at use —
// same reasoning as GRADING_MIN_SAMPLE_METERS. Depth is deliberately
// generous (worst-case local DEM dip within the margin, times whatever
// verticalExaggeration is dialed to) rather than measured — cheap to bump
// if a gap ever shows at a steep site.
const GRADE_PAD_MARGIN_METERS = 3;
const GRADE_PAD_DEPTH = 30;
// The pad's top sits at the same fitted-plane height the real DEM is
// (by construction) very close to — in the ring where the pad peeks out
// past a sidewalk/building edge, that near-coincidence is a z-fighting
// risk. Nudging the rendered top down by a hair makes the real terrain
// reliably win the depth test there instead of flickering against it.
const GRADE_PAD_TOP_INSET = 0.15;
// Packed-earth/cut-lot tone — reads as a graded pad, not a floating slab.
// Placeholder color like every other LocationProps prop; swap for a real
// texture later without touching the pad-building logic itself.
const GRADE_PAD_COLOR = new Color3(0.3, 0.26, 0.2);

// One flat (but tilted-with-the-plane) pad per compound, sized to its
// placement bounds + margin, extruded down to a buried base. Visually
// absorbs the seam between the compound's own shared grade and the DEM's
// real, unaltered slope around it — a deliberate graded-lot edge instead of
// an accidental clipping cliff. Does not modify HeightmapTerrain itself.
function buildGradePad(
  scene: Scene,
  plane: GradingPlane,
  bounds: Bounds,
  horizontalScale: number,
): Mesh {
  const margin = GRADE_PAD_MARGIN_METERS * horizontalScale;
  const minX = bounds.minX - margin;
  const maxX = bounds.maxX + margin;
  const minZ = bounds.minZ - margin;
  const maxZ = bounds.maxZ + margin;

  const topY = (x: number, z: number) => planeHeightAt(plane, x, z) - GRADE_PAD_TOP_INSET;
  const topCorners = [
    new Vector3(minX, topY(minX, minZ), minZ),
    new Vector3(maxX, topY(maxX, minZ), minZ),
    new Vector3(maxX, topY(maxX, maxZ), maxZ),
    new Vector3(minX, topY(minX, maxZ), maxZ),
  ];
  const baseY = Math.min(...topCorners.map((v) => v.y)) - GRADE_PAD_DEPTH;
  const bottomCorners = topCorners.map((v) => new Vector3(v.x, baseY, v.z));

  const positions: number[] = [];
  const indices: number[] = [];
  const pushQuad = (a: Vector3, b: Vector3, c: Vector3, d: Vector3) => {
    const base = positions.length / 3;
    [a, b, c, d].forEach((v) => positions.push(v.x, v.y, v.z));
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  pushQuad(topCorners[0], topCorners[1], topCorners[2], topCorners[3]);
  pushQuad(bottomCorners[3], bottomCorners[2], bottomCorners[1], bottomCorners[0]);
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    pushQuad(topCorners[i], topCorners[next], bottomCorners[next], bottomCorners[i]);
  }

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;

  const mesh = new Mesh('compoundGradePad', scene);
  vertexData.applyToMesh(mesh, true);

  const mat = new PBRMaterial('compoundGradePadMat', scene);
  mat.albedoColor = GRADE_PAD_COLOR;
  mat.roughness = 0.95;
  mat.metallic = 0;
  mesh.material = mat;
  mesh.receiveShadows = true;

  return mesh;
}

// Shared by both the glTF loader and the procedural builder below — the
// only difference between "a downloaded city module" and "a mesh we built
// in code" is how renderMeshes gets populated; thin-instancing already-
// resolved placements is identical either way.
function placeRenderMeshes(
  renderMeshes: Mesh[],
  placements: ExpandedPlacement[],
  shadowGenerator?: ShadowGenerator,
): void {
  let minimumY = Number.POSITIVE_INFINITY;
  for (const mesh of renderMeshes) {
    mesh.computeWorldMatrix(true);
    minimumY = Math.min(minimumY, mesh.getBoundingInfo().boundingBox.minimumWorld.y);
  }
  if (!Number.isFinite(minimumY)) minimumY = 0;

  const matrices = placements.map((placement) => Matrix.Compose(
    new Vector3(placement.scaleXZ, placement.scaleY, placement.scaleXZ),
    Quaternion.FromEulerAngles(0, placement.rotationRadians, 0),
    new Vector3(placement.x, placement.groundY - minimumY * placement.scaleY, placement.z),
  ));
  for (const mesh of renderMeshes) {
    // Flatten the glTF node hierarchy before applying absolute thin-instance
    // matrices, matching HeroTreeInstances' multi-mesh loading path.
    mesh.bakeCurrentTransformIntoVertices();
    mesh.parent = null;
    mesh.receiveShadows = true;
    mesh.thinInstanceAdd(matrices, true);
    shadowGenerator?.addShadowCaster(mesh);
  }
}

async function loadThinInstancedAsset(
  scene: Scene,
  filename: string,
  placements: ExpandedPlacement[],
  shadowGenerator?: ShadowGenerator,
): Promise<AssetContainer> {
  const container = await LoadAssetContainerAsync(`${CITY_ASSET_BASE}${filename}`, scene);
  container.addAllToScene();
  const renderMeshes = container.meshes.filter(
    (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0,
  );
  if (renderMeshes.length === 0) throw new Error(`city asset has no renderable meshes: ${filename}`);

  placeRenderMeshes(renderMeshes, placements, shadowGenerator);
  return container;
}

function placeProceduralAsset(
  scene: Scene,
  builder: (scene: Scene) => Mesh,
  placements: ExpandedPlacement[],
  shadowGenerator?: ShadowGenerator,
): Mesh {
  const template = builder(scene);
  placeRenderMeshes([template], placements, shadowGenerator);
  return template;
}

// Loads each authored asset once, then repeats its render meshes with thin
// instances across every compound location that references it. A compound
// is a lat/long anchor plus a rotated local meter grid: large arrangements
// stay data-driven without pretending each building module is a landmark.
export async function loadCompositeLocations(
  scene: Scene,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  verticalExaggeration: number,
  getHeightAt: (x: number, z: number) => number,
  shadowGenerator?: ShadowGenerator,
): Promise<CompositeLocationsHandle> {
  await ensureGltfLoader();
  const byAsset = new Map<string, ExpandedPlacement[]>();
  const gradePads: Mesh[] = [];

  for (const location of locations) {
    if (!location.compound) continue;
    const [lat, lon] = location.latLong;
    const anchor = toRenderXZ(lat, lon);
    const positioned = expandCompoundPositions(location, anchor, horizontalScale, verticalExaggeration);

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const placement of positioned) {
      if (!isKnownAsset(placement.asset)) continue;
      minX = Math.min(minX, placement.x);
      maxX = Math.max(maxX, placement.x);
      minZ = Math.min(minZ, placement.z);
      maxZ = Math.max(maxZ, placement.z);
    }
    if (!Number.isFinite(minX)) continue;

    const bounds: Bounds = { minX, maxX, minZ, maxZ };
    const plane = computeGradingPlane(anchor.x, anchor.z, bounds, horizontalScale, getHeightAt);
    gradePads.push(buildGradePad(scene, plane, bounds, horizontalScale));

    for (const placement of positioned) {
      if (!isKnownAsset(placement.asset)) {
        console.warn(`[CompositeLocations] unknown asset "${placement.asset}" at "${location.name}"`);
        continue;
      }
      const entries = byAsset.get(placement.asset) ?? [];
      entries.push({ ...placement, groundY: planeHeightAt(plane, placement.x, placement.z) });
      byAsset.set(placement.asset, entries);
    }
  }

  const containers: AssetContainer[] = [];
  const proceduralMeshes: Mesh[] = [];
  await Promise.all([...byAsset].map(async ([asset, entries]) => {
    if (asset in PROCEDURAL_ASSETS) {
      const template = placeProceduralAsset(scene, PROCEDURAL_ASSETS[asset], entries, shadowGenerator);
      proceduralMeshes.push(template);
    } else {
      const container = await loadThinInstancedAsset(scene, CITY_ASSETS[asset], entries, shadowGenerator);
      containers.push(container);
    }
    console.info(`[CompositeLocations] placed ${entries.length} "${asset}" module(s)`);
  }));

  return {
    dispose: () => {
      containers.forEach((container) => container.dispose());
      // false/true: skip the (already-null) parent-hierarchy walk, do
      // dispose the material+textures — each of these meshes owns a
      // freshly-constructed material with nothing else referencing it, so
      // this is the fix for the leak-on-rebuild noted in review: every
      // hScale/vExag slider drag disposes and rebuilds this whole set.
      proceduralMeshes.forEach((mesh) => mesh.dispose(false, true));
      gradePads.forEach((mesh) => mesh.dispose(false, true));
    },
  };
}
