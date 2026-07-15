# Dissonance Monorepo

A pnpm/turborepo monorepo built with [BabylonJS](https://www.babylonjs.com/) and [Tone.js](https://tonejs.github.io/), currently home to two apps:

- **[Don't Turn Around](apps/dont-turn-around)** — a first-person horror walking game set in a procedurally generated forest at dusk. Something is following you. Don't turn around.
- **[Trail Viewer](apps/trail-viewer)** — a real-world terrain POC: real USGS DEM elevation + real OSM trails + a recorded GPX track, walkable in first-person. See [docs/trail-viewer-poc/](docs/trail-viewer-poc/README.md) for the full writeup.

Shared systems (terrain, player controller, audio, pursuit AI, etc.) live in `packages/*` — see [CLAUDE.md](CLAUDE.md) for the full architecture.

## Setup

```bash
pnpm install      # installs all workspace deps, once, from the repo root
```

## Running an app

| App | Command | URL |
|---|---|---|
| Don't Turn Around | `pnpm --filter dont-turn-around dev` | http://localhost:5173 |
| Trail Viewer | `pnpm --filter trail-viewer dev` | http://localhost:5173/?level=1 (also `2`, `3`) |

Or `pnpm dev` from the repo root runs every app's dev server at once (via turbo).

## Building

```bash
pnpm build                              # builds every app (turbo, respects package dependency order)
pnpm turbo build --filter=dont-turn-around  # build just one app
pnpm turbo build --filter=trail-viewer
pnpm preview                            # serve a build locally
```

## Testing

```bash
pnpm turbo test    # runs Vitest for every package that has a test script (currently packages/geo)
```

## Don't Turn Around — feature highlights

- Procedural terrain, forest, mountain ring, and cloud system
- PS1 / dark experience profiles with distinct visuals and audio
- Pursuer AI with proximity states (distant → near → close) driving audio and visual tension
- Heartbeat audio, ambient soundscape, and footstep layers that respond to adrenaline level
- Proximity vignette overlay and watcher eye effects
- Dev HUD for testing (toggle with `` ` ``)

## Deploy

The repo includes a `render.yaml` blueprint that builds `dont-turn-around` with `pnpm turbo build --filter=dont-turn-around`. Connect the repo on [Render](https://render.com) via **New → Blueprint** and it will auto-deploy on every push to `main`.
