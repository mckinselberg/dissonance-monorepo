import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import type { LocationEntry } from './LocationProps';

// The diegetic collectible half of state/lineglass.ts's tiered unlock —
// see that module's own comment for scope (one small slice of docs/plans/
// dissonance-lineglass-engineering-review-prompt.md, not the full device).
// Deliberately NOT thin-instanced like everything else in this file's
// neighborhood (CompositeLocations/UtilityCorridors): there are only ever
// a handful of these, each needs independently controllable visibility
// (hide on pickup, stay hidden if already collected on load), and thin
// instances don't expose that per-instance without extra buffer work not
// worth it at this count.
const PICKUP_RADIUS_METERS = 2.5;
// Small enough to read as "a held device component", floating above the
// ground so it doesn't get lost in sidewalk/grass clutter. Faceted rather
// than round — a fragment of hard-edged municipal equipment, not a game-y
// glowing orb.
const PART_RADIUS = 0.22;
const PART_HOVER_HEIGHT = 1.1;
const PART_SPIN_RADIANS_PER_SECOND = 0.8;
// Cyan + warm amber together, echoing the Lineglass doc's own palette
// (§8: "cyan edges", "warm amber... points of importance") rather than
// picking one — this is the device's own component, it gets both.
const PART_COLOR = new Color3(0.55, 0.85, 0.9);
const PART_EMISSIVE = new Color3(0.35, 0.75, 0.85);
const PART_ACCENT_EMISSIVE = new Color3(0.95, 0.65, 0.25);

export interface LineglassPartsHandle {
  // Called once per frame with dt (seconds) and the active controller's
  // current x/z (render space) — returns ids newly collected this frame
  // (empty most frames). Already-collected parts (see `alreadyCollected` at
  // load time) never appear here again.
  update(dt: number, playerX: number, playerZ: number): string[];
  dispose(): void;
}

function buildPartMesh(scene: Scene, name: string): Mesh {
  const mat = new PBRMaterial(`${name}_mat`, scene);
  mat.albedoColor = PART_COLOR;
  mat.emissiveColor = PART_EMISSIVE;
  mat.roughness = 0.25;
  mat.metallic = 0.6;

  const body = MeshBuilder.CreatePolyhedron(name, { type: 2, size: PART_RADIUS }, scene); // type 2 = octahedron
  body.material = mat;

  const accentMat = new PBRMaterial(`${name}_accent_mat`, scene);
  accentMat.albedoColor = PART_ACCENT_EMISSIVE;
  accentMat.emissiveColor = PART_ACCENT_EMISSIVE;
  accentMat.roughness = 0.3;
  accentMat.metallic = 0.4;
  const accent = MeshBuilder.CreateSphere(`${name}_accent`, { diameter: PART_RADIUS * 0.5 }, scene);
  accent.material = accentMat;
  accent.parent = body;

  return body;
}

// Reads every location's `lineglassParts` (see LocationProps.ts), places
// each as its own small hovering, spinning part, and reports pickups by
// proximity — no interact key, matching this app's existing "walking near
// it is enough" collision/placement conventions rather than adding a new
// input binding for one feature.
export function loadLineglassParts(
  scene: Scene,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  getHeightAt: (x: number, z: number) => number,
  alreadyCollected: ReadonlySet<string>,
): LineglassPartsHandle {
  const pending: Array<{ id: string; mesh: Mesh; x: number; z: number }> = [];
  const allMeshes: Mesh[] = [];

  for (const location of locations) {
    if (!location.lineglassParts) continue;
    const anchor = toRenderXZ(location.latLong[0], location.latLong[1]);
    for (const part of location.lineglassParts) {
      const x = anchor.x + part.local[0] * horizontalScale;
      const z = anchor.z + part.local[1] * horizontalScale;
      const mesh = buildPartMesh(scene, `lineglassPart_${part.id}`);
      const groundY = getHeightAt(x, z);
      mesh.position.set(x, groundY + PART_HOVER_HEIGHT, z);
      allMeshes.push(mesh);

      if (alreadyCollected.has(part.id)) {
        mesh.setEnabled(false);
        continue;
      }
      pending.push({ id: part.id, mesh, x, z });
    }
  }

  let spinPhase = 0;
  return {
    update(dt: number, playerX: number, playerZ: number): string[] {
      spinPhase += PART_SPIN_RADIANS_PER_SECOND * dt;
      const collectedThisFrame: string[] = [];
      const radius = PICKUP_RADIUS_METERS * horizontalScale;
      for (let i = pending.length - 1; i >= 0; i--) {
        const part = pending[i];
        part.mesh.rotation.y = spinPhase;
        const dx = playerX - part.x;
        const dz = playerZ - part.z;
        if (dx * dx + dz * dz <= radius * radius) {
          part.mesh.setEnabled(false);
          collectedThisFrame.push(part.id);
          pending.splice(i, 1);
        }
      }
      return collectedThisFrame;
    },
    dispose() {
      allMeshes.forEach((mesh) => mesh.dispose());
    },
  };
}
