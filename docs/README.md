# Docs Index

## Canonical documentation system

Start with [DISSONANCE-DOCSYSTEM.md](DISSONANCE-DOCSYSTEM.md). Authority is split
across these registries and document layers:

- [THREADS.md](THREADS.md) — workstream ownership and status.
- [SYSTEMS.md](SYSTEMS.md) — runtime, state, and presentation ownership.
- [DECISIONS.md](DECISIONS.md) — accepted consequential decisions.
- [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) — unresolved gates and held-open forks.
- [`design/`](design/) — canonical feature and domain specifications.
- [`engineering/`](engineering/) — implementation plans, prompts, audits, and the
  [legacy-plan reconciliation](engineering/PLAN-RECONCILIATION.md).
- [`archive/`](archive/) — superseded and historical provenance.
- [`intake/`](intake/) — non-canonical inbox for new ideas, references, prompts,
  and possible changes in direction awaiting reconciliation.

The former `plans/` directory has been retired. Consult the reconciliation table
to locate each migrated artifact and understand its authority.

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

## `dissonance/` — Dissonance / World

- **[dissonance/world/README.md](dissonance/world/README.md)** — start here.
  Overview of `apps/world`: real DEM terrain + real OSM trails + a recorded
  GPX track + a first-person player, all sourced from actual South Mountain
  Reservation data.
  - [data-pipeline.md](dissonance/world/data-pipeline.md) — sourcing the
    DEM/OSM/GPX data and processing it in QGIS (reproject, crop, export).
    The manual, human-driven part — read this before repeating the process
    for a different park.
  - [architecture.md](dissonance/world/architecture.md) — the code:
    `packages/geo`, `ITerrain`/`HeightmapTerrain`, the `world` app,
    the `packages/player` integration.
  - [scale-tuning.md](dissonance/world/scale-tuning.md) — why real terrain
    reads as flat at human scale, the three viewing levels
    (`?level=1|2|3`), the actual slope math, and known tradeoffs/bugs.
  - [design/world/CATEGORY-OBJECT-SCALING.md](design/world/CATEGORY-OBJECT-SCALING.md)
    — T38's canonical contract for separating terrain/geographic H/V from
    realistic cross-source object calibration, independently persisted category
    scale, and a separate transient seam for dysphoric spatial effects.
  - [park-map-overlay.md](dissonance/world/park-map-overlay.md) — planned
    (not yet implemented) work to drape an illustrated park map onto the
    terrain as a texture.
- **[dissonance/game-story-and-trails-plan.md](dissonance/game-story-and-trails-plan.md)**
  — the core pitch and trail-expansion plan: recovering artifacts across a
  network of separate trail sites, driving between them on a regional map.
- **[dissonance/dissonance-forest-graphics-prompt.md](dissonance/dissonance-forest-graphics-prompt.md)**
  — prompt for a forest-graphics upgrade pass, with the game vision
  (lost in the forest at night, following trail markers back to the car)
  as context.
- **[dissonance/extemporaneous.md](dissonance/extemporaneous.md)** — Dan's
  running scratch file of loose Dissonance ideas (underwater exploration
  apparatus, clothing/equipment systems, music-from-diving-gear).
- **[dissonance/story-manifest.md](dissonance/story-manifest.md)** — runtime
  story-beat contract for workshop discovery, the independent strike/recovery
  beat, and the underground boundary sequence.
- **[dissonance/world-save-contract.md](dissonance/world-save-contract.md)** —
  versioned ownership boundary for durable World progression.
- **[dissonance/underground-network-concept-v1.md](dissonance/underground-network-concept-v1.md)** —
  T35 topology, authored-node, corridor, and validation contract.
- **[dissonance/rey-caverns-concept-v1.md](dissonance/rey-caverns-concept-v1.md)** —
  T36's gated concept and implemented boundary-lurker scope.
- **[dissonance/diegetic-terminal-offline-v1.md](dissonance/diegetic-terminal-offline-v1.md)** —
  T29's independent offline Boulevard terminal slice, its input/Scrambler
  boundary, validation gate, and explicit networking/progression/T31 exclusions.
- **[dissonance/haze-fog-emissive-schema.md](dissonance/haze-fog-emissive-schema.md)** —
  environment-presentation profile ownership, live haze/emissive application
  seams, and the remaining visual-tuning gate.
- See also the archived
  **[World terrain POC prompt](archive/prompts/completed/dissonance-trail-data-poc-prompt.md)**.

## `dta/` — Don't Turn Around

- **["dta/notes for don't turn around.md"](dta/notes%20for%20don%27t%20turn%20around.md)**
  — a running scratch file of feature ideas and fixes for
  `apps/museum/dont-turn-around` (footsteps, phone/flashlight inventory,
  audio tuning, a measuring-tape/coordinate tool idea, etc.) — informal,
  not a polished plan.

## Engineering and historical artifacts

- [`intake/RENDER_PIPELINE_QUICKSTART.md`](intake/RENDER_PIPELINE_QUICKSTART.md)
  is the tracked T24 billboard/impostor dispatch brief. Its original quick-start
  APIs are aspirational pseudocode; follow the prepended repository assessment
  and Phase 0 audit before implementation.
- [`engineering/prompts/`](engineering/prompts/) contains active or
  implementation-candidate prompts. A Phase 0 refresh is still required before
  executing a legacy prompt.
- [`engineering/reviews/`](engineering/reviews/) contains audits and engineering
  reviews, including the Lineglass, DTA migration, and T13 Boulevard reviews.
- [`engineering/handoffs/`](engineering/handoffs/) contains human production
  handoffs such as the Milo apartment Blender cleanup.
- [`archive/prompts/completed/`](archive/prompts/completed/) contains prompts whose
  defined implementation scope landed.
- [`archive/prompts/superseded/`](archive/prompts/superseded/) contains prompts
  replaced by later decisions or plans.
- [`archive/design-sources/`](archive/design-sources/) retains source material
  already folded into canonical design documents.
- [PLAN-RECONCILIATION.md](engineering/PLAN-RECONCILIATION.md) records the exact
  destination and authority of every artifact formerly under `plans/`.

Reference images now live with their domains:
[creature silhouettes](design/creatures/references/animals.webp) and
[SMR shed](design/locations/references/smr-shed.webp).

## Instanced material pipeline

- **[dissonance/instanced-material-pipeline-prompt-v1.md](dissonance/instanced-material-pipeline-prompt-v1.md)**
  — the handoff prompt: turning reference-art material swatches into
  tileable PBR textures + a thin-instance variation shader. See THREADS.md
  T30 for status.
- **[dissonance/instanced-material-pipeline-constants.md](dissonance/instanced-material-pipeline-constants.md)**
  — named constants inventory + known tradeoffs from the first
  implementation pass (`packages/materials`, `apps/materials-demo`).

## `monorepo/` — architecture & extraction history (shared, cross-game)

- **["monorepo/260615 Monorepo Prompt.md"](monorepo/260615%20Monorepo%20Prompt.md)**
  — the long-term architecture vision: converting the single-app
  `dont-turn-around` prototype into a shared monorepo foundation for four
  planned games.
- **[monorepo/pursuer-extraction-prompt.md](monorepo/pursuer-extraction-prompt.md)**
  — master prompt governing the first extraction pass (pulling the pursuer
  system into shared packages).
- **[monorepo/pursuer-extraction-continuation.md](monorepo/pursuer-extraction-continuation.md)**
  — continuation of the pursuer extraction, picking up after the initial
  package scaffolding was in place.
- **[monorepo/generation-systems-audit.md](monorepo/generation-systems-audit.md)** — a
  file-by-file audit of the forest/terrain/trail/creature generation
  systems (`packages/world`, `packages/pursuit`, `packages/glow`, and the
  app-local systems in `apps/museum/dont-turn-around`), written to be
  self-contained enough to paste into a separate conversation.

## `archive/` — superseded, kept for provenance

- **[archive/THREADS-fold-in.260721.md](archive/THREADS-fold-in.260721.md)**
  — hero/scatter tree authoring plan; content already landed (see THREADS.md
  T22), kept because `HeroTreeInstances.ts` cites it by name in a source
  comment.
- **[archive/THREADS-v9.20-addendum.md](archive/THREADS-v9.20-addendum.md)**
  — a THREADS.md addendum written against an older version, superseded by
  the current thread registry; see `engineering/prompts/addendum-reconciliation-implementation-v1.md`
  for what was actually reconciled from it.
- **[archive/THREADS-delta-underground-and-interference.md](archive/THREADS-delta-underground-and-interference.md)**
  — source delta folded into canonical THREADS.md v9.53; provenance only,
  with stale implementation assumptions fenced at the top.
- **[archive/HANDOFF-underground-interference-sonic.md](archive/HANDOFF-underground-interference-sonic.md)**
  — the delta's obsolete execution handoff, archived with the same v9.53
  reconciliation; its proposed sonic-semantics T34 was not registered because
  canonical T34 is Acoustic mech disable.

---

*This index is a manually maintained map of `docs/`, not a build artifact —
update it when adding, moving, or retiring a doc.*
