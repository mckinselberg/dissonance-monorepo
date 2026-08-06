import {
  LoadAssetContainerAsync,
  Mesh,
  TransformNode,
  Vector3,
  type AssetContainer,
  type Scene,
  type ShadowGenerator,
} from '@babylonjs/core';
import type { LocationEntry } from './LocationProps';
import { ensureGltfLoader } from './gltfLoader';

const RUNTIME_MODEL_URL = `${import.meta.env.BASE_URL}models/city-complex/city-complex.glb`;

export interface CityComplexHandle {
  dispose(): void;
}

// Loads city-complex.glb (see scripts/blender/prepare_city_complex.py) once
// per `cityComplex` location entry and places it whole at that location's
// own latLong. Visual-only POC — no colliders, no story/save wiring (see
// LocationProps.ts's cityComplex field comment).
export function loadCityComplex(
  scene: Scene,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  getHeightAt: (x: number, z: number) => number,
  shadowGenerator?: ShadowGenerator,
): CityComplexHandle {
  let disposed = false;
  const roots: TransformNode[] = [];
  const containers: AssetContainer[] = [];

  for (const location of locations) {
    const cityComplex = location.cityComplex;
    if (!cityComplex) continue;

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

    // Outer root carries the real placement (world position/heading, plus
    // the real-meters -> render-space scale every other exterior loader
    // applies — see WorldTerminals.ts's own root.scaling.setAll). Y scale is
    // independent (effectiveScaleY) so buildings can be stretched taller
    // without resizing the footprint. Root Y position is only a placeholder
    // here — the model's footprint isn't known until it loads, so it's set
    // for real once loadCity's async work below samples the terrain under
    // the whole footprint rather than a single point.
    const outerRoot = new TransformNode(`cityComplex:${location.id}`, scene);
    outerRoot.position.set(anchor.x, getHeightAt(anchor.x, anchor.z), anchor.z);
    outerRoot.rotation.y = headingRadians;
    outerRoot.scaling.set(effectiveScale, effectiveScaleY, effectiveScale);
    roots.push(outerRoot);

    // Inner root stays at identity while the loaded scene is recentered —
    // its own local space equals world space until it's parented under
    // outerRoot below, which sidesteps having to convert the source scene's
    // arbitrary Blender-authored pivot through outerRoot's rotation/scale by
    // hand.
    const innerRoot = new TransformNode(`cityComplex:${location.id}:inner`, scene);

    void (async () => {
      try {
        await ensureGltfLoader();
        const container = await LoadAssetContainerAsync(RUNTIME_MODEL_URL, scene);
        if (disposed) {
          container.dispose();
          return;
        }
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
        // innerRoot is still at identity here, so these bounds are
        // effectively local — center the geometry's X/Z under innerRoot.
        // Deliberately NOT also zeroing Y to the geometry's lowest point:
        // the source scene's own street level sits at its object-space
        // Y=0 (confirmed against scripts/blender/prepare_city_complex.py's
        // stats dump — min.y is only ~-0.68, a below-grade curb/foundation
        // detail, not the walkable surface), so re-flooring on min.y instead
        // left the actual street floating ~0.68m above the terrain (~1.4m
        // once doubled by the `scale: 2` placement) — trust the source's
        // own ground reference instead.
        const center = min.add(max).scale(0.5);
        innerRoot.position.set(-center.x, 0, -center.z);
        innerRoot.parent = outerRoot;

        // A rigid flat-bottomed block on sloped terrain can't sit flush
        // everywhere — sampling only the anchor's own point left edges
        // floating wherever the terrain nearby happened to be lower than
        // that one sample. Sample the terrain under all four footprint
        // corners (in real, un-scaled model meters, converted to world
        // offsets through the same heading/scale the model itself renders
        // with) and settle on the lowest of the five — the block may sink
        // slightly into the high side, but it never floats above the low
        // side, which reads better for something meant to sit ON the
        // ground.
        const halfWidth = ((max.x - min.x) / 2) * effectiveScale;
        const halfDepth = ((max.z - min.z) / 2) * effectiveScale;
        const corners: Array<[number, number]> = [
          [-halfWidth, -halfDepth], [halfWidth, -halfDepth],
          [-halfWidth, halfDepth], [halfWidth, halfDepth],
        ];
        let lowestGroundY = getHeightAt(anchor.x, anchor.z);
        for (const [cornerX, cornerZ] of corners) {
          const worldX = anchor.x + cornerX * cosHeading + cornerZ * sinHeading;
          const worldZ = anchor.z - cornerX * sinHeading + cornerZ * cosHeading;
          lowestGroundY = Math.min(lowestGroundY, getHeightAt(worldX, worldZ));
        }
        // heightOffset is a real-meters nudge on top of the auto terrain
        // fit — same real-to-render conversion as `local`, not `scale`,
        // since it's adjusting the ground-fit point itself rather than a
        // property of the model's own geometry.
        outerRoot.position.y = lowestGroundY + (cityComplex.heightOffset ?? 0) * horizontalScale;
        innerRoot.computeWorldMatrix(true);
        containers.push(container);

        console.info(
          `[CityComplex] loaded ${renderMeshes.length} meshes, ` +
          `${renderMeshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0)} vertices ` +
          `for "${location.id}"`,
        );
      } catch (error) {
        console.error(`[CityComplex] failed to load runtime GLB for "${location.id}"`, error);
      }
    })();
  }

  return {
    dispose() {
      disposed = true;
      containers.forEach((container) => container.dispose());
      roots.forEach((root) => root.dispose());
    },
  };
}
