# Engineering Spec Prompt: Authored Morphing Cloud Volumes for Babylon.js

## Role

Act as a senior TypeScript, Babylon.js, real-time rendering, and procedural graphics engineer.

Design and implement an authored cloud system for the **Dissonance** game that represents clouds as scriptable volumetric shape graphs rather than conventional static sky textures or purely noise-generated volumetric clouds.

The system must allow artists and engineers to:

- Author cloud formations from reusable volumetric primitives.
- Define named cloud shapes.
- Morph continuously between different authored shapes.
- Apply wind shear and local deformation.
- Scroll cloud formations across the sky.
- Recycle formations into an effectively infinite cloud field.
- Render the same authored cloud data through multiple quality tiers.
- Preserve art direction while adding procedural detail and variation.
- Integrate with existing Babylon.js world, atmosphere, weather, and performance systems.

The core design principle is:

> Authored fields control low-frequency form; procedural systems control high-frequency detail.

Do not begin by implementing a full-screen, unconstrained volumetric cloud raymarch. First establish the data model, authoring workflow, deterministic animation, debug visualization, and an inexpensive renderer.

---

## Project Context

The target project uses:

- TypeScript
- Babylon.js
- Vite
- Modular game-engine packages
- Profile-driven configuration
- Ground-level and occasional elevated exploration
- Large outdoor environments
- Atmospheric fog and restrained cinematic lighting
- Multiple visual-quality tiers
- Potential WebGL 2 and WebGPU rendering paths

The desired aesthetic is not photorealistic simulation for its own sake. The cloud system should support:

- Moody overcast skies
- Long low cloud banks
- Broken formations
- Slowly building storm fronts
- Wind-sheared silhouettes
- Sparse hero clouds over landmarks
- Subtle symbolic or unsettling forms
- Natural ambiguity rather than explicit skywriting
- A visual language between atmospheric realism and authored stylization

The system should be usable for ordinary ambient weather and for authored narrative sky events.

---

# Primary Objective

Implement a reusable `AuthoredCloudField` system in which each cloud formation is described by a set of volumetric primitives and semantic control parts.

A cloud formation must support:

1. Named shape definitions.
2. Compatible semantic primitive mappings between shapes.
3. Primitive transform interpolation.
4. Density-field crossfading where topology differs.
5. Per-part timing offsets.
6. Wind-driven translation and deformation.
7. Procedural edge erosion.
8. Multiple renderer backends.
9. Camera-relative positioning and recycling.
10. Debug inspection in a development scene or materials-demo application.

---

# Non-Goals for the Initial Implementation

Do not initially implement:

- A planet-scale atmospheric fluid simulation.
- Physically accurate meteorology.
- Full Navier-Stokes cloud dynamics.
- Global weather prediction.
- Unbounded full-resolution raymarching.
- Arbitrary real-time CSG editing by the player.
- A production cloud editor before the runtime model is validated.
- Mesh morph targets as the primary cloud representation.
- Large transparent particle systems without an overdraw budget.
- Per-cloud physics bodies or collision.

Clouds are visual and atmospheric unless a later gameplay system explicitly requires interaction.

---

# Required Architecture

Create or propose modules equivalent to:

```text
AuthoredCloudField
├── CloudShapeLibrary
├── CloudPrimitiveGraph
├── CloudMorphController
├── CloudWindDeformer
├── CloudDensityEvaluator
├── CloudSequenceDirector
├── CloudFieldManager
├── CloudRecycler
├── CloudDebugRenderer
├── CloudPuffRenderer
├── CloudVolumeRenderer
└── CloudShadowProjector
```

Names may change to match repository conventions, but responsibilities must remain separated.

Avoid creating one monolithic `CloudSystem` class containing authoring, simulation, rendering, and lifecycle logic.

---

# Core Data Model

## Cloud primitive types

Support these primitives in the first production-capable data model:

```ts
type CloudPrimitiveType = 'ellipsoid' | 'capsule' | 'roundedBox' | 'sweptCurve';
```

The first implementation only needs to render ellipsoids and capsules. The schema must remain extensible.

Each primitive must have:

```ts
interface CloudPrimitiveDefinition {
  id: string;
  semanticRole: CloudSemanticRole;
  type: CloudPrimitiveType;

  position: readonly [number, number, number];
  rotationEuler?: readonly [number, number, number];
  scale: readonly [number, number, number];

  density: number;
  softness: number;

  operation: 'add' | 'subtract';

  noiseInfluence?: number;
  windInfluence?: number;
  lightingInfluence?: number;

  enabled?: boolean;
}
```

Recommended semantic roles:

```ts
type CloudSemanticRole =
  | 'core'
  | 'lowerMass'
  | 'upperCrown'
  | 'leadingEdge'
  | 'trailingEdge'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'wisp'
  | 'cutout'
  | 'detail';
```

Semantic roles are important because morphing must not rely only on array indices.

---

## Cloud shape definition

```ts
interface CloudShapeDefinition {
  id: string;
  displayName: string;

  primitives: Record<string, CloudPrimitiveDefinition>;

  bounds: {
    center: readonly [number, number, number];
    extents: readonly [number, number, number];
  };

  lighting?: CloudLightingProfile;
  erosion?: CloudErosionProfile;
  metadata?: Record<string, unknown>;
}
```

A shape definition must be immutable at runtime. Runtime instances should create resolved mutable state separately.

---

## Lighting profile

```ts
interface CloudLightingProfile {
  baseDarkness: number;
  topBrightness: number;
  ambientContribution: number;
  forwardScattering: number;
  silverLiningStrength: number;
  absorption: number;
}
```

---

## Erosion profile

```ts
interface CloudErosionProfile {
  macroScale: number;
  macroStrength: number;

  detailScale: number;
  detailStrength: number;

  edgeSoftness: number;
  densityThreshold: number;

  advectionSpeed: readonly [number, number, number];
}
```

---

## Cloud shape sequence

```ts
interface CloudShapeKeyframe {
  timeSeconds: number;
  shapeId: string;

  densityMultiplier?: number;
  erosionMultiplier?: number;
  verticalGrowth?: number;
  horizontalStretch?: number;

  easing?: CloudEasingName;
}

interface CloudSequenceDefinition {
  id: string;
  durationSeconds: number;
  loopMode: 'once' | 'loop' | 'pingPong';

  keyframes: CloudShapeKeyframe[];

  partTimingOffsets?: Partial<Record<CloudSemanticRole, number>>;

  movement: {
    direction: readonly [number, number, number];
    speedMetersPerSecond: number;
  };

  deformation?: CloudWindDeformationProfile;
}
```

---

# Density-Field Model

The authored cloud must be treated as an implicit density field.

Do not treat primitive geometry as the final visible surface.

For each sample point:

1. Transform the point into cloud-local space.
2. Transform it into each primitive's local space.
3. Evaluate the primitive field.
4. Combine additive and subtractive primitives.
5. Apply authored density.
6. Apply large-scale procedural erosion.
7. Apply fine procedural detail.
8. Clamp or remap the result into final density.

Conceptual evaluation:

```ts
function evaluateCloudDensity(localPoint: Vector3, resolvedShape: ResolvedCloudShape, noise: CloudNoiseSampler): number;
```

The density evaluator should have:

- A CPU implementation for debugging, tests, bounds inspection, and puff placement.
- A shader-compatible formulation for the volumetric renderer.
- Deterministic results from a supplied seed.
- No hidden dependency on global time.

Time and wind offsets must be passed explicitly.

---

# Primitive Field Requirements

## Ellipsoid

Evaluate a normalized local point against an ellipsoidal field.

The field must support:

- Nonuniform scale.
- Rotation.
- Soft edges.
- Density weighting.

## Capsule

Evaluate distance to a line segment with radius and anisotropic scaling where practical.

## Additive composition

Combine masses without exposing obvious sphere intersections.

Do not simply clamp the sum immediately after every primitive. Preserve enough range for smooth remapping.

## Subtractive composition

Allow authored cutouts beneath or between cloud masses.

Subtractive primitives are useful for:

- Flattening cloud undersides.
- Creating channels.
- Breaking symmetry.
- Preventing merged-sphere silhouettes.
- Forming arch-like negative space.

---

# Morphing Requirements

Implement two morphing strategies.

## Strategy A: Semantic primitive interpolation

Use when both shapes contain compatible semantic primitives.

Interpolate:

- Position with `Vector3.Lerp`.
- Rotation with `Quaternion.Slerp`.
- Scale with `Vector3.Lerp`.
- Density.
- Softness.
- Noise influence.
- Wind influence.
- Lighting influence.

Missing primitives may resolve to a zero-density or near-zero-scale pose, but transitions must avoid numerical instability.

Use eased interpolation rather than raw linear timing.

Provide at least:

```ts
type CloudEasingName = 'linear' | 'smoothstep' | 'smootherstep' | 'easeInOutCubic';
```

## Strategy B: Density-field crossfade

Use when shapes have incompatible structures.

Evaluate both fields and blend their densities.

Prevent the result from reading as a global dissolve by supporting a spatial transition mask.

Possible transition directions:

```ts
type CloudMorphDirection =
  | 'uniform'
  | 'leadingToTrailing'
  | 'trailingToLeading'
  | 'bottomToTop'
  | 'topToBottom'
  | 'radial';
```

The local morph weight should be allowed to vary by cloud-local position and noise.

---

# Temporal Behavior

Cloud animation must occur at several distinct time scales.

Recommended ranges:

```text
Formation translation:       minutes
Primary silhouette morph:    30–180 seconds
Part-level deformation:      8–40 seconds
Edge erosion movement:       2–15 seconds
Fine noise advection:        continuous
```

Do not animate every property from one global sinusoid.

Each semantic role may have a timing offset.

Example:

```ts
const defaultPartTimingOffsets = {
  core: 0,
  upperCrown: 0.08,
  leadingEdge: -0.12,
  trailingEdge: 0.18,
  lowerMass: 0.1,
  wisp: 0.25,
};
```

Offsets should be normalized relative to the active morph interval.

---

# Wind and Deformation

Clouds must not move as rigid props only.

Implement a `CloudWindDeformer` that can modify resolved primitive poses based on:

- Cloud-local height.
- Leading/trailing position.
- Semantic role.
- Wind direction.
- Wind speed.
- Per-primitive wind influence.
- Time.
- Deterministic seed.

Required deformation controls:

```ts
interface CloudWindDeformationProfile {
  upperWindMultiplier: number;
  lowerWindMultiplier: number;

  horizontalShear: number;
  verticalLift: number;
  trailingStretch: number;
  leadingCompression: number;

  crownGrowth: number;
  wispBreakup: number;

  oscillationAmplitude: number;
  oscillationFrequency: number;
}
```

The result should support:

- Faster upper-level movement.
- Elongated trailing edges.
- Compressed leading edges.
- Slow crown buildup.
- Slight vertical breathing.
- Independent wisps.
- Asymmetric deformation.

All deformation must remain bounded so that cloud bounds can be conservatively calculated.

---

# Cloud Movement and Recycling

Each active cloud instance has a root transform.

```ts
interface CloudInstanceState {
  id: string;
  sequenceId: string;
  seed: number;

  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;

  ageSeconds: number;
  sequenceTimeSeconds: number;

  active: boolean;
}
```

Move the cloud root using the active wind vector.

Do not accumulate cloud positions indefinitely across enormous world coordinates.

Support a camera-relative cloud field:

- Maintain a cloud-field origin near the camera.
- Rebase or recycle clouds when they exceed a configurable horizontal range.
- Preserve visual continuity during rebasing.
- Avoid visible snapping.
- Keep cloud-local noise coordinates stable through recycling where possible.

When recycling a cloud:

- Move it ahead of the active wind corridor.
- Choose a compatible sequence from a weighted pool.
- Randomize scale within safe limits.
- Randomize altitude within a configured band.
- Randomize yaw slightly.
- Generate a deterministic seed.
- Avoid immediate repetition of the same silhouette.

---

# Renderer Quality Tiers

The authored shape data must not be coupled to one renderer.

Implement renderer interfaces such as:

```ts
interface CloudRenderer {
  initialize(context: CloudRenderContext): Promise<void>;
  addCloud(instance: CloudInstance): void;
  removeCloud(instanceId: string): void;
  update(frame: CloudFrameState): void;
  render(frame: CloudFrameState): void;
  dispose(): void;
}
```

Support the following staged renderers.

---

## Tier 0: Debug primitive renderer

Purpose:

- Validate authoring.
- Inspect bounds.
- Inspect primitive roles.
- Inspect morph compatibility.
- Inspect wind deformation.
- Test sequence playback.

Render:

- Wireframe or transparent ellipsoids.
- Primitive IDs.
- Semantic-role colors.
- Cloud bounds.
- Wind vector.
- Current shape and morph percentage.

This tier is mandatory before visual cloud rendering.

---

## Tier 1: Instanced puff renderer

This is the first visual production prototype.

Populate each cloud volume with deterministic sample points.

Possible methods:

- Rejection sampling.
- Stratified grid sampling.
- Blue-noise sample set.
- Precomputed unit-volume sample set transformed into cloud space.

Use:

- Thin instances where appropriate.
- Camera-facing quads or crossed quads.
- Soft cloud textures.
- Per-instance scale.
- Per-instance opacity.
- Density-based culling.
- Depth-aware fading if available.
- Stable seeded placement.

Do not regenerate every puff every frame.

Instead:

- Generate stable local samples.
- Re-evaluate density or transform influence as the cloud morphs.
- Fade puffs in and out gradually.
- Update only required instance attributes.
- Consider grouping updates over multiple frames.

Target ranges should be configurable, for example:

```text
Distant cloud:  24–80 puffs
Medium cloud:   80–180 puffs
Hero cloud:     180–400 puffs
```

These are starting values, not fixed requirements.

Provide an overdraw budget and debug visualization.

---

## Tier 2: Bounded volumetric renderer

Implement only after the authoring and puff systems work.

Requirements:

- Raymarch only inside each cloud's conservative bounds.
- Render to a reduced-resolution target.
- Support half- or quarter-resolution rendering.
- Use early ray-box rejection.
- Use empty-space skipping or coarse stepping.
- Use smaller steps only near meaningful density.
- Terminate when accumulated opacity is sufficiently high.
- Limit light-transmittance samples.
- Composite against scene depth.
- Support temporal accumulation only if it remains stable.
- Expose quality presets.

Do not raymarch the entire sky atmosphere for every pixel.

Recommended initial presets:

```ts
interface CloudVolumeQualityPreset {
  resolutionScale: number;
  maxViewSteps: number;
  maxLightSteps: number;
  densityCutoff: number;
  earlyExitAlpha: number;
  temporalAccumulation: boolean;
}
```

---

## Tier 3: Hybrid renderer

The production target should permit:

- Distant cloud banks as puff or sheet representations.
- Mid-distance clouds as puff volumes.
- Selected hero clouds as bounded raymarched volumes.
- Shared authored shape definitions across all tiers.
- Smooth renderer LOD transitions where practical.

Renderer selection may depend on:

- Distance.
- Projected screen size.
- Narrative importance.
- Platform quality tier.
- Current GPU frame budget.

---

# Cloud Shadows

Implement cloud shadows separately from visible cloud rendering.

The initial shadow system should use:

- A low-frequency projected noise texture or weather map.
- Wind synchronized with the dominant cloud field.
- Broad, low-contrast shading.
- Terrain/world-position projection.
- Configurable shadow strength.
- Optional region masks.

Later, hero clouds may contribute local shadow proxies derived from their authored density bounds.

Do not require visible puff geometry to cast conventional Babylon.js shadow-map shadows.

Cloud shadows should remain inexpensive and visually coherent rather than geometrically exact.

---

# Atmosphere Integration

Clouds must integrate with:

- Sky color.
- Sun direction.
- Fog color.
- Fog density.
- Time of day.
- Exposure.
- Weather state.
- Regional atmosphere profiles.

Distant clouds should approach the horizon fog color.

Avoid bright white clouds in heavily desaturated or overcast scenes unless explicitly art-directed.

Provide an atmosphere adapter:

```ts
interface CloudAtmosphereState {
  sunDirection: Vector3;
  sunColor: Color3;
  ambientColor: Color3;
  horizonColor: Color3;
  fogColor: Color3;
  fogDensity: number;
  exposure: number;
}
```

The cloud system must consume resolved atmosphere state rather than reading arbitrary scene globals in multiple modules.

---

# Lighting Approximation

For puff rendering:

- Use height-based top/bottom color variation.
- Apply sun-facing brightness.
- Darken lower mass.
- Support optional rim or forward-scattering approximation.
- Avoid lighting each puff as an unrelated billboard.

For volumetric rendering:

- Estimate transmittance toward the sun with a small number of samples.
- Include ambient contribution.
- Support density-based absorption.
- Support height-based color bias.
- Keep light sample counts configurable.

Lighting must prioritize stable art direction over strict physical accuracy.

---

# Authoring Workflow

Start with code-authored or JSON-authored shape definitions.

Do not build a complex editor first.

Provide:

1. A shape library directory.
2. Schema validation.
3. Hot reload where practical.
4. Debug selection controls.
5. Shape preview.
6. Sequence playback.
7. Morph scrubber.
8. Wind controls.
9. Erosion controls.
10. Seed controls.
11. Renderer-tier selector.
12. Performance counters.

All cloud assets must be visually inspected in the project's **materials-demo** or equivalent visual inspection app before integration into the main world.

The demo must support:

- Isolated sky preview.
- Neutral lighting.
- Dissonance overcast lighting.
- Dawn/dusk lighting.
- Fog on/off.
- Fixed and animated sun.
- Camera orbit.
- Ground-level camera.
- Elevated camera.
- Current primitive debug view.
- Puff renderer view.
- Volume renderer view when available.

---

# Example Shape Library

Create at least these initial authored shapes:

```text
low-broken-bank
flat-overcast-mass
wind-sheared-trail
rising-crown
storm-wall
isolated-cumulus
fragmented-wisps
```

Each shape should use a manageable primitive count.

Recommended initial range:

```text
6–16 primary primitives
0–6 subtractive primitives
```

Do not use dozens of tiny primitives to imitate fine noise. Fine detail belongs to the erosion system.

---

# Example Sequence Library

Create at least these sequences:

## Ambient drift

```text
low-broken-bank
→ wind-sheared-trail
→ low-broken-bank
```

## Storm buildup

```text
flat-overcast-mass
→ rising-crown
→ storm-wall
```

## Dissolving front

```text
storm-wall
→ fragmented-wisps
→ low-broken-bank
```

## Narrative ambiguity

A formation gradually approaches a deliberate silhouette from a specific observation region, then loses that structure as it passes.

The result must remain deniable and natural rather than becoming literal iconography.

---

# Serialization and Validation

Use serializable definitions.

Provide runtime validation for:

- Duplicate primitive IDs.
- Invalid scales.
- Negative softness.
- Missing shape references.
- Unsorted keyframes.
- Empty sequences.
- Unsupported primitive types.
- Invalid semantic-role mappings.
- Excessive primitive counts.
- Bounds that fail to contain resolved primitives.
- Morph pairs with incompatible primitive mappings.

Validation errors must be actionable.

Example:

```text
Cloud shape "storm-wall" primitive "upper-crown-2":
scale.x must be greater than 0; received 0.
```

---

# Performance Requirements

Instrument:

- Active cloud count.
- Active primitive count.
- Puff count.
- Transparent overdraw estimate where possible.
- CPU density evaluations per frame.
- GPU cloud render time.
- Volume raymarch steps.
- Shadow pass cost.
- Memory used by cloud instance buffers.
- Recycled clouds per minute.
- LOD transitions.

Provide adjustable budgets.

Suggested initial desktop targets:

```text
Cloud simulation CPU:       under 1 ms average
Puff renderer GPU:          under 2 ms average
Cloud shadows:              under 0.5 ms average
Hero volume renderer:       under 3 ms at selected quality
Total cloud system:         configurable to stay under 4–6 ms
```

Treat these as working targets to validate, not guaranteed platform-independent limits.

The system must degrade gracefully:

1. Reduce hero volume resolution.
2. Reduce raymarch steps.
3. Reduce puff count.
4. Disable local cloud shadows.
5. Reduce active cloud count.
6. Fall back to distant sheets or static sky coverage.

---

# Determinism

Cloud behavior must be deterministic when given:

- World seed.
- Cloud instance seed.
- Sequence definition.
- Starting transform.
- Simulation time.

Do not use `Math.random()` inside simulation or rendering code.

Use the project's seeded random service or create a small injected deterministic generator.

Determinism is required for:

- Reproducible screenshots.
- Debugging.
- Save/load.
- Narrative sky events.
- Automated visual testing.

---

# Save and Restore

Cloud field state should be restorable from compact data.

Persist:

- Active sequence ID.
- Sequence time.
- Cloud transform.
- Seed.
- Renderer-relevant stable sample seed.
- Lifecycle state.

Do not persist every puff transform if those can be regenerated deterministically.

---

# API Proposal

Provide an API similar to:

```ts
interface AuthoredCloudFieldOptions {
  maxActiveClouds: number;
  fieldRadius: number;
  altitudeRange: readonly [number, number];
  seed: number;
  qualityProfile: CloudQualityProfile;
}

class AuthoredCloudField {
  constructor(
    scene: Scene,
    shapeLibrary: CloudShapeLibrary,
    sequenceLibrary: CloudSequenceLibrary,
    atmosphereSource: CloudAtmosphereSource,
    options: AuthoredCloudFieldOptions,
  );

  initialize(): Promise<void>;

  spawnCloud(request: CloudSpawnRequest): CloudInstanceHandle;

  removeCloud(id: string): void;

  setWeatherProfile(profileId: string): void;

  setQualityProfile(profile: CloudQualityProfile): void;

  update(deltaSeconds: number): void;

  captureState(): CloudFieldSaveState;

  restoreState(state: CloudFieldSaveState): void;

  dispose(): void;
}
```

Support explicit narrative spawning:

```ts
cloudField.spawnCloud({
  sequenceId: 'narrative-listening-form',
  position: observationCorridorStart,
  altitude: 420,
  importance: 'hero',
  seed: narrativeSeed,
});
```

---

# Testing Requirements

## Unit tests

Test:

- Primitive density evaluation.
- Additive composition.
- Subtractive composition.
- Transform conversion.
- Semantic primitive interpolation.
- Quaternion interpolation.
- Easing.
- Spatial morph masks.
- Sequence selection.
- Sequence looping.
- Wind deformation bounds.
- Deterministic seeded sampling.
- Recycling decisions.
- Serialization.
- Validation failures.

## Integration tests

Test:

- Cloud field initialization and disposal.
- Renderer switching.
- Shape hot reload.
- Atmosphere updates.
- Camera-relative rebasing.
- Save/restore equivalence.
- Quality-profile changes.
- Narrative sequence spawning.
- No resource leaks after repeated recycling.

## Visual regression tests

Capture deterministic views for:

- Each authored shape.
- Each sequence at fixed normalized times.
- Multiple seeds.
- Puff renderer.
- Debug renderer.
- Volume renderer.
- Fog integration.
- Dawn/dusk lighting.
- Camera-relative rebase boundary.
- LOD transition distances.

---

# Development Controls

Add a developer panel with:

- Enable/disable cloud system.
- Pause simulation.
- Time scale.
- Wind direction.
- Wind speed.
- Active shape.
- Active sequence.
- Morph scrubber.
- Erosion strength.
- Density threshold.
- Renderer tier.
- Puff count multiplier.
- Volume resolution scale.
- View-step count.
- Light-step count.
- Shadow strength.
- Bounds visualization.
- Primitive-role visualization.
- Performance counters.
- Regenerate seed.
- Spawn hero cloud.
- Recycle all clouds.

The panel should integrate with the project's existing developer UI conventions rather than creating a second independent HUD framework.

---

# Implementation Phases

## Phase 1: Data model and debug geometry

Deliver:

- TypeScript schemas.
- Shape library.
- Sequence library.
- Validation.
- CPU density evaluator.
- Semantic primitive interpolation.
- Cloud root movement.
- Wind deformation.
- Debug geometry renderer.
- Materials-demo integration.
- Unit tests.

Acceptance gate:

- At least three cloud shapes morph cleanly in debug view.
- A cloud can scroll, deform, recycle, and replay deterministically.
- Bounds remain valid during all tested morphs.
- No visual renderer work begins until this is stable.

---

## Phase 2: Instanced puff renderer

Deliver:

- Stable seeded volume sampling.
- Thin-instance or equivalent puff rendering.
- Density-based visibility.
- Per-puff scale and opacity.
- Height-based shading.
- Sun-direction response.
- Fog integration.
- Overdraw and count diagnostics.
- Quality settings.
- Visual regression tests.

Acceptance gate:

- Clouds read as coherent volumes from ground level.
- Morphs do not visibly pop.
- Puffs do not regenerate randomly every frame.
- Formation movement does not look like rigid card translation.
- Target desktop performance is measured and documented.

---

## Phase 3: Field management and weather integration

Deliver:

- Multi-cloud field.
- Camera-relative origin.
- Recycling.
- Weighted sequence pools.
- Weather profiles.
- Atmosphere adapter.
- Cloud shadow projection.
- Save/restore.
- Narrative cloud spawning.

Acceptance gate:

- The field can run continuously without drift, leaks, or visible recycling.
- Weather transitions can change sequence pools and coverage.
- Cloud shadows move coherently with the dominant wind.
- Narrative clouds can coexist with ambient clouds.

---

## Phase 4: Bounded volumetric hero renderer

Deliver:

- Per-cloud bounded raymarch.
- Reduced-resolution render target.
- Scene-depth composite.
- Configurable view and light steps.
- Early termination.
- Empty-space optimization.
- Quality presets.
- Hero-cloud renderer assignment.
- Hybrid LOD strategy.

Acceptance gate:

- One or more hero clouds can render volumetrically within budget.
- Distant clouds remain on cheaper renderers.
- Renderer transitions are acceptable at intended camera distances.
- Performance measurements are included.

---

## Phase 5: Art-direction refinement

Deliver:

- Initial production shape library.
- Initial production sequence library.
- Region-specific cloud profiles.
- Dissonance narrative formations.
- Improved erosion.
- Improved silhouette controls.
- Documentation for authors.
- Example recipes.

Acceptance gate:

- A non-rendering engineer can create or modify a cloud shape from documentation.
- Authored symbolism remains subtle.
- The system supports both ordinary ambient weather and narrative sky direction.

---

# Acceptance Criteria

The implementation is complete when:

1. Clouds are represented by authored volumetric primitive graphs.
2. Shapes can morph through semantic primitive interpolation.
3. Incompatible shapes can transition through spatial density crossfades.
4. Wind affects deformation as well as translation.
5. Shape, erosion, and motion are deterministic.
6. Clouds scroll and recycle without visible snapping.
7. The same cloud definitions work across debug, puff, and volumetric renderers.
8. The first useful production tier does not require volumetric raymarching.
9. Fog, atmosphere, lighting, and cloud shadows are integrated.
10. The system has explicit performance budgets and instrumentation.
11. Cloud assets are visually inspected in the materials-demo application.
12. Automated tests cover field evaluation, morphing, sequencing, recycling, and serialization.
13. Narrative cloud events can be spawned explicitly and remain separate from ambient weather selection.
14. No single monolithic class owns all cloud responsibilities.
15. Documentation explains how to add a shape, sequence, weather profile, and narrative event.

---

# Required Deliverables

Produce:

1. A brief repository audit identifying relevant existing systems.
2. A proposed file and package layout.
3. Core TypeScript interfaces.
4. A phased implementation plan mapped to repository files.
5. Phase 1 implementation.
6. Tests for Phase 1.
7. Materials-demo visualization.
8. Performance-risk notes.
9. Follow-up recommendations for the puff renderer.
10. Clear documentation of assumptions and unresolved constraints.

Do not silently invent repository architecture. Inspect the existing codebase first and adapt the design to current conventions.

---

# Engineering Constraints

- Use strict TypeScript.
- Avoid `any`.
- Prefer immutable authored definitions.
- Separate authored data from resolved runtime state.
- Inject randomness and time dependencies.
- Dispose Babylon.js resources explicitly.
- Avoid per-frame allocations in hot paths.
- Avoid rebuilding meshes or buffers every frame.
- Avoid reading scene globals from unrelated modules.
- Use existing profile-resolution patterns where available.
- Use existing developer UI and event infrastructure.
- Preserve WebGL 2 compatibility for baseline features.
- Isolate optional WebGPU improvements.
- Document GPU feature requirements.
- Do not couple cloud logic to a single world scene.
- Do not make cloud rendering block game startup if a fallback renderer is available.

---

# Final Instruction

Begin by auditing the repository for:

- Existing sky and atmosphere systems.
- Fog configuration.
- Weather profiles.
- Time-of-day state.
- Materials-demo or visual-inspection application.
- Existing profile architecture.
- Thin-instance utilities.
- Shader infrastructure.
- Render-target utilities.
- Developer HUD controls.
- Seeded randomness.
- Save/load conventions.
- Performance instrumentation.

Then provide a concise implementation proposal before modifying code.

Implement Phase 1 completely before proceeding to later phases unless existing repository infrastructure makes a limited puff prototype necessary to validate the density model.
