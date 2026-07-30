# THREADS.md — DELTA (corridor system)

**Apply against local v9.x. Bump revision to next minor. Paste-ready sections below; merge, don't overwrite.**

Summary of this delta: new **T26 Infrastructure corridor** (rail + power + EM-charge, tunnel, climbable pylon, patrol binding); new **T27 Acoustic mech disable** (song-gated, headphone-countered); **T4** gains the dog SensorProfile (dual-sense hunt) + EM-charge dependency on the broken-mech rung; **T9** gains its first real agent target; **T10** gains two load-bearing principles (disarmament-into-infrastructure; EM-charging corridor). Two prior prompts archived per P1.

---

## NEW — T26. Infrastructure corridor (rail + power + EM-charge)

- **Status:** provisional — design landed; implementation gated on Phase 0 sign-off
- **Owning doc:** `rail-and-lines-corridor-prompt-v3.md`
- **Supersedes/archives (P1):** `rail-spine-prompt-v1.md`, `rail-and-lines-corridor-prompt-v1.md`
- **Scope:** one continuous right-of-way across one full world axis — rail spine (graded, cut/fill), high-tension power line (T6.2 pipeline), EM-charge line (T6.2 pipeline, powers patrol mechs), one authored tunnel (terrain-stamp consumer, O1/O2), one climbable hero pylon (vertical exposure beat, knowledge-payload not loot), patrol binding to frozen PATROL/ALERT (T13). All lines share lateral deviation; wires sag over terrain the rail is graded through/around.
- **Packages:** linear-infra package (single-writer) + T6.2 power pipeline (consumed, not modified). Agents package for patrol (single-writer). **Must not touch `@dta/audio` or pursuer internals.**
- **Blocked by:** nothing hard for the surface corridor. Tunnel blocked on O1/O2 (stamp↔navmesh). Patrol embodiment blocked on T4 (binds placeholder meanwhile).
- **Cross-links:** T6.2 (power pipeline reuse), T7 (corridor-clear + exposure gradient, now vertical at the pylon), T4 (patrol embodiment; off-corridor run-down feeds broken-mech rung), T5 (detection seam), T13 (patrol skeleton), T8 (all meshes), T10 (active-vs-derelict fiction), T17 (SurfaceField).
- **Four authored defaults awaiting one-word sign-off (Phase 0):** pylon-payload = knowledge; EM-vestige = retrofit-on-old-telephone-easement; off-corridor-run-down = canon-yes; Tesla-aesthetic = cold/invisible.

## NEW — T27. Acoustic mech disable ("the right song")

- **Status:** experimental — rests on two unresolved canon choices (below)
- **Scope:** corridor patrol mech (T26/T4) is disableable by a player who has *learned* the correct pattern. Performing it (T9 match-score) above `DISABLE_MATCH_THRESHOLD` held `DISABLE_HOLD_DURATION` → new **DORMANT** state (data on the corridor-patrol variant ONLY; pursuer brain never gets it). Recoverable window (`DORMANT_DURATION`), not a kill — nonviolence-safe. Entry point: `applyDisruption('acoustic-desync', magnitude)` (T4 stub). Performing the song spikes player legibility (amplitude = signal) — the tool that clears the corridor lights you up on it.
- **Two open canon choices (need sign-off before hardening):**
  1. **Which song** — Resistance-resolution-as-disruptor (in-tune correctness intolerable to a detuned system; recommended) vs. Synod-password-as-override (closer to T14 possession). Possible two-verb split: resolution *stalls*, password *possesses*.
  2. **Nonviolence framing** — confirm disable = recoverable dormancy, never destruction. (Permanent-disable variant only via the already-broken T4 rung: the song lets it *finally stop* — pathos, not violence.)
- **Blocked by:** T9 port to TS/Tone.js (Godot oscilloscope prompt stale); T3/T4 for the mech.
- **Owning doc:** none yet — needs `acoustic-disable-prompt-v1.md` (under T9 family).

---

## EDIT — T4 (append to Added scope)

- **Added scope — dog SensorProfile (dual-sense hunt, PoC target):** mech dog hunts by **two legible, exploitable senses**. (1) **Audio** — subscribes to player noise-level (the T9/detection-meter amplitude value); movement, foliage-proximity (T7 mow-line), culvert-masking, and the disable-song all feed it. (2) **Vision** — rudimentary, degraded, narrow cone (per T15 "vision degraded, sound/warmth-forward"); surfaced diegetically as a **Lineglass (T19) cyan-outline machine-read** — the dog sees as the Synod sees. Different blind spots → quiet beats audio, break-LoS beats vision, hidden-quiet-spot beats both. **Squeal-inducer (experimental):** when both senses are denied, the dog emits a high-pitch tone designed to induce an involuntary flinch/squeal, *re-generating* the lost noise signature — sound as coercion, forcing expression from a body trying to stay silent. **Nonviolence guard:** targets involuntary reaction/discomfort, never injury; recoverable; no damage model. **Counter = Milo's headphones** (below). This is the **fourth `SensorProfile` axis** flagged as highest-leverage — this design is its spec; write `mech-dog-sensor-prompt-v1.md` (a.k.a. embodiment prompt v2).
- **Added scope — EM-charge dependency:** corridor mechs are charged by the T26 EM-charge line. Off-corridor → run-down/strand. This gives the **broken-mech ladder rung** (rung 4) a *cause*: it wandered off its charging field and never made it back. Pathos with an engineering reason.

## NEW — T18/monitoring adjacent — Milo's headphones as diegetic UI

*(File under T18 voice-rig family or note as its own micro-thread; Dan's call on placement.)*
- **Status:** provisional — strong, low-contradiction canon addition
- **Scope:** Milo monitors his world through headphones; his arc = becoming an audio engineer. This **retro-justifies the entire sound-as-control UI as a diegetic monitoring rig** (the oscilloscope/signal readout is what he sees in his rig — no HUD violation). **Character progression == player skill curve** (T15 mutual-legibility applied to the player's own competence): early Milo hears crudely and gets caught; late Milo reads the spectrum, ducks the squeal-inducer, matches the disable-song cleanly. Headphones are diegetic PPE — a learned filter/duck attenuates the inducer frequency (earned capability, NOT day-one toggle). Open decision: duck fully negates (skill wins clean) vs. only attenuates (noise still leaks — tenser; recommended).

---

## EDIT — T9 (append to Scope)

- **First real agent target:** the abstract "drone" of the oscilloscope prototype becomes the corridor mech (T26) and the mech dog (T4). Match-score output → `BehaviorProfile` DORMANT transition (T27) and → the dog's noise-tracking sense. This is the sound-as-control system finding what it acts *on*.

---

## EDIT — Layer 6 / T10 — two new principles (provisional, load-bearing)

### Principle: Disarmament-into-infrastructure (material basis of the nonviolence pillar)
- The Synod's consolidation included a near-total weapons confiscation; seized materials were repurposed into SignalNet's physical body (emitters, acoustic domain layer, mech chassis, corridor pylons). **Makes D2 diegetic, not just a design rule** — the player has no violent option because the world contains no weapons; they were melted into the infrastructure that now watches. Also explains where a declining civilization got the resources for pervasive acoustic infra, and why *sound* is the only remaining weapon (hence music forbidden; hence Milo's arc). **Discovery-filter governed — inferred through material detail (ground-off serials, repurposed mechanisms, decommissioning stamps), never narrated.** Keep cold/procedural, not gun-grab-allegory. Scale = *effectively* all, not tidy totality.
- **Open fork (T10 pass):** confiscation as **living memory** (someone remembers surrendering something — quiet grief, Resistance recruitment logic) vs. **settled history** (forgotten; just what the pylons are made of, colder/more total). Different games; don't resolve here.

### Principle: EM-charging corridor (supersedes the telephone-line fiction)
- The corridor's second wire line is **not** telephony — it's resonant-inductive (Tesla-lineage) power transmission keeping patrol mechs charged as they traverse. Line + patrol are one system. **Explains why mechs patrol corridors** (that's where their power is) and **justifies off-corridor penalty as run-down** (fiction→mechanic fusion; feeds T4 broken-mech rung). **Vestige (recommended):** EM line retrofitted onto the pre-Synod telephone easement — old poles reused → preserves confiscation stratigraphy AND the ghost of a corridor that once carried human voices, now carrying power to the things that hunt. **Aesthetic: cold/invisible/felt** (low hum, faint skin-charge, faint fog ionization) — never arcing/glowing (camp/steampunk drift = tone violation).

---

## Open decisions — append

5. **T26 pylon payload:** knowledge-unlock vs. craftable resource. *Recommend knowledge (protects frozen T15 boundary).*
6. **T26 EM-line vestige:** retrofit-on-old-telephone-easement vs. purpose-built. *Recommend retrofit.*
7. **T26/T4 off-corridor run-down:** accept mech charging-field dependency as canon? *Recommend yes (load-bearing fiction→mechanic).*
8. **T26 EM aesthetic:** confirm cold/invisible/felt, never arcing/glowing.
9. **T27 which song:** Resistance-resolution vs. Synod-password (vs. both as two verbs). *Recommend resolution; hold password for T14.*
10. **T27 nonviolence framing:** confirm recoverable dormancy, never destruction.
11. **T10 confiscation:** living memory vs. settled history.
12. **Headphone inducer-counter:** full negate vs. attenuate-only. *Recommend attenuate (tenser).*

---

## Integration sequence — note

Add to FLOATING / THEN as appropriate:
```
T26 corridor: surface spine authorable now (Phase 0 sign-off) | tunnel waits O1/O2 | patrol binds placeholder until T4
T27 acoustic disable: paper design now; implementation after T9 TS port + T4
T4 SensorProfile (mech-dog-sensor-prompt-v1 / embodiment v2): highest-leverage next artifact — spec'd this session
```

## P1 archive actions

- Archive `rail-spine-prompt-v1.md` and `rail-and-lines-corridor-prompt-v1.md` (git tag + one-line READMEs) — superseded by v3.
