import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh, Matrix, Quaternion, Vector3, ShadowGenerator } from '@babylonjs/core';

export type ThinInstanceTreesOptions = {
  templateCount?: number;
  // Real (unscaled) tree height range, in meters.
  heightMin?: number;
  heightMax?: number;
  // Opt-in — same ForestGenerator convention (packages/world's DTA forest):
  // registered per-template after each scatter()'s thinInstanceAdd.
  shadowGenerator?: ShadowGenerator;
};

// A real-world (x, z) position plus its real (unscaled) ground elevation —
// e.g. straight out of HeightmapSampler.sampleHeight, same convention
// HeightmapTerrain/WaterPlane use.
export type TreePoint = { x: number; z: number; groundY: number };

const DEFAULTS = {
  templateCount: 12,
  heightMin: 6,
  heightMax: 16,
};

// Four silhouettes instead of a single conifer/deciduous coin-flip, weighted
// so the forest still reads as mostly conifer/round-deciduous at a glance
// with tall/thin and shrub outliers for variety.
type TreeArchetype = 'conifer' | 'deciduousRound' | 'deciduousTall' | 'shrub';
const ARCHETYPE_WEIGHTS: Array<{ type: TreeArchetype; weight: number }> = [
  { type: 'conifer', weight: 0.35 },
  { type: 'deciduousRound', weight: 0.35 },
  { type: 'deciduousTall', weight: 0.18 },
  { type: 'shrub', weight: 0.12 },
];

function pickArchetype(): TreeArchetype {
  const r = Math.random();
  let acc = 0;
  for (const { type, weight } of ARCHETYPE_WEIGHTS) {
    acc += weight;
    if (r <= acc) return type;
  }
  return 'conifer';
}

// scatter()'s own comment explains why tree size tracks horizontalScale and
// not verticalExaggeration directly — but left unclamped, ScaleTuningRow's
// sliders (hScale 1-15, vExag 1-20) can multiply through the per-instance
// jitter into toothpick-thin giants at one extreme or barely-visible specks
// at the other. Cap the multiplier, and let a damped fraction of vExag nudge
// it up: heavily exaggerated relief reads oddly next to real-proportioned
// trees, so letting them grow a little (not 1:1) keeps them looking anchored
// to the slope instead of like miniatures on a giant's terrain.
function clampedTreeScale(horizontalScale: number, verticalExaggeration: number, jitter: number): number {
  const reliefNudge = 1 + Math.min(Math.max(verticalExaggeration - 1, 0), 19) * 0.04;
  const raw = horizontalScale * reliefNudge * jitter;
  const min = horizontalScale * 0.6;
  const max = horizontalScale * 2.2 + 4;
  return Math.min(Math.max(raw, min), max);
}

// Same "bake a small template library once, scatter cheap GPU instances via
// thinInstanceAdd" technique as @dissonance/world's ForestGenerator (DTA's
// forest) — but decoupled from ExperienceProfile, with no bark/branch detail,
// since at the real-world (often km-scale) distances this viewer renders
// at, that detail is invisible anyway.
export class ThinInstanceTrees {
  private templates: Mesh[] = [];
  private readonly shadowGenerator: ShadowGenerator | undefined;

  constructor(scene: Scene, options: ThinInstanceTreesOptions = {}) {
    const templateCount = options.templateCount ?? DEFAULTS.templateCount;
    const heightMin = options.heightMin ?? DEFAULTS.heightMin;
    const heightMax = options.heightMax ?? DEFAULTS.heightMax;
    this.shadowGenerator = options.shadowGenerator;

    for (let i = 0; i < templateCount; i++) {
      this.templates.push(this.buildTemplate(scene, i, heightMin, heightMax));
    }
  }

  private buildTemplate(scene: Scene, id: number, heightMin: number, heightMax: number): Mesh {
    const archetype = pickArchetype();

    // Per-archetype height bands off the same base range, rather than one
    // range for everything — shrubs read wrong at 6-16m and tall/thin trees
    // want to lean past the top of the band to stand out.
    const heightRange = heightMax - heightMin;
    let height: number;
    if (archetype === 'shrub') {
      height = heightMin * 0.35 + Math.random() * (heightRange * 0.35);
    } else if (archetype === 'deciduousTall') {
      height = heightMin + heightRange * 0.6 + Math.random() * (heightRange * 0.7);
    } else {
      height = heightMin + Math.random() * heightRange;
    }

    const trunkRatio = archetype === 'shrub' ? 0.15 + Math.random() * 0.1
      : archetype === 'deciduousTall' ? 0.55 + Math.random() * 0.1
      : 0.4;
    const trunkHeight = height * trunkRatio;
    const canopyHeight = height - trunkHeight;
    const trunkRadius = (archetype === 'shrub' ? 0.08 : 0.15) + Math.random() * 0.1;

    const trunkMat = new PBRMaterial(`thinTreeTrunkMat_${id}`, scene);
    trunkMat.albedoColor = new Color3(0.08 + Math.random() * 0.03, 0.05, 0.02);
    trunkMat.metallic = 0;
    trunkMat.roughness = 0.95;

    const trunk = MeshBuilder.CreateCylinder(`thinTree_${id}_trunk`, {
      height: trunkHeight,
      diameterBottom: trunkRadius * 2,
      diameterTop: trunkRadius * 1.6,
      tessellation: 6,
    }, scene);
    trunk.position.y = trunkHeight / 2;
    trunk.material = trunkMat;

    const canopyMat = new PBRMaterial(`thinTreeCanopyMat_${id}`, scene);
    const green = 0.35 + Math.random() * 0.35;
    canopyMat.albedoColor = archetype === 'conifer'
      ? new Color3(0.05, green * 0.75, 0.10)
      : new Color3(0.10, green, 0.08);
    canopyMat.metallic = 0;
    canopyMat.roughness = 0.85;

    let canopy: Mesh;
    let canopyYFactor: number;
    switch (archetype) {
      case 'conifer':
        canopy = MeshBuilder.CreateCylinder(`thinTree_${id}_canopy`, {
          height: canopyHeight, diameterTop: 0, diameterBottom: canopyHeight * 0.55, tessellation: 7,
        }, scene);
        canopyYFactor = 0.5;
        break;
      case 'deciduousTall':
        // Narrower, elongated canopy (birch-like) instead of the round dome.
        canopy = MeshBuilder.CreateSphere(`thinTree_${id}_canopy`, {
          diameterX: canopyHeight * 0.5, diameterY: canopyHeight * 0.95, diameterZ: canopyHeight * 0.5, segments: 6,
        }, scene);
        canopyYFactor = 0.48;
        break;
      case 'shrub':
        // Short trunk, wide low canopy — no single dominant trunk silhouette.
        canopy = MeshBuilder.CreateSphere(`thinTree_${id}_canopy`, {
          diameterX: canopyHeight * 1.3, diameterY: canopyHeight * 0.8, diameterZ: canopyHeight * 1.3, segments: 6,
        }, scene);
        canopyYFactor = 0.4;
        break;
      case 'deciduousRound':
      default:
        canopy = MeshBuilder.CreateSphere(`thinTree_${id}_canopy`, {
          diameterX: canopyHeight * 0.85, diameterY: canopyHeight * 0.7, diameterZ: canopyHeight * 0.85, segments: 6,
        }, scene);
        canopyYFactor = 0.42;
        break;
    }
    canopy.position.y = trunkHeight + canopyHeight * canopyYFactor;
    canopy.material = canopyMat;

    const merged = Mesh.MergeMeshes([trunk, canopy], true, true, undefined, false, true);
    if (!merged) throw new Error(`tree template ${id} failed to merge`);
    merged.name = `thinTreeTemplate_${id}`;
    return merged;
  }

  // Converts real-world points to rendered space: ground position the same
  // way HeightmapTerrain/WaterPlane do (X/Z by horizontalScale, Y by
  // verticalExaggeration), but the tree's OWN size uses horizontalScale
  // uniformly on all three axes, deliberately *not* verticalExaggeration —
  // that setting exaggerates terrain relief, not the real proportions of
  // objects standing on it. A real ~10m tree stretched 10x taller than wide
  // renders as a needle-thin spike instead of a tree; keeping natural
  // proportions and only resizing with the world's overall scale (matching
  // how the OSM/GPX trail line meshes are treated) reads correctly.
  //
  // treeHScale/treeVScale are a separate, user-facing multiplier layered on
  // top of that clamped base size — X/Z get treeHScale, Y gets treeVScale —
  // so a forest can be made bigger/smaller or squatter/taller independently
  // of both the world's own hScale/vExag *and* each other, without disturbing
  // the clamping above (which stays anchored to the world scale alone).
  scatter(
    points: TreePoint[],
    horizontalScale: number,
    verticalExaggeration: number,
    treeHScale = 1,
    treeVScale = 1,
  ): void {
    const matricesByTemplate: Matrix[][] = this.templates.map(() => []);
    for (const p of points) {
      const ti = Math.floor(Math.random() * this.templates.length);
      const jitter = 0.8 + Math.random() * 0.5;
      const renderX = p.x * horizontalScale;
      const renderZ = p.z * horizontalScale;
      const renderY = p.groundY * verticalExaggeration;
      const baseScale = clampedTreeScale(horizontalScale, verticalExaggeration, jitter);
      const sx = baseScale * treeHScale;
      const sy = baseScale * treeVScale;
      matricesByTemplate[ti].push(Matrix.Compose(
        new Vector3(sx, sy, sx),
        Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
        new Vector3(renderX, renderY, renderZ),
      ));
    }
    this.templates.forEach((t, i) => {
      if (matricesByTemplate[i].length > 0) {
        t.thinInstanceAdd(matricesByTemplate[i], true);
        this.shadowGenerator?.addShadowCaster(t);
      }
    });
  }

  setVisible(visible: boolean): void {
    this.templates.forEach((t) => t.setEnabled(visible));
  }

  dispose(): void {
    this.templates.forEach((t) => t.dispose());
  }
}
