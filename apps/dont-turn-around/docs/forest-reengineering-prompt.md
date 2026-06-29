You are revising an existing Babylon.js forest system for a first-person atmospheric exploration / chase prototype.

The goal is to make the forest substantially more performant while preserving a dense, eerie, stylized PS1-to-early-3D visual feel.

## Current Problem

The existing forest system may be too expensive if it relies on many individually managed meshes, per-tree collisions, high-poly vegetation, or always-active world geometry.

Refactor the forest system around batching, chunking, LOD, and simple near-player interaction.

## Primary Technical Goals

Revise the forest implementation to use:

1. Thin instances for repeated forest objects
2. Chunk-based loading / activation
3. Distance-based LOD
4. Billboard or impostor trees for distant forest density
5. Minimal near-player collision geometry
6. Fog, darkness, and occlusion as intentional performance tools
7. Low-poly / stylized assets consistent with PS1-era visuals

## Architecture Requirements

Structure the forest as terrain chunks.

Each chunk should own or reference:

- Tree thin-instance transforms
- Rock / log / stump thin-instance transforms
- Grass or shrub card placement
- Optional metadata for spawn density, biome type, slope, trail proximity, and obstacle zones
- Lightweight collision proxies near the player only

Use chunk sizes such as 32x32m or 64x64m unless the existing project scale suggests otherwise.

Only nearby chunks should be active. Far chunks should either be disabled, represented by simplified impostors, or hidden by fog.

## Tree Rendering Strategy

Do not create one Babylon mesh per tree.

Instead:

- Define a small set of reusable tree variants, approximately 5–12.
- Each tree variant should be a source mesh.
- Render repeated trees using Babylon.js thin instances.
- Store transforms as matrices or compact placement data.
- Avoid per-instance JS objects where possible.
- Group trees by mesh/material so draw calls remain low.

Use low-poly trunks, simplified branch silhouettes, and alpha-card foliage where appropriate.

For distant trees, use one or more of:

- Crossed billboard cards
- Impostor planes
- Silhouette cards
- Very low-poly tree proxies
- Fog-hidden forest walls

## LOD Requirements

Implement distance-based forest detail:

Near distance:

- Real low-poly tree mesh
- Optional simple trunk collider
- Visible rocks/logs/ground detail

Mid distance:

- Simplified tree mesh or reduced-card representation
- No detailed collision
- Reduced material complexity

Far distance:

- Billboard, impostor, silhouette, or fog-only representation
- No collision
- Minimal draw calls

Very far distance:

- Hidden, merged into fog, or represented by terrain-color silhouettes only

LOD transitions do not need to be physically perfect. They should be visually acceptable within the game’s stylized horror atmosphere.

## Collision Requirements

Do not attach full mesh collision to every tree.

Use simple collision proxies only near the player:

- Cylinders, capsules, or bounding boxes for nearby trunks
- Enable or create these only within a small radius around the player
- Disable or recycle proxies as the player moves
- No collision for distant trees, branches, leaves, grass, shrubs, or far rocks unless gameplay requires it

The player should feel blocked by dense forest where intended, but the system should not simulate every object physically.

## Grass and Undergrowth

Grass should be cheap.

Acceptable approaches:

- Low-density cards near the player
- Thin instances for shrubs / ferns / repeated clumps
- Shader-based ground texture variation
- Noise-driven placement
- Fade out grass by distance
- Use fog and darkness to hide low detail

Avoid thousands of individually animated grass meshes.

## Wind / Animation

Do not animate individual leaves or tree objects with expensive per-object logic.

Use cheap visual tricks:

- Vertex shader displacement
- Material animation
- Subtle sine/noise-based branch or foliage movement
- Screen-space or audio-driven atmospheric effects

Wind should contribute to mood without increasing CPU cost significantly.

## Terrain and Trail Integration

The forest should support trails and blocked dense areas.

When placing trees:

- Keep trails mostly clear
- Place denser vegetation outside trail corridors
- Use occasional fallen logs, rocks, branches, and slope changes as navigation obstacles
- Use tree density to guide movement and conceal boundaries
- Allow forest density to become a level design tool, not just decoration

Dense impassable forest can be represented with thick vegetation cards, fog, darkness, and invisible boundary volumes rather than fully modeled trees.

## Performance Targets

Optimize for smooth browser performance.

The implementation should aim to:

- Reduce draw calls
- Reduce active mesh count
- Reduce JS object churn
- Avoid per-frame loops over every tree
- Avoid full collision on instanced vegetation
- Keep materials simple
- Keep alpha blending under control
- Support graceful degradation on weaker machines

Include debug counters or logging for:

- Active chunks
- Active thin-instance counts
- Active collider proxies
- Approximate draw calls if available
- Frame time or FPS

## Visual Direction

Favor a stylized eerie forest over realism.

Acceptable visual techniques include:

- PS1-style low-poly geometry
- Dithered or crunchy textures
- Fog walls
- Flat-shaded trunks
- Billboard tree silhouettes
- Limited draw distance
- Strong moonlight / flashlight contrast
- Darkness hiding aggressive culling

The forest should feel dense and threatening, but it does not need to be physically realistic.

## Deliverables

Revise the existing forest system and provide:

1. A brief explanation of the new architecture
2. Updated TypeScript / Babylon.js code
3. Any new helper classes or modules needed for chunking, LOD, or placement
4. Notes on how to tune density, draw distance, fog, and collision radius
5. A list of removed or simplified expensive behavior
6. Basic performance instrumentation

Prioritize practical, working code over theoretical perfection.

Do not rewrite unrelated game systems unless necessary.
