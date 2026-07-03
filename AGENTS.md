# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm/Turbo TypeScript monorepo for the BabylonJS/Tone.js game "Don't Turn Around." Active app work lives in `apps/dont-turn-around/`; shared systems live in `packages/*`. Key packages include `engine`, `world`, `player`, `audio`, `pursuit`, `glow`, `input`, `navigation`, `persistence`, and `shared-types`.

The root-level `src/`, `index.html`, `vite.config.ts`, and root app files are legacy prototype reference material from the pre-monorepo migration. Do not edit them for new features unless the migration plan explicitly requires it. Add package exports through each package's `src/index.ts` barrel.

## Build, Test, and Development Commands

Run commands from the repository root unless noted:

```bash
pnpm install      # install workspace dependencies
pnpm dev          # run Turbo dev; serves the app with Vite
pnpm build        # type-check and build workspaces in dependency order
pnpm preview      # build, then serve the production output locally
```

For app-only work, use the same commands inside `apps/dont-turn-around/`; `pnpm dev` starts Vite, usually at `http://localhost:5173`.

## Coding Style & Naming Conventions

Use TypeScript with strict types. The shared base config enables `strict`, `noUnusedLocals`, and `noUnusedParameters`; treat `pnpm build` as the primary style and type gate. Follow existing class-based system names such as `GameLoop`, `ForestGenerator`, and `PursuerSystem`. Keep game-specific behavior inside `apps/dont-turn-around/src/`; packages must not import from `apps/*`.

Prefer focused modules with explicit constructor dependencies. Avoid extracting abstractions until a second consumer needs them.

## Testing Guidelines

No automated test runner is currently configured. Validate changes with `pnpm build` and, for gameplay or visual changes, `pnpm dev` plus manual browser testing. Use the in-game Dev HUD, toggled with the backtick key, to inspect runtime state and tune systems.

## Commit & Pull Request Guidelines

Recent commits use Conventional Commit style, for example `feat(world,audio): ...`, `fix(deploy): ...`, and `refactor(game,ui): ...`. Keep the scope specific to the touched area.

Pull requests should include a concise summary, manual test notes, linked issues when relevant, and screenshots or short recordings for visible UI, world, or gameplay changes. Mention any package boundary changes or newly exported APIs.

## Security & Configuration Tips

Do not commit local secrets or deployment credentials. Render deployment is described by `render.yaml`; production builds target the `dont-turn-around` app through Turbo. Keep config files deterministic and avoid environment-specific defaults in shared packages.
