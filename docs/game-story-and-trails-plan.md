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

1. Add a second trail inside the current forest generator with distinct landmarks.
2. Extract trail definitions into data: name, waypoints, artifact, destination, encounter tuning.
3. Replace the single destination with trail objectives and return-to-car flow.
4. Add a simple map screen for choosing trails.
5. Introduce artifact inventory and story log entries.
