# Dissonance Engineering Prompt: Camera-Aware Foliage Occlusion and Interaction

You are an expert TypeScript and Babylon.js graphics engineer working inside the existing **Dissonance / DTA monorepo**.

Your task is to design and implement a reusable foliage interaction system that recreates the behavior seen in games where dense vegetation remains visually present but foliage blocking the camera or player becomes partially dissolved, bent aside, or otherwise made readable.

The result must work well in a dense Babylon.js forest, remain compatible with thin instances, and fit the project’s existing profile-driven architecture.

---

# Core Goal

Implement a foliage system with three coordinated behaviors:

1. **Near-camera foliage dissolve**
2. **Camera-to-player visibility corridor**
3. **Physical foliage displacement around the player**

The system must preserve the feeling of moving through dense vegetation without allowing leaves and branches to make the game unreadable.

This is not merely a transparency effect.

The final behavior should be:

- distant vegetation remains fully visible,
- vegetation near the player bends away,
- foliage very close to the camera partially dissolves,
- foliage between the camera and a third-person subject can dissolve along a narrow corridor,
- wind animation and player interaction coexist,
- thin-instance performance remains viable,
- the system is configurable through profiles,
- debug visualization is available.

---

# Project Context

The codebase uses:

- TypeScript
- Babylon.js
- Vite
- profile-driven environment configuration
- thin instances for high-volume repeated geometry
- reusable packages inside a monorepo

The project already favors a pattern similar to:

```ts
EnvironmentProfile
BehaviorProfile
EmbodimentProfile
AudioProfile
ResolvedPursuerProfile
applyProfile()
```

The foliage system should follow the same general principle:

> There must be one resolved configuration path, rather than scattered ad hoc constants.

Do not introduce multiple competing initialization paths.

---

# Required Package Boundary

Create or extend a package with a structure similar to:

```text
@dta/world-foliage
├── src/
│   ├── FoliageInteractionController.ts
│   ├── FoliageInteractionProfile.ts
│   ├── FoliageMaterialPlugin.ts
│   ├── FoliageInstanceData.ts
│   ├── FoliageDebugRenderer.ts
│   ├── resolveFoliageInteractionProfile.ts
│   ├── shaders/
│   │   ├── foliageInteraction.vertex.glsl
│   │   └── foliageOcclusion.fragment.glsl
│   └── profiles/
│       ├── naturalForest.ts
│       ├── denseUndergrowth.ts
│       ├── synodConditioned.ts
│       └── hallucination.ts
├── test/
└── index.ts
```

Adapt this structure to the repository’s actual conventions rather than forcing it literally.

---

# Functional Requirements

## 1. Near-Camera Foliage Dissolve

Foliage fragments close to the active camera must dissolve using alpha testing or dithering.

Do not rely on broad conventional alpha blending for the primary effect.

The implementation should prefer:

- alpha testing,
- ordered dithering,
- blue-noise dithering,
- temporal dithering if stable,
- fragment discard where appropriate.

The intent is to avoid:

- transparency sorting problems,
- excessive blended overdraw,
- large translucent leaf masses,
- visible circular clipping.

The dissolve must use a smooth inner and outer radius.

Conceptually:

```glsl
float cameraDistance = distance(worldPosition, cameraPosition);

float cameraVisibility = smoothstep(
    cameraInnerRadius,
    cameraOuterRadius,
    cameraDistance
);
```

Then apply dithered discard:

```glsl
float threshold = sampleDither(screenUv, worldPosition, instanceSeed);

if (threshold > cameraVisibility) {
  discard;
}
```

The exact comparison may be inverted depending on implementation, but the visible result must be correct.

The dissolve should remain somewhat irregular and organic.

Avoid a perfectly spherical visible boundary.

---

## 2. Camera-to-Player Visibility Corridor

For third-person or over-the-shoulder modes, create a narrow soft corridor between the camera and a configured player focus point.

The focus point should normally be:

- upper torso,
- chest,
- shoulders,
- or head.

Do not target the player’s feet by default.

The corridor should be represented mathematically as a capsule or distance-to-line-segment field.

Conceptually:

```glsl
float distanceToSightline = distanceToSegment(
  worldPosition,
  cameraPosition,
  playerFocusPosition
);

float corridorVisibility = smoothstep(
  corridorInnerRadius,
  corridorOuterRadius,
  distanceToSightline
);
```

Combine this with the camera dissolve so either condition can reduce visibility:

```glsl
float visibility = min(
  cameraVisibility,
  corridorVisibility
);
```

You may use a more suitable compositing method if it produces a better transition.

The corridor must:

- remain narrow,
- avoid exposing large amounts of ground,
- avoid looking like a tunnel cut through the forest,
- fade softly at the edges,
- disable cleanly in first-person mode.

---

## 3. Player-Centered Foliage Displacement

Nearby vegetation must bend or move away from the player.

This must occur primarily in the vertex shader.

The system should calculate influence using a configurable interaction volume around the player.

A capsule is preferred, but a sphere or ellipsoid is acceptable for the first implementation.

Conceptually:

```glsl
float influence =
  1.0 - smoothstep(
    pushInnerRadius,
    pushOuterRadius,
    distanceToPlayerVolume
  );

vec3 pushDirection = normalize(
  worldPosition - closestPointOnPlayerVolume
);

worldPosition +=
  pushDirection *
  influence *
  pushStrength *
  vertexFlexibility;
```

The system must support per-vertex or per-mesh stiffness so that:

- grass bends substantially,
- shrubs bend moderately,
- large branches move very little,
- trunks do not deform,
- roots remain visually anchored.

The base of each foliage mesh should remain comparatively stable.

Use vertex height, vertex color, UV channel, or another documented mask to determine flexibility.

For example:

```glsl
float heightMask = smoothstep(
  rootedHeight,
  flexibleHeight,
  localPosition.y
);
```

Then:

```glsl
float finalPush =
  influence *
  pushStrength *
  heightMask *
  instanceInteractionStrength;
```

---

## 4. Wind Compatibility

The interaction system must coexist with existing or future wind animation.

The final vertex displacement should conceptually combine:

```glsl
finalPosition =
  basePosition +
  windOffset +
  playerInteractionOffset;
```

Do not replace the existing wind system.

The implementation must avoid obvious conflicts such as:

- snapping,
- doubled amplitudes,
- detached mesh bases,
- interaction cancelling all wind,
- different shaders using inconsistent time values.

Prefer one shared simulation time source.

---

## 5. Thin Instance Compatibility

The system must be designed for large numbers of thin instances.

Do not perform per-instance JavaScript distance checks every frame for all foliage.

Shared interaction calculations should happen in the shader using scene-level uniforms.

The core shared inputs should include:

```ts
export interface FoliageInteractionUniforms {
  cameraPosition: Vector3;
  playerPosition: Vector3;
  playerFocusPosition: Vector3;
  timeSeconds: number;

  cameraInnerRadius: number;
  cameraOuterRadius: number;

  corridorInnerRadius: number;
  corridorOuterRadius: number;

  pushInnerRadius: number;
  pushOuterRadius: number;
  pushStrength: number;
}
```

Adjust names to repository conventions.

Use thin-instance custom attributes only where per-instance variation is useful.

Suggested per-instance data:

```text
x = wind phase
y = stiffness or flexibility
z = interaction strength
w = random seed or dissolve offset
```

For example:

```ts
mesh.thinInstanceRegisterAttribute("foliageData", 4);
```

The implementation must document:

- attribute packing,
- default values,
- update frequency,
- whether buffers are static or dynamic,
- how the shader accesses the values.

---

# First-Person Behavior

Dissonance currently includes first-person experiences.

In first person, the character visibility corridor should normally be disabled.

Instead, implement a camera-centered personal clearance volume.

This should be elongated slightly in the camera forward direction rather than being a perfect sphere.

Desired behavior:

- foliage within approximately 0.6 meters bends away,
- foliage within approximately 0.25–0.4 meters begins to dissolve,
- leaves can still briefly cross the frame,
- vegetation near the screen edges remains more visible,
- the player feels enclosed rather than surrounded by invisible geometry.

Do not clear a long empty tunnel in front of the camera.

The goal is:

> preserve physical contact and density while preventing prolonged total visual obstruction.

Support separate first-person and third-person profile values.

---

# Profile Model

Create a strongly typed profile.

A possible starting point:

```ts
export type FoliageCameraMode =
  | "first-person"
  | "third-person"
  | "cinematic";

export interface FoliageInteractionProfile {
  enabled: boolean;

  cameraMode: FoliageCameraMode;

  occlusion: {
    enabled: boolean;

    cameraInnerRadius: number;
    cameraOuterRadius: number;

    corridorEnabled: boolean;
    corridorInnerRadius: number;
    corridorOuterRadius: number;

    ditherScale: number;
    ditherStrength: number;

    preserveEdgeFoliage: boolean;
    edgePreservationStrength: number;
  };

  displacement: {
    enabled: boolean;

    pushInnerRadius: number;
    pushOuterRadius: number;
    pushStrength: number;

    rootedHeight: number;
    flexibleHeight: number;

    recoverySeconds: number;
  };

  wind: {
    interactionBlend: number;
  };

  debug: {
    enabled: boolean;
    showCameraVolume: boolean;
    showCorridorVolume: boolean;
    showPlayerPushVolume: boolean;
  };

  synodResponse?: {
    enabled: boolean;
    quantizationHz: number;
    preemptiveMotion: number;
    pulseStrength: number;
    directionalBias: [number, number, number];
  };
}
```

Do not preserve this exact shape when a better structure fits the codebase.

The important requirements are:

- strong typing,
- sensible defaults,
- one resolution path,
- no magic numbers spread through runtime code,
- explicit first-person and third-person behavior,
- optional Synod-specific modulation.

Create:

```ts
resolveFoliageInteractionProfile()
```

or integrate into the project’s existing resolver pattern.

Validate invalid values such as:

- negative radii,
- outer radius smaller than inner radius,
- invalid dither scale,
- negative recovery duration,
- unsupported camera mode.

Prefer dev-time warnings or schema validation rather than silent failure.

---

# Initial Profiles

Provide at least four example profiles.

## `naturalForest`

Subtle, readable, realistic response.

```ts
{
  cameraInnerRadius: 0.25,
  cameraOuterRadius: 0.9,
  pushInnerRadius: 0.25,
  pushOuterRadius: 0.8,
  pushStrength: 0.15
}
```

Values are illustrative.

Tune visually.

## `denseUndergrowth`

Stronger displacement and slightly larger dissolve radius.

The player should feel as though they are moving through dense brush.

## `synodConditioned`

Vegetation reacts unnaturally to nearby acoustic or Synod influence.

Possible behavior:

- displacement pulses rhythmically,
- movement is quantized,
- plants bias toward a signal direction,
- vegetation begins moving slightly before contact.

## `hallucination`

Visually unstable but still playable.

Possible behavior:

- corridor width breathes subtly,
- dissolve threshold shifts,
- foliage appears to open toward incorrect paths,
- interaction timing is slightly delayed or anticipatory.

Do not overdevelop the narrative profiles until the core system is stable.

---

# Dissonance-Specific Extension Points

After the base system works, expose controlled modulation hooks for world-state effects.

These hooks may include:

```ts
export interface FoliageInteractionModulation {
  pulsePhase: number;
  pulseStrength: number;
  directionalBias: Vector3;
  preemptiveOffset: number;
  quantizationHz: number;
}
```

Potential world behaviors:

- leaves bend before the player reaches them,
- foliage pulses in time with an acoustic signal,
- plants repeatedly orient toward a transmitter,
- the visibility corridor briefly forms incorrect silhouettes,
- vegetation closes behind the player unnaturally quickly,
- movement becomes rhythmically quantized,
- foliage parts toward a misleading destination.

Keep these optional and disabled by default.

The ordinary foliage behavior must not depend on Synod-specific systems.

---

# Material Integration

Choose the Babylon.js material integration that best fits the current repository.

Potential approaches include:

- `MaterialPluginBase`,
- `PBRCustomMaterial`,
- Node Material integration,
- a dedicated shader material,
- repository-specific material extension infrastructure.

Prefer the least invasive solution that:

- works with the project’s existing foliage materials,
- supports thin instances,
- exposes required uniforms and attributes,
- keeps shader code testable and maintainable,
- does not duplicate whole PBR shaders unnecessarily.

Before implementing, inspect the current material setup.

Do not assume all foliage uses the same material class.

Create an adapter or compatibility boundary when necessary.

---

# Alpha and Rendering Requirements

Foliage assets may use alpha-tested texture cards.

Ensure the new dissolve logic composes correctly with the existing leaf alpha mask.

Conceptually:

```glsl
float textureAlpha = baseColor.a;
float interactionVisibility = computeInteractionVisibility();

float finalAlpha = textureAlpha * interactionVisibility;
```

Then perform one coherent alpha test or dithered discard.

Avoid multiple contradictory discard conditions where possible.

Check:

- backface behavior,
- two-sided foliage materials,
- depth writing,
- depth prepass compatibility,
- shadows,
- SSAO,
- fog,
- post-processing,
- motion vectors if present,
- temporal anti-aliasing if present.

The foliage should not disappear from shadows in an obviously inconsistent way unless this is deliberately configured.

Document whether the dissolve affects:

- main render pass,
- shadow pass,
- reflection probes,
- depth-only passes.

For the first iteration, prioritize correct main-camera rendering, but explicitly record unsupported passes.

---

# Interaction Recovery

A purely shader-based distance field causes vegetation to return immediately as the player moves away.

This may be sufficient for the first prototype.

However, the profile includes `recoverySeconds`, so investigate two options:

## Option A: Stateless recovery

Approximate recovery entirely through smooth distance falloff.

Advantages:

- simple,
- cheap,
- thin-instance friendly.

Disadvantages:

- no persistent bend,
- may feel springy or artificial.

## Option B: Localized interaction field

Maintain a small low-resolution interaction texture, render target, or spatial field representing recent player movement.

Advantages:

- vegetation can remain displaced briefly,
- footsteps through brush can leave a temporary trail.

Disadvantages:

- greater complexity,
- additional texture sampling and updates.

Implement Option A first.

Design the API so Option B could be introduced later without rewriting all consumers.

Do not build a full vegetation simulation for the first pass.

---

# Debug Visualization

Implement a debug renderer that can visualize:

- camera dissolve inner radius,
- camera dissolve outer radius,
- camera-to-player corridor,
- player interaction volume,
- player focus point,
- active camera mode,
- current resolved profile name,
- relevant uniform values.

Use low-cost Babylon.js debug meshes or lines.

The debug view must be toggleable at runtime and disabled by default.

If the project has a Dev HUD, integrate controls there.

Suggested controls:

```text
Foliage Interaction
[ ] Enabled
Mode: First Person / Third Person / Cinematic

Camera Inner Radius
Camera Outer Radius

Corridor Enabled
Corridor Inner Radius
Corridor Outer Radius

Push Inner Radius
Push Outer Radius
Push Strength

Dither Scale
Dither Strength

[ ] Show Debug Volumes
```

Do not create a separate unrelated debugging UI if an existing Dev HUD can host it.

---

# Performance Requirements

Measure rather than guess.

Provide a small benchmark scene containing:

- several foliage mesh types,
- at least thousands of thin instances,
- alpha-tested leaf cards,
- wind animation,
- player movement,
- camera movement,
- first-person and third-person modes.

Track:

- frame time,
- draw calls,
- active indices,
- shader compilation time,
- GPU frame time where available,
- overdraw observations,
- impact of debug rendering,
- impact of corridor calculations,
- impact of dither sampling.

The implementation should avoid:

- allocating new vectors every frame,
- setting unchanged uniforms repeatedly without need,
- traversing all foliage instances on the CPU,
- cloning materials per instance,
- creating one material per plant,
- per-frame instance-buffer rewrites unless justified.

Prefer shared materials and cached vectors.

---

# Suggested Initial Parameter Range

Use these only as a starting point:

```ts
const initialProfile = {
  cameraInnerRadius: 0.3,
  cameraOuterRadius: 1.0,

  corridorInnerRadius: 0.18,
  corridorOuterRadius: 0.65,

  pushInnerRadius: 0.2,
  pushOuterRadius: 0.85,
  pushStrength: 0.18,

  rootedHeight: 0.05,
  flexibleHeight: 0.7,

  ditherScale: 8,
  ditherStrength: 1
};
```

Tune based on real asset scale.

Do not assume one Babylon unit necessarily equals one meter without verifying current world conventions.

---

# Implementation Order

Proceed in this order.

## Phase 1: Repository Inspection

Identify:

- current foliage meshes,
- current foliage materials,
- thin-instance creation code,
- wind shader code,
- profile resolution system,
- Dev HUD integration points,
- camera abstraction,
- player position and focus-point sources.

Write a brief implementation plan before editing.

## Phase 2: Minimal Camera Dissolve

Implement:

- shared camera uniforms,
- near-camera distance field,
- dithered alpha test,
- one foliage material integration,
- debug visualization.

Verify visually before continuing.

## Phase 3: Player Displacement

Implement:

- player interaction uniforms,
- vertex displacement,
- rooted/flexible mask,
- thin-instance variation,
- wind composition.

## Phase 4: Third-Person Corridor

Implement:

- player focus point,
- distance-to-segment calculation,
- corridor profile settings,
- camera-mode switching.

## Phase 5: Profiles and Dev HUD

Implement:

- resolved profile,
- defaults,
- runtime controls,
- validation,
- debug display.

## Phase 6: Synod Modulation Hooks

Add optional modulation inputs without making them required.

## Phase 7: Tests and Benchmark

Add unit tests, integration tests where practical, and a benchmark/demo scene.

---

# Testing Requirements

Add tests for pure TypeScript logic.

At minimum:

```ts
describe("resolveFoliageInteractionProfile", () => {
  it("fills default values");
  it("preserves explicit overrides");
  it("rejects negative radii");
  it("rejects outer radius smaller than inner radius");
  it("disables corridor in first-person defaults");
  it("does not enable Synod modulation by default");
});
```

Add tests for utility math where implemented on the CPU:

```ts
describe("distanceToSegment", () => {
  it("returns distance to the middle of a segment");
  it("clamps to segment start");
  it("clamps to segment end");
  it("handles zero-length segments");
});
```

Shader behavior may be difficult to unit test directly.

At minimum provide:

- a deterministic demo scene,
- screenshot or visual regression hooks if the repository supports them,
- a manual verification checklist.

---

# Manual Verification Checklist

The implementation is not complete until these cases are checked:

1. Standing outside vegetation leaves it fully visible.
2. Walking into a bush bends leaves away from the player.
3. Leaves touching the camera dissolve gradually.
4. Dissolve boundaries do not appear as obvious hard spheres.
5. Thin instances retain per-instance wind variation.
6. Tree trunks remain stable.
7. Grass bends more than woody branches.
8. Existing wind remains visible.
9. Third-person foliage between camera and player dissolves.
10. The corridor does not expose the ground excessively.
11. First-person mode does not create a long empty tunnel.
12. Leaves may briefly cross the frame without blocking it for long.
13. Debug volumes match visible shader behavior.
14. Turning the system off restores normal foliage.
15. Profile switching does not recreate all foliage instances.
16. No significant CPU spike occurs from proximity checks.
17. No large transparency sorting artifacts appear.
18. Shadow behavior is documented and acceptable.
19. The system works with camera movement independent of player movement.
20. Synod modulation remains optional.

---

# Acceptance Criteria

The task is complete when:

- the system is implemented in TypeScript and Babylon.js,
- it works with thin-instanced foliage,
- near-camera foliage dissolves with a stable dithered technique,
- nearby foliage bends away from the player,
- third-person visibility corridors are supported,
- first-person behavior is independently configurable,
- wind and interaction displacement coexist,
- profiles resolve through one typed configuration path,
- debug visualization is available,
- a benchmark or demo scene exists,
- tests cover profile resolution and reusable math,
- unsupported render passes are documented,
- no per-instance CPU distance loop is required for normal operation.

---

# Deliverables

Return:

1. A concise summary of the existing foliage architecture you found.
2. The implementation plan.
3. The files created or modified.
4. The completed implementation.
5. Tests.
6. Benchmark or demo instructions.
7. Performance observations.
8. Known limitations.
9. Recommended next steps.

Do not merely propose pseudocode.

Implement the first usable version in the repository.

Prefer a small correct implementation over an elaborate incomplete vegetation simulation.
