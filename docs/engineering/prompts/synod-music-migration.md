# Dissonance Engineering Task: Establish Canonical Babylon Audio Runtime

## Background

The project currently has very little audio implemented, which makes this the ideal time to establish a long-term audio architecture before additional systems (Synod harmonic language, radio broadcasts, ambience, procedural music, cinematics, etc.) are built.

There is an existing standalone audio prototype (`dissonance-frontend`) which explores the Synod harmonic language. That prototype is **not** the immediate target of this work.

Instead, the goal is to ensure the game itself has a clean, centralized audio architecture that future systems can plug into.

---

# Objective

Design and implement a canonical Babylon.js audio runtime for the game.

The end result should be:

- one audio runtime
- one listener
- one audio ownership model
- one lifecycle
- one approved path for future audio features

The Synod harmonic engine will be migrated **after** this work is complete.

---

# Scope

This task is intentionally limited.

Do **not** begin porting the Synod audio demo.

Do **not** implement new procedural audio.

Do **not** redesign gameplay audio.

Instead, focus entirely on the architecture that those systems will eventually use.

---

# Phase 1 — Audit

Perform a complete audit of the existing audio implementation.

Identify:

- every audio call site
- every sound asset
- music playback
- ambience
- positional sounds
- UI sounds
- scene ownership
- initialization
- disposal
- mute/volume handling

Determine:

- whether Babylon Audio Engine V1 or V2 is currently in use
- whether multiple audio contexts are created
- whether any code bypasses Babylon
- whether audio is scene-owned or globally owned

Produce a concise architecture summary before making major changes.

---

# Phase 2 — Design

Design a single canonical audio service.

The service should own:

- initialization
- listener
- buses
- routing
- playback
- teardown
- volume
- mute

Feature code should never:

- create AudioContexts
- instantiate raw Web Audio nodes
- manage listeners
- connect directly to destination
- manage global audio state

All audio should flow through this service.

---

# Initial Bus Layout

Keep this intentionally simple.

```

master
├── music
├── ambience
├── world
└── ui

```

Do **not** over-engineer future buses.

Additional buses (dialogue, procedural, cinematics, Synod, etc.) can be added when real consumers exist.

---

# Phase 3 — Migration

Move all existing game audio onto the canonical runtime.

Behavior should remain unchanged.

The goal is architectural consolidation, not feature work.

---

# Phase 4 — Validation

Verify:

- one audio runtime
- proper cleanup
- no leaked audio objects
- listener follows active camera
- scene transitions cleanly dispose audio
- volume controls work correctly
- mute works globally

---

# Deliverables

## 1. Audio Architecture Review

Document:

- current state
- problems found
- proposed ownership model
- lifecycle
- future extension points

---

## 2. Canonical Audio Runtime

Implement the centralized runtime.

---

## 3. Migration

Update all existing audio consumers.

---

## 4. Documentation

Add a short developer document describing:

- how new audio should be added
- ownership rules
- lifecycle
- routing
- patterns to avoid

---

# Out of Scope

Do **not** implement:

- Synod harmonic engine
- radio broadcasts
- procedural music
- adaptive soundtrack
- cinematic scoring
- Tone.js migration
- audio authoring tools

Those are separate follow-up tasks.

---

# Architectural Principles

- Favor simplicity over flexibility.
- Build only what today's code requires.
- Preserve clear ownership.
- Avoid premature abstractions.
- Do not introduce additional audio runtimes.
- Make Babylon the canonical owner of game audio.

The Synod audio prototype should eventually become **a consumer of this runtime**, not its foundation.

---

# Success Criteria

When complete:

- every game sound flows through the canonical Babylon audio runtime
- audio ownership is centralized
- lifecycle is deterministic
- future systems have a stable integration point
- no gameplay code manages low-level audio directly

The codebase should be in a state where the next task can confidently begin migrating the Synod harmonic prototype into this architecture.
