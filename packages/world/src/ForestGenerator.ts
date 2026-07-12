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
  VertexData,
  Observer,
} from '@babylonjs/core';

import type { ExperienceProfile } from '@dissonance/shared-types';
import type { WorldPosition } from '@dissonance/shared-types';
import type { Terrain } from './Terrain';
import { RIVER_POINTS } from './Terrain';
import { displaceToBlob, displaceRadial } from './noise';
import { FOREST_PALETTE, buildJitteredColorBuffer, jitterFamily, jitterHsv, hueShift, scaleValue } from './palette';

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

const SURVEY_TRAIL_WIDTH = 1.55;
const SURVEY_TRAIL_WAYPOINTS: [number, number][] = [
  [-18, 12], [-36, 30], [-58, 52], [-82, 66],
  [-108, 70], [-132, 58], [-154, 38],
];

export interface Collider { x: number; z: number; radius: number; }

export type TrailWorldOptions = {
  flavor?: 'pine' | 'rocky' | 'river';
  waypoints?: WorldPosition[];
};

const RIVER_WIDTH = 10.5;
// How far back from the water's edge trees are kept clear. Wider than the
// water itself so the river reads visually from further away instead of
// only being visible once you're standing right on top of it.
const RIVER_CLEAR_WIDTH = 22;
// Width of the thinned approach corridor along the trail's own waypoints
// (the route to the artifact) — a soft bushwhacked-path clearing, not a
// groomed trail, just enough to open sightlines toward the crossing.
const RIVER_APPROACH_WIDTH = 4.5;

export class ForestGenerator {
  private treeMeshes: Mesh[] = [];
  private lights: PointLight[] = [];
  private terrain!: Terrain;
  private _colliders: Collider[] = [];
  private shadowGenerator: ShadowGenerator | undefined;
  private taillightMat: StandardMaterial | null = null;
  private headlightMat: StandardMaterial | null = null;
  private lightFlashActive = false;
  private trailOptions: TrailWorldOptions = {};
  private riverWaterSegments: { mesh: Mesh; baseY: number; phase: number }[] = [];
  private riverFlowObserver: Observer<Scene> | null = null;
  private riverScene: Scene | null = null;

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
    trailOptions: TrailWorldOptions = {},
  ): void {
    this.terrain = terrain;
    this._colliders = [];
    this.shadowGenerator = shadowGenerator;
    this.trailOptions = trailOptions;
    this.buildForest(scene, profile, destinationPos);
    this.buildCarGoal(scene, profile, destinationPos);
    this.buildRocks(scene, profile);
    this.buildRockOutcrops(scene, profile);
    this.buildRockyTrailFeatures(scene, profile);
    this.buildRiverTrailFeatures(scene, profile);
    this.buildUnderbrush(scene, profile);
    this.buildDeadEndTrail(scene, profile);
    this.buildGrass(scene, profile);
    this.buildLowGroundcover(scene, profile);
    this.buildPs3PlantVariety(scene, profile);
    this.buildForestFloor(scene, profile);
    this.buildHikingTrail(scene, profile);
    this.buildSurveyTrail(scene, profile);
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
    return this.nearPolyline(x, z, HIKING_WAYPOINTS, HIKING_TRAIL_WIDTH)
      || this.nearPolyline(x, z, SURVEY_TRAIL_WAYPOINTS, SURVEY_TRAIL_WIDTH);
  }

  private nearPolyline(x: number, z: number, points: [number, number][], width: number): boolean {
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i];
      const [bx, bz] = points[i + 1];
      const ddx = bx - ax, ddz = bz - az;
      const len2 = ddx * ddx + ddz * ddz;
      const t = Math.max(0, Math.min(1, ((x - ax) * ddx + (z - az) * ddz) / len2));
      const px = ax + t * ddx - x;
      const pz = az + t * ddz - z;
      if (px * px + pz * pz < width * width) return true;
    }
    return false;
  }

  private inEitherCorridor(x: number, z: number): boolean {
    return this.inTrailCorridor(x, z)
      || this.inHikingTrailCorridor(x, z)
      || this.inRiverCorridor(x, z)
      || this.inRiverApproachCorridor(x, z);
  }

  private inRiverCorridor(x: number, z: number): boolean {
    return this.trailOptions.flavor === 'river'
      && this.nearPolyline(x, z, RIVER_POINTS, RIVER_CLEAR_WIDTH);
  }

  // Thins trees along the route to the river artifact so the crossing has
  // an open sightline leading into it, rather than only the water's own
  // narrow clearing.
  private inRiverApproachCorridor(x: number, z: number): boolean {
    if (this.trailOptions.flavor !== 'river') return false;
    const pts = this.trailOptions.waypoints;
    if (!pts || pts.length < 2) return false;
    return this.nearPolyline(x, z, pts.map((p): [number, number] => [p.x, p.z]), RIVER_APPROACH_WIDTH);
  }

  private inRockyVistaClearing(x: number, z: number): boolean {
    if (this.trailOptions.flavor !== 'rocky') return false;
    const pts = this.trailOptions.waypoints ?? [];
    const overlook = pts[pts.length - 1];
    if (!overlook) return false;
    const dx = x - overlook.x;
    const dz = z - overlook.z;
    return dx * dx + dz * dz < 34 * 34;
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

  // Overcast look-dev pass (docs/dissonance-forest-color-handoff.md) wants
  // canopy jitter done in HSV space against the named hue family rather
  // than the genesis RGB-space jitterColor above. Falls back to jitterColor
  // whenever overcast is false, so genesis output is byte-for-byte unchanged.
  private jitterCanopy(base: Color3, overcast: boolean): Color3 {
    if (!overcast) return this.jitterColor(base);
    const f = FOREST_PALETTE.canopyWarm;
    return jitterHsv(base, f.hueJitterDeg, f.satJitter, f.valueJitter);
  }

  private makeWindMat(name: string, albedo: Color3, roughness: number, scene: Scene): PBRMaterial {
    const mat = new PBRMaterial(name, scene);
    mat.albedoColor = albedo;
    mat.metallic = 0;
    mat.roughness = roughness;
    return mat;
  }

  // Builds one fully-randomized tree (trunk + conifer tiers or deciduous
  // dome+clumps) at local origin, then merges every part into a single
  // mesh. Called a fixed number of times up front to bake a small library
  // of unique trees — the design itself (widths/heights/tier counts/colors)
  // is exactly what was validated in the test grid, just no longer
  // rebuilt fresh per scattered tree.
  private buildOneTreeTemplate(scene: Scene, profile: ExperienceProfile, id: number): { mesh: Mesh; radius: number } {
    const ps1 = profile.mode === 'ps1';
    const ps2 = profile.mode === 'ps2';
    const ps3 = profile.mode === 'ps3';
    const overcast = ps3 && profile.lookVariant === 'overcast';
    const height = 4 + Math.random() * 18;
    const baseRad = 0.12 + Math.random() * 0.22;
    const topRad = baseRad * 0.75;
    const lean = (Math.random() - 0.5) * 0.12;
    const seed = Math.floor(Math.random() * 100000);
    const parts: Mesh[] = [];

    const trunkMat = new PBRMaterial(`treeTrunkMat_${id}`, scene);
    // Genesis bark stays dark brown-black (jittered in RGB space, as before).
    // Overcast bark leans toward the doc's grey-brown family, HSV-jittered —
    // "nothing crushed to black" per the reference's lifted-shadow read.
    trunkMat.albedoColor = overcast
      ? jitterFamily(FOREST_PALETTE.barkGreyBrown)
      : this.jitterColor(ps3 ? new Color3(0.12, 0.065, 0.028) : new Color3(0.06, 0.03, 0.01));
    trunkMat.metallic = 0;
    trunkMat.roughness = 0.95;

    const trunk = MeshBuilder.CreateCylinder(`tree_${id}_trunk`, {
      height,
      diameterBottom: baseRad * 2,
      diameterTop: topRad * 2,
      tessellation: ps1 ? 6 : ps3 ? 12 : ps2 ? 10 : 8,
    }, scene);
    trunk.position.set(0, height / 2, 0);
    trunk.rotation.set(lean, Math.random() * Math.PI * 2, lean * 0.6);
    trunk.material = trunkMat;
    if (ps1) trunk.convertToFlatShadedMesh();
    parts.push(trunk);

    if (ps3) {
      const barkCount = 4 + Math.floor(Math.random() * 4);
      for (let b = 0; b < barkCount; b++) {
        const a = Math.random() * Math.PI * 2;
        const y = height * (0.18 + Math.random() * 0.62);
        const stripH = height * (0.10 + Math.random() * 0.18);
        const strip = MeshBuilder.CreateBox(`tree_${id}_bark_${b}`, {
          width: 0.025 + Math.random() * 0.018,
          height: stripH,
          depth: 0.018,
        }, scene);
        strip.position.set(Math.cos(a) * baseRad * 1.06, y, Math.sin(a) * baseRad * 1.06);
        strip.rotation.y = -a;
        strip.material = trunkMat;
        strip.bakeCurrentTransformIntoVertices();
        parts.push(strip);
      }

      const branchCount = 2 + Math.floor(Math.random() * 3);
      for (let b = 0; b < branchCount; b++) {
        const a = Math.random() * Math.PI * 2;
        const branch = MeshBuilder.CreateCylinder(`tree_${id}_branch_${b}`, {
          height: 0.55 + Math.random() * 0.65,
          diameterTop: 0.035,
          diameterBottom: 0.06,
          tessellation: 6,
        }, scene);
        branch.position.set(
          Math.cos(a) * (baseRad + 0.20),
          height * (0.42 + Math.random() * 0.30),
          Math.sin(a) * (baseRad + 0.20),
        );
        branch.rotation.set(Math.PI / 2 - 0.18, 0, -a + Math.PI / 2);
        branch.material = trunkMat;
        branch.bakeCurrentTransformIntoVertices();
        parts.push(branch);
      }
    }

    // Per-template shade factor — spreads 30 templates across 0.35-1.0 of
    // the base canopy brightness so adjacent trees have clearly different values.
    // Darkest templates (0.35) read as shadowed/dead; brightest (1.0) as vivid
    // green. The 3:1 ratio stays perceptible even at night's low ambient.
    const shadeFactor = ps3 ? 0.45 + Math.random() * 0.45 : 0.35 + Math.random() * 0.65;
    const isConifer = Math.random() < 0.5;
    const apexY = height;

    if (isConifer) {
      // Genesis ps3 conifer stays its own hand-tuned dark green. Overcast
      // derives from canopyWarm rotated cooler (conifers read bluer than
      // deciduous canopy) — the doc's palette doesn't name a separate
      // conifer family, so this is an extrapolation, not a literal value.
      const baseConiferColor = overcast
        ? scaleValue(hueShift(FOREST_PALETTE.canopyWarm.base, -42), shadeFactor)
        : ps3
        ? new Color3(0.035, 0.36 * shadeFactor, 0.075 * shadeFactor)
        : new Color3(0.06, 0.75 * shadeFactor, 0.16 * shadeFactor);

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
          tessellation: ps1 ? 6 : ps3 ? 13 : ps2 ? 11 : 9,
          subdivisions: 2,
        }, scene);
        displaceRadial(tier, 0.28, seed + t * 53 + 11);
        const ox = (Math.random() - 0.5) * tierBottomDiam * 0.15;
        const oz = (Math.random() - 0.5) * tierBottomDiam * 0.15;
        tier.position.set(ox, cursorY - tierHeight / 2, oz);
        tier.rotation.y = Math.random() * Math.PI * 2;
        tier.material = this.makeWindMat(`treeConiferMat_${id}_${t}`, this.jitterCanopy(baseConiferColor, overcast), 0.7, scene);
        if (ps1) tier.convertToFlatShadedMesh();
        parts.push(tier);

        cursorY -= tierHeight * (1 + gapFrac);
      }
    } else {
      const baseDeciduousColor = overcast
        ? scaleValue(FOREST_PALETTE.canopyWarm.base, shadeFactor)
        : ps3
        ? new Color3(0.055, 0.40 * shadeFactor, 0.085 * shadeFactor)
        : new Color3(0.08, 0.72 * shadeFactor, 0.14 * shadeFactor);

      // Superlinear in height (not just a flat fraction) — taller trees
      // get a disproportionately bigger canopy, not just a scaled-up copy
      // of a small tree's canopy.
      const canopyWidth = Math.pow(height, 1.12) * 0.38;

      const dome = MeshBuilder.CreateSphere(`tree_${id}_canopy`, {
        diameter: canopyWidth, segments: ps1 ? 6 : ps3 ? 14 : ps2 ? 12 : 10,
      }, scene);
      displaceToBlob(dome, 0.4, 2.2, seed);
      dome.scaling.set(
        0.85 + Math.random() * 0.3,
        0.5 + Math.random() * 0.15,
        0.85 + Math.random() * 0.3,
      );
      dome.position.set(0, height - canopyWidth * 0.12, 0);
      dome.rotation.y = Math.random() * Math.PI * 2;
      dome.material = this.makeWindMat(`treeDeciduousMat_${id}_dome`, this.jitterCanopy(baseDeciduousColor, overcast), 0.6, scene);
      if (ps1) dome.convertToFlatShadedMesh();
      parts.push(dome);

      const clumpCount = ps3 ? 7 + Math.floor(Math.random() * 5) : ps2 ? 5 + Math.floor(Math.random() * 4) : 3 + Math.floor(Math.random() * 3);
      for (let c = 0; c < clumpCount; c++) {
        const ox = (Math.random() - 0.5) * (canopyWidth * 0.6 + baseRad * 2);
        const oz = (Math.random() - 0.5) * (canopyWidth * 0.6 + baseRad * 2);
        const oy = (Math.random() - 0.3) * (height * 0.18);
        const clumpDiam = canopyWidth * (0.4 + Math.random() * 0.35);

        const clump = MeshBuilder.CreateSphere(`tree_${id}_clump_${c}`, {
          diameter: clumpDiam, segments: ps1 ? 5 : ps3 ? 12 : ps2 ? 10 : 8,
        }, scene);
        displaceToBlob(clump, 0.45, 2.4, seed + c * 31 + 7);
        clump.scaling.set(
          0.8 + Math.random() * 0.4,
          0.55 + Math.random() * 0.25,
          0.8 + Math.random() * 0.4,
        );
        clump.position.set(ox, height - canopyWidth * 0.12 + oy, oz);
        clump.rotation.y = Math.random() * Math.PI * 2;
        clump.material = this.makeWindMat(`treeDeciduousMat_${id}_${c}`, this.jitterCanopy(baseDeciduousColor, overcast), 0.6, scene);
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
    const templates = this.buildTreeTemplates(scene, profile, profile.mode === 'ps3' ? 52 : profile.mode === 'ps2' ? 40 : 30);
    const matricesByTemplate: Matrix[][] = templates.map(() => []);
    const maxRadius = profile.drawDistance * 1.15;
    const rocky = this.trailOptions.flavor === 'rocky';
    const river = this.trailOptions.flavor === 'river';
    const treeTarget = rocky
      ? Math.round(profile.treeCount * 0.68)
      : river
      ? Math.round(profile.treeCount * 0.86)
      : profile.treeCount;

    let placed = 0;
    let attempts = 0;
    const maxAttempts = treeTarget * 8;

    while (placed < treeTarget && attempts < maxAttempts) {
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
    const outerCountBase = profile.mode === 'ps3' ? 420 : profile.mode === 'ps2' ? 280 : 200;
    const outerCount = rocky
      ? Math.round(outerCountBase * 0.72)
      : river
      ? Math.round(outerCountBase * 0.9)
      : outerCountBase;
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
    const lotRingCountBase = profile.mode === 'ps3' ? 88 : profile.mode === 'ps2' ? 68 : 48;
    const lotRingCount = rocky ? Math.round(lotRingCountBase * 0.78) : lotRingCountBase;
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

    this.buildTrailWalls(profile, templates, matricesByTemplate);

    templates.forEach((t, i) => {
      t.mesh.thinInstanceAdd(matricesByTemplate[i], true);
      this.addCasters([t.mesh]);
    });
  }

  private buildTrailWalls(
    profile: ExperienceProfile,
    templates: { mesh: Mesh; radius: number }[],
    matricesByTemplate: Matrix[][],
  ): void {
    const wallTreeCountBase = profile.mode === 'ps3' ? 56 : profile.mode === 'ps2' ? 40 : 28;
    const wallTreeCount = this.trailOptions.flavor === 'rocky'
      ? Math.round(wallTreeCountBase * 0.55)
      : wallTreeCountBase;
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
    const ps1 = profile.mode === 'ps1';
    const ps2 = profile.mode === 'ps2';
    const ps3 = profile.mode === 'ps3';
    const overcast = ps3 && profile.lookVariant === 'overcast';

    const mat = new StandardMaterial('underbrushMat', scene);
    if (overcast) {
      // White — per-instance jitter below (understoryMid family) is the
      // sole colorant so genesis's flat shared color doesn't also tint it.
      mat.diffuseColor = Color3.White();
    } else if (profile.mode === 'radio') {
      mat.diffuseColor = new Color3(0.05, 0.06, 0.06);
    } else if (profile.mode === 'ps3') {
      mat.diffuseColor = new Color3(0.09, 0.20, 0.075);
    } else if (profile.mode === 'ps2') {
      mat.diffuseColor = new Color3(0.08, 0.18, 0.06);
    } else {
      mat.diffuseColor = new Color3(0.06, 0.14, 0.05);
    }
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;

    const template = ps1
      ? MeshBuilder.CreateCylinder('shrubBase', { height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 4 }, scene)
      : ps3
        ? MeshBuilder.CreateSphere('shrubBase', { diameter: 1, segments: 7 }, scene)
        : ps2
        ? MeshBuilder.CreateSphere('shrubBase', { diameter: 1, segments: 5 }, scene)
        : MeshBuilder.CreateSphere('shrubBase', { diameter: 1, segments: 3 }, scene);
    template.material = mat;
    this.treeMeshes.push(template);

    const count = ps1 ? 220 : ps3 ? 480 : ps2 ? 320 : 160;
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
    if (overcast) {
      template.thinInstanceSetBuffer('color', buildJitteredColorBuffer(matrices.length, FOREST_PALETTE.understoryMid), 4);
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

    const trimMat = new StandardMaterial('carTrimMat', scene);
    trimMat.diffuseColor = new Color3(0.025, 0.025, 0.028);
    trimMat.specularColor = Color3.Black();

    const plateMat = new StandardMaterial('carPlateMat', scene);
    plateMat.diffuseColor = new Color3(0.68, 0.64, 0.48);
    plateMat.specularColor = Color3.Black();

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
    // Raw dimensions (x cs = actual world size).
    const bW = 1.82, bH = 0.64, bD = 4.55; // low sedan body
    const bodyBottom = groundY + 0.18 * cs;
    const bodyTopY = bodyBottom + bH * cs;

    const addMesh = (m: Mesh) => {
      if (ps1) m.convertToFlatShadedMesh();
      this.treeMeshes.push(m);
    };

    const makeTaperedPrism = (
      name: string,
      bottomWidth: number,
      topWidth: number,
      bottomDepth: number,
      topDepth: number,
      height: number,
      topZOffset: number,
    ): Mesh => {
      const mesh = new Mesh(name, scene);
      const bw = bottomWidth * cs / 2;
      const tw = topWidth * cs / 2;
      const bd = bottomDepth * cs / 2;
      const td = topDepth * cs / 2;
      const h = height * cs;
      const z = topZOffset * cs;
      const positions = [
        -bw, 0, -bd,  bw, 0, -bd,  bw, 0, bd,  -bw, 0, bd,
        -tw, h, z - td,  tw, h, z - td,  tw, h, z + td,  -tw, h, z + td,
      ];
      const indices = [
        0, 2, 1, 0, 3, 2,
        4, 5, 6, 4, 6, 7,
        3, 7, 6, 3, 6, 2,
        0, 1, 5, 0, 5, 4,
        1, 2, 6, 1, 6, 5,
        0, 4, 7, 0, 7, 3,
      ];
      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      const vertexData = new VertexData();
      vertexData.positions = positions;
      vertexData.indices = indices;
      vertexData.normals = normals;
      vertexData.applyToMesh(mesh);
      return mesh;
    };

    // Lower body (door sills, side panels)
    const body = makeTaperedPrism('carBody', bW, bW * 0.88, bD, bD * 0.94, bH, 0);
    body.position.set(pos.x, bodyBottom, pos.z);
    body.material = bodyMat;
    addMesh(body);

    const nose = MeshBuilder.CreateBox('carNoseWedge', { width: 1.42 * cs, height: 0.22 * cs, depth: 0.62 * cs }, scene);
    nose.position.set(pos.x, bodyBottom + 0.34 * cs, pos.z + (bD / 2 - 0.18) * cs);
    nose.rotation.x = -0.06;
    nose.material = bodyMat;
    addMesh(nose);

    // Hood — thin slab on top of front third of body
    const hoodD = 1.48;
    const hood = MeshBuilder.CreateBox('carHood', { width: (bW - 0.26) * cs, height: 0.075 * cs, depth: hoodD * cs }, scene);
    hood.position.set(pos.x, bodyTopY + 0.025 * cs, pos.z + (bD / 2 - hoodD / 2 - 0.08) * cs);
    hood.rotation.x = -0.045;
    hood.material = panelMat;
    addMesh(hood);

    // Trunk lid — shorter slab on top of rear section
    const trunkD = 1.1;
    const trunk = MeshBuilder.CreateBox('carTrunk', { width: (bW - 0.24) * cs, height: 0.075 * cs, depth: trunkD * cs }, scene);
    trunk.position.set(pos.x, bodyTopY + 0.015 * cs, pos.z - (bD / 2 - trunkD / 2 - 0.10) * cs);
    trunk.rotation.x = 0.035;
    trunk.material = panelMat;
    addMesh(trunk);

    // Cabin / greenhouse (windows + roof)
    const cW = 1.48, cH = 0.62, cD = 2.24;
    const cabin = makeTaperedPrism('carCabin', cW, 1.18, cD, 1.24, cH, -0.06);
    cabin.position.set(pos.x, bodyTopY + 0.02 * cs, pos.z - 0.20 * cs);
    cabin.material = glassMat;
    addMesh(cabin);

    // Roof cap and window breaks make the greenhouse read as glass panels
    // instead of one dark block.
    const roof = MeshBuilder.CreateBox('carRoof', { width: 1.12 * cs, height: 0.065 * cs, depth: 1.16 * cs }, scene);
    roof.position.set(pos.x, bodyTopY + cH * cs + 0.055 * cs, pos.z - 0.25 * cs);
    roof.material = bodyMat;
    addMesh(roof);

    const windshield = MeshBuilder.CreateBox('carWindshield', { width: 1.22 * cs, height: 0.38 * cs, depth: 0.045 * cs }, scene);
    windshield.position.set(pos.x, bodyTopY + 0.38 * cs, pos.z + 0.70 * cs);
    windshield.rotation.x = -0.42;
    windshield.material = glassMat;
    addMesh(windshield);

    const rearWindow = MeshBuilder.CreateBox('carRearWindow', { width: 1.12 * cs, height: 0.34 * cs, depth: 0.045 * cs }, scene);
    rearWindow.position.set(pos.x, bodyTopY + 0.36 * cs, pos.z - 1.22 * cs);
    rearWindow.rotation.x = 0.36;
    rearWindow.material = glassMat;
    addMesh(rearWindow);

    for (const sx of [-1, 1]) {
      const sideWindow = MeshBuilder.CreateBox('carSideWindow', {
        width: 0.045 * cs, height: 0.31 * cs, depth: 0.72 * cs,
      }, scene);
      sideWindow.position.set(pos.x + sx * (cW / 2 + 0.025) * cs, bodyTopY + 0.38 * cs, pos.z - 0.10 * cs);
      sideWindow.material = glassMat;
      addMesh(sideWindow);
    }

    for (const sx of [-1, 1]) {
      const beltline = MeshBuilder.CreateBox('carBeltline', { width: 0.035 * cs, height: 0.055 * cs, depth: 2.95 * cs }, scene);
      beltline.position.set(pos.x + sx * (bW / 2 + 0.018) * cs, bodyBottom + 0.66 * cs, pos.z - 0.12 * cs);
      beltline.material = trimMat;
      addMesh(beltline);

      const rocker = MeshBuilder.CreateBox('carRockerPanel', { width: 0.055 * cs, height: 0.13 * cs, depth: 3.28 * cs }, scene);
      rocker.position.set(pos.x + sx * (bW / 2 + 0.018) * cs, bodyBottom + 0.17 * cs, pos.z - 0.04 * cs);
      rocker.material = bumperMat;
      addMesh(rocker);
    }

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

    const grille = MeshBuilder.CreateBox('carGrille', { width: 0.58 * cs, height: 0.20 * cs, depth: 0.06 * cs }, scene);
    grille.position.set(pos.x, bodyBottom + 0.42 * cs, pos.z + (bD / 2 + 0.02) * cs);
    grille.material = trimMat;
    addMesh(grille);

    const frontPlate = MeshBuilder.CreateBox('carFrontPlate', { width: 0.46 * cs, height: 0.14 * cs, depth: 0.04 * cs }, scene);
    frontPlate.position.set(pos.x, bodyBottom + 0.20 * cs, pos.z + (bD / 2 + 0.12) * cs);
    frontPlate.material = plateMat;
    addMesh(frontPlate);

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

    const rearPlate = MeshBuilder.CreateBox('carRearPlate', { width: 0.48 * cs, height: 0.15 * cs, depth: 0.04 * cs }, scene);
    rearPlate.position.set(pos.x, bodyBottom + 0.34 * cs, pos.z - (bD / 2 + 0.12) * cs);
    rearPlate.material = plateMat;
    addMesh(rearPlate);

    const seamSpecs: [number, number, number, number][] = [
      [-0.02, -0.52, 0.024, 0.72],
      [-0.02, 0.48, 0.024, 0.58],
    ];
    for (const sx of [-1, 1]) {
      for (const [, zOff, width, height] of seamSpecs) {
        const seam = MeshBuilder.CreateBox('carDoorSeam', { width: width * cs, height: height * cs, depth: 0.025 * cs }, scene);
        seam.position.set(pos.x + sx * (bW / 2 + 0.01) * cs, bodyBottom + 0.48 * cs, pos.z + zOff * cs);
        seam.rotation.y = Math.PI / 2;
        seam.material = trimMat;
        addMesh(seam);
      }

      const handle = MeshBuilder.CreateBox('carDoorHandle', { width: 0.025 * cs, height: 0.055 * cs, depth: 0.22 * cs }, scene);
      handle.position.set(pos.x + sx * (bW / 2 + 0.035) * cs, bodyBottom + 0.62 * cs, pos.z + 0.28 * cs);
      handle.rotation.y = Math.PI / 2;
      handle.material = trimMat;
      addMesh(handle);
    }

    // Wheels + rims (4 corners)
    const wR = 0.36, wXOff = (bW / 2 + 0.05) * cs, wZOff = 1.28 * cs;
    const wheelAxes: [number, number][] = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
    for (const [sx, sz] of wheelAxes) {
      const arch = MeshBuilder.CreateBox('carWheelArch', {
        width: 0.08 * cs, height: 0.38 * cs, depth: 0.88 * cs,
      }, scene);
      arch.position.set(pos.x + sx * (bW / 2 + 0.035) * cs, groundY + 0.58 * cs, pos.z + sz * wZOff);
      arch.material = trimMat;
      addMesh(arch);

      const tire = MeshBuilder.CreateCylinder('carWheel', {
        height: 0.30 * cs, diameter: wR * 2 * cs, tessellation: ps1 ? 8 : profile.mode === 'ps3' ? 18 : 14,
      }, scene);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(pos.x + sx * wXOff, groundY + wR * cs, pos.z + sz * wZOff);
      tire.material = wheelMat;
      addMesh(tire);

      const rim = MeshBuilder.CreateCylinder('carRim', {
        height: 0.32 * cs, diameter: wR * 1.26 * cs, tessellation: ps1 ? 6 : profile.mode === 'ps3' ? 14 : 10,
      }, scene);
      rim.rotation.z = Math.PI / 2;
      rim.position.copyFrom(tire.position);
      rim.material = rimMat;
      addMesh(rim);

      const hub = MeshBuilder.CreateCylinder('carHub', {
        height: 0.34 * cs, diameter: wR * 0.42 * cs, tessellation: ps1 ? 6 : profile.mode === 'ps3' ? 14 : 10,
      }, scene);
      hub.rotation.z = Math.PI / 2;
      hub.position.copyFrom(tire.position);
      hub.material = trimMat;
      addMesh(hub);
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
        height: poleHeight, diameter: 0.13, tessellation: ps1 ? 6 : profile.mode === 'ps3' ? 10 : 8,
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
      light.intensity = profile.mode === 'ps3' ? 1.65 : profile.mode === 'ps2' ? 1.45 : 1.0;
      light.range = profile.mode === 'ps3' ? 34 : profile.mode === 'ps2' ? 28 : 22;
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

    const count = profile.mode === 'ps1' ? 80 : profile.mode === 'ps3' ? 125 : 55;
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

    const outcropCount = profile.mode === 'ps1' ? 14 : profile.mode === 'ps3' ? 22 : 9;
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
  private buildRockyTrailFeatures(scene: Scene, profile: ExperienceProfile): void {
    if (this.trailOptions.flavor !== 'rocky') return;
    const pts = this.trailOptions.waypoints ?? [];
    if (pts.length === 0) return;

    const screeMat = new PBRMaterial('ridgeScreeMat', scene);
    screeMat.albedoColor = profile.mode === 'radio'
      ? new Color3(0.12, 0.12, 0.13)
      : new Color3(0.30, 0.28, 0.24);
    screeMat.metallic = 0;
    screeMat.roughness = 0.95;

    const scree = MeshBuilder.CreateBox('ridgeScreeTemplate', { size: 1 }, scene);
    scree.material = screeMat;
    if (profile.mode === 'ps1') scree.convertToFlatShadedMesh();
    this.treeMeshes.push(scree);

    const screeMatrices: Matrix[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const count = profile.mode === 'ps3' ? 34 : profile.mode === 'ps2' ? 26 : 18;

      for (let s = 0; s < count; s++) {
        const t = (s + Math.random()) / count;
        const side = Math.random() < 0.5 ? -1 : 1;
        const shoulder = 2.0 + Math.random() * 4.8;
        const x = a.x + dx * t + nx * shoulder * side + (Math.random() - 0.5) * 1.2;
        const z = a.z + dz * t + nz * shoulder * side + (Math.random() - 0.5) * 1.2;
        const groundY = this.terrain.getHeightAt(x, z);
        const size = 0.22 + Math.random() * 0.72;
        screeMatrices.push(Matrix.Compose(
          new Vector3(size * (1.0 + Math.random()), size * (0.25 + Math.random() * 0.45), size * (0.8 + Math.random())),
          Quaternion.FromEulerAngles(Math.random() * 0.4, Math.random() * Math.PI * 2, Math.random() * 0.4),
          new Vector3(x, groundY + size * 0.16, z),
        ));
      }
    }
    scree.thinInstanceAdd(screeMatrices, true);
    this.addCasters([scree]);

    if (profile.mode === 'ps3') {
      const shaleMat = new PBRMaterial('ridgeShaleChipMat', scene);
      shaleMat.albedoColor = new Color3(0.18, 0.17, 0.15);
      shaleMat.metallic = 0;
      shaleMat.roughness = 0.96;
      const shale = MeshBuilder.CreateBox('ridgeShaleChipTemplate', { size: 1 }, scene);
      shale.material = shaleMat;
      this.treeMeshes.push(shale);

      const rootMat = new PBRMaterial('ridgeRootMat', scene);
      rootMat.albedoColor = new Color3(0.13, 0.075, 0.035);
      rootMat.metallic = 0;
      rootMat.roughness = 0.9;
      const root = MeshBuilder.CreateCylinder('ridgeRootTemplate', {
        height: 1,
        diameterTop: 0.045,
        diameterBottom: 0.07,
        tessellation: 6,
      }, scene);
      root.material = rootMat;
      this.treeMeshes.push(root);

      const shaleMatrices: Matrix[] = [];
      const rootMatrices: Matrix[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;

        for (let s = 0; s < 42; s++) {
          const t = Math.random();
          const side = Math.random() < 0.5 ? -1 : 1;
          const shoulder = 0.9 + Math.random() * 5.6;
          const x = a.x + dx * t + nx * shoulder * side + (Math.random() - 0.5) * 1.4;
          const z = a.z + dz * t + nz * shoulder * side + (Math.random() - 0.5) * 1.4;
          const groundY = this.terrain.getHeightAt(x, z);
          const size = 0.14 + Math.random() * 0.32;
          shaleMatrices.push(Matrix.Compose(
            new Vector3(size * (1.4 + Math.random() * 1.6), 0.018 + Math.random() * 0.025, size * (0.7 + Math.random())),
            Quaternion.FromEulerAngles((Math.random() - 0.5) * 0.12, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.12),
            new Vector3(x, groundY + 0.018, z),
          ));
        }

        for (let r = 0; r < 8; r++) {
          const t = Math.random();
          const side = Math.random() < 0.5 ? -1 : 1;
          const shoulder = 1.6 + Math.random() * 4.4;
          const x = a.x + dx * t + nx * shoulder * side;
          const z = a.z + dz * t + nz * shoulder * side;
          const groundY = this.terrain.getHeightAt(x, z);
          rootMatrices.push(Matrix.Compose(
            new Vector3(1, 0.65 + Math.random() * 1.0, 1),
            Quaternion.FromEulerAngles(Math.PI / 2 + (Math.random() - 0.5) * 0.16, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.22),
            new Vector3(x, groundY + 0.055, z),
          ));
        }
      }
      shale.thinInstanceAdd(shaleMatrices, true);
      root.thinInstanceAdd(rootMatrices, true);
      this.addCasters([root]);
    }

    const cairnMat = new PBRMaterial('ridgeCairnMat', scene);
    cairnMat.albedoColor = new Color3(0.36, 0.34, 0.30);
    cairnMat.metallic = 0;
    cairnMat.roughness = 0.92;

    pts.slice(1).forEach((p, i) => {
      const prev = pts[i];
      const next = pts[Math.min(pts.length - 1, i + 2)];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const side = i % 2 === 0 ? 1 : -1;
      const cairnX = p.x + (-dz / len) * 2.45 * side;
      const cairnZ = p.z + (dx / len) * 2.45 * side;
      const groundY = this.terrain.getHeightAt(cairnX, cairnZ);
      const levels = i === pts.length - 2 ? 5 : 3 + Math.floor(Math.random() * 2);
      for (let l = 0; l < levels; l++) {
        const w = (0.86 - l * 0.11) * (0.82 + Math.random() * 0.22);
        const h = 0.16 + Math.random() * 0.08;
        const d = (0.62 - l * 0.07) * (0.82 + Math.random() * 0.20);
        const stone = MeshBuilder.CreateBox(`ridgeCairn_${i}_${l}`, {
          width: w,
          height: h,
          depth: d,
        }, scene);
        stone.position.set(
          cairnX + (Math.random() - 0.5) * 0.14,
          groundY + 0.08 + l * 0.14,
          cairnZ + (Math.random() - 0.5) * 0.14,
        );
        stone.rotation.set(
          (Math.random() - 0.5) * 0.18,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.18,
        );
        stone.material = cairnMat;
        if (profile.mode === 'ps1') stone.convertToFlatShadedMesh();
        this.treeMeshes.push(stone);
        this.addCasters([stone]);
      }
      this._colliders.push({ x: cairnX, z: cairnZ, radius: 0.55 });
    });
  }

  private buildRiverTrailFeatures(scene: Scene, profile: ExperienceProfile): void {
    if (this.trailOptions.flavor !== 'river') return;

    const waterMat = new StandardMaterial('blackwaterMat', scene);
    // Deliberately cool and saturated blue — every other surface in this
    // scene (ground, bark, fog, the ps3 golden-hour sky) sits in warm
    // tan/green territory, so a near-black warm teal was blending straight
    // into the terrain instead of reading as water. Blue is the one hue
    // nothing else here uses.
    waterMat.diffuseColor = profile.mode === 'radio'
      ? new Color3(0.015, 0.02, 0.035)
      : new Color3(0.03, 0.06, 0.16);
    waterMat.emissiveColor = profile.mode === 'radio'
      ? Color3.Black()
      : profile.mode === 'ps3'
      ? new Color3(0.020, 0.048, 0.11)
      : new Color3(0.012, 0.030, 0.075);
    waterMat.specularColor = new Color3(0.35, 0.45, 0.6);
    waterMat.specularPower = 32;
    // Fully opaque — alpha < 1 was letting the pale terrain directly beneath
    // the water box show through and wash the color out. The bank/stone
    // ring around it already reads as "edge," so the water itself doesn't
    // need transparency to look wet.
    waterMat.alpha = 1.0;

    const bankMat = new PBRMaterial('blackwaterBankRockMat', scene);
    bankMat.albedoColor = new Color3(0.13, 0.12, 0.10);
    bankMat.metallic = 0;
    bankMat.roughness = 0.94;

    // The one deliberate crossing point — a gap in the bank colliders below
    // lines up with this so the rock ford is the only place the river can
    // actually be crossed.
    const crossing = { x: -24, z: 62 };
    const BANK_COLLIDER_RADIUS = 3.0;
    const BANK_OFFSET = RIVER_WIDTH * 0.5 - 0.3;
    // The ford stones themselves span up to ~6.2 units either side of the
    // centerline (see the crossing-stone loop below), and the guided
    // approach path actually reaches the river ~5 units off from this
    // constant — a 5-unit gap radius left colliders clipping the ford on
    // both counts. Wide enough to clear both with margin.
    const CROSSING_GAP_RADIUS = 14;

    // One flat box per RIVER_POINTS segment (each up to ~125 units long) let
    // the terrain's carved-channel noise — only damped 58%, not flattened —
    // rise well above the box's flat elevation partway along its length,
    // poking through and breaking the water into disconnected patches.
    // Sampling every ~6 units and hugging local terrain height per short
    // sub-segment keeps the water surface within the noise's short-range
    // variation instead of averaging over the whole span.
    const WATER_STEP = 6;
    const samples: { x: number; z: number }[] = [];
    for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
      const [ax, az] = RIVER_POINTS[i];
      const [bx, bz] = RIVER_POINTS[i + 1];
      const segLen = Math.sqrt((bx - ax) ** 2 + (bz - az) ** 2);
      const stepsInSeg = Math.max(1, Math.round(segLen / WATER_STEP));
      for (let s = 0; s < stepsInSeg; s++) {
        const t = s / stepsInSeg;
        samples.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t });
      }
    }
    const [lastX, lastZ] = RIVER_POINTS[RIVER_POINTS.length - 1];
    samples.push({ x: lastX, z: lastZ });

    // Sampling per-box from only its own two endpoints meant neighbouring
    // boxes each picked elevation independently and disagreed at the shared
    // joint, showing up as a visible stair-step (bare ground peeking through
    // at every seam) instead of one continuous surface. Precomputing a
    // windowed-max height per sample first means adjacent boxes agree on
    // the shared point's height, and a thicker box absorbs whatever small
    // mismatch remains as an underwater ledge instead of exposed ground.
    const rawHeights = samples.map(p => this.terrain.getHeightAt(p.x, p.z));
    const surfaceHeights = rawHeights.map((_, i) => {
      const lo = Math.max(0, i - 1);
      const hi = Math.min(rawHeights.length - 1, i + 1);
      let m = rawHeights[i];
      for (let k = lo; k <= hi; k++) m = Math.max(m, rawHeights[k]);
      return m;
    });

    const WATER_CLEARANCE = 0.16;
    const WATER_THICKNESS = 0.6;

    let arcLen = 0;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const mx = (a.x + b.x) * 0.5;
      const mz = (a.z + b.z) * 0.5;
      const yTop = Math.max(surfaceHeights[i], surfaceHeights[i + 1]) + WATER_CLEARANCE;
      const y = yTop - WATER_THICKNESS * 0.5;

      const water = MeshBuilder.CreateBox(`blackwaterSegment_${i}`, {
        width: RIVER_WIDTH,
        height: WATER_THICKNESS,
        depth: len + 0.8,
      }, scene);
      water.position.set(mx, y, mz);
      water.rotation.y = Math.atan2(dx, dz);
      water.material = waterMat;
      water.isPickable = false;
      this.treeMeshes.push(water);
      this.riverWaterSegments.push({ mesh: water, baseY: y, phase: arcLen + len * 0.5 });
      arcLen += len;

      // Bank colliders block entry into the water everywhere except a gap
      // around the rock-ford crossing, so the river reads as an obstacle
      // you have to route around rather than open ground you can wade
      // straight through.
      if (Math.sqrt((mx - crossing.x) ** 2 + (mz - crossing.z) ** 2) > CROSSING_GAP_RADIUS) {
        this._colliders.push({ x: mx + nx * BANK_OFFSET, z: mz + nz * BANK_OFFSET, radius: BANK_COLLIDER_RADIUS });
        this._colliders.push({ x: mx - nx * BANK_OFFSET, z: mz - nz * BANK_OFFSET, radius: BANK_COLLIDER_RADIUS });
      }
    }

    const stone = MeshBuilder.CreateBox('blackwaterStoneTemplate', { size: 1 }, scene);
    stone.material = bankMat;
    if (profile.mode === 'ps1') stone.convertToFlatShadedMesh();
    this.treeMeshes.push(stone);

    const stoneMatrices: Matrix[] = [];
    for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
      const [ax, az] = RIVER_POINTS[i];
      const [bx, bz] = RIVER_POINTS[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const count = profile.mode === 'ps3' ? 22 : 14;
      for (let r = 0; r < count; r++) {
        const t = Math.random();
        const side = Math.random() < 0.5 ? -1 : 1;
        const bankOffset = RIVER_WIDTH * (0.58 + Math.random() * 0.42) * side;
        const x = ax + dx * t + nx * bankOffset + (Math.random() - 0.5) * 1.4;
        const z = az + dz * t + nz * bankOffset + (Math.random() - 0.5) * 1.4;
        const s = 0.35 + Math.random() * 0.9;
        stoneMatrices.push(Matrix.Compose(
          new Vector3(s * (1.2 + Math.random()), s * (0.22 + Math.random() * 0.28), s * (0.8 + Math.random())),
          Quaternion.FromEulerAngles(Math.random() * 0.24, Math.random() * Math.PI * 2, Math.random() * 0.18),
          new Vector3(x, this.terrain.getHeightAt(x, z) + s * 0.12, z),
        ));
      }

      // Streambed rocks scattered within the water itself (not just the
      // banks) so the river has some texture/character instead of reading
      // as a flat blue slab — poking up just above the surface like rocks
      // breaking a real creek.
      const bedCount = profile.mode === 'ps3' ? 16 : 9;
      for (let r = 0; r < bedCount; r++) {
        const t = Math.random();
        const bedOffset = (Math.random() - 0.5) * RIVER_WIDTH * 0.7;
        const x = ax + dx * t + nx * bedOffset;
        const z = az + dz * t + nz * bedOffset;
        const s = 0.28 + Math.random() * 0.5;
        stoneMatrices.push(Matrix.Compose(
          new Vector3(s * (0.9 + Math.random() * 0.6), s * (0.5 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.5)),
          Quaternion.FromEulerAngles(Math.random() * 0.3, Math.random() * Math.PI * 2, Math.random() * 0.3),
          new Vector3(x, this.terrain.getHeightAt(x, z) + WATER_CLEARANCE + s * 0.22, z),
        ));
      }
    }

    const [ca, cb] = [RIVER_POINTS[2], RIVER_POINTS[3]];
    const cdx = cb[0] - ca[0];
    const cdz = cb[1] - ca[1];
    const clen = Math.sqrt(cdx * cdx + cdz * cdz) || 1;
    const cnx = -cdz / clen;
    const cnz = cdx / clen;
    for (let s = -4; s <= 4; s++) {
      const x = crossing.x + cnx * s * 1.55 + (Math.random() - 0.5) * 0.18;
      const z = crossing.z + cnz * s * 1.55 + (Math.random() - 0.5) * 0.18;
      stoneMatrices.push(Matrix.Compose(
        new Vector3(1.55 + Math.random() * 0.42, 0.22 + Math.random() * 0.12, 1.08 + Math.random() * 0.34),
        Quaternion.FromEulerAngles((Math.random() - 0.5) * 0.12, Math.atan2(cnx, cnz) + (Math.random() - 0.5) * 0.24, (Math.random() - 0.5) * 0.12),
        new Vector3(x, this.terrain.getHeightAt(x, z) + 0.18, z),
      ));
    }
    stone.thinInstanceAdd(stoneMatrices, true);
    this.addCasters([stone]);

    // Gives the river visible motion without any texture/shader asset: each
    // short water segment bobs on a sine wave keyed by its own arc-length
    // position, so the crests travel steadily downstream rather than the
    // whole surface pulsing in place.
    this.riverScene = scene;
    const RIPPLE_AMPLITUDE = 0.05;
    const RIPPLE_SPEED = 1.6;
    const RIPPLE_WAVELENGTH_K = 0.28;
    this.riverFlowObserver = scene.onBeforeRenderObservable.add(() => {
      const t = performance.now() / 1000;
      for (const seg of this.riverWaterSegments) {
        seg.mesh.position.y = seg.baseY + Math.sin(seg.phase * RIPPLE_WAVELENGTH_K - t * RIPPLE_SPEED) * RIPPLE_AMPLITUDE;
      }
    });

    if (profile.mode !== 'ps3') return;

    const reedMat = new StandardMaterial('blackwaterReedMat', scene);
    reedMat.diffuseColor = new Color3(0.16, 0.20, 0.075);
    reedMat.specularColor = Color3.Black();
    const reed = MeshBuilder.CreateCylinder('blackwaterReedTemplate', {
      height: 1,
      diameterTop: 0.022,
      diameterBottom: 0.045,
      tessellation: 5,
    }, scene);
    reed.material = reedMat;
    this.treeMeshes.push(reed);

    const reedMatrices: Matrix[] = [];
    for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
      const [ax, az] = RIVER_POINTS[i];
      const [bx, bz] = RIVER_POINTS[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      for (let r = 0; r < 34; r++) {
        const t = Math.random();
        const side = Math.random() < 0.5 ? -1 : 1;
        const bankOffset = RIVER_WIDTH * (0.50 + Math.random() * 0.35) * side;
        const x = ax + dx * t + nx * bankOffset + (Math.random() - 0.5) * 1.8;
        const z = az + dz * t + nz * bankOffset + (Math.random() - 0.5) * 1.8;
        const h = 0.65 + Math.random() * 1.05;
        reedMatrices.push(Matrix.Compose(
          new Vector3(1, h, 1),
          Quaternion.FromEulerAngles((Math.random() - 0.5) * 0.35, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.35),
          new Vector3(x, this.terrain.getHeightAt(x, z) + h * 0.5, z),
        ));
      }
    }
    reed.thinInstanceAdd(reedMatrices, true);
  }

  private buildGrass(scene: Scene, profile: ExperienceProfile): void {
    const grassPalette = profile.mode === 'ps3'
      ? [
          [0.11, 0.25, 0.08], [0.07, 0.18, 0.06],
          [0.045, 0.12, 0.045], [0.15, 0.22, 0.065],
          [0.08, 0.14, 0.055],
        ]
      : profile.mode === 'ps2'
      ? [
          [0.10, 0.22, 0.07], [0.06, 0.15, 0.05],
          [0.04, 0.10, 0.04], [0.13, 0.18, 0.05],
        ]
      : profile.mode === 'ps1'
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

    const perBaseRaw = profile.mode === 'ps1' ? 1100 : profile.mode === 'ps3' ? 1700 : profile.mode === 'ps2' ? 1250 : 640;
    const perBase = this.trailOptions.flavor === 'rocky' ? Math.round(perBaseRaw * 0.56) : perBaseRaw;
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
    const ps2 = profile.mode === 'ps2';
    const ps3 = profile.mode === 'ps3';
    const palette = ps3
      ? [[0.20, 0.34, 0.12], [0.13, 0.25, 0.09], [0.09, 0.18, 0.07], [0.24, 0.28, 0.10]]
      : ps2
      ? [[0.18, 0.30, 0.10], [0.12, 0.22, 0.08], [0.08, 0.16, 0.06], [0.20, 0.24, 0.08]]
      : ps1
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

    const clumpCountRaw = ps1 ? 950 : ps3 ? 1800 : ps2 ? 1250 : 650;
    const clumpCount = this.trailOptions.flavor === 'rocky' ? Math.round(clumpCountRaw * 0.55) : clumpCountRaw;
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
      const bladesInClump = (ps3 ? 24 : ps2 ? 18 : 14) + Math.floor(Math.random() * (ps3 ? 18 : ps2 ? 14 : 10));
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

  private buildPs3PlantVariety(scene: Scene, profile: ExperienceProfile): void {
    if (profile.mode !== 'ps3') return;

    const maxRadius = profile.drawDistance * 1.15;

    const makeLeafMat = (name: string, color: Color3, alpha = 0.92): StandardMaterial => {
      const mat = new StandardMaterial(name, scene);
      mat.diffuseColor = color;
      mat.emissiveColor = new Color3(color.r * 0.12, color.g * 0.16, color.b * 0.08);
      mat.specularColor = Color3.Black();
      mat.backFaceCulling = false;
      mat.alpha = alpha;
      return mat;
    };

    const fernTemplates = [
      makeLeafMat('ps3FernMat_0', new Color3(0.10, 0.26, 0.08)),
      makeLeafMat('ps3FernMat_1', new Color3(0.07, 0.20, 0.07)),
      makeLeafMat('ps3FernMat_2', new Color3(0.14, 0.30, 0.10)),
    ].map((mat, i) => {
      const blade = MeshBuilder.CreatePlane(`ps3FernBlade_${i}`, { width: 0.16, height: 0.9 }, scene);
      blade.material = mat;
      this.treeMeshes.push(blade);
      return blade;
    });
    const fernMatrices: Matrix[][] = fernTemplates.map(() => []);

    const rocky = this.trailOptions.flavor === 'rocky';
    const fernClumps = rocky ? 430 : 1050;
    let fernPlaced = 0, fernAttempts = 0;
    while (fernPlaced < fernClumps && fernAttempts < fernClumps * 5) {
      fernAttempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * (maxRadius - 5);
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;
      if (this.inEitherCorridor(cx, cz)) continue;

      const groundY = this.terrain.getHeightAt(cx, cz);
      const ti = Math.floor(Math.random() * fernTemplates.length);
      const fronds = 5 + Math.floor(Math.random() * 5);
      for (let f = 0; f < fronds; f++) {
        const yaw = (f / fronds) * Math.PI * 2 + Math.random() * 0.45;
        const offset = Math.random() * 0.22;
        const h = 0.42 + Math.random() * 0.42;
        fernMatrices[ti].push(Matrix.Compose(
          new Vector3(0.75 + Math.random() * 0.45, h / 0.9, 1),
          Quaternion.FromEulerAngles(-0.38 - Math.random() * 0.35, yaw, (Math.random() - 0.5) * 0.22),
          new Vector3(cx + Math.cos(yaw) * offset, groundY + h * 0.46, cz + Math.sin(yaw) * offset),
        ));
      }
      fernPlaced++;
    }
    fernTemplates.forEach((t, i) => t.thinInstanceAdd(fernMatrices[i], true));

    const broadleafMats = [
      makeLeafMat('ps3BroadleafMat_0', new Color3(0.11, 0.28, 0.09)),
      makeLeafMat('ps3BroadleafMat_1', new Color3(0.17, 0.32, 0.10)),
      makeLeafMat('ps3BroadleafMat_2', new Color3(0.08, 0.18, 0.07)),
    ];
    const broadleafTemplates = broadleafMats.map((mat, i) => {
      const leaf = MeshBuilder.CreatePlane(`ps3Broadleaf_${i}`, { width: 0.34, height: 0.48 }, scene);
      leaf.material = mat;
      this.treeMeshes.push(leaf);
      return leaf;
    });
    const broadleafMatrices: Matrix[][] = broadleafTemplates.map(() => []);

    const broadleafCount = rocky ? 620 : 1500;
    let leafPlaced = 0, leafAttempts = 0;
    while (leafPlaced < broadleafCount && leafAttempts < broadleafCount * 5) {
      leafAttempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * (maxRadius - 4);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (this.inEitherCorridor(x, z) || this.inRockyVistaClearing(x, z)) continue;

      const ti = Math.floor(Math.random() * broadleafTemplates.length);
      const h = 0.16 + Math.random() * 0.36;
      const groundY = this.terrain.getHeightAt(x, z);
      broadleafMatrices[ti].push(Matrix.Compose(
        new Vector3(0.55 + Math.random() * 0.7, h / 0.48, 1),
        Quaternion.FromEulerAngles(-0.65 + Math.random() * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.6),
        new Vector3(x, groundY + h * 0.45, z),
      ));
      leafPlaced++;
    }
    broadleafTemplates.forEach((t, i) => t.thinInstanceAdd(broadleafMatrices[i], true));

    const saplingMat = makeLeafMat('ps3SaplingLeafMat', new Color3(0.12, 0.31, 0.10));
    const saplingStemMat = new StandardMaterial('ps3SaplingStemMat', scene);
    saplingStemMat.diffuseColor = new Color3(0.10, 0.06, 0.035);
    saplingStemMat.specularColor = Color3.Black();

    const saplingStem = MeshBuilder.CreateCylinder('ps3SaplingStem', {
      height: 1,
      diameter: 0.055,
      tessellation: 6,
    }, scene);
    saplingStem.material = saplingStemMat;
    this.treeMeshes.push(saplingStem);

    const saplingLeaf = MeshBuilder.CreateSphere('ps3SaplingLeaf', {
      diameter: 1,
      segments: 6,
    }, scene);
    saplingLeaf.material = saplingMat;
    this.treeMeshes.push(saplingLeaf);

    const stemMatrices: Matrix[] = [];
    const crownMatrices: Matrix[] = [];
    const saplingCount = rocky ? 95 : 260;
    let saplings = 0, saplingAttempts = 0;
    while (saplings < saplingCount && saplingAttempts < saplingCount * 6) {
      saplingAttempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * (maxRadius - 8);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (this.inEitherCorridor(x, z) || this.inRockyVistaClearing(x, z)) continue;

      const h = 0.7 + Math.random() * 1.0;
      const groundY = this.terrain.getHeightAt(x, z);
      const leanX = (Math.random() - 0.5) * 0.22;
      const leanZ = (Math.random() - 0.5) * 0.22;
      stemMatrices.push(Matrix.Compose(
        new Vector3(1, h, 1),
        Quaternion.FromEulerAngles(leanX, Math.random() * Math.PI * 2, leanZ),
        new Vector3(x, groundY + h * 0.5, z),
      ));
      crownMatrices.push(Matrix.Compose(
        new Vector3(0.42 + Math.random() * 0.26, 0.24 + Math.random() * 0.18, 0.42 + Math.random() * 0.26),
        Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
        new Vector3(x + leanZ * 0.35, groundY + h + 0.10, z - leanX * 0.35),
      ));
      saplings++;
    }
    saplingStem.thinInstanceAdd(stemMatrices, true);
    saplingLeaf.thinInstanceAdd(crownMatrices, true);

    const mushroomStemMat = new StandardMaterial('ps3MushroomStemMat', scene);
    mushroomStemMat.diffuseColor = new Color3(0.42, 0.36, 0.27);
    mushroomStemMat.specularColor = Color3.Black();
    const mushroomCapMat = new StandardMaterial('ps3MushroomCapMat', scene);
    mushroomCapMat.diffuseColor = new Color3(0.34, 0.16, 0.09);
    mushroomCapMat.specularColor = Color3.Black();

    const mushroomStem = MeshBuilder.CreateCylinder('ps3MushroomStem', {
      height: 1,
      diameter: 0.12,
      tessellation: 6,
    }, scene);
    mushroomStem.material = mushroomStemMat;
    this.treeMeshes.push(mushroomStem);

    const mushroomCap = MeshBuilder.CreateCylinder('ps3MushroomCap', {
      height: 0.12,
      diameterTop: 0.16,
      diameterBottom: 0.38,
      tessellation: 8,
    }, scene);
    mushroomCap.material = mushroomCapMat;
    this.treeMeshes.push(mushroomCap);

    const mushroomStemMatrices: Matrix[] = [];
    const mushroomCapMatrices: Matrix[] = [];
    const mushroomCount = rocky ? 120 : 340;
    let mushrooms = 0, mushroomAttempts = 0;
    while (mushrooms < mushroomCount && mushroomAttempts < mushroomCount * 5) {
      mushroomAttempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * (maxRadius - 5);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (this.inEitherCorridor(x, z)) continue;

      const h = 0.12 + Math.random() * 0.22;
      const s = 0.55 + Math.random() * 0.9;
      const groundY = this.terrain.getHeightAt(x, z);
      mushroomStemMatrices.push(Matrix.Compose(
        new Vector3(s, h, s),
        Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
        new Vector3(x, groundY + h * 0.5, z),
      ));
      mushroomCapMatrices.push(Matrix.Compose(
        new Vector3(s, 1, s),
        Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
        new Vector3(x, groundY + h + 0.05, z),
      ));
      mushrooms++;
    }
    mushroomStem.thinInstanceAdd(mushroomStemMatrices, true);
    mushroomCap.thinInstanceAdd(mushroomCapMatrices, true);
  }

  // Leaves and moss were already regular instances; logs were unique
  // geometry per log (length/radius varied per-log). All three now use
  // thin instances — logs via a unit-size template scaled per instance
  // instead of building bespoke geometry each time.
  private buildForestFloor(scene: Scene, profile: ExperienceProfile): void {
    if (profile.mode === 'ps3' && profile.lookVariant === 'overcast') {
      this.buildForestFloorOvercast(scene, profile);
      return;
    }

    const leafColors = profile.mode === 'ps3'
      ? [
          [0.28, 0.14, 0.045], [0.18, 0.09, 0.035],
          [0.30, 0.23, 0.07], [0.10, 0.14, 0.05],
          [0.20, 0.15, 0.08], [0.12, 0.10, 0.06],
        ]
      : profile.mode === 'ps2'
      ? [
          [0.25, 0.12, 0.04], [0.16, 0.08, 0.03],
          [0.26, 0.20, 0.06], [0.09, 0.12, 0.04],
          [0.18, 0.14, 0.08],
        ]
      : profile.mode === 'ps1'
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
    const leavesPerColor = profile.mode === 'ps1' ? 260 : profile.mode === 'ps3' ? 500 : profile.mode === 'ps2' ? 340 : 110;
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
    mossMat.diffuseColor = profile.mode === 'ps3'
      ? new Color3(0.045, 0.18, 0.045)
      : profile.mode === 'ps2'
      ? new Color3(0.04, 0.15, 0.04)
      : profile.mode === 'ps1'
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

    const mossCount = profile.mode === 'ps1' ? 90 : profile.mode === 'ps3' ? 190 : profile.mode === 'ps2' ? 130 : 55;
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
    logMat.diffuseColor = profile.mode === 'ps3'
      ? new Color3(0.12, 0.075, 0.045)
      : profile.mode === 'ps2'
      ? new Color3(0.11, 0.07, 0.04)
      : profile.mode === 'ps1'
      ? new Color3(0.20, 0.13, 0.07)
      : new Color3(0.06, 0.05, 0.04);
    logMat.specularColor = Color3.Black();

    const logBase = MeshBuilder.CreateCylinder(
      'logBase',
      { height: 1, diameter: 1, tessellation: profile.mode === 'ps1' ? 6 : profile.mode === 'ps3' ? 12 : profile.mode === 'ps2' ? 10 : 8 },
      scene,
    );
    logBase.material = logMat;
    if (profile.mode === 'ps1') logBase.convertToFlatShadedMesh();
    this.treeMeshes.push(logBase);

    const logCount = profile.mode === 'ps1' ? 42 : profile.mode === 'ps3' ? 90 : profile.mode === 'ps2' ? 60 : 28;
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

  // Overcast variant of buildForestFloor (docs/dissonance-forest-color-handoff.md).
  // Leaf litter/moss/logs each move from a handful of discrete materials to
  // one shared white-based material + a per-thin-instance HSV-jittered color
  // buffer from FOREST_PALETTE, matching the doc's "jitter per instance, no
  // per-instance materials" guidance. Logs additionally get a scarce,
  // minimum-spaced rust-accent recolor instead of the flat log-brown genesis
  // used everywhere else. Counts/placement/corridor rules are otherwise
  // identical to the genesis path above.
  private buildForestFloorOvercast(scene: Scene, profile: ExperienceProfile): void {
    const maxRadius = profile.drawDistance * 1.15;

    // ─── Leaf litter ────────────────────────────────────────────────────
    const leafMat = new StandardMaterial('leafLitterMatOvercast', scene);
    leafMat.diffuseColor = Color3.White();
    leafMat.specularColor = Color3.Black();
    leafMat.backFaceCulling = false;
    const leafTemplate = MeshBuilder.CreateCylinder('leafLitterBaseOvercast', {
      height: 0.025, diameter: 0.28, tessellation: 5,
    }, scene);
    leafTemplate.material = leafMat;
    this.treeMeshes.push(leafTemplate);

    const leafCount = 500 * 6; // matches genesis ps3's 6-bucket x 500 total
    const leafMatrices: Matrix[] = [];
    for (let i = 0; i < leafCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * (maxRadius - 5);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const groundY = this.terrain.getHeightAt(x, z);
      const scale = 0.6 + Math.random() * 1.6;
      leafMatrices.push(Matrix.Compose(
        new Vector3(scale, scale, scale),
        Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
        new Vector3(x, groundY + 0.013, z),
      ));
    }
    leafTemplate.thinInstanceAdd(leafMatrices, true);
    leafTemplate.thinInstanceSetBuffer('color', buildJitteredColorBuffer(leafMatrices.length, FOREST_PALETTE.leafLitter), 4);

    // ─── Moss ───────────────────────────────────────────────────────────
    const mossMat = new StandardMaterial('mossMatOvercast', scene);
    mossMat.diffuseColor = Color3.White();
    mossMat.specularColor = Color3.Black();
    const mossBase = MeshBuilder.CreateCylinder('mossBaseOvercast', { height: 0.04, diameter: 1.2, tessellation: 7 }, scene);
    mossBase.material = mossMat;
    this.treeMeshes.push(mossBase);

    const mossCount = 190; // matches genesis ps3
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
    mossBase.thinInstanceSetBuffer('color', buildJitteredColorBuffer(mossMatrices.length, FOREST_PALETTE.mossCool), 4);

    // ─── Logs — bark-brown by default, scarce rust-accent hero logs ───────
    const logMat = new StandardMaterial('logMatOvercast', scene);
    logMat.diffuseColor = Color3.White();
    logMat.specularColor = Color3.Black();
    const logBase = MeshBuilder.CreateCylinder('logBaseOvercast', { height: 1, diameter: 1, tessellation: 12 }, scene);
    logBase.material = logMat;
    this.treeMeshes.push(logBase);

    const logCount = 90; // matches genesis ps3
    const RUST_MIN_SPACING = 28;
    const RUST_PROBABILITY = 0.10;
    const logMatrices: Matrix[] = [];
    const logColors: number[] = [];
    const rustLogPositions: { x: number; z: number }[] = [];
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

      const farEnoughFromRust = rustLogPositions.every(
        (p) => (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) > RUST_MIN_SPACING * RUST_MIN_SPACING,
      );
      const isRust = farEnoughFromRust && Math.random() < RUST_PROBABILITY;
      const color = isRust ? jitterFamily(FOREST_PALETTE.rustAccent) : jitterFamily(FOREST_PALETTE.barkGreyBrown);
      if (isRust) rustLogPositions.push({ x, z });
      logColors.push(color.r, color.g, color.b, 1);
    }
    logBase.thinInstanceAdd(logMatrices, true);
    logBase.thinInstanceSetBuffer('color', new Float32Array(logColors), 4);
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

  private buildSurveyTrail(scene: Scene, profile: ExperienceProfile): void {
    const ps1 = profile.mode === 'ps1';

    const dirtMat = new StandardMaterial('surveyDirtMat', scene);
    dirtMat.diffuseColor = profile.mode === 'ps3'
      ? new Color3(0.18, 0.13, 0.08)
      : profile.mode === 'ps2'
      ? new Color3(0.16, 0.11, 0.07)
      : ps1
        ? new Color3(0.24, 0.15, 0.08)
        : new Color3(0.055, 0.045, 0.035);
    dirtMat.specularColor = Color3.Black();

    const woodMat = new StandardMaterial('surveyPostMat', scene);
    woodMat.diffuseColor = profile.mode === 'ps3'
      ? new Color3(0.16, 0.095, 0.05)
      : profile.mode === 'ps2'
      ? new Color3(0.14, 0.085, 0.045)
      : ps1
        ? new Color3(0.24, 0.14, 0.07)
        : new Color3(0.07, 0.055, 0.04);
    woodMat.specularColor = Color3.Black();

    const stoneMat = new StandardMaterial('surveyCairnMat', scene);
    stoneMat.diffuseColor = profile.mode === 'radio'
      ? new Color3(0.08, 0.08, 0.09)
      : new Color3(0.25, 0.24, 0.22);
    stoneMat.specularColor = Color3.Black();

    const markerMat = new StandardMaterial('surveyMarkerMat', scene);
    markerMat.diffuseColor = new Color3(0.52, 0.30, 0.10);
    markerMat.emissiveColor = profile.mode === 'ps3'
      ? new Color3(0.22, 0.10, 0.03)
      : profile.mode === 'ps2'
      ? new Color3(0.18, 0.08, 0.02)
      : Color3.Black();
    markerMat.specularColor = Color3.Black();

    const pts = SURVEY_TRAIL_WAYPOINTS;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const ddx = bx - ax, ddz = bz - az;
      const len = Math.sqrt(ddx * ddx + ddz * ddz);
      const yaw = Math.atan2(ddx, ddz);
      const subCount = Math.max(1, Math.ceil(len / 7));
      const subLen = len / subCount;

      for (let s = 0; s < subCount; s++) {
        const t0 = s / subCount, t1 = (s + 1) / subCount;
        const x0 = ax + t0 * ddx, z0 = az + t0 * ddz;
        const x1 = ax + t1 * ddx, z1 = az + t1 * ddz;
        const y0 = this.terrain.getHeightAt(x0, z0);
        const y1 = this.terrain.getHeightAt(x1, z1);
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, my = (y0 + y1) / 2;
        const slope = Math.atan2(y1 - y0, subLen);

        const strip = MeshBuilder.CreateBox(`surveyTrailStrip_${i}_${s}`, {
          width: SURVEY_TRAIL_WIDTH * 2,
          height: 0.045,
          depth: subLen + 0.28,
        }, scene);
        strip.position.set(mx, my + 0.025, mz);
        strip.rotation.set(-slope, yaw, 0);
        strip.material = dirtMat;
        this.treeMeshes.push(strip);
      }

      if (i % 2 === 0) {
        const px = -ddz / len, pz = ddx / len;
        const side = i % 4 === 0 ? 1 : -1;
        const wx = ax + px * (SURVEY_TRAIL_WIDTH + 0.7) * side;
        const wz = az + pz * (SURVEY_TRAIL_WIDTH + 0.7) * side;
        const wy = this.terrain.getHeightAt(wx, wz);

        const post = MeshBuilder.CreateCylinder('surveyPost', {
          height: 1.1, diameter: 0.10, tessellation: ps1 ? 5 : 7,
        }, scene);
        post.position.set(wx, wy + 0.55, wz);
        post.rotation.z = (Math.random() - 0.5) * 0.18;
        post.material = woodMat;
        if (ps1) post.convertToFlatShadedMesh();
        this.treeMeshes.push(post);

        const tag = MeshBuilder.CreateBox('surveyTag', { width: 0.28, height: 0.18, depth: 0.035 }, scene);
        tag.position.set(wx, wy + 1.0, wz);
        tag.rotation.y = yaw + Math.PI / 2;
        tag.material = markerMat;
        this.treeMeshes.push(tag);
      }
    }

    for (let i = 1; i < pts.length; i += 2) {
      const [cx, cz] = pts[i];
      const cy = this.terrain.getHeightAt(cx, cz);
      for (let s = 0; s < 4; s++) {
        const size = 0.42 - s * 0.06;
        const stone = MeshBuilder.CreateBox(`surveyCairn_${i}_${s}`, { size }, scene);
        stone.position.set(
          cx + (Math.random() - 0.5) * 0.18,
          cy + 0.10 + s * 0.18,
          cz + (Math.random() - 0.5) * 0.18,
        );
        stone.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
        stone.scaling.y = 0.45;
        stone.material = stoneMat;
        if (ps1) stone.convertToFlatShadedMesh();
        this.treeMeshes.push(stone);
      }
    }

    const [ex, ez] = pts[pts.length - 1];
    const ey = this.terrain.getHeightAt(ex, ez);
    const signPost = MeshBuilder.CreateCylinder('surveyEndPost', {
      height: 1.4, diameter: 0.12, tessellation: ps1 ? 5 : 7,
    }, scene);
    signPost.position.set(ex, ey + 0.7, ez);
    signPost.material = woodMat;
    this.treeMeshes.push(signPost);

    const sign = MeshBuilder.CreateBox('surveyEndSign', { width: 1.1, height: 0.32, depth: 0.06 }, scene);
    sign.position.set(ex, ey + 1.28, ez);
    sign.rotation.set(0.08, -0.7, -0.08);
    sign.material = woodMat;
    this.treeMeshes.push(sign);

    const cap = MeshBuilder.CreateCylinder('surveyMarkerCap', {
      height: 0.08, diameter: 0.48, tessellation: ps1 ? 8 : 12,
    }, scene);
    cap.position.set(ex + 1.4, ey + 0.06, ez - 0.8);
    cap.material = markerMat;
    this.treeMeshes.push(cap);
  }

  dispose(): void {
    this.treeMeshes.forEach(m => m.dispose());
    this.treeMeshes = [];
    this.lights.forEach(l => l.dispose());
    this.lights = [];
    if (this.riverFlowObserver && this.riverScene) {
      this.riverScene.onBeforeRenderObservable.remove(this.riverFlowObserver);
    }
    this.riverFlowObserver = null;
    this.riverWaterSegments = [];
  }
}
