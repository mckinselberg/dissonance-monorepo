# Regions and Atmosphere Composition

**Status:** provisional  
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

One composition seam must serve region, clock, detection, and spatial zone inputs.
The current proposal is region-selected profile family, clock-interpolated base,
then detection overlay with named weights. Spatial zones initially alter perceptual
atmosphere only. O9 and O12 must be resolved before the seam becomes canonical API.

