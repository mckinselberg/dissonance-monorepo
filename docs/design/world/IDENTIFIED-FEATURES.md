# Identified World Features

**Status:** queued  
**Owning thread:** T26  
**Canonical scope:** Stable identity for landmarks, interactables, navigation targets, and lore-bearing world features  
**Does not own:** Anonymous scatter, cell LOD, or atmosphere zones  
**Runtime owner:** `apps/world` + geographic data loaders `VERIFY`  
**State owner:** stable feature IDs referenced by World save  
**Presentation owner:** Babylon props, navigation, Lineglass  
**Depends on:** T21 geographic coordinates and D41 placement architecture  
**Consumed by:** T29 docking, T28 landmarks, saves, replication  
**Decisions:** D41  
**Open questions:** none yet  
**Last reviewed:** 2026-07-31

Identified features are a sparse overlay, not a replacement for runtime scatter.
Each feature has a stable ID, authoritative WGS84 position or stable reference, and
tags. Render position is derived rather than stored as a second editable truth.
Raw instance-array indices are not identities.

