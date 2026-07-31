# Rey Caverns concept v1

**Thread:** T33 — Rey Caverns and the gatekeepers

**Status:** provisional name / gated concept

**Parent:** T32 underground network

## Current decisions

- **Name:** `Rey Caverns` is the working canon name for now.
- **Culture:** in development; do not infer a resistance faction, sanctuary,
  settlement hierarchy, costume language, or shared ideology.
- **Trust economy:** in development; do not create reputation points, dialogue
  gates, favors, tiers, or terminal/receiver awards yet.
- **Tonal language:** parked. It depends on the separate Dissonance Audio HUD
  repository, which has not yet been adapted to this monorepo.
- **Spatial gate:** inhabited space beyond Milo's workshop and its validation
  hallway remains inaccessible.

The earlier architectural-lithophone direction remains provisional. No tuned
stone, mallet system, tonal lock, or playable instrument should be implemented
until the Audio HUD dependency and tonal-language rules arrive.

## Boundary teaser: the lurker

One simple human-like figure may appear at the far edge of the existing
workshop hallway. This is a boundary read, not an authored inhabitant:

- stable ID: `rey-caverns-lurker-01`;
- visible at a distance and physically human-like, but deliberately
  undescribed;
- flees deeper when Milo approaches or illuminates it with the flashlight;
- never approaches, attacks, speaks, gestures, drops inventory, or opens the
  gate;
- disappearance sets a durable one-shot story flag;
- a Dev HUD reset may restore it for authoring.

The figure confirms only that someone was present. It does not identify a
gatekeeper, establish Rey culture, explain the predecessor, or answer whether
the Synod knows about the underground.

## Implementation boundary

The far hallway gate remains closed to Milo. The figure can retreat through
that boundary because it is presentation, not a player traversal affordance.
No space beyond the current corridor is rendered as explorable or assigned
story interactions.
