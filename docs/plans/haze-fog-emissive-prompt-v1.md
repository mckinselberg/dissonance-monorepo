# haze-band-fog + emissive-dot machinery — implementation prompt v1

**Status (2026-07-31):** runtime implementation landed as environment-profile
machinery, not a saved view. The Phase 0/schema/profile-data slice landed in
`014abe1`; the fixed-four shared material plugin, World window/lamp adapters,
and red-channel consumer are now wired through the existing apply seam. Type
checks, focused tests, and the production World build pass. The mandatory live
depth-ramp/reference tuning pass remains a follow-up; `occupancyMask` is still
the intentionally nullable, unimplemented silhouette slot. Canonical runtime
ownership resolved to T1/T2 (profile/apply/HUD) plus T30 (`packages/materials`);
the original T6 ownership line below is retained as prompt provenance only.

**Session type:** local Claude Code (filesystem write access)
**Owning thread:** T6 (landscape profiles) presentation machinery; cross-links T1 (profile pattern)
**Design source:** web session reference-match against two concept images (urban-edge dusk; open-hardscape fog)

---

## Prime directive: verify, do not assume

This prompt was written in a web session **without filesystem access**. Every package name, path, seam, and convention below is a *claim to be checked against the actual tree*, not a fact to build on. Where this prompt names something (`@culture/...`, a plugin class, a profile directory), treat it as **"the web session believes this exists — confirm before use."**

If any named target does not exist, does not match the tree's convention, or conflicts with an existing pattern: **stop and report the discrepancy. Do not invent a plausible substitute. Do not create a new package or path to make the prompt fit.** The tree is authoritative over this document in every case.

---

## Phase 0 — audit gate (no files created or modified)

Complete every item and write findings to the session log before any implementation. If any item can't be resolved from the tree, surface it as a blocking question.

**0.1 — Namespace + seam confirmation.**
- Confirm the cross-game scope prefix actually in use (prompt assumes `@culture/*`). Report the real prefix if different.
- Locate where scene-fog / material-plugin rendering machinery lives today. The prompt assumes cross-game render machinery rides an **existing engine render seam** under the shared scope rather than a new package (per the prior Lineglass decision: rendering rides the existing seam, not a fresh sibling package). Confirm:
  - Is there a named render/engine package under the shared scope? Report its exact package name and path.
  - Or is fog currently configured inline per-scene / per-profile with no plugin layer yet? Report which.
- **Do not create a new package.** If no suitable home exists, stop and report — package creation is a separate deliberate decision (see conflict rules), not part of this session.

**0.2 — Existing fog implementation.**
- Find how fog is currently applied. Report: is it Babylon stock `scene.fogMode` (LINEAR/EXP/EXP2), a custom plugin, or profile-driven config?
- The prompt's `HazeBandFog` claims to sit alongside/extend EXP2 base extinction. Confirm the current fog mode and whether a `MaterialPluginBase` extension is already present or would be net-new.
- Confirm `FoliageSwayPlugin` exists and note its integration pattern — the prompt claims `HazeBandFog` should follow the same `MaterialPluginBase` + thin-instance-compatible pattern. If `FoliageSwayPlugin` uses a different integration approach than assumed, follow the tree's actual pattern.

**0.3 — Profile schema.**
- Locate the `EnvironmentProfile` type definition and `applyProfile()` (or equivalently-named) code path. Report exact path and the current shape of the fog-related and any emissive/lighting-related fields.
- Confirm whether profiles carry a `grade` / color-curve block today, and whether grading uses `ColorCurves`, a LUT, or the `DefaultRenderingPipeline` image-processing stack. The prompt assumes `ColorCurves`. Report actual.
- Confirm where Dissonance-app-scoped profile *data* lives (the prompt assumes an app-scoped location distinct from the shared machinery). Report the exact directory.

**0.4 — Emissive vocabulary.**
- Report whether an emissive-quad / emissive-dot material already exists (the prompt claims prior art: `EmissiveDotMaterial`, emissive window dots on the urban-edge profile). If it exists, this session **extends** it — do not author a parallel one.
- Confirm the bloom / post stack in use (prompt assumes `DefaultRenderingPipeline` bloom). Report the threshold/intensity config path, since emissive `intensity` values must drive that existing bloom, not a new one.

**0.5 — Naming + convention scan.**
- Report the tree's conventions for: profile `id` strings, profile file naming, hex-color vs. `Color3` representation in profile data, and constant-naming style. The prompt's example values use hex strings and kebab-case ids — conform to the tree if it differs.
- Confirm the single-writer status of any package you'd touch (conflict rule 4-style ownership). If the render seam is currently owned by an in-flight thread, stop and report the collision.

**Phase 0 output:** a short findings block listing, for each of 0.1–0.5, either the confirmed real target or a blocking discrepancy. Do not proceed to Phase 1 with any 0.x unresolved.

---

## Phase 1 — shader machinery spike (shared scope)

Only after Phase 0 confirms the real seam and the real fog/emissive state.

**Scope:** two pieces of cross-game render machinery, placed at the seam Phase 0 confirmed (NOT at the assumed `@culture/render` unless 0.1 confirmed that exact name).

### 1a. HazeBandFog
Depth-quantized inscattering tint layered on the existing EXP2 (or tree-actual) base extinction. Produces discrete tonal depth bands with soft seams, rather than a smooth single gradient.

- **Band count: fixed at 4.** Unrolled in the fragment path — no dynamic loop, no uniform band-count. This is a deliberate performance decision (fixed-4 unrolls to straight-line GLSL; a variable-length loop is a known GPU stall pattern for a per-fragment full-screen effect). Interiors needing fewer bands collapse two adjacent bands to near-identical values rather than changing the count.
- Params consumed from profile data (final field names must match the schema Phase 0 reported):
  - `extinctionDensity : float` — base EXP2 density
  - `bands : [4]` of `{ depth: float(0..1), color: <tree's color repr>, inscatter: float(0..1) }`, ordered near→far
  - `bandSoftness : float` — seam lerp width (~0.05–0.2)
  - `heightFalloff : float` — ground-pooling vs. uniform
- Integration: follow `FoliageSwayPlugin`'s actual `MaterialPluginBase` pattern (per 0.2). Must remain thin-instance compatible.

### 1b. EmissiveDotMaterial
One emissive-quad material, parameterized. If prior art exists (0.4), **extend it** to carry these params rather than authoring new.

- Params:
  - `color : <tree repr>`
  - `intensity : float` — must drive the existing bloom (0.4), not a new pass
  - `bloomThreshold : float` — shared with the confirmed post stack
  - `flicker : { amp: float, hz: float, seed: int }` — `amp: 0` = dead-steady
  - `occupancyMask : ref | null` — UV-scroll silhouette slot for the future window-figure layer (T6.2). **Wire the slot as nullable now; do not implement the mask feature this session.** It must accept `null` and be a clean seam so the crossing-figure feature drops in later with no shader rewrite.

### Composition-order validation (mandatory before Phase 1 is "done")
- Confirm `HazeBandFog` inscattering composites **before** the bloom pass, or the four haze tiers bloom-bleed into each other.
- Confirm the profile `grade` (color curves) runs **post-fog**, so grading is authored against the fogged frame, not the raw scene. Note this ordering in the code where it matters.
- **Validation artifact:** a depth-ramp test plane rendered under a 4-band config, visually confirming four distinct bands with soft (not hard-edged) seams. Include it as a throwaway scene/route, not committed content.

### Phase 1 explicitly out of scope
- The window-occupancy silhouette feature (only the null slot).
- Any agent/moving-light emissive (drone beacon — see Phase 2 note).
- Any change to `applyProfile()` beyond what's needed to pass the new params through. If the schema needs a field the current `EnvironmentProfile` lacks, **stop** — schema changes to `EnvironmentProfile` are a dedicated single-session change per the interiors/schema conflict rule, not a rider on this session. Report the needed field and halt.

---

## Phase 2 — Dissonance profile data (app-scoped)

Only after Phase 1 machinery works and Phase 0 confirmed the app-scoped data location.

Two authored profiles as **data files in the Dissonance app scope** (0.3), consuming the Phase 1 machinery. Values below are the web session's reference-match starting point — tune against the actual render, and translate hex/kebab to the tree's conventions (0.5).

### Profile A — urban-edge-dusk
```
id: urban-edge-dusk
biome: urban-edge
weather: dusk-clear          # sibling to the baseline urban-edge-overcast

fog:
  extinctionDensity: 0.018
  bands:                     # 4, near→far
    - { depth: 0.0, color: "#1a1c22", inscatter: 0.0  }
    - { depth: 0.3, color: "#3d3540", inscatter: 0.45 }
    - { depth: 0.6, color: "#8a4a52", inscatter: 0.8  }
    - { depth: 1.0, color: "#c86b5a", inscatter: 1.0  }
  bandSoftness: 0.12
  heightFalloff: 0.3

grade:                       # color curves, NOT LUT — dusk is a time variant
  globalSaturation: 0.7
  shadowsHue: 250            # crush cool/blue
  shadowsDensity: 0.6
  highlightsHue: 20          # sodium warmth in the glow only
  redChannelGain: 1.0        # un-starved variant (see note below)

emissive:
  windows: { color: "#e8a870", intensity: 2.2, flicker: {amp:0, hz:0}, occupancyMask: null }

verticals: catenary-wires
```

### Profile B — open-hardscape-fog
```
id: open-hardscape-fog
biome: urban-edge            # parking-lot sub-read (T6.6 family)
weather: fog-dense

fog:
  extinctionDensity: 0.045   # silhouettes barely resolve
  bands:
    - { depth: 0.0,  color: "#4a4d50", inscatter: 0.0  }
    - { depth: 0.4,  color: "#6b6e72", inscatter: 0.5  }
    - { depth: 0.75, color: "#8f9296", inscatter: 0.85 }
    - { depth: 1.0,  color: "#a9acb0", inscatter: 1.0  }
  bandSoftness: 0.18
  heightFalloff: 0.75        # strong ground pooling

grade:
  globalSaturation: 0.25     # near-monochrome
  shadowsHue: 220
  shadowsDensity: 0.35       # lifted — fog kills contrast
  highlightsHue: 30
  redChannelGain: 0.85       # starved-red baseline

emissive:
  streetLamps: { color: "#c89050", intensity: 1.4, flicker: {amp:0, hz:0}, occupancyMask: null }
  # NO drone beacon here — a moving agent light belongs to the agent's own profile,
  # not the environment. Confirmed design decision. Do not add it to this profile.

verticals: light-standards
```

### Profile-data notes
- **A and B are NOT interpolatable.** `redChannelGain` differs (1.0 vs 0.85) — they're different weather states, not a time-of-day lerp pair. Do not build a crossfade between them.
- Field names above are illustrative — conform to the schema Phase 0 (0.3) reported. If the schema has no `grade` block, that's a schema-extension question → stop and report (do not add it as part of this session).

---

## Acceptance criteria
1. Phase 0 findings block committed to session log; no 0.x left unresolved.
2. `HazeBandFog` (fixed-4) and `EmissiveDotMaterial` live at the **tree-confirmed** seam, not an assumed path; thin-instance compatible; following the real `FoliageSwayPlugin` integration pattern.
3. Depth-ramp validation shows 4 soft-seamed bands; inscattering confirmed pre-bloom; grade confirmed post-fog.
4. `occupancyMask` accepts `null` and is a clean seam; mask feature NOT implemented.
5. Both profiles load as app-scoped data, render close to the reference intent, and use tree-native conventions for id/color/naming.
6. No new package created; no `EnvironmentProfile` schema change smuggled in; no drone beacon in the environment profile.

## Halt-and-report conditions (do not work around)
- Assumed package/seam/path doesn't exist or misnames the convention.
- Emissive or grade prior art exists in a form the prompt didn't anticipate.
- A needed field is missing from `EnvironmentProfile` (schema change = separate session).
- The render seam is owned by an in-flight thread (single-writer collision).
- Anything in this prompt contradicts the tree. The tree wins; report the contradiction.
