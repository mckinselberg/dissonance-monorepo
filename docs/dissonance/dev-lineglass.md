# Dev Lineglass

The World developer overlay now renders through a reusable Lineglass shell.
Developer controls remain connected to their existing signals and command
handlers; the shell owns only navigation, disclosure, capability filtering,
summaries, and presentation.

## Registering a module

Add a `LineglassModuleDefinition` to the registry in `apps/world/src/main.tsx`.
A module declares its modes, priority, required capabilities, summary selector,
and the existing Preact root elements shown in its expanded panel. Summary
functions must derive their text from current state rather than embedding it in
the shell.

The developer capability set is passed to `LineglassShell`. A future
player-facing registry can use the same shell with a restricted set such as
`inspect-signals` and `record-artifacts`; modules requiring developer
capabilities will be filtered before display.

## Value sources

Controls use `LineglassValueSource`: `profile`, `override`, `live`, `recorded`,
or `derived`. Profile values are inherited configuration, overrides are
explicit developer changes, live values are measured runtime state, recorded
values come from an artifact, and derived values are calculated readouts.
Source labels must accompany color so the distinction remains accessible.

## Migration state

Phase 1 wraps the canonical legacy control roots in the new shell. This keeps
one state and command path while the controls move module-by-module. World,
Sky, Audio, Context, Authoring, and Diagnostics have Lineglass homes. The next
slice should split the combined authoring root into Movement, Navigation,
Routes, and Replay adapters, then add source metadata to individual controls.
The legacy `Section` component should be removed only after that parity pass.
