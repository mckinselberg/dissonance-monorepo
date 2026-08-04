import { LoadAssetContainerAsync, Material, Matrix, Mesh, Quaternion, Vector3 } from '@babylonjs/core';
import type { Scene, ShadowGenerator } from '@babylonjs/core';
import { FoliageSwayPlugin, type FoliageSwaySource } from '@dissonance/world';
import { ensureGltfLoader } from './gltfLoader';

export interface HeroTreeInstancesHandle {
  triangleCount: number;
  setPlacements(groundPositions: Vector3[], horizontalScale: number, verticalScale: number): void;
  dispose(): void;
}

// Per-instance size variation, independent per axis (so a given tree isn't
// just a uniformly bigger/smaller clone — it can be a bit stouter or a bit
// taller than its neighbors too). Bounded to +/-18% around the caller's
// base scale — real same-species specimens vary by roughly this much;
// wider would start reading as different species rather than natural
// variation, which is what "realistic heights" means for a single template.
const SCALE_JITTER_MIN = 0.82;
const SCALE_JITTER_MAX = 1.18;
const jitterScale = (base: number, rand: () => number) =>
  base * (SCALE_JITTER_MIN + rand() * (SCALE_JITTER_MAX - SCALE_JITTER_MIN));

// setPlacements is called repeatedly for the SAME ground position whenever
// distance culling re-uploads the currently-visible subset (BulkForestSystem/
// TrailsideForestSystem's updateCulling, every 0.25s while the camera moves)
// — not just once at load/reposition time. Math.random() per call made every
// still-visible tree reroll its rotation and scale jitter on every culling
// tick, which read as the whole forest "animating"/jumping in place instead
// of holding still. Seeding off the position itself (mulberry32, same
// generator shape as BulkForestSystem's createBulkEligibleCandidatePositions)
// makes a given ground position always produce the same jitter, so repeat
// calls with the same positions are visually stable.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashPosition(x: number, z: number): number {
  let h = 0x811c9dc5;
  // Millimeter precision keeps neighboring trees from colliding onto the
  // same seed while staying far below any meaningful position difference.
  h ^= Math.imul(Math.floor(x * 1000) | 0, 0x85ebca6b);
  h = Math.imul(h, 0x01000193);
  h ^= Math.imul(Math.floor(z * 1000) | 0, 0xc2b2ae35);
  h = Math.imul(h, 0x01000193);
  return h >>> 0;
}

// Scatters ONE loaded GLB as GPU thin instances — the hero-zone half of the
// two-tier plan in docs/archive/THREADS-fold-in.260721.md (T8): full-detail real
// geometry close to the player, in place of a decimated scatter-tier asset
// that doesn't exist yet. Originally written for tree_small_02 (see
// public/models/tree-small-02/ASSET-LICENSE.txt — 52k tris/tree), now
// reused for the other Poly Haven hero-zone props (saplings, dead trunk,
// stump), and for the bulk-forest and trailside tiers (main.tsx) — every
// caller thin-instances one loaded asset across a set of placements, just
// with different candidate-point sources and counts.
//
// Multi-material GLBs (trunk+leaf-card submeshes with different vertex
// attributes) can't go through Mesh.MergeMeshes — it requires identical
// attributes across all sources. Instead this follows Babylon's documented
// pattern for thin-instancing a multi-mesh model: thinInstanceAdd is called
// on EACH submesh with the SAME matrix array, so every part renders at
// every location without merging geometry at all.
export async function loadHeroTreeInstances(
  scene: Scene,
  url: string,
  groundPositions: Vector3[],
  horizontalScale: number,
  verticalScale: number,
  shadowGenerator?: ShadowGenerator,
  wind?: FoliageSwaySource,
): Promise<HeroTreeInstancesHandle> {
  await ensureGltfLoader();

  const container = await LoadAssetContainerAsync(url, scene);

  try {
    container.addAllToScene();

    const renderMeshes = container.meshes.filter(
      (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0,
    );
    if (renderMeshes.length === 0) throw new Error(`hero asset GLB has no renderable meshes: ${url}`);

    // The live-tree GLBs name their foliage card materials "leaves", "twig",
    // or "twigs". Bark, branches, dead wood, trunks, and stumps stay rigid.
    if (wind) {
      const foliageMaterials = new Set<Material>();
      for (const mesh of renderMeshes) {
        for (const material of mesh.subMeshes
          .map((subMesh) => subMesh.getMaterial())
          .filter((material): material is Material => material instanceof Material)) {
          if (/(?:leaves|twigs?)/i.test(material.name)) foliageMaterials.add(material);
        }
      }
      foliageMaterials.forEach((material) => new FoliageSwayPlugin(material, wind));
    }

    let minimumY = Number.POSITIVE_INFINITY;
    let triangleCount = 0;
    for (const mesh of renderMeshes) {
      mesh.computeWorldMatrix(true);
      minimumY = Math.min(minimumY, mesh.getBoundingInfo().boundingBox.minimumWorld.y);
      triangleCount += Math.floor(mesh.getTotalIndices() / 3);
      // Bakes this mesh's full container-hierarchy world matrix into its own
      // vertices and resets its local transform to identity, so thinInstanceAdd's
      // absolute world matrices afterward don't need to account for the
      // GLB's internal node structure.
      mesh.bakeCurrentTransformIntoVertices();
      mesh.parent = null;
      mesh.receiveShadows = true;
      shadowGenerator?.addShadowCaster(mesh);
    }
    if (!Number.isFinite(minimumY)) minimumY = 0;

    const setPlacements = (positions: Vector3[], scaleXZ: number, scaleY: number) => {
      const matrices = positions.map((pos) => {
        const rand = seededRandom(hashPosition(pos.x, pos.z));
        const sxz = jitterScale(scaleXZ, rand);
        const sy = jitterScale(scaleY, rand);
        return Matrix.Compose(
          new Vector3(sxz, sy, sxz),
          Quaternion.FromEulerAngles(0, rand() * Math.PI * 2, 0),
          new Vector3(pos.x, pos.y - minimumY * sy, pos.z),
        );
      });
      for (const mesh of renderMeshes) {
        mesh.thinInstanceCount = 0;
        if (matrices.length > 0) mesh.thinInstanceAdd(matrices, true);
      }
      shadowGenerator?.getShadowMap()?.resetRefreshCounter();
    };
    setPlacements(groundPositions, horizontalScale, verticalScale);

    let disposed = false;
    return {
      triangleCount,
      setPlacements,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        renderMeshes.forEach((mesh) => mesh.dispose());
        container.dispose();
      },
    };
  } catch (error) {
    container.dispose();
    throw error;
  }
}
