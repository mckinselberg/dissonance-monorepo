import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
} from '@babylonjs/core';
import type { PursuerState, ExperienceMode } from '@dissonance/shared-types';

const LOOK_ANGLE_RAD = 0.6;

export class WatcherEffect {
  private scene: Scene;
  private mode: ExperienceMode;
  private cooldown = 4.0;
  private activePairs: Mesh[][] = [];
  private enabled = true;

  constructor(scene: Scene, mode: ExperienceMode) {
    this.scene = scene;
    this.mode = mode;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.cooldown = 0.5;
  }

  forceSpawn(
    pursuerPos: { x: number; z: number },
    playerPos:  { x: number; z: number },
    state: PursuerState = 'close',
    groundY = 0,
  ): void {
    this.spawnEyes(pursuerPos, playerPos, state, groundY);
  }

  update(
    dt: number,
    playerPos: Vector3,
    playerYaw: number,
    pursuerPos: { x: number; z: number },
    pursuerState: PursuerState,
    pursuerGroundY: number,
    onAdrenalineSpike: () => void,
  ): void {
    if (!this.enabled) return;
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    if (pursuerState === 'far' || pursuerState === 'caught') return;

    const dpx = pursuerPos.x - playerPos.x;
    const dpz = pursuerPos.z - playerPos.z;
    const angleToPursuer = Math.atan2(dpx, dpz);
    let rel = angleToPursuer - playerYaw;
    while (rel >  Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;

    if (Math.abs(rel) > LOOK_ANGLE_RAD) return;

    this.spawnEyes(pursuerPos, { x: playerPos.x, z: playerPos.z }, pursuerState, pursuerGroundY);
    onAdrenalineSpike();

    this.cooldown = pursuerState === 'close'
      ? 4  + Math.random() * 5
      : 9  + Math.random() * 10;
  }

  private spawnEyes(
    pursuerPos: { x: number; z: number },
    playerPos:  { x: number; z: number },
    state: PursuerState,
    groundY: number,
  ): void {
    const fdx = playerPos.x - pursuerPos.x;
    const fdz = playerPos.z - pursuerPos.z;
    const fLen = Math.sqrt(fdx * fdx + fdz * fdz) || 1;
    const fx = fdx / fLen, fz = fdz / fLen;
    const rx = -fz, rz = fx;

    const PUSH    = 0.30;
    const halfSep = 0.13;
    const eyeY    = groundY + 1.45 + Math.random() * 0.12;

    const coreColor = this.mode === 'ps1'
      ? new Color3(1.0, 0.72 + Math.random() * 0.14, 0.04)
      : new Color3(0.55, 0.90, 1.0);
    const haloColor = new Color3(
      coreColor.r * 0.45,
      coreColor.g * 0.45,
      coreColor.b * 0.45,
    );

    const meshes: Mesh[] = [];

    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const jitter = (Math.random() - 0.5) * 0.06;
      const xPos = pursuerPos.x + fx * PUSH + rx * (halfSep * side + jitter);
      const zPos = pursuerPos.z + fz * PUSH + rz * (halfSep * side + jitter);

      const core = MeshBuilder.CreateSphere(
        `eye_c_${Date.now()}_${i}`,
        { diameter: 0.26, segments: 4 },
        this.scene,
      );
      const coreMat = new StandardMaterial(`eyeMatC_${Date.now()}_${i}`, this.scene);
      coreMat.emissiveColor = coreColor;
      coreMat.disableLighting = true;
      core.material = coreMat;
      core.position.set(xPos, eyeY, zPos);

      const halo = MeshBuilder.CreateSphere(
        `eye_h_${Date.now()}_${i}`,
        { diameter: 0.60, segments: 4 },
        this.scene,
      );
      const haloMat = new StandardMaterial(`eyeMatH_${Date.now()}_${i}`, this.scene);
      haloMat.emissiveColor = haloColor;
      haloMat.disableLighting = true;
      haloMat.alpha = 0.72;
      haloMat.backFaceCulling = false;
      halo.material = haloMat;
      halo.position.copyFrom(core.position);

      const fog = MeshBuilder.CreateSphere(
        `eye_f_${Date.now()}_${i}`,
        { diameter: 1.30, segments: 3 },
        this.scene,
      );
      const fogMat = new StandardMaterial(`eyeMatF_${Date.now()}_${i}`, this.scene);
      fogMat.emissiveColor = new Color3(
        coreColor.r * 0.18,
        coreColor.g * 0.18,
        coreColor.b * 0.18,
      );
      fogMat.disableLighting = true;
      fogMat.alpha = 0.22;
      fogMat.backFaceCulling = false;
      fog.material = fogMat;
      fog.position.copyFrom(core.position);

      meshes.push(core, halo, fog);
    }

    this.activePairs.push(meshes);

    const showMs = state === 'close'
      ? 300 + Math.random() * 300
      : 450 + Math.random() * 500;

    const dart = Math.random() < 0.55;

    setTimeout(() => {
      if (!this.activePairs.includes(meshes)) return;

      if (dart) {
        meshes.forEach(m => m.scaling.set(1.6, 1.6, 1.6));
        setTimeout(() => {
          const dx = (Math.random() - 0.5) * 5.0;
          const dz = (Math.random() - 0.5) * 5.0;
          meshes.forEach(m => {
            m.position.x += dx;
            m.position.z += dz;
            m.scaling.set(1, 1, 1);
          });
          setTimeout(() => this.disposePair(meshes), 90);
        }, 45);
      } else {
        this.disposePair(meshes);
      }
    }, showMs);
  }

  private disposePair(pair: Mesh[]): void {
    pair.forEach(m => m.dispose());
    const idx = this.activePairs.indexOf(pair);
    if (idx >= 0) this.activePairs.splice(idx, 1);
  }

  dispose(): void {
    this.activePairs.forEach(pair => pair.forEach(m => m.dispose()));
    this.activePairs = [];
  }
}
