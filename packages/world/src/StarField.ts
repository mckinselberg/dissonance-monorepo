import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Matrix, Quaternion, Vector3 } from '@babylonjs/core';

export type StarFieldOptions = {
  count?: number;
  // Camera-relative distance (Mesh.infiniteDistance, same technique as
  // Sun's disc) — fixed regardless of world scale, same reasoning as Sun.
  radius?: number;
  size?: number;
};

const DEFAULTS = { count: 800, radius: 3000, size: 4 };

// A camera-relative dome of tiny emissive quads (Mesh.infiniteDistance, same
// technique as Sun's disc) standing in for a starfield — fixed apparent
// size/position in the sky no matter where the player roams. Visibility is
// a single mesh-level property (not per-star alpha), so fading stars in/out
// over the day/night cycle is one assignment regardless of star count.
export class StarField {
  private readonly stars: Mesh;

  constructor(scene: Scene, options: StarFieldOptions = {}) {
    const count = options.count ?? DEFAULTS.count;
    const radius = options.radius ?? DEFAULTS.radius;
    const size = options.size ?? DEFAULTS.size;

    const mat = new StandardMaterial('starFieldMat', scene);
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.disableDepthWrite = true;

    this.stars = MeshBuilder.CreatePlane('starTemplate', { size }, scene);
    this.stars.material = mat;
    this.stars.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.stars.infiniteDistance = true;
    this.stars.applyFog = false;
    this.stars.visibility = 0;

    const matrices: Matrix[] = [];
    for (let i = 0; i < count; i++) {
      // Random point on the upper hemisphere only — stars below the
      // horizon would just be hidden by terrain/sky color anyway.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5; // 0 = zenith, PI/2 = horizon
      const x = Math.sin(phi) * Math.cos(theta) * radius;
      const y = Math.cos(phi) * radius;
      const z = Math.sin(phi) * Math.sin(theta) * radius;
      const scale = 0.5 + Math.random() * 1.0;
      matrices.push(Matrix.Compose(new Vector3(scale, scale, scale), Quaternion.Identity(), new Vector3(x, y, z)));
    }
    if (matrices.length > 0) this.stars.thinInstanceAdd(matrices, true);
  }

  // 0 (fully hidden, daytime) .. 1 (fully visible, night).
  setNightFactor(factor: number): void {
    this.stars.visibility = Math.max(0, Math.min(1, factor));
  }

  dispose(): void {
    this.stars.dispose();
  }
}
