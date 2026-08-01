# DTA Environment Port — Scoping Pass (v1)

## Origin

Dan asked (local session, 2026-07-24): replace "the first DTA level environment" with trail-viewer's **`dissonance environment test 1`** view data (`apps/trail-viewer/public/data/views.json`, entry 8 — `level: "1"`, `activeMode: "drive"`; a fuller atmosphere/terrain-color/hero-forest tuning pass than the earlier `dissonance-forest-scale` candidate already logged under T21, THREADS v9.18).

Investigation this session found it can't be done as a config edit — DTA's live world systems (`apps/dont-turn-around`) and trail-viewer's DEM/scale-tuning/tiered-forest systems are architecturally disjoint; most of that view's fields have no field to write into on the DTA side. Dan's call: stop, don't touch DTA's game code, write up the actual gap as a scoping doc first. This is that doc — an audit, not a build spec. Per P4, nothing here is decided; the numbered items under "Open questions" need Dan's sign-off before any implementation session runs.

**This doc is a first concrete scoping pass feeding T23's existing "DTA-onto-TrailViewer work items" list** (`docs/THREADS.md`), not a new, competing direction — see "Relationship to existing threads" below.

## What "dissonance environment test 1" actually is

Full entry, `apps/trail-viewer/public/data/views.json`:

```json
{
  "name": "dissonance environment test 1",
  "level": "1", "activeMode": "drive",
  "x": -1130.28, "y": 693.90, "z": -1523.78,
  "rotationX": -0.478, "rotationY": -5.94,
  "hScale": 1.5, "vExag": 4.5, "waterLevel": 77.24,
  "cameraHeightOffset": 0.8, "timeOfDay": 17.1,
  "fogDensity": 0.00095, "fogColor": "#000000", "overcast": false,
  "starCount": 1100, "starColor": "#ffffff",
  "cloudCount": 24, "cloudColor": "#7272a7", "cloudOpacity": 0.35,
  "waterColor": "#418fb4",
  "skyDayColor": "#8ca6c7", "skyNightColor": "#050814",
  "terrainLowColor": "#df8e2a", "terrainHighColor": "#ffffff",
  "sunTint": "#ffa8df",
  "treeCount": 0, "treeRegionRadius": 2783.34, "treeHScale": 2.5, "treeVScale": 3,
  "trailsideHScale": 3, "trailsideVScale": 3, "trailsideCount": 600,
  "bulkForestHScale": 3, "bulkForestVScale": 3, "bulkForestCount": 12300, "bulkForestRadius": 1427.35,
  "heroHScale": 1, "heroVScale": 1, "heroRadius": 28, "heroCount": 0,
  "weatherMode": "windy",
  "masterMuted": false, "windVolume": 0.8, "footstepMuted": false, "breathMuted": false
}
```

It's a `ViewSnapshot` (see T21) — a saved camera position plus every live-tunable knob trail-viewer's own scale-tuning/atmosphere/forest-tier HUD exposes at Level 1. It is **not** an `EnvironmentProfile` in the T1/T2 sense (no schema, no `applyProfile()` path, lives only as one array entry in a hand-edited JSON file).

## Current-state audit (verified this session)

### DTA's environment stack today (`apps/dont-turn-around`)

- **No "levels."** `Game.ts` selects by **trail** (`morrow_pine_loop` / `stonejaw_ridge` / `blackwater_spur`, default `morrow_pine_loop` — `config/trails.ts`), **experience mode** (`radio`/`ps1`/`ps2`/`ps3` — `config/experienceProfiles.ts`), and **departure time** (`afternoon`/`dusk`/`night` — `config/runProfiles.ts`). "The first DTA level" has no literal referent in the code; the closest analog is `DEFAULT_TRAIL_ID`.
- **`Terrain`** (`packages/world/src/Terrain.ts`): a fixed 800×800-unit procedurally-noised heightfield (`WORLD_SIZE`, `MAX_HEIGHT`, `SEED` constants). No DEM, no `hScale`/`vExag`/`waterLevel` concept — the world is a fixed size, period.
- **`ForestGenerator`** (`packages/world/src/ForestGenerator.ts`): fixed trail-waypoint-driven procedural placement (trunks/canopy/rocks/underbrush/grass as primitive geometry). No `treeRegionRadius`, no bulk/trailside/hero tiers, no real `.glb` assets.
- **`ExperienceProfile`** (4 modes): `treeCount`, `fogDensity`, `fogColor`, `skyColor`, `drawDistance`, `ambientIntensity`, `visualNoise`, `audioLoFiAmount`.
- **`RunProfile`** (3 departure times): `startingLightLevel`, `daylightDecayRate`, `startingFogDensity`, `runDurationSeconds`.
- No water plane, no star field, no sky day/night pair, no terrain low/high color, no sun tint, no per-cluster hero/bulk/trailside forest tiers.

### Trail-viewer's environment stack today (`apps/trail-viewer`)

- **`HeightmapTerrain`**: real DEM (South Mountain Reservation), rescaled live via `hScale`/`vExag` sliders; three "Levels" (1: exaggerated relief + shrunk player, 2: uniform 7× scale, 3: orbit-only true scale) — a trail-viewer-internal concept, unrelated to any DTA level.
- **Three-tier forest**: `ThinInstanceTrees` (procedural, forest-wide, `treeCount`/`treeRegionRadius`), bulk-forest tier (decimated real `.glb` trees filling part of the same candidate pool, `bulkForestCount`/`bulkForestRadius`/`bulkForestHScale`/`bulkForestVScale`), trailside tier (`trailsideCount`, along GPX + yellow-blazed OSM trails), hero tier (`HeroTreeInstances`, real Poly Haven `.glb` assets in a 0–30m trail-adjacent zone, `heroRadius`/`heroCount`).
- **Full atmosphere set**: `Sun`/`StarField` day-night cycle (`timeOfDay`, `starCount`/`starColor`), `WaterPlane` (`waterLevel`/`waterColor`), fog (`fogDensity`/`fogColor`), `overcast` toggle, sky day/night color pair, terrain low/high color (dead controls since the slope-blended 3-tier ground material landed — flagged under T21, THREADS v9.23), `sunTint`, `WeatherSystem` (already shared with DTA, ported as-is).
- **Copy/Load View + `views.json`**: a snapshot mechanism with no DTA equivalent — DTA has no "load a saved vista" concept at all.

### Field-by-field mapping

| Field on `dissonance environment test 1` | Has a home in DTA today? | Where |
|---|---|---|
| `fogDensity`, `fogColor` | yes | `ExperienceProfile` |
| `treeCount` | yes (different semantics — total count, not "extra real trees") | `ExperienceProfile` |
| `weatherMode` | yes | `WeatherSystem` (already shared) |
| `masterMuted`/`windVolume`/`footstepMuted`/`breathMuted` | partial | DTA's audio layer has muting/volume concepts but not this exact shape |
| `timeOfDay` | partial | no `setTimeOfDay(hour)`; closest is `RunProfile.startingLightLevel` (afternoon/dusk/night buckets, not a continuous hour) |
| `hScale`, `vExag` | **no** | Terrain is fixed-scale, no concept of rescaling |
| `waterLevel`, `waterColor` | **no** | no water plane in DTA at all |
| `starCount`, `starColor`, `cloudCount`, `cloudColor`, `cloudOpacity` | **no** | `CloudSystem`/`MountainRing` exist but take no such params; no star field |
| `skyDayColor`, `skyNightColor`, `sunTint` | **no** | `ExperienceProfile.skyColor` is one static color, no day/night pair or tint |
| `terrainLowColor`, `terrainHighColor` | **no** (and dead even in trail-viewer, see above) | n/a |
| `treeRegionRadius`, `treeHScale`, `treeVScale` | **no** | no DEM-region concept |
| `trailsideHScale/VScale/Count`, `bulkForestHScale/VScale/Count/Radius`, `heroHScale/VScale/Radius/Count` | **no** | none of these tiers exist in `ForestGenerator` |

Roughly a third of the fields have a plausible DTA-side home today; the rest describe systems that only exist in trail-viewer.

## Why this isn't a quick edit

DTA's `Terrain`/`ForestGenerator` and trail-viewer's DEM/scale-tuning/tiered-forest systems are two independent implementations of "a walkable forest," built for different purposes (a fixed hand-tuned horror-game arena vs. a real-world heightmap viewer/authoring tool). Applying `dissonance environment test 1`'s values to DTA today would silently no-op on two-thirds of its fields — there is nothing in `Game.ts`, `Terrain.ts`, or `ForestGenerator.ts` that reads `hScale`, `waterLevel`, `treeRegionRadius`, or any of the tier params. A real port means either building DTA-side equivalents of these systems, or moving DTA's actual game logic (pursuer, trails, destination/artifact placement) onto trail-viewer's terrain instead.

## Relationship to existing threads

- **P8 (corrected, THREADS.md "Principles")**: trail-viewer is already designated the *successor foundation* — the DTA concept is meant to move onto trail-viewer's terrain/water/atmosphere/traversal systems, with `apps/dont-turn-around` preserved as the frozen reference, not the other way around. That reframes this doc's real question: not "how do we copy this view's numbers into the old app," but "what does it take for trail-viewer to host DTA's actual gameplay, with this view as one of its first authored vistas."
- **T23 ("DTA-onto-TrailViewer work items")** already lists the gameplay-side pieces of this exact migration: pursuer consuming real terrain (`getHeightAt` locomotion + tile-based navmesh bake, O2 decided-required), a concealment mask bridging trail-viewer foliage into detection logic, collectible-ring authoring on real trailhead topology. This doc adds the **environment/atmosphere** side of the same migration, which wasn't previously itemized there.
- **T1/T2** already establishes the target pattern for *how* configuration should flow (`EnvironmentProfile` + a single `applyProfile()` seam) — any schema this doc's Phase 1 produces should be an instance of that pattern, not a parallel one.
- **T25 (atmosphere grading)** is already planned as a schema-first extension of the profile pattern for post-stack grading (bloom/color-curves/lens-flare). If `dissonance environment test 1`'s fields become part of a formal schema, T25's extension and this doc's schema should be the same schema, not two.
- **T21**'s v9.18 entry already logged `dissonance-forest-scale` as Dan's earlier candidate scale "for porting the DTA/Dissonance concept onto this terrain" — `dissonance environment test 1`/`test 2` are the next iteration of that same exploration, now covering atmosphere and forest-tier params the first candidate didn't touch.

## Open questions (need Dan's sign-off before an implementation session runs)

1. **Direction confirmation.** Is P8's migration (DTA's gameplay moves onto trail-viewer's terrain) still the plan, superseding any notion of copying these values into the old `apps/dont-turn-around` app? (Reading of the existing docs says yes — T23 already frames it this way — but the original ask this session implied the other direction, so this is surfaced rather than assumed.)
2. **Schema or stay a snapshot?** Should trail-viewer's environment state graduate from `ViewSnapshot` (a hand-pasted array entry) into a formal `EnvironmentProfile` (T1/T2 pattern) that `dissonance environment test 1` becomes the first authored instance of? This is the natural attachment point for DTA's actual pursuer/forest logic once T23's work items land.
3. **Fields with no DTA-side home today** (terrain/water colors, sky day/night pair + sun tint, star/cloud params, `treeRegionRadius`, all bulk/trailside/hero tier params) — do these become part of that schema now (schema-first, matching T25's own precedent), or wait until T23's region system actually needs them?
4. **Scope of "first level."** Confirming this means "whatever vista becomes the default once trail-viewer is playable as DTA" — there is no level-numbering concept to add to the old `dont-turn-around` app, and this doc does not propose adding one.
5. **`timeOfDay`/`RunProfile` reconciliation.** Trail-viewer's continuous `setTimeOfDay(hour)` and DTA's three discrete `RunProfile` buckets (afternoon/dusk/night) are different models of the same idea — if they need to unify under one schema (open question 2), which one wins, or does the schema carry both a continuous hour and a bucket label derived from it?

## Proposed phasing (draft — not started, gated on the questions above)

- **Phase 0 (this doc):** audit — done.
- **Phase 1:** schema decision (open question 2/3) — likely a T1/T2 session, possibly combined with T25's own schema extension so they don't diverge.
- **Phase 2:** once a schema exists, confirm `dissonance environment test 1` (or a refreshed capture) as its first authored/validation instance.
- **Phase 3:** wire DTA's actual gameplay (pursuer, colliders, destination/artifact placement) onto trail-viewer's real terrain — already T23's listed scope, not new work invented here.
- **Phase 4:** per P8, retire/freeze `apps/dont-turn-around` as the museum-piece reference once parity is reached.

## Out of scope for this doc

- Any code changes — this session's instruction was to stop and scope, not implement.
- Re-deciding T23's region system, T25's grading schema, or the pursuer-onto-terrain work — those are separate, already-tracked threads this doc feeds into.

## Working style

Surface decisions, don't resolve them unilaterally (P4). The five open questions above are the gate — nothing in "Proposed phasing" should be started before at least question 1 and 2 are answered.
