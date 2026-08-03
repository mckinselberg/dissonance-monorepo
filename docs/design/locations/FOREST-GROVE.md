# Forest Grove (outside) — forest impasse ring / grove clearing / secret entrance

**Status:** Phase 1 landed  
**Owning thread:** T7  
**Canonical scope:** the `forest-grove` `locations.json` entry — impasse zones, the grove clearing, and the one secret entrance  
**Does not own:** general foliage/scatter systems (`BulkForestSystem`, `TrailsideForestSystem`), the forest palette/shader direction (T22), audio zones (T5/T9), navmesh (O20), the shelter structure itself (T35, `FalloutShelterEntrance.ts` — see "Co-location" below)  
**Runtime owner:** `apps/world`  
**State owner:** `apps/world/public/data/locations.json` (`forest-grove` entry, `forestImpasse` field)  
**Presentation owner:** Babylon world (`ForestImpasses.ts`, `HeroTreeInstances.ts`)  
**Depends on:** T1/T2 (locations.json/profile authoring pattern), T26 (stable-identity substrate)  
**Consumed by:** none yet — a self-contained content pocket  
**Decisions:** none yet  
**Open questions:** O20  
**Last reviewed:** 2026-08-01

## What this is

Executes the design intent of `docs/intake/world-foliage-impasse-prompt-v1.md`
(T7: hand-placed impasses defining navigable space, one authored grove
clearing, one discoverable secret entrance) — but that doc is filed under
`docs/intake/`, which `docs/README.md` marks non-canonical and unreconciled,
and it specifies a pipeline this app doesn't have: a Blender-authored scene
baked into one terrain+foliage `.glb`, per-log convex-hull collision, and an
open question about coupling to a tile-based navmesh. `apps/world` has no
navmesh and no mesh collision at all — every collider in the app (props,
utility poles, buildings, the fallout-shelter thicket) is a circle
(`{x, z, radius}`, `packages/world/src/ForestGenerator.ts`'s `Collider` type,
despite that file itself being unused DTA legacy — see THREADS.md's Parking
lot note). This location's content ships through that existing
runtime/data-hybrid pipeline instead: a `locations.json` entry read by
`ForestImpasses.ts`, which thin-instances Quaternius forest assets
(`apps/world/public/models/quaternius-forest/`) and produces `Collider[]`
for `WorldFeaturesSystem` to aggregate — the same shape as
`FalloutShelterEntrance.ts`/`UtilityCorridors.ts`.

## Co-location with the underground bunker (T35)

`forest-grove`'s `latLong` is deliberately the *same* coordinate as
`mountain-crater` — the existing `locations.json` entry that owns the
fallout-shelter entrance (`shelterEntrance`, built by
`FalloutShelterEntrance.ts`, reachable from the Dev HUD's "Go to crater
shelter" button). The two are separate `locations.json` entries (so both
get their own distinct Dev HUD dropdown label — "mountain crater" vs.
"forest grove (outside)" — matching the existing
`milos-apartment`/`milos-building` pattern of two named anchors sharing one
real-world spot) rather than one entry carrying both `shelterEntrance` and
`forestImpasse`, but they render on top of each other: the grove's `local:
[0, 0]` center *is* the bunker's own doorway position. That's intentional,
not a collision to fix — the impasse ring (vine-tangle/deadfall/shrub-wall)
now reads as the forest cover that hides the bunker, and the secret
entrance (a gap in `deadfall-west`'s log run) becomes the discovery path
that leads a curious player toward it rather than an arbitrary reward in
open forest. `FalloutShelterEntrance.ts` already scatters its own hero-tree
thicket in a ring (radius 7.5–12.5m) around the same center to disguise the
shelter; this location's canopy ring (radius 12m) and ground cover layer on
top of that rather than replacing it — denser cover around a hidden bunker
reads as more correct, not redundant, but the two systems were not tuned
against each other and some overlap is expected. Fine-grained visual
de-confliction (exact snag/grove offset vs. the shelter door and its own
colliders) is a follow-up polish pass, not done this session.

## Layout

One `locations.json` entry (`forest-grove`, `latLong: [40.755397,
-74.274582]` — `mountain-crater`'s own coordinates, see above) anchors
everything below via `LocationEntry.forestImpasse`. All positions are local
meters from that anchor (same convention as `corridor`/`shelterEntrance`),
carried over from the source doc's own relative layout (its Blender-space
coordinates translated to offsets from the grove center):

| Zone | Kind | Local (m) | Notes |
|---|---|---|---|
| `vine-tangle-north` | vine-tangle | (-20, 40) | one blocking collider disc, radius 20m |
| `deadfall-east` | deadfall | (60, 0) | log row, heading 90°, half-length 12.5m |
| `deadfall-west` | deadfall | (-80, -30) | log row, heading 90°, half-length 9m; owns the secret passage |
| `shrub-wall-south` | shrub-wall | (-30, -80) | dense, no collider — passable |
| grove | — | (0, 0), radius 12 | canopy ring + ground cover, no interior colliders |
| snag | — | (5, -5) | landmark, one small collider |
| secret passage | — | (-80, -25) | gap in `deadfall-west`'s log run |

### Zone collision, per the source doc's own split

- **vine-tangle:** "nearly opaque... non-passable by default" → one generous
  blocking disc at the zone center. No per-instance colliders — coarse and
  eyeballed, same philosophy as `LocationProps.ts`'s `PROP_COLLISION_RADII`.
  Instance density is area-based (per m², not per radius-meter — a disc's
  area grows with the square of its radius, so an early per-radius formula
  left large zones visibly sparser than small ones) and mixes real trees
  (`BirchTree_4/5`, `MapleTree_4/5`) in with the bush layer, not bushes
  alone — a sparse bush-only scatter left an invisible collider covering
  bare-looking ground (Dan, 2026-08-01: "it's just a half invisible circle
  that's completely impassable... we need trees, too").
- **deadfall:** "small gaps between logs are passable — this is where
  creativity happens" → real per-instance colliders (`DeadTree` placements
  every ~2.4m along a line through the zone's `local` at `headingDegrees`),
  so the natural log-to-log gaps read as minor squeeze-throughs even outside
  the authored secret passage.
- **shrub-wall:** "acceptable to pass through with friction/audio penalty" →
  dense instances, deliberately zero colliders. Friction/audio are Phase 2
  (see below); today it's simply passable.

### Grove clearing

Six canopy anchors (alternating Birch/Maple) ring the clearing at its
authored radius; ground cover (grass/flower clumps) scatters inside at 85%
of that radius; the standing snag (`DeadTree_10`, scaled up ~1.9x vertically)
sits near the center as the wayfinding landmark, with its own small collider.
No colliders anywhere else inside the clearing — "cleared... no foliage
collision within the bowl," per the source doc.

### Secret entrance (source doc's Option A: low deadfall pass)

Chose Option A (low deadfall passage) over B (vine-obscured — this asset
pack has no vine/rope geometry) and C (split-rock — no rock assets in scope).
Matches the source doc's own recommendation ("most tactile, least tech-heavy,
strongest discovery reward").

Implementation: `deadfall-west`'s log run skips one instance (and its
collider) at the point closest to the secret passage's authored `local`
position, flanked by real logs on both sides — the gap is a property of
*which log is missing*, not a separate passable/impassable flag. A few
ground-cover instances (ferns/flowers) mark the gap mouth as the one visual
tell this Phase-1, geometry-only pass can give ("moss on log undersides,
small ferns poking through," per the source doc's texture note).

## Known Phase-1 simplifications

- **No per-instance rotation.** `HeroTreeInstances.loadHeroTreeInstances` —
  the shared thin-instance primitive every tree/bush/deadfall placement in
  this app goes through — only supports upright placement with random
  Y-facing and uniform XZ/Y scale; there's no hook for laying a trunk on its
  side. Deadfall therefore reads as a dense standing dead-wood thicket, not
  literal cross-hatched fallen logs. Extending the shared primitive for
  arbitrary per-instance orientation would touch every other caller
  (bulk/trailside forest, the fallout-shelter thicket) for a cosmetic gain
  this phase doesn't need.
- **No collision height.** `Collider` is a 2D circle with no vertical
  extent, so the secret entrance's "duck under" isn't gated at the collision
  level — a player can walk through standing upright. The existing crouch
  key (`Ctrl`; `PlayerController`'s `CROUCH_HEIGHT = 0.9` vs.
  `STAND_HEIGHT = 1.7`) still makes crouching the natural read: standing eye
  height clips into the low overhead geometry, crouched eye height clears
  it. That's an emergent, camera-only version of the intended mechanic, not
  an enforced one.
- **Density is area-based but below the source doc's own per-square-meter
  target** (0.7–0.9/m², tree-only, would put hundreds of full trees in even
  a modest shrub-wall zone) — vine-tangle runs ~0.09/m² and shrub-wall
  ~0.05/m² with these mixed bush+tree assets, tuned to read as continuous
  cover rather than match the doc's literal density number; these are small
  authored pockets, not a `BulkForestSystem`-scale field.
- **No audio, no wind-sway/animation on the new impasses, no navmesh
  coupling (O20).** All match the source doc's own explicit Phase 1/Phase 2
  boundary — geometry and collision only.

## Verification

`pnpm --filter world exec tsc --noEmit` and `pnpm --filter world build` both
pass. Browser-verified via the Dev HUD's Navigation → Locations → "forest
grove (outside)" teleport: all `quaternius-forest` assets fetch 200/304 (no
404s), the canopy ring renders with visibly distinct Birch/Maple foliage
plus ground cover at the expected position, and no new console errors
appear. Full
first-person traversal of every zone (confirming the deadfall colliders
block movement and the secret gap doesn't) was not automated this session —
the collider math was hand-traced instead (see `ForestImpasses.ts`'s gap
projection) and mirrors the already-shipped `UtilityCorridors`/
`FalloutShelterEntrance` collider patterns.
