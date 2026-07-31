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

`plans/` is a legacy intake directory pending physical migration. Its files are
not canonical implementation guidance by location; consult the reconciliation
table before using one.

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
- See also **[plans/dissonance-trail-data-poc-prompt.md](plans/dissonance-trail-data-poc-prompt.md)**
  under "Design & handoff prompts" below — the original prompt that kicked
  off the World terrain POC.

## `dta/` — Don't Turn Around

- **["dta/notes for don't turn around.md"](dta/notes%20for%20don%27t%20turn%20around.md)**
  — a running scratch file of feature ideas and fixes for
  `apps/museum/dont-turn-around` (footsteps, phone/flashlight inventory,
  audio tuning, a measuring-tape/coordinate tool idea, etc.) — informal,
  not a polished plan.

## Design & handoff prompts (`plans/`)

Session handoff docs, one per topic, spanning both games plus some shared
substrate design — left as one flat folder rather than split by game,
since THREADS.md cross-references these by path from dozens of places.
THREADS.md is the index of record for which of these are still open vs.
already landed in code — check there first; several of the docs below
describe work that has since shipped.

- **[plans/geo-grid-engineering-prompt.md](plans/geo-grid-engineering-prompt.md)**
  — lat/long grid system for World. **Shipped** (`packages/geo/src/graticule.ts`
  + a HUD toggle) — see THREADS.md T21.
- **[plans/dissonance-lineglass-engineering-review-prompt.md](plans/dissonance-lineglass-engineering-review-prompt.md)**
  — 21-section engineering brief for a diegetic diagnostic-vision device.
  Only a small slice shipped (§7.6 geo-reference layer + §6 progressive
  unlock) — see THREADS.md T21.
- **[plans/instance-placement-prompt-v1.md](plans/instance-placement-prompt-v1.md)**
  and **[plans/scatter-placement-prompt-v1.md](plans/scatter-placement-prompt-v1.md)**
  — two related, ambitious designs for a manifest-driven placement/zone-field
  substrate (anonymous + identified instance layers, cell LOD, QGIS-authored
  zones). **Not built** — the code that shipped instead is simpler runtime
  procedural scatter. See THREADS.md T23 for the surfaced design/implementation
  gap between these docs and what actually exists.
- **[plans/dissonance-camera-aware-foliage-prompt.md](plans/dissonance-camera-aware-foliage-prompt.md)**
  — large foliage-interaction engineering prompt; scoped down to wind sway
  only (shipped) — see THREADS.md T21/T22.
- **[plans/boulevard-build-prompt-v1.md](plans/boulevard-build-prompt-v1.md)**
  — Dissonance Boulevard city-kit build method.
- **[plans/dta-environment-port-prompt-v1.md](plans/dta-environment-port-prompt-v1.md)**
  — audit-only scoping doc for porting the first DTA level environment onto
  World's DEM/atmosphere systems. No code changed — five open questions
  gate any implementation session. See THREADS.md T21/T23.
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
- **[plans/haze-fog-emissive-prompt-v1.md](plans/haze-fog-emissive-prompt-v1.md)**
  — the audited fixed-four haze and emissive-presentation implementation brief;
  runtime landed, live depth-ramp/reference tuning remains. See THREADS.md T1/T2
  and T30.
- **[plans/photogrammetry_archaeological_loot_room_ai_prompt.md](plans/photogrammetry_archaeological_loot_room_ai_prompt.md)**,
  **[plans/photogrammetry-archaeological-loot-room-execution-plan-v1.md](plans/photogrammetry-archaeological-loot-room-execution-plan-v1.md)**,
  **[plans/photogrammetry-archaeological-loot-room-execution-plan-v2.md](plans/photogrammetry-archaeological-loot-room-execution-plan-v2.md)**
  — a photogrammetry-sourced loot-room feature: original prompt plus two
  execution-plan iterations.
- **[plans/addendum-reconciliation-implementation-v1.md](plans/addendum-reconciliation-implementation-v1.md)**
  — executable handoff reconciling `archive/THREADS-v9.20-addendum.md`'s
  proposals against the current thread registry.
- **plans/smr-shed.webp** — an on-trail photo of a fenced stone building
  with a chimney; filename confirms it's SMR shed reference material for
  T22's "Shed / comfort station" feature, though it doesn't fully match
  photo 10's described corrugated roof/undergrowth state — see THREADS.md's
  Doc inventory note.

See also **[plans/dissonance-trail-data-poc-prompt.md](plans/dissonance-trail-data-poc-prompt.md)**
under "dissonance/" above — the original prompt that kicked off the World
terrain POC.

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
  the current thread registry; see `plans/addendum-reconciliation-implementation-v1.md`
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
