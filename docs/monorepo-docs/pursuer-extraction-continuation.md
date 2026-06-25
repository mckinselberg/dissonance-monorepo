# PURSUER SYSTEM EXTRACTION — CONTINUATION PROMPT (v2)

## Context

This is a **continuation**, not a cold start. A prior session already scaffolded most of the package extraction described in the original `pursuer-extraction-prompt.md`. Per `CLAUDE.md`, the following packages exist and are wired into the pnpm/turborepo workspace:

```
packages/
  shared-types/   # @dta/shared-types — cross-cutting types, no deps, import-only
  engine/         # @dta/engine — BabylonJS bootstrap (SceneFactory, GameLoop)
  world/          # @dta/world — Terrain, ForestGenerator, CloudSystem, MountainRing, DaylightSystem, WeatherSystem, WatcherEffect
  player/         # @dta/player — PlayerController, AdrenalineSystem, BreathSystem
  audio/          # @dta/audio — AudioEngine (Tone.js), AmbientAudio, PlayerAudio, HeartbeatAudio
  input/          # @dta/input — stub
  navigation/     # @dta/navigation — stub
  persistence/    # @dta/persistence — stub
```

Dependency rule already established: **packages never import from `apps/*`**. Within `packages/`, the flow is `shared-types` ← `engine`/`world`/`audio`/`input`/`navigation` ← `player` (depends on `world`) ← `persistence` (depends on `navigation`). Preserve this — do not introduce a reverse or circular dependency.

`apps/dont-turn-around/src/pursuer/` (`PursuerSystem`, `PursuerBody`, `PursuerAudio`) is documented as **intentionally not fully extracted yet**. `PursuerAudio.ts` already carries a `// EXTRACTION CANDIDATE` comment marking it as deliberately deferred.

---

## ⚠️ Required first step: verify current state before doing anything else

**Do not assume which pieces are already extracted.** The exact state of `pursuer/` is unconfirmed as of this prompt being written. Before making any changes:

1. List the contents of `apps/dont-turn-around/src/pursuer/`. Confirm which of `PursuerSystem.ts`, `PursuerBody.ts`, `PursuerAudio.ts` are still present there, in what form.
2. Check whether any proximity/aggression state machine or heartbeat-glow logic already exists inside `packages/` (likely candidates: a new package not listed above, or logic folded into `packages/engine` or `packages/world`). Search for class names `PursuerSystem`, `HeartbeatGlow`, `PulsingEmitter`, `ProximityConfig`/`PursuerConfig` across `packages/*`.
3. Check `packages/shared-types` for `PursuerState`, `PursuerModel` — confirm whether they've already moved out of app-local `types`.
4. Report findings back in this format before proceeding:

   ```
   PursuerSystem:  [not extracted / partially extracted / fully extracted] — location(s): ...
   PursuerBody:    [not split / glow math extracted / fully split] — location(s): ...
   PursuerAudio:   [untouched, marker only / partially extracted] — location(s): ...
   shared-types:   [PursuerState/PursuerModel present? Y/N]
   ```

5. Only after reporting state, proceed to the relevant phase(s) below. **Skip any phase whose target state is already achieved** — re-verify it matches spec rather than redoing it from scratch.

This step exists because extraction work may have happened in a separate session this prompt's author wasn't present for. Treat the phases below as the **target end state**, not a guaranteed sequence of untouched work.

---

## Target end state (apply whichever phases are still needed)

### Phase A — `PursuerSystem` → package

**Target:** A package (suggest `packages/pursuit` as `@dta/pursuit`, but if a differently-named package already contains this logic, keep that name — do not rename an already-integrated package just to match this doc) containing the proximity/aggression state machine, fully config-injected (no implicit import of `PURSUER_CONFIG` from app-local `config/runProfiles`).

- `PursuerState`/`PursuerModel` types sourced from `@dta/shared-types`, not redeclared locally.
- Constructor takes a config object (player supplies `PURSUER_CONFIG` from `apps/dont-turn-around/src/config/runProfiles` at the call site).
- `update()`, `getModel()`, `reset()` signatures unchanged from original — no behavior change, only relocation + config injection.
- Dependency direction respected: this package should not depend on `@dta/player` or `@dta/world` unless genuinely necessary (distance/LoS inputs are passed in as plain values, not fetched).

### Phase B — `PursuerBody` split

**Target:** Generic heartbeat-synced glow-pulse math lives in a package (e.g. `@dta/engine` if it fits engine's scope, or a new small package — check `@dta/engine`'s existing surface first per "extend before create"). DTA-specific mesh/material/`ExperienceMode` color table stays in `apps/dont-turn-around/src/pursuer/PursuerBody.ts` as a thin wrapper.

- Preserve exact tuning constants in the pulse curve (BPM mapping, `5.5`/`2.5` exponent, `0.14` phase offset, `13` multiplier) — these are tuned to match `HeartbeatAudio`'s BPM curve. Do not adjust them as part of this extraction.
- The extracted class should accept an existing `GlowLayer` rather than always constructing its own, so multiple glow emitters could someday share one layer.

### Phase C — `PursuerAudio`: confirm still deferred

**Target:** No extraction. Confirm the `// EXTRACTION CANDIDATE` marker is still present and accurate. Do not extract the tiered timer-based scheduling pattern in this pass — single consumer, premature per "a working system is more valuable than a perfect abstraction."

If you find `PursuerAudio` has already been touched in a way that contradicts this (e.g. partially extracted), stop and report rather than continuing or reverting unilaterally.

---

## Validation (run regardless of which phases were actually executed)

- `pnpm build` succeeds from repo root (turbo build across workspaces)
- `pnpm dev` runs `apps/dont-turn-around` cleanly, no console errors
- `tsc` clean (project has `strict`, `noUnusedLocals`, `noUnusedParameters` on — no test runner or lint script exists, so this is the only automated check)
- Manual playtest: aggression rises on sprint, decays correctly on hide/crouch/still, all four proximity states (`far`/`near`/`close`/`caught`) transition correctly, heartbeat glow pulses match prior visual behavior at varying stress, audio behavior in `PursuerAudio` is unchanged
- No package imports from `apps/*` (check this explicitly — it's the one rule most likely to be silently violated during a refactor)
- Root-level `src/`, `index.html`, `vite.config.ts`, `tsconfig.json` remain untouched — they are the frozen pre-monorepo reference, not live code

## Out of scope for this pass

- Event-sourced provenance / artifact history (aspirational, not started)
- Multiplayer/Colyseus sync of pursuer state
- Filling in the `input`, `navigation`, or `persistence` stubs
- Any change to `PursuerAudio`'s actual logic beyond confirming its deferred status
- Renaming or restructuring any package not directly touched by this extraction
