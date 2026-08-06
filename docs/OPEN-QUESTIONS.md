# Dissonance Open Question Registry

**Status:** Canonical  
**Scope:** Unresolved design and architecture forks  
**Last reviewed:** 2026-08-04

Identifiers O1–O19 are preserved from `THREADS.md`. This file is now their
canonical registry; `THREADS.md` should link to them rather than grow new prose.

| ID | Status | Question | Gates |
|---|---|---|---|
| O1 | open | What vertical exaggeration factor governs the geo world? | navmesh and scale tuning |
| O2 | accepted; tooling open | Tile-based navmesh is required; what granularity and tooling should bake it? | T23 traversal |
| O3 | open | Do terrain stamps ride the tile-bake system or remain separate? | interior/hardscape regions |
| O4 | open | When and where does the isometric surveillance camera rule apply? | T37 room transition and other monitored interiors |
| O5 | awaiting formal sign-off | Is first-encounter scare state persistent across sessions? | persistence consumer |
| O7 | open | Is `SensorProfile` the fourth resolved pursuer-profile axis? | T4 prompt revision |
| O8 | open | Does the acoustic-world queue still depend on deferred T3 audio extraction? | T20 phases 2+ |
| O9 | open | Is composition region family → clock interpolation → detection overlay? | T5/T23/T25/T27 profile seam |
| O10 | open | Can T4 start with T3 phases A/B complete and phase C deferred? | T4 |
| O11 | open | Does the audio single-writer queue still apply? | T9, T18, T19, T20 |
| O12 | resolved — D47 | Distortion is perceptual only; authoritative geometry does not deform. | none |
| O13 | blocked on assets | Are higher-resolution rust/plastic/tape source crops available? | T30 material families |
| O14 | deferred | Atlas or single-tile variation once a second family exists? | T30 expansion |
| O15 | open | Are Echo-17 reference-art output rights cleared? | external distribution |
| O16 | open | Is the current faint texture seam acceptable? | T30 quality bar |
| O17 | open | Does terminal control misuse Milo's authorization or use a found credential? | T29/T31 v2 |
| O18 | open | What recharges the emitter? | T31 charge implementation |
| O19 | open | Is receiver hardware permanent or losable? | T36 award path |
| O20 | open | Should creature surfaces be light-reactive matte-dark or fully matte? | T4/T17 creature authoring |
| O21 | open | Is motion wrongness primarily profile data, authored clips, or a hybrid? | T4/T17 creature implementation |
| O22 | blocked on audit | What canonical environment-profile schema replaces the old DTA snapshot boundary? | T23 DTA-to-World migration |
| O23 | open | Should the Dev Lineglass and player-facing Lineglass share only visual language, or also UI infrastructure? | T1/T2 and T21/T29 |
| O24 | open | Windmill blade rotation speed: fixed, or tied to T25 wind/atmosphere + T20 acoustic state? | T20/T25, T28 windmill |
| O25 | open | Farm silo clustering: procedural grid + T30 material-variant jitter, or hand-placed variants? | T28 silo, T30 |
| O26 | open | Self-storage per-unit narrative state: is T22's existing per-prop story-profile pattern sufficient as data, or does it need a dedicated interface? | T28 self-storage |
| O27 | open | Does Babylon replace Tone.js as game-audio owner, reversing accepted D1? `docs/intake/DISSONANCE_AUDIO_THREADS.md` proposes exactly this (a Babylon-owned bus tree plus extracting an external prototype's harmonic/tuning domain) without acknowledging D1. Not resolved — surfaced, not decided, by the 2026-08-04 intake reconciliation pass. | D1, T9, T20 |

O6 is closed by the established bus names (`spatial`, `ambient-beds`, `interior`,
`music-synth`) and is recorded in `THREADS.md` as resolved.

O12 is closed by D47. Persisted object calibration defines the authoritative
baseline; transient dysphoric distortion changes presentation only.

