# Pattern: Ambiguity & Placement — `@dissonance/lore`

**Status:** CANON (framework) — the settled design law for how the world is observed, how meaning stays open, and how dissonance is felt as a gradient.
**Consolidates:** four-way legibility, ambiguity-as-band (1–4), scalar ambiguity (local/relational/systemic), the placement subsystem (find/observe), and the hands/sky rule.
**Governs:** `pattern-combination-gate-v1.md`, `story-engine-prompt-v1.md`, and all future beat/placement authoring.
**Rests on:** the pure reducer (`@culture/narrative`) and Gate G3 (state records conditions, never conclusions).

---

## 0. The one law everything else serves

> **Meaning is never stored. It is observed by the player and held, unresolved, in their head.**

The engine records that things *happened* (conditions). It never records what they *meant* (conclusions). Every mechanism below is a way of making that law playable, rich, and felt rather than merely enforced.

---

## 1. Ambiguity is a quantity (1–4), not a binary

A beat is not simply "ambiguous" or "resolved." It carries a **reading count**: how many live interpretations it sustains in context.

The canonical local example is the pet, on two independent axes:
- **ontological:** real animal / mech
- **relational:** your pet / merely along for a while

→ four readings (real·pet, real·along, mech·pet, mech·along).

A beat may be authored to hold 1, 2, 3, or 4 of these.

### CRITICAL: narrow is not concluded

A 1-reading beat is **not** a disambiguated beat. The engine still stores no verdict. The beat is merely written narrowly enough that, given current conditions, one reading dominates. Narrowing is a property of *the writing*, never a flag in *the state*. There is no setting at which a conclusion is stored. The dial runs 1→4 in **legibility breadth**, never 0→1 in **conclusion recorded**.

If a session ever "narrows to 1" by writing a conclusion-shaped field (`dogIsMech`, `bondConfirmed`), that is a G3 violation, not a level-1 beat. HALT.

---

## 2. Dissonance is a band, and the band is diegetic

Local dissonance = **how many readings the world sustains at that place/state.** This is a *gradient the player walks through*, not a difficulty setting.

- Author it as a property of **place and world-state**, never as a player-facing option. Dissonance is something the world *is*, not something a menu picks. (Guard: the moment `maxReadings` becomes an "easy/hard" slider, the whole framework flattens into ordinary authored control. Keep it in the fiction.)
- **Synod-controlled space narrows the band** (toward 1). Order = fewer things simultaneously true.
- **Anomaly-space widens the band** (toward 4). Dissonance = more things simultaneously true.

A beat may only surface where the band admits its reading count. A four-way beat physically cannot fire in a `maxReadings: 2` zone — not because the game concluded anything, but because the world there does not sustain that many readings.

### The thematic identity

The Synod's power *is* legibility-enforcement. So this is literal: Synod space reduces the number of readings reality can hold. Dissonance (the state, the game's namesake) is where more can be true at once. **The band is the Synod's grip, measured.**

---

## 3. Ambiguity is scalar — it nests across scope

The same ambiguity recurs, self-similar, at three magnifications. The pet question and the world question are one shape at different lenses:

| Scope | Question | Example referent |
|---|---|---|
| **local** | is this object what it seems? | is the dog mech? |
| **relational** | is this presence watching me? who is it? | is the pursuer the watcher? is Lola? |
| **systemic** | is the Synod behind it — all of it? any of it? | is anyone watching, ever? |

A single observation can carry readings at multiple scopes at once. Witnessing the window-figure is local ("a figure"), gestures relational ("was it watching me?"), and gestures systemic ("is this Synod habitation-monitoring?") — none resolved.

### CRITICAL: the ladder does not rung upward

**No accumulation of local evidence resolves a systemic question.** Find a hundred drone carcasses; "is the Synod behind it all" stays *exactly* as open as at zero. Systemic scope lives where local evidence structurally cannot reach.

This is not withholding. It is the surveillance state's true epistemology: **you can observe any amount and never see the observer.** The engine models this by having *no slot for the answer* — no `synodConfirmed`, no `beingWatched`, at any scope, ever. G3, extended from local to systemic.

The band gates *which scopes stay live*:
- **near the Synod core** (narrow): observations read mostly local; the large questions are *suppressed* — not answered, but the world is too legible for them to breathe.
- **deep in anomaly-space** (wide): one observation blooms across all scopes; dog, pursuer, and Synod all become possible referents for the same shiver.

Walking core→deep is **the large questions coming back online.** Dissonance is *the felt return of the systemic question the Synod's order suppresses.*

---

## 4. The hands/sky rule (the rule that saves the whole thing)

> **The player gets real answers at the scale of their hands, and never at the scale of the sky.**

- **Local scope RESOLVES into felt, playable consequence** — deviance rises, a capability unlocks, the world reacts, a companion is kept or cleaned. The player gets genuine answers at the scale of their own actions.
- **Systemic scope NEVER resolves.** The sky stays sealed.

This is the guard against both failure modes:
- **scavenger hunt** (answers everywhere) — avoided because systemic never closes.
- **nihilism** (answers nowhere, nothing matters) — avoided because local *does* close, concretely and often.

Dissonance is the *distance* between the hand and the sky. Keep both live.

**Tone guard:** systemic un-answerability must feel like *truth about the world*, not like the game withholding. Dread, never frustration.

---

## 5. The Placement Subsystem — giving the player something to do or observe

The engine reacts; placement is what the player's body actually touches. Placement is the **input side** the reducer was always built to consume — it generates the events (`prop:inspected`, `artifact:recovered`, `observed:*`) that beats fire on.

### Separation of concerns (keep these clean)

- **Placement** = *what is where, and what you can do with it.* World-state. "A drone carcass lies in the understory fringe; you can inspect it."
- **Story engine** = *what it means that you did.* Reaction. "You inspected it → surface the workshop → the band shifts."

Placement posts events; the reducer consumes them. They share one **condition vocabulary** (counts, flags, timestamps, weights, band) — that shared vocabulary is what makes them one system, not two bolted together.

### The two verbs

- **find** — an object you *acquire*. Changes state (capability, companion, deviance weight). Active.
- **observe** — something you *witness but cannot take*. Changes nothing mechanically, but a beat may still fire. Passive — and often more powerful, because **observation-without-acquisition is the core theme as a verb.** You watch, gain nothing, and the world registers that you were there watching.

### Placement discipline (against inflation)

> **Every placement must justify its verb.**
- A `find` must change state meaningfully — no filler collectibles.
- An `observe` must be able to surface a beat — otherwise it is set dressing, which is fine but belongs to the environment/asset layer (T7/T8), not the placement subsystem.
- A placement that neither changes state nor can fire a beat is not a placement. Cut it or hand it to the environment artist.

### Anchoring (not scatter)

`where` is a **hand-placed anchor reasoned from discovery logic** ("how might a player find this?"), never random distribution. Inherits T7's rule directly.

### Placements are condition-gated

A placement's existence/observability gates on `when` — the same conditions the story engine reads, *including the dissonance band*. The drone carcass exists in the understory *because SignalNet is thin there*. A thing can be present only where the band and the player's history allow.

### The terminal is already a placement

The wired terminal beat (`surface via terminal`) is an `observe` placement in **data-space**: the anomaly appears in Milo's queue; he witnesses it; taking-or-not is the interaction. The drone carcass is the same rule in **physical space**. One placement grammar, two surfaces — the tell that the abstraction is right.

---

## 6. How it all rides together (the payoff)

Scope, band, and placement are one machine:

```
placement (find/observe) posts an event
        │
reducer reads conditions (incl. band + scope tags), stores NO conclusion
        │
beat surfaces — legible at N readings across M scopes
        │
delivery renders it diegetically; may TILT a reading, never assert one
        │
player observes, holds meaning unresolved
        │
LOCAL scope may close into felt consequence  ← hands
SYSTEMIC scope never closes                    ← sky
```

The Synod's grip is the band narrowing the world's readings and suppressing the large questions. Dissonance is the grip loosening — readings multiplying, scopes reopening, the sky-questions waking. The player walks that gradient with their hands full of real answers and the sky permanently open above them.

---

## 7. Open decisions (batched for Dan's sign-off)

- **O-P1** — does `observe` post an event on *every* witnessing, or only the first (a `since` timestamp, like the once-only gate)? Repeated firing risks noise. [every / first-only / per-placement choice]
- **O-P2** — is placement its own package or manifest data the reducer already reads? Lean: manifest data (placements *are* manifest entries with a verb) — avoids a new package, keeps inputs in one place. [package / manifest]
- **O-A1** — is the dissonance band derived-up (measured from live readings) or gated-down (authored per zone/state)? They are duals; gated-down snaps cleaner into placement `when`. [derive / gate / both]
- **O-A2** — scope tags (local/relational/systemic) on beats: authored explicitly per beat, or inferred from which subjects a beat references? [explicit / inferred]
- **O-A3** — confirm the hands/sky rule as hard canon: local scope MAY resolve; systemic NEVER does. [confirm]

---

## Canon-risk summary

- **CANON (framework):** meaning-never-stored (§0); ambiguity-as-quantity with narrow≠concluded (§1); dissonance-as-diegetic-band (§2); scalar ambiguity with no-upward-ladder (§3); hands/sky (§4); placement find/observe with justify-the-verb (§5). These are all G3 and the never-disambiguate rule *generalized* — not new fiction, existing law extended to new scope.
- **PROVISIONAL:** specific zone bandings; the scope-tagging mechanism; the placement package/data decision.
- **The two fragile rules a future session will try to break, flagged loudly:** (a) local evidence never resolves systemic scope (§3); (b) the band is a property of place/state, never a difficulty slider (§2). Both must be defended, not negotiated.

---

*Companion to `story-engine-prompt-v1.md` (engine + terminal) and `pattern-combination-gate-v1.md` (condition-gated beats). This doc is the governing framework; those two implement pieces of it. See `eng-ambiguity-placement-v1.md` for the buildable contract.*
