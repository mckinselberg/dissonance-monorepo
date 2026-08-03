import { Vector3, type Scene, type ShadowGenerator } from '@babylonjs/core';
import type { ITerrain, FoliageSwaySource } from '@dissonance/world';
import { latLonToWorld, type GeoPolyline, type UtmCoordinate } from '@dissonance/geo';
import type { ScaleTuningSignals } from '../state/scaleTuning';
import type { TrailsideScatterSignals } from '../state/trailsideScatter';
import { loadHeroTreeInstances, type HeroTreeInstancesHandle } from './HeroTreeInstances';
import { debounce } from '../utils';

// Counts are lower for the understory/deadfall props than the tree canopy
// — a real forest floor has far fewer stumps and dead trunks underfoot
// than it has live trees overhead.
const HERO_ASSETS = [
  {
    label: 'tree_small_02',
    url: `${import.meta.env.BASE_URL}models/tree-small-02/tree_small_02_preview.glb`,
    count: 100,
  },
  {
    label: 'pine_sapling_medium',
    url: `${import.meta.env.BASE_URL}models/pine-sapling-medium/pine_sapling_medium_preview.glb`,
    count: 8,
  },
  {
    label: 'fir_sapling_medium',
    url: `${import.meta.env.BASE_URL}models/fir-sapling-medium/fir_sapling_medium_preview.glb`,
    count: 8,
  },
  {
    label: 'dead_tree_trunk_02',
    url: `${import.meta.env.BASE_URL}models/dead-tree-trunk-02/dead_tree_trunk_02_preview.glb`,
    count: 6,
  },
  {
    label: 'tree_stump_01',
    url: `${import.meta.env.BASE_URL}models/tree-stump-01/tree_stump_01_preview.glb`,
    count: 8,
  },
] as const;

const HERO_WEIGHT_TOTAL = HERO_ASSETS.reduce((sum, asset) => sum + asset.count, 0);

const TRAILSIDE_MIN_OFFSET = 3;
const TRAILSIDE_MAX_OFFSET = 14;

// See BulkForestSystem's identical constant for why: thin instances cull as
// one aggregate bounding box per mesh, never per instance, so a trail-length
// scatter renders in full no matter how far away the player currently is
// unless the position array itself is distance-filtered before upload.
const CULL_UPDATE_INTERVAL_SECONDS = 0.25;

type TrailSegment = { ax: number; az: number; bx: number; bz: number; length: number; start: number };

// Player-mode-only (see main.tsx — orbit mode never constructs this):
// scatters HERO_ASSETS' full-detail tree GLBs along both sides of the
// recorded GPX track and the yellow-blazed OSM trails, using HERO_ASSETS'
// per-species counts as MIX WEIGHTS (not absolute counts) so the cluster
// keeps the same species proportions, scaled by the user-facing "Trailside
// count" slider instead of a fixed total.
export class TrailsideForestSystem {
  private readonly trailSegments: TrailSegment[] = [];
  private trailTotalLength = 0;
  private readonly clusters: Array<{ weight: number; handle: HeroTreeInstancesHandle; fullPositions: Vector3[] }> = [];
  private readonly rebuildDebouncedFn: () => void;
  private lastCameraPosition: Vector3 | null = null;
  private cullRadius = Number.POSITIVE_INFINITY;
  private cullAccumulator = 0;

  private constructor(
    private readonly terrain: ITerrain,
    private readonly scaleTuning: ScaleTuningSignals,
    private readonly trailsideScale: TrailsideScatterSignals,
    origin: UtmCoordinate,
    gpxTrack: GeoPolyline[],
    trails: GeoPolyline[],
  ) {
    // Segments are computed once, in real (unscaled) meters, same
    // convention as TerrainOverlaySystem's own overlay draping —
    // trailTotalLength stays fixed even as hScale changes, only the final
    // render-space conversion below depends on it.
    this.addTrailCorridor(origin, gpxTrack);
    // smr-trails.geojson carries no osmc:symbol tag at all (every OSM
    // trail renders the same neutral tan regardless of real blaze color —
    // see TerrainOverlaySystem's blazeColorFromTags) — but several way
    // segments DO encode it in the name text instead, e.g. "Lenape Trail
    // (Yellow)", "Lenape Yellow Blaze", "Yellow/Red Blaze". Matching on
    // osmc:symbol too costs nothing and covers datasets that do have it.
    this.addTrailCorridor(
      origin,
      trails.filter((polyline) => {
        const primary = polyline.tags?.['osmc:symbol']?.split(':')[0]?.toLowerCase();
        if (primary === 'yellow') return true;
        return !!polyline.tags?.name?.toLowerCase().includes('yellow');
      }),
    );
    this.rebuildDebouncedFn = debounce(() => this.rebuild(), 200);
  }

  // Total triangle cost scales with the count slider alone, which is
  // exactly the "watch the FPS readout and find the real ceiling" pattern
  // this app already uses for candidate-pool-backed sliders — see
  // BulkForestSystem's MAX_TREE_COUNT. Default count (60, see
  // trailsideScale's creation in main.tsx) is intentionally conservative.
  static async create(
    scene: Scene,
    origin: UtmCoordinate,
    gpxTrack: GeoPolyline[],
    trails: GeoPolyline[],
    terrain: ITerrain,
    scaleTuning: ScaleTuningSignals,
    trailsideScale: TrailsideScatterSignals,
    shadowGenerator: ShadowGenerator | undefined,
    windSource: FoliageSwaySource,
  ): Promise<TrailsideForestSystem> {
    const system = new TrailsideForestSystem(terrain, scaleTuning, trailsideScale, origin, gpxTrack, trails);

    await Promise.all(
      HERO_ASSETS.map(async ({ label, url, count: weight }) => {
        try {
          const positions = system.trailsidePositions(system.speciesCount(weight));
          const handle = await loadHeroTreeInstances(
            scene,
            url,
            positions,
            scaleTuning.hScale.value * trailsideScale.hScale.value,
            scaleTuning.hScale.value * trailsideScale.vScale.value,
            shadowGenerator,
            windSource,
          );
          system.clusters.push({ weight, handle, fullPositions: positions });
          console.info(`[TrailsideScatter] loaded ${system.speciesCount(weight)} thin-instanced ${label}(s) along the trail`);
        } catch (error) {
          console.error(`[TrailsideScatter] failed to load ${label} along the trail`, error);
        }
      }),
    );

    return system;
  }

  private addTrailCorridor(origin: UtmCoordinate, polylines: GeoPolyline[]): void {
    for (const polyline of polylines) {
      const realPoints = polyline.points.map((p) => latLonToWorld(p, origin));
      for (let i = 0; i < realPoints.length - 1; i++) {
        const a = realPoints[i];
        const b = realPoints[i + 1];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        if (length <= 0) continue;
        this.trailSegments.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, length, start: this.trailTotalLength });
        this.trailTotalLength += length;
      }
    }
  }

  private speciesCount(weight: number): number {
    return Math.round(this.trailsideScale.count.value * (weight / HERO_WEIGHT_TOTAL));
  }

  private trailsidePositions(count: number): Vector3[] {
    const positions: Vector3[] = [];
    if (this.trailTotalLength <= 0) return positions;
    for (let i = 0; i < count; i++) {
      const d = Math.random() * this.trailTotalLength;
      const seg =
        this.trailSegments.find((s) => d >= s.start && d < s.start + s.length) ?? this.trailSegments[this.trailSegments.length - 1];
      const t = (d - seg.start) / seg.length;
      const px = seg.ax + (seg.bx - seg.ax) * t;
      const pz = seg.az + (seg.bz - seg.az) * t;
      // Unit tangent along the segment, rotated 90 degrees in the XZ plane
      // to get the side-to-side offset direction ("both sides" of the trail).
      const dirX = (seg.bx - seg.ax) / seg.length;
      const dirZ = (seg.bz - seg.az) / seg.length;
      const side = Math.random() < 0.5 ? -1 : 1;
      const offset = (TRAILSIDE_MIN_OFFSET + Math.random() * (TRAILSIDE_MAX_OFFSET - TRAILSIDE_MIN_OFFSET)) * side;
      const realX = px - dirZ * offset;
      const realZ = pz + dirX * offset;
      const x = realX * this.scaleTuning.hScale.value;
      const z = realZ * this.scaleTuning.hScale.value;
      positions.push(new Vector3(x, this.terrain.getHeightAt(x, z), z));
    }
    return positions;
  }

  rebuild(): void {
    for (const cluster of this.clusters) {
      cluster.fullPositions = this.trailsidePositions(this.speciesCount(cluster.weight));
    }
    this.applyCulling();
  }

  rebuildDebounced(): void {
    this.rebuildDebouncedFn();
  }

  // Mirrors BulkForestSystem's applyCulling/updateCulling pair — see its
  // comments for why thin instances need this at all.
  private applyCulling(): void {
    const hScale = this.scaleTuning.hScale.value * this.trailsideScale.hScale.value;
    const vScale = this.scaleTuning.hScale.value * this.trailsideScale.vScale.value;
    const camera = this.lastCameraPosition;
    const radius = this.cullRadius;
    const withinRadius = (positions: Vector3[]): Vector3[] => {
      if (!camera || !Number.isFinite(radius)) return positions;
      const radiusSq = radius * radius;
      return positions.filter((p) => {
        const dx = p.x - camera.x;
        const dz = p.z - camera.z;
        return dx * dx + dz * dz <= radiusSq;
      });
    };
    for (const cluster of this.clusters) {
      cluster.handle.setPlacements(withinRadius(cluster.fullPositions), hScale, vScale);
    }
  }

  updateCulling(dt: number, cameraPosition: Vector3, cullRadius: number): void {
    this.lastCameraPosition = cameraPosition;
    this.cullRadius = cullRadius;
    this.cullAccumulator += dt;
    if (this.cullAccumulator < CULL_UPDATE_INTERVAL_SECONDS) return;
    this.cullAccumulator = 0;
    this.applyCulling();
  }
}
