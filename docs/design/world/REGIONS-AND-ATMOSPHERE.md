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
**Decisions:** D41  
**Open questions:** O9, O12  
**Last reviewed:** 2026-07-31

The manually selectable environment-presentation runtime is landed: fixed-four
haze and red gain live in `@dissonance/materials`; World owns live window/lamp
emissive adapters, validation, grade/bloom parity, and profile selection. Saved
views reference `environmentProfileId` rather than copying the recipe. Live
depth-ramp/reference tuning remains outstanding.

Environment selection now passes through a source-aware controller. Sources are
`default`, `session-seed`, `location`, `narrative`, and `manual`; explicit manual
selection has highest precedence for authoring, while clearing it reveals the
highest remaining automatic source. An empty level-1 settings slot seeds from the
curated `dissonance boulevard concept art 4 nighttime` view and records provenance
in session storage. Developers may intentionally reseed once with
`?seedView=<committed view name>`; the query parameter removes itself after a
successful seed. Existing local settings are otherwise never overwritten.

The larger composition problem remains provisional. One seam must serve region,
clock, detection, and spatial-zone inputs. The current proposal is a
region-selected profile family, clock-interpolated base, then detection overlay
with named weights. Spatial zones initially alter perceptual atmosphere only. O9
and O12 must be resolved before that seam becomes canonical API.
