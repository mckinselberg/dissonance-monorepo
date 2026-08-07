import type { Beat, Intent, NarrativeEvent, NarrativeState, WorldManifest } from './types';

// Absence of a zone from the manifest defaults to the widest band (4) — the
// eng doc's own thematic default: absence of Synod control = maximal
// dissonance. Do not change this to a restrictive default.
function bandAllows(manifest: WorldManifest, zone: string | null, readingCount: number): boolean {
  const max = manifest.bands[zone ?? ''] ?? 4;
  return readingCount <= max;
}

function cloneState(state: NarrativeState): NarrativeState {
  return {
    proximityTicks: { ...state.proximityTicks },
    capabilities: { ...state.capabilities },
    companions: { ...state.companions },
    deviance: state.deviance,
    devianceWeights: { ...state.devianceWeights },
    since: { ...state.since },
    zone: state.zone,
    rng: state.rng,
  };
}

// Deterministic algorithm per eng-ambiguity-placement-v1.md §2:
// filter by `when` -> band filter -> once filter -> collect intents (tagged
// by beat id for a stable sort) -> apply state-changing intents -> sort ->
// return. `state` is never mutated; `next` is returned instead.
export function reduce(
  state: NarrativeState,
  event: NarrativeEvent,
  registry: Beat[],
  manifest: WorldManifest,
): { state: NarrativeState; intents: Intent[] } {
  const next = cloneState(state);
  const zone = event.zone ?? state.zone;

  const firing = registry
    .filter((beat) => beat.when(state, event))
    .filter((beat) => bandAllows(manifest, zone, beat.readingCount))
    .filter((beat) => !(beat.once && state.since[beat.id] !== undefined));

  const tagged: { beatId: string; intent: Intent }[] = [];
  for (const beat of firing) {
    for (const intent of beat.emits(state, event)) {
      tagged.push({ beatId: beat.id, intent });
    }
  }
  // Sort by beat id then intent kind so registry order never affects output
  // (purity gate: reorder registry -> identical sorted intents).
  tagged.sort((a, b) => {
    if (a.beatId !== b.beatId) return a.beatId < b.beatId ? -1 : 1;
    return a.intent.kind < b.intent.kind ? -1 : a.intent.kind > b.intent.kind ? 1 : 0;
  });

  for (const { intent } of tagged) {
    if (intent.kind === 'mark-fired') {
      next.since[intent.key] = intent.t;
    } else if (intent.kind === 'capability-grant') {
      next.capabilities[intent.capability] = true;
    } else if (intent.kind === 'companion-keep') {
      next.companions[intent.id] = true;
    } else if (intent.kind === 'resolve-profile') {
      next.deviance += intent.delta;
    }
    // surface / shift-ambient / sound-cue / present-inventory are
    // delivery-only requests — they never change narrative state (§2 step 6).
  }

  return { state: next, intents: tagged.map((t) => t.intent) };
}
