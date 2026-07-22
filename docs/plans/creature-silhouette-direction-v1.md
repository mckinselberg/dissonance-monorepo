# Creature Silhouette Direction — v1 (engineering notes)

Feeds: **T8** (asset pipeline — primary), **T4** (embodiment/motion), **T7** (ambient life).
Source: web session, crystal-construct concept art review. Crystal material rejected; low-poly silhouette language retained.

---

## 1. Design principles (proposed for freeze)

- **P-A. Silhouette carries identity; surface carries nothing.** Creatures are authored to read as outline against background at range/dim light. Interior detail budget ≈ zero.
- **P-B. Uncanny = recognition/geometry gap.** Instantly recognizable animal profile + hard-plane faceted geometry. Do not add monster features; wrongness comes from the mismatch, not the design.
- **P-C. Environment contrast is the amplifier.** Faceted creatures against naturalistic terrain/foliage produce a material contradiction. Do NOT drift the environment toward stylized low-poly — the effect depends on the environment staying organic.
- **P-D. Motion is the wrongness dial.** Silhouette says *what*; motion says *how wrong*. Watchers: unnatural stillness. Pursuers: too-fluid for their geometry. Ambient animals: correct, natural motion (the control group that makes the others read).

## 2. Blender authoring rules

- **Poly budgets:** ambient animals 300–800 tris; watcher/hero creatures 1.5–3k tris. Hard ceiling, not target — go lower if the silhouette holds.
- **Flat shading only.** Split normals per face / no autosmooth. This is the *opposite* of the T8 foliage pipeline — no Data Transfer normal baking on creatures. Two normal disciplines, one pipeline; note it in the export checklist so habits don't cross-contaminate.
- **Model to side and three-quarter profile first.** Validate every creature as a black shape on a mid-grey background before any material work.
- **One exaggerated identifying shape per creature**, pushed past realistic proportion (ears, tail, posture, head-drop). Name it in the asset's README line — it's the design decision the model hangs on.
- **No textures.** Single flat material or vertex color. UV unwrap optional.
- **Export:** standard Blender → glTF `.glb` path; `AnimationGroup` clip naming per T4 loud-validation rule.

## 3. Runtime rendering

- **Material default (needs sign-off, see D1):** near-black matte with low, uniform specular — enough that flat faces catch the carry light as discrete planes, not a gradient. Warm-light ownership rules hold: facets flaring under carry light is consistent (carry light + interactables own warm), and doubles as free proximity feedback.
- **No shader plugin required.** The parked iridescence idea (`MaterialPluginBase` + vertex-color facet mask, sibling to `FoliageSwayPlugin`) stays parked; document only.
- **LOD:** silhouette-first makes the billboard tier nearly lossless — a dark silhouette card *is* the intended distant read. Ambient static poses (birds on wire) are thin-instance candidates; skeletal creatures are individually budgeted meshes.

## 4. Motion / embodiment direction (T4)

- Wrongness should live as **data where possible**: playback-rate curves, interpolation smoothing, and hold durations as `EmbodimentProfile` params, before reaching for bespoke clips.
- Watcher stillness = literal clip hold + micro head-tracking; connects to FaunaSystem REGARD.
- Pursuer over-fluidity candidates: elevated interpolation smoothing, no gait noise, zero settle frames on stops.
- Ambient animals use unmodified natural clips — they are the baseline that makes deviation legible.

## 5. Decisions needing sign-off

- **D1.** Creature surface default: matte-dark with uniform low spec (proposed) vs. fully matte (no light response) — affects whether carry light produces facet-flare feedback.
- **D2.** Motion wrongness as profile params (proposed) vs. authored per-creature clips — cost/expressiveness tradeoff; can hybridize later.
- **D3.** Doc home: fold into T8 as an addendum, or keep standalone with T8 pointer.

---

## THREADS.md delta (paste-ready)

> **T8 addendum — creature silhouette direction (v1):** Crystal-construct material rejected; low-poly silhouette language canon-direction. Silhouette-first authoring (side/¾ validation as black shape), flat shading (no normal transfer — creatures diverge from foliage normal discipline), 300–800 tri ambient / 1.5–3k hero budgets, one exaggerated identifying shape per creature, no textures. Motion = wrongness dial (watchers still, pursuers over-fluid, ambient animals natural baseline) → params in `EmbodimentProfile` where possible (T4). Billboard LOD ≈ lossless for silhouette creatures. Owning doc: `creature-silhouette-direction-v1.md`. Open: D1 surface spec, D2 motion-as-data, D3 doc home.
