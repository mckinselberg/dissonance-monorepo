# CLAUDE.md

Repository guidance for the Dissonance monorepo.

## Application layers

The applications are dioramic layers:

```text
apps/home/                       launcher
apps/world/                      living Dissonance world
apps/museum/                     playable archive
apps/museum/dont-turn-around/    preserved DTA exhibit
```

World is the successor foundation: real DEM terrain, atmosphere, authored
locations, route tools, and future surveilled interiors. Do not add new active
Dissonance gameplay to the preserved DTA exhibit.

`apps/trail-viewer/` and `apps/dont-turn-around/` still exist on disk but hold
only `dist/`/`node_modules/` leftovers from before the "establish diorama app
layers" reorg — no `src/` or `package.json`. Their active successors are
`apps/world/` and `apps/museum/dont-turn-around/`. Don't edit or reference the
old paths.

## Commands

From the repository root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

Per-layer:

```bash
pnpm --filter home dev
pnpm --filter museum dev
pnpm --filter world dev
pnpm --filter dont-turn-around dev
```

Development ports/base paths:

- Home: `http://localhost:5173/`
- Museum: `http://localhost:5174/museum/`
- World: `http://localhost:5175/world/`
- DTA exhibit: `http://localhost:5176/museum/dont-turn-around/`

Strict TypeScript is the primary build gate. Focused packages may provide
Vitest tests — currently only `@dissonance/geo`. There's no root `test`
script; run `pnpm --filter @dissonance/geo test` (or `cd packages/geo && npx
vitest run`) rather than `pnpm test`. Visual and interactive work requires
browser verification.

## Package architecture

Shared systems live in `packages/*`. Important packages include:

- `@dissonance/shared-types`
- `@dissonance/engine`
- `@dissonance/world`
- `@dissonance/player`
- `@dissonance/audio`
- `@dissonance/pursuit`
- `@dissonance/pursuer`
- `@dissonance/glow`
- `@dissonance/geo`
- `@dissonance/navigation`
- `@dissonance/persistence`
- `@dissonance/utils`

`@dissonance/pursuit` and `@dissonance/pursuer` are distinct: `pursuit` is the
generic proximity/aggression state machine; `pursuer` holds the DTA-specific
locomotion and tiered proximity-audio scheduling extracted out of the app.

Packages must never import from `apps/*`. Package `main`/`types` entries point
to source, so add public exports to the package's `src/index.ts` barrel.

Prefer explicit constructor dependencies and focused modules. Reuse before
extracting; do not create a shared abstraction until another consumer needs it.

## World conventions

- WGS84 is authoritative for geographic features; render coordinates derive
  through `@dissonance/geo`.
- Stable feature IDs, not array indexes or mesh names, drive navigation,
  persistence, docking, and future replication.
- `apps/world/public/data/locations.json` is the current runtime/data-hybrid
  authored-location source.
- Dev HUD changes must persist through saved settings and Copy/Load View when
  they represent authored environment state.
- Keep canonical simulation coordinates separate from perceptual distortion.
- Dispose every mesh, container, material, observer, UI mount, and audio
  resource owned by a reloadable system.

## Museum conventions

Museum exhibits are playable archive artifacts. The shell must support multiple
exhibits. Exhibit-specific code stays nested under its exhibit directory, and
active World work must not force refactors into an archived build.

## Docs

`docs/THREADS.md` is the living tracker of every active/parked/blocked design
and engineering thread across both games — check it first for current state
before reading other docs under `docs/`, most of which are handoff prompts or
reference material it indexes and summarizes.

## Deployment

`render.yaml` builds and assembles:

- `/`
- `/world/`
- `/museum/`
- `/museum/dont-turn-around/`

More-specific rewrites must appear before broader Museum/Home routes.
