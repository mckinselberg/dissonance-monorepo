# Environment presentation profile runtime

This document records the tree-native resolution of
`archive/prompts/completed/haze-fog-emissive-prompt-v1.md`.

## Confirmed architecture

- Namespace: `@dissonance/*`.
- The current World environment profile remains app-owned under
  `apps/world/src/state`; DTA's frozen `ExperienceProfile` path is untouched.
- Babylon EXP2 fog remains the baseline. `applyEnvironmentRenderingProfile()`
  is the single application seam for scene fog, color curves, bloom, fixed-four
  haze, red-channel gain, and named emissive presentations.
- `HazeBandFogMaterialPlugin` lives in `@dissonance/materials`. Its scene
  controller attaches to current and asynchronously added PBR/Standard
  materials, uses four explicitly unrolled bands, samples live EXP2 density,
  and requires no thin-instance attribute.
- World owns the app-local material-name adapters for `windows` and
  `streetLamps`. They update existing and late-loaded materials, restore
  authored baselines when a profile has no matching group, and support seeded
  flicker. `occupancyMask: null` remains a clean data seam, not an implemented
  silhouette feature.
- Babylon exposes bloom threshold globally rather than per emitter. The
  profile bloom block owns the live threshold; the matching value carried by
  each emissive presentation remains descriptive/validated data.

## Profiles

The registry contains `forest-default`, `urban-edge-dusk`, and
`open-hardscape-fog`. Profile IDs use kebab case and colors use six-digit hex
strings. The two concept profiles are discrete weather/presentation states;
they are not interpolated.

Selecting a profile from Dev Lineglass applies its fog, grading, and bloom and
persists the profile ID. It now also updates haze and existing/future
window/lamp materials without rebuilding the world. Subsequent direct fog
or window-tint/glow edits are runtime overrides and remain in the existing
settings snapshot path.

This is an environment profile, not a saved view. A saved view may reference
`environmentProfileId` alongside a camera/session snapshot, but it does not own
or duplicate haze bands, grading, bloom, or emissive recipes.

## Validation and deferred tuning

- World and `@dissonance/materials` TypeScript checks pass.
- Focused runtime tests cover exact-four validation, existing/late-loaded
  window and lamp materials, baseline restoration, and deterministic flicker.
- The production World build passes.
- A live depth-ramp/reference-match pass remains required before calling the
  authored values visually tuned. The implementation is landed; visual tuning
  is not signed off in this session because the in-app browser was unavailable.
- Occupancy silhouettes, automatic region/clock/detection selection and
  interpolation, and a moving drone beacon remain outside this slice.

Future consumers must extend this profile/application seam rather than
introducing another profile, saved-view recipe, or post-processing path.
