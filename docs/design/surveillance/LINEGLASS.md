# Lineglass

**Status:** provisional  
**Owning thread:** T21 / T29  
**Canonical scope:** Player-facing inspection device, unlock progression, information layers, and reliability constraints  
**Does not own:** Developer HUD architecture or terminal dialogue/control  
**Runtime owner:** `apps/world` `VERIFY`  
**State owner:** World save Lineglass inventory/unlock state  
**Presentation owner:** Babylon device/render layers + Preact overlay  
**Depends on:** T21 geographic substrate, T26 stable features, T29 terminal boundary  
**Consumed by:** Boulevard investigation, T31 drone review/control, navigation  
**Decisions:** D44  
**Open questions:** O12, O19, O23  
**Last reviewed:** 2026-07-31

Lineglass makes otherwise hidden structural, signal, acoustic, historical,
biological, and geographic relationships perceptible. It is an unreliable
in-world instrument, not an omniscient minimap or a decorative post-process.

The landed first slice is deliberately narrow: three persistent parts unlock
Grid, GPX, and OSM visibility in that order. It does not establish the physical
device, the other five information layers, a package split, anomaly generation,
or live drone reception.

Future implementation must preserve canonical geographic identity, work offline,
degrade to grid plus authored landmarks, distinguish unavailable from unreliable
data, and never let diagnostic telemetry resolve intentional narrative ambiguity.

