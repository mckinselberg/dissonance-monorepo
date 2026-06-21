# Engineering Prompt: Convert `dont-turn-around` into a Shared World Monorepo

Repository:

```txt
https://github.com/mckinselberg/dont-turn-around
```

## Goal

Refactor the current `dont-turn-around` prototype into a monorepo that preserves the existing prototype while extracting shared systems into reusable packages.

The long-term goal is to support four related games/modes from one foundation:

1. **Don’t Turn Around** — fear, pursuit, darkness, navigation pressure.
2. **Dissonance** — cultural preservation, courier networks, SignalNet ruins, diegetic discovery.
3. **Cultural Runner** — trail-running / treadmill-compatible persistent distance world.
4. **Make a Movie With Your Friends** — collaborative filmmaking inside the shared world using camera, recorder, props, editing rooms, and export tools.

Do not discard the current prototype. Treat it as the seed application.

---

# Core Concept

Build a persistent world where players move through trails, forests, ruins, roads, towers, and liminal spaces. The shared foundation should support walking, running, navigation, distance tracking, ambient audio, tools, artifacts, async player traces, and world persistence.

The central design idea is:

> A world where people physically carry music, art, letters, recordings, films, instruments, crafted objects, and lost items across long distances for one another.

Distance matters. Objects have histories. Culture moves physically through the world.

---

# Monorepo Structure

Use a workspace-based monorepo.

Recommended:

```txt
/
  apps/
    dont-turn-around/
    dissonance/
    cultural-runner/
    movie-world/
    server/

  packages/
    engine/
    world/
    player/
    input/
    audio/
    artifacts/
    culture/
    navigation/
    community/
    persistence/
    filming/
    ui/
    shared-types/

  tools/
    content-pipeline/
    dev-scripts/

  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

Use `pnpm` workspaces unless there is already a package manager in the repo.

---

# Shared Packages

## `packages/engine`

BabylonJS setup and render-loop ownership.

Responsibilities:

- Engine bootstrap
- Scene lifecycle
- Asset loading
- Environment setup
- Lighting
- Camera rig
- Debug helpers
- Performance utilities

Should not contain game-specific logic.

---

## `packages/world`

Shared world systems.

Responsibilities:

- Forest generation
- Trail paths
- Terrain
- Dense forest boundaries
- Landmarks
- Power lines
- Radio towers
- Water towers
- Roads
- Clearings
- Weather hooks
- Time of day
- World zones

Worlds should support both handcrafted and procedural content.

---

## `packages/player`

Shared player controller.

Responsibilities:

- First-person movement
- Walking
- Running
- Stamina hooks
- Collision
- Ground detection
- Fall detection
- Movement metrics
- Player position sampling

Do not hard-code horror mechanics here.

---

## `packages/input`

Input abstraction layer.

Support:

- Keyboard
- Mouse
- Controller
- Treadmill later
- Simulated input for tests

All input sources should resolve into a common movement state.

```ts
export type MovementInputSource = 'keyboard' | 'controller' | 'treadmill' | 'simulation';

export type MovementInputState = {
  source: MovementInputSource;
  forwardAmount: number;
  turnAmount: number;
  runAmount: number;
  pauseRequested: boolean;
};
```

Keyboard/controller must be able to override treadmill input.

---

## `packages/audio`

Tone.js audio layer.

Responsibilities:

- Ambient forest sound
- Footsteps
- Breathing
- Distant highway
- Wind
- Rain
- Power-line hum
- Radio static
- Signal interference
- Musical fragments
- Field recordings
- Location-based audio

Expose a shared audio manager:

```ts
export class AudioWorldManager {
  start(): Promise<void>;
  setTimeOfDay(value: number): void;
  setPlayerSpeed(speed: number): void;
  setSignalInterference(amount: number): void;
  playDiscoveryMotif(id: string): void;
  playArtifactTone(id: string): void;
}
```

---

## `packages/navigation`

Diegetic navigation systems.

Responsibilities:

- Compass
- Map placards
- Trail markers
- Junction signs
- Landmark bearings
- Discovered routes
- In-world navigation memory

Important rule:

Do not give the player a free omniscient minimap.

Navigation aids must be found, inspected, and understood in-world.

Example: map placards at trail junctions.

A placard should show a partial local map. The player must physically find it, look at it, and interpret it. Once understood, nearby trail knowledge can be added to memory.

```ts
export type MapPlacard = {
  id: string;
  position: WorldPosition;
  routeIdsShown: string[];
  landmarkHints: string[];
  discoveredByPlayer: boolean;
  grokkedByPlayer: boolean;
};
```

---

## `packages/artifacts`

Physical object system.

Artifacts are not generic loot. They are world objects with history.

Examples:

- Pocket knife
- Compass
- Camera
- Field recorder
- Letter
- Photograph
- Song fragment
- Guitar
- Flute
- Drawing
- Film reel
- Prop
- Lost personal item
- Crafted object

Artifacts should track history:

```ts
export type Artifact = {
  id: string;
  type: ArtifactType;
  title: string;
  description: string;
  creatorId?: string;
  intendedRecipientId?: string;
  currentOwnerId?: string;
  originLocation: WorldPosition;
  currentLocation: WorldPosition;
  condition: ArtifactCondition;
  distanceTraveledMeters: number;
  ownerHistory: ArtifactOwnerRecord[];
  eventHistory: ArtifactEvent[];
  isLostItem: boolean;
  isDeliverable: boolean;
};
```

Example:

```txt
Pocket Knife
Condition: Worn
Owner History: 7 people
Distance Traveled: 238 miles
```

Objects should visually wear over time.

Wear should reflect:

- Distance carried
- Use count
- Damage
- Repairs
- Number of owners
- Exposure

---

## `packages/culture`

Media and cultural artifact layer.

Supports:

- Letters
- Poems
- Drawings
- Photographs
- Songs
- Recordings
- Films
- Instruments
- Crafted objects
- Trail shrines
- Personal messages
- Lockable artifacts intended for specific recipients

Core idea:

Players create culture in the world. Other players discover it, carry it, preserve it, perform it, deliver it, or reinterpret it.

---

## `packages/community`

Async community layer.

Use Colyseus and WebSockets first.

WebRTC can come later.

Responsibilities:

- Shared rooms
- Player traces
- Artifact sync
- Trail notes
- Delivery contracts
- Courier history
- Shared locations
- Reputation events
- Async discovery

This is not an MMO-first system. It is asynchronous-first.

Players should mostly encounter traces of others:

- Notes
- Photos
- Songs
- Lost items
- Trail marks
- Carved messages
- Courier routes
- Footprints
- Film props
- Field recordings

---

## `packages/persistence`

Persistence layer.

Local first. Server later.

Persist:

- Player position
- Distance traveled
- Inventory
- Artifact state
- Discovered map placards
- Known routes
- Reputation
- Created media
- Filming sessions
- Save/resume state

---

## `packages/filming`

Collaborative filmmaking systems.

Used by `apps/movie-world`.

Responsibilities:

- In-game camera
- Video capture
- Shot metadata
- Takes
- Props
- Actors
- Scene markers
- Recording sessions
- Editing room
- Timeline editing
- Audio sync
- Export pipeline

The editing room should exist as a diegetic location in the world, not merely a menu.

Possible locations:

- Abandoned TV station
- SignalNet archive
- Projection room
- School AV room
- Community theater
- Basement editing suite

Players can gather there over WebRTC, review footage, splice clips, edit audio, and export a finished film.

A finished film becomes an artifact that can be carried, screened, archived, or delivered.

---

# Four Apps

## 1. `apps/dont-turn-around`

Tone:

- Fear
- Paranoia
- Pursuit
- Darkness
- Limited resources

Uses shared systems:

- World
- Player
- Input
- Audio
- Navigation
- Persistence

Game-specific systems:

- Unseen chaser
- Phone flashlight with low battery
- Stamina/adrenaline
- Trip/fall risk
- Pareidolia flashes
- Distant highway audio that sometimes disappears
- Dense forest barriers
- Mundane destination, such as an empty parking lot with a car

---

## 2. `apps/dissonance`

Tone:

- Wonder
- Unease
- Cultural preservation
- Collapsing infrastructure
- SignalNet ruins

Uses shared systems:

- World
- Player
- Input
- Audio
- Navigation
- Artifacts
- Culture
- Community
- Persistence

Core mechanics:

- Carry letters, music, recordings, art, instruments, and lost objects
- Deliver artifacts to intended recipients
- Discover SignalNet towers and dead network nodes
- Use camera, recorder, compass, and crafted tools
- Preserve culture physically instead of uploading it globally
- Let objects gain history through use and movement

---

## 3. `apps/cultural-runner`

Tone:

- Flow
- Trail running
- Persistence
- Exercise
- Reflection

Uses shared systems:

- World
- Player
- Input
- Audio
- Navigation
- Artifacts
- Culture
- Community
- Persistence

Core mechanics:

- Walk/run long routes over multiple sessions
- Pause and resume
- Treadmill support later
- Keyboard/controller override always available
- Load or simulate long trail routes
- Discover trail notes, field recordings, lost items, and cultural objects
- Community traces appear asynchronously

This should support the fantasy:

```txt
I ran 2 miles today.
Tomorrow I continue from mile 2.
Eventually I crossed the whole route.
```

---

## 4. `apps/movie-world`

Tone:

- Collaborative
- Creative
- Playful
- Cultural
- Social

Uses shared systems:

- World
- Player
- Input
- Audio
- Navigation
- Artifacts
- Culture
- Community
- Persistence
- Filming

Core mechanics:

- Players enter the same persistent world
- Players use cameras and recorders
- Players create props and costumes
- Players shoot scenes together
- Players enter an editing room
- Players splice footage and audio
- Players export finished films
- Finished films become world artifacts

Required systems:

```txt
Camera
Recorder
Scene markers
Takes
Timeline editor
Editing room
File export
Shared review
Artifact publishing
```

---

# Object History and Wear

Objects should change as they travel.

Example new object:

```txt
Pocket Knife
Condition: New
Owner History: 1 person
Distance Traveled: 0.2 miles
```

Example worn object:

```txt
Pocket Knife
Condition: Worn
Owner History: 7 people
Distance Traveled: 238 miles

Used to carve 12 trail marks.
Used to open 4 sealed letters.
Used to repair 1 flute.
Lost for 43 days.
Recovered near the old water tower.
```

This history should matter more than rarity.

A common object with a deep history should feel valuable.

---

# Trail Ethics and Reputation

Finding lost items should create ethical decisions.

Choices:

- Leave it visible
- Mark it on the map
- Move it to a safer location
- Carry it to a lost-and-found
- Deliver it to the owner
- Keep it
- Ignore it

Reputation tracks:

- Trail Steward
- Trusted Courier
- Archivist
- Scavenger Risk
- Ghost

Avoid gamey popups. Use subtle world feedback.

---

# Trail Marks and Carved Messages

If the player finds a pocket knife, they can create trail marks.

Avoid unrestricted graffiti spam at first.

Start with:

- Initials
- Symbols
- Arrows
- Short marks
- Friend-directed messages
- Personal sigils

Messages can be intended for specific players.

Example:

```txt
Carved Message
From: Dan
To: Noah
Location: North trail junction
Message: Look toward the tower.
```

This should be asynchronous. The recipient is not directly notified. The message exists in the world and may be found later.

---

# Map Placards

Add map placards at certain trail junctions.

These are in-world navigation aids.

Rules:

- The player must physically find the placard.
- The player must inspect it.
- The placard shows a partial local map.
- The map is not automatically omniscient.
- Once understood, the player can remember local landmarks and route branches.
- Placards may be damaged, outdated, vandalized, or incomplete.

Placards should feel like real trail infrastructure.

Example interaction:

```txt
You found a weathered map placard.

Visible:
- Old Water Tower
- North Ridge Trail
- Radio Service Road
- Stream Crossing

Unreadable:
- Eastern spur
- Lower access path
```

---

# First Milestone

Do not build all four games immediately.

First milestone:

Convert the current prototype into a monorepo and extract reusable core systems.

Deliver:

```txt
apps/dont-turn-around
packages/engine
packages/world
packages/player
packages/input
packages/audio
packages/navigation
packages/persistence
packages/shared-types
```

The existing game should still run.

Acceptance criteria:

- Existing prototype behavior preserved
- App runs from `apps/dont-turn-around`
- Shared packages compile
- Player can walk in the world
- Audio still works
- Navigation package exposes compass/map placard types
- Persistence package can save/load player position and distance
- No Dissonance/movie systems required in milestone 1

---

# Second Milestone

Add the cultural foundation.

Deliver:

```txt
packages/artifacts
packages/culture
packages/community
apps/dissonance
```

Acceptance criteria:

- Player can find an artifact
- Artifact has condition/history/distance metadata
- Player can carry/drop/mark an artifact
- Player can find a map placard
- Player can create a simple trail mark
- Player distance persists
- Basic Colyseus room can sync one shared artifact or trail note

---

# Third Milestone

Add Cultural Runner.

Deliver:

```txt
apps/cultural-runner
packages/input treadmill-ready abstraction
route persistence
distance-gated discovery rules
```

Acceptance criteria:

- Player can run a route over multiple sessions
- Total distance persists
- Keyboard/controller override works
- Discoveries unlock by distance
- Trail placards and landmarks support navigation

---

# Fourth Milestone

Add Movie World.

Deliver:

```txt
apps/movie-world
packages/filming
camera recording prototype
editing room prototype
basic file export
```

Acceptance criteria:

- Player can record footage
- Footage is saved as a take
- Takes appear in an editing room
- Player can arrange takes on a simple timeline
- Player can export a basic video file
- Finished movie can become an artifact in the world

---

# Implementation Guidance

Prioritize architecture over polish.

Avoid coupling game-specific mechanics into shared packages.

Shared packages should know about:

```txt
movement
worlds
audio
artifacts
culture
navigation
persistence
community
filming
```

Apps should define:

```txt
tone
rules
content
win/loss states
theme
specific mechanics
```

Do not build heavy UI yet. Keep systems diegetic where possible.

Avoid:

- Generic MMO UI
- XP spam
- Loot rarity colors
- Omniscient minimaps
- Always-online assumptions
- Replacing the original prototype wholesale

Preserve the original prototype’s feel.

---

# Main Task Prompt

Refactor `dont-turn-around` into a TypeScript monorepo that preserves the current BabylonJS/Vite/Tone.js prototype while extracting reusable systems for four future games: Don’t Turn Around, Dissonance, Cultural Runner, and Make a Movie With Your Friends.

The shared foundation should support first-person movement, trails, terrain, ambient audio, diegetic navigation, distance tracking, save/resume persistence, artifacts with history and wear, cultural objects, asynchronous community traces, and later collaborative filmmaking.

Keep the first milestone small: move the existing prototype into `apps/dont-turn-around`, create shared packages for engine/world/player/input/audio/navigation/persistence/shared-types, and make the existing app run unchanged. Then add map placards as in-world navigation aids that must be physically found and interpreted.

Build modularly so the later apps can reuse the same foundation without copying code.
