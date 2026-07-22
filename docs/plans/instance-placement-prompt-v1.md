# instance-placement-prompt-v1.md

**Thread:** T7 substrate (new — placement/instancing/field layer beneath World Population)
**Owning package this session:** `packages/geo` (authoring/data) + `apps/trail-viewer` (runtime consumer)
**Session type:** local Claude Code — implementation
**Status on entry:** trail-viewer PoC renders terrain + trails + sky/clouds; trees not yet working

---

## Phase 0 — audit gate (mandatory, before any code)

Do not write code until this is reported back:

1. Confirm current trail-viewer scatter/placement path: is there any existing tree/foliage code, and if so where does placement currently live (runtime scatter vs. data file)? Report the exact files.
2. Confirm `packages/geo` current exports and whether a manifest/serialization convention already exists (feature manifest, GeoPolyline pipeline, resolveFeatures). Reuse it; do not invent a parallel one.
3. Confirm the fog + post-process stack currently applied in trail-viewer: which uniforms/params are live and writable per-frame (fog color, fog density, any grading). The zone system writes into these — it must not add a second path.
4. Confirm thin-instance support is already in use anywhere (buffer format, per-instance matrix convention).
5. Report the terrain height-sampling entrypoint (the `getHeightAt` / `SurfaceField` equivalent) placements will snap to.

Surface any conflict with the constraints below **before** producing files. Wait for sign-off.

---

## Objective

Stand up the data-and-runtime substrate that everything in the DTA/Dissonance world will sit on:

1. **Anonymous placement layer** — bulk instanced scatter (trees now, rocks/ferns later), placement authored/generated as data, not scattered at runtime.
2. **Identified overlay layer** — a sparse set of instances carrying identity + optional fields (interactable, archival photo, lore tag, lat/long pedigree). References or augments the anonymous layer.
3. **Cell-based LOD/instancing** — representation chosen per spatial cell, not per instance, with hysteresis.
4. **Zone field system** — polygons authored in QGIS that the player position samples every frame, producing weighted blends that drive atmosphere (fog/color/grading), a `glitchIntensity` channel, and arbitrary non-visual actuators.

Placeholder tree meshes are generated **in code** this session (procedural bent-normal canopies). Blender authoring is explicitly out of scope; the pipeline must accept swapped `.glb` archetypes later with no data changes.

---

## Governing principle

**Placement is data; representation is a decision; the world is a set of fields the player samples.**

- The runtime never asks "where are the trees?" — that is fixed data.
- It only asks "how should cell N be represented this frame?" and "what do the fields read at the player's position?"
- Trees, interactables, archival-photo props, and zones are the **same three mechanisms** (anonymous instance / identified overlay entry / field sample) wearing different fields. Do not build them as separate systems.

This is the resolver/profile pattern (T1) applied to world content. No second code path.

---

## Data model

### Anonymous placement layer (its own file, separate from the photographed-feature manifest)

Flat array of instances. No per-instance identity. Generated offline in `packages/geo` against the lat/long grid + terrain height.

```
AnonymousInstance {
  position:  [x, y, z]      // y snapped to terrain height at author time
  rotationY: number         // yaw only for scatter
  scale:     number         // uniform, or [x,y,z] if needed
  archetype: string         // key into archetype registry ("oak_a", "conifer_b", ...)
}
```

Serialize as a compact binary-friendly form if the count warrants it (thousands+). Keep a JSON authoring form; runtime form may be packed. Placement generation is seeded and deterministic (record the seed).

### Identified overlay layer (thin file, references the anonymous layer)

Sparse. Each entry either references a slot in the anonymous layer (by index/handle) or places its own instance. All gameplay/identity fields are **optional** — absence is the default, and the default is "pure forest."

```
IdentifiedInstance {
  ref?:        number            // index into anonymous layer, OR
  placement?:  AnonymousInstance // self-placed if no ref
  id:          string            // stable identity
  latlon?:     [number, number]  // pedigree if it came from real coords
  interact?:   InteractionSpec   // optional — presence = interactable
  photo?:      string            // optional — archival image asset key (bygone-era viz)
  lore?:       string            // optional — tag / entry key
  proximity?:  ProximitySpec[]   // optional — radial triggers (see below)
}
```

**Rendering treats anonymous and identified instances identically.** Only overlay entries get registered into the sparse gameplay index. Identity does not change how a thing draws — only whether the game knows it exists as a thing.

Rationale to preserve in comments: thin instances are GPU matrices with **no identity by design**. Interaction/proximity requires a separate sparse spatial index regardless; the overlay *is* that index. Tagging one specific tree with a 1990s photograph is one JSON entry, not a schema change.

---

## Cell-based LOD / instancing

- Bucket all placements into spatial cells (start **64–128 m**; make it a named constant, tune later).
- LOD decision is **per cell**, not per instance:
  - **near** cells → bind matrix buffer to real archetype meshes as thin instances
  - **mid** cells → bind the *same* matrix buffer to a crossed-plane / billboard impostor
  - **far** cells → draw nothing; fog carries it
- Tier swap = re-point which mesh consumes an existing matrix buffer. **Matrices never rebuild on tier change.**
- Add a **hysteresis margin** (named constant) on tier boundaries so a cell straddling a threshold doesn't flicker between representations as the camera moves.
- Slots into the existing three-zone LOD intent (0–30 hero / 30–80 billboard / 80+ fog) — reconcile the cell distances with those bands during Phase 0.

### Procedural placeholder archetypes (this session, no Blender)

- Trunk: cylinder. Canopy: 2–3 merged icospheres, ~300–600 tris total.
- **Bent normals in code:** set every canopy vertex normal to `normalize(vertexPos - canopyCenter)` so the low-poly canopy shades as one smooth volume, not crumpled facets.
- This is the shading-split rule at the normal level: **environment = bent/soft normals; creatures (later) = hard face normals.** Same polycount, opposite emotional read. Bake this expectation into the archetype registry now.
- Sample canopy tint from the same palette ramp the terrain uses at that distance so trees sit *in* the atmosphere, not on top of it.
- 3–5 archetypes is enough. Ugly is fine; the pipeline is the deliverable.

---

## Zone field system

### Authoring
- Zones are **polygons in `packages/geo`, authored in QGIS**, same surface as trails and features. One authoring surface — the dread is drawn on a map.
- Each zone owns a parameter set + a soft-edge width.

```
Zone {
  polygon:    [[lat, lon], ...]
  edgeWidth:  number            // meters of soft falloff inward from the boundary
  params: {
    fogColor?:        [r,g,b]
    fogDensity?:      number
    grading?:         ColorRampOrLUTKey
    ambientTint?:     [r,g,b]
    windStrength?:    number
    glitchIntensity?: number    // 0..1, continuous
    ...arbitrary named actuator channels
  }
}
```

### Sampling (runtime)
- Every frame, the player position samples all nearby zones.
- Per-zone **weight** = f(distance to edge, edgeWidth) → 0 outside, ramps to 1 at core.
- Final world params = weighted blend of active zones over a base/default profile.
- Write the blended result into the **existing** fog uniforms + post-process params (the ones confirmed in Phase 0). **Do not add a second atmosphere path.**
- **Blend, never switch.** Crossing a boundary shifts the world over ~10 m. The gradient is a storytelling tool.

### Glitch channel
- `glitchIntensity` is just another blended param — no special system.
- One custom post-process pass, **no-op at 0**. At low intensity: occasional single-frame chromatic-aberration flicker (subliminal, deniable). Near a zone core: overt UV tear / posterize / held frame.
- Drive it from a **single shared glitch event-source**: seeded noise emitting discrete glitch events at intensity-scaled frequency. The shader consumes these events. (Audio consumes the *same* events — see below.)

### Non-visual actuators
- The same per-zone weights can drive arbitrary channels: pursuer aggression, spawn tables, which ambient loop plays. "The woods feel wrong here" is **one zone entry**, not five systems. Expose the blended field as a readable value other systems can subscribe to.

---

## Proximity actuators (identified instances)

- An identified instance's `proximity` spec is a **point field**: radial falloff from the instance, driving local effects (mesh shudder/sway ramp, an armed audio one-shot, an animation trigger).
- Same abstraction as zones, smaller radius. Point field vs. area field — **one sampler, many actuators.** Implement them against a shared sampling notion, not two parallel systems.
- Proximity queries run against the sparse overlay index (spatial hash), never against the anonymous layer.

---

## Audio coupling (respect D1 / audio single-writer)

- **Do not touch `@dta/audio` internals this session** — it is single-writer under T3 until extraction lands (conflict rule 4). This session emits/*exposes* the glitch event stream and the zone field values; wiring them to Tone.js buses is a later T9/T5-adjacent step.
- Design the glitch event-source so audio can consume the **same discrete events** the shader does. A visual tear on the exact frame as an audio stutter/detuned stab reads as *the world breaking*, not as two effects. The intended audio move (deferred): corrupt the **familiar ambient bed** (bit-crush/granular-chop the existing wind) rather than introducing new sound.
- Just make the event stream and field values cleanly subscribable. No audio graph edits.

---

## Constraints (frozen — do not relitigate)

- One package owns writes per session; declare out-of-bounds paths in your first report.
- `@dta/audio` is **out of bounds** (T3 single-writer). Expose events; do not consume them into the audio graph.
- All atmosphere tuning writes into the **existing** fog/post uniforms via one seam. No parallel render path (conflict rule 3).
- Placement, zones, proximity specs are **additive data**. Engine code stays generic; content lives in `packages/geo` files.
- Blender is out of scope. Archetypes are procedural this session and must be swappable for `.glb` later with zero data-model change.
- Anonymous layer and photographed-feature manifest stay **separate files** (Dan's decision).

---

## Open decisions (flag; do not resolve unilaterally)

1. **Navmesh coupling** — do placements feed the tile-based navmesh bake as obstacles (trees-as-blockers) or is the forest walkable-through? This is the T7/T16 tile-bake open decision resurfacing. Convenient consequence if adopted: only the **identified overlay** (short list) supplies obstacle candidates, not the 6,000 anonymous trees. Needs Dan's sign-off before bake assumptions.
2. **Anonymous layer serialization** — packed binary vs. JSON at current counts. Recommend JSON authoring form + optional packed runtime form; confirm.
3. **Cell size + hysteresis constants** — propose 64–128 m cell, hysteresis TBD; Dan tunes.
4. **Grading representation in zone params** — ColorRamp (interpolatable, preferred for blended fields) vs. LUT key. Recommend ramp for zones since they blend continuously; LUT only for fixed-mood cases. Confirm against existing grading path.

---

## Acceptance criteria

- [ ] Anonymous placement file loads and renders as thin-instanced procedural trees with bent-normal canopies over real terrain.
- [ ] Cells swap near/mid/far representation with no matrix rebuild and no visible flicker at boundaries (hysteresis working).
- [ ] An identified overlay entry can tag a specific instance; presence of `interact`/`photo`/`lore` fields is detected via the sparse index; absence is the default.
- [ ] At least one QGIS-authored zone polygon blends fog color/density over ~10 m at its edge, written through the existing fog seam.
- [ ] `glitchIntensity` channel drives a post-process pass that is a true no-op at 0 and visibly tears near a zone core, driven by a single seeded event-source.
- [ ] The glitch event stream and blended zone field are exposed as subscribable values (proving the audio/non-visual coupling seam) without any `@dta/audio` edit.
- [ ] One proximity actuator fires from an identified instance (e.g. sway ramp on approach), sharing the sampler abstraction with zones.

## Out of scope (do not build)

- Blender assets / real `.glb` trees (procedural placeholders only).
- Any `@dta/audio` graph work / Tone.js wiring.
- Real biome authoring, animals, artifact discovery logic (that is T7 proper, later).
- Navmesh bake itself (blocked on open decision 1).
- Inventory-as-room, photo-viewing UI (data hooks only; presentation later).
