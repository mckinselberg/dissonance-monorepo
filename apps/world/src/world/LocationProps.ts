import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Matrix,
  Quaternion,
  Vector3,
} from '@babylonjs/core';
import type { ShadowGenerator } from '@babylonjs/core';
import type { Collider } from '@dissonance/world';

export type LocationEntry = {
  // Stable authored identity. Names are labels and may change; array order is
  // not identity. Saves, compass targets, docking, and future replication
  // refer to this key instead.
  id: string;
  name: string;
  latLong: [number, number];
  tags?: string[];
  props?: string[];
  compound?: {
    // Local grid measured from latLong. Keeping the anchor geographic and
    // the authored layout metric makes a whole block move as one location
    // without turning every curb/building into its own lat/long landmark.
    cellMeters: number;
    rotationDegrees?: number;
    placements: Array<{
      asset: string;
      grid: [number, number];
      rotationDegrees?: number;
      scale?: number;
      repeat?: {
        count: number;
        step: [number, number];
      };
      // Stable identity for a single (non-repeated) placement — e.g. singling
      // one specific building out of an otherwise-anonymous thin-instanced
      // row for collision exceptions or later T26 identified-overlay
      // hookup. Only meaningful without `repeat` (every repeated instance
      // sharing one placement entry has no way to carry distinct ids yet).
      id?: string;
    }>;
  };
  // A utility/power-line corridor — a freeform polyline (not grid-snapped
  // like `compound`, since a real right-of-way runs at whatever bearing it
  // actually takes), consumed by UtilityCorridors.ts. Same "local meters
  // from latLong" anchor convention as `compound`'s grid, so a corridor
  // moves with its location as one unit. Independent of `compound` — an
  // entry may have either, both, or neither.
  corridor?: {
    path: Array<[number, number]>;
    poleSpacingMeters: number;
    wireCount: number;
    // When true, `path`'s first and last points are only a position +
    // direction seed — UtilityCorridors.ts extends both open ends outward
    // along their own line until they hit the loaded DEM's real bounding
    // box ("the edge of the world"), rather than stopping at the authored
    // coordinates. Interior points (if any) are left alone.
    extendToWorldBounds?: boolean;
  };
  // Diegetic Lineglass parts (see world/LineglassParts.ts, state/
  // lineglass.ts) — exact local-meter offsets from `latLong`, same
  // convention as `corridor.path`. Deliberately its own field rather than
  // another `props` entry: props are jittered single-cluster placements
  // (see PLACEMENT_JITTER_METERS below), but a part collected via proximity
  // pickup needs an exact, individually-addressable position and a stable
  // id `state/lineglass.ts` can persist.
  lineglassParts?: Array<{ id: string; local: [number, number] }>;
  // Individually-addressable, app-local surveillance agents. Route points
  // use the same local-meter convention as corridor.path/lineglassParts.
  patrolDrones?: Array<{
    id: string;
    route: Array<[number, number]>;
    speedMetersPerSecond?: number;
    altitudeMeters?: number;
  }>;
  strikeAnchors?: Array<{
    id: string;
    local: [number, number];
    patrolDroneRef: string;
    eligible: boolean;
    weight?: number;
  }>;
  shelterEntrance?: {
    local: [number, number];
    headingDegrees: number;
  };
};

export interface LocationPropsHandle {
  // One collider per placed prop instance, in the same render-space x/z
  // PlayerController already collides against (see main.tsx's
  // player.setColliders wiring) — built alongside placement so it can never
  // drift from what's actually rendered.
  colliders: Collider[];
  dispose(): void;
}

// Small lateral jitter so multiple props listed on the same location entry
// (e.g. a future picnic-grounds location with both 'picnic-table' and
// 'trash-barrel') don't land stacked on the exact same point.
const PLACEMENT_JITTER_METERS = 3;

function mergeParts(name: string, parts: Mesh[], mat: PBRMaterial): Mesh {
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true) ?? parts[0];
  merged.name = name;
  merged.material = mat;
  return merged;
}

function pbr(scene: Scene, name: string, color: Color3, roughness = 0.9, metallic = 0): PBRMaterial {
  const mat = new PBRMaterial(name, scene);
  mat.albedoColor = color;
  mat.roughness = roughness;
  mat.metallic = metallic;
  return mat;
}

// Every builder below is a crude primitive stand-in for a prop named in
// THREADS.md (T22's asset queue / picnic-grounds / stairway / creek-
// corridor sections) that doesn't have an authored or downloaded asset
// yet — same "cheap template, thin-instance it" technique ThinInstanceTrees
// already uses for trees, just for hardscape/deadfall props instead.
// Meant to be swapped for real assets later without touching the placement
// system (scatterLocationProps) at all — only PROP_BUILDERS changes.

// Simplest possible placeholder trees — not meant to compete with (or
// duplicate) HeroTreeInstances' real Poly Haven trees; this is for
// location entries that just want "a few trees here" without pulling in
// the async GLB pipeline. Same trunk-cylinder + canopy-cone shape
// ThinInstanceTrees uses for its own conifer archetype, minus the variety;
// clustered like buildRocks rather than a single lonely tree.
function buildSimpleTree(scene: Scene): Mesh {
  const trunkMat = pbr(scene, 'locProp_treeTrunkMat', new Color3(0.1, 0.07, 0.04), 0.95);
  const canopyMat = pbr(scene, 'locProp_treeCanopyMat', new Color3(0.08, 0.28, 0.12), 0.85);
  const parts: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const height = 3 + Math.random() * 2;
    const trunkHeight = height * 0.4;
    const canopyHeight = height - trunkHeight;
    const offsetX = (Math.random() - 0.5) * 4;
    const offsetZ = (Math.random() - 0.5) * 4;
    const trunk = MeshBuilder.CreateCylinder(`treeTrunk_${i}`, {
      height: trunkHeight, diameterBottom: 0.4, diameterTop: 0.3, tessellation: 6,
    }, scene);
    trunk.position.set(offsetX, trunkHeight / 2, offsetZ);
    parts.push(trunk);
    const canopy = MeshBuilder.CreateCylinder(`treeCanopy_${i}`, {
      height: canopyHeight, diameterBottom: canopyHeight * 0.6, diameterTop: 0, tessellation: 7,
    }, scene);
    canopy.position.set(offsetX, trunkHeight + canopyHeight / 2, offsetZ);
    parts.push(canopy);
  }
  parts.forEach((p, i) => { p.material = i % 2 === 0 ? trunkMat : canopyMat; });
  // Not mergeParts — that helper always applies one shared material after
  // merging, which would clobber the per-part trunk/canopy materials just
  // set above. multiMultiMaterials preserves them as a MultiMaterial instead.
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true) ?? parts[0];
  merged.name = 'locProp_trees';
  return merged;
}

// "Dissonance Boulevard" placeholder — THREADS.md's T13 excavation of the
// Godot Surveillance Boulevard PoC names globe-in-cage street lamps as its
// single most distinctive urban-edge prop (rhymes with the catenary-wire
// vertical rhythm), so that's the one piece worth a placeholder ahead of
// any real boulevard-layout work. Cage is literal thin bars rather than a
// solid shade, nodding to the PoC's other named strongest visual identity
// ("wireframe-over-mass aesthetic — the world rendered the way SignalNet
// parses it") without trying to fake a real wireframe shader here.
// Exported (unlike its sibling builders) so CompositeLocations.ts can place
// it as a repeated compound-grid module alongside the city kit's glTF
// assets — a lamp row down the sidewalk, not just the one jittered instance
// scatterLocationProps gives every plain prop type.
export function buildStreetLamp(scene: Scene): Mesh {
  const poleMat = pbr(scene, 'locProp_lampPoleMat', new Color3(0.05, 0.05, 0.06), 0.5, 0.7);
  const globeMat = new PBRMaterial('locProp_lampGlobeMat', scene);
  globeMat.albedoColor = new Color3(0.9, 0.7, 0.3);
  globeMat.emissiveColor = new Color3(0.9, 0.6, 0.15); // warm amber, T22's palette note: warm reserved for carry light/interactables
  globeMat.roughness = 0.4;
  globeMat.metallic = 0;

  const parts: Mesh[] = [];
  const pole = MeshBuilder.CreateCylinder('lampPole', { height: 4, diameter: 0.12, tessellation: 8 }, scene);
  pole.position.y = 2;
  parts.push(pole);
  const cageBarCount = 6;
  for (let i = 0; i < cageBarCount; i++) {
    const angle = (i / cageBarCount) * Math.PI * 2;
    const bar = MeshBuilder.CreateCylinder(`lampCageBar_${i}`, { height: 0.6, diameter: 0.025, tessellation: 4 }, scene);
    bar.position.set(Math.cos(angle) * 0.28, 4.3, Math.sin(angle) * 0.28);
    parts.push(bar);
  }
  const poleMerged = Mesh.MergeMeshes(parts, true, true, undefined, false, true) ?? parts[0];
  poleMerged.material = poleMat;

  const globe = MeshBuilder.CreateSphere('lampGlobe', { diameter: 0.5, segments: 10 }, scene);
  globe.position.y = 4.3;
  globe.material = globeMat;

  const merged = Mesh.MergeMeshes([poleMerged, globe], true, true, undefined, false, true) ?? poleMerged;
  merged.name = 'locProp_streetLamp';
  return merged;
}

// Utility pole for power-corridor rows (UtilityCorridors.ts) — same
// "template mesh, thin-instance the placements" split as buildStreetLamp
// above, exported for the same reason: a different module needs to place
// this repeatedly along a spline rather than scatterLocationProps' own
// jittered-single-instance-per-location path. Built base-up from local
// y=0 so UtilityCorridors' thin-instance matrices can scale it directly
// without the min-Y compensation CompositeLocations needs for glTF meshes.
export function buildUtilityPole(scene: Scene): Mesh {
  const mat = pbr(scene, 'locProp_utilityPoleMat', new Color3(0.22, 0.16, 0.1), 0.95);
  const height = 10;
  const parts: Mesh[] = [];
  const pole = MeshBuilder.CreateCylinder('utilityPole', {
    height, diameterBottom: 0.35, diameterTop: 0.22, tessellation: 8,
  }, scene);
  pole.position.y = height / 2;
  parts.push(pole);
  const crossarm = MeshBuilder.CreateBox('utilityCrossarm', { width: 2.4, height: 0.15, depth: 0.15 }, scene);
  crossarm.position.y = height - 0.6;
  parts.push(crossarm);
  return mergeParts('locProp_utilityPole', parts, mat);
}

// Local-space (the building's own coordinate frame, matching the real
// bounds scanned off Building_Medium_2_001.gltf: X approx [-7,7], Z approx
// [-12,0] front-to-back with the glass front at Z~0, Y=0 at the ground
// floor) — CompositeLocations.ts transforms these into world-space
// PlayerController.FloorSurfaces using the same placement math it
// positions the building mesh itself with.
export type LocalFloorSurface = { minX: number; maxX: number; minZ: number; maxZ: number; y: number };

export interface MilosInteriorResult {
  meshes: Mesh[];
  floorSurfaces: LocalFloorSurface[];
}

// Milo's building only (Dan, 2026-07-27: "add a door? and an interior
// stairwell that leads to a second floor apartment?"). Building_Medium_2's
// own geometry has no real door gap or second story to build on — its
// front is one continuous glass pane (MI_Glass, checked directly against
// the glTF's accessor bounds) and "MI_InteriorWall"/"MI_InteriorFloor" are
// a flat one-sided ground-floor backdrop (floor + back wall, no enclosing
// side walls), not a real room. This adds actual geometry on top: a door
// visually distinct from the neighboring buildings' uniform glass facade,
// a rising flight of steps, and an open-topped second-floor room shell —
// same crude-primitive style as every other prop in this file, positioned
// from the building's own scanned bounds so nothing poke through its
// exterior walls. Caller (CompositeLocations.ts) parents every mesh here
// to the already-placed building mesh so they inherit its transform.
export function buildMilosInterior(scene: Scene): MilosInteriorResult {
  const meshes: Mesh[] = [];
  const floorSurfaces: LocalFloorSurface[] = [];

  const doorMat = pbr(scene, 'milos_doorMat', new Color3(0.32, 0.2, 0.12), 0.7);
  const door = MeshBuilder.CreateBox('milos_door', { width: 1.5, height: 2.3, depth: 0.14 }, scene);
  door.position.set(-2, 1.15, -0.07);
  door.material = doorMat;
  meshes.push(door);

  // 11 steps x 0.36m rise = ~4m, landing at the second floor. Runs along
  // the building's own depth axis, offset to the side of the door so
  // crossing the lobby to reach it reads as a real room, not a closet.
  const stairMat = pbr(scene, 'milos_stairMat', new Color3(0.35, 0.32, 0.28), 0.85);
  const stepCount = 11;
  const stepHeight = 0.36;
  const stepDepth = 0.32;
  const stepWidth = 2.0;
  const stepX = 2.4;
  const stairStartZ = -1.2;
  const stairParts: Mesh[] = [];
  for (let i = 0; i < stepCount; i++) {
    const stepZ = stairStartZ - i * stepDepth;
    const step = MeshBuilder.CreateBox(`milos_step_${i}`, {
      width: stepWidth, height: stepHeight, depth: stepDepth,
    }, scene);
    step.position.set(stepX, stepHeight * (i + 0.5), stepZ);
    stairParts.push(step);
    floorSurfaces.push({
      minX: stepX - stepWidth / 2,
      maxX: stepX + stepWidth / 2,
      minZ: stepZ - stepDepth / 2,
      maxZ: stepZ + stepDepth / 2,
      y: stepHeight * (i + 1),
    });
  }
  meshes.push(mergeParts('milos_stairwell', stairParts, stairMat));

  // Open-topped — the building's own roof geometry sits far above this (Y
  // up to ~24-25), no ceiling needed. Inset from the scanned exterior
  // bounds (X[-7,7] Z[-12,0]) so the walls don't poke through the
  // building's own brick/trim shell. The stairwell's top step (stepX=2.4,
  // furthest stairZ) lands inside this rectangle, not at its edge, so the
  // full perimeter below doesn't wall off the one way in.
  const floorY = stepHeight * stepCount + 0.15;
  const roomMinX = -6.3;
  const roomMaxX = 6.3;
  const roomMinZ = -11.3;
  const roomMaxZ = -0.9;
  const roomWidth = roomMaxX - roomMinX;
  const roomDepth = roomMaxZ - roomMinZ;
  const roomCenterX = (roomMinX + roomMaxX) / 2;
  const roomCenterZ = (roomMinZ + roomMaxZ) / 2;

  const floorMat = pbr(scene, 'milos_apartmentFloorMat', new Color3(0.3, 0.24, 0.18), 0.85);
  const floorSlab = MeshBuilder.CreateBox('milos_apartmentFloor', {
    width: roomWidth, height: 0.3, depth: roomDepth,
  }, scene);
  floorSlab.position.set(roomCenterX, floorY, roomCenterZ);
  floorSlab.material = floorMat;
  meshes.push(floorSlab);
  floorSurfaces.push({
    minX: roomMinX, maxX: roomMaxX, minZ: roomMinZ, maxZ: roomMaxZ, y: floorY + 0.15,
  });

  const wallMat = pbr(scene, 'milos_apartmentWallMat', new Color3(0.42, 0.38, 0.34), 0.9);
  const wallHeight = 2.5;
  const wallThickness = 0.15;
  const wallY = floorY + 0.15 + wallHeight / 2;
  const wallParts: Mesh[] = [];
  const front = MeshBuilder.CreateBox('milos_wallFront', { width: roomWidth, height: wallHeight, depth: wallThickness }, scene);
  front.position.set(roomCenterX, wallY, roomMaxZ);
  wallParts.push(front);
  const back = MeshBuilder.CreateBox('milos_wallBack', { width: roomWidth, height: wallHeight, depth: wallThickness }, scene);
  back.position.set(roomCenterX, wallY, roomMinZ);
  wallParts.push(back);
  const left = MeshBuilder.CreateBox('milos_wallLeft', { width: wallThickness, height: wallHeight, depth: roomDepth }, scene);
  left.position.set(roomMinX, wallY, roomCenterZ);
  wallParts.push(left);
  const right = MeshBuilder.CreateBox('milos_wallRight', { width: wallThickness, height: wallHeight, depth: roomDepth }, scene);
  right.position.set(roomMaxX, wallY, roomCenterZ);
  wallParts.push(right);
  meshes.push(mergeParts('milos_apartmentWalls', wallParts, wallMat));

  return { meshes, floorSurfaces };
}

function buildRocks(scene: Scene): Mesh {
  const mat = pbr(scene, 'locProp_rocksMat', new Color3(0.42, 0.4, 0.38), 0.95);
  const parts: Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const size = 0.5 + Math.random() * 1.1;
    const rock = MeshBuilder.CreateIcoSphere(`rock_${i}`, { radius: size, subdivisions: 1 }, scene);
    rock.scaling.set(1 + Math.random() * 0.4, 0.55 + Math.random() * 0.45, 1 + Math.random() * 0.4);
    rock.position.set((Math.random() - 0.5) * 2, size * 0.3, (Math.random() - 0.5) * 2);
    rock.rotation.y = Math.random() * Math.PI * 2;
    parts.push(rock);
  }
  return mergeParts('locProp_rocks', parts, mat);
}

function buildStoneSteps(scene: Scene): Mesh {
  const mat = pbr(scene, 'locProp_stepsMat', new Color3(0.5, 0.48, 0.44));
  const parts: Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const step = MeshBuilder.CreateBox(`step_${i}`, { width: 1.4, height: 0.25, depth: 0.6 }, scene);
    step.position.set(0, i * 0.25 + 0.125, -i * 0.55);
    parts.push(step);
  }
  return mergeParts('locProp_stoneSteps', parts, mat);
}

function buildPicnicTable(scene: Scene): Mesh {
  const mat = pbr(scene, 'locProp_picnicMat', new Color3(0.35, 0.24, 0.14), 0.85);
  const parts: Mesh[] = [];
  const top = MeshBuilder.CreateBox('picnicTop', { width: 1.8, height: 0.08, depth: 0.8 }, scene);
  top.position.y = 0.75;
  parts.push(top);
  for (const side of [-0.65, 0.65]) {
    const bench = MeshBuilder.CreateBox('picnicBench', { width: 1.8, height: 0.06, depth: 0.3 }, scene);
    bench.position.set(0, 0.45, side);
    parts.push(bench);
  }
  for (const lx of [-0.8, 0.8]) {
    for (const lz of [-0.35, 0.35]) {
      const leg = MeshBuilder.CreateBox('picnicLeg', { width: 0.08, height: 0.75, depth: 0.08 }, scene);
      leg.position.set(lx, 0.375, lz);
      parts.push(leg);
    }
  }
  return mergeParts('locProp_picnicTable', parts, mat);
}

function buildTrashBarrel(scene: Scene): Mesh {
  const mat = pbr(scene, 'locProp_barrelMat', new Color3(0.15, 0.15, 0.16), 0.6, 0.6);
  const barrel = MeshBuilder.CreateCylinder('locProp_trashBarrel', {
    height: 0.9, diameterTop: 0.55, diameterBottom: 0.5, tessellation: 12,
  }, scene);
  barrel.position.y = 0.45;
  barrel.material = mat;
  return barrel;
}

function buildPostGrill(scene: Scene): Mesh {
  const mat = pbr(scene, 'locProp_grillMat', new Color3(0.12, 0.12, 0.13), 0.5, 0.7);
  const parts: Mesh[] = [];
  const post = MeshBuilder.CreateCylinder('grillPost', { height: 0.9, diameter: 0.08, tessellation: 8 }, scene);
  post.position.y = 0.45;
  parts.push(post);
  const top = MeshBuilder.CreateCylinder('grillTop', { height: 0.15, diameter: 0.5, tessellation: 12 }, scene);
  top.position.y = 0.95;
  parts.push(top);
  return mergeParts('locProp_postGrill', parts, mat);
}

function buildRootBall(scene: Scene): Mesh {
  const mat = pbr(scene, 'locProp_rootMat', new Color3(0.22, 0.15, 0.09), 0.95);
  const parts: Mesh[] = [];
  const base = MeshBuilder.CreateSphere('rootBase', { diameter: 1.2, segments: 6 }, scene);
  base.position.y = 0.6;
  parts.push(base);
  const rootCount = 7;
  for (let i = 0; i < rootCount; i++) {
    const angle = (i / rootCount) * Math.PI * 2 + Math.random() * 0.3;
    const length = 1.2 + Math.random() * 1.0;
    const root = MeshBuilder.CreateCylinder(`root_${i}`, {
      height: length, diameterTop: 0.03, diameterBottom: 0.18, tessellation: 5,
    }, scene);
    root.position.set(Math.cos(angle) * 0.5, 0.6 + length * 0.4, Math.sin(angle) * 0.5);
    root.rotation.z = Math.PI / 2 - (Math.random() * 0.6 + 0.5);
    root.rotation.y = angle;
    parts.push(root);
  }
  return mergeParts('locProp_rootBall', parts, mat);
}

function buildGiantSnag(scene: Scene): Mesh {
  const mat = pbr(scene, 'locProp_snagMat', new Color3(0.2, 0.16, 0.12), 0.95);
  const trunk = MeshBuilder.CreateCylinder('locProp_giantSnag', {
    height: 5, diameterBottom: 1.1, diameterTop: 0.5, tessellation: 8,
  }, scene);
  trunk.position.y = 2.5;
  trunk.material = mat;
  return trunk;
}

function buildMossyLog(scene: Scene): Mesh {
  const mat = pbr(scene, 'locProp_logMat', new Color3(0.24, 0.22, 0.12), 0.9);
  const log = MeshBuilder.CreateCylinder('locProp_mossyLog', { height: 2.5, diameter: 0.5, tessellation: 8 }, scene);
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.25;
  log.material = mat;
  return log;
}

function buildDeadFountain(scene: Scene): Mesh {
  const mat = pbr(scene, 'locProp_fountainMat', new Color3(0.5, 0.49, 0.46), 0.85);
  const parts: Mesh[] = [];
  const basin = MeshBuilder.CreateCylinder('fountainBasin', {
    height: 0.6, diameterTop: 0.9, diameterBottom: 0.7, tessellation: 10,
  }, scene);
  basin.position.y = 0.3;
  parts.push(basin);
  const spigot = MeshBuilder.CreateCylinder('fountainSpigot', { height: 0.3, diameter: 0.12, tessellation: 8 }, scene);
  spigot.position.y = 0.75;
  parts.push(spigot);
  return mergeParts('locProp_deadFountain', parts, mat);
}

function buildShedShell(scene: Scene): Mesh {
  const mat = pbr(scene, 'locProp_shedMat', new Color3(0.32, 0.3, 0.27), 0.9);
  const parts: Mesh[] = [];
  const walls = MeshBuilder.CreateBox('shedWalls', { width: 3, height: 2.2, depth: 3 }, scene);
  walls.position.y = 1.1;
  parts.push(walls);
  const roof = MeshBuilder.CreateBox('shedRoof', { width: 3.4, height: 0.2, depth: 3.4 }, scene);
  roof.position.y = 2.3;
  parts.push(roof);
  return mergeParts('locProp_shedShell', parts, mat);
}

const PROP_BUILDERS: Record<string, (scene: Scene) => Mesh> = {
  trees: buildSimpleTree,
  rocks: buildRocks,
  'stone-steps': buildStoneSteps,
  'picnic-table': buildPicnicTable,
  'trash-barrel': buildTrashBarrel,
  'post-grill': buildPostGrill,
  'root-ball': buildRootBall,
  'giant-snag': buildGiantSnag,
  'mossy-log': buildMossyLog,
  'dead-fountain': buildDeadFountain,
  'shed-shell': buildShedShell,
  'street-lamp': buildStreetLamp,
};

// One circle per placed instance (PlayerController's collision is
// circle-only — see @dissonance/world's Collider), eyeballed from each
// builder's own dimensions above rather than measured off a bounding box.
// Deliberately generous/round: this is a coarse "don't walk through it"
// blocker, not a tight hitbox. street-lamp/trash-barrel/post-grill are the
// odd ones out (radius smaller than their visible globe/top) since the
// solid part at player-collision height is the thin pole, not the wider
// cap sitting well above head height.
const PROP_COLLISION_RADII: Record<string, number> = {
  trees: 2.5,
  rocks: 1.5,
  'stone-steps': 1.2,
  'picnic-table': 1.2,
  'trash-barrel': 0.4,
  'post-grill': 0.4,
  'root-ball': 1.8,
  'giant-snag': 0.7,
  'mossy-log': 1.3,
  'dead-fountain': 0.6,
  'shed-shell': 2.2,
  'street-lamp': 0.3,
};

// Reads locations.json-shaped entries and thin-instances a crude primitive
// stand-in for each named prop at (a small jitter from) that location's
// real coordinates — one template mesh per prop TYPE actually referenced
// (not per location), thin-instanced across every location that lists it,
// same batching convention as HeroTreeInstances.
export function scatterLocationProps(
  scene: Scene,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  getHeightAt: (x: number, z: number) => number,
  shadowGenerator?: ShadowGenerator,
): LocationPropsHandle {
  const matricesByType = new Map<string, Matrix[]>();
  const colliders: Collider[] = [];
  for (const location of locations) {
    const [lat, lon] = location.latLong;
    const base = toRenderXZ(lat, lon);
    for (const propType of location.props ?? []) {
      if (!PROP_BUILDERS[propType]) {
        console.warn(`[LocationProps] unknown prop type "${propType}" for location "${location.name}"`);
        continue;
      }
      const x = base.x + (Math.random() - 0.5) * PLACEMENT_JITTER_METERS * 2;
      const z = base.z + (Math.random() - 0.5) * PLACEMENT_JITTER_METERS * 2;
      const y = getHeightAt(x, z);
      const matrix = Matrix.Compose(
        Vector3.One(),
        Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
        new Vector3(x, y, z),
      );
      if (!matricesByType.has(propType)) matricesByType.set(propType, []);
      matricesByType.get(propType)!.push(matrix);
      const radius = PROP_COLLISION_RADII[propType];
      if (radius !== undefined) colliders.push({ x, z, radius });
    }
  }

  const templates: Mesh[] = [];
  for (const [propType, matrices] of matricesByType) {
    const template = PROP_BUILDERS[propType](scene);
    template.receiveShadows = true;
    template.thinInstanceAdd(matrices, true);
    shadowGenerator?.addShadowCaster(template);
    templates.push(template);
    const firstPos = matrices[0].getTranslation();
    console.info(`[LocationProps] placed ${matrices.length} "${propType}" at (${firstPos.x.toFixed(1)}, ${firstPos.y.toFixed(1)}, ${firstPos.z.toFixed(1)})`);
  }

  return {
    colliders,
    dispose: () => templates.forEach((t) => t.dispose()),
  };
}
