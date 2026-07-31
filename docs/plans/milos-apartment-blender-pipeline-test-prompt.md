# Milo Apartment Blender Pipeline — Validation Prompt

Handoff prompt for a Claude Code session running on a machine with a working
Blender install. Scope is limited to proving the automated preparation script
(`prepare_milos_apartment.py`) runs cleanly and produces its outputs. The
manual art-direction pass in `milos-apartment-blender-handoff.md` is separate,
human, GUI work and is explicitly out of scope here.

```text
You're validating a Blender preparation pipeline for a photogrammetry capture in
the "dissonance-monorepo" project. Your job is ONLY to prove the automated script
runs cleanly against this machine's installed Blender and produces its outputs —
NOT to do the manual art-direction cleanup pass. Stop and report back before
touching anything creative.

## Background

The script imports a raw photogrammetry scan of "Milo's apartment" (two fused,
untextured-by-name meshes, no semantic segmentation), does conservative mechanical
cleanup, builds a placeholder low-poly room shell, creates a provisional artifact
anchor empty, renders four preview angles, and exports a Babylon.js-ready GLB. A
human then opens the resulting .blend in the Blender GUI to do real segmentation,
debris/decay authoring, and artifact placement — that part is out of scope for you.

## Inputs

Two files are needed:
- `prepare_milos_apartment.py` (the script)
- `milos-apartment-capture-original.glb` (source capture, ~4.3MB, 36,442 triangles)

First check whether this machine has a clone of the `dissonance-monorepo` repo. If
so, they live at:
  apps/world/scripts/blender/prepare_milos_apartment.py
  apps/world/public/models/milos-apartment/source/milos-apartment-capture-original.glb

If there's no repo clone, ask me (the user) where I copied these two files to
before proceeding — do not guess paths.

IMPORTANT: if a repo clone exists, `git log -1 -- apps/world/scripts/blender/prepare_milos_apartment.py`
and confirm you have the current version — it was recently patched to call
`bpy.context.view_layer.update()` before computing bounds (fixes stale bound_box
after bmesh mesh cleanup). If your copy predates that fix, pull latest or ask me
for the current file content before running it.

## What to do

1. Determine the installed Blender version (`blender --version` or locate the
   executable under Program Files / Applications, whichever OS this is).

2. Run it headless, substituting real absolute paths:

   Windows:
   & 'C:\Program Files\Blender Foundation\Blender <X.Y>\blender.exe' `
     --background `
     --python '<path>\prepare_milos_apartment.py' `
     -- `
     --input '<path>\milos-apartment-capture-original.glb' `
     --output-blend '<path>\milos-apartment-clean.blend' `
     --output-glb '<path>\milos-apartment-runtime.glb' `
     --preview-dir '<path>\previews'

   macOS/Linux: same args, invoking the Blender binary directly.

3. Capture full stdout/stderr. If Blender raises a Python traceback (e.g. a
   `TypeError` about an unexpected keyword on `bpy.ops.export_scene.gltf`, an
   invalid enum value for `scene.render.engine` or `scene.view_settings.look`, or
   a changed `bmesh.ops` signature), diagnose the exact API break for your
   installed version and patch the script minimally to fix that one
   compatibility issue — don't restructure its logic or behavior. Re-run until
   it completes with exit code 0.

4. Verify the outputs actually exist and are non-trivial:
   - `previews/milos-apartment-view-1.png` through `-4.png` (should be ~900x900,
     not blank/black — spot check at least one visually if you can render an
     image preview)
   - the `.blend` file
   - the runtime `.glb`

5. Open the `.blend` (or use `blender --background --python-expr` to script an
   inspection) and confirm:
   - two capture meshes named `APT_ARCH_CAPTURE_01` / `APT_ARCH_CAPTURE_02`
   - `APT_ARCH_FLOOR` and four `APT_OCCLUDER_*_WALL` objects exist
   - exactly one `ARTIFACT_ANCHOR_DegradedCassette` empty exists
   - no object outside the `APT_ARCH_*` / `APT_OCCLUDER_*` / `ARTIFACT_ANCHOR_*`
     naming contract

6. Report back to me with:
   - Blender version used and the exact command that finally succeeded
   - whether it worked on the first try, or what you had to patch and why (show
     the diff)
   - triangle/vertex counts and file sizes for the exported GLB
   - confirmation of the naming/anchor checks from step 5
   - any warnings Blender printed that seem worth flagging

## Explicitly do NOT

- Do not perform the manual segmentation, debris cleanup, wall/window cutting,
  cassette-anchor repositioning, or final rotation/scale/export described in
  docs/plans/milos-apartment-blender-handoff.md — that's a human art-direction
  pass against an approved reference image, done later in the Blender GUI.
- Do not copy outputs into the repo's `working/`/`runtime/` directories or make
  any git commits. Just tell me the local output paths and your findings so I
  can review them first.
- Do not modify the source GLB.
```
