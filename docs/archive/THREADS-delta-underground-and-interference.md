# THREADS.md delta — Underground & Interference cluster

> **FOLDED into canonical `docs/THREADS.md` v9.53 on 2026-07-31.** Retained for provenance only; do not execute or use as current status. The body preserves this delta's then-proposed IDs: its T31 maps to canonical T31, its underground T32 maps to T35, and its Rey T33 maps to T36. Its proposed sonic-semantics T34 was not registered because canonical T34 is Acoustic mech disable. Several claims below were superseded by shipped work and reconciliation—notably `applyDisruption` is documentation-only (no code stub), the workshop prerequisite for T31 acquisition was removed, T25/T31 acquisition/T35 Draft 1/T36's boundary lurker have landed, Rey Caverns is the working name, and inhabited-space/tonal-language work remains gated.

**Re-keyed against canonical v9.49 registry (2026-07-29).** The earlier draft used thread IDs (T21/T28/T29/T30) already occupied in the canonical file. Per the registry rule *"IDs are now stable; do not renumber,"* the three genuinely-new threads take the next free IDs **T31 / T32 / T33**; everything else folds into existing threads as **extensions**.

## ⚠ Verification notes before applying
- **D/O/P numbers** sit below where the fetch could read. Every reference is tagged **⚠VERIFY** — confirm the number against your local file before applying. Anchors used: **D1/D1a** (audio: Tone.js owns AudioContext, four-bus), **D2** (nonviolence), **P-series** (extend-don't-rewrite; Phase-0 audit gate; single-writer), **T10 Synod-scope** open question.
- **Package scope:** canonical repo is `@dissonance/*` (no `@dta/*`). All references below use `@dissonance/*`.
- **`applyDisruption`:** already a real stub (T4 hacked-mech ladder) + named future-hook (T18). T31 is its first *consumer* — coordinate the signature, don't redeclare.
- **Mech dog:** already partly in code (T21 `mechDog` toggle + in-progress pursuer; T4 owns the ladder). T31's captured drone is a *different* entity (repurposed patrol drone, urban), not the DTA mech-dog pursuer.

---

## Corrected mapping

| Designed concept | Canonical home | New / extension |
|---|---|---|
| Interference verb / captured drone / emitter | **T31** | NEW |
| Underground network (stratum) | **T32** | NEW |
| Cavern-hub [NAME TBD] + gatekeepers | **T33** | NEW |
| Milo's workshop | child of **T32** | NEW (under T32) |
| Rain / snow / thunder conditions | **T25** (+ shipped `WeatherSystem`, T21) | EXTENSION |
| Storm-disables-drone strike beat | **T31**, commands T25 weather | NEW (in T31) |
| Lineglass drone-view + acoustic viz | **T21** Lineglass layer | EXTENSION |
| Preact terminals + drone control | **T29** (diegetic comms/terminal) | EXTENSION |
| `applyDisruption` interference | **T4** + **T18** (existing stub) | EXTENSION (first consumer) |
| Repair-pipeline "ride-the-mend" hack | **T31** sub-mechanic | NEW (in T31) |

---

## 1. NEW — T31. Interference verb / the captured drone (the emitter)

Registry row: `| T31 | Interference verb / captured drone (emitter) | experimental — Dissonance-only, design only |`

```markdown
### T31 — Interference verb / the captured drone (the emitter) 🆕

The player's one verb that isn't running or hiding: **interference, never violence** (⚠VERIFY D2 holds — an interference/disabling option, never a weapon). Milo captures a disabled Synod patrol drone, builds a crude emitter, and turns surveillance infrastructure back into an instrument of agency — a skeleton key made from the lock. First real consumer of the `applyDisruption(kind, magnitude)` stub (T4/T18).

- **Scope boundary:** **Dissonance-only** (Milo, urban, drones). DTA pursuer's world stays pure prey. Distinct from the in-code mech-dog pursuer (T4/T21).

**Origin beat — the witnessed strike (provisional):**
- A lightning strike disables a Synod patrol drone in Milo's presence. One anomaly, three payloads: teaches the interference principle (EM transient drops a drone); provides the chassis (recoverable); plants the idea (infrastructure can be *taken*). Environment + system response only — no dialogue, no log. Random / already-failing / arranged stays **unresolved** (⚠VERIFY anomaly rule, T10).
- **Strike gate (frozen for v1 scaffold):** narrative-certain, **Milo-proximity-gated**, *commands* the weather system (T25/`WeatherSystem`). Rain is a manufactured precondition — raining → fire; dry → start storm, let it establish, then fire. **Never fires dry** (keeps EM physics legible, preserves ambient tone). Witness gate = **line-of-sight to the drone**. **Arm-on-entry / hold-armed / fire-on-next-LOS:** arms on LOS entry; leaving LOS HOLDS the armed state; fires on LOS regain — always witnessed, never wasted, never requires standing still. Location seeded across runs; wind-up duration seeded within a band.
- **`StrikeAnchor` manifest (data):** eligible sites in boulevard `locations.json`-style data — patrol points passing a strike-plausible vertical (light standard or **utility-corridor pole**, T21's shipped `UtilityCorridors` — hands the recharge-fiction tie for free). Seeded selector picks among eligible anchors.
- **Workshop-gates-strike:** the gate cannot arm until `workshopDiscovered` (T32 workshop primes the player to *read* the strike).
- **Owning scaffold:** `emitter-drone-prompt-v1.md` (acquisition only — EXISTS; needs one edit: its weather dependency is **T25/`WeatherSystem`**, not "T21 weather" — in canonical, T21 is the geo pipeline).

**The verb (v2 — deferred):**
- Milo builds a crude emitter (hand-scale imitation of the strike; sourced from the dead drone + utility-corridor EM fiction), mounts it on the recovered drone → mobile interference platform: disables *other* drones, maps guard-fauna to open a path. Disables/blinds/slips past, never harms.
- **`applyDisruption` is the call:** `kind` = sensor flicker / audio-channel jam / brief patrol-read corruption; `magnitude` = decaying EM charge. First consumer of the existing stub — coordinate with T4/T18.
- **"Maps the animals" — A-mechanic / B-meaning:** **A (sensing)** = the mechanic (drone reads guard-fauna via Lineglass vision cam + audio-tracking channel; surfaces routes as predictable outlines for timing). **B (imitation)** = the meaning, never coded (SignalNet blind to behavioral perfection — ⚠VERIFY T10 imitation principle — so a drone moving exactly like mapped fauna reads as fauna; player experiences A, world supplies B). **Precedent:** Playdead's *Inside* stages imitation as discrete authored pass-inspection set-pieces (march-in-step), never a persistent stat — keep imitation as authored moments.

**Four-layer cost model (four distinct scalars — do NOT collapse; they pull different directions):**
1. **Acquisition** — hold all three parts yet (drone/terminal/receiver). Progression cost.
2. **Battery / EM charge** — this outing; flying + disrupting drain it; recharge = utility-corridor proximity (couples to T4 broken-mech run-down).
3. **Wear / maintenance** — this drone's lifespan (actuator drift, read-cone flicker, **view corruption visible in the Lineglass feed, no HUD**). Paid by hand at the workshop. Wear past a threshold is the on-ramp to the repair-pipeline hack.
4. **Emission / legibility** — this moment's risk; every activation is SignalNet-readable; use it briefly.
Net: expensive to assemble, run, maintain, deploy. Never free.

**Three-part hardware gating (replaces "one controller"):** (1) **captured drone** (records + flies; storm beat, early); (2) **portable terminal** (addressing/control + review — the Preact terminal, T29); (3) **receiver camera** (live downlink to *see* the Lineglass feed — **hard to come by**, the pacing lever). Until all three held, the drone is inert potential. Terminal + receiver gated through the gatekeepers (T33).

**Record-before-fly (staged):** the drone **records offline without the receiver.** Early = deploy-and-review (send blind, return to workshop, review recorded feed — **Milo's job made mechanical**; the drone is a work tool before a flight tool). Later + receiver = live feed + real piloting (**viewpoint-binding through a console → T14's first real, non-aspirational use**). *Read the past → see the present.*

**Salvage-vs-take fork:** **salvage** (receiver + emitter, leave chassis) = fast, low-exposure, but the chassis is what the repair pipeline collects; **take it all** (whole drone → workshop) = slow, legible, but permanently yours. Player authors the downstream path.

**Repair-pipeline hack — "ride-the-mend" (experimental sub-mechanic):**
- The Synod auto-repairs disabled infrastructure (~a day or two) and returns it to service, indifferently, without hunting Milo. This is the **loss condition** (a lost drone re-enters the patrol population — texture, not a cheap respawn) AND a seam.
- **The hack:** if Milo can address a drone (T29 terminal), he can address the **repair queue** — leave a unit to be "repaired," ride the pipeline into unreachable infrastructure. **Hack the system by letting it fix your Trojan.** Imitation principle (T10) applied to infrastructure.
- **The knowledge gap IS the puzzle:** Milo plausibly knows the pipeline; the *player* doesn't. Milo **never narrates knowledge the player hasn't earned**. Layer 1 perception (notice disabled drones vanish + reappear intact, infer a pipeline); layer 2 exploitation (realize it can be addressed). Player closes the gap by catching up to Milo's system-literacy (his job-familiarity surfaces as legible interface — a Lineglass tag reading "this will be collected" — not words). The system's *patience* (heals, doesn't retaliate) is more unsettling than pursuit — no vengeful-network drift.

**Tension guards (never a power fantasy):** non-lethal, short-range, unreliable, charge-bound, self-incriminating, precious. Feel = defusing, not hunting.

- **Cross-links:** T4 (`applyDisruption`; hacked-mech ladder; drone = repurposed patrol body) · T18 (`applyDisruption` future-hook; noise grammar) · T21 (utility poles = strike anchors + recharge; boulevard drones; Lineglass feed) · T25 (strike commands weather) · T29 (terminal control; disabled-drone-as-suppressed-transmission) · T14 (piloting = viewpoint binding, first real use) · T10 (imitation; anomaly rule) · T32 (workshop = seat of verb, gates strike) · T33 (gatekeepers gate terminal + receiver).
- **Depends on:** T25/`WeatherSystem` (strike, v1); T4/T18 `applyDisruption` (verb); T29 (control); T32 workshop (gate).
- **Status:** experimental — design only. v1 acquisition scaffold exists.
```

---

## 2. NEW — T32. The underground network (stratum — parent)

Registry row: `| T32 | Underground network (stratum — parent; contains workshop) | provisional (concept) / experimental (impl) |`

```markdown
### T32 — The underground network (stratum) 🆕

- **Status:** provisional (concept) / experimental (impl) — parent thread; contains the workshop.
- **Origin:** the world module already has an **existing sub-terrain layer** reachable when the camera clips through the ground without collision. T32 promotes that found geometry into an authored place — worldbuilding on existing geometry, not build-from-zero.
- **Concept:** a literal underground stratum beneath the Dissonant Boulevard — the unmonitored, **off-SignalNet** substrate of the surveillance city. Surface = SignalNet's domain; underground = the negative space made into a place: the dead zone as a whole stratum, not scattered pockets. The pre-Synod infrastructural layer (utility tunnels, transit, service corridors; the utility-easement ghost already in T21's `UtilityCorridors`) — the body of the civilization before the surface became a watching machine. History you can walk through.
- **Thematic load (provisional but strong):** signal-coverage-as-geography made spatial (dead-zone-as-freedom gets its base stratum) · silence-as-syntax gets a geography (sound below is enclosed, unmonitored, *yours* again — ties to T9/T20) · **camera-as-surveillance extended into a depth axis** — surface = isometric surveillance read (⚠VERIFY isometric-surveillance camera rule, T6/T10), deeper = first-person, unwatched; **pairs with the domicile beat** (domicile stays first-person until a one-shot isometric reveal that home is watched; the underground is the inverse — descending *out* of legibility into first-person dark; the vertical axis IS the crossing between watched and unwatched) · history-as-curated-artifact inverted (the Synod abandoned the underground; decay-as-freedom, contrast T31's repair pipeline where the surface heals itself).
- **Structure:** **authored nodes + procedural corridors** — key rooms hand-authored (workshop, T33 cavern-hub, future nodes); the network between them generated along pre-Synod infrastructure logic (⚠VERIFY consistent with the runtime/data-hybrid placement resolution under T23/T7, 2026-07-27 — runtime placement, not offline manifest).
- **Two poles:** the **workshop** = *solitary* pole (dead, inherited, one predecessor's residue); the **T33 cavern-hub** = *inhabited* pole (communal, governed). The stratum ranges between them.
- **Tension guard:** an underground that is pure safe freedom drains tension — it needs its own dangers (structural hazard; the ambiguity of Synod awareness; and/or things down there that aren't the Synod). Not a cozy haven.
- **CANON FLAG — HELD OPEN:** a whole free stratum says something about Synod control limits — ⚠VERIFY rides the **T10 Synod-scope** open question. **Never resolve** whether the Synod can't reach it / chooses not to / has written it off / lost control. Existence is provisional; the Synod's relationship stays dark — this sets the temperature of every room.

**Child node — Milo's underground workshop (provisional; first authored node):**
- Seat of the T31 verb. Private, underground, **off-SignalNet** — the one place Milo is not watched; dead-zone-as-freedom as a base. Counterpart to the domicile (issued/watched); the workshop is dark/his.
- **Functions, diegetic, no menus:** assembly + storage of the three-part hardware (**inventory-as-room** — drone on a bench, receiver on a shelf, terminal on a table IS the inventory screen); **maintenance station** (T31 wear paid here by hand); **review station** (deploy-and-review — read what the drone saw, before the receiver enables live field review).
- **`RoomProfile`** (⚠VERIFY room-scale profile exists/proposed under T6 domicile): hard underground acoustics, single work-light, material density of forbidden work. Zero exposition.
- **Workshop-gates-strike (RESOLVED sequencing):** finding the workshop precedes + gates the T31 storm beat — its residue shows "what might be possible, based on what's been left," giving the frame to read the strike without exposition. `StrikeGate` gains a `workshopDiscovered` precondition (edit already in `emitter-drone-prompt-v1.md`).
- **INHERITED, not built (provisional):** someone was here before Milo and left. Explains how a data-sanitation clerk knows any of this (competence inherited + completed); seeds a **predecessor**; makes "what's possible" design-legible as residue (incomplete rig → drone, empty mount → emitter, dark terminal → control, disconnected receiver → downlink — the room previews the three-part hunt as archaeology).
- **Predecessor — EXPERIMENTAL:** unnamed prior operator. **Show, not tell** — no note, no log. Legible *method*, ambiguous *person/fate*. ⚠VERIFY flag against **T10** (implies others have resisted). May tie to T33 gatekeepers (one of them / exiled / unknown) — do not resolve. **OPEN FORK:** functional/interrupted (proven method, sudden unexplained leave — torch passed) vs. failed/abandoned (warning as much as primer). Lean: interrupted-but-ambiguous (reads proven so the player trusts it, but the interruption is slightly wrong — chair pushed back, task mid-step — torch and warning at once, never resolved).

- **Cross-links:** T31 (verb's home; workshop gates the strike; salvage/repair) · T33 (inhabited pole; predecessor tie) · T21 (utility easement continues underground; the sub-terrain geometry is the world module) · T6 domicile (watched-above/unwatched-below pair; inventory-as-room; RoomProfile) · T9/T20 (sound unmonitored below) · T10 (Synod scope) · T14 (depth = first-person, unwatched).
- **Owning doc:** needs `underground-network-concept-v1.md` (topology, diegetic entrance, corridor rules) before authoring nodes past the workshop.
```

---

## 3. NEW — T33. Cavern-hub [NAME TBD] + gatekeepers (inhabited pole)

Registry row: `| T33 | Cavern-hub [NAME TBD] + gatekeepers (inhabited pole) | provisional / aspirational (lithophone) |`

```markdown
### T33 — THE CAVERN-HUB [NAME TBD] + the gatekeepers 🆕

- **Status:** provisional (concept) / aspirational (lithophone as playable endgame). Child of T32 (inhabited pole opposite the workshop's solitary pole).
- **Name:** deliberately UNNAMED — working label **THE CAVERN-HUB [NAME TBD]**. Do NOT borrow "Luray" in canon (real, named, privately-owned site). Luray is inspiration/structure only.
- **Concept:** the entrance to the underground network (T32) is a cave complex that is *also*, secretly, a **lithophone at architectural scale** — tuned stone (real-world seed: Luray's Great Stalacpipe Organ — a lithophone: console wired to solenoid-fired rubber mallets striking ~37 naturally-formed stalactites tuned to pitch across 3.5 acres; enclosed acoustics carry the sound through the whole cavern). The **gatekeepers'** domain. Milo cannot simply enter — he must **gain or buy their trust.**
- **FUNCTION, not defiance (critical anti-cliché guard — ⚠VERIFY against the negative-instructions "no genre-generic resistance" rule):** the lithophone is NOT played in defiant concerts of forbidden music. It is *used* — signaling system, lock, tonal language — because sound underground is unmonitored and enclosed acoustics carry struck-stone tones everywhere. Music repurposed as *utility*, stripped of original meaning — the mirror of the Synod turning weapons into surveillance (D2's diegetic basis). Above: tools became watching. Below: music became utility. Both cold, both stripped. No nostalgia, no speeches.
- **Deep origin/apex of sound-as-control (T9/T20):** the cavern is where sound-as-control *predates* Milo, practiced at a level he can't yet read. The gatekeepers speak a tonal language; earning trust is partly *learning to hear it*. Ties the voice-rig/oscilloscope lineage (T20; audio-art-expo heritage) to a diegetic origin.
- **Gatekeepers — trust economy (the spine):** NOT a reputation grind. Trust proven by *what Milo brings and how he behaves*, read through the legibility lens but **inverted from SignalNet** — the Synod watches for **deviance**; gatekeepers watch for **authenticity of intent**, and are **blind to performance** the way SignalNet is blind to behavioral perfection (⚠VERIFY T10 imitation, inverted). Can't fake trustworthiness; get in by being legibly useful and *unwatched*.
- **Trust gates progression diegetically:** trust-tiers unlock deeper access. The T31 hardware hunt routes through them — the scarce **receiver** and **terminal** are gatekeeper-held, not looted from a crate. Fuses hardware-gating with the trust economy.
- **Un-heroic tone:** wary, transactional, possibly unpleasant; sound used practically. They value Milo partly *because* he's still legible above (moves in the watched world, brings things back) — the tension: the surface-connection that makes him useful also makes him a risk.
- **Physics real:** struck tuned stone, solenoids, mallets, resonance. Power is social + semantic (language, lock, signal), never supernatural. No sound-magic.
- **Aspirational apex:** the cave-scale lithophone as an endgame instrument where sound-as-control mastery goes spatial + enormous. Park as aspirational.
- **CANON FLAGS:** (a) an *inhabited* underground the Synod doesn't control puts the ⚠VERIFY **T10 Synod-scope** question under real pressure — keep ambiguous (can't reach / tolerates as pressure valve / written off; never confirm). (b) Function-not-defiance guard = above. (c) Name it before hardening.
- **Cross-links:** T32 (parent; inhabited pole) · T31 (receiver + terminal via trust) · T9/T20 (sound-as-control origin; voice rig) · T10 (imitation inverted; Synod scope) · workshop predecessor (possible tie, unresolved).
- **Owning doc:** folded under T32's concept doc initially; its own once the trust economy is designed.
```

---

## 4. EXTENSION — T25 (Atmosphere grading + time-of-day): weather conditions (rain / snow / storm)

Append to T25. This is where "time + weather" actually lives — NOT a new T21. Day/night (`Sun`/`StarField`/`setTimeOfDay`) and `WeatherSystem` (wind/gusts, `getMaskLevel()`) are already shipped (T21); this extends the profile/compose schema with precipitation as acoustic + visibility modifiers.

```markdown
- **Weather conditions (extension — rain / snow / storm):** precipitation is a T25 atmosphere-profile axis layered onto the shipped `WeatherSystem`. One authoritative intensity scalar per condition (0..1); all derives from it (particle spawn, audio-bed gain, fog boost, detection noise-floor offset). Composes through T25's existing three-driver seam (region × clock × detection) — precipitation modulates the clock/atmosphere side, no new code path.
  - **Rain:** RAISES the global noise floor — masks the player's footsteps on the pursuer's hearing channel AND drops the player's ability to hear the pursuer. **Symmetric loss** (⚠VERIFY culvert principle, T22). Rain audio = Tone.js ambient-bed (⚠VERIFY D1 — Babylon never plays it), ducked under heartbeat/sting (⚠VERIFY D1a).
  - **Snow:** INVERTS the mask — snow *deadens* the world, LOWERS the noise floor (in a world where silence carries semantic weight, snowfall is the environment enforcing quiet). Heavier/whiter fog bias, slow-drift particles. **Footprint-trail beat — PARKED:** fresh snow could render footprints (a legibility surface, on-theme) but competes with the trail-marker nav loop + adds persistence concerns — park it; ship snow's acoustic/visual layer first.
  - **Storm (lightning + thunder):** layered on rain. `ThunderScheduler` (only new code unit) emits discrete strikes (flash → seeded delay → clap) with spacing floors; `stormDistance` (0 overhead .. 1 far) drives flash-to-clap delay + clap gain. Flash = brief light/ambient spike (subtle, overcast/canopy — NOT a strobe; drawn bolts out of the base version, tone risk). Clap = Tone.js one-shot on ambient-beds, ducked. **Thunderclap = a found masking window** — sibling to T31's *made* window (the emitter).
- **Detection coupling:** precipitation raises/lowers the noise floor (rain up, snow down); night degrades the vision-detection channel the way rain degrades hearing — parallel axes on T25's detection driver. (⚠ interacts with T5 seam — the detection half wants it stable.)
- **Guards:** no sudden weather (minutes-long lerps). Precipitation is a 2D ambient bed, never per-drop spatialized (⚠VERIFY D1 panner budget). Flash + red-throb vignette compose on the post-process, not fight (one named priority). Snow/rain mutually exclusive. Fog-derived cull horizon stays one named constant (auto-retunes with precipitation).
- **Serves T31:** the strike is an authored, LOS-gated event that *commands* this system (manufactures rain via `WeatherSystem`'s existing mode-swap — no fork). Authored, not farmable; weather never becomes a combat resource.
- **Named constants (profile data):** `rainIntensityToNoiseFloor` · `snowIntensityToNoiseFloor` (negative) · `rainBedGainCurve` · `rainFogBoost` · `snowFogBoost` · `snowAccumulationRate` · `nightVisionPenalty` · `thunderMinInterval`/`thunderMaxInterval` · `stormDistance` · `flashIntensity` · `flashDurationSeconds` · `thunderMaskFloorSpike` · `thunderMaskDecaySeconds`.
- **Owning doc:** needs `weather-conditions-prompt-v1.md` (Phase 0 audit; `ThunderScheduler`; T31 strike-gate handshake). Day/night + wind already shipped — this doc is precipitation + storm only.
```

---

## 5. EXTENSION — T21 (Lineglass layer): drone-view render + acoustic-emission viz

Append to T21's Lineglass bullet. Graticule + tiered-unlock parts already shipped; this adds the drone's-eye render mode.

```markdown
- **Lineglass drone-view (extension — render mode for T31's captured drone):** flying/reviewing the drone renders the world as the Synod's machine-read — the T14 thesis made literal. Composition: **textures hidden** (geometry as wireframe/outline — what things are *to the system*); **lat/long graticule** (already shipped — reused as the drone-view grid); **acoustic emissions as monitor viz** (sound is the primary readable signal — emitters render as oscilloscope/spectral traces in world-space; *in Lineglass, sound is what you see*). **Diegetic-UI justification:** ⚠VERIFY Milo's-headphones canon — his sound-reading mastery curve equals the player's, so an acoustic-first machine-read is *his* native way of seeing.
  - **Degraded-vision guard:** *differently blind*, not better — machine-legible, human-illegible. **Wear corrupts the view** (T31): dropped wireframe outlines + glitching acoustic traces = the drone dying, seen diegetically, no HUD.
  - **Two-layer render:** (a) Babylon world-substrate (texture-off wireframe + emissive-dot classifications — shipped `EmissiveDotMaterial`/graticule stack is the seed); (b) Preact/SVG instrument layer on top (graticule + per-emitter acoustic traces as Signals + terminal chrome — see T29). Babylon supplies wireframe + projected emitter screen-positions; Preact draws grid + acoustic instrumentation from live signals.
- **Relationship to the full Lineglass brief:** a *drone-mounted* application of the `dissonance-lineglass-engineering-review-prompt.md` aesthetic — the wireframe + graticule + acoustic-contour subset, seen through the drone; does not require the full 6-layer device.
```

---

## 6. EXTENSION — T29 (Diegetic communications / terminal layer): Preact framework + drone-control surface

Append to T29.

```markdown
- **Framework decision (extension — RESOLVED):** diegetic terminals = **Preact + Signals, SVG-forward, composited over Babylon.** Rationale (game context): ~3–4kB vs React ~35kB+ preserves byte budget; Signals' pull-based updates fit terminals + per-emitter acoustic viz (T21 Lineglass); native DOM/SVG attributes ease the vector aesthetic; `preact/compat` is a free escape hatch. Terminal reads game state through a thin bridge (game emits signals, terminal subscribes), writes intent through a command seam — never reaches engine internals (⚠VERIFY single-writer / extend-don't-rewrite).
- **Drone-control surface (extension — serves T31):** the **portable terminal** is T31's "controller." Control model = **not a handheld** — drones are network-directed, so control = **terminal access**, leaning **misused authorization** (Milo's data-sanitation job grants legitimate reach; he addresses the console *outward* — abuses a trust, doesn't steal a tool; darker, fits early-story). Piloting = **viewpoint-binding through a console** (T14's first real, non-aspirational use). The terminal is also the **review station** for deploy-and-review (recorded Lineglass feeds) and the addressing surface for the **repair-pipeline hack** (repair queue as addressable target).
- **Disabled-drone-as-transmission (extension):** a Milo-disabled drone may surface here as a **suppressed/blank transmission** (the network noticing one of its own go silent) — ties T31 interference to this layer's mediation/divergence concept.
```

---

## 7. EXTENSION — T4 / T18: `applyDisruption` first consumer

```markdown
# Append to T4 (hacked-mech ladder / applyDisruption):
- **First real consumer: T31** (captured-drone emitter). `kind` = sensor-flicker / audio-jam / patrol-read-corruption; `magnitude` = decaying EM charge. Coordinate the stub signature with T31; do not redeclare.

# Append to T18 (throw & distraction / applyDisruption future-hook):
- **The `applyDisruption` future-hook's first real caller is T31.** The made-interference-window (emitter) is the deliberate sibling of T18's noise-event distractors and T25's found thunderclap window — same "signal as the only lever" grammar, escalated from ambient to directed.
```

---

## 8. Open decisions (append to the canonical O-series — ⚠VERIFY next free O-number and renumber to continue)

```markdown
# T31
- Control model: misused-authorization vs. found terminal credential. Direction = terminal-not-handheld. Lean: misused authorization.
- Recharge: utility-corridor proximity (preferred — shipped `UtilityCorridors` + T4 run-down) vs. passive tick vs. salvage.
- Receiver: consumable/losable (mid-game revocation of Lineglass sight — darker) vs. permanent unlock. Lean: losable.
- Salvage-vs-take: one-time choice vs. returnable later. Lean: returnable (pressure, not trap).

# T32
- What the underground *was*: tunnels / transit / service / drainage / layered-palimpsest. Lean: layered + mixed.
- Corridor-generation rules (authored-nodes + procedural-corridors confirmed in principle).
- Topology: hub-and-spoke vs. maze. Interacts with trail-marker nav loop + parked compass (T28).
- Diegetic descent: how Milo first gets down — gates the workshop, which gates the T31 strike. (Camera-clip is dev reachability, NOT the diegetic entrance.)
- **TEMPERATURE-SETTER, held open:** does the Synod KNOW the underground exists? Rides T10 Synod-scope — do not resolve casually.

# T33
- Cavern name — UNNAMED until a good one emerges.
- What the gatekeepers WANT (trust currency = who they are): things from above / silence kept / network maintained / test intent. Lean: cold mix of the first two.

# Predecessor (T32 workshop)
- Functional/interrupted vs. failed/abandoned residue. Lean: interrupted-but-ambiguous.

# T25
- Scripted time-scrub for narrative beats (`setTimeOfDay` is shipped + settable; confirm scripted-scrub is acceptable).
- Rain's detection coupling: land in T25 now, or ship precipitation visual+audio only and defer the noise-floor hook to the T5 seam?
```

---

## 9. Apply order

```
T25 weather extension (§4) — everything strike-related references it
  → T31 (§1) → T32 (§2) → T33 (§3)
  → T21 Lineglass (§5) → T29 terminal/control (§6) → T4/T18 applyDisruption (§7)
  → registry rows (T31/T32/T33) → open decisions (§8, renumbered into the O-series)
```

## 10. Companion file
`emitter-drone-prompt-v1.md` (T31 acquisition scaffold) — EXISTS. On apply, correct its weather dependency to read **T25 / shipped `WeatherSystem`** (in canonical, T21 = geo pipeline). The `workshopDiscovered` gate edit is already in place.
