import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceProfile } from '../types';

export class ForestGenerator {
  private treeMeshes: Mesh[] = [];
  private groundMesh: Mesh | null = null;
  private towerMesh: Mesh | null = null;

  generate(
    scene: Scene,
    profile: ExperienceProfile,
    destinationPos: Vector3,
  ): void {
    this.buildGround(scene, profile);
    this.buildTrees(scene, profile);
    this.buildDestinationTower(scene, profile, destinationPos);
    this.buildRocks(scene, profile);
  }

  private buildGround(scene: Scene, profile: ExperienceProfile): void {
    const ground = MeshBuilder.CreateGround('ground', { width: 400, height: 400 }, scene);
    const mat = new StandardMaterial('groundMat', scene);

    if (profile.mode === 'radio') {
      mat.diffuseColor = new Color3(0.04, 0.04, 0.04);
      mat.ambientColor = new Color3(0.02, 0.02, 0.03);
    } else {
      mat.diffuseColor = new Color3(0.12, 0.16, 0.08);
      mat.ambientColor = new Color3(0.06, 0.09, 0.04);
    }

    mat.specularColor = Color3.Black();
    ground.material = mat;
    this.groundMesh = ground;
  }

  private buildTrees(scene: Scene, profile: ExperienceProfile): void {
    const trunkMat = new StandardMaterial('trunkMat', scene);
    const foliageMat = new StandardMaterial('foliageMat', scene);

    if (profile.mode === 'radio') {
      trunkMat.diffuseColor = new Color3(0.12, 0.12, 0.14);
      foliageMat.diffuseColor = new Color3(0.08, 0.10, 0.10);
    } else {
      trunkMat.diffuseColor = new Color3(0.25, 0.18, 0.10);
      foliageMat.diffuseColor = new Color3(0.08, 0.20, 0.06);
    }

    trunkMat.specularColor = Color3.Black();
    foliageMat.specularColor = Color3.Black();
    foliageMat.backFaceCulling = false;

    for (let i = 0; i < profile.treeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Avoid spawning directly on start (0,0,0) or destination
      const minRadius = 8;
      const radius = minRadius + Math.random() * 160;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const height = 5 + Math.random() * 8;
      const trunkRadius = 0.15 + Math.random() * 0.25;

      const trunk = MeshBuilder.CreateCylinder(
        `trunk_${i}`,
        { height, diameter: trunkRadius * 2, tessellation: profile.mode === 'ps1' ? 6 : 8 },
        scene,
      );
      trunk.position.set(x, height / 2, z);
      trunk.material = trunkMat;

      if (profile.mode === 'ps1') {
        // Cone canopy
        const canopy = MeshBuilder.CreateCylinder(
          `canopy_${i}`,
          { height: height * 0.7, diameterTop: 0, diameterBottom: 2 + Math.random() * 2, tessellation: 5 },
          scene,
        );
        canopy.position.set(x, height * 0.6 + height * 0.35, z);
        canopy.material = foliageMat;
        this.treeMeshes.push(canopy);
      } else {
        // Radio mode: simple sphere
        const canopy = MeshBuilder.CreateSphere(
          `canopy_${i}`,
          { diameter: 2.5 + Math.random() * 2, segments: 4 },
          scene,
        );
        canopy.position.set(x, height + 1.0, z);
        canopy.material = foliageMat;
        this.treeMeshes.push(canopy);
      }

      this.treeMeshes.push(trunk);
    }
  }

  private buildDestinationTower(
    scene: Scene,
    profile: ExperienceProfile,
    pos: Vector3,
  ): void {
    const mat = new StandardMaterial('towerMat', scene);
    if (profile.mode === 'radio') {
      mat.diffuseColor = new Color3(0.5, 0.5, 0.55);
      mat.emissiveColor = new Color3(0.05, 0.05, 0.08);
    } else {
      mat.diffuseColor = new Color3(0.55, 0.50, 0.40);
    }
    mat.specularColor = Color3.Black();

    // Tower base cylinder
    const base = MeshBuilder.CreateCylinder(
      'towerBase',
      { height: 20, diameter: 4, tessellation: profile.mode === 'ps1' ? 8 : 12 },
      scene,
    );
    base.position.set(pos.x, 10, pos.z);
    base.material = mat;

    // Top cap
    const cap = MeshBuilder.CreateCylinder(
      'towerCap',
      { height: 3, diameterTop: 1, diameterBottom: 5, tessellation: profile.mode === 'ps1' ? 8 : 12 },
      scene,
    );
    cap.position.set(pos.x, 21.5, pos.z);
    cap.material = mat;

    this.towerMesh = base;
  }

  private buildRocks(scene: Scene, profile: ExperienceProfile): void {
    const rockMat = new StandardMaterial('rockMat', scene);
    if (profile.mode === 'radio') {
      rockMat.diffuseColor = new Color3(0.10, 0.10, 0.12);
    } else {
      rockMat.diffuseColor = new Color3(0.30, 0.28, 0.25);
    }
    rockMat.specularColor = Color3.Black();

    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 120;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const size = 0.3 + Math.random() * 1.2;

      const rock = MeshBuilder.CreateBox(`rock_${i}`, { size }, scene);
      rock.position.set(x, size * 0.4, z);
      rock.rotation.set(
        Math.random() * 0.5,
        Math.random() * Math.PI * 2,
        Math.random() * 0.5,
      );
      rock.scaling.set(1 + Math.random() * 0.5, 0.6 + Math.random() * 0.4, 1 + Math.random() * 0.5);
      rock.material = rockMat;
    }
  }

  dispose(): void {
    this.treeMeshes.forEach((m) => m.dispose());
    this.treeMeshes = [];
    this.groundMesh?.dispose();
    this.towerMesh?.dispose();
  }
}
