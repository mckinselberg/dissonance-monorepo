# Runtime Story Manifest

`apps/world/public/data/story-beats.json` is the structured record of causal
story beats in World. It complements, rather than replaces, the prose canon in
`docs/THREADS.md`.

## Separation of responsibilities

- `locations.json` owns stable geographic identity and authored placement.
- `story-beats.json` owns prerequisites, triggers, and resulting story flags.
- Runtime systems own verbs and presentation.
- The app-local story state owns the versioned, persisted resolved flag set.

A story beat references a `locationId` from `locations.json`; it does not copy
coordinates. Moving a location therefore moves its associated story without
rewriting narrative data.

## Beat contract

```ts
type StoryBeat = {
  id: string;
  locationId: string;
  trigger:
    | { kind: 'zone-enter'; zoneId: string }
    | { kind: 'system-event'; event: string }
    | { kind: 'interaction'; target: string };
  requires: string[];
  sets: string[];
  once: boolean;
  status: 'planned' | 'implemented';
};
```

IDs are stable lowercase kebab-case. Flags are stable lower camel case.
`status` describes implementation readiness only; it is not player state.

## First chain: workshop → strike → recovery

1. Entering the workshop workbench zone sets `workshopDiscovered`.
2. That flag permits the seeded Boulevard strike gate to arm.
3. A witnessed completed strike sets `droneStrikeWitnessed`.
4. Recovering the inert drone sets `emitterAcquired` and
   `chassisRecovered`.

This manifest ends at acquisition. Emitter construction, interference,
piloting, repair, and loss remain separate later beats.

## Runtime consumer

World validates the manifest version, beat IDs, location references, flag
ordering, triggers, and statuses at startup. Its app-local story store persists
resolved flags in browser storage and applies beats only when their
prerequisites are satisfied.

The first chain is live end to end: entering the crater shelter permanently
silences its exterior locator alarm, reaching the workshop workbench sets
`workshopDiscovered`, T31 records the witnessed strike, and recovery records
both acquired parts. The HUD checkbox remains as an explicit persistent debug
override for slow-machine strike authoring.
