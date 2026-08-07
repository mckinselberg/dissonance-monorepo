# Dissonance Audio Threads

Canonical thread index and reproducible task definitions derived from the current audio architecture discussion.

Status values:

- `active`
- `queued`
- `blocked`
- `parallel-safe`
- `experimental`
- `aspirational`

---

## Thread Index

### AUDIO-1 — Canonical Babylon Audio Runtime

- **Status:** active
- **Priority:** highest
- **Goal:** Establish Babylon.js as the canonical owner of game audio before adding significant new audio features.
- **Blocked by:** none
- **Blocks:** AUDIO-2, AUDIO-3, AUDIO-4
- **Scope:**
  - Audit the small amount of audio already implemented in the monorepo.
  - Determine whether Babylon Audio Engine V1 or V2 is in use.
  - Centralize audio initialization, routing, listener ownership, volume, mute, and teardown.
  - Migrate all existing audio consumers to the canonical runtime.
  - Ensure no feature code creates an independent `AudioContext`.
- **Out of scope:**
  - Synod harmonic system
  - radio content
  - procedural score
  - cinematic music
  - Tone.js migration
  - large audio-authoring systems
- **Success condition:** Every existing game sound flows through one Babylon-owned runtime with deterministic lifecycle and documented integration rules.

---

### AUDIO-2 — Extract the Synod Harmonic Domain

- **Status:** queued
- **Priority:** high
- **Blocked by:** AUDIO-1
- **Source prototype:** `mckinselberg/dissonance-frontend`
- **Live demo:** `https://dissonance-e7r6.onrender.com/`
- **Goal:** Extract the reusable, non-runtime musical concepts from the existing standalone prototype.
- **Scope:**
  - Preserve the current Synod scale and pure-interval comparison.
  - Extract cent-to-frequency conversion.
  - Extract tuning standards and tuning state.
  - Extract adaptive-layer definitions and risk thresholds.
  - Extract serializable note/sequence definitions.
  - Add characterization tests before changing semantics.
- **Out of scope:**
  - narrative interpretation
  - radio broadcasts
  - cinematic cue design
  - revising interval values
  - replacing Babylon as the game audio owner
- **Success condition:** Harmonic definitions and adaptive rules can be imported without React, DOM, Babylon, Tone, or raw Web Audio dependencies.

---

### AUDIO-3 — Babylon-Compatible Procedural Synod Renderer

- **Status:** blocked
- **Priority:** high
- **Blocked by:** AUDIO-1, AUDIO-2
- **Goal:** Reproduce the existing Synod prototype through the canonical Babylon-owned audio runtime.
- **Scope:**
  - Render the existing oscillators, gain envelopes, drones, adaptive layers, crossfades, and retuning.
  - Preserve audible behavior before adding new features.
  - Route generated audio through the game mixer.
  - Avoid creating another audio context or master tree.
  - Establish clear ownership and disposal.
- **Open decision:** Use Babylon-supported procedural audio facilities directly, or use the native Web Audio context beneath Babylon where required.
- **Tone.js rule:** Do not introduce Tone merely to replace raw oscillator calls. Add it only if later sequencing or synthesis requirements justify it.
- **Success condition:** The standalone prototype’s essential behavior runs inside the monorepo and through the canonical audio runtime.

---

### AUDIO-4 — Audio Lab Port

- **Status:** blocked
- **Priority:** medium
- **Blocked by:** AUDIO-2, AUDIO-3
- **Goal:** Preserve the standalone demo as an in-monorepo audio development workbench.
- **Scope:**
  - Port useful playgrounds and controls.
  - Provide interval, chord, tuning, adaptive-layer, sequence, and runtime-diagnostic views.
  - Consume the same domain and runtime packages used by the game.
  - Keep the lab separate from production game UI.
- **Success condition:** Audio concepts can be auditioned and debugged without launching the full game, with no duplicate implementation.

---

### AUDIO-5 — Minimal Game Integration

- **Status:** blocked
- **Priority:** medium
- **Blocked by:** AUDIO-3
- **Goal:** Prove that the Synod renderer can be safely consumed by the game before implementing narrative systems.
- **Initial integration:**
  - trigger one named interval;
  - set a base tuning;
  - change one adaptive intensity/risk value;
  - start and stop one continuous layer;
  - route through a debug surface or dev lineglass;
  - verify cleanup across scene transitions.
- **Out of scope:**
  - radio station
  - cinematic sequence
  - full adaptive soundtrack
- **Success condition:** One small production-shaped consumer works end to end.

---

### AUDIO-6 — Synod Radio and Cinematic Harmonic Language

- **Status:** aspirational
- **Priority:** later
- **Blocked by:** AUDIO-2, AUDIO-3, AUDIO-5
- **Goal:** Use the mature Synod harmonic system as a diegetic cinematic language for radio, public messaging, and environmental contradiction.
- **Important constraint:** The radio must consume the established sound system. It must not define or prematurely freeze the sound architecture.
- **Potential later concerns:**
  - consonant public reassurance;
  - dissonant attention or compliance cues;
  - weak counter-transmissions;
  - location-specific interference;
  - authored cinematic timing;
  - speech and environmental mixing;
  - recurring harmonic motifs.
- **Success condition:** Narrative use is derived from tested musical capabilities rather than invented in parallel.

---

## Reproduced Thread: AUDIO-1 — Canonical Babylon Audio Runtime

### Task

Establish a canonical Babylon.js audio runtime for the Dissonance monorepo.

The project currently has little audio implemented. Use this opportunity to establish the correct foundation before audio spreads through gameplay systems.

The result must provide:

- one game audio runtime;
- one listener ownership model;
- one master routing tree;
- one initialization and unlock flow;
- one lifecycle and disposal model;
- one approved integration path for future audio.

Do not begin porting the Synod audio prototype during this task.

### Required Working Method

Before modifying architecture:

1. Inspect repository conventions.
2. Inventory all existing audio code and assets.
3. Identify every audio call site.
4. Determine the Babylon audio API currently in use.
5. Document the current audio lifecycle.
6. Propose the smallest viable canonical runtime.
7. Implement in reviewable slices.

Do not impose package names, folder conventions, dependency patterns, or service patterns that conflict with the repository.

Do not use the `@dta/*` namespace. This work belongs to Dissonance unless explicitly noted otherwise.

### Audit Requirements

Identify:

- music playback;
- ambient audio;
- world and positional sounds;
- UI sounds;
- cinematic or narrative audio;
- audio asset loading;
- global mute and volume behavior;
- audio-context creation;
- listener creation and updates;
- scene transition behavior;
- teardown and disposal;
- direct Web Audio use;
- Tone.js use;
- Babylon audio use;
- duplicate or competing audio trees.

Determine:

- Babylon Audio Engine V1 or V2;
- who creates and owns the audio engine;
- whether audio is app-scoped, scene-scoped, or feature-scoped;
- whether more than one `AudioContext` exists;
- whether the active camera correctly drives the listener;
- whether sounds survive scene teardown unintentionally.

### Target Ownership

Babylon should be the canonical owner of game audio.

Feature code must not:

- construct independent `AudioContext` instances;
- create global listeners;
- connect directly to a browser destination;
- bypass the game mixer;
- retain sounds after its owning scope is disposed;
- create another top-level audio tree.

### Initial Routing

Keep the first bus structure intentionally small:

```text
master
├── music
├── ambience
├── world
└── ui
```

Do not add speculative buses for dialogue, procedural audio, cinematics, radio, Synod, vehicles, or factions until real consumers require them.

The architecture may expose a safe way to add buses later.

### Runtime Responsibilities

The canonical runtime should own or coordinate:

- initialization;
- browser audio unlock/resume;
- Babylon audio-engine access;
- listener synchronization;
- master volume;
- global mute;
- bus volume;
- sound creation;
- positional-sound creation;
- routing;
- scoped cleanup;
- complete disposal.

A possible API shape may resemble:

```ts
export interface GameAudioRuntime {
  initialize(): Promise<void>;

  setMasterVolume(value: number): void;
  setMuted(muted: boolean): void;
  setBusVolume(bus: AudioBusId, value: number): void;

  playOneShot(request: OneShotRequest): PlaybackHandle;
  createSpatialSound(request: SpatialSoundRequest): SpatialSoundHandle;

  stopScope(scope: AudioScope): void;
  dispose(): void;
}
```

This is illustrative, not mandatory. Adapt to repository conventions and Babylon’s actual API.

### Migration

Migrate every existing audio consumer to the canonical runtime.

Preserve existing behavior unless a defect prevents correct ownership or cleanup.

For each migrated consumer, verify:

- correct output bus;
- correct lifetime;
- correct positional behavior where applicable;
- correct volume behavior;
- correct disposal;
- no direct audio-context creation;
- no bypass of canonical routing.

### Validation

Verify:

- only the intended audio context exists;
- active camera/listener behavior is correct;
- scene transitions do not leak sounds;
- global mute works;
- master volume works;
- bus volume works;
- positional sound follows its owner;
- disposed objects no longer produce sound;
- repeated scene entry does not duplicate playback;
- current audio remains perceptually equivalent.

Add focused tests where repository infrastructure supports them.

### Documentation

Add a concise developer document covering:

- where the runtime lives;
- who initializes it;
- how feature code plays a sound;
- how positional sounds are attached;
- how ownership scopes work;
- how to route to a bus;
- how to dispose;
- how to add a future bus;
- prohibited patterns.

### Explicitly Out of Scope

Do not implement:

- Synod scale generation;
- pure-interval comparison;
- adaptive Synod music;
- radio broadcasts;
- procedural music;
- cinematic scoring;
- Tone.js migration;
- an audio lab;
- a universal audio framework;
- speculative multiplayer audio synchronization.

### Deliverables

1. Current-state audio audit.
2. Proposed canonical architecture.
3. Central Babylon-owned runtime.
4. Migration of every current consumer.
5. Tests or validation notes.
6. Developer documentation.
7. Summary of remaining risks and next steps.

### Completion Criteria

This thread is complete when:

- every existing game sound uses the canonical runtime;
- Babylon owns the game audio lifecycle;
- audio ownership and teardown are deterministic;
- no feature creates a competing audio context or tree;
- the path for future audio features is documented;
- the codebase is ready for AUDIO-2 and AUDIO-3.

---

## Reproduced Thread: AUDIO-2 — Extract Synod Harmonic Domain

### Source

Standalone repository:

```text
mckinselberg/dissonance-frontend
```

Live reference:

```text
https://dissonance-e7r6.onrender.com/
```

### Goal

Extract reusable musical-domain code from the standalone prototype without porting its current React and Web Audio ownership model.

### Preserve Before Refactoring

Preserve current behavior and concepts, including:

- `SYNOD_SCALE`;
- `PURE_INTERVALS`;
- cent-to-frequency conversion;
- tuning-standard values;
- named Synod intervals;
- five adaptive risk layers;
- current thresholds;
- current layer intervals;
- current target gains;
- sawtooth Synod timbre;
- pure sine comparison;
- 2-second crossfades;
- approximately 100 ms pitch glide;
- note-duration controls;
- recorded-note semantics.

Do not revise the musical theory during extraction.

### Known Areas to Inspect

The current prototype appears to combine:

- harmonic data;
- frequency mathematics;
- narrative labels;
- mutable tuning state;
- frequency listeners;
- adaptive layer definitions;
- React lifecycle;
- raw Web Audio construction;
- keyboard handling;
- recording and playback;
- design notes.

Separate only where a real dependency boundary exists.

### Runtime-Neutral Destination

The extracted domain must not depend on:

- React;
- DOM globals;
- Babylon;
- Tone.js;
- `AudioContext`;
- `OscillatorNode`;
- `GainNode`.

Candidate concepts:

```ts
export type IntervalSet = Readonly<Record<string, number>>;

export interface AdaptiveLayerDefinition {
  readonly id: string;
  readonly threshold: number;
  readonly intervalsCents: readonly number[];
  readonly gain: number;
  readonly waveform: WaveformId;
}

export interface NoteEvent {
  readonly cents: number;
  readonly startSeconds: number;
  readonly durationSeconds: number;
  readonly velocity?: number;
}
```

Names and shapes must follow monorepo conventions after inspection.

### Characterization Tests

Add tests for:

- cents-to-frequency conversion;
- tuning conversions;
- exact scale values;
- adaptive threshold resolution;
- gain-target resolution;
- sequence ordering;
- duration preservation;
- deterministic behavior where randomness exists;
- invalid-input behavior.

### Known Prototype Risks to Verify

Investigate and document:

- stale `BASE_FREQUENCY` exports;
- module-global mutable tuning;
- listener cleanup;
- multiple audio contexts;
- delayed playback scheduling;
- React effect stale closures;
- oscillator and gain-node disconnection;
- recording timing behavior.

Do not silently fix behavior before it is characterized.

### Completion Criteria

This thread is complete when:

- reusable harmonic definitions exist in the monorepo;
- tests preserve current behavior;
- no runtime dependency is required to import them;
- the standalone prototype or ported lab can consume the extracted definitions;
- no narrative radio system has been implemented.

---

## Reproduced Thread: AUDIO-3 — Babylon-Compatible Synod Renderer

### Goal

Implement the current Synod prototype’s audio behavior as a consumer of the canonical Babylon audio runtime.

### Required Constraints

- Babylon remains the owner of game audio.
- Do not create another top-level audio context.
- Do not connect feature nodes directly to browser destination.
- Route through a runtime-provided bus.
- Keep harmonic definitions runtime-neutral.
- Preserve behavior before expanding capability.
- Do not introduce Tone.js unless a concrete requirement justifies it.

### First Renderer Capabilities

Implement only what the prototype currently needs:

- play one interval;
- play one chord;
- create short gain envelopes;
- create continuous oscillator layers;
- crossfade layer gains;
- retune layers smoothly;
- stop and dispose layers;
- play a recorded note sequence;
- route all output through the canonical mixer.

### Technical Spike

Before committing to a large implementation:

1. Obtain the native audio context through the supported Babylon runtime path.
2. Create one procedural oscillator.
3. Route it through the canonical bus.
4. Confirm global volume and mute affect it.
5. Confirm scene teardown disposes it.
6. Confirm no second context is created.
7. Test spatialization only if a real initial consumer requires it.

Document any need to use lower-level Web Audio nodes beneath Babylon.

### Completion Criteria

This thread is complete when:

- the core Synod prototype can be reproduced in the monorepo;
- output participates in the canonical mixer;
- lifecycle is deterministic;
- one small game consumer can use it;
- no radio or cinematic API has been added prematurely.

---

## Dependency Order

```text
AUDIO-1 Canonical Babylon Audio Runtime
    ↓
AUDIO-2 Extract Synod Harmonic Domain
    ↓
AUDIO-3 Babylon-Compatible Synod Renderer
    ↓
AUDIO-4 Audio Lab Port
    ↓
AUDIO-5 Minimal Game Integration
    ↓
AUDIO-6 Radio and Cinematic Harmonic Language
```

AUDIO-2 may begin in parallel with late AUDIO-1 work only when its changes remain strictly runtime-neutral and do not assume the final mixer or lifecycle API.

---

## Repository Rules Captured in This Thread Set

- Dissonance packages must not use the `@dta/*` prefix unless explicitly requested.
- Babylon should own the game’s audio lifecycle and spatial context.
- The Synod harmonic language should remain independent of its renderer.
- Tone.js is optional, not foundational.
- A second audio tree must not be created.
- The radio system is a future consumer, not a current architectural driver.
- Preserve the existing demo as a behavioral and musical reference.
- Prefer small, reviewable migration slices.
- Do not overbuild speculative buses or packages.
