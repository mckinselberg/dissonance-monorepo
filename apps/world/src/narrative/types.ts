// Pure, game-agnostic narrative-reducer types. This module is the engine
// half of docs/intake/{pattern,eng}-ambiguity-placement-v1.md.
//
// Per THREADS.md T40, this stays an app-local module (not a @culture/narrative
// package): DTA is permanently out of scope for new work (CLAUDE.md) and no
// second consumer exists yet, so per CLAUDE.md's "reuse before extract" there
// is nothing to share. Promote wholesale if a second real consumer appears.
//
// HARD RULE (G3, canon doc §0): nothing in this file may name a Dissonance
// noun, and NarrativeState may only ever record that something happened (a
// condition), never what it means (a conclusion). Content — beats, copy,
// zone data — lives in ../lore, never here.
//
// Note this is a distinct concept from ../state/story.ts's StoryBeat/
// applyBeat, an existing flag requires/sets progression-gate system (e.g.
// `witness-boulevard-drone-strike`). That system stores plain boolean
// conditions for gating content; this one is specifically for ambiguity that
// must never resolve into a stored verdict. They are not meant to merge.

export type ReadingCount = 1 | 2 | 3 | 4;

export type Scope = 'local' | 'relational' | 'systemic';

export interface NarrativeState {
  // counts
  proximityTicks: Record<string, number>; // subjectId -> ticks near player
  // capability flags — flags on the PLAYER'S ability, never on a subject's nature
  capabilities: Record<string, boolean>;
  // what the player is carrying/keeping (an action record, NOT a nature verdict)
  companions: Record<string, boolean>;
  // numeric weights
  deviance: number;
  devianceWeights: Record<string, number>;
  // timestamps — the ONLY way "already happened once" is recorded
  since: Record<string, number>;
  // world-state
  zone: string | null;
  // rng — splitmix32 state
  rng: number;
}

export function createNarrativeState(seed = 1): NarrativeState {
  return {
    proximityTicks: {},
    capabilities: {},
    companions: {},
    deviance: 0,
    devianceWeights: {},
    since: {},
    zone: null,
    rng: seed,
  };
}

export interface NarrativeEvent {
  t: number; // loop tick, host-stamped. THE ONLY source of time.
  kind: string;
  subject?: string;
  zone?: string;
}

export type Intent =
  | { kind: 'surface'; id: string; subject: string; via: string; readingCount?: ReadingCount; scopes?: Scope[] }
  | { kind: 'shift-ambient'; zone: string; toward: string }
  | { kind: 'resolve-profile'; entity: string; delta: number }
  | { kind: 'sound-cue'; bus: string; cue: string }
  | { kind: 'capability-grant'; capability: string }
  | { kind: 'present-inventory'; surface: string; source: string }
  | { kind: 'mark-fired'; key: string; t: number }
  // Extension beyond the intake eng doc's own Intent union: that doc defines
  // NarrativeState.companions (§1.2) but its §1.4 Intent union never actually
  // specifies how it gets written. Added here, same shape as capability-grant,
  // pending a future pass reconciling this back into the canon doc.
  | { kind: 'companion-keep'; id: string };

export interface Beat {
  id: string;
  tier: 'CANON' | 'PROVISIONAL' | 'EXPERIMENTAL' | 'PARKED';
  readingCount: ReadingCount; // declared; must match actual legibility
  scopes: Scope[];
  when: (state: NarrativeState, event: NarrativeEvent) => boolean; // PURE
  emits: (state: NarrativeState, event: NarrativeEvent) => Intent[]; // PURE, deterministic
  once: boolean; // once-only via `since`, never a stored flag
  readings: string[]; // inert documentation; length should equal readingCount
}

export interface WorldManifest {
  bands: Record<string, ReadingCount>; // zoneId -> max readings allowed there
  // Placement[] is deliberately not modeled yet — no find/observe world
  // object exists to place. Add it here when the first real one lands
  // (see THREADS.md T40/T26).
}
