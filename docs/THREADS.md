# THREADS.md — Living Dev Thread Tracker

**Version:** 9
**Date:** 2026-07-14
**Scope:** Culture Engine monorepo (Dissonance + Don't Turn Around)
**Note:** v9 folds in a local Claude Code session's trail-viewer expansion (Drive mode, water/sky/atmosphere systems, forest fire) under the existing Geo pipeline / TrailViewer POC thread — additive only, no other section touched.

---

## Active threads

### T3 — Pursuer extraction ⛔ BLOCKER
Extract `PursuerSystem.ts`, `PursuerBody.ts`, `PursuerAudio.ts` into monorepo packages. Sole integration blocker for downstream pursuer work.
- **Handoff:** `pursuer-extraction-prompt-v2.md`
- **Sequencing note:** the four-bus audio scaffold (D1) should be stood up during T3's audio phase even if three buses start empty — route extracted pursuer audio correctly now rather than re-plumbing later.
- **Status:** ready to run locally

### Pursuer embodiment / profile system
Three composable axes — `BehaviorProfile`, `EmbodimentProfile`, `AudioProfile` — composing into a frozen `ResolvedPursuerProfile` at load time.
- **Handoff:** `pursuer-embodiment-prompt-v1.md`
- **Horizon variants:** drone (procedural animation) and rigged mech dog (skeletal), ground-snap raycasting, loud glTF clip-name validation at load.
- **Dog silhouette ambiguity ladder (design scope):** one silhouette, five readings — (1) live dog (comic relief), (2) acoustically damaged animal (ties to creature-damage canon proposal), (3) mech pursuer (threat), (4) broken mech — dead actuator, damaged gait, ignoring player, walking an unmaintained patrol route forever (decayed-system storytelling; one extra gait clip), (5) hacked mech — surveillance asset watching the player; plugs into `applyDisruption` + break-and-hack seeds. Resolution requires closing distance. Hacked variant needs a subtle behavioral tell (holds distance; head-tracks a half-second too long) — a `BehaviorProfile` difference, same skeleton. **"Hacked by whom" stays deliberately unanswered** pending resistance open question. *Note: the ghost-of-you resolves-toward-player arc applies to the primary DTA pursuer; ladder variants are separate entities.*
- **Depends on:** T3
- **Status:** designed, blocked on T3

### Throw & distraction system 🔄 UPDATED
**Pivoted from melee to strictly nonviolent.** The stick-as-stagger-weapon concept is cut (see D2). Throwables — rock, stick, bottle, pinecone — are sound-making distractors only: analytic ballistic arcs (no physics engine), one optional bounce max, impacts resolve `(profile × surface)` → noise event on the existing bus + spatialized one-shot via the existing wind/water/foliage audio pattern (Phase 0 recon gate).
- **Handoff:** `dissonance-throw-distraction-prompt.md` — **supersedes** the pickup+swing+stagger prompt entirely.
- **Future hook:** `applyDisruption(kind, magnitude)` stub on the brain interface.
- **In-phase sign-offs reserved for Dan:** bottle per-surface break rules; thrown-object persistence/re-pickup (touches registry re-add path); overlapping-noise precedence (latest vs loudest).
- **Status:** handoff ready

### Wildlife / fauna
`FaunaSystem` (per-agent WANDER → ALERT → FLEE → despawn) + `AmbientSwarmSystem`. Birds audio-primary with flush events; birdsong silences at ~1.5s as earliest player warning, recovers slowly. Fireflies night-only, yellow-green only (see P5).
- **Handoff:** `wildlife-expansion-prompt-v1.md`
- **Status:** handoff ready

### Character rigging learning track
Four-tier ladder: segmented rigid arm → mech quadruped → organic quadruped → humanoid. Tier 1 (three-cube arm, direct bone parenting, `AnimationGroup` playback) walked through in full.
- **Asset queue additions (from web session):** live dog — false-scare double, **silhouette must rhyme with the mech dog at range while close reads diverge; design the pair together, not sequentially**; player character rig — visible in isometric surveillance view, clothing/cosmetic layer; vultures (roost pose, feeding pose, distant-circling billboard); pursuer stagger/telegraph clip (first-attack jump scare).
- **Status:** Dan ready to attempt Tier 1 in Blender
- **Feeds:** mech-dog embodiment variant; Lola/nightmare-Lola shared-rig strategy; player rig (isometric views)

### Environment profiles / Dev HUD
`EnvironmentProfile` data type; `applyProfile()` as the sole engine code path. Dev HUD with live parameter tuning + export-to-JSON authoring loop.
- **HUD feature candidate (from Godot PoC):** agent route/waypoint visualization as a toggleable overlay — generalize the PoC's patrol-route toggle for any agent (drone patrols, DTA pursuer).
- **Status:** established pattern; extend, don't fork

### Geo pipeline / TrailViewer POC
South Mountain Reservation heightmap validated the premise: one real heightmap generates a wide variety of landscape types. `packages/geo` (WGS84→UTM, GeoJSON/GPX parsing, heightmap sampling) + `HeightmapTerrain` in `packages/world`. MapMyRun GPX as ground-truth validation.
- **Status:** POC validated; open decisions O1–O3 gate next steps
- **Feeds:** single-level hub structure
- **Cross-genre landscape reuse (2026-07-14 session):** trail-viewer picked up a full traversal/atmosphere layer — Drive mode (grounded fast travel, decoupled `DriveController`), `WaterPlane`, `Sun`/`StarField` day-night cycle, tunable fog, thin-instanced trees, and a `ForestFire` spread mechanic — all as decoupled siblings of the DTA-coupled `CloudSystem`/`DaylightSystem`/`ForestGenerator` rather than reusing those directly. Same DEM + H-scale/V-exaggeration levers now read as seeds for distinct games, not just one viewer: **skiing** (Drive + downhill-biased physics), **firefighting** (`ForestFire` is most of the way there already), **climbing/bouldering** (a steep-terrain-aware Walk variant). Noted as a generative insight, not scoped work.
- **Fly/Drive as unlockable fast-travel skills (parking-lot idea, 2026-07-14):** both are unconditionally available in the current POC. Design intent for whatever game grows out of this viewer: gate them as skills the player unlocks (landmark reached / item found) rather than defaults. Not buildable yet — needs `@dta/persistence` (still a stub) and an actual reason to gate progression.
- **Correction to P8 (Dan, 2026-07-14):** P8 previously named trail-viewer as a superseded PoC becoming a museum piece — backwards. The actual plan: the *current* `dont-turn-around` implementation is what gets preserved as the museum piece; the DTA concept migrates onto trail-viewer's new systems (terrain, water, atmosphere, traversal) as the active foundation going forward. P8's text corrected below to match.

### T12 — Mobile control layer
Touch-drag look; gyroscope tilt-to-move (DeviceOrientation/DeviceMotion); standing play as a first-class posture. Calibration moment ("hold comfortably, tap to set neutral") with a cheap, habitual re-center gesture — all tilt measured as deviation from calibrated pose.
- **Architecture:** `ControlProfile` (dead zones, sensitivity curves, inversion, tilt-to-speed mapping, calibration offsets) through a single `applyControlProfile()` seam — same pattern as environment profiles, tunable in Dev HUD, exported to JSON. Gives `@dta/input` its reason to exist.
- **Constraints:** iOS Safari requires explicit permission via user gesture over HTTPS — **shares one moment with AudioContext unlock (D1) and calibration**; gyro yaw drifts. Phone speakers collapse 3D panning — pursuer-critical info must survive in mono channels (volume, timbre, filter, rhythm), direction is a headphone luxury.
- **Status:** design parallel-safe; implementation gated on `@dta/input`
- **Owning doc:** none yet — needs `mobile-control-prompt-v1.md`

### Sound-as-control
Polyphonic synth with keys routing into the Tone.js graph; may serve diegetically as the hacking interface. The instrument you play is the instrument that hacks. Godot oscilloscope prototype prompt exists as a reference artifact (match-score → drone state loop) — concept reference only, no code porting.
- **Status:** horizon; depends on D1 bus scaffold

### Godot PoC excavation (reference only)
Surveillance Boulevard PoC mined for: boulevard axial layout (urban-edge level design); two-state patrol design (waypoint rounds → detection-triggered pursuit — ambient, not hunting; maps to a `BehaviorProfile`, confirming drone and DTA pursuer share one skeleton); break-and-hack seeds (→ `applyDisruption`, future mechanics thread).
- **Next action:** Dan captures **5–10 stills** (boulevard from each end, drone at route points, route-overlay toggled on, hack interactions) + **three hand-timed numbers** (full circuit time, corner dwell, detection-to-pursuit delay). Stills + numbers → one short extraction doc. Video is for Dan's own reference; Claude reads stills only. No implementation session; no code ports.
- **Status:** parked pending capture

### Lore / AGENTS.md (parallel)
- **T-Lola:** counterpart persona, ontology branch-dependent (data-ghost / expressed self / anomaly-adjacent), never fully confirmed; functions as auditory disguise degrading SignalNet classification. Isometric rendering = diegetic SignalNet perception; Lola-active state degrades player legibility in that view. *Status: experimental.*
- **T-Lola addendum:** fourth manifestation — hallucinatory nightmare figure; a failure mode of the other three, not a fourth ontology. Same rig/silhouette degraded via animation corruption or shader treatment. Candidate mechanism: Synod acoustic experimentation damage — identity-layer expression of the same phenomenon as DTA creatures. Open: trigger conditions; whether player-as-Lola sessions can be visited by nightmare-Lola. *Status: experimental.*
- **DTA pursuer ↔ nightmare-Lola link** via viewpoint binding. *Status: provisional.* **Note: viewpoint binding is now narratively load-bearing** — the DTA spine's perspective shifts and ghost-of-you reveal depend on it (implementation still aspirational; design artifact `data-as-identity.svg`: identity is the resolved profile; possession/hacking = re-binding the viewpoint; skinchanger and hacker are one mechanic wearing two fictions).
- **Pursuer gender-ambiguity design** (silhouette, pitch-ambiguous vocalization, gait corruption). *Status: provisional.*
- **DTA narrative spine** and **single-level hub structure** (per `dta-session-notes.md`). *Status: provisional/experimental as marked.*
- **Isometric camera rule (experimental, needs O4 sign-off):** monitored interiors snap to isometric (SignalNet's legible read); private spaces stay first-person — camera grammar diegetically signals observation. Domicile stays first-person until a one-shot scripted beat renders it isometric (home is watched; zero dialogue). Extensions: (a) player body visible only in surveilled view — the system sees you as a legible object; found clothing reads as data; (b) **inventory-as-room** — collectibles physically displayed in the domicile, a shelf is an inventory screen (ties to collect-and-leave vision + provenance); (c) **staged confrontation framing** — fixed side-on isometric shot for scripted encounters; theatrical legibility without combat (D2 holds; tension is who moves/speaks/backs down). Control during shift: same movement input, camera reframed only.
- **AGENTS.md candidates:** mutual legibility, ghost-of-you reveal, sleep-hike ambiguity rule. *Flag provisional.*

---

## Decisions (frozen — do not relitigate in sessions)

**D1. Audio engine: Tone.js owns the AudioContext. Babylon never plays sound.** One context, one master chain in `@dta/audio`. Named buses: spatial / ambient-beds / interior (heartbeat, stings) / music-synth. Ducking constants defined once, between buses. Spatialization via `Tone.Panner3D` + `Tone.Listener`. Babylon's sole audio role: a bridge system syncing listener/emitter positions from the render loop (~15–20Hz throttle). AudioContext unlock shares T12's permission+calibration moment on mobile. Panner budget: dozens OK, hundreds not — swarm life stays in 2D beds. Keep `Tone.Transport` (musical time) distinct from game-loop time.

**D1a. Thread split.** Tone.js on the main thread; native WebAudio DSP on the browser audio thread; custom synthesis in AudioWorklets; FFT/match-scoring in a web worker.

**D2. Nonviolence.** The player is never given the option to be violent. No melee, no damage, no HP, no forced stagger. Objects affect the world only through sound. "You are prey" is a design principle, not a mechanic choice. Supersedes the stagger/repel stick design in full.

---

## Principles

- **P1. Extend, don't rewrite** — `EnvironmentProfile`/`applyProfile()`, `getHeightAt`, thin-instancing are stable; new systems conform.
- **P2. Audit before implement** — every handoff prompt carries a Phase 0 audit gate.
- **P3. Named constants, never hardcoded values.**
- **P4. Gates between phases** — Dan signs off; decisions are not resolved unilaterally.
- **P5. Warm light belongs to trail markers** — fireflies yellow-green only, never orange/amber; navigation legibility is a hard rule.
- **P6. Diegetic coherence** — isometric camera as SignalNet perception, Lola as auditory disguise, detection state driving environment reactivity.
- **P7. Handoff prompt as primary artifact** — web sessions produce versioned, self-contained prompt docs; prior versions explicitly superseded.
- **P8. Playable archive** — the project retraces its own path; superseded implementations (Godot Surveillance Boulevard, the current `dont-turn-around` app) become museum pieces once their concept migrates onto its successor foundation. *(Corrected 2026-07-14: trail-viewer is that successor foundation, not a museum piece — the DTA concept moves onto trail-viewer's terrain/water/atmosphere/traversal systems, and the present `dont-turn-around` implementation is preserved as the frozen reference instead.)*

---

## Open decisions (pending Dan's sign-off)

1. **O1. Vertical exaggeration factor** (geo pipeline) — couples to `walkableSlopeAngle` in the navmesh bake.
2. **O2. Tile-based navmesh bake** — likely required at reservation scale; also prerequisite for dynamic obstacles (warehouse barricades).
3. **O3. Terrain stamps** — ride on the tile-bake decision, or separate?
4. **O4. Isometric camera rule** — experimental; no level design may assume it before sign-off.
5. **O5. First-encounter jump-scare flag persistence** — persisted across sessions (decided in web session, restated for sign-off): first real consumer of `@dta/persistence`.

---

## Parking lot

- Screenshot capture as state snapshot — serialize camera position/target, exaggeration, palette, generation params to JSON; PNG export as later layer.
- Shadow-as-exposure pursuer mechanic — revisit later.
- Provenance/multiplayer + viewpoint binding — implementation aspirational, explicitly out of scope for current pass (but see lore note: now narratively load-bearing).
- Ambient dread roster: vultures; false-scare roster (vulture burst / live-dog-vs-mech / understory crash) with cry-wolf budget of 2–3 per playthrough, heartbeat+vignette must participate in fakes; first-attack jump scare with persisted one-shot flag, telegraph stagger clip, first-time + toned-down sting variants, sting-ducks-heartbeat named constant.
- Creature behavioral damage canon — pending proposal linking to Synod acoustic experimentation (now also referenced by T-Lola addendum).
- World population; Dissonant Boulevard window occupancy figures (rare silhouettes crossing lit windows — UV-scrolled mask or quads behind glass, ~3 sightings per walk, never reacting; a silhouette that stops and turns is a one-shot scripted beat). Interior sound leaks from lit windows (2D bed, proximity-gated).
- Interior schema pass + reactive environment seam (after embodiment work). Interiors to bracket: liminal mall (long repeating corridors) vs. mausoleum (tight stone) vs. Milo's domicile (`RoomProfile`: acoustics, light sources, anchor props + scatter kits; issued furniture, ration packaging, no sound-making objects; candidate anomaly seed).
- Hold-to-aim throw strength (noted as future knob in throw slice).
- Landscape targets: forest, urban-edge, liminal mall, cemetery, mausoleum, parking lot (dead-commerce exterior; also the DTA hub lot), Milo's domicile. Cemetery = open sightlines + dense low occluders (vision-dominant play); warehouse complex = interior occlusion (hearing-dominant play, surface-typed footsteps).

---

## Conflict rules

- Contradictions between design docs and codebase are surfaced and analyzed, never silently resolved.
- Narrative additions enter at provisional/experimental and are elevated deliberately.
- Frozen decisions (D-series) are recorded here and not revisited without an explicit Dan-initiated reopening.
- **This file is single-writer per session** — two v7s existed because two sessions consolidated in parallel. The repo copy is canonical; web sessions propose diffs against it, never a parallel full version.

---

## Revision log

| Version | Date | Change |
|---|---|---|
| 9 | 2026-07-14 | Local session expanded trail-viewer (Drive mode; `WaterPlane`, `Sun`/`StarField`, fog, `ThinInstanceTrees`, `ForestFire` — decoupled siblings of DTA's CloudSystem/DaylightSystem/ForestGenerator). Added under existing Geo pipeline / TrailViewer POC thread: cross-genre landscape reuse note (skiing/firefighting/climbing), Fly/Drive-as-unlockable-skill parking-lot idea. Corrected P8 per Dan: trail-viewer is the successor foundation the DTA concept migrates onto, not a museum piece — the current `dont-turn-around` implementation is the one preserved as museum piece. |
| 8 | 2026-07-14 | Reconciled divergent v7s. Restored T12 (was cited by D1 but missing). Added: dog ambiguity ladder (embodiment), asset-queue additions (live dog pair rule, player rig, vultures, stagger clip), route-viz HUD candidate, Godot excavation next-action (stills + 3 timings), isometric camera rule package (O4), O5 persistence sign-off, single-writer conflict rule. Parking lot enriched (false-scare details, window occupancy, RoomProfile). Viewpoint binding flagged narratively load-bearing. |
| 7 | 2026-07-14 | Consolidation. Throw & distraction thread rewritten nonviolent (D2 frozen); melee prompt superseded. D1/D1a recorded. T-Lola addendum, DTA spine, hub structure, playable archive (P8) folded in. Parking lot + open decisions O1–O3 refreshed. |
| 6 | prior | Baseline for this consolidation. |
