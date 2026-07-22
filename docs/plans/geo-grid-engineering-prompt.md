# Engineering Prompt: Lat/Long Grid System (trail-viewer)

## Context

You are working in the Dissonance turborepo (TypeScript, BabylonJS, Zustand, Vitest). This task implements the foundational geographic grid system. It lives in `apps/trail-viewer` **for now**, but write the core math as a self-contained, dependency-free module so it can be lifted into `packages/geo` later without changes. Do not import BabylonJS or any app state into the math module.

## Design decisions (settled — do not revisit)

1. **Real WGS84 lat/long is the canonical coordinate identity for everything.** Terrain, trails, and placed features are addressed by real-world coordinates. Game-world positions are always *derived* from lat/long, never stored independently.
2. **One conversion function, one frozen anchor.** Geo→meters goes through a single local projection anchored at a fixed origin coordinate in South Mountain Reservation. There must be exactly one implementation of this transform in the codebase.
3. **Real scale is preserved.** One meter in projected space is one real meter. A local tangent-plane (equirectangular) approximation is acceptable at SMR's extent (~10 km); document the expected error bound in a comment. Do not introduce UTM unless you find a compelling reason — if you do, surface it rather than deciding.
4. **The geo transform is the immutable first stage.** The existing world-scale sliders (horizontal/vertical) apply *downstream* of geo→meters, as a separate transform to world/render space. A feature's real coordinate never changes when sliders move.
5. **Grid cells are quantized meter space.** Cells are square regions in the projected meter plane, not in degrees.

## Deliverables

### 1. Core module (pure, no deps)

- `latLongToMeters(coord: LatLong): MetersXY` and `metersToLatLong(xy: MetersXY): LatLong`, round-trip stable to sub-centimeter within SMR bounds.
- A frozen `GEO_ANCHOR` constant. Inspect the existing terrain pipeline for a natural anchor (heightmap origin/corner used by the USGS/GPX alignment). **Propose the anchor value with your reasoning; flag it for sign-off before treating it as final.**
- Grid functions parameterized by `cellSize` (meters): `cellForMeters`, `cellForLatLong`, `cellId` (stable, string-serializable), `cellBounds`, `neighborsOf`. Suggest a default `cellSize` with rationale; flag for sign-off.
- Distinct nominal types (or branded types) for `LatLong`, `MetersXY`, and world-space vectors, so coordinate spaces can't be silently mixed.

### 2. World-space adapter (trail-viewer side)

- A small adapter that composes geo→meters with the existing world-scale slider transform to produce BabylonJS world positions. This is the only place render space touches geo space.
- Keep it thin: it should read like `worldFromLatLong = scaleTransform(latLongToMeters(coord))`.

### 3. Optional lat/long placement parameter for thin instances

- Extend the thin-instance placement path in trail-viewer so a placement may specify `latLong` instead of a local world position. When present, position derives through the adapter; when absent, existing world-coordinate behavior is unchanged.
- Coordinates remain stored as lat/long in whatever placement data structure exists; conversion happens at placement/render time, not at authoring time.

### 4. Tests (Vitest)

- Round-trip accuracy tests at the anchor and at SMR's far corners.
- Known-distance test: two hand-picked real coordinates with a verifiable ground distance.
- Cell quantization: boundary behavior, id stability, neighbor correctness.
- Slider independence: changing scale sliders must not alter meter-space output.

### 5. Validation scene

Place four debug markers in trail-viewer at these real features (coordinates to be supplied from photo EXIF — leave clearly marked placeholders):

- Stone utility/pump house
- Concrete spillway channel
- Incinerator pad
- Stone dam / beam bridge

Confirm their relative positions and pairwise distances match reality against a map.

## Out of scope (do not build)

- The feature manifest / development archive
- Photo storage or in-game camera
- Navmesh integration
- Any packages/geo restructuring — extraction happens later

## Working style

Surface decisions rather than resolving them unilaterally: anchor coordinate, default cell size, and anything ambiguous in how the slider transform currently composes. Prefer conceptual clarity and small pure functions over cleverness.
