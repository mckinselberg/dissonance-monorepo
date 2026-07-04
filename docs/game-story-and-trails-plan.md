# Game Story & Trail Expansion Plan

## Core Pitch

The player is sent into a network of remote forest trails to recover artifacts tied to local disappearances. Each trail is a separate playable site with its own terrain, landmarks, weather, artifact, and forest devil behavior. Between hikes, the player drives from location to location on a regional map.

## Loop

1. Pick a trailhead from the map.
2. Drive there and enter the trail.
3. Explore, read environmental clues, and locate the assigned artifact.
4. Avoid or repel forest devils long enough to return to the car.
5. Bring artifacts back to unlock new trails, story fragments, and harder encounters.

## Trail Map Structure

The map should show named trailheads as physical locations rather than abstract levels. Early version: a flat illustrated map UI with selectable nodes. Later version: a short drivable road scene connecting trailheads, ranger lots, gas stations, and blocked roads.

Example trail nodes:

- `Morrow Pine Loop`: first trail, phone/light tutorial, one pursuer.
- `Blackwater Spur`: wetland trail, low fog, sound misdirection.
- `Glass Ridge`: exposed rock trail, long sightlines, stronger flashlight tension.
- `Old Survey Road`: abandoned maintenance route, car-centric clues.
- `Stonejaw Ridge`: rocky mountain trail, loose stone markers, exposed switchbacks, sparse tree cover.
- `Devil's Acre`: late-game site, multiple devils, artifact ritual payoff.

## Artifacts

Artifacts should feel mundane but wrong: survey tags, cassette tapes, carved trail markers, rusted bells, missing-person charms, antler fragments, and radio parts. Each artifact teaches one piece of the forest-devil mythology.

## Forest Devils

Keep the pursuer as the base devil archetype: unseen pressure, proximity audio, and brief visual confirmation. Add variants per trail instead of making a generic enemy roster:

- Watcher: punishes direct staring and spawns eyes.
- Mimic: repeats car alarms, footsteps, and phone sounds.
- Stalker: retreats from flashlight but circles faster.
- Warden: blocks trails and forces detours.

## Near-Term Implementation Steps

1. Playtest the current survey-tag objective loop.
2. Add a simple map screen for choosing trails.
3. Introduce artifact inventory and story log entries.
4. Add a rocky mountain trail definition and landscape pass.
5. Start replacing hard-coded trail geometry with trail-specific data.

## Current Execution Plan

Completed from notes:

- Remove run-count difficulty from Dev HUD and game state.
- Remove spawn-eyes controls from Dev HUD.
- Add a second trail with distinct survey markers.
- Add artifact pickup and return-to-car objective flow.
- Improve pursuer readability with a more humanoid body.
- Add car alarm as the destination audio identity.
- Add mountain billboards with a world boundary.
- Add PS3 visual mode with denser forest detail, richer ground cover, and stronger atmosphere.
- Fix mountain anchoring so the backdrop reads as fixed world geometry.
- Add pursuer growls for near and close proximity pressure.
- Give the pursuer a first-pass humanoid gait with leaning, bobbing, and flashlight reactions.
- Reduce player disorientation intensity.
- Add a full-sprint stamina cap so the player must stop and catch breath.
- Make the car sleeker with lower sedan proportions and tapered cabin geometry.
- Add forest-ground player footsteps, heavier pursuer footsteps, proximity tree rustles, and clearer fatigue breathing.
- Tune pursuer approach pacing so close encounters leave a short reaction window for flashlight use.
- Add the phone as an immediate collectible inventory item that unlocks flashlight use.
- Add selectable trails to the title flow, starting with `Morrow Pine Loop` and `Stonejaw Ridge`.
- Add `Stonejaw Ridge` as a rocky trail variant with cairns, scree, a stone-marker artifact, and a separate car destination.

Next polish targets:

- Playtest the `Stonejaw Ridge` route for artifact readability, car-alarm guidance, and close-cover pacing.
- Tune ridge-specific forest density, rock collision, and pursuer pacing after playtest.

Next expansion targets:

- Give each trail a clearer artifact, trailhead, route shape, landmark set, and forest-devil behavior profile.
- Build the first version of the regional map with selectable trailheads.
