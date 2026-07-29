# Scale Tuning — Why Real Terrain Needs Exaggeration, and Three Ways to Do It

## The problem

South Mountain Reservation's real relief is gentle — this isn't a guess, it's
measured directly from the DEM data:

| Statistic | Value |
|---|---|
| Elevation range | 152.2m (24.74m – 176.90m) |
| Footprint | 5672m × 4332m |
| Mean slope (per DEM cell) | **6.3°** |
| Median slope | 4.2° |
| p90 slope | 13.7° |
| p99 slope | 30.6° |
| Max slope | ~86.9° (almost certainly the Hemlock Falls dam/cliff) |

At true scale (1 world unit = 1 real meter, no exaggeration), a human-scale
player (1.7m eye height, 4.5–10.5 m/s walk/sprint speed) experiences this as
essentially flat — real hiking trails are gentle by design. To make hills and
valleys *read* as hills and valleys at game/human scale, the vertical and/or
horizontal axes need to be exaggerated relative to reality.

## Two different ways to exaggerate, and why they're not equivalent

**Vertical-only exaggeration** (`verticalExaggeration` on `HeightmapTerrain`,
horizontal axes untouched) stretches only the Y axis. This **distorts real
slope angles** — a real 6° slope becomes `atan(exaggeration × tan(6°))`. At
10x, that's ~48°; at 10x, the p90 slopes (13.7° real) become ~68°; p99 (30.6°
real) becomes ~80°, essentially a wall. Cranking this too far turns a gently
rolling reservation into a landscape of near-vertical cliffs.

**Uniform X/Y/Z scale** (`horizontalScale` set equal to
`verticalExaggeration`) grows the *whole world* proportionally instead. True
slope angles are preserved exactly — nothing gets steeper than reality — the
map is just physically bigger. A player whose own size/speed stays at real,
unscaled values automatically becomes *relatively* smaller and slower
against the enlarged world — the same perceptual effect as shrinking the
player, achieved from the other direction, with no slope distortion.

## The three levels this POC ended up with

Selected via `?level=1|2|3` in the trail-viewer URL (or the links in the UI
panel). Config lives in `apps/trail-viewer/src/main.ts`'s `LEVELS` map.

### Level 1 — exaggerated relief, shrunk player

```
verticalExaggeration: 10, horizontalScale: 1, playerScale: 0.1, gridResolution: 700, farClip: 10000
```

Y-only exaggeration (mean slope → ~48°). To compensate, the player's own
physical size (`PlayerControllerOptions.scale`) is shrunk to 1/10th —
`eyeHeight`/`crouchHeight`/collision radius all scale down, but **not**
movement speed (only explicitly asked for the "eyeline"/size to shrink). This
keeps the player feeling proportionate against terrain that's now
dramatically steeper than reality. World stays true-sized (~5.7km), so
Babylon's default `camera.maxZ = 10000` comfortably covers it.

### Level 2 — uniform 7x world scale

```
verticalExaggeration: 7, horizontalScale: 7, playerScale: 1, gridResolution: 1000, farClip: 60000
```

True slopes preserved; the whole world is rendered ~7x bigger (~40km across).
Player stays at real, unscaled size/speed, which makes it relatively tiny/slow
against the much bigger world — no separate player-shrinking needed.

Two real bugs surfaced building this one, both worth remembering:

1. **Babylon's `Camera.maxZ` defaults to 10000 units.** Level 2's ~40km
   world blows straight past that, so most of the terrain simply wasn't
   drawn — it looked like "the trail floating in empty space, terrain only
   visible when turning to face it." This is why `PlayerControllerOptions`
   grew a `farClip` option, and why every level's config carries an explicit
   `farClip` sized to that level's actual rendered world extent.
2. **Mesh resolution doesn't automatically follow `horizontalScale`.**
   `HeightmapTerrain`'s vertex loop samples the *original fine-resolution
   DEM* directly (via `HeightmapSampler`) regardless of mesh density — but
   the *rendered* mesh only has vertices every `(real cell size) ×
   horizontalScale` meters apart, linearly interpolating between them. At
   `gridResolution: 700` (chosen so 1 mesh quad ≈ 1 DEM pixel at
   `horizontalScale: 1`), scaling horizontally by 7x stretches each quad to
   ~57m in rendered space — coarse enough, up close, that the flat-shaded
   mesh surface can visibly diverge from the precise `getHeightAt()` value
   used for player collision (reported as "the player ending up underground
   in some spots"). `gridResolution` was bumped to 1000 for level 2
   (~40m quads) as a partial mitigation — **not a full fix**. See "Known
   limitation" below.

### Level 3 — true scale, orbit view

```
verticalExaggeration: 1, horizontalScale: 1, cameraMode: 'orbit', gridResolution: 700, farClip: 10000
```

The original Phase 3/4 validation view, preserved as a mode rather than
deleted once the player was added: a free `ArcRotateCamera` (drag to orbit,
scroll to zoom, right-drag to pan) over the true-scale model, no player or
collision involved. Useful as a "ground truth" reference to compare the two
playable levels against.

## Known limitation: uniform scaling and mesh density don't compose cheaply

Making the *rendered* mesh quad size at `horizontalScale: S` match level 1's
density would require multiplying `gridResolution` by roughly `S` too — at
`S=7` that's `gridResolution ≈ 4900`, i.e. a ~24 million vertex single mesh.
Not feasible in real time as one flat `CreateGround`. The practical ceiling
for a single static mesh is somewhere well under that, meaning **level 2 (or
any uniform-scale level beyond a modest factor) will always render coarser
up close than level 1**, unless the terrain is chunked with proper
level-of-detail — out of scope for this POC. If a future iteration needs
uniform scaling *and* fine close-up detail simultaneously, that's the
direction to look (streaming/chunked terrain, not a single mesh).

## The math, if you want to reproduce this for a different exaggeration value

- World X/Z: 1:1 real UTM meters, unless `horizontalScale` is set.
- World Y: `renderedHeight = realElevationMeters × verticalExaggeration`.
- Rendered slope at a point where the real slope is `θ`:
  `atan(verticalExaggeration × tan(θ))` (vertical-only) — this is *not*
  linear, steep real slopes blow up disproportionately fast.
- Uniform scaling (`horizontalScale == verticalExaggeration == S`) leaves
  slope angle unchanged; it just multiplies every real-world distance
  (including "how far you have to walk") by `S`.
- Player physical size and movement speed are independent knobs
  (`PlayerControllerOptions.scale` vs. the hardcoded `PLAYER_CONFIG` walk/
  jog/sprint speeds in `packages/player/src/defaults.ts`) — this POC only
  ever scaled physical size, not speed, per what was actually asked for.
