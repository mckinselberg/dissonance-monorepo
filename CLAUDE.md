# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Don't Turn Around" — a first-person horror walking game (procedural forest, mountains, clouds, an unseen pursuer driving audio/visual tension) built with BabylonJS + Tone.js + TypeScript + Vite.

The repo is a **pnpm/turborepo monorepo in progress**. It is being converted from a single-app prototype into a shared foundation for four planned games (Don't Turn Around, Dissonance, Cultural Runner, Make a Movie With Your Friends) — see `docs/monorepo-docs/260615 Monorepo Prompt.md` for the full long-term architecture vision and `docs/monorepo-docs/pursuer-extraction-prompt.md` for the extraction methodology used so far.

**Important: the root-level `src/`, `index.html`, `vite.config.ts`, `tsconfig.json`, and `package-lock.json` are the old pre-monorepo prototype, left in place during migration.** They are not wired into the turbo pipeline and should not be edited — active development happens in `apps/dont-turn-around/` and `packages/*`. When extracting/checking behavior parity, the root `src/` is the reference for "what the prototype did before extraction," not a place to make changes.

## Commands

Run from repo root (uses turbo to fan out to workspaces):

```bash
pnpm install      # install all workspace deps
pnpm dev          # turbo dev — runs apps/dont-turn-around on Vite (http://localhost:5173)
pnpm build        # turbo build — tsc + vite build per workspace, respecting dependency order
pnpm preview      # turbo preview — serve the built app
```

Per-app (inside `apps/dont-turn-around`):

```bash
pnpm dev          # vite
pnpm build        # tsc && vite build  -> dist/
pnpm preview      # vite preview
```

There is no test runner configured in this repo. There is no lint script configured — rely on `tsc` (via `pnpm build`) for type checking; `noUnusedLocals`/`noUnusedParameters`/`strict` are on in `tsconfig.base.json`.

Deploys via `render.yaml` (Render.com static site blueprint) build with `pnpm turbo build --filter=dont-turn-around`, auto-deploying on push to `main`.

## Workspace architecture

```
apps/dont-turn-around/   # the game app — composes packages, owns game-specific logic
packages/
  shared-types/          # @dta/shared-types — cross-cutting types (no deps), import-only, no logic
  engine/                # @dta/engine — BabylonJS bootstrap: SceneFactory, GameLoop. No game logic.
  world/                 # @dta/world — Terrain, ForestGenerator, CloudSystem, MountainRing,
                          #   DaylightSystem, WeatherSystem, WatcherEffect
  player/                # @dta/player — PlayerController, AdrenalineSystem, BreathSystem
  audio/                 # @dta/audio — AudioEngine (Tone.js), AmbientAudio, PlayerAudio, HeartbeatAudio
  input/                 # @dta/input — input abstraction (currently a stub; see MovementInputState
                          #   in shared-types for the target shape)
  navigation/            # @dta/navigation — diegetic nav types (compass/map placards), currently a stub
  persistence/           # @dta/persistence — save/load layer, currently a stub
```

Dependency rule established during extraction: **packages never import from `apps/*`** (one-directional: apps depend on packages, never the reverse). Within `packages/`, dependencies flow `shared-types` ← `engine`/`world`/`audio`/`input`/`navigation` ← `player` (depends on `world`) ← `persistence` (depends on `navigation`).

Each package's `package.json` points `main`/`types` straight at `src/index.ts` (no build step inside packages — consumers compile the TS directly via Vite/tsc), so adding an export means adding it to that package's `index.ts` barrel.

### What's still app-local (not yet extracted)

`apps/dont-turn-around/src/pursuer/` (`PursuerSystem`, `PursuerBody`, `PursuerAudio`) is the core horror-specific AI and is **intentionally not fully extracted** — see `pursuer-extraction-prompt.md` for the planned split: a generic proximity/aggression state machine, a generic `HeartbeatGlow`/pulse-emitter for the glow effect, while mesh/material/mode logic and the actual sound content stay app-side. `PursuerAudio.ts` has a `// EXTRACTION CANDIDATE` marker for this. Don't extract further than what that doc specifies without checking — the rule of thumb in this codebase is "a working system is more valuable than a perfect abstraction; do not over-extract."

Also app-local: `config/experienceProfiles.ts` and `config/runProfiles.ts` (PS1 vs radio visual/audio profiles, afternoon vs dusk run profiles), `world/DestinationSystem.ts`, and all of `ui/` (DevHUD, MainMenu, ProximityOverlay).

### Game composition (`apps/dont-turn-around/src/game/Game.ts`)

`Game` is the central orchestrator: constructs the scene via `SceneFactory`, instantiates one instance of every system (terrain, forest, daylight, weather, destination, pursuer, audio layers, watcher, pursuer body, heartbeat, proximity overlay), and drives them all from a single `tick(dt)` called by `GameLoop`. Line-of-sight between player and pursuer is computed directly in `Game` against the forest's collider list. State machine for pursuer proximity (`far`/`near`/`close`/`caught`) lives in `PursuerSystem` and fans out into audio panning, watcher-eye spawning, glow stress, and the proximity vignette.

`DevHUD` (toggle with `` ` ``) exposes live debug state (`Game.getDebugState()`) and runtime controls (`Game.getControls()`) for tuning without restarting — e.g. wind override, mute toggles, force-spawning watcher eyes, pursuer body visibility.

Config flow: `MainMenu` → `GameConfig` (experience mode + departure time) → persisted to `localStorage` (`dta_config`) → resumed on reload via a "click to enter" screen, or cleared via Esc back to the menu.
