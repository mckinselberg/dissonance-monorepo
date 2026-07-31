# DTA Environment Migration to World

**Status:** blocked  
**Owning thread:** T23  
**Canonical scope:** Moving DTA gameplay onto the World geographic/environment foundation  
**Does not own:** New development inside the museum DTA exhibit  
**Runtime owner:** `apps/world` `VERIFY`  
**State owner:** environment profiles and World save `TBD`  
**Presentation owner:** Babylon world and atmosphere  
**Depends on:** T1/T2 profile seam, T23 regions, T25 atmosphere  
**Consumed by:** future DTA gameplay in the living world  
**Decisions:** D42  
**Open questions:** O9, O22  
**Last reviewed:** 2026-07-31

The migration target is World. The old DTA terrain and forest architecture is a
museum reference and should not receive a parallel copy of World's DEM, scale,
forest-tier, and atmosphere systems.

The completed audit shows that the selected environment snapshot cannot be mapped
field-for-field. The next gate is O22: define a canonical EnvironmentProfile using
existing conventions, preferably alongside the T25/T27 composition seam. Only then
should the selected view become an authored validation profile and DTA gameplay be
moved onto it.

