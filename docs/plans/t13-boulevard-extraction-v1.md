# T13 — Godot Surveillance Boulevard PoC: Extraction Doc v1

**Status:** partial analysis pass (screenshot set, 2026-07). Patrol behavior not yet captured in motion — drone was docked at route root in all captures. A video pass of the patrol loop remains outstanding before this doc is complete.

**Rule of engagement:** reference only. No code ports. Everything here is a *seed* routed to an owning thread.

---

## 1. Layout notes (→ T6.2 urban-edge profile)

Observed from captures:

- **Axial boulevard as spine.** Long single sightline with tower verticals flanking. The patrol route runs the axis; the player reads the whole enforcement geometry from street level. Keep this in the Babylon rebuild: legibility of the watcher's territory *is* the level design.
- **Vertical rhythm:** street lamps with spherical caged heads + tower masses. The lamp silhouette (globe-in-cage) is distinctive — carries forward as an urban-edge prop. Rhymes with the catenary-wire vertical rhythm already in T6.2.
- **Emissive windows** in warm amber against teal/black — already consistent with the T6.2 window-occupancy layer. The PoC confirms the read: sparse warm rectangles against dark mass are enough to signal curfewed habitation. No interior geometry needed at range.
- **Wireframe-over-mass aesthetic** (cyan edge lines, dashed ground markings) reads as *the world rendered the way SignalNet parses it* — structure as data. This is provisional canon-adjacent (see §5) but visually it's the PoC's strongest identity and worth preserving as a T6.2 post-process/material direction rather than a placeholder artifact.
- **Milo's building interior** exists: entry door, stair run, landing, unpopulated second floor. Matches the T6.7 domicile shell notes. Zone label transitions ("Open Boulevard" → "Milo's Building / recovery") confirm zone-scoped state, see §4.

## 2. Drone patrol notes (→ T4 BehaviorProfile)

- **Route root is an authored track** (red overlay). Fixed waypoint loop, two-state brain: patrol / pursue. Ambient rounds, not hunting — simplicity is the point and should survive the port.
- **Route visualization toggle** (the red track overlay itself) generalizes into T2: dev HUD renders *any* agent's waypoint/path as an overlay. This is the single highest-value dev-tool extraction from the PoC.
- Patrol-vs-pursue maps onto `BehaviorProfile` cleanly, confirming the Dissonance drone and DTA pursuer share one skeleton.

### 2a. Waveform locomotion (new seed, provisional)

Motion idea, adopted for the Babylon drone embodiment: the drone's flight path is a **sanctioned waveform**. Enforcement hardware moves in pure periodic functions — sterile, legible, endlessly repeating. Its motion is literally renderable on an oscilloscope, which fuses the drone's *body* with the T9 sound-as-control *signal*: path and signal are the same object.

Mechanics (procedural embodiment, T4):

- Perpendicular offset from path tangent:
  `offset = BOB_AMPLITUDE * sin(PHASE_OFFSET + distanceAlongPath * SPATIAL_FREQUENCY)`
- **Distance-parameterized, not time-parameterized** — speed changes must not distort the wave shape.
- Axis swap by tangent frame: horizontal travel → vertical sine; vertical travel (ascending a facade) → lateral sine. Same function, rotated frame.
- All three parameters live in `EmbodimentProfile` as named constants. `BehaviorProfile` may modulate them per state:
  - **patrol:** clean sine, fixed frequency
  - **pursue:** waveform degrades/chirps — frequency drifts up, amplitude tightens
  - **disrupted** (via `applyDisruption`): phase jitter — a drone whose signal is corrupted *moves wrong* before it does anything else. Player-readable interference at a glance.
- T9 hook: a CONTROLLED drone's locomotion waveform entrains toward the player's signal. The oscilloscope UI and the drone's visible motion converge — the tell that control has been achieved is spatial, not just a meter.

## 3. Break-and-hack seeds (→ T4 `applyDisruption`, future mechanics thread)

- **Fault relay** object + "Bring component to relay — Signal n/10" loop: repairing/feeding Synod infrastructure as a player verb. Inverts cleanly: the same interaction grammar (carry component → socket into device) can *sabotage* as easily as restore. One interaction verb, two moral directions, zero new UI.
- **Signal components as collectibles** (music-note pickup observed in iso debug view): fragments of suppressed signal as physical objects. Do not harden the music-note iconography — too literal for shipping Dissonance tone; the PoC placeholder over-states what the fiction should imply. Route the *collect-and-socket* loop forward, not the icon.

## 4. Interior-state / wellbeing HUD (new seed, unrouted — needs a thread decision)

The PoC carries a psych-state panel not currently tracked anywhere in THREADS: **Signal, Coherence, Focus, Energy, Mood, Social Load, Sensory Load, Burnout Risk**, with zone-scoped modifiers (boulevard = neutral, domicile = *recovery*).

Observations:

- This is **Milo's interior state as a resource system** — ambient self-regulation under surveillance. "Regulate" and "Rest" existed as bound inputs (R / E), meaning self-management was a *verb*, not just a meter.
- Zone labels driving state direction (recovery vs. neutral) is the profile pattern at the psychological layer — an `EnvironmentProfile` field family, not a new system.
- Thematically strong: the Synod doesn't need to punish you; it only needs you depleted. Burnout as ambient control. But it's a *large* mechanic with pacing risk (sim-management drift away from atmosphere/restraint).

**Disposition:** log as experimental. Needs its own design pass before any thread claims it. Do not fold into T9 or T5 implicitly.

## 5. Canon-risk register

| Seed | Risk | Suggested status |
|---|---|---|
| Waveform locomotion | Implies SignalNet agents are signal-shaped in physical space — extends isometric-as-surveillance logic to *agent bodies* | provisional (AGENTS.md candidate) |
| Wireframe-as-SignalNet-render | Overlaps the isometric surveillance-view rule (T6 experimental) — two claims about "how SignalNet sees" must not contradict | provisional, resolve alongside T6 camera rule sign-off |
| Wellbeing meters | Big mechanical surface; tone risk (management-sim drift) | experimental, unrouted |
| Component-socket verb | Low risk — interaction grammar only | provisional |

## 6. Outstanding

1. Video capture of the patrol loop in motion (detection trigger + pursue behavior, return-to-route logic).
2. Dan sign-off on which §4 disposition to take (park vs. open a design thread).
3. Fold §2a constants into `pursuer-embodiment-prompt-v1.md` scope when T4 unblocks.
