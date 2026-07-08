import { decode } from 'fast-png';
import type { UtmCoordinate, WorldXZ } from './projection';
import { worldToUtm } from './projection';

export type HeightmapBoundingBox = { minX: number; minZ: number; maxX: number; maxZ: number };

// Mirrors the shape of smr-heightmap.json (docs/plans/dissonance-trail-data-poc-prompt.md) —
// the "projection contract" recorded when the DEM was exported from QGIS.
export type HeightmapContract = {
  crs: string;
  bbox: HeightmapBoundingBox;
  pixelWidth: number;
  pixelHeight: number;
  elevation: { min: number; max: number };
};

export function decodeHeightmapPng(pngBytes: Uint8Array, contract: HeightmapContract): Float32Array {
  const png = decode(pngBytes);
  if (png.width !== contract.pixelWidth || png.height !== contract.pixelHeight) {
    throw new Error(
      `Heightmap PNG dimensions (${png.width}x${png.height}) don't match contract ` +
      `(${contract.pixelWidth}x${contract.pixelHeight})`,
    );
  }

  const { min, max } = contract.elevation;
  const elevations = new Float32Array(png.width * png.height);
  for (let i = 0; i < elevations.length; i++) {
    elevations[i] = min + (png.data[i] / 65535) * (max - min);
  }
  return elevations;
}

// Bilinear-samples the decoded heightmap in world space — mirrors the
// existing procedural Terrain.getHeightAt(x, z) contract
// (packages/world/src/Terrain.ts) so HeightmapTerrain can satisfy the same
// interface.
export class HeightmapSampler {
  constructor(
    private readonly elevations: Float32Array,
    private readonly contract: HeightmapContract,
    private readonly origin: UtmCoordinate,
  ) {}

  sampleHeight(world: WorldXZ): number {
    const { bbox, pixelWidth, pixelHeight } = this.contract;
    const utm = worldToUtm(world, this.origin);

    const u = ((utm.x - bbox.minX) / (bbox.maxX - bbox.minX)) * (pixelWidth - 1);
    // Row 0 of the decoded PNG is the northernmost (maxZ) row, so v grows
    // as northing decreases.
    const v = ((bbox.maxZ - utm.y) / (bbox.maxZ - bbox.minZ)) * (pixelHeight - 1);

    const cu = Math.max(0, Math.min(pixelWidth - 1, u));
    const cv = Math.max(0, Math.min(pixelHeight - 1, v));

    const ix = Math.min(pixelWidth - 2, Math.floor(cu));
    const iz = Math.min(pixelHeight - 2, Math.floor(cv));
    const fx = cu - ix;
    const fz = cv - iz;

    const at = (x: number, z: number) => this.elevations[z * pixelWidth + x];
    const h00 = at(ix, iz);
    const h10 = at(ix + 1, iz);
    const h01 = at(ix, iz + 1);
    const h11 = at(ix + 1, iz + 1);

    return (
      h00 * (1 - fx) * (1 - fz) +
      h10 * fx * (1 - fz) +
      h01 * (1 - fx) * fz +
      h11 * fx * fz
    );
  }
}
