# Engineering: Ambiguity & Placement — buildable contract

**Status:** implementation spec. Subordinate to `pattern-ambiguity-and-placement-v1.md` (canon). This doc translates that framework into types, data shapes, and function contracts. It decides *how*, never *what* — if a choice here would change the design, HALT and defer to the canon doc.
**Single-machine, single-player.** No networking. Types must not *preclude* later multiplayer (per-player fan-out), but wire none of it.
**Packages:** `@culture/narrative` (engine, pure, game-agnostic) · `@dissonance/lore` (data + Dissonance types).

---

## 0. Placement of these types across the package boundary

Keep the boundary clean — the engine must stay game-agnostic:

- `@culture/narrative` owns: `NarrativeState`, `NarrativeEvent`, `Intent`, `Beat`, `reduce`, `rng`. It knows about **reading counts** and **scopes** as generic concepts (numbers, tags) but knows NOTHING about dogs, the Synod, or specific readings.
- `@dissonance/lore` owns: the actual `Beat[]` registry, the `Placement[]` data, the dissonance-band data per zone, the `cond.*` / `mark.*` helpers, and all Dissonance-specific constants. Reading *content* ("real·pet") lives here as inert strings.

Rule: if a type in `@culture/narrative` mentions a Dissonance noun, it is in the wrong package.

---

## 1. Core types (in `@culture/narrative`)

### 1.1 Reading count & scope — generic

```ts
// how many live interpretations a beat sustains in context. 1..4 (or N).
export type ReadingCount = 1 | 2 | 3 | 4;

// the magnification a reading operates at. generic; content is lore's problem.
export type Scope = "local" | "relational" | "systemic";
```

### 1.2 NarrativeState — conditions only (G3)

```ts
export interface NarrativeState {
  // counts
  proximityTicks: Record<string, number>;      // subjectId -> ticks near player
  // capability flags — flags on the PLAYER'S ability, never on a subject's nature
  capabilities: Record<string, boolean>;        // "interference-emitter" -> true
  // what the player is carrying/keeping (an action record, NOT a nature verdict)
  companions: Record<string, boolean>;           // "dog" -> true  (= you kept it near)
  // numeric weights
  deviance: number;                              // accumulated exposure
  devianceWeights: Record<string, number>;       // subjectId -> weight it adds
  // timestamps — the ONLY way "already happened once" is recorded
  since: Record<string, number>;                 // key -> event.t when first true
  // world-state
  zone: string | null;                           // current zone id
  // rng
  rng: number;                                   // seed; splitmix32 state
}
```

**FORBIDDEN fields (compile-review gate, human-checked):** anything asserting what a subject *is* or what a relationship *means* or that a systemic question is *answered*. Illustrative banlist: `*Resolved`, `*Confirmed`, `is*` on a subject, `beingWatched`, `synod*`, `whoIsGhost`, `bondReal`. If a field like this is proposed, HALT.

There is **no field for reading count, dissonance level, or scope conclusion** in state. Those are computed/authored, never stored as verdicts. Band is read from lore data (§4); reading count is a property of the beat (§3); scope resolution *never happens* for systemic.

### 1.3 NarrativeEvent — carries time and interaction

```ts
export interface NarrativeEvent {
  t: number;                     // server/loop tick. THE ONLY source of time.
  kind: string;                  // "zone:enter" | "prop:inspect" | "observe" | ...
  subject?: string;              // what was interacted with
  zone?: string;
  // no wall-clock, no rng seed here — rng lives in state.
}
```

### 1.4 Intent — inert data (unchanged from engine prompt, restated)

```ts
export type Intent =
  | { kind: "surface"; id: string; subject: string; via: string; readingCount?: ReadingCount; scopes?: Scope[] }
  | { kind: "shift-ambient"; zone: string; toward: string }
  | { kind: "resolve-profile"; entity: string; delta: number }
  | { kind: "sound-cue"; bus: string; cue: string }
  | { kind: "capability-grant"; capability: string }
  | { kind: "present-inventory"; surface: string; source: string }
  | { kind: "mark-fired"; key: string; t: number };   // writes state.since[key]
```

`readingCount` and `scopes` on `surface` are **carried to delivery for tilt/rendering**, NOT read back into state as conclusions. Delivery may use them to choose intensity/layering; it must never assert a reading.

### 1.5 Beat — the reading count and scopes are authored properties

```ts
export interface Beat {
  id: string;
  tier: "CANON" | "PROVISIONAL" | "EXPERIMENTAL" | "PARKED";
  readingCount: ReadingCount;    // declared; MUST match actual legibility (checklist)
  scopes: Scope[];               // which magnifications this beat gestures at
  when: (state: NarrativeState, event: NarrativeEvent) => boolean;  // PURE
  emits: (state: NarrativeState, event: NarrativeEvent) => Intent[]; // PURE, deterministic
  once: boolean;                 // gates default false; once-only via `since` (not a flag)
  readings: string[];            // inert documentation, length SHOULD equal readingCount
}
```

**Invariant (checklist, human):** `readings.length === readingCount`, and every string in `readings` describes a frame the emitted surface genuinely survives. A beat whose surface only holds under one listed reading is mis-declared — fix the count or the copy.

---

## 2. The reducer contract (`reduce`)

```ts
export function reduce(
  state: NarrativeState,
  event: NarrativeEvent,
  registry: Beat[],
  manifest: WorldManifest,     // includes placements + band data; see §4
): { state: NarrativeState; intents: Intent[] };
```

Deterministic algorithm:

1. Start `next = structuralClone(state)` (immutable-in-spirit; never mutate `state`).
2. Filter `registry` to beats whose `when(state, event)` is true.
3. **Band filter:** drop any beat whose `readingCount` exceeds the band allowed at `event.zone ?? state.zone` (band from manifest, §4). This enforces §2 of canon — a 4-reading beat cannot fire in a narrow zone.
4. **Once filter:** drop beats where `once === true` and `state.since[beat.id]` is set.
5. For each surviving beat (in a stable pass), collect `beat.emits(state, event)`.
6. Apply any `mark-fired` intents to `next.since`. Apply any state-changing intents (`capability-grant`, proximity updates, deviance) to `next`. **`surface`, `shift-ambient`, `sound-cue`, `present-inventory` do NOT change narrative state** — they are delivery requests.
7. **Sort all emitted intents by beat id, then by intent `id`/kind** for stability. Registry order must not affect output.
8. Return `{ state: next, intents }`.

**Purity gates (tested in `purity.spec.ts`):**
- same `(state, event)` ⇒ deep-equal `{state, intents}` twice.
- reorder `registry` ⇒ identical sorted intents.
- a seeded "random" beat reproduces across runs (rng from `state.rng` only).
- grep gate: no `Date.now`, `Math.random`, `fetch`, `import` of io/audio in `@culture/narrative/src`.

---

## 3. RNG (in `@culture/narrative/rng.ts`)

```ts
// splitmix32: pure. seed in, {value, seed} out. NEVER call Math.random.
export function nextRng(seed: number): { value: number; seed: number } {
  let z = (seed + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  const value = ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  return { value, seed: z | 0 };
}
```

A beat that needs randomness reads `state.rng`, calls `nextRng`, uses `value`, and emits a state update writing the new `seed` back. Replay reproduces exactly (P1 playable-archive holds).

---

## 4. Placement + band data (in `@dissonance/lore`, read via manifest)

Per O-P2's lean (manifest data, not a new package). Confirm before building.

### 4.1 WorldManifest

```ts
export interface WorldManifest {
  placements: Placement[];
  bands: Record<string, ReadingCount>;   // zoneId -> max readings allowed there
  // narrow near Synod core (1-2), wide in anomaly-space (3-4). §2 canon.
}
```

### 4.2 Placement

```ts
export interface Placement {
  id: string;
  subject: string;
  where: string;                 // zone id or named anchor. HAND-PLACED, not scatter.
  verb: "find" | "observe";
  when: (state: NarrativeState) => boolean;   // PURE. existence/observability gate.
  emits: NarrativeEvent;         // the event posted when the player interacts.
}
```

### 4.3 How placement feeds the reducer

Placement is **input-side**. The runtime (host, single-machine) does:

```
player interacts with placement P (in range + P.when(state) true)
        │
host posts P.emits  (a NarrativeEvent, stamped with current tick t)
        │
reduce(state, event, registry, manifest) → { state', intents }
        │
delivery router renders intents (terminal wired; rest logged)
```

- **find** posts e.g. `{ t, kind:"prop:inspect", subject:"downed-drone", zone }` and its beat may `capability-grant` / update deviance.
- **observe** posts `{ t, kind:"observe", subject:"window-figure", zone }`. Its beat surfaces but changes no state (unless once-only, which writes a `since` timestamp only).

**O-P1 (observe repeat):** if first-only, the observe beat's `when` includes `cond.notYetFired(state, beatId)` and emits `mark-fired`. If every-time, `once:false` and no `since`. Per-placement choice is cleanest — put the decision in data, not engine.

### 4.4 Condition helpers (`@dissonance/lore/conditions.ts`)

```ts
export const cond = {
  proximityAtLeast: (s, id, n) => (s.proximityTicks[id] ?? 0) >= n,
  capabilityHeld:   (s, cap)   => !!s.capabilities[cap],
  companionKept:    (s, id)    => !!s.companions[id],
  inZone:           (e, z)     => (e.zone ?? null) === z,
  event:            (e, k)     => e.kind === k,
  notYetFired:      (s, key)   => s.since[key] === undefined,
  bandAllows:       (m, zone, rc) => rc <= (m.bands[zone] ?? 4),  // §2 enforcement
};
export const mark = {
  fired: (key, t) => ({ kind: "mark-fired", key, t } as const),
};
```

All pure. No helper reads a conclusion because no conclusion exists in state to read.

---

## 5. Scope handling — the un-resolvable part, in code

Scopes are **carried, never concluded.** Concretely:

- A beat declares `scopes: ["local","relational","systemic"]`.
- The reducer passes those onto the `surface` intent for delivery tilt.
- **There is no code path that sets a systemic scope to "resolved."** There is no `state.systemicResolved`. The absence is the feature — grep for any such field in review and delete it.
- Local scope "resolves" ONLY in the sense that a `find` beat changes concrete state (capability/deviance). That is the hands side of §4. No equivalent exists for relational/systemic; they only ever surface, never settle.

**Test (`scope.spec.ts`):** assert that no sequence of events drives any state field toward a systemic conclusion. Property: for all event sequences, `state` contains no field outside the allowed condition set. This is the machine-checkable half of G3; the semantic half stays human review.

---

## 6. Build order (fits the seam-first Phase 1)

1. `@culture/narrative`: types (§1), `reduce` (§2), `rng` (§3). `purity.spec` + `scope.spec` green. **REVIEW.**
2. `@dissonance/lore`: `conditions.ts` (§4.4), a small `Beat[]` incl. one banded 4-reading pet beat and one `observe` placement, `manifest` with 2 zones (one narrow, one wide). `beats.spec` proves band filtering + determinism. **REVIEW.**
3. Wire ONE surface: the terminal `surface(via:"terminal")` beat renders in the terminal via existing `mediate()` path. Everything else logs. **REVIEW — Phase 1 done.**

---

## 7. Risks & edge cases

- **Clone cost:** `structuralClone` per tick is fine at this scale; if state grows, switch to structural sharing (immer-style) but keep purity. Do not optimize prematurely.
- **Band edge:** a beat exactly at the band limit (`readingCount === bands[zone]`) fires. `<=`, not `<`. Documented in `cond.bandAllows`.
- **Zone missing from bands map:** default to `4` (widest) — absence of Synod control = maximal dissonance. This default is itself thematic; do not change it to a restrictive default.
- **Once-only via flag temptation:** if a dev adds `state.firedX = true`, that is a conclusion-shaped field. Route through `since` timestamps only. Grep gate.
- **readingCount drift:** the declared count can silently diverge from actual legibility as copy is edited. No compiler catches this — it is on the §1.5 checklist and human review.
- **Delivery reading tilt leaking to state:** ensure the terminal bridge never writes `readingCount`/`scopes` back into `NarrativeState`. One-way: state → intent → delivery. Never back.

---

## 8. Acceptance criteria

1. `@culture/narrative` mentions zero Dissonance nouns; zero io/clock/rng-lib/audio/`@dta` imports.
2. `reduce` passes `purity.spec` (determinism, reorder-stable, seeded-rng) and `scope.spec` (no systemic-conclusion field reachable).
3. Band filtering works: a 4-reading beat does not fire in a `bands: 2` zone; does fire in a `bands: 4` zone.
4. Placement posts events; `find` changes state, `observe` does not (except `since` for once-only).
5. Exactly one surface (terminal) is live; all other intents log.
6. Every `NarrativeState` field and every `Beat.readingCount` affirmed in the session report (G3 + §1.5 checklist).

---

*Implements `pattern-ambiguity-and-placement-v1.md`. Where this doc and the canon doc disagree, the canon doc wins and this doc is the bug.*
