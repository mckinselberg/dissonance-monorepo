# AI Coding Assistant Prompt: Photogrammetry-Based Isometric Archaeological Loot Room

You are a senior TypeScript and Babylon.js engineer working inside the existing **Dissonance** repository.

Implement a playable, profile-driven **isometric archaeological loot room** using an existing 3D photogrammetry capture as the visual and spatial foundation.

The original image is a screenshot of the capture. Do not attempt to reconstruct the room from the screenshot. Assume the underlying photogrammetry mesh and textures can be exported and processed into glTF/GLB.

The final room should depict the captured music studio after approximately **200–300 years of imperfect preservation**, rendered with a restrained **PS3/PS4-era game aesthetic**.

---

## Non-Negotiable Repository Requirements

Before modifying code, inspect the repository and determine its established conventions for:

- Package ownership and boundaries
- Scene and location construction
- Profile definition and resolution
- Babylon.js asset loading
- Asset manifests
- Camera creation
- Input abstraction
- Pointer interaction
- UI integration
- Audio integration
- Save-state and persistence
- Logging and error handling
- Lifecycle and disposal
- Testing
- Performance diagnostics
- Quality settings and LOD selection

Follow those conventions.

Do not create parallel systems when equivalent repository abstractions already exist.

In particular:

- Use the existing profile-resolution path as the sole runtime configuration path.
- Use the existing environment or location builder.
- Use the existing asset loader and manifest format.
- Use the existing input-command system rather than raw global listeners.
- Use the existing UI, event, audio, persistence, and logging systems.
- Use the existing dev HUD for diagnostics.
- Follow current naming, file placement, export, test, and disposal conventions.
- Avoid unrelated refactors.

Where this prompt conflicts with the repository architecture, follow the repository and document the adaptation.

---

# Required Initial Audit

Before implementing, report:

1. The package or feature area that should own this system
2. The existing profile types or resolvers to extend
3. The environment or location builder to use
4. The existing GLB loading pathway
5. The asset-manifest format
6. The existing camera and input abstractions
7. The interaction and picking pathway
8. The UI and event pathway
9. The audio pathway
10. The persistence pathway
11. The lifecycle and disposal pattern
12. The testing framework and relevant test conventions
13. The existing performance and quality-profile systems
14. The exact files proposed for creation or modification

Do not begin with a large speculative implementation before completing this audit.

---

# Architectural Principle

Maintain three separate layers:

```text
Photogrammetry base
= visual and spatial historical record

Authored archaeological layer
= physical degradation, environmental storytelling, and Synod additions

Artifact proxy/replacement layer
= interaction, narrative state, puzzles, recovery, and persistence
```

The photogrammetry mesh must not own gameplay state or interaction logic.

---

# Experience

The room is a domestic music and art studio discovered centuries after abandonment.

Recognizable surviving elements should include:

- Leather couch
- Desk
- Synthesizer or keyboard
- Guitars
- Speakers and amplifiers
- Audio equipment
- Framed art and photographs
- Computers or electronic equipment
- Physical media
- Cables
- Books and papers
- Personal objects
- Structural debris
- Later Synod monitoring equipment or markings

The player should:

- Examine the site
- Activate a scanner
- Detect artifacts and signal residue
- Clear debris
- Identify objects
- Reconstruct chronology
- Recover audio or cultural fragments
- Decide whether to recover artifacts or leave them in situ
- Discover evidence of later Synod intervention

Do not treat this as a conventional fantasy treasure room.

---

# Photogrammetry Source Pipeline

Preserve separate source, working, and runtime assets:

```text
source/
  studio-capture-high.<source-format>

working/
  studio-capture-clean.blend

runtime/
  studio-capture-lod0.glb
  studio-capture-lod1.glb
  studio-capture-lod2.glb
```

Do not destructively alter the only high-resolution source capture.

If the source asset is not yet present:

- Define the complete runtime asset contract.
- Create the loading and integration pathway.
- Use a minimal placeholder GLB with the expected node names and metadata.
- Clearly document where the real processed capture belongs.
- Do not replace the photogrammetry strategy with a fully procedural room.

---

# Blender Preparation Guide

Provide a concise Blender preparation guide covering the following.

## Scale and Orientation

Determine scale from a known object such as the keyboard, couch, desk, door, or window.

Use the repository’s world-unit convention. Where none exists, prefer:

```text
1 Blender unit = 1 meter
origin = approximate center of room floor
transforms applied before export
```

Verify glTF/Babylon axis conversion in the existing asset pipeline.

## Remove Capture Artifacts

Delete:

- Floating geometry
- Stretched reconstruction fragments
- Duplicate surfaces
- Exterior fragments
- Unseen geometry beneath the floor
- Severe reflective-object artifacts
- Unnecessary ceiling geometry
- Front-wall geometry blocking the cutaway view
- Geometry far outside the usable room

## Segment by Responsibility

Use repository naming conventions. Suggested semantic groups:

```text
PG_ARCH_RearWall
PG_ARCH_LeftWall
PG_ARCH_RightWall
PG_ARCH_Floor

PG_PROP_Couch
PG_PROP_Desk
PG_PROP_WindowArea
PG_PROP_WallArt
PG_PROP_InstrumentCluster
PG_PROP_Clutter_A
PG_PROP_Clutter_B

PG_OCCLUDER_LeftWall
PG_OCCLUDER_RightWall

ARTIFACT_ANCHOR_DegradedCassette
ARTIFACT_ANCHOR_GuitarComponent
ARTIFACT_ANCHOR_SynthMemory
ARTIFACT_ANCHOR_PersonalImage
ARTIFACT_ANCHOR_SynodRelay
```

Prefer glTF `extras` metadata when the repository supports it.

Do not split every tiny fragment into a separate mesh.

## Optimization

Use a hybrid strategy:

- Rebuild walls and floor as clean low-poly geometry where useful.
- Decimate irregular furniture and clutter.
- Retopologize only important hero regions.
- Replace badly captured objects with authored models.
- Remove hidden and duplicate geometry.
- Preserve useful capture UVs and texture detail.

Initial profiling targets:

```text
Desktop high:
150,000–400,000 visible triangles

Balanced web:
100,000–250,000 visible triangles

Low-quality/mobile:
75,000–150,000 visible triangles
```

Use existing project budgets when available.

## Texture Processing

Photogrammetry textures may contain baked lighting. Do not assume they are clean albedo textures.

Use a hybrid strategy:

- Preserve capture textures as the room’s visual foundation.
- Avoid strongly relighting baked capture surfaces.
- Use full PBR materials for authored replacement objects.
- Use cleaner PBR materials for rebuilt walls and floors.
- Add contact shadows, decals, and archaeological overlays.
- Avoid obvious double lighting.

Prefer the project’s established compression pipeline. Otherwise evaluate:

- KTX2/Basis for textures
- Meshopt or Draco for geometry
- GLB packaging

Validate the final glTF/GLB.

---

# Runtime Asset Contract

Classify imported nodes once during load.

Do not repeatedly scan the full scene mesh list during pointer events or render loops.

Conceptual result:

```ts
export interface LoadedArchaeologicalRoom {
  root: TransformNode;

  architecture: readonly AbstractMesh[];
  capturedProps: readonly AbstractMesh[];
  capturedClutter: readonly AbstractMesh[];

  occludersBySide: ReadonlyMap<
    "north" | "east" | "south" | "west",
    readonly AbstractMesh[]
  >;

  artifactAnchors: ReadonlyMap<string, TransformNode>;
  replacementArtifacts: ReadonlyMap<string, AbstractMesh>;
  debrisSources: ReadonlyMap<string, Mesh>;
}
```

Adapt this interface to repository conventions.

The capture geometry should normally be:

```ts
mesh.isPickable = false;
mesh.receiveShadows = true;
```

Do not use the dense capture mesh for ordinary artifact picking.

---

# Profile-Driven Configuration

Extend the existing profile system rather than introducing an unrelated room configuration system.

The resolved configuration should conceptually include:

```ts
export interface ArchaeologicalRoomProfile {
  id: string;

  assets: {
    lod0: string;
    lod1?: string;
    lod2?: string;
    damageOverlay?: string;
    artifactReplacements?: string;
    debris?: string;
  };

  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };

  camera: {
    alpha: number;
    beta: number;
    radius: number;
    target: [number, number, number];
    orthoSize: number;
    minOrthoSize?: number;
    maxOrthoSize?: number;
    allowQuarterTurns: boolean;
  };

  decay: {
    dust: number;
    dampness: number;
    oxidation: number;
    biologicalGrowth: number;
    structuralDamage: number;
    paperDecay: number;
    sunBleaching: number;
    signalContamination: number;
  };

  lighting: {
    ambientIntensity: number;
    keyIntensity: number;
    keyDirection: [number, number, number];
    shadowMapSize: number;
    bloomWeight: number;
    exposure: number;
    contrast: number;
  };

  artifactIds: readonly string[];
  debrisSeed: number;
  quality: "low" | "balanced" | "high";
}
```

Mutable artifact progress must not be stored in the immutable profile.

---

# Orthographic Isometric Camera

Render the room through an orthographic camera.

Requirements:

- Fixed isometric-style target
- No unrestricted panning
- Optional orthographic zoom
- Responsive framing based on render aspect ratio
- Optional exact 90-degree rotations
- Stable composition
- No first-person controls
- No unrestricted production orbit camera

The initial view must clearly expose:

- Couch seat
- Floor
- Desk surface
- Keyboard
- Wall art
- Window area
- Major artifact positions

Use existing engine resize handling. Do not create unmanaged global resize listeners when the repository already provides lifecycle-aware resize events.

Conceptual orthographic-bound calculation:

```ts
function updateOrthographicBounds(
  camera: ArcRotateCamera,
  renderWidth: number,
  renderHeight: number,
  verticalSize: number,
): void {
  const safeWidth = Math.max(renderWidth, 1);
  const safeHeight = Math.max(renderHeight, 1);
  const aspect = safeWidth / safeHeight;

  const halfHeight = verticalSize / 2;
  const halfWidth = halfHeight * aspect;

  camera.orthoLeft = -halfWidth;
  camera.orthoRight = halfWidth;
  camera.orthoTop = halfHeight;
  camera.orthoBottom = -halfHeight;
}
```

---

# Quarter-Turn Camera Rotation

Support four curated orientations where compatible with the existing camera system:

```ts
export type RoomOrientation =
  | "northEast"
  | "southEast"
  | "southWest"
  | "northWest";
```

Requirements:

- Rotate exactly 90 degrees
- Animate over roughly 300–500 milliseconds
- Prevent overlapping rotation commands
- Preserve target and orthographic framing
- Update visible wall groups
- Update scanner overlays and labels
- Use existing animation helpers
- Use existing input actions rather than raw key listeners

---

# Occlusion Handling

Implement two forms of occlusion.

## Orientation-Based Walls

For each camera orientation:

- Hide the wall nearest the camera, or
- Fade it using a dedicated or cloned material

## Selection-Based Occlusion

When an artifact is selected:

1. Test the camera-to-artifact line against registered occluders.
2. Fade only tagged occluding meshes.
3. Restore previous visibility and material state when selection changes.
4. Avoid mutating shared materials globally.
5. Dispose temporary materials.
6. Reuse any existing obstruction or focus system.

The photogrammetry asset must be segmented enough to support this.

---

# Authored Archaeological Layer

Do not attempt to generate 200–300 years of degradation entirely through a runtime shader.

Add authored geometry and decals for:

- Crumbled plaster
- Exposed wall lath
- Broken window framing
- Rotten wood
- Collapsed furniture sections
- Corroded electronics
- Cable bundles
- Paper deposits
- Rubble
- Water paths
- Mold or biological growth
- Synod-era additions
- Survey glyphs or markings

This layer may intersect or cover the capture mesh.

Age materials according to likely conditions rather than tinting everything uniformly.

Examples:

```text
Window-facing paper:
bleached, brittle, partially absent

Damp corners:
water staining, biological damage, plaster loss

Electronics:
oxidized contacts, cracked plastic, mineral deposits

Leather:
collapsed structure, cracking, exposed stuffing

Protected objects:
better preservation beneath furniture or inside containers
```

---

# Artifact Proxy and Replacement System

Do not make the dense captured objects directly interactive.

Use explicit anchors, low-complexity proxies, or authored replacement meshes.

Each artifact anchor should provide:

- Stable artifact ID
- World transform
- Picking volume
- Interaction radius
- Scanner position
- Label position
- Audio-emitter position
- Optional excavation cover
- Optional replacement mesh
- Optional captured mesh groups to hide

Conceptual metadata:

```ts
export interface ArtifactAnchorMetadata {
  type: "artifactAnchor";
  artifactId: string;
  capturedMeshNames?: readonly string[];
  replacementMeshName?: string;
  excavationCoverName?: string;
}
```

Invisible proxies may be pickable:

```ts
proxy.isVisible = false;
proxy.isPickable = true;
proxy.metadata = {
  type: "artifactAnchor",
  artifactId,
};
```

For important interactive objects:

```text
photogrammetry object
= visual context

authored replacement
= gameplay-capable version
```

Replace or mask major captured objects when they need:

- Animation
- State changes
- Individual highlighting
- Excavation
- Removal
- Opening
- Puzzle interactions
- Material changes

---

# Initial Artifact Set

Implement at least five artifacts.

## Degraded Voice Cassette

- Initially partially buried
- Requires excavation
- Contains a recoverable audio fragment
- Low signal integrity

## Broken Guitar Component

- Cultural artifact
- Contains tuning or resonant evidence
- May be left in situ

## Synthesizer Memory Module

- Contains sequence or configuration data
- Potential musical puzzle hook

## Personal Framed Image

- Provides chronology and room-owner context
- Primarily narrative

## Synod Monitoring Relay

- Added after the original domestic occupation
- Chronologically distinct from the room contents
- Contains evidence of surveillance
- Major narrative artifact
- Prefer an authored replacement mesh

---

# Artifact Definitions and Runtime State

Follow existing entity and state conventions.

Conceptual immutable definition:

```ts
export type ArtifactState =
  | "buried"
  | "detected"
  | "exposed"
  | "identified"
  | "recovered"
  | "left-in-situ";

export interface ArtifactDefinition {
  id: string;
  displayName: string;
  anchorName: string;
  initialState: ArtifactState;
  interactionRadius: number;

  preservation: number;
  signalResidue: number;
  contamination: number;

  estimatedYearStart?: number;
  estimatedYearEnd?: number;
  chronologyConfidence?: number;

  loreEntryId?: string;
  audioFragmentId?: string;
  puzzleId?: string;
  inventoryItemId?: string;

  recoverable: boolean;
}
```

Conceptual mutable record:

```ts
export interface ArchaeologyRecord {
  artifactId: string;
  state: ArtifactState;

  identified: boolean;
  excavated: boolean;
  archived: boolean;

  preservation: number;
  signalResidue: number;
  contamination: number;

  discoveredAt?: number;
  recoveredAt?: number;
}
```

Persist runtime state through the repository’s existing save-state mechanism.

---

# Interaction Flow

Use the repository’s interaction-state conventions or implement a small explicit state machine.

Required flow:

```text
idle
→ hovered
→ selected
→ detected or excavating
→ exposed
→ identified
→ recovered or left in situ
```

Do not instantly collect artifacts on click.

Available actions should depend on state:

```text
EXCAVATE
SCAN
ANALYZE
RECONSTRUCT AUDIO
ARCHIVE
RECOVER
LEAVE IN SITU
```

Core interaction logic must not be tightly coupled to one GUI implementation.

Only artifact proxies or replacement meshes should be pickable.

---

# Scanner

Implement or extend a diegetic archaeological scanner.

Supported modes may include:

```ts
type ScannerMode =
  | "visual"
  | "acoustic"
  | "chronological"
  | "hybrid";
```

## Visual

- Reveals artifact silhouettes
- Indicates preservation
- Reveals partially obscured objects

## Acoustic

- Reveals sound-bearing objects
- Shows cable, speaker, instrument, and recorder relationships
- Indicates signal residue
- Supports subtle waveform or resonance traces

## Chronological

- Distinguishes original household objects from later additions
- Displays approximate date ranges
- Represents uncertainty or confidence
- Identifies Synod-era intervention

## Hybrid

- Combines restrained portions of the above

Avoid generic full-screen detective vision.

Scanner effects should use Dissonance’s sound, signal, interference, and archaeological vocabulary.

---

# Excavation

At least one artifact must begin buried beneath an explicit cover mesh.

Implement:

- Begin excavation
- Update progress
- Cancel excavation
- Fade, move, or remove the cover mesh
- Reveal the artifact
- Update persistent state
- Trigger a restrained dust and material-contact effect
- Prevent duplicate completion

Use the repository’s update loop and cancellation patterns.

---

# Debris Rendering

Use different rendering strategies according to function.

## Hero Debris

Use normal meshes for:

- Large plaster sections
- Exposed wall lath
- Broken electronic equipment
- Instrument fragments
- Collapsed shelving
- Major paper clusters

## Repeated Medium Debris

Use ordinary instances for:

- Books
- Cassettes
- Broken keys
- Circuit boards
- Frame fragments
- Cable connectors

## Tiny Decorative Debris

Use thin instances for:

- Plaster chips
- Wood chips
- Paper scraps
- Small noninteractive fragments

Do not use thin instances for individually interactive artifacts.

Use the repository’s deterministic random helper. Do not rely on uncontrolled `Math.random()` for room reconstruction.

---

# Lighting and Materials

The capture may already contain baked lighting.

Use restrained hybrid lighting:

- Low-intensity ambient light
- One directional window light
- Soft shadows from authored hero objects
- Contact shadows
- Optional window light card
- Optional low-cost dust particles

Do not make all captured fragments cast dynamic shadows.

Use existing rendering profiles and material factories.

Prefer:

- FXAA
- Optional low-sample MSAA
- Mild bloom
- Exposure and contrast adjustments
- Restrained ambient occlusion
- Optional subtle grain

Avoid:

- Heavy depth of field
- Strong chromatic aberration
- Excessive bloom
- Expensive reflections without clear benefit

---

# Asset Manifest and Quality Selection

Register every runtime asset through the repository’s asset manifest.

Support quality-aware selection:

```text
high     → LOD0 and high-resolution textures
balanced → LOD1 and balanced textures
low      → LOD2 and reduced textures
```

Reuse the existing graphics-quality system.

Gracefully handle:

- Missing high-quality LOD
- Missing optional damage overlays
- Missing optional replacement meshes
- Unsupported compression
- Missing artifact anchors

Required data failures should produce actionable development diagnostics.

---

# Performance

Measure and report:

- GLB download size
- Texture download size
- Texture memory estimate where available
- Triangle count
- Mesh count
- Material count
- Draw calls
- Shadow casters
- Instance counts
- Thin-instance counts
- Load duration
- Time to first interactive frame
- Average frame time
- Scanner activation cost

Integrate diagnostics into the existing dev HUD where possible.

Do not add a separate debug interface when one already exists.

---

# Lifecycle

The room must safely support:

```text
load
enter
activate
pause
resume
exit
dispose
recreate
```

Clean up:

- Imported roots
- Temporary materials
- Highlight registrations
- Pointer observers
- Input bindings
- Animation handles
- Scanner overlays
- GUI state
- Audio emitters
- Particle systems
- Shadow registrations
- Event subscriptions
- Cached artifact references

Ensure revisiting the room does not duplicate observers or interactions.

---

# Vertical Slice

Implement this smallest playable slice:

1. Load a processed photogrammetry GLB
2. Apply profile-controlled transform
3. Classify imported nodes
4. Disable picking on capture geometry
5. Create the orthographic isometric camera
6. Implement responsive framing
7. Implement cutaway wall visibility
8. Support clockwise and counterclockwise quarter turns
9. Add a degraded cassette artifact proxy
10. Add an authored Synod relay
11. Add hover and selection
12. Add a minimal inspection UI
13. Add one excavation cover
14. Add acoustic scanner mode
15. Recover one audio fragment
16. Add deterministic debris overlays
17. Add restrained lighting and post-processing
18. Persist artifact state
19. Implement complete disposal
20. Record performance metrics

Use a contract-compatible placeholder GLB only when the processed capture is unavailable.

---

# Testing

Follow repository test conventions.

Add tests for:

## Profile Resolution

- Required assets
- Default values
- Numeric bounds
- Camera defaults
- Unique artifact IDs
- Quality variants

## Asset Classification

- Architecture classification
- Occluder classification
- Artifact-anchor mapping
- Duplicate-anchor rejection
- Optional-node handling
- Required-node diagnostics

## Camera

- Orthographic bounds across aspect ratios
- Quarter-turn orientation mapping
- Rotation lock during animation
- Zoom clamping

## Artifact State

Valid path:

```text
buried
→ detected
→ exposed
→ identified
→ recovered
```

Alternative terminal path:

```text
identified
→ left-in-situ
```

Reject invalid transitions.

## Deterministic Debris

- Same seed produces identical transforms
- Different seeds produce different transforms

## Persistence

- Recovered artifacts do not respawn
- Identified state survives reload
- Left-in-situ state survives reload

## Disposal

Verify cleanup of:

- Input bindings
- Pointer observers
- Scene nodes
- Temporary materials
- UI
- Scanner effects
- Audio
- Animation callbacks
- Event subscriptions

---

# Implementation Phases

## Phase 1 — Repository Audit

Identify integration points and proposed file changes.

## Phase 2 — Asset Contract

Define GLB naming, metadata, scale, LOD, and manifest requirements.

## Phase 3 — Minimal Capture Load

Load and classify the processed capture through existing infrastructure.

## Phase 4 — Camera and Cutaway

Implement orthographic framing, rotation, and wall handling.

## Phase 5 — Artifact Proxy

Add one artifact anchor, picking, selection, and inspection.

## Phase 6 — Archaeology Systems

Add excavation, scanner behavior, audio reconstruction, and persistence.

## Phase 7 — Optimization

Add LOD selection, compression, deterministic debris, and profiling.

## Phase 8 — Hardening

Add tests, error handling, disposal verification, and documentation.

After each phase:

- Run type checking
- Run relevant tests
- Run linting
- Report changed files
- Report unresolved assumptions
- Avoid unrelated modifications

---

# Deliverables

Provide:

1. Repository architecture audit
2. Implementation plan
3. Files created and modified
4. Photogrammetry GLB contract
5. Blender cleanup and export guide
6. Naming and metadata guide
7. Profile integration
8. Asset-manifest integration
9. Camera and cutaway implementation
10. Artifact proxy system
11. Scanner integration
12. Excavation vertical slice
13. UI and audio integration
14. Persistence integration
15. Tests
16. Performance results
17. Known limitations
18. Recommended next steps

Prefer a small working vertical slice over a large speculative framework.

The final implementation must treat the photogrammetry capture as the room’s historical visual record while keeping degradation, interaction, narrative state, and gameplay in separate authored and data-driven layers.
