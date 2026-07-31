# instanced-material-pipeline-prompt-v1.md

**Thread:** new — sits under T6 (landscape/scatter profiles) and T8 (asset pipeline); consumes T1 profile discipline. No new THREADS thread until this lands; file a delta after.
**Session type:** local Claude Code, filesystem write access.
**One-line goal:** turn a set of reference-art material swatches into tileable PBR textures and a Babylon thin-instance material path with per-instance variation, so scatter props (rust panels, cracked plastic, fabric) don't visibly repeat.

---

## Phase 0 — Audit gate (MANDATORY, no files created until this is reported)

Before writing or modifying anything, produce a short audit:

1. **Existing material code.** Search the monorepo for current thin-instance / instanced-mesh usage: `thinInstance*`, `MaterialPluginBase` subclasses, `EmissiveDotMaterial`, `FoliageSwayPlugin`, any existing per-instance buffer attributes. Report what already exists and where. **Extend these, do not add a parallel path** (Conflict rule 3).
2. **Package ownership.** Identify which package owns shared material code today (`@culture/*` vs app-scoped). Per the global-first rule, new cross-game material machinery defaults to `@culture/*`; only Dissonance-specific fiction stays app-scoped. State the target package and confirm single-writer status before touching it.
3. **Texture conventions.** Report existing texture directory layout, naming, resolution conventions, and whether an atlas system already exists. Match it; do not invent a new convention.
4. **Asset source legality.** The input swatches are cropped from AI-generated reference art produced for this project. Confirm they carry no third-party asset licensing constraint before baking them into shipped textures. Flag if uncertain — do not assume.

**Stop after the audit and report.** Do not proceed to Phase 1 until the audit is reviewed. If the audit reveals an existing material path that already does per-instance variation, the rest of this prompt collapses to "add textures to it" — say so rather than building new machinery.

---

## Scope

### In scope
- Extract tileable swatches from provided reference crops (rust, cracked plastic, frayed fabric, duct-tape/wrap, charcoal weave).
- Produce seamless power-of-two albedo maps; derive roughness and normal where reasonable.
- One shared material per swatch family, driven by the existing thin-instance path.
- A per-instance variation buffer (hue/value jitter + optional atlas index) so N instances of one prop read as varied, not cloned.
- An emissive **data-pattern** material for the scramble-screen / signal-palette art (UV-scrolled emissive), usable by the Vane/Lineglass brow surface.

### Out of scope / out of bounds
- **Do not** touch `@culture/audio` / `@dta/audio` (single-writer, held by T3).
- **Do not** modify `applyProfile()` or add a second engine code path.
- **Do not** author the Vane or Lineglass device logic here — this session produces the *emissive material* only; device state machines are separate threads (Lineglass T19, Vane experimental).
- **Do not** rig, model, or import creature meshes — that is T8, offline Blender track.
- No character/full-scene reference art gets baked as a texture (composed lighting, wrong for instances).

---

## Deliverables

### 1. Texture assets
For each swatch family: `albedo` (required), `roughness` (derived/authored), `normal` (derived where the swatch has legible relief; skip for flat weaves). Power-of-two (512 default, 1024 for hero-tier). Seamless (verify by tiling 3×3 and checking edges). Place per the directory convention found in Phase 0.

### 2. Shared thin-instance material
Extend the existing thin-instance material path (identified in audit) to accept a **per-instance variation buffer**. Minimum attributes:
- `hueShift` (float, small range — breaks color cloning)
- `valueJitter` (float — breaks luminance cloning)
- `atlasIndex` (int/float, optional — only if an atlas is used)

Variation applied in-shader via the plugin, sampled from the instanced buffer. **All ranges/defaults live as data** (a profile or config file), not hardcoded in the material — consistent with T1 (decisions as data).

### 3. Emissive data-pattern material
A material that takes the scramble-screen / signal-palette texture as an emissive map, UV-scrolled over time, tint-driven. This is the reusable substrate for machine-readout surfaces (Vane brow, Lineglass overlays). Expose scroll speed, tint, and intensity as parameters. Do **not** wire it to any device logic — deliver it as a standalone material + a demo mesh.

### 4. Named constants inventory
List every tuning value introduced (jitter ranges, default resolutions, scroll speed, atlas cell size, derived-fog-cull relationship if touched) with its home file. Flag any that should be profile parameters for Dan's sign-off.

---

## Acceptance criteria
- A demo scene instances one prop ≥100× using the shared material; no two instances are visibly identical at a glance (per-instance variation works).
- Swatch textures tile seamlessly (3×3 test render committed as evidence).
- The emissive data-pattern material scrolls and reads as machine-readout on a flat quad.
- Zero changes to `applyProfile()` or audio packages.
- All new tuning values are data, enumerated in the constants inventory.
- Round-trip: variation ranges editable in config → visible change in demo without recompiling the material.

---

## Conflict declarations
- Reads T1 profile pattern; adds no second code path.
- Shares no files with T3 (audio) or T8 (Blender/import).
- Emissive material is a *substrate* for T19 (Lineglass) and the experimental Vane — it must not assume or embed either device's state logic.

## Open decisions flagged for Dan (do not resolve unilaterally)
1. Target package for the shared material — confirm `@culture/*` home vs app-scoped.
2. Atlas vs. single-tile-plus-variation for the first scatter family — audit should recommend; Dan signs off.
3. Whether the emissive data-pattern material is promoted to `@culture/*` now (anticipating Vane + Lineglass both consuming it) or stays app-scoped until a second consumer is real (extend-don't-rewrite: promote on second consumer, not first).
