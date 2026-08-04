# Category Object Scaling

**Status:** implementation-ready specification

**Thread:** T38

**Runtime scope:** `apps/world`

**Decision:** D47

**Date:** 2026-08-03

## Purpose

World currently has separate terrain `horizontalScale` and
`verticalExaggeration` controls, but several object loaders also use those
values as object dimensions. Changing the map can therefore make a building
taller, widen a terminal, or resize a tree even when the asset itself did not
change.

This effort introduces independently persisted horizontal and vertical object
scale controls for four categories:

- structures;
- vegetation;
- props;
- agents.

The result must let terrain exaggeration, geographic spacing, and object size
be tuned independently while preserving grounding, collision, interaction,
animation, and saved-view behavior.

## Design intent: calibration and dysphoria

This system has two related purposes, and implementation must preserve both.

First, World combines models from many sources with different authored units,
export conventions, and assumed dimensions. It needs an ordinary, believable
baseline in which a dog, doorway, tree, terminal, and building read at realistic
sizes relative to one another. Asset calibration establishes that baseline;
category controls make it practical to tune related assets together without
re-exporting source files.

Second, once the ordinary baseline is trustworthy, independently changing the
horizontal and vertical scale of selected categories can create deliberate
dysphoric spatial effects: vegetation can become oppressively tall, structures
can feel compressed or impossibly narrow, or agents can become subtly wrong in
relation to the world around them. The effect works because the player first
has a coherent scale relationship to lose.

Persisted category values belong to the calibration/authoring layer. A future
diegetic effect must be a separate, transient modulation layered on top; it must
not overwrite saved calibration values. T38 provides a composable scale
resolver seam but does not author the trigger, envelope, radius, audio cause, or
narrative event for that effect.

THREADS P11 (transform reality, not assets) favors this profile-driven approach.
D47 resolves the former O12 fork: diegetic distortion is perceptual only.
Transient modulation never alters collision, navigation, interactions, saves,
multiplayer state, or simulation coordinates.

## Coordinate-space contract

The implementation must keep these concerns distinct:

1. **Source space:** geographic positions and elevation samples in real meters.
2. **Terrain/render space:** source X/Z multiplied by terrain H-scale; sampled
   elevation multiplied by terrain V-exaggeration.
3. **Asset calibration:** a fixed conversion from an asset's authored units to
   World meters. This belongs beside the asset definition, not in saved user
   settings.
4. **Category calibration:** an editable, persisted
   `{ horizontal, vertical }` multiplier applied to calibrated object geometry.
   Horizontal means X/Z; vertical means Y.
5. **Placement override:** an optional authored multiplier for one placement.
   Existing uniform `scale` remains supported and applies to both axes.
6. **Transient modulation:** a non-persisted `{ horizontal, vertical }`
   multiplier reserved for deliberate dysphoric effects. Its identity value is
   `{ horizontal: 1, vertical: 1 }`.

For an object at a geographic point:

```text
renderX = sourceX * terrainHorizontalScale
renderZ = sourceZ * terrainHorizontalScale
groundY = sampledElevation * terrainVerticalExaggeration

baselineScaleXZ = assetCalibrationXZ * categoryHorizontal * placementScaleXZ
baselineScaleY  = assetCalibrationY  * categoryVertical   * placementScaleY

visualScaleXZ = baselineScaleXZ * transientHorizontal
visualScaleY  = baselineScaleY  * transientVertical
```

Terrain H/V values must not appear in the baseline or visual object scale.
Changing terrain scale may move an object's root and change its ground height;
it must not change the object's dimensions.

Gameplay geometry always resolves from baseline scale and never follows
transient modulation.

Changing category scale changes geometry, not geographic positions, compound
spacing, patrol paths, scatter density/radius, or movement speed.

## Category ownership

| Category | Initial consumers | Scale-dependent gameplay data |
|---|---|---|
| Structures | Compound buildings and interiors, grade pads, terminals, fallout-shelter shell, utility poles and wires | Building/pole colliders, floors, doors, docking and structure-local interaction anchors |
| Vegetation | Trailside and bulk forest instances, shelter concealment trees, other World-owned trees/stumps/deadfall | Tree footprints where collision exists; ground offsets |
| Props | Location props, Lineglass parts, loose exterior fixtures not classified as structures | Prop colliders, pickup radii, prop-local interaction anchors |
| Agents | Pet/mech dog and boulevard patrol drones | Visual bounds, ground offset, proximity/contact radius where it represents body size |

Backdrop mountains/clouds, terrain, water, overlays, particles, interior UI,
and cameras are not object-scale consumers. Furniture permanently attached to
a scaled interior follows its structure transform rather than receiving the
props multiplier a second time.

Mixed systems must classify their children explicitly. For example, the
fallout-shelter shell is a structure while its concealment trees are vegetation.

## Data and state

Add an app-local object-scaling state module. Do not extract a shared package
until a second app consumes the contract.

```ts
type ObjectScaleCategory = 'structures' | 'vegetation' | 'props' | 'agents';

type AxisScale = {
  horizontal: number;
  vertical: number;
};

type ObjectScaleSettings = Record<ObjectScaleCategory, AxisScale>;
```

All eight values must:

- default to `1` after asset calibration;
- be finite and positive;
- persist per level through the existing settings path;
- round-trip through Copy View, Load View, and `public/data/views.json`;
- tolerate older settings and snapshots where the object-scale block is absent.

Prefer one optional nested `objectScale` field in settings/snapshots over eight
new unrelated top-level keys. Loading normalizes missing categories or axes to
`1`; serialization writes the complete normalized block.

The location placement contract may grow optional `scaleXZ` and `scaleY`
fields. Resolution order is:

1. use the axis-specific placement value when present;
2. otherwise use the existing uniform `scale` when present;
3. otherwise use `1`.

This is a backward-compatible data extension. Existing location JSON need not
be rewritten as part of the first implementation.

## HUD and update behavior

Add an **Object scale** group to the World tuning module with H/V controls for
each category. Initial range: `0.25`–`3`, step `0.05`, displayed to two decimal
places. These are authoring controls, not player-facing options.

Category changes must not rebuild terrain, water, overlays, clouds, or
mountains.

- Vegetation should update existing thin-instance matrices.
- Agents should update their visual root transforms and recompute grounding.
- Structures and props may use focused dispose/rebuild paths in the first pass,
  retaining the existing generation guards for asynchronous glTF loads.
- A category rebuild must not reset story state, collected parts, patrol state,
  doors, the active controller, or the camera.

If preserving a transient door/agent state across a focused rebuild is not
practical, update the existing handle in place instead of accepting state loss.

## Gameplay geometry rules

Visual scaling and gameplay geometry must share the same resolved category and
placement scale.

- X/Z collider footprints use resolved horizontal scale.
- Vertical offsets, floor heights, door heights, and grounded mesh offsets use
  resolved vertical scale.
- Local X/Z anchors use horizontal scale; local Y anchors use vertical scale.
- Geographic placement coordinates continue to use terrain H-scale.
- Ground lookup continues to use terrain H/V through `ITerrain`.
- Interaction ranges that describe physical reach from an object's body may
  scale horizontally. Minimum usability padding and player reach do not scale.
- Agent route speed, pursuit thresholds, and patrol paths remain unchanged
  unless a value is explicitly derived from physical body bounds.

Non-uniform agent scale is applied at the imported model root. It must be
checked across idle, walk/gallop, pet/reaction, patrol, and inert animations for
unacceptable skeletal or grounding artifacts.

## Migration inventory

The implementation pass must audit at least these current seams:

- `CompositeLocations.ts`: remove terrain H/V from mesh dimensions while
  retaining it for geographic placement and ground sampling; update grade
  bounds, colliders, interiors, floors, doors, and interaction anchors.
- `WorldTerminals.ts`: replace `root.scaling.setAll(horizontalScale)` with
  resolved structure H/V scaling; keep geographic placement separate.
- `UtilityCorridors.ts`: separate pole/wire dimensions from corridor positions
  and pole spacing.
- `FalloutShelterEntrance.ts`: classify shelter geometry and concealment
  vegetation separately.
- `TrailsideForestSystem.ts`, `BulkForestSystem.ts`, and
  `HeroTreeInstances.ts`: converge initial-load and later-reposition formulas;
  category V-scale must not alternate between terrain H-scale and terrain
  V-exaggeration.
- `LocationProps.ts` and `LineglassParts.ts`: apply props scaling to visuals and
  matching collision/pickup geometry without changing landmark coordinates.
- `MechDogBody.ts`/`MechDogController.ts` and boulevard patrol drones: apply
  agent scaling without scaling routes or movement speed.
- `settingsStorage.ts`, snapshot builders/loaders, and the World HUD: persist
  and restore the normalized category block.

## Implementation sequence

1. Add pure scale types, normalization, and a resolver with unit tests.
2. Add persistence and snapshot round-trip tests before wiring UI controls.
3. Migrate vegetation first because its H/V instance API already exists; fix
   initial-load/reposition parity.
4. Migrate structures, including collision and interior transforms.
5. Migrate props and their pickup/collision behavior.
6. Migrate agents and verify animation/grounding.
7. Add HUD controls and focused update callbacks.
8. Calibrate asset defaults and run the validation matrix.

## Acceptance criteria

The effort is complete when all of the following are true:

1. With category scales held constant, changing terrain H/V moves and grounds
   every object correctly without changing its measured width or height.
2. Changing one category's H-scale changes only that category's X/Z dimensions
   and matching physical footprint.
3. Changing one category's V-scale changes only that category's height and
   vertical local offsets.
4. Unselected categories do not resize, and category scaling does not change
   authored placement spacing or scatter density.
5. Colliders, floors, doors, pickups, docking, petting, and agent grounding
   remain aligned with visible geometry at minimum, default, and maximum scale.
6. Initial load, live edits, Copy/Load View, saved-view selection, and browser
   reload produce the same scale values and visual result.
7. Older saved settings and view JSON without `objectScale` load with normalized
   defaults and no migration failure.
8. Focused tests, `pnpm --filter world test`, and
   `pnpm --filter world build` pass.
9. Manual browser verification covers levels 1–3, all movement modes that exist
   on each level, each category at `0.25`, `1`, and `3`, and at least one live
   terrain H/V change after category tuning.
10. The resolver accepts identity transient modulation without changing the
    baseline, and transient values are absent from settings and view snapshots.

## Non-goals

- Changing terrain-generation or DEM-sampling math.
- Scaling object placement density, geographic spacing, routes, or speeds.
- Building a general inspector or per-instance runtime editor.
- Automatically inferring real dimensions from arbitrary glTF files.
- Authoring the trigger, timing envelope, spatial radius, audio driver, or
  narrative content of a dysphoric scale effect.
- Making transient distortion authoritative or persisting it as world state.
- Moving the contract into a shared package before a second consumer exists.
- Altering the preserved museum exhibit.

## Risks and expected effort

The sliders and state are small. The material work is keeping compound
interiors, gameplay geometry, thin-instance updates, and animated roots aligned
while removing several different legacy interpretations of terrain scale.

Expected implementation size is three to five focused development days:

- approximately half a day for state, UI, normalization, and persistence;
- one to one-and-a-half days to migrate render consumers;
- half to one day for collision and interaction geometry;
- one to two days for asset calibration and browser verification.

If only visual mesh scaling is implemented, this estimate falls to roughly one
to two days, but that reduced scope does not satisfy this specification.
