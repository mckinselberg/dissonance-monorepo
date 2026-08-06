# Render Pipeline — T24 Dispatch Brief

> **Status, 2026-08-03:** tracked intake/engineering brief for T24. The
> original “15-minute quick start” is preserved below as a design target, not
> as documentation of code or packages that already exist in this repository.
> Any implementation session must complete the repository audit in this brief
> before choosing package boundaries or writing runtime integration.

## Original Proposal Goal

Get from "messy 20+ object types" to "automatic LOD culling in your game" in
one session. This is the source document's aspiration, not the repository-
conformed estimate for the dispatch scope below.

---

## Repository Assessment

### What the original proposal describes

The proposal sketches a four-tier distance-LOD pipeline:

1. an offline CLI renders hero meshes into billboard atlases;
2. a manifest records atlas files and UV rectangles by stable type id;
3. the runtime registers hero, thin-instance, billboard, and impostor
   representations of one object population;
4. distance thresholds switch or blend between those representations;
5. the Dev HUD reports active tiers, draw calls, vertices, update time, and
   editable thresholds.

Its nominal tiers are hero at 0–30m, thin instances at 30–60m, billboards at
60–100m, then an impostor or hard cull beyond 100m. The later sections include
atlas expansion, validation, troubleshooting, speculative performance numbers,
and a browser-console stats check.

### What exists now

World has the first, deliberately smaller T24 foundation:

- `BulkForestSystem` and `TrailsideForestSystem` cache their full render-space
  placement arrays.
- On a 0.25-second throttle they filter those arrays by camera X/Z distance and
  upload only the visible subset through `HeroTreeInstances.setPlacements()`.
- `distanceCulling.ts` owns the pure radius filter and skips redundant
  thin-instance uploads when the visible set has not changed.
- The persisted **Vegetation culling → Cull radius** World HUD control supplies
  the live cutoff, initially defaulted from the active environment profile's
  `foliage.impostorRadius`.
- Beyond that radius vegetation is currently hard-culled. There is no billboard
  or impostor representation to receive the same population yet.

The trailside hero-detail scatter and bulk decimated scatter are currently
different populations at different positions. They are not two LOD tiers of
one tree population, so simply cross-fading those existing systems would make
trees teleport rather than change representation.

### Assumptions in the original proposal that are not true here

Repository search confirms that these proposed surfaces do not exist:

- `packages/@culture/render-pipeline`;
- `@culture/world`;
- `instanceTaxonomy.ts`;
- `setupLODIntegration()`;
- the proposed `assets/` source hierarchy;
- a generated billboard/impostor manifest;
- `RENDER_PIPELINE_INSTRUCTIONS.md`.

The monorepo uses `@dissonance/*` package names, and World assets currently
live primarily under `apps/world/public/models/`. Generated runtime assets must
not be written into an ephemeral Vite `dist/` directory. The original API and
code samples are therefore pseudocode, not an integration recipe.

The performance numbers are also hypotheses. Acceptance must be measured on
the target older machine rather than inferred from the document's 20–60 FPS
examples.

## Dispatch Scope

### Phase 0 — required audit

Before implementation, inspect and report back on:

1. `docs/THREADS.md` T24 and
   `docs/design/world/CATEGORY-OBJECT-SCALING.md` T38;
2. `BulkForestSystem.ts`, `TrailsideForestSystem.ts`,
   `HeroTreeInstances.ts`, and `distanceCulling.ts`;
3. `environmentRenderingProfile.ts`, the live vegetation-cull signal, its HUD
   control, persistence, and saved-view path;
4. existing tree source/decimated assets and their authored bounds/materials;
5. available repo tooling for deterministic offscreen image rendering and
   atlas packing;
6. the correct generated-asset output location and whether generated artifacts
   should be committed or reproducibly rebuilt.

Do not create the assumed `@culture/*` packages or a parallel culling manager.
Extend the existing World/T24 ownership unless the audit demonstrates a real
second consumer that justifies a shared package.

### Recommended first implementation slice

Prove one tree type end to end before generalizing:

1. Use one authoritative placement population.
2. Produce one lower-cost representation and one billboard representation from
   the same calibrated source asset.
3. Define the smallest versioned manifest needed to locate those artifacts and
   their bounds/atlas rectangles.
4. Hand the same placement transforms between near, mid, billboard, and current
   hard-cull tiers using existing profile/HUD distance values.
5. Add hysteresis or a short cross-fade so threshold jitter does not flicker.
6. Preserve hard culling as a safe fallback when a manifest or far-tier asset
   cannot load.
7. Expose tier counts and update cost through the existing Dev Lineglass/World
   HUD patterns; do not add a second global debug surface or `window as any` API.

Do not start by supporting 20 object types, terrain impostors, collision-proxy
pooling, or a new general taxonomy. Those are follow-on work after one species
proves the asset bake, manifest, runtime handoff, and measured performance win.

### Scale contract

Every representation of an object must resolve from the same T38 asset and
category calibration. Do not repair tier mismatches with one-off code such as
`thinTree.scaling.y *= 1.05`. A billboard's captured bounds, pivot, and ground
contact must match the hero/thin source at category scale 1 and continue to
match when category H/V changes.

Transient dysphoric scale modulation follows D47: it may alter what is rendered,
but collision, navigation, interactions, saves, and multiplayer state remain on
the calibrated authoritative baseline.

### Acceptance for the first slice

- One tree population transitions through its implemented tiers without moving
  position, changing apparent ground contact, or visibly changing calibrated
  size.
- A missing/invalid far-tier manifest degrades to today's hard-cull behavior
  with a useful diagnostic and no scene-load failure.
- The live cull/LOD controls persist and round-trip through saved views.
- Tier counts and transition/update cost are visible in the existing HUD.
- The World test suite and production build pass.
- Before/after FPS, frame time, draw calls, and memory are recorded on the target
  older machine at a named view and population count.

---

## Original Quick-Start Proposal (Reference Only)

## Prerequisites

- All your hero 3D meshes are in `assets/` (organized by type)
- You've populated `instanceTaxonomy.ts` with at least 10 types
- You have Node.js 18+ and pnpm

---

## Step-by-Step

### 1. Add CLI Commands to package.json (1 min)

In `packages/@culture/render-pipeline/package.json`:

```json
{
  "scripts": {
    "render:all": "ts-node bin/cli.ts all",
    "render:billboards": "ts-node bin/cli.ts billboards",
    "render:impostors": "ts-node bin/cli.ts impostors"
  }
}
```

### 2. Create Minimal Render Config (2 min)

Create `render-config-quickstart.json` in project root:

```json
{
  "billboards": [
    {
      "typeId": "tree-oak-hero",
      "heroMeshPath": "assets/trees/oak-hero.glb",
      "outputSize": 512,
      "atlasGridSize": 2,
      "cameraDistance": 1.5,
      "angles": [0]
    },
    {
      "typeId": "tree-spruce-hero",
      "heroMeshPath": "assets/trees/spruce-hero.glb",
      "outputSize": 512,
      "atlasGridSize": 2,
      "cameraDistance": 1.5,
      "angles": [0]
    },
    {
      "typeId": "rock-granite-hero",
      "heroMeshPath": "assets/rocks/granite-hero.glb",
      "outputSize": 512,
      "atlasGridSize": 1,
      "cameraDistance": 1.3,
      "angles": [0]
    }
  ],
  "impostors": [],
  "outputDir": "./dist/assets/textures/rendered"
}
```

**Just 3 types to start.** Add more later.

### 3. Run Render Pipeline (2 min)

```bash
cd packages/@culture/render-pipeline
pnpm render:billboards --config ../../render-config-quickstart.json --output manifest.json
```

**Output:**

```
[CLI] Starting render pipeline
[CLI] Command: billboards
[CLI] Config: render-config-quickstart.json
[CLI] Output: ./dist/assets/textures/rendered
[Billboard] Starting render for 3 types
[Atlas] Creating billboard-atlas-2x2-... (1024×1024)
[Billboard] Rendered tree-oak-hero@0° → atlas cell [0, 0]
[Billboard] Rendered tree-spruce-hero@0° → atlas cell [1, 0]
[Atlas] Saved billboard-atlas-2x2-... → billboard-atlas-2x2-1725372000000.png
[Impostor] Starting render for 0 patches
✓ Render complete
Manifest saved: ./dist/assets/textures/rendered/manifest.json
Billboards: 3
Impostors: 0
Atlases: 1
```

Check `dist/assets/textures/rendered/` — you should see:
- `billboard-atlas-2x2-*.png` (all 3 billboards packed)
- `manifest.json` (texture coordinates)

### 4. Integrate Into Scene (5 min)

In your main game setup (e.g., `src/main.ts`):

```typescript
import { setupLODIntegration } from "@culture/world";

async function main() {
  const scene = new BABYLON.Scene(engine);
  const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 5, -10), scene);

  // Load your level...
  await loadMyLevel(scene);

  // ← ADD THIS:
  const lodIntegration = await setupLODIntegration(scene, camera, {
    manifestPath: "/assets/textures/rendered/manifest.json",
    autoLoadEntities: true,
  });

  // Expose to HUD (optional, for tuning)
  (window as any).lodIntegration = lodIntegration;

  return { scene, camera, lodIntegration };
}
```

### 5. Spawn Objects with LOD Names (3 min)

When placing a tree in your world:

```typescript
// OLD:
const tree = scene.getMeshByName("MyTreeObject");

// NEW (for LOD):
const tree = await BABYLON.SceneLoader.ImportMeshAsync(
  undefined,
  "",
  "assets/trees/oak-hero.glb",
  scene
);
tree.meshes[0].name = "tree-oak-hero"; // ← This name is KEY
tree.meshes[0].position = new BABYLON.Vector3(x, y, z);

// Also spawn thin/billboard versions (culling system manages them all)
// ... load oak-thin, oak-billboard with same position, different names
```

### 6. Add HUD Stats (2 min, optional)

Add LOD panel to your Dev HUD (T2):

```typescript
function LODStatsPanel() {
  const integration = (window as any).lodIntegration;
  const stats = integration?.getStats();

  if (!stats) return <div>LOD not loaded</div>;

  return (
    <div class="panel-lod">
      <h3>LOD Culling</h3>
      <div>Active Objects: {stats.totalObjects}</div>
      <div>Draw Calls: {stats.totalDrawCalls}</div>
      <div>Vertices: {stats.totalVertices}</div>
      <div>Time: {stats.time.toFixed(2)}ms</div>
      <div style="margin-top: 8px">
        {Array.from(stats.activeTiers.entries()).map(([cat, count]) => (
          <div key={cat}>
            {cat}: {count} instances
          </div>
        ))}
      </div>
      <div style="margin-top: 8px">
        <label>
          Hero Distance:
          <input
            type="range"
            min="10"
            max="100"
            defaultValue="30"
            onChange={(e) =>
              integration?.setLODThreshold("hero", parseInt(e.currentTarget.value))
            }
          />
        </label>
      </div>
    </div>
  );
}
```

---

## What Happens Now

Walk your camera through the scene:

1. **0–30m:** Hero trees render (full detail, per-instance draw calls)
2. **30–60m:** Thin-instance trees render (lower poly, batched)
3. **60–100m:** Billboard trees render (flat quads, very fast)
4. **100m+:** Fog/impostor tier (single quads or completely culled)

Watch your HUD:
- Draw calls drop as camera moves back
- Active tier counts update
- Vertices shrink
- Culling time stays < 5ms

---

## Next: Expand

Once the 3-type quick-start works:

1. **Add more types:** Edit `render-config-quickstart.json`, add 5 more hero types
2. **Add multi-angle billboards:** Change `"angles": [0]` to `"angles": [0, 90, 180, 270]` for better omnidirectional coverage
3. **Add impostors:** For distant terrain patches, add impostor entries to render config
4. **Tune thresholds:** Use HUD sliders to dial in when each tier appears

---

## Validation Checklist

- [ ] `manifest.json` exists in `dist/assets/textures/rendered/`
- [ ] PNG files look reasonable (clear silhouettes, no garbage)
- [ ] Game loads without errors
- [ ] Camera movement shows hero → thin → billboard → fog transition
- [ ] HUD shows stats updating in real time
- [ ] Draw calls drop as camera pulls back

---

## Troubleshooting

### Render fails with "Cannot load mesh"

**Fix:** Check `heroMeshPath` in config — must be exact path relative to project root.

```bash
# Verify:
ls assets/trees/oak-hero.glb
# If missing, find the real path:
find . -name "*oak*" -type f | grep -i "hero\|\.glb"
```

### HUD shows "LOD not loaded"

**Fix:** Check browser console. Manifest path wrong?

```typescript
// Debug:
fetch("/assets/textures/rendered/manifest.json")
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

### Objects flicker or pop between tiers

**Fix:** Hero and thin-instance meshes have different sizes. Normalize:

1. In Blender: ensure both versions are same bounding box
2. In code: scale on load:
```typescript
const thinTree = await BABYLON.SceneLoader.ImportMeshAsync(...);
thinTree.meshes[0].scaling.y *= 1.05; // Stretch to match hero
```

### Billboard looks completely different from hero

**Fix:** Lighting or angle mismatch during render.

1. Increase outputSize: 512 → 1024
2. Adjust camera distance in config
3. In `renderPipeline.ts`, tweak keyLight intensity

---

## Performance Expectations

With the 3-type config on a mid-range machine:

- **0–30m:** 20–30 fps (hero detail)
- **30–100m:** 50–60 fps (thin + billboard)
- **100m+:** 60 fps (impostor/culled)

If you're way slower, check:

1. Is frustum culling working? (Enable in HUD)
2. Are thin-instances actually batched? (Check drawCallCost in taxonomy)
3. Are audio emitters synced? (Disable if not needed)

---

## One-Liner Test

After setup, run this in browser console to verify LOD system:

```javascript
const stats = window.lodIntegration.getStats();
console.log(`
Active: ${stats.totalObjects} objects
Vertices: ${stats.totalVertices}
Draw Calls: ${stats.totalDrawCalls}
Time: ${stats.time.toFixed(2)}ms
${Array.from(stats.activeTiers.entries()).map(([c, n]) => `  ${c}: ${n}`).join('\n')}
`);
```

Should show tiers switching as you move camera.

---

## Next Docs

- `docs/THREADS.md` — T24 owns forest performance, LOD, and culling.
- `docs/design/world/CATEGORY-OBJECT-SCALING.md` — T38 owns calibrated scale
  shared by every visual tier.
- `AGENTS.md` — repository boundaries, validation, and preserved-museum rules.
- `RENDER_PIPELINE_INSTRUCTIONS.md` does not currently exist.
