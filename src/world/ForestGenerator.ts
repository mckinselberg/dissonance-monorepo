import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceProfile } from '../types';

// The dead-end trail runs northwest — opposite to the destination (northeast).
// It is a visible corridor of cleared trees that lures the player away before
// the bell teaches them to turn around and listen.
const TRAIL_DIR = new Vector3(-0.65, 0, -0.76).normalize(); // northwest
const TRAIL_LENGTH = 90;
const TRAIL_WIDTH = 7;
const TRAIL_START = new Vector3(6, 0, 4);  // just ahead of player start

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
    this.buildTrees(scene, profile, destinationPos);
    this.buildDestinationTower(scene, profile, destinationPos);
    this.buildRocks(scene, profile);
    this.buildUnderbrush(scene, profile);
    this.buildDeadEndTrail(scene, profile);
  }

  // Returns true if a point lies within the dead-end trail corridor
  private inTrailCorridor(x: number, z: number): boolean {
    const dx = x - TRAIL_START.x;
    const dz = z - TRAIL_START.z;
    const along = dx * TRAIL_DIR.x + dz * TRAIL_DIR.z;
    if (along < 0 || along > TRAIL_LENGTH) return false;
    const perpX = dx - along * TRAIL_DIR.x;
    const perpZ = dz - along * TRAIL_DIR.z;
    const perp = Math.sqrt(perpX * perpX + perpZ * perpZ);
    return perp < TRAIL_WIDTH;
  }

  private buildGround(scene: Scene, profile: ExperienceProfile): void {
    const ground = MeshBuilder.CreateGround('ground', { width: 400, height: 400 }, scene);
    const mat = new StandardMaterial('groundMat', scene);

    if (profile.mode === 'radio') {
      mat.diffuseColor = new Color3(0.04, 0.04, 0.04);
      mat.ambientColor = new Color3(0.02, 0.02, 0.03);
    } else {
      mat.diffuseColor = new Color3(0.14, 0.22, 0.07);  // richer earthy green
      mat.ambientColor = new Color3(0.10, 0.16, 0.05);
    }

    mat.specularColor = Color3.Black();
    ground.material = mat;
    this.groundMesh = ground;
  }

  private buildTrees(scene: Scene, profile: ExperienceProfile, destinationPos: Vector3): void {
    // PS1: multiple materials for color variety + flat shading on every mesh.
    // RADIO: single dark material throughout.
    const trunkMats: StandardMaterial[] = [];
    const foliageMats: StandardMaterial[] = [];

    if (profile.mode === 'radio') {
      const t = new StandardMaterial('trunkMat', scene);
      t.diffuseColor = new Color3(0.12, 0.12, 0.14);
      t.specularColor = Color3.Black();
      trunkMats.push(t);

      const f = new StandardMaterial('foliageMat', scene);
      f.diffuseColor = new Color3(0.08, 0.10, 0.10);
      f.specularColor = Color3.Black();
      f.backFaceCulling = false;
      foliageMats.push(f);
    } else {
      // PS1 trunk palette — warm browns, some darker, some lighter
      for (const [r, g, b] of [
        [0.30, 0.19, 0.09],
        [0.20, 0.13, 0.06],
        [0.36, 0.24, 0.14],
        [0.15, 0.10, 0.05],
      ]) {
        const m = new StandardMaterial(`trunkMat_${trunkMats.length}`, scene);
        m.diffuseColor = new Color3(r, g, b);
        m.specularColor = Color3.Black();
        trunkMats.push(m);
      }

      // PS1 foliage palette — several greens, one autumn outlier
      for (const [r, g, b] of [
        [0.07, 0.32, 0.05],   // bright forest green
        [0.18, 0.35, 0.04],   // yellow-green
        [0.04, 0.22, 0.14],   // blue-green
        [0.09, 0.24, 0.07],   // muted mid-green
        [0.28, 0.24, 0.04],   // autumn yellow (rare variety)
      ]) {
        const m = new StandardMaterial(`foliageMat_${foliageMats.length}`, scene);
        m.diffuseColor = new Color3(r, g, b);
        m.specularColor = Color3.Black();
        m.backFaceCulling = false;
        foliageMats.push(m);
      }
    }

    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    let placed = 0;
    let attempts = 0;
    const maxAttempts = profile.treeCount * 6;

    while (placed < profile.treeCount && attempts < maxAttempts) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 160;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      if (this.inTrailCorridor(x, z)) continue;
      const tdx = x - destinationPos.x;
      const tdz = z - destinationPos.z;
      if (tdx * tdx + tdz * tdz < 36) continue;

      const height = 5 + Math.random() * 8;
      const trunkRadius = 0.15 + Math.random() * 0.25;

      const trunk = MeshBuilder.CreateCylinder(
        `trunk_${placed}`,
        { height, diameter: trunkRadius * 2, tessellation: profile.mode === 'ps1' ? 6 : 8 },
        scene,
      );
      trunk.position.set(x, height / 2, z);
      trunk.material = pick(trunkMats);

      if (profile.mode === 'ps1') {
        trunk.convertToFlatShadedMesh();

        const canopy = MeshBuilder.CreateCylinder(
          `canopy_${placed}`,
          { height: height * 0.7, diameterTop: 0, diameterBottom: 2 + Math.random() * 2, tessellation: 5 },
          scene,
        );
        canopy.position.set(x, height * 0.6 + height * 0.35, z);
        canopy.material = pick(foliageMats);
        canopy.convertToFlatShadedMesh();
        this.treeMeshes.push(canopy);
      } else {
        const canopy = MeshBuilder.CreateSphere(
          `canopy_${placed}`,
          { diameter: 2.5 + Math.random() * 2, segments: 4 },
          scene,
        );
        canopy.position.set(x, height + 1.0, z);
        canopy.material = pick(foliageMats);
        this.treeMeshes.push(canopy);
      }

      this.treeMeshes.push(trunk);
      placed++;
    }

    this.buildTrailWalls(scene, pick(trunkMats), pick(foliageMats), profile);
  }

  private buildTrailWalls(
    scene: Scene,
    trunkMat: StandardMaterial,
    foliageMat: StandardMaterial,
    profile: ExperienceProfile,
  ): void {
    const wallTreeCount = 28;
    const perp = new Vector3(-TRAIL_DIR.z, 0, TRAIL_DIR.x);

    for (let i = 0; i < wallTreeCount; i++) {
      const t = (i / wallTreeCount) * TRAIL_LENGTH;
      const cx = TRAIL_START.x + TRAIL_DIR.x * t;
      const cz = TRAIL_START.z + TRAIL_DIR.z * t;

      for (const side of [-1, 1]) {
        const jitter = (Math.random() - 0.5) * 2.5;
        const x = cx + perp.x * (TRAIL_WIDTH + 1.5 + jitter);
        const z = cz + perp.z * (TRAIL_WIDTH + 1.5 + jitter);
        const height = 6 + Math.random() * 7;

        const trunk = MeshBuilder.CreateCylinder(
          `trailTrunk_${i}_${side}`,
          { height, diameter: 0.5, tessellation: profile.mode === 'ps1' ? 6 : 8 },
          scene,
        );
        trunk.position.set(x, height / 2, z);
        trunk.material = trunkMat;

        let canopy: Mesh;
        if (profile.mode === 'ps1') {
          canopy = MeshBuilder.CreateCylinder(
            `trailCanopy_${i}_${side}`,
            { height: height * 0.6, diameterTop: 0, diameterBottom: 3 + Math.random(), tessellation: 5 },
            scene,
          );
          canopy.position.set(x, height * 0.75, z);
        } else {
          canopy = MeshBuilder.CreateSphere(
            `trailCanopy_${i}_${side}`,
            { diameter: 3 + Math.random() * 1.5, segments: 4 },
            scene,
          );
          canopy.position.set(x, height + 1.2, z);
        }
        canopy.material = foliageMat;

        this.treeMeshes.push(trunk, canopy);
      }
    }
  }

  private buildUnderbrush(scene: Scene, profile: ExperienceProfile): void {
    const mat = new StandardMaterial('underbrushMat', scene);
    if (profile.mode === 'radio') {
      mat.diffuseColor = new Color3(0.05, 0.06, 0.06);
    } else {
      mat.diffuseColor = new Color3(0.06, 0.14, 0.05);
    }
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;

    const count = profile.mode === 'ps1' ? 180 : 140;
    let placed = 0;
    let attempts = 0;

    while (placed < count && attempts < count * 5) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 160;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (this.inTrailCorridor(x, z)) continue;

      const w = 0.6 + Math.random() * 1.1;
      const h = 0.25 + Math.random() * 0.45;

      let shrub: Mesh;
      if (profile.mode === 'ps1') {
        shrub = MeshBuilder.CreateCylinder(
          `shrub_${placed}`,
          { height: h, diameterTop: 0, diameterBottom: w * 2, tessellation: 4 },
          scene,
        );
      } else {
        shrub = MeshBuilder.CreateSphere(
          `shrub_${placed}`,
          { diameter: w, segments: 3 },
          scene,
        );
      }
      shrub.position.set(x, h * 0.5, z);
      shrub.rotation.y = Math.random() * Math.PI * 2;
      shrub.material = mat;
      this.treeMeshes.push(shrub);
      placed++;
    }
  }

  private buildDeadEndTrail(scene: Scene, profile: ExperienceProfile): void {
    const rockMat = new StandardMaterial('deadEndRockMat', scene);
    if (profile.mode === 'radio') {
      rockMat.diffuseColor = new Color3(0.14, 0.12, 0.14);
    } else {
      rockMat.diffuseColor = new Color3(0.32, 0.28, 0.22);
    }
    rockMat.specularColor = Color3.Black();

    // Dead end position: trail tip
    const endX = TRAIL_START.x + TRAIL_DIR.x * TRAIL_LENGTH;
    const endZ = TRAIL_START.z + TRAIL_DIR.z * TRAIL_LENGTH;

    // A cluster of large boulders blocking the path — unmistakably a wall
    const boulderPositions = [
      [0, 0], [3, 1.5], [-3, 1], [1.5, -2.5], [-2, 2.5],
      [4.5, -1], [-4, -2], [0.5, 3.5], [-1.5, -3.5],
    ];

    for (let i = 0; i < boulderPositions.length; i++) {
      const [ox, oz] = boulderPositions[i];
      const size = 1.2 + Math.random() * 1.6;
      const boulder = MeshBuilder.CreateBox(`deadEndBoulder_${i}`, { size }, scene);
      boulder.position.set(endX + ox, size * 0.45, endZ + oz);
      boulder.rotation.set(
        Math.random() * 0.6,
        Math.random() * Math.PI * 2,
        Math.random() * 0.5,
      );
      boulder.scaling.set(
        0.8 + Math.random() * 0.6,
        0.5 + Math.random() * 0.5,
        0.9 + Math.random() * 0.5,
      );
      boulder.material = rockMat;
    }

    // A few dead trees directly at the end to reinforce "wrong way"
    const deadTrunkMat = new StandardMaterial('deadTrunkMat', scene);
    deadTrunkMat.diffuseColor = profile.mode === 'radio'
      ? new Color3(0.08, 0.08, 0.09)
      : new Color3(0.18, 0.14, 0.10);
    deadTrunkMat.specularColor = Color3.Black();

    for (let i = 0; i < 5; i++) {
      const ox = (Math.random() - 0.5) * 12;
      const oz = (Math.random() - 0.5) * 6;
      const h = 4 + Math.random() * 5;
      const lean = (Math.random() - 0.5) * 0.4;
      const dead = MeshBuilder.CreateCylinder(
        `deadTree_${i}`,
        { height: h, diameter: 0.35, tessellation: 5 },
        scene,
      );
      dead.position.set(endX + ox, h / 2, endZ + oz);
      dead.rotation.set(lean, Math.random() * Math.PI * 2, lean * 0.5);
      dead.material = deadTrunkMat;
      this.treeMeshes.push(dead);
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

    const base = MeshBuilder.CreateCylinder(
      'towerBase',
      { height: 20, diameter: 4, tessellation: profile.mode === 'ps1' ? 8 : 12 },
      scene,
    );
    base.position.set(pos.x, 10, pos.z);
    base.material = mat;

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
    // PS1: a few rock color variants for visual variety
    const rockColors = profile.mode === 'radio'
      ? [new Color3(0.10, 0.10, 0.12)]
      : [
          new Color3(0.32, 0.28, 0.22),  // warm grey
          new Color3(0.22, 0.24, 0.20),  // cool grey-green
          new Color3(0.38, 0.30, 0.20),  // sandstone
          new Color3(0.18, 0.16, 0.22),  // dark slate
        ];

    const rockMats = rockColors.map((c, i) => {
      const m = new StandardMaterial(`rockMat_${i}`, scene);
      m.diffuseColor = c;
      m.specularColor = Color3.Black();
      return m;
    });

    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 120;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (this.inTrailCorridor(x, z)) continue;

      const size = 0.3 + Math.random() * 1.2;
      const rock = MeshBuilder.CreateBox(`rock_${i}`, { size }, scene);
      rock.position.set(x, size * 0.4, z);
      rock.rotation.set(
        Math.random() * 0.5,
        Math.random() * Math.PI * 2,
        Math.random() * 0.5,
      );
      rock.scaling.set(1 + Math.random() * 0.5, 0.6 + Math.random() * 0.4, 1 + Math.random() * 0.5);
      rock.material = rockMats[Math.floor(Math.random() * rockMats.length)];
      if (profile.mode === 'ps1') rock.convertToFlatShadedMesh();
    }
  }

  dispose(): void {
    this.treeMeshes.forEach((m) => m.dispose());
    this.treeMeshes = [];
    this.groundMesh?.dispose();
    this.towerMesh?.dispose();
  }
}
