# Rural Infrastructure

**Status:** canon + placement/asset/acoustic contracts reconciled; silo placeholder, highway on-foot hookup, and compass HUD readout all landed 2026-08-04

**Thread:** T28

**Runtime scope:** `apps/world`

**Date:** 2026-08-04

## Purpose

Seven pre-Synod rural infrastructure categories — windmill, water tower, farm
silo, self-storage facility, regional airport, two-lane highway, physical
compass — as landmark/traversal content for World. Power lines are an eighth,
already-shipped category (visual corridor only, poles + sagging wires,
`UtilityCorridors.ts`); treat as done, not part of this backlog's open work.

**Provenance:** this reconciles `docs/intake/dissonance-infrastructure-lore-CORRECTED.md`,
`infrastructure-placement-prompt-CORRECTED.md`,
`infrastructure-asset-creation-prompt-CORRECTED.md`, and
`infrastructure-acoustic-atmosphere-prompt-CORRECTED.md` (all now deleted —
folded in here) into one canonical doc. Those in turn corrected an earlier
package that had wrong thread numbers (T18/T22 confused for T20/World) and,
in its own "corrected" pass, introduced new errors: dropping compass from
scope, inventing a placement schema that duplicated an already-shipped
system, and fabricating an acoustic-signature claim. All fixed here. The
original rejected `@dissonance/rural-infrastructure` engineering prompt is
archived at `docs/archive/prompts/superseded/dissonance-rural-infrastructure-integration-prompt.md`
— it proposed a full offline asset-provenance/LOD pipeline and an eight-
category package in one pass; repo audit found its core assumptions
(`EnvironmentProfile`, `applyProfile()`, `locationBuilder`) didn't exist, and
only the power-line slice actually shipped. It contains real unmined ideas
(a generic Synod-retrofit layer, a runtime streaming-state lifecycle, a
vegetation-exclusion contract, a rural-industrial shared material family that
overlaps T30) worth a future look, but none of it is adopted here — this doc
deliberately stays small, per that history.

## Overarching lore

The landscape contains the ghosts of the pre-Synod era: communication
(highways, power distribution, water infrastructure, silos, storage) and
movement (airports, rail, utilities). Synod policy repurposed material
rather than cleared it — windmills became acoustic apparatus, towers became
surveillance mounts, power lines became EM backbone, silos hold compressed
reserves or buried data. Airports are functionally defunct; runways become
reference geometry and long-sightline traps. Every element is a dual-use
answer to "what does the Synod do with inherited systems?" — suppression and
repurposing, not demolition.

## Category ownership and status

| Category | Owner | Status | Gate |
|---|---|---|---|
| Windmill | T20 + T28 | Provisional | T20 acoustic doctrine |
| Water tower | T26 + T28 | Provisional | T26 landmark-identity |
| Farm silo | T20 + T17 + T28 | Provisional, **placeholder landed** | T20 wrongness doctrine (for the wrongness-seed variant only — plain silo is unblocked) |
| Self-storage | T22 (pattern) + T28 | Provisional | none blocking — reuses T22's existing per-prop story-profile pattern as data |
| Regional airport | T28 | Experimental, very low priority | largest build by far; don't start here |
| Two-lane highway | T28 | Provisional, **on-foot speed hookup + patrol-dog exposure consequence landed** | none — placement mechanism already shipped |
| Physical compass | T21 + T28 | Provisional, **HUD readout landed** | T27 zone-field blending (for the full diegetic item only — HUD readout is unblocked) |
| Power lines | T28 | Done (visual only) | none |

Fauna (birdsong, forest understory, small animals) are **not** T28 content —
they belong to T19 (Wildlife) and T20 (Acoustic), and may be referenced
*from* infrastructure entries (e.g. "windmill's signature is masked by
birdsong at dawn") without being owned here.

## Category entries

### Windmill
Pre-Synod grain/water mill retrofitted with acoustic emitters, resonant
chambers, EM field inductors. Slow mechanical rotation (not a turbine),
synced to surveillance-zone patterns or time-of-day acoustic cover.
**This is primarily a T20 feature wearing a windmill's silhouette** — visual
blade rotation must split from acoustic/behavioral state via a
`BehaviorProfile`-like pattern, and multiple windmills in one field should
support a shared synchronization group (in-phase or phase-offset). Narrative
functions: acoustic masking near the base; Synod presence without patrol
(mechanical regularity signals observation without embodiment); a wrongness
seed (unnatural rhythm, mid-cycle stop); salvaged-blade artifacts as a
collectible anchor. Material: weathered cast iron, asymmetric rust
(wind-exposure), Synod addenda bolted over original bearing housings, one
dented blade against three intact ones, moss-grown pre-Synod concrete stamps.

### Water tower
Decommissioned municipal storage, one per major basin/region boundary,
visible 2-3km in clear conditions. Vertical sightline anchor and dead-
reckoning landmark (T21 navigation), must support T26 stable landmark
identity from day one (not built as an anonymous scatter piece). Hollow-
metal-shell reverb makes voicecasting against it read differently than open
ground. Interior: rotted stairs, cap platform, tight-vertical-space acoustic
trap (claustrophobic high-frequency reverb, ambush geometry). EM shielding
from the tower's mass creates a device-coverage dead zone in its shadow — an
inversion of T11 signal-as-geography (safety from digital observation,
exposure to acoustic pursuit instead). Material: scaled/flaked rust over
original town-seal paint, solid/missing ladder bolts forcing an alternate
climb route, jammed-or-open cap hatch, an interior mineral-stain waterline
marking decommission time.

### Farm silo
Sealed pre-Synod agricultural storage, now a buried data repository, grain
reserve, or sensory lab (Synod infrasound/compression/resonance
experimentation). Clustered in agricultural hubs, tall (40-80m) but
optically recessive — weathered concrete, vertical repetition, blends into
fog at range, dangerous up close. Sealed low-frequency hum that shifts pitch
with wind; may sharpen the acoustic pursuer's detection cone near a cluster
(structural resonance). Wrongness seed (provisional, T10-gated): infrasound-
damaged animals nearby with distinct behavioral tells (rocking gait,
vibration hypersensitivity) sensed through distress calls, never directly
observed. Collectible trap: a valve/hatch fitting is high-value but removing
it triggers a location-broadcasting acoustic event. Player cannot enter —
traversal obstacle and acoustic landmark only. Material: vertical
corrugation/fluting, moisture streaks below a rusted cap band, a ~3m hatch
with broken/missing welded ladder steps, a moss-covered concrete pad, no
graffiti (actively Synod-policed).

**Implementation status:** landed — `buildFarmSilo` (`LocationProps.ts`), a
`farm-silo` `PROCEDURAL_ASSETS` entry, an `OBSTACLE_COLLISION_RADII` entry,
T30 weathering variation, and a 3-silo test cluster (`farm-silo-cluster-01`
in `locations.json`). See "Placement and asset contracts" below.

### Self-storage facility
Half-abandoned commercial complex, one per major settlement (T16 hub
geometry), edge-of-town placement. Interior/exterior boundary is a
traversal/acoustic transition zone. A unit that should be sealed but isn't
holds personal, pre-Synod or disappeared-persons contents — collectible
spiral context. Hard metal surfaces and tight corridors change the acoustic
signature from open forest (louder footsteps, odd echo propagation) and
create small-scale navigation confusion (hallway maze, worse in fog/low
light). One unit is a Synod sealed cache (structural-integrity tape,
bolted, surveillance tag) — standing in front >10s triggers an acoustic
alert; teaches players to map prohibited spaces. First candidate for a
hybrid interior-exterior traversal test (roofed corridors, open ends, mixed
acoustic classes). **Per-unit narrative state reuses T22's existing DTA
shed/fountain/picnic per-prop story-profile pattern as data — one profile
per unit, not hardcoded text, and not a new system.** Material: rust-through
corrugated panels, rusted/crooked roll-up doors with faded numbers, cracked
oil-stained concrete, interior graffiti (resistance trace) vs. absent
exterior graffiti (surveillance).

### Regional airport
Decommissioned civilian airport; overgrown runway, sealed/repurposed
terminal. Not functional — a spatial landmark and potential interior test-
bed. Vast empty runway is an alien-scale experience; crossing it is a
committed, maximally-exposed act with a distinct audio signature. Terminal
artifacts (ID badges, uniform pieces, signage) as collectible context.
Possible Synod acoustic-lab site (conditional T20 wrongness). **The single
largest build in this backlog by a wide margin — don't start here.**
Establish silo/tower/storage patterns first.

### Two-lane rural highway
Unmaintained pre-Synod road connecting settlements: cracked asphalt, blown
soil, center-line invasive growth. Line-of-sight corridor, acoustically
distinctive (hard-surface reflection amplifies exposure rather than masking
it — the inverse of the windmill). Exposure-vs-speed trade: faster on-foot
travel, maximally exposed; a pursuer's route-finding may favor highways too.
Collectible context via an abandoned vehicle, roadside marker, or mile-post.

**Placement is already solved** — see "Placement and asset contracts" below.
**Exposure consequence: landed (2026-08-04).** `RoadPatrolDog.ts` dispatches
a hostile mech-dog patroller, seeded from the road's own data
(`LocationEntry.road.patrol` — presence and type live on the road entry
itself, not a separate hand-authored list). Patrols the road via
`RoadHandle.positionAtDistance` back and forth; detecting the player within
`detectionRadiusMeters` switches it to active pursuit, reusing the same
standoff-based `PursuerSystem` behavior the existing companion mech dog
already uses (closing distance and being visibly threatening is the
consequence — no catch/fail state, consistent with D2 and
`MechDogController`'s own precedent). Loses interest and resumes patrol
after a sustained-distance cooldown, picking the road's nearest point to
resume from (`RoadHandle.nearestPointOnRoad`). Physically collides with the
player via the same `PlayerController.setDynamicColliders` mechanism the
companion dog uses. Asphalt surface itself also got real normal/roughness
detail this pass (`RoadNetwork.ts`'s asphalt material was albedo-only) —
lane markings stayed out of scope: the city kit's only decal sheet is urban
crosswalk/stop-sign signage, wrong register for an unmaintained rural road.

### Physical compass
Not a tool — a diegetic navigation subsystem combining magnetic bearing with
a Synod-issued waypoint device, broken or partially broken (stuck needle,
cracked casing; coarse bearing only). Points toward the nearest EM source
(power line, silo, buried cable) instead of true north, or oscillates
uncertainly — teaches that tech is unreliable in the Synod landscape. Dusk/
dawn accuracy worst (solar interference, provisional), noon most reliable.
Early collectible, paired with the player's lost keys/phone in the
collectible spiral.

**Not greenfield** — `packages/navigation` (`CompassReading`, `MapPlacard`,
`NearbyLandmark` types; `bearingBetween`, `distanceBetween`,
`createMapPlacard` functions) already exists. It's currently dead code: not
a listed `apps/world` dependency, zero imports. First slice (landed) is a
HUD bearing/nearby-landmark readout in the existing Lineglass Navigation
panel — no new 3D prop, no collectible pickup yet. The full diegetic item
(physical pickup, broken-needle prop, "compass deviates near active
infrastructure") is a deliberately deferred second phase: that deviation
behavior is a natural first consumer of T27's zone-field blending once it
lands, not a bespoke interference system to build now.

## Placement and asset contracts

### Point landmarks (windmill, water tower, silo, self-storage, airport)

`locations.json` is a plain JSON array (not GeoJSON) of `LocationEntry`
objects (`apps/world/src/world/LocationProps.ts`). Add an optional
`infrastructure` metadata block, coexisting with the existing `props`/
`compound`/`corridor`/`road` fields the same way those already coexist:

```json
{
  "id": "farm-silo-cluster-north",
  "name": "Northern Farm Silos",
  "latLong": [40.756, -74.273],
  "infrastructure": {
    "category": "silo",
    "metadata": {
      "acoustic": { "signature": "silo-resonance", "maskingRadius": 150, "frequency": [30, 80] },
      "narrative": { "storyProfile": "silo-mysterious" },
      "landmark": { "compassTarget": true, "identity": "landmark-farm-silos-north" }
    }
  },
  "compound": {
    "cellMeters": 12,
    "placements": [
      { "asset": "farm-silo", "grid": [0, 0] },
      { "asset": "farm-silo", "grid": [1, 0] }
    ]
  }
}
```

`infrastructure.metadata.landmark.identity`/`compassTarget` bind to T26 once
that lands; `metadata.acoustic.signature` names a T20 emitter contract (see
below); `metadata.narrative.storyProfile` is only relevant to self-storage
for now. None of this blocks the silo placeholder, which needs only `compound`.

**Validation (once T26/T20/narrative systems exist to check against):**
acoustic signature names must be known to T20; landmark identities must be
unique across all locations; a narrative `storyProfile` must resolve to a
defined profile, no orphaned IDs.

### Highway (linear, not a point landmark)

**Already solved — do not add a `compound` polyline shape.**
`LocationEntry.road` (`path` or `routeFile`, `widthMeters`, `pullOffs`),
consumed by `apps/world/src/world/RoadNetwork.ts`, is shipped and live: it
builds a terrain-draped asphalt ribbon with dirt shoulders, and already
drives the `sr-27-service-road` vehicle-travel sequence
(`VehicleSession.ts`). A second road, `grove-to-dissonance-blvd`, is already
authored and renders — it just has no gameplay hook yet. An `infrastructure`
metadata block can sit alongside `road` on the same entry if acoustic/
landmark hints are wanted, exactly like `props`/`compound`/`corridor` already
coexist as independent optional fields on one entry.

### Silo asset (first implementation slice)

Procedural placeholder, not a Blender model — same convention as
`buildUtilityPole`/`buildStreetLamp` in `LocationProps.ts`: one exported
`buildFarmSilo(scene): Mesh` (tapered cylinder body + conical roof),
registered in `CompositeLocations.ts`'s `PROCEDURAL_ASSETS` map, thin-
instanced across every `'farm-silo'` placement via the existing
`expandCompoundPositions` → `placeProceduralAsset` path (no new plumbing). A
real Blender-authored asset can replace the template later without touching
placement — only the `PROCEDURAL_ASSETS` entry changes.

Per-instance weathering variety reuses T30's shipped
`ScatterVariationMaterialPlugin` (`@dissonance/materials`,
`createScatterMaterial`) — per-thin-instance hue/value jitter via an instance
buffer, already verified live at 144 instances / 60fps in
`apps/materials-demo`. This replaces the earlier drafts' proposal of separate
mesh/material entries per weathering tier, and a `placement.variant` field
that doesn't exist on `LocationEntry.compound.placements`.

Silo needs an `OBSTACLE_COLLISION_RADII` entry (`CompositeLocations.ts`) —
per its lore, it's a sealed traversal obstacle, not walk-through scatter.

Poly-budget numbers in earlier intake drafts (three different, mutually
inconsistent figures) were never sourced from T24 — T24's actual THREADS.md
text has never specified a concrete poly count for anything. Treat any
number here as an estimate to validate against the FPS readout, not a spec.

## Acoustic contracts (what T28 needs, not how T20 implements it)

T20 owns the DSP; this is coordination only. For each category, T28 supplies
a signature name + emission parameters, T20 implements the emitter:

| Category | Signature need | Masking | Exposure | Modulation |
|---|---|---|---|---|
| Windmill | 80-180 Hz, periodic (blade RPM) | yes | gradient | wind-driven RPM (T25) |
| Water tower | 40-120 Hz, sealed-metal resonance | no | gradient | stochastic (wind) |
| Silo | 30-80 Hz, sealed-container resonance | no | gradient | none baseline / wrongness variant (T10-gated) |
| Power line | continuous 60Hz+harmonics | yes (narrow) | no | none — **not yet implemented, see below** |
| Highway | 100-5000 Hz, hard-surface reflection | no (amplifies instead) | yes | none |
| Self-storage | 200-8000 Hz, interior reverberation | no | yes | none |
| Compass | 2-4 kHz, tick on bearing update | no | no | none (HUD slice has no audio yet) |

**Power lines are visual-only today.** An earlier intake draft claimed T20
"already has" the 60Hz signature — checked (`packages/audio`,
`apps/world/src/audio`): it doesn't exist. T20's Phase 0 audit hasn't run.

Integration seam (once T20's Phase 0 lands): a landmark coming into view
(T21/T26 culling) spawns its T20 emitter; going out of view releases it.
Time-of-day/weather changes (T25) drive modulation — windmill RPM, tower
resonance, compass tick cadence — through whatever seam T20's audit defines;
not designed here.

## Non-goals

- A general offline asset-provenance/LOD pipeline, a new `@dissonance/rural-infrastructure` package, or any multi-week/multi-category simultaneous build — this is the mistake T28's own history already made once (see Provenance above).
- Changing terrain/DEM math or geographic spacing.
- Building T20's acoustic DSP, T26's landmark-identity system, or T27's zone-field blending — this doc specifies what infrastructure needs from them, not their implementation.
- A general per-instance placement variant field — use T30's material-plugin approach instead where per-instance visual variety is wanted.

## Open questions

Tracked in `docs/OPEN-QUESTIONS.md` (O24+): windmill blade-rotation speed
source, silo clustering pattern, and whether self-storage's narrative state
needs a dedicated interface beyond reusing T22's pattern as-is. See that file
for current status — not duplicated here to avoid drift between two copies.
