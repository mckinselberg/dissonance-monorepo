# Creature Silhouette and Motion Direction

**Status:** provisional  
**Owning thread:** T4 / T17  
**Canonical scope:** Creature silhouette, surface, motion wrongness, and asset-authoring rules  
**Does not own:** Pursuer behavior, wildlife ecology, or foliage authoring  
**Runtime owner:** creature/pursuer presentation modules `VERIFY`  
**State owner:** resolved embodiment/profile data  
**Presentation owner:** Babylon meshes, materials, animation, and audio profiles  
**Depends on:** T4 profile schema and T17 asset pipeline  
**Consumed by:** pursuers, watchers, ambient fauna  
**Decisions:** none yet  
**Open questions:** O20, O21  
**Last reviewed:** 2026-07-31

Identity is carried by a recognizable animal silhouette with hard faceted geometry;
wrongness comes from the recognition/geometry mismatch and motion, not added monster
features. Creatures remain visually distinct from the naturalistic environment.

Authoring uses flat shading, split face normals, no normal-transfer baking, and
silhouette validation before materials. Ambient animals target 300–800 triangles;
hero/watchers target 1.5–3k, as ceilings rather than quotas. Motion values should be
profile data where practical, without pre-deciding O21 against authored clips.

