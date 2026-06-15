import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceProfile } from '../types';
import type { Terrain } from './Terrain';

// ── Dead-end trail (the misleading one) ─────────────────────────────────────
const TRAIL_DIR = new Vector3(-0.65, 0, -0.76).normalize();
const TRAIL_LENGTH = 90;
const TRAIL_WIDTH = 7;
const TRAIL_START = new Vector3(6, 0, 4);

// ── Hiking trail (the real path toward the destination) ──────────────────────
const HIKING_TRAIL_WIDTH = 3.8;
const HIKING_WAYPOINTS: [number, number][] = [
  [8, 6],   [22, 17],  [40, 30],  [54, 48],
  [72, 56], [92, 70],  [114, 86], [134, 100],
  [152, 114],[168, 126],[180, 135],
];

export interface Collider { x: number; z: number; radius: number; }

export class ForestGenerator {
  private treeMeshes: Mesh[] = [];
  private towerMesh: Mesh | null = null;
  private terrain!: Terrain;
  private _colliders: Collider[] = [];

  getColliders(): Collider[] { return this._colliders; }

  generate(
    scene: Scene,
    profile: ExperienceProfile,
    destinationPos: Vector3,
    terrain: Terrain,
  ): void {
    this.terrain = terrain;
    this._colliders = [];
    this.buildTrees(scene, profile, destinationPos);
    this.buildDestinationTower(scene, profile, destinationPos);
    this.buildRocks(scene, profile);
    this.buildUnderbrush(scene, profile);
    this.buildDeadEndTrail(scene, profile);
    this.buildGrass(scene, profile);
    this.buildForestFloor(scene, profile);
    this.buildHikingTrail(scene, profile);
  }

  // ── Corridor checks ──────────────────────────────────────────────────────

  private inTrailCorridor(x: number, z: number): boolean {
    const dx = x - TRAIL_START.x;
    const dz = z - TRAIL_START.z;
    const along = dx * TRAIL_DIR.x + dz * TRAIL_DIR.z;
    if (along < 0 || along > TRAIL_LENGTH) return false;
    const perpX = dx - along * TRAIL_DIR.x;
    const perpZ = dz - along * TRAIL_DIR.z;
    return Math.sqrt(perpX * perpX + perpZ * perpZ) < TRAIL_WIDTH;
  }

  private inHikingTrailCorridor(x: number, z: number): boolean {
    const w = HIKING_TRAIL_WIDTH;
    for (let i = 0; i < HIKING_WAYPOINTS.length - 1; i++) {
      const [ax, az] = HIKING_WAYPOINTS[i];
      const [bx, bz] = HIKING_WAYPOINTS[i + 1];
      const ddx = bx - ax, ddz = bz - az;
      const len2 = ddx * ddx + ddz * ddz;
      const t = Math.max(0, Math.min(1, ((x - ax) * ddx + (z - az) * ddz) / len2));
      const px = ax + t * ddx - x;
      const pz = az + t * ddz - z;
      if (px * px + pz * pz < w * w) return true;
    }
    return false;
  }

  private inEitherCorridor(x: number, z: number): boolean {
    return this.inTrailCorridor(x, z) || this.inHikingTrailCorridor(x, z);
  }

  // ── Tree archetypes ──────────────────────────────────────────────────────

  private buildSingleTree(
    scene: Scene,
    profile: ExperienceProfile,
    x: number, z: number,
    groundY: number,
    trunkMats: StandardMaterial[],
    foliageMats: StandardMaterial[],
    id: number,
  ): number {
    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const ps1 = profile.mode === 'ps1';
    const r = Math.random();

    // ── Stump ─────────────────────────────────────────────── 5%
    if (r < 0.05) {
      const h = 0.7 + Math.random() * 1.1;
      const rad = 0.24 + Math.random() * 0.28;
      const m = MeshBuilder.CreateCylinder(`trunk_${id}`, {
        height: h, diameter: rad * 2, diameterTop: rad * 1.6,
        tessellation: ps1 ? 6 : 8,
      }, scene);
      m.position.set(x, groundY + h / 2, z);
      m.material = pick(trunkMats);
      if (ps1) m.convertToFlatShadedMesh();
      this.treeMeshes.push(m);
      return rad;
    }

    // ── Dead / bare — leaning ────────────────────────────── 10%
    if (r < 0.15) {
      const h = 4.5 + Math.random() * 7;
      const rad = 0.07 + Math.random() * 0.12;
      const lean = (Math.random() - 0.5) * 0.32;
      const m = MeshBuilder.CreateCylinder(`trunk_${id}`, {
        height: h, diameter: rad * 2, diameterTop: rad * 0.25,
        tessellation: ps1 ? 5 : 7,
      }, scene);
      m.position.set(x, groundY + h / 2, z);
      m.rotation.z = lean;
      m.material = pick(trunkMats);
      if (ps1) m.convertToFlatShadedMesh();
      this.treeMeshes.push(m);
      return rad;
    }

    // ── Tall narrow pine ─────────────────────────────────── 15%
    if (r < 0.30) {
      const h = 14 + Math.random() * 10;
      const rad = 0.07 + Math.random() * 0.10;
      const trunk = MeshBuilder.CreateCylinder(`trunk_${id}`, {
        height: h, diameter: rad * 2, diameterTop: rad * 0.5,
        tessellation: ps1 ? 6 : 8,
      }, scene);
      trunk.position.set(x, groundY + h / 2, z);
      trunk.material = pick(trunkMats);
      if (ps1) trunk.convertToFlatShadedMesh();

      const coneH = h * 0.90;
      const cone = MeshBuilder.CreateCylinder(`canopy_${id}`, {
        height: coneH, diameterTop: 0,
        diameterBottom: 0.9 + Math.random() * 0.8,
        tessellation: ps1 ? 5 : 7,
      }, scene);
      // canopy center: 1/3 up trunk, extends above top
      cone.position.set(x, groundY + h * 0.33 + coneH / 2, z);
      cone.material = pick(foliageMats);
      if (ps1) cone.convertToFlatShadedMesh();
      this.treeMeshes.push(trunk, cone);
      return rad;
    }

    // ── Broad deciduous — wide layered canopy ─────────────── 20%
    if (r < 0.50) {
      const h = 5 + Math.random() * 6;
      const rad = 0.18 + Math.random() * 0.30;
      const trunk = MeshBuilder.CreateCylinder(`trunk_${id}`, {
        height: h, diameter: rad * 2, tessellation: ps1 ? 6 : 8,
      }, scene);
      trunk.position.set(x, groundY + h / 2, z);
      trunk.material = pick(trunkMats);
      if (ps1) trunk.convertToFlatShadedMesh();

      const cW = 3.0 + Math.random() * 2.8;
      const fm = pick(foliageMats);

      if (ps1) {
        // two stacked flat cones = layered deciduous silhouette
        const lowerH = h * 0.42;
        const lower = MeshBuilder.CreateCylinder(`canopy_${id}_lo`, {
          height: lowerH, diameterTop: 0, diameterBottom: cW,
          tessellation: 5,
        }, scene);
        lower.position.set(x, groundY + h * 0.62, z);
        lower.material = fm;
        lower.convertToFlatShadedMesh();

        const upperH = h * 0.30;
        const upper = MeshBuilder.CreateCylinder(`canopy_${id}_hi`, {
          height: upperH, diameterTop: 0, diameterBottom: cW * 0.55,
          tessellation: 5,
        }, scene);
        upper.position.set(x, groundY + h * 0.62 + lowerH * 0.72, z);
        upper.material = fm;
        upper.convertToFlatShadedMesh();
        this.treeMeshes.push(lower, upper);
      } else {
        const canopy = MeshBuilder.CreateSphere(`canopy_${id}`, {
          diameter: cW, segments: 4,
        }, scene);
        canopy.position.set(x, groundY + h + cW * 0.28, z);
        canopy.material = fm;
        this.treeMeshes.push(canopy);
      }
      this.treeMeshes.push(trunk);
      return rad;
    }

    // ── Multi-trunk birch cluster ─────────────────────────── 8%
    if (r < 0.58) {
      const count = 2 + (Math.random() < 0.4 ? 1 : 0);
      const baseRad = 0.06 + Math.random() * 0.08;
      const fm = pick(foliageMats);
      for (let ti = 0; ti < count; ti++) {
        const offX = (Math.random() - 0.5) * 0.7;
        const offZ = (Math.random() - 0.5) * 0.7;
        const h = 6 + Math.random() * 6;
        const lean = (Math.random() - 0.5) * 0.18;
        const trunk = MeshBuilder.CreateCylinder(`trunk_${id}_${ti}`, {
          height: h, diameter: baseRad * 2, tessellation: ps1 ? 5 : 7,
        }, scene);
        trunk.position.set(x + offX, groundY + h / 2, z + offZ);
        trunk.rotation.z = lean;
        trunk.material = pick(trunkMats);
        if (ps1) trunk.convertToFlatShadedMesh();

        if (ps1) {
          const canopy = MeshBuilder.CreateCylinder(`canopy_${id}_${ti}`, {
            height: h * 0.55, diameterTop: 0,
            diameterBottom: 1.4 + Math.random() * 1.2,
            tessellation: 5,
          }, scene);
          canopy.position.set(x + offX, groundY + h * 0.90, z + offZ);
          canopy.material = fm;
          canopy.convertToFlatShadedMesh();
          this.treeMeshes.push(canopy);
        } else {
          const canopy = MeshBuilder.CreateSphere(`canopy_${id}_${ti}`, {
            diameter: 2.0 + Math.random() * 1.2, segments: 4,
          }, scene);
          canopy.position.set(x + offX, groundY + h + 0.6, z + offZ);
          canopy.material = fm;
          this.treeMeshes.push(canopy);
        }
        this.treeMeshes.push(trunk);
      }
      return baseRad + 0.35; // rough bounding radius for cluster
    }

    // ── Standard conifer (default) ────────────────────────── 42%
    const h = 5 + Math.random() * 8;
    const rad = 0.14 + Math.random() * 0.22;
    const trunk = MeshBuilder.CreateCylinder(`trunk_${id}`, {
      height: h, diameter: rad * 2, tessellation: ps1 ? 6 : 8,
    }, scene);
    trunk.position.set(x, groundY + h / 2, z);
    trunk.material = pick(trunkMats);
    if (ps1) trunk.convertToFlatShadedMesh();

    if (ps1) {
      const canopy = MeshBuilder.CreateCylinder(`canopy_${id}`, {
        height: h * 0.70, diameterTop: 0,
        diameterBottom: 2.0 + Math.random() * 2.0,
        tessellation: 5,
      }, scene);
      canopy.position.set(x, groundY + h * 0.95, z);
      canopy.material = pick(foliageMats);
      canopy.convertToFlatShadedMesh();
      this.treeMeshes.push(canopy);
    } else {
      const canopy = MeshBuilder.CreateSphere(`canopy_${id}`, {
        diameter: 2.5 + Math.random() * 2.0, segments: 4,
      }, scene);
      canopy.position.set(x, groundY + h + 1.0, z);
      canopy.material = pick(foliageMats);
      this.treeMeshes.push(canopy);
    }
    this.treeMeshes.push(trunk);
    return rad;
  }

  // ── Tree placement ───────────────────────────────────────────────────────

  private buildTrees(scene: Scene, profile: ExperienceProfile, destinationPos: Vector3): void {
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
      for (const [r, g, b] of [
        [0.30, 0.19, 0.09], [0.20, 0.13, 0.06],
        [0.36, 0.24, 0.14], [0.15, 0.10, 0.05],
      ]) {
        const m = new StandardMaterial(`trunkMat_${trunkMats.length}`, scene);
        m.diffuseColor = new Color3(r, g, b);
        m.specularColor = Color3.Black();
        trunkMats.push(m);
      }
      for (const [r, g, b] of [
        [0.07, 0.32, 0.05], [0.18, 0.35, 0.04],
        [0.04, 0.22, 0.14], [0.09, 0.24, 0.07],
        [0.28, 0.24, 0.04],
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
    const maxAttempts = profile.treeCount * 8;

    while (placed < profile.treeCount && attempts < maxAttempts) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 160;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      if (this.inEitherCorridor(x, z)) continue;
      const tdx = x - destinationPos.x, tdz = z - destinationPos.z;
      if (tdx * tdx + tdz * tdz < 36) continue;

      const groundY = this.terrain.getHeightAt(x, z);
      const rad = this.buildSingleTree(scene, profile, x, z, groundY, trunkMats, foliageMats, placed);
      this._colliders.push({ x, z, radius: rad });
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
        const groundY = this.terrain.getHeightAt(x, z);
        const height = 6 + Math.random() * 7;

        const trunk = MeshBuilder.CreateCylinder(
          `trailTrunk_${i}_${side}`,
          { height, diameter: 0.5, tessellation: profile.mode === 'ps1' ? 6 : 8 },
          scene,
        );
        trunk.position.set(x, groundY + height / 2, z);
        trunk.material = trunkMat;
        this._colliders.push({ x, z, radius: 0.26 });

        let canopy: Mesh;
        if (profile.mode === 'ps1') {
          canopy = MeshBuilder.CreateCylinder(
            `trailCanopy_${i}_${side}`,
            { height: height * 0.6, diameterTop: 0, diameterBottom: 3 + Math.random(), tessellation: 5 },
            scene,
          );
          canopy.position.set(x, groundY + height * 0.75, z);
        } else {
          canopy = MeshBuilder.CreateSphere(
            `trailCanopy_${i}_${side}`,
            { diameter: 3 + Math.random() * 1.5, segments: 4 },
            scene,
          );
          canopy.position.set(x, groundY + height + 1.2, z);
        }
        canopy.material = foliageMat;
        this.treeMeshes.push(trunk, canopy);
      }
    }
  }

  // ── Underbrush ───────────────────────────────────────────────────────────

  private buildUnderbrush(scene: Scene, profile: ExperienceProfile): void {
    const mat = new StandardMaterial('underbrushMat', scene);
    if (profile.mode === 'radio') {
      mat.diffuseColor = new Color3(0.05, 0.06, 0.06);
    } else {
      mat.diffuseColor = new Color3(0.06, 0.14, 0.05);
    }
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;

    const count = profile.mode === 'ps1' ? 220 : 160;
    let placed = 0, attempts = 0;

    while (placed < count && attempts < count * 5) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 160;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (this.inEitherCorridor(x, z)) continue;

      const groundY = this.terrain.getHeightAt(x, z);
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
      shrub.position.set(x, groundY + h * 0.5, z);
      shrub.rotation.y = Math.random() * Math.PI * 2;
      shrub.material = mat;
      this.treeMeshes.push(shrub);
      placed++;
    }
  }

  // ── Dead-end trail ───────────────────────────────────────────────────────

  private buildDeadEndTrail(scene: Scene, profile: ExperienceProfile): void {
    const rockMat = new StandardMaterial('deadEndRockMat', scene);
    if (profile.mode === 'radio') {
      rockMat.diffuseColor = new Color3(0.14, 0.12, 0.14);
    } else {
      rockMat.diffuseColor = new Color3(0.32, 0.28, 0.22);
    }
    rockMat.specularColor = Color3.Black();

    const endX = TRAIL_START.x + TRAIL_DIR.x * TRAIL_LENGTH;
    const endZ = TRAIL_START.z + TRAIL_DIR.z * TRAIL_LENGTH;

    const boulderOffsets: [number, number][] = [
      [0, 0], [3, 1.5], [-3, 1], [1.5, -2.5], [-2, 2.5],
      [4.5, -1], [-4, -2], [0.5, 3.5], [-1.5, -3.5],
    ];
    for (let i = 0; i < boulderOffsets.length; i++) {
      const [ox, oz] = boulderOffsets[i];
      const bx = endX + ox, bz = endZ + oz;
      const groundY = this.terrain.getHeightAt(bx, bz);
      const size = 1.2 + Math.random() * 1.6;
      const boulder = MeshBuilder.CreateBox(`deadEndBoulder_${i}`, { size }, scene);
      boulder.position.set(bx, groundY + size * 0.45, bz);
      boulder.rotation.set(
        Math.random() * 0.6, Math.random() * Math.PI * 2, Math.random() * 0.5,
      );
      boulder.scaling.set(
        0.8 + Math.random() * 0.6, 0.5 + Math.random() * 0.5, 0.9 + Math.random() * 0.5,
      );
      boulder.material = rockMat;
    }

    const deadTrunkMat = new StandardMaterial('deadTrunkMat', scene);
    deadTrunkMat.diffuseColor = profile.mode === 'radio'
      ? new Color3(0.08, 0.08, 0.09)
      : new Color3(0.18, 0.14, 0.10);
    deadTrunkMat.specularColor = Color3.Black();

    for (let i = 0; i < 5; i++) {
      const ox = (Math.random() - 0.5) * 12;
      const oz = (Math.random() - 0.5) * 6;
      const tx = endX + ox, tz = endZ + oz;
      const groundY = this.terrain.getHeightAt(tx, tz);
      const h = 4 + Math.random() * 5;
      const lean = (Math.random() - 0.5) * 0.4;
      const dead = MeshBuilder.CreateCylinder(
        `deadTree_${i}`,
        { height: h, diameter: 0.35, tessellation: 5 },
        scene,
      );
      dead.position.set(tx, groundY + h / 2, tz);
      dead.rotation.set(lean, Math.random() * Math.PI * 2, lean * 0.5);
      dead.material = deadTrunkMat;
      this.treeMeshes.push(dead);
    }
  }

  // ── Destination tower ────────────────────────────────────────────────────

  private buildDestinationTower(scene: Scene, profile: ExperienceProfile, pos: Vector3): void {
    const groundY = this.terrain.getHeightAt(pos.x, pos.z);
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
    base.position.set(pos.x, groundY + 10, pos.z);
    base.material = mat;

    const cap = MeshBuilder.CreateCylinder(
      'towerCap',
      { height: 3, diameterTop: 1, diameterBottom: 5, tessellation: profile.mode === 'ps1' ? 8 : 12 },
      scene,
    );
    cap.position.set(pos.x, groundY + 21.5, pos.z);
    cap.material = mat;
    this.towerMesh = base;
  }

  // ── Rocks ────────────────────────────────────────────────────────────────

  private buildRocks(scene: Scene, profile: ExperienceProfile): void {
    const rockColors = profile.mode === 'radio'
      ? [new Color3(0.10, 0.10, 0.12)]
      : [
          new Color3(0.32, 0.28, 0.22), new Color3(0.22, 0.24, 0.20),
          new Color3(0.38, 0.30, 0.20), new Color3(0.18, 0.16, 0.22),
        ];

    const rockMats = rockColors.map((c, i) => {
      const m = new StandardMaterial(`rockMat_${i}`, scene);
      m.diffuseColor = c; m.specularColor = Color3.Black();
      return m;
    });

    const count = profile.mode === 'ps1' ? 80 : 55;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 130;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (this.inEitherCorridor(x, z)) continue;

      const groundY = this.terrain.getHeightAt(x, z);
      const size = 0.3 + Math.random() * 1.4;
      const rock = MeshBuilder.CreateBox(`rock_${i}`, { size }, scene);
      rock.position.set(x, groundY + size * 0.4, z);
      this._colliders.push({ x, z, radius: size * 0.55 });
      rock.rotation.set(
        Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5,
      );
      rock.scaling.set(
        1 + Math.random() * 0.5, 0.6 + Math.random() * 0.4, 1 + Math.random() * 0.5,
      );
      rock.material = rockMats[Math.floor(Math.random() * rockMats.length)];
      if (profile.mode === 'ps1') rock.convertToFlatShadedMesh();
    }
  }

  // ── Grass ────────────────────────────────────────────────────────────────

  private buildGrass(scene: Scene, profile: ExperienceProfile): void {
    const grassPalette = profile.mode === 'ps1'
      ? [
          [0.18, 0.44, 0.09], [0.11, 0.32, 0.06],
          [0.06, 0.22, 0.04], [0.22, 0.38, 0.06],
        ]
      : [
          [0.04, 0.07, 0.03], [0.03, 0.05, 0.02],
        ];

    const bases: Mesh[] = [];
    for (const [r, g, b] of grassPalette) {
      const mat = new StandardMaterial(`grassMat_${bases.length}`, scene);
      mat.diffuseColor = new Color3(r, g, b);
      mat.specularColor = Color3.Black();

      const base = MeshBuilder.CreateCylinder(
        `grassBase_${bases.length}`,
        { height: 0.42, diameterTop: 0, diameterBottom: 0.16, tessellation: 3 },
        scene,
      );
      base.material = mat;
      base.isVisible = false;
      if (profile.mode === 'ps1') base.convertToFlatShadedMesh();
      bases.push(base);
      this.treeMeshes.push(base);
    }

    const perBase = profile.mode === 'ps1' ? 1100 : 640;
    for (let bi = 0; bi < bases.length; bi++) {
      let placed = 0, attempts = 0;
      while (placed < perBase && attempts < perBase * 4) {
        attempts++;
        const angle = Math.random() * Math.PI * 2;
        const radius = 4 + Math.random() * 158;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        if (this.inEitherCorridor(x, z)) continue;

        const groundY = this.terrain.getHeightAt(x, z);
        const h = 0.28 + Math.random() * 0.32;
        const inst = bases[bi].createInstance(`grass_${bi}_${placed}`);
        inst.position.set(x, groundY + h / 2, z);
        inst.rotation.y = Math.random() * Math.PI * 2;
        inst.rotation.x = (Math.random() - 0.5) * 0.22;
        inst.rotation.z = (Math.random() - 0.5) * 0.22;
        inst.scaling.set(1, h / 0.42, 1);
        placed++;
      }
    }
  }

  // ── Forest floor ─────────────────────────────────────────────────────────

  private buildForestFloor(scene: Scene, profile: ExperienceProfile): void {
    // Leaf litter
    const leafColors = profile.mode === 'ps1'
      ? [
          [0.44, 0.22, 0.07], [0.32, 0.14, 0.05],
          [0.50, 0.34, 0.06], [0.24, 0.18, 0.08],
        ]
      : [
          [0.07, 0.06, 0.05], [0.05, 0.04, 0.03],
        ];

    const leafBases: Mesh[] = [];
    for (const [r, g, b] of leafColors) {
      const mat = new StandardMaterial(`leafMat_${leafBases.length}`, scene);
      mat.diffuseColor = new Color3(r, g, b);
      mat.specularColor = Color3.Black();
      mat.backFaceCulling = false;
      const base = MeshBuilder.CreateCylinder(
        `leafBase_${leafBases.length}`,
        { height: 0.025, diameter: 0.28, tessellation: 5 },
        scene,
      );
      base.material = mat;
      base.isVisible = false;
      leafBases.push(base);
      this.treeMeshes.push(base);
    }

    const leavesPerColor = profile.mode === 'ps1' ? 150 : 60;
    for (let bi = 0; bi < leafBases.length; bi++) {
      for (let i = 0; i < leavesPerColor; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 158;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const groundY = this.terrain.getHeightAt(x, z);
        const scale = 0.6 + Math.random() * 1.6;
        const leaf = leafBases[bi].createInstance(`leaf_${bi}_${i}`);
        leaf.position.set(x, groundY + 0.013, z);
        leaf.rotation.y = Math.random() * Math.PI * 2;
        leaf.scaling.setAll(scale);
      }
    }

    // Moss patches
    const mossMat = new StandardMaterial('mossMat', scene);
    mossMat.diffuseColor = profile.mode === 'ps1'
      ? new Color3(0.06, 0.22, 0.06)
      : new Color3(0.03, 0.06, 0.03);
    mossMat.specularColor = Color3.Black();

    const mossBase = MeshBuilder.CreateCylinder(
      'mossBase',
      { height: 0.04, diameter: 1.2, tessellation: 7 },
      scene,
    );
    mossBase.material = mossMat;
    mossBase.isVisible = false;
    this.treeMeshes.push(mossBase);

    const mossCount = profile.mode === 'ps1' ? 90 : 55;
    for (let i = 0; i < mossCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 6 + Math.random() * 140;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const groundY = this.terrain.getHeightAt(x, z);
      const scale = 0.5 + Math.random() * 1.8;
      const moss = mossBase.createInstance(`moss_${i}`);
      moss.position.set(x, groundY + 0.02, z);
      moss.rotation.y = Math.random() * Math.PI * 2;
      moss.scaling.setAll(scale);
    }

    // Fallen logs
    const logMat = new StandardMaterial('logMat', scene);
    logMat.diffuseColor = profile.mode === 'ps1'
      ? new Color3(0.20, 0.13, 0.07)
      : new Color3(0.06, 0.05, 0.04);
    logMat.specularColor = Color3.Black();

    const logCount = profile.mode === 'ps1' ? 42 : 28;
    for (let i = 0; i < logCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 145;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (this.inEitherCorridor(x, z)) continue;

      const groundY = this.terrain.getHeightAt(x, z);
      const logLen = 3 + Math.random() * 5;
      const logRad = 0.14 + Math.random() * 0.18;
      const yaw = Math.random() * Math.PI * 2;

      const log = MeshBuilder.CreateCylinder(
        `fallenLog_${i}`,
        { height: logLen, diameter: logRad * 2, tessellation: profile.mode === 'ps1' ? 6 : 8 },
        scene,
      );
      log.rotation.set(0, yaw, Math.PI / 2);
      log.position.set(x, groundY + logRad, z);
      log.material = logMat;
      if (profile.mode === 'ps1') log.convertToFlatShadedMesh();
      this.treeMeshes.push(log);
    }
  }

  // ── Hiking trail ─────────────────────────────────────────────────────────

  private buildHikingTrail(scene: Scene, profile: ExperienceProfile): void {
    const ps1 = profile.mode === 'ps1';

    // Dirt path material
    const dirtMat = new StandardMaterial('hikingDirtMat', scene);
    dirtMat.diffuseColor = ps1
      ? new Color3(0.30, 0.19, 0.10)
      : new Color3(0.07, 0.06, 0.04);
    dirtMat.specularColor = Color3.Black();

    // Trail blaze material (rectangular markers on posts)
    const blazeMat = new StandardMaterial('trailBlazeMat', scene);
    blazeMat.diffuseColor = ps1
      ? new Color3(0.85, 0.42, 0.05)   // orange hiking blaze
      : new Color3(0.22, 0.22, 0.26);
    if (ps1) blazeMat.emissiveColor = new Color3(0.18, 0.08, 0.00);
    blazeMat.specularColor = Color3.Black();

    // Post material
    const postMat = new StandardMaterial('trailPostMat', scene);
    postMat.diffuseColor = ps1
      ? new Color3(0.24, 0.16, 0.08)
      : new Color3(0.08, 0.07, 0.06);
    postMat.specularColor = Color3.Black();

    const pts = HIKING_WAYPOINTS;

    // Dirt strips between each consecutive waypoint pair
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const ddx = bx - ax, ddz = bz - az;
      const len = Math.sqrt(ddx * ddx + ddz * ddz);
      const groundY = this.terrain.getHeightAt(mx, mz);

      const strip = MeshBuilder.CreateBox(`trailStrip_${i}`, {
        width: HIKING_TRAIL_WIDTH * 2,
        height: 0.06,
        depth: len + 1.8,
      }, scene);
      strip.position.set(mx, groundY + 0.03, mz);
      strip.rotation.y = Math.atan2(ddx, ddz);
      strip.material = dirtMat;
      this.treeMeshes.push(strip);

      // Junction patch at each waypoint (covers the corner join)
      if (i === 0 || i === pts.length - 2) {
        const jx = i === 0 ? ax : bx;
        const jz = i === 0 ? az : bz;
        const jGroundY = this.terrain.getHeightAt(jx, jz);
        const patch = MeshBuilder.CreateCylinder(`trailPatch_${i}`, {
          height: 0.06, diameter: HIKING_TRAIL_WIDTH * 2.2, tessellation: 8,
        }, scene);
        patch.position.set(jx, jGroundY + 0.03, jz);
        patch.material = dirtMat;
        this.treeMeshes.push(patch);
      }
    }

    // Trail marker posts — every 2 waypoints
    for (let i = 0; i < pts.length; i += 2) {
      const [wx, wz] = pts[i];
      const wGroundY = this.terrain.getHeightAt(wx, wz);

      // Direction to next waypoint for offset
      const ni = Math.min(i + 1, pts.length - 1);
      const [nx, nz] = pts[ni];
      const pdx = nz - wz, pdz = -(nx - wx); // perpendicular left
      const pLen = Math.sqrt(pdx * pdx + pdz * pdz) || 1;
      const sideX = wx + (pdx / pLen) * (HIKING_TRAIL_WIDTH + 0.6);
      const sideZ = wz + (pdz / pLen) * (HIKING_TRAIL_WIDTH + 0.6);

      const postH = 1.5;
      const post = MeshBuilder.CreateCylinder(`trailPost_${i}`, {
        height: postH, diameter: 0.08, tessellation: 5,
      }, scene);
      post.position.set(sideX, wGroundY + postH / 2, sideZ);
      post.material = postMat;
      if (ps1) post.convertToFlatShadedMesh();
      this.treeMeshes.push(post);

      // Blaze plate
      const blaze = MeshBuilder.CreateBox(`trailBlaze_${i}`, {
        width: 0.26, height: 0.38, depth: 0.05,
      }, scene);
      blaze.position.set(sideX, wGroundY + postH + 0.22, sideZ);
      blaze.material = blazeMat;
      this.treeMeshes.push(blaze);
    }

    // Edge stones along the trail at irregular intervals
    const stoneMat = new StandardMaterial('trailStoneMat', scene);
    stoneMat.diffuseColor = ps1
      ? new Color3(0.36, 0.30, 0.22)
      : new Color3(0.10, 0.09, 0.10);
    stoneMat.specularColor = Color3.Black();

    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const ddx = bx - ax, ddz = bz - az;
      const len = Math.sqrt(ddx * ddx + ddz * ddz);
      // Perpendicular
      const px = -ddz / len, pz = ddx / len;
      const stoneSteps = Math.ceil(len / 4);

      for (let s = 0; s < stoneSteps; s++) {
        const t = (s + 0.5) / stoneSteps;
        const cx = ax + t * ddx, cz = az + t * ddz;

        for (const side of [-1, 1]) {
          if (Math.random() < 0.55) continue; // sparse
          const sx = cx + px * (HIKING_TRAIL_WIDTH + 0.2 + Math.random() * 0.5) * side;
          const sz = cz + pz * (HIKING_TRAIL_WIDTH + 0.2 + Math.random() * 0.5) * side;
          const sGroundY = this.terrain.getHeightAt(sx, sz);
          const sSize = 0.15 + Math.random() * 0.30;
          const stone = MeshBuilder.CreateBox(`trailStone_${i}_${s}_${side}`, {
            size: sSize,
          }, scene);
          stone.position.set(sx, sGroundY + sSize * 0.3, sz);
          stone.rotation.set(
            Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4,
          );
          stone.scaling.set(1.2 + Math.random() * 0.5, 0.5 + Math.random() * 0.35, 1 + Math.random() * 0.4);
          stone.material = stoneMat;
          if (ps1) stone.convertToFlatShadedMesh();
          this.treeMeshes.push(stone);
        }
      }
    }
  }

  dispose(): void {
    this.treeMeshes.forEach(m => m.dispose());
    this.treeMeshes = [];
    this.towerMesh?.dispose();
  }
}
