# Dissonance Documentation System

**Status:** Canonical  
**Scope:** Repository-wide design, lore, systems, implementation planning, and decision tracking  
**Primary registry:** `docs/THREADS.md`  
**Applies to:** All Dissonance packages, prototypes, narrative systems, world systems, and implementation prompts

---

## 1. Purpose

This document defines the canonical documentation architecture for the Dissonance repository.

The project contains interdependent systems spanning:

- worldbuilding;
- narrative;
- gameplay;
- audio;
- rendering;
- surveillance;
- traversal;
- AI behavior;
- environmental systems;
- developer tooling;
- player-facing interfaces;
- save-state and progression;
- implementation planning.

These systems must remain understandable without forcing `THREADS.md` to become a complete design archive.

The documentation system therefore separates:

1. **workstream registration;**
2. **canonical system specifications;**
3. **decisions and open questions;**
4. **runtime ownership;**
5. **persistent state ownership;**
6. **implementation prompts;**
7. **historical and superseded material.**

The governing rule is:

> Every material concept has one canonical home, one owning workstream, and one explicitly named implementation boundary.

Documents may cross-reference one another. They must not silently redefine one another.

---

## 2. Documentation hierarchy

The repository documentation is organized into six layers.

```text
docs/
├── THREADS.md
├── SYSTEMS.md
├── DECISIONS.md
├── OPEN-QUESTIONS.md
├── design/
├── engineering/
└── archive/
```

### Layer 1 — `THREADS.md`

`THREADS.md` is the project workstream registry.

It answers:

- What active bodies of work exist?
- Which thread owns each body of work?
- What is its status?
- Which canonical document contains its full specification?
- What does it depend on?
- What depends on it?
- Which decisions and open questions govern it?
- What is its current implementation state?

`THREADS.md` must remain compact enough to scan quickly.

It is not the canonical location for:

- full feature specifications;
- long lore passages;
- detailed API designs;
- complete implementation prompts;
- full encounter scripts;
- scene-by-scene narrative content;
- extensive rationale already housed elsewhere.

A thread entry should generally remain under approximately 20–30 lines.

### Layer 2 — `SYSTEMS.md`

`SYSTEMS.md` is the runtime system registry.

It answers:

- What systems exist in the game?
- Which package or module owns each system?
- Which thread owns its design?
- Where does persistent state live?
- How is the system presented to the player?
- What is its implementation status?
- Which systems consume it?

Threads describe bodies of work. Systems describe operational parts of the game.

A single thread may own several systems. A system may be consumed by several threads.

### Layer 3 — Canonical design documents

Canonical design documents live under `docs/design/`.

They define the actual behavior, fiction, player experience, constraints, state model, dependencies, and unresolved questions for a system or domain.

Examples:

```text
docs/design/
├── underground/
│   ├── UNDERGROUND-SYSTEM-MASTER.md
│   ├── WORKSHOP-NODE.md
│   ├── CAVERN-HUB.md
│   ├── TRANSIT-AND-FAST-TRAVEL.md
│   ├── SYMBOL-LANGUAGE.md
│   ├── LURER-ENCOUNTER.md
│   └── SURFACE-ENTRANCES.md
├── audio/
│   └── SONIC-SEMANTICS.md
├── surveillance/
│   └── LINEGLASS.md
└── weather/
    └── WEATHER-CONDITIONS.md
```

A canonical design document should answer:

- Why does this exist?
- What player experience does it create?
- What is resolved?
- What remains open?
- Which systems own its implementation?
- What state must persist?
- How does the player perceive it?
- What must not be implemented?
- What are its dependencies and consumers?

### Layer 4 — Decision and question registries

`DECISIONS.md` contains resolved project decisions.

`OPEN-QUESTIONS.md` contains unresolved design and architecture forks.

These registries prevent decisions from being duplicated, forgotten, or hardened accidentally inside prose.

Every consequential decision receives a stable identifier.

Examples:

```text
D41 — Surface boundaries govern authorized movement; underground topology governs actual movement.
D42 — Underground routes become fast travel only after full traversal and stabilization.
D43 — The workshop remains permanently first-person while uncompromised.
```

Examples of open questions:

```text
O63 — Does the Synod know the underground exists?
O64 — Is the receiver camera permanently owned or losable?
O65 — Does the crater alarm stop when Milo crosses the threshold?
```

Canonical documents may summarize a decision, but they must link back to the owning `D` or `O` identifier.

### Layer 5 — Engineering specifications and prompts

Implementation-facing documents live under `docs/engineering/`.

Examples:

```text
docs/engineering/
├── prompts/
│   ├── emitter-drone-prompt-v1.md
│   ├── weather-conditions-prompt-v1.md
│   └── workshop-node-build-prompt-v1.md
├── architecture/
│   ├── underground-state-model.md
│   └── sonic-runtime-ownership.md
└── reviews/
    └── underground-phase-0-audit.md
```

Engineering documents translate canonical design into implementation work.

They must not invent or silently resolve lore or design questions.

Each engineering document must identify:

- its owning thread;
- its canonical design sources;
- required Phase 0 audits;
- files and packages likely involved;
- existing conventions that must be followed;
- out-of-scope work;
- acceptance criteria;
- decisions and open questions that gate implementation.

### Layer 6 — Archive

Superseded or historical documents move to `docs/archive/`.

Archive documents must include:

- the date archived;
- the document that superseded them;
- whether any material remains authoritative;
- a warning that they are not current implementation guidance.

Do not delete useful history merely because a document is no longer canonical.

---

## 3. Canonical ownership rules

Every material system, mechanic, or narrative domain must have the following ownership fields.

### 3.1 Design owner

The thread responsible for the system’s intended behavior and player-facing meaning.

Example:

```text
Design owner: T32 — Underground Network
```

### 3.2 Runtime owner

The package, module, service, or subsystem that implements it.

Example:

```text
Runtime owner: @dta/world
```

The actual package name must be confirmed during Phase 0 audit. Documentation must not invent a new package merely for conceptual neatness.

### 3.3 State owner

The canonical store for persistent and session state.

Example:

```text
State owner: UndergroundProgress
```

This may be a save-game domain, world-state object, profile, or existing persistence module.

### 3.4 Presentation owner

The system responsible for making the mechanic perceptible to the player.

Examples:

```text
Presentation owner: Babylon scene + Tone.js audio + Preact Lineglass overlay
```

Presentation ownership is required because many Dissonance systems are communicated through environmental response rather than conventional HUD.

### 3.5 Canonical document

The single design document that defines the system.

Example:

```text
Canonical document: docs/design/underground/TRANSIT-AND-FAST-TRAVEL.md
```

### 3.6 Implementation owner

The active thread, issue, prompt, branch, or local coding session performing the work.

This field may change more frequently than the design or runtime owner.

---

## 4. Single-source-of-truth rule

Every concept has one canonical home.

Other documents may:

- summarize it;
- reference it;
- explain how they consume it;
- define an extension within their own scope.

Other documents may not:

- copy the full rule and modify it;
- create a competing definition;
- silently change its terminology;
- resolve its open questions;
- create a second state model;
- introduce an alternative runtime owner without updating the canonical registry.

When two documents disagree:

1. the canonical document wins;
2. `DECISIONS.md` wins over narrative recollection;
3. implemented behavior does not automatically become canon;
4. the discrepancy must be logged and resolved;
5. stale documents must be corrected or archived.

---

## 5. Thread entry template

Use this structure for new or revised `THREADS.md` entries.

```markdown
### TXX — Thread name

- **Status:** active | queued | blocked | parallel-safe | experimental | aspirational | provisional
- **Purpose:** One concise statement of what the thread exists to establish.
- **Owns:** Systems, mechanics, or domains for which this thread is the design authority.
- **Canonical docs:** Paths to the owning design documents.
- **Runtime owners:** Existing packages/modules, or `⚠VERIFY` if not yet confirmed.
- **State owners:** Save-state or runtime-state domains, or `TBD`.
- **Depends on:** Thread IDs and system names.
- **Consumed by:** Thread IDs, features, or systems.
- **Decisions:** `D##`, `D##`.
- **Open questions:** `O##`, `O##`.
- **Implementation:** Current repo state in one or two sentences.
- **Next gate:** The next audit, decision, or implementation milestone.
```

Do not embed the complete feature specification inside the registry entry.

---

## 6. System registry template

`SYSTEMS.md` should use a compact table for orientation, followed by optional expanded sections where necessary.

```markdown
| System | Design owner | Runtime owner | State owner | Presentation owner | Status | Canonical doc |
|---|---|---|---|---|---|---|
| Underground topology | T32 | `@dta/world` ⚠VERIFY | `UndergroundProgress` | Babylon world | design-complete | `docs/design/underground/UNDERGROUND-SYSTEM-MASTER.md` |
| Sonic semantics | T34 | audio package ⚠VERIFY | tuning configuration + progression state | Tone.js + Lineglass | prototype prior art | `docs/design/audio/SONIC-SEMANTICS.md` |
| Underground transit | T32 | traversal/world package ⚠VERIFY | route knowledge + route condition | world nodes + audio transition | provisional | `docs/design/underground/TRANSIT-AND-FAST-TRAVEL.md` |
```

Every runtime system should eventually identify:

- initialization path;
- update path;
- event inputs;
- outputs;
- save representation;
- test location;
- debugging surface;
- deactivation or cleanup behavior.

These implementation details may live in linked engineering architecture documents rather than in the top-level registry.

---

## 7. State-model discipline

Do not represent a complex domain as a growing collection of unrelated booleans.

Avoid:

```ts
workshopDiscovered
alarmHeard
alarmStopped
foundSecondExit
followedLurer
lurerEscaped
fastTravelUnlocked
knowsThreeLineSymbol
```

Prefer structured domain state.

Illustrative model:

```ts
interface UndergroundProgress {
  discoveredNodes: Set<UndergroundNodeId>;
  discoveredEntrances: Set<UndergroundEntranceId>;
  knownRoutes: Map<UndergroundRouteId, RouteState>;
  symbolKnowledge: Map<SymbolId, SymbolKnowledge>;
  encounters: Map<EncounterId, EncounterProgress>;
  transitCapabilities: Set<TransitCapability>;
}
```

Illustrative route state:

```ts
interface RouteState {
  knowledge: RouteKnowledge;
  condition: RouteCondition;
  trust: RouteTrust;
  lastTraversal?: GameTimestamp;
  discoveredFrom?: UndergroundNodeId;
}

type RouteKnowledge =
  | "unknown"
  | "glimpsed"
  | "entered"
  | "traversed"
  | "mapped"
  | "trusted";

type RouteCondition =
  | "stable"
  | "uncertain"
  | "flooded"
  | "blocked"
  | "occupied"
  | "compromised";
```

Fast travel should derive from state rather than from a standalone unlock boolean.

Illustrative rule:

```ts
const canFastTravel =
  route.knowledge === "trusted" &&
  route.condition === "stable" &&
  progress.discoveredNodes.has(destinationNodeId);
```

The exact model must follow existing repository conventions after audit.

---

## 8. Dependency tracking

Each major canonical design document must include a dependency table.

Example:

| Feature | World topology | Audio | Lineglass | Weather | AI | Persistence | Surface world |
|---|---:|---:|---:|---:|---:|---:|---:|
| Workshop discovery | required | optional | no | no | no | required | required |
| Consonant crater alarm | required | required | optional | optional | no | required | required |
| Lurer sequence | required | required | optional | optional | required | required | no |
| Melody threshold | required | required | required | no | no | required | optional |
| Underground transit | required | required | optional | required | optional | required | required |
| Outer-parcel exit | required | optional | no | optional | optional | required | required |

Dependencies must be described directionally.

Bad:

```text
T32 relates to T34.
```

Good:

```text
T32 consumes T34 interval semantics for route authentication.
T34 does not own underground topology.
```

---

## 9. Status vocabulary

Use the existing project statuses consistently.

### `active`

Implementation or detailed design work is currently underway.

### `queued`

The work is accepted but not started.

### `blocked`

The work cannot proceed until a named dependency, audit, asset, or decision is resolved.

### `parallel-safe`

The work can proceed without conflicting with active owning threads.

### `experimental`

The work is a prototype or investigation and is not yet canonical production architecture.

### `aspirational`

The idea is intentionally preserved but must not be treated as committed scope.

### `provisional`

The design direction is accepted, but specific open questions still gate implementation.

A system may have mixed status by subsection.

Example:

```text
provisional — underground topology
active — existing sub-terrain audit
aspirational — network-scale mechanized transport
```

---

## 10. Decision discipline

### 10.1 Resolved decisions

When a consequential design choice is made:

1. assign the next available `D` number;
2. add it to `DECISIONS.md`;
3. update every affected canonical document;
4. update relevant `THREADS.md` entries;
5. remove or close the corresponding `O` item;
6. identify implementation consequences.

Decision entry template:

```markdown
### DXX — Decision title

- **Date:** YYYY-MM-DD
- **Status:** accepted
- **Decision:** The concise canonical rule.
- **Rationale:** Why this direction was selected.
- **Applies to:** Threads, systems, and documents.
- **Consequences:** Required state, architecture, content, or migration changes.
- **Supersedes:** Prior decisions or documents, if any.
```

### 10.2 Open questions

Open questions must remain visible and must not be resolved implicitly during implementation.

Question template:

```markdown
### OXX — Question title

- **Status:** open | deferred | blocked-on-audit
- **Question:** The exact unresolved fork.
- **Options:** Short list of viable directions.
- **Current lean:** Optional and explicitly non-binding.
- **Gates:** Which implementation work cannot proceed.
- **Related:** Threads, decisions, and canonical documents.
```

### 10.3 Held-open canon

Some ambiguity is intentional and should remain unresolved.

Mark these questions:

```text
Status: held open
```

A held-open question is not a missing decision. It is a canonical constraint against premature explanation.

Examples:

- whether the Synod knows the underground exists;
- whether apparently magical acoustic behavior has a technical cause;
- whether multiple symbol systems share an origin;
- whether the Lurer guides, hunts, imitates, or merely coincides with the player’s route.

---

## 11. Phase 0 audit gate

No implementation prompt may assume repository structure, API shape, or existing ownership without a local audit.

Each implementation prompt must begin with a Phase 0 audit that confirms:

- relevant packages and paths;
- existing interfaces;
- naming conventions;
- profile patterns;
- state-management conventions;
- save-game conventions;
- test conventions;
- developer tooling;
- reusable assets;
- current thread and decision identifiers;
- whether similar systems already exist.

Audit findings must be recorded before implementation.

If the repository contradicts a design assumption:

1. do not silently work around it;
2. document the conflict;
3. prefer existing conventions unless they violate an accepted decision;
4. update the engineering plan;
5. escalate genuine design conflicts back to the owning canonical document.

---

## 12. Canonical underground documentation domain

The underground cluster is the first system domain governed by this documentation model.

Create or normalize the following structure:

```text
docs/design/underground/
├── UNDERGROUND-SYSTEM-MASTER.md
├── WORKSHOP-NODE.md
├── CAVERN-HUB.md
├── TRANSIT-AND-FAST-TRAVEL.md
├── SYMBOL-LANGUAGE.md
├── LURER-ENCOUNTER.md
└── SURFACE-ENTRANCES.md
```

### `UNDERGROUND-SYSTEM-MASTER.md`

Owns:

- design thesis;
- relationship to Synod control;
- vertical layers;
- authored nodes and connective corridors;
- topology;
- system boundaries;
- player progression;
- persistence model;
- cross-system dependency map;
- canonical open questions.

It does not fully specify individual encounters or nodes.

### `WORKSHOP-NODE.md`

Owns:

- crater entrance;
- consonant alarm;
- threshold behavior;
- three-zone workshop composition;
- predecessor residue;
- discovery trigger;
- maintenance and review functions;
- first-person presentation rule.

### `CAVERN-HUB.md`

Owns:

- cavern architecture;
- architectural lithophone;
- gatekeepers;
- trust economy;
- route access;
- functional tonal language;
- anti-cliché constraints.

### `TRANSIT-AND-FAST-TRAVEL.md`

Owns:

- route discovery states;
- route stabilization;
- mechanized transport;
- journey compression;
- transit risks;
- destination requirements;
- interaction with weather and compromise;
- access beyond the controlled surface parcel.

Canonical thesis:

> Surface boundaries govern authorized movement. Underground topology governs actual movement.

### `SYMBOL-LANGUAGE.md`

Owns:

- material marks;
- tonal notation;
- route symbols;
- overlapping historical symbol systems;
- player interpretation;
- deliberate ambiguity;
- relation to itinerant travel traditions without direct historical copying;
- guards against turning the system into a collectible cipher alphabet.

### `LURER-ENCOUNTER.md`

Owns:

- lure;
- commitment;
- reversal;
- chase;
- release;
- hidden-route discovery;
- re-entry and recurrence rules;
- ambiguity of the Lurer’s intent;
- save and encounter state.

### `SURFACE-ENTRANCES.md`

Owns:

- crater entrance;
- later ascent points;
- outer-parcel emergence;
- Synod-maintained entrances;
- environmental clue funnels;
- surface boundary relationships;
- world-expansion sequencing.

---

## 13. Canonical underground system rules

The following accepted rules should be recorded in the appropriate design documents and decision registry.

### 13.1 Underground through-network

The underground is not a closed refuge.

Its layers ultimately form a through-network with multiple ascent points.

The player’s understanding progresses through:

1. isolated workshop;
2. local dead zone;
3. buried network;
4. inhabited or governed nodes;
5. alternate surface entrances;
6. routes beyond the controlled parcel;
7. possible wider regional infrastructure.

### 13.2 Outer-parcel access

The underground extends beneath and beyond the literally gated or patrolled surface parcel.

The perimeter defines authorized movement, not actual geography.

The first outer emergence should materially revise the player’s understanding of:

- the world’s scale;
- the purpose of the perimeter;
- the Synod’s mobility controls;
- the relationship between infrastructure and people.

Outer exits do not necessarily lead to freedom.

They may lead to:

- logistics areas;
- abandoned infrastructure;
- other controlled parcels;
- rural or industrial sites;
- environmentally damaged zones;
- isolated communities;
- regions with different surveillance regimes.

### 13.3 Restricted mechanized transport

The Synod limits efficient human movement by controlling mechanized transport.

Possible mechanisms include:

- identity-bound vehicles;
- route authorization;
- fuel or charge rationing;
- recorded public transit;
- checkpointed roads;
- restricted repair parts;
- confiscation or attrition of private vehicles;
- mobility privileges tied to occupation or status.

The hierarchy of movement may be expressed as:

```text
Signals    — highly mobile
Goods      — controlled but mobile
Machines   — highly mobile
Officials  — credentialed mobility
Residents  — locally contained
Milo       — initially contained, later illicitly mobile
```

### 13.4 Underground fast travel

Fast travel is earned through real traversal.

A route becomes eligible for compressed travel only after the player has:

- discovered both relevant nodes;
- traversed the route;
- learned enough of its markings or tonal behavior;
- stabilized or authenticated it;
- satisfied any trust or mechanical requirements;
- confirmed its current condition.

Fast travel must remain diegetic.

Journey compression may use:

- partial traversal images;
- lamp movement;
- recurring marks;
- tones;
- changing environmental audio;
- mechanical carrier movement;
- brief glimpses of unexplored branches.

### 13.5 Lurer path discovery

The Lurer encounter may reveal the first route beyond the apparent underground boundary.

The player must follow the lure through the full reversal and chase to discover the path.

Abandoning the sequence does not grant:

- a map marker;
- a persistent route;
- an automatic unlock;
- complete knowledge of the destination.

The Lurer must not become a reliable guide NPC.

### 13.6 Symbol language

Underground marks are practical, layered, ambiguous, and historically accumulated.

They may encode:

- route condition;
- safe emergence;
- acoustic behavior;
- timing;
- danger;
- occupancy;
- transport status;
- trust;
- listening instructions.

Some apparent symbols may be:

- unrelated utility notation;
- geological pattern;
- repeated abrasion;
- animal traces;
- Synod survey marks;
- pareidolia.

The player must never receive a complete authoritative legend.

---

## 14. File header standard

Every canonical design or engineering document should begin with:

```markdown
# Document title

**Status:** canonical | provisional | experimental | aspirational | archived  
**Owning thread:** TXX  
**Canonical scope:** What this document owns  
**Does not own:** Adjacent concerns explicitly excluded  
**Runtime owner:** Package/module or `⚠VERIFY`  
**State owner:** State domain or `TBD`  
**Presentation owner:** Player-facing systems  
**Depends on:** Threads, systems, and decisions  
**Consumed by:** Threads, systems, and features  
**Decisions:** D-numbers  
**Open questions:** O-numbers  
**Last reviewed:** YYYY-MM-DD
```

This header makes ownership visible before a reader enters the body.

---

## 15. Cross-reference standard

Use stable references.

Preferred:

```markdown
See [T32 — Underground Network](../../THREADS.md#t32--underground-network).
See [D41](../../DECISIONS.md#d41--surface-boundaries-and-underground-topology).
See [Underground transit](./TRANSIT-AND-FAST-TRAVEL.md).
```

Avoid references such as:

```text
See the discussion above.
See the old prompt.
See the previous version.
As discussed in chat.
```

Chat transcripts are source material, not canonical repository documentation.

---

## 16. Naming and terminology discipline

Each canonical document should include a terminology section when the domain introduces specialized terms.

Example:

```markdown
## Terminology

- **Node:** An authored underground destination with persistent identity.
- **Route:** A traversable connection between nodes.
- **Entrance:** A surface-to-underground boundary.
- **Ascent point:** An underground-to-surface boundary, discovered from below.
- **Outer parcel:** A playable area beyond the initially controlled surface boundary.
- **Trusted route:** A fully traversed, stable route eligible for journey compression.
- **Lurer:** Provisional name for the ambiguous underground pursuer/leader entity.
```

Do not introduce synonyms casually after terms become canonical.

---

## 17. Prompt creation rules

Every AI coding-assistant prompt must:

1. name the owning thread;
2. link to canonical design documents;
3. list accepted decisions;
4. list unresolved questions that remain out of scope;
5. require a Phase 0 repository audit;
6. instruct the assistant to follow existing repo conventions;
7. identify likely packages without assuming them;
8. define acceptance criteria;
9. define explicit non-goals;
10. require documentation updates after implementation;
11. prohibit opportunistic architecture rewrites;
12. prohibit resolving held-open lore through code comments, UI text, or filenames.

Prompts must be stored as copyable Markdown under `docs/engineering/prompts/`.

---

## 18. Change-management workflow

When adding or changing a system:

### Step 1 — Identify ownership

Determine:

- owning thread;
- canonical document;
- runtime owner;
- state owner;
- presentation owner.

### Step 2 — Register the change

Update:

- `THREADS.md`;
- `SYSTEMS.md`;
- `OPEN-QUESTIONS.md` or `DECISIONS.md`.

### Step 3 — Update canonical design

Change the owning document.

Do not begin by editing dependent documents.

### Step 4 — Propagate references

Update consumers with links or short summaries.

Do not duplicate the full revised specification.

### Step 5 — Audit implementation impact

Identify:

- state migrations;
- package boundaries;
- tests;
- developer tools;
- save compatibility;
- content impact.

### Step 6 — Create implementation prompt or issue

The prompt must cite the canonical design and accepted decisions.

### Step 7 — Close the loop

After implementation:

- update implementation status;
- update system registry;
- add tests and debug instructions;
- record any deviations;
- archive superseded prompts if necessary.

---

## 19. Documentation review checklist

Before declaring a document canonical, confirm:

- [ ] It has a single clear scope.
- [ ] It names its owning thread.
- [ ] It names runtime, state, and presentation owners.
- [ ] It distinguishes resolved rules from open questions.
- [ ] It links decisions by stable ID.
- [ ] It does not duplicate another canonical specification.
- [ ] It identifies dependencies directionally.
- [ ] It names explicit non-goals.
- [ ] It does not explain intentionally ambiguous lore.
- [ ] It provides enough information for an engineering prompt.
- [ ] It identifies what must be verified in the repository.
- [ ] It includes a last-reviewed date.
- [ ] Relevant registries have been updated.

---

## 20. Initial migration plan

Apply this documentation system in the following order.

### Phase A — Establish registries

Create or normalize:

```text
docs/THREADS.md
docs/SYSTEMS.md
docs/DECISIONS.md
docs/OPEN-QUESTIONS.md
```

Preserve existing identifiers.

Do not renumber existing `T`, `D`, or `O` entries unless the registry is already inconsistent and the migration explicitly records the remap.

### Phase B — Register the underground cluster

Register:

- T31 — interference verb;
- T32 — underground network;
- T33 — cavern hub and gatekeepers;
- T34 — discordant/consonant sonic semantics.

Apply cross-links to:

- weather;
- Lineglass;
- terminal UI;
- disruption;
- world topology;
- transport control;
- save-state.

### Phase C — Create underground canonical documents

Create:

```text
docs/design/underground/UNDERGROUND-SYSTEM-MASTER.md
docs/design/underground/WORKSHOP-NODE.md
docs/design/underground/CAVERN-HUB.md
docs/design/underground/TRANSIT-AND-FAST-TRAVEL.md
docs/design/underground/SYMBOL-LANGUAGE.md
docs/design/underground/LURER-ENCOUNTER.md
docs/design/underground/SURFACE-ENTRANCES.md
```

Populate them from the accepted handoff material.

### Phase D — Register systems and state

Add underground topology, routes, entrances, transit, symbols, encounters, and sonic authentication to `SYSTEMS.md`.

Confirm whether an existing world-progress or save-state domain can own the data before introducing `UndergroundProgress`.

### Phase E — Produce implementation prompts

Create implementation prompts only after:

- registry audit;
- package audit;
- state audit;
- required Dan decisions;
- canonical design documents.

### Phase F — Archive superseded handoffs

Once all accepted material has been folded into canonical documents:

- move the original handoff into `docs/archive/handoffs/`;
- mark it superseded;
- link to the new canonical documents;
- retain it as historical design provenance.

---

## 21. Repository authority statement

This document governs how Dissonance documentation is organized and maintained.

In case of conflict:

1. accepted decisions in `DECISIONS.md` govern;
2. canonical design documents govern their declared scope;
3. `THREADS.md` governs workstream ownership and status;
4. `SYSTEMS.md` governs runtime and state ownership;
5. engineering prompts govern only the implementation task they define;
6. archived documents and chat transcripts do not govern current behavior.

The documentation system should make the project easier to reason about, not create process for its own sake.

Its purpose is to preserve the relationship between:

- fiction;
- mechanics;
- runtime architecture;
- persistent state;
- player perception;
- implementation order.

The standard for success is:

> A contributor can locate the authoritative rule, understand why it exists, identify where it belongs in the runtime, determine what state it requires, and see what remains unresolved without reading the project’s complete conversation history.
