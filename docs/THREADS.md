# THREADS.md — Living Dev Thread Tracker

**Version:** 9
**Date:** 2026-07-14
**Scope:** Culture Engine monorepo (Dissonance + Don't Turn Around)

> **North star:** Audio is the key element of this game. Sound and music are not a subsystem — they are a first-class simulated world force woven through every system: ecology, bodies, behavior, institutions, identity, navigation, threat, and play. Every thread below either produces sound, consumes it, or is shaped by it. When in doubt, decide in favor of the dream: a world you learn by listening.

**Note:** v9 weaves `acoustic-world-systems-prompt-v1.md` (fiction→design→implementation spine) through existing threads. Four conflicts surfaced as O6–O8 + oscilloscope supersession — not silently resolved.

---

## Thread ID registry (reconciled v9.3 — IDs are now stable; do not renumber)

| ID | Thread | State |
|---|---|---|
| T1/T2 | Environment profiles / Dev HUD (profile pattern + authoring loop) | active |
| T3 | Pursuer extraction | active — blocker |
| T4 | Pursuer embodiment / profile system | blocked on T3 |
| T5 | Reactive environment seam | parked — shares transition seam with T23 |
| T6 | Landscape profiles (targets list) | parked — targets become T23 regions |
| T7 | World population / window occupancy | parked — reframed as world assembly under T23 |
| T8 | — retired: merged into T17 (asset queue) | merged |
| T9 | Sound-as-control → voice rig | horizon |
| T10 | Lore / AGENTS.md (contains T-Lola, T14, T15, T16) | parallel |
| T11 | Provenance / multiplayer | parked (reserved ID) |
| T12 | Mobile control layer | queued |
| T13 | Godot PoC excavation | parked pending capture |
| T14 | Viewpoint binding / possession | lore-committed, impl. aspirational |
| T15 | DTA narrative spine | provisional (lore) |
| T16 | Single-level hub structure | provisional (lore) |
| T17 | Character rigging learning track | active |
| T18 | Throw & distraction system | handoff ready |
| T19 | Wildlife / fauna | handoff ready |
| T20 | Acoustic world systems (master spine) | owning doc ready |
| T21 | Geo pipeline / TrailViewer — successor foundation | active; traversal/atmosphere layer landed; O1–O3 gate geo next steps |
| T22 | DTA forest visual & play-scenario direction | direction set |
| T23 | Region system / continuous world | design committed |

---

## Active threads

### T3 — Pursuer extraction ⛔ BLOCKER
Extract `PursuerSystem.ts`, `PursuerBody.ts`, `PursuerAudio.ts` into monorepo packages. Sole integration blocker for downstream pursuer work.
- **Handoff:** `pursuer-extraction-prompt-v2.md`
- **Sequencing note:** the four-bus audio scaffold (D1) should be stood up during T3's audio phase even if three buses start empty — route extracted pursuer audio correctly now rather than re-plumbing later.
- **Status:** ready to run locally

### T4 — Pursuer embodiment / profile system
Three composable axes — `BehaviorProfile`, `EmbodimentProfile`, `AudioProfile` — composing into a frozen `ResolvedPursuerProfile` at load time.
- **Handoff:** `pursuer-embodiment-prompt-v1.md`
- **Horizon variants:** drone (procedural animation) and rigged mech dog (skeletal), ground-snap raycasting, loud glTF clip-name validation at load. Acoustic-world prompt adds: damaged / hacked / abandoned / animal-imitating variants, and a **fourth axis — `SensorProfile`** (directional mics, vibration sensing, human/animal-response measurement, challenge-response) → schema change to the resolved profile (O7; embodiment prompt needs v2 before running).
- **Perceptual identity resolution:** the dog ambiguity ladder now has a data structure — `PerceptualLODProfile`, *independent of geometric LOD*: far = shared silhouette (+ audio profile), medium = behavior tell + animation divergence, near = material/anatomy truth, inspect = provenance. Identity is never resolved through labels; hacked-dog tells (holds distance, head-tracks too long, delays patrol return, listens to nothing audible) live in `BehaviorProfile`.
- **Dog silhouette ambiguity ladder (design scope):** one silhouette, five readings — (1) live dog (comic relief), (2) acoustically damaged animal (ties to creature-damage canon proposal), (3) mech pursuer (threat), (4) broken mech — dead actuator, damaged gait, ignoring player, walking an unmaintained patrol route forever (decayed-system storytelling; one extra gait clip), (5) hacked mech — surveillance asset watching the player; plugs into `applyDisruption` + break-and-hack seeds. Resolution requires closing distance. Hacked variant needs a subtle behavioral tell (holds distance; head-tracks a half-second too long) — a `BehaviorProfile` difference, same skeleton. **"Hacked by whom" stays deliberately unanswered** pending resistance open question. *Note: the ghost-of-you resolves-toward-player arc applies to the primary DTA pursuer; ladder variants are separate entities.*
- **Depends on:** T3
- **Status:** designed, blocked on T3

### T18 — Throw & distraction system 🔄 UPDATED
**Pivoted from melee to strictly nonviolent.** The stick-as-stagger-weapon concept is cut (see D2). Throwables — rock, stick, bottle, pinecone — are sound-making distractors only: analytic ballistic arcs (no physics engine), one optional bounce max, impacts resolve `(profile × surface)` → noise event on the existing bus + spatialized one-shot via the existing wind/water/foliage audio pattern (Phase 0 recon gate).
- **Handoff:** `dissonance-throw-distraction-prompt.md` — **supersedes** the pickup+swing+stagger prompt entirely.
- **Future hook:** `applyDisruption(kind, magnitude)` stub on the brain interface.
- **In-phase sign-offs reserved for Dan:** bottle per-surface break rules; thrown-object persistence/re-pickup (touches registry re-add path); overlapping-noise precedence (latest vs loudest).
- **Status:** handoff ready

### T19 — Wildlife / fauna
`FaunaSystem` (per-agent WANDER → ALERT → FLEE → despawn) + `AmbientSwarmSystem`. Birds audio-primary with flush events; birdsong silences at ~1.5s as earliest player warning, recovers slowly. Fireflies night-only, yellow-green only (see P5).
- **Handoff:** `wildlife-expansion-prompt-v1.md`
- **Extension path (per acoustic-world prompt):** exposure/entrainment/cumulative-dose states per agent (`AcousticSensitivityProfile`, `AcousticExposureState`); expanded state roster (freeze, investigate, repeat-route, abandon-nest, entrained, fail-to-recover); ecological conditions layer (time/season/weather/human activity/Synod exposure). **Healthy baseline first (P9)** — damaged behavior only reads against an established normal. "Specific wrongness" roster, never a generic creepy layer: birds at wrong times, alarm calls without predators, synchronized insect silence waves, animals answering infrastructure tones, moving bands of silence. Damaged animals are not monsters — confusion, timidity, repetition, detachment, wrong-time activity.
- **Status:** handoff ready; extension queued behind acoustic domain types

### T20 — Acoustic world systems — master engineering spine 🆕
Sound as a first-class simulated world phenomenon whose audible, biological, behavioral, ecological, and institutional meanings stay **separate but interconnected**. The DDI braid: fiction (Synod acoustic control) → design (command profiles, voice rig, ambiguity) → implementation (typed domain, buses, workers).
- **Owning doc:** `acoustic-world-systems-prompt-v1.md` (this session; save under this name)
- **Eight-layer separation (architecture law):** source / propagation / audible rendering / biological exposure / cumulative dose / behavioral response / ecological response / narrative interpretation. Audio playback is never authoritative gameplay state — a `SoundField` exists whether or not the player hears it. Emitters emit fields; **no `makeEveryoneKneel()`** — other systems independently process exposure and learned behavior.
- **Typed domain:** `SoundField`, `AcousticZoneProfile`, `AcousticHabitatProfile`, `AcousticSensitivityProfile`, `AcousticExposureState`, `AcousticCommandProfile` (advisory / civic-control / enforcement / experimental / obsolete), `HumanAcousticResponseContext`, typed `WorldSignal` bus.
- **Human response is never binary compliance:** recognition × conditioning × fear × physiology × social pressure × protection-of-others. A person kneels by choice, fear, imitation, or body-before-mind — **the system supports ambiguous outcomes; the person may not know which it was.** That ambiguity is the project.
- **Voice rig / vocoder (supersedes oscilloscope-as-mechanic):** mic → gate → compressor → pitch/formant → vocoder|direct → filter → distortion → delay → convolution → out, with parallel destinations (audible / authentication-analysis / recorder / in-world transmitter). **What the player hears and what the machine evaluates may differ.** Authentication is multi-dimensional (`VoiceAuthenticationResult`: identity, biological confidence, challenge timing, environmental match, anomaly score) — static playback fails advanced systems; partial matches produce graded consequences (opens door + logs anomaly; fools mech but not human; passes machine sounding monstrous). **Anti-minigame rule: never one correct frequency.**
- **Diegetic interface (P6):** no DAW rack in-world — salvaged knobs, patch cables, pipes, broken radios, rooms as processors (`EnvironmentalAudioProcessor`: mausoleum reverb, water-tank resonance, mic placement). The world is part of the processing chain. Dev HUD gets the numeric controls.
- **Mech-dog challenge slice (Dissonance vertical slice):** public command pattern → ambiguous crowd choreography → dog flags delayed compliance → challenge → Milo answers through the rig → Lola derives a carrier from the dog's own actuator hum → authentication passes → **nearby wildlife reacts badly** — technical success, ecological/social cost. Dog stays partially autonomous; player controls only part of the system; never a combat drone.
- **Phases:** 0 audit (mandatory gate) → 1 typed acoustic domain + tests → 2 Babylon/Tone bridge → 3 healthy ecology → 4 Synod fields → 5 voice rig → 6 mech-dog challenge → 7 vertical-slice integration. **Sequencing:** Phase 1 is pure types — parallel-safe now. Phases 2+ touch `@dta/audio` → queue behind T3 (single-writer rule; see O8).
- **Baseline milestone contains zero Synod effects** — forest edge, service road, parking lot, small residential/utility area; ordinary warning speaker, ordinary voices, ordinary silence. Synod overlay is a second milestone.
- **Status:** owning doc ready; Phase 0 audit is the next local session after (or parallel-typed alongside) T3

### T17 — Character rigging learning track
- **Status:** active — offline/Blender track, parallel-safe, zero repo conflict
- **Scope:** four-tier skill ladder building toward production character assets. Each tier proves a pipeline capability before the next adds complexity:
  1. **Segmented rigid arm** — three-cube chain, plain bone parenting (no weight painting), single keyframed action, full Blender → `.glb` → Babylon `AnimationGroup` round trip. *Walked through in full; ready to attempt.*
  2. **Mech quadruped** — rigid-segment technique at production scale; walk cycle; feeds T4 mech-dog embodiment directly
  3. **Organic quadruped** — first real weight painting (Automatic Weights + cleanup); feeds T8 live dog / animals
  4. **Humanoid + outfit** — full deformation rig; target: 3D Lola character. Nightmare-Lola = same rig, corrupted animation / shader treatment, not a second model
- **Known failure modes (tier 1):** wrong import scale (fix: Ctrl+A Apply All Transforms pre-export), animation plays but nothing moves (keyframes set in Object Mode instead of Pose Mode)
- **Conventions:** bone and Action names are load-bearing — they travel into the glb and become Babylon lookup keys; validate clip names loudly at load (same rule as T4)
- **Ties:** T8 (this track produces its skills), T4 (mech dog + stagger clip), T-Lola (tier 4 target; one-rig-two-presentations rule)
- **Numbering note (RESOLVED v9.3):** T4 = embodiment thread above; T8 retired — merged into this thread's asset queue. See registry.
- **Asset queue (carried from v8):** live dog — false-scare double, **silhouette must rhyme with the mech dog at range while close reads diverge; design the pair together, not sequentially**; player character rig — visible in isometric surveillance view, clothing/cosmetic layer; vultures (roost pose, feeding pose, distant-circling billboard); pursuer stagger/telegraph clip.
- **Owning doc:** none yet — tier walkthroughs live in web sessions until a `rigging-track-notes.md` is worth extracting; player rig (isometric views)

### T1/T2 — Environment profiles / Dev HUD
`EnvironmentProfile` data type; `applyProfile()` as the sole engine code path. Dev HUD with live parameter tuning + export-to-JSON authoring loop.
- **HUD feature candidate (from Godot PoC):** agent route/waypoint visualization as a toggleable overlay — generalize the PoC's patrol-route toggle for any agent (drone patrols, DTA pursuer).
- **Status:** established pattern; extend, don't fork

### T21 — Geo pipeline / TrailViewer — successor foundation (per P8 correction)
South Mountain Reservation heightmap validated the premise: one real heightmap generates a wide variety of landscape types. `packages/geo` (WGS84→UTM, GeoJSON/GPX parsing, heightmap sampling) + `HeightmapTerrain` in `packages/world`. MapMyRun GPX as ground-truth validation.
- **Traversal/atmosphere layer (local session, 2026-07-14/15):** trail-viewer picked up **Drive mode** (`DriveController` — grounded, flight-speed traversal alongside Walk/Fly), **`WaterPlane`** (reflective, tunable real-elevation level, + separate murky underside so submerging shows no void), **`Sun`/`StarField`** day–night cycle (`setTimeOfDay(hour)` drives ambient, sky color, star visibility together), tunable **fog** (density + color picker), an **overcast toggle** (denser/greyer/lower cloud blanket + ~40% sun/ambient dim — genuinely flat diffused sky), **`ThinInstanceTrees`** (elevation-scattered, avoids the flat coastal zone — no land-use data in this dataset; tree-count slider capped at a deliberate 8000 hardware ceiling — thin instancing keeps render cost flat, so the cap is considered, not accidental), a **`ForestFire`** spread mechanic (F ignites nearest tree; neighbor spread, throttled growth, survives rescales), and a **Bounded World toggle** (clamps Walk/Fly/Drive to the DEM bbox per frame; app-local — Fly/Drive previously had no bounds concept). Full tuning state persists per level across reloads. **All are decoupled siblings of DTA’s `CloudSystem`/`DaylightSystem`/`ForestGenerator`/`PlayerController`** — those are coupled to `ExperienceProfile` and DTA’s ~800-unit scale; trail-viewer is real-world/km scale. App-local for now; no shared package until a second consumer exists.
- **Copy/Load View snapshot mechanism (net-new, never previously committed):** “📋 Copy View” serializes the exact current vista to clipboard JSON; “Load View” jumps to one. **`ViewSnapshot` shape:** `{ level, activeMode?, x/y/z?, rotationX/Y? }` (player modes) or `{ level, orbitTargetX/Y/Z?, orbitAlpha/Beta/Radius? }` (orbit), both sharing `hScale, vExag, waterLevel, cameraHeightOffset?, timeOfDay, fogDensity, fogColor?, overcast?, starCount, cloudCount, treeCount`. Reuses trail-viewer’s per-level settings storage, no parallel format. **Codebase-wide gotcha (caught + fixed):** `location.reload()`/`location.href` fire `beforeunload`/`pagehide` on the dying page *before* the new one loads — the periodic autosave was re-persisting stale in-memory state and clobbering the just-written snapshot (same race fixed once before for reset-position). Fix: unregister those listeners immediately before writing + navigating. **Remember for any future reload-to-restore-state pattern.**
- **Fast-travel design intent (noted, not built):** Fly/Drive read naturally as *unlockable* fast-travel skills (gated behind landmark/item), not defaults — needs `@dissonance/persistence` (still a stub) and an actual progression reason.
- **Generative insight (cross-ref T6, T23):** same DEM + H-scale/V-exaggeration levers read as seeds for **distinct games**, not one viewer — skiing (Drive + downhill-biased physics, not built), firefighting (`ForestFire` is most of the way there), climbing/bouldering (steep-terrain-aware Walk variant, not built). Extends T21’s “one heightmap → many landscape types” premise from visual variety to game *mechanics*. Insight, not scoped work.
- **Status:** POC validated and growing into the successor foundation; open decisions O1–O3 gate next steps
- **Feeds:** single-level hub structure (T16), region system (T23)

### T22 — DTA forest visual & play-scenario direction
Compact index of `dta-session-notes.md` §1–4 (all PROVISIONAL; the notes doc is the owning artifact):
- **Palette:** hue-narrow / value-wide — blue-black green → acid chartreuse; crush shadows cool, let backlit foliage clip via bloom, starve red channel. Warm orange/red reserved for carry light + interactables (extends P5).
- **Play scenarios:** culvert as threshold object (water masks both hearing channels — free speed, blind approach); mow line as instant exposure gradient (tall grass conceals, costs foliage noise). Shadow-as-exposure PARKED (analytic method sketched, no shadow-map readback).
- **Engineering:** terrain stamps for overhangs (→ O3); concealment mask sampled in terrain-splat UV space, one fetch per tick, no raycasts; `FoliageSwayPlugin` + translucency term (`dot(-lightDir, viewDir)`) for backlit ignition.
- **FPPOV lighting:** dapple via scrolling canopy-noise light cookie; god rays (`VolumetricLightScatteringPostProcess`, chartreuse-keyed); **diegetic exposure feedback — vignette strength tied to concealment, no HUD** (the audio-first north star's visual twin: the frame itself tells you if you're hidden); near-camera grass blades with near-blur for body presence.
- **Status:** direction set; lands as profile data + shader extensions when world assembly (T23) opens

### T23 — Region system / continuous world 🆕
- **Status:** design committed — implementation after T3/T4; interiors schema pass is a prerequisite for interior regions
- **Thesis:** one continuous world (SMR-scale TrailViewer terrain), environments as *regions selected by profile*, not levels selected by scene load. The landscape targets (T6) become zones in one space, not separate scenes.
- **The one new engine seam:** a spatial query — "which profile governs here" — via zone volumes or a splat-space region mask, feeding `applyProfile()`. Boundary crossing = lerped profile transition. **Shares lerp machinery with T5** (reactive environment): spatial trigger and detection trigger drive the same seam. Route both through one transition system, one session.
- **DTA-onto-TrailViewer work items:**
  - Pursuer consumes real terrain: `getHeightAt` locomotion + tile-based navmesh bake (O2 — now decided-required)
  - Concealment mask (splat-UV, one fetch/tick) bridges TrailViewer foliage → detection logic
  - Collectible rings (T15/T16) = authoring pass on real trailhead topology
- **Interior/hardscape regions:** terrain stamps (O3) for mall/mausoleum/domicile; flattened patches for parking lot/urban-edge. Gated on interiors schema pass.
- **Density budgets:** per-region scatter budgets; likely tile-based content loading (rides the O2/O3 tile decision).
- **Canon guard:** continuous world = *shared engineering world*, not confirmed shared fiction — see T10 note. Cemetery remains the designed seam.
- **Owning doc:** none yet — needs `region-system-prompt-v1.md`
- **Ties:** T1/T2 (profiles are the mechanism), T5 (shared transition seam), T6 (targets become regions), T7 (world assembly, not population), T15/T16 (rings/hub), T21 (terrain substrate), O2/O3.

### T12 — Mobile control layer
Touch-drag look; gyroscope tilt-to-move (DeviceOrientation/DeviceMotion); standing play as a first-class posture. Calibration moment ("hold comfortably, tap to set neutral") with a cheap, habitual re-center gesture — all tilt measured as deviation from calibrated pose.
- **Architecture:** `ControlProfile` (dead zones, sensitivity curves, inversion, tilt-to-speed mapping, calibration offsets) through a single `applyControlProfile()` seam — same pattern as environment profiles, tunable in Dev HUD, exported to JSON. Gives `@dta/input` its reason to exist.
- **Constraints:** iOS Safari requires explicit permission via user gesture over HTTPS — **one gesture must unlock: AudioContext (D1) + microphone (voice rig) + device orientation + calibration**; gyro yaw drifts. Phone speakers collapse 3D panning — pursuer-critical info must survive in mono channels (volume, timbre, filter, rhythm), direction is a headphone luxury.
- **Status:** design parallel-safe; implementation gated on `@dta/input`
- **Owning doc:** none yet — needs `mobile-control-prompt-v1.md`

### T9 — Sound-as-control → voice rig
The shipped mechanic is the **voice rig / vocoder loop** (see acoustic world systems thread): live signal construction, multi-dimensional authentication, partial-match consequences. Polyphonic synth with keys routes into the same Tone.js graph — the instrument you play is the instrument that hacks; synth carriers feed the vocoder. **The Godot oscilloscope prototype is a museum piece (P8): its single-frequency match-score loop is explicitly superseded by the anti-minigame rule.** Concept reference only.
- **Vocoder as theme made mechanism:** voice as modulator, machine as carrier — human intention passes through technological structure and emerges neither fully human nor fully mechanical. Lola operates *inside this graph* (see lore).
- **Status:** horizon; depends on D1 bus scaffold + acoustic domain types

### T13 — Godot PoC excavation (reference only)
Surveillance Boulevard PoC mined for: boulevard axial layout (urban-edge level design); two-state patrol design (waypoint rounds → detection-triggered pursuit — ambient, not hunting; maps to a `BehaviorProfile`, confirming drone and DTA pursuer share one skeleton); break-and-hack seeds (→ `applyDisruption`, future mechanics thread).
- **Next action:** Dan captures **5–10 stills** (boulevard from each end, drone at route points, route-overlay toggled on, hack interactions) + **three hand-timed numbers** (full circuit time, corner dwell, detection-to-pursuit delay). Stills + numbers → one short extraction doc. Video is for Dan's own reference; Claude reads stills only. No implementation session; no code ports.
- **Status:** parked pending capture

### T10 — Lore / AGENTS.md (parallel)
- **T-Lola:** counterpart persona, ontology branch-dependent (data-ghost / expressed self / anomaly-adjacent), never fully confirmed; functions as auditory disguise degrading SignalNet classification. Isometric rendering = diegetic SignalNet perception; Lola-active state degrades player legibility in that view. *Status: experimental.*
- **T-Lola addendum:** fourth manifestation — hallucinatory nightmare figure; a failure mode of the other three, not a fourth ontology. Same rig/silhouette degraded via animation corruption or shader treatment. Candidate mechanism: Synod acoustic experimentation damage — identity-layer expression of the same phenomenon as DTA creatures. Open: trigger conditions; whether player-as-Lola sessions can be visited by nightmare-Lola. *Status: experimental.*
- **T14 — DTA pursuer ↔ nightmare-Lola link** via viewpoint binding. *Status: provisional.* **Note: viewpoint binding is now narratively load-bearing** — the DTA spine's perspective shifts and ghost-of-you reveal depend on it (implementation still aspirational; design artifact `data-as-identity.svg`: identity is the resolved profile; possession/hacking = re-binding the viewpoint; skinchanger and hacker are one mechanic wearing two fictions).
- **Pursuer gender-ambiguity design** (silhouette, pitch-ambiguous vocalization, gait corruption). *Status: provisional.*
- **Spiral placement rule (T15/T16, provisional):** collectibles placed on an outward spiral from the parking-lot hub — distance rings made continuous, with deterministic angular progression. Authoring/testing win: placement is a function (radius, angle), not a hand-scatter; walk order is enumerable for playtests. Spiral points **snap to nearest reachable trail-network position** (pure geometry would strand items off-trail). Known tell: pattern-literate players may deduce the spiral — acceptable for now, revisit with jitter/per-ring angular offset later; the trail network already distorts the spiral enough that on-foot legibility is low. Pursuer escalation stays keyed to *radius*, so the spiral changes nothing about T15's difficulty bargain.
- **T15 — DTA narrative spine** and **T16 — single-level hub structure** (per `dta-session-notes.md` §5–11; §1–4 indexed under "DTA forest visual & play-scenario direction" above). *Status: provisional/experimental as marked.*
- **Isometric camera rule (experimental, needs O4 sign-off):** monitored interiors snap to isometric (SignalNet's legible read); private spaces stay first-person — camera grammar diegetically signals observation. Domicile stays first-person until a one-shot scripted beat renders it isometric (home is watched; zero dialogue). Extensions: (a) player body visible only in surveilled view — the system sees you as a legible object; found clothing reads as data; (b) **inventory-as-room** — collectibles physically displayed in the domicile, a shelf is an inventory screen (ties to collect-and-leave vision + provenance); (c) **staged confrontation framing** — fixed side-on isometric shot for scripted encounters; theatrical legibility without combat (D2 holds; tension is who moves/speaks/backs down). Control during shift: same movement input, camera reframed only.
- **AGENTS.md candidates:** mutual legibility, ghost-of-you reveal, sleep-hike ambiguity rule. *Flag provisional.*
- **Acoustic-world canon candidates (per `acoustic-world-systems-prompt-v1.md`, flag provisional):**
  - **Disarmament contradiction:** the Synod confiscated civilian weapons "to end private violence," then made coercion environmental — language authorizes force, sound enacts it. Guns are rare narrative objects, never player mechanics (D2 holds); a single gunshot is rare and significant.
  - **Ambiguity of compliance (core theme):** a person who kneels cannot determine whether it was choice, fear, habit, imitation, or body-before-mind. Conditioned public choreography (stop / disperse / kneel / face forward / clear streets) emerges from conditioning + fear + physiology + social imitation — never magical mind control.
  - **Sensory punishment:** the institution treats bodily faculties as revocable privileges — euphemisms: *sensory revocation, auditory forfeiture, visual suspension, manual disqualification, civic incapacitation*. Expressed through adaptation, testimony, prosthetics, sign languages, tactile warning systems, protected acoustic spaces — never gore or spectacle. **Affected characters remain complete people with agency and expertise, not storytelling props.**
  - **Creature damage canon strengthened:** the pending acoustic-experimentation proposal now sits on systemic ground — cumulative dose, entrainment, ecological breakdown are simulated phenomena, not backstory. The Synod is not omniscient; sound is not magic. **Continuous-world canon guard (T23):** the one-world build is a *shared engineering world* — one playable space for construction and testing — and does **not** commit the fiction to shared DTA/Dissonance geography. Cemetery stays the deliberate seam; the shared-universe question remains open until the T10 narrative pass resolves Synod geographic scope deliberately.
  - **Lola, mechanical role:** operates inside the voice graph — supplies harmonics, corrects timing, splits voice into layers, derives carriers, suppresses stress markers. Ontology guard extended: **do not assume data-ghost is primary.** The mechanic itself performs the ambiguity — is she filtering your voice, replacing part of it, or speaking through you? A successful disguise may leave the player unsure the accepted voice was theirs. *Status: experimental; do not make ontology explicit early.*

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
- **P8. Playable archive** — the project retraces its own path; superseded implementations (Godot Surveillance Boulevard, the current `dont-turn-around` app) become museum pieces once their concept migrates onto its successor foundation. *(Corrected 2026-07-14, Dan, local trail-viewer session: trail-viewer is the **successor foundation**, not a museum piece — the DTA concept moves onto trail-viewer’s terrain/water/atmosphere/traversal systems, and the present `dont-turn-around` implementation is preserved as the frozen reference instead. This aligns P8 with T23’s DTA-onto-TrailViewer plan, which the prior wording contradicted.)*
- **P9. Baseline world first** — build the ordinary, healthy, inhabited world (ecology, settlements, ordinary voices, ordinary silence) before applying Synod transformations. Wrongness only reads against an established normal. The Synod changes a world; it is not the world's identity.
- **P10. Audible ≠ harmful** — audibility and biological exposure are separate values everywhere. A faint infrasound signal can harm; a loud waterfall can mask without harming. No system may conflate them.

---

## Open decisions (pending Dan's sign-off)

1. **O1. Vertical exaggeration factor** (geo pipeline) — couples to `walkableSlopeAngle` in the navmesh bake.
2. **O2. Tile-based navmesh bake — DECIDED: required** (T23 continuous world + pursuer route cutoffs at reservation scale). Remaining question is bake granularity/tooling only.
3. **O3. Terrain stamps** — ride on the tile-bake decision, or separate?
4. **O4. Isometric camera rule** — experimental; no level design may assume it before sign-off.
5. **O5. First-encounter jump-scare flag persistence** — persisted across sessions (decided in web session, restated for sign-off): first real consumer of `@dta/persistence`.
6. **O6. Bus naming collision — RESOLVED (Dan, 2026-07-14):** D1 names stand (`spatial / ambient-beds / interior / music-synth`); `acoustic-world-systems-prompt-v1.md` conforms to D1 before use. Reopen only with a compelling reason per standing D-series rule — closed, not welded shut.
7. **O7. `SensorProfile` as fourth profile axis** — schema change to the resolved pursuer/mech-dog profile; `pursuer-embodiment-prompt-v1.md` needs a v2 incorporating it before that session runs.
8. **O8. Acoustic-world sequencing vs. audio single-writer** — Phase 1 (pure types) parallel to T3; Phases 2+ queue behind extraction. *Decided in the web session and already stated as settled in T20’s text — restated here for formal sign-off (same pattern as O5), so the doc stops contradicting its own P4.*

---

## Parking lot

- Screenshot capture as state snapshot — serialize camera position/target, exaggeration, palette, generation params to JSON; PNG export as later layer.
- Shadow-as-exposure pursuer mechanic — revisit later.
- **[T11/T14]** Provenance/multiplayer + viewpoint binding — implementation aspirational, explicitly out of scope for current pass (but see lore note: now narratively load-bearing).
- Ambient dread roster: vultures; false-scare roster (vulture burst / live-dog-vs-mech / understory crash) with cry-wolf budget of 2–3 per playthrough, heartbeat+vignette must participate in fakes; first-attack jump scare with persisted one-shot flag, telegraph stagger clip, first-time + toned-down sting variants, sting-ducks-heartbeat named constant.
- Creature behavioral damage canon — pending proposal linking to Synod acoustic experimentation (now also referenced by T-Lola addendum).
- **[T7]** World population; Dissonant Boulevard window occupancy figures (rare silhouettes crossing lit windows — UV-scrolled mask or quads behind glass, ~3 sightings per walk, never reacting; a silhouette that stops and turns is a one-shot scripted beat). Interior sound leaks from lit windows (2D bed, proximity-gated).
- **[T5/T6]** Interior schema pass + reactive environment seam (after embodiment work). Interiors to bracket: liminal mall (long repeating corridors) vs. mausoleum (tight stone) vs. Milo's domicile (`RoomProfile`: acoustics, light sources, anchor props + scatter kits; issued furniture, ration packaging, no sound-making objects; candidate anomaly seed). **Interiors gain a mechanical job (acoustic-world prompt): rooms as diegetic audio processors** — mausoleum reverb, water-tank resonance as `EnvironmentalAudioProcessor` stations in the voice-rig chain.
- **Acoustic persistence roster (from acoustic-world prompt):** cumulative exposure, long-term ecological changes, broken emitters, hacked devices, discovered carrier signals, voice-rig presets, animal route changes, known command patterns, permanent character effects. Versioned schemas; never persist transient DSP params.
- Hold-to-aim throw strength (noted as future knob in throw slice).
- **[T6]** Landscape targets: forest, urban-edge, liminal mall, cemetery, mausoleum, parking lot (dead-commerce exterior; also the DTA hub lot), Milo's domicile. Cemetery = open sightlines + dense low occluders (vision-dominant play); warehouse complex = interior occlusion (hearing-dominant play, surface-typed footsteps).

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
| 9.5 | 2026-07-15 | Merged local trail-viewer session per discrepancy report (local commit `ecc0fd4` predated the web overwrite; re-merged per single-writer rule). P8 corrected — `dont-turn-around` app is the museum piece, trail-viewer is the successor foundation (Dan, direct correction). T21 expanded: Drive mode, WaterPlane, Sun/StarField day–night, fog color, overcast, ThinInstanceTrees (8000 cap), ForestFire, Bounded World, per-level persistence; ViewSnapshot Copy/Load spec + beforeunload/autosave race gotcha (net-new); fast-travel-as-unlock intent; ski/firefight/climb generative insight (→ T6/T23). O8 reworded to O5 pattern (decided, restated for sign-off). T22 stale world-population reference → T23. |
| 9.4 | 2026-07-14 | T23 region system / continuous world added (environments as profile-selected regions in one world; shared transition seam with T5). O2 upgraded to decided-required. T10 continuous-world canon guard added. Spiral collectible placement rule added to T15/T16 (deterministic, trail-snapped, provisional). T5/T6/T7 registry states updated. |
| 9.3 | 2026-07-14 | One-time ID reconciliation. Registry table added; every section/bullet tagged; T1–T17 lineage adopted (T3/T12/T-Lola/T17 precedent honored); new IDs T18–T22; T5/T6/T7/T11/T14 reserved for parked threads; T8 formally retired into T17. IDs are now stable — future threads take T23+. |
| 9.2 | 2026-07-14 | Rigging track upgraded to Dan's authored T17 (four tiers with per-tier feeds, tier-1 failure modes, load-bearing naming convention, Lola one-rig-two-presentations rule). v8 asset queue preserved inside T17; T4/T8 numbering note added pending repo reconciliation. |
| 9.1 | 2026-07-14 | Gap fix: dta-session-notes §1–4 (palette, culvert/mow-line scenarios, concealment-mask/stamp/foliage engineering, FPPOV lighting) were orphaned during the v8 structure adoption — now indexed as a compact active-thread entry; lore pointer broadened. |
| 9 | 2026-07-14 | Wove `acoustic-world-systems-prompt-v1.md` (DDI spine). New master thread (8-layer separation, typed acoustic domain, voice rig/vocoder, mech-dog challenge slice, phases 0–7). Sound-as-control superseded by voice rig (oscilloscope → museum). SensorProfile 4th axis + PerceptualLODProfile on embodiment. Wildlife extension path + specific-wrongness roster. Lore: disarmament contradiction, ambiguity of compliance, sensory punishment, Lola mechanical role. P9 baseline-first, P10 audible≠harmful. O6 bus naming, O7 sensor axis schema, O8 sequencing. Rooms as diegetic processors; acoustic persistence roster. |
| 8 | 2026-07-14 | Reconciled divergent v7s. Restored T12 (was cited by D1 but missing). Added: dog ambiguity ladder (embodiment), asset-queue additions (live dog pair rule, player rig, vultures, stagger clip), route-viz HUD candidate, Godot excavation next-action (stills + 3 timings), isometric camera rule package (O4), O5 persistence sign-off, single-writer conflict rule. Parking lot enriched (false-scare details, window occupancy, RoomProfile). Viewpoint binding flagged narratively load-bearing. |
| 7 | 2026-07-14 | Consolidation. Throw & distraction thread rewritten nonviolent (D2 frozen); melee prompt superseded. D1/D1a recorded. T-Lola addendum, DTA spine, hub structure, playable archive (P8) folded in. Parking lot + open decisions O1–O3 refreshed. |
| 6 | prior | Baseline for this consolidation. |
