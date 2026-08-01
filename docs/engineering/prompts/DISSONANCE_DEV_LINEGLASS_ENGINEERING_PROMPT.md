# Engineering Prompt — Dissonance Dev Lineglass Redesign

## Role

You are a senior TypeScript/Babylon.js engineer working inside the existing **Dissonance** repository.

Implement a major redesign of the current developer HUD. The existing HUD has grown into a long, continuously scrolling parameter sheet containing world controls, sky controls, audio settings, interior state, movement settings, navigation, route recording, replay, and diagnostics.

Replace that interface with a reusable **Lineglass UI system**.

The implementation must follow existing repository conventions, package boundaries, naming patterns, profile architecture, state-management patterns, styling conventions, and test practices. Inspect the repository before introducing new abstractions. Do not create parallel systems where an existing mechanism can be extended.

---

# Objective

Create a compact, readable, collapsible developer interface modeled after an in-world device called the **Dev Lineglass**.

The Lineglass should:

1. Make current world state understandable at a glance.
2. Replace the long scrolling form with compact subsystem rows.
3. Show detailed controls only when deliberately expanded.
4. Distinguish inherited profile values from runtime overrides.
5. Separate inspection, tuning, authoring, and diagnostics.
6. Serve as the reusable UI foundation for a future player-facing Lineglass.
7. Preserve all existing developer HUD functionality during migration.
8. Avoid coupling the reusable Lineglass shell to developer-only concepts.

The target visual design is a narrow, vertical, industrial device interface with:

- dark charcoal background,
- phosphor blue/cyan text,
- restrained green and amber state indicators,
- monospaced typography,
- thin borders,
- compact spacing,
- minimal glow,
- clean hierarchy,
- no ornamental steampunk styling,
- no generic Bootstrap/admin-dashboard appearance.

The supplied visual mockup should be treated as the primary visual reference.

---

# Core Design Principle

The interface must reveal information in this order:

1. **Current state**
2. **Available actions**
3. **Editable parameters**
4. **Raw engineering detail**

A developer should not need to scan dozens of sliders to answer:

- Where am I?
- What environment is active?
- Which values are overridden?
- Is route recording active?
- Which subsystem is likely affecting performance?
- Which profile produced the current state?

---

# High-Level Layout

The Lineglass should render as a narrow vertical panel.

```text
┌──────────────────────────────────────────┐
│ DEV LINEGLASS                      LIVE │
├──────────────────────────────────────────┤
│ INSPECT     TUNE     AUTHOR     SYSTEM  │
├──────────────────────────────────────────┤
│ WORLD        Forest · 200 · R 1427 m   › │
│ SKY          Night · Fog low · 30%     › │
│ AUDIO        Wind 60% · Breath idle    › │
│ INTERIOR     Milo apartment · active   ▼ │
│   ...expanded content...                 │
│ MOVEMENT     Walk · 1.5 m              › │
│ NAVIGATION   40.7384, -74.2731         › │
│ ROUTES       new-route · 0 points      › │
│ REPLAY       No route selected         › │
│ DIAGNOSTICS  25 fps · Level 1          › │
├──────────────────────────────────────────┤
│ ■ PROFILE    ■ OVERRIDE    ■ LIVE       │
└──────────────────────────────────────────┘
```

Only one module should be expanded by default.

Support pinning or multi-open behavior only if it can be implemented cleanly without complicating the first pass.

---

# Top-Level Modes

Implement four top-level Lineglass modes.

## Inspect

Primarily read-only world and player state.

Examples:

- current route,
- current scene or interior,
- coordinates,
- ground distance,
- active profile,
- active overrides,
- player embodiment state,
- FPS,
- instance counts,
- currently active audio state.

## Tune

Frequently adjusted runtime controls.

Examples:

- world density,
- forest radius,
- terrain relief,
- time of day,
- fog,
- clouds,
- wind volume,
- movement mode,
- camera height.

## Author

Content-creation tools.

Examples:

- saved views,
- location selection,
- route recorder,
- route replay,
- route import/export,
- object placement,
- manifest utilities.

## System

Engineering-level diagnostics.

Examples:

- FPS,
- frame timing,
- LOD state,
- thin-instance counts,
- requested versus placed counts,
- profile-resolution information,
- active overrides,
- scene identifiers,
- streaming status,
- memory statistics where already available.

Do not duplicate controls across modes unless the repository already supports shared actions. A module may appear differently in more than one mode, but its state and commands must be sourced from the same underlying service.

---

# Module Model

Implement the Lineglass as a declarative module system.

The exact interface may vary to fit repository conventions, but the architecture should resemble:

```ts
export interface LineglassModule {
  id: string;
  label: string;
  icon?: LineglassIcon;
  mode: LineglassMode | LineglassMode[];
  priority?: number;
  status?: LineglassStatus;
  summary: LineglassSummary;
  sections: LineglassSection[];
  capabilities?: LineglassCapability[];
}
```

Suggested supporting types:

```ts
export type LineglassMode =
  | "inspect"
  | "tune"
  | "author"
  | "system";

export type LineglassStatus =
  | "normal"
  | "active"
  | "warning"
  | "error"
  | "disabled";

export interface LineglassSummary {
  primary: string;
  secondary?: string;
  badge?: string;
}

export interface LineglassSection {
  id: string;
  label?: string;
  collapsed?: boolean;
  level?: "primary" | "advanced" | "engineering";
  controls: LineglassControlDefinition[];
}
```

Do not hardcode every module directly into the shell component.

The shell should receive a registry or resolved list of modules.

---

# Capability-Based Reuse

The reusable Lineglass system must support both:

- developer modules,
- future player-facing modules.

Do not build the system as a developer HUD that will later be visually reskinned.

Use a capability-aware design.

Example:

```ts
export type LineglassCapability =
  | "inspect-world"
  | "edit-world"
  | "author-routes"
  | "inspect-signals"
  | "record-artifacts"
  | "view-diagnostics"
  | "teleport"
  | "edit-profile";
```

A future player Lineglass may use the same shell and controls but expose only capabilities such as:

```ts
const playerCapabilities: LineglassCapability[] = [
  "inspect-signals",
  "record-artifacts",
];
```

A developer Lineglass may expose:

```ts
const developerCapabilities: LineglassCapability[] = [
  "inspect-world",
  "edit-world",
  "author-routes",
  "view-diagnostics",
  "teleport",
  "edit-profile",
];
```

The capability filter should remove unavailable modules, sections, or actions before rendering.

---

# Control Library

Create or extend a small reusable Lineglass control vocabulary.

Potential primitives:

```ts
LineglassToggle
LineglassSlider
LineglassSelect
LineglassNumberInput
LineglassTextInput
LineglassCoordinateReadout
LineglassButton
LineglassActionRow
LineglassMeter
LineglassStatusReadout
LineglassDisclosure
LineglassTabs
LineglassFileAction
LineglassBadge
```

These must wrap browser-native controls rather than exposing inconsistent native controls throughout the panel.

Every control should support a common state model.

```ts
export type LineglassValueSource =
  | "profile"
  | "runtime"
  | "override"
  | "recorded"
  | "derived";

export interface LineglassControlState<T> {
  value: T;
  source?: LineglassValueSource;
  dirty?: boolean;
  disabled?: boolean;
  warning?: string;
}
```

Preserve accessibility and keyboard behavior.

Do not sacrifice usability for visual styling.

---

# Profile and Override Semantics

The existing Dissonance architecture uses profiles as the canonical path for resolving environment and behavior state.

The Lineglass must reinforce that architecture.

It must clearly distinguish:

- profile-derived values,
- temporary runtime values,
- explicit developer overrides,
- derived values,
- recorded values.

A control should visually indicate its source.

Example:

```text
Forest count     200       PROFILE
Forest radius    1427 m    OVERRIDE
Time of day      23:00     OVERRIDE
Fog              0.0012    PROFILE
FPS               25       DERIVED
```

Collapsed rows should indicate override count when useful.

```text
WORLD    Forest · 200 · R 1427 m    2 overrides
```

Provide section-level actions where appropriate:

```text
[ Clear overrides ]
[ Save as profile ]
```

Only implement “Save as profile” if there is already a safe, canonical repository path for profile persistence. Do not invent a competing profile-writing mechanism.

Runtime UI controls must ultimately flow through the repository’s canonical profile/application path where applicable.

Do not directly mutate Babylon scene state from UI components if the repository already has an environment or profile controller.

---

# Required Initial Modules

Implement these modules in the first pass.

## 1. Context or Interior

The current surveillance interior block should become a high-priority context module.

Collapsed summary:

```text
INTERIOR    Milo apartment · active
```

Expanded content:

- route identifier,
- transition type,
- return snapshot status,
- compact location or floorplan readout if available,
- exit interior action,
- copy current position action,
- camera height,
- movement mode,
- advanced disclosure.

Avoid duplicating movement controls if they already exist in the Movement module. It is acceptable to display relevant context read-only and link to the controlling module.

## 2. World

Collapsed summary:

```text
WORLD    Forest · 200 instances · R 1427 m
```

Primary controls:

- active environment/world profile,
- trail-side tree count,
- bulk forest count,
- bulk forest radius,
- terrain relief,
- water level where relevant,
- wind response.

Advanced controls:

- trail-side horizontal scale,
- trail-side vertical scale,
- bulk horizontal scale,
- bulk vertical scale,
- vertical exaggeration,
- detailed placement controls,
- generation seed if already exposed.

Engineering readouts:

- requested instance count,
- actual placed instance count,
- active LOD,
- source asset identifiers where useful.

## 3. Sky

Collapsed summary:

```text
SKY    Night 23:00 · Fog low · Clouds 30%
```

Primary controls:

- time of day,
- sky mode,
- fog amount,
- cloud density,
- cloud opacity.

Advanced controls:

- sun tint,
- sky tint,
- stars,
- fog color,
- exact numeric fog parameters.

## 4. Audio

Collapsed summary:

```text
AUDIO    Wind 60% · Footsteps on · Breath idle
```

Primary controls:

- mute all,
- wind volume,
- mute footsteps,
- mute breath.

Readouts:

- current breath state,
- active ambient profile,
- major mute or solo state if already available.

## 5. Movement

Collapsed summary:

```text
MOVEMENT    Walk · 1.5 m
```

Primary controls:

- movement mode,
- camera height.

Advanced controls:

- embodiment scale,
- speed presets,
- collision or locomotion debug state where available.

## 6. Navigation

Collapsed summary:

```text
NAVIGATION    40.7384, -74.2731
```

Separate navigation into clear subsections:

### Position

- current world position,
- latitude/longitude,
- ground offset,
- copy current position,
- reset to trailhead.

### Locations

- choose location,
- go to location.

### Saved Views

- choose saved view,
- copy current view,
- import view from JSON.

Do not place route recording inside the Navigation module.

## 7. Routes

Collapsed summary:

```text
ROUTES    new-route · 0 points
```

Expanded content:

- route name,
- point count,
- auto spacing,
- recording state,
- record,
- add point,
- undo,
- clear,
- copy JSON,
- download JSON,
- GeoJSON export.

Disable actions according to state rather than leaving ambiguous inactive buttons.

## 8. Replay

Collapsed summary:

```text
REPLAY    No route selected
```

Expanded content:

- route selection,
- route progress,
- play,
- pause,
- stop,
- speed selection,
- route import.

## 9. Diagnostics

Collapsed summary:

```text
DIAGNOSTICS    25 fps · Level 1
```

Expanded content:

- FPS,
- active level,
- current route,
- world coordinates,
- latitude/longitude,
- ground distance,
- instance counts,
- active profile,
- override count.

Do not duplicate editable controls here. Diagnostics should generally be read-only.

---

# Progressive Disclosure

Each module should support three levels of information.

## Level 1: Summary

Visible while collapsed.

Example:

```text
WORLD    Forest · 200 · R 1427 m
```

## Level 2: Primary Controls

Visible when expanded.

Example:

```text
Profile            Forest / Default
Bulk forest        200
Forest radius      1427 m
Terrain relief     24.7 m
```

## Level 3: Advanced or Engineering Controls

Hidden behind a disclosure.

Example:

```text
ADVANCED TUNING
Trail H scale      1.00×
Trail V scale      1.00×
Bulk H scale       1.00×
Bulk V scale       1.00×
Generation seed    41820
```

Do not expose every raw property in the primary expanded state.

---

# Summary Generation

Module summaries must be derived from current state.

Do not hardcode display strings inside visual components.

Example:

```ts
function createWorldSummary(
  state: ResolvedWorldState,
): LineglassSummary {
  return {
    primary: state.profileLabel,
    secondary:
      `${state.bulkForestCount} instances · ` +
      `R ${Math.round(state.bulkForestRadiusMeters)} m`,
  };
}
```

Summary formatting should be testable separately from rendering.

Use existing formatting utilities where available.

---

# Interaction Requirements

## Accordion behavior

- Opening a module should close the previously open module by default.
- The open module should remain stable during value updates.
- Switching top-level modes may preserve the last-open module per mode.
- Do not unexpectedly scroll the user away from the selected module.

## Keyboard navigation

Support at minimum:

```text
Arrow Up / Down    Move between module rows
Enter / Space      Expand or collapse selected module
Escape             Collapse current module or return to overview
Tab                Move between controls
```

Optional, if cleanly supported:

```text
/                  Focus module search
Left / Right       Adjust selected slider
```

## Pointer behavior

- Entire module row should be clickable.
- Small action controls inside an expanded module must not trigger row collapse.
- Sliders must not update on accidental scroll-wheel input unless explicitly focused.

## Focus behavior

- Use visible focus states.
- Preserve focus after state updates.
- Do not trap focus inside the panel.

---

# Responsive Behavior

The Lineglass should work in at least three contexts:

1. Desktop developer overlay.
2. Narrow docked side panel.
3. Future in-world texture or device display.

Avoid layout assumptions that require a wide browser viewport.

Target a baseline width around:

```text
360–460 CSS pixels
```

The implementation should remain usable below that range where practical.

Long route names and identifiers must truncate or wrap predictably.

Use tabular numeric styling where available.

---

# Visual Styling

Create a reusable Lineglass design-token layer.

Example:

```ts
export interface LineglassTheme {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderActive: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  live: string;
  override: string;
  warning: string;
  error: string;
  glowStrength: number;
}
```

Prefer CSS variables or the styling mechanism already used by the project.

Suggested semantic tokens:

```css
--lineglass-bg
--lineglass-surface
--lineglass-surface-raised
--lineglass-border
--lineglass-border-active
--lineglass-text
--lineglass-text-muted
--lineglass-accent
--lineglass-live
--lineglass-override
--lineglass-warning
--lineglass-error
--lineglass-focus
```

Visual guidelines:

- restrained cyan borders,
- brighter border only for active or expanded modules,
- minimal shadows,
- subtle glow only around active elements,
- compact uppercase labels,
- readable mixed-case values,
- no gratuitous animation,
- no excessive iconography,
- no animated scanlines that impair legibility,
- no full-screen visual noise.

Animations should be brief and functional.

Respect reduced-motion preferences.

---

# Device Frame Versus UI Shell

Separate the usable interface from the decorative device frame.

Suggested structure:

```text
LineglassDeviceFrame
  LineglassShell
    LineglassHeader
    LineglassModeTabs
    LineglassModuleList
    LineglassLegend
    LineglassFooter
```

The developer overlay should be able to render:

```tsx
<LineglassShell />
```

without the physical frame.

An in-world player device can later render:

```tsx
<LineglassDeviceFrame>
  <LineglassShell />
</LineglassDeviceFrame>
```

Do not bake scratches, casing, battery indicators, or fictional hardware details into the core control components.

---

# State Architecture

The UI should consume resolved state through adapters or selectors.

Avoid allowing each module to independently query arbitrary global state.

Preferred flow:

```text
Existing game/profile/runtime state
                ↓
       Lineglass state adapter
                ↓
      Resolved module view model
                ↓
          Lineglass renderer
```

Suggested shape:

```ts
export interface ResolvedLineglassModule {
  id: string;
  label: string;
  mode: LineglassMode[];
  summary: LineglassSummary;
  status: LineglassStatus;
  overrideCount: number;
  sections: ResolvedLineglassSection[];
}
```

Separate:

- domain state,
- command handlers,
- view formatting,
- UI rendering.

Do not put Babylon.js scene manipulation directly in React event handlers.

---

# Command Architecture

Actions such as:

- exit interior,
- teleport,
- reset position,
- begin recording,
- add route point,
- replay route,
- clear overrides,

should use existing command or service layers.

Where no command abstraction exists, introduce a narrow adapter rather than coupling the UI to scene internals.

Example:

```ts
export interface LineglassCommands {
  exitInterior(): Promise<void> | void;
  copyCurrentPosition(): Promise<void>;
  resetToTrailhead(): Promise<void> | void;
  beginRouteRecording(options: RouteRecordingOptions): void;
  stopRouteRecording(): void;
  clearWorldOverrides(): void;
}
```

Module components should receive command functions through their resolved view model or context.

---

# Error and Warning States

Display operational errors within the relevant module.

Examples:

```text
ROUTES    Draft · save failed    WARNING
WORLD     200 requested · 164 placed
AUDIO     Context unavailable
```

Do not rely only on console logging.

A module may display:

- warning badge,
- error summary,
- inline error message,
- retry action.

Errors should not cause the entire Lineglass to disappear.

---

# Persistence

Persist only appropriate UI preferences.

Potentially persist:

- last active top-level mode,
- last open module per mode,
- pinned quick controls if implemented,
- panel position or width if the existing HUD already supports this.

Do not persist transient game values simply because they are edited through the Lineglass.

Use the repository’s existing persistence abstraction where available.

---

# Quick Tune

After the primary shell is stable, optionally add a small **Quick Tune** module.

It should contain a user-selected subset of frequently used controls.

Example:

```text
QUICK TUNE
Time            23:00
Fog             0.0012
Forest count    200
Wind            0.60
```

This is secondary scope.

Do not delay the core module migration to build it.

---

# Search

A module or control search may be added after the base architecture works.

Example:

```text
> fog
```

Results:

```text
SKY / Fog
WORLD / Fog bounds
AUDIO / Fog attenuation
```

Search is not required for the first implementation pass unless the current repository already has a command palette or reusable fuzzy-search utility.

---

# Migration Strategy

Do not replace the entire HUD in one untestable rewrite.

Use staged migration.

## Phase 1 — Shell

Implement:

- Lineglass shell,
- header,
- mode tabs,
- module row,
- summary,
- accordion state,
- section disclosure,
- source badges,
- theme tokens.

Create static development fixtures for visual testing.

## Phase 2 — Core Tuning Modules

Migrate:

- World,
- Sky,
- Audio,
- Movement.

Ensure they still use the canonical existing state and command paths.

## Phase 3 — Context and Navigation

Migrate:

- Interior/context,
- position,
- locations,
- saved views.

## Phase 4 — Authoring

Migrate:

- route recorder,
- route replay,
- route import/export.

## Phase 5 — Diagnostics

Migrate:

- FPS,
- LOD,
- placement counts,
- coordinates,
- profile state,
- override state.

## Phase 6 — Remove Legacy HUD

Remove the old controls only when feature parity has been verified.

During migration, either:

- keep the old HUD behind a development flag, or
- provide a temporary legacy mode.

Do not maintain two permanent state paths.

---

# Testing Requirements

Use the repository’s existing testing stack and conventions.

At minimum, test:

## Unit tests

- summary-formatting functions,
- capability filtering,
- mode filtering,
- profile/override source formatting,
- module ordering,
- one-open-module reducer or state machine,
- control-state adaptation,
- disabled action logic,
- route recording status formatting.

## Component tests

- collapsed module row,
- expanded module,
- advanced disclosure,
- mode switching,
- keyboard navigation,
- source badges,
- error state,
- long-value truncation,
- focus preservation.

## Integration tests

- changing a Lineglass control updates the existing canonical state path,
- clearing an override restores the inherited profile value,
- route recording commands invoke the existing route system,
- exiting an interior uses the existing transition system,
- diagnostics update without forcing unrelated modules to remount.

## End-to-end tests

Using Playwright where the repository already supports it:

1. Open the Dev Lineglass.
2. Switch to Tune.
3. Expand World.
4. Change forest count.
5. Confirm collapsed summary updates.
6. Confirm override badge appears.
7. Clear override.
8. Confirm inherited value returns.
9. Switch to Author.
10. Start and stop route recording.
11. Verify route status and point count.
12. Switch to System.
13. Confirm diagnostics are visible.

Avoid brittle screenshot-only tests. Use stable semantic selectors.

---

# Performance Requirements

The Lineglass must not become a source of frame instability.

- Avoid rerendering every module every animation frame.
- Subscribe only to state required by each module.
- Throttle or sample rapidly changing diagnostics such as FPS.
- Do not rebuild module registries during every render.
- Memoize resolved summaries where useful.
- Avoid polling when event-driven state already exists.
- Do not synchronize slider updates to expensive world regeneration on every pointer movement unless the existing system safely supports it.

For expensive values, use one of:

- preview while dragging and commit on release,
- throttled updates,
- numeric entry with explicit commit,
- debounced updates.

Document which controls use which behavior.

---

# Accessibility

Even though the UI is visually diegetic, it must remain usable.

Include:

- semantic buttons,
- semantic tabs,
- proper disclosure attributes,
- labels for controls,
- visible focus states,
- keyboard navigation,
- adequate contrast,
- reduced-motion support,
- screen-reader-accessible summaries,
- no information conveyed by color alone.

State badges should contain text or accessible labels.

---

# File and Package Organization

Follow the repository’s existing package layout.

A possible structure, only if consistent with the repository:

```text
packages/
  ui/
    lineglass/
      LineglassShell.tsx
      LineglassModuleRow.tsx
      LineglassSection.tsx
      LineglassModeTabs.tsx
      LineglassControlRenderer.tsx
      controls/
      theme/
      types.ts
      index.ts

apps/
  dissonance/
    dev-lineglass/
      modules/
        worldLineglassModule.ts
        skyLineglassModule.ts
        audioLineglassModule.ts
        movementLineglassModule.ts
        interiorLineglassModule.ts
        navigationLineglassModule.ts
        routesLineglassModule.ts
        replayLineglassModule.ts
        diagnosticsLineglassModule.ts
      adapters/
      commands/
      DevLineglass.tsx
```

Do not force this structure if the repository already has a better-established convention.

The reusable shell belongs in the appropriate shared UI package.

Developer-specific module definitions belong near the developer tooling.

---

# Documentation

Add concise documentation covering:

- how to register a module,
- how summaries are generated,
- how control sources are represented,
- how capabilities filter modules,
- how to add a future player Lineglass module,
- how controls connect to profile and runtime state,
- which values are safe to override,
- how advanced and engineering sections should be used.

Include one example player-facing module to prove reuse, but do not build a full player UI.

Example:

```ts
const signalModule: LineglassModule = {
  id: "signal",
  label: "Signal",
  mode: ["inspect"],
  capabilities: ["inspect-signals"],
  summary: {
    primary: "Weak carrier",
    secondary: "Bearing NE · unstable",
  },
  sections: [
    {
      id: "primary",
      level: "primary",
      controls: [
        signalStrengthReadout,
        signalBearingReadout,
        tuneSignalAction,
      ],
    },
  ],
};
```

This example should demonstrate that the shell does not depend on developer-only concepts.

---

# Acceptance Criteria

The implementation is complete when:

1. The developer HUD is represented as a compact Lineglass panel.
2. All major systems appear as collapsed summary rows.
3. One module can be expanded to reveal primary controls.
4. Advanced controls are separately disclosed.
5. Inspect, Tune, Author, and System modes work.
6. World, Sky, Audio, Movement, Interior, Navigation, Routes, Replay, and Diagnostics are migrated.
7. Existing functionality remains available.
8. Profile-derived values and overrides are visually distinguishable.
9. Clearing an override restores the inherited value correctly.
10. UI components do not directly mutate Babylon scene state.
11. The shell can render without the fictional device frame.
12. Capability filtering supports a future player-facing Lineglass.
13. Keyboard navigation works.
14. Automated tests cover module behavior and core state transitions.
15. The legacy HUD can be removed or disabled without losing functionality.
16. The result closely matches the supplied Dissonance Lineglass visual mockup while remaining practical for daily development.

---

# Non-Goals

Do not:

- redesign the underlying world-generation systems,
- rewrite the profile architecture,
- introduce an unrelated global state framework,
- convert the entire game UI at once,
- build the complete player Lineglass,
- create a second route system,
- directly serialize arbitrary runtime state into profiles,
- add ornamental animations that reduce readability,
- leave the old HUD as a permanent parallel implementation,
- hardcode the mockup as a non-functional image.

---

# Deliverables

Provide:

1. Reusable Lineglass shell and control primitives.
2. Developer module registry.
3. Migrated modules listed in this prompt.
4. State and command adapters.
5. Theme tokens matching the visual mockup.
6. Tests.
7. Migration notes.
8. Documentation for adding modules.
9. A brief engineering summary containing:
   - files added,
   - files modified,
   - architectural decisions,
   - functionality migrated,
   - remaining limitations,
   - recommended next step for the player Lineglass.

Before coding, inspect the repository and produce a concise implementation plan identifying the existing systems that will be reused. Then implement the work incrementally, validating each migrated module before removing its legacy equivalent.
