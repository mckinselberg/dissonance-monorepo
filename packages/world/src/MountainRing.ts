import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceProfile } from '@dissonance/shared-types';

const CLUSTER_COUNT = 13;
const RING_RADIUS = 210;

export class MountainRing {
  private meshes: Mesh[] = [];

  constructor(scene: Scene, profile: ExperienceProfile) {
    const bodyMat = new StandardMaterial('mountainMat', scene);
    bodyMat.disableLighting = true;

    const snowMat = new StandardMaterial('snowMat', scene);
    snowMat.disableLighting = true;

    if (profile.mode === 'ps1') {
      bodyMat.emissiveColor = new Color3(0.07, 0.10, 0.20);
      snowMat.emissiveColor  = new Color3(0.72, 0.76, 0.80);
    } else {
      bodyMat.emissiveColor = new Color3(0.03, 0.02, 0.05);
      snowMat.emissiveColor  = new Color3(0.14, 0.14, 0.18);
    }

    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const baseAngle = (c / CLUSTER_COUNT) * Math.PI * 2;
      const peakCount = 2 + Math.floor(Math.random() * 4);

      for (let p = 0; p < peakCount; p++) {
        const angle = baseAngle + (Math.random() - 0.5) * 0.7;
        const dist  = RING_RADIUS + (Math.random() - 0.5) * 40;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;

        const height    = 48 + Math.random() * 82;
        const baseDiam  = height * (0.75 + Math.random() * 0.65);
        const tess      = profile.mode === 'ps1' ? 4 : 6;

        const coneBaseY = height / 2 - 10;

        const cone = MeshBuilder.CreateCylinder(`mtn_${c}_${p}`, {
          height,
          diameterTop:    0,
          diameterBottom: baseDiam,
          tessellation:   tess,
        }, scene);
        cone.position.set(x, coneBaseY, z);
        cone.material = bodyMat;
        cone.applyFog = false;
        if (profile.mode === 'ps1') cone.convertToFlatShadedMesh();
        this.meshes.push(cone);

        if (height > 88) {
          const capH    = height * 0.20;
          const capDiam = baseDiam * 0.22;
          const capY    = coneBaseY + height / 2 - capH / 2;

          const cap = MeshBuilder.CreateCylinder(`snow_${c}_${p}`, {
            height:         capH,
            diameterTop:    0,
            diameterBottom: capDiam,
            tessellation:   tess,
          }, scene);
          cap.position.set(x, capY, z);
          cap.material = snowMat;
          cap.applyFog = false;
          if (profile.mode === 'ps1') cap.convertToFlatShadedMesh();
          this.meshes.push(cap);
        }
      }
    }
  }

  dispose(): void {
    this.meshes.forEach(m => m.dispose());
    this.meshes = [];
  }
}
