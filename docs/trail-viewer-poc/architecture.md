# Architecture — Code That Powers the Trail Viewer

Three layers, in dependency order: `packages/geo` (pure data/math, no
rendering), `packages/world`'s `HeightmapTerrain` (rendering, backed by
`geo`), and `apps/trail-viewer` (composes everything into a scene). Plus a
small, backward-compatible extension to `packages/player`.

## `packages/geo`

Pure functions, zero Babylon imports, fully Vitest-tested (19 tests). Owns
every place the real-world → game-world pipeline can silently go wrong.

- **`projection.ts`** — `latLonToUtm`/`utmToLatLon` (via the `proj4` library,
  not a hand-rolled Transverse Mercator — see "Why proj4" below),
  `utmToWorld`/`worldToUtm`/`latLonToWorld`, and `originFromBoundingBox`.

  **World-space axis convention** (the thing to get right once and never
  again): the world origin is the *center* of the heightmap's UTM bounding
  box — this matches the existing procedural `Terrain`'s own
  origin-centered convention, so a real-world terrain mesh ends up centered
  at world (0,0,0) the same way the procedural one is. `+worldX = +UTM
  easting` (east), `+worldZ = +UTM northing` (north) — no axis flip. Babylon
  is left-handed, but nothing in the existing codebase establishes a
  real-world compass convention to match, so there's no existing precedent
  forcing a flip; east=+X/north=+Z is just the simplest consistent choice,
  and it's applied uniformly to terrain, OSM trails, and GPX tracks alike.

- **`types.ts`** — `GeoPolyline` (`{ points: GeoPoint[]; source: 'osm' |
  'gpx'; tags?: Record<string,string> }`), the shared shape both OSM trail
  ways and a recorded GPX track get parsed into, so downstream rendering
  code treats them identically.

- **`geojson.ts` / `gpx.ts`** — parse OSM `LineString`/`MultiLineString`
  features and GPX `trkpt` sequences into `GeoPolyline[]`. GPX parsing is a
  hand-rolled regex extractor rather than a full XML library — `trkpt`
  structure is simple/fixed enough that a general XML dependency wasn't
  justified.

- **`heightmap.ts`** — `HeightmapContract` (mirrors `smr-heightmap.json`'s
  shape), `decodeHeightmapPng` (via `fast-png` — a pure-JS decoder, not the
  browser Canvas/Image API, so this stays testable in Vitest/Node with no
  DOM), and `HeightmapSampler` (bilinear interpolation in world space,
  mirroring the procedural `Terrain.getHeightAt(x,z)` contract exactly).

### Why `proj4`, not a hand-rolled Transverse Mercator

The plan that kicked this off left the choice open. A hand-derived Snyder
series formula is easy to get subtly wrong in ways that *internal*
round-trip tests wouldn't catch (a systematic bug can cancel out in a round
trip). `proj4` is the de facto standard, ships its own TypeScript types, and
has zero DOM/Babylon coupling. It was cross-checked against a real
GDAL/PROJ-computed reference point (pulled from this project's own QGIS
export via `gdalinfo`) — an independent implementation, not just internal
consistency — and matched to sub-meter precision.

## `packages/world`

- **`ITerrain.ts`** — the minimal interface every terrain implementation
  satisfies: `{ getHeightAt(x, z): number; dispose(): void }`. Extracted
  from how `ForestGenerator` and `Game.ts` actually use the procedural
  `Terrain` (they only ever call `getHeightAt`/`dispose`, nothing
  `Terrain`-specific) — **the existing `Terrain`'s behavior was not
  changed**, it just gained an `implements ITerrain` clause.

- **`HeightmapTerrain.ts`** — a sibling to the procedural `Terrain`,
  satisfying the same `ITerrain` contract but backed by `packages/geo`'s
  `HeightmapSampler` instead of procedural noise. Mesh construction mirrors
  `Terrain`'s own approach (`CreateGround` + vertex displacement + computed
  normals), with a few extra knobs:

  - `gridResolution` — mesh subdivision density, independent of the
    heightmap's own pixel resolution (default 128; the trail-viewer app
    uses much higher values — see [scale-tuning.md](scale-tuning.md) for
    why).
  - `verticalExaggeration` — multiplies sampled elevation (Y only), default
    1.0 (true scale).
  - `horizontalScale` — uniform multiplier on X/Z, default 1.0 (true
    scale, 1 world unit = 1 meter).

  `getHeightAt(x, z)` takes coordinates in this terrain's *rendered* world
  space (i.e. already multiplied by `horizontalScale`) and internally
  divides back out before sampling the DEM — so a camera/player moving
  through the scene and the mesh itself always agree on where things are,
  regardless of scale.

  Elevation-tinted via per-vertex color (brown-to-gray gradient) rather
  than a texture, consistent with the rest of the codebase having no
  texture pipeline. `setVisible(visible)` is a POC-viewer convenience for
  layer toggles, not part of `ITerrain`.

## `apps/trail-viewer`

A minimal Vite/Babylon app, structurally mirroring `apps/dont-turn-around`'s
conventions (`package.json`/`tsconfig.json`/`vite.config.ts` with one
path-alias/resolve-alias pair per `@dissonance/*` dependency).

`src/main.ts` flow:
1. Fetch the four data files from `public/data/`.
2. `decodeHeightmapPng` + `HeightmapSampler` + `HeightmapTerrain` to build
   the terrain.
3. `parseGeoJsonTrails`/`parseGpxTrack` → project each polyline via
   `latLonToWorld` → drape onto the terrain via `getHeightAt` with a small
   Y-lift (0.3–0.7m, GPX slightly higher than OSM trails so it doesn't
   z-fight where they coincide) → render as `MeshBuilder.CreateLines`
   meshes, colored by OSM `osmc:symbol` blaze tag when present.
4. A plain HTML/CSS overlay panel (not Babylon GUI — simplest option, no
   texture pipeline needed) with checkboxes to toggle each layer's
   visibility and a live camera/player-position + ground-height readout.
5. Camera/player setup branches by "level" — see
   [scale-tuning.md](scale-tuning.md).

`GameLoop` (from `packages/engine`) is reused for the dt-clamped render
loop; `SceneFactory` (also from `packages/engine`) is **not** used — it's
heavily `ExperienceProfile`/`RunProfile`-driven (fog, sky gradients, PS1/2/3
post-processing) for `dont-turn-around` specifically, which a flat-lit
terrain-viewer POC doesn't need. `trail-viewer` hand-rolls a minimal
Engine/Scene/light instead.

## `packages/player` extension

Two small, additive, backward-compatible changes so `PlayerController`
(originally written only for the procedural `Terrain`) works against any
`ITerrain`:

- `setTerrain(terrain: Terrain)` → `setTerrain(terrain: ITerrain)`. Pure
  type-level widening — `Terrain` already satisfies `ITerrain`, so nothing
  about `dont-turn-around`'s behavior changes.
- New `PlayerControllerOptions`: `scale` (uniform multiplier on the
  player's own eye height/crouch height/collision radius — *not* movement
  speed — default 1, so `dont-turn-around`'s existing
  `new PlayerController(scene, startPosition)` call is unaffected) and
  `farClip` (overrides Babylon's `Camera.maxZ`, which defaults to 10000
  units — fine for `dont-turn-around`'s ~800-unit world, but far too short
  once a scene's geometry gets scaled past that — see
  [scale-tuning.md](scale-tuning.md)).
