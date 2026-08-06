import {
  LoadAssetContainerAsync,
  Mesh,
  TransformNode,
  Vector3,
  type AssetContainer,
  type Scene,
  type ShadowGenerator,
} from '@babylonjs/core';
import type { Collider } from '@dissonance/world';
import type { LocationEntry } from './LocationProps';
import { ensureGltfLoader } from './gltfLoader';

const RUNTIME_MODEL_URL = `${import.meta.env.BASE_URL}models/city-complex/city-complex.glb`;
// Meshes shorter than this (real, un-scaled model meters) are treated as
// ground-level clutter (streets, sidewalks, curbs, decals) and skipped when
// deriving colliders below — only meshes solid enough to plausibly block a
// walking player get one.
const SOLID_HEIGHT_THRESHOLD_METERS = 0.5;

export interface CityComplexHandle {
  colliders: Collider[];
  dispose(): void;
}

interface LoadedCityComplex {
  root: TransformNode;
  container: AssetContainer;
  colliders: Collider[];
}

async function loadOne(
  scene: Scene,
  location: LocationEntry,
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  getHeightAt: (x: number, z: number) => number,
  shadowGenerator: ShadowGenerator | undefined,
): Promise<LoadedCityComplex> {
  const cityComplex = location.cityComplex!;
  const geoAnchor = toRenderXZ(location.latLong[0], location.latLong[1]);
  const [localOffsetX, localOffsetZ] = cityComplex.local ?? [0, 0];
  const anchor = {
    x: geoAnchor.x + localOffsetX * horizontalScale,
    z: geoAnchor.z + localOffsetZ * horizontalScale,
  };
  const effectiveScale = horizontalScale * (cityComplex.scale ?? 1);
  const effectiveScaleY = horizontalScale * (cityComplex.scaleY ?? cityComplex.scale ?? 1);
  const headingRadians = (cityComplex.headingDegrees * Math.PI) / 180;
  const cosHeading = Math.cos(headingRadians);
  const sinHeading = Math.sin(headingRadians);

  // Outer root carries the real placement (world position/heading, plus the
  // real-meters -> render-space scale every other exterior loader applies —
  // see WorldTerminals.ts's own root.scaling.setAll). Y scale is independent
  // (effectiveScaleY) so buildings can be stretched taller without resizing
  // the footprint. Root Y position is a placeholder until the model's own
  // footprint is known below.
  const outerRoot = new TransformNode(`cityComplex:${location.id}`, scene);
  outerRoot.position.set(anchor.x, getHeightAt(anchor.x, anchor.z), anchor.z);
  outerRoot.rotation.y = headingRadians;
  outerRoot.scaling.set(effectiveScale, effectiveScaleY, effectiveScale);

  // Inner root stays at identity while the loaded scene is recentered — its
  // own local space equals world space until it's parented under outerRoot
  // below, which sidesteps having to convert the source scene's arbitrary
  // Blender-authored pivot through outerRoot's rotation/scale by hand.
  const innerRoot = new TransformNode(`cityComplex:${location.id}:inner`, scene);

  await ensureGltfLoader();
  const container = await LoadAssetContainerAsync(RUNTIME_MODEL_URL, scene);
  container.addAllToScene();
  for (const node of container.rootNodes) node.parent = innerRoot;

  const renderMeshes = container.meshes.filter(
    (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0,
  );
  for (const mesh of renderMeshes) {
    mesh.receiveShadows = true;
    mesh.computeWorldMatrix(true);
    shadowGenerator?.addShadowCaster(mesh);
  }

  let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  for (const mesh of renderMeshes) {
    const bounds = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, bounds.minimumWorld);
    max = Vector3.Maximize(max, bounds.maximumWorld);
  }
  // innerRoot is still at identity here, so these bounds are effectively
  // local — center the geometry's X/Z under innerRoot. Deliberately NOT also
  // zeroing Y to the geometry's lowest point: the source scene's own street
  // level sits at its object-space Y=0 (min.y is only ~-0.68, a below-grade
  // curb/foundation detail, not the walkable surface) — trust the source's
  // own ground reference instead of the geometric minimum.
  const center = min.add(max).scale(0.5);
  innerRoot.position.set(-center.x, 0, -center.z);
  innerRoot.parent = outerRoot;

  // A rigid flat-bottomed block on sloped terrain can't sit flush
  // everywhere — sample the terrain under all four footprint corners (in
  // real, un-scaled model meters, converted to world offsets through the
  // same heading/scale the model itself renders with) and settle on the
  // lowest of the five. The block may sink slightly into the high side, but
  // it never floats above the low side.
  const halfWidth = ((max.x - min.x) / 2) * effectiveScale;
  const halfDepth = ((max.z - min.z) / 2) * effectiveScale;
  const corners: Array<[number, number]> = [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [-halfWidth, halfDepth],
    [halfWidth, halfDepth],
  ];
  let lowestGroundY = getHeightAt(anchor.x, anchor.z);
  for (const [cornerX, cornerZ] of corners) {
    const worldX = anchor.x + cornerX * cosHeading + cornerZ * sinHeading;
    const worldZ = anchor.z - cornerX * sinHeading + cornerZ * cosHeading;
    lowestGroundY = Math.min(lowestGroundY, getHeightAt(worldX, worldZ));
  }
  // heightOffset is a real-meters nudge on top of the auto terrain fit —
  // same real-to-render conversion as `local`, not `scale`, since it's
  // adjusting the ground-fit point itself rather than a property of the
  // model's own geometry.
  outerRoot.position.y = lowestGroundY + (cityComplex.heightOffset ?? 0) * horizontalScale;
  innerRoot.computeWorldMatrix(true);

  // Derive one circle collider per solid mesh from its own world bounding
  // box (a circle circumscribing its XZ footprint) and feed it into the
  // same Collider[] list every other exterior feature already uses — see
  // PlayerController.isColliding(), which is pure circle-vs-point math with
  // no notion of mesh geometry, so this is the only way exterior collision
  // sees this GLB at all. This asset has no usable per-mesh naming to key a
  // building/street classification off (see prepare_city_complex.py's
  // "Mesh"/"Mesh.001" export warnings), so a height threshold stands in:
  // anything taller than SOLID_HEIGHT_THRESHOLD_METERS blocks, flatter
  // meshes (streets, sidewalks, curbs, decals) stay walkable. Real gaps in
  // the source geometry (modeled doorways, if any) fall out of this
  // naturally, not by design.
  const colliders: Collider[] = [];
  const solidHeightThreshold = SOLID_HEIGHT_THRESHOLD_METERS * effectiveScaleY;
  for (const mesh of renderMeshes) {
    const bounds = mesh.getBoundingInfo().boundingBox;
    const meshMin = bounds.minimumWorld;
    const meshMax = bounds.maximumWorld;
    if (meshMax.y - meshMin.y < solidHeightThreshold) continue;
    const width = meshMax.x - meshMin.x;
    const depth = meshMax.z - meshMin.z;
    colliders.push({
      x: (meshMin.x + meshMax.x) / 2,
      z: (meshMin.z + meshMax.z) / 2,
      radius: Math.hypot(width, depth) / 2,
    });
  }

  console.info(
    `[CityComplex] loaded ${renderMeshes.length} meshes, ` +
      `${renderMeshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0)} vertices, ` +
      `${colliders.length} colliders for "${location.id}"`,
  );

  return { root: outerRoot, container, colliders };
}

// Loads city-complex.glb (see scripts/blender/prepare_city_complex.py) once
// per `cityComplex` location entry and places it whole at that location's
// own latLong, deriving exterior colliders from the loaded mesh geometry —
// see LocationProps.ts's cityComplex field comment. No story/save wiring.
export async function loadCityComplex(
  scene: Scene,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  getHeightAt: (x: number, z: number) => number,
  shadowGenerator?: ShadowGenerator,
): Promise<CityComplexHandle> {
  const targets = locations.filter((location) => location.cityComplex);
  const results = (
    await Promise.all(
      targets.map((location) =>
        loadOne(scene, location, toRenderXZ, horizontalScale, getHeightAt, shadowGenerator).catch(
          (error): LoadedCityComplex | null => {
            console.error(`[CityComplex] failed to load runtime GLB for "${location.id}"`, error);
            return null;
          },
        ),
      ),
    )
  ).filter((result): result is LoadedCityComplex => result !== null);

  return {
    colliders: results.flatMap((result) => result.colliders),
    dispose() {
      results.forEach((result) => {
        result.container.dispose();
        result.root.dispose();
      });
    },
  };
}
