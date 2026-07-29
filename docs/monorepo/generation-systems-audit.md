# Forest / Terrain / Trail / Creature Generation Systems — Audit

Branch: written against `codex/260703`, verified current against `main` on
2026-07-07 (`codex/260703` is fully merged into `main`; the only diff in the
audited directories is formatting plus the unrelated `feat(ui): add
instructions screen` commit — no forest/terrain/trail/creature system changed).
Scope: `packages/world`, `packages/pursuit`, `packages/glow`,
and the app-local systems in `apps/dont-turn-around/src` that touch terrain,
vegetation, lighting, trails, creatures, and collectibles. Written to be
self-contained (file tree + responsibilities + key signatures) so it can be
pasted into a separate conversation without the source tree attached.

## 1. File map

```
packages/world/src/
  Terrain.ts            — procedural heightfield (value-noise), single ground mesh, per-flavor tilt/carve
  ForestGenerator.ts     — 2,316 lines. All vegetation/rock/trail/car-goal/river geometry + scatter logic
  noise.ts               — 3D value noise + two mesh-displacement helpers (blob / radial)
  DaylightSystem.ts      — sun (DirectionalLight) + ambient (HemisphericLight) + ShadowGenerator, day/night curve
  WeatherSystem.ts        — wind intensity state machine (gusts), no visual output — feeds audio only
  CloudSystem.ts         — billboarded blob-cluster clouds drifting on a wrapped plane
  MountainRing.ts        — 2D "card" mountain silhouettes ringing the world edge (near+far layer)
  WildlifeSystem.ts       — ps3-only ambient birds + deer/fox/turkey, flee-on-approach, respawn-around-player
  WatcherEffect.ts        — spawns paired glowing "eyes" near the pursuer when in the player's view cone
  index.ts               — package barrel

packages/pursuit/src/
  PursuerSystem.ts        — pure state-machine model: distance/aggression/state, illumination + flashlight response
  index.ts

packages/glow/src/
  HeartbeatGlow.ts        — BPM-synced GlowLayer intensity driver (shared by PursuerBody)
  index.ts

packages/engine/src/
  SceneFactory.ts          — engine/scene bootstrap, sky-dome gradient, fog mode/params, post-process pipeline
  GameLoop.ts              — thin requestAnimationFrame wrapper calling Game.tick(dt)

packages/shared-types/src/index.ts — ExperienceProfile, RunProfile, PursuerModel, WorldPosition, etc.

apps/dont-turn-around/src/
  game/Game.ts             — 912 lines. Orchestrates every system, owns tick(), spawn logic, line-of-sight
  pursuer/PursuerBody.ts   — procedural boxes/cylinders humanoid mesh, gait animation, glow-when-dark/lit-when-flashlit
  pursuer/PursuerAudio.ts  — tiered timer-scheduled SFX (footsteps/growls/snaps/rustle) by proximity state
  world/DestinationSystem.ts — car-goal distance tracking, audio beacon, "visible from" check for key-fob unlock
  config/trails.ts         — 3 hardcoded TrailDefinition records (waypoints, artifact, pursuer profile, world flavor)
  config/experienceProfiles.ts — 4 ExperienceProfile presets (radio/ps1/ps2/ps3): treeCount, fogDensity, drawDistance…
  config/runProfiles.ts    — 3 RunProfile presets (afternoon/dusk/night) + buildPursuerConfig() tuning curve
  items/ArtifactProp.ts    — per-trail collectible marker (post + pulsing tag), pickup-radius trigger
  items/PhoneProp.ts       — flashlight pickup prop (flickering screen), pickup-radius trigger
  items/InventorySystem.ts — trivial string-id list (phone / 3 artifact ids)
  ui/TrailIntroOverlay.ts  — one-time card shown at run start: artifact preview + trail's intro/start hint text
```

## 2. Key type/interface signatures

```ts
// packages/shared-types/src/index.ts
export interface ExperienceProfile {
  mode: 'radio' | 'ps1' | 'ps2' | 'ps3';
  treeCount: number; fogDensity: number; drawDistance: number;
  ambientIntensity: number; visualNoise: number; audioLoFiAmount: number;
  fogColor: {r:number;g:number;b:number}; skyColor: {r:number;g:number;b:number};
}
export interface RunProfile {
  departureTime: 'afternoon' | 'dusk' | 'night';
  startingLightLevel: number; daylightDecayRate: number;
  startingFogDensity: number; runDurationSeconds: number;
}
export interface PursuerModel { distance: number; state: 'far'|'near'|'close'|'caught'; aggression: number; isHidden: boolean; }
export type WorldPosition = { x: number; y: number; z: number };

// packages/pursuit/src/PursuerSystem.ts
export interface PursuerConfig {
  startDistance: number; baseSpeed: number; maxSpeed: number; catchRadius: number;
  nearThreshold: number; closeThreshold: number; sprintAggressionGain: number;
  stillAggressionLoss: number; aggressionDecayRate: number; stunMin: number; stunRange: number;
  orbitStrength: number; reengageDelay: number;
}
// update(dt, playerSpeed, playerPos, pursuerPos, hasLoS, isCrouching, isIlluminated, flashlightPressure, artifactRecovered): void
// mutates pursuerPos in place; classifyState() derives far/near/close/caught from distance

// packages/world/src/ForestGenerator.ts
export interface Collider { x: number; z: number; radius: number; }
export type TrailWorldOptions = { flavor?: 'pine'|'rocky'|'river'; waypoints?: WorldPosition[] };
// generate(scene, profile, destinationPos, terrain, shadowGenerator?, trailOptions?): void
// getColliders(): Collider[]  — flat list consumed by Game for player collision AND line-of-sight raycasts

// apps/dont-turn-around/src/config/trails.ts
export type TrailDefinition = {
  id: string; name: string; menuSummary: string; mapPosition: {x:number;y:number};
  startHint: string; introNote?: string;
  destinationPosition: WorldPosition; spawnPosition?: WorldPosition;
  artifact: { id: ArtifactId; name: string; icon: ArtifactIconKind; position: WorldPosition };
  waypoints: WorldPosition[];
  pursuerProfile: 'stalker' | 'ridge_stalker';
  worldFlavor: 'pine' | 'rocky' | 'river';
  alarmMode: 'continuous_until_visible' | 'manual_chirp';
};
```

## 3. Design-decision classification

### Forest rendering / generation

| Decision | Status | Notes |
|---|---|---|
| 3-zone distance LOD (hero+thin-instance / billboard impostor / fog-swallowed) | **Absent** | No `SpriteManager`, no `MeshLODLevel`, no distance-based mesh swap anywhere. Every scattered object (trees, rocks, grass, ferns, groundcover) is full-detail geometry at every distance out to `drawDistance*1.15`; only the *count* varies per profile (`ForestGenerator.ts` scatter loops). Cost is controlled by total instance count + fog masking, not by a cheaper far-tier. |
| GPU wind sway via `MaterialPluginBase` | **Absent** | `WeatherSystem.ts` computes a wind intensity float but only feeds `AmbientAudio.setWeatherIntensity` (`Game.ts:389`). No vertex shader / plugin touches foliage; tree/grass/fern materials are static `PBRMaterial`/`StandardMaterial` with no sway term. |
| Blender→glb asset pipeline, `ImportMeshAsync`/`AssetContainer`, authored `MeshLODLevel` | **Absent** | Zero mesh imports anywhere in the app or world package — every mesh is `MeshBuilder.CreateBox/Cylinder/Sphere/Plane` built at runtime, then merged (`Mesh.MergeMeshes`) and thin-instanced. |
| 4–5 rock variants, randomized scale/rotation, baked AO + SSAO2 | **Partial** | `buildRocks`/`buildRockOutcrops` (`ForestGenerator.ts:1042`, `:1099`) use exactly 4 color variants (1 in `radio` mode) thin-instanced with randomized scale/rotation/position — matches the count and randomization. SSAO2 is real (`SceneFactory.createPostProcessing`, `:255`). No baked AO texture exists because there is no texture pipeline at all (flat vertex/material color everywhere). |
| Thin-instance / GPU-instancing discipline generally | **Implemented, and further along than the design doc assumes** | Extensive inline comments in `ForestGenerator.ts` document a completed migration from unique meshes / regular `InstancedMesh` to `thinInstanceAdd` across trees, rocks, underbrush, grass (~640-1700/palette), groundcover (~17,500 instances — largest single count), ferns/broadleaf/saplings/mushrooms (ps3 only). |

### Terrain

| Decision | Status | Notes |
|---|---|---|
| `GroundFromHeightMap` + `TerrainMaterial` texture blending | **Absent / diverged** | `Terrain.ts` uses `MeshBuilder.CreateGround` (flat grid) then displaces vertices directly in JS from a hand-rolled value-noise heightfield (`macro()` + `fbm()`, `Terrain.ts:49-90`); one flat-color `PBRMaterial` per experience mode/flavor, no texture blending, no `TerrainMaterial`. |
| Real DEM pipeline (USGS 3DEP/OpenTopography → QGIS/GDAL → heightmap) | **Absent** | No heightmap image import capability exists; terrain height is a pure procedural function (`getHeightAt`, `Terrain.ts:204`) seeded by a constant (`SEED=7331`). |
| GPX/GeoJSON trail import, raycast-to-terrain, `CreateTube`/ribbon | **Absent / diverged, but functionally covered differently** | Trails are hardcoded `[number,number][]` waypoint arrays (`HIKING_WAYPOINTS`, `SURVEY_TRAIL_WAYPOINTS` in `ForestGenerator.ts:30-40`; per-trail `waypoints: WorldPosition[]` in `trails.ts`). Path geometry is built from sub-segmented, slope-pitched flat boxes (`buildHikingTrail`/`buildSurveyTrail`, `ForestGenerator.ts:2032-2303`), height-sampled via the terrain's analytic `getHeightAt()` (not a raycast — reasonable substitute since the terrain has no physics mesh to raycast against yet). No GPX/GeoJSON parsing exists anywhere. |
| Slope-aware terrain (rocky ridge climb, river channel carve) | **Implemented** | `Terrain.ts:165-188`: `rocky` flavor adds a ridge-lift climb + side-bank; `river` flavor carves a channel bed along `RIVER_POINTS` and dampens tilt near it. |

### Lighting / atmosphere / post-processing

| Decision | Status | Notes |
|---|---|---|
| Layered directional + hemispheric night lighting | **Implemented** | `DaylightSystem.ts`: one `DirectionalLight` (sun/moon) + one `HemisphericLight` (ambient), per-mode color/intensity curves, day-length decay (`update()`). |
| Player-attached carry light | **Implemented** | `PlayerController` flashlight, toggled via phone pickup (`Game.ts:264-266, 564-568`), tuned per experience mode (`Game.ts:209-225`). Deliberately non-shadow-casting per comment in `DaylightSystem.ts:33`. |
| Volumetric light shafts | **Absent** | No `VolumetricLightScatteringPostProcess` or godray geometry found. |
| SSAO2 | **Implemented** | `SceneFactory.createPostProcessing` (`:255-262`), ratio/strength/radius/samples scaled by profile mode, toggleable via `GameControls.setSSAOEnabled`. |
| Motion blur, bloom, grain, desaturated cool color grade | **Implemented** | Same method: `MotionBlurPostProcess` driven live by player speed each frame (`Game.tick`, `:319-328`); `DefaultRenderingPipeline` bloom/grain/`ColorCurves` with negative `globalSaturation` (`:266-283`). No texture-based LUT — grading is procedural via `ColorCurves`, not a literal LUT asset, but achieves the same designed effect. |
| One shadow-casting light, static shadow map | **Implemented, and specifically optimized** | `DaylightSystem.ts:34-48`: single `ShadowGenerator` off the sun, `refreshRate = RENDERONCE` since all casters are static once world-gen finishes — explicit comment flags this as the fix for a real single-digit-FPS regression. |
| Fog: `FOGMODE_EXP2`, tuned invisible fog line | **Diverged** | `SceneFactory.ts:47`: `scene.fogMode = Scene.FOGMODE_EXP` (linear-exponential), not `EXP2` (exponential-squared). Density (`fogDensity`) and `drawDistance` are both tuned per profile (40/80/115/178 units for radio/ps1/ps2/ps3) and further modulated at runtime by night level + wind (`SceneFactory.updateFog`). Divergence from spec, not obviously a bug — EXP has a gentler falloff than EXP2, which may be the reason it reads as invisible-enough already. |

### Trail / navigation

**Correction (2026-07-07): the "trail markers as the only warm light source"
concept from the original prompt is disowned by the user — it's not part of
the actual design intent and its origin is unclear. Dropped from
consideration entirely; do not carry it into Phase 2.** The actual wanted
design is a real-world-style trail marker system: **painted blazes on trees**
along the route (not free-standing lit posts), with **occasional junction
pedestals carrying a map** as a nice-to-have. Current code should be read
against that corrected vision, not the original prompt's light-beacon idea.

| Decision | Status | Notes |
|---|---|---|
| Painted-blaze-on-tree trail marking | **Absent (current blazes are free-standing, not on trees)** | `buildHikingTrail`'s `trailBlazeMat` boxes are mounted on their own dedicated posts (`ForestGenerator.ts:2114-2128`: `trailPost_${i}` cylinder + `trailBlaze_${i}` box, placed to the side of the path) — there is no association between a blaze and a scattered tree instance, painted-on-trunk or otherwise. `buildSurveyTrail`'s `markerMat` tags are the same pattern (own post, `:2246-2259`). Matching the corrected vision would mean attaching blaze decals/emissive patches to actual tree trunk instances (or trunk-shaped standalone posts styled to read as a blazed tree) rather than a separate sign post. |
| Junction pedestal with map (nice-to-have) | **Absent** | No map/kiosk prop exists anywhere in `ForestGenerator.ts` or `items/`. Would be a new prop type, likely spawned at trail-waypoint junctions (where `HIKING_WAYPOINTS`/`SURVEY_TRAIL_WAYPOINTS` branch or where a `TrailDefinition.waypoints` route forks). |
| Trail-adjacent forest thinning (clear sightlines/corridors) | **Implemented** | `ForestGenerator.inEitherCorridor`/`inHikingTrailCorridor`/`inRiverCorridor`/`inRiverApproachCorridor`/`inRockyVistaClearing` (`:128-187`) gate every scatter loop (trees, rocks, grass, ferns, groundcover, saplings) so corridors and the destination clearing stay open. |
| Collectible trail artifacts | **Implemented** | `ArtifactProp.ts` (pulsing tag+post prop, pickup radius 2.4) + per-trail `artifact` definition in `trails.ts` + `InventorySystem`/`InventoryUI`. Three artifacts total, one per trail (`survey_tag`, `ridge_marker`, `river_charm`). |
| Navigation-by-beacon (car alarm audio + visibility check) | **Implemented, and orthogonal to trail marking** | `DestinationSystem.ts` (audio-distance beacon + `isVisibleFrom` 58-unit check) is the "get back to the car" mechanic, separate from "stay on the trail while you're out." Worth keeping distinct in Phase 2: trail blazes are a wayfinding/atmosphere layer, not a replacement for the destination beacon. |

### Creatures

| Decision | Status | Notes |
|---|---|---|
| Pursuer | **Implemented** | Three-part split: `PursuerSystem` (pure state machine — distance/aggression/`far`\|`near`\|`close`\|`caught`, illumination-triggered stun+flee, flashlight-pressure hesitation, orbit-strafe behavior) in `packages/pursuit`; `PursuerBody` (procedural boxes/cylinders humanoid, `packages/glow`'s `HeartbeatGlow` for a BPM-synced glow pulse) in the app; `PursuerAudio` (tiered timer-scheduled footsteps/growls/snaps/rustle by proximity state, marked `EXTRACTION CANDIDATE`) in the app. Notably the body is **invisible** (`alpha=0`) except when directly flashlit (`alpha=1`, matte, no glow) — normally it's represented only by a floating BPM-pulsing emissive glow via `GlowLayer`, not a solid silhouette. Worth confirming this matches the intended "silhouette readability" goal, since right now it reads as a glow-blob at range rather than a silhouette. |
| Watcher | **Implemented, as a lightweight peripheral effect** | `WatcherEffect.ts`: when the pursuer is `near`/`close` and within a ±0.6 rad view-cone of the player, spawns a paired core/halo/fog "eyes" mesh near the pursuer's position, holds briefly, then either darts sideways or despawns. Not a full creature body — an eye-glint apparition. |
| Demon forest creature (3rd distinct creature) | **Absent as a separate entity — folded into the pursuer** | `PursuerBody.ts:96-97` bakes small horns onto the pursuer mesh explicitly "to keep the devil read" — the demon concept was merged into the pursuer's design rather than implemented as an independent third creature. |
| Blender block-out→sculpt→retopo→rig→`AnimationGroup` pipeline | **Absent** | All creature motion is procedural sine-wave gait/lean/scale driven directly in `PursuerBody.update()` (`:147-184`) — no skeleton, no imported animation. |
| Ambient wildlife (not in original design doc) | **New/undocumented addition** | `WildlifeSystem.ts` — ps3-only birds + deer/fox/turkey with flee-on-approach and respawn-around-player logic. Not mentioned anywhere in the prior design sessions; worth flagging as an out-of-scope addition (or an update to fold into the design doc going forward). |

## 4. Divergence summary (not judged right/wrong, just flagged)

- Fog is `FOGMODE_EXP`, not the specified `FOGMODE_EXP2`.
- There is no distance-tiered LOD system at all — cost is controlled by total scatter counts per profile mode (`treeCount`, per-species counts scaled by mode/flavor) and by fog/drawDistance, not by swapping representations near the fog line.
- No texture/material asset pipeline exists anywhere (terrain, trees, rocks, trail, car, creatures) — everything is flat vertex/material color. This means "baked AO" and "TerrainMaterial blending" specifically can't exist yet; SSAO2 (real-time, not baked) is the only AO present.
- Trail marking is currently free-standing sign posts (dedicated post+blaze meshes), not blazes painted on actual trees, and there's no junction map pedestal. (Note: the original prompt's "trail markers as the only warm light source" framing has been dropped per user correction — not part of the actual design intent.)
- The "demon" creature concept was absorbed into the pursuer's model rather than built separately.
- `WildlifeSystem` is a codebase addition with no counterpart in the prior design docs.

## 5. Performance-relevant observations

- **Instancing discipline is already strong.** Every repeated element (trees, rocks, grass, groundcover, ferns, saplings, mushrooms, scree, cairns' component stones excepted) is baked as a small template library and scattered via `thinInstanceAdd`, not per-object `InstancedMesh` or unique geometry — extensively commented as a deliberate prior optimization pass in `ForestGenerator.ts` (e.g. groundcover: "~17,500 instances... now thin instances (one matrix in a buffer each)").
- **No far-tier cost reduction.** Because there's no billboard/impostor tier, every instance within `drawDistance*1.15` is full 3D geometry — at `ps3` profile that's 2,200 trees plus outer-ring/lot-ring/wall trees plus thousands of grass/groundcover/fern instances, all at full vertex count, all the time. This is the main place where adding the designed LOD tiers would pay off, especially for `ps3`'s larger `drawDistance` (178).
- **Shadow casters are registered selectively.** `addCasters()` skips grass/leaf-litter/moss/branch-stubs and the cluster-canopy thin-instances deliberately (`ForestGenerator.ts:117-126`), and the shadow map only renders once (`RENDERONCE`) since geometry is static after world-gen — this is already the right call for a single moving shadow-casting light with 1000+ static casters.
- **Light budget:** 5 simultaneous lights (sun + ambient + 2 lamp posts + flashlight) forced `maxSimultaneousLights = 6` on every material via `onNewMaterialAddedObservable` (`Game.ts:172-178`) — fine at this light count, but a ceiling to watch if more lights are added later (e.g. a lit junction pedestal, if that ships).
- **River water animation** (`buildRiverTrailFeatures`) drives a per-frame `onBeforeRenderObservable` sine-wave over N short water segments (`ForestGenerator.ts:1518-1523`) — cheap (no shader), but is a per-frame JS loop over however many ~6-unit segments the river polyline produces; fine at current river lengths (~4 segments of RIVER_POINTS × a handful of 6-unit steps each).
- **Draw-call shape:** thin instances + merged multi-part meshes (trees, car, pursuer body) keep draw-call count low; the car alone is ~30 separate `Mesh` objects (`buildCarGoal`) not merged, which is a minor outlier next to the thin-instance-everything pattern used elsewhere, though it's a one-off per world (not scattered), so it's a fixed, small cost.

## 6. Open questions for Phase 2 discussion

1. Forest generation: is moving to real distance-tiered LOD (billboard impostors past ~30-80m) worth it given instancing is already efficient, or does count-tuning-per-profile already solve the actual performance problem?
2. Trail generation: is the DEM/GPX pipeline still the goal? Separately — how should painted-on-tree blazes attach to the existing tree-scatter system (`ForestGenerator.buildForest`'s thin-instanced template library), given trees currently have no per-instance identity to hang a "this one is blazed" decal off of? And where should junction pedestals spawn relative to `HIKING_WAYPOINTS`/`SURVEY_TRAIL_WAYPOINTS`/`TrailDefinition.waypoints`?
3. Creatures: should the "demon" be split back out from the pursuer now that `WatcherEffect` and `WildlifeSystem` both exist as separate lightweight creature-adjacent systems, or is the merged design intentional and final?
