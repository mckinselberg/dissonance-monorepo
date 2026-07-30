# emitter-drone-prompt-v1.md

**Thread:** T28 (the emitter / captured drone) — **acquisition only**
**Scope boundary:** the witnessed strike + recovery. The emitter build, the mount, the interference verb, control model, animal-mapping, and loss condition are **explicitly out of scope** (deferred to v2 / T29). This doc must not implement, stub-toward, or assume any of them beyond leaving a clean hand-off marker.
**Depends on:** the weather system's rain mode-swap must exist — in canonical THREADS.md this is the shipped `WeatherSystem` (registered under T21's geo-pipeline work) with precipitation extended under **T25** (atmosphere grading + time-of-day). Do NOT read "T21" here as "time+weather"; in canonical, T21 is the geo pipeline and T25 owns atmosphere/weather conditions. Also consumes a `workshopDiscovered` flag (T32 workshop) as an arm precondition — the flag is set by the workshop-discovery beat (out of scope here); this doc only *reads* it. If the flag source doesn't yet exist, stub it to `true` for isolated testing but do not ship it stubbed.

**Thread ID note:** this scaffold's thread is **T31** in canonical THREADS.md (Interference verb / captured drone), NOT T28. Earlier drafts used T28 before the registry was checked; T28 is Rural-infrastructure backlog in canonical.
**Owning package:** Dissonance app scope + `@culture/weather` (strike event as an authored weather command). No engine fork.

---

## Phase 0 — Audit gate (MANDATORY, before any file is created or modified)

Do not write or edit any file until this audit is complete and its findings are reported back.

1. **Confirm T21 exists and expose its seam.** Locate the weather system (`@culture/weather`, `WeatherProfile`, `WeatherState`, the target-swap / `requestWeather`-equivalent). Confirm rain intensity is a readable scalar and that a storm/rain target can be commanded programmatically. **If T21 is not yet landed, STOP** and report — this doc cannot proceed without it.
2. **Locate the boulevard manifest.** Find where Dissonant Boulevard's authored data lives (the manifest referenced by Lineglass boulevard work and window-occupancy). The `StrikeAnchor` list will be added here as additive data. Report its path and current schema shape.
3. **Locate the drone entity.** Find the existing patrol-drone representation (patrol/pursue `BehaviorProfile`, T13 lineage; emissive dots; read-cone). Confirm a single drone instance can be addressed and driven to a disabled/inert visual+audio state **without** modifying shared drone behavior code. Report how a per-instance state override is reached.
4. **Locate LOS facility.** Determine whether a line-of-sight test (Milo → drone) already exists (detection systems, T5 prior art, pursuer view-cone code). Report it; if none exists, note the cheapest raycast-based approach that does not add a parallel code path.
5. **Locate the audio seam (D1).** Confirm the thunderclap one-shot and the strike-flash-associated audio route through Tone.js on the `ambient-beds` bus, ducked under the heartbeat/sting priority constant (T5/D1). Report the ducking constant name. **Babylon must never play the strike audio.**
6. **Report a written audit** covering all six points, the exact files you intend to touch, and any conflict with the out-of-bounds paths below, **before writing code.**

**Out-of-bounds paths (do not modify):** shared drone behavior code, `@culture/audio` master chain / bus definitions, `applyProfile()` / resolver internals, any pursuer brain code, `EnvironmentProfile` schema. All strike behavior lands as additive data + one authored event consumer.

---

## Objective

Implement a single authored, deterministic-outcome / seeded-location narrative beat: Milo, within line-of-sight of a patrolling boulevard drone, witnesses a lightning strike that disables it; the storm is manufactured as a precondition if the weather is dry; the disabled drone becomes recoverable, and recovery hands Milo the emitter + inert chassis (marked for v2, not built here).

Deterministic in outcome (the beat will happen this playthrough), seeded in place (which anchor, across runs) and timing (wind-up duration within a band).

---

## Assumptions

- T21 exposes a commandable weather target-swap and a readable `rainIntensity` scalar.
- The boulevard manifest accepts additive authored data.
- A single drone instance can be driven to an inert state via per-instance override, no shared-code edit.
- A Milo→drone LOS test is reachable (existing or cheap raycast).
- Tone.js owns all strike audio (D1); the ducking constant exists (T5).

### Art-direction reminder (non-blocking)

- Dan likes the current procedural Boulevard patrol-drone design. Preserve its
  silhouette, proportions, cyan emissive eyes, and ground-projected read cone
  through the T31 acquisition slice.
- **Dan to provide drone concept art later**, before any production-model or
  authored-asset replacement pass. Use it as refinement reference rather than
  treating it as permission to replace the procedural design wholesale.
- Concept art is not a prerequisite for `StrikeGate`, the inert transition, or
  recovery-hand-off implementation.

---

## File / module structure

All new; additive. Adjust paths to match the audit findings.

```
Dissonance app scope:
  data/boulevard/strike-anchors.<manifest-format>   — StrikeAnchor list (authored data)
  systems/strike/StrikeGate.ts                       — the arm/hold/fire state machine + LOS gate
  systems/strike/StrikeAnchorSelector.ts             — seeded pick over eligible anchors
  systems/strike/StrikeEvent.ts                      — commands weather (T21) + drives drone-inert + flash/clap
  systems/strike/DroneRecovery.ts                    — proximity-gated pickup → hand-off marker (v2 boundary)
profiles/ (or T21 profile home):
  strike-constants.<profile-format>                  — named constants (below), tunable in Dev HUD (T2)
```

No changes to engine, resolver, shared drone behavior, or audio buses.

---

## StrikeAnchor manifest schema (data)

Each anchor is authored, not procedural. Minimum fields:

```
StrikeAnchor {
  id: string
  position: Vec3                 // the strike-plausible vertical (light standard / catenary pole / high-tension run)
  patrolDroneRef: string         // which drone's slack circuit passes here
  losProbePoint: Vec3            // point on/near the drone the Milo-LOS test targets (usually drone body)
  eligible: boolean              // author toggle; lets designers retire an anchor without deleting it
  weight?: number                // optional bias for the seeded selector (default 1)
}
```

Author 3–6 anchors along the boulevard at readable, composed sites. The seeded selector picks one per run.

---

## Named constants inventory (all data, Dev-HUD tunable, JSON round-trip)

```
strikeRainThreshold        // rainIntensity at/above which a strike may fire (defines "raining enough")
strikeWindupMinSeconds     // seeded wind-up band, lower bound
strikeWindupMaxSeconds     // seeded wind-up band, upper bound
rainEstablishTimeoutSeconds// safety cap: max wait for manufactured rain to reach threshold before forcing
losRange                   // max Milo→drone distance for the gate to arm
flashIntensity             // strike light-spike magnitude (subtle; overcast/canopy, not strobe)
flashDurationSeconds       // brief
clapDelayFromFlashSeconds  // flash→clap interval (sells proximity; near-zero for an overhead strike)
recoveryProximityRange     // how close Milo must get to the downed drone to recover
droneInertSettleSeconds    // guttering-dots → dead-weight-fall timing (the comic-beat "tag")
```

Seeds: strike **location** seeded off the run seed (stable within a run, varies across runs). Wind-up **duration** seeded within `[min,max]` off the same seed + anchor id (so it isn't a metronome and doesn't transfer across runs).

---

## StrikeGate — state machine (the frozen behavior)

```
States: DORMANT → ARMED → FIRING → SPENT

DORMANT:
  - PRECONDITION: workshopDiscovered flag is set (T30 — the workshop primes the player
    to read the strike; the gate cannot arm until Milo has seen the workshop).
    While workshopDiscovered is false, StrikeGate stays DORMANT regardless of LOS.
  - selector has chosen an anchor (once, at run start, seeded)
  - each tick (only once workshopDiscovered): test Milo→anchor.losProbePoint LOS AND distance <= losRange
  - on first satisfied: → ARMED

ARMED:  (arm-on-entry / HOLD)
  - if rainIntensity >= strikeRainThreshold: begin windup immediately
  - else: requestWeather(storm target >= strikeRainThreshold)   // T21 target-swap, NOT a fork
          wait until rainIntensity >= strikeRainThreshold OR rainEstablishTimeoutSeconds
  - windup = seeded duration in [strikeWindupMinSeconds, strikeWindupMaxSeconds]
  - CRITICAL — HOLD ACROSS LOS LOSS: if Milo leaves LOS during ARMED/windup,
    DO NOT fire and DO NOT disarm. Pause the fire-commit and hold ARMED.
    Resume/fire only when Milo REGAINS LOS to the anchor.
    => the strike always lands witnessed, never wasted, never requires standing still.
  - when windup complete AND Milo currently has LOS: → FIRING

FIRING:
  - flash (light spike, flashIntensity/flashDurationSeconds)
  - clap after clapDelayFromFlashSeconds (Tone.js, ambient-beds bus, ducked)
  - drive patrolDroneRef → inert: emissive dots gutter (not instant-off), read-cone snaps off,
    dead-weight fall + settle over droneInertSettleSeconds (bin-lid landing = the tag)
  - mark drone recoverable
  - → SPENT

SPENT:
  - one-shot; never re-arms this run
  - DroneRecovery now live for this drone
```

**The strike never fires dry** (ARMED guarantees threshold first). **The strike never fires unwitnessed** (FIRING requires current LOS; ARMED holds through LOS loss).

---

## DroneRecovery (the v2 boundary — implement the hand-off, not the verb)

- When Milo enters `recoveryProximityRange` of the inert drone, allow a recovery interaction.
- On recovery: emit a single, clean hand-off event/flag — e.g. `emitterAcquired` + `chassisRecovered` — and nothing more. **Do not** build the emitter, mount, control model, or any interference capability. This flag is the seam v2 consumes.
- Diegetic detail is allowed and encouraged (the warm underside, the scorched read-cone emitter, the emitter working loose) but it is *presentation*, not mechanics. No systems past the flag.

---

## Risks / edge cases

- **Causality reads backwards on replay.** Mitigated by seeded wind-up duration (no metronome) + seeded location across runs (rain-then-strike happens elsewhere next run). Verify both seeds derive from the run seed.
- **Strike fires to an empty street.** Prevented by the FIRING-requires-current-LOS rule; ARMED-hold covers the walk-away case.
- **Manufactured rain never reaches threshold** (weather stalls). `rainEstablishTimeoutSeconds` safety cap forces the threshold or logs and forces the strike — the beat must not softlock.
- **Weather snap.** Do not instant-set rain; use T21's lerped target-swap so manufactured rain still reads ambient (slow build = the comic wind-up). A snap breaks tone.
- **Audio stacking.** Clap must duck under heartbeat/sting priority (D1/T5). Confirm the clap doesn't collide with an active red-throb vignette event on the post-process (compose, don't fight).
- **Flash too bright.** Keep `flashIntensity` subtle — weather through overcast/canopy, not a set-piece strobe. Bright strobing breaks the phone-HDR overcast look (T6.1) and the tone wall.
- **Second drone inspects the downed unit.** For v1, the network does NOT react (the ambiguous non-response is authored per the recovery beat). Ensure no existing detection code auto-dispatches a drone to the inert one during this beat.

---

## Validation steps

1. **Dry-entry path:** approach the anchor with no rain → storm builds (lerped) → strike fires after seeded wind-up → drone gutters and falls → recoverable. Rain never absent at fire time.
2. **Wet-entry path:** approach while already raining above threshold → strike fires after seeded wind-up, no weather command needed.
3. **LOS-loss hold:** enter LOS (arm), walk out of LOS mid-wind-up → strike does NOT fire, does NOT disarm → re-enter LOS → strike fires. Confirm it never fires while Milo lacks LOS.
4. **One-shot:** after SPENT, no re-arm; leaving and returning does not re-trigger.
5. **Seed determinism:** same run seed → same anchor + same wind-up duration. Different seed → different anchor and/or duration.
6. **Recovery boundary:** recovery emits only the hand-off flag; no emitter/mount/verb exists in the build. Grep confirms no interference capability shipped.
7. **Audio:** clap on ambient-beds via Tone.js, ducked; Babylon plays no strike audio.
8. **Dev HUD round-trip (T2):** all named constants tunable and lossless HUD → JSON → committed profile.

---

## Out of scope (do not implement — v2 / T29)

Emitter build · mount on drone · interference verb / `applyDisruption` call · control model (terminal / viewpoint-bind) · animal-mapping (sensing A) · repair pipeline · loss condition · any drone-disables-drone capability. This doc ends at: **Milo witnesses the strike and recovers the emitter + chassis.** Everything after the hand-off flag is a separate session.
