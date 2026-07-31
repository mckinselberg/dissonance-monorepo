# Instanced material pipeline — named constants inventory

First-pass implementation of `instanced-material-pipeline-prompt-v1.md`.
Package: `packages/materials` (`@dissonance/materials`). Demo app:
`apps/materials-demo` (dev-only, not deployed).

## Bake-time constants (authoring, not shipped code)

| Constant | Value | Home file | Notes |
|---|---|---|---|
| `TARGET_RESOLUTION` | 512 | `packages/materials/scripts/bake-swatches.mjs`, `bake-emissive.mjs` | Matches the existing `apps/world/public/textures` convention (512 default, 1024 hero-tier — not used here). |
| `SEAM_FEATHER_PX` | 18 (leather), 8 (emissive default), 3 (signal-palette override) | same two bake scripts | Width of the blurred band hiding the offset-heal center seam. Tuned per-asset — see "known tradeoffs" below. |
| `NORMAL_STRENGTH` | 2.0 | `bake-swatches.mjs` | Sobel gradient multiplier in `heightToNormal`. Eyeballed against the one swatch baked; not derived from a measured relief depth. |
| `ROUGHNESS_MIN` / `ROUGHNESS_MAX` | 140 / 230 (~0.55–0.90 encoded) | `bake-swatches.mjs` | Levels remap of greyscale albedo into a plausible worn-leather roughness range. Derived/approximate, not authored or measured — flagged in deliverable #1. |
| `SEAM_BLUR_DIVISOR` | 10 | `bake-emissive.mjs` | Lower blur-sigma-per-feather-px than the leather bake's default (3) — high-contrast graphic content turns a normal blur into a flat gray stripe; see the offset-heal tradeoff note below. |
| `TILE_TEST_REPS` | 3 | both bake scripts | The 3×3 acceptance-criteria render. |

**Should any of these become profile/config parameters?** Flagging per the
doc's deliverable #4, not deciding: right now they're script-local
constants because there's exactly one swatch family and two emissive
patterns. If a second swatch family gets baked, `ROUGHNESS_MIN`/`MAX` and
`NORMAL_STRENGTH` should probably move into a per-material-family config
object rather than staying as shared script constants — deferred until
that second consumer is real (extend-don't-rewrite).

## Runtime constants (shipped in `packages/materials/src`)

| Constant | Value | Home file | Notes |
|---|---|---|---|
| `DEFAULT_SCATTER_VARIATION_PROFILE.hueShift` | [-0.03, 0.03] | `ScatterVariationProfile.ts` | Hue-turn fraction. **This is the one genuinely "data, not hardcoded" deliverable** — round-trips through `setScatterVariationBuffer(mesh, count, profile, seed)`, editable without touching the plugin or recompiling the material. |
| `DEFAULT_SCATTER_VARIATION_PROFILE.valueJitter` | [-0.12, 0.12] | `ScatterVariationProfile.ts` | Multiplicative brightness jitter. Kept conservative — the leather swatch is near-black, wide jitter clips to solid black/white rather than reading as varied. |
| `EmissiveDataPatternMaterial` defaults: `scrollSpeedU` 0, `scrollSpeedV` 0.35, `intensity` 1.5 | — | `EmissiveDataPatternMaterial.ts` | Constructor-overridable per instance (see `apps/materials-demo/src/main.ts` for both demo planes using different overrides). Not yet tied to any device state machine, per the doc's explicit scope boundary. |

**Flagged for Dan's sign-off (open decision #2, atlas vs. single-tile):**
this pass ships single-tile-plus-variation only — no `atlasIndex` field
exists in the per-instance buffer. Only one swatch family was baked, so an
atlas has no second tile to index yet; adding an unused field now would be
building for a hypothetical. If/when a second swatch family lands, decide
atlas-vs-more-materials then.

## Where things live, for the next session

- `packages/materials/src/` — shipped code (`ScatterVariationMaterialPlugin`,
  `createScatterMaterial`, `EmissiveDataPatternMaterial`, the profile type).
- `packages/materials/scripts/` — authoring-time bake scripts + `lib/tile-utils.mjs`
  (offset-heal tiling, Sobel normal derivation). Not part of the shipped
  barrel; run via `pnpm bake` / `pnpm bake:emissive`. Needs `packages/materials/.env`
  (copy from `.env.example`) pointing `REF_DIR` at wherever the raw
  reference-art crops live locally — machine-specific, gitignored.
- `apps/materials-demo/` — the acceptance-criteria demo app (144 thin
  instances + two emissive planes), dev-only, not in `render.yaml`.
- `apps/world/public/textures/echo17-*/` — the three baked texture sets,
  each with an `ASSET-LICENSE.txt` adapted from the existing Poly-Haven-CC0
  convention to flag AI-generated-art provenance instead (see those files
  for the full licensing caveat — not independently verified this session).

## Known tradeoffs (not silently papered over)

- **Seamless tiling uses "offset and heal" (quadrant swap + blurred center
  seam), not a real content-aware seamless-texture tool** — none was
  available in this environment. A quad-mirror approach was tried first and
  rejected on inspection (obvious kaleidoscope/diamond artifact). The
  shipped result has a faint seam visible on close inspection; acceptable
  for a first pass, not indistinguishable from a fully healed capture.
- **Only one of the doc's five named swatch families got baked**
  (a worn-leather/tooled-leather patch, standing in for "frayed
  fabric"/"charcoal weave"). Rust, cracked plastic, and duct-tape/wrap were
  skipped — the only source material for them was ~65×65px thumbnails in
  the reference sheet's own material-legend, too low-res to bake honestly.
- **`ScatterVariationMaterialPlugin`'s fragment injection point
  (`CUSTOM_FRAGMENT_UPDATE_ALBEDO`) was unverified until this session's live
  browser check** (`apps/materials-demo`, 144 instances, confirmed rendering
  with visible per-instance variation, no shader compile errors, 60fps).
  Verified now — not still an open risk.
