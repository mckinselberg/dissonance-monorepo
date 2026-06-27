# Dissonance Monorepo — Forest Graphics Upgrade Prompt

Use this prompt in your local Claude instance that has access to the Dissonance Monorepo codebase.

---

## Prompt

You are working inside the **Dissonance Monorepo**, a first-person forest game built with BabylonJS. Before writing any code, read the existing environment/forest system files so you understand the current structure. Do not assume anything about the code — read it first, then propose changes.

---

## Game Vision (for context)

The player is **lost in the forest at night**. The goal is to follow a trail back to a parking lot where their car waits. Trail markers guide the way, but the forest is dark and hard to navigate. The mood is tense and immersive — not horror, but disorienting and atmospheric.

Key scene qualities to aim for:
- Thick canopy, minimal ambient light — dark and claustrophobic
- Steep, craggy terrain with variety — not flat, not uniform
- Dense, believable forest without destroying performance
- Existing assets: a good wind sound and convincing footstep sounds are already in place

---

## Graphics Upgrade Goals

After reading the existing code, update or extend the forest/environment system to implement the following. Work through these one system at a time, pausing for confirmation before moving to the next.

---

### 1. Distance-Layered Rendering (LOD strategy)

Implement a three-zone render strategy based on distance from the player camera:

- **Close (0–30m):** Full 3D hero trees as PBR meshes + thin instances (`mesh.thinInstanceAdd()`) for rocks, ferns, surface roots
- **Mid (30–80m):** Billboard sprites via `SpriteManager` — pre-rendered tree impostors facing the camera. Very cheap, convincing under canopy shadow.
- **Far (80m+):** Exponential fog eats it. Use `scene.fogMode = BABYLON.Scene.FOGMODE_EXP2` with density tuned so the fog line is invisible but coverage is total.

LOD transitions should be invisible in motion — the player is walking, not flying.

---

### 2. Terrain — Steep and Craggy

- Use `GroundFromHeightMap` with a high-contrast heightmap to produce steep ridges, gullies, and uneven ground
- Terrain should feel like a Pacific Northwest or Appalachian forest floor — roots, rocks, slope changes
- Apply a `TerrainMaterial` (BabylonJS extras) blending at minimum: leaf litter, exposed dirt, moss on slopes
- Surface normals should drive texture blending — moss appears on steep faces, dirt in flat/low areas

---

### 3. Atmospheric Lighting (Night Forest)

This is the most important mood system. The scene is dark — the player has limited visibility.

- Primary light: a dim `DirectionalLight` representing indirect moonlight filtering through canopy. Keep intensity low (0.15–0.25 range).
- Add a subtle `HemisphericLight` with a deep blue/green ground color and near-black sky color to simulate sky bounce.
- Player carry light: a `PointLight` or `SpotLight` attached to the camera with short range (6–10m) and warm color — like a flashlight or lantern.
- **Volumetric light shafts:** `VolumetricLightScatteringPostProcess` pointing at the moonlight source. Even subtle shafts through canopy are extremely high-impact for mood.
- Shadow: one `ShadowGenerator` on the moonlight, tight frustum, cascaded if needed. Do NOT add shadows to the player carry light — too expensive.

---

### 4. Ground Detail and Ambient Occlusion

- Add `SSAO2RenderingPipeline` to the scene — this darkens crevices, under-root areas, and rock bases and does enormous perceptual work for "forest floor" feel
- Tune AO radius to match the terrain scale
- Layer decal meshes or alpha-blended planes for: fallen leaves, exposed roots, puddles (reflective plane with low opacity)

---

### 5. Wind Animation (Vertex Shader)

Add a gentle wind effect to foliage meshes:

```glsl
// In a custom vertex shader or via BabylonJS ShaderMaterial
float windStrength = 0.04;
float windSpeed = 1.2;
vec3 worldPos = (world * vec4(position, 1.0)).xyz;
float wave = sin(time * windSpeed + worldPos.x * 0.5 + worldPos.z * 0.3) * windStrength;
positionUpdated.x += wave * (uv.y); // Only move tips, not base (uv.y = height in leaf plane)
```

Apply only to foliage thin instances and billboard sprites, not to trunks or terrain. This makes the entire scene feel alive at near-zero cost.

---

### 6. Post-Processing Stack

Build a single `DefaultRenderingPipeline` or `PostProcessRenderPipeline` with:

- **Motion blur** (`MotionBlurPostProcess`) — at walking speed this is subtle, but it helps sell movement over rough terrain
- **Bloom** (low intensity) — makes the player light source glow slightly, enhances trail marker visibility
- **Color grading / LUT** — if possible, apply a desaturated cool-green LUT to push the nighttime palette. If no LUT is available, use `ImageProcessingPostProcess` to shift the contrast curve and desaturate slightly.
- **Grain** (subtle) — cheap and adds to the tension and low-light feel

---

### 7. Trail Markers

Trail markers should be the ONE warm light source in the scene. Implement them as:
- A mesh (post + reflective blaze) with a small `PointLight` in warm orange/yellow (like a retroreflective blaze catching the player's light)
- Use bloom to make them visually pop against the dark forest
- Space them so the player can just barely see the next one from the current one — creates a "follow the light" tension loop

---

## Output Instructions

1. Read the existing environment/forest system files first. Summarize what currently exists before proposing any changes.
2. Identify which of the above systems are already partially implemented vs. net new.
3. Implement one system at a time. After each, pause and ask for confirmation before continuing.
4. Preserve the existing environment system's architecture — extend it, don't rewrite it.
5. All new code should be TypeScript, consistent with the monorepo's existing conventions.
