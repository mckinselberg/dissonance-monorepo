import { Mesh, VertexBuffer, VertexData } from '@babylonjs/core';

export function fadeCurve(t: number): number { return t * t * (3 - 2 * t); }

export function hash3(ix: number, iy: number, iz: number, s: number): number {
  let n = (ix * 1619 + iy * 31337 + iz * 6971 + s * 1031) | 0;
  n = (n ^ (n << 13)) | 0;
  n = (n * (n * n * 15731 + 789221) + 1376312589) | 0;
  return (n & 0x7fffffff) / 0x7fffffff;
}

export function noise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fadeCurve(fx), uy = fadeCurve(fy), uz = fadeCurve(fz);

  const c000 = hash3(ix,     iy,     iz,     seed);
  const c100 = hash3(ix + 1, iy,     iz,     seed);
  const c010 = hash3(ix,     iy + 1, iz,     seed);
  const c110 = hash3(ix + 1, iy + 1, iz,     seed);
  const c001 = hash3(ix,     iy,     iz + 1, seed);
  const c101 = hash3(ix + 1, iy,     iz + 1, seed);
  const c011 = hash3(ix,     iy + 1, iz + 1, seed);
  const c111 = hash3(ix + 1, iy + 1, iz + 1, seed);

  const x00 = c000 + (c100 - c000) * ux;
  const x10 = c010 + (c110 - c010) * ux;
  const x01 = c001 + (c101 - c001) * ux;
  const x11 = c011 + (c111 - c011) * ux;

  const y0 = x00 + (x10 - x00) * uy;
  const y1 = x01 + (x11 - x01) * uy;

  return y0 + (y1 - y0) * uz;
}

// Pushes each vertex of a (roughly spherical, origin-centered) mesh outward or
// inward along its own normal direction by an amount sampled from 3D value
// noise. Breaks the perfect-sphere silhouette into an organic lumpy blob.
// Must run before the mesh is positioned/scaled into the world.
export function displaceToBlob(mesh: Mesh, strength: number, freq: number, seed: number): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) as Float32Array;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    const nx = x / len, ny = y / len, nz = z / len;
    const n = noise3(nx * freq + seed, ny * freq + seed, nz * freq + seed, seed);
    const scale = 1 + (n - 0.5) * 2 * strength;
    positions[i]     = nx * len * scale;
    positions[i + 1] = ny * len * scale;
    positions[i + 2] = nz * len * scale;
  }
  mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
  const indices = mesh.getIndices()!;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
}

// Pushes vertices of a cone/cylinder-like mesh outward/inward in the XZ
// plane only, based on noise sampled from angle-around-Y and height-along-Y.
// Turns a perfectly round cone into a jagged, ridged silhouette. Vertices
// right on the central axis (the apex, r ~ 0) get nudged sideways instead —
// a perfectly centered apex is what makes a cone read as a "drawn triangle";
// offsetting it breaks the symmetry the eye latches onto.
export function displaceRadial(mesh: Mesh, strength: number, seed: number): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) as Float32Array;
  let maxR = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], z = positions[i + 2];
    maxR = Math.max(maxR, Math.sqrt(x * x + z * z));
  }
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const r = Math.sqrt(x * x + z * z);
    if (r < 0.001) {
      const an = noise3(y * 0.3 + seed, seed, seed, seed) * Math.PI * 2;
      const off = noise3(seed, y * 0.3 + seed, seed, seed) * strength * maxR * 0.22;
      positions[i]     = Math.cos(an) * off;
      positions[i + 2] = Math.sin(an) * off;
      continue;
    }
    const angle = Math.atan2(z, x);
    const n = noise3(Math.cos(angle) * 2.2 + seed, Math.sin(angle) * 2.2 + seed, y * 0.12 + seed, seed);
    const scale = 1 + (n - 0.5) * 2 * strength;
    positions[i]     = x * scale;
    positions[i + 2] = z * scale;
  }
  mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
  const indices = mesh.getIndices()!;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
}
