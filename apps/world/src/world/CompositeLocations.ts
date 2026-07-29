import {
  Color3,
  LoadAssetContainerAsync,
  Matrix,
  Mesh,
  PBRMaterial,
  Quaternion,
  Texture,
  Vector3,
  VertexData,
} from '@babylonjs/core';
import type {
  AssetContainer,
  Scene,
  ShadowGenerator,
} from '@babylonjs/core';
import type { Collider } from '@dissonance/world';
import type { FloorSurface } from '@dissonance/player';
import type { LocationEntry } from './LocationProps';
import { buildStreetLamp, buildMilosInterior } from './LocationProps';
import { ensureGltfLoader } from './gltfLoader';

export interface CompositeLocationsHandle {
  // One collider per solid (non-Milo's-building) building instance — see
  // BUILDING_COLLISION_RADII/MILOS_BUILDING_ID below. Streets/sidewalks/
  // props/lamps stay walk-through; only buildings are "un-enterable" here.
  colliders: Collider[];
  // World-space "you can stand here" rectangles for Milo's stairwell steps
  // and second-floor slab — see PlayerController.setFloorSurfaces. Empty
  // for every other building (none of them have interior geometry).
  floorSurfaces: FloorSurface[];
  // Stable interaction metadata derived from the authored placement.
  milosEntrance: SurveilledLocationEntrance | null;
  dispose(): void;
}

export interface SurveilledLocationEntrance {
  featureId: 'milos-building';
  position: Vector3;
  cameraRotation: Vector3;
  interactionRadius: number;
}

// Real footprint dimensions read straight off each glTF's own position
// accessor min/max (checked directly, not guessed): buildings small
// 12.46x14.54m, medium 15.06x13.06m, large 20.64x16.64m — radius = average
// of the two half-extents, not the half-diagonal, so a circle stays inside
// the footprint on the flat walls instead of bulging past them into the
// sidewalk (undershoots at the corners, the safer failure mode; a circle
// can't fit a rectangle exactly). bollard 0.216x0.227m, planter 2x2m —
// both round enough that half-extent and half-diagonal barely differ, no
// real corner-vs-flat tradeoff to make. street-lamp reuses the same 0.3
// LocationProps.ts's own PROP_COLLISION_RADII already settled on for the
// identical buildStreetLamp mesh — same asset, different placement path
// (CompositeLocations' compound grid here vs. scatterLocationProps'
// jittered single point there), same collision radius.
// Everything else placeable on a compound (streets, sidewalks, crosswalk
// decals, manhole covers, drains) is flat ground, deliberately excluded —
// walking ON these is the point, not blocked BY them.
const OBSTACLE_COLLISION_RADII: Record<string, number> = {
  'building-small': 6.5,
  'building-medium': 7,
  'building-large': 9,
  bollard: 0.15,
  planter: 1.0,
  'street-lamp': 0.3,
};
// One building on "dissonance boulevard" is tagged this id in locations.json
// (Dan, 2026-07-27: "all buildings but milo's apartment building
// un-enterable") — excluded from the collider list below so the player can
// walk into its footprint; everything else with an OBSTACLE_COLLISION_RADII
// entry is solid.
const MILOS_BUILDING_ID = 'milos-building';

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

// Every "MI_FakeInterior_N" material is a flat card behind a window's glass
// pane. The kit's own baked photo of a little room (see ASSET-LICENSE.txt —
// the paid tier has real interior shaders; this free tier only ships the
// photo) tiled identically across every window of every building instance,
// which read as a repeated photographed office rather than "a lit window at
// range" — replaced here (Dan, 2026-07-27) with a plain procedural glow
// card, no baked room detail at all. albedoColor/emissiveColor still tint
// and glow it via the same windowTintColor/windowGlow signals; default
// white/0 leaves it a plain unlit pale card, close enough to the old
// un-tuned look that every existing view still reads fine.
const FAKE_INTERIOR_MATERIAL_PREFIX = 'MI_FakeInterior';
const WINDOW_CARD_SIZE = 128;
// The window's real UV'd quad (baked into the glTF) isn't a tight crop of
// exactly the visible glass — it runs a bit past it into the frame/an
// arched top corner, which the kit's original naturalistic photo texture
// disguised (its edges were already wall/shadow tones). A flat, bright
// gradient filled edge-to-edge exposed that overscan as a visible light
// leak past the frame (Dan, 2026-07-27 screenshot). Insetting the glow
// inside this margin, dark everywhere else, means any overscan reads as
// dark frame instead — cheap, and correct regardless of the exact UV fit.
const WINDOW_CARD_MARGIN_FRACTION = 0.15;

// docs/THREADS.md T7 ("window occupancy") — first, deliberately small cut:
// one still silhouette on one card's glow texture. NOT the full T7 spec (no
// rarity roll, no UV-scrolled crossing motion, no scripted stop-and-turn
// beat) — those need per-instance variation this thin-instancing loader
// doesn't support (every placement of one asset shares one material set, so
// this appears on all three "building-large" instances identically, not ~3
// sightings per walk). Toggle off below if it reads wrong before investing
// in the real per-instance version.
const ENABLE_WINDOW_SHADOW_FIGURE = false;
const SHADOW_FIGURE_ASSET = 'building-large';
const SHADOW_FIGURE_MATERIAL = 'MI_FakeInterior_1';

// A plain vertical glow gradient — brighter near the top (reads as a
// ceiling light bleeding down) fading toward the sill — standing in for the
// baked room photo. `withFigure` layers one still person-shaped silhouette
// on top, standing on the card's implied floor; see ENABLE_WINDOW_SHADOW_
// FIGURE above for why only one card ever gets this.
function buildWindowCardTexture(scene: Scene, withFigure: boolean): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = WINDOW_CARD_SIZE;
  canvas.height = WINDOW_CARD_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Dark everywhere first — this is what shows through the margin (see
  // WINDOW_CARD_MARGIN_FRACTION above).
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, WINDOW_CARD_SIZE, WINDOW_CARD_SIZE);

  const margin = WINDOW_CARD_SIZE * WINDOW_CARD_MARGIN_FRACTION;
  const innerSize = WINDOW_CARD_SIZE - margin * 2;
  const gradient = ctx.createLinearGradient(0, margin, 0, margin + innerSize);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0.22)');
  ctx.fillStyle = gradient;
  ctx.fillRect(margin, margin, innerSize, innerSize);

  if (withFigure) {
    const figureX = margin + innerSize * 0.6;
    const floorY = margin + innerSize * 0.94;
    const figureHeight = innerSize * 0.5;
    const headRadius = figureHeight * 0.14;
    ctx.fillStyle = 'rgba(4, 4, 6, 0.92)';
    ctx.beginPath();
    ctx.arc(figureX, floorY - figureHeight + headRadius, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(figureX, floorY - figureHeight * 0.45, figureHeight * 0.16, figureHeight * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return new Texture(canvas.toDataURL('image/png'), scene);
}

function applyWindowTint(
  container: AssetContainer,
  asset: string,
  tintColor: Color3,
  glow: number,
  cardTexture: Texture,
  cardWithFigureTexture: Texture,
): void {
  for (const material of container.materials) {
    if (!material.name.startsWith(FAKE_INTERIOR_MATERIAL_PREFIX)) continue;
    const mat = material as PBRMaterial;
    const useFigure = ENABLE_WINDOW_SHADOW_FIGURE
      && asset === SHADOW_FIGURE_ASSET
      && material.name === SHADOW_FIGURE_MATERIAL;
    const texture = useFigure ? cardWithFigureTexture : cardTexture;
    mat.albedoTexture = texture;
    mat.albedoColor = tintColor;
    mat.emissiveTexture = texture;
    mat.emissiveColor = tintColor.scale(glow);
  }
}

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
  id?: string;
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
        id: placement.id,
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

// Same baked-transform + minimumY compensation as placeRenderMeshes, but a
// regular Node transform (position/rotationQuaternion/scaling) instead of a
// thin-instance matrix. Needed for Milo's building specifically: only a
// mesh with a real Node transform supports normal parent/child
// relationships, and the door/stairwell/second-floor meshes need to be
// parented to it so they inherit its placement automatically. Assumes a
// single render mesh (true for every building.gltf checked so far — one
// merged multi-material mesh per file); logs if that ever stops holding.
// Returns the world Y that the mesh's own local Y=0 maps to, so callers can
// place child geometry (or compute FloorSurfaces) in the building's local
// space and convert it themselves.
function placeSingleTransformMesh(
  renderMeshes: Mesh[],
  placement: ExpandedPlacement,
  shadowGenerator?: ShadowGenerator,
): { baseWorldY: number } {
  if (renderMeshes.length !== 1) {
    console.warn(`[CompositeLocations] expected exactly one render mesh for a single-transform placement, got ${renderMeshes.length}`);
  }
  let minimumY = Number.POSITIVE_INFINITY;
  for (const mesh of renderMeshes) {
    mesh.computeWorldMatrix(true);
    minimumY = Math.min(minimumY, mesh.getBoundingInfo().boundingBox.minimumWorld.y);
  }
  if (!Number.isFinite(minimumY)) minimumY = 0;

  const baseWorldY = placement.groundY - minimumY * placement.scaleY;
  for (const mesh of renderMeshes) {
    mesh.bakeCurrentTransformIntoVertices();
    mesh.parent = null;
    mesh.receiveShadows = true;
    mesh.position.set(placement.x, baseWorldY, placement.z);
    mesh.rotationQuaternion = Quaternion.FromEulerAngles(0, placement.rotationRadians, 0);
    mesh.scaling.set(placement.scaleXZ, placement.scaleY, placement.scaleXZ);
    shadowGenerator?.addShadowCaster(mesh);
  }
  return { baseWorldY };
}

// Converts one of buildMilosInterior's local-space rectangles into a
// world-space PlayerController.FloorSurface, applying the exact same
// rotate/scale/translate the building mesh itself was placed with (see
// placeSingleTransformMesh) so a rotated placement (Milo's is
// rotationDegrees: 90) still gets a correctly-positioned rectangle. Uses
// the AABB of the four rotated corners rather than a true oriented
// rectangle — exact for the 90-degree-multiple rotations every compound
// placement in this app actually uses, a safe (over-covering, never
// under-covering) approximation for anything else.
function localFloorSurfaceToWorld(
  local: { minX: number; maxX: number; minZ: number; maxZ: number; y: number },
  placement: ExpandedPlacement,
  baseWorldY: number,
): FloorSurface {
  const cos = Math.cos(placement.rotationRadians);
  const sin = Math.sin(placement.rotationRadians);
  const corners = [
    [local.minX, local.minZ], [local.maxX, local.minZ],
    [local.maxX, local.maxZ], [local.minX, local.maxZ],
  ].map(([lx, lz]) => {
    const sx = lx * placement.scaleXZ;
    const sz = lz * placement.scaleXZ;
    return { x: placement.x + (sx * cos - sz * sin), z: placement.z + (sx * sin + sz * cos) };
  });
  return {
    minX: Math.min(...corners.map((c) => c.x)),
    maxX: Math.max(...corners.map((c) => c.x)),
    minZ: Math.min(...corners.map((c) => c.z)),
    maxZ: Math.max(...corners.map((c) => c.z)),
    y: baseWorldY + local.y * placement.scaleY,
  };
}

function localPointToWorld(
  local: Vector3,
  placement: ExpandedPlacement,
  baseWorldY: number,
): Vector3 {
  const cos = Math.cos(placement.rotationRadians);
  const sin = Math.sin(placement.rotationRadians);
  const scaledX = local.x * placement.scaleXZ;
  const scaledZ = local.z * placement.scaleXZ;
  return new Vector3(
    placement.x + (scaledX * cos - scaledZ * sin),
    baseWorldY + local.y * placement.scaleY,
    placement.z + (scaledX * sin + scaledZ * cos),
  );
}

// Milo's building specifically (see MILOS_BUILDING_ID) — loaded as its own
// standalone container rather than folded into the shared "building-medium"
// thin-instance batch, since thin instances can't carry unique per-instance
// geometry (the door/stairwell/second floor would otherwise appear on
// every building-medium on the boulevard, not just this one).
async function loadMilosBuilding(
  scene: Scene,
  placement: ExpandedPlacement,
  windowTintColor: Color3,
  windowGlow: number,
  cardTexture: Texture,
  cardWithFigureTexture: Texture,
  shadowGenerator?: ShadowGenerator,
): Promise<{
  container: AssetContainer;
  extraMeshes: Mesh[];
  floorSurfaces: FloorSurface[];
  entrance: SurveilledLocationEntrance;
}> {
  const container = await LoadAssetContainerAsync(`${CITY_ASSET_BASE}${CITY_ASSETS['building-medium']}`, scene);
  container.addAllToScene();
  const renderMeshes = container.meshes.filter(
    (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0,
  );
  if (renderMeshes.length === 0) throw new Error('milos building has no renderable meshes');

  applyWindowTint(container, 'building-medium', windowTintColor, windowGlow, cardTexture, cardWithFigureTexture);
  const { baseWorldY } = placeSingleTransformMesh(renderMeshes, placement, shadowGenerator);

  const buildingMesh = renderMeshes[0];
  const { meshes: extraMeshes, floorSurfaces: localFloorSurfaces } = buildMilosInterior(scene);
  extraMeshes.forEach((mesh) => {
    mesh.parent = buildingMesh;
    mesh.receiveShadows = true;
    shadowGenerator?.addShadowCaster(mesh);
  });
  const floorSurfaces = localFloorSurfaces.map((local) => localFloorSurfaceToWorld(local, placement, baseWorldY));
  const position = localPointToWorld(new Vector3(-2, 0, 1.75), placement, baseWorldY);
  const doorTarget = localPointToWorld(new Vector3(-2, 1.15, 0), placement, baseWorldY);
  const direction = doorTarget.subtract(position);
  const entrance: SurveilledLocationEntrance = {
    featureId: MILOS_BUILDING_ID,
    position,
    cameraRotation: new Vector3(
      Math.atan2(-direction.y, Math.hypot(direction.x, direction.z)),
      Math.atan2(direction.x, direction.z),
      0,
    ),
    interactionRadius: 3 * placement.scaleXZ,
  };

  return { container, extraMeshes, floorSurfaces, entrance };
}

async function loadThinInstancedAsset(
  scene: Scene,
  asset: string,
  filename: string,
  placements: ExpandedPlacement[],
  windowTintColor: Color3,
  windowGlow: number,
  cardTexture: Texture,
  cardWithFigureTexture: Texture,
  shadowGenerator?: ShadowGenerator,
): Promise<AssetContainer> {
  const container = await LoadAssetContainerAsync(`${CITY_ASSET_BASE}${filename}`, scene);
  container.addAllToScene();
  const renderMeshes = container.meshes.filter(
    (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0,
  );
  if (renderMeshes.length === 0) throw new Error(`city asset has no renderable meshes: ${filename}`);

  applyWindowTint(container, asset, windowTintColor, windowGlow, cardTexture, cardWithFigureTexture);

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
  windowTintColor: Color3 = Color3.White(),
  windowGlow: number = 0,
  shadowGenerator?: ShadowGenerator,
): Promise<CompositeLocationsHandle> {
  await ensureGltfLoader();
  const byAsset = new Map<string, ExpandedPlacement[]>();
  const gradePads: Mesh[] = [];
  const colliders: Collider[] = [];
  // Set at most once — locations.json is expected to tag MILOS_BUILDING_ID
  // on exactly one placement. If it's ever tagged twice, the last one wins
  // silently; not worth a loud validation for a single hand-authored id.
  let milosPlacement: ExpandedPlacement | undefined;
  // Built once and shared by every "fake interior" material across every
  // building type/instance — see applyWindowTint's own comment for why
  // these replaced the kit's baked room photo.
  const windowCardTexture = buildWindowCardTexture(scene, false);
  const windowCardWithFigureTexture = buildWindowCardTexture(scene, true);

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
      const expandedPlacement = { ...placement, groundY: planeHeightAt(plane, placement.x, placement.z) };

      if (placement.id === MILOS_BUILDING_ID) {
        // Not added to byAsset — this one gets its own standalone container
        // below (loadMilosBuilding) instead of the shared thin-instance
        // batch, and no collider (it's the one enterable building).
        milosPlacement = expandedPlacement;
        continue;
      }

      const entries = byAsset.get(placement.asset) ?? [];
      entries.push(expandedPlacement);
      byAsset.set(placement.asset, entries);

      const obstacleRadius = OBSTACLE_COLLISION_RADII[placement.asset];
      if (obstacleRadius !== undefined) {
        colliders.push({ x: placement.x, z: placement.z, radius: obstacleRadius * horizontalScale });
      }
    }
  }

  const containers: AssetContainer[] = [];
  const proceduralMeshes: Mesh[] = [];
  let floorSurfaces: FloorSurface[] = [];
  let milosEntrance: SurveilledLocationEntrance | null = null;
  await Promise.all([
    ...[...byAsset].map(async ([asset, entries]) => {
      if (asset in PROCEDURAL_ASSETS) {
        const template = placeProceduralAsset(scene, PROCEDURAL_ASSETS[asset], entries, shadowGenerator);
        proceduralMeshes.push(template);
      } else {
        const container = await loadThinInstancedAsset(
          scene, asset, CITY_ASSETS[asset], entries, windowTintColor, windowGlow,
          windowCardTexture, windowCardWithFigureTexture, shadowGenerator,
        );
        containers.push(container);
      }
      console.info(`[CompositeLocations] placed ${entries.length} "${asset}" module(s)`);
    }),
    (async () => {
      if (!milosPlacement) return;
      const milos = await loadMilosBuilding(
        scene, milosPlacement, windowTintColor, windowGlow,
        windowCardTexture, windowCardWithFigureTexture, shadowGenerator,
      );
      containers.push(milos.container);
      floorSurfaces = milos.floorSurfaces;
      milosEntrance = milos.entrance;
      console.info(`[CompositeLocations] placed milos-building (door/stairwell/second-floor, ${floorSurfaces.length} floor surfaces)`);
    })(),
  ]);

  return {
    colliders,
    floorSurfaces,
    milosEntrance,
    dispose: () => {
      containers.forEach((container) => container.dispose());
      // false/true: skip the (already-null) parent-hierarchy walk, do
      // dispose the material+textures — each of these meshes owns a
      // freshly-constructed material with nothing else referencing it, so
      // this is the fix for the leak-on-rebuild noted in review: every
      // hScale/vExag slider drag disposes and rebuilds this whole set.
      proceduralMeshes.forEach((mesh) => mesh.dispose(false, true));
      // Milo's door/stairwell/second-floor meshes are parented to the
      // building mesh, which containers.forEach's dispose() above already
      // tears down — Babylon disposes a mesh's children along with it, so
      // these would double-dispose (harmless — dispose() on an
      // already-disposed mesh is a no-op) if listed too; skipped here to
      // keep this loop's own semantics clear (every mesh in it owns a
      // freshly-constructed material, which containers' meshes do not).
      gradePads.forEach((mesh) => mesh.dispose(false, true));
      // Not tracked in any container's own texture list (built standalone,
      // shared across every building type's materials) — container.dispose()
      // above won't reach these, so they'd leak on every rebuild otherwise.
      windowCardTexture.dispose();
      windowCardWithFigureTexture.dispose();
    },
  };
}
