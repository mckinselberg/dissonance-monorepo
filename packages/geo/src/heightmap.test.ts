import { encode } from 'fast-png';
import { describe, expect, it } from 'vitest';
import { decodeHeightmapPng, HeightmapSampler, type HeightmapContract } from './heightmap';

// A 4x4 grid, row-major, row 0 = north (maxZ) per PNG row order.
// prettier-ignore
const GRID = [
    0,  10,  20,  30,
   40,  50,  60,  70,
   80,  90, 100, 110,
  120, 130, 140, 150,
];

// bbox chosen so 1 UTM/world unit = 1 pixel, and origin = (0,0) so
// world space equals UTM space directly — isolates the bilinear math
// from the origin-offset math (already covered in projection.test.ts).
const CONTRACT: HeightmapContract = {
  crs: 'EPSG:26918',
  bbox: { minX: 0, minZ: 0, maxX: 3, maxZ: 3 },
  pixelWidth: 4,
  pixelHeight: 4,
  elevation: { min: 0, max: 150 },
};
const ORIGIN = { x: 0, y: 0 };

describe('HeightmapSampler', () => {
  const sampler = new HeightmapSampler(new Float32Array(GRID), CONTRACT, ORIGIN);

  it('returns exact grid values at pixel centers', () => {
    expect(sampler.sampleHeight({ x: 0, z: 3 })).toBeCloseTo(0, 6); // row0, col0 (north-west)
    expect(sampler.sampleHeight({ x: 1, z: 3 })).toBeCloseTo(10, 6); // row0, col1
    expect(sampler.sampleHeight({ x: 0, z: 0 })).toBeCloseTo(120, 6); // row3, col0 (south-west)
  });

  it('interpolates linearly along a single row', () => {
    // Halfway between row0[0]=0 and row0[1]=10.
    expect(sampler.sampleHeight({ x: 0.5, z: 3 })).toBeCloseTo(5, 6);
  });

  it('interpolates linearly along a single column', () => {
    // Halfway between row0[0]=0 (z=3, north) and row1[0]=40 (z=2).
    expect(sampler.sampleHeight({ x: 0, z: 2.5 })).toBeCloseTo(20, 6);
  });

  it('interpolates bilinearly across all four corners', () => {
    // Average of row0[0]=0, row0[1]=10, row1[0]=40, row1[1]=50.
    expect(sampler.sampleHeight({ x: 0.5, z: 2.5 })).toBeCloseTo(25, 6);
  });

  it('clamps out-of-bounds world coordinates to the heightmap edge', () => {
    expect(sampler.sampleHeight({ x: 5, z: 3 })).toBeCloseTo(30, 6); // clamps to row0[3]
    expect(sampler.sampleHeight({ x: 0, z: -5 })).toBeCloseTo(120, 6); // clamps to row3[0]
  });
});

describe('decodeHeightmapPng', () => {
  it('decodes a 16-bit grayscale PNG back into meters using the elevation contract', () => {
    const raw = new Uint16Array([0, 32768, 65535, 16384]);
    const pngBytes = encode({ width: 2, height: 2, data: raw, depth: 16, channels: 1 });

    const contract: HeightmapContract = {
      crs: 'EPSG:26918',
      bbox: { minX: 0, minZ: 0, maxX: 1, maxZ: 1 },
      pixelWidth: 2,
      pixelHeight: 2,
      elevation: { min: 100, max: 200 },
    };

    const elevations = decodeHeightmapPng(pngBytes, contract);
    expect(elevations[0]).toBeCloseTo(100, 1); // 0        -> min
    expect(elevations[1]).toBeCloseTo(150, 1); // 32768/65535 ~ 0.5 -> midpoint
    expect(elevations[2]).toBeCloseTo(200, 1); // 65535    -> max
    expect(elevations[3]).toBeCloseTo(125, 1); // 16384/65535 ~ 0.25
  });

  it('throws if the decoded PNG dimensions do not match the contract', () => {
    const raw = new Uint16Array([0, 0, 0, 0]);
    const pngBytes = encode({ width: 2, height: 2, data: raw, depth: 16, channels: 1 });
    const contract: HeightmapContract = {
      crs: 'EPSG:26918',
      bbox: { minX: 0, minZ: 0, maxX: 1, maxZ: 1 },
      pixelWidth: 3,
      pixelHeight: 2,
      elevation: { min: 0, max: 1 },
    };
    expect(() => decodeHeightmapPng(pngBytes, contract)).toThrow();
  });
});
