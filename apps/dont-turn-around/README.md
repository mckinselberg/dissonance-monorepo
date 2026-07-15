# Don't Turn Around

A first-person horror walking game set in a procedurally generated forest at dusk. Something is following you. Don't turn around.

Part of the [Dissonance Monorepo](../../README.md) — run `pnpm install` from the repo root first if you haven't already.

## Run it

```bash
pnpm dev              # from this directory, or:
pnpm --filter dont-turn-around dev   # from the repo root
```

Open [http://localhost:5173](http://localhost:5173).

## Build / preview

```bash
pnpm build     # tsc typecheck + vite build -> dist/
pnpm preview   # serve the build locally
```

## Controls

- WASD to move, Shift to sprint, Ctrl to crouch
- Mouse to look (click the canvas to lock the pointer)
- `` ` `` to toggle the Dev HUD (wind override, mute toggles, force-spawn watcher eyes, pursuer body visibility, etc.)
- Esc to return to the main menu

See the root [CLAUDE.md](../../CLAUDE.md) for architecture details (workspace layout, the `Game.ts` orchestrator, config flow) and `docs/monorepo-docs/` for the extraction history behind the current package structure.
