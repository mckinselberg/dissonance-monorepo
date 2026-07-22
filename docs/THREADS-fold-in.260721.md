> **Status (2026-07-22): landed, kept for historical reference only.** This delta's content is folded into THREADS.md's T22 (not T8 — T8 is retired/merged into T17, and this content's own "T8" framing below predates that reconciliation, see THREADS.md v9.20/v9.22). The hero/scatter tree POC described here has since shipped in code and gone further than this doc specifies (real Poly Haven `.glb` assets, not just one validation tree) — see `apps/trail-viewer/src/world/HeroTreeInstances.ts`, which cites this file by name in its own header comment. That source-code reference is the reason this file is still in the repo rather than deleted now that its content is landed; do not treat anything below as a live pending task.

## THREADS.md delta — fold into T8 (Rigging + 3D art pipeline)

Insert into **T8** scope, after the existing target list ("mech dog ... T4).") —
add as a new paragraph:

---

**Added scope — hero/scatter tree authoring tier (trail-adjacent detail need):**
Trail-adjacent trees (0–30m hero zone, FPPOV under canopy) need more detail than
deep-stand scatter trees — same trunk-geometry-plus-alpha-cutout-leaf-card method
as scatter trees, just authored at higher density with two additions: (1) bent
normals via Blender Data Transfer modifier, copying normals from a canopy-hull
proxy onto the leaf cards so the canopy lights as one soft volume instead of
noisy per-quad shading; (2) interior card fill on hero trees only — FPPOV walks
under/through canopy constantly, and hollow-shell trees (cards facing outward,
empty interior) are visibly wrong from below. Scatter-tier trees derive from the
hero template by decimating cards and dropping interior fill — one authoring
template, two output tiers, not two separate pipelines. No renderer change:
confirmed compatible with existing thin instancing, three-zone LOD, and
`FoliageSwayPlugin`. Alpha cutout only, never alpha blend (sorting).

**POC step before original authoring:** source ONE reference tree (Poly Haven,
CC0 — closest existing implementation of the bent-normal + card technique) to
validate the Blender→glb→Babylon round-trip and surface gotchas (does bent-normal
data survive export/import intact? does the sourced asset expose the
hollow-interior problem as expected?) before Dan builds an original hero-tree
template. Owning doc: `hero-tree-poc-prompt-v1.md`. Quaternius CC0 lowpoly tree
pack usable as cheap scatter-tier filler in trail-viewer in the meantime — not a
technique reference, just placeholder density.

---

## Revision note (append to the revision history line)

Add to the _Revision_ line at the bottom of THREADS.md:

`; T8 hero/scatter tree authoring tier added (bent-normal leaf cards, interior
fill for hero-tier, POC sourcing step via Poly Haven/Quaternius before original
authoring)`
