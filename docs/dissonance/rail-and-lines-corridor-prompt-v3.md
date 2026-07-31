# rail-and-lines-corridor-prompt-v3.md

**Owning thread:** T33 (Infrastructure corridor) — see THREADS delta.
**Supersedes:** `rail-spine-prompt-v1.md`, `rail-and-lines-corridor-prompt-v1.md` (+ patrol delta v2). Archive prior per P1.
**Web-session role:** design/architecture. This doc is a complete handoff to a local Claude Code session.

---

## Objective

Author a single continuous **infrastructure corridor** traversing one full world axis: a rail spine, a high-tension **power line**, and an **EM-charge line** (the resonant-inductive transmission that keeps corridor patrol mechs charged), all resolved from one shared centerline as a coherent engineered right-of-way. Add one **climbable hero pylon** as a vertical traversal/knowledge beat, and one **tunnel** where the rail passes through elevated terrain. Delivered as profile-selected data consumed by the renderer. No bespoke render path; no second code path into the engine.

---

## Assumptions

- Terrain exposes `SurfaceField` (`getHeightAt(x, z)`), per T17.
- `GeoPolyline` is the sole path for linear infrastructure (trails, power lines). Rail, power, and EM-charge lines are all `GeoPolyline` consumers.
- The **power line** reuses the existing T6.2 power-line pipeline (pole placement, catenary sag, corridor-clearing). Do not author a second catenary system.
- The **EM-charge line** replaces the former "telephone line" fiction (v1). It is authored on the T6.2 pipeline too (poles + spanning conductor), differing by constants and fiction, not mechanism.
- Terrain-stamp mechanism (T7 note, open decisions O1/O2) may not be landed. Tunnel consumes it if present; otherwise flags `enclosed` + `// STAMP PENDING O1`. Never fake the tunnel with a deep trench.
- Patrol behavior uses the **frozen PATROL/ALERT `BehaviorProfile`** (T13). This prompt binds it to the corridor; it does not modify the brain.
- Extend-don't-rewrite. Single-writer package rules. All tuning lands as data in `profiles/`.

---

## Phase 0 — Audit gate (MANDATORY, no code)

Report before writing anything. Stop and surface conflicts; Dan signs off; then proceed.

1. **Axis convention** — which of x/z is the traversal axis; sign of world origin; `AXIS_MIN`/`AXIS_MAX`.
2. **Terrain-stamp state (O1/O2)** — has the stamp↔navmesh coupling decision landed? If not, tunnel ships surface-flagged only.
3. **`GeoPolyline` resolver signature** — confirm per-vertex vertical-offset channel exists (needed for cut/fill, tunnel entry, pole bases).
4. **T6.2 power pipeline interface** — pole placement, sag, corridor-clear. Confirm it needs no internal change to serve two wire lines (power + EM-charge) at different constants.
5. **Package ownership** — which package owns linear infrastructure (rail is single-writer there); which owns agents (patrol single-writer there). Declare out-of-bounds paths. **Do not touch `@dta/audio` or the pursuer package internals.**
6. **T4 mech embodiment state** — landed enough to bind patrols? If not, patrols bind to placeholder + `// EMBODIMENT PENDING T4`.
7. **Four authored defaults awaiting sign-off** (carry from design session — confirm or override each):
   - **7a. Pylon payload** = knowledge-unlock / ambient-find, **NOT** craftable resource (protects frozen T15 collectibles boundary). *Default: knowledge.*
   - **7b. EM-line vestige** = retrofit onto pre-Synod telephone easement (old poles reused; preserves confiscation stratigraphy + lost-human-voice ghost) vs. purpose-built. *Default: retrofit.*
   - **7c. Off-corridor mech run-down** = accepted as canon (mech depends on the charging field; leaving it degrades/strands it). This is the load-bearing fiction-into-mechanic. *Default: yes.*
   - **7d. Tesla aesthetic** = cold / invisible / felt (low hum, faint skin-charge, faint fog ionization), **never** arcing/glowing/crackling. *Default: cold.*

---

## Design constraints (data, not code)

### A. Corridor centerline (from v1)

- Ordered control points in world-XZ spanning `AXIS_MIN`→`AXIS_MAX`; lateral deviation on the cross axis bounded by `RAIL_MAX_LATERAL_DEVIATION`.
- Catmull-Rom resample at `RAIL_SAMPLE_SPACING`; enforce `RAIL_MIN_CURVE_RADIUS` — reject configs producing tighter turns; **fail loudly at load** with the offending segment index.
- One lateral deviation is authored to run the centerline into a ridge, guaranteeing the tunnel (below). Author it; don't rely on terrain chance.

### B. Rail vertical (grade-following)

- Rail-head elevation = `getHeightAt` along centerline, constrained by `RAIL_MAX_GRADE` via a smoothing pass (rail cuts and fills; it cannot follow raw terrain).
- Below terrain → **cut** stamp (terrain lowered to rail + `RAIL_CUT_CLEARANCE`). Above terrain → **fill/embankment** (`EMBANKMENT_SLOPE` side slopes).
- Cut depth > `TUNNEL_THRESHOLD_DEPTH` for a run > `TUNNEL_MIN_LENGTH` → promote to **tunnel**.

### C. Tunnel

- Stamp removes/masks terrain along the bore; authored portal transforms at `TUNNEL_ENTRY`/`TUNNEL_EXIT`; affected polyline vertices flagged `enclosed` (renderer skips sky occlusion; audio switches to interior bed — hooks for T5/`@dta/audio`, not built here).
- Rail passes **through**; wires do **not** (see E). If stamp unlanded, emit polyline with `enclosed` span + `// STAMP PENDING O1`.

### D. Corridor cross-section (named offsets from rail centerline)

- `POWERLINE_OFFSET` — high-tension pylons, larger set-back, wide corridor-clear; establishes the far-silhouette vertical rhythm (echoes T6.2 catenary/light-standard rhythm).
- `EMCHARGE_OFFSET` — the charge line hugs the rail closer (it powers the mechs *on* the rail). Small, constant offset. If retrofit (7b), its poles are the pre-Synod easement poles — author them as older/leaning where derelict variant applies.
- All lines share the corridor's **lateral deviation** (curve the rail, curve the corridor). Wires do **not** follow rail grade — they span between supports and sag, ignoring small undulation. Poles/pylons each stand on their own `getHeightAt`.

### E. Wire lines (power + EM-charge, both via T6.2)

- **Power:** `POWERLINE_SPAN_SPACING` (long spans), `PYLON_HEIGHT`, `POWERLINE_SAG_FACTOR` (low sag, high tension), corridor-clear radius.
- **EM-charge:** `EMCHARGE_SPAN_SPACING` (shorter), `EMCHARGE_POLE_HEIGHT`, `EMCHARGE_SAG_FACTOR`. Fiction: resonant-inductive transmission keeping patrol mechs charged along the corridor. **Aesthetic per 7d — no arcing/glow.** Optional player-legible field hook (`EMCHARGE_FIELD_READABLE` flag) for Milo's monitoring rig to perceive; emit as data only, no visual here.
- **Tunnel handling:** both wire lines terminate at a `LINE_TERMINATION` anchor structure before the portal and resume past the exit — authored gap, not glitch. `POWERLINE_OVER_RIDGE` flag (default on): power line climbs over the ridge the rail tunnels through (it sags between tall supports, doesn't care about grade) — cheap environmental storytelling justifying the tunnel (rail *had* to go under; the line didn't). Termination structures → T8 manifest.

### F. Climbable hero pylon (vertical beat)

- One oversized pylon at authored `HERO_PYLON_POSITION` on the power layer. Ladder/climb affordance up authored attach nodes at `LADDER_SPACING`.
- **Payload per 7a — knowledge-unlock, not resource.** Reaching height reveals (i) a long corridor sightline (navigation/legibility reward) and (ii) a diegetic close-read of the charging system — a component stamped with a ground-off serial (confiscation stratigraphy), which unlocks Milo's *understanding* of how mechs are charged (capability/knowledge flag, not inventory). No stackable parts. No crafting.
- **Vertical exposure gradient:** a lit/high pylon is maximally legible — a patrol below can read the climber against the sky. Climbing trades concealment for sightline. Ties to T7 exposure-corridor logic, made vertical. Failure state is environmental (fall / exposure), never combat — the dog does not knock you off.

### G. Patrol binding (frozen PATROL/ALERT)

- Patrol route = corridor centerline sampled at `PATROL_WAYPOINT_SPACING`. `PATROL_COUNT` single-digit across a full-axis corridor — **ambient rounds, not saturation** (T13: simplicity is the point). `PATROL_SPEED`, `PATROL_INTERVAL`.
- Two states only. **ALERT** returns to route after `ALERT_TIMEOUT` — no learning, no resolves-toward-player (provably distinct from the T15 primary pursuer).
- **Rail bed = fast lane.** Off-corridor movement penalized (slower/awkward) — and per 7c also *strands the mech from its charging field* (degradation over time off-corridor; feeds the T4 broken-mech ladder rung). `PATROL_DWELL` at authored junctions (terminations, portals) gives readable cadence without extra AI.
- Detection feeds the **existing** T5 seam (fog/heartbeat/vignette). No parallel detection or audio path.
- Tunnel beat: author one patrol timing so a mech is plausibly *in* the tunnel on player approach (near-miss valve, release if timing misses — T4 false-scare grammar). `TUNNEL_STATIONING` flag (default off): a mech stationed at a portal = checkpoint / transit-is-legible read.

---

## Deliverables

1. `profiles/infrastructure/rail-lines-corridor.json` — control points; all named constants (below); tunnel params; hero-pylon position + payload flag; termination/over-ridge flags; corridor-clear width; EM-field-readable flag.
2. `profiles/behavior/corridor-patrol.json` — route binding, speed/interval/count, detection params, dwell nodes, tunnel timing/stationing flags, off-corridor run-down params.
3. **Resolver** `CorridorProfile` → rail polyline (elevation + `cut`/`fill`/`enclosed` classification) + power-line input to T6.2 + EM-charge-line input to T6.2 + combined corridor-clear mask + hero-pylon transform + patrol route/dwell waypoints. Pure data-in/data-out; renderer-agnostic.
4. **T8 manifests:** pylons (if not from T6.2), EM/power poles, line-termination structures, tunnel portals, hero-pylon ladder nodes.
5. Archive README per P1 (supersedes v1/v2).

## Named-constants inventory (author starting values in the session; all live in profile data)

`AXIS_MIN` · `AXIS_MAX` · `RAIL_SAMPLE_SPACING` · `RAIL_MAX_LATERAL_DEVIATION` · `RAIL_MIN_CURVE_RADIUS` · `RAIL_MAX_GRADE` · `RAIL_CUT_CLEARANCE` · `EMBANKMENT_SLOPE` · `TUNNEL_THRESHOLD_DEPTH` · `TUNNEL_MIN_LENGTH` · `POWERLINE_OFFSET` · `POWERLINE_SPAN_SPACING` · `PYLON_HEIGHT` · `POWERLINE_SAG_FACTOR` · `EMCHARGE_OFFSET` · `EMCHARGE_SPAN_SPACING` · `EMCHARGE_POLE_HEIGHT` · `EMCHARGE_SAG_FACTOR` · `CORRIDOR_CLEAR_WIDTH` · `HERO_PYLON_POSITION` · `LADDER_SPACING` · `PATROL_WAYPOINT_SPACING` · `PATROL_COUNT` · `PATROL_SPEED` · `PATROL_INTERVAL` · `PATROL_DWELL` · `ALERT_TIMEOUT` · `OFFCORRIDOR_RUNDOWN_RATE`

---

## Acceptance criteria

- Line continuous edge-to-edge on the traversal axis; no gaps at resample joins.
- No segment violates `RAIL_MAX_GRADE` / `RAIL_MIN_CURVE_RADIUS`; violations throw at load with segment index.
- ≥1 authored tunnel with portals both ends and `enclosed` vertices between.
- All three lines share lateral deviation; none drifts off the right-of-way. Poles/pylons each on own terrain height; wires sag between supports, never intersect ground on flat spans.
- Both wire lines terminate before the portal and resume after; no wire enters the tunnel; over-ridge power crossing renders if flagged.
- One combined corridor-clear mask (no triple overlap).
- Hero pylon climbable to top; reaching top emits the knowledge-unlock flag (not an inventory item).
- Patrols follow corridor edge-to-edge incl. tunnel; off-corridor visibly penalized and (7c) triggers run-down; exactly two states; ALERT returns after timeout — provably distinct from pursuer brain.
- Detection feeds existing T5 seam; no new detection/audio path.
- Deterministic, hash-stable re-runs (FNV-1a resolver-input convention). Round-trips through Dev HUD (T2) losslessly if exposed.

## Out of scope (declare and hold)

- Rail/wire/pole/pylon **meshes** and materials — T8.
- Rolling stock; any moving train; physics.
- **Crafting / resource systems** — pylon payload is knowledge, not parts (7a).
- Energized behavior beyond hooks (EM hum audio, field-read visualization) — `@dta/audio`/T5/monitoring-rig own these; emit data only.
- **Acoustic mech disable / squeal-inducer / dog SensorProfile** — separate threads (T9 / T34 / T4 SensorProfile). Corridor exposes the *hooks* (`applyDisruption` entry, detection seam); it does not implement them.
- Luring mechs off-corridor as a player verb — the run-down *fiction* lands here; the *verb* is a future mechanics thread.
- Navmesh coupling of the tunnel stamp (O1/O2, upstream).
- Second corridor, branch, junction.

---

## Canon note (for the session's awareness; do not author fiction into code)

The corridor is the Synod's metabolism made visible — transit, power, and mech-charging bundled into one legible, watched artery, with the tunnel as its one blind span. Its materials descend from the disarmament principle (confiscated arms → surveillance infrastructure). Active-Synod vs. derelict-SMR are `CorridorProfile` **variants** (leaning poles, snapped conductors, forest reclaiming the cleared right-of-way, stranded run-down mechs) resolved as data — do not resolve in code. Keep the EM aesthetic cold and affectless (7d). These fictions are provisional pending the T10 pass; author *toward* them, don't harden them.
