> **Archived 2026-08-01.** Execution plan v2 and D45 supersede this separate-app direction. Retained as provenance, not current implementation guidance.

# Photogrammetry Archaeological Loot Room — Execution Plan v1

**Date:** 2026-07-28
**Status:** superseded by `photogrammetry-archaeological-loot-room-execution-plan-v2.md`; retained as provenance for the discarded separate-app direction
**Supersedes/extends:** `photogrammetry_archaeological_loot_room_ai_prompt.md` (the original AI-assistant prompt — kept as provenance; this doc is the executable handoff, same relationship `addendum-reconciliation-implementation-v1.md` has to its addendum)
**Proposed thread ID:** T30 — Archaeological loot room / photogrammetry pipeline (next free ID after T29; not yet merged into `THREADS.md` — fold in on the next reconciliation pass, per that file's single-writer rule)

---

## 1. Reconciliation against THREADS.md

The source prompt was written as a self-contained spec and assumes a repo that doesn't quite exist yet — several of its "use the existing X" instructions have no X to point at. Resolved against the actual state of `docs/THREADS.md` (v9.45) and the repo:

- **This is Dissonance, not Don't Turn Around.** The lore (Synod, SignalNet, "later Synod monitoring equipment") only appears in Dissonance's threads (T10, T20, T28, T29). Dissonance has **no app yet** — only `apps/dont-turn-around`, `apps/home`, `apps/trail-viewer` exist. This plan is the first piece of Dissonance to become real code, not a feature bolted onto an existing app. **Recommendation (flagged for sign-off, §5.1):** new `apps/dissonance`, minimal Vite scaffold mirroring `apps/dont-turn-around`'s shape.

- **O4 (isometric camera rule) is explicitly unresolved.** `THREADS.md` lists it as *"experimental; no level design may assume it before sign-off"* (line 355), and T10 restates: *"monitored interiors snap to isometric (SignalNet's legible read); private spaces stay first-person."* Per your instruction, this plan **proceeds with the orthographic isometric camera but flags it as the concrete O4 pilot case**, not a silent assumption. The loot room is actually a strong pilot: it's explicitly a Synod-monitored site (the relay artifact), which is exactly the "monitored interior" category O4's own design principle (P6) describes. Slice 0's sign-off should include: *"O4 approved, scoped to this room, using this room as the reference case rather than a general rule yet."*

- **Testing:** CLAUDE.md and T28's own audit both confirm there is no repo-wide test runner or lint script. The only precedent is `packages/geo`'s standalone `vitest run` (not wired into turbo). Per your instruction to use the monorepo's actual Playwright-flavored verification habit (see T21's repeated "verified via Playwright"/chrome-devtools-automation entries throughout 2026-07-17 through 2026-07-24), this plan's QA strategy is: **live browser verification via the chrome-devtools MCP for anything visual/interactive (camera framing, occlusion, hover/select, excavation), plus a small `vitest` suite scoped to pure deterministic logic only** (state-machine transitions, camera bounds math, deterministic debris seeding) — mirroring `packages/geo`'s existing pattern rather than inventing the full formal suite the original prompt specifies. This is a real reduction from the prompt's "Testing" section; the rest of that section is reference material for later, not a Slice 0–N requirement.

- **DTA's "artifact" system was evaluated, not extracted.** `apps/dont-turn-around/src/items/{ArtifactProp,InventorySystem}.ts` and `ui/ArtifactIcon.ts` exist, but on inspection: `InventorySystem` is a 17-line wrapper around an array of a hardcoded 4-value literal union with no state machine, no persistence hookup, and no anchor/proxy concept; `ArtifactProp` is a single shared post+tag mesh with no per-object identity beyond id/label/xz; `ArtifactIcon` hand-draws SVGs keyed to that same literal union. None of it models buried/detected/exposed/identified/recovered state, excavation, or chronology — the actual shape this feature needs. **Verdict: not well-designed for this reuse target, per your own conditional ("if it exists and is well designed, extract it").** Building fresh in a new package instead, but keeping the anchor/state-machine shape generic enough that DTA's simple pickups *could* migrate onto it later if you ever want that (not required now, not scoped here).

- **Persistence isn't a stub — it's just unused.** CLAUDE.md's package summary calls `@dissonance/persistence` "a stub," but `packages/persistence/src/index.ts` already contains a working `PlayerPersistence` class (localStorage-backed, save/load/clear, `PlayerSaveState`-typed). `THREADS.md`'s O5 calls first-encounter jump-scare persistence "first real consumer of `@dissonance/persistence`" — meaning the class exists but nothing in `dont-turn-around`'s actual game loop calls it yet. Per your answer (local/session storage + IndexedDB is enough for now, server-side later), this plan **extends the same package with an `ArchaeologyPersistence` class following the identical localStorage pattern** (own storage key, same save/load/clear shape). IndexedDB is *not* needed for the vertical slice — five artifacts' worth of state (an enum + a few numbers + booleans each) is trivially small for localStorage; IndexedDB is noted as a future option only if IntersectionObserver-scale debris/audio-blob caching ever needs it. Two features (this one and O5) are independent localStorage keys on the same class shape — neither blocks the other.

- **Real gap found and worth fixing as part of this work, not a new parallel system:** there is no shared deterministic-RNG helper anywhere in the repo (`packages/utils` only has `preventAccidentalClose`). Trail-viewer's `bulkForestScatter.ts` already reimplements an FNV-1a-salted seed inline, ad hoc, for the exact "same seed → same layout" problem this room's debris system needs. This will be the second independent reimplementation if left alone, and the third real consumer justifies extraction (same logic T3 used to decide *not* to extract `PursuerAudio` early — one consumer isn't enough, two-going-on-three is). **Plan: extract a ~20-line `seededRandom(seed)`/`hashString(seed)` pair into `packages/utils` in Slice 0, point trail-viewer's existing inline version at it in a follow-up (not required for this feature to ship, noted for later).**

- **glTF loading is also duplicated, not shared, today.** `apps/dont-turn-around/src/pursuer/gltfLoader.ts` and `apps/trail-viewer/src/world/gltfLoader.ts` are near-identical independent `ensureGltfLoader()` one-liners (dynamic `@babylonjs/loaders` import, memoized per session). A third app needing the identical helper is the same "extract on the third consumer" case as above. **Plan: this becomes a real `packages/engine` export (`ensureGltfLoader`) in Slice 0**, with DTA/trail-viewer left on their local copies for now (no unrelated-refactor churn) — noted as a cheap follow-up whenever someone's already touching those files.

- **`SceneFactory.create()` is not a generic scene bootstrap** — it's `ExperienceProfile`/`RunProfile`-coupled DTA sky/fog/day-night setup (confirmed by reading it), the same kind of coupling T21 already hit and solved by building a decoupled sibling rather than forcing reuse. This room needs an interior isometric scene (no sky dome, no day/night), so it gets its **own minimal scene bootstrap** — but `GameLoop` (packages/engine) is genuinely generic (`Engine`/`dt`-callback only, already registers its own resize→`engine.resize()` listener) and is reused as-is.

- **Scanner ≠ T20's acoustic-world systems, on purpose, for now.** T20 (`SoundField`, `AcousticZoneProfile`, etc.) is "horizon" status — only Phase 1 (pure types) is even unblocked, and it hasn't run. The loot room's scanner does not depend on it: `signalResidue` stays a plain per-artifact number (already in the original prompt's `ArtifactDefinition` shape), not a real acoustic simulation. If/when T20 Phase 1 lands, this is a natural place to swap the stand-in for the real typed domain — flagged, not built now.

---

## 2. Required Initial Audit (answered)

Per the original prompt's own Phase 1 gate:

1. **Owning package/app:** new `apps/dissonance` (first Dissonance-game code) + new `packages/archaeology` (`@dissonance/archaeology`) for the anchor/state-machine/scanner domain logic — kept engine-agnostic where practical so it isn't Babylon-only if a future non-3D consumer ever needs artifact state.
2. **Profile system to extend:** there is no generic `EnvironmentProfile`/`applyProfile()` outside DTA, and DTA's version is tightly coupled to its own forest/day-night domain (confirmed, same finding T21/T28 already made independently). No existing profile resolver fits `ArchaeologicalRoomProfile` — it becomes its own small profile type in `@dissonance/archaeology`, following the *pattern* (frozen resolved config object, Dev-HUD-tunable source data) without forcing a fit into DTA's shape.
3. **Environment/location builder:** closest real precedent is trail-viewer's `CompositeLocations.ts`/`LocationProps.ts` (hand-authored JSON, classified once at load, batched by type) — the pattern to follow, not the code to import (it's geo-coordinate/UTM-specific, this room is a single local-origin interior).
4. **GLB loading pathway:** two independent app-local `ensureGltfLoader()` copies exist (DTA, trail-viewer); this is the third consumer, justifying extraction into `packages/engine` (see §1).
5. **Asset manifest format:** none exists repo-wide. This room defines its own small manifest shape (LOD0/1/2 + optional overlays, per the original prompt's `assets` block) inside its profile — first-of-its-kind, not a divergence from an existing convention.
6. **Camera/input abstraction:** `packages/input` is a stub; no existing camera abstraction beyond DTA's first-person `PlayerController` and trail-viewer's Walk/Fly/Drive controllers — neither applies to a fixed orthographic room camera. New, self-contained `RoomCamera` in the app, following T1/T2's "profile-driven, Dev-HUD-tunable" convention rather than DTA/trail-viewer's movement-controller shape.
7. **Interaction/picking pathway:** no existing generic pointer-interaction system; DTA's flashlight/`isPointIlluminated` pattern and the boulevard's collider system are the closest analogues (radius-based, not general picking). New picking layer scoped to artifact proxies only, per the prompt's own "only proxies are pickable" rule.
8. **UI/event pathway:** no shared UI package; DTA uses hand-rolled DOM/Babylon GUI (`ui/*.ts`), trail-viewer uses Preact (`ui/*.tsx`). **Recommendation:** Preact for this room's UI (inspection panel, scanner HUD) — it's the newer, less imperative pattern and this is new-app territory with no legacy DOM code to match.
9. **Audio pathway:** `@dissonance/audio` (Tone.js, D1's bus names: spatial/ambient-beds/interior/music-synth) is the real, working audio engine — used directly for the recovered audio fragment and any scanner tones, routed through the existing bus names (not new ones — O6 already closed that question).
10. **Persistence pathway:** `@dissonance/persistence`'s existing `PlayerPersistence` class/pattern, extended with an `ArchaeologyPersistence` sibling (see §1).
11. **Lifecycle/disposal pattern:** every world system in this repo (`ForestFire`, `WeatherSystem`, `CompositeLocations`, etc.) exposes an explicit `dispose()` disposing its own meshes/materials/observers — followed exactly.
12. **Testing framework/conventions:** `packages/geo`'s standalone `vitest run`, scoped narrowly (see §1) + chrome-devtools MCP for live verification (the repo's actual habit, not a formal suite).
13. **Performance/quality-profile systems:** none exist beyond ad hoc HUD sliders (H-scale, tree counts, etc.). This room gets a small `quality: "low"|"balanced"|"high"` field in its own profile and its own Dev-HUD-style debug counters — no borrowing from a system that doesn't generalize (DTA/trail-viewer's quality knobs are both domain-specific).
14. **Files proposed:** see §6.

---

## 3. Scope cut

Applying the same method T28 used on the oversized rural-infrastructure prompt: audit found the repo doesn't have most of the infrastructure the doc assumes, so scope gets cut to the piece with an obvious, unblocked path; everything else is recorded so the ideas aren't lost, not discarded.

**Building now (Slices 0–7, below):** the prompt's own 20-step "Vertical Slice" section, essentially as written — placeholder-GLB contract (real capture arrives when you hand it off, see §5.3), orthographic camera + quarter-turns + cutaway walls, one full artifact spine (degraded cassette: buried→detected→exposed→identified→recovered), acoustic-only scanner (visual mode too; chronological/hybrid deferred), one excavation, one audio fragment, localStorage persistence, deterministic debris, restrained lighting, disposal, perf counters.

**Explicitly deferred (recorded, not built):** the remaining 4 of 5 artifacts beyond the cassette spine + relay; chronological/hybrid scanner modes; KTX2/Draco compression pipeline; full Blender optimization budgets (150k–400k tri targets — moot until a real capture exists to optimize); the formal test suite beyond the narrow vitest slice in §1; IndexedDB persistence; server-side persistence.

---

## 4. Vertical slices

Each slice ends with a Dan sign-off gate (P4) before the next starts — same discipline as T20's phase list.

### Slice 0 — Scaffolding & shared extractions (gate: app location, package name, O4 flag)
- `apps/dissonance`: minimal Vite app (package.json/index.html/vite.config.ts/tsconfig.json/src/main.ts), mirroring `apps/dont-turn-around`'s shape at the smallest useful size.
- `packages/archaeology` (`@dissonance/archaeology`): package skeleton, `src/index.ts` barrel.
- Extract `ensureGltfLoader` into `packages/engine` (new export, DTA/trail-viewer untouched).
- Extract `seededRandom`/`hashString` into `packages/utils`.
- Placeholder GLB with the runtime asset contract's expected node names (`PG_ARCH_*`, `PG_PROP_*`, `ARTIFACT_ANCHOR_*`) so later slices aren't blocked on the real capture.
- **Sign-off:** app/package names; O4 flagged-and-approved for this room specifically; confirm placeholder-GLB-first is fine until the real capture is ready to hand off.

### Slice 1 — Capture load & classification
- Load the (placeholder, then real) GLB via the extracted loader; classify nodes once by name/`extras` metadata into architecture/props/clutter/occluders/artifact anchors (`LoadedArchaeologicalRoom` shape from the original prompt, adapted).
- `mesh.isPickable = false` on all capture geometry.
- **Sign-off:** none needed — mechanical, low-risk; proceed straight to Slice 2 unless something looks wrong live.

### Slice 2 — Orthographic isometric camera & cutaway (the O4 pilot instance)
- `RoomCamera`: fixed isometric target, ortho bounds recomputed via `engine.onResizeObservable` (not a raw `window.resize` listener — matches `GameLoop`'s existing convention), optional zoom clamped, four quarter-turn orientations (~300–500ms animation, rotation-lock during animation, per the original prompt).
- Orientation-based wall hide/fade using the classified occluder groups from Slice 1.
- **Sign-off:** camera framing/feel checked live via chrome-devtools MCP; confirm this satisfies your intent for "flag it with ortho iso" before it becomes load-bearing for anything downstream.

### Slice 3 — First artifact spine (degraded cassette)
- One `ArtifactAnchor` (metadata-driven per the original prompt), invisible pickable proxy, hover/select.
- State machine: `buried → detected → exposed → identified → recovered | left-in-situ`, implemented as a small explicit machine in `@dissonance/archaeology` (rejecting invalid transitions — the one place a real vitest unit test earns its keep).
- Minimal Preact inspection panel (not GUI-coupled to one widget set, per the original prompt's "not tightly coupled to one GUI implementation" rule).
- One excavation cover mesh; begin/progress/cancel/complete, restrained dust effect, duplicate-completion guard.
- **Sign-off:** interaction flow feels right live before it becomes the template for artifacts 2–5.

### Slice 4 — Scanner (visual + acoustic only) & audio fragment
- `ScannerMode = "visual" | "acoustic"` only (chronological/hybrid deferred per §3).
- Visual: artifact silhouette/preservation reveal. Acoustic: signal-residue indicator, one waveform/resonance trace, routed through `@dissonance/audio`'s existing bus names.
- Recover the cassette's one audio fragment through the existing audio engine.
- **Sign-off:** scanner reads as "Dissonance's vocabulary," not generic detective-vision, per the original prompt's own restraint rule.

### Slice 5 — Persistence
- `ArchaeologyPersistence` in `@dissonance/persistence` (own localStorage key, save/load/clear, same shape as `PlayerPersistence`).
- Verify: recovered artifacts don't respawn; identified/left-in-situ state survives reload.
- **Sign-off:** none needed if the vitest round-trip test + one manual reload check both pass.

### Slice 6 — Remaining artifacts, deterministic debris, Synod relay
- Broken guitar component, synth memory module, personal framed image, Synod monitoring relay (authored replacement mesh, per the original prompt's recommendation for this one) — each reusing Slice 3's anchor/state-machine template, not five bespoke implementations.
- Deterministic debris (hero meshes + ordinary instances + thin instances per the original prompt's three-tier rule), seeded via the extracted `seededRandom`.
- **Sign-off:** debris density/read live-checked; confirm the relay's narrative weight lands before calling the artifact roster done.

### Slice 7 — Lighting, performance, disposal hardening
- Restrained hybrid lighting (ambient + one window directional + contact shadows), FXAA + mild bloom, no heavy DoF/chromatic aberration (per the original prompt's explicit "avoid" list).
- Perf counters (tri/mesh/material/draw-call/load-time) — own small on-screen debug readout for this app, since there's no existing DevHUD to extend here yet (DTA's `DevHUD` is app-local and DTA-specific; not worth forcing a cross-app HUD abstraction for one counter panel — noted as a real "no existing thing to extend" case, not a violation of P1).
- Full disposal pass: imported roots, temp materials, pointer observers, scanner overlays, audio emitters, animation handles — verified by re-entering the room twice in one session and confirming no duplicate observers/leaked meshes.
- **Sign-off:** final walkthrough; decide whether this is "done for now" or continues into the deferred scope from §3.

---

## 5. Sign-offs needed before Slice 0 starts

1. **App/package naming** — `apps/dissonance` + `@dissonance/archaeology` as proposed, or different names?
2. **O4** — approve isometric camera for this room specifically (pilot case, not yet a general rule)?
3. **Real capture handoff** — you confirmed one exists; what format is it in today (raw scan / `.blend` / already-exported GLB), and where should it land (`apps/dissonance/public/models/archaeology/source/...`, matching the original prompt's source/working/runtime split)? Slice 0–2 can proceed against the placeholder either way, so this only blocks whenever you're ready to hand it off, not the start of work.
4. **THREADS.md fold-in** — this plan proposes T30; actually editing `THREADS.md` is left to you/a dedicated reconciliation pass rather than done as a side effect here, per that file's single-writer convention.

---

## 6. Files (proposed)

```
apps/dissonance/
  package.json, index.html, vite.config.ts, tsconfig.json
  src/main.ts
  src/scene/DissonanceSceneFactory.ts   (minimal, NOT SceneFactory reuse — see §1)
  src/room/RoomCamera.ts
  src/room/RoomOrientation.ts
  src/room/OcclusionController.ts
  src/ui/InspectionPanel.tsx
  src/ui/ScannerOverlay.tsx
  public/models/archaeology/{source,working,runtime}/  (placeholder GLB first)

packages/archaeology/
  package.json, tsconfig.json
  src/index.ts
  src/ArchaeologicalRoomProfile.ts
  src/RoomAssetClassification.ts        (LoadedArchaeologicalRoom shape)
  src/ArtifactDefinition.ts
  src/ArchaeologyRecord.ts
  src/ArtifactStateMachine.ts
  src/ArtifactStateMachine.test.ts       (vitest — the one real unit-test surface)
  src/ScannerMode.ts

packages/persistence/src/
  ArchaeologyPersistence.ts             (new, alongside existing PlayerPersistence.ts)

packages/engine/src/
  gltfLoader.ts                          (new export: ensureGltfLoader)

packages/utils/src/
  random.ts                              (new export: seededRandom/hashString)
```

---

## 7. Production schedule

Session-sized, matching how this repo actually gets built (local sessions, not calendar sprints) — map onto whatever cadence works for you:

| Session | Slice(s) | Est. size |
|---|---|---|
| 1 | Slice 0 (scaffolding + extractions) | short — mechanical |
| 2 | Slice 1 + Slice 2 (load/classify + camera/cutaway) | medium — camera feel is the real work |
| 3 | Slice 3 (first artifact spine) | medium-large — the template everything else copies |
| 4 | Slice 4 (scanner + audio fragment) | medium |
| 5 | Slice 5 (persistence) | short |
| 6 | Slice 6 (remaining artifacts + debris + relay) | large — mostly repeating Slice 3's template ×4 |
| 7 | Slice 7 (lighting/perf/disposal hardening) | medium |

Seven sessions to a complete vertical slice as scoped in §3. Deferred scope (§3) is a second pass after Dan reviews the vertical slice live, not pre-committed to this schedule.
