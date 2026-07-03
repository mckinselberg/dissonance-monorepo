import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  ShadowGenerator,
  PointLight,
  AbstractMesh,
  Color3,
  Vector3,
  Matrix,
  Quaternion,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceProfile } from '@dissonance/shared-types';
import type { Terrain } from './Terrain';
import { displaceToBlob, displaceRadial } from './noise';

const TRAIL_DIR = new Vector3(-0.65, 0, -0.76).normalize();
const TRAIL_LENGTH = 90;
const TRAIL_WIDTH = 7;
const TRAIL_START = new Vector3(6, 0, 4);

const HIKING_TRAIL_WIDTH = 1.9;
const HIKING_WAYPOINTS: [number, number][] = [
  [8, 6],   [22, 17],  [40, 30],  [54, 48],
  [72, 56], [92, 70],  [114, 86], [134, 100],
  [152, 114],[168, 126],[180, 135],
];

export interface Collider { x: number; z: number; radius: number; }

export class ForestGenerator {
  private treeMeshes: Mesh[] = [];
  private lights: PointLight[] = [];
  private terrain!: Terrain;
  private _colliders: Collider[] = [];
  private shadowGenerator: ShadowGenerator | undefined;
  private taillightMat: StandardMaterial | null = null;
  private headlightMat: StandardMaterial | null = null;
  private lightFlashActive = false;

  getColliders(): Collider[] { return this._colliders; }

  // Called by DestinationSystem on each alarm chirp — flashes car lights
  // bright for 150 ms then returns them to their resting state.
  flashCarLights(): void {
    if (this.lightFlashActive) return;
    this.lightFlashActive = true;
    if (this.taillightMat) this.taillightMat.emissiveColor = new Color3(1.0, 0.30, 0.20);
    if (this.headlightMat) this.headlightMat.emissiveColor = new Color3(1.0, 0.97, 0.82);
    setTimeout(() => {
      if (this.taillightMat) this.taillightMat.emissiveColor = new Color3(0.75, 0.04, 0.04);
      if (this.headlightMat) this.headlightMat.emissiveColor = new Color3(0.85, 0.80, 0.60);
      this.lightFlashActive = false;
    }, 150);
  }

  generate(
    scene: Scene,
    profile: ExperienceProfile,
    destinationPos: Vector3,
    terrain: Terrain,
    shadowGenerator?: ShadowGenerator,
  ): void {
    this.terrain = terrain;
    this._colliders = [];
    this.shadowGenerator = shadowGenerator;
    this.buildForest(scene, profile, destinationPos);
    this.buildCarGoal(scene, profile, destinationPos);
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
  private addCasters(meshes: AbstractMesh[]): void {
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

  // Per-tree/per-blob color jitter — a shared material means every canopy
  // piece is the *exact* same shade, which alone makes a forest read as
  // copy-pasted. Green swings further than red/blue since that's the
  // channel that actually reads as "this leaf mass vs that one."
  private jitterColor(base: Color3): Color3 {
    return new Color3(
      Math.max(0, base.r + (Math.random() - 0.5) * 0.08),
      Math.max(0, base.g + (Math.random() - 0.5) * 0.22),
      Math.max(0, base.b + (Math.random() - 0.5) * 0.06),
    );
  }

  // Builds one fully-randomized tree (trunk + conifer tiers or deciduous
  // dome+clumps) at local origin, then merges every part into a single
  // mesh. Called a fixed number of times up front to bake a small library
  // of unique trees — the design itself (widths/heights/tier counts/colors)
  // is exactly what was validated in the test grid, just no longer
  // rebuilt fresh per scattered tree.
  private buildOneTreeTemplate(scene: Scene, profile: ExperienceProfile, id: number): { mesh: Mesh; radius: number } {
    const ps1 = profile.mode === 'ps1';
    const height = 4 + Math.random() * 18;
    const baseRad = 0.12 + Math.random() * 0.22;
    const topRad = baseRad * 0.75;
    const lean = (Math.random() - 0.5) * 0.12;
    const seed = Math.floor(Math.random() * 100000);
    const parts: Mesh[] = [];

    const trunkMat = new PBRMaterial(`treeTrunkMat_${id}`, scene);
    trunkMat.albedoColor = this.jitterColor(new Color3(0.06, 0.03, 0.01));
    trunkMat.metallic = 0;
    trunkMat.roughness = 0.95;

    const trunk = MeshBuilder.CreateCylinder(`tree_${id}_trunk`, {
      height,
      diameterBottom: baseRad * 2,
      diameterTop: topRad * 2,
      tessellation: ps1 ? 6 : 8,
    }, scene);
    trunk.position.set(0, height / 2, 0);
    trunk.rotation.set(lean, Math.random() * Math.PI * 2, lean * 0.6);
    trunk.material = trunkMat;
    if (ps1) trunk.convertToFlatShadedMesh();
    parts.push(trunk);

    // Per-template shade factor — spreads 30 templates across 0.35-1.0 of
    // the base canopy brightness so adjacent trees have clearly different values.
    // Darkest templates (0.35) read as shadowed/dead; brightest (1.0) as vivid
    // green. The 3:1 ratio stays perceptible even at night's low ambient.
    const shadeFactor = 0.35 + Math.random() * 0.65;
    const isConifer = Math.random() < 0.5;
    const apexY = height;

    if (isConifer) {
      const coniferMat = new PBRMaterial(`treeConiferMat_${id}`, scene);
      coniferMat.albedoColor = new Color3(0.06, 0.75 * shadeFactor, 0.16 * shadeFactor);
      coniferMat.metallic = 0;
      coniferMat.roughness = 0.7;

      const angleSeed = Math.random();
      const coneBaseWidth = baseRad * 4 + height * (0.22 + angleSeed * 0.28);
      const coneHeight = height * (0.7 + Math.random() * 0.25);
      const tierCount = 3 + Math.floor(Math.random() * 3);
      const gapFrac = 0.12 + Math.random() * 0.12;
      let cursorY = apexY;

      for (let t = 0; t < tierCount; t++) {
        const tFrac = (t + 1) / tierCount;
        const tierHeight = (coneHeight / tierCount) * (0.85 + Math.random() * 0.25);
        const tierBottomDiam = coneBaseWidth * (0.35 + tFrac * 0.65) * (0.85 + Math.random() * 0.3);
        const tierTopDiam = t === 0 ? 0 : tierBottomDiam * (0.25 + Math.random() * 0.15);

        const tier = MeshBuilder.CreateCylinder(`tree_${id}_tier_${t}`, {
          height: tierHeight,
          diameterTop: tierTopDiam,
          diameterBottom: tierBottomDiam,
          tessellation: ps1 ? 6 : 9,
          subdivisions: 2,
        }, scene);
        displaceRadial(tier, 0.28, seed + t * 53 + 11);
        const ox = (Math.random() - 0.5) * tierBottomDiam * 0.15;
        const oz = (Math.random() - 0.5) * tierBottomDiam * 0.15;
        tier.position.set(ox, cursorY - tierHeight / 2, oz);
        tier.rotation.y = Math.random() * Math.PI * 2;
        const tierMat = coniferMat.clone(`treeConiferMat_${id}_${t}`);
        tierMat.albedoColor = this.jitterColor(coniferMat.albedoColor);
        tier.material = tierMat;
        if (ps1) tier.convertToFlatShadedMesh();
        parts.push(tier);

        cursorY -= tierHeight * (1 + gapFrac);
      }
    } else {
      const deciduousMat = new PBRMaterial(`treeDeciduousMat_${id}`, scene);
      deciduousMat.albedoColor = new Color3(0.08, 0.72 * shadeFactor, 0.14 * shadeFactor);
      deciduousMat.metallic = 0;
      deciduousMat.roughness = 0.6;

      // Superlinear in height (not just a flat fraction) — taller trees
      // get a disproportionately bigger canopy, not just a scaled-up copy
      // of a small tree's canopy.
      const canopyWidth = Math.pow(height, 1.12) * 0.38;

      const dome = MeshBuilder.CreateSphere(`tree_${id}_canopy`, {
        diameter: canopyWidth, segments: ps1 ? 6 : 10,
      }, scene);
      displaceToBlob(dome, 0.4, 2.2, seed);
      dome.scaling.set(
        0.85 + Math.random() * 0.3,
        0.5 + Math.random() * 0.15,
        0.85 + Math.random() * 0.3,
      );
      dome.position.set(0, height - canopyWidth * 0.12, 0);
      dome.rotation.y = Math.random() * Math.PI * 2;
      const domeMat = deciduousMat.clone(`treeDeciduousMat_${id}_dome`);
      domeMat.albedoColor = this.jitterColor(deciduousMat.albedoColor);
      dome.material = domeMat;
      if (ps1) dome.convertToFlatShadedMesh();
      parts.push(dome);

      const clumpCount = 3 + Math.floor(Math.random() * 3);
      for (let c = 0; c < clumpCount; c++) {
        const ox = (Math.random() - 0.5) * (canopyWidth * 0.6 + baseRad * 2);
        const oz = (Math.random() - 0.5) * (canopyWidth * 0.6 + baseRad * 2);
        const oy = (Math.random() - 0.3) * (height * 0.18);
        const clumpDiam = canopyWidth * (0.4 + Math.random() * 0.35);

        const clump = MeshBuilder.CreateSphere(`tree_${id}_clump_${c}`, {
          diameter: clumpDiam, segments: ps1 ? 5 : 8,
        }, scene);
        displaceToBlob(clump, 0.45, 2.4, seed + c * 31 + 7);
        clump.scaling.set(
          0.8 + Math.random() * 0.4,
          0.55 + Math.random() * 0.25,
          0.8 + Math.random() * 0.4,
        );
        clump.position.set(ox, height - canopyWidth * 0.12 + oy, oz);
        clump.rotation.y = Math.random() * Math.PI * 2;
        const clumpMat = deciduousMat.clone(`treeDeciduousMat_${id}_${c}`);
        clumpMat.albedoColor = this.jitterColor(deciduousMat.albedoColor);
        clump.material = clumpMat;
        if (ps1) clump.convertToFlatShadedMesh();
        parts.push(clump);
      }
    }

    const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
    if (!merged) throw new Error(`tree template ${id} failed to merge`);
    merged.name = `treeTemplate_${id}`;
    // Thin instances (used to scatter this template — see buildForest)
    // require the source mesh to stay visible; its own base transform
    // contributes nothing extra once thin instances are added.
    this.treeMeshes.push(merged);

    return { mesh: merged, radius: baseRad + 0.1 };
  }

  // Bakes a fixed library of unique trees once. Every scattered tree
  // afterward is a cheap GPU instance of one of these, not unique geometry —
  // the whole point of moving past the per-tree-build test grid.
  private buildTreeTemplates(
    scene: Scene, profile: ExperienceProfile, count: number,
  ): { mesh: Mesh; radius: number }[] {
    const templates: { mesh: Mesh; radius: number }[] = [];
    for (let i = 0; i < count; i++) {
      templates.push(this.buildOneTreeTemplate(scene, profile, i));
    }
    return templates;
  }

  // Bakes the template library once, then scatters cheap instances of it
  // across the whole map (avoiding trail corridors and a clearing around
  // the destination), plus a denser flanking wall along the dead-end trail.
  // Thin-instanced, same as the ground-cover systems — was regular
  // createInstance() per tree (up to 1,000 full InstancedMesh objects,
  // each a multi-submesh/multi-material node). Matrices accumulate across
  // both this scatter pass and buildTrailWalls, then commit once per
  // template at the end so bounding-info refresh only happens once.
  private buildForest(scene: Scene, profile: ExperienceProfile, destinationPos: Vector3): void {
    const templates = this.buildTreeTemplates(scene, profile, 30);
    const matricesByTemplate: Matrix[][] = templates.map(() => []);
    const maxRadius = profile.drawDistance * 1.15;

    let placed = 0;
    let attempts = 0;
    const maxAttempts = profile.treeCount * 8;

    while (placed < profile.treeCount && attempts < maxAttempts) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * (maxRadius - 8);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      if (this.inEitherCorridor(x, z)) continue;
      const tdx = x - destinationPos.x, tdz = z - destinationPos.z;
      if (tdx * tdx + tdz * tdz < 18 * 18) continue;

      const groundY = this.terrain.getHeightAt(x, z);
      const ti = Math.floor(Math.random() * templates.length);
      const rad = templates[ti].radius;
      const scale = 0.85 + Math.random() * 0.45;
      matricesByTemplate[ti].push(Matrix.Compose(
        new Vector3(scale, scale, scale),
        Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
        new Vector3(x, groundY, z),
      ));

      this._colliders.push({ x, z, radius: rad * scale });
      placed++;
    }

    // Sparse outer ring, reusing the same baked templates — extends the
    // "this is a forest" silhouette out toward the world boundary without
    // paying dense-forest cost that far out (mostly fog-hidden anyway,
    // just enough visible above/through it to not read as an abrupt edge).
    const outerRadius = 300;
    const outerCount = 200;
    let outerPlaced = 0, outerAttempts = 0;
    while (outerPlaced < outerCount && outerAttempts < outerCount * 8) {
      outerAttempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = maxRadius + Math.random() * (outerRadius - maxRadius);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      if (this.inEitherCorridor(x, z)) continue;
      const tdx = x - destinationPos.x, tdz = z - destinationPos.z;
      if (tdx * tdx + tdz * tdz < 18 * 18) continue;

      const groundY = this.terrain.getHeightAt(x, z);
      const ti = Math.floor(Math.random() * templates.length);
      const rad = templates[ti].radius;
      const scale = 0.85 + Math.random() * 0.45;
      matricesByTemplate[ti].push(Matrix.Compose(
        new Vector3(scale, scale, scale),
        Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
        new Vector3(x, groundY, z),
      ));

      this._colliders.push({ x, z, radius: rad * scale });
      outerPlaced++;
    }

    // Dense ring of trees framing the parking lot clearing — the lot's
    // asphalt footprint is ~30x22, so start at radius 18 (just past the
    // corners, ~sqrt(15²+11²)) and spread outward 20 units for a thick
    // treeline that makes the clearing feel intentional rather than random.
    const lotRingMin = 18, lotRingMax = 38;
    const lotRingCount = 48;
    for (let r = 0; r < lotRingCount; r++) {
      const angle = (r / lotRingCount) * Math.PI * 2 + (Math.random() - 0.5) * (Math.PI / lotRingCount) * 2;
      const dist = lotRingMin + Math.random() * (lotRingMax - lotRingMin);
      const x = destinationPos.x + Math.cos(angle) * dist;
      const z = destinationPos.z + Math.sin(angle) * dist;
      const groundY = this.terrain.getHeightAt(x, z);
      const ti = Math.floor(Math.random() * templates.length);
      const rad = templates[ti].radius;
      const scale = 0.9 + Math.random() * 0.4;
      matricesByTemplate[ti].push(Matrix.Compose(
        new Vector3(scale, scale, scale),
        Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
        new Vector3(x, groundY, z),
      ));
      this._colliders.push({ x, z, radius: rad * scale });
    }

    this.buildTrailWalls(templates, matricesByTemplate);

    templates.forEach((t, i) => {
      t.mesh.thinInstanceAdd(matricesByTemplate[i], true);
      this.addCasters([t.mesh]);
    });
  }

  private buildTrailWalls(
    templates: { mesh: Mesh; radius: number }[],
    matricesByTemplate: Matrix[][],
  ): void {
    const wallTreeCount = 28;
    const perp = new Vector3(-TRAIL_DIR.z, 0, TRAIL_DIR.x);

    for (let i = 0; i < wallTreeCount; i++) {
      const t = (i / wallTreeCount) * TRAIL_LENGTH;
      const cx = TRAIL_START.x + TRAIL_DIR.x * t;
      const cz = TRAIL_START.z + TRAIL_DIR.z * t;

      for (const side of [-1, 1]) {
        const jitter = (Math.random() - 0.5) * 2.5;
        const x = cx + perp.x * (TRAIL_WIDTH + 1.5 + jitter) * side;
        const z = cz + perp.z * (TRAIL_WIDTH + 1.5 + jitter) * side;
        const groundY = this.terrain.getHeightAt(x, z);

        const ti = Math.floor(Math.random() * templates.length);
        const rad = templates[ti].radius;
        const scale = 0.8 + Math.random() * 0.4;
        matricesByTemplate[ti].push(Matrix.Compose(
          new Vector3(scale, scale, scale),
          Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
          new Vector3(x, groundY, z),
        ));

        this._colliders.push({ x, z, radius: rad * scale });
      }
    }
  }

  // One shared box/cone-or-sphere template, thin-instanced — was one unique
  // mesh per shrub (160-220 individual draw calls) for a shape that never
  // varied beyond size/rotation.
  private buildUnderbrush(scene: Scene, profile: ExperienceProfile): void {
    const mat = new StandardMaterial('underbrushMat', scene);
    if (profile.mode === 'radio') {
      mat.diffuseColor = new Color3(0.05, 0.06, 0.06);
    } else {
      mat.diffuseColor = new Color3(0.06, 0.14, 0.05);
    }
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;

    const ps1 = profile.mode === 'ps1';
    const template = ps1
      ? MeshBuilder.CreateCylinder('shrubBase', { height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 4 }, scene)
      : MeshBuilder.CreateSphere('shrubBase', { diameter: 1, segments: 3 }, scene);
    template.material = mat;
    this.treeMeshes.push(template);

    const count = ps1 ? 220 : 160;
    const maxRadius = profile.drawDistance * 1.15;
    const matrices: Matrix[] = [];
    let placed = 0, attempts = 0;

    while (placed < count && attempts < count * 5) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * (maxRadius - 5);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (this.inEitherCorridor(x, z)) continue;

      const groundY = this.terrain.getHeightAt(x, z);
      const w = 0.6 + Math.random() * 1.1;
      const h = 0.25 + Math.random() * 0.45;
      const scale = ps1 ? new Vector3(w * 2, h, w * 2) : new Vector3(w, w, w);

      matrices.push(Matrix.Compose(
        scale,
        Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
        new Vector3(x, groundY + h * 0.5, z),
      ));
      placed++;
    }
    template.thinInstanceAdd(matrices, true);
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

  // The goal: a parked car on a large asphalt clearing, lit by two lamp
  // posts, surrounded by forest (the ring is planted in buildForest).
  // All geometry is boxes/cylinders — no asset pipeline. Two PointLights
  // only (fixed, non-shadow-casting), a negligible per-frame cost.
  private buildCarGoal(scene: Scene, profile: ExperienceProfile, pos: Vector3): void {
    const ps1 = profile.mode === 'ps1';
    const groundY = this.terrain.getHeightAt(pos.x, pos.z);
    const cs = 1.45; // uniform scale applied to all car dimensions

    // ─── Parking lot ──────────────────────────────────────────────────
    const lotMat = new StandardMaterial('parkingLotMat', scene);
    lotMat.diffuseColor = new Color3(0.10, 0.10, 0.11);
    lotMat.specularColor = Color3.Black();
    const lot = MeshBuilder.CreateBox('parkingLot', { width: 30, height: 0.1, depth: 22 }, scene);
    lot.position.set(pos.x, groundY + 0.05, pos.z);
    lot.material = lotMat;
    this.treeMeshes.push(lot);

    // Lot border — a slightly raised lip around the edge reads as a kerb.
    const kerbMat = new StandardMaterial('parkingKerbMat', scene);
    kerbMat.diffuseColor = new Color3(0.22, 0.22, 0.24);
    kerbMat.specularColor = Color3.Black();
    const kerbPairs: [number, number, number, number][] = [
      // [width, depth, offsetX, offsetZ]
      [30.5, 0.4, 0, 11], [30.5, 0.4, 0, -11],
      [0.4, 22.5, 15, 0], [0.4, 22.5, -15, 0],
    ];
    for (const [kw, kd, kox, koz] of kerbPairs) {
      const kerb = MeshBuilder.CreateBox('parkingKerb', { width: kw, height: 0.18, depth: kd }, scene);
      kerb.position.set(pos.x + kox, groundY + 0.12, pos.z + koz);
      kerb.material = kerbMat;
      this.treeMeshes.push(kerb);
    }

    // ─── Car materials ────────────────────────────────────────────────
    const bodyMat = new StandardMaterial('carBodyMat', scene);
    bodyMat.diffuseColor = new Color3(0.15, 0.21, 0.32);
    bodyMat.specularColor = Color3.Black();

    const panelMat = new StandardMaterial('carPanelMat', scene);
    panelMat.diffuseColor = new Color3(0.13, 0.18, 0.28); // slightly darker for hood/trunk
    panelMat.specularColor = Color3.Black();

    const glassMat = new StandardMaterial('carGlassMat', scene);
    glassMat.diffuseColor = new Color3(0.04, 0.06, 0.08);
    glassMat.specularColor = Color3.Black();

    const bumperMat = new StandardMaterial('carBumperMat', scene);
    bumperMat.diffuseColor = new Color3(0.09, 0.09, 0.10);
    bumperMat.specularColor = Color3.Black();

    const wheelMat = new StandardMaterial('carWheelMat', scene);
    wheelMat.diffuseColor = new Color3(0.04, 0.04, 0.04);
    wheelMat.specularColor = Color3.Black();

    const rimMat = new StandardMaterial('carRimMat', scene);
    rimMat.diffuseColor = new Color3(0.44, 0.44, 0.50);
    rimMat.specularColor = Color3.Black();

    this.headlightMat = new StandardMaterial('carHeadlightMat', scene);
    this.headlightMat.diffuseColor = new Color3(0.9, 0.9, 0.92);
    this.headlightMat.emissiveColor = new Color3(0.85, 0.80, 0.60);
    this.headlightMat.specularColor = Color3.Black();
    const headlightMat = this.headlightMat;

    this.taillightMat = new StandardMaterial('carTaillightMat', scene);
    this.taillightMat.diffuseColor = new Color3(0.6, 0.05, 0.05);
    this.taillightMat.emissiveColor = new Color3(0.75, 0.04, 0.04);
    this.taillightMat.specularColor = Color3.Black();
    const taillightMat = this.taillightMat;

    // ─── Car geometry — sedan proportions, car faces +Z ───────────────
    // Raw dimensions (× cs = actual world size).
    const bW = 1.72, bH = 0.78, bD = 4.1; // main body
    const bodyBottom = groundY + 0.18 * cs;
    const bodyTopY = bodyBottom + bH * cs;

    const addMesh = (m: ReturnType<typeof MeshBuilder.CreateBox>) => {
      if (ps1) m.convertToFlatShadedMesh();
      this.treeMeshes.push(m);
    };

    // Lower body (door sills, side panels)
    const body = MeshBuilder.CreateBox('carBody', { width: bW * cs, height: bH * cs, depth: bD * cs }, scene);
    body.position.set(pos.x, bodyBottom + (bH * cs) / 2, pos.z);
    body.material = bodyMat;
    addMesh(body);

    // Hood — thin slab on top of front third of body
    const hoodD = 1.3;
    const hood = MeshBuilder.CreateBox('carHood', { width: (bW - 0.08) * cs, height: 0.10 * cs, depth: hoodD * cs }, scene);
    hood.position.set(pos.x, bodyTopY + 0.05 * cs, pos.z + (bD / 2 - hoodD / 2) * cs);
    hood.material = panelMat;
    addMesh(hood);

    // Trunk lid — shorter slab on top of rear section
    const trunkD = 1.0;
    const trunk = MeshBuilder.CreateBox('carTrunk', { width: (bW - 0.1) * cs, height: 0.10 * cs, depth: trunkD * cs }, scene);
    trunk.position.set(pos.x, bodyTopY + 0.05 * cs, pos.z - (bD / 2 - trunkD / 2) * cs);
    trunk.material = panelMat;
    addMesh(trunk);

    // Cabin / greenhouse (windows + roof)
    const cW = 1.52, cH = 0.72, cD = 2.3;
    const cabin = MeshBuilder.CreateBox('carCabin', { width: cW * cs, height: cH * cs, depth: cD * cs }, scene);
    cabin.position.set(pos.x, bodyTopY + (cH * cs) / 2, pos.z - 0.22 * cs);
    cabin.material = glassMat;
    addMesh(cabin);

    // Front bumper
    const fBumper = MeshBuilder.CreateBox('carFBumper', { width: (bW + 0.06) * cs, height: 0.28 * cs, depth: 0.20 * cs }, scene);
    fBumper.position.set(pos.x, bodyBottom + 0.14 * cs, pos.z + (bD / 2 + 0.10) * cs);
    fBumper.material = bumperMat;
    addMesh(fBumper);

    // Rear bumper
    const rBumper = MeshBuilder.CreateBox('carRBumper', { width: (bW + 0.06) * cs, height: 0.28 * cs, depth: 0.20 * cs }, scene);
    rBumper.position.set(pos.x, bodyBottom + 0.14 * cs, pos.z - (bD / 2 + 0.10) * cs);
    rBumper.material = bumperMat;
    addMesh(rBumper);

    // Headlights (front face, upper corners)
    const hlXOff = (bW / 2 - 0.22) * cs;
    const hlY = bodyBottom + 0.52 * cs;
    const hlZ = pos.z + (bD / 2 + 0.01) * cs;
    for (const sx of [-1, 1]) {
      const hl = MeshBuilder.CreateBox('carHeadlight', { width: 0.40 * cs, height: 0.18 * cs, depth: 0.07 * cs }, scene);
      hl.position.set(pos.x + sx * hlXOff, hlY, hlZ);
      hl.material = headlightMat;
      addMesh(hl);
    }

    // Taillights (rear face)
    const tlXOff = (bW / 2 - 0.24) * cs;
    const tlY = bodyBottom + 0.48 * cs;
    const tlZ = pos.z - (bD / 2 + 0.01) * cs;
    for (const sx of [-1, 1]) {
      const tl = MeshBuilder.CreateBox('carTaillight', { width: 0.36 * cs, height: 0.18 * cs, depth: 0.07 * cs }, scene);
      tl.position.set(pos.x + sx * tlXOff, tlY, tlZ);
      tl.material = taillightMat;
      addMesh(tl);
    }

    // Wheels + rims (4 corners)
    const wR = 0.36, wXOff = (bW / 2 + 0.05) * cs, wZOff = 1.28 * cs;
    const wheelAxes: [number, number][] = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
    for (const [sx, sz] of wheelAxes) {
      const tire = MeshBuilder.CreateCylinder('carWheel', {
        height: 0.30 * cs, diameter: wR * 2 * cs, tessellation: ps1 ? 8 : 14,
      }, scene);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(pos.x + sx * wXOff, groundY + wR * cs, pos.z + sz * wZOff);
      tire.material = wheelMat;
      addMesh(tire);

      const rim = MeshBuilder.CreateCylinder('carRim', {
        height: 0.32 * cs, diameter: wR * 1.26 * cs, tessellation: ps1 ? 6 : 10,
      }, scene);
      rim.rotation.z = Math.PI / 2;
      rim.position.copyFrom(tire.position);
      rim.material = rimMat;
      addMesh(rim);
    }

    // Side mirrors
    const mirY = bodyTopY - 0.05 * cs;
    const mirXOff = (bW / 2 + 0.06) * cs;
    const mirZ = pos.z + 0.72 * cs;
    for (const sx of [-1, 1]) {
      const mir = MeshBuilder.CreateBox('carMirror', { width: 0.07 * cs, height: 0.11 * cs, depth: 0.13 * cs }, scene);
      mir.position.set(pos.x + sx * mirXOff, mirY, mirZ);
      mir.material = bumperMat;
      addMesh(mir);
    }

    // Antenna
    const antenna = MeshBuilder.CreateCylinder('carAntenna', { height: 0.4 * cs, diameter: 0.025 * cs, tessellation: 4 }, scene);
    antenna.position.set(pos.x - 0.3 * cs, bodyTopY + cH * cs + 0.2 * cs, pos.z - 0.6 * cs);
    antenna.material = bumperMat;
    this.treeMeshes.push(antenna);

    // ─── Lamp posts ────────────────────────────────────────────────────
    const poleMat = new StandardMaterial('lampPoleMat', scene);
    poleMat.diffuseColor = new Color3(0.08, 0.08, 0.09);
    poleMat.specularColor = Color3.Black();

    const lampMat = new StandardMaterial('lampHeadMat', scene);
    lampMat.diffuseColor = new Color3(0.28, 0.26, 0.16);
    lampMat.emissiveColor = new Color3(1.0, 0.85, 0.55);
    lampMat.specularColor = Color3.Black();

    const lampOffsets: [number, number][] = [[-10, 7], [10, -7]];
    for (const [lx, lz] of lampOffsets) {
      const lampGroundY = this.terrain.getHeightAt(pos.x + lx, pos.z + lz);
      const poleHeight = 5.0;

      const pole = MeshBuilder.CreateCylinder('lampPole', {
        height: poleHeight, diameter: 0.13, tessellation: ps1 ? 6 : 8,
      }, scene);
      pole.position.set(pos.x + lx, lampGroundY + poleHeight / 2, pos.z + lz);
      pole.material = poleMat;
      this.treeMeshes.push(pole);

      const arm = MeshBuilder.CreateBox('lampArm', { width: 0.1, height: 0.1, depth: 0.8 }, scene);
      arm.position.set(pos.x + lx, lampGroundY + poleHeight + 0.05, pos.z + lz + 0.35);
      arm.material = poleMat;
      this.treeMeshes.push(arm);

      const lampHeadPos = new Vector3(pos.x + lx, lampGroundY + poleHeight + 0.22, pos.z + lz + 0.7);
      const lampHead = MeshBuilder.CreateBox('lampHead', { width: 0.5, height: 0.15, depth: 0.5 }, scene);
      lampHead.position.copyFrom(lampHeadPos);
      lampHead.material = lampMat;
      this.treeMeshes.push(lampHead);

      const light = new PointLight('lampLight', lampHeadPos, scene);
      light.diffuse = new Color3(1.0, 0.85, 0.55);
      light.specular = Color3.Black();
      light.intensity = 1.0;
      light.range = 22;
      this.lights.push(light);
    }
  }

  // One box template per rock color, thin-instanced — was one unique box
  // mesh per rock (55-80 individual draw calls + individual shadow casters).
  // Shadow casting is now registered once per template since thin instances
  // ride along with the source mesh's render/shadow pass automatically.
  private buildRocks(scene: Scene, profile: ExperienceProfile): void {
    const rockColors = profile.mode === 'radio'
      ? [new Color3(0.10, 0.10, 0.12)]
      : [
          new Color3(0.32, 0.28, 0.22), new Color3(0.22, 0.24, 0.20),
          new Color3(0.38, 0.30, 0.20), new Color3(0.18, 0.16, 0.22),
        ];

    const templates = rockColors.map((c, i) => {
      const m = new PBRMaterial(`rockMat_${i}`, scene);
      m.albedoColor = c; m.metallic = 0; m.roughness = 0.9;
      const t = MeshBuilder.CreateBox(`rockTemplate_${i}`, { size: 1 }, scene);
      t.material = m;
      if (profile.mode === 'ps1') t.convertToFlatShadedMesh();
      this.treeMeshes.push(t);
      return t;
    });
    const matricesByTemplate: Matrix[][] = templates.map(() => []);

    const count = profile.mode === 'ps1' ? 80 : 55;
    const maxRadius = profile.drawDistance * 1.15;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * (maxRadius - 10);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (this.inEitherCorridor(x, z)) continue;

      const groundY = this.terrain.getHeightAt(x, z);
      const size = 0.3 + Math.random() * 1.4;
      this._colliders.push({ x, z, radius: size * 0.55 });

      const ti = Math.floor(Math.random() * templates.length);
      matricesByTemplate[ti].push(Matrix.Compose(
        new Vector3(
          size * (1 + Math.random() * 0.5),
          size * (0.6 + Math.random() * 0.4),
          size * (1 + Math.random() * 0.5),
        ),
        Quaternion.FromEulerAngles(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5),
        new Vector3(x, groundY + size * 0.4, z),
      ));
    }
    templates.forEach((t, i) => {
      t.thinInstanceAdd(matricesByTemplate[i], true);
      this.addCasters([t]);
    });
  }

  // Larger angular bedrock formations — a handful of multi-boulder clusters,
  // part-buried in the ground, distinct from the small scattered pebbles in
  // buildRocks(). This is what actually reads as "rock outcropping" instead
  // of loose stones.
  // Same template+thin-instance pattern as buildRocks — was up to ~110
  // individual unique-geometry boulders. One material is still picked per
  // outcrop cluster (so a whole formation reads as one rock type), so
  // boulders group into their cluster's chosen template's matrix array.
  private buildRockOutcrops(scene: Scene, profile: ExperienceProfile): void {
    const rockColors = profile.mode === 'radio'
      ? [new Color3(0.09, 0.09, 0.11), new Color3(0.13, 0.12, 0.14)]
      : [
          new Color3(0.34, 0.31, 0.27), new Color3(0.24, 0.25, 0.23),
          new Color3(0.40, 0.33, 0.24), new Color3(0.20, 0.19, 0.24),
        ];
    const templates = rockColors.map((c, i) => {
      const m = new PBRMaterial(`outcropMat_${i}`, scene);
      m.albedoColor = c; m.metallic = 0; m.roughness = 0.9;
      const t = MeshBuilder.CreateBox(`outcropTemplate_${i}`, { size: 1 }, scene);
      t.material = m;
      if (profile.mode === 'ps1') t.convertToFlatShadedMesh();
      this.treeMeshes.push(t);
      return t;
    });
    const matricesByTemplate: Matrix[][] = templates.map(() => []);

    const outcropCount = profile.mode === 'ps1' ? 14 : 9;
    const maxRadius = profile.drawDistance * 1.15;
    let placed = 0, attempts = 0;
    while (placed < outcropCount && attempts < outcropCount * 8) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 18 + Math.random() * (maxRadius - 18);
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;
      if (this.inEitherCorridor(cx, cz)) continue;

      const boulderCount = 4 + Math.floor(Math.random() * 5);
      const ti = Math.floor(Math.random() * templates.length);

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

        // sunk so the bottom third or so is buried, like real exposed bedrock
        matricesByTemplate[ti].push(Matrix.Compose(
          new Vector3(
            size * (1 + Math.random() * 0.7),
            size * (0.7 + Math.random() * 0.6),
            size * (1 + Math.random() * 0.7),
          ),
          Quaternion.FromEulerAngles(Math.random() * 0.6, Math.random() * Math.PI * 2, Math.random() * 0.6),
          new Vector3(bx, by + size * 0.22, bz),
        ));
        this._colliders.push({ x: bx, z: bz, radius: size * 0.45 });
      }
      placed++;
    }
    templates.forEach((t, i) => {
      t.thinInstanceAdd(matricesByTemplate[i], true);
      this.addCasters([t]);
    });
  }

  // Thin-instanced — was a regular InstancedMesh per blade (up to ~4,400
  // full mesh-node objects). Thin instances are just a matrix appended to
  // a buffer on the template, no per-instance JS object at all.
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
      if (profile.mode === 'ps1') base.convertToFlatShadedMesh();
      bases.push(base);
      this.treeMeshes.push(base);
    }

    const perBase = profile.mode === 'ps1' ? 1100 : 640;
    const maxRadius = profile.drawDistance * 1.15;
    for (let bi = 0; bi < bases.length; bi++) {
      const matrices: Matrix[] = [];
      let placed = 0, attempts = 0;
      while (placed < perBase && attempts < perBase * 4) {
        attempts++;
        const angle = Math.random() * Math.PI * 2;
        const radius = 4 + Math.random() * (maxRadius - 4);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        if (this.inEitherCorridor(x, z)) continue;

        const groundY = this.terrain.getHeightAt(x, z);
        const h = 0.28 + Math.random() * 0.32;
        matrices.push(Matrix.Compose(
          new Vector3(1, h / 0.42, 1),
          Quaternion.FromEulerAngles((Math.random() - 0.5) * 0.22, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.22),
          new Vector3(x, groundY + h / 2, z),
        ));
        placed++;
      }
      bases[bi].thinInstanceAdd(matrices, true);
    }
  }

  // Dense, wispy low groundcover (ferns/clearweed) — thin double-sided
  // "blade" thin-instances clustered into small fern-like clumps, with a
  // touch of emissive green so they read as backlit/translucent rather
  // than solid. This is the single largest instance count in the forest
  // (~17,500) — was regular instances (one full mesh-node object each),
  // now thin instances (one matrix in a buffer each).
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
      this.treeMeshes.push(blade);
      return blade;
    });
    const matricesByTemplate: Matrix[][] = bladeTemplates.map(() => []);

    const clumpCount = ps1 ? 950 : 650;
    const maxRadius = profile.drawDistance * 1.15;
    let placed = 0, attempts = 0;
    while (placed < clumpCount && attempts < clumpCount * 5) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * (maxRadius - 4);
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;
      if (this.inEitherCorridor(cx, cz)) continue;

      const groundY = this.terrain.getHeightAt(cx, cz);
      const bladesInClump = 14 + Math.floor(Math.random() * 10);
      const ti = Math.floor(Math.random() * bladeTemplates.length);

      for (let b = 0; b < bladesInClump; b++) {
        const bx = cx + (Math.random() - 0.5) * 0.55;
        const bz = cz + (Math.random() - 0.5) * 0.55;
        const h = 0.35 + Math.random() * 0.5;
        matricesByTemplate[ti].push(Matrix.Compose(
          new Vector3(1, h / 0.55, 1),
          Quaternion.FromEulerAngles((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, 0),
          new Vector3(bx, groundY + h * 0.5, bz),
        ));
      }
      placed++;
    }
    bladeTemplates.forEach((t, i) => t.thinInstanceAdd(matricesByTemplate[i], true));
  }

  // Leaves and moss were already regular instances; logs were unique
  // geometry per log (length/radius varied per-log). All three now use
  // thin instances — logs via a unit-size template scaled per instance
  // instead of building bespoke geometry each time.
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
      leafBases.push(base);
      this.treeMeshes.push(base);
    }

    const maxRadius = profile.drawDistance * 1.15;
    const leavesPerColor = profile.mode === 'ps1' ? 260 : 110;
    for (let bi = 0; bi < leafBases.length; bi++) {
      const matrices: Matrix[] = [];
      for (let i = 0; i < leavesPerColor; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * (maxRadius - 5);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const groundY = this.terrain.getHeightAt(x, z);
        const scale = 0.6 + Math.random() * 1.6;
        matrices.push(Matrix.Compose(
          new Vector3(scale, scale, scale),
          Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
          new Vector3(x, groundY + 0.013, z),
        ));
      }
      leafBases[bi].thinInstanceAdd(matrices, true);
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
    this.treeMeshes.push(mossBase);

    const mossCount = profile.mode === 'ps1' ? 90 : 55;
    const mossMatrices: Matrix[] = [];
    for (let i = 0; i < mossCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 6 + Math.random() * (maxRadius - 6);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const groundY = this.terrain.getHeightAt(x, z);
      const scale = 0.5 + Math.random() * 1.8;
      mossMatrices.push(Matrix.Compose(
        new Vector3(scale, scale, scale),
        Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
        new Vector3(x, groundY + 0.02, z),
      ));
    }
    mossBase.thinInstanceAdd(mossMatrices, true);

    const logMat = new StandardMaterial('logMat', scene);
    logMat.diffuseColor = profile.mode === 'ps1'
      ? new Color3(0.20, 0.13, 0.07)
      : new Color3(0.06, 0.05, 0.04);
    logMat.specularColor = Color3.Black();

    const logBase = MeshBuilder.CreateCylinder(
      'logBase',
      { height: 1, diameter: 1, tessellation: profile.mode === 'ps1' ? 6 : 8 },
      scene,
    );
    logBase.material = logMat;
    if (profile.mode === 'ps1') logBase.convertToFlatShadedMesh();
    this.treeMeshes.push(logBase);

    const logCount = profile.mode === 'ps1' ? 42 : 28;
    const logMatrices: Matrix[] = [];
    for (let i = 0; i < logCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * (maxRadius - 8);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (this.inEitherCorridor(x, z)) continue;

      const groundY = this.terrain.getHeightAt(x, z);
      const logLen = 3 + Math.random() * 5;
      const logRad = 0.14 + Math.random() * 0.18;
      const yaw = Math.random() * Math.PI * 2;

      logMatrices.push(Matrix.Compose(
        new Vector3(logRad * 2, logLen, logRad * 2),
        Quaternion.FromEulerAngles(0, yaw, Math.PI / 2),
        new Vector3(x, groundY + logRad, z),
      ));
    }
    logBase.thinInstanceAdd(logMatrices, true);
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
      const ddx = bx - ax, ddz = bz - az;
      const len = Math.sqrt(ddx * ddx + ddz * ddz);
      const yaw = Math.atan2(ddx, ddz);

      // Each waypoint-to-waypoint gap used to be one flat box sampled at
      // its midpoint height only — fine on flat ground, but it clips into
      // or floats above the now-hillier/tilted terrain along its length.
      // Splitting into shorter sub-boxes, each pitched to the slope between
      // its own two endpoints, makes the path follow the grade instead.
      const subCount = Math.max(1, Math.ceil(len / 8));
      const subLen = len / subCount;
      for (let s = 0; s < subCount; s++) {
        const t0 = s / subCount, t1 = (s + 1) / subCount;
        const x0 = ax + t0 * ddx, z0 = az + t0 * ddz;
        const x1 = ax + t1 * ddx, z1 = az + t1 * ddz;
        const y0 = this.terrain.getHeightAt(x0, z0);
        const y1 = this.terrain.getHeightAt(x1, z1);
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, my = (y0 + y1) / 2;
        const slope = Math.atan2(y1 - y0, subLen);

        const strip = MeshBuilder.CreateBox(`trailStrip_${i}_${s}`, {
          width: HIKING_TRAIL_WIDTH * 2,
          height: 0.06,
          depth: subLen + 0.4,
        }, scene);
        strip.position.set(mx, my + 0.03, mz);
        strip.rotation.set(-slope, yaw, 0);
        strip.material = dirtMat;
        this.treeMeshes.push(strip);
      }

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
    this.lights.forEach(l => l.dispose());
    this.lights = [];
  }
}
