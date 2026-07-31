import { Vector3, type Scene, type ShadowGenerator } from '@babylonjs/core';
import { defaultWaterLevel, type TreePoint, type FoliageSwaySource } from '@dissonance/world';
import { HeightmapSampler, type HeightmapContract } from '@dissonance/geo';
import { signal, type Signal } from '@preact/signals';
import { createBulkForestScatterSignals, type BulkForestScatterSignals } from '../state/bulkForestScatter';
import type { ScaleTuningSignals } from '../state/scaleTuning';
import { loadHeroTreeInstances, type HeroTreeInstancesHandle } from './HeroTreeInstances';
import { debounce } from '../utils';

// Candidate pool feeds ForestFire (via treePointsInRegion) and caps the
// "Bulk forest count" slider — 8000 was a guessed-not-measured ceiling;
// raised well past it (matching TREE_CANDIDATE_COUNT) so that slider can
// actually be dragged into the range needed to find the real one — watch
// the FPS readout while doing that, don't trust this number until it's
// been through that.
export const MAX_TREE_COUNT = 30000;
const TREE_CANDIDATE_COUNT = 30000;
const TREE_CLEARANCE_ABOVE_WATER = 20;

const BULK_FOREST_URL = `${import.meta.env.BASE_URL}models/tree-small-02-scatter/tree_small_02_scatter_preview.glb`;

// Prototype: sparse understory variety mixed into the bulk tier, same
// weighted-species pattern as trailside's HERO_ASSETS (independent random
// draw per species, sized as a fraction of the dominant tree's own count)
// — but using assets that already exist at a real-world scatter-tier tri
// budget (dead-tree-trunk-02/tree-stump-01, both already decimated-enough
// to have shipped as trailside's own understory props) rather than
// full-detail saplings, since bulk forest runs at 10x+ hero-grove's
// instance count. Fractions are deliberately small and easy to retune — no
// new asset authoring, just budget: at a count of 2250 this adds ~110
// extra instances (~1.8M tris) on top of the dominant tree's own ~17M, for
// real silhouette variety instead of one repeated clone.
const BULK_UNDERSTORY_ASSETS = [
  {
    label: 'tree_stump_01',
    url: `${import.meta.env.BASE_URL}models/tree-stump-01/tree_stump_01_preview.glb`,
    fraction: 0.03,
  },
  {
    label: 'dead_tree_trunk_02',
    url: `${import.meta.env.BASE_URL}models/dead-tree-trunk-02/dead_tree_trunk_02_preview.glb`,
    fraction: 0.02,
  },
] as const;

// Owns the map-wide tree candidate pool (feeds ForestFire's ignition region
// too — see treePointsInRegion) plus the bulk/decimated forest scatter that
// reads from its own sub-disc of that same pool. Exists for every level
// (orbit included) — only the trailside hero-detail scatter and ForestFire
// are player-mode-only (see main.tsx).
export class BulkForestSystem {
  readonly treeRegionRadiusMax: number;
  readonly defaultTreeRegionRadius: number;
  // Consolidates the ForestFire candidate pool toward the map's center
  // instead of covering the whole bbox corner-to-corner — a real forest
  // reads as a region, not a uniform carpet over the entire DEM. No HUD
  // slider of its own anymore (see the removed "Thin-instance tree radius"
  // control); "Bulk forest radius" reuses treeRegionRadiusMax for its own,
  // separate range.
  readonly treeRegionRadius: Signal<number>;
  readonly bulkForestScale: BulkForestScatterSignals;
  // Its own disc (bulkForestRadius), independent of treeRegionRadius/
  // treePointsInRegion — the region-radius pool only feeds ForestFire, so
  // bulk forest generating its own candidates keeps it fully decoupled
  // from that tier's session-fixed radius.
  readonly bulkForestRadius: Signal<number>;
  readonly bulkForestPlacedCount = signal(0);

  private readonly treePoints: TreePoint[];
  private readonly forestWaterline: number;
  private readonly repositionDebouncedFn: () => void;

  private constructor(
    private readonly sampler: HeightmapSampler,
    contract: HeightmapContract,
    private readonly scaleTuning: ScaleTuningSignals,
    savedRadii: { treeRegionRadius?: number; bulkForestRadius?: number },
    bulkForestScaleDefaults: { hScale: number; vScale: number; count: number },
    private bulkForest: HeroTreeInstancesHandle | null,
    private readonly bulkUnderstoryClusters: Array<{ label: string; fraction: number; handle: HeroTreeInstancesHandle }>,
  ) {
    const realWidth = contract.bbox.maxX - contract.bbox.minX;
    const realDepth = contract.bbox.maxZ - contract.bbox.minZ;
    this.treeRegionRadiusMax = Math.hypot(realWidth, realDepth) / 2;
    this.defaultTreeRegionRadius = this.treeRegionRadiusMax * 0.4;
    this.treeRegionRadius = signal(savedRadii.treeRegionRadius ?? this.defaultTreeRegionRadius);
    this.bulkForestRadius = signal(savedRadii.bulkForestRadius ?? this.defaultTreeRegionRadius);
    this.bulkForestScale = createBulkForestScatterSignals(bulkForestScaleDefaults);
    // WaterPlane is a freely tunable visual stand-in, not mapped hydrology.
    // Raising it must not erase the forest candidate pool or lock the
    // count controls. Keep vegetation's shoreline threshold stable.
    this.forestWaterline = defaultWaterLevel(contract);

    this.treePoints = [];
    for (let i = 0; i < TREE_CANDIDATE_COUNT; i++) {
      const x = (Math.random() - 0.5) * realWidth;
      const z = (Math.random() - 0.5) * realDepth;
      const groundY = sampler.sampleHeight({ x, z });
      this.treePoints.push({ x, z, groundY });
    }

    this.repositionDebouncedFn = debounce(() => this.reposition(), 200);
  }

  static async create(
    scene: Scene,
    sampler: HeightmapSampler,
    contract: HeightmapContract,
    scaleTuning: ScaleTuningSignals,
    shadowGenerator: ShadowGenerator | undefined,
    windSource: FoliageSwaySource,
    savedSettings: {
      treeRegionRadius?: number;
      bulkForestRadius?: number;
      bulkForestHScale?: number;
      bulkForestVScale?: number;
      bulkForestCount?: number;
    },
  ): Promise<BulkForestSystem> {
    const system = new BulkForestSystem(
      sampler, contract, scaleTuning,
      { treeRegionRadius: savedSettings.treeRegionRadius, bulkForestRadius: savedSettings.bulkForestRadius },
      {
        hScale: savedSettings.bulkForestHScale ?? 1,
        vScale: savedSettings.bulkForestVScale ?? 1,
        count: savedSettings.bulkForestCount ?? 200,
      },
      null,
      [],
    );

    try {
      const positions = system.bulkForestPositions();
      system.bulkForest = await loadHeroTreeInstances(
        scene,
        BULK_FOREST_URL,
        positions,
        scaleTuning.hScale.value * system.bulkForestScale.hScale.value,
        scaleTuning.hScale.value * system.bulkForestScale.vScale.value,
        shadowGenerator,
        windSource,
      );
      system.bulkForestPlacedCount.value = positions.length;
      console.info(
        `[BulkForest] loaded ${positions.length} thin-instanced tree_small_02_scatter(s), ${system.bulkForest.triangleCount.toLocaleString()} tris each`,
      );
    } catch (error) {
      system.bulkForestPlacedCount.value = 0;
      console.error('[BulkForest] failed to load bulk forest tree', error);
    }

    await Promise.all(
      BULK_UNDERSTORY_ASSETS.map(async ({ label, url, fraction }) => {
        try {
          const positions = system.bulkUnderstoryPositions(label, fraction);
          const handle = await loadHeroTreeInstances(
            scene,
            url,
            positions,
            scaleTuning.hScale.value * system.bulkForestScale.hScale.value,
            scaleTuning.hScale.value * system.bulkForestScale.vScale.value,
            shadowGenerator,
            windSource,
          );
          system.bulkUnderstoryClusters.push({ label, fraction, handle });
          console.info(`[BulkForest] loaded ${positions.length} thin-instanced ${label}(s) as understory`);
        } catch (error) {
          console.error(`[BulkForest] failed to load ${label} understory cluster`, error);
        }
      }),
    );

    return system;
  }

  private isForestEligible(point: TreePoint): boolean {
    return point.groundY >= this.forestWaterline + TREE_CLEARANCE_ABOVE_WATER;
  }

  treePointsInRegion(): TreePoint[] {
    return this.treePoints.filter(
      (p) => Math.hypot(p.x, p.z) <= this.treeRegionRadius.value && this.isForestEligible(p),
    );
  }

  // Stable string hash (FNV-1a) — gives each species its own seed salt so
  // multiple calls at the SAME radius (dominant tree + every understory
  // species) don't draw the same deterministic sequence. Without this,
  // every call's leading N accepted points were identical regardless of
  // which species asked, since the seed depended only on radius — the
  // understory props were landing exactly on top of the dominant tree (and
  // each other), reading as floating/embedded rather than freestanding.
  private hashSeed(label: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < label.length; i++) {
      h ^= label.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  private createBulkEligibleCandidatePositions(count: number, radius: number, seedSalt: number): TreePoint[] {
    if (count <= 0 || radius <= 0) return [];
    let state = ((Math.round(radius * 10) ^ 0x9e3779b9) ^ seedSalt) >>> 0;
    const random = () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    const positions: TreePoint[] = [];
    const maxAttempts = Math.max(1_000, count * 16);
    for (let attempt = 0; attempt < maxAttempts && positions.length < count; attempt++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const point = { x, z, groundY: this.sampler.sampleHeight({ x, z }) };
      if (this.isForestEligible(point)) positions.push(point);
    }
    return positions;
  }

  private bulkForestPoints(): TreePoint[] {
    return this.createBulkEligibleCandidatePositions(
      this.bulkForestScale.count.value, this.bulkForestRadius.value, this.hashSeed('tree_small_02_scatter'),
    );
  }

  // Real (unscaled) points -> render space, same conversion
  // HeightmapTerrain/WaterPlane use (X/Z by hScale, Y by vExag, groundY
  // already sampled once at candidate-generation time). Shared by the
  // dominant scatter tree and the understory mix.
  private toRenderPositions(points: TreePoint[]): Vector3[] {
    const hScale = this.scaleTuning.hScale.value;
    const vExag = this.scaleTuning.vExag.value;
    return points.map((p) => new Vector3(p.x * hScale, p.groundY * vExag, p.z * hScale));
  }

  private bulkForestPositions(): Vector3[] {
    return this.toRenderPositions(this.bulkForestPoints());
  }

  private bulkUnderstoryCount(fraction: number): number {
    return Math.round(this.bulkForestScale.count.value * fraction);
  }

  private bulkUnderstoryPositions(label: string, fraction: number): Vector3[] {
    return this.toRenderPositions(
      this.createBulkEligibleCandidatePositions(this.bulkUnderstoryCount(fraction), this.bulkForestRadius.value, this.hashSeed(label)),
    );
  }

  reposition(): void {
    const positions = this.bulkForestPositions();
    const hScale = this.scaleTuning.hScale.value;
    const vExag = this.scaleTuning.vExag.value;
    if (!this.bulkForest) {
      this.bulkForestPlacedCount.value = 0;
    } else {
      this.bulkForestPlacedCount.value = positions.length;
      this.bulkForest.setPlacements(positions, hScale * this.bulkForestScale.hScale.value, vExag * this.bulkForestScale.vScale.value);
    }
    for (const { label, fraction, handle } of this.bulkUnderstoryClusters) {
      handle.setPlacements(
        this.bulkUnderstoryPositions(label, fraction),
        hScale * this.bulkForestScale.hScale.value,
        vExag * this.bulkForestScale.vScale.value,
      );
    }
  }

  repositionDebounced(): void {
    this.repositionDebouncedFn();
  }
}
