import { Vector3, type Scene, type ShadowGenerator } from '@babylonjs/core';
import type { Collider } from '@dissonance/world';
import type { LocationEntry } from './LocationProps';
import { loadHeroTreeInstances, type HeroTreeInstancesHandle } from './HeroTreeInstances';

// Executes the design intent of docs/intake/world-foliage-impasse-prompt-v1.md
// (T7: impasse zones ringing/subdividing a forest, one authored grove
// clearing, one secret entrance) through this app's actual pipeline instead
// of that doc's Blender-authored/baked-terrain/navmesh assumptions — see
// LocationProps.ts's `forestImpasse` field comment for why. Same
// "one template mesh per species, thin-instance every placement" technique
// HeroTreeInstances/TrailsideForestSystem/BulkForestSystem already use, and
// the same "read locations.json, build geometry + Collider[]" shape as
// FalloutShelterEntrance.ts/UtilityCorridors.ts.
//
// Known Phase-1 simplification: loadHeroTreeInstances only supports
// upright placement (random Y-facing, uniform XZ/Y scale) — there is no
// per-instance arbitrary rotation hook, so deadfall trunks stand upright
// rather than lying cross-hatched as the source doc pictures. A dense row
// of standing dead trees still functions as the intended impasse (blocks
// movement, breaks sightlines); it just reads as a dead-wood thicket rather
// than literal stacked logs. Extending the shared primitive for arbitrary
// per-instance orientation would affect every other caller (bulk/trailside
// forest, shelter thicket) for a cosmetic gain this phase doesn't need.

const FOREST_ASSET_BASE = `${import.meta.env.BASE_URL}models/quaternius-forest/`;

// Grove canopy-ring anchors — alternating species so six anchor trees don't
// read as one clone stamped six times.
const CANOPY_ASSETS = [
  'BirchTree_1.gltf', 'MapleTree_1.gltf', 'BirchTree_2.gltf', 'MapleTree_2.gltf',
  'BirchTree_3.gltf', 'MapleTree_3.gltf', 'BirchTree_4.gltf', 'MapleTree_4.gltf',
  'BirchTree_5.gltf', 'MapleTree_5.gltf',
].map((f) => FOREST_ASSET_BASE + f);

// Ten distinct silhouettes for deadfall runs — real species variety instead
// of one trunk repeated ("vary angle... to break visual repetition", source
// doc).
const DEADFALL_ASSETS = Array.from({ length: 10 }, (_, i) => `${FOREST_ASSET_BASE}DeadTree_${i + 1}.gltf`);

// Its own asset (not drawn from DEADFALL_ASSETS) so the grove's landmark
// snag stays visually consistent across rebuilds rather than depending on
// per-zone indexing.
const SNAG_ASSET = `${FOREST_ASSET_BASE}DeadTree_10.gltf`;

// Vine-tangle stand-in: this pack ships no rope/vine geometry, so dense
// stacked bush clusters carry the "opaque, ground-to-canopy" read the
// source doc asks for — its own text already frames the alternative as
// "vine-heavy brush", not literal vines.
// Ground-to-canopy layering (source doc's own Image 1 reference) needs real
// trees in the mix, not just an understory of bushes — a sparse bush-only
// scatter left large gaps of bare ground inside what's meant to read (and
// collide) as one solid, opaque thicket.
const VINE_TANGLE_ASSETS = [
  `${FOREST_ASSET_BASE}Bush_Large.gltf`,
  `${FOREST_ASSET_BASE}Bush_Large_Flowers.gltf`,
  `${FOREST_ASSET_BASE}Bush.gltf`,
  `${FOREST_ASSET_BASE}BirchTree_4.gltf`,
  `${FOREST_ASSET_BASE}BirchTree_5.gltf`,
  `${FOREST_ASSET_BASE}MapleTree_4.gltf`,
  `${FOREST_ASSET_BASE}MapleTree_5.gltf`,
];

// Shrub-wall: smaller variants than the vine tangle — a softer, passable
// gate rather than a true wall (see the collider split below).
const SHRUB_WALL_ASSETS = [
  `${FOREST_ASSET_BASE}Bush_Small.gltf`,
  `${FOREST_ASSET_BASE}Bush_Small_Flowers.gltf`,
];

// Grove floor / secret-entrance-mouth ground cover.
const GROUND_COVER_ASSETS = [
  `${FOREST_ASSET_BASE}Grass_Small.gltf`,
  `${FOREST_ASSET_BASE}Flower_1_Clump.gltf`,
  `${FOREST_ASSET_BASE}Flower_2_Clump.gltf`,
];

const CANOPY_SCALE = 1.0;
const DEADFALL_SCALE = 1.15;
const VINE_TANGLE_SCALE = 1.2;
const SHRUB_WALL_SCALE = 0.85;
const GROUND_COVER_SCALE = 0.8;
const SNAG_HORIZONTAL_SCALE = 1.0;
const SNAG_VERTICAL_SCALE = 1.9;

// Center-to-center spacing along a deadfall run — close enough that
// neighboring trunks visually overlap (the "reads solid from a distance"
// half of the secret entrance's tell), loose enough that the authored gap
// reads as a real opening rather than a missing tooth.
const LOG_SPACING_METERS = 2.4;
// Coarse, generous, eyeballed — same philosophy as LocationProps'
// PROP_COLLISION_RADII, not a tight hitbox.
const DEADFALL_LOG_COLLIDER_RADIUS_METERS = 1.1;
const SNAG_COLLIDER_RADIUS_METERS = 0.65;

const CANOPY_RING_COUNT = 6;
const GROVE_GROUND_COVER_COUNT = 14;
// Per-square-meter, not per-radius-meter — a disc's area grows with the
// square of its radius, so a linear-in-radius count left large zones
// visibly sparser than small ones (a 20m-radius vine tangle read as barely
// filled at all). Lower than the source doc's own 0.7-0.9/m² tree-only
// density target (that many full trees would be a BulkForestSystem-scale
// field, not a small authored pocket), but high enough with these mixed
// bush+tree assets to read as one continuous, opaque thicket rather than a
// sparse scatter inside an invisible collider.
const VINE_TANGLE_DENSITY_PER_SQM = 0.09;
const SHRUB_WALL_DENSITY_PER_SQM = 0.05;

export interface ForestImpassesHandle {
  colliders: Collider[];
  dispose(): void;
}

function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function loadForestImpasses(
  scene: Scene,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
  getHeightAt: (x: number, z: number) => number,
  shadowGenerator?: ShadowGenerator,
): ForestImpassesHandle {
  const positionsByAsset = new Map<string, Vector3[]>();
  const colliders: Collider[] = [];
  let disposed = false;
  const handles: HeroTreeInstancesHandle[] = [];

  const addInstance = (assetUrl: string, x: number, z: number) => {
    const list = positionsByAsset.get(assetUrl);
    const position = new Vector3(x, getHeightAt(x, z), z);
    if (list) list.push(position);
    else positionsByAsset.set(assetUrl, [position]);
  };

  for (const location of locations) {
    const forest = location.forestImpasse;
    if (!forest) continue;
    const anchor = toRenderXZ(location.latLong[0], location.latLong[1]);

    // Real-meter secret-passage anchor, resolved once per location so every
    // deadfall zone can check whether it owns the gap.
    const secretPassage = forest.secretPassage;

    for (const zone of forest.zones) {
      const cx = anchor.x + zone.local[0] * horizontalScale;
      const cz = anchor.z + zone.local[1] * horizontalScale;

      if (zone.kind === 'deadfall') {
        const heading = ((zone.headingDegrees ?? 0) * Math.PI) / 180;
        const dirX = Math.cos(heading);
        const dirZ = Math.sin(heading);
        const perpX = -dirZ;
        const perpZ = dirX;
        const runLength = zone.radiusMeters * 2;
        const logCount = Math.max(1, Math.round(runLength / LOG_SPACING_METERS));
        const assetOffset = hashId(zone.id) % DEADFALL_ASSETS.length;

        // Project the secret passage's authored position onto this run's
        // axis (in real meters, before horizontalScale) so the gap check
        // below lines up with where logs are actually being placed.
        let gapT: number | null = null;
        if (secretPassage && secretPassage.zoneRef === zone.id) {
          const relX = secretPassage.local[0] - zone.local[0];
          const relZ = secretPassage.local[1] - zone.local[1];
          gapT = relX * dirX + relZ * dirZ;
        }

        for (let i = 0; i < logCount; i++) {
          const t = -zone.radiusMeters + (i + 0.5) * (runLength / logCount);
          if (gapT !== null && Math.abs(t - gapT) < secretPassage!.gapWidthMeters / 2) continue;

          const jitterAlong = (seeded(i, hashId(zone.id)) - 0.5) * LOG_SPACING_METERS * 0.4;
          const jitterAcross = (seeded(i, hashId(zone.id) + 7) - 0.5) * 1.6;
          const realX = zone.local[0] + dirX * (t + jitterAlong) + perpX * jitterAcross;
          const realZ = zone.local[1] + dirZ * (t + jitterAlong) + perpZ * jitterAcross;
          const x = anchor.x + realX * horizontalScale;
          const z = anchor.z + realZ * horizontalScale;

          const asset = DEADFALL_ASSETS[(i + assetOffset) % DEADFALL_ASSETS.length];
          addInstance(asset, x, z);
          colliders.push({ x, z, radius: DEADFALL_LOG_COLLIDER_RADIUS_METERS * horizontalScale });
        }

        // A little ground-cover tell right at the gap mouth — "moss on log
        // undersides, small ferns poking through" (source doc's Option A
        // texture note) — the one visual cue this Phase-1 geometry-only
        // pass can actually give the secret entrance.
        if (gapT !== null) {
          const gapRealX = zone.local[0] + dirX * gapT;
          const gapRealZ = zone.local[1] + dirZ * gapT;
          for (let i = 0; i < 3; i++) {
            const spread = (seeded(i, hashId(zone.id) + 13) - 0.5) * 1.4;
            const x = anchor.x + (gapRealX + perpX * spread) * horizontalScale;
            const z = anchor.z + (gapRealZ + perpZ * spread) * horizontalScale;
            addInstance(GROUND_COVER_ASSETS[i % GROUND_COVER_ASSETS.length], x, z);
          }
        }
      } else if (zone.kind === 'vine-tangle') {
        // One generous blocking disc — "nearly opaque... non-passable by
        // default" (source doc) doesn't need per-bush colliders.
        colliders.push({ x: cx, z: cz, radius: zone.radiusMeters * horizontalScale });
        const count = Math.round(Math.PI * zone.radiusMeters * zone.radiusMeters * VINE_TANGLE_DENSITY_PER_SQM);
        for (let i = 0; i < count; i++) {
          const angle = seeded(i, hashId(zone.id)) * Math.PI * 2;
          const dist = Math.sqrt(seeded(i, hashId(zone.id) + 3)) * zone.radiusMeters;
          const x = cx + Math.cos(angle) * dist * horizontalScale;
          const z = cz + Math.sin(angle) * dist * horizontalScale;
          addInstance(VINE_TANGLE_ASSETS[i % VINE_TANGLE_ASSETS.length], x, z);
        }
      } else {
        // shrub-wall: dense but deliberately no collider — "acceptable to
        // pass through with friction/audio penalty" (source doc); friction/
        // audio are Phase-2, so today it's simply passable.
        const count = Math.round(Math.PI * zone.radiusMeters * zone.radiusMeters * SHRUB_WALL_DENSITY_PER_SQM);
        for (let i = 0; i < count; i++) {
          const angle = seeded(i, hashId(zone.id) + 5) * Math.PI * 2;
          const dist = Math.sqrt(seeded(i, hashId(zone.id) + 11)) * zone.radiusMeters;
          const x = cx + Math.cos(angle) * dist * horizontalScale;
          const z = cz + Math.sin(angle) * dist * horizontalScale;
          addInstance(SHRUB_WALL_ASSETS[i % SHRUB_WALL_ASSETS.length], x, z);
        }
      }
    }

    // Grove clearing — canopy ring, floor ground cover (no colliders inside
    // the bowl, per the source doc), and the landmark snag.
    const groveRealX = forest.grove.local[0];
    const groveRealZ = forest.grove.local[1];
    const groveX = anchor.x + groveRealX * horizontalScale;
    const groveZ = anchor.z + groveRealZ * horizontalScale;
    for (let i = 0; i < CANOPY_RING_COUNT; i++) {
      const angle = (i / CANOPY_RING_COUNT) * Math.PI * 2 + seeded(i, 41) * 0.3;
      const x = groveX + Math.cos(angle) * forest.grove.radiusMeters * horizontalScale;
      const z = groveZ + Math.sin(angle) * forest.grove.radiusMeters * horizontalScale;
      addInstance(CANOPY_ASSETS[i % CANOPY_ASSETS.length], x, z);
    }
    for (let i = 0; i < GROVE_GROUND_COVER_COUNT; i++) {
      const angle = seeded(i, 53) * Math.PI * 2;
      const dist = Math.sqrt(seeded(i, 59)) * forest.grove.radiusMeters * 0.85;
      const x = groveX + Math.cos(angle) * dist * horizontalScale;
      const z = groveZ + Math.sin(angle) * dist * horizontalScale;
      addInstance(GROUND_COVER_ASSETS[i % GROUND_COVER_ASSETS.length], x, z);
    }
    const snagX = anchor.x + forest.grove.snagLocal[0] * horizontalScale;
    const snagZ = anchor.z + forest.grove.snagLocal[1] * horizontalScale;
    addInstance(SNAG_ASSET, snagX, snagZ);
    colliders.push({ x: snagX, z: snagZ, radius: SNAG_COLLIDER_RADIUS_METERS * horizontalScale });
  }

  const scaleForAsset = (assetUrl: string): { hScale: number; vScale: number } => {
    if (assetUrl === SNAG_ASSET) return { hScale: SNAG_HORIZONTAL_SCALE, vScale: SNAG_VERTICAL_SCALE };
    if (assetUrl.includes('DeadTree')) return { hScale: DEADFALL_SCALE, vScale: DEADFALL_SCALE };
    if (assetUrl.includes('BirchTree') || assetUrl.includes('MapleTree')) return { hScale: CANOPY_SCALE, vScale: CANOPY_SCALE };
    if (assetUrl.includes('Bush_Large')) return { hScale: VINE_TANGLE_SCALE, vScale: VINE_TANGLE_SCALE };
    if (assetUrl.includes('Bush')) return { hScale: SHRUB_WALL_SCALE, vScale: SHRUB_WALL_SCALE };
    return { hScale: GROUND_COVER_SCALE, vScale: GROUND_COVER_SCALE };
  };

  for (const [assetUrl, positions] of positionsByAsset) {
    const { hScale, vScale } = scaleForAsset(assetUrl);
    void loadHeroTreeInstances(
      scene,
      assetUrl,
      positions,
      horizontalScale * hScale,
      horizontalScale * vScale,
      shadowGenerator,
    )
      .then((handle) => {
        if (disposed) handle.dispose();
        else handles.push(handle);
      })
      .catch((error) => {
        console.error(`[ForestImpasses] failed to load ${assetUrl}`, error);
      });
  }

  return {
    colliders,
    dispose() {
      disposed = true;
      handles.forEach((handle) => handle.dispose());
    },
  };
}
