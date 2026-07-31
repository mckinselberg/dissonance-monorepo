import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Scene,
  type ShadowGenerator,
} from '@babylonjs/core';
import type { Collider } from '@dissonance/world';
import type { LocationEntry } from './LocationProps';

const FEATURE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TERMINAL_COLLIDER_RADIUS_METERS = 0.55;

export interface WorldTerminalFixture {
  readonly id: string;
  readonly name: string;
  readonly position: Vector3;
  readonly interactionRadius: number;
  readonly colliderRadius: number;
}

export interface WorldTerminalsHandle {
  readonly terminals: readonly WorldTerminalFixture[];
  readonly colliders: Collider[];
  get(id: string): WorldTerminalFixture | null;
  dispose(): void;
}

type TerminalPlacement = {
  location: LocationEntry;
  position: Vector3;
};

function requireFinite(value: number, field: string, id: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`[WorldTerminals] ${field} must be finite for "${id}".`);
  }
}

function resolvePlacements(
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  getHeightAt: (x: number, z: number) => number,
): TerminalPlacement[] {
  const ids = new Set<string>();
  const placements: TerminalPlacement[] = [];

  for (const location of locations) {
    const terminal = location.terminal;
    if (!terminal) continue;

    if (!FEATURE_ID_PATTERN.test(location.id)) {
      throw new Error(
        `[WorldTerminals] invalid terminal id "${location.id}"; use lowercase kebab-case.`,
      );
    }
    if (ids.has(location.id)) {
      throw new Error(`[WorldTerminals] duplicate terminal id "${location.id}".`);
    }
    ids.add(location.id);

    if (location.name.trim().length === 0) {
      throw new Error(`[WorldTerminals] terminal "${location.id}" requires a name.`);
    }
    requireFinite(location.latLong[0], 'latitude', location.id);
    requireFinite(location.latLong[1], 'longitude', location.id);
    requireFinite(terminal.headingDegrees, 'headingDegrees', location.id);
    requireFinite(terminal.interactionRadiusMeters, 'interactionRadiusMeters', location.id);
    if (terminal.interactionRadiusMeters <= 0) {
      throw new Error(
        `[WorldTerminals] interactionRadiusMeters must be positive for "${location.id}".`,
      );
    }

    const projected = toRenderXZ(location.latLong[0], location.latLong[1]);
    requireFinite(projected.x, 'render x', location.id);
    requireFinite(projected.z, 'render z', location.id);
    const groundY = getHeightAt(projected.x, projected.z);
    requireFinite(groundY, 'terrain height', location.id);
    placements.push({
      location,
      position: new Vector3(projected.x, groundY, projected.z),
    });
  }

  return placements;
}

function buildTerminal(
  scene: Scene,
  placement: TerminalPlacement,
  metal: PBRMaterial,
  screenMaterial: StandardMaterial,
  horizontalScale: number,
  shadowGenerator: ShadowGenerator | undefined,
): { root: TransformNode; meshes: Mesh[] } {
  const { location, position } = placement;
  const terminal = location.terminal!;
  const root = new TransformNode(`worldTerminal:${location.id}`, scene);
  root.position.copyFrom(position);
  root.rotation.y = terminal.headingDegrees * Math.PI / 180;
  root.scaling.setAll(horizontalScale);

  const base = MeshBuilder.CreateBox(
    `worldTerminal:${location.id}:base`,
    { width: 0.9, height: 0.14, depth: 0.72 },
    scene,
  );
  base.position.y = 0.07;

  const pedestal = MeshBuilder.CreateBox(
    `worldTerminal:${location.id}:pedestal`,
    { width: 0.54, height: 1.02, depth: 0.42 },
    scene,
  );
  pedestal.position.y = 0.65;

  const housing = MeshBuilder.CreateBox(
    `worldTerminal:${location.id}:housing`,
    { width: 0.82, height: 0.62, depth: 0.5 },
    scene,
  );
  housing.position.set(0, 1.36, 0);

  const screen = MeshBuilder.CreateBox(
    `worldTerminal:${location.id}:screen`,
    { width: 0.6, height: 0.36, depth: 0.025 },
    scene,
  );
  screen.position.set(0, 1.39, -0.263);

  const solidMeshes = [base, pedestal, housing];
  for (const mesh of solidMeshes) {
    mesh.material = metal;
    mesh.parent = root;
    mesh.receiveShadows = true;
    shadowGenerator?.addShadowCaster(mesh);
  }
  screen.material = screenMaterial;
  screen.parent = root;

  return { root, meshes: [...solidMeshes, screen] };
}

/**
 * Builds authored, offline terminal fixtures from top-level world features.
 * The returned metadata is presentation/proximity only: this loader owns no
 * docking state, progression, terminal commands, or network behavior.
 */
export function loadWorldTerminals(
  scene: Scene,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  getHeightAt: (x: number, z: number) => number,
  shadowGenerator?: ShadowGenerator,
): WorldTerminalsHandle {
  if (!Number.isFinite(horizontalScale) || horizontalScale <= 0) {
    throw new Error('[WorldTerminals] horizontalScale must be finite and positive.');
  }
  const placements = resolvePlacements(locations, toRenderXZ, getHeightAt);
  const terminals: WorldTerminalFixture[] = [];
  const terminalsById = new Map<string, WorldTerminalFixture>();
  const colliders: Collider[] = [];
  const roots: TransformNode[] = [];
  const meshes: Mesh[] = [];

  const metal = new PBRMaterial('worldTerminal:metal', scene);
  metal.albedoColor = new Color3(0.075, 0.085, 0.08);
  metal.metallic = 0.72;
  metal.roughness = 0.68;

  const screenMaterial = new StandardMaterial('worldTerminal:screen', scene);
  screenMaterial.diffuseColor = new Color3(0.015, 0.12, 0.045);
  screenMaterial.emissiveColor = new Color3(0.08, 0.78, 0.25);
  screenMaterial.specularColor = Color3.Black();

  for (const placement of placements) {
    const terminal = placement.location.terminal!;
    const built = buildTerminal(
      scene, placement, metal, screenMaterial, horizontalScale, shadowGenerator,
    );
    roots.push(built.root);
    meshes.push(...built.meshes);

    const fixture: WorldTerminalFixture = {
      id: placement.location.id,
      name: placement.location.name,
      position: placement.position.clone(),
      interactionRadius: terminal.interactionRadiusMeters * horizontalScale,
      colliderRadius: TERMINAL_COLLIDER_RADIUS_METERS * horizontalScale,
    };
    terminals.push(fixture);
    terminalsById.set(fixture.id, fixture);
    colliders.push({
      x: placement.position.x,
      z: placement.position.z,
      radius: fixture.colliderRadius,
    });
  }

  let disposed = false;
  return {
    terminals,
    colliders,
    get(id) {
      return terminalsById.get(id) ?? null;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      meshes.forEach((mesh) => mesh.dispose());
      roots.forEach((root) => root.dispose());
      metal.dispose();
      screenMaterial.dispose();
      terminalsById.clear();
    },
  };
}
