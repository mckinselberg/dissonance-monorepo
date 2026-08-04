# Dissonance Decision Registry

**Status:** Canonical  
**Scope:** Accepted repository-wide design and architecture decisions  
**Last reviewed:** 2026-08-03

Existing identifiers from `THREADS.md` remain stable. This migration begins new
documentation-system decisions at `D41` to avoid colliding with undocumented
historical identifiers.

### D1 — Tone.js owns audio

- **Date:** 2026-07-14
- **Status:** accepted
- **Decision:** Tone.js owns the single AudioContext and master chain. Named buses are `spatial`, `ambient-beds`, `interior`, and `music-synth`; Babylon supplies positions but never plays sound.
- **Rationale:** One audio graph preserves routing, ducking, timing, and browser-unlock ownership.
- **Applies to:** T3, T9, T12, T18–T20, T31, T34.
- **Consequences:** Spatial emitters bridge Babylon transforms into Tone.js; musical transport remains distinct from frame time.

### D1a — Audio work is split by execution context

- **Date:** 2026-07-14
- **Status:** accepted
- **Decision:** Tone.js orchestration remains on the main thread, native DSP on the browser audio thread, custom synthesis in AudioWorklets, and FFT/match scoring in a web worker.
- **Rationale:** Real-time audio must not be coupled to render-loop stalls.
- **Applies to:** T9, T20.
- **Consequences:** Sound-control prompts must preserve this boundary during Phase 0 and implementation.

### D2 — Player nonviolence

- **Date:** 2026-07-14
- **Status:** accepted
- **Decision:** The player is never given a violent action. There is no melee, damage, HP, or forced stagger; objects affect the world through sound and other nonviolent interactions.
- **Rationale:** “You are prey” is a design constraint, not a selectable combat posture.
- **Applies to:** T18, T31, T32, T34 and all player verbs.
- **Consequences:** Supersedes the stagger/repel stick direction and constrains disruption mechanics.

### D41 — Runtime/data-hybrid world placement

- **Date:** 2026-07-27
- **Status:** accepted
- **Decision:** Authored locations and stable identified features use committed data; anonymous and tunable scatter may regenerate deterministically at runtime.
- **Rationale:** This preserves stable identity without discarding the shipped live-authoring workflow.
- **Applies to:** T7, T23, T24, T26, T27.
- **Consequences:** The offline-manifest core of the instance/scatter prompts is superseded. Cell LOD remains T24; zone blending remains T27.
- **Supersedes:** `docs/archive/prompts/superseded/instance-placement-prompt-v1.md`, `docs/archive/prompts/superseded/scatter-placement-prompt-v1.md` as executable briefs.

### D42 — DTA is preserved; World is the successor foundation

- **Date:** 2026-07-15
- **Status:** accepted
- **Decision:** New living-world development targets `apps/world`; the DTA application remains a preserved museum reference.
- **Rationale:** The geographic terrain, authoring, atmosphere, and traversal foundation already lives in World.
- **Applies to:** T21, T23 and the DTA environment migration.
- **Consequences:** Migration work moves gameplay onto World rather than rebuilding World systems inside DTA.

### D43 — Foliage prompt is narrowed to shipped wind sway

- **Date:** 2026-07-23
- **Status:** accepted
- **Decision:** Wind sway is the production slice. Camera dissolve, third-person corridor, player displacement, and Synod modulation remain aspirational until a real consumer exists.
- **Applies to:** T21, T24.
- **Consequences:** The original camera-aware foliage prompt is not an executable production plan.

### D44 — Lineglass geographic unlock is only the first device slice

- **Date:** 2026-07-28
- **Status:** accepted
- **Decision:** Three collected parts progressively unlock Grid, GPX, and OSM visibility; this does not establish the full Lineglass renderer or package architecture.
- **Applies to:** T21, T29.
- **Consequences:** The full Lineglass review remains provisional design input.

### D45 — Milo's apartment belongs inside World

- **Date:** 2026-07-28
- **Status:** accepted
- **Decision:** The archaeological apartment is entered from the existing `milos-building` location in `apps/world`, not implemented as a separate application.
- **Applies to:** T37, T21, T23, T35.
- **Consequences:** Photogrammetry execution plan v2 supersedes v1 and the original standalone prompt.

### D46 — Captured-drone acquisition v1 is complete

- **Date:** 2026-07-30
- **Status:** accepted
- **Decision:** Strike, recovery, persistence, profile round-trip, and deterministic tests complete the acquisition slice; construction and control are separate later work.
- **Applies to:** T31, T32, T35.
- **Consequences:** `emitter-drone-prompt-v1.md` is completed provenance, not an open implementation prompt.

### D47 — Spatial distortion is perceptual only

- **Date:** 2026-08-03
- **Status:** accepted
- **Decision:** Transient dysphoric scale distortion may alter rendered object transforms, atmosphere, and audio, but it never deforms authoritative world geometry. Persisted asset/category calibration defines the ordinary physical baseline. Canonical geographic and simulation coordinates, collision, floors, doors, navigation, interaction geometry, saves, and multiplayer state remain on that baseline.
- **Rationale:** The intended effect is that the world looks wrong to the player, not that physical reality or shared simulation state changes. This preserves the expressive category H/V effect without making source-of-truth geometry unstable.
- **Applies to:** T27, T38, and future T4/T5/T9/T21 distortion consumers.
- **Consequences:** Closes O12. Distortion intensity and presentation must account for temporary visual/collision mismatch; no navmesh rebake, physics deformation, save migration, or replicated geometry state is introduced for the effect.
