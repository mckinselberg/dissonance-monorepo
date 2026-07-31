import {
  Color3,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Scene,
  type ShadowGenerator,
} from '@babylonjs/core';
import type { Collider } from '@dissonance/world';
import type { LocationEntry } from './LocationProps';
import { loadHeroTreeInstances, type HeroTreeInstancesHandle } from './HeroTreeInstances';
import { texturedMaterial } from './texturedMaterial';

const SHELTER_WIDTH = 13;
const SHELTER_DEPTH = 8;
const SHELTER_HEIGHT = 4.8;
const PORTAL_WIDTH = 3.4;
const PORTAL_HEIGHT = 2.7;
const FENCE_RADIUS = 10;
const TREE_COUNT = 22;
const HERO_TREE_URL = `${import.meta.env.BASE_URL}models/tree-small-02/tree_small_02_preview.glb`;
const PINE_SAPLING_URL = `${import.meta.env.BASE_URL}models/pine-sapling-medium/pine_sapling_medium_preview.glb`;
const FIR_SAPLING_URL = `${import.meta.env.BASE_URL}models/fir-sapling-medium/fir_sapling_medium_preview.glb`;

export interface FalloutShelterEntranceHandle {
  colliders: Collider[];
  position: Vector3 | null;
  doorPosition: Vector3 | null;
  interactionRadius: number;
  dispose(): void;
}

function material(
  scene: Scene,
  name: string,
  color: Color3,
  roughness: number,
  metallic = 0,
): PBRMaterial {
  const result = new PBRMaterial(name, scene);
  result.albedoColor = color;
  result.roughness = roughness;
  result.metallic = metallic;
  return result;
}

function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function loadFalloutShelterEntrance(
  scene: Scene,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  getHeightAt: (x: number, z: number) => number,
  shadowGenerator?: ShadowGenerator,
): FalloutShelterEntranceHandle {
  const meshes: AbstractMesh[] = [];
  const heroTreeHandles: HeroTreeInstancesHandle[] = [];
  let disposed = false;
  const colliders: Collider[] = [];
  let entrancePosition: Vector3 | null = null;
  let doorPosition: Vector3 | null = null;

  for (const location of locations) {
    if (!location.shelterEntrance) continue;
    const anchor = toRenderXZ(location.latLong[0], location.latLong[1]);
    const x = anchor.x + location.shelterEntrance.local[0] * horizontalScale;
    const z = anchor.z + location.shelterEntrance.local[1] * horizontalScale;
    const groundY = getHeightAt(x, z);
    entrancePosition = new Vector3(x, groundY, z);

    const root = new TransformNode(`falloutShelter:${location.id}`, scene);
    root.position.copyFrom(entrancePosition);
    root.rotation.y = location.shelterEntrance.headingDegrees * Math.PI / 180;
    root.computeWorldMatrix(true);
    doorPosition = Vector3.TransformCoordinates(
      new Vector3(0, 0, -SHELTER_DEPTH * 0.92),
      root.getWorldMatrix(),
    );

    const concrete = texturedMaterial(
      scene,
      'shelterWeatheredConcrete',
      {
        albedo: `${import.meta.env.BASE_URL}models/downtown-city-megakit/T_Concrete_BaseColor.png`,
        normal: `${import.meta.env.BASE_URL}models/downtown-city-megakit/T_Concrete_Normal.png`,
        orm: `${import.meta.env.BASE_URL}models/downtown-city-megakit/T_Concrete_ORM.png`,
      },
      2.5,
    );
    const darkConcrete = material(
      scene,
      'shelterRecessConcrete',
      new Color3(0.11, 0.12, 0.105),
      0.98,
    );
    const rust = texturedMaterial(
      scene,
      'shelterDoorRust',
      {
        albedo: `${import.meta.env.BASE_URL}models/downtown-city-megakit/T_MetalConcrete_BaseColor.png`,
        normal: `${import.meta.env.BASE_URL}models/downtown-city-megakit/T_MetalConcrete_Normal.png`,
        orm: `${import.meta.env.BASE_URL}models/downtown-city-megakit/T_MetalConcrete_ORM.png`,
      },
      2,
    );
    rust.albedoColor = new Color3(0.45, 0.24, 0.13);
    rust.metallic = 0.6;
    const earth = texturedMaterial(
      scene,
      'shelterEarthCover',
      {
        albedo: `${import.meta.env.BASE_URL}textures/forest-ground-04/forest_ground_04_diff_512.jpg`,
        normal: `${import.meta.env.BASE_URL}textures/forest-ground-04/forest_ground_04_nor_gl_512.png`,
      },
      3,
    );

    // Two low horizontal concrete drums, buried past their midpoint so only
    // the rounded civil-defense roof and battered face remain visible.
    for (const side of [-1, 1]) {
      const lobe = MeshBuilder.CreateCylinder(
        `shelterConcreteLobe:${side}`,
        {
          height: SHELTER_WIDTH / 2,
          diameter: SHELTER_HEIGHT * 1.65,
          tessellation: 18,
        },
        scene,
      );
      lobe.rotation.z = Math.PI / 2;
      lobe.position.set(side * SHELTER_WIDTH * 0.24, 0.55, 1.2);
      lobe.scaling.z = SHELTER_DEPTH / (SHELTER_HEIGHT * 1.65);
      lobe.material = concrete;
      lobe.parent = root;
      meshes.push(lobe);
      shadowGenerator?.addShadowCaster(lobe);
    }

    const earthCap = MeshBuilder.CreateSphere(
      'shelterEarthCap',
      { diameter: 2, segments: 16 },
      scene,
    );
    earthCap.scaling.set(SHELTER_WIDTH * 0.48, 1.35, SHELTER_DEPTH * 0.52);
    earthCap.position.set(0, 2.3, 1.35);
    earthCap.material = earth;
    earthCap.parent = root;
    meshes.push(earthCap);

    // Deep recessed portal: thick lintel/jambs, black throat, and an old
    // steel door held slightly ajar.
    const throat = MeshBuilder.CreateBox(
      'shelterDoorThroat',
      { width: PORTAL_WIDTH, height: PORTAL_HEIGHT, depth: 2.6 },
      scene,
    );
    throat.position.set(0, PORTAL_HEIGHT / 2, -SHELTER_DEPTH * 0.47);
    throat.material = darkConcrete;
    throat.parent = root;
    meshes.push(throat);

    const frameParts = [
      { name: 'left', position: [-PORTAL_WIDTH / 2 - 0.35, PORTAL_HEIGHT / 2, -SHELTER_DEPTH * 0.63], size: [0.7, PORTAL_HEIGHT + 0.8, 1.1] },
      { name: 'right', position: [PORTAL_WIDTH / 2 + 0.35, PORTAL_HEIGHT / 2, -SHELTER_DEPTH * 0.63], size: [0.7, PORTAL_HEIGHT + 0.8, 1.1] },
      { name: 'lintel', position: [0, PORTAL_HEIGHT + 0.35, -SHELTER_DEPTH * 0.63], size: [PORTAL_WIDTH + 1.4, 0.7, 1.1] },
    ] as const;
    for (const part of frameParts) {
      const mesh = MeshBuilder.CreateBox(
        `shelterPortal:${part.name}`,
        { width: part.size[0], height: part.size[1], depth: part.size[2] },
        scene,
      );
      mesh.position.set(part.position[0], part.position[1], part.position[2]);
      mesh.material = concrete;
      mesh.parent = root;
      meshes.push(mesh);
    }

    const doorHinge = new TransformNode('shelterDoorHinge', scene);
    doorHinge.position.set(-PORTAL_WIDTH / 2, 0, -SHELTER_DEPTH * 0.78);
    doorHinge.rotation.y = -0.28;
    doorHinge.parent = root;
    const door = MeshBuilder.CreateBox(
      'shelterDoor',
      { width: PORTAL_WIDTH, height: PORTAL_HEIGHT, depth: 0.18 },
      scene,
    );
    door.position.set(PORTAL_WIDTH / 2, PORTAL_HEIGHT / 2, 0);
    door.material = rust;
    door.parent = doorHinge;
    meshes.push(door);

    // Old chain-link enclosure. Wireframe planes give a readable diamond-ish
    // mesh at World scale without introducing a bespoke texture dependency.
    const fenceMaterial = new StandardMaterial('shelterChainLink', scene);
    fenceMaterial.diffuseColor = new Color3(0.24, 0.27, 0.24);
    fenceMaterial.emissiveColor = new Color3(0.025, 0.03, 0.025);
    fenceMaterial.alpha = 0.62;
    fenceMaterial.wireframe = true;
    fenceMaterial.backFaceCulling = false;
    const fenceSegments = [
      { x: -FENCE_RADIUS, z: -1, width: 12, heading: Math.PI / 2 },
      { x: FENCE_RADIUS, z: -1, width: 12, heading: Math.PI / 2 },
      { x: -6.5, z: -FENCE_RADIUS, width: 7, heading: 0 },
      { x: 6.5, z: -FENCE_RADIUS, width: 7, heading: 0 },
    ];
    for (let index = 0; index < fenceSegments.length; index++) {
      const segment = fenceSegments[index];
      const panel = MeshBuilder.CreatePlane(
        `shelterChainLinkPanel:${index}`,
        { width: segment.width, height: 2.5, sideOrientation: 2 },
        scene,
      );
      panel.position.set(segment.x, 1.25, segment.z);
      panel.rotation.y = segment.heading;
      panel.rotation.z = (seeded(index, 9) - 0.5) * 0.08;
      panel.material = fenceMaterial;
      panel.parent = root;
      panel.isPickable = false;
      meshes.push(panel);
      for (const end of [-1, 1]) {
        const post = MeshBuilder.CreateCylinder(
          `shelterFencePost:${index}:${end}`,
          { height: 2.8, diameter: 0.12, tessellation: 8 },
          scene,
        );
        const alongX = Math.cos(segment.heading) * segment.width * 0.5 * end;
        const alongZ = -Math.sin(segment.heading) * segment.width * 0.5 * end;
        post.position.set(segment.x + alongX, 1.35, segment.z + alongZ);
        post.material = rust;
        post.parent = root;
        meshes.push(post);
      }
    }

    // Dense, deliberately irregular thicket around the flanks and rear.
    // Uses the same full-detail GLBs as the trail hero tier; this authored
    // cluster is small enough that the high-detail source remains appropriate.
    const heroPositions: Vector3[] = [];
    const pinePositions: Vector3[] = [];
    const firPositions: Vector3[] = [];
    const cosHeading = Math.cos(root.rotation.y);
    const sinHeading = Math.sin(root.rotation.y);
    for (let index = 0; index < TREE_COUNT; index++) {
      const angle = (index / TREE_COUNT) * Math.PI * 2;
      const radius = 7.5 + seeded(index, 2) * 5;
      // Preserve a narrow approach gap at the front (local -Z).
      if (Math.abs(Math.sin(angle)) < 0.36 && Math.cos(angle) < 0) continue;
      const localX = Math.sin(angle) * radius;
      const localZ = Math.cos(angle) * radius + 1.5;
      const worldX = x + localX * cosHeading + localZ * sinHeading;
      const worldZ = z - localX * sinHeading + localZ * cosHeading;
      const position = new Vector3(worldX, getHeightAt(worldX, worldZ), worldZ);
      const species = index % 5;
      if (species === 0) pinePositions.push(position);
      else if (species === 1) firPositions.push(position);
      else heroPositions.push(position);
    }
    const queueHeroAsset = (url: string, positions: Vector3[], scale: number) => {
      if (positions.length === 0) return;
      void loadHeroTreeInstances(
        scene,
        url,
        positions,
        horizontalScale * scale,
        horizontalScale * scale,
        shadowGenerator,
      )
        .then((handle) => {
          if (disposed) handle.dispose();
          else heroTreeHandles.push(handle);
        })
        .catch((error) => {
          console.error(`[FalloutShelter] failed to load thicket asset ${url}`, error);
        });
    };
    queueHeroAsset(HERO_TREE_URL, heroPositions, 0.72);
    queueHeroAsset(PINE_SAPLING_URL, pinePositions, 0.9);
    queueHeroAsset(FIR_SAPLING_URL, firPositions, 0.9);

    const heading = root.rotation.y;
    const sideX = Math.cos(heading) * SHELTER_WIDTH * 0.28;
    const sideZ = -Math.sin(heading) * SHELTER_WIDTH * 0.28;
    colliders.push(
      { x: x - sideX, z: z - sideZ, radius: 2.8 * horizontalScale },
      { x: x + sideX, z: z + sideZ, radius: 2.8 * horizontalScale },
    );
  }

  return {
    colliders,
    position: entrancePosition,
    doorPosition,
    interactionRadius: 3.5,
    dispose() {
      disposed = true;
      heroTreeHandles.forEach((handle) => handle.dispose());
      meshes.forEach((mesh) => mesh.dispose(false, true));
    },
  };
}
