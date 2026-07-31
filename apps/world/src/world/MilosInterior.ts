import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  Texture,
  TransformNode,
} from '@babylonjs/core';
import { mergeParts, pbr } from './LocationProps';

// Local-space (the building's own coordinate frame, matching the real
// bounds scanned off Building_Medium_2_001.gltf: X approx [-7,7], Z approx
// [-12,0] front-to-back with the glass front at Z~0, Y=0 at the ground
// floor) — CompositeLocations.ts transforms these into world-space
// PlayerController.FloorSurfaces using the same placement math it
// positions the building mesh itself with.
export type LocalFloorSurface = { minX: number; maxX: number; minZ: number; maxZ: number; y: number };

// A single collider-chain point in the building's local space — one circle
// in a row of circles standing in for a solid wall (PlayerController's
// collision is circle-only, see packages/player/src/PlayerController.ts;
// this is the same technique CompositeLocations.ts's OBSTACLE_COLLISION_
// RADII bollard rows already use, just generated procedurally for a wall
// run instead of hand-authored per bollard). CompositeLocations.ts scales
// `radius` by the building placement's scaleXZ, same as every other
// collider it produces.
export interface LocalWallCollider { x: number; z: number; radius: number }

export interface LocalDoor {
  hinge: TransformNode;
  leafMesh: Mesh;
  // Point to measure player-proximity against, and the collider that sits
  // in the wall gap while the door isn't open enough to pass through — both
  // still in local space; CompositeLocations.ts converts them the same way
  // it converts everything else building-placement-dependent.
  triggerLocal: { x: number; z: number };
  gapHalfWidth: number;
  openAngleRadians: number;
}

// Building-local anchor for a loaded (not procedurally built) furniture
// GLB — CompositeLocations.ts owns the actual async load (this file only
// builds synchronous procedural geometry, see createMilosInteriorGeometry's
// own comment), but the anchor lives here so the room layout stays the one
// source of truth for where things sit relative to its own walls.
export interface LocalFurniturePlacement { x: number; y: number; z: number; rotationY: number }

export interface MilosInteriorGeometry {
  // Everything here gets parented to the building mesh by the caller
  // (CompositeLocations.ts), same as this module's previous, smaller
  // version did — this file only builds geometry/materials, it never
  // touches placement, shadows, or collision scaling itself.
  staticMeshes: Mesh[];
  wallColliders: LocalWallCollider[];
  floorSurfaces: LocalFloorSurface[];
  frontDoor: LocalDoor;
  apartmentDoor: LocalDoor;
  couch: LocalFurniturePlacement;
}

const CITY_KIT_TEXTURE_BASE = `${import.meta.env.BASE_URL}models/downtown-city-megakit/`;

// Half the player's own collision radius (packages/player/src/
// PlayerController.ts's PLAYER_RADIUS = 0.38) — spacing collider-chain
// circles this tight guarantees two neighbors always overlap enough that
// the player can never slip through the seam between them.
const WALL_COLLIDER_RADIUS = 0.2;
const WALL_COLLIDER_SPACING = 0.35;

const DOOR_WIDTH = 1.5;
const DOOR_HEIGHT = 2.3;
const DOOR_THICKNESS = 0.08;
// A bit of frame clearance beyond the leaf's own half-width, so the visual
// gap (and its matching blocker collider) aren't razor-thin against the
// door mesh.
const DOOR_GAP_HALF_WIDTH = DOOR_WIDTH / 2 + 0.1;
// Positive Y rotation swings a point starting on the hinge's local +X side
// toward local -Z — every door here hinges on its local -X edge (see
// buildDoor's hingeSign) so a positive angle always swings the leaf further
// INTO the building (deeper, more-negative Z), never back out through the
// wall it's set in.
const DOOR_OPEN_ANGLE_RADIANS = (100 * Math.PI) / 180;

// Ground-floor lobby — a modest, human-scaled carved room just inside the
// building's own glass front (Z~0), not the whole open shell (Dan, 2026-
// 07-29: carve a smaller lobby room rather than enclosing the full existing
// void). The front door keeps its original placeholder position/size.
const LOBBY_MIN_X = -4;
const LOBBY_MAX_X = 4;
const LOBBY_FRONT_Z = -0.3;
const LOBBY_BACK_Z = -2.6;
const LOBBY_WALL_HEIGHT = 2.6;
const LOBBY_WALL_THICKNESS = 0.15;
const LOBBY_CEILING_THICKNESS = 0.15;
const LOBBY_DOOR_X = -2;
// The lobby's back-wall opening lines up with the stairs beyond it — see
// STEP_X below, same value, so the two connect directly instead of Dan
// having to walk into a wall to find the gap.
const STAIR_GAP_X = 2.4;

// 11 steps x 0.36m rise = ~4m, landing at the second floor. Starts just
// past the lobby's back-wall opening (was a fixed -1.2 before the lobby
// existed) so leaving the lobby through that gap puts you directly at the
// bottom step.
const STEP_COUNT = 11;
const STEP_HEIGHT = 0.36;
const STEP_DEPTH = 0.32;
const STEP_WIDTH = 2.0;
const STEP_X = STAIR_GAP_X;
const STAIR_START_Z = LOBBY_BACK_Z - 0.1;
const STAIR_END_Z = STAIR_START_Z - STEP_COUNT * STEP_DEPTH;

// No door at the lobby/stairs opening (only the front and apartment doors
// are real doors) — just an open architectural gap, so it has to clear the
// full stair width rather than a single door leaf's width.
const STAIR_GAP_HALF_WIDTH = STEP_WIDTH / 2 + 0.15;

// Where the apartment's partition wall + door sit — just past the top
// step, so arriving at the top of the stairs means going through a real
// doorway instead of just being in the room (the landing used to dead-end
// in the middle of the open floor with no wall at all). Deliberately NOT
// full room width (roomMinX/roomMaxX below) — a short door-frame-sized
// segment instead, since this wall's collider is Y-agnostic (see
// createMilosInteriorGeometry's own comment on the apartment shell) and a
// shorter span keeps its unavoidable ground-floor side-effect small.
const PARTITION_Z = STAIR_END_Z - 0.3;
const PARTITION_HALF_SPAN = 3.5;

function texturedMaterial(scene: Scene, name: string, textureFile: string): PBRMaterial {
  const mat = new PBRMaterial(name, scene);
  mat.albedoTexture = new Texture(`${CITY_KIT_TEXTURE_BASE}${textureFile}`, scene);
  mat.roughness = 0.85;
  return mat;
}

const DOOR_DEFAULT_COLOR = new Color3(0.32, 0.2, 0.12);
// Bright, self-lit red for the front door specifically (Dan, 2026-07-30:
// Milo's building had become hard to spot among the boulevard's otherwise-
// identical thin-instanced buildings) — a beacon visible from a distance
// even in the boulevard's dim dusk lighting, not just a red-tinted still-
// dark box, hence the emissive term alongside the albedo.
const FRONT_DOOR_COLOR = new Color3(0.85, 0.05, 0.05);
const FRONT_DOOR_EMISSIVE = new Color3(0.9, 0.05, 0.05);
// The apartment door isn't meant to be a beacon like the front door, but a
// screenshot showed it reading as a flat black slab at close range (no
// emissive term at all, in a room with little ambient light) — a small dim
// warm glow so it's legible as a door up close without competing with the
// front door's red.
const APARTMENT_DOOR_EMISSIVE = new Color3(0.12, 0.08, 0.03);

// One hinge TransformNode per door, positioned at the gap's edge (not
// center) so rotating it swings the leaf like a real door instead of
// spinning it in place. Hinges on the local -X edge of the gap for every
// door in this file (see DOOR_OPEN_ANGLE_RADIANS' own comment for why that
// makes a single positive open-angle always swing inward).
function buildDoor(
  scene: Scene,
  name: string,
  gapCenterX: number,
  wallZ: number,
  groundY: number,
  color: Color3 = DOOR_DEFAULT_COLOR,
  emissive?: Color3,
): LocalDoor {
  const hinge = new TransformNode(`${name}_hinge`, scene);
  hinge.position.set(gapCenterX - DOOR_WIDTH / 2, groundY, wallZ);

  const mat = pbr(scene, `${name}_mat`, color, 0.7);
  if (emissive) mat.emissiveColor = emissive;
  const leaf = MeshBuilder.CreateBox(name, { width: DOOR_WIDTH, height: DOOR_HEIGHT, depth: DOOR_THICKNESS }, scene);
  leaf.position.set(DOOR_WIDTH / 2, DOOR_HEIGHT / 2, 0);
  leaf.material = mat;
  leaf.parent = hinge;

  return {
    hinge,
    leafMesh: leaf,
    triggerLocal: { x: gapCenterX, z: wallZ },
    gapHalfWidth: DOOR_GAP_HALF_WIDTH,
    openAngleRadians: DOOR_OPEN_ANGLE_RADIANS,
  };
}

// Builds a wall running along X at a fixed Z, optionally leaving a
// door-width gap — returns a single merged visual mesh (the gap's two
// flanking segments share one material, so merging them costs nothing) and
// the matching local-space collider chain (circles along the solid
// segments only, spaced per WALL_COLLIDER_SPACING).
function buildWallAlongX(
  scene: Scene,
  name: string,
  minX: number,
  maxX: number,
  z: number,
  height: number,
  thickness: number,
  material: PBRMaterial,
  gap: { centerX: number; halfWidth: number } | null,
): { mesh: Mesh | null; colliders: LocalWallCollider[] } {
  const segments: Array<[number, number]> = gap
    ? [[minX, gap.centerX - gap.halfWidth], [gap.centerX + gap.halfWidth, maxX]]
    : [[minX, maxX]];

  const parts: Mesh[] = [];
  const colliders: LocalWallCollider[] = [];
  for (const [segMinX, segMaxX] of segments) {
    const width = segMaxX - segMinX;
    if (width <= 0.01) continue;
    const centerX = (segMinX + segMaxX) / 2;
    const box = MeshBuilder.CreateBox(`${name}_${centerX.toFixed(1)}`, { width, height, depth: thickness }, scene);
    box.position.set(centerX, height / 2, z);
    parts.push(box);

    const count = Math.max(1, Math.round(width / WALL_COLLIDER_SPACING));
    for (let i = 0; i <= count; i++) {
      colliders.push({ x: segMinX + (width * i) / count, z, radius: WALL_COLLIDER_RADIUS });
    }
  }
  if (parts.length === 0) return { mesh: null, colliders };
  return { mesh: mergeParts(name, parts, material), colliders };
}

// Same as buildWallAlongX but running along Z at a fixed X — used for the
// lobby's solid side walls, which need no door gap.
function buildWallAlongZ(
  scene: Scene,
  name: string,
  x: number,
  minZ: number,
  maxZ: number,
  height: number,
  thickness: number,
  material: PBRMaterial,
): { mesh: Mesh; colliders: LocalWallCollider[] } {
  const depth = maxZ - minZ;
  const centerZ = (minZ + maxZ) / 2;
  const mesh = MeshBuilder.CreateBox(name, { width: thickness, height, depth }, scene);
  mesh.position.set(x, height / 2, centerZ);
  mesh.material = material;

  const colliders: LocalWallCollider[] = [];
  const count = Math.max(1, Math.round(depth / WALL_COLLIDER_SPACING));
  for (let i = 0; i <= count; i++) {
    colliders.push({ x, z: minZ + (depth * i) / count, radius: WALL_COLLIDER_RADIUS });
  }
  return { mesh, colliders };
}

// Milo's building only (Dan, 2026-07-27: door/stairwell/second-floor room;
// extended 2026-07-29: a functional front door, a real collision-correct
// lobby carved into the ground floor, stair railings, and an apartment
// door at the stair landing). Building_Medium_2's own geometry has no real
// door gap or second story to build on — its front is one continuous
// glass pane (MI_Glass, checked directly against the glTF's accessor
// bounds) and "MI_InteriorWall"/"MI_InteriorFloor" are a flat one-sided
// ground-floor backdrop (floor + back wall, no enclosing side walls), not
// a real room. This adds actual geometry on top, same crude-primitive
// style as every other prop in this file's neighborhood, positioned from
// the building's own scanned bounds so nothing pokes through its exterior
// walls. Caller (CompositeLocations.ts) parents every mesh here to the
// already-placed building mesh so it all inherits its transform.
export function createMilosInteriorGeometry(scene: Scene): MilosInteriorGeometry {
  const staticMeshes: Mesh[] = [];
  const wallColliders: LocalWallCollider[] = [];
  const floorSurfaces: LocalFloorSurface[] = [];

  // --- Lobby ---
  const lobbyFloorMat = texturedMaterial(scene, 'milos_lobbyFloorMat', 'T_MarbleFloor_BaseColor.png');
  const lobbyWallMat = texturedMaterial(scene, 'milos_lobbyWallMat', 'T_Concrete_BaseColor.png');

  const lobbyFloor = MeshBuilder.CreateBox('milos_lobbyFloor', {
    width: LOBBY_MAX_X - LOBBY_MIN_X, height: 0.15, depth: LOBBY_FRONT_Z - LOBBY_BACK_Z,
  }, scene);
  lobbyFloor.position.set((LOBBY_MIN_X + LOBBY_MAX_X) / 2, -0.075, (LOBBY_FRONT_Z + LOBBY_BACK_Z) / 2);
  lobbyFloor.material = lobbyFloorMat;
  staticMeshes.push(lobbyFloor);

  const lobbyCeiling = MeshBuilder.CreateBox('milos_lobbyCeiling', {
    width: LOBBY_MAX_X - LOBBY_MIN_X, height: LOBBY_CEILING_THICKNESS, depth: LOBBY_FRONT_Z - LOBBY_BACK_Z,
  }, scene);
  lobbyCeiling.position.set(
    (LOBBY_MIN_X + LOBBY_MAX_X) / 2,
    LOBBY_WALL_HEIGHT + LOBBY_CEILING_THICKNESS / 2,
    (LOBBY_FRONT_Z + LOBBY_BACK_Z) / 2,
  );
  lobbyCeiling.material = lobbyWallMat;
  staticMeshes.push(lobbyCeiling);

  const frontWall = buildWallAlongX(
    scene, 'milos_lobbyFrontWall', LOBBY_MIN_X, LOBBY_MAX_X, LOBBY_FRONT_Z,
    LOBBY_WALL_HEIGHT, LOBBY_WALL_THICKNESS, lobbyWallMat,
    { centerX: LOBBY_DOOR_X, halfWidth: DOOR_GAP_HALF_WIDTH },
  );
  if (frontWall.mesh) staticMeshes.push(frontWall.mesh);
  wallColliders.push(...frontWall.colliders);

  const backWall = buildWallAlongX(
    scene, 'milos_lobbyBackWall', LOBBY_MIN_X, LOBBY_MAX_X, LOBBY_BACK_Z,
    LOBBY_WALL_HEIGHT, LOBBY_WALL_THICKNESS, lobbyWallMat,
    { centerX: STAIR_GAP_X, halfWidth: STAIR_GAP_HALF_WIDTH },
  );
  if (backWall.mesh) staticMeshes.push(backWall.mesh);
  wallColliders.push(...backWall.colliders);

  const leftWall = buildWallAlongZ(
    scene, 'milos_lobbyLeftWall', LOBBY_MIN_X, LOBBY_BACK_Z, LOBBY_FRONT_Z,
    LOBBY_WALL_HEIGHT, LOBBY_WALL_THICKNESS, lobbyWallMat,
  );
  staticMeshes.push(leftWall.mesh);
  wallColliders.push(...leftWall.colliders);

  const rightWall = buildWallAlongZ(
    scene, 'milos_lobbyRightWall', LOBBY_MAX_X, LOBBY_BACK_Z, LOBBY_FRONT_Z,
    LOBBY_WALL_HEIGHT, LOBBY_WALL_THICKNESS, lobbyWallMat,
  );
  staticMeshes.push(rightWall.mesh);
  wallColliders.push(...rightWall.colliders);

  const frontDoor = buildDoor(
    scene, 'milos_frontDoor', LOBBY_DOOR_X, LOBBY_FRONT_Z, 0, FRONT_DOOR_COLOR, FRONT_DOOR_EMISSIVE,
  );
  staticMeshes.push(frontDoor.leafMesh);

  // --- Stairwell (11 steps, plus railings so the player can't step off
  // either side into open air) ---
  const stairMat = pbr(scene, 'milos_stairMat', new Color3(0.35, 0.32, 0.28), 0.85);
  const stairParts: Mesh[] = [];
  for (let i = 0; i < STEP_COUNT; i++) {
    const stepZ = STAIR_START_Z - i * STEP_DEPTH;
    // Depth padded slightly past STEP_DEPTH (the spacing between step
    // centers) so consecutive steps overlap by a hair instead of exactly
    // touching — a visible seam/gap between steps read as "floating" in a
    // screenshot, cheap insurance against it regardless of cause.
    const step = MeshBuilder.CreateBox(`milos_step_${i}`, {
      width: STEP_WIDTH, height: STEP_HEIGHT, depth: STEP_DEPTH + 0.02,
    }, scene);
    step.position.set(STEP_X, STEP_HEIGHT * (i + 0.5), stepZ);
    stairParts.push(step);
    floorSurfaces.push({
      minX: STEP_X - STEP_WIDTH / 2,
      maxX: STEP_X + STEP_WIDTH / 2,
      minZ: stepZ - STEP_DEPTH / 2,
      maxZ: stepZ + STEP_DEPTH / 2,
      y: STEP_HEIGHT * (i + 1),
    });
  }
  staticMeshes.push(mergeParts('milos_stairwell', stairParts, stairMat));

  const railMat = pbr(scene, 'milos_railMat', new Color3(0.1, 0.1, 0.11), 0.5, 0.6);
  const railInsetX = STEP_WIDTH / 2 + 0.08;
  for (const railX of [STEP_X - railInsetX, STEP_X + railInsetX]) {
    for (let i = 0; i <= STEP_COUNT; i++) {
      const z = STAIR_START_Z - i * STEP_DEPTH;
      wallColliders.push({ x: railX, z, radius: WALL_COLLIDER_RADIUS });
    }
    const runLength = Math.hypot(STEP_COUNT * STEP_DEPTH, STEP_COUNT * STEP_HEIGHT);
    const rail = MeshBuilder.CreateBox('milos_stairRail', { width: 0.06, height: 0.06, depth: runLength }, scene);
    rail.position.set(railX, STEP_HEIGHT * (STEP_COUNT / 2) + 0.9, STAIR_START_Z - (STEP_COUNT * STEP_DEPTH) / 2);
    rail.rotation.x = -Math.atan2(STEP_COUNT * STEP_HEIGHT, STEP_COUNT * STEP_DEPTH);
    rail.material = railMat;
    staticMeshes.push(rail);
  }

  // --- Apartment (open-topped — the building's own roof sits far above
  // this, no ceiling needed) ---
  //
  // Collision is X/Z-only with no notion of floor/height (see
  // packages/player/src/PlayerController.ts's isColliding — a Collider
  // blocks at every Y), and this room shares its whole X/Z footprint with
  // the ground floor below (and the stairs rising through it). That means
  // the room's own 4 outer walls can NEVER be collided — doing so would
  // also wall off the ground floor at the same spot, and would cut straight
  // through the stairwell where it rises into this room. roomMaxZ is kept
  // shallower than LOBBY_BACK_Z (below) so the room's footprint doesn't
  // reach forward into the lobby's own — collided — walls either.
  // Matches the top step's own walkable surface height exactly
  // (STEP_HEIGHT * STEP_COUNT) — previously had a stray extra +0.15 that
  // put the landing 0.3m above the last step, an unintended jump between
  // "climb the stairs" and "stand on the landing."
  const floorSurfaceY = STEP_HEIGHT * STEP_COUNT;
  const roomMinX = -6.3;
  const roomMaxX = 6.3;
  const roomMinZ = -11.3;
  const roomMaxZ = -3.0;
  const roomWidth = roomMaxX - roomMinX;
  const roomDepth = roomMaxZ - roomMinZ;
  const roomCenterX = (roomMinX + roomMaxX) / 2;
  const roomCenterZ = (roomMinZ + roomMaxZ) / 2;

  const apartmentFloorMat = pbr(scene, 'milos_apartmentFloorMat', new Color3(0.3, 0.24, 0.18), 0.85);
  const floorSlab = MeshBuilder.CreateBox('milos_apartmentFloor', {
    width: roomWidth, height: 0.3, depth: roomDepth,
  }, scene);
  // Slab's own center sits half its thickness below the walkable surface,
  // so its TOP face (not its center) is what actually lines up with the
  // top step and the wallY the walls/door/couch below are all based on.
  floorSlab.position.set(roomCenterX, floorSurfaceY - 0.15, roomCenterZ);
  floorSlab.material = apartmentFloorMat;
  staticMeshes.push(floorSlab);
  floorSurfaces.push({
    minX: roomMinX, maxX: roomMaxX, minZ: roomMinZ, maxZ: roomMaxZ, y: floorSurfaceY,
  });

  const apartmentWallMat = pbr(scene, 'milos_apartmentWallMat', new Color3(0.42, 0.38, 0.34), 0.9);
  const apartmentWallHeight = 2.5;
  const apartmentWallThickness = 0.15;
  const wallY = floorSurfaceY;

  // Visual meshes only below (see the comment above) — none of these four
  // push into wallColliders.
  const roomFront = buildWallAlongX(
    scene, 'milos_wallFront', roomMinX, roomMaxX, roomMaxZ,
    apartmentWallHeight, apartmentWallThickness, apartmentWallMat, null,
  );
  if (roomFront.mesh) { roomFront.mesh.position.y += wallY; staticMeshes.push(roomFront.mesh); }

  const roomBack = buildWallAlongX(
    scene, 'milos_wallBack', roomMinX, roomMaxX, roomMinZ,
    apartmentWallHeight, apartmentWallThickness, apartmentWallMat, null,
  );
  if (roomBack.mesh) { roomBack.mesh.position.y += wallY; staticMeshes.push(roomBack.mesh); }

  const roomLeft = buildWallAlongZ(
    scene, 'milos_wallLeft', roomMinX, roomMinZ, roomMaxZ,
    apartmentWallHeight, apartmentWallThickness, apartmentWallMat,
  );
  roomLeft.mesh.position.y += wallY;
  staticMeshes.push(roomLeft.mesh);

  const roomRight = buildWallAlongZ(
    scene, 'milos_wallRight', roomMaxX, roomMinZ, roomMaxZ,
    apartmentWallHeight, apartmentWallThickness, apartmentWallMat,
  );
  roomRight.mesh.position.y += wallY;
  staticMeshes.push(roomRight.mesh);

  // Partition + door right at the stair landing — arriving at the top of
  // the stairs used to dead-end in the middle of the open room with no
  // wall at all; this makes it a real doorway instead. Unlike the room's
  // own outer walls above, this one DOES need a collider (the apartment
  // door has to actually block), so — per this section's opening comment —
  // it's kept to a short door-frame span (PARTITION_HALF_SPAN) rather than
  // the room's full width, to minimize how much ground-floor space it
  // incidentally walls off one floor down.
  const partition = buildWallAlongX(
    scene, 'milos_apartmentPartition', STEP_X - PARTITION_HALF_SPAN, STEP_X + PARTITION_HALF_SPAN, PARTITION_Z,
    apartmentWallHeight, apartmentWallThickness, apartmentWallMat,
    { centerX: STEP_X, halfWidth: DOOR_GAP_HALF_WIDTH },
  );
  if (partition.mesh) { partition.mesh.position.y += wallY; staticMeshes.push(partition.mesh); }
  wallColliders.push(...partition.colliders);

  const apartmentDoor = buildDoor(
    scene, 'milos_apartmentDoor', STEP_X, PARTITION_Z, wallY, DOOR_DEFAULT_COLOR, APARTMENT_DOOR_EMISSIVE,
  );
  staticMeshes.push(apartmentDoor.leafMesh);

  // Against the room's back wall (roomMinZ), centered — away from the
  // partition door's sightline (that's at STEP_X=2.4, off to one side, not
  // roomCenterX=0). Dan placed a real couch.glb (raw bounding box ~1.0m x
  // 0.28m x 0.63m — small for a couch) at D:\dan\code\dissonance-related\
  // Furniture; CompositeLocations.ts loads and parents it, using COUCH_
  // SCALE below. Position/rotation/scale are all an eyeballed first guess —
  // nobody has looked at this in a running browser yet, see COUCH_SCALE's
  // own comment.
  const couch: LocalFurniturePlacement = {
    x: roomCenterX,
    y: wallY,
    z: roomMinZ + 1.0,
    rotationY: 0,
  };

  return { staticMeshes, wallColliders, floorSurfaces, frontDoor, apartmentDoor, couch };
}

// The raw couch.glb measures ~1.0m x 0.28m x 0.63m (checked directly against
// its own POSITION accessor min/max) — notably small/shallow for a real
// couch (~2m long, ~0.8-0.9m seat-to-backrest height is typical), so this
// scales it up rather than placing it at its native size. Picked without
// seeing it rendered (no browser tooling available this session) — the
// first thing to eyeball and adjust once someone can actually look at it.
export const COUCH_SCALE = 2.2;

export interface DoorController {
  // Returns true only on the frame its blocking state actually flips —
  // callers use this to know when to re-run player.setColliders() instead
  // of doing it unconditionally every frame.
  update(dt: number, playerX: number, playerZ: number): boolean;
  getBlockerCollider(): { x: number; z: number; radius: number } | null;
}

// Same trigger-radius-with-hysteresis idea as LineglassParts.ts's pickup
// radius, plus a close radius so the door doesn't flutter open/closed right
// at one threshold.
const DOOR_OPEN_TRIGGER_METERS = 2.2;
const DOOR_CLOSE_TRIGGER_METERS = 2.8;
// Same lerp idiom PlayerController.ts already uses for eye-height smoothing
// (value += (target - value) * Math.min(1, dt * rate)).
const DOOR_LERP_RATE = 4;
// Fraction open before the gap counts as clear — gates blocker-collider
// removal on the door's actual swing progress, not the instant the trigger
// radius is crossed, so nothing clips through a barely-cracked door.
const DOOR_BLOCK_OPEN_THRESHOLD = 0.25;

// Generic — CompositeLocations.ts instantiates one of these per door after
// converting that door's local hinge/trigger points to world space (the
// hinge's own rotation is local and needs no conversion; only the
// proximity check and the blocker collider are plain world-space data, same
// as PlayerController.FloorSurface).
export function createDoorController(
  hinge: TransformNode,
  openAngleRadians: number,
  worldTrigger: { x: number; z: number },
  blockerRadius: number,
): DoorController {
  let openAmount = 0;
  let blocking = true;

  return {
    update(dt, playerX, playerZ) {
      const dx = playerX - worldTrigger.x;
      const dz = playerZ - worldTrigger.z;
      const dist = Math.hypot(dx, dz);
      const wantOpen = dist < DOOR_OPEN_TRIGGER_METERS ? true
        : dist > DOOR_CLOSE_TRIGGER_METERS ? false
        : openAmount > 0.5;
      const target = wantOpen ? 1 : 0;
      openAmount += (target - openAmount) * Math.min(1, dt * DOOR_LERP_RATE);
      hinge.rotation.y = openAmount * openAngleRadians;

      const nowBlocking = openAmount < DOOR_BLOCK_OPEN_THRESHOLD;
      const changed = nowBlocking !== blocking;
      blocking = nowBlocking;
      return changed;
    },
    getBlockerCollider() {
      return blocking ? { x: worldTrigger.x, z: worldTrigger.z, radius: blockerRadius } : null;
    },
  };
}
