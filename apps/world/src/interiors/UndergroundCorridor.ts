import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Scene,
} from '@babylonjs/core';

export type UndergroundSegmentKind = 'straight' | 'bend' | 'junction' | 'grade' | 'service-bay';
export type UndergroundWidthClass = 'crawl' | 'service' | 'transit';

export interface UndergroundSegment {
  id: string;
  kind: UndergroundSegmentKind;
  length: number;
  headingDegrees: number;
  elevationDelta: number;
  widthClass: UndergroundWidthClass;
  hazardSlots: string[];
  start: [number, number, number];
  end: [number, number, number];
}

export interface UndergroundCorridor {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  seed: number;
  segments: UndergroundSegment[];
}

export interface CorridorDiagnostics {
  valid: boolean;
  reversible: boolean;
  segmentCount: number;
  collisionMeshCount: number;
  errors: string[];
}

export interface UndergroundCorridorHandle {
  metadata: UndergroundCorridor;
  diagnostics: CorridorDiagnostics;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

const WIDTHS: Record<UndergroundWidthClass, number> = {
  crawl: 1.4,
  service: 3.1,
  transit: 5.2,
};

function seededUnit(seed: number, salt: string): number {
  let hash = seed | 0;
  for (let index = 0; index < salt.length; index++) {
    hash = Math.imul(hash ^ salt.charCodeAt(index), 16_777_619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

export function buildWorkshopTestCorridor(seed: number): UndergroundCorridor {
  const specifications: Array<Omit<UndergroundSegment, 'id' | 'start' | 'end'>> = [
    {
      kind: 'straight',
      length: 7,
      headingDegrees: 0,
      elevationDelta: 0,
      widthClass: 'service',
      hazardSlots: [],
    },
    {
      kind: 'bend',
      length: 6,
      headingDegrees: seededUnit(seed, 'bend-direction') < 0.5 ? -28 : 28,
      elevationDelta: -0.35,
      widthClass: 'service',
      hazardSlots: ['electrical-cycle'],
    },
    {
      kind: 'service-bay',
      length: 8,
      headingDegrees: 0,
      elevationDelta: 0,
      widthClass: 'transit',
      hazardSlots: ['maintenance-evidence'],
    },
  ];

  let cursor = new Vector3(0, 0, 27.2);
  let absoluteHeading = 0;
  const segments = specifications.map((specification, index): UndergroundSegment => {
    absoluteHeading += specification.headingDegrees;
    const radians = absoluteHeading * Math.PI / 180;
    const end = cursor.add(new Vector3(
      Math.sin(radians) * specification.length,
      specification.elevationDelta,
      Math.cos(radians) * specification.length,
    ));
    const segment: UndergroundSegment = {
      ...specification,
      id: `workshop-test-corridor:${index}`,
      headingDegrees: absoluteHeading,
      start: [cursor.x, cursor.y, cursor.z],
      end: [end.x, end.y, end.z],
    };
    cursor = end;
    return segment;
  });

  return {
    id: 'workshop-test-corridor',
    fromNodeId: 'milos-workshop',
    toNodeId: 'locked-utility-continuation',
    seed,
    segments,
  };
}

export function validateCorridor(corridor: UndergroundCorridor): CorridorDiagnostics {
  const errors: string[] = [];
  const ids = new Set<string>();
  corridor.segments.forEach((segment, index) => {
    if (ids.has(segment.id)) errors.push(`duplicate segment id ${segment.id}`);
    ids.add(segment.id);
    if (!Number.isFinite(segment.length) || segment.length <= 0) {
      errors.push(`${segment.id} has invalid length`);
    }
    if (index > 0) {
      const previousEnd = Vector3.FromArray(corridor.segments[index - 1].end);
      const start = Vector3.FromArray(segment.start);
      if (Vector3.Distance(previousEnd, start) > 0.001) {
        errors.push(`${segment.id} is disconnected`);
      }
    }
  });

  const forward = corridor.segments.flatMap((segment) => [segment.start, segment.end]);
  const reverse = [...corridor.segments].reverse().flatMap((segment) => [segment.end, segment.start]);
  const reversible =
    forward.length === reverse.length &&
    forward.every((point, index) => Vector3.Distance(
      Vector3.FromArray(point),
      Vector3.FromArray(reverse[reverse.length - 1 - index]),
    ) <= 0.001);
  if (!reversible) errors.push('reverse traversal endpoints do not match');

  return {
    valid: errors.length === 0,
    reversible,
    segmentCount: corridor.segments.length,
    collisionMeshCount: corridor.segments.length * 4,
    errors,
  };
}

export function createUndergroundCorridor(
  scene: Scene,
  parent: TransformNode,
  corridor: UndergroundCorridor,
): UndergroundCorridorHandle {
  const diagnostics = validateCorridor(corridor);
  if (!diagnostics.valid) {
    throw new Error(`[UndergroundCorridor] ${diagnostics.errors.join('; ')}`);
  }
  const root = new TransformNode(corridor.id, scene);
  root.parent = parent;
  const meshes: AbstractMesh[] = [];
  const material = new StandardMaterial('undergroundCorridorConcrete', scene);
  material.diffuseColor = new Color3(0.115, 0.13, 0.12);
  material.specularColor = new Color3(0.015, 0.018, 0.016);

  const makeBox = (
    name: string,
    width: number,
    height: number,
    depth: number,
    position: Vector3,
    rotationY: number,
  ) => {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
    mesh.position.copyFrom(position);
    mesh.rotation.y = rotationY;
    mesh.material = material;
    mesh.checkCollisions = true;
    mesh.parent = root;
    meshes.push(mesh);
  };

  corridor.segments.forEach((segment) => {
    const start = Vector3.FromArray(segment.start);
    const end = Vector3.FromArray(segment.end);
    const center = Vector3.Center(start, end);
    const heading = segment.headingDegrees * Math.PI / 180;
    const width = WIDTHS[segment.widthClass];
    const wallOffset = width / 2;
    const normal = new Vector3(Math.cos(heading), 0, -Math.sin(heading));
    makeBox(`${segment.id}:floor`, width, 0.2, segment.length, center.add(new Vector3(0, -0.1, 0)), heading);
    makeBox(`${segment.id}:ceiling`, width, 0.22, segment.length, center.add(new Vector3(0, 3.35, 0)), heading);
    makeBox(
      `${segment.id}:left`,
      0.22,
      3.5,
      segment.length,
      center.add(normal.scale(wallOffset)).add(new Vector3(0, 1.65, 0)),
      heading,
    );
    makeBox(
      `${segment.id}:right`,
      0.22,
      3.5,
      segment.length,
      center.subtract(normal.scale(wallOffset)).add(new Vector3(0, 1.65, 0)),
      heading,
    );
  });

  return {
    metadata: corridor,
    diagnostics,
    setEnabled: (enabled) => root.setEnabled(enabled),
    dispose: () => {
      meshes.forEach((mesh) => mesh.dispose(false, true));
      material.dispose();
      root.dispose();
    },
  };
}
