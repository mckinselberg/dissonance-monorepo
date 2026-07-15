# Dissonance Monorepo — Real-World Trail Data POC Prompt (`apps/trail-viewer`)

Use this with your local Claude instance with access to the Dissonance Monorepo. All prior work is on `main`.

---

## Part A — Human prep (do this yourself before running the prompt)

Local Claude can't do these external-tool steps. Complete them first and place the outputs in the repo (suggested: `apps/trail-viewer/public/data/`).

1. **Trail data (OSM via Overpass Turbo).** At overpass-turbo.eu, zoom to South Mountain Reservation and run:
   ```
   [out:json];
   (
     way["highway"~"path|footway|track"]({{bbox}});
   );
   out geom;
   ```
   Export → GeoJSON → save as `smr-trails.geojson`. Optionally filter to the Hemlock Falls loop segments in QGIS first, but the full network is fine — filtering can happen in code.
2. **Elevation data (USGS DEM).** Pull the 1/3 arc-second DEM tile covering SMR from USGS 3DEP (apps.nationalmap.gov/downloader) or OpenTopography. In QGIS:
   - Load the GeoTIFF and the GeoJSON together; visually confirm the trails sit on the terrain where expected.
   - Reproject **both** layers to **EPSG:26918 (UTM zone 18N)** so units are meters.
   - Crop the DEM to a bounding box around the reservation (a few hundred meters of margin).
   - Export the DEM as a **16-bit grayscale PNG** heightmap: `smr-heightmap.png`.
   - Record and save these numbers (they are the projection contract): the UTM bounding box of the exported heightmap (minX, minZ, maxX, maxZ in meters), its pixel dimensions, and the min/max elevation in meters that 0 and 65535 map to. Put them in `smr-heightmap.json` next to the PNG.
3. **Ground-truth track (MapMyRun).** Export one GPX of a run/hike you actually recorded in SMR — ideally one covering part of the Hemlock Falls loop — as `my-track.gpx`.

---

## Part B — Prompt for local Claude

You are working inside the **Dissonance Monorepo** (turborepo; packages in `packages/*`, apps in `apps/*`). Before writing any code, read the existing structure so new work matches conventions: `packages/world/src/Terrain.ts` (especially the `getHeightAt(x, z)` contract and how `ForestGenerator` and trail builders consume it), `packages/shared-types`, `packages/engine/src/SceneFactory.ts` and `GameLoop.ts`, one existing app's build/config setup (`apps/dont-turn-around`), and the root turborepo/workspace config. Summarize what you find before proposing anything.

### Goal

A proof-of-concept app, `apps/trail-viewer`, that renders **real terrain** (USGS DEM heightmap of South Mountain Reservation, NJ) with the **real trail network** (OpenStreetMap GeoJSON) draped onto it — and then drapes a **personally recorded GPX track** over the same terrain as a visual validation overlay. This is a data-pipeline POC: no gameplay, no pursuer, no run profiles. Free-fly/orbit camera, simple lighting, minimal UI.

Input files (already prepared, in `apps/trail-viewer/public/data/`):
- `smr-heightmap.png` — 16-bit grayscale DEM export, EPSG:26918 (UTM 18N), meters
- `smr-heightmap.json` — bounding box (UTM meters), pixel dimensions, elevation min/max for the 0–65535 range
- `smr-trails.geojson` — OSM trail ways (WGS84 lat/lon, standard GeoJSON)
- `my-track.gpx` — recorded GPX track (WGS84 lat/lon)

### Architecture (three deliverables, in dependency order)

**1. `packages/geo` (new package — pure functions, zero Babylon imports, fully Vitest-tested)**

This package isolates every place the pipeline can silently go wrong. It should own:
- **Projection:** WGS84 lat/lon → UTM 18N meters (implement the standard Transverse Mercator conversion or use a small dependency like `proj4` — your call, justify it), then UTM meters → local world space via a shared origin offset (`worldX = utmX - originX`, `worldZ = -(utmY - originY)` or similar — be explicit and consistent about the Z-axis handedness relative to Babylon's left-handed coordinate system, and document the choice).
- **Parsing:** GeoJSON `LineString`/`MultiLineString` ways → arrays of lat/lon points (carry OSM tags through — `name`, `osmc:symbol`/blaze color if present); GPX trackpoints → the same shape. Both should output one shared `GeoPolyline` type so downstream code treats OSM trails and the recorded track identically.
- **Heightmap:** decode the 16-bit PNG into a `Float32Array` of elevations in meters (using the min/max from the sidecar JSON), plus `sampleHeight(x, z)` doing bilinear interpolation in world space using the bounding box.
- **Tests:** round-trip known lat/lon ↔ UTM pairs (published test vectors exist for UTM 18N), bilinear sampling against a hand-built 4×4 heightfield, GeoJSON/GPX fixtures. The origin offset, axis orientation, and elevation scaling are the three things most likely to be wrong — each needs a test that would catch its specific failure.

**2. `packages/world`: add `HeightmapTerrain`**

A sibling to the existing procedural `Terrain`, satisfying the same interface — most importantly `getHeightAt(x, z)` — backed by `packages/geo`'s heightmap sampler. Extract a shared interface (e.g. `ITerrain`) if one doesn't exist rather than duplicating; do **not** modify the existing `Terrain`'s behavior. Mesh construction can mirror the existing approach (`CreateGround` grid + vertex displacement), with grid resolution decoupled from heightmap resolution. One decision to surface for discussion before implementing: whether to apply a vertical exaggeration factor (real SMR relief is ~120m over a large area and may read as flat at game scale — make it a constructor parameter, default 1.0).

**3. `apps/trail-viewer` (new app)**

Minimal Babylon app following the monorepo's app conventions (reuse `packages/engine`'s `SceneFactory`/`GameLoop` where sensible):
- Load heightmap → `HeightmapTerrain` → render with a simple elevation- or slope-tinted material (no texture pipeline exists in this repo; stay flat-color, consistent with everything else).
- Load `smr-trails.geojson` → project → drape each polyline via `getHeightAt` with a small Y-lift (~0.3m) → render as line/ribbon meshes. Color by blaze tag when available, neutral otherwise.
- Load `my-track.gpx` → identical path through the same functions → render in a strongly contrasting color (e.g. red vs. white/yellow trails).
- Free-fly or arc-rotate camera, a readout of camera world position + terrain height under it, and a toggle to show/hide each layer.

### Acceptance criteria (the point of the whole POC)

- OSM trails visibly follow terrain features the way real SMR trails do (e.g. the Rahway/River trail tracking the valley floor, Lenape climbing the ridge).
- The recorded GPX track lies on the terrain surface and hugs the corresponding OSM trail geometry within GPS-noise distance (~5–15m).
- Diagnostic value: if the track is offset **sideways**, the horizontal transform (projection/origin/axis) is wrong; if it **floats or tunnels**, the vertical scaling (elevation range or exaggeration) is wrong. The viewer should make both failure modes visually obvious.

### Phasing and gates

1. **Phase 0 — Repo orientation.** Read the files listed above; report existing conventions, the `Terrain` interface surface, and how a new app should be wired into the workspace. **Pause for confirmation.**
2. **Phase 1 — `packages/geo`** with full tests, all green. Present the module structure and the coordinate-convention decisions (axis handedness, origin choice) for sign-off. **Pause.**
3. **Phase 2 — `HeightmapTerrain`** + the shared terrain interface. **Pause.**
4. **Phase 3 — `apps/trail-viewer`** rendering terrain + OSM trails. **Pause for visual check.**
5. **Phase 4 — GPX overlay** + layer toggles + position readout. Final visual validation.

### Conventions

- TypeScript throughout, matching existing monorepo style; extend existing architecture, don't rewrite.
- Prefer explaining design tradeoffs as mental models before mechanics.
- Keep `packages/geo` free of rendering concerns — it should be reusable verbatim when the main game adopts real-world terrain later.
- Note for later (do not implement): once this pipeline works, the main game consumes it by swapping `Terrain` → `HeightmapTerrain` and feeding projected trail polylines into the existing `TrailDefinition.waypoints` shape — `ForestGenerator`'s corridors, scatter, and trail builders should work unchanged.

---

*Generated with Claude · SMR real-world trail data POC · 2026-07-07*
