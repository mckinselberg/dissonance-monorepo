> **Archived 2026-08-01.** D41 supersedes the offline-manifest premise. T24/T26/T27 retain selected ideas. Not current implementation guidance.

# Handoff Prompt — Scatter Placement Manifest (Trees, Rocks, Trail Cutting, Power Lines)
`scatter-placement-prompt-v1.md`

You are working in the Dissonance/DTA TypeScript monorepo (Turborepo). Stack: BabylonJS, TypeScript, Vitest. This session builds the **first slice of the placement manifest**: offline generation of tree/rock scatter on the lat/long grid, trail-corridor clearing, and a power-line infrastructure layer — all consumed read-only by `apps/trail-viewer`.

Core principle (frozen): **placement is data, representation is a decision.** The runtime never scatters. It reads a committed manifest and decides how each cell is represented.

## Assumed decisions (Dan may override before session start)

- **A1.** OSM trails cut the clear corridor; the recorded GPX track does NOT clear (it is validation ground truth, not geometry).
- **A2.** One corridor constant to start: `TRAIL_CLEAR_HALF_WIDTH_M = 1.75` (tunable; per-blaze widths are a future extension).
- **A3.** Trees and rocks live in ONE anonymous-scatter manifest as archetype classes. This layer is separate from the photographed-feature/landmark manifest (identified layer) and separate from the power-line layer. Same schema family, different files.

## Phase 0 — Audit (MANDATORY, before any code)

1. Confirm `packages/geo` API: projection (WGS84 → UTM 18N → world), bbox metadata, `GeoPolyline` type, GeoJSON parsing (including OSM tag carry-through).
2. Confirm thin-instancing infrastructure in the repo (where it lives, how matrix buffers are built/bound) — this session consumes it, does not rebuild it.
3. Confirm `getHeightAt(x, z)` interface and trail drape constants.
4. Confirm the graticule/grid interval constant from the lat/long grid overlay session (`GRID_INTERVAL_DEG`) — the manifest cell grid must key on the same snapped lat/lon values. If the overlay session has not landed, stop and surface it.
5. Confirm whether Overpass data pulled so far includes `power=line` / `power=minor_line` ways for the SMR extent. If not, note it: the power layer needs one additional Overpass pull (document the query in the pipeline README; do not silently expand data scope).
6. Report findings + surprises before writing code.

## Scope

- **Touch:** `packages/geo` (generator + schema + tests), `apps/trail-viewer` (manifest loading + per-cell thin-instance binding + layer toggles), committed data files.
- **Out of bounds:** `@dta/engine` internals, `@dta/audio`, `HeightmapTerrain` internals, trail/track rendering code, profile schemas, navmesh (see Deferred).

## Layer files (all committed data, same schema family)

```
data/placement/
  scatter.json        # anonymous layer: trees + rocks
  powerlines.json     # infrastructure layer: poles + spans
  # landmarks.geojson  (identified layer — exists/planned elsewhere, NOT this session)
```

## System 1 — Scatter generator (offline, `packages/geo`)

Pure, deterministic, seeded. Inputs: bbox, cell grid (from `GRID_INTERVAL_DEG`), density config, trail polylines, power-line polylines, seed. Output: manifest.

### Density config

```ts
{
  defaults: { tree: number, rock: number },   // instances per cell
  overrides: { [cellId: string]: Partial<{ tree: number, rock: number }> }
}
```

- `cellId` = snapped lat/lon of the cell's SW corner at grid interval precision (e.g. `"40.743,-74.301"`) — the same round values the grid overlay displays. Authoring loop: look at a cell on screen, read its ID off the graticule, write one override line.
- Density config is a committed JSON file, hand-editable. Named constants for defaults; no magic numbers.

### Scatter rules

- Seeded PRNG per cell (`hash(seed, cellId)`) → deterministic candidate positions within the cell. Same seed + config = byte-identical manifest (test this).
- Per-instance: `{ position, rotationY, scale, archetype }`. Rotation uniform; scale jittered within named min/max per archetype.
- **Corridor rejection at generation time:** any candidate within `TRAIL_CLEAR_HALF_WIDTH_M` of any OSM trail polyline is rejected. Same test against power-line polylines with `POWERLINE_CLEAR_HALF_WIDTH_M` (wider — rights-of-way; suggest 6.0, named constant). Distance test = point-to-segment in world space.
- GPX track clears nothing (A1).
- Y is NOT stored — height is sampled at load time via `getHeightAt` (terrain vertical exaggeration remains an open decision; baking Y would freeze it).

### Output manifest

Instances bucketed by cellId. Include a header block: `{ seed, gridIntervalDeg, generatorVersion, sourceFiles }` — provenance, cheap now.

## System 2 — Power-line layer (offline generation + runtime rendering)

Reuses the polyline pipeline verbatim: OSM `power=*` ways → `GeoPolyline` → project.

Offline (`packages/geo`):
- Poles at way nodes: world XZ per node (Y sampled at load). If consecutive nodes exceed `MAX_SPAN_M` (suggest 80, named), subdivide with interpolated poles.
- Output `powerlines.json`: pole list + span pairs, with provenance header.

Runtime (trail-viewer):
- Pole = cylinder or thin box, `POLE_HEIGHT_M` (suggest 10, named), base at `getHeightAt`.
- Span = sagged curve between pole tops: catenary (`cosh`) or quadratic approximation — implementer's call, comment the choice; sampled at `WIRE_SAMPLES_PER_SPAN` into the existing line-mesh approach. `SAG_RATIO` named constant (suggest 0.035 of span length).
- `WIRES_PER_CROSSARM` (suggest 1 to start; constant exists so 3 is a data change).
- Flat dark material; silhouette-first, consistent with everything else in the viewer.

## System 3 — Runtime consumption (trail-viewer)

- Load manifests; per cell, build thin-instance matrix buffers against placeholder archetype meshes (ugly primitives fine — cone/cylinder tree, icosphere rock; Blender swaps meshes later, per the bent-normals archetype plan).
- LOD: **this session ships near-tier only** (thin instances, all cells within `SCATTER_DRAW_RADIUS_M`, suggest 200, named). Impostor/mid tier and cell hysteresis are the NEXT session — leave a marked seam (`// TIER: mid impostor binding point`), do not implement.
- Layer toggles: `Scatter`, `Power lines` alongside existing `Trails` / `Track` / `Grid`.

## Validation

1. Determinism: same seed/config → identical manifest (byte compare) — Vitest.
2. Corridor test: generate over a synthetic straight trail; assert zero instances within half-width, expected density outside — Vitest.
3. Cell keying: instance cellIds match graticule line values visible in the overlay — manual, in viewer.
4. Visual: trails read as walkable gaps through trees; power-line corridor reads as a wider cut; wires sag plausibly and connect pole tops after drape.
5. Override loop: edit one cell's density, regenerate, confirm only that cell changed (manifest diff).

## Deferred (comment hooks only)

- Mid/far representation tiers + hysteresis (next session).
- Placements → navmesh bake as obstacles (open decision with the tile-bake question — do not couple yet).
- Per-blaze corridor widths; interactable/identified promotion of individual instances; wire emissive/hum (urban-edge, `@dta/audio` — off limits here).

## Conflict rules (standing)

- One package focus per session; out-of-bounds paths above are hard.
- All tuning as named constants or committed config data. Nothing inline.
- No new engine code paths; consume existing seams only.
- End-of-session report: files touched, constants added, validation results, THREADS.md status line.
