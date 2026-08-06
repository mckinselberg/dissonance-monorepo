# World overlay/UI architecture audit — remaining smells

**Status:** active
**Owning thread:** T39
**Canonical scope:** `apps/world/src` BabylonJS↔Preact overlay/UI wiring — window listeners, Preact `render()` call sites, direct DOM mutation, and `state/*.ts` signal-ownership conventions.
**Does not own:** Museum/DTA UI (untouched, out of scope per `CLAUDE.md`'s "do not add new active Dissonance gameplay to the preserved DTA exhibit"), gameplay/world-generation systems themselves.
**Runtime owner:** `apps/world`
**Source:** `docs/intake/babylonjs-preact-overlay-singleton-refactor-prompt.md` (the full target architecture — singleton Preact root, typed `OverlayController`, durable state layer, transient command bus). This audit tracks a scoped, incremental subset of that spec rather than the full rewrite.
**Last reviewed:** 2026-08-06 (phases 1-3 landed)

---

## Phase 1 — DONE: keyboard-action dispatch

Replaced 10 independent `window`/`document` keydown/keyup listeners in `main.tsx` and `SurveillanceSession.tsx` with a single typed `KeyActionDispatcher` (`apps/world/src/input/keyActionDispatcher.ts`). Fixed a real bug along the way: `main.tsx`'s KeyE interact cascade and `SurveillanceSession.tsx`'s KeyE handler were two independent listeners racing with no coordination, now two ordered/guarded bindings on one dispatcher. See commit `970fda6`. `SurveilledInteriorCamera.ts`'s listener (already had its own `dispose()`) and `packages/input`'s WASD poller were left untouched — different concerns.

---

## Phase 2 — DONE: `render()` duplication for orbit vs. player mode

`main.tsx` is one `async function main()` with an early `return` after the orbit-mode branch (~line 1259). Everything below that point — including `#navigation-root`, `#routes-root`, `#replay-root` — is unreachable in orbit mode. Two separate `render()` call sites target each of those three DOM ids: one inside the orbit branch (`<ViewToolsRow/><GotoRow/>`, `<RouteRecorder/>`, `<RouteReplay/>` closing over `orbitCamera`), one in the player-mode continuation (same three components, closing over `controllers[movement.activeMode.value]` and adding `<CompassRow/>`). They never run in the same session — orbit mode returns before reaching the second set — so this isn't a live duplicate-mount bug, but it is two composition sites maintaining the same DOM contract by hand, which drifted once already (orbit's set lacks `CompassRow`).

**Direction:** extract one `renderNavigationPanel(target: 'orbit' | 'player', ...)`-shaped helper (or a small component taking a `getCurrentSample`/`getPosition` accessor) so the two branches share one call site instead of two hand-kept-in-sync ones. Low risk — no behavior change, just removes the duplicate composition.

**Landed:** `renderNavigationPanels()` in `main.tsx`, called once from each branch with its own closures; every closure body carried over verbatim. See commit `1fc67fb`.

## Phase 3 — DONE: direct `textContent` game-loop writes

The game loop (`main.tsx`'s per-frame closures) writes directly into plain DOM nodes for several HUD readouts instead of going through a signal:

- `#interaction-prompt`, `#breath-load-value`, `#t29-terminal-status`, `#t36-lurker-status`, `#t31-strike-status` — written every frame via `.textContent`/`.style.display`.
- `#vehicle-road-status`, `#vehicle-travel-mode`, `#vehicle-fuel`, `#vehicle-range`, `#vehicle-occupancy` — written every frame inside `updateVehicleHud()`.
- `#interaction-prompt` specifically is also written by `SurveillanceSession.tsx`, sharing one DOM node by reference across two files (acknowledged in a comment there).

Two of these (`ui/AudioRow.tsx`'s breath readout, `ui/VehicleRow.tsx`) already document this as a deliberate perf convention — avoid a full Preact rerender for a value that changes every frame. That's a legitimate pattern the intake doc itself endorses ("render it outside Preact only when there is a measured need and a clearly owned imperative DOM path"). The smell isn't the pattern, it's that it's applied inconsistently and undocumented everywhere else (the T29/T31/T36 debug-status divs, `interaction-prompt`, `level-label`/`readout` have no comment explaining why they bypass signals, and nothing marks them as a deliberate perf lane vs. an oversight).

**Direction:** not a rewrite to signals (that would reintroduce the rerender cost the current code is deliberately avoiding). Instead: name the pattern once (a small `bindFrameReadout(el, () => string)`-shaped helper, or just a shared comment block) and apply it uniformly so every frame-driven DOM write is visibly intentional and DRY, rather than N ad hoc `getElementById(...).textContent = ...` call sites.

**Landed:** `writeReadout(el, text)` helper next to `bindPauseControl`, one explanatory comment, applied at all 7 per-frame write sites (`#readout` ×2, `#breath-load-value`, the 5 vehicle-HUD fields, `#t29-terminal-status`, `#t36-lurker-status`, `#t31-strike-status`). `#interaction-prompt` intentionally left untouched — real branching state machine, not a single-value write. See commit `f036afa`.

## Phase 4 candidate — `state/*.ts` signal-ownership conventions

At least four different shapes coexist for "a feature's reactive state":

- **A.** `createXSignals(defaults)` factory → plain object of raw `Signal<T>` fields, mutated directly by callers (`audio.ts`, `movement.ts`, `visibility.ts`, `lineglass.ts`, `atmosphere.ts`, `scaleTuning.ts`, `trailsideScatter.ts`). Dominant convention.
- **B.** Class exposing public readonly `Signal` fields + imperative setter methods (`WorldSessionCoordinator` in `worldSession.ts`, `SurveilledInteriorCamera`).
- **C.** Closure-based controller exposing one `ReadonlySignal` + `request()`/`clear()` methods plus a separate `onChange` callback (`environmentProfileController.ts`).
- **D.** Plain non-signal object mutated imperatively, wrapped in a signal only if/where a caller needs it (`heartbeatVignette.ts`, `TerminalDockingSystem.ts`); `compassReading` is a bare `signal()` declared ad hoc inline in `main.tsx` rather than via a `state/` factory at all.

**Direction:** this is the highest-risk, lowest-immediate-payoff item — touches the most files for the least behavior-visible benefit, and the intake doc's own non-goals warn against "opportunistic architecture rewrites" and preserving diff-minimizing bad abstractions over doing this right. Recommend converging new/touched state on convention **A** (already dominant, already idiomatic for this codebase) rather than a big-bang migration: leave B/C/D alone unless a feature they own is being touched anyway, and steer new state modules to A explicitly in review. Not scheduled as a standalone phase unless requested.

---

## Non-goals (unchanged from the intake doc)

Full singleton Preact root, typed `OverlayController`/command bus, and durable-state layer remain out of scope until a real second overlay-architecture consumer or a concrete rerender-cost problem justifies them. Do not introduce Redux/Zustand/MobX/RxJS. Do not touch Museum/DTA.
