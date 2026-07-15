import { Scene, MeshBuilder, PBRMaterial, Color3, Mesh, Matrix, Quaternion, Vector3 } from '@babylonjs/core';

export type ThinInstanceTreesOptions = {
  templateCount?: number;
  // Real (unscaled) tree height range, in meters.
  heightMin?: number;
  heightMax?: number;
};

// A real-world (x, z) position plus its real (unscaled) ground elevation —
// e.g. straight out of HeightmapSampler.sampleHeight, same convention
// HeightmapTerrain/WaterPlane use.
export type TreePoint = { x: number; z: number; groundY: number };

const DEFAULTS = {
  templateCount: 6,
  heightMin: 6,
  heightMax: 16,
};

// Same "bake a small template library once, scatter cheap GPU instances via
// thinInstanceAdd" technique as @dissonance/world's ForestGenerator (DTA's
// forest) — but decoupled from ExperienceProfile and simplified down to two
// silhouettes (conifer cone, deciduous dome) with no bark/branch detail,
// since at the real-world (often km-scale) distances this viewer renders
// at, that detail is invisible anyway.
export class ThinInstanceTrees {
  private templates: Mesh[] = [];

  constructor(scene: Scene, options: ThinInstanceTreesOptions = {}) {
    const templateCount = options.templateCount ?? DEFAULTS.templateCount;
    const heightMin = options.heightMin ?? DEFAULTS.heightMin;
    const heightMax = options.heightMax ?? DEFAULTS.heightMax;

    for (let i = 0; i < templateCount; i++) {
      this.templates.push(this.buildTemplate(scene, i, heightMin, heightMax));
    }
  }

  private buildTemplate(scene: Scene, id: number, heightMin: number, heightMax: number): Mesh {
    const height = heightMin + Math.random() * (heightMax - heightMin);
    const trunkHeight = height * 0.4;
    const canopyHeight = height - trunkHeight;
    const trunkRadius = 0.15 + Math.random() * 0.1;
    const isConifer = Math.random() < 0.5;

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
    canopyMat.albedoColor = isConifer
      ? new Color3(0.05, green * 0.75, 0.10)
      : new Color3(0.10, green, 0.08);
    canopyMat.metallic = 0;
    canopyMat.roughness = 0.85;

    const canopy = isConifer
      ? MeshBuilder.CreateCylinder(`thinTree_${id}_canopy`, {
        height: canopyHeight, diameterTop: 0, diameterBottom: canopyHeight * 0.55, tessellation: 7,
      }, scene)
      : MeshBuilder.CreateSphere(`thinTree_${id}_canopy`, {
        diameterX: canopyHeight * 0.85, diameterY: canopyHeight * 0.7, diameterZ: canopyHeight * 0.85, segments: 6,
      }, scene);
    canopy.position.y = trunkHeight + canopyHeight * (isConifer ? 0.5 : 0.42);
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
  scatter(points: TreePoint[], horizontalScale: number, verticalExaggeration: number): void {
    const matricesByTemplate: Matrix[][] = this.templates.map(() => []);
    for (const p of points) {
      const ti = Math.floor(Math.random() * this.templates.length);
      const jitter = 0.8 + Math.random() * 0.5;
      const renderX = p.x * horizontalScale;
      const renderZ = p.z * horizontalScale;
      const renderY = p.groundY * verticalExaggeration;
      const scale = horizontalScale * jitter;
      matricesByTemplate[ti].push(Matrix.Compose(
        new Vector3(scale, scale, scale),
        Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
        new Vector3(renderX, renderY, renderZ),
      ));
    }
    this.templates.forEach((t, i) => {
      if (matricesByTemplate[i].length > 0) t.thinInstanceAdd(matricesByTemplate[i], true);
    });
  }

  setVisible(visible: boolean): void {
    this.templates.forEach((t) => t.setEnabled(visible));
  }

  dispose(): void {
    this.templates.forEach((t) => t.dispose());
  }
}
