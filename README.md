# Dissonance Monorepo

A pnpm/Turbo monorepo built with BabylonJS, Tone.js, TypeScript, and Vite.
The applications are organized as dioramic layers:

- **[Home](apps/home)** — deployment launcher.
- **[World](apps/world)** — the living Dissonance world, grown from the real-terrain Trail Viewer POC.
- **[Museum](apps/museum)** — playable archive and exhibit chooser.
- **[Don't Turn Around](apps/museum/dont-turn-around)** — the first preserved museum exhibit.

Shared terrain, player, audio, navigation, pursuit, persistence, and engine
systems live in `packages/*`.

## Setup

```bash
pnpm install
```

## Running a layer

| Layer | Command | URL |
|---|---|---|
| Home | `pnpm --filter home dev` | http://localhost:5173/ |
| Museum | `pnpm --filter museum dev` | http://localhost:5174/museum/ |
| World | `pnpm --filter world dev` | http://localhost:5175/world/?level=1 |
| DTA exhibit | `pnpm --filter dont-turn-around dev` | http://localhost:5176/museum/dont-turn-around/ |

`pnpm dev` runs all workspaces through Turbo. Home proxies the other layers so
they can also be reached from port 5173.

## Build and test

```bash
pnpm build
pnpm turbo build --filter=world
pnpm turbo build --filter=museum
pnpm turbo build --filter=dont-turn-around
pnpm turbo test
```

## Deployment

`render.yaml` assembles Home, World, Museum, and the preserved DTA exhibit into
one static deployment at `/`, `/world/`, `/museum/`, and
`/museum/dont-turn-around/`.
