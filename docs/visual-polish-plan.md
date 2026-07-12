# Visual Polish Plan

## Why these two levers

Full Skyrim/BotW parity isn't realistic solo — that's a 100-300 person, multi-year
production. But two specific upgrades give a large visual jump for effort that's
achievable alone, because they target exactly what the camera spends the most time
looking at: the ground underfoot, and the pursuer/car during an encounter.

Everything in the game today is procedural primitives (boxes, cylinders, spheres)
with flat or vertex-colored materials — zero textures anywhere. That reads as
deliberately retro at PS1 tier, but it's the ceiling on how "detailed" PS2/PS3 tier
can ever look, no matter how much geometry gets added.

## Good news: the plumbing already exists, unused

Two packages are already installed as dependencies but never imported anywhere in
the codebase:

- `@babylonjs/materials` (in `@dissonance/world`) — includes `TriPlanarMaterial`,
  which textures a mesh by world-space projection instead of UV coordinates. This
  matters a lot here because the terrain/rocks/trunks are procedurally generated
  with no hand-authored UV layout — triplanar mapping sidesteps that entirely.
- `@babylonjs/loaders` (in the app) — glTF/`.glb` import via `SceneLoader`. This is
  what a modeled-and-animated pursuer or car would load through.

Both are dead weight right now. Wiring them up is additive, not a rewrite.

## Lever 1: Real texture sets (terrain, bark, rock)

**Current state:** `Terrain.ts` and `ForestGenerator.ts` assign flat `albedoColor`
per trail flavor (pine/rocky/river) and profile mode. No `Texture` object exists
anywhere in the repo.

**Plan:**

1. Source CC0 (no-attribution, commercial-safe) texture sets from Poly Haven —
   grass, dirt/forest-floor, bark, rock. 1-2K resolution is plenty; the game
   already caps draw distance well below where higher res would matter.
2. Terrain ground: swap the flat `PBRMaterial` for `TriPlanarMaterial` with a
   diffuse+normal+roughness set per flavor, blended at the same slope/flavor
   boundaries the color logic already uses (pine/rocky/river). No mesh changes
   needed — triplanar reads world position, not UVs.
3. Tree trunks: bark texture on the trunk cylinders. These already have
   conventional UVs from `MeshBuilder.CreateCylinder`, so this is a plain
   `Texture` swap, no triplanar needed.
4. Rocks (bank stones, cairns, boulders, scree): one shared rock texture across
   all rock features — they already share `bankMat`/similar materials, so this
   is a small, localized change.
5. Tie texture fidelity to the existing profile tiers instead of introducing a
   new axis: PS1 keeps flat vertex colors (this is already the intentional
   "retro" floor), PS2 gets the texture sets at lower resolution, PS3 gets the
   full set including normal maps. This extends a pattern the game already has
   rather than adding a new one.
6. New home for the files: `apps/dont-turn-around/public/textures/`, loaded via
   plain `Texture` construction — Vite serves `public/` as static assets with no
   bundler config needed.

**Why this first:** lowest integration risk. It doesn't touch collision, AI, or
any gameplay-load-bearing class — purely material swaps in `Terrain.ts` and
`ForestGenerator.ts`. Benefits every trail immediately once done once.

## Lever 2: A real pursuer model (and eventually the car)

**Current state:** `PursuerBody` (per `CLAUDE.md`, already the intended seam —
"a thin wrapper owning only mesh/material/`ExperienceMode` color-table logic")
is procedural boxes with hand-coded bob/lean motion, no skeleton, no animation
clips. This is the single biggest ceiling on "detail" during an actual encounter,
since it's what the camera is pointed at when tension is highest.

**Plan:**

1. Rig + animate via Mixamo (free, Adobe): upload a base humanoid, pull down
   walk/run/idle/reach clips as free mocap. This avoids hand-authoring animation
   entirely — the realistic bottleneck for a solo dev.
2. Export as glTF/`.glb` (Mixamo gives FBX; convert via Blender's glTF exporter —
   one pass, not per-animation).
3. Load through `@babylonjs/loaders`' `SceneLoader.ImportMeshAsync`, drive
   `AnimationGroup`s from `PursuerSystem`'s existing state machine
   (far/near/close/caught → idle/walk/run/reach).
4. Integration point stays exactly `PursuerBody`'s current public interface
   (position/stress/visibility setters) — `Game.ts` shouldn't need to change at
   all. This is why the prior extraction work (leaving `PursuerBody` as a thin
   wrapper) pays off here.
5. Recolor/re-skin the base Mixamo model to match the existing per-`ExperienceMode`
   color-table look rather than using it realistically textured — keeps the
   horror silhouette read consistent with the rest of the world.
6. Car is the same idea (source or model a low-poly sedan, no rigging needed) but
   lower priority — the player never lingers on it the way they do the pursuer.

**Bigger lift than Lever 1:** this replaces a load-bearing gameplay class's guts,
needs a state→animation mapping, and skinned-mesh performance needs a look
(probably fine at one instance, but worth checking against the existing
tree-count/shadow budget).

## Sequencing

1. Terrain/rock/bark texturing — lowest risk, immediate payoff, no gameplay code
   touched. Good testbed: Morrow Pine Loop first, then extend to Stonejaw/Blackwater's
   distinct flavors.
2. Pursuer model + animation — highest single "wow," but touches a gameplay class
   and needs the state-machine wiring.
3. Car model — nice-to-have, do last.

## Open decisions (your call)

- **Asset sourcing:** do you want to pull CC0 textures/models yourself (Poly Haven,
  Mixamo, Sketchfab-with-license-check), or do you want me to research and hand you
  a specific shortlist of URLs + licenses to review before anything gets wired in?
- **Art direction on the pursuer's re-skin:** keep it abstract/silhouette-y like now
  (recolored, not realistically textured), or lean more toward a grounded human
  look now that a real rig exists?
