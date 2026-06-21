# PURSUER SYSTEM EXTRACTION — MASTER PROMPT

## Context

You are working inside the `dont-turn-around-monorepo-2` Turborepo. Currently the only workspace is `apps/dont-turn-around`, which contains a fully working horror walking game built with BabylonJS, Tone.js, and TypeScript. No `packages/` workspace exists yet.

This prompt governs the **first extraction pass**: pulling reusable logic out of the pursuer system (`src/pursuer/PursuerSystem.ts`, `src/pursuer/PursuerBody.ts`, `src/pursuer/PursuerAudio.ts`) into shared packages, following the architectural rules already established for this project:

- Inspect before creating. Reuse before duplicating.
- Don't hardcode horror-specific assumptions into reusable packages.
- Packages should be generic enough to serve a future second app (e.g. Dissonance) without modification.
- A working system is more valuable than a perfect abstraction. Do not over-extract.

Do not refactor anything outside the scope listed below. Do not touch `PursuerAudio.ts` beyond what's specified in Phase 3. Do not introduce event sourcing, provenance, or multiplayer sync in this pass — that is explicitly out of scope and aspirational per current project status.

---

## Phase 0 — Workspace scaffolding

Before moving any code:

1. Create `packages/types` as a new workspace package (or confirm one doesn't already exist under a different name — inspect first).
2. Add it to the root `package.json` workspaces / `turbo.json` pipeline as needed.
3. Configure `apps/dont-turn-around/tsconfig.json` and `vite.config.ts` to resolve the new package (path alias or workspace dependency — match whatever pattern the repo already uses, if any precedent exists; otherwise use standard workspace `"@dontturn/types": "workspace:*"` style naming, but confirm naming convention preference before committing to a scope prefix).

**Validation:** `npm run dev` in `apps/dont-turn-around` still starts cleanly with zero functional changes after this phase.

---

## Phase 1 — Extract shared types

**Objective:** Move `PursuerModel` and `PursuerState` (and any other types that will be referenced by extracted packages) out of `apps/dont-turn-around/src/types` into `packages/types`.

**Steps:**
1. Identify every type currently in `src/types` that is referenced by `PursuerSystem.ts`, `PursuerBody.ts`, or `PursuerAudio.ts`.
2. Move `PursuerState`, `PursuerModel` into `packages/types/src/pursuer.ts` (or equivalent). Keep `ExperienceMode` here too if it will be needed by the generic glow package in Phase 3 — otherwise leave it app-local since it's PS1/radio-mode specific.
3. Re-export from `packages/types/src/index.ts`.
4. Update imports in the app to pull these from the new package instead of local `../types`.

**Do not** move types that are purely app-specific (e.g. anything tied only to DTA's HUD, config shape, or rendering profiles) — only move what extracted packages will need to import.

**Validation:** App builds and runs identically. No behavior change. `tsc --noEmit` passes with no new errors.

---

## Phase 2 — Extract `PursuerSystem` → `packages/ai/proximity-system` (or `packages/engine/proximity-ai` — confirm naming against existing package conventions before creating)

**Objective:** Extract the proximity/aggression state machine as a fully generic, config-injected system with zero references to DTA-specific naming or behavior beyond what's already abstracted.

**Assumptions:**
- The state machine logic (aggression rise/decay, distance bucketing into far/near/close/caught, line-of-sight and crouch modifiers) is already free of horror-specific coupling except for naming.
- `PURSUER_CONFIG` is currently imported directly from `../config/runProfiles`. This must become an injected config object, not an implicit import.

**Steps:**
1. Create the new package with a `PursuerConfig` interface (or rename to something neutral like `ProximityConfig` if you want the package itself to be domain-agnostic — your call, but be consistent: if the package is named generically, the types inside it should be too).
2. Move `PursuerSystem.ts` into the package. Replace the `PURSUER_CONFIG` import with a required constructor parameter.
3. In `apps/dont-turn-around`, instantiate the system with `PURSUER_CONFIG` passed in explicitly from `config/runProfiles`.
4. Update all app-side imports of `PursuerSystem` to pull from the new package.
5. `getModel()`, `update()`, `reset()` signatures stay as-is — no behavior change, only relocation + config injection.

**Risks/edge cases:**
- Confirm `PursuerModel`/`PursuerState` import correctly from `packages/types` (Phase 1 dependency).
- Confirm no other app file is reaching into `PursuerSystem`'s internals (private fields) — should be safe given the current encapsulation, but verify.

**Validation:** Pursuer behavior in-game is byte-for-byte identical pre/post extraction. Manually verify aggression rise on sprint, decay on hide/crouch, and state transitions through all four tiers still function.

---

## Phase 3 — Split `PursuerBody` into generic glow package + thin app wrapper

**Objective:** Separate the reusable heartbeat-synced glow-pulse math from the DTA-specific mesh/color/mode logic.

**New package:** `packages/render/heartbeat-glow` (or similar — confirm naming convention).

**What moves to the package:**
- The BPM-to-cycle-length math, lub/dub pulse curve, base+peak glow intensity calculation.
- A generic class — call it `HeartbeatGlow` or `PulsingEmitter` — that takes a `Mesh`, a `GlowLayer` (or constructs its own), a stress value setter, and **glow color as a constructor parameter** (not a mode enum).
- Should expose the same `setStress(stress: number)` and an `update(dt: number)` method, returning/applying the computed `glow.intensity`.

**What stays in the app (`apps/dont-turn-around/src/pursuer/PursuerBody.ts`):**
- Capsule mesh creation, `ExperienceMode` handling (`ps1` vs `radio`), the glow color table (`glowR/G/B` per mode), tessellation/subdivision settings, `convertToFlatShadedMesh()`.
- `PursuerBody` becomes a thin wrapper: builds the mesh + material per mode, constructs a `HeartbeatGlow` instance with the resolved color, and delegates `setStress`/`update` to it.

**Steps:**
1. Create the package, implement `HeartbeatGlow` with the extracted math — no knowledge of "pursuer," "PS1," or "radio" anywhere in the package.
2. Rewrite `PursuerBody.ts` to own only mesh/material/mode logic and hold a `HeartbeatGlow` instance internally.
3. Confirm position update (`capsule.position.set(...)`) stays in `PursuerBody` — that's mesh placement, not glow logic, and is app/entity-specific.

**Risks/edge cases:**
- The glow math currently assumes `glow.intensity` is the only output. If the package needs to support meshes without an existing `GlowLayer`, decide whether `HeartbeatGlow` creates its own layer or expects one passed in. Recommend: accept an existing `GlowLayer` as a parameter so multiple emitters can share one layer later (relevant if Dissonance ever wants multiple glowing entities).
- Preserve the exact pulse curve constants (`5.5`, `2.5` exponent, `0.14` phase offset, `13` multiplier) — these were tuned to match `HeartbeatAudio`'s BPM curve. Do not "clean up" these magic numbers without flagging it — they're load-bearing tuning, not arbitrary.

**Validation:** Visual glow behavior is identical at all stress levels, both experience modes. Confirm `dispose()` still correctly tears down both the capsule and the glow layer/emitter.

---

## Phase 4 — `PursuerAudio` (do not extract yet)

**Objective:** No extraction in this pass. Leave `PursuerAudio.ts` in `apps/dont-turn-around/src/pursuer/`.

**Rationale:** The actual sound content (branch snaps, leaf rustle, footstep cracks) is forest/DTA-specific. The *pattern* underneath — tiered timer-based event scheduling with weather-mask-scaled trigger probability — is reusable, but extracting it now would be premature abstraction with only one consumer. Revisit when a second app (e.g. Dissonance's SignalNet patrol audio) needs the same scheduling shape.

**Action:** Add a `// EXTRACTION CANDIDATE` comment block at the top of the file noting the future package boundary (tiered probabilistic event scheduler, sound callbacks injected rather than hardcoded to `AudioEngine.play*`), so this isn't lost by the time a second consumer exists.

---

## Final Validation Checklist

- [ ] `npm run dev` in `apps/dont-turn-around` runs with no console errors
- [ ] `npm run build` succeeds across the monorepo (`turbo build` if pipeline is wired)
- [ ] `tsc --noEmit` clean in both the app and all new packages
- [ ] Pursuer behavior (aggression, state transitions, glow, audio) is unchanged in manual playtest
- [ ] No package imports anything from `apps/dont-turn-around` (one-directional dependency: apps depend on packages, never the reverse)
- [ ] `PursuerAudio.ts` is untouched except for the added extraction-candidate comment

## Out of scope for this pass

- Event-sourced provenance / artifact history (aspirational, not started)
- Multiplayer/Colyseus sync of pursuer state
- Any change to `PursuerAudio`'s actual logic
- Any package beyond `packages/types`, the proximity-system package, and the heartbeat-glow package
