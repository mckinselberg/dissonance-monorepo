# Regions and Atmosphere Composition

**Status:** active/provisional  
**Owning thread:** T23 / T25 / T27  
**Canonical scope:** Region selection, clock interpolation, detection overlay, and spatial atmosphere zones  
**Does not own:** Scatter placement or authoritative spatial deformation  
**Runtime owner:** World atmosphere/profile seam `VERIFY`  
**State owner:** authored profiles and current runtime blend state  
**Presentation owner:** Babylon fog/post stack + Tone.js consumers  
**Depends on:** T1 profile pattern and existing time/weather state  
**Consumed by:** T5 reactive environment, Boulevard, DTA migration  
**Decisions:** D41, D47<br>
**Open questions:** O9<br>
**Last reviewed:** 2026-08-03

The manually selectable environment-presentation runtime is landed: fixed-four
haze and red gain live in `@dissonance/materials`; World owns live window/lamp
emissive adapters, validation, grade/bloom parity, and profile selection. Saved
views reference `environmentProfileId` rather than copying the recipe. Live
depth-ramp/reference tuning remains outstanding.

The larger composition problem remains provisional. One seam must serve region,
clock, detection, and spatial-zone inputs. The current proposal is a
region-selected profile family, clock-interpolated base, then detection overlay
with named weights. Per D47, spatial distortion is always perceptual: canonical
geometry, collision, navigation, interaction, saves, and multiplayer state do
not deform. O9 must still be resolved before the composition seam becomes a
canonical API.
