# boulevard-build-prompt-v1.md

**Owning thread:** T13 (Godot PoC excavation → realized) + T6.2 (urban-edge profile) + T9 (sound-as-control, deferred to its own session)
**Target:** TS / BabylonJS / Tone.js monorepo. Godot PoC is reference geometry only — no code ports.
**Scope of this doc:** the Dissonant Boulevard as one continuous first-person level, with the five narrative threads built in as diegetic encounters. World and story develop concurrently — every system lands as data (profiles/manifests) so narrative tuning never requires code.
**Deferred out of this prompt:** isometric-surveillance camera rule (open decision #4) — Milo's home reveal here uses a placeholder first-person beat; the isometric reveal arrives via the incoming photogrammetry engineering prompt and replaces the placeholder without touching thread logic.

---

## Canonical grounding (do not relitigate)

- Signal = surveillance. **Dead zones = freedom.** SignalNet coverage is a gradient, not a binary.
- Suppression is ambient and decentralized. The drone is an ambient round, not a hunter (two-state: patrol / pursue, per T13).
- Delivery is diegetic: environment, system response, material detail. **No exposition, no dialogue in the base layer.** Milo accretes through what he is equipped to notice.
- Warm light belongs to markers/carry light only (P5 / chroma rules). Saturated artifact against desaturated ground = discovery signal.
- Data over code (Conflict rule 2): coverage field, window occupancy, encounter placement, and Milo's fragments are all authored data consumed by the renderer.

---

## Decision required before Phase 1 (blocks the reactive layer)

**DEC-A — dead-zone exposure cue.** The boulevard inverts DTA's proven heartbeat/vignette: on the lit axis Milo is *exposed* (subtle unease ramp); entering a dead zone *releases* it (relief). Two options:
- **(A1) Reuse inverted.** Same heartbeat/vignette vocabulary from `@dta/audio` + post-stack, driven by an `exposure_score` instead of pursuer state. Cheapest; ties into T5 seam directly.
- **(A2) New signal-loss vocabulary.** Dead zones get their own cue (e.g. SignalNet ambient bed thinning, faint high-frequency drop-out) distinct from DTA's cardiac language.

Prompt assumes **A1** unless overridden. This touches D1 audio buses — do not open `@dta/audio` from two threads (T3 owns it until extraction lands; coordinate).

---

## Phase 0 — Audit gate (mandatory, no code changes)

Before writing anything:
1. Confirm the existing Boulevard geometry/buildings import cleanly (`ImportMeshAsync` / `AssetContainer`). Report what's present: axis extent, building count, any existing drone path.
2. Confirm `EnvironmentProfile` + `applyProfile()` is the sole render path. Identify any gap the urban-edge profile needs (bloom, LUT, grain, vignette, emissive window dots, catenary wires, wet ground) — report as a schema-extension list, do **not** extend yet.
3. Confirm `@dta/audio` write-ownership status (T3). If unresolved, the audio hooks in later phases are stubbed against named constants only.
4. Confirm window-occupancy shader approach (UV-scrolled silhouette mask on emissive window shader or flat quads) is available or needs authoring.
5. Output: a one-page audit + the DEC-A recommendation. **Stop for sign-off.**

---

## Phase 1 — The spine (Boulevard as coverage gradient)

**Goal:** the boulevard reads as one continuous monitored axis with legible dead zones. No encounters yet — just the terrain of attention.

- **Urban-edge profile** (`profiles/landscape/boulevard.json`): dark fog, bloom, LUT, grain, vignette, emissive window dots, catenary wires, wet ground. Additive data file only.
- **Coverage field** (`profiles/signalnet/coverage.json`): authored scalar field over the boulevard footprint — sampled once per tick from a texture in ground-splat UV space (one fetch, no raycasts), yielding `exposure_score ∈ [0,1]`. High on the lit axis, thinning at authored seams.
- **Reactive hook (DEC-A):** `exposure_score` drives the cue via the resolved-profile seam. Asymmetric lerps (ramp-in faster than release, mirroring T5's ~2s/~5s). Named constants: `EXPOSURE_RAMP_IN_S`, `EXPOSURE_RELEASE_S`, `DEADZONE_THRESHOLD`.
- **Drone patrol** (`profiles/behavior/drone_patrol.json`): fixed waypoint round on the lit axis, two-state (patrol/pursue). Pursue is soft here — investigate, not catch. The drone is the *cost* that makes dead-zone detours meaningful.

**Acceptance:** walk the axis; exposure cue ramps on the lit spine and releases in seams; drone runs its round; profile round-trips through Dev HUD losslessly.
**Out of scope:** any encounter, any narrative object, isometric.

---

## Phase 2 — Ambient absence (T-Neighbor)

**Goal:** the cheapest thread first — pure atmosphere, zero AI, establishes the watcher inversion.

- **Window occupancy layer** (`profiles/boulevard/windows.json`): per-window randomized timers, low probability (~3 sightings per walk), varied speed, silhouettes never loop visibly, never react. UV-scrolled mask, no meshes.
- **The quiet window:** one authored exception — a unit whose light is on but nothing ever crosses, OR whose silhouette stopped. One-shot scripted beat available if the player watches past a dwell threshold: silhouette stops and turns (fires once, then never again). Named constant: `NEIGHBOR_DWELL_TRIGGER_S`.
- **No resolution.** No body, no alarm, no NPC. SignalNet's non-response is the payload.

**Acceptance:** ambient silhouettes populate believably; the quiet window is registrable but easy to miss; the turn-beat fires at most once and is persisted (do not re-fire on revisit).
**Narrative relevance:** disappearance without system response; player-as-watcher.

---

## Phase 3 — The edited record (T-Redacted, Milo's spine)

**Goal:** give Milo a profession, competence, and first self-doubt — diegetically.

- **Public sanitation terminal** on the lit axis (accessing it while observed is the tension). Reachable because of what Milo does.
- **The discrepancy** (`profiles/threads/redacted_record.json`): two versions of one entry; the edit timestamp is Milo's own. Delivered as displayed data, not dialogue. The terminal UI is a Synod-legible read — cold, procedural, machine-first.
- **Milo fragment system** (`profiles/threads/milo_fragments.json`): a lightweight, additive store of what Milo has *noticed*. No stats, no inventory grid — a set of registered observations that later threads can reference. This is the concurrent-story seam: narrative grows by adding fragment data, never code.

**Acceptance:** terminal accessible; discrepancy legible without exposition; fragment registers on discovery; exposure cue makes on-axis access feel exposed.
**Narrative relevance:** sanitation edits reality; Milo's labor is suspect; observation vs. understanding (he sees the edit, can't understand it).

---

## Phase 4 — The preserved wrong thing (T-Curator)

**Goal:** history-as-curated-artifact turning against its curators.

- **Dead commercial interior** off the storefront row — visible through glass before enterable (anticipation before access). Reuse liminal-mall profile direction (silent PA, bleached-pastel signage, sepia/grey base, skylight shafts vs dead fluorescents). First interior test — expect the `EnvironmentProfile` reverb/acoustic-zone gap flagged in Phase 0; route any schema extension through T1 in one dedicated session **before** authoring the interior profile.
- **The wrong exhibit** (`profiles/threads/curator_anomaly.json`): one preserved item the Synod's editorial logic should have erased. Found by looking — saturated artifact against desaturated ground (chroma exception). Was it a curator's error or a message? **Never disambiguated** (multi-interpretation canon rule).
- Registers a Milo fragment; cross-links to T-Redacted (he notices editorial inconsistency because it's his job).

**Acceptance:** interior enters via profile system without a fog crutch; anomaly discoverable by perception, not prompt; ambiguity preserved (no telemetry that resolves error-vs-message).
**Narrative relevance:** curated history; the editorial seam; Milo's eye for the edited applied to the world.

---

## Phase 5 — Home (T-Domicile) — first-person placeholder

**Goal:** private space as monitored space, at room scale.

- **Milo's domicile** off a boulevard spoke (entering is a deliberate, characterizing detour). `RoomProfile` (`profiles/rooms/milo_domicile.json`): issued furniture, ration packaging, **no sound-making objects**; hand-placed anchor props + per-room-type scatter kit.
- **The anomalous signal:** one thing produces a signal it shouldn't — a wall hum, an object predating austerity. Registers as a candidate anomaly seed + Milo fragment.
- **Reveal — PLACEHOLDER:** a restrained first-person beat marking home-as-watched (e.g. the wall hum spikes when the exterior drone passes the spoke). **The isometric surveillance reveal is deferred** to the incoming photogrammetry engineering prompt; it will replace this placeholder without touching thread or fragment logic. Leave a clean seam: `domicile_reveal` is a named beat the future prompt re-binds.

**Acceptance:** domicile reads through material conditions alone; anomalous signal registrable; placeholder reveal fires once; `domicile_reveal` seam documented for later isometric swap.
**Narrative relevance:** how Milo is allowed to live; surveillance turned inward.

---

## Phase 6 — Composition & posture-of-attention pass

**Goal:** verify the threads compose as *one continuous read*, not a menu.

- No thread announces itself. The boulevard is layered by attention:
  - fast on the lit axis → spine + peripheral neighbor stillness
  - detour into dead zones → terminal, mall glass, home spoke
  - drone pressure makes detours cost exposure on re-entry
- **Concurrent-story check:** confirm all five threads read/write only through profile + fragment data. Adding a sixth thread later must require zero engine changes.
- Playable archive (P1): tag + zipped `dist/` + one-line README once the boulevard supersedes the trail-viewer as the showcase build.

**Acceptance:** a single unbroken walk surfaces every thread at the appropriate posture of attention; fragment store reflects what was noticed; no thread requires the player to leave the diegesis (no menus, no exposition dumps).

---

## Named-constants inventory (single source; tune in Dev HUD, export to JSON)

- `EXPOSURE_RAMP_IN_S`, `EXPOSURE_RELEASE_S`, `DEADZONE_THRESHOLD`
- `DRONE_PATROL_SPEED`, `DRONE_INVESTIGATE_RADIUS`
- `WINDOW_SIGHTING_PROB`, `WINDOW_TIMER_MIN_S`, `WINDOW_TIMER_MAX_S`, `NEIGHBOR_DWELL_TRIGGER_S`
- `ANOMALY_CHROMA_SATURATION_FLOOR` (discovery-signal threshold)

## Out of scope (do not build in this pass)

- Isometric-surveillance camera (deferred — photogrammetry eng prompt).
- Sound-as-control oscilloscope mechanic (T9 — separate session, after T3).
- Resistance hardening, anomaly-nature resolution, Synod geographic scope (open canon — keep all thread material provisional).
- Any second render path or engine-side tuning (Conflict rules 2–3).
- Opening `@dta/audio` concurrently with T3.

## Conflict declarations

- One package per session. This prompt spans profiles/manifests + one urban-edge render pass; if it must touch `@dta/audio`, split that into its own session under T3's ownership.
- All narrative tuning is additive data. Threads grow by adding profile/fragment files, never engine code.

---

*Status of all narrative material herein: provisional. Composes existing provisional pieces (dead-zones-as-freedom, window occupancy, chroma exception, drone two-state, RoomProfile, multi-interpretation canon). Needs a freeze pass before any thread becomes load-bearing.*
