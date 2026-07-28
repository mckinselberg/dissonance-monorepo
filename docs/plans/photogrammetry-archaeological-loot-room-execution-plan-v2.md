# Milo's Apartment Archaeology Room — Execution Plan v2

**Date:** 2026-07-28
**Status:** approved architecture; implementation-ready
**Supersedes:** `photogrammetry-archaeological-loot-room-execution-plan-v1.md`

## 1. Resolved architecture

The repository is a set of dioramic layers:

- `apps/home` is the launcher.
- `apps/world` is the living Dissonance world and successor to Trail Viewer.
- `apps/museum` is the playable archive.
- `apps/museum/dont-turn-around` is the first preserved exhibit.

The archaeological loot room is not a separate app. It is Milo's apartment,
entered from the existing `milos-building` placement in `apps/world`. Exterior
exploration remains first-person. Entering an authored surveilled location
transitions to a loaded interior diorama and an orthographic-isometric camera.
This transition becomes reusable for later monitored interiors.

The apartment remains part of the same world session:

- exterior feature identity remains `dissonance-boulevard` / `milos-building`;
- canonical WGS84/world position remains the save and return authority;
- apartment state loads separately from exterior render state;
- leaving restores the prior controller, camera transform, and exterior position;
- no page navigation or second Vite application is involved.

## 2. Scope cut

The first production slice proves one complete loop:

1. approach Milo's exterior door;
2. receive an enter prompt;
3. transition into the apartment;
4. inspect one degraded cassette through the archaeology state machine;
5. use visual/acoustic scanner modes;
6. recover or leave the item in situ;
7. persist the result locally;
8. exit and return to the same exterior position.

Deferred until that loop is signed off:

- the other four artifact types;
- chronological/hybrid scanner modes;
- full capture optimization/KTX2/Draco pipeline;
- IndexedDB and server persistence;
- multiplayer synchronization;
- generalized arbitrary-building interiors.

## 3. Runtime boundaries

### World-owned

- exterior trigger and `milos-building` stable identity;
- transition orchestration;
- controller/camera suspension and restoration;
- apartment scene root lifecycle;
- Preact inspection/scanner UI;
- Dev HUD entry/exit/debug controls.

### `@dissonance/archaeology`

Create only when the first artifact state machine is implemented:

- artifact definitions and stable IDs;
- `buried → detected → exposed → identified → recovered | left-in-situ`;
- transition validation;
- scanner-mode domain types;
- serialization-safe archaeology record.

No Babylon or Preact imports in the package.

### Persistence

Extend `@dissonance/persistence` with an archaeology sibling using its current
localStorage pattern. Use a separate versioned key. IndexedDB is unnecessary
for the first slice's small structured state.

### Assets

The real photogrammetry capture lands under:

```text
apps/world/public/models/milos-apartment/
  source/      # original handoff, never loaded at runtime
  working/     # Blender/export intermediates
  runtime/     # browser-ready GLB + textures
```

A contract placeholder may be used before the capture is ready. Runtime node
names use:

- `APT_ARCH_*`
- `APT_PROP_*`
- `APT_OCCLUDER_*`
- `ARTIFACT_ANCHOR_*`

## 4. Vertical slices

### Slice 0 — App migration and launcher

- Rename Trail Viewer to `apps/world`.
- Move DTA to `apps/museum/dont-turn-around`.
- Add a general `apps/museum` exhibit menu.
- Update workspace discovery, Vite bases, local proxies, deployment assembly,
  root launcher, and current repository guidance.

Gate: all four workspaces build and their production base paths are correct.

### Slice 1 — Surveilled-location transition seam

Add an app-local transition state machine:

```text
exterior → entering → interior → exiting → exterior
```

Requirements:

- identify the doorway through `milos-building`, not a mesh-name guess;
- snapshot active traversal mode, position, camera rotation, and pointer-lock state;
- suspend exterior controller updates while inside;
- load/unload one apartment root without reloading the page;
- restore the snapshot exactly on exit;
- reject re-entry while a transition is active;
- expose transition state in the Dev HUD.

Gate: enter/exit Milo's empty apartment five times without duplicated meshes,
observers, audio, UI, or position drift.

### Slice 2 — Orthographic-isometric interior camera

Implement `SurveilledInteriorCamera` app-locally:

- orthographic framing derived from room bounds;
- four quarter-turn orientations;
- 300–500ms rotation with input locked during animation;
- zoom clamped to authored limits;
- resize through Babylon engine observables;
- orientation-driven occluder hide/fade;
- no exterior navigation assumptions.

This is the explicit O4 pilot, scoped to surveilled interiors rather than a
global camera rule.

Gate: live visual sign-off on framing, rotation, cutaway behavior, and return
to first person.

### Slice 3 — Capture contract and apartment lifecycle

- Load placeholder/real GLB through the existing world glTF loader.
- Classify architecture, props, clutter, occluders, and artifact anchors once.
- Make capture geometry non-pickable.
- Track every imported container, generated material, observer, animation, and
  UI mount in one disposable apartment handle.
- Fit the room into Milo's already-authored shell without changing its exterior
  geographic anchor.

Gate: deterministic node classification and clean disposal after repeated entry.

### Slice 4 — Cassette archaeology spine

- Create `@dissonance/archaeology`.
- Implement explicit validated state transitions.
- Create one invisible pick proxy at the cassette anchor.
- Add hover/select and a minimal Preact inspection panel.
- Add excavation begin/progress/cancel/complete with duplicate-completion guard.
- Keep dust/feedback restrained.

Gate: one complete buried-to-recovered or left-in-situ flow.

### Slice 5 — Scanner and audio fragment

- Support `"visual" | "acoustic"` scanner modes.
- Visual mode reveals preservation/silhouette information.
- Acoustic mode reads `signalResidue` and renders one restrained trace.
- Route cassette playback through existing audio infrastructure.
- Do not block this slice on T20's future full acoustic-domain model.

Gate: scanner reads as Dissonance infrastructure, not generic detective vision.

### Slice 6 — Persistence

- Add versioned archaeology save/load/clear.
- Persist artifact state, excavation progress where appropriate, recovered
  audio-fragment state, and selected leave/recover outcome.
- Never persist transient hover, animation, or DSP parameters.

Gate: reload the app, re-enter Milo's apartment, and reconstruct the exact
artifact outcome without respawning recovered content.

### Slice 7 — Capture integration and hardening

- Replace the placeholder with the real capture.
- Establish first-pass triangle/material/texture budgets from measured browser
  performance rather than the original prompt's speculative numbers.
- Add restrained lighting, FXAA, mild bloom, and apartment debug counters.
- Verify low/balanced/high quality data only if a real measured need exists.
- Run repeated enter/exit, resize, reload, and route-to-door checks.

Gate: production walkthrough and explicit decision on the deferred artifact set.

## 5. Production schedule

| Session | Deliverable |
|---|---|
| 1 | Slice 0: app migration, museum, launcher, deployment |
| 2 | Slice 1: reusable surveilled-location transition |
| 3 | Slice 2: orthographic-isometric camera and cutaway |
| 4 | Slice 3: capture classification and lifecycle |
| 5 | Slice 4: cassette archaeology spine |
| 6 | Slice 5: scanner and audio fragment |
| 7 | Slice 6: local persistence |
| 8 | Slice 7: real capture integration and hardening |

## 6. Verification

For each slice:

- strict TypeScript/build gate for affected workspaces;
- focused pure-logic tests when a state machine or deterministic calculation
  exists;
- browser verification for camera, picking, transitions, disposal, and audio;
- production-base-path smoke tests for `/`, `/world/`, `/museum/`, and
  `/museum/dont-turn-around/`;
- screenshots or recordings for visible review gates.

No slice may modify the preserved DTA exhibit merely to support world runtime
behavior.
