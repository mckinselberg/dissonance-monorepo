import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  ShadowGenerator,
  AbstractMesh,
  Color3,
  Vector3,
  Mesh,
} from '@babylonjs/core';
import type { ExperienceProfile } from '@dissonance/shared-types';
import type { Terrain } from './Terrain';
import { displaceToBlob, displaceRadial } from './noise';

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
  private shadowGenerator: ShadowGenerator | undefined;

  getColliders(): Collider[] { return this._colliders; }

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
    // Trees deliberately removed — redesigning from scratch, one simple
    // tree at a time, before scattering anything across the world again.
    this.buildTestTree(scene, profile);
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

  // A 4×4 grid of test trees near the world origin — one axis varies trunk
  // width, the other varies height (range confirmed good as-is, kept as
  // randomizable variety rather than converging on one size). Canopy
  // alternates conifer (cone) / deciduous (flattened dome) checkerboard-
  // style across the grid so both styles are visible across the full size
  // range side by side.
  private buildTestTree(scene: Scene, profile: ExperienceProfile): void {
    const ps1 = profile.mode === 'ps1';
    const widths = [0.12, 0.19, 0.27, 0.34];
    const heights = [4, 7, 10, 13];
    const spacing = 4;

    const trunkMat = new PBRMaterial('testTreeTrunkMat', scene);
    trunkMat.albedoColor = new Color3(0.36, 0.16, 0.07);
    trunkMat.metallic = 0;
    trunkMat.roughness = 0.85;

    const coniferMat = new PBRMaterial('testTreeConiferMat', scene);
    coniferMat.albedoColor = new Color3(0.06, 0.26, 0.10);
    coniferMat.metallic = 0;
    coniferMat.roughness = 0.7;

    const deciduousMat = new PBRMaterial('testTreeDeciduousMat', scene);
    deciduousMat.albedoColor = new Color3(0.16, 0.34, 0.06);
    deciduousMat.metallic = 0;
    deciduousMat.roughness = 0.6;

    for (let wi = 0; wi < widths.length; wi++) {
      for (let hi = 0; hi < heights.length; hi++) {
        const x = wi * spacing;
        const z = hi * spacing;
        const groundY = this.terrain.getHeightAt(x, z);

        const height = heights[hi];
        const baseRad = widths[wi];
        const topRad = baseRad * 0.75;
        const lean = (Math.random() - 0.5) * 0.12;

        const trunk = MeshBuilder.CreateCylinder(`testTree_${wi}_${hi}`, {
          height,
          diameterBottom: baseRad * 2,
          diameterTop: topRad * 2,
          tessellation: ps1 ? 6 : 8,
        }, scene);
        trunk.position.set(x, groundY + height / 2, z);
        trunk.rotation.set(lean, Math.random() * Math.PI * 2, lean * 0.6);
        trunk.material = trunkMat;
        if (ps1) trunk.convertToFlatShadedMesh();
        this.treeMeshes.push(trunk);
        this.addCasters([trunk]);

        const isConifer = (wi + hi) % 2 === 0;
        const canopyWidth = height * 0.4;
        const seed = wi * 47 + hi * 113;

        // Per-tree/per-blob material clone with a randomized color — a
        // shared material means every canopy piece is the *exact* same
        // shade, which alone makes a forest read as copy-pasted. Green
        // swings further than red/blue since that's the channel that
        // actually reads as "this leaf mass vs that one."
        const jitterColor = (base: Color3): Color3 => new Color3(
          Math.max(0, base.r + (Math.random() - 0.5) * 0.08),
          Math.max(0, base.g + (Math.random() - 0.5) * 0.22),
          Math.max(0, base.b + (Math.random() - 0.5) * 0.06),
        );

        if (isConifer) {
          // The "triangle angle" — base width relative to height — comes
          // from the trunk's own height/width plus a random seed, instead
          // of one fixed ratio for every conifer. Apex is pinned exactly at
          // the tree's top; the base falls wherever coneHeight puts it,
          // generously overlapping the trunk rather than floating above it.
          const angleSeed = Math.random();
          const coneBaseWidth = baseRad * 4 + height * (0.22 + angleSeed * 0.28);
          const coneHeight = height * (0.7 + Math.random() * 0.25);
          const cone = MeshBuilder.CreateCylinder(`testTree_${wi}_${hi}_canopy`, {
            height: coneHeight,
            diameterTop: 0,
            diameterBottom: coneBaseWidth,
            tessellation: ps1 ? 7 : 10,
            subdivisions: 4,
          }, scene);
          displaceRadial(cone, 0.3, seed);
          const apexY = groundY + height;
          cone.position.set(x, apexY - coneHeight / 2, z);
          cone.scaling.set(0.85 + Math.random() * 0.3, 1, 0.85 + Math.random() * 0.3);
          cone.rotation.y = Math.random() * Math.PI * 2;
          const coneMat = coniferMat.clone(`testTreeConiferMat_${wi}_${hi}`);
          coneMat.albedoColor = jitterColor(coniferMat.albedoColor);
          cone.material = coneMat;
          if (ps1) cone.convertToFlatShadedMesh();
          this.treeMeshes.push(cone);
          this.addCasters([cone]);
        } else {
          const dome = MeshBuilder.CreateSphere(`testTree_${wi}_${hi}_canopy`, {
            diameter: canopyWidth, segments: ps1 ? 6 : 10,
          }, scene);
          displaceToBlob(dome, 0.4, 2.2, seed);
          dome.scaling.set(
            0.85 + Math.random() * 0.3,
            0.5 + Math.random() * 0.15,
            0.85 + Math.random() * 0.3,
          );
          // sink into the trunk top instead of resting exactly on it
          dome.position.set(x, groundY + height - canopyWidth * 0.12, z);
          dome.rotation.y = Math.random() * Math.PI * 2;
          const domeMat = deciduousMat.clone(`testTreeDeciduousMat_${wi}_${hi}`);
          domeMat.albedoColor = jitterColor(deciduousMat.albedoColor);
          dome.material = domeMat;
          if (ps1) dome.convertToFlatShadedMesh();
          this.treeMeshes.push(dome);
          this.addCasters([dome]);

          // A handful of extra small blobs clustered around the main dome,
          // offset relative to the trunk's own height/width — breaks the
          // "one perfect sphere" look into a clumpier, more clustered crown.
          const clumpCount = 3 + Math.floor(Math.random() * 3);
          for (let c = 0; c < clumpCount; c++) {
            const ox = (Math.random() - 0.5) * (canopyWidth * 0.6 + baseRad * 2);
            const oz = (Math.random() - 0.5) * (canopyWidth * 0.6 + baseRad * 2);
            const oy = (Math.random() - 0.3) * (height * 0.18);
            const clumpDiam = canopyWidth * (0.4 + Math.random() * 0.35);

            const clump = MeshBuilder.CreateSphere(`testTree_${wi}_${hi}_clump_${c}`, {
              diameter: clumpDiam, segments: ps1 ? 5 : 8,
            }, scene);
            displaceToBlob(clump, 0.45, 2.4, seed + c * 31 + 7);
            clump.scaling.set(
              0.8 + Math.random() * 0.4,
              0.55 + Math.random() * 0.25,
              0.8 + Math.random() * 0.4,
            );
            clump.position.set(x + ox, groundY + height - canopyWidth * 0.12 + oy, z + oz);
            clump.rotation.y = Math.random() * Math.PI * 2;
            const clumpMat = deciduousMat.clone(`testTreeDeciduousMat_${wi}_${hi}_${c}`);
            clumpMat.albedoColor = jitterColor(deciduousMat.albedoColor);
            clump.material = clumpMat;
            if (ps1) clump.convertToFlatShadedMesh();
            this.treeMeshes.push(clump);
            this.addCasters([clump]);
          }
        }

        this._colliders.push({ x, z, radius: baseRad + 0.1 });
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
