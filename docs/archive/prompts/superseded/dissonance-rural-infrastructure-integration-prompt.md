# Dissonance Rural Infrastructure Integration Prompt

You are a senior TypeScript and Babylon.js engineer working inside the existing **Dissonance** game monorepo.

Your task is to design and implement a reusable rural-infrastructure content package that can source, generate, optimize, place, and integrate a set of environmental landmarks into the existing world-building systems.

The requested environment elements are:

- Farm silos
- Windmills that are secretly large-scale acoustic machines
- Water towers
- Power lines and utility corridors
- Self-storage facilities
- A small regional airport
- Two-lane rural highways
- A physical compass and compass-based navigation system

The implementation must fit the existing Dissonance architecture rather than creating a parallel world-building system.

---

# Project Context

Dissonance is a first-person exploration, environmental-horror, and archaeological mystery game built primarily with:

- TypeScript
- Babylon.js
- Vite
- Tone.js or an equivalent audio layer
- Monorepo packages
- Profile-driven world configuration
- Procedural and deterministic environmental placement
- Thin instances for repeated environmental objects
- Higher-detail hero assets for important locations
- Data-driven location construction
- Minimal or no conventional HUD

The world combines:

- Forest
- Rural infrastructure
- Abandoned civic spaces
- Industrial remnants
- Surveillance systems
- Acoustic weapons
- Environmental storytelling
- Reclaimed landscapes
- Physical navigation
- Diegetic artifacts

The Synod, the governing power in the fiction, learned to use sound to alter behavior, perception, memory, bodies, animals, and ecology.

These rural structures must initially appear mundane. Their acoustic, surveillance, and historical functions should emerge gradually through exploration.

---

# Architectural Constraints

Respect and extend the existing architecture.

Assume the repository already contains or is moving toward systems resembling:

```ts
EnvironmentProfile
BehaviorProfile
EmbodimentProfile
AudioProfile
ResolvedPursuerProfile
applyProfile()
locationBuilder
feature libraries
thin-instance placement
deterministic procedural generation
latitude/longitude or world-coordinate placement manifests
```

Do not create a second profile pipeline.

Do not hardcode world content directly into scene setup functions.

Do not place significant landmarks using untracked random values.

All content must be definable through serializable data and resolved through the existing profile and location-building pipeline.

Where exact repository names differ, inspect the codebase and adapt to its real conventions.

---

# Primary Objective

Create a reusable package or module responsible for rural infrastructure.

A likely package name is:

```txt
@dissonance/rural-infrastructure
```

If the monorepo uses the earlier `@dta/*` namespace, follow the repository’s established naming convention instead of introducing a new namespace.

The package should support:

1. Asset sourcing
2. Procedural asset creation
3. Asset normalization
4. Level-of-detail generation
5. Collision and interaction metadata
6. Thin-instance and regular-instance rendering
7. Hero-location construction
8. Deterministic placement
9. Latitude/longitude or equivalent geographic placement
10. Acoustic behavior
11. Environmental storytelling
12. Navigation landmark registration
13. Streaming and activation ranges
14. Debug visualization
15. Validation and automated tests

---

# First Step: Repository Inspection

Before making architectural changes, inspect the repository and identify:

- Existing package boundaries
- World-building APIs
- Profile types
- Location-building utilities
- Feature registries
- Thin-instance systems
- Asset-loading systems
- Coordinate systems
- Latitude/longitude mapping
- Terrain sampling
- Road or spline systems
- Audio-zone systems
- Interaction systems
- Save-state systems
- Debug HUD or development tooling
- Existing environmental manifests
- Naming conventions
- Test frameworks
- Build scripts

Produce a concise implementation map before editing code.

The map should identify:

- Existing systems that can be reused unchanged
- Existing systems that require extension
- New modules that are genuinely necessary
- Any assumptions that cannot be verified from the repository

Do not replace working systems merely to match this prompt.

---

# Content Categories

Model each feature as one of the following categories.

## Scatter Feature

Low-cost repeated elements suitable for instancing or thin instancing.

Examples:

- Utility poles
- Power-line towers
- Road reflectors
- Highway signs
- Storage-unit doors
- Fence segments
- Airport runway lights
- Windmill field variants
- Small agricultural props
- Transformers
- Road barriers

## Landmark Feature

Medium-complexity structures placed deliberately and visible from long distances.

Examples:

- Farm silos
- Water towers
- Large windmills
- Airport control tower
- Hangars
- Self-storage office
- Highway overpass
- Substation

## Hero Location

A hand-authored or procedurally assembled area with exploration, interaction, audio, narrative artifacts, and interior or close-range detail.

Examples:

- A complete self-storage facility
- A farm with multiple silos
- A windmill acoustic-array site
- A regional airport
- A water-tower maintenance compound
- A power substation
- A roadside service area

## System Artifact

An item or system carried or used by the player.

Example:

- Physical compass

The implementation should make the distinction explicit in data rather than relying on naming conventions.

---

# Proposed Core Types

Adapt these examples to existing repository patterns.

```ts
export type RuralFeatureKind =
  | 'farm-silo'
  | 'acoustic-windmill'
  | 'water-tower'
  | 'utility-pole'
  | 'power-corridor'
  | 'self-storage'
  | 'regional-airport'
  | 'two-lane-highway'
  | 'compass';

export type RuralFeatureScale = 'scatter' | 'landmark' | 'hero-location' | 'system-artifact';

export interface GeographicPlacement {
  latitude?: number;
  longitude?: number;
  altitudeMeters?: number;
  worldPosition?: {
    x: number;
    y?: number;
    z: number;
  };
  headingDegrees?: number;
}

export interface DeterministicPlacement {
  seed: string;
  placementMode: 'explicit' | 'geographic' | 'spline' | 'terrain-scatter' | 'corridor' | 'cluster';
}

export interface RuralFeatureDefinition {
  id: string;
  kind: RuralFeatureKind;
  scale: RuralFeatureScale;

  assetId?: string;
  proceduralGeneratorId?: string;

  placement: GeographicPlacement & DeterministicPlacement;

  visualProfileId: string;
  collisionProfileId?: string;
  interactionProfileId?: string;
  audioProfileId?: string;
  narrativeProfileId?: string;

  tags: string[];

  enabled?: boolean;
}
```

Do not use a large untyped `Record<string, unknown>` as the primary configuration format.

Use discriminated unions where feature-specific configuration differs materially.

---

# Feature Manifest

Create or extend a world manifest that tracks all deliberately placed landmarks.

Each placed landmark should support:

- Stable ID
- Feature type
- Position
- Latitude and longitude, when geographic mapping exists
- World-space coordinates
- Rotation
- Scale
- Source asset or generator
- Placement seed
- Narrative state
- Discovery state
- Streaming radius
- Audio activation radius
- Visibility distance
- Map visibility
- Compass visibility
- Dependency relationships
- Debug notes

Example:

```ts
export interface LandmarkManifestEntry {
  id: string;
  kind: RuralFeatureKind;

  latitude?: number;
  longitude?: number;

  position: {
    x: number;
    y: number;
    z: number;
  };

  rotationY: number;
  scale: number;

  source: {
    type: 'asset' | 'procedural' | 'composite';
    id: string;
  };

  seed: string;

  visibility: {
    maxDistance: number;
    mapVisible: boolean;
    compassVisible: boolean;
  };

  activation: {
    renderDistance: number;
    audioDistance?: number;
    interactionDistance?: number;
  };

  state?: Record<string, boolean | number | string>;
}
```

If the repository already has a placement manifest, extend it rather than creating a competing structure.

---

# Asset Sourcing Strategy

Build an asset-sourcing workflow rather than manually dropping unrelated files into the repository.

For every requested feature, evaluate three options:

1. Source an existing asset
2. Build a parametric procedural asset
3. Build a modular asset from reusable primitives

Prefer procedural or modular construction when:

- The structure has simple industrial geometry
- Many variants are required
- Polygon budgets must be tightly controlled
- Materials can be shared
- The object will be used at multiple resolutions
- The object needs gameplay-driven deformation or state changes

Prefer sourced assets when:

- Close-range realism is important
- The structure has difficult mechanical detail
- The asset license is clear
- The asset can be normalized into project standards
- The asset can be reduced into appropriate LODs

Do not rely on remote runtime assets.

All production assets must be vendored, licensed, documented, and processed into project-ready formats.

---

# Asset Licensing and Provenance

Create an asset provenance manifest.

For every third-party asset, record:

- Asset name
- Original creator
- Source URL
- License
- Date acquired
- Modifications performed
- Original file format
- Exported runtime format
- Attribution requirements
- Whether commercial use is permitted
- Whether derivative works are permitted

Example:

```ts
export interface AssetProvenanceEntry {
  assetId: string;
  title: string;
  creator?: string;
  sourceUrl?: string;
  license: string;
  acquiredAt: string;
  modifications: string[];
  runtimePath: string;
  attributionRequired: boolean;
}
```

Reject assets with unclear licenses.

Do not commit large unoptimized source files into runtime asset directories.

Separate:

```txt
assets/source/
assets/processed/
assets/runtime/
```

or follow equivalent repository conventions.

---

# Asset Normalization Pipeline

Every asset must pass through a consistent normalization process.

Normalize:

- Coordinate system
- Units
- Origin
- Forward direction
- Pivot placement
- Scale
- Material naming
- Texture naming
- Texture dimensions
- UV conventions
- Collision meshes
- LOD naming
- Metadata
- Animation naming
- Runtime export format

Use glTF or GLB unless the repository already establishes another standard.

Suggested conventions:

```txt
feature-name.hero.glb
feature-name.lod0.glb
feature-name.lod1.glb
feature-name.lod2.glb
feature-name.collision.glb
```

Avoid embedding unique high-resolution materials in every asset.

Use shared material families whenever feasible.

---

# Level-of-Detail Strategy

Implement several representation tiers.

## Tier 0: Hero

Used for close exploration.

Features may include:

- Full silhouette
- Interactive parts
- Detailed materials
- Interior access
- Collision
- Narrative objects
- Local audio emitters
- Damage or state variants

## Tier 1: Near Landmark

Used at medium range.

Features may include:

- Reduced geometry
- Simplified materials
- No small mechanical detail
- Simplified collision or no collision
- Reduced shadow complexity

## Tier 2: Distant Landmark

Used across the landscape.

Features should prioritize:

- Strong silhouette
- Very low triangle count
- Shared material
- No interaction
- Minimal or no shadows

## Tier 3: Impostor or Billboard

Used at extreme distance when appropriate.

Suitable for:

- Silo clusters
- Windmill fields
- Water towers
- Airport buildings
- Distant utility structures

Do not use a billboard when parallax, rotation, or silhouette changes make it visually unacceptable.

Create measurable triangle and material budgets for each tier.

Suggested initial targets, subject to validation:

```txt
Hero landmark:        15,000–80,000 triangles
Near landmark:         5,000–20,000 triangles
Distant landmark:        300–3,000 triangles
Scatter item:             20–1,000 triangles
Impostor:                  2–12 triangles
```

Treat these as starting constraints, not universal rules.

---

# Shared Materials

Create a small family of rural-industrial materials.

Examples:

- Galvanized steel
- Painted steel
- Rusted steel
- Weathered concrete
- Corrugated metal
- Asphalt
- Faded road paint
- Utility wood
- Dirty glass
- Chain-link fence
- Airport safety paint
- Agricultural enamel
- Synod retrofit panels

Use material parameters and texture atlases rather than creating one material per mesh.

Support environmental variation through:

- Tint
- Roughness
- Rust amount
- Dirt amount
- Fading
- Moss
- Wetness
- Damage decals
- Synod markings

Where possible, vary these values per instance without duplicating materials.

---

# Farm Silos

Implement silos as modular or procedural structures.

Required variants:

- Tall cylindrical metal silo
- Concrete grain silo
- Clustered agricultural silo
- Damaged or partially collapsed silo
- Synod-retrofitted resonator silo
- Distant low-poly silhouette

Composable parts may include:

- Cylinder body
- Conical roof
- Access ladder
- Top railing
- Vent
- Pipe
- Catwalk
- Base hatch
- External motor
- Acoustic retrofit assembly

Feature configuration should support:

```ts
export interface FarmSiloConfig {
  heightMeters: number;
  radiusMeters: number;
  materialVariant: string;
  hasLadder: boolean;
  hasCatwalk: boolean;
  damageLevel: number;
  acousticRetrofit?: {
    enabled: boolean;
    resonantFrequencyHz: number;
    activationState: 'silent' | 'ambient' | 'active' | 'damaged';
  };
}
```

At close range, silos may provide:

- Climbable ladders
- Maintenance platforms
- Interior resonance
- Environmental recordings
- Hidden storage
- Navigation viewpoints

---

# Acoustic Windmills

Windmills must initially read as plausible agricultural or energy infrastructure.

They are secretly giant sound-producing machines.

Support multiple interpretations:

- Conventional farm windmill
- Small wind turbine
- Large field turbine
- Synod acoustic rotor
- Damaged or desynchronized rotor

The windmill system should separate:

- Visual blade rotation
- Mechanical rotor state
- Wind response
- Audio generation
- Synod activation state
- Gameplay effect state

Example:

```ts
export interface AcousticWindmillConfig {
  rotorRadiusMeters: number;
  bladeCount: number;

  rotation: {
    mode: 'wind-driven' | 'fixed-speed' | 'scripted';
    minRpm: number;
    maxRpm: number;
  };

  acousticSystem: {
    enabled: boolean;
    carrierFrequencyHz: number;
    modulationFrequencyHz?: number;
    audibleComponentGain: number;
    infrasoundSimulationStrength: number;
    phaseOffset: number;
  };

  synchronizationGroupId?: string;
}
```

Do not attempt to reproduce physically dangerous sound levels.

Represent low-frequency or infrasonic effects through safe game abstractions such as:

- Filtered audio
- Amplitude modulation
- Camera movement
- Post-processing
- Controller vibration
- Environmental animation
- AI behavior changes
- Animal reactions
- Compass interference
- Spatial disorientation

Windmills within the same synchronization group should be capable of:

- Matching phase
- Drifting out of phase
- Beating against one another
- Entering a scripted sequence
- Becoming disabled
- Being retuned by the player or resistance systems

Blade animation must remain efficient at long range.

Use shared animation logic, shader-driven rotation, or batched transforms where appropriate.

---

# Water Tower

Create modular water-tower variants:

- Elevated spherical tank
- Elevated cylindrical tank
- Municipal standpipe
- Rusted rural tower
- Synod communications retrofit
- Partially collapsed tower

Composable pieces:

- Tank
- Legs
- Cross-bracing
- Ladder
- Maintenance platform
- Antenna
- Warning light
- Pipework
- Fence
- Access building

The water tower should register as:

- Long-distance landmark
- Compass target
- Possible map marker
- Audio emitter
- Climbable hero location
- Observation point

Support an interior resonance zone for hollow or drained tanks.

---

# Power Lines and Utility Corridors

Implement power infrastructure as a spline- or corridor-driven system.

It must support:

- Utility poles
- Transmission towers
- Crossarms
- Insulators
- Transformers
- Wires
- Substations
- Maintenance tracks
- Cleared vegetation corridors

Do not model each wire as dense geometry over long distances.

Use one of the following, depending on existing architecture and measured performance:

- Babylon.js line systems
- Tubes with distance-based segmentation
- Shader-generated curves
- GPU-friendly cable strips
- Simplified distant wire representation
- No visible wires beyond a validated threshold

Create a reusable utility-corridor builder:

```ts
export interface UtilityCorridorConfig {
  path: Array<{ x: number; y?: number; z: number }>;
  poleSpacingMeters: number;
  poleVariantIds: string[];
  wireCount: number;
  sagAmount: number;
  maintenanceTrack?: boolean;
  vegetationClearanceMeters: number;
  poweredState: 'active' | 'intermittent' | 'dead';
}
```

Power corridors should integrate with:

- Terrain height sampling
- Vegetation exclusion
- Trail generation
- Navigation
- Electrical hum
- Drone or mech-animal traversal logic
- Compass interference zones

---

# Self-Storage Facility

Build self-storage facilities from modular pieces.

Required modules:

- Storage unit row
- Corner section
- Office
- Vehicle gate
- Perimeter fence
- Security camera pole
- Exterior light
- Asphalt lot
- Drainage area
- Signage
- Individual unit doors

Use instancing for repeated unit sections and doors.

Hero variants should support individually addressable units.

Each storage unit may contain a lightweight narrative inventory.

Example:

```ts
export interface StorageUnitStory {
  unitId: string;
  doorState: 'open' | 'closed' | 'locked' | 'damaged';
  contentsProfileId?: string;
  narrativeArtifactIds?: string[];
  audioCueId?: string;
  searchedStateKey?: string;
}
```

Do not load every unit interior at once.

Use:

- Streaming
- Interior activation volumes
- Pooled prop sets
- Deferred loading
- Shared collision
- Unit-level state serialization

The repetitive metal structures should support distinctive sound propagation and reflections without requiring expensive full acoustic simulation.

---

# Regional Airport

Create a small regional or municipal airport as a composite hero location.

Potential modules:

- Runway
- Taxiway
- Apron
- Small terminal
- Control tower
- Hangars
- Fuel area
- Weather station
- Radar or navigation beacon
- Perimeter fence
- Maintenance roads
- Runway lights
- Abandoned aircraft
- Drone infrastructure

The airport builder should be driven by structured data rather than one monolithic mesh.

Example:

```ts
export interface RegionalAirportConfig {
  runway: {
    lengthMeters: number;
    widthMeters: number;
    headingDegrees: number;
    condition: 'maintained' | 'cracked' | 'overgrown';
  };

  hangars: Array<{
    id: string;
    offset: { x: number; z: number };
    variantId: string;
    accessible: boolean;
  }>;

  controlTower?: {
    enabled: boolean;
    accessible: boolean;
  };

  synodConversion?: {
    enabled: boolean;
    droneOperations: boolean;
    acousticBeacon: boolean;
  };
}
```

Use decals, texture masks, or tiled materials for runway markings rather than large unique textures.

The runway should create a broad vegetation exclusion region.

---

# Two-Lane Highway

Implement the highway using the existing spline, road, terrain, or corridor system.

Required features:

- Two traffic lanes
- Center line
- Edge lines
- Shoulder
- Terrain conforming
- Vegetation exclusion
- Guardrail support
- Sign placement
- Intersections
- Driveways
- Drainage features
- Cracks and damage
- Overgrowth parameters

Example:

```ts
export interface RuralHighwayConfig {
  path: Array<{ x: number; y?: number; z: number }>;
  laneWidthMeters: number;
  shoulderWidthMeters: number;
  surfaceCondition: number;
  overgrowth: number;
  centerLineStyle: 'solid' | 'dashed' | 'mixed' | 'faded';
  trafficState: 'none' | 'rare' | 'active' | 'phantom-audio-only';
}
```

The road system must expose hooks for:

- Future vehicle driving
- AI pathfinding
- Encounter placement
- Roadside narrative objects
- Audio zones
- Highway landmark generation
- Intersections with utility corridors
- Airport access roads
- Farm access roads

Avoid baking the entire highway into one enormous high-detail mesh.

Chunk it for culling, streaming, collision, and terrain updates.

---

# Compass System

Implement the compass as a physical, diegetic artifact.

It should not merely be a HUD heading strip.

Required capabilities:

- Equip and unequip
- Inspect in first person
- Display magnetic north
- Read player heading
- Support objective bearings
- Register visible landmarks
- React to interference zones
- Preserve a distinction between true north and indicated north
- Support annotations or ownership history
- Serialize player discovery state

Example:

```ts
export interface CompassReading {
  playerHeadingDegrees: number;
  magneticNorthDegrees: number;
  indicatedNorthDegrees: number;
  interferenceStrength: number;
  nearestLandmarkBearing?: number;
}

export interface CompassInterferenceSource {
  id: string;
  position: { x: number; y: number; z: number };
  radiusMeters: number;
  strength: number;
  falloff: 'linear' | 'quadratic' | 'custom';
  frequencyHz?: number;
}
```

The compass should generally remain trustworthy.

Interference should be:

- Localized
- Discoverable
- Consistent
- Driven by world systems
- Reversible when the player leaves the affected area
- Debuggable

Avoid arbitrary random needle movement.

Possible interference sources:

- Active power lines
- Substations
- Synod machinery
- Windmill arrays
- Buried infrastructure
- Damaged airport navigation equipment

Provide a development overlay showing:

- True north
- Player heading
- Indicated heading
- Interference vectors
- Landmark bearings

---

# Landmark Registry

Create or extend a landmark registry.

Every major rural structure should be optionally available to:

- Compass navigation
- Map generation
- Fast-travel systems, if they exist later
- World streaming
- AI navigation
- Audio occlusion or propagation approximations
- Narrative discovery
- Save-state tracking
- Debug overlays

Example:

```ts
export interface LandmarkRecord {
  id: string;
  label: string;
  kind: RuralFeatureKind;
  position: BABYLON.Vector3;
  discoveryRadiusMeters: number;
  compassMode: 'hidden' | 'bearing-only' | 'named';
  discoveredStateKey: string;
}
```

Do not couple the compass directly to scene meshes.

The compass should query the landmark registry or world-state service.

---

# Geographic and Deterministic Placement

All major features must support explicit placement.

Repeated features should also support deterministic procedural placement.

Placement modes may include:

- Exact world coordinates
- Latitude/longitude
- Along a spline
- Inside a polygon
- Clustered around a hero location
- Along a utility corridor
- Along a road
- Terrain-aware scatter
- Rule-based placement near another feature

Example rules:

```ts
{
  kind: "farm-silo",
  placementMode: "cluster",
  nearFeatureId: "farmstead-01",
  minDistanceMeters: 30,
  maxDistanceMeters: 120,
  count: 3,
  seed: "north-farm-silos"
}
```

Procedural placement must be reproducible.

Use seeded random generation.

Store or derive stable IDs.

Do not allow placement order changes to silently move unrelated landmarks.

Prefer per-feature or per-region seeds over one global mutable random sequence.

---

# Terrain Integration

Every structure builder must declare how it interacts with terrain.

Possible requirements:

- Sample terrain elevation
- Flatten terrain
- Apply local grading
- Create foundation
- Cut a road
- Clear vegetation
- Preserve selected trees
- Add drainage
- Reject steep slopes
- Rotate to terrain normal
- Remain vertically aligned regardless of terrain normal

Example:

```ts
export interface TerrainPlacementPolicy {
  elevationMode: 'sample' | 'flatten' | 'foundation' | 'fixed';
  maxSlopeDegrees: number;
  clearanceRadiusMeters: number;
  vegetationPolicy: 'preserve' | 'clear' | 'thin';
}
```

Hero structures should not float, sink, or inherit unrealistic terrain tilt.

---

# Vegetation Integration

Integrate with the existing forest and thin-instance vegetation system.

Each rural feature must be able to declare:

- Hard exclusion zone
- Soft thinning zone
- Regrowth profile
- Edge vegetation profile
- Roadside vegetation
- Maintenance clearance
- Abandonment age
- Ecological disturbance

Examples:

- Power lines create long cleared corridors.
- Airports create broad grass or scrub zones.
- Roads clear a central corridor with variable shoulder growth.
- Silos may be surrounded by former fields becoming young forest.
- Storage lots may crack and support weeds.
- Water towers may create fenced clearings.
- Windmill arrays may alter animal distribution.

The vegetation system should consume feature exclusion data rather than rural features manually deleting unrelated meshes after generation.

---

# Audio Integration

Each structure may expose an audio profile.

Possible audio layers:

- Wind interaction
- Structural creaks
- Electrical hum
- Rotor rhythm
- Metal resonance
- Airport beacons
- Distant road noise
- Fence movement
- Interior reverberation approximation
- Synod activation tones
- Animal response
- Mechanical maintenance sounds

Example:

```ts
export interface RuralAudioProfile {
  ambientLoopIds: string[];
  oneShotIds?: string[];
  activationRadiusMeters: number;
  attenuationModel: string;
  occlusionMode?: 'none' | 'simple' | 'zone-based';
  modulationSource?: 'wind' | 'time' | 'power-state' | 'scripted';
}
```

Avoid one audio source per thin instance.

For repeated infrastructure, use:

- Clustered audio emitters
- Shared regional ambience
- Nearest-source selection
- Pooled emitters
- Distance-based activation
- Audio zones

Windmill arrays should support phase relationships through data.

---

# Synod Retrofit System

Do not create separate unrelated “normal” and “Synod” assets wherever a modular retrofit will work.

Create a retrofit layer that can add:

- Acoustic resonators
- Antennas
- Sensor packages
- Warning lights
- Cabling
- Control boxes
- Broadcast horns
- Drone docks
- Synod markings
- Barriers
- Maintenance platforms

Example:

```ts
export interface SynodRetrofitConfig {
  enabled: boolean;
  retrofitKitId: string;
  operationalState: 'inactive' | 'monitoring' | 'broadcasting' | 'damaged' | 'resistance-modified';
}
```

This allows a normal water tower, silo, windmill, or airport beacon to be visually and functionally transformed without duplicating the complete base structure.

---

# Environmental Storytelling

Support lightweight narrative data on hero locations.

Possible story channels:

- Printed signs
- Maintenance logs
- Unit numbers
- Faded municipal names
- Photographs
- Tools
- Personal storage
- Improvised resistance markings
- Synod inspection tags
- Damaged equipment
- Abandoned vehicles
- Audio recordings
- Camera artifacts
- Hidden compartments

Keep narrative data separate from visual construction.

Example:

```ts
export interface EnvironmentalStoryProfile {
  id: string;
  artifactIds: string[];
  propSetIds: string[];
  stateRequirements?: string[];
  discoveryEvents?: string[];
}
```

A location builder should receive a story profile ID rather than containing hardcoded story text.

---

# Runtime Lifecycle

Each feature must have a clear runtime lifecycle.

Suggested states:

```ts
type FeatureRuntimeState = 'unloaded' | 'proxy' | 'distant' | 'near' | 'hero' | 'suspended';
```

Transition based on:

- Player distance
- Camera visibility
- Narrative state
- Audio relevance
- Interior occupancy
- Debug overrides

Avoid repeatedly disposing and recreating expensive assets during small distance fluctuations.

Use hysteresis in streaming thresholds.

Example:

```ts
loadNearDistance: 500;
unloadNearDistance: 600;
loadHeroDistance: 100;
unloadHeroDistance: 140;
```

---

# Performance Requirements

The system must be suitable for dense outdoor scenes.

Track:

- Draw calls
- Active meshes
- Triangle count
- Material count
- Texture memory
- CPU time
- GPU frame time
- Thin-instance count
- Audio source count
- Collision cost
- Shadow casters
- Streaming transitions

Use thin instances where:

- Geometry is identical
- Per-instance interaction is unnecessary
- Individual animation is unnecessary or can be shader-driven
- Per-instance state can be encoded efficiently

Use regular instances where:

- Limited per-instance state is needed
- Shared geometry remains useful
- Individual transforms or visibility are required

Use unique meshes only for:

- Hero locations
- Interactable structures
- Destructible or stateful geometry
- Unique narrative landmarks

---

# Shadow Strategy

Not every rural feature should cast full dynamic shadows.

Support per-tier shadow settings:

- Hero: full or selective shadows
- Near: simplified shadows
- Distant: no shadows or baked approximation
- Scatter: limited shadow casters
- Power lines: generally no wire shadows at distance
- Runway lights and small props: no shadows
- Windmill blades: shadows only within a validated range

Expose shadow policy through data.

---

# Collision Strategy

Use simplified collision geometry.

Collision categories:

- None
- Bounding box
- Bounding capsule
- Convex proxy
- Compound primitive
- Simplified mesh
- Full hero collision

Roads should use chunked collision.

Repeated storage units should share collision shapes.

Power wires should normally have no collision.

Utility poles, fences, and structural supports should use simple proxies.

---

# Interaction Strategy

Interactions should be component-driven.

Possible interactions:

- Climb ladder
- Open storage door
- Inspect sign
- Activate machinery
- Disable windmill
- Read compass
- Enter airport tower
- Play recording
- Search storage unit
- Restore power
- Retune acoustic device

Do not place interaction logic inside mesh-loading code.

Use existing interaction components or create a minimal reusable adapter if none exists.

---

# Debug Tooling

Add a rural-infrastructure debug layer to the existing development HUD.

Required toggles:

- Show landmark IDs
- Show placement seeds
- Show geographic coordinates
- Show feature bounds
- Show exclusion zones
- Show streaming ranges
- Show LOD state
- Show collision proxies
- Show audio radii
- Show compass interference
- Show utility splines
- Show road splines
- Show vegetation-clearance regions
- Force hero representation
- Force distant representation
- Disable Synod retrofits

Add a summary panel showing:

```txt
Loaded rural features
Hero features
Distant proxies
Thin instances
Draw calls
Triangles
Active audio emitters
Streaming operations
```

---

# Validation

Build automated and runtime validation.

Validate that:

- Every feature ID is unique
- Every referenced asset exists
- Every source asset has provenance data
- Every placement has a stable seed
- Geographic and world coordinates resolve correctly
- LOD paths exist
- Collision profiles exist
- Audio profiles exist
- Story profiles exist
- Landmark registry references are valid
- No road section exceeds slope constraints
- Utility poles do not float
- Hero structures have foundations
- Vegetation exclusions are applied
- Compass interference values remain bounded
- Runtime representation transitions are valid

Validation failures should identify the exact feature and manifest path.

---

# Testing Requirements

Use the repository’s existing test tools.

Likely tests include Jest and Playwright, but confirm actual configuration.

Add unit tests for:

- Seeded placement stability
- Coordinate conversion
- Landmark registration
- Compass bearing calculation
- Compass interference falloff
- LOD selection
- Streaming hysteresis
- Feature manifest validation
- Road chunk generation
- Utility-pole spacing
- Windmill synchronization groups

Add integration tests for:

- Loading a rural test region
- Moving between streaming ranges
- Discovering a landmark
- Equipping the compass
- Entering and leaving an interference zone
- Opening a storage unit
- Disabling an acoustic windmill
- Reloading saved world state

Where graphical regression infrastructure exists, add representative screenshots for:

- Farm cluster
- Windmill field
- Water tower
- Power corridor
- Storage facility
- Regional airport
- Highway segment
- Compass view

---

# Initial Deliverable Scope

Do not attempt to build the entire production region in one pass.

Implement a vertical slice containing:

1. One procedural farm silo
2. One acoustic windmill with safe simulated effects
3. One modular water tower
4. One short utility corridor
5. One small self-storage facility with several streamed units
6. One simplified airport runway and hangar
7. One two-lane highway segment
8. One physical compass
9. One landmark registry
10. One shared placement manifest
11. One debug overlay
12. Automated tests for deterministic placement and compass behavior

Create a small demonstration region in which:

- The highway crosses the environment.
- The storage facility sits beside the highway.
- The water tower is visible beyond it.
- Power lines cross the road and continue toward the forest.
- Silos sit near an abandoned farm.
- Several windmills form an acoustic array.
- The airport runway lies beyond the farm.
- The compass can identify discovered landmarks.
- The compass deviates consistently near active electrical or Synod infrastructure.

The vertical slice should prove the architecture before large-scale asset production begins.

---

# Suggested Demonstration Layout

Use deterministic coordinates or the existing geographic mapping system.

Illustrative relationships:

```txt
Highway
  ├── Self-storage facility
  ├── Utility corridor crossing
  ├── Access road to farm
  │     ├── Silo cluster
  │     └── Acoustic windmill field
  ├── Water tower near former town boundary
  └── Airport access road
        ├── Runway
        ├── Hangar
        └── Control tower
```

The exact coordinates should be defined in data.

---

# Example Region Profile

```ts
export const ruralPrototypeRegion = {
  id: 'rural-prototype-region',
  seed: 'dissonance-rural-prototype-v1',

  environmentProfileId: 'temperate-rural-reclaimed',

  features: [
    {
      id: 'highway-01',
      kind: 'two-lane-highway',
      scale: 'hero-location',
      placement: {
        placementMode: 'spline',
        seed: 'highway-01',
        worldPosition: { x: 0, z: 0 },
      },
      visualProfileId: 'rural-highway-faded',
      tags: ['road', 'navigation', 'vehicle-ready'],
    },
    {
      id: 'storage-01',
      kind: 'self-storage',
      scale: 'hero-location',
      placement: {
        placementMode: 'explicit',
        seed: 'storage-01',
        worldPosition: { x: 180, z: 90 },
        headingDegrees: 82,
      },
      visualProfileId: 'storage-abandoned',
      narrativeProfileId: 'storage-family-archives',
      tags: ['archaeology', 'interior', 'roadside'],
    },
    {
      id: 'water-tower-01',
      kind: 'water-tower',
      scale: 'landmark',
      placement: {
        placementMode: 'explicit',
        seed: 'water-tower-01',
        worldPosition: { x: 900, z: -450 },
      },
      visualProfileId: 'water-tower-synod-retrofit',
      audioProfileId: 'water-tower-low-hum',
      tags: ['landmark', 'compass-target', 'synod'],
    },
  ],
} satisfies RuralRegionDefinition;
```

Adapt this example to actual project types.

---

# Documentation

Create documentation covering:

- Package purpose
- Architecture
- Feature categories
- Asset import workflow
- Licensing workflow
- Manifest format
- Placement system
- LOD conventions
- Terrain integration
- Vegetation integration
- Audio integration
- Compass integration
- Adding a new rural feature
- Adding a hero location
- Debugging placement
- Performance budgets
- Known limitations

Include a concise “add a new feature” example from definition through runtime placement.

---

# Implementation Standards

Use:

- Strict TypeScript
- Explicit public interfaces
- Discriminated unions
- Dependency injection where the repository already uses it
- Small focused modules
- Deterministic generation
- Reusable builders
- Shared resources
- Clear disposal semantics
- Tests for pure logic
- Documentation for public APIs

Avoid:

- Monolithic scene classes
- Hidden global state
- Runtime asset downloads
- Unseeded randomness
- One material per object
- One audio emitter per thin instance
- Hardcoded positions scattered through scene code
- Direct coupling between compass code and meshes
- Duplicate world-building pipelines
- Large opaque configuration objects
- Premature replacement of existing systems

---

# Expected Output

Complete the work in the following order:

## 1. Repository Assessment

Provide:

- Relevant existing packages
- Systems to extend
- Proposed file layout
- Risks
- Assumptions

## 2. Architecture Proposal

Provide:

- Module boundaries
- Core types
- Data flow
- Runtime lifecycle
- Integration points

## 3. Vertical-Slice Implementation

Implement the smallest complete test region containing all eight requested feature categories.

## 4. Tests

Add deterministic placement, manifest, landmark, streaming, and compass tests.

## 5. Documentation

Document how future content creators can source or build additional assets and place them through data.

## 6. Performance Report

Record baseline measurements for the demonstration region, including:

- Draw calls
- Triangles
- Materials
- Texture memory
- Active meshes
- Thin instances
- Audio emitters
- Frame timing
- Streaming behavior

## 7. Follow-Up Backlog

Provide a prioritized backlog separating:

- Required production work
- Optimization work
- Art improvements
- Narrative integration
- Experimental acoustic effects

Do not claim the task is complete unless the demonstration region runs, the major integration points are exercised, and the tests pass.
