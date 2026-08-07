# Dissonance Runtime System Registry

**Status:** Canonical  
**Scope:** Repository-wide runtime, state, and presentation ownership  
**Last reviewed:** 2026-08-04

This registry follows [DISSONANCE-DOCSYSTEM.md](./DISSONANCE-DOCSYSTEM.md). Package
names marked `VERIFY` must be confirmed by a Phase 0 audit before implementation.

| System | Design owner | Runtime owner | State owner | Presentation owner | Status | Canonical doc |
|---|---|---|---|---|---|---|
| Geographic world and trail data | T21 | `packages/geo`, `apps/world` | world settings and authored geographic data | Babylon world + Dev Lineglass | active | `docs/dissonance/world/README.md` |
| Region/profile composition | T23, T25, T27 | `apps/world` + `packages/materials` | environment/profile data + per-level settings/seed provenance | Babylon atmosphere + audio | source-aware profile selection and seeded view landed; location/narrative bindings ready, spatial composition provisional | `docs/design/world/REGIONS-AND-ATMOSPHERE.md` |
| Identified world features | T26 | `apps/world/public/data/locations.json` + consumers `VERIFY` | stable feature IDs + World save references | world props, navigation, Lineglass | queued | `docs/design/world/IDENTIFIED-FEATURES.md` |
| Lineglass player device | T21, T29 | `apps/world` `VERIFY` | Lineglass parts/unlocks in World save | Babylon object + Preact overlay | experimental; geo unlock landed | `docs/design/surveillance/LINEGLASS.md` |
| Diegetic terminal | T29 | `apps/world/src/terminal`, `apps/world/src/ui/terminal`, `apps/world/src/world/WorldTerminals.ts` | none in offline v1 | Babylon fixture + Preact/Signals overlay | offline v1 validated | `docs/dissonance/diegetic-terminal-offline-v1.md` |
| Dev Lineglass | T1/T2 | `apps/world/src/ui` `VERIFY` | environment settings, overrides, panel state | Preact developer UI | queued | `docs/design/tooling/DEV-LINEGLASS.md` |
| Sound control / voice rig | T9, T20 | `packages/audio` + future control module `VERIFY` | control/session state + profile data | Tone.js, embodiment response, Lineglass | blocked | `docs/design/audio/SOUND-CONTROL.md` |
| Creature embodiment and silhouette | T4, T17 | pursuit/pursuer render modules `VERIFY` | resolved pursuer/creature profiles | Babylon mesh, animation, audio | blocked/provisional | `docs/design/creatures/CREATURE-DIRECTION.md` |
| Foliage wind response | T21 | `packages/world` `FoliageSwayPlugin` | weather runtime state | Babylon canopy materials | landed | `docs/dissonance/dissonance-forest-graphics-prompt.md` |
| Camera-aware foliage interaction | T21/T24 | no active owner | profile data `TBD` | Babylon foliage shaders | aspirational | `docs/design/world/FOLIAGE-INTERACTION.md` |
| Boulevard world slice | T21, T23 | `apps/world` | locations/profile/World save data | Babylon world + Tone.js | active; public terminal landed, wider narrative slice incomplete | `docs/design/locations/DISSONANCE-BOULEVARD.md` |
| Milo's apartment archaeology room | T37 | `apps/world` `VERIFY` | World save archaeology/location state `TBD` | Babylon room + isometric/first-person transition | queued | `docs/design/locations/MILOS-APARTMENT.md` |
| DTA-to-World environment migration | T23 | `apps/world`; museum DTA is reference-only | environment profiles `TBD` | Babylon world | blocked on schema decisions | `docs/design/world/DTA-ENVIRONMENT-MIGRATION.md` |
| Captured drone acquisition | T31 | `apps/world` + `packages/world` weather | World save strike and hardware state | Babylon, Tone.js, Dev Lineglass | v1 landed; live QA deferred | `docs/dissonance/THREADS-delta-T31-T32.md` |
| Underground network/workshop | T35 | `apps/world` | versioned World save | Babylon + Tone.js | Draft 1 landed | `docs/dissonance/underground-network-concept-v1.md` |
| Rey Caverns | T36 | `apps/world` `VERIFY` | World save encounter/progression state | Babylon + future tonal systems | boundary teaser only; blocked | `docs/dissonance/rey-caverns-concept-v1.md` |
| Rural infrastructure | T28 | `apps/world/src/world` (`LocationProps.ts`, `CompositeLocations.ts`, `RoadNetwork.ts`) `VERIFY` | `apps/world/public/data/locations.json` | Babylon world + Dev Lineglass (compass) | farm silo placeholder, highway on-foot speed hookup, and compass HUD readout landed 2026-08-04; water tower/windmill/self-storage/airport unbuilt | `docs/design/world/RURAL-INFRASTRUCTURE.md` |
| Ambiguity & Placement narrative engine | T40 | `apps/world/src/narrative`, `apps/world/src/lore`, `apps/world/src/state/narrativeDog.ts` | `NarrativeState` (conditions only — no stored conclusions, per G3); not persisted | console log only (terminal surface gated on O33) | first slice landed 2026-08-06: one real beat (pet-ambiguity) wired to the live companion dog, opt-in Dev HUD mode, 87/87 tests green; in-browser check pending | `docs/intake/pattern-ambiguity-and-placement-v1.md`, `docs/intake/eng-ambiguity-placement-v1.md` |
