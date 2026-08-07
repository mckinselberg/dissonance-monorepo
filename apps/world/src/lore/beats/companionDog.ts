import type { Beat } from '../../narrative';
import { cond, mark } from '../conditions';

const DOG_FIRST_PET_KEY = 'dog-first-pet';

// The canon doc's own worked example (pattern-ambiguity-and-placement-v1.md
// §1): ontological (real animal / mech construct) crossed with relational
// (your pet / merely along for a while) = four live readings, none ever
// resolved. First real content wired against the live companion dog
// (../../pursuer/MechDogController) — see THREADS.md T40.
//
// Deliberately does not read MechDogController's `skin` signal (default vs
// black reskin): that signal is a dev-HUD asset-QA toggle, not in-fiction
// state. Branching a reading on it would make the render asset double as a
// stored conclusion — exactly the trap canon doc §2 warns against.
//
// Fires once, on the first pet. Repeated pets do nothing narratively; the
// once-gate is a `since` timestamp, never a stored verdict about what the
// dog is (canon doc §1's "narrow is not concluded").
export const companionDogAmbiguityBeat: Beat = {
  id: 'companion-dog-ambiguity',
  tier: 'EXPERIMENTAL',
  readingCount: 4,
  scopes: ['local', 'relational'],
  once: true,
  when: (state, event) =>
    cond.event(event, 'companion:pet') && cond.notYetFired(state, DOG_FIRST_PET_KEY),
  emits: (_state, event) => [
    {
      kind: 'surface',
      id: 'companion-dog-first-pet',
      subject: 'companion-dog',
      via: 'console',
      readingCount: 4,
      scopes: ['local', 'relational'],
    },
    { kind: 'companion-keep', id: 'companion-dog' },
    mark.fired(DOG_FIRST_PET_KEY, event.t),
  ],
  readings: [
    'a real animal, and it is genuinely yours now',
    'a real animal, only along for a while',
    'a mech construct, and it has become yours in every way that matters',
    'a mech construct, merely accompanying you',
  ],
};
