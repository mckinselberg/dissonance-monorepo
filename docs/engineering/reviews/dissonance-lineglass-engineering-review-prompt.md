# Dissonance Boulevard — Lineglass / “Godot View” Implementation & Engineering Review Prompt

You are a senior TypeScript, Babylon.js, game-systems, rendering, and technical-design engineer reviewing an existing Dissonance prototype.

Your task is to produce an implementation plan and engineering review for a diegetic visual-inspection device that recreates the visual language of the original Godot prototype: dark geometry, cyan structural outlines, sparse warm highlights, visible spatial relationships, and selectively exposed signal or acoustic information.

The device is an in-world object rather than a purely stylistic post-process.

The working informal name is **Lineglass**.

---

## 1. Project Context

**Dissonance** is a first-person exploration, mystery, horror, and archaeology game.

The game is not primarily about combat.

Its recurring themes include:

- sound as infrastructure
- language as power
- perception as an unreliable interface
- state and municipal systems
- memory
- environmental storytelling
- surveillance
- ecology altered by technology
- the contrast between human traces and administrative abstraction

The governing institution, the **Synod**, uses sound, signal, language, architecture, and public infrastructure to alter behavior, territory, memory, animals, and human bodies.

The project is currently being developed in TypeScript and Babylon.js, with a package-oriented architecture intended to support multiple related games and prototypes.

Existing architectural principles include:

- profile-driven configuration
- one resolved code path rather than divergent implementations
- declarative location construction
- reusable environment packages
- deterministic procedural placement
- optional real-world latitude/longitude placement
- data-driven encounters
- low-HUD or no-HUD presentation
- reusability across forest, urban, trail, and interior locations

---

## 2. Source Location: Dissonance Boulevard

The original Godot prototype contains an urban route referred to here as **Dissonance Boulevard**.

The location includes:

- Milo’s apartment building
- the apartment interior and stairwell
- a broad urban boulevard
- sparse streetlights
- tall residential or mixed-use buildings
- warm irregular windows
- signal or sound-interaction objects
- a route toward a large civic or municipal structure
- severe, mostly unornamented architecture
- strong cyan edge visualization
- dark teal, black, brown, and amber values

The boulevard should feel:

- under-occupied rather than abandoned
- civic rather than commercial
- exposed rather than crowded
- administered rather than lived in
- quiet in a controlled and unnatural way
- spatially legible but psychologically unstable

The route from Milo’s apartment toward the municipal complex is intended to become a recurring narrative corridor.

The municipal structure may initially remain ambiguous. Possible public functions include:

- city administration
- civil records
- court
- archive
- public-health authority
- communications authority
- public-works headquarters
- a former cultural building later repurposed by the Synod

Do not prematurely resolve that ambiguity unless implementation requires a temporary identifier.

---

## 3. Core Feature

Create a system for a wearable or handheld in-world inspection device that allows the player to see an alternate diagnostic interpretation of the environment.

When activated, it produces a visual mode inspired by the original Godot prototype:

- cyan structural contours
- dark or suppressed surface shading
- warm signal highlights
- selective rendering of nodes, conduits, boundaries, and spatial anomalies
- reduced ordinary color
- optional low-resolution or imperfect reconstruction
- exposed relationships that ordinary vision does not show
- an optional geospatial reference overlay: latitude/longitude grid, surveyed route,
  civic landmarks, and (where licensed offline data is available) an OSM-derived base map

This alternate view is not necessarily objective truth.

It is the Synod’s or municipality’s machine-readable interpretation of the world.

The device treats:

- buildings as structures
- streets as channels
- rooms as bounded volumes
- people as moving sources
- music as interference
- social behavior as load
- dissent as instability
- animals as biological anomalies or tracked signatures
- sound as a measurable field
- architecture as a control surface
- maps as municipal claims about territory rather than neutral ground truth

The view should therefore be useful, unsettling, incomplete, and ideologically biased.

---

## 4. Device Identity

Use **Lineglass** as the working name, but keep naming configurable.

Other internal or formal names may include:

- Civic Survey Visor
- Structural Field Viewer
- Municipal Diagnostic Optic
- Resonance Inspection Mask
- Trace Lens
- Contour
- The Frame

The physical device should feel:

- old
- specialized
- repaired
- municipal or industrial
- slightly uncomfortable
- partially obsolete
- built for trained workers rather than consumers
- tactile rather than sleek

Possible physical characteristics:

- scratched housing
- worn rubber face seal
- mechanical focus wheel
- slightly misaligned optics
- condensation or dust inside lenses
- cable-connected power pack
- relay clicks
- startup hum
- low-resolution indicators
- warning glyphs in an obsolete technical dialect

Avoid making it feel like a generic modern AR headset.

---

## 5. Narrative Function

The device should initially appear to be mundane infrastructure-inspection equipment.

Possible original users:

- public-works engineers
- structural inspectors
- acoustic survey crews
- emergency responders
- signal-maintenance technicians
- Synod enforcement technicians

As the player learns more, the device should reveal that the same system used to inspect buildings was also used to inspect and model populations.

The strongest thematic interpretation is:

> The Lineglass does not reveal the world as it is. It reveals the world as the Synod has learned to classify it.

The device may show:

- walls that visually exist but are absent from the diagnostic model
- doors that exist in the model but not in ordinary vision
- maintenance passages
- sealed rooms
- underground extensions
- old versions of buildings
- overlapping versions of the same space
- people with incomplete or missing contours
- mech animals with multiple competing silhouettes
- acoustic fields
- signal routes
- surveillance cones
- forbidden frequency zones
- structurally impossible interiors
- spaces marked as “vacant” that are visibly occupied
- rooms marked as occupied after their residents have disappeared

---

## 6. Engineering Goals

Produce an architecture that is:

- data-driven
- composable
- testable
- configurable
- performant
- reusable across urban and non-urban environments
- compatible with Babylon.js
- compatible with TypeScript strict mode
- suitable for desktop first, with a path toward mobile
- deterministic where procedural elements are involved
- integrated with existing location manifests and profile systems
- capable of progressively unlocking new scan layers
- able to degrade gracefully on lower-end hardware

Avoid hard-coding this feature specifically to Dissonance Boulevard.

Dissonance Boulevard should be the first canonical urban implementation and test environment.

---

## 7. Required Visual Layers

Design the feature as a stack of separately controllable layers.

### 7.1 Structural Layer

Shows:

- major mesh boundaries
- door and window contours
- supports
- stairs
- maintenance routes
- voids
- damaged geometry
- collision-relevant structure
- occluded structural edges when appropriate
- portal relationships
- room and floor boundaries

### 7.2 Signal Layer

Shows:

- transmitters
- relays
- signal-bearing objects
- communication paths
- surveillance devices
- machine-awareness cones
- current objective components
- active versus dormant infrastructure
- signal strength or integrity

### 7.3 Acoustic Layer

Shows:

- sound emitters
- standing-wave regions
- resonance pockets
- pressure or intensity fields
- destructive-interference regions
- masked sound
- safe acoustic routes
- areas affected by Synod conditioning patterns
- audibility or propagation boundaries

### 7.4 Historical Layer

Shows:

- prior building footprints
- demolished walls
- previous civic layouts
- reconstructed streets
- archived room layouts
- disputed municipal records
- ghost structures
- imperfectly aligned historical models

### 7.5 Biological Layer

Shows, with intentional uncertainty:

- movement
- animal presence
- stress markers
- body heat or metabolic approximation
- altered wildlife
- mechanical-organic hybrids
- signatures inconsistent with known categories

This layer should not become a conventional enemy-vision mode.

### 7.6 Geospatial Reference Layer

The Lineglass may render a restrained, world-anchored geographic reference rather
than opening a conventional full-screen map. Evaluate it as a separately unlockable
or profile-controlled layer, with independently toggleable sources:

- latitude/longitude grid, coordinate readout, north indicator, and local origin
- GPX route traces, waypoints, and optional elevation/distance markers
- authored civic and narrative landmarks (for example Milo's building, relay sites,
  municipal complex, trailheads, and survey markers)
- offline, attribution-compliant OpenStreetMap-derived roads, building footprints,
  paths, water, and place labels
- historical or Synod-maintained map records that deliberately disagree with the
  present world

The overlay must be spatially registered to the location's geo origin and local
Cartesian world coordinates. It should be a selective in-world projection,
contour, or low-resolution field visible through the device--not an always-on
minimap, a live web map, or an unrestricted navigation aid. It may reveal only
nearby geometry, landmarks, or the currently selected route. Treat every source,
including OSM and GPX, as fallible diagnostic evidence that can be stale,
redacted, offset, or ideologically classified.

Review data licensing, attribution, offline packaging, coordinate precision,
projection choice, tile/cache size, and a no-network runtime requirement. Define
how unavailable map data degrades gracefully to the lat/long grid and authored
landmarks.

---

## 8. Visual Design Requirements

The default visual language should include:

- near-black background
- dark teal or blue-black surfaces
- cyan edges
- warm amber, yellow, orange, or red points of importance
- sparse labels
- low visual noise at baseline
- increased noise under stress or signal instability
- slightly imperfect edge alignment
- subtle temporal jitter
- occasional dropped geometry
- selective rather than universal x-ray vision

The original Godot visual character should be treated as intentional reference, not as placeholder debug rendering.

Important visual goals:

1. Preserve silhouette readability.
2. Avoid making every mesh equally bright.
3. Distinguish structural edges from active signal edges.
4. Prevent distant geometry from becoming unreadable cyan noise.
5. Maintain strong contrast between inhabited warm windows and administrative cyan structure.
6. Allow the same environment to feel meaningfully different with the device off.
7. Support transitions that feel physical and optical rather than menu-based.
8. Keep geospatial references sparse and diegetic; they should orient the player
   without replacing exploration with a conventional map UI.

---

## 9. Babylon.js Rendering Approaches to Evaluate

Review and compare at least the following approaches.

### 9.1 EdgeRenderer

Evaluate:

- `enableEdgesRendering()`
- edge color and width
- per-mesh cost
- limitations with thin instances
- behavior on imported meshes
- visual stability at distance
- suitability for selective structural contours

### 9.2 HighlightLayer

Evaluate for:

- signal objects
- interactables
- active relay components
- objective-critical artifacts
- occluded highlights
- color separation between device layers

### 9.3 GlowLayer

Evaluate only where appropriate.

Avoid turning the entire view into neon bloom.

Possible uses:

- powered relays
- resonance sources
- unstable infrastructure
- warm window signals
- rare narrative anomalies

### 9.4 Custom Shader Material

Assess whether a custom shader or Node Material is required for:

- fresnel-like contours
- view-dependent edge detection
- quantized shading
- scanline artifacts
- depth-based fade
- distance attenuation
- false-color signal rendering
- per-instance diagnostic state
- unstable geometry effects
- layer-specific visualization

### 9.5 Post-Process Edge Detection

Evaluate screen-space edge detection using:

- depth
- normals
- luminance
- object masks
- render targets
- multi-camera composition

Discuss tradeoffs:

- scene-wide visual coherence
- loss of semantic distinction
- aliasing
- temporal shimmer
- transparent meshes
- UI contamination
- performance
- mobile compatibility

### 9.6 Multi-Pass or Render-Target Composition

Evaluate a dedicated diagnostic render pipeline with:

- normal scene camera
- diagnostic camera or render target
- layer masks
- selective meshes
- compositing
- optional low-resolution render target
- CRT or optical treatment
- deliberate latency or frame decimation

### 9.7 GreasedLine / Line Meshes

Evaluate for:

- signal routes
- acoustic paths
- municipal conduits
- historical street traces
- line-of-sight guides
- directional arrows
- scanned path reconstruction

### 9.8 Thin Instances

Evaluate how the system should support:

- thin-instanced windows
- streetlights
- architectural modules
- trees
- bollards
- repeated civic props
- per-instance active state
- per-instance diagnostic color
- per-instance visibility
- custom instance buffers
- selection or interaction limitations

Provide a recommendation for a hybrid rendering architecture rather than assuming one technique must solve everything.

---

## 10. Recommended Technical Architecture

Review and improve a system shaped approximately like this:

```ts
export type DiagnosticLayerId =
  | "structural"
  | "signal"
  | "acoustic"
  | "historical"
  | "biological"
  | "geospatial";

export interface LineglassState {
  enabled: boolean;
  activeLayer: DiagnosticLayerId;
  unlockedLayers: ReadonlySet<DiagnosticLayerId>;
  stability: number;
  power: number;
  focus: number;
  signalExposure: number;
  thermalLoad: number;
}

export interface DiagnosticTag {
  id: string;
  layers: DiagnosticLayerId[];
  classification:
    | "structure"
    | "portal"
    | "relay"
    | "emitter"
    | "conduit"
    | "occupant"
    | "animal"
    | "artifact"
    | "historical"
    | "anomaly";
  priority: number;
  visibility: "always" | "occluded" | "line-of-sight" | "proximity";
  styleId: string;
  metadata?: Record<string, unknown>;
}

export interface DiagnosticStyle {
  id: string;
  edgeWidth: number;
  edgeIntensity: number;
  surfaceOpacity: number;
  fillIntensity: number;
  pulseRate?: number;
  jitter?: number;
  distanceFadeStart?: number;
  distanceFadeEnd?: number;
}

export interface LineglassProfile {
  powerDrainPerSecond: number;
  startupDurationMs: number;
  shutdownDurationMs: number;
  layerSwitchDurationMs: number;
  maxContinuousUseSeconds?: number;
  scanResolutionScale: number;
  frameRateLimit?: number;
  supportsOccludedEdges: boolean;
  supportsHistoricalOverlay: boolean;
  supportsBiologicalApproximation: boolean;
  supportsGeospatialOverlay: boolean;
}
```

The review should propose explicit contracts for geographic sources rather than
embedding map-provider or GPX parsing details in rendering code. At minimum,
consider a `GeoReferenceSource` (grid, authored landmarks, GPX, offline OSM), a
location-local projection contract, source visibility policy, attribution metadata,
and diagnostic styling for routes, footprints, labels, and landmarks.

Do not treat these interfaces as final.

Review:

- naming
- ownership
- package boundaries
- runtime update frequency
- serialization needs
- ECS compatibility
- event flow
- profile resolution
- multiplayer implications
- deterministic behavior
- save-state requirements

---

## 11. Proposed Package Boundaries

Evaluate a package arrangement such as:

```text
@dissonance/lineglass
@dissonance/diagnostics
@dissonance/rendering
@dissonance/acoustics
@dissonance/signals
@dissonance/world
@dissonance/locations
@dissonance/location-dissonance-boulevard
```

A likely responsibility split:

### `@dissonance/lineglass`

Owns:

- player-facing device state
- activation
- power
- stability
- tuning
- unlock progression
- input bindings
- audio feedback
- state transitions

### `@dissonance/diagnostics`

Owns:

- diagnostic tags
- layer definitions
- visibility policies
- classifications
- scan queries
- anomaly contracts
- semantic-to-visual mapping

### `@dissonance/rendering`

Owns:

- Babylon.js render pipeline
- materials
- post-processes
- line rendering
- render targets
- quality tiers
- resource lifecycle

### `@dissonance/acoustics`

Owns:

- emitters
- propagation approximations
- acoustic zones
- resonance fields
- visualization-ready acoustic data

### `@dissonance/signals`

Owns:

- relay graph
- active paths
- signal strengths
- surveillance nodes
- machine-awareness zones

### `@dissonance/location-dissonance-boulevard`

Owns:

- the boulevard manifest
- Milo’s building placement
- municipal complex placement
- local scan annotations
- narrative-state variants
- encounter anchors
- local historical overlays

Recommend changes if this creates unnecessary package fragmentation.

---

## 12. Location Manifest Integration

Dissonance Boulevard should be data-driven.

Review a structure similar to:

```ts
export interface GeoAnchor {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface WorldPlacement {
  id: string;
  assetId: string;
  localPosition: [number, number, number];
  localRotation?: [number, number, number];
  localScale?: [number, number, number];
  geo?: GeoAnchor;
  procedural?: {
    seed: string;
    ruleId: string;
  };
  diagnosticTags?: DiagnosticTag[];
}

export interface DissonanceBoulevardManifest {
  id: "dissonance-boulevard";
  origin?: GeoAnchor;
  routeSegments: BoulevardSegment[];
  districts: DistrictDefinition[];
  buildings: WorldPlacement[];
  interiors: InteriorPortalDefinition[];
  acousticZones: AcousticZoneDefinition[];
  signalNodes: SignalNodeDefinition[];
  historicalOverlays: HistoricalOverlayDefinition[];
  encounterAnchors: EncounterAnchorDefinition[];
  narrativeStates: BoulevardNarrativeState[];
  geoReferences?: GeoReferenceDefinition[];
}
```

The implementation should allow:

- local Cartesian placement
- optional latitude/longitude anchoring
- deterministic procedural placement when explicit coordinates are omitted
- stable object IDs
- scene reload
- save/load compatibility
- narrative-state replacement or augmentation
- scan-layer annotations
- asset substitution without location rewrite
- lat/long grid and local-coordinate reconciliation
- optional GPX route import or authored route traces
- offline OSM-derived reference features and required attribution
- landmark visibility that can vary by device layer, narrative state, and diagnostic reliability

---

## 13. Device Interaction Model

The device should feel physically operated.

Avoid a conventional radial menu unless it is strictly a debugging fallback.

Possible interactions:

- raise/lower device
- rotate physical tuning dial
- hold to stabilize
- tap to switch layer
- replace module
- refocus
- manually align doubled geometry
- suppress one frequency band to reveal another
- disable active scan to remain hidden
- toggle available geographic sources or cycle a selected route without leaving the
  diegetic device view

Suggested controls:

```text
Toggle / raise device
Cycle unlocked layer
Hold to stabilize
Adjust tuning
Focus near/far
Mark anomaly
Lower device immediately
```

The system should support remapping through the existing input abstraction.

---

## 14. Risk, Cost, and Failure Model

The device should be useful but not free.

Possible costs:

- battery drain
- heat
- signal exposure
- narrowing of peripheral vision
- temporary suppression of normal color
- depth distortion
- visual afterimages
- audio amplification
- headaches or nausea
- detection by Synod systems
- corrupted or obsolete data
- false positives
- historical overlays mistaken for present geometry

Potential state variables:

```ts
power
heat
stability
signalExposure
focus
calibration
historicalDrift
biologicalNoise
```

Avoid treating health effects as generic damage-over-time.

They should affect perception, confidence, movement, sound, and decision-making.

---

## 15. Deliberate Unreliability

The implementation must support controlled discrepancies between normal view and diagnostic view.

Required anomaly types should include:

```ts
type DiagnosticAnomaly =
  | "missing-in-model"
  | "present-only-in-model"
  | "historical-ghost"
  | "duplicate-signature"
  | "classification-conflict"
  | "impossible-volume"
  | "stale-occupancy"
  | "signal-without-source"
  | "source-without-signal"
  | "geometry-drift"
  | "biological-unknown";
```

Anomalies should be authored, procedural, or state-driven.

They must not rely solely on random screen noise.

The player should sometimes be able to investigate and resolve them.

---

## 16. Dissonance Boulevard Vertical Slice

Define an initial vertical slice with the following route:

```text
Milo’s apartment
→ interior stairwell
→ recessed building entrance
→ residential boulevard
→ relay or component interaction
→ open civic approach
→ municipal threshold
```

The first implementation should demonstrate:

1. Device activation and deactivation.
2. Structural contour mode.
3. At least one signal object.
4. At least one acoustic visualization.
5. One historical discrepancy.
6. One deliberately false or stale classification.
7. A visible municipal destination.
8. A warm-window pattern that changes between normal and Lineglass view.
9. One risk consequence for excessive use.
10. One example of the device exposing a path unavailable to normal perception.
11. A world-registered latitude/longitude grid and at least one authored landmark.
12. One optional route trace (GPX-derived or authored) whose visibility is controlled
    by the Lineglass rather than a conventional map screen.

Possible test anomaly:

- A blank wall in Milo’s stairwell contains a diagnostic doorway.
- The historical layer shows that the doorway once connected to a municipal service corridor.
- The structural layer says the volume still exists.
- The signal layer shows intermittent activity behind it.
- Ordinary vision shows only painted concrete.

---

## 17. Visual Performance Strategy

The review must recommend quality tiers.

Example:

### Low

- reduced render-target resolution
- structural layer only
- no occluded edges
- limited post-processing
- low update frequency for fields
- simplified signal paths
- no biological layer

### Medium

- structural and signal layers
- limited acoustic overlays
- moderate temporal effects
- selective occluded highlights
- capped diagnostic frame rate

### High

- historical overlays
- acoustic field visualization
- layered composition
- stable distance fading
- anomaly distortion
- higher-resolution diagnostic render target

### Experimental

- volumetric acoustic visualization
- full historical reconstruction
- spatially distorted geometry
- temporal persistence
- object-classification overlays
- device-specific optical aberration

Discuss whether the diagnostic view should render at a deliberately lower frame rate than the main scene.

A low-resolution or 20–30 FPS diagnostic pass may both improve performance and strengthen the physical-device aesthetic.

---

## 18. Audio Requirements

The feature must include an audio design interface.

Required events:

```ts
lineglass.powerOn
lineglass.powerOff
lineglass.raise
lineglass.lower
lineglass.layerSwitch
lineglass.focus
lineglass.lock
lineglass.unlock
lineglass.warning
lineglass.overheat
lineglass.falsePositive
lineglass.signalDetected
lineglass.anomalyDetected
```

Audio should include:

- relay clicks
- low electrical hum
- tuning noise
- unstable beat frequencies
- filtered environmental sound
- slight stereo narrowing
- band-limited playback
- acoustic feedback that communicates instability without UI text

The device should affect what the player hears, not only what the player sees.

---

## 19. HUD and Accessibility

Default presentation should remain diegetic and minimal.

However, provide accessibility options for:

- contour brightness
- edge width
- reduced flicker
- reduced chromatic aberration
- reduced jitter
- stable labels
- high-contrast signal colors
- audio-only anomaly cues
- subtitle or text equivalents
- motion-sickness-safe transitions
- disabling simulated focus blur

Debug HUD and shipping UI must remain separate.

Do not bake debug classification labels into the final aesthetic.

---

## 20. Testing Requirements

Provide a test strategy covering:

### Unit Tests

- state transitions
- battery and heat calculation
- unlock rules
- layer selection
- visibility policy
- anomaly resolution
- profile merging
- deterministic procedural annotations

### Integration Tests

- scene registration
- mesh disposal
- render-target lifecycle
- layer masks
- material restoration
- entering and leaving interiors
- save/load
- respawn
- narrative-state transitions

### Playwright or Browser-Level Tests

Where practical:

- keyboard remapping
- device activation
- quality setting persistence
- accessibility settings
- pause and resume
- scene restart
- WebGL context recovery

### Visual Regression Tests

Capture:

- normal view
- structural layer
- signal layer
- acoustic layer
- historical discrepancy
- low-quality mode
- high-quality mode
- interior and exterior cases
- thin-instance-heavy scenes

### Performance Tests

Measure:

- GPU frame time
- CPU frame time
- draw calls
- active meshes
- shader compilation
- render-target memory
- thin-instance scaling
- scene transition leaks
- long-session thermal or memory growth

---

## 21. Telemetry and Debugging

Recommend a debug interface that can show:

```text
active layer
registered diagnostic objects
visible diagnostic objects
render-target resolution
diagnostic frame rate
battery drain
heat
signal exposure
anomaly count
edge-rendered mesh count
highlighted mesh count
thin-instance buffer count
GPU and CPU timing
```

Add developer-only controls to:

- force layers
- reveal all anomalies
- freeze instability
- disable battery drain
- isolate a render pass
- inspect object tags
- view diagnostic classification
- export a scan manifest
- compare normal and device render side by side

---

## 22. Non-Goals for the First Pass

Do not attempt all of the following in the initial vertical slice:

- full semantic recognition of arbitrary imported scenes
- physically accurate acoustics
- full destructible geometry
- universal x-ray vision
- advanced AI interpretation
- multiplayer synchronization of every visual artifact
- complete biological scanning
- unrestricted procedural historical reconstruction
- photorealistic materials
- polished final device model

The first pass should prove:

- the visual identity
- the diegetic interaction
- the semantic tagging system
- the rendering architecture
- the location-manifest integration
- the narrative usefulness

---

## 23. Required Engineering Review Output

Produce a review containing:

1. **Executive assessment**
2. **Recommended architecture**
3. **Rendering approach comparison**
4. **Selected hybrid rendering strategy**
5. **Package ownership**
6. **Core TypeScript contracts**
7. **Babylon.js lifecycle plan**
8. **Thin-instance strategy**
9. **Location-manifest integration**
10. **Geospatial-reference architecture**, including offline OSM/GPX handling,
    projection, attribution, and graceful degradation
11. **Device state machine**
12. **Risk and instability model**
13. **Dissonance Boulevard vertical-slice plan**
14. **Testing strategy**
15. **Performance budget**
16. **Accessibility considerations**
17. **Implementation phases**
18. **Known risks**
19. **Open questions**
20. **Acceptance criteria**
21. **Suggested file tree**

Include concrete TypeScript examples where useful.

Do not produce vague design prose.

Call out architectural mistakes, overengineering, rendering risks, Babylon.js limitations, and unclear ownership.

Prefer a small coherent first implementation over a speculative universal framework.

---

## 24. Acceptance Criteria for the First Implementation

The first vertical slice is complete when:

- Lineglass can be raised and lowered in first person.
- The normal scene is restored without material or state leakage.
- Structural contours reproduce the essential cyan-on-dark Godot visual language.
- At least one signal relay is highlighted in warm color.
- At least one acoustic field is visible.
- At least one stale or contradictory diagnostic record is authored.
- One hidden route or structural discrepancy can be discovered.
- The device can show a correctly registered lat/long grid and one authored landmark
  without introducing an always-on map UI.
- If a route source is present, a GPX-derived or authored route trace can be enabled
  and disabled independently; unavailable OSM data falls back cleanly to local grid
  and landmarks.
- Battery or heat creates a meaningful usage limit.
- The feature works in Milo’s stairwell and on the boulevard.
- The feature handles repeated or thin-instanced street objects without one draw call per instance.
- The feature supports at least low and high quality profiles.
- Automated tests cover the device state machine and profile resolution.
- Visual-regression captures exist for normal and diagnostic views.
- Performance remains within the project’s agreed frame budget.
- The implementation is not coupled to Dissonance Boulevard.
- Dissonance Boulevard remains the canonical first test location.

---

## 25. Final Design Principle

Treat the original Godot prototype’s outline view as recovered visual language, not obsolete graphics.

The new implementation should preserve its strongest qualities:

- cyan architectural structure
- warm isolated human signals
- dark civic space
- sparse legibility
- severe geometry
- administrative abstraction
- psychological ambiguity

The player should feel that the Lineglass reveals hidden information while simultaneously forcing the world into the Synod’s categories.

The governing principle is:

> See less and remain safe, or see more and risk becoming visible.
