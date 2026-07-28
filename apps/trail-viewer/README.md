# Trail Viewer (POC)

A real-world terrain proof-of-concept: a USGS DEM heightmap of South Mountain
Reservation, NJ, with the real OSM trail network and a recorded GPX track
draped onto it, walkable in first-person.

Part of the [Dissonance Monorepo](../../README.md) — run `pnpm install` from
the repo root first if you haven't already.

## Run it

```bash
pnpm dev              # from this directory, or:
pnpm --filter trail-viewer dev   # from the repo root
```

Then visit one of:

- `http://localhost:5173/?level=1` — exaggerated relief, shrunk player
- `http://localhost:5173/?level=2` — uniform 7x world scale
- `http://localhost:5173/?level=3` — true-scale free orbit view (no player)

(Also switchable via the "Level: 1 2 3" links in the on-screen UI panel.)

**Levels 1/2 (player mode):** click the canvas to lock the pointer, WASD to
move, Shift to sprint. **Level 3 (orbit mode):** left-drag to orbit, scroll to
zoom, right-drag to pan. All three have checkboxes to toggle the terrain/OSM
trails/GPX track layers, and a live position + ground-height readout.

## Route recorder

The **Navigation & Views** section includes a route recorder for authoring
wayfinding and location data. Add individual points or record continuously at
a configurable real-world spacing. Drafts survive reloads in local storage and
can be copied/downloaded as JSON or exported as GeoJSON.

JSON points use `latLongHeightmap: [latitude, longitude, elevationMeters]`.
Elevation is sampled from the raw DEM, so the recorded values are unaffected
by the active level's horizontal scale or vertical exaggeration.

The neighboring **Route replay** control loads committed routes listed in
`public/data/routes/index.json`, or a local recorder `.json`/`.geojson` export.
Its transport provides play/pause, start/end jumps, a distance scrubber, and
real-world playback speeds. In player levels it moves the active traversal
controller along the terrain; in orbit mode it moves the camera target along
the route.

## Build / preview

```bash
pnpm build     # tsc typecheck + vite build -> dist/
pnpm preview   # serve the build locally
```

## Docs

See **[docs/trail-viewer-poc/](../../docs/trail-viewer-poc/README.md)** for
the full writeup: how the DEM/trail/GPX data was sourced and processed in
QGIS, the `packages/geo`/`HeightmapTerrain` architecture, and the math behind
the three scale levels.
