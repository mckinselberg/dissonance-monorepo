# THREADS Addendum --- Communications, Streaming, Spatial Distortion & Multiplayer

**Intended target:** Merge into THREADS.md v9.19

This addendum captures the new engineering and worldbuilding threads
from the latest design session.

## T26 --- World Streaming, LOD & Spatial Rendering

**Status:** Design committed

### Scope

-   Chunk streaming
-   Frustum culling
-   Thin-instance forests
-   Billboard impostors
-   Fog horizon
-   Deterministic scatter
-   World feature manifests

### Architecture

-   Fog hides transitions.
-   LOD reduces geometric complexity.
-   Frustum culling prevents rendering unseen geometry.
-   Streaming manages memory residency.

These remain independent systems sharing one distance axis.

### EnvironmentProfile additions

``` ts
heroRadius
heroFadeStart
heroFadeEnd
impostorRadius
fogDensity
fogColor
cullRadius
streamRadius
chunkSize
```

### Chunk policy

Chunks own instance buffers and feature manifests.

Hero meshes remain globally resident.

Cull chunks, not individual trees.

------------------------------------------------------------------------

## T27 --- Diegetic Communications Layer

**Status:** Experimental

Portable green-screen terminal with mechanical docking.

Preact renders terminal UI above Babylon canvas.

WebSocket and WebRTC provide runtime communications.

Server owns message authority through the Synod Scrambler.

### NPC Runtime

Simulation -\> Context -\> AI -\> Validation -\> Dialogue

LLMs never own world state.

### Planned MCP

-   getNpcContext()
-   inspectSignalRoute()
-   requestMessageSend()
-   getFactionMemory()

Used primarily for authoring and tooling.

------------------------------------------------------------------------

## Multiplayer

Factions:

-   Synod
-   Independents
-   Chorus
-   Null

Conflict is infrastructure-centric rather than weapon-centric.

------------------------------------------------------------------------

## Infrastructure Resonance

Milo discovers forgotten engineering manuals describing oscillators,
relays, breadboards and electromechanical testing.

He realizes infrastructure already vibrates.

Terminal docks become both network interfaces and acoustic injection
points.

------------------------------------------------------------------------

## Spatial Distortion Profiles

Regions may alter:

-   horizontal scale
-   vertical scale
-   fog
-   atmosphere
-   color grading
-   ambient audio

Reality changes through transform layers instead of unique geometry.

------------------------------------------------------------------------

## Synod Capital

Radial transform volume.

Buildings near the center scale vertically.

Scaling eases continuously toward normal at the suburbs.

------------------------------------------------------------------------

## World Feature Manifest

Each feature stores:

-   id
-   latitude
-   longitude
-   world position
-   rotation
-   scale
-   asset
-   tags

Used for placement, replication, saves and deterministic regeneration.

------------------------------------------------------------------------

## Principle P11

**Transform Reality, Not Assets**

Prefer transforms, perception, acoustics and profile-driven changes over
bespoke geometry.

------------------------------------------------------------------------

## Engineering Spikes

1.  EnvironmentProfile rendering schema
2.  Chunk streaming
3.  Impostor bake pipeline
4.  Terminal overlay
5.  Docking system
6.  Synod Scrambler
7.  NPC interaction service
8.  Culture Engine MCP prototype
9.  Feature manifest
10. Spatial distortion profiles
