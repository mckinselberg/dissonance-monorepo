# Blender Prop Asset Workflow

Use this workflow for static authored props that arrive as `.blend`, GLB/glTF,
FBX, or OBJ files and need a browser-ready GLB. It keeps the original source
immutable, makes decimation an explicit visual choice, and prevents authoring
textures from being copied into production builds.

## Layout

```text
apps/world/assets/models/<asset>/
  source/       original download and textures; never loaded by the app
  working/      selected preview and optional prepared Blender file

apps/world/public/models/<asset>/
  ASSET-LICENSE.txt
  runtime/
    <asset>.glb
```

Record the source URL, author, license, preparation settings, source triangle
count, and runtime triangle count in `ASSET-LICENSE.txt`. Unknown licensing
must be recorded as unknown rather than inferred.

## Generate candidates

Run Blender from the repository root. On Windows, for example:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' `
  --background `
  --python apps/world/scripts/blender/prepare_prop.py `
  -- `
  --input apps/world/assets/models/<asset>/source/<source>.blend `
  --output-blend apps/world/assets/models/<asset>/working/<asset>-70.blend `
  --output-glb apps/world/public/models/<asset>/runtime/<asset>-70.glb `
  --preview apps/world/assets/models/<asset>/working/<asset>-70.png `
  --decimate-ratio 0.7 `
  --texture-size 1024
```

Generate at least full-detail, conservative, and aggressive candidates—usually
ratios `1.0`, `0.7`, and `0.5`. Keep the camera, lighting, and texture size
identical between candidates. Choose the lowest reduction that preserves the
silhouette and authored details at the asset's closest real gameplay distance.
Do not pick a ratio from triangle count alone.

The script:

- opens/imports the source without modifying it;
- applies Blender's Collapse decimation when the ratio is below `1.0`;
- downsizes and packs textures into the working file;
- saves an editable prepared `.blend`;
- exports a self-contained, uncompressed Babylon-compatible GLB;
- optionally renders a square comparison preview;
- prints a JSON report containing input/output counts and texture dimensions.

Runtime mesh compression is deliberately off so Babylon does not need an
external decoder. Texture resolution is often the larger optimization lever;
inspect both geometry and material payload before deciding what to reduce.

## Validate

1. Confirm the JSON report has the expected triangle and texture counts.
2. Compare candidate previews, including thin straps, wires, glass, and ridges.
3. Run `pnpm --filter world build`.
4. Load the affected World view and verify scale, pose, materials, visibility
   toggling, near-plane clearance, and rendering-group depth behavior.
5. Keep raw source and working files outside `public/`; only runtime assets and
   license metadata belong under `public/models/`.
