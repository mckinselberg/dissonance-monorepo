import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { createScrollingTexture } from '@dissonance/materials';
import type { ScrollingTextureHandle } from '@dissonance/materials';
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
// Tints the scrolling readout texture (below) rather than being the sole
// emissive source — boosted above the old flat-color value since
// multiplying a muted tint against the texture's own bright streaks
// washed them out toward monochrome cyan.
const PART_BODY_EMISSIVE_TINT = new Color3(0.6, 1.15, 1.3);
const PART_ACCENT_EMISSIVE = new Color3(0.95, 0.65, 0.25);
// Body reads as a live signal readout, not a jamming/static pattern —
// echo17-signal-palette (a "live feed" strip) fits the Lineglass fiction
// (compass/map/nav device) better than echo17-scramble-screen would.
// See docs/dissonance/instanced-material-pipeline-prompt-v1.md.
const BODY_TEXTURE_PATH = '/textures/echo17-signal-palette/echo17_signal_palette_emissive_512.jpg';
const BODY_SCROLL_SPEED_U = 0.5;

export interface LineglassPartsHandle {
  // Called once per frame with dt (seconds) and the active controller's
  // current x/z (render space) — returns ids newly collected this frame
  // (empty most frames). Already-collected parts (see `alreadyCollected` at
  // load time) never appear here again.
  update(dt: number, playerX: number, playerZ: number): string[];
  dispose(): void;
}

function buildPartMesh(scene: Scene, name: string, bodyTexture: ScrollingTextureHandle['texture']): Mesh {
  const mat = new PBRMaterial(`${name}_mat`, scene);
  mat.albedoColor = PART_COLOR;
  mat.emissiveColor = PART_BODY_EMISSIVE_TINT;
  mat.emissiveTexture = bodyTexture;
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
  // One shared texture+scroll-driver for every part, not one per part —
  // they're read as the same device's readout, so synced scrolling is
  // correct, not a bug, and it avoids loading the same 512px jpeg N times.
  const bodyTexture = createScrollingTexture(scene, BODY_TEXTURE_PATH, {
    scrollSpeedU: BODY_SCROLL_SPEED_U,
  });

  for (const location of locations) {
    if (!location.lineglassParts) continue;
    const anchor = toRenderXZ(location.latLong[0], location.latLong[1]);
    for (const part of location.lineglassParts) {
      const x = anchor.x + part.local[0] * horizontalScale;
      const z = anchor.z + part.local[1] * horizontalScale;
      const mesh = buildPartMesh(scene, `lineglassPart_${part.id}`, bodyTexture.texture);
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
      bodyTexture.dispose();
    },
  };
}
