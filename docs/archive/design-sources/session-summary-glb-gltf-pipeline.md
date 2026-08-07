# Session Summary — GLB/GLTF Asset Pipeline

**Project:** Dissonance (Culture Engine monorepo)
**Thread:** T8 (rigging + 3D art pipeline)
**Stack:** TypeScript / Babylon.js / Tone.js · `gltf-transform` normalization · `ImportMeshAsync` / `AssetContainer`

---

## What we covered

### 1. What a GLB/GLTF actually packages from Blender
A GLB/GLTF is a scene-graph transport format — a **baked snapshot** of the runtime-relevant parts of a Blender scene, stripped of authoring intent.

**Travels:** mesh data (vertices, normals, tangents, UVs, vertex colors, triangulated faces); PBR metallic-roughness materials + texture bindings; textures (embedded or referenced); transforms + node hierarchy; skeletal animation (skin, joints, inverse bind matrices, ≤4 weights/vertex, Actions → animation channels).

**Does NOT travel:** modifiers (apply first), procedural/node materials (bake to textures first), cameras/lights (Babylon owns lighting), geometry nodes / drivers / constraints / physics / particles unless realized to mesh, >4 bone influences without an extension.

Mental model: geometry (positions/weights/matrices) + surface (texture samples) or it must be baked into one of those before export.

### 2. Authoring a scene like the SMR creek photo
Approach = **kit-of-parts, not a single sculpted scene** (~6 unique assets scattered hundreds of times — maps onto three-zone LOD + `ThinInstancedMesh`).

Sequence: block out scale first (Milo eye height ~1.7m — the pending scale audit) → terrain base (sculpt or heightmap + terrain-stamp for the channel) → author reusable kit (4–5 rocks, 2–3 tree LOD tiers, fern clumps, leaf-litter plane) → scatter with geometry nodes at authoring time BUT re-scatter at runtime in Babylon with thin instancing (geometry nodes don't survive glTF export as nodes) → Principled-BSDF-only materials, procedural masks baked to textures → bake AO/lightmap into UV1 → export.

Key adjustment: **author the ingredients + one scatter recipe, not "the scene."**

### 3. GLB vs GLTF — corrected a false premise
GLB and GLTF are the **same data in two containers**:
- `.gltf` — JSON + separate `.bin` + loose image files (multi-file, human-readable)
- `.glb` — one binary blob with JSON + bin + embedded textures

Correction: choosing GLTF does **not** by itself make textures "runtime-swappable." Runtime texture assignment works with **either** container; it's orthogonal to the container choice.

**"Is GLB cheaper because it's fully baked?"** Cheaper in *pipeline simplicity/integrity* — yes. Cheaper in *bytes/load flexibility* — often no. GLTF (or external textures) lets one texture load once and be **shared across instanced kit pieces** — favorable for the many-instances-sharing-materials case on a tight VRAM budget.

**The move for this project:** export geometry as GLB/GLTF *without* heavy embedded textures, keep textures as separate optimized **KTX2/basis** files, bind in Babylon. `gltf-transform` does this: export "dirty" from Blender, then split/compress textures to KTX2, dedup shared materials, Draco/meshopt geometry. Gets GLB integrity + GLTF texture-sharing. **The real lever is texture compression + instance sharing (where VRAM goes), not the container.**

### 4. Jargon primer
Geometry: **vertex** (point, may carry normal/UV/color/weights) → **edge** → **face/polygon** (tri or quad; glTF is tris-only) → **mesh**. **Normal** = which way a surface faces (lighting); **normal map** = texture faking detail. **UV/UV map** = 2D coords wrapping a texture onto geometry (UV0 color, UV1 baked AO/lightmap). **Material** = surface description (metallic-roughness PBR). **Texture/map** channels: albedo, normal, roughness, metallic, AO, emissive. **Texel** = texture pixel. **Baking** = pre-computing expensive things into a flat texture. **LOD** = simpler mesh at distance. **Instancing** = same mesh drawn many times cheaply (`ThinInstancedMesh`). **Draw call** = one GPU draw instruction (fewer = faster; instancing + material consolidation cut these). **Tris/poly count** = the budget.

Through-line: vertex→face→mesh is geometry; UV→texture→material is surface; instancing+LOD+baking+draw calls are performance levers; GLB/GLTF is the shipping box.

### 5. Editing / swapping geometry and textures independently
The separated-KTX2 path decouples mesh and texture at the **file** level, so:
- **Texture swap** — reassign the material channel at runtime (`mat.albedoTexture = new Texture("dry-rock.ktx2", scene)`); shared textures swap everywhere at once. Easy, container-independent.
- **Geometry edit** — re-export GLB, re-run geometry step, textures untouched.

**The catch:** the two files share one contract — **the UV map**. Moving vertices is safe; **re-unwrapping breaks texture alignment**. Treat UVs as the API between mesh and texture: change either side freely, change the UVs and both sides must re-agree.

Caveat: a GLB with **embedded** textures bakes images into the blob — editing a texture means re-exporting the whole GLB. For independent swapping you specifically want **geometry-GLB + external KTX2** (or GLTF-with-separated-textures), **not** GLB-with-embedded.

Fits the data-over-code / seam-first discipline: texture becomes tunable data behind a stable UV interface. Enables palette swaps (overcast ↔ backlit chartreuse), Synod emissive states, and one-texture-serving-many-instances VRAM savings.

---

## Deliverable produced
**`asset-export-pipeline-prompt-v1.md`** — a local Claude Code handoff prompt (not the pipeline itself), because the existing on-disk pipeline wasn't visible and network access was off. Audit-gated to *extend* existing tooling, not duplicate it (conflict rule 3). Key features:
- **Phase 0 audit gate** — discovers existing GLB/GLTF tooling, folder conventions (source vs. served), loader expectations (KTX2/Draco decoders), `gltf-transform` version. HALT conditions for conflicting methods or decoder gaps. Notably verifies whether the repo's "both GLB and GLTF" methods embed or separate textures (0.3) — the thing that determines whether independent swap is even possible.
- **Phase 1** — dedup / geometry-compress / texture-compress-to-KTX2 / prune, matching loader expectations; named constants (`TEXTURE_MAX_DIM`, `GEOMETRY_COMPRESSION`, `KTX2_QUALITY`); emit both containers only if genuinely supported (don't fabricate a second path).
- **Phase 2** — Blender "dirty export" checklist (apply transforms, Principled BSDF only, bake procedurals, UV1 for AO, no double-compression, deliberate Action names).
- **Phase 3** — verify one asset round-trips + renders; report size/memory/tri delta.
- Acceptance criteria, out-of-bounds paths, batched open decisions (O-EXP1–3), paste-ready THREADS.md delta.

---

## Open decisions carried forward
- **O-EXP1** — adopt a source/served folder convention if none exists?
- **O-EXP2** — `TEXTURE_MAX_DIM` value against the 2GB Quadro ceiling.
- **O-EXP3** — dual-container vs. GLB+KTX2-only.
- Verify (via Phase 0) which existing container method embeds vs. separates textures — gates the independent-swap workflow.

## Next action
Run `asset-export-pipeline-prompt-v1.md` in a local Claude Code session; review Phase 0 findings before any writes.
