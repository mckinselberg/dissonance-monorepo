# Engineering Prompt — Audit and Refactor Overlay Architecture into a BabylonJS–Preact Bridge with a Singleton Preact Root

## Role

Act as a senior TypeScript, BabylonJS, and Preact engineer working inside the existing repository.

Your task is to audit the current overlay/UI architecture and refactor it into a clear, typed, lifecycle-safe communication system between BabylonJS and a single persistent Preact application root.

Follow existing repository conventions unless they directly conflict with the architectural requirements below. Do not introduce a parallel framework, duplicate state system, or broad rewrite that is not required to complete this task.

---

## Primary Objective

Replace ad hoc overlay creation, repeated Preact mounts, direct DOM manipulation, and global `window`-event coupling with:

1. One persistent Preact singleton root.
2. A typed BabylonJS-to-Preact communication boundary.
3. A small external overlay state layer for durable UI state.
4. A scoped event channel for transient one-shot commands.
5. Explicit ownership and teardown rules.
6. Fine-grained subscriptions that prevent BabylonJS frame updates from rerendering the full overlay tree.

The resulting system should make all DOM-based overlays flow through one architecture while keeping BabylonJS unaware of Preact component implementation details.

---

## Required Prerequisite

Before making architectural changes:

- Run the relevant application or applications locally.
- Inspect every current overlay visually and behaviorally.
- Inspect the existing overlay behavior in the materials-demo app where applicable.
- Record which overlays exist, how they are mounted, how they receive state, how they are closed, and whether they are persistent, modal, transient, diagnostic, or player-facing.
- Capture the current behavior sufficiently to prevent silent feature loss during the refactor.

Do not begin by replacing code based only on filenames or assumptions.

---

## Scope

Audit all code involved in:

- Preact mounting and unmounting.
- `render(...)` calls.
- Overlay containers and DOM roots.
- `window.addEventListener(...)`.
- `window.removeEventListener(...)`.
- `CustomEvent`.
- `EventTarget`.
- BabylonJS `Observable` usage related to UI.
- Direct `document.createElement(...)` overlay construction.
- Direct DOM mutations performed by game systems.
- UI state stored in BabylonJS scene objects, services, controllers, or globals.
- Keyboard, pointer, resize, focus, visibility, and fullscreen listeners.
- Developer HUDs.
- Player HUDs.
- Lineglass systems.
- Soliloquy, hint, narrative, prompt, notification, inventory, capability, interaction, and mech-control overlays.
- Any app-specific overlay roots that may duplicate the same infrastructure.

Do not refactor unrelated rendering, gameplay, ECS, world generation, or audio systems unless a minimal change is required to establish the communication boundary.

---

## Audit Phase

Create an audit before implementing the final architecture.

### 1. Inventory all UI entry points

Find every location that:

- Calls Preact `render`.
- Mounts a Preact component.
- Creates an overlay DOM node.
- Queries an overlay DOM node by ID or class.
- Writes directly to overlay HTML.
- Dispatches or listens for global custom events.
- Stores overlay state on `window`, `globalThis`, scene metadata, or arbitrary singletons.
- Imports Preact from gameplay or world-system code.
- Imports BabylonJS into leaf UI components.

For each entry point, document:

- File path.
- Owning subsystem.
- Current responsibility.
- Mount lifecycle.
- State source.
- Communication direction.
- Cleanup behavior.
- Update frequency.
- Whether the behavior is durable state or a transient command.
- Risks such as duplicate mounts, stale closures, listener leaks, event-name collisions, or per-frame rerenders.

### 2. Identify existing architectural conventions

Before introducing new files or names, inspect the repository for:

- Existing service patterns.
- Existing controller or facade patterns.
- Existing signal/store packages.
- Existing dependency injection or composition-root conventions.
- Existing BabylonJS observable abstractions.
- Existing test conventions.
- Existing app bootstrap conventions.
- Existing package boundaries in the monorepo.
- Existing dev-HUD and player-HUD architecture.
- Existing profile-driven configuration rules.

Prefer extending a suitable existing convention over inventing a competing abstraction.

### 3. Establish a migration map

Classify every existing UI communication path into one of these categories:

#### Durable state

Examples:

- Active overlay.
- Overlay visibility.
- Selected tab.
- Selected capability.
- Current interaction target.
- Player status.
- Current prompt.
- Current lineglass mode.
- Dev-panel section state.
- Current mech-control mode.

Durable state must live in a typed external state layer that Preact can subscribe to.

#### Transient command

Examples:

- Flash an indicator.
- Play a notification animation.
- Show a toast for a fixed duration.
- Emit a one-shot hint.
- Trigger a temporary pulse.
- Request focus.
- Play a UI sound.
- Announce an event that should not become retained state.

Transient commands must use a scoped, typed command/event channel rather than global `window` events.

#### Genuine browser event

Examples:

- `resize`.
- `keydown` or `keyup`, where globally appropriate.
- `visibilitychange`.
- `focus` and `blur`.
- `fullscreenchange`.
- Pointer-lock events.

These may remain browser listeners, but they must have explicit ownership and teardown.

#### BabylonJS-internal event

Examples:

- Scene disposal.
- Before-render or after-render hooks.
- Pointer observables.
- Camera changes.
- Gameplay observables.

These should remain BabylonJS-native and should be adapted at the bridge boundary rather than exposed directly throughout the Preact tree.

---

## Target Architecture

Implement the following conceptual architecture, adapted to repository naming conventions.

```text
BabylonJS gameplay/world systems
             |
             v
     typed OverlayController
             |
       +-----+------+
       |            |
       v            v
 durable UI state   transient UI commands
 signals/store      scoped command bus
       |            |
       +-----+------+
             |
             v
   singleton Preact OverlayRoot
             |
             v
       overlay components
```

### Architectural rule

BabylonJS systems may call a typed overlay-facing API, but they must not:

- Import leaf Preact components.
- Mount Preact roots.
- Manipulate overlay DOM directly.
- Dispatch custom events on `window`.
- Depend on component-local implementation details.
- Pass large mutable game objects into the UI tree.
- Push full frame-rate state updates into the entire overlay root.

Preact components may consume typed UI state and commands, but leaf components should not become tightly coupled to BabylonJS scene internals.

---

## Singleton Preact Root

Create one persistent Preact root per application runtime.

The root must:

- Be mounted exactly once.
- Own all DOM-based overlays.
- Persist for the lifetime of the application.
- Render overlay slots or layers rather than repeatedly mounting separate Preact trees.
- Support player-facing, narrative, modal, notification, and developer overlay layers.
- Be disposed only during application teardown or hot-reload cleanup.
- Defend against accidental duplicate initialization.
- Work with the repository's existing app bootstrap and test environment.

A possible shape is:

```tsx
export function OverlayRoot(): JSX.Element {
  return (
    <OverlayShell>
      <WorldHudLayer />
      <InteractionLayer />
      <NarrativeLayer />
      <ModalLayer />
      <NotificationLayer />
      <DeveloperLayer />
    </OverlayShell>
  );
}
```

Do not copy this structure blindly. First map existing overlays to the smallest set of meaningful layers.

### Singleton bootstrap requirements

Provide an explicit bootstrap API, such as:

```ts
export interface OverlayAppHandle {
  dispose(): void;
}

export function mountOverlayApp(options: MountOverlayAppOptions): OverlayAppHandle;
```

The bootstrap must:

- Resolve or create the root host element according to repository conventions.
- Avoid duplicate roots.
- Return an idempotent `dispose`.
- Clean up subscriptions and command listeners.
- Behave safely under development hot reload.
- Avoid silently appending multiple overlay containers.

If the project already has an application composition root, integrate there rather than creating a hidden global initializer.

---

## BabylonJS–Preact Communication Boundary

Create a typed facade/controller that game systems use.

A representative interface may look like:

```ts
export interface OverlayController {
  open(request: OpenOverlayRequest): void;
  close(id?: OverlayId): void;
  setActiveOverlay(id: OverlayId | null): void;
  setInteractionPrompt(prompt: InteractionPrompt | null): void;
  setCapabilityState(state: CapabilityOverlayState): void;
  publish(command: OverlayCommand): void;
  reset(): void;
}
```

Use discriminated unions for commands and overlay requests.

Example:

```ts
export type OverlayCommand =
  | {
      type: "notification.show";
      notification: OverlayNotification;
    }
  | {
      type: "indicator.flash";
      indicator: IndicatorId;
      durationMs: number;
    }
  | {
      type: "overlay.focus";
      overlayId: OverlayId;
    }
  | {
      type: "ui.sound.play";
      soundId: UiSoundId;
    };
```

Requirements:

- No stringly typed event names spread across the repository.
- No untyped `CustomEvent.detail`.
- No direct dependency on `window`.
- No payloads typed as `any`.
- No general-purpose god object exposing arbitrary UI mutation.
- Public methods must reflect actual domain operations.
- The controller should be easy to fake in tests.
- The bridge must not expose component setters or DOM nodes.

---

## Durable Overlay State

Use the repository's existing state solution if it is suitable.

If no suitable solution exists, prefer a minimal signal-based store, such as Preact Signals, over a large new state-management dependency.

The state layer must:

- Live outside individual components.
- Be typed.
- Represent durable current state.
- Support direct reads for tests where practical.
- Support fine-grained subscriptions.
- Provide explicit reset behavior.
- Avoid retaining BabylonJS scene objects, meshes, cameras, engines, or large mutable domain graphs.
- Store serializable or UI-specific view models where practical.

Representative state:

```ts
export interface OverlayState {
  activeOverlay: OverlayId | null;
  interactionPrompt: InteractionPrompt | null;
  lineglass: LineglassViewState;
  capabilities: CapabilityOverlayState;
  playerHud: PlayerHudViewState;
  developerHud: DeveloperHudViewState;
}
```

Do not create one monolithic signal if doing so causes all overlays to rerender for every field change. Prefer smaller signals or selectors aligned with component ownership.

---

## Transient Command Channel

Create a scoped command channel for one-shot UI effects.

A local `EventTarget` is acceptable if wrapped in a typed API. A small typed pub/sub implementation is also acceptable.

Requirements:

- The command channel must not use `window`.
- Subscribe and unsubscribe behavior must be explicit.
- Commands must be discriminated unions.
- Subscriber failures should not corrupt the bus.
- Disposal must clear listeners.
- Tests must verify that subscribers are removed.
- Commands should not be used to represent state that must be recoverable after mounting.
- Late subscribers are not expected to replay old transient commands unless the existing product behavior explicitly requires it.

Possible API:

```ts
export interface OverlayCommandBus {
  publish(command: OverlayCommand): void;
  subscribe<TType extends OverlayCommand["type"]>(
    type: TType,
    listener: (
      command: Extract<OverlayCommand, { type: TType }>
    ) => void,
  ): () => void;
  dispose(): void;
}
```

---

## High-Frequency BabylonJS Data

Treat high-frequency updates as a first-class performance concern.

Audit all values that may update:

- Every render frame.
- Every physics tick.
- Every pointer movement.
- Every audio-analysis frame.
- More than several times per second.

For each high-frequency value, choose one of these strategies:

1. Do not expose it to Preact if it is not required.
2. Reduce it to a UI-specific scalar or compact view model.
3. Throttle or sample it at an appropriate UI rate.
4. Quantize it so updates occur only when the displayed value changes.
5. Subscribe only the smallest leaf component.
6. Render it outside Preact only when there is a measured need and a clearly owned imperative DOM path.

Do not pass the full player, scene, camera, engine, mesh, or world-state object through Preact context.

Do not update the entire overlay state from `scene.onBeforeRenderObservable`.

Document any chosen sampling rates and why they are appropriate.

---

## Browser Event Ownership

Retain `window.addEventListener` only for genuine browser-level concerns.

Create an explicit owner for each global listener.

Every listener must:

- Be registered once.
- Have a matching cleanup path.
- Avoid anonymous callbacks when cleanup requires stable identity.
- Be testable.
- Be removed during teardown.
- Avoid duplicate registration during hot reload or scene recreation.

Where appropriate, centralize browser-event adaptation into a service that updates the typed overlay state or BabylonJS input systems.

Do not route domain-level overlay commands through browser events.

---

## Overlay Composition and Layering

Audit current z-index, pointer-event, focus, and modal behavior.

The singleton root must preserve or improve:

- Z-order.
- Pointer capture.
- Keyboard focus.
- Escape behavior.
- Screen-reader semantics where applicable.
- Modal blocking.
- Click-through behavior.
- Developer-overlay coexistence.
- Fullscreen behavior.
- Pointer-lock behavior.
- Mobile touch behavior.
- Resize behavior.

Use a documented layer system rather than arbitrary component-local z-index escalation.

A possible token set:

```ts
export const overlayLayers = {
  worldHud: 10,
  interaction: 20,
  narrative: 30,
  modal: 40,
  notifications: 50,
  developer: 100,
} as const;
```

Use existing CSS variable or token conventions when available.

---

## Migration Strategy

Perform the refactor incrementally.

### Phase 1 — Characterize current behavior

- Complete the audit.
- Add or update tests that lock in critical current behavior.
- Identify duplicate roots and leaked listeners.
- Identify overlays that are safe to migrate first.

### Phase 2 — Introduce infrastructure

- Add the singleton Preact root.
- Add the durable overlay state layer.
- Add the typed command bus.
- Add the typed `OverlayController`.
- Mount the root from the application composition point.
- Keep current behavior working through temporary adapters where necessary.

### Phase 3 — Migrate overlays

Migrate overlays one at a time:

1. Move rendering under `OverlayRoot`.
2. Replace global custom events with controller methods or typed commands.
3. Replace direct DOM state with typed durable state.
4. Remove redundant mount logic.
5. Add lifecycle tests.
6. Visually verify parity.
7. Remove the temporary adapter for that overlay.

Prefer migrating a representative low-risk overlay first, then a more complex overlay, before converting all remaining overlays.

### Phase 4 — Remove legacy paths

After all callers have migrated:

- Remove duplicate Preact `render` calls.
- Remove obsolete overlay containers.
- Remove domain-level `window` custom events.
- Remove direct game-to-overlay DOM mutations.
- Remove unused adapters.
- Remove dead CSS.
- Remove stale global declarations.
- Remove listener code that is no longer reachable.

### Phase 5 — Verify

Run:

- Type checking.
- Linting.
- Unit tests.
- Integration tests.
- Browser tests.
- Relevant app builds.
- Relevant demo apps.
- Manual visual inspection.
- Hot-reload checks.
- Scene-restart and application-teardown checks.

---

## Testing Requirements

Add tests appropriate to the repository's existing stack.

At minimum, verify:

### Singleton behavior

- Mounting creates one root.
- Repeated initialization does not create duplicate roots.
- Disposal is idempotent.
- Hot-reload-style remounting does not retain stale subscriptions.

### Durable state

- Babylon-facing controller operations update the correct state.
- A newly mounted component sees current durable state.
- Reset returns the overlay system to its defined baseline.
- Updating one state slice does not unnecessarily rerender unrelated overlay components.

### Command bus

- Commands reach matching subscribers.
- Unrelated subscribers do not fire.
- Unsubscribe works.
- Dispose removes subscribers.
- Commands remain typed.
- Subscriber errors are handled according to repository conventions.

### Lifecycle

- BabylonJS scene disposal removes scene-bound subscriptions.
- Browser listeners are removed.
- Overlay root teardown removes DOM ownership cleanly.
- Recreating a scene does not duplicate listeners or UI roots.

### Behavioral parity

For each migrated overlay, preserve:

- Opening.
- Closing.
- Toggle behavior.
- Keyboard behavior.
- Pointer behavior.
- Displayed data.
- Animation triggers.
- Focus behavior.
- Layering.
- Game pause or input-blocking behavior, where relevant.

---

## Instrumentation and Performance Verification

Add lightweight development-only diagnostics if the repository has an established diagnostics pattern.

Verify:

- Number of mounted Preact roots.
- Number of active global browser listeners owned by the overlay system.
- Number of command-bus subscribers.
- Overlay rerender frequency for high-frequency readouts.
- Whether scene recreation duplicates subscriptions.
- Whether hidden overlays continue performing expensive work.

Do not add a permanent heavy profiling framework.

Where practical, use Preact render-count tests or development diagnostics to prove that unrelated overlays do not rerender when an isolated signal changes.

---

## Dependency and Package Boundaries

Respect the monorepo's package direction.

Preferred dependency direction:

```text
domain/gameplay packages
        |
        v
overlay contracts or controller interface
        |
        v
overlay implementation package
        |
        v
Preact components
```

Avoid:

```text
gameplay -> Preact leaf component
Preact leaf component -> BabylonJS scene internals
shared domain package -> browser-only DOM implementation
```

If contracts need to be shared, place only framework-neutral types and interfaces in the appropriate shared package.

Do not move browser-only code into packages that must remain environment-agnostic.

---

## Naming Guidance

Use existing project terminology when clear.

Suggested concepts, not mandatory filenames:

```text
overlay/
  contracts/
    overlayTypes.ts
    overlayCommands.ts
    overlayController.ts
  state/
    overlayState.ts
  events/
    overlayCommandBus.ts
  preact/
    OverlayRoot.tsx
    mountOverlayApp.tsx
  adapters/
    babylonOverlayAdapter.ts
```

Do not create unnecessary folders merely to match this sketch.

---

## Explicit Non-Goals

Do not:

- Replace BabylonJS GUI systems that are intentionally rendered in-engine unless the audit demonstrates a concrete reason.
- Rewrite all UI styling.
- Introduce Redux, Zustand, MobX, RxJS, or another major dependency without a demonstrated repository need.
- Convert every BabylonJS observable into Preact state.
- Create a generalized application-wide event bus unrelated to overlays.
- Add a service locator.
- Store BabylonJS engine objects in signals.
- Route browser input through Preact merely for architectural symmetry.
- Preserve poor abstractions only to minimize diff size.
- Perform unrelated gameplay refactors.
- Leave both the old and new systems active indefinitely.

---

## Required Deliverables

Produce the following in the repository:

1. An audit document containing:
   - Current overlay inventory.
   - Existing communication paths.
   - Duplicate mount points.
   - Global listeners.
   - Direct DOM mutation paths.
   - Lifecycle risks.
   - Performance risks.
   - Proposed migration mapping.

2. The singleton Preact overlay root.

3. The typed durable overlay state layer.

4. The typed transient command channel.

5. The BabylonJS-facing overlay controller or facade.

6. Migrated overlay implementations.

7. Removal of superseded legacy paths.

8. Tests covering singleton, state, events, lifecycle, and behavioral parity.

9. A concise architecture document describing:
   - Ownership.
   - Dependency direction.
   - State versus command rules.
   - Listener lifecycle.
   - High-frequency update policy.
   - Instructions for adding a new overlay.

10. A final implementation report containing:
    - Files changed.
    - Architectural decisions.
    - Legacy paths removed.
    - Tests run.
    - Manual verification performed.
    - Known limitations.
    - Follow-up work that is genuinely out of scope.

---

## Acceptance Criteria

The work is complete only when all of the following are true:

- Exactly one persistent Preact overlay root exists per application runtime.
- Overlay components are composed under that root.
- BabylonJS systems communicate through a typed overlay-facing boundary.
- Durable UI state does not rely on transient events.
- Transient UI commands do not rely on durable state hacks.
- Domain-level overlay communication no longer uses `window` custom events.
- Direct overlay DOM manipulation from BabylonJS systems is removed or explicitly justified.
- Duplicate Preact mounts are removed.
- Browser listeners have explicit ownership and cleanup.
- Scene recreation does not duplicate roots or listeners.
- High-frequency BabylonJS data does not rerender the entire overlay tree.
- Existing overlay behavior is visually and functionally preserved unless an intentional change is documented.
- Type checking, linting, tests, and relevant builds pass.
- The architecture documentation explains how future overlays must be added.

---

## Implementation Principles

- Audit before rewriting.
- Preserve behavior before improving behavior.
- Prefer typed domain operations over generic event strings.
- Prefer durable state for current truth.
- Prefer commands for one-shot effects.
- Prefer one composition root over hidden initialization.
- Prefer fine-grained subscriptions over global rerenders.
- Prefer explicit teardown over assumed garbage collection.
- Prefer repository conventions over speculative abstractions.
- Remove the legacy path once migration is complete.

---

## Final Response Format

When complete, report:

1. Audit findings.
2. Architecture implemented.
3. Overlay migration summary.
4. Legacy mechanisms removed.
5. Performance protections added.
6. Tests and verification run.
7. Remaining risks or intentionally deferred work.

Do not claim completion without running the available validation commands and visually inspecting the migrated overlays.
