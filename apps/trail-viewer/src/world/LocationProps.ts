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

export type LocationEntry = {
  name: string;
  latLong: [number, number];
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
    }>;
  };
};

export interface LocationPropsHandle {
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
    dispose: () => templates.forEach((t) => t.dispose()),
  };
}
