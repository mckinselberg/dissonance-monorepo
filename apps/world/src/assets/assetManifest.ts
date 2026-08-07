/**
 * Catalog of 3D asset packs under apps/world/public/models/. This is the
 * first piece of an asset processing pipeline: formalize what ASSET-LICENSE.txt
 * prose already recorded per-pack (source, license, triangle counts, the
 * gltfpack/Blender/ffmpeg commands used) into data a script can read, instead
 * of provenance living only as free text next to each model.
 *
 * Pure data/types — no Vite/browser env references — so this can be imported
 * from both app runtime code and Node authoring scripts.
 */

export type AssetCategory =
  | 'vegetation'
  | 'structure'
  | 'furniture'
  | 'vehicle'
  | 'creature'
  | 'handheld'
  | 'interior-capture';

export type AssetLicenseStatus =
  // Source, author, and license are recorded and traceable.
  | 'confirmed'
  // A working asset exists but provenance is incomplete — do not treat as cleared for redistribution.
  | 'needs-review'
  // No ASSET-LICENSE.txt on disk at all; provenance was never recorded.
  | 'missing';

export interface AssetPackFile {
  /** Relative to apps/world/public/models/<pack.id>/ */
  path: string;
  role: 'runtime' | 'source' | 'preview';
}

export interface AssetProcessingStep {
  tool: 'gltfpack' | 'blender' | 'ffmpeg' | 'gltf-transform';
  summary: string;
  /** Triangle count before/after, when the ASSET-LICENSE.txt recorded it. */
  triangles?: { before: number; after: number };
}

export interface AssetPackSource {
  url?: string;
  author?: string;
  note?: string;
}

export interface AssetPack {
  id: string;
  label: string;
  category: AssetCategory;
  files: AssetPackFile[];
  /** Textures shared across multiple files in this pack, not tied to one mesh file. */
  sharedTextures?: string[];
  source?: AssetPackSource;
  license?: string;
  licenseStatus: AssetLicenseStatus;
  processing?: AssetProcessingStep[];
  notes?: string;
}

const POLYHAVEN_LICENSE = 'CC0 1.0 Universal';
const QUATERNIUS_LICENSE = 'CC0 1.0 Universal';

export const ASSET_MANIFEST: AssetPack[] = [
  {
    id: 'dead-tree-trunk-02',
    label: 'Dead Tree Trunk 02',
    category: 'vegetation',
    files: [{ path: 'dead_tree_trunk_02_preview.glb', role: 'runtime' }],
    source: {
      url: 'https://polyhaven.com/a/dead_tree_trunk_02',
      author: 'Jenelle van Heerden (Photography), Rico Cilliers (Processing)',
    },
    license: POLYHAVEN_LICENSE,
    licenseStatus: 'confirmed',
    processing: [
      { tool: 'ffmpeg', summary: 'downscaled 3 textures from 4K to 1024x1024 (only a 4K source glTF was available)' },
      {
        tool: 'gltfpack',
        summary: 'gltfpack -si 0.25 -sp -kn -km, packaged as one GLB',
        triangles: { before: 83128, after: 20782 },
      },
    ],
    notes: 'Diffuse color-normalized 2026-07-23 against the other tree species (see tree-small-02). Meshopt runtime compression intentionally disabled to avoid an external decoder fetch.',
  },
  {
    id: 'fir-sapling-medium',
    label: 'Fir Sapling Medium',
    category: 'vegetation',
    files: [{ path: 'fir_sapling_medium_preview.glb', role: 'runtime' }],
    source: {
      url: 'https://polyhaven.com/a/fir_sapling_medium',
      author: 'Rico Cilliers (Modeling), Rob Tuytel (Photography)',
    },
    license: POLYHAVEN_LICENSE,
    licenseStatus: 'confirmed',
    processing: [
      {
        tool: 'gltfpack',
        summary: 'from Poly Haven 1K glTF, gltfpack -si 0.033 -sp -kn -km, preserves original 6 1K JPEG textures (3 meshes: branches/twigs/dead-branches)',
        triangles: { before: 1533513, after: 53435 },
      },
    ],
    notes: 'Branches diffuse color-normalized 2026-07-23; twigs diffuse (alpha-cutout card atlas) deliberately left untouched. Meshopt runtime compression intentionally disabled.',
  },
  {
    id: 'pine-sapling-medium',
    label: 'Pine Sapling Medium',
    category: 'vegetation',
    files: [{ path: 'pine_sapling_medium_preview.glb', role: 'runtime' }],
    source: {
      url: 'https://polyhaven.com/a/pine_sapling_medium',
      author: 'Rico Cilliers (Modeling), Rob Tuytel (Photography)',
    },
    license: POLYHAVEN_LICENSE,
    licenseStatus: 'confirmed',
    processing: [
      { tool: 'ffmpeg', summary: 'downscaled 6 textures from 4K to 1024x1024 (only a 4K source glTF was available)' },
      {
        tool: 'gltfpack',
        summary: 'gltfpack -si 0.009 -sp -kn -km (3 meshes: bark/twig/dead-branches); needed a much lower ratio than tree-small-02 since source is ~3x heavier',
        triangles: { before: 6038139, after: 62147 },
      },
    ],
    notes: 'Bark diffuse color-normalized 2026-07-23; twig diffuse deliberately left untouched. Meshopt runtime compression intentionally disabled.',
  },
  {
    id: 'tree-small-02',
    label: 'Tree Small 02 (hero/near-field tier)',
    category: 'vegetation',
    files: [{ path: 'tree_small_02_preview.glb', role: 'runtime' }],
    source: { url: 'https://polyhaven.com/a/tree_small_02', author: 'Rico Cilliers' },
    license: POLYHAVEN_LICENSE,
    licenseStatus: 'confirmed',
    processing: [
      {
        tool: 'gltfpack',
        summary: 'gltfpack 1.1 -si 0.025 -sp -kn -km, preserves original 9 1K JPEG textures',
        triangles: { before: 2062487, after: 52353 },
      },
      {
        tool: 'gltfpack',
        summary: 're-simplified 2026-07-23 (gltfpack 1.2, -si 0.015) — deliberate art-direction decimation (Dan), not a performance fix; chosen from a 3-way comparison as smallest reduction indistinguishable at normal viewing distance',
        triangles: { before: 52353, after: 32854 },
      },
    ],
    notes: 'Trunk+branch diffuse color-normalized 2026-07-23 (60% blend toward the 6-species bark/wood average via NumPy/Pillow Reinhard-style transfer — see rocky-terrain-02 texture ASSET-LICENSE.txt for the technique). Leaves diffuse (alpha-cutout, transparent bg) deliberately untouched — cross-species foliage color variance is correct. Meshopt runtime compression intentionally disabled.',
  },
  {
    id: 'tree-small-02-scatter',
    label: 'Tree Small 02 (bulk/scatter tier)',
    category: 'vegetation',
    files: [{ path: 'tree_small_02_scatter_preview.glb', role: 'runtime' }],
    source: { url: 'https://polyhaven.com/a/tree_small_02', author: 'Rico Cilliers' },
    license: POLYHAVEN_LICENSE,
    licenseStatus: 'confirmed',
    processing: [
      {
        tool: 'gltfpack',
        summary: 'same 1K glTF source as tree-small-02, gltfpack -si 0.002 -sp -kn -km for bulk/non-trail-adjacent forest use; tested down to the gltfpack floor (~4,737 tris), which loses too much leaf-card geometry, so 7,660 was chosen as the lowest ratio that still reads as leafy',
        triangles: { before: 2062487, after: 7660 },
      },
    ],
    notes: 'Shares tree-small-02\'s color-normalized textures. Meshopt runtime compression intentionally disabled.',
  },
  {
    id: 'tree-stump-01',
    label: 'Tree Stump 01',
    category: 'vegetation',
    files: [{ path: 'tree_stump_01_preview.glb', role: 'runtime' }],
    source: { url: 'https://polyhaven.com/a/tree_stump_01', author: 'Rob Tuytel' },
    license: POLYHAVEN_LICENSE,
    licenseStatus: 'confirmed',
    processing: [
      { tool: 'ffmpeg', summary: 'downscaled 3 textures from 4K to 1024x1024 (only a 4K source glTF was available)' },
      {
        tool: 'gltfpack',
        summary: 'gltfpack -si 0.3 -sp -kn -km',
        triangles: { before: 41046, after: 12312 },
      },
    ],
    notes: 'Diffuse color-normalized 2026-07-23; this diffuse is a multi-region UV atlas (moss/bark/wood/leaf-litter) but fully opaque, so the statistical transform applies safely. Meshopt runtime compression intentionally disabled.',
  },
  {
    id: 'quaternius-forest',
    label: 'Quaternius Forest Kit',
    category: 'vegetation',
    files: [
      'BirchTree_1', 'BirchTree_2', 'BirchTree_3', 'BirchTree_4', 'BirchTree_5',
      'MapleTree_1', 'MapleTree_2', 'MapleTree_3', 'MapleTree_4', 'MapleTree_5',
      'DeadTree_1', 'DeadTree_2', 'DeadTree_3', 'DeadTree_4', 'DeadTree_5',
      'DeadTree_6', 'DeadTree_7', 'DeadTree_8', 'DeadTree_9', 'DeadTree_10',
      'Bush', 'Bush_Flowers', 'Bush_Large', 'Bush_Large_Flowers', 'Bush_Small', 'Bush_Small_Flowers',
      'Flower_1', 'Flower_1_Clump', 'Flower_2', 'Flower_2_Clump', 'Flower_3_Clump', 'Flower_4_Clump', 'Flower_5_Clump',
      'Grass_Small', 'Grass_Large', 'Grass_Large_Extruded',
    ].map((name): AssetPackFile => ({ path: `${name}.gltf`, role: 'runtime' })),
    sharedTextures: [
      'BirchTree_Bark.jpg', 'BirchTree_Bark_Normal.png', 'BirchTree_Leaves.png',
      'MapleTree_Bark.jpg', 'MapleTree_Bark_Normal.png', 'MapleTree_Leaves.png',
      'NormalTree_Bark.jpg', 'NormalTree_Bark_Normal.png',
      'Bush_Leaves.png', 'Flowers.png', 'Grass.png',
    ],
    source: { url: 'https://quaternius.com', author: '@Quaternius' },
    license: QUATERNIUS_LICENSE,
    licenseStatus: 'confirmed',
    processing: [
      { tool: 'ffmpeg', summary: 'Bark(.jpg)/Bark_Normal(.png) texture trio for Birch/Maple/(Dead via NormalTree) downscaled 2048x2048 -> 512x512 to match the ground-texture convention (rocky-terrain-02, marble-cliff-03)' },
    ],
    notes: 'Raw multi-file glTF (mesh + .bin + loose textures), same convention as downtown-city-megakit — not baked into a single GLB since each species is already a small single-mesh asset with no benefit from gltfpack decimation. Selected 2026-08-01 for T7 forest-impasse/grove work: 36 of the full pack\'s meshes imported (canopy/hero variety, 10 deadfall silhouettes, shrub-wall/understory fill, ground-cover accents); NormalTree_*/PalmTree_*/PineTree_*/Rocks.jpg deliberately left out (texture-only in this download, no mesh). DeadTree_* intentionally references the NormalTree_Bark texture set (pairing from the source pack, not a substitution made here). Leaf/flower/grass textures (already 1024x1024 alpha-cutout cards) left untouched; MapleTree_Leaves_BW.png not copied (unreferenced by the 5 imported Maple variants).',
  },
  {
    id: 'downtown-city-megakit',
    label: 'Downtown City MegaKit (Standard/free)',
    category: 'structure',
    files: [
      'Building_Large_2', 'Building_Medium_2_001', 'Building_Small_1',
      'Street_2Lane', 'Street_TIntersection',
      'Sidewalk_Straight_3m', 'Sidewalk_Corner_Flat_3m',
      'Decal_Crosswalk', 'Decal_Crosswalk_Wide',
      'Prop_Bollard', 'Prop_Planter_Single', 'Prop_ManholeCover', 'Prop_Drain',
    ].map((name): AssetPackFile => ({ path: `${name}.gltf`, role: 'runtime' })),
    sharedTextures: [
      'T_Concrete_BaseColor.png', 'T_Concrete_Normal.png', 'T_Concrete_ORM.png',
      'T_Concrete_Asphalt_BaseColor.png',
      'T_Dirt_BaseColor.png', 'T_Dirt_Normal.png', 'T_Dirt_ORM.png',
      'T_MarbleFloor_BaseColor.png', 'T_MarbleFloor_Normal.png', 'T_MarbleFloor_ORM.png',
      'T_MetalConcrete_BaseColor.png', 'T_MetalConcrete_Normal.png', 'T_MetalConcrete_ORM.png',
      'T_RedBrick_BaseColor.png', 'T_RedBrick_Normal.png', 'T_RedBrick_ORM.png',
      'T_Trim_BaseColor.png', 'T_Trim_Normal.png', 'T_Trim_ORM.png',
      'T_Street_Decals.png', 'T_dark_interior.png', 'T_lit_interior_1.png', 'T_lit_interior_2.png',
    ],
    source: { url: 'https://quaternius.com', author: '@Quaternius' },
    license: QUATERNIUS_LICENSE,
    licenseStatus: 'confirmed',
    notes: 'Standard (free) tier of the kit; the paid Source version adds Unity/Unreal/Godot projects with collisions/shaders. Initial import (7 modules) for the first Dissonance Boulevard block; extended 2026-07-24 with 6 more modules (decal/intersection polish pass) from the same package/export. Every module shares this one license file and T_Street_Decals.png.',
  },
  {
    id: 'flashlight',
    label: 'Small Plastic Torch',
    category: 'handheld',
    files: [{ path: 'runtime/flashlight.glb', role: 'runtime' }],
    source: {
      note: 'Source package supplied locally by Daniel 2026-08-03 at apps/world/assets/models/flashlight/source/small_plastic_torch_4k/. Original download URL, author, and license not yet recorded.',
    },
    licenseStatus: 'needs-review',
    processing: [
      {
        tool: 'blender',
        summary: 'apps/world/scripts/blender/prepare_prop.py --decimate-ratio 0.7 --texture-size 1024; embeds 1K versions of 5 source 4K material textures',
        triangles: { before: 13252, after: 9288 },
      },
    ],
    notes: 'Do not infer redistribution rights from the presence of this working asset — confirm and record source attribution/license before any public release. 70% decimation selected as the lowest conservative reduction with no visible silhouette loss (compared against 100%/70%/50% candidates from the same camera), preserving the wrist loop and ridged end caps.',
  },
  {
    id: 'mech-dog',
    label: 'Mech Dog (companion / hostile patrol skins)',
    category: 'creature',
    files: [
      { path: 'Husky.gltf', role: 'runtime' },
      { path: 'HuskyBlack.gltf', role: 'runtime' },
    ],
    licenseStatus: 'missing',
    notes: 'No ASSET-LICENSE.txt on disk — provenance not recorded. Both files are self-contained single-file glTF (embedded buffers/textures, no external .bin or loose textures alongside). Husky ("default" skin) and HuskyBlack drive both the companion dog (MechDogController) and the hostile T28 patrol dog (RoadPatrolDog) — see THREADS.md T40 for the currently-mismatched skin-label/HUD text this manifest does not attempt to resolve.',
  },
  {
    id: 'milos-apartment',
    label: "Milo's Apartment (photogrammetry capture)",
    category: 'interior-capture',
    files: [
      { path: 'runtime/milos-apartment.glb', role: 'runtime' },
      { path: 'source/milos-apartment-capture-original.glb', role: 'source' },
    ],
    licenseStatus: 'missing',
    notes: 'No ASSET-LICENSE.txt on disk. Own capture, not a third-party asset, so licensing may not apply the same way as the Poly Haven/Quaternius packs — still unrecorded either way. The runtime and source GLBs are nearly identical in size (~4.32MB each), unlike every other pack\'s runtime derivative, which suggests the "processing" step for this one was minimal/non-optimizing; worth revisiting once a general decimation/compression pass exists.',
  },
  {
    id: 'vehicles',
    label: 'Vehicle (Riviera)',
    category: 'vehicle',
    files: [{ path: 'Riviera Black.glb', role: 'runtime' }],
    licenseStatus: 'missing',
    notes: 'No ASSET-LICENSE.txt on disk — provenance not recorded. Filename contains a space, unlike every other pack\'s kebab-case convention. 14.7MB single GLB, no recorded optimization pass — a processing-pipeline candidate.',
  },
  {
    id: 'city-complex',
    label: 'City Complex',
    category: 'structure',
    files: [{ path: 'city-complex.glb', role: 'runtime' }],
    licenseStatus: 'missing',
    notes: 'No ASSET-LICENSE.txt on disk — provenance not recorded. 18.3MB single GLB, no recorded optimization pass — a processing-pipeline candidate.',
  },
  {
    id: 'couch',
    label: 'Couch',
    category: 'furniture',
    files: [{ path: 'couch.glb', role: 'runtime' }],
    licenseStatus: 'missing',
    notes: 'No ASSET-LICENSE.txt on disk — provenance not recorded. THREADS.md v9.50 records this as a decimated real couch capture (@gltf-transform/cli, 285k -> 35k tris) placed in Milo\'s building lobby, but that processing detail was never written into an ASSET-LICENSE.txt here — folded into this manifest entry\'s history via that changelog line, not verified against a license file.',
    processing: [
      { tool: 'gltf-transform', summary: 'Recorded only in THREADS.md v9.50, not in an ASSET-LICENSE.txt: decimated via @gltf-transform/cli', triangles: { before: 285000, after: 35000 } },
    ],
  },
];

export function getAssetPack(id: string): AssetPack | undefined {
  return ASSET_MANIFEST.find((pack) => pack.id === id);
}

export function listAssetPacksByCategory(category: AssetCategory): AssetPack[] {
  return ASSET_MANIFEST.filter((pack) => pack.category === category);
}
