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
- Give `Stonejaw Ridge` first-pass trail-specific tuning: sparser forest cover, less ground carpet, shoulder cairns, and a ridge-stalker pursuer profile.
- Add a first regional-map trail picker to the title screen with selectable trailhead nodes.
- Add a steeper `Stonejaw Ridge` terrain grade, selected-destination terrain flattening, and a wider ridge vista clearing.
- Start a more realistic PS3 sky treatment with richer gradient, horizon haze, sun/moon glow, and high cloud wisps.
- Add key-fob car alarm behavior: Morrow's constant alarm can be silenced once the car is in view, while later trails use manual alarm chirps for navigation.
- Tune PS3 afternoon/dusk readability with warmer golden sky color, gentler fog growth, darker distant tree palettes, bark/branch detail, and extra Stonejaw ground texture.
- Increase PS3 render distance while keeping low-spec mode available as the fallback.
- Make the pursuer escalate with extra aggression and speed after the trail artifact is recovered.
- Remove the `F5` restart prompt from the win screen because it conflicts with browser reload.
- Add a first ambient wildlife pass for PS3 mode with birds, deer, and rare fox/turkey sightings.
- Add `Blackwater Spur` as a first river-trail prototype with a carved creek bed, water channel, reeds, bank rocks, stepping-stone crossing, river charm artifact, and map selection.
- Fix `Blackwater Spur` river findability: add a distance-driven running-water audio beacon (`RiverAudio`), widen the tree-free clearing around the water so it reads from further away, thin trees along the artifact-route waypoints as an approach corridor, and brighten the water material's glint so it doesn't blend into dark forest floor.
- Fix the river reading as flat/disconnected patches and the PS3 horizon haze reading as a hard-edged rectangle — both were single flat-colored segments with no gradient; rebuilt the river as many short terrain-hugging segments and gave the haze a vertex-color fade into the sky dome.
- Make the river an actual obstacle: bank colliders block entry everywhere except a gap at the rock-ford crossing, added streambed rocks for texture, and gave the water surface a traveling ripple animation (no texture assets — just per-segment sine-wave bobbing keyed to arc-length position).
- Add a trail-intro card shown once at run start: artifact name + icon preview (distinct per artifact — tag/stone/charm) plus a trail-specific teaching note (Morrow: phone + watcher warning; Stonejaw: starts at the car, explains the key fob immediately).
- Give `Stonejaw Ridge` its own spawn point at the car instead of the shared southern-mountain spawn.

Next polish targets:

- Playtest the `Stonejaw Ridge` climb for slope feel, artifact readability, car-alarm guidance, and vista framing.
- Tune PS3 sky values after playtest: golden afternoon brightness, dusk contrast, sun/moon placement, haze strength, cloud-wisp density, and bloom response.
- Tune ridge-specific values after playtest: tree density, scree/cairn spacing, artifact visibility, and ridge-stalker pressure.
- Tune key-fob alarm distance, cooldown, and prompt timing after playtest.
- Tune ambient wildlife frequency, visibility distance, and movement so sightings stay readable but not distracting.
- Playtest `Blackwater Spur` again after the findability fix: confirm the water audio beacon range/volume feels right, the widened clearing and approach corridor actually surface the river during normal play, stepping-stone placement and river charm readability, and whether the manual alarm chirp is enough for navigation.

Next expansion targets:

- Give each trail a clearer artifact, trailhead, route shape, landmark set, and forest-devil behavior profile.
- Expand the regional map into progression: locked trailheads, story fragments, and eventually a drivable road scene.
