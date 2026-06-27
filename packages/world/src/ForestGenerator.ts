import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  ShadowGenerator,
  Color3,
  Vector3,
  Quaternion,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceProfile } from '@dissonance/shared-types';
import type { Terrain } from './Terrain';
import { displaceToBlob } from './noise';

// Canopy shape strategy, switchable at dev-time (see DevHUD):
// 'noise'   — one big irregular blob per tree, organic but unique geometry per tree.
// 'cluster' — several small instanced spheres jittered into a clump, cheap at high tree counts.
export type FoliageTechnique = 'noise' | 'cluster';

const TRAIL_DIR = new Vector3(-0.65, 0, -0.76).normalize();
const TRAIL_LENGTH = 90;
const TRAIL_WIDTH = 7;
const TRAIL_START = new Vector3(6, 0, 4);

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
  private foliageTechnique: FoliageTechnique = 'cluster';
  private shadowGenerator: ShadowGenerator | undefined;

  getColliders(): Collider[] { return this._colliders; }

  generate(
    scene: Scene,
    profile: ExperienceProfile,
    destinationPos: Vector3,
    terrain: Terrain,
    foliageTechnique: FoliageTechnique = 'cluster',
    shadowGenerator?: ShadowGenerator,
  ): void {
    this.terrain = terrain;
    this._colliders = [];
    this.foliageTechnique = foliageTechnique;
    this.shadowGenerator = shadowGenerator;
    this.buildTrees(scene, profile, destinationPos);
    this.buildDestinationTower(scene, profile, destinationPos);
    this.buildRocks(scene, profile);
    this.buildRockOutcrops(scene, profile);
    this.buildUnderbrush(scene, profile);
    this.buildDeadEndTrail(scene, profile);
    this.buildGrass(scene, profile);
    this.buildLowGroundcover(scene, profile);
    this.buildForestFloor(scene, profile);
    this.buildHikingTrail(scene, profile);
  }

  // Registers shadow casters for substantial geometry only (trunks,
  // standalone canopy blobs, rocks) — grass/leaf-litter/moss, branch stubs,
  // and the 'cluster' canopy technique's many small instances are
  // deliberately skipped, since registering that many individual shadow
  // casters measurably hurt frame rate for a visual contribution nobody
  // would notice (branches are thin enough their shadows barely register).
  private addCasters(meshes: Mesh[]): void {
    if (!this.shadowGenerator) return;
    for (const m of meshes) this.shadowGenerator.addShadowCaster(m);
  }

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

  // Builds a trunk as a few stacked segments, each tilted a bit further
  // than the last — a single straight cylinder always looks the same
  // (a pole), while a small cumulative kink per segment reads as an
  // organically crooked trunk. Returns the meshes plus where the trunk
  // actually ends up (since it no longer ends straight above x/z), so
  // branches/canopy can attach to the real top instead of an assumed one.
  private buildCrookedTrunk(
    scene: Scene,
    x: number, z: number, groundY: number,
    totalHeight: number,
    baseRad: number, topRad: number,
    mat: PBRMaterial,
    ps1: boolean,
    id: string,
    segments: number,
  ): { meshes: Mesh[]; topPos: Vector3 } {
    const meshes: Mesh[] = [];
    let pos = new Vector3(x, groundY, z);
    let dir = new Vector3(0, 1, 0);
    const segH = totalHeight / segments;

    for (let s = 0; s < segments; s++) {
      dir = new Vector3(
        dir.x + (Math.random() - 0.5) * 0.22,
        dir.y,
        dir.z + (Math.random() - 0.5) * 0.22,
      ).normalize();

      const segBaseRad = baseRad + (topRad - baseRad) * (s / segments);
      const segTopRad  = baseRad + (topRad - baseRad) * ((s + 1) / segments);

      const seg = MeshBuilder.CreateCylinder(`${id}_trunk_${s}`, {
        height: segH,
        diameterBottom: segBaseRad * 2,
        diameterTop: segTopRad * 2,
        tessellation: ps1 ? 6 : 8,
      }, scene);
      seg.position.copyFrom(pos.add(dir.scale(segH / 2)));
      seg.rotationQuaternion = Quaternion.FromUnitVectorsToRef(
        Vector3.Up(), dir, new Quaternion(),
      );
      seg.material = mat;
      if (ps1) seg.convertToFlatShadedMesh();
      meshes.push(seg);

      pos = pos.add(dir.scale(segH));
    }
    return { meshes, topPos: pos };
  }

  // A handful of short angled sticks poking out near the top of a trunk,
  // below the canopy. Without these every tree reads as a bare pole with a
  // leaf-ball stuck on top — branches are what make the silhouette between
  // trunk and crown look like a tree instead of a lollipop.
  private addBranchStubs(
    scene: Scene,
    x: number, z: number, topY: number,
    trunkMat: PBRMaterial,
    ps1: boolean,
    id: string,
    count: number,
    reach: number,
  ): Mesh[] {
    const stubs: Mesh[] = [];
    for (let i = 0; i < count; i++) {
      const len = reach * (0.6 + Math.random() * 0.7);
      const yaw = Math.random() * Math.PI * 2;
      const pitch = 0.25 + Math.random() * 0.55;
      const dir = new Vector3(
        Math.cos(pitch) * Math.cos(yaw),
        Math.sin(pitch),
        Math.cos(pitch) * Math.sin(yaw),
      ).normalize();

      const branch = MeshBuilder.CreateCylinder(`${id}_branch_${i}`, {
        height: len,
        diameter: 0.05 + Math.random() * 0.06,
        diameterTop: 0.015,
        tessellation: ps1 ? 4 : 6,
      }, scene);
      const origin = new Vector3(x, topY - i * len * 0.12, z);
      branch.position.copyFrom(origin.add(dir.scale(len / 2)));
      branch.rotationQuaternion = Quaternion.FromUnitVectorsToRef(
        Vector3.Up(), dir, new Quaternion(),
      );
      branch.material = trunkMat;
      if (ps1) branch.convertToFlatShadedMesh();
      stubs.push(branch);
    }
    return stubs;
  }

  // Builds a broadleaf-style canopy at (x, baseY, z) using whichever
  // foliageTechnique is active. 'noise' produces one unique lumpy blob;
  // 'cluster' scatters instances of a shared template mesh into a clump.
  // clumpTemplate must come from the same material the caller wants — pass
  // undefined to fall back to the noise blob regardless of technique.
  private buildCanopy(
    scene: Scene,
    x: number, z: number, baseY: number,
    width: number, height: number,
    mat: PBRMaterial,
    ps1: boolean,
    id: string,
    clumpTemplate?: Mesh,
  ): Mesh[] {
    if (this.foliageTechnique === 'cluster' && clumpTemplate) {
      const clumpCount = 10 + Math.floor(Math.random() * 6);
      for (let i = 0; i < clumpCount; i++) {
        const inst = clumpTemplate.createInstance(`${id}_clump_${i}`);
        const ox = (Math.random() - 0.5) * width * 0.55;
        const oz = (Math.random() - 0.5) * width * 0.55;
        const oy = (Math.random() * 0.7 - 0.15) * height;
        inst.position.set(x + ox, baseY + oy, z + oz);
        const s = (0.95 + Math.random() * 0.75) * (width / 3.2);
        // Independently-scaled axes break up the "row of bubbles" look a
        // uniform sphere instance gives — each clump piece reads as an
        // irregular leaf mass instead of a perfect ball.
        inst.scaling.set(
          s * (0.75 + Math.random() * 0.6),
          s * (0.45 + Math.random() * 0.35),
          s * (0.75 + Math.random() * 0.6),
        );
        inst.rotation.set(
          Math.random() * Math.PI, Math.random() * Math.PI * 2, Math.random() * Math.PI,
        );
      }
      return [];
    }

    const blob = MeshBuilder.CreateSphere(`canopy_${id}`, {
      diameter: 1, segments: ps1 ? 5 : 9,
    }, scene);
    displaceToBlob(blob, 0.6, 2.4, Math.floor(Math.random() * 1000));
    blob.scaling.set(width, height, width);
    blob.position.set(x, baseY, z);
    blob.material = mat;
    if (ps1) blob.convertToFlatShadedMesh();
    return [blob];
  }

  private buildSingleTree(
    scene: Scene,
    profile: ExperienceProfile,
    x: number, z: number,
    groundY: number,
    trunkMats: PBRMaterial[],
    foliageMats: PBRMaterial[],
    id: number,
    clumpTemplates: Mesh[],
  ): number {
    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const pickIndexed = <T>(arr: T[]): [T, number] => {
      const i = Math.floor(Math.random() * arr.length);
      return [arr[i], i];
    };
    const ps1 = profile.mode === 'ps1';
    const r = Math.random();

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
      this.addCasters([m]);
      return rad;
    }

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
      this.addCasters([m]);
      return rad;
    }

    if (r < 0.30) {
      const h = 14 + Math.random() * 10;
      const rad = 0.07 + Math.random() * 0.10;
      const trunkMat = pick(trunkMats);
      const { meshes: trunkMeshes, topPos } = this.buildCrookedTrunk(
        scene, x, z, groundY, h, rad, rad * 0.5, trunkMat, ps1, `${id}`, 3,
      );

      const branches = this.addBranchStubs(
        scene, topPos.x, topPos.z, topPos.y, trunkMat, ps1, `${id}`, 4 + Math.floor(Math.random() * 4), 1.9,
      );

      const cW = 3.4 + Math.random() * 2.6;
      const [fm, fmIndex] = pickIndexed(foliageMats);
      const skipCanopy = Math.random() < 0.1;
      const canopyMeshes = skipCanopy ? [] : this.buildCanopy(
        scene, topPos.x, topPos.z, topPos.y - cW * 0.18, cW, cW * 0.6, fm, ps1,
        `${id}`, clumpTemplates[fmIndex],
      );
      this.treeMeshes.push(...trunkMeshes, ...branches, ...canopyMeshes);
      this.addCasters(trunkMeshes);
      this.addCasters(canopyMeshes);
      return rad;
    }

    if (r < 0.50) {
      const h = 5 + Math.random() * 6;
      const rad = 0.18 + Math.random() * 0.30;
      const trunkMat = pick(trunkMats);
      const { meshes: trunkMeshes, topPos } = this.buildCrookedTrunk(
        scene, x, z, groundY, h, rad, rad * 0.85, trunkMat, ps1, `${id}`, 2,
      );

      const branches = this.addBranchStubs(
        scene, topPos.x, topPos.z, topPos.y, trunkMat, ps1, `${id}`, 4 + Math.floor(Math.random() * 4), 1.6,
      );

      const cW = 3.6 + Math.random() * 3.0;
      const [fm, fmIndex] = pickIndexed(foliageMats);
      const skipCanopy = Math.random() < 0.1;

      const canopyMeshes = skipCanopy ? [] : this.buildCanopy(
        scene, topPos.x, topPos.z, topPos.y - cW * 0.15, cW, cW * 0.6, fm, ps1,
        `${id}`, clumpTemplates[fmIndex],
      );
      this.treeMeshes.push(...canopyMeshes, ...branches, ...trunkMeshes);
      this.addCasters(trunkMeshes);
      this.addCasters(canopyMeshes);
      return rad;
    }

    if (r < 0.58) {
      const count = 2 + (Math.random() < 0.4 ? 1 : 0);
      const baseRad = 0.06 + Math.random() * 0.08;
      const [fm, fmIndex] = pickIndexed(foliageMats);
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

        const cW = 2.2 + Math.random() * 1.4;
        const canopyMeshes = this.buildCanopy(
          scene, x + offX, z + offZ, groundY + h * 0.88, cW, cW * 0.6, fm, ps1,
          `${id}_${ti}`, clumpTemplates[fmIndex],
        );
        this.treeMeshes.push(...canopyMeshes, trunk);
        this.addCasters([trunk]);
        this.addCasters(canopyMeshes);
      }
      return baseRad + 0.35;
    }

    const h = 5 + Math.random() * 8;
    const rad = 0.14 + Math.random() * 0.22;
    const trunkMat = pick(trunkMats);
    const { meshes: trunkMeshes, topPos } = this.buildCrookedTrunk(
      scene, x, z, groundY, h, rad, rad * 0.8, trunkMat, ps1, `${id}`, 2,
    );

    const branches = this.addBranchStubs(
      scene, topPos.x, topPos.z, topPos.y, trunkMat, ps1, `${id}`, 3 + Math.floor(Math.random() * 4), 1.5,
    );

    const cW = 3.0 + Math.random() * 2.2;
    const [fm, fmIndex] = pickIndexed(foliageMats);
    const skipCanopy = Math.random() < 0.1;
    const canopyMeshes = skipCanopy ? [] : this.buildCanopy(
      scene, topPos.x, topPos.z, topPos.y - cW * 0.15, cW, cW * 0.6, fm, ps1,
      `${id}`, clumpTemplates[fmIndex],
    );
    this.treeMeshes.push(...canopyMeshes, ...branches, ...trunkMeshes);
    this.addCasters(trunkMeshes);
    this.addCasters(canopyMeshes);
    return rad;
  }

  private buildTrees(scene: Scene, profile: ExperienceProfile, destinationPos: Vector3): void {
    const trunkMats: PBRMaterial[] = [];
    const foliageMats: PBRMaterial[] = [];

    if (profile.mode === 'radio') {
      const t = new PBRMaterial('trunkMat', scene);
      t.albedoColor = new Color3(0.12, 0.12, 0.14);
      t.metallic = 0; t.roughness = 0.85;
      trunkMats.push(t);

      const f = new PBRMaterial('foliageMat', scene);
      f.albedoColor = new Color3(0.08, 0.10, 0.10);
      f.metallic = 0; f.roughness = 0.6;
      f.backFaceCulling = false;
      foliageMats.push(f);
    } else {
      for (const [r, g, b] of [
        [0.30, 0.19, 0.09], [0.20, 0.13, 0.06],
        [0.36, 0.24, 0.14], [0.15, 0.10, 0.05],
      ]) {
        const m = new PBRMaterial(`trunkMat_${trunkMats.length}`, scene);
        m.albedoColor = new Color3(r, g, b);
        m.metallic = 0; m.roughness = 0.85;
        trunkMats.push(m);
      }
      for (const [r, g, b] of [
        [0.07, 0.32, 0.05], [0.18, 0.35, 0.04],
        [0.04, 0.22, 0.14], [0.09, 0.24, 0.07],
        [0.28, 0.24, 0.04],
      ]) {
        const m = new PBRMaterial(`foliageMat_${foliageMats.length}`, scene);
        m.albedoColor = new Color3(r, g, b);
        m.metallic = 0; m.roughness = 0.6;
        m.backFaceCulling = false;
        foliageMats.push(m);
      }
    }

    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const ps1 = profile.mode === 'ps1';

    // One shared "clump" template per foliage color, used only by the
    // 'cluster' canopy technique (see buildCanopy). Instancing these is far
    // cheaper than building unique geometry per tree.
    const clumpTemplates: Mesh[] = this.foliageTechnique === 'cluster'
      ? foliageMats.map((fm, i) => {
          const t = MeshBuilder.CreateSphere(`clumpTemplate_${i}`, {
            diameter: 1, segments: ps1 ? 6 : 9,
          }, scene);
          displaceToBlob(t, 0.55, 2.6, 400 + i * 37);
          t.material = fm;
          t.isVisible = false;
          if (ps1) t.convertToFlatShadedMesh();
          this.treeMeshes.push(t);
          return t;
        })
      : [];

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
      const rad = this.buildSingleTree(scene, profile, x, z, groundY, trunkMats, foliageMats, placed, clumpTemplates);
      this._colliders.push({ x, z, radius: rad });
      placed++;
    }

    const fmIndex = Math.floor(Math.random() * foliageMats.length);
    this.buildTrailWalls(
      scene, pick(trunkMats), foliageMats[fmIndex], profile, clumpTemplates[fmIndex],
    );
  }

  private buildTrailWalls(
    scene: Scene,
    trunkMat: PBRMaterial,
    foliageMat: PBRMaterial,
    profile: ExperienceProfile,
    clumpTemplate?: Mesh,
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

        const cW = 3.2 + Math.random() * 1.8;
        const canopyMeshes = this.buildCanopy(
          scene, x, z, groundY + height * 0.88, cW, cW * 0.6, foliageMat,
          profile.mode === 'ps1', `trail_${i}_${side}`, clumpTemplate,
        );
        this.treeMeshes.push(trunk, ...canopyMeshes);
        this.addCasters([trunk]);
        this.addCasters(canopyMeshes);
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

  private buildDeadEndTrail(scene: Scene, profile: ExperienceProfile): void {
    const rockMat = new PBRMaterial('deadEndRockMat', scene);
    if (profile.mode === 'radio') {
      rockMat.albedoColor = new Color3(0.14, 0.12, 0.14);
    } else {
      rockMat.albedoColor = new Color3(0.32, 0.28, 0.22);
    }
    rockMat.metallic = 0; rockMat.roughness = 0.9;

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
      this.treeMeshes.push(boulder);
      this.addCasters([boulder]);
    }

    const deadTrunkMat = new PBRMaterial('deadTrunkMat', scene);
    deadTrunkMat.albedoColor = profile.mode === 'radio'
      ? new Color3(0.08, 0.08, 0.09)
      : new Color3(0.18, 0.14, 0.10);
    deadTrunkMat.metallic = 0; deadTrunkMat.roughness = 0.85;

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
      this.addCasters([dead]);
    }
  }

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

  private buildRocks(scene: Scene, profile: ExperienceProfile): void {
    const rockColors = profile.mode === 'radio'
      ? [new Color3(0.10, 0.10, 0.12)]
      : [
          new Color3(0.32, 0.28, 0.22), new Color3(0.22, 0.24, 0.20),
          new Color3(0.38, 0.30, 0.20), new Color3(0.18, 0.16, 0.22),
        ];

    const rockMats = rockColors.map((c, i) => {
      const m = new PBRMaterial(`rockMat_${i}`, scene);
      m.albedoColor = c; m.metallic = 0; m.roughness = 0.9;
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
      this.treeMeshes.push(rock);
      this.addCasters([rock]);
    }
  }

  // Larger angular bedrock formations — a handful of multi-boulder clusters,
  // part-buried in the ground, distinct from the small scattered pebbles in
  // buildRocks(). This is what actually reads as "rock outcropping" instead
  // of loose stones.
  private buildRockOutcrops(scene: Scene, profile: ExperienceProfile): void {
    const rockColors = profile.mode === 'radio'
      ? [new Color3(0.09, 0.09, 0.11), new Color3(0.13, 0.12, 0.14)]
      : [
          new Color3(0.34, 0.31, 0.27), new Color3(0.24, 0.25, 0.23),
          new Color3(0.40, 0.33, 0.24), new Color3(0.20, 0.19, 0.24),
        ];
    const rockMats = rockColors.map((c, i) => {
      const m = new PBRMaterial(`outcropMat_${i}`, scene);
      m.albedoColor = c; m.metallic = 0; m.roughness = 0.9;
      return m;
    });
    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const outcropCount = profile.mode === 'ps1' ? 14 : 9;
    let placed = 0, attempts = 0;
    while (placed < outcropCount && attempts < outcropCount * 8) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 18 + Math.random() * 140;
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;
      if (this.inEitherCorridor(cx, cz)) continue;

      const boulderCount = 4 + Math.floor(Math.random() * 5);
      const mat = pick(rockMats);

      for (let b = 0; b < boulderCount; b++) {
        // Spread boulders around the outcrop center rather than scattering
        // them in a tight box — random scatter with large radii could pack
        // tightly enough to seal the whole cluster from every direction.
        const bAngle = (b / boulderCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
        const bDist = 1.2 + Math.random() * 3.0;
        const ox = Math.cos(bAngle) * bDist;
        const oz = Math.sin(bAngle) * bDist;
        const bx = cx + ox, bz = cz + oz;
        const by = this.terrain.getHeightAt(bx, bz);
        const size = 1.5 + Math.random() * 2.3;

        const boulder = MeshBuilder.CreateBox(`outcrop_${placed}_${b}`, { size }, scene);
        // sunk so the bottom third or so is buried, like real exposed bedrock
        boulder.position.set(bx, by + size * 0.22, bz);
        boulder.rotation.set(
          Math.random() * 0.6, Math.random() * Math.PI * 2, Math.random() * 0.6,
        );
        boulder.scaling.set(
          1 + Math.random() * 0.7, 0.7 + Math.random() * 0.6, 1 + Math.random() * 0.7,
        );
        boulder.material = mat;
        if (profile.mode === 'ps1') boulder.convertToFlatShadedMesh();
        this.treeMeshes.push(boulder);
        this.addCasters([boulder]);
        this._colliders.push({ x: bx, z: bz, radius: size * 0.45 });
      }
      placed++;
    }
  }

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

  // Dense, wispy low groundcover (ferns/clearweed) — thin double-sided
  // "blade" instances clustered into small fern-like clumps, with a touch of
  // emissive green so they read as backlit/translucent rather than solid.
  private buildLowGroundcover(scene: Scene, profile: ExperienceProfile): void {
    const ps1 = profile.mode === 'ps1';
    const palette = ps1
      ? [[0.42, 0.62, 0.22], [0.34, 0.56, 0.18], [0.50, 0.68, 0.30]]
      : [[0.10, 0.16, 0.07], [0.08, 0.13, 0.06]];

    const bladeTemplates: Mesh[] = palette.map(([r, g, b], i) => {
      const mat = new StandardMaterial(`groundcoverMat_${i}`, scene);
      mat.diffuseColor = new Color3(r, g, b);
      mat.emissiveColor = new Color3(r * 0.18, g * 0.22, b * 0.10);
      mat.specularColor = Color3.Black();
      mat.backFaceCulling = false;
      mat.alpha = 0.88;

      const blade = MeshBuilder.CreatePlane(`groundcoverBlade_${i}`, {
        width: 0.10, height: 0.6,
      }, scene);
      blade.material = mat;
      blade.isVisible = false;
      this.treeMeshes.push(blade);
      return blade;
    });

    const clumpCount = ps1 ? 600 : 420;
    let placed = 0, attempts = 0;
    while (placed < clumpCount && attempts < clumpCount * 5) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 150;
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;
      if (this.inEitherCorridor(cx, cz)) continue;

      const groundY = this.terrain.getHeightAt(cx, cz);
      const bladesInClump = 9 + Math.floor(Math.random() * 8);
      const template = bladeTemplates[Math.floor(Math.random() * bladeTemplates.length)];

      for (let b = 0; b < bladesInClump; b++) {
        const bx = cx + (Math.random() - 0.5) * 0.55;
        const bz = cz + (Math.random() - 0.5) * 0.55;
        const h = 0.35 + Math.random() * 0.5;
        const inst = template.createInstance(`groundcover_${placed}_${b}`);
        inst.position.set(bx, groundY + h * 0.5, bz);
        inst.rotation.y = Math.random() * Math.PI * 2;
        inst.rotation.x = (Math.random() - 0.5) * 0.5;
        inst.scaling.set(1, h / 0.55, 1);
      }
      placed++;
    }
  }

  private buildForestFloor(scene: Scene, profile: ExperienceProfile): void {
    const leafColors = profile.mode === 'ps1'
      ? [
          [0.44, 0.22, 0.07], [0.32, 0.14, 0.05],
          [0.50, 0.34, 0.06], [0.24, 0.18, 0.08],
          [0.38, 0.30, 0.10], [0.20, 0.22, 0.07],
        ]
      : [
          [0.07, 0.06, 0.05], [0.05, 0.04, 0.03], [0.06, 0.05, 0.03],
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

    const leavesPerColor = profile.mode === 'ps1' ? 260 : 110;
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

  private buildHikingTrail(scene: Scene, profile: ExperienceProfile): void {
    const ps1 = profile.mode === 'ps1';

    const dirtMat = new StandardMaterial('hikingDirtMat', scene);
    dirtMat.diffuseColor = ps1
      ? new Color3(0.30, 0.19, 0.10)
      : new Color3(0.07, 0.06, 0.04);
    dirtMat.specularColor = Color3.Black();

    const blazeMat = new StandardMaterial('trailBlazeMat', scene);
    blazeMat.diffuseColor = ps1
      ? new Color3(0.85, 0.42, 0.05)
      : new Color3(0.22, 0.22, 0.26);
    if (ps1) blazeMat.emissiveColor = new Color3(0.18, 0.08, 0.00);
    blazeMat.specularColor = Color3.Black();

    const postMat = new StandardMaterial('trailPostMat', scene);
    postMat.diffuseColor = ps1
      ? new Color3(0.24, 0.16, 0.08)
      : new Color3(0.08, 0.07, 0.06);
    postMat.specularColor = Color3.Black();

    const pts = HIKING_WAYPOINTS;

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

    for (let i = 0; i < pts.length; i += 2) {
      const [wx, wz] = pts[i];
      const wGroundY = this.terrain.getHeightAt(wx, wz);

      const ni = Math.min(i + 1, pts.length - 1);
      const [nx, nz] = pts[ni];
      const pdx = nz - wz, pdz = -(nx - wx);
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

      const blaze = MeshBuilder.CreateBox(`trailBlaze_${i}`, {
        width: 0.26, height: 0.38, depth: 0.05,
      }, scene);
      blaze.position.set(sideX, wGroundY + postH + 0.22, sideZ);
      blaze.material = blazeMat;
      this.treeMeshes.push(blaze);
    }

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
      const px = -ddz / len, pz = ddx / len;
      const stoneSteps = Math.ceil(len / 4);

      for (let s = 0; s < stoneSteps; s++) {
        const t = (s + 0.5) / stoneSteps;
        const cx = ax + t * ddx, cz = az + t * ddz;

        for (const side of [-1, 1]) {
          if (Math.random() < 0.55) continue;
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
