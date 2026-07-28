# Repository Guidelines

## Project Structure

This is a pnpm/Turbo TypeScript monorepo for Dissonance's BabylonJS/Tone.js
dioramic layers:

- `apps/home/` — launcher.
- `apps/world/` — active living-world development.
- `apps/museum/` — playable archive.
- `apps/museum/dont-turn-around/` — preserved DTA exhibit.
- `packages/*` — shared systems.

Key packages include `engine`, `world`, `player`, `audio`, `pursuit`, `pursuer`,
`glow`, `input`, `navigation`, `persistence`, `geo`, and `shared-types`. Add
package exports through each package's `src/index.ts` barrel. Packages must
never import from `apps/*`.

## Commands

Run from the repository root unless noted:

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

World runs at `http://localhost:5175/world/`. The root Home dev server proxies
all layers when the Turbo dev task is running.

## Code Style

Use strict TypeScript. The shared config enables `strict`, `noUnusedLocals`,
and `noUnusedParameters`; treat `pnpm build` as the primary style and type
gate. Prefer focused modules with explicit constructor dependencies. Avoid
extracting abstractions until a second consumer needs them.

Keep layer-specific behavior in its owning app. Preserve the museum exhibit
unless work explicitly targets that archived build.

## Testing

Validate changes with `pnpm build` and focused tests where configured. For
gameplay or visual changes, run the affected app and verify it manually in the
browser. Use the World Dev HUD for runtime state and tuning.

## Commits and Pull Requests

Use Conventional Commit style with specific scopes. Pull requests should include
a concise summary, test notes, linked issues when relevant, and screenshots or
recordings for visible changes. Mention package-boundary or deployment changes.

## Security and Configuration

Do not commit secrets or deployment credentials. Render deployment is described
by `render.yaml` and assembles every layer through Turbo. Keep configuration
deterministic and avoid environment-specific defaults in shared packages.
