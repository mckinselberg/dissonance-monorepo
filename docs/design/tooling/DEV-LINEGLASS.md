# Dev Lineglass

**Status:** provisional  
**Owning thread:** T1/T2  
**Canonical scope:** Developer-facing world inspection, tuning, authoring, and diagnostics UI  
**Does not own:** Player-facing Lineglass fiction, progression, or scan-layer behavior  
**Runtime owner:** `apps/world/src/ui` `VERIFY`  
**State owner:** Canonical runtime/profile state plus UI-only panel state  
**Presentation owner:** Preact developer overlay  
**Depends on:** Existing profile, settings, persistence, and command seams  
**Consumed by:** World-system authors and runtime debugging  
**Decisions:** none yet  
**Open questions:** O23  
**Last reviewed:** 2026-07-31

Dev Lineglass replaces the flat parameter sheet with a compact Inspect, Tune,
Author, and System interface. It must consume resolved state through adapters and
send intent through existing commands rather than directly mutating Babylon state.

The legacy redesign prompt is implementation input, not proof the redesign has
landed. Existing controls and the use of the “Dev Lineglass” name are prior art.
Before implementation, Phase 0 must inventory every control, persistence/export
path, and current command seam and decide O23. Migration ends by removing the old
HUD path; two permanent state/control paths are prohibited.

