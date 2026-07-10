# Docs Index

## Trail Viewer POC — real-world terrain pipeline

- **[trail-viewer-poc/README.md](trail-viewer-poc/README.md)** — start here.
  Overview of `apps/trail-viewer`: real DEM terrain + real OSM trails + a
  recorded GPX track + a first-person player, all sourced from actual
  South Mountain Reservation data.
  - [data-pipeline.md](trail-viewer-poc/data-pipeline.md) — sourcing the
    DEM/OSM/GPX data and processing it in QGIS (reproject, crop, export).
    The manual, human-driven part — read this before repeating the process
    for a different park.
  - [architecture.md](trail-viewer-poc/architecture.md) — the code:
    `packages/geo`, `ITerrain`/`HeightmapTerrain`, the `trail-viewer` app,
    the `packages/player` integration.
  - [scale-tuning.md](trail-viewer-poc/scale-tuning.md) — why real terrain
    reads as flat at human scale, the three viewing levels
    (`?level=1|2|3`), the actual slope math, and known tradeoffs/bugs.
  - [park-map-overlay.md](trail-viewer-poc/park-map-overlay.md) — planned
    (not yet implemented) work to drape an illustrated park map onto the
    terrain as a texture.
- **[plans/dissonance-trail-data-poc-prompt.md](plans/dissonance-trail-data-poc-prompt.md)**
  — the original prompt/plan that kicked off the Trail Viewer POC.

## Monorepo architecture & extraction history

- **[monorepo-docs/260615 Monorepo Prompt.md](monorepo-docs/260615%20Monorepo%20Prompt.md)**
  — the long-term architecture vision: converting the single-app
  `dont-turn-around` prototype into a shared monorepo foundation for four
  planned games.
- **[monorepo-docs/pursuer-extraction-prompt.md](monorepo-docs/pursuer-extraction-prompt.md)**
  — master prompt governing the first extraction pass (pulling the pursuer
  system into shared packages).
- **[monorepo-docs/pursuer-extraction-continuation.md](monorepo-docs/pursuer-extraction-continuation.md)**
  — continuation of the pursuer extraction, picking up after the initial
  package scaffolding was in place.
- **[generation-systems-audit.md](generation-systems-audit.md)** — a
  file-by-file audit of the forest/terrain/trail/creature generation
  systems (`packages/world`, `packages/pursuit`, `packages/glow`, and the
  app-local systems in `apps/dont-turn-around`), written to be
  self-contained enough to paste into a separate conversation.

## Game design & narrative

- **[game-story-and-trails-plan.md](game-story-and-trails-plan.md)** — the
  core pitch and trail-expansion plan: recovering artifacts across a
  network of separate trail sites, driving between them on a regional map.
- **[dissonance-forest-graphics-prompt.md](dissonance-forest-graphics-prompt.md)**
  — prompt for a forest-graphics upgrade pass, with the game vision
  (lost in the forest at night, following trail markers back to the car)
  as context.
- **["notes for don't turn around.md"](notes%20for%20don%27t%20turn%20around.md)**
  — a running scratch file of feature ideas and fixes for
  `dont-turn-around` (footsteps, phone/flashlight inventory, audio tuning,
  a measuring-tape/coordinate tool idea, etc.) — informal, not a polished
  plan.

---

*This index is a manually maintained map of `docs/`, not a build artifact —
update it when adding or retiring a doc.*
