import { Color3, MeshBuilder, Vector3, type Mesh, type Scene } from '@babylonjs/core';
import { HeightmapTerrain, type ITerrain } from '@dissonance/world';
import {
  latLonToWorld,
  graticuleLines,
  HeightmapSampler,
  type GeoPolyline,
  type GraticuleLine,
  type HeightmapContract,
  type UtmCoordinate,
} from '@dissonance/geo';
import { setMeshesEnabled } from '../utils';

const OSM_TRAIL_Y_LIFT = 0.5;
// Slightly higher than the OSM trails so the recorded track sits visibly on
// top of them instead of z-fighting where the two coincide.
const GPX_TRACK_Y_LIFT = 0.7;
const GPX_TRACK_COLOR = new Color3(1.0, 0.1, 0.1);

// Three-tier slope-blended ground material (see HeightmapTerrain's
// slopeTextures option) — flat/mid/steep, blended by DEM-derived slope,
// not external land-cover data (this dataset has none).
const TERRAIN_TEXTURES_BASE = `${import.meta.env.BASE_URL}textures/`;
const TERRAIN_SLOPE_TEXTURES = {
  flat: {
    diffuseUrl: `${TERRAIN_TEXTURES_BASE}forest-ground-04/forest_ground_04_diff_512.jpg`,
    normalUrl: `${TERRAIN_TEXTURES_BASE}forest-ground-04/forest_ground_04_nor_gl_512.png`,
  },
  mid: {
    diffuseUrl: `${TERRAIN_TEXTURES_BASE}rocky-terrain-02/rocky_terrain_02_diff_512.jpg`,
    normalUrl: `${TERRAIN_TEXTURES_BASE}rocky-terrain-02/rocky_terrain_02_nor_gl_512.png`,
  },
  steep: {
    diffuseUrl: `${TERRAIN_TEXTURES_BASE}marble-cliff-03/marble_cliff_03_diff_512.jpg`,
    normalUrl: `${TERRAIN_TEXTURES_BASE}marble-cliff-03/marble_cliff_03_nor_gl_512.png`,
  },
};

// Highest of the three drape lifts — the grid is a measurement layer that
// should read as sitting "above" both trail layers, not fighting either for
// z-order where they cross.
const GRID_Y_LIFT = 0.9;
// ~111m lat / ~84m lon at 40.7°N. Must match (or cleanly derive from) the
// placement-manifest cell interval once that lands in packages/geo.
const GRID_INTERVAL_DEG = 0.001;
// Sampled through the projection rather than drawn as 2-point lines — at
// SMR's scale the curvature is sub-visual, but sampling is itself the
// validation (a kinked/skewed line here would mean a projection bug).
const GRID_LINE_SAMPLES = 64;
const GRID_LINE_COLOR = new Color3(0.4, 0.75, 0.8);
const GRID_LINE_ALPHA = 0.35;

// OSM's osmc:symbol format is "waycolor:symbolcolor:symboltext" (e.g.
// "blue:blue:blue_bar") — only the leading waycolor is used here, which is
// enough for a POC "does this roughly match the real blaze" visual check.
const BLAZE_COLORS: Record<string, Color3> = {
  blue: new Color3(0.25, 0.45, 1.0),
  red: new Color3(1.0, 0.25, 0.2),
  white: new Color3(1, 1, 1),
  yellow: new Color3(1.0, 0.9, 0.2),
  green: new Color3(0.25, 0.8, 0.3),
  orange: new Color3(1.0, 0.55, 0.1),
};
const NEUTRAL_TRAIL_COLOR = new Color3(0.8, 0.75, 0.6);

function blazeColorFromTags(tags?: Record<string, string>): Color3 {
  const symbol = tags?.['osmc:symbol'];
  const primary = symbol?.split(':')[0]?.toLowerCase();
  if (primary && BLAZE_COLORS[primary]) return BLAZE_COLORS[primary];
  return NEUTRAL_TRAIL_COLOR;
}

function buildPolylineMeshes(
  scene: Scene,
  polylines: GeoPolyline[],
  terrain: ITerrain,
  origin: UtmCoordinate,
  options: {
    namePrefix: string;
    yLift: number;
    horizontalScale: number;
    colorFor: (tags?: Record<string, string>) => Color3;
  },
): Mesh[] {
  const meshes: Mesh[] = [];
  polylines.forEach((polyline, i) => {
    if (polyline.points.length < 2) return;
    const path = polyline.points.map((p) => {
      // latLonToWorld returns real (unscaled) meters; scale to match the
      // terrain's rendered space before asking it for a height there.
      const real = latLonToWorld(p, origin);
      const renderX = real.x * options.horizontalScale;
      const renderZ = real.z * options.horizontalScale;
      const y = terrain.getHeightAt(renderX, renderZ) + options.yLift;
      return new Vector3(renderX, y, renderZ);
    });
    const lines = MeshBuilder.CreateLines(`${options.namePrefix}_${i}`, { points: path }, scene);
    lines.color = options.colorFor(polyline.tags);
    meshes.push(lines);
  });
  return meshes;
}

// Same drape path as buildPolylineMeshes (project -> scale -> getHeightAt +
// lift), kept separate because every grid line shares one visual treatment
// and GraticuleLine has no tags/elevation metadata to branch on.
function buildGraticuleMeshes(
  scene: Scene,
  lines: GraticuleLine[],
  terrain: ITerrain,
  origin: UtmCoordinate,
  horizontalScale: number,
): Mesh[] {
  return lines.map((line, i) => {
    const path = line.points.map((p) => {
      const real = latLonToWorld(p, origin);
      const renderX = real.x * horizontalScale;
      const renderZ = real.z * horizontalScale;
      const y = terrain.getHeightAt(renderX, renderZ) + GRID_Y_LIFT;
      return new Vector3(renderX, y, renderZ);
    });
    const mesh = MeshBuilder.CreateLines(`grid_${line.axis}_${i}`, { points: path }, scene);
    mesh.color = GRID_LINE_COLOR;
    mesh.alpha = GRID_LINE_ALPHA;
    return mesh;
  });
}

export type TerrainVisibilityState = {
  terrain: boolean;
  osm: boolean;
  gpx: boolean;
  grid: boolean;
};

// Owns the heightmap mesh plus its three draped overlays (OSM trails, the
// recorded GPX track, the lat/lon measurement grid) as one unit, since all
// four are disposed and rebuilt together on every hScale/vExag rescale
// (see rebuild()) and the overlays' own draping depends on the terrain
// mesh's getHeightAt existing first. Implements ITerrain directly so it can
// stand in for the terrain anywhere a plain HeightmapTerrain used to be
// passed (PlayerController.setTerrain, DriveController.setTerrain, the
// tree/location/mech-dog height lookups elsewhere in the app).
export class TerrainOverlaySystem implements ITerrain {
  private terrain: HeightmapTerrain;
  private trailMeshes: Mesh[];
  private gpxMeshes: Mesh[];
  private gridMeshes: Mesh[];
  private readonly gridLines: GraticuleLine[];

  constructor(
    private readonly scene: Scene,
    private readonly sampler: HeightmapSampler,
    private readonly contract: HeightmapContract,
    private readonly origin: UtmCoordinate,
    private readonly gridResolution: number,
    private readonly trails: GeoPolyline[],
    private readonly gpxTrack: GeoPolyline[],
    hScale: number,
    vExag: number,
    lowColor: Color3,
    highColor: Color3,
    initialVisible: TerrainVisibilityState,
  ) {
    this.terrain = this.buildTerrainMesh(hScale, vExag, lowColor, highColor);
    // Generated once from the heightmap's real (unscaled) UTM bbox — the
    // lat/lon line values themselves don't depend on hScale/vExag, only the
    // meshes built from them do (see rebuild()).
    this.gridLines = graticuleLines(contract.bbox, GRID_INTERVAL_DEG, GRID_LINE_SAMPLES);
    this.trailMeshes = this.buildTrailMeshes(hScale);
    this.gpxMeshes = this.buildGpxMeshes(hScale);
    this.gridMeshes = this.buildGridMeshes(hScale);
    // Terrain/OSM/GPX meshes default enabled (matching their visibility
    // signals' own `true` default — state/visibility.ts), so only the grid
    // needs an explicit initial sync: it's the one layer that defaults off
    // (a measurement layer, not something every session should pay
    // rendering cost for unless explicitly enabled) and its mesh would
    // otherwise render regardless of that default. A rescale's rebuild()
    // below re-syncs all four, since fresh meshes always start enabled.
    setMeshesEnabled(this.gridMeshes, initialVisible.grid);
  }

  getHeightAt(x: number, z: number): number {
    return this.terrain.getHeightAt(x, z);
  }

  getMesh(): Mesh {
    return this.terrain.getMesh();
  }

  setTerrainVisible(visible: boolean): void {
    this.terrain.setVisible(visible);
  }

  setOsmVisible(visible: boolean): void {
    setMeshesEnabled(this.trailMeshes, visible);
  }

  setGpxVisible(visible: boolean): void {
    setMeshesEnabled(this.gpxMeshes, visible);
  }

  setGridVisible(visible: boolean): void {
    setMeshesEnabled(this.gridMeshes, visible);
  }

  // Live scale tuning (level 1) dispose/recreates the terrain mesh and both
  // trail overlays from scratch at the new hScale/vExag — see rebuildWorld's
  // own comment in main.tsx for why this can't just be a cheap setScale.
  rebuild(hScale: number, vExag: number, lowColor: Color3, highColor: Color3, visible: TerrainVisibilityState): void {
    this.disposeMeshes();
    this.terrain = this.buildTerrainMesh(hScale, vExag, lowColor, highColor);
    this.trailMeshes = this.buildTrailMeshes(hScale);
    this.gpxMeshes = this.buildGpxMeshes(hScale);
    this.gridMeshes = this.buildGridMeshes(hScale);
    this.terrain.setVisible(visible.terrain);
    setMeshesEnabled(this.trailMeshes, visible.osm);
    setMeshesEnabled(this.gpxMeshes, visible.gpx);
    setMeshesEnabled(this.gridMeshes, visible.grid);
  }

  dispose(): void {
    this.disposeMeshes();
  }

  private disposeMeshes(): void {
    this.terrain.dispose();
    this.trailMeshes.forEach((m) => m.dispose());
    this.gpxMeshes.forEach((m) => m.dispose());
    this.gridMeshes.forEach((m) => m.dispose());
  }

  // getHeightAt (used for player collision + trail draping) samples the
  // ORIGINAL fine-resolution DEM directly, but the rendered mesh only has
  // vertices every (width/gridResolution) meters and linearly interpolates
  // between them — so wherever real terrain curves between two mesh
  // vertices, the coarse rendered surface can drift from the true DEM
  // height there, and verticalExaggeration multiplies that drift right
  // along with the real relief. gridResolution is chosen per level (see
  // state/levels.ts) to keep roughly one mesh quad per DEM pixel.
  private buildTerrainMesh(hScale: number, vExag: number, lowColor: Color3, highColor: Color3): HeightmapTerrain {
    return new HeightmapTerrain(this.scene, this.sampler, this.contract, this.origin, {
      gridResolution: this.gridResolution,
      verticalExaggeration: vExag,
      horizontalScale: hScale,
      lowElevationColor: lowColor,
      highElevationColor: highColor,
      slopeTextures: TERRAIN_SLOPE_TEXTURES,
    });
  }

  private buildTrailMeshes(hScale: number): Mesh[] {
    return buildPolylineMeshes(this.scene, this.trails, this.terrain, this.origin, {
      namePrefix: 'osmTrail',
      yLift: OSM_TRAIL_Y_LIFT,
      horizontalScale: hScale,
      colorFor: blazeColorFromTags,
    });
  }

  private buildGpxMeshes(hScale: number): Mesh[] {
    return buildPolylineMeshes(this.scene, this.gpxTrack, this.terrain, this.origin, {
      namePrefix: 'gpxTrack',
      yLift: GPX_TRACK_Y_LIFT,
      horizontalScale: hScale,
      colorFor: () => GPX_TRACK_COLOR,
    });
  }

  private buildGridMeshes(hScale: number): Mesh[] {
    return buildGraticuleMeshes(this.scene, this.gridLines, this.terrain, this.origin, hScale);
  }
}
