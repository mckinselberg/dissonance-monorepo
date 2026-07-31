# Environment presentation profile seam

This slice resolves the audit gate in
`plans/haze-fog-emissive-prompt-v1.md` without prematurely adding its shader.

## Confirmed architecture

- Namespace: `@dissonance/*`.
- The current World environment profile remains app-owned under
  `apps/world/src/state`; DTA's frozen `ExperienceProfile` path is untouched.
- Babylon EXP2 fog is the baseline. `applyEnvironmentRenderingProfile()` is
  now the single application seam for scene fog, color curves, and bloom.
- Fixed-four haze bands and emissive presentation values are validated profile
  data. The application seam returns them to future material consumers.
- `redChannelGain` is retained explicitly but is not marked as applied:
  Babylon `ColorCurves` does not expose per-channel gain. A later shader or
  grading pass must consume it.

## Profiles

The registry contains `forest-default`, `urban-edge-dusk`, and
`open-hardscape-fog`. Profile IDs use kebab case and colors use six-digit hex
strings. The two concept profiles are discrete weather/presentation states;
they are not interpolated.

Selecting a profile from Dev Lineglass applies its fog, grading, and bloom and
persists the profile ID. Subsequent direct fog edits are runtime overrides and
remain in the existing settings snapshot path.

## Deferred consumers

- `HazeBandFog`: fixed-four thin-instance-compatible shader.
- Emissive adapters for windows and street lamps.
- Red-channel gain.
- Depth-ramp visual validation route.

Those consumers should extend this schema and application result rather than
introducing another profile or post-processing path.
