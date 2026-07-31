# Milo's Apartment Archaeology Room

**Status:** queued  
**Owning thread:** T37  
**Canonical scope:** Photogrammetry-derived apartment, archaeology interaction, room transition, preservation treatment, and production pipeline  
**Does not own:** Wider underground workshop, generic photogrammetry tooling, or the global isometric rule  
**Runtime owner:** `apps/world` `VERIFY`  
**State owner:** World save location/archaeology progress `TBD`  
**Presentation owner:** Babylon room, contextual UI, and camera transition  
**Depends on:** existing `milos-building`, World save, O4 camera pilot, validated Blender export  
**Consumed by:** Milo narrative, Boulevard, archaeology progression  
**Decisions:** D45  
**Open questions:** O4  
**Last reviewed:** 2026-07-31

The room is entered from the existing `milos-building` placement in World. It is
not a separate app. The preserved capture is the visual/spatial foundation and
must be processed from its source GLB rather than reconstructed from screenshots.

Outstanding work is deliberately split: validate the automated Blender preparation
script; perform the human semantic cleanup and art-direction pass; then implement
the room, interaction/state model, camera pilot, and browser validation. Existing
procedural building stairs and the underground workshop are adjacent prior art,
not evidence that this room is implemented.

