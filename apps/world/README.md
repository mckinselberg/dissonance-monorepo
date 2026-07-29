# World

The living Dissonance world, grown from the Trail Viewer proof-of-concept:
USGS DEM terrain, real OSM trails, authored locations, route tools, atmosphere,
and first-person traversal.

## Run

```bash
pnpm --filter world dev
```

Open:

- `http://localhost:5175/world/?level=1` — exaggerated relief/player view
- `http://localhost:5175/world/?level=2` — uniform-scale player view
- `http://localhost:5175/world/?level=3` — true-scale orbit view

## Route tools

The Navigation & Views section can record WGS84/heightmap routes, recover local
drafts, export JSON or GeoJSON, load committed/local routes, and replay them
with transport and scrub controls.

## Build

```bash
pnpm --filter world build
```

The original terrain/data-pipeline documentation remains under
[`docs/dissonance/world`](../../docs/dissonance/world/README.md).
