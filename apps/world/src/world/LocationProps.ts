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
import { ScatterVariationMaterialPlugin } from '@dissonance/materials';
import { texturedMaterial, CITY_KIT_TEXTURE_BASE, TEXTURES_BASE } from './texturedMaterial';

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
  // An authored, drivable Synod service road — consumed by
  // vehicle/RoadNetwork.ts. Unlike `corridor` (a power right-of-way with
  // poles/wires), a road is a traversal surface: it gets a wide ground-hugging
  // ribbon mesh, not thin-instanced props along it. `pullOffs` are named stops
  // (parking/sanctioned destinations) addressed by distance along the path
  // rather than their own local offset, since a pull-off only makes sense as
  // a point *on* the road.
  //
  // The path itself comes from exactly one of two sources:
  // - `routeFile`: the id (filename) of an entry in public/data/routes/
  //   index.json — the same recorded/imported route documents RouteReplay.tsx
  //   already loads (RouteRecorder.tsx's export format or a GeoJSON
  //   LineString), as absolute WGS84 points. This is the preferred source —
  //   walk or fly the intended road once with the route recorder, export,
  //   commit the file, and point a road at it. No local-meter conversion.
  // - `path`: a freeform polyline in local meters from `latLong`, same
  //   convention as `corridor.path` — a hand-authored fallback for when
  //   there's no recording (or the road is short enough not to need one).
  road?: {
    path?: Array<[number, number]>;
    routeFile?: string;
    widthMeters: number;
    pullOffs?: Array<{ id: string; distanceMeters: number }>;
    // T28 highway consequence (docs/design/world/RURAL-INFRASTRUCTURE.md) —
    // the road's own data seeds the presence and type of a hostile
    // patroller (RoadPatrolDog.ts), rather than a separate hand-authored
    // list like patrolDrones above. `type` is a single value today, kept as
    // a discriminant so a second patroller archetype is a data addition,
    // not a schema break.
    patrol?: {
      id: string;
      type: 'mech-dog';
      speedMetersPerSecond?: number;
      detectionRadiusMeters?: number;
    };
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
    losProbeOffset: [number, number, number];
    eligible: boolean;
    weight?: number;
  }>;
  shelterEntrance?: {
    local: [number, number];
    headingDegrees: number;
  };
  // Stable, offline terminal fixture metadata. The owning location supplies
  // identity/name/latLong; this field owns only the physical presentation and
  // proximity boundary. Dialogue, progression, control, and networking live
  // outside the world-feature manifest.
  terminal?: {
    headingDegrees: number;
    interactionRadiusMeters: number;
  };
  // Hand-authored foliage that shapes navigable space through *exclusion*
  // rather than open scatter — executes the design intent of
  // docs/intake/world-foliage-impasse-prompt-v1.md (T7: impasse rings, one
  // grove clearing, one secret entrance) through this app's actual
  // locations.json + circle-collider pipeline, not that doc's Blender/
  // baked-terrain/navmesh assumptions (this app has no navmesh — see
  // ForestImpasses.ts). Same "local meters from latLong" convention as
  // corridor/shelterEntrance; one cluster per location entry.
  forestImpasse?: {
    zones: Array<{
      id: string;
      // vine-tangle/deadfall are non-passable (real colliders); shrub-wall
      // is a soft gate players can push through, so it gets none — matches
      // the source doc's own per-type collision spec.
      kind: 'vine-tangle' | 'deadfall' | 'shrub-wall';
      local: [number, number];
      radiusMeters: number;
      // Orientation of the log-run/hedge-line through local — meaningless
      // for the roughly-circular vine-tangle/shrub-wall clusters.
      headingDegrees?: number;
    }>;
    grove: {
      local: [number, number];
      radiusMeters: number;
      // Standing dead snag — the grove's wayfinding landmark.
      snagLocal: [number, number];
    };
    // The one deliberately-not-signposted opening (source doc's Option A:
    // low deadfall passage). `zoneRef` must name a `kind: 'deadfall'` zone
    // above; ForestImpasses.ts leaves a real gap in that zone's log run and
    // collider set at the point closest to `local`, rather than modeling a
    // separate passable/impassable flag.
    secretPassage: {
      zoneRef: string;
      local: [number, number];
      gapWidthMeters: number;
    };
  };
  // Dev-only visual QA tool: lays one instance of each named asset out in an
  // evenly-spaced grid, centered on this location, for side-by-side
  // comparison — not narrative content. Built for eyeballing a freshly
  // imported asset pack (see AssetShowcase.ts) before deciding how to use it
  // in real placements like forestImpasse above.
  assetShowcase?: {
    assetUrls: string[];
    columns: number;
    spacingMeters: number;
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

export function mergeParts(name: string, parts: Mesh[], mat: PBRMaterial): Mesh {
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true) ?? parts[0];
  merged.name = name;
  merged.material = mat;
  return merged;
}

export function pbr(scene: Scene, name: string, color: Color3, roughness = 0.9, metallic = 0): PBRMaterial {
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
  const poleMat = texturedMaterial(
    scene,
    'locProp_lampPoleMat',
    {
      albedo: `${CITY_KIT_TEXTURE_BASE}T_MetalConcrete_BaseColor.png`,
      normal: `${CITY_KIT_TEXTURE_BASE}T_MetalConcrete_Normal.png`,
      orm: `${CITY_KIT_TEXTURE_BASE}T_MetalConcrete_ORM.png`,
    },
    1,
  );
  poleMat.albedoColor = new Color3(0.09, 0.09, 0.1);
  poleMat.metallic = 0.7;
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

// Farm silo placeholder for T28's rural-infrastructure backlog (see
// docs/design/world/RURAL-INFRASTRUCTURE.md) — same procedural-now,
// real-asset-later convention as buildUtilityPole/buildStreetLamp above:
// cylinder body + conical roof, matching T28's own description. Flat
// material (no texture asset) so ScatterVariationMaterialPlugin's per-
// instance hue/value jitter reads as rust/weathering variety without
// needing an authored texture — the CompositeLocations caller fills the
// actual per-instance buffer once placement count is known (see
// PROCEDURAL_ASSETS's 'farm-silo' entry), this only attaches the plugin.
export function buildFarmSilo(scene: Scene): Mesh {
  const mat = pbr(scene, 'locProp_farmSiloMat', new Color3(0.62, 0.6, 0.56), 0.85);
  new ScatterVariationMaterialPlugin(mat);
  const bodyHeight = 16;
  const diameter = 8;
  const roofHeight = 3;
  const parts: Mesh[] = [];
  const body = MeshBuilder.CreateCylinder('farmSiloBody', {
    height: bodyHeight, diameter, tessellation: 16,
  }, scene);
  body.position.y = bodyHeight / 2;
  parts.push(body);
  const roof = MeshBuilder.CreateCylinder('farmSiloRoof', {
    height: roofHeight, diameterBottom: diameter, diameterTop: 0, tessellation: 16,
  }, scene);
  roof.position.y = bodyHeight + roofHeight / 2;
  parts.push(roof);
  return mergeParts('locProp_farmSilo', parts, mat);
}

function buildRocks(scene: Scene): Mesh {
  const mat = texturedMaterial(
    scene,
    'locProp_rocksMat',
    {
      albedo: `${TEXTURES_BASE}rocky-terrain-02/rocky_terrain_02_diff_512.jpg`,
      normal: `${TEXTURES_BASE}rocky-terrain-02/rocky_terrain_02_nor_gl_512.png`,
      roughness: `${TEXTURES_BASE}rocky-terrain-02/rocky_terrain_02_rough_512.png`,
    },
    1.5,
  );
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
  const mat = texturedMaterial(
    scene,
    'locProp_stepsMat',
    {
      albedo: `${TEXTURES_BASE}marble-cliff-03/marble_cliff_03_diff_512.jpg`,
      normal: `${TEXTURES_BASE}marble-cliff-03/marble_cliff_03_nor_gl_512.png`,
    },
    1.2,
  );
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
  const mat = texturedMaterial(
    scene,
    'locProp_barrelMat',
    {
      albedo: `${CITY_KIT_TEXTURE_BASE}T_MetalConcrete_BaseColor.png`,
      normal: `${CITY_KIT_TEXTURE_BASE}T_MetalConcrete_Normal.png`,
      orm: `${CITY_KIT_TEXTURE_BASE}T_MetalConcrete_ORM.png`,
    },
    1.5,
  );
  mat.albedoColor = new Color3(0.2, 0.2, 0.22);
  mat.metallic = 0.6;
  const barrel = MeshBuilder.CreateCylinder('locProp_trashBarrel', {
    height: 0.9, diameterTop: 0.55, diameterBottom: 0.5, tessellation: 12,
  }, scene);
  barrel.position.y = 0.45;
  barrel.material = mat;
  return barrel;
}

function buildPostGrill(scene: Scene): Mesh {
  const mat = texturedMaterial(
    scene,
    'locProp_grillMat',
    {
      albedo: `${CITY_KIT_TEXTURE_BASE}T_MetalConcrete_BaseColor.png`,
      normal: `${CITY_KIT_TEXTURE_BASE}T_MetalConcrete_Normal.png`,
      orm: `${CITY_KIT_TEXTURE_BASE}T_MetalConcrete_ORM.png`,
    },
    1,
  );
  mat.albedoColor = new Color3(0.16, 0.16, 0.17);
  mat.metallic = 0.7;
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
  const mat = texturedMaterial(
    scene,
    'locProp_fountainMat',
    {
      albedo: `${TEXTURES_BASE}marble-cliff-03/marble_cliff_03_diff_512.jpg`,
      normal: `${TEXTURES_BASE}marble-cliff-03/marble_cliff_03_nor_gl_512.png`,
    },
    1,
  );
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
  const mat = texturedMaterial(
    scene,
    'locProp_shedMat',
    {
      albedo: `${CITY_KIT_TEXTURE_BASE}T_MetalConcrete_BaseColor.png`,
      normal: `${CITY_KIT_TEXTURE_BASE}T_MetalConcrete_Normal.png`,
      orm: `${CITY_KIT_TEXTURE_BASE}T_MetalConcrete_ORM.png`,
    },
    2,
  );
  mat.albedoColor = new Color3(0.34, 0.33, 0.3);
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
    // false/true: recurse (none of these templates parent children, but
    // matches CompositeLocations' own convention), disposeMaterialAndTextures
    // true — several builders above (buildRocks, buildStoneSteps,
    // buildTrashBarrel, buildPostGrill, buildDeadFountain, buildShedShell,
    // buildStreetLamp) now own real texture files via texturedMaterial(),
    // which would leak GPU texture memory on every dev-HUD rebuild otherwise.
    dispose: () => templates.forEach((t) => t.dispose(false, true)),
  };
}
