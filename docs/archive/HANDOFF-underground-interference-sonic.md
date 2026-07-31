# HANDOFF — Underground / Interference / Sonic cluster

> **SUPERSEDED by canonical `docs/THREADS.md` v9.53 on 2026-07-31.** Provenance only; do not execute this build order. The body's underground T32 maps to canonical T35 and its Rey T33 maps to T36; its proposed sonic-semantics T34 was not registered because canonical T34 is Acoustic mech disable. The workshop prerequisite for T31 acquisition was removed. T25/T31 acquisition/T35 Draft 1 and the T36 boundary teaser have landed, Rey Caverns is the working name, and `applyDisruption` has no code stub. Tonal-language work is parked on the unadapted Dissonance Audio HUD repository.

**For:** a local Claude Code session with filesystem + repo access.
**From:** a web design session (design/architecture/lore only — no repo access).
**Canonical reference:** `docs/THREADS.md` v9.49 (registry confirmed; D/O/P tail not readable from web — see ⚠VERIFY tags).
**Companion files in this handoff bundle:** `THREADS-delta-underground-and-interference.md` (paste-ready thread delta), `emitter-drone-prompt-v1.md` (T31 acquisition scaffold).

This document is the single source of truth for everything designed in the session. It is design-complete in places, and deliberately open in others. **Nothing here should be implemented before the Phase 0 audit gate and before the flagged open questions are answered by Dan.** Web sessions do design; this local session has write access — but the open questions below gate real code.

---

## 0. How to read this handoff

- **✅ RESOLVED** — decided, safe to build against (still behind Phase 0 audit).
- **⚠VERIFY** — a reference to a canonical D/O/P number or an existing thread detail the web session could not read; confirm against the local file before relying on it.
- **❓OPEN — DAN** — a design fork the web session did NOT resolve; needs Dan's one-word sign-off before dependent work.
- **📦 DAN SUPPLIES** — code, repos, or assets Dan will provide locally (the web session has no access).

---

## 1. What this cluster is

A single connected arc that spun out of an interference-verb design session, spanning:
- **T31** — the interference verb (Milo captures a lightning-disabled Synod drone, builds an emitter, turns surveillance infrastructure into agency). NEW.
- **T32** — the underground network (an existing sub-terrain layer in the world module, promoted into an authored off-SignalNet stratum) + Milo's workshop (first node). NEW.
- **T33** — the cavern-hub [NAME TBD] + gatekeepers (inhabited pole; a lithophone at architectural scale; a trust economy). NEW.
- **T34** — discordant/consonant sonic semantics (the setting's sound, the alarm's meaning, the game's music, AND a melody-memory unlock mechanic — all one system Dan has already built). NEW — this thread is the biggest surprise and the connective tissue.
- **Extensions** to **T25** (weather: rain/snow/storm), **T21** (Lineglass drone-view), **T29** (Preact terminals + drone control), **T4/T18** (`applyDisruption` first consumer).

**Thread-ID caution:** an earlier draft used T21/T28/T29/T30 for the new threads before the registry was checked — those IDs are OCCUPIED (T21=geo pipeline, T28=rural infra, T29=comms, T30=instanced materials). The corrected IDs are **T31/T32/T33/T34**. The delta file is already re-keyed; do not reintroduce the old numbers.

---

## 2. T31 — Interference verb / captured drone (the emitter)

Full spec is in `THREADS-delta-underground-and-interference.md` §1 and the `emitter-drone-prompt-v1.md` scaffold. Summary of what's decided vs. open:

### ✅ RESOLVED
- **The verb is interference, never violence** (⚠VERIFY D2 nonviolence). Disables/blinds/slips-past, never harms. Dissonance-only (not DTA).
- **Origin = a witnessed lightning strike** disables a Synod patrol drone. One anomaly, three payloads: teaches the principle, provides the chassis, plants the idea. No exposition; anomaly stays unresolved.
- **Strike gate** (frozen for the v1 scaffold): narrative-certain, Milo-proximity-gated, **commands** the weather system (manufactures rain if dry, never fires dry), **LOS-gated**, **arm-on-entry / hold-armed-through-LOS-loss / fire-on-next-LOS**. Location seeded across runs; wind-up duration seeded within a band. Gated behind `workshopDiscovered` (the workshop primes the player to read the strike).
- **Four-layer cost model** (keep as FOUR distinct scalars — do not collapse): acquisition / battery (EM charge, corridor recharge) / wear (paid by hand at the workshop, visible as Lineglass-feed corruption) / emission (SignalNet-legible).
- **Three-part hardware gating:** captured drone + portable terminal + receiver camera. Until all three held, the drone is inert potential. Terminal + receiver gated through T33 gatekeepers.
- **Record-before-fly:** the drone records offline; early = deploy-and-review at the workshop terminal (Milo's job made mechanical); later + receiver = live piloting (T14 viewpoint-binding, first real use).
- **"Maps the animals":** A (sensing) is the coded mechanic; B (imitation) is authored *meaning*, never a system. Precedent: *Inside* stages imitation as discrete set-pieces, not a stat.
- **Repair-pipeline "ride-the-mend" hack:** disabled drones left ~a day are auto-repaired and returned to service — this is the loss condition (re-enter patrol population) AND a hack (address the repair queue, ride your Trojan in). The knowledge-gap (Milo knows, player doesn't) IS the puzzle; delivered by legible interface, never narration.
- **`applyDisruption(kind, magnitude)`** — T31 is the FIRST CONSUMER of the existing T4/T18 stub. Do not redeclare; coordinate the signature.

### ❓OPEN — DAN
- **Control model detail:** misused-authorization (Milo abuses job-granted terminal reach) vs. found credential. Direction is terminal-not-handheld; the *how* is open. Web lean: misused authorization.
- **Recharge source:** utility-corridor proximity (preferred — couples to shipped `UtilityCorridors`) vs. passive tick vs. salvage.
- **Receiver camera:** losable (enables mid-game revocation of Lineglass sight) vs. permanent unlock. Web lean: losable.
- **Salvage-vs-take fork:** one-time choice at the drone vs. returnable later. Web lean: returnable.

### 📦 DAN SUPPLIES (local)
- The existing drone entity / patrol `BehaviorProfile` code (to drive one instance inert without touching shared behavior).
- The shipped `WeatherSystem` + `UtilityCorridors` interfaces (the strike commands weather; poles are strike anchors + recharge).
- The `applyDisruption` stub's current signature (to make T31 its consumer).

### Build-readiness
`emitter-drone-prompt-v1.md` is a complete **acquisition-only** scaffold (Phase 0 audit gate, `StrikeGate` state machine, `StrikeAnchor` manifest, seeded selector, recovery hand-off). It ships against the weather system alone; everything past the recovery hand-off flag is v2 and out of its scope. **One correction already applied:** its weather dependency reads T25/`WeatherSystem`, not "T21 weather."

---

## 3. T32 — Underground network + Milo's workshop

Full thread spec in delta §2. The workshop NODE DESIGN below exists only in this handoff (it was designed in conversation after the delta was written — fold it into a `workshop-node-design-v1.md` locally, or author directly).

### ✅ RESOLVED — the stratum
- Promote the **existing sub-terrain layer** (reachable when the camera clips through the ground) into an authored, off-SignalNet stratum. Pre-Synod infrastructure; dead-zone-as-freedom made spatial; silence-as-syntax gets a geography; camera-as-surveillance extended into a depth axis (surface isometric/watched → deep first-person/unwatched).
- **Authored nodes + procedural corridors.** Two poles: workshop = solitary/dead/inherited; cavern (T33) = inhabited/governed.
- **CANON FLAG HELD OPEN:** whether the Synod knows/can't reach/tolerates/lost the underground — ⚠VERIFY rides T10 Synod-scope. Never resolve.

### ✅ RESOLVED — the workshop (function + narrative)
- Seat of the T31 verb. Off-SignalNet. Counterpart to the domicile (issued/watched above vs. dark/his below).
- **Functions, diegetic, no menus:** inventory-as-room (hardware on benches/shelves IS the inventory screen); maintenance station (T31 wear paid by hand here); review station (deploy-and-review of recorded Lineglass feeds).
- **First-person, and it STAYS first-person** — permanent first-person-ness is the diegetic signal it's off SignalNet (the domicile flips to isometric on a scripted watched-reveal; the workshop never does — hold a one-time flip in reserve as a late-game betrayal only).
- **INHERITED, not built:** a predecessor was here and left. Explains Milo's competence (inherited + completed); makes "what's possible" legible as residue.
- **The residue previews the hardware hunt as archaeology:** an incomplete/dead drone (or its dust-outline) → a drone belongs here; an empty emitter cradle → the shape of what Milo will scavenge; a dark terminal → control is possible; a disconnected receiver bracket → the downlink, the most-clearly-missing part.
- **`workshopDiscovered` gates the T31 strike** — fires when the player has *read the bench* (crossed far enough into the workbench zone that the empty mounts have been seen), not merely entered.

### ✅ RESOLVED — the entrance (crater + consonant alarm)
- **Location:** a separate entrance elsewhere in the world (NOT under the domicile). A **crater** — an unrepaired wound in a state that heals its infrastructure, therefore conspicuously a place the system abandoned (a dead zone). The crater's *cause* stays permanently unresolved (T10).
- **The structure:** a warped, half-collapsed **pre-Synod access structure** (service/utility head-house — the old world's way into its own utility tunnels) at the crater's edge, tilted/damaged by whatever made the crater — which is *why* it's abandoned, unmonitored, AND why its door no longer seals.
- **Concealment:** behind pre-Synod **fence** (old, not Synod-issue — a relic boundary) and **trees** (concealment the player has learned hides interesting things).
- **The alarm:** the door is **ajar**, which is why an alarm sounds — a door-ajar sensor whose circuit never completed. The alarm has been sounding, unanswered, into the one place the system doesn't watch, for an unknown long time. The player is the first thing to answer it. It's the predecessor's trace, still sounding.
- **The alarm is CONSONANT** (see T34) — in a city whose Synod sound is tuned discordant, a consonant alarm is a sound that *shouldn't exist here*; it draws the player the way color draws the eye in a desaturated field (acoustic sibling of the artifact-chroma exception). It's a relic in the old human tuning.
- **Wayfinding funnel (multi-channel, redundant, no markers):** (1) long-range silhouette — the crater zone reads as a break in the boulevard's rhythm; (2) the fence implies an enclosed reason, funnels circling; (3) trees reward looking behind cover; (4) ground evidence — worn path / disturbed litter / footprints-to-nothing (the parked snow-footprint idea repurposed as environmental cluing) — a path leading to a spot with no visible destination, the shape of a hidden entrance; (5) the ajar door + faint warm light-leak confirms. The **alarm carries across distance** as the primary pull (alarms are diegetically meant to be heard, so audible-from-range doesn't break the no-marker ethos). Any one clue is missable; they compound so the attentive player converges.
- **Optional playtest backstop:** if findability fails in testing, gently RAMP clue intensity (draft/alarm presence, light-leak) the longer a player wanders — the world helping without marking. Tuning lever, not built-in from the start.

#### Exterior visual direction — Dan, 2026-07-30

- The crater entrance is an **old fallout/civil-defense shelter door**, hidden
  behind an aging chain-link fence and a dense thicket of trees.
- Reference supplied locally:
  `C:/Users/Daniel/Documents/code/dissonance-related/fallout-ref.png`.
- Carry forward the reference's low, half-buried concrete mass; rounded
  earth-covered roof; cracked/spalled concrete; deep recessed opening; and
  improvised exclusion fence. Do not copy its bright open-field presentation.
- Dissonance version is smaller, darker, wetter, and substantially more
  concealed. The structure should not read as a monumental bunker visible
  from across the map. Players first read fence and thicket, then discover
  concrete massing, then finally resolve the recessed door.
- Use **chain-link**, not military razor/barbed wire. The fence is pre-Synod,
  leaning and locally breached rather than an active security perimeter.
- Preserve the handoff's existing ajar-door and consonant-alarm semantics.
  Exterior concept art is direction for massing/material/concealment, not a
  change to the three-stage acoustic transition.

### ❓OPEN — DAN (entrance)
- **Alarm stops on entry, or persists?** Web strong lean: **stops** — crossing the threshold silences it; the loaded silence + the dead-quiet consonant underground below is the point (also avoids alarm fatigue). Three acoustic states: grating discordant city → consonant call → consonant quiet below.
- **DTA alarm reuse:** sound-only asset reuse vs. **deliberate cross-game acoustic rhyme** (flagged T10, never explained — consonance/dissonance as the shared sonic vocabulary of the whole SignalNet/Dissonance universe). Web lean: rhyme, held loosely.

### ❓OPEN — DAN (workshop interior)
- **Predecessor residue:** functional/interrupted (proven method, sudden unexplained leave — a torch passed) vs. failed/abandoned (a warning). Web lean: **interrupted-but-ambiguous** — reads proven so the player trusts it, but a single staged detail is *slightly, wrongly stopped* (chair pushed back, task mid-step) — torch and warning at once, never resolved.
- **Predecessor ↔ gatekeepers (T33) tie:** seed nothing / faint tie (one object faintly rhymes with the cavern's material or tonal world) / rupture (evidence they were exiled). Web lean: **faint tie** — makes the underground feel like one connected world without resolving anything. NOTE: the entrance's ground-wear already implies "others use this route," which is a faint seed on its own.

### 📦 DAN SUPPLIES (local)
- The existing sub-terrain layer / world-module geometry (the underground's raw space).
- The crater location in the world (Dan identified it as an existing spot — "a crater location where a hidden manhole/door could be seeded behind trees and a fence").
- The shipped domicile / Milo's-building interior (door → 11-step stairwell → second-floor room) for spatial + RoomProfile consistency.
- ⚠VERIFY the `RoomProfile` pattern (acoustic character / light sources / prop population) as proposed under T6 domicile.

### WORKSHOP ROOM — three-zone authoring spec (design-complete, ready to build)
Author as an archaeology the player reads by moving a single warm work-light through the dark, not a lit workspace. RoomProfile: hard enclosed underground acoustics, low room tone, the specific deadness of earth on all sides (this is the first place sound behaves as *yours* — unmonitored, no read-cone). Single low warm work-light, pooling; everything outside its throw stays dark.

- **Zone 1 — threshold (habitation, "someone lived here"):** cot/chair, cold heat source, cup, blanket — off-ration, off-issue personal debris (opposite of the domicile's issued furniture / ration packaging). Establishes the predecessor as a *person* before a *workshop*.
- **Zone 2 — the workbench (the primer — gates the strike):** the four hardware-absence anchors — incomplete/dead drone or its dust-outline + empty mounts; empty emitter cradle; dark terminal (powered-capable, addressing nothing — also the melody-mechanic seed, see T34); disconnected receiver bracket (the most-clearly-missing). Read together = the three-part hardware hunt previewed. `workshopDiscovered` fires on reading this zone.
- **Zone 3 — the wall (the predecessor's mind, ambiguous):** below-language traces of working-out — scratched marks (tallies? schematics? a calendar?), components sorted in a private order, a pinned parts array. Method reads as *proven*; person and fate stay *dark*. The interruption tell lives here or in Zone 2: one thing slightly, wrongly stopped.

**Interior guards:** residue must stay below language (if any object could be captioned, it's too explicit); the predecessor must stay an absence (no portrait, no journal, no named object); the room must not READ as a tutorial (no highlights/prompts — teaching is entirely environmental).

---

## 4. T33 — Cavern-hub [NAME TBD] + gatekeepers

Full spec in delta §3. Summary:

### ✅ RESOLVED
- The underground network's entrance/hub is a cave complex that is ALSO a **lithophone at architectural scale** (real-world seed: Luray's Great Stalacpipe Organ — tuned stone struck by solenoid mallets, enclosed acoustics fill the space). The gatekeepers' domain; Milo must earn/buy trust.
- **FUNCTION, not defiance** (critical anti-cliché guard): the lithophone is USED as signaling/lock/tonal-language, not played in defiant concerts. Music repurposed as utility — the mirror of the Synod turning weapons into surveillance. No nostalgia, no speeches, un-heroic gatekeepers.
- **Trust economy** (NOT a reputation grind): gatekeepers read for authenticity of intent — SignalNet's legibility lens INVERTED (blind to performance the way SignalNet is blind to behavioral perfection, ⚠VERIFY T10). Trust-tiers gate deeper access; the scarce receiver + terminal (T31) are gatekeeper-held.
- Physics stays real (struck stone, solenoids, resonance); power is social/semantic, never supernatural.

### ❓OPEN — DAN
- **Name** — UNNAMED placeholder until a good one emerges. Do NOT use "Luray" in canon.
- **What the gatekeepers WANT** (trust currency = who they are): things from above / silence kept / network maintained / test intent. Web lean: cold mix of the first two (Milo useful *because* still legible above → trust-building is a real tension).

### 📦 DAN SUPPLIES (local)
- Nothing yet — this is design-only until the trust economy is specced. Aspirational: the cave-scale lithophone as endgame instrument (uses T34's sound system at scale).

---

## 5. T34 — Discordant/consonant sonic semantics (THE connective thread) 🆕

**This thread did not exist when the delta was written — it needs a full thread block authored (template below) and registry row T34.** It is the biggest thing to come out of the session because Dan has ALREADY BUILT most of it.

### 📦 DAN SUPPLIES (local) — the owning prior art
- A **repo with a built interval/tuning UI**: click a button, it plays intervals — discordant intervals (tuned to a scale that does not exist, engineered uncanny/ugly against consonance) AND consonant intervals. You can build songs out of it. Controllable through a UI that **can become the Preact/React overlay terminal** (T29 / T21 Lineglass instrument layer). ⚠ CONFIRM WHICH REPO — is this the `audio-art-expo` oscilloscope repo, or a separate interval-UI repo? The web session could not determine this; cite it correctly as T34's owning prior art (like `WeatherSystem`/Lineglass are cited as shipped).

### ✅ RESOLVED — the semantics
- **The Synod's sonic surface is tuned to the discordant, nonexistent scale.** That ugliness is AMBIENT — alarms, drones, interfaces, the city's whole acoustic texture grate by design. Consonance is *absent* on the surface (tuned out, like music was outlawed).
- **Consonance = the sound of the dead zone / underground / from-before.** The player hears "freedom" before they can name it. Dead-zone-as-freedom arrives through the ear.
- **The crater alarm is CONSONANT** — a relic in the old human tuning, sounding in a discordant city; the wrongness that pulls the player is *beauty where none should be* (acoustic sibling of the artifact-chroma exception). This is also the first (unprovable) seed of the gatekeepers' consonant world below.
- **The game's MUSIC and the game's LOCKS are the same instrument in the same tuning system.** The soundtrack passively teaches the mechanic — the player's ear trains for hours on consonant/discordant intervals before any lock demands one. The score IS the tutorial. No line between music, sound design, and mechanic.

### ✅ RESOLVED — the melody-memory mechanic (the player-facing verb)
The player perceives a melody in the world and must reproduce it elsewhere to unlock/pass. In a world where music is forbidden and sound is control, **the key is a melody** — every lock is a small act of the forbidden. Fits: sound-as-control made literal (⚠VERIFY the anti-minigame rule T9/T20 — this must stay multi-dimensional/graded, NOT single-correct-frequency); music-as-subversion; rewards perception + restraint + pattern recognition.

Decided principles:
- **Graded, not binary** (⚠VERIFY `VoiceAuthenticationResult` graded-partial-match philosophy): a partial melody works but *costs* — partial/slow/**noisy** success (emission spike; the Synod hears a botched attempt). Precision rewarded with silence, imprecision with exposure. **Musicianship = stealth.**
- **Two capability tiers as a progression:** memory tier (memorize + reproduce — hard, pure, rewards the musical, stays *clean*) → recording-gizmo tier (a device captures the melody — but recording is contraband, a stored forbidden thing, an emission/legibility risk; trades skill-difficulty for exposure-risk). Same cost-grammar as the T31 interference verb (carrying a recording = carrying evidence).
- **Rarity:** melody-locks guard SIGNIFICANT thresholds (the cavern, deep nodes, the consonant world), never routine doors — scarcity keeps it special and keeps "music is forbidden" meaningful.

### ❓OPEN — DAN (the four mechanic decisions)
1. **Reproduction instrument:** the terminal (your existing interval-UI, stripped down — diegetic, reuses what you built) / a world instrument (cavern-lithophone) / the drone-emitter. Web lean: **terminal is the everyday instrument, lithophone is the endgame instrument** (same mechanic, two scales).
2. **Observation layer (how the melody is perceived, no HUD):** pure ear (hardest) / **ear + Lineglass visualization** (the acoustic-emission viz turns melody into a readable waveform/contour — musical players use ear, observant players read the shape; unifies the sound repo + Lineglass + oscilloscope lineage; gives a difficulty gradient for free). Web lean: **ear-primary, Lineglass-visible.**
3. **Memory vs. gizmo:** tiers vs. **progression** (memorize-only early; gizmo later as a costed crutch). Web lean: progression.
4. **Graded-failure behavior:** confirm partial-match = partial success + noise (not hard fail/retry). Web lean: yes.

### ❓OPEN — DAN (two carried from prior turns)
- **First consonant sound — unsettling or beautiful?** Web strong lean: **unsettling-first** — the discordant-trained ear should find the consonant alarm *wrong* before beautiful, preserving the "why is this here" pull; beauty-as-comfort arrives deeper down. (If Dan wants immediate pull-toward-safety / DTA signal=safety valence, that's the warmer alternative.)

### Load-bearing accessibility guard (design-in-from-start, NOT a patch)
Some players cannot reproduce melodies by ear. Mitigations must be present from the first implementation: the **gizmo tier** (record instead of memorize) and the **Lineglass-visualization tier** (read the shape if you can't hold the sound). Between them, no player is hard-locked by musical ability. Flag as load-bearing.

### Aspirational — retuning as the endgame thesis
If the discordant/consonant systems are parametrically controllable through the terminal, then sound-as-control becomes literal: Milo could *address* the sonic infrastructure — mute an alarm, shift a tone, eventually **retune** a system from discordant toward consonant. The game's named tension (dissonance) becomes an operable parameter; the arc is *moving the world from the Synod's scale back toward the human one*. The interference verb (T31), the melody-locks, and the cavern-lithophone are then revealed as the same operation at three scales. **Park as aspirational** — ship only the consonant-alarm-as-cue and the melody-lock now; record the retuning thesis.

### T34 thread block — TEMPLATE to author locally
```markdown
### T34 — Discordant/consonant sonic semantics 🆕
- Status: provisional (sonic-world + alarm semantics + music-as-score) / provisional (melody-memory mechanic, pending the 4 decisions) / aspirational (retuning-as-mechanic) / experimental (cross-game tuning rhyme, flagged T10)
- Owning prior art: [📦 DAN — the interval/tuning-UI repo; confirm which]
- Setting canon: Synod surface tuned discordant (ambient, engineered-ugly); consonance suppressed on surface, native to underground/from-before. [⚠VERIFY does not contradict existing music-forbidden canon in AGENTS.md]
- Alarm semantics: consonant alarm as relic-in-old-tuning; pull = beauty-where-none-should-be (acoustic sibling of artifact-chroma exception).
- Music = locks: same instrument/tuning; soundtrack passively teaches the mechanic.
- Melody-memory mechanic: key-is-a-melody; graded not binary (musicianship=stealth); memory→gizmo progression (gizmo=contraband/emission cost); rare, guards significant thresholds. Accessibility (gizmo + Lineglass-viz) load-bearing from start.
- Cross-links: T9/T20 (sound-as-control; anti-minigame rule) · T21+oscilloscope (Lineglass viz as observation layer) · T29 (terminal as reproduction instrument) · T31 (emission cost grammar; recording-as-contraband) · T32 (crater consonant alarm = first in-world consonant sound) · T33 (cavern-lithophone = endgame instrument) · T10 (cross-game tuning rhyme; retuning-lore literalness — both HELD OPEN).
- Open: reproduction instrument / observation layer / memory-vs-gizmo / graded-failure / first-consonant-valence (see handoff §5).
```

---

## 6. Extensions to existing threads (apply from delta)

All specced in `THREADS-delta-underground-and-interference.md`:
- **§4 — T25** gains rain/snow/storm as weather CONDITIONS on the shipped `WeatherSystem` (rain raises the noise floor; snow inverts it/lowers it; storm = `ThunderScheduler`, the only new code unit; thunderclap = found masking window). Named constants listed. Needs `weather-conditions-prompt-v1.md`.
- **§5 — T21 Lineglass** gains the drone-view render mode (textures-off wireframe + graticule + acoustic-emission viz; two-layer Babylon+Preact/SVG; wear corrupts the view). ⚠VERIFY Milo's-headphones diegetic-UI justification.
- **§6 — T29** gains the Preact+Signals framework decision (SVG-forward, composited over Babylon) + the drone-control surface (terminal-not-handheld, misused-authorization, piloting = T14 viewpoint-binding) + disabled-drone-as-suppressed-transmission.
- **§7 — T4/T18** note T31 as the first `applyDisruption` consumer.

---

## 7. CONSOLIDATED OPEN-QUESTIONS REGISTER (everything Dan must decide)

Grouped for a single sign-off pass. Web leans given; none are binding.

**T31 interference verb**
1. Control model detail (misused-authorization ✎lean vs. found credential)
2. Recharge source (utility-corridor ✎lean / passive / salvage)
3. Receiver losable ✎lean vs. permanent
4. Salvage-vs-take one-time vs. returnable ✎lean

**T32 entrance + workshop**
5. Alarm stops on entry ✎lean vs. persists
6. DTA alarm: sound-only vs. cross-game rhyme ✎lean (T10 flag)
7. Predecessor residue: interrupted ✎lean vs. failed
8. Predecessor↔gatekeeper tie: none / faint ✎lean / rupture
9. Underground topology: hub-and-spoke vs. maze (interacts with parked compass, T28)
10. Underground "was": layered-palimpsest ✎lean vs. single type
11. **HELD OPEN (T10):** does the Synod know the underground exists? (temperature-setter — do not resolve casually)

**T33 cavern/gatekeepers**
12. Cavern name (UNNAMED until good one emerges)
13. What gatekeepers want (cold mix of above-access + silence-kept ✎lean)

**T34 sonic semantics + melody mechanic**
14. Reproduction instrument (terminal ✎lean / lithophone / drone)
15. Observation layer (ear + Lineglass-viz ✎lean / pure ear)
16. Memory-vs-gizmo: progression ✎lean vs. tiers
17. Graded-failure = partial+noise ✎lean (confirm)
18. First consonant sound: unsettling ✎lean vs. beautiful
19. **HELD OPEN (T10):** cross-game tuning rhyme + retuning-lore literalness (do not harden)

**T25 weather**
20. Scripted time-scrub acceptable? (`setTimeOfDay` shipped/settable)
21. Rain detection-coupling in T25 now vs. deferred to T5 seam

**⚠VERIFY (local file check, not decisions)**
- Next free O-number (to renumber the delta's open decisions into the canonical O-series)
- D2 = nonviolence still
- D1/D1a audio ownership wording (Tone.js owns AudioContext, four-bus, ducking constant name)
- T10 Synod-scope open-question exact wording (so the underground/cavern/rhyme flags point at it precisely)
- The `RoomProfile` pattern's status/shape under T6
- T22 culvert principle (for the symmetric-loss cross-reference in T25 weather)

---

## 8. Suggested local build order

Nothing below the audit gate; decisions above gate dependent code.

1. **Apply the delta** (`THREADS-delta-underground-and-interference.md`) — register T31/T32/T33, author T34 from the §5 template, apply the T25/T21/T29/T4/T18 extensions, renumber open decisions into the O-series. Fix `emitter-drone-prompt-v1.md`'s only lingering reference if needed.
2. **Dan answers the §7 register** (or at least the subsets gating whichever thread goes first).
3. **T25 weather-conditions** first among code (everything strike-related references it) — needs `weather-conditions-prompt-v1.md` (Phase 0 audit + `ThunderScheduler`).
4. **T31 acquisition** via `emitter-drone-prompt-v1.md` (Phase 0 audit; ships against weather alone).
5. **T32 workshop node** (entrance funnel + three-zone room) — needs the crater location + sub-terrain geometry from Dan; author `workshop-node-design-v1.md` from §3 here.
6. **T34 melody-lock** — needs the interval-UI repo confirmed + the four mechanic decisions; the workshop's dark terminal (Zone 2) is the natural first encounter with the reproduction interface.
7. Later/deferred: T31 v2 verb, T29 terminal build-out, T33 trust economy, T34 retuning (aspirational).

---

## 9. Tone reminders (carry into every implementation)
Restrained, precise, suggestive-not-explanatory. No exposition; environment/material/system-response only. Anomalies never disambiguated. No genre-generic resistance (the T33 function-not-defiance guard). Nonviolence held (⚠VERIFY D2). The predecessor stays an absence. Music-is-forbidden stays *meaningful* — every melody played is a risk. Consonance should first read as *uncanny*, not comforting. Silence (the alarm stopping; the quiet underground) is as loaded as sound.
