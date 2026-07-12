# Dissonance — Forest Color & Light Pass (Handoff Prompt)

## Context for local Claude

You have access to the Dissonance codebase (BabylonJS + TypeScript, turborepo monorepo). The current forest scene uses procedural flat-color geometry with aggressive thin-instancing, EXP fog, SSAO2, and a `DefaultRenderingPipeline` post stack. This task is a **look-dev pass**: bring the daytime forest toward the reference described below without restructuring existing systems. Extend, don't rewrite.

**Reference look (from a photo of South Mountain Reservation, overcast summer day):** dense deciduous forest, no direct sun. Multiple distinct green families (yellow-green canopy, cool blue-green moss carpet, mid understory), desaturated brown leaf litter as the neutral base, and rare saturated rust-orange accents (rotting logs) as complementary hero elements. Lifted shadows, compressed dynamic range, everything luminous — a "phone HDR" quality that reads as lush and slightly hyperreal.

## Goals

1. Palette system with hue-family jitter per thin instance
2. Overcast bounce lighting rig
3. Grading pass via the existing pipeline
4. Fog retint to grey-green

All values below are **starting points** — expose them via whatever debug/tweak mechanism the project already uses so Dan can iterate visually.

---

## 1. Palette system

Define a palette module (suggested: alongside existing procedural geometry config) with named hue families. Colors in linear space if materials expect linear; values below are sRGB hex for readability.

| Family | Base color | Hue jitter | Sat jitter | Value jitter | Applies to |
|---|---|---|---|---|---|
| Canopy green (warm) | `#7CA344` | ±8° | ±10% | ±12% | tree foliage, upper leaf cards |
| Moss green (cool) | `#5E9B5A` → lean teal `#4E8F63` | ±6° | ±8% | ±10% | ground moss carpet patches |
| Understory green (mid) | `#6A9450` | ±10° | ±10% | ±15% | shrubs, saplings, ferns |
| Leaf litter (neutral) | `#8A7358` | ±5° | −20–40% sat overall | ±10% | ground plane, scattered leaf clutter |
| Bark grey-brown | `#6E6A5F` | ±4° | low sat (≤20%) | ±12% | trunks |
| **Rust accent (hero)** | `#A6472A` with hot core `#C25B2E` | ±5° | keep high sat | ±10% | rotting logs, rare stumps |

Implementation notes:

- Jitter per **thin instance** via instance color buffer (`thinInstanceSetBuffer("color", ...)`) with material `useVertexColors`/instance color support — do NOT create per-instance materials.
- Jitter in **HSV/HSL space**, then convert. Hue jitter in RGB space looks muddy.
- Rust accents must be **scarce**: budget them (e.g., max 1 per ~30m radius, or hand-placed). Their impact comes from rarity + complementarity with green.
- Keep leaf litter clearly desaturated relative to the greens — it's the neutral that makes the greens pop.

## 2. Lighting rig (overcast bounce)

Replace/retune the current day lighting to:

- **DirectionalLight** (sky diffuse stand-in): intensity ~0.4–0.6, color near-white slightly cool `#EAF0EA`, steep-ish angle. Shadows either OFF or very soft (large blur kernel, low darkness ~0.3) — the reference has almost no hard shadows.
- **HemisphericLight** (the workhorse):
  - `diffuse` (sky): cool pale `#DDE8E4`, intensity ~0.7
  - `groundColor` (bounce): warm green-brown `#5C6B3F` — this green-contaminated upward bounce is the single most important value in the rig. It sells "under a canopy."
- Optional: very low-intensity ambient via `scene.ambientColor` only if materials use ambient; otherwise skip.

Target feel: no visible light "direction," shadows readable (nothing crushed to black), everything softly luminous.

## 3. Post-processing / grading (existing DefaultRenderingPipeline)

- `imageProcessing.toneMappingEnabled = true`, `toneMappingType = ACES`
- `imageProcessing.contrast ≈ 0.9` (slightly **below** 1 — lifted shadows)
- `imageProcessing.exposure ≈ 1.1–1.2`
- Saturation: +10–20%. Use `ColorCurves`: `globalSaturation ≈ 15`
- Shadow tint toward green-teal: `colorCurves.shadowsHue ≈ 150`, `shadowsSaturation ≈ 10–15`, `shadowsDensity` small positive. Keep highlights neutral.
- SSAO2: keep enabled; radius small enough that it reads as contact darkening in leaf litter / around log bases rather than a global dirt pass. If it's currently strong, reduce `totalStrength` to ~0.8–1.0.

## 4. Fog

- Keep EXP mode. Retint `scene.fogColor` from any blue toward **grey-green**: start `#9DB39A`.
- Density tuned so distance dissolves into "more forest," not sky. The far treeline in the reference is a soft green haze, not atmospheric blue.
- Fog color should sit tonally between canopy green and the hemispheric sky color so faded objects don't pop against either.

## Acceptance criteria

1. Screenshot at eye level in dense forest shows ≥3 visually distinct green families and a clearly desaturated ground neutral.
2. No pure-black areas in shadow; darkest readable value roughly matches lifted-shadow reference feel.
3. A rust-accent log placed in frame is the unambiguous focal point without any lighting tricks.
4. Distant trees fade to grey-green haze; no blue horizon contamination.
5. No new materials created per instance; instance count/perf characteristics unchanged.

## Decisions to surface to Dan (do not resolve unilaterally)

- Whether directional shadows stay on (soft) or off entirely for the overcast look
- Final rust-accent placement strategy: procedural budget vs. hand-placed
- Whether palette config lives in `packages/geo` adjacency or a new shared look-dev config
