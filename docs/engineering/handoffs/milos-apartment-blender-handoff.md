# Milo Apartment Blender Handoff

This handoff turns the preserved photogrammetry capture into an editable
environment-art working file and a Babylon-ready GLB. The script performs only
safe mechanical work. A human cleanup pass remains required because the source
contains two fused capture meshes with no semantic segmentation.

## Inputs and outputs

Input:

```text
milos-apartment-capture-original.glb
```

Expected outputs:

```text
milos-apartment-clean.blend
milos-apartment-runtime.glb
previews/
  milos-apartment-view-1.png
  milos-apartment-view-2.png
  milos-apartment-view-3.png
  milos-apartment-view-4.png
```

Never overwrite the original capture.

## Copy to the Blender machine

Copy these two files to the other machine:

```text
apps/world/public/models/milos-apartment/source/milos-apartment-capture-original.glb
apps/world/scripts/blender/prepare_milos_apartment.py
```

## Run the preparation script

From a terminal on the Blender machine, replace the example paths with local
absolute paths:

### Windows

```powershell
& 'C:\Program Files\Blender Foundation\Blender 4.3\blender.exe' `
  --background `
  --python 'C:\dissonance\prepare_milos_apartment.py' `
  -- `
  --input 'C:\dissonance\milos-apartment-capture-original.glb' `
  --output-blend 'C:\dissonance\milos-apartment-clean.blend' `
  --output-glb 'C:\dissonance\milos-apartment-runtime.glb' `
  --preview-dir 'C:\dissonance\previews'
```

### macOS

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background \
  --python /Users/you/dissonance/prepare_milos_apartment.py \
  -- \
  --input /Users/you/dissonance/milos-apartment-capture-original.glb \
  --output-blend /Users/you/dissonance/milos-apartment-clean.blend \
  --output-glb /Users/you/dissonance/milos-apartment-runtime.glb \
  --preview-dir /Users/you/dissonance/previews
```

The script:

- imports and preserves the two capture meshes;
- flattens imported transforms;
- merges near-duplicate vertices and repairs normals;
- centers the room in X/Y and places its lowest point at Z=0;
- normalizes capture material roughness and metallic response;
- creates a separate low-poly floor and four cutaway walls;
- creates a provisional cassette anchor;
- creates an orthographic camera and restrained preview lighting;
- renders four square preview orientations;
- saves an editable `.blend`;
- exports a Babylon-ready GLB.

## Required manual Blender pass

Open `milos-apartment-clean.blend` and complete these in order.

### 1. Choose the canonical orientation

- Inspect all four preview renders.
- Rotate the contents, not the camera rig, so the intended bright window and
  desk composition match the approved reference.
- Keep Z up, floor at Z=0, and the room centered close to X=0/Y=0.
- Apply rotation and scale after the orientation is approved.

### 2. Clean the scan conservatively

- Work on duplicates of `APT_ARCH_CAPTURE_01` and
  `APT_ARCH_CAPTURE_02` if destructive editing is necessary.
- Delete floating islands, underside fragments, accidental exterior geometry,
  ceiling fragments, and obvious scan spikes.
- Do not smooth away useful plaster, furniture, cable, or debris detail.
- Preserve UVs and capture materials.
- Check face orientation and recalculate only visibly incorrect regions.

### 3. Segment only gameplay-relevant geometry

Separate geometry only where Babylon needs independent visibility or behavior:

- foreground wall pieces that block an isometric orientation;
- the ceiling, if any remains;
- large foreground scan fragments;
- hero objects that will be replaced or highlighted.

Use these prefixes:

```text
APT_ARCH_*       persistent captured or rebuilt architecture
APT_PROP_*       independently controlled furniture and clutter
APT_OCCLUDER_*   camera-orientation cutaway geometry
ARTIFACT_ANCHOR_* empty nodes marking artifact locations
```

Do not split every small object. Segmentation has a runtime and authoring cost.

### 4. Refine the authored shell

- Resize the generated floor and walls to sit behind the scan without
  z-fighting.
- Cut the major window and doorway openings.
- Remove walls that are not part of the intended room.
- Keep foreground walls as `APT_OCCLUDER_*`.
- Leave the ceiling open for the isometric presentation.

### 5. Place the first archaeology anchor

Move `ARTIFACT_ANCHOR_DegradedCassette` to the cassette's intended resting
position. Its local axes should be:

- +Z up;
- +Y toward the artifact's visual front;
- scale 1.

The anchor is gameplay metadata, not visible geometry.

### 6. Create the art-direction preview

The approved target is a warm, deteriorated music studio:

- bright damaged-window key light;
- amber/brown room palette;
- dark peripheral falloff;
- readable sofa, workstation, keyboard, speakers, guitar, wall images, and
  central excavation area;
- restrained magenta signal-residue accents;
- dense but intentionally composed debris.

The preparation script does not synthesize these assets. Add proxies or
licensed/authored hero models only after the room orientation and cutaway are
approved.

### 7. Final export

Before export:

- apply mesh rotation and scale;
- retain UVs, normals, materials, and embedded/collected textures;
- exclude preview cameras and lights;
- confirm every runtime object has a contract prefix;
- confirm the floor remains at Z=0;
- confirm the cassette anchor exists once;
- save the `.blend`.

Export as glTF 2.0 binary:

```text
Format: glTF Binary (.glb)
Include: Visible Objects
Transform: +Y Up
Geometry: Apply Modifiers, UVs, Normals
Materials: Export
Animation: Off
Cameras: Off
Punctual Lights: Off
```

## Return to this repository

Copy the results into:

```text
apps/world/public/models/milos-apartment/working/milos-apartment-clean.blend
apps/world/public/models/milos-apartment/working/previews/
apps/world/public/models/milos-apartment/runtime/milos-apartment.glb
```

The returned preview images are the visual review gate. Do not replace the
current runtime asset until at least one orientation clearly supports the
approved composition.
