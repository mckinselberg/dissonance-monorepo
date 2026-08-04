# loot-room-blender-guide-and-manifest-v1.md

**Owning thread:** proposed **T18. Archaeological interior (loot room)** (pending O-LR1)
**Pairs with:** `loot-room-audit-prompt-v1.md` (Phase 0 audit — run first)
**Keyed to:** `2_6_2026.glb` (the actual capture, inspected)
**Session type:** offline Blender authoring (T8-adjacent, no repo code)

This is two coupled documents:
- **Part A — Blender segmentation guide**, specced against the real geometry.
- **Part B — Manifest as target contract**: the node names Part A must produce. Part B does not describe the current file; it describes the file Part A creates. The manifest is ready to load the moment segmentation lands.

---

## Ground truth (inspected from `2_6_2026.glb`)

| Property | Value | Consequence |
|---|---|---|
| Nodes | 3 (one parent, two mesh children) | **No segmentation.** Everything is two blobs. |
| Mesh 0 | 21,254 tris / 12,856 verts / atlas 0 | Fused capture region A |
| Mesh 1 | 15,188 tris / 9,296 verts / atlas 1 | Fused capture region B |
| Total tris | ~36,400 | Under even the low budget on geometry — headroom for authored decay |
| Textures | 4096×4096 (2.0MB) + 4096×3136 (1.6MB), JPEG | ~3.5MB; the heavy half of the asset |
| Materials | 2, `metallicFactor: 0`, baseColor only | **Baked lighting in atlases.** No metal/rough/normal maps. |
| Bounds | X≈3.7m, Y≈2.6m, Z≈3.2m | **Axis ambiguous** — vertical is not the tallest axis (see A1). |
| Total file | 4.3MB GLB | Lean; textures dominate |

Three facts drive everything below: **(1)** it's raw two-blob capture — no couch/guitar/glyph nodes exist yet; **(2)** lighting is baked into the JPEGs; **(3)** the three magenta Synod glyphs are painted into atlas texels, not separable geometry.

---

# PART A — Blender Segmentation Guide

## A1. Axis and scale — VERIFY FIRST, before anything else

The bounds are wrong for a room as-is: Y (2.6m) is shorter than both X (3.7m) and Z (3.2m). A room's vertical axis should normally be the tallest or near it. This capture is almost certainly **Z-up** (photogrammetry default), meaning the ~3.2m Z is a floor dimension and the true ceiling height is one of the horizontal-looking axes. **Do not proceed on assumption. Verify in Blender:**

1. Import the GLB. Note which axis points "up" in the room (couch sits on floor, window is vertical, guitars hang vertically).
2. **Scale check via known object.** The couch is the best reference — a two-seat leather couch is ~1.5–1.7m wide. Measure the couch's long dimension in Blender units. If it reads ~1.6, the file is already in meters. If it reads ~0.016 or ~160, apply the corresponding scale so **1 Blender unit = 1 meter**.
3. **Axis conversion.** If up is Z, rotate the root −90° on X so up becomes Y (glTF convention), then **apply the rotation** (Ctrl+A → Rotation). Re-check that the window is vertical and the floor is horizontal.
4. Set origin to **approximate center of room floor** (Object → Set Origin → Origin to 3D Cursor with cursor floor-centered).
5. **Apply all transforms** (Ctrl+A → All Transforms) before export.
6. Record the final couch long-axis measurement in the export notes so the manifest `transform.scale` can trust it.

> If verification shows the capture is already meters + Y-up, skip the conversion but still record the couch measurement.

## A2. Separate the two blobs into semantic parts

The capture is two fused meshes sharing two atlases. You will cut them into the named parts the manifest expects. Work in Edit Mode with the texture visible (material preview) so you can select by what you see.

**Method:** select faces belonging to each object (L to select linked-flat where geometry is islanded; box/lasso where fused), then P → Selection to split into a new object. Rename per the target contract in Part B.

**Do not over-split.** The contract has ~18 target objects, not one-per-fragment. Group tiny clutter into `Clutter_A`/`Clutter_B` bins.

Cut order (coarse → fine):

1. **Architecture first.** Isolate the two visible walls and the floor. These become `PG_ARCH_*`. The rebuilt-geometry option (A4) applies here.
2. **Occluder walls.** The left gallery wall and right window wall each also need an **occluder** version for the cutaway system — see A5.
3. **Hero props.** Couch, desk, keyboard, the two corner guitars, speaker cabinet, the wall-art cluster. These become `PG_PROP_*`.
4. **Artifact anchor regions.** The fallen framed photo on the couch, the disc on the desk, the buried-cassette zone in the floor debris, the keyboard (doubles as synth-memory host), one guitar (broken-component host). These get `ARTIFACT_ANCHOR_*` **empties** placed at them (A6) — you are not making the capture mesh itself interactive.
5. **Everything else** → `Clutter_A` / `Clutter_B`.

## A3. Remove capture artifacts

Delete: floating geometry, stretched reconstruction webs, duplicate/overlapping surfaces, any exterior fragments beyond the two walls, geometry under the floor plane, and the **front two walls** (the ones facing the isometric camera) if the capture reconstructed them — the cutaway view needs them gone or they become the always-hidden pair. Keep only the two back-facing walls the screenshot shows.

## A4. Optimization — hybrid, honest about the budget

Geometry is already cheap (~36k tris). The win here is **structure, not decimation**. Do not blindly decimate — you have headroom.

- **Rebuild walls + floor** as clean low-poly planes where the capture is noisy. Project the atlas onto them (keep UVs) so they still read as the captured surface. This gives you clean occluder geometry for free.
- **Keep hero props at capture density** — 36k total means you can afford it.
- **Decimate only** genuinely dense clutter that isn't a hero read.
- **Author replacements** (not decimate) for anything needing state change — the Synod relay especially (see Part B, it's authored-mesh-preferred).

Target after segmentation: stay near the current ~36k visible; the low/balanced/high split (Part B) comes from texture resolution and clutter culling, not aggressive geometry LODs, because geometry was never the bottleneck. **Textures are.**

## A5. Occluders — the cutaway requirement

For each of the two visible walls, produce a low-poly occluder mesh (`PG_OCCLUDER_LeftWall`, `PG_OCCLUDER_RightWall`). These are the meshes the runtime fades/hides per camera orientation and per selection line-of-sight. They can be the rebuilt clean planes from A4. They must be separate objects so the runtime can toggle them without touching the textured hero wall.

Map them to compass sides in the manifest (`occludersBySide`). The screenshot's high-angle-into-corner framing means, per orientation, one of the two is nearest-camera and hides.

## A6. Artifact anchors — empties, not mesh

Place an **Empty** (Plain Axes) at each artifact location, parented to the room root, named per Part B (`ARTIFACT_ANCHOR_*`). Position each at the object's interaction point:

- `ARTIFACT_ANCHOR_PersonalImage` → the fallen framed photo on the couch cushion.
- `ARTIFACT_ANCHOR_DegradedCassette` → in the floor debris field (this one starts **buried** — see A7).
- `ARTIFACT_ANCHOR_SynthMemory` → at the keyboard on the windowsill.
- `ARTIFACT_ANCHOR_GuitarComponent` → at the lower of the two corner guitars.
- `ARTIFACT_ANCHOR_SynodRelay` → **your call on placement**; the glyph near the window (top-right) is the natural diegetic home. This anchor prefers an **authored replacement mesh**, not the capture (Part B).

Store `artifactId` and the mesh-hide list in glTF `extras` on each empty **if your export path preserves extras** (verify — the current file has none). If extras don't survive, the manifest carries the mapping by node name instead (Part B supports both).

## A7. Excavation cover — one authored mesh

`ARTIFACT_ANCHOR_DegradedCassette` starts buried. Author a small debris-cover mesh (`EXCAVATION_COVER_Cassette`) sitting over the anchor — a clump of the floor rubble, authored so it can fade/move/remove at runtime independent of the capture floor. The capture's existing debris field gives you the visual language to match.

## A8. The three Synod glyphs — texture regions, decision deferred

The magenta glyphs (window-corner sigil, wall-art mandala, floor spiral) are **baked into the atlases** — not geometry. Per the "keep ambiguous, spec both" decision, author for both readings and let the manifest's `synodGlyphChroma` flag choose at runtime:

- **Path 1 (glyphs own chroma — Synod announces itself):** leave them baked. Optionally add a faint authored emissive decal over each so they can pulse under the chronological scanner. No atlas edit needed.
- **Path 2 (artifacts own chroma — glyphs sit quiet):** in the atlas, desaturate the three glyph regions toward the sepia ground (mask + hue-strip in an image editor, re-export atlas). The recoverable artifacts then carry the only chroma.

Author **Path 1 by default** (non-destructive), and keep a desaturated atlas variant on hand for Path 2. The manifest references whichever atlas the profile selects. Document the glyph texel regions in the export notes so the desaturation is repeatable.

## A9. Texture processing — the real budget lever

- Keep the capture atlases as the room's visual foundation (baked look is the point).
- **Don't relight the capture.** Authored objects get real PBR; capture stays as-is.
- Produce the LOD texture tiers by resolution, not geometry:
  - **high** → 4096 atlases (as-is)
  - **balanced** → 2048 atlases (downsample)
  - **low** → 1024 atlases
- Prefer the repo's compression pipeline (audit task D). If none, evaluate **KTX2/Basis** for the atlases — that's where the download savings live, since textures are the heavy half.

## A10. Export contract

Export three GLBs (the Part B `assets.lod0/1/2`), transforms applied, Y-up, named nodes preserved:

```
runtime/
  studio-capture-lod0.glb   (4096 atlases, full clutter)
  studio-capture-lod1.glb   (2048 atlases, culled tiny clutter)
  studio-capture-lod2.glb   (1024 atlases, hero + architecture only)
```

Preserve the source and working files unmodified:

```
source/  2_6_2026.glb                (the capture as delivered — never edit in place)
working/ studio-capture-clean.blend  (your segmentation work)
```

Validate each exported GLB (glTF-Validator) and confirm node names survived export.

---

# PART B — Manifest as Target Contract

This is the contract Part A must satisfy. It is **not** a description of `2_6_2026.glb` — it is the shape of its segmented descendant. Adapt field names to whatever the audit (task D) reports as the repo's real manifest format; this is the semantic contract, namespace-neutral pending the mid-migration resolution.

## B1. Required node names (Part A must emit these)

```
Architecture:
  PG_ARCH_LeftWall          (gallery wall)
  PG_ARCH_RightWall         (window wall)
  PG_ARCH_Floor

Occluders (separate objects, toggled by runtime):
  PG_OCCLUDER_LeftWall
  PG_OCCLUDER_RightWall

Hero props (capture-density, non-pickable):
  PG_PROP_Couch
  PG_PROP_Desk
  PG_PROP_Keyboard
  PG_PROP_GuitarCluster
  PG_PROP_SpeakerCabinet
  PG_PROP_WallArt

Clutter bins:
  PG_PROP_Clutter_A
  PG_PROP_Clutter_B

Artifact anchors (empties):
  ARTIFACT_ANCHOR_PersonalImage
  ARTIFACT_ANCHOR_DegradedCassette
  ARTIFACT_ANCHOR_SynthMemory
  ARTIFACT_ANCHOR_GuitarComponent
  ARTIFACT_ANCHOR_SynodRelay

Authored:
  EXCAVATION_COVER_Cassette
  REPLACEMENT_SynodRelay          (authored mesh, not capture)
```

Capture meshes: `isPickable = false`, `receiveShadows = true`. Only artifact proxies/replacements are pickable.

## B2. Room profile (extends the interior schema — pending O-LR2)

```jsonc
{
  "id": "studio-loot-room",
  "assets": {
    "lod0": "runtime/studio-capture-lod0.glb",
    "lod1": "runtime/studio-capture-lod1.glb",
    "lod2": "runtime/studio-capture-lod2.glb",
    "artifactReplacements": "runtime/loot-room-replacements.glb",
    "debris": "runtime/loot-room-debris.glb"
  },
  "transform": {
    "position": [0, 0, 0],
    "rotation": [0, 0, 0],      // capture already Y-up post-Blender (A1)
    "scale": 1.0                // confirmed via couch measurement (A1.6)
  },
  "camera": {
    "alpha": 0.785,             // ~45deg — into the corner, per screenshot
    "beta": 0.955,              // ~55deg down — high-angle isometric read
    "radius": 8,
    "target": [0, 1.0, 0],      // room-center, ~1m up
    "orthoSize": 4.0,
    "minOrthoSize": 2.5,
    "maxOrthoSize": 6.0,
    "allowQuarterTurns": true
  },
  "decay": {
    "dust": 0.8, "dampness": 0.5, "oxidation": 0.7,
    "biologicalGrowth": 0.3, "structuralDamage": 0.6,
    "paperDecay": 0.85, "sunBleaching": 0.6, "signalContamination": 0.4
  },
  "lighting": {
    "ambientIntensity": 0.35,   // low — atlas already carries baked light
    "keyIntensity": 0.5,        // low directional; don't fight baked sun (A9)
    "keyDirection": [-0.6, -0.7, 0.4],  // from window, right wall
    "shadowMapSize": 1024,
    "bloomWeight": 0.15,
    "exposure": 1.0,
    "contrast": 1.1
  },
  "synodGlyphChroma": "loud",   // "loud" = Path 1 (glyphs own chroma)
                                //  "quiet" = Path 2 (desaturated atlas, artifacts own chroma)
  "artifactIds": [
    "personal-image", "degraded-cassette", "synth-memory",
    "guitar-component", "synod-relay"
  ],
  "debrisSeed": 20260206,       // deterministic — from the capture date
  "quality": "high"
}
```

`synodGlyphChroma` is the one field carrying the deferred decision. `"loud"` loads the baked atlas + emissive glyph decals; `"quiet"` loads the desaturated atlas variant and lets artifacts own the saturation budget. Neither is frozen; authoring flips the flag.

## B3. Artifact anchor metadata (per anchor)

```jsonc
{
  "type": "artifactAnchor",
  "artifactId": "degraded-cassette",
  "capturedMeshNames": [],                  // cassette is buried in clutter; nothing to hide
  "replacementMeshName": null,
  "excavationCoverName": "EXCAVATION_COVER_Cassette"
}
```
```jsonc
{
  "type": "artifactAnchor",
  "artifactId": "synod-relay",
  "capturedMeshNames": [],                  // relay is authored, not in capture
  "replacementMeshName": "REPLACEMENT_SynodRelay",
  "excavationCoverName": null
}
```
```jsonc
{
  "type": "artifactAnchor",
  "artifactId": "personal-image",
  "capturedMeshNames": ["PG_PROP_Clutter_A_photo"],  // hide the captured photo when replacement shows
  "replacementMeshName": null,
  "excavationCoverName": null
}
```

If glTF `extras` survive export (A6), these live on the empties and the loader reads them directly. If not, the manifest carries this map by node name — the loader falls back to name-keyed lookup. **Support both**; the current file has no extras, so name-keyed is the safe default until export is verified.

## B4. Initial artifact set (matches the five anchors)

| artifactId | anchor | starts | recovery hook | authored? |
|---|---|---|---|---|
| `degraded-cassette` | DegradedCassette | **buried** | audio fragment, low integrity | cover mesh |
| `guitar-component` | GuitarComponent | exposed | tuning/resonance evidence; leave-in-situ eligible | capture ok |
| `synth-memory` | SynthMemory | exposed | sequence data; musical-puzzle hook | capture ok |
| `personal-image` | PersonalImage | exposed | chronology / room-owner context | capture ok |
| `synod-relay` | SynodRelay | detected | surveillance evidence; chronologically distinct | **authored replacement** |

## B5. Coupling checklist (guide ↔ manifest)

Before this manifest loads, Part A must have delivered:
- [ ] Y-up, metered, transforms applied, couch measurement recorded
- [ ] All B1 node names present and validated in the export
- [ ] Two occluder meshes separate from hero walls
- [ ] Five artifact-anchor empties placed
- [ ] `EXCAVATION_COVER_Cassette` authored and independent of capture floor
- [ ] `REPLACEMENT_SynodRelay` authored
- [ ] Three LOD GLBs + texture tiers exported
- [ ] Glyph atlas: baked default + desaturated variant on hand
- [ ] Source `2_6_2026.glb` preserved unmodified

---

## Open decisions carried forward (still need Dan)

- **O-LR1–6** from the audit prompt remain open; this pair assumes their recommended resolutions (T18 thread, schema-session-first, mechanism/fiction namespace split, camera demonstrative-only, audio silent-stub, persistence co-dependency named).
- **O-LR7 (new).** `synodGlyphChroma` default: ship `"loud"` or `"quiet"`? Recommended `"loud"` for authoring (non-destructive; the desaturated atlas is the extra step, so default to the one that needs no atlas edit) — but this is a *fiction* call, not a pipeline one. Your read.
- **O-LR8 (new).** Confirm the SynodRelay glyph placement (window-corner sigil) as its diegetic anchor, or place the authored relay elsewhere and treat the baked glyphs purely as survey-marks with no physical relay behind them.

## Out of scope

- No repo code (that's the audit's separate implementation session, gated on the interior schema).
- No THREADS.md edit — this proposes; Dan applies.
- No atlas editing until O-LR7 resolves (Path 2 is destructive-ish; don't pre-commit).
