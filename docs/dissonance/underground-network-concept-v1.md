# Underground network concept v1

**Thread:** T32 — underground network (stratum)  
**Status:** provisional concept / implementation contract  
**First authored node:** crater shelter and Milo's workshop  
**Downstream:** T31 interference hardware; T33 cavern-hub and gatekeepers

## Purpose

The underground is the pre-Synod infrastructural layer beneath the watched
surface: utility tunnels, service passages, drainage, abandoned transit, and
rooms whose original functions overlap imperfectly. It makes SignalNet's
negative space walkable.

It is not a separate fantasy underworld, a safe-player hub, or proof that the
Synod cannot reach below ground. Whether the network is unreachable,
tolerated, forgotten, or quietly observed remains unresolved.

The depth transition carries the camera grammar:

- surface and monitored interiors may become system-legible;
- private underground space remains first-person;
- descending should feel like leaving a readable field, not entering a menu.

## Topology

The network uses **authored nodes joined by authored-seed procedural
corridors**.

```text
crater shelter
  -> threshold vestibule
  -> service corridor
  -> Milo's workshop (solitary pole)
  -> locked utility continuation
  -> future infrastructure nodes
  -> T33 cavern-hub (inhabited pole; not yet authored)
```

Authored nodes own story interactions, distinctive silhouettes, inventory
surfaces, exits, and hazards. Corridors own traversal rhythm, orientation
pressure, acoustic continuity, and reusable infrastructure language.

Version 1 stops at the workshop's locked continuation. It must imply a larger
network without generating unreachable or narratively active destinations.

## Entrance rule

Every entrance is a real surface feature with stable geographic identity.
T32's first entrance is the half-buried crater shelter in `locations.json`.
The threshold has four ordered reads:

1. dense vegetation and fencing conceal the civic-scale concrete form;
2. the consonant exterior locator grows legible on approach;
3. the sound cuts at the physical doorway;
4. first-person movement continues through the interior without a level-menu
   fiction.

Reloading inside an underground node resumes at the last safe exterior
transform. Interior cameras and generated corridor instances are runtime
resources, not durable player transforms; see `world-save-contract.md`.

## Corridor generation contract

Corridors are deterministic from a network seed and authored endpoint IDs.
Generation must produce metadata before meshes:

```ts
type UndergroundCorridor = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  seed: number;
  segments: UndergroundSegment[];
};

type UndergroundSegment = {
  kind: 'straight' | 'bend' | 'junction' | 'grade' | 'service-bay';
  length: number;
  headingDegrees: number;
  elevationDelta: number;
  widthClass: 'crawl' | 'service' | 'transit';
  hazardSlots: string[];
};
```

Rules:

- endpoints and stable IDs are authored; connective variation is seeded;
- every generated route must be reversible and collision-valid;
- no junction advertises a traversable branch unless that branch exists;
- bends interrupt sightlines, but never become a featureless maze;
- grade changes remain compatible with player collision and the chosen
  vertical exaggeration;
- repeated modules receive controlled material, prop, damage, and utility-run
  variation;
- generation never places story flags, unique inventory, named characters, or
  canon-bearing evidence.

## Orientation language

The player navigates without a minimap-specific underground exception.
Orientation comes from persistent physical systems:

- utility runs retain color/material identity through connected segments;
- water direction and floor grade establish a downhill reading;
- numbered maintenance bays provide sparse, non-expository landmarks;
- distant mechanical beds leak from authored destinations;
- the return route remains visually distinguishable after each junction.

Procedural variation may complicate a route but cannot erase these invariants.

## Acoustic rules

The underground is off-SignalNet in presentation, not acoustically empty.
Enclosure makes the player's sound feel owned again while also making its
consequences harder to localize.

- Tone.js remains the only audio owner.
- Rooms and corridor classes select authored acoustic profiles.
- The surface locator alarm is absent beyond the first threshold.
- Utility machinery and water are environmental beds, not navigation speech.
- T33's lithophone is not ambient decoration and does not appear before its
  social/interaction contract exists.

## Hazard budget

The underground cannot become an unconditional sanctuary. V1 permits only
systemic, non-combat hazards:

- unstable or flooded routes that alter traversal;
- electrical/utility cycling that changes timing and visibility;
- ambiguous evidence of recent maintenance;
- acoustic occlusion that hides both threats and safety cues.

No hazard may resolve the Synod-scope question. No monster roster, damage
spectacle, pursuit population, or supernatural sound behavior is authorized by
this concept document.

## Authored-node boundary

An authored node is required when a place:

- sets or consumes story progression;
- contains unique inventory or a diegetic workstation;
- changes camera/session grammar;
- has named social ownership;
- needs a unique hazard resolution;
- carries evidence whose exact arrangement matters.

The workshop qualifies on the first three grounds. Its benches and shelves
will become inventory-as-room surfaces for recovered hardware, but only after
the relevant T31 beat is authorized. T33 qualifies as a future authored node,
but remains blocked on its name, trust economy, and tonal-language design.

## Implementation order

1. Validate the existing shelter/workshop vertical slice against this contract.
2. Extract an app-local underground node/session contract from the second
   concrete consumer—not before.
3. Author the locked workshop continuation and one short deterministic test
   corridor with metadata and collision diagnostics.
4. Prove reversible traversal, reload recovery, and acoustic transition.
5. Only then design another authored node.

T31 v2 hardware construction and T33 remain out of scope for this sequence.

## V1 validation slice

The workshop rear wall now contains a locked utility portal backed by one
seeded three-segment corridor (`straight → bend → service-bay`). The corridor
is built from metadata, validates stable/unique IDs and connected endpoints,
and proves that reversing the segment sequence returns through the same
endpoints. Its floor, ceiling, and two walls per segment are collision meshes.

The T32 Dev HUD reports topology validity, segment/collider counts, and reverse
validity. A debug-only unlock opens the workshop gate so the corridor can be
walked in both directions without making it canonical progression.

Production build validation is complete. Manual full-speed checks remain
required for wall seams, the small elevation step, camera collision, and
returning through the unlocked portal on the slow authoring machine.

The corridor visibility gate reuses `@dissonance/player`'s extracted
camera-carried flashlight. Milo's persisted flashlight state follows the
active first-person camera across the exterior/workshop threshold; `L` toggles
it, and the T32 Dev HUD exposes the same control. This is illumination for
traversal validation, not a new inventory or acquisition beat.
