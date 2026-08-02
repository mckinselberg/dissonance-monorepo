# Audio Architecture

Status: active World consumers migrated; manual audio-quality validation pending.

This review was performed on 2026-08-01. The active migration target is
`apps/world`. `apps/museum/dont-turn-around` is a preserved exhibit and is a
compatibility boundary, not an active migration target.

## Pre-migration audit

World used Tone.js, not Babylon audio V1 or V2. Tone's module-level
context is the only live audio context, but ownership is split between global
package singletons and feature objects. There is no Babylon listener. Direction
is approximated with caller-computed stereo pan, so audio does not follow the
active camera automatically.

There are no checked-in sound files in the active apps or packages. All current
sound is procedurally synthesized:

| Owner | Output and lifecycle |
| --- | --- |
| `AudioEngine` | Footsteps, breath, whistle, pursuer and foliage one-shots. Static Tone helpers connect many nodes directly to destination and dispose them with timers. |
| `AudioBuses` | Module-global `spatial`, `ambientBeds`, `interior`, and `musicSynth` gains. Each connects directly to destination and is never disposed. |
| `AmbientAudio` | Wind, rain, insects, drone and thunder. It has no complete `dispose()` path. |
| `HeartbeatAudio` | Heartbeat and drone routed to `interior`. It has disposal, but World never calls it. |
| `ShelterAlarmAudio` | Proximity locator routed to `ambientBeds`. It has disposal, but World never calls it. |
| `TrailPlayerAudio` / `PlayerAudio` | Movement and breath scheduling around static `AudioEngine` calls. |
| `RiverAudio` | River noise routed directly to destination; used by the museum exhibit. |
| `DestinationAudio` | Alarm chirps routed directly to destination and scheduled on Tone's global transport; used by the museum exhibit. |

World constructed audio features during setup. A dedicated button later called
`AudioEngine.start()` from a user gesture and starts continuous layers. Master
mute writes directly to Tone's destination. Other controls are wind level and
feature-local footstep/breath mutes; there is no master volume or bus volume API.

World did not tear its audio objects down on page hide, unload, or scene
disposal. Some classes expose `dispose()`, but the app does not call them. Other
continuous classes lack complete disposal, so Tone's global destination and
buses define their effective lifetime.

The preserved DTA exhibit consumes the shared Tone implementation and adds
river, destination-alarm, and pursuer call sites. Changing those exports in
place would change the archive. Its imports remain on the legacy package entry.

The separate Synod prototype creates a raw `AudioContext`, oscillators, and gain
graph. Its risk-score layering is useful future behavior, but copying that hook
would create a second runtime and is outside this migration.

## Canonical ownership

`BabylonAudioRuntime` from `@dissonance/audio/babylon` is the only approved
owner for new game audio. It uses Babylon Audio Engine V2 from the installed
Babylon 7 line. The root `@dissonance/audio` entry exists only for the preserved
DTA Tone implementation. Active World code may load it only through the
development comparison adapter described below.

Application bootstraps one runtime per live scene with
`BabylonAudioRuntime.forScene(scene)`. Repeated calls for the same scene return
the same in-flight or initialized runtime. The runtime owns:

- Babylon's audio engine and single listener;
- the master bus and `music`, `ambience`, `world`, and `ui` buses;
- sound creation and routing;
- master mute, master volume, and bus volume;
- sound handles and deterministic teardown.

The listener attaches to `scene.activeCamera` and reattaches whenever the active
camera changes. Scene disposal automatically disposes the runtime, sounds,
buses, listener, and underlying context. Explicit disposal should happen before
an application replaces its scene.

```text
master
|-- music
|-- ambience
|-- world
`-- ui
```

Do not add a bus without a real mixing requirement. Synod should initially use
`music`; being a distinct feature is not sufficient reason for another bus.

## Adding audio

Application startup owns the runtime. Call `start()` only from a user gesture:

```ts
const audio = await BabylonAudioRuntime.forScene(scene);

enableAudioButton.addEventListener('click', async () => {
  await audio.start();
});
```

Load sounds through the runtime and select their semantic bus. Returned handles
can control playback but cannot bypass routing:

```ts
const alert = await audio.createSound('terminal-alert', '/audio/alert.ogg', {
  bus: 'ui',
  volume: 0.6,
});

alert.play();
```

For positional audio, enable spatial processing and attach the handle to a
Babylon node:

```ts
const alarm = await audio.createSound('shelter-alarm', '/audio/alarm.ogg', {
  bus: 'world',
  loop: true,
  spatialEnabled: true,
  spatialMinDistance: 2,
  spatialMaxDistance: 45,
});

alarm.attachTo(shelterNode);
alarm.play();
```

Features dispose short-lived handles when their lifetime ends. The runtime is
the final owner and disposes anything remaining during scene teardown.

## Development comparison

World's development HUD exposes an `Audio engine` selector. Babylon is the
default; selecting `Tone (legacy)` reloads with `?audioEngine=tone`. Switching
always reloads and disposes the current stack, so Babylon and Tone never create
contexts on the same page. Production ignores the query parameter, omits the
selector, selects Babylon unconditionally, and tree-shakes Tone from the World
bundle.

## Avoid

- Do not create `AudioContext`, oscillators, gains, or raw Web Audio nodes in
  application or feature code.
- Do not import Tone.js in new code.
- Do not import Babylon audio factories outside `@dissonance/audio/babylon`.
- Do not connect sources directly to a browser or library destination.
- Do not create another listener or update it from gameplay loops.
- Do not keep global mute or volume state in a feature class.

## Migration state

Active World responsibilities now use Babylon-owned PCM sources and managed
handles for ambience, rain, thunder, footsteps, breath, shelter chimes,
heartbeat ducking, and whistle melodies. World unlocks one Babylon runtime,
tracks the active camera listener, and disposes feature timers and audio on
scene disposal or page hide. Its production bundle contains no Tone code.

Tone remains only behind the root package entry used by the preserved DTA
exhibit. Remaining work is manual browser validation of the generated sound
character, controls, camera changes, repeated entry, and teardown. Synod can be
implemented afterward as a consumer of the `music` route.
