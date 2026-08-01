# Legacy Plan Reconciliation

**Status:** canonical  
**Owning thread:** repository documentation governance  
**Canonical scope:** Final disposition of every file formerly stored under `docs/plans/`  
**Does not own:** Feature behavior; linked design documents own behavior  
**Runtime owner:** none  
**State owner:** none  
**Presentation owner:** none  
**Depends on:** `docs/DISSONANCE-DOCSYSTEM.md`, `docs/THREADS.md`  
**Consumed by:** contributors selecting or authoring implementation work  
**Decisions:** D41–D46  
**Open questions:** O20–O23  
**Last reviewed:** 2026-08-01

The legacy `docs/plans/` folder has been retired. Its contents now live in the
documentation-system layer matching their authority. This table records the final
disposition; source filenames are retained where practical for provenance.

| Legacy artifact | Thread | Final location | Authority / outstanding boundary |
|---|---|---|---|
| `addendum-reconciliation-implementation-v1.md` | T24/T26/T27/T29/T11 | `engineering/prompts/` | Partially executed; offline T29 terminal is complete; identified features, chunking, zones, and later networking remain. |
| `boulevard-build-prompt-v1.md` | T21/T23/T10 | `engineering/prompts/` | Non-canonical implementation candidate; rewrite against `design/locations/DISSONANCE-BOULEVARD.md`. |
| `creature-silhouette-direction-v1.md` + `animals.webp` | T4/T17 | `archive/design-sources/` + `design/creatures/references/` | Folded into `design/creatures/CREATURE-DIRECTION.md`; O20/O21 remain. |
| `DISSONANCE_DEV_LINEGLASS_ENGINEERING_PROMPT.md` | T1/T2 | `engineering/prompts/` | Design authority is `design/tooling/DEV-LINEGLASS.md`; O23 gates execution. |
| `dissonance-camera-aware-foliage-prompt.md` | T21/T24 | `archive/prompts/superseded/` | D43 supersedes it; wind landed, remainder aspirational. |
| `dissonance-lineglass-engineering-review-prompt.md` | T21/T29 | `engineering/reviews/` | Source for `design/surveillance/LINEGLASS.md`; future work requires scoped prompts. |
| `dissonance-trail-data-poc-prompt.md` | T21 | `archive/prompts/completed/` | Historical provenance; no outstanding scope. |
| `dta-environment-port-prompt-v1.md` | T23 | `engineering/reviews/` | Completed audit; O22 and migration phases remain. |
| `emitter-drone-prompt-v1.md` | T31 | `archive/prompts/completed/` | Defined scope complete; stronger-hardware QA remains tracked by T31. |
| `geo-grid-engineering-prompt.md` | T21 | `archive/prompts/completed/` | Shipped; runtime docs under `dissonance/world/` govern. |
| `haze-fog-emissive-prompt-v1.md` | T1/T2/T25/T30 | `archive/prompts/completed/` | Runtime landed; live tuning and broader composition remain separately tracked. |
| `instance-placement-prompt-v1.md` | T7/T23 | `archive/prompts/superseded/` | D41 supersedes it; T26/T27 retain salvaged scope. |
| `scatter-placement-prompt-v1.md` | T7/T23 | `archive/prompts/superseded/` | D41 supersedes it; T24/T26/T27 retain salvaged scope. |
| `milos-apartment-blender-handoff.md` | T37 | `engineering/handoffs/` | Manual cleanup/export remains. |
| `milos-apartment-blender-pipeline-test-prompt.md` | T37 | `engineering/prompts/` | Automated Blender validation remains. |
| `photogrammetry_archaeological_loot_room_ai_prompt.md` | T37 | `archive/prompts/superseded/` | v2 and canonical design supersede it. |
| `photogrammetry-archaeological-loot-room-execution-plan-v1.md` | T37 | `archive/prompts/superseded/` | D45 and v2 supersede it. |
| `photogrammetry-archaeological-loot-room-execution-plan-v2.md` | T37 | `engineering/prompts/` | Active plan; Phase 0 refresh, room implementation, and validation remain. |
| `sound-as-control-prompt-v1.md` | T9/T20 | `engineering/prompts/` | Rewrite after O8/O11; canonical behavior lives in `design/audio/SOUND-CONTROL.md`. |
| `t13-boulevard-extraction-v1.md` | T13 | `engineering/reviews/` | Patrol-motion capture remains with Dan. |
| `smr-shed.webp` | T22 | `design/locations/references/` | Reconcile which shed/location it depicts. |

## Execution rule

Contributors may read migrated legacy files for provenance but must begin from the
linked canonical design, decisions, questions, and current `THREADS.md` status. A
legacy prompt still requires a fresh Phase 0 audit and conforming header before it
can authorize work.
