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

## Living tracker

- **[THREADS.md](THREADS.md)** — the single living record of every active/parked/blocked
  design-and-engineering thread across both games, frozen decisions, principles,
  open decisions needing Dan's sign-off, and a revision log. Start here for
  "what's the current state and what's next" before reading anything below —
  most of the docs in this index are handoff prompts or reference material
  that THREADS.md points to and summarizes.
- **[NOTES.md](NOTES.md)** — Dan's raw scratch inbox; untriaged items get
  logged into THREADS.md's parking lot, then this file's own copy is left
  as-is (not deleted) as the original record.

## Design & handoff prompts (`plans/`)

Session handoff docs, one per topic. THREADS.md is the index of record for
which of these are still open vs. already landed in code — check there
first; several of the docs below describe work that has since shipped.

- **[plans/geo-grid-engineering-prompt.md](plans/geo-grid-engineering-prompt.md)**
  — lat/long grid system for trail-viewer. **Shipped** (`packages/geo/src/graticule.ts`
  + a trail-viewer toggle) — see THREADS.md T21.
- **[plans/instance-placement-prompt-v1.md](plans/instance-placement-prompt-v1.md)**
  and **[plans/scatter-placement-prompt-v1.md](plans/scatter-placement-prompt-v1.md)**
  — two related, ambitious designs for a manifest-driven placement/zone-field
  substrate (anonymous + identified instance layers, cell LOD, QGIS-authored
  zones). **Not built** — the code that shipped instead is simpler runtime
  procedural scatter. See THREADS.md T23 for the surfaced design/implementation
  gap between these docs and what actually exists.
- **[plans/creature-silhouette-direction-v1.md](plans/creature-silhouette-direction-v1.md)**
  — low-poly faceted-silhouette creature design direction (crystal material
  rejected, language kept); paired reference sheet
  **[plans/animals.webp](plans/animals.webp)**. See THREADS.md T4/T17.
- **[plans/sound-as-control-prompt-v1.md](plans/sound-as-control-prompt-v1.md)**
  — T9's actual handoff prompt (packages/sound-control, oscilloscope/vocoder
  prototype), supersedes the old Godot `Oscilloscope_prompt` reference. Not
  yet implemented — see THREADS.md T9 for its (narrower than "T3 lands") gate.
- **[plans/t13-boulevard-extraction-v1.md](plans/t13-boulevard-extraction-v1.md)**
  — analysis pass over the Godot Surveillance Boulevard PoC (reference only,
  no code ports). See THREADS.md T13.
- **plans/smr-shed.webp** — an on-trail photo of a fenced stone building
  with a chimney; filename confirms it's SMR shed reference material for
  T22's "Shed / comfort station" feature, though it doesn't fully match
  photo 10's described corrugated roof/undergrowth state — see THREADS.md's
  Doc inventory note.

See also **[plans/dissonance-trail-data-poc-prompt.md](plans/dissonance-trail-data-poc-prompt.md)**
under "Trail Viewer POC" above — the original prompt that kicked off that
whole effort.

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
