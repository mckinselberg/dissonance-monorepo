# Legacy Plan Reconciliation

**Status:** canonical  
**Owning thread:** repository documentation governance  
**Canonical scope:** Disposition and migration boundary for every file formerly treated as a plan under `docs/plans/`  
**Does not own:** Feature behavior; linked design documents own behavior  
**Runtime owner:** none  
**State owner:** none  
**Presentation owner:** none  
**Depends on:** `docs/DISSONANCE-DOCSYSTEM.md`, `docs/THREADS.md`  
**Consumed by:** contributors selecting or authoring implementation work  
**Decisions:** D41–D46  
**Open questions:** O20–O23  
**Last reviewed:** 2026-07-31

`docs/plans/` is a legacy intake folder, not a layer in the canonical documentation
hierarchy. No document there is canonical merely because it exists. This table is
the authoritative disposition until the physical archive/move pass is completed.

| Legacy artifact | Thread | Classification | Authority / disposition | Outstanding boundary |
|---|---|---|---|---|
| `addendum-reconciliation-implementation-v1.md` | T24/T26/T27/T29/T11 | partially executed engineering handoff | migrate remaining scope into scoped prompts after canonical designs exist | identified features, chunking, zones, later networking; offline T29 terminal is complete |
| `boulevard-build-prompt-v1.md` | T21/T23/T10 | mixed design + prompt | non-canonical source for `design/locations/DISSONANCE-BOULEVARD.md`; rewrite before execution | narrative encounters and continuous composition pass |
| `creature-silhouette-direction-v1.md` + `animals.webp` | T4/T17 | design source + reference | folded into `design/creatures/CREATURE-DIRECTION.md`; retain image as design reference | O20/O21 and authored creatures |
| `DISSONANCE_DEV_LINEGLASS_ENGINEERING_PROMPT.md` | T1/T2 | engineering prompt | migrate to `engineering/prompts/` after O23; design authority is `design/tooling/DEV-LINEGLASS.md` | full HUD redesign |
| `dissonance-camera-aware-foliage-prompt.md` | T21/T24 | superseded prompt | archive after D43; wind slice is landed, remainder aspirational | no scheduled implementation |
| `dissonance-lineglass-engineering-review-prompt.md` | T21/T29 | mixed design/review | source for `design/surveillance/LINEGLASS.md`; must be rewritten into scoped prompts | all device layers beyond geo unlock |
| `dissonance-trail-data-poc-prompt.md` | T21 | completed prompt | archive as historical provenance | none |
| `dta-environment-port-prompt-v1.md` | T23 | completed audit | migrate to `engineering/reviews/`; canonical design is `design/world/DTA-ENVIRONMENT-MIGRATION.md` | O22 and migration phases |
| `emitter-drone-prompt-v1.md` | T31 | completed prompt | archive; canonical status remains in T31/system registry | stronger-hardware live QA only |
| `geo-grid-engineering-prompt.md` | T21 | completed prompt | archive; runtime docs under `dissonance/world/` govern | none |
| `haze-fog-emissive-prompt-v1.md` | T1/T2/T25/T30 | completed implementation prompt | archive after its accepted runtime rules are reflected in the environment/atmosphere canonical design | live depth-ramp/reference tuning; broader region/clock/detection compose seam remains separate |
| `instance-placement-prompt-v1.md` | T7/T23 | superseded prompt | archive under D41 | only separately registered T26/T27 work survives |
| `scatter-placement-prompt-v1.md` | T7/T23 | superseded prompt | archive under D41 | only T24/T26/T27 slices survive |
| `milos-apartment-blender-handoff.md` | T37 | human production handoff | migrate to `engineering/handoffs/`; governed by `design/locations/MILOS-APARTMENT.md` | manual cleanup/export |
| `milos-apartment-blender-pipeline-test-prompt.md` | T37 | engineering validation prompt | migrate to `engineering/prompts/` | automated Blender pipeline validation |
| `photogrammetry_archaeological_loot_room_ai_prompt.md` | T37 | superseded prompt | archive; v2 and canonical design supersede it | none independently |
| `photogrammetry-archaeological-loot-room-execution-plan-v1.md` | T37 | superseded plan | archive under D45 | none independently |
| `photogrammetry-archaeological-loot-room-execution-plan-v2.md` | T37 | active engineering plan | migrate to `engineering/prompts/` after Phase 0 refresh | room implementation and validation |
| `sound-as-control-prompt-v1.md` | T9/T20 | stale gated prompt | rewrite after O8/O11; canonical behavior is `design/audio/SOUND-CONTROL.md` | package/API audit and prototype |
| `t13-boulevard-extraction-v1.md` | T13 | reference audit | migrate to `engineering/reviews/` | patrol-motion capture by Dan |
| `smr-shed.webp` | T22 | reference asset | move with T22 design references when that domain is normalized | reconcile which shed/location it depicts |

## Execution rule

Until the physical migration is complete, contributors may read a legacy file for
provenance but must begin from its linked canonical design, decisions, questions,
and current `THREADS.md` status. A legacy prompt must receive a fresh Phase 0 audit
and header conforming to the documentation system before it can authorize work.
