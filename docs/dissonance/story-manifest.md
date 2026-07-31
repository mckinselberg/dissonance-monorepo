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

## First beats: workshop discovery; strike → recovery

1. Entering the workshop workbench zone sets `workshopDiscovered`.
2. Independently, proximity plus witnessed LOS permits the seeded Boulevard
   strike gate to arm; it has no workshop prerequisite.
3. A witnessed completed strike sets `droneStrikeWitnessed`.
4. Recovering the inert drone sets `emitterAcquired` and
   `chassisRecovered`.

This manifest ends at acquisition. Emitter construction, interference,
piloting, repair, and loss remain separate later beats.

## Rey Caverns boundary

The one-shot `glimpse-rey-caverns-lurker` beat sits after workshop discovery
without unlocking inhabited space. Proximity or direct flashlight illumination
causes the stable figure `rey-caverns-lurker-01` to flee through the far
hallway boundary and sets `reyLurkerFled`. The event grants no inventory,
trust, dialogue, access, or cultural information.

## Runtime consumer

World validates the manifest version, beat IDs, location references, flag
ordering, triggers, and statuses at startup. Its app-local story store persists
resolved flags in browser storage and applies beats only when their
prerequisites are satisfied.

Both strands are live: entering the crater shelter permanently silences its
exterior locator alarm and reaching the workbench sets `workshopDiscovered`;
separately, T31 records the witnessed strike and recovery records both acquired
parts. The HUD checkbox remains as an explicit persistent debug override for
slow-machine strike authoring.

## Required integration follow-up

Before adding another gameplay beat, audit and consolidate the World game-state
and player-state seams. The current vertical slice spans three independent
stores: level/view settings in `settingsStorage`, narrative flags in the
app-local story store, and the older `@dissonance/persistence`
`PlayerPersistence` contract. Interior routing is also split between
`WorldSessionCoordinator` and the workshop session.

The follow-up must establish explicit ownership and one versioned save boundary
for durable player progression without folding temporary presentation or Dev
HUD tuning into game state. At minimum, verify:

- exterior/interior route and return transforms survive save/reload safely;
- story flags, recovered hardware, and Lineglass inventory have stable IDs and
  restore atomically;
- traversal/camera state cannot continue updating behind an active interior;
- debug overrides are visibly separate from canonical progression;
- the archived museum app and its existing save key are not migrated or
  overwritten by World.

This audit landed in the versioned contract documented by
`docs/dissonance/world-save-contract.md`. Treat its build and reload checks as
a mandatory gate before T31 v2 hardware construction, T35 network expansion,
or T36 trust progression.
