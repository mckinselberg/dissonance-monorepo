# Trail Viewer POC — Real-World Terrain Pipeline

`apps/trail-viewer` renders **real terrain** (a USGS DEM heightmap of South Mountain
Reservation, NJ) with the **real OSM trail network** draped onto it, plus a
personally recorded GPX track as a visual validation overlay, and a
first-person player that can walk on it. It started as the data-pipeline POC
described in `docs/plans/dissonance-trail-data-poc-prompt.md` and grew into a
small playable proof-of-concept afterward.

This folder documents how it was built, so the same pipeline can be repeated
for a different park/trail, or extended toward the main game
(`apps/dont-turn-around`).

## Contents

1. **[data-pipeline.md](data-pipeline.md)** — sourcing the DEM/OSM/GPX data and
   processing it in QGIS (reproject, crop, export). This is the part that
   can't be automated — read this before doing it again for new terrain.
2. **[architecture.md](architecture.md)** — the code: `packages/geo`
   (projection/parsing/heightmap math), `packages/world`'s `ITerrain` /
   `HeightmapTerrain`, the `trail-viewer` app itself, and the
   `packages/player` integration.
3. **[scale-tuning.md](scale-tuning.md)** — why real-world relief needs
   exaggeration to feel like anything at human/game scale, the three
   viewing modes (`?level=1|2|3`) this POC ended up with, the actual slope
   math behind them, and the tradeoffs/bugs each one ran into.
4. **[park-map-overlay.md](park-map-overlay.md)** — planned (not yet
   implemented) work to drape an illustrated park trail map onto the terrain
   as a texture.

## Quick orientation

- Data lives in `apps/trail-viewer/public/data/`: `smr-heightmap.png` +
  `smr-heightmap.json` (the DEM and its "projection contract"),
  `smr-trails.geojson` (OSM trails), `my-track.gpx` (a recorded hike).
- Run it: `pnpm --filter trail-viewer dev`, then visit
  `http://localhost:5173/?level=1` (or `2`, or `3`).
- The whole thing is real-world accurate: 1 world unit = 1 real meter
  horizontally (via `packages/geo`'s UTM projection), unless a level
  explicitly applies `horizontalScale`/`verticalExaggeration`.
