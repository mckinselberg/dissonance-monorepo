# Addendum Reconciliation Implementation v1

## Purpose

Implement the useful systems proposed by `docs/archive/THREADS-v9.20-addendum.md`
without reusing its obsolete T26/T27 IDs or contradicting the runtime/data-
hybrid placement decision already recorded in canonical `THREADS.md`.

## Ownership

- T24: chunk ownership, culling, LOD, impostors, residency, fog transitions.
- T26: stable identified world features and manifest validation.
- T27: zone sampling, atmosphere blending, and later perceptual distortion.
- T29: terminal UI, docking, dialogue boundary, and Scrambler client contract.
- T11: WebSocket authority, replication, provenance, factions, later WebRTC.

## Phase 0 — profile seam

Audit TrailViewer's current signals and saved-view schema. Introduce one
validated app-local rendering profile without claiming the absent
`EnvironmentProfile`/`applyProfile()` system already exists. Preserve current
defaults and saved data. Model foliage LOD radii, cull/stream radii, chunk size,
and existing fog fields; enforce positive sizes and ordered radii. Expose only
parameters with a live consumer in the HUD.

Gate: today's default profile is visually unchanged and survives Copy/Load View.

## Phase 1 — stable feature identity

Add stable IDs and a validated anchor union to the existing locations data.
WGS84 is authoritative for geographic features; rendered coordinates are
derived. Runtime-scattered references use stable keys, never array indices.
Build an ID registry consumed by locations navigation, compass targets,
docking, saves, and later replication.

Gate: reorder-safe identity, duplicate-ID load failure, scale-safe resolution.

## Phase 2 — chunk baseline and observability

Build a deterministic real-meter chunk index and HUD counters before changing
visibility. Chunks own instance buffers and region metadata; hero meshes remain
resident. Record loaded/resident/visible chunk counts, LOD instance counts,
rebuild time, current chunk, and approximate memory.

Gate: identical seed/profile produces identical chunk contents and current
visual output remains the baseline.

## Phase 3 — activation, residency, and LOD

Add hysteretic chunk activation, then chunk visibility, then residency eviction,
then near/far representations and the impostor bake spike. Keep fog, LOD,
culling, and residency independently configurable. Use route replay as the
repeatable traversal benchmark.

Gate: no boundary thrash, stable resident count, no per-tree culling loop, and
no obvious bright silhouette pop at the fog/LOD transition.

## Phase 4 — zone sampler and profile composition

Implement a pure circle/polygon zone sampler in canonical real-world space.
Drive existing fog fields first. Compose in this order: region selects family,
clock interpolates the base, detection/distortion overlays by named weights.
Show contributing zones and weights in the Dev HUD.

Gate: deterministic overlap, smooth boundaries, one atmosphere application path.

## Phase 5 — perceptual distortion

Add zone-driven horizontal/vertical perceived scale, grading, and ambient-audio
weights without modifying canonical geo, navigation, collision, or save
coordinates. Do not reuse the destructive terrain-rebuild sliders as a
continuous runtime effect. Prototype Synod Capital as a radial vertical-building
field with a smooth suburban falloff.

Gate: no teleport/collision discontinuity and save/reload reconstructs the same
perception from canonical position plus zone state.

## Phase 6 — offline terminal slice

Register one terminal as a T26 feature. Implement docking state, Preact terminal
overlay, input-focus transfer, and fixture messages. Dialogue flows through
Simulation → Context → Provider → Validation → Authorized Dialogue; no provider
mutates simulation state.

Gate: fully usable offline, clean dock/undock controls, stable terminal identity.

## Phase 7 — authority and networking

Define Scrambler request/authorized-event contracts in-process first. Then move
the same authority implementation behind a WebSocket server owned by T11:
sessions, reconnect, terminal messages, traces/presence, stable feature IDs,
faction affiliation, ordering, and provenance. Exclude shared physics, full
world replication, voice/video, WebRTC, and combat from the first network slice.

Gate: clients cannot mint authoritative message IDs or bypass Scrambler policy.

## Phase 8 — NPC services, MCP, WebRTC

Add server-owned faction memory, structured NPC proposals, validation, and
deterministic offline fallback. MCP tools remain authoring/inspection surfaces
and use the same authorization path. Consider WebRTC only after WebSocket
identity, rooms, reconnect, and authority are proven.
