# EXP2 Fog: Culling & Atmosphere

## The Formula

```
visibility = exp2(-density² × distance²)
```

The pixel's final color blends toward fog color based on that visibility factor:

```
final = mix(pixelColor, fogColor, 1.0 - visibility)
```

**In plain terms:** exponential fog thickens *aggressively* at distance. Objects fade hard and fast. No long gradient—hard cutoff into mist.

---

## Why EXP2 vs. Alternatives

| Model | Formula | Behavior | Use Case |
|-------|---------|----------|----------|
| **Linear** | `1.0 - (distance / fogEnd)` | Constant thickening rate | Simple, predictable, unrealistic |
| **EXP** | `exp(-density × distance)` | Exponential thickening | Gradual fade-out; still soft |
| **EXP2** | `exp2(-density² × distance²)` | **Aggressive exponential** | **Hard, fast fade; ideal for culling** |

---

## For Dissonance: Why EXP2 Works

### 1. **Culling is invisible**
Objects disappear into fog before they'd visibly pop. At 80m+, EXP2 fog has already rendered the object nearly invisible. Stop rendering it entirely—player won't notice.

### 2. **One knob, two outcomes**
Adjust `fogDensity` in your `EnvironmentProfile`, and both the **visual mood** and **cull horizon** shift together. No separate `farClipPlane` constant. One parameter governs performance and aesthetics.

### 3. **Fits the fiction**
Heavy fog that swallows the world is thematically perfect for Dissonance. Not "haze at the horizon"—fog that obscures, constrains, threatens. Ambient surveillance meets ambient weather.

### 4. **Layers with LOD**
- **0–30m:** Hero zone, full detail
- **30–80m:** Billboard/thin-instance zone, fading
- **80m+:** EXP2 fog has already made objects ~95% invisible; culling them is free

---

## Implementation: Babylon.js

```javascript
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
scene.fogDensity = 0.015;  // tune this value
scene.fogColor = new BABYLON.Color3(0.05, 0.08, 0.07); // muted teal-green, match environment profile
```

### Tuning `fogDensity`

| Density | Visual | Cull Horizon (~95% opacity) | Use |
|---------|--------|-----|-----|
| `0.01` | Clear, threatening | ~200m | Open areas, urban-edge |
| `0.015` | Moderate (default) | ~130m | Trail, forest standard |
| `0.02` | Dense, claustrophobic | ~100m | Deep forest, caves |
| `0.03` | Very oppressive | ~65m | Tight encounters, interior spill |

Higher density = tighter world = more aggressive culling.

---

## The Cull Distance Rule

Given a fog density, the distance at which fog reaches ~95% opacity (effectively invisible):

```
cull_distance ≈ log(0.05) / (-density²)
```

**Example:** `fogDensity = 0.015`
```
cull_distance ≈ 2.996 / 0.000225 ≈ 13,300 units
```

(Varies by engine scale and pixel tolerance, but the principle is consistent.)

**Implication:** Change `fogDensity`, and your render horizon changes automatically. No secondary tuning needed. Material on LOD zones stays correct.

---

## Profile Integration

Store fog settings in `EnvironmentProfile`:

```json
{
  "environment": {
    "fog": {
      "mode": "EXP2",
      "density": 0.015,
      "color": [0.05, 0.08, 0.07]
    },
    "lod": {
      "heroZone": 30,
      "billboardZone": 80,
      "cullDerivedFromFog": true
    }
  }
}
```

One profile change reshapes the entire world—visual mood, render distance, and culling behavior.

---

## Hardware Optimization (W530 / GTX 1060)

For older machines, lean on EXP2 hard:

- **W530 (Quadro K2000M, 2GB VRAM):** Use `fogDensity = 0.02–0.03`. Aggressive fog keeps draw calls low. Cull horizon stays tight (60–100m).
- **Alienware GTX 1060:** Can handle `fogDensity = 0.015–0.02`. More breathing room, still disciplined.

**Result:** Both machines maintain 60+ FPS in typical trail/urban scenes without material detail sacrifice.

---

## Visual Tone Notes

EXP2 fog works with Dissonance's palette:

- **Desaturated foliage + teal-on-dark fog:** Creates a suffocating, watched-over feeling. The world is small, the sky is elsewhere.
- **Emissive window dots fading into fog (urban-edge):** Isolation. You're close to civilization but cut off.
- **Fog swallowing distant structures:** Optically matches SignalNet's limited observation range—you can't see the whole system either.

The fog becomes a character: it limits knowledge, it threatens, it's ambiguous.

---

## Testing / Tuning

1. **Adjust `fogDensity` in real time** (Dev HUD or live profile reload)
2. **Record draw-call count** at different densities (Babylon's Inspector shows this)
3. **Check for visual pops** — if objects disappear before fog masks them, fog density is too high or LOD transitions are too sharp
4. **Listen for audio zone transitions** — if audio culling isn't synced to fog cull, it breaks immersion (audio is louder than visuals suggest)

---

## Related Threads

- **T5 (Reactive Environment):** Fog density shifts with detection state (hunted → denser fog)
- **T7 (World Population):** Fog cull horizon constrains render scope for scatter geometry
- **T6 (Landscape Profiles):** Each biome has a `fogDensity` variant in its profile

---

## Reference

- Babylon.js Fog: https://doc.babylonjs.com/features/featuresDeepDive/Meshes/fog
- Scene fog modes: `FOGMODE_NONE`, `FOGMODE_EXP`, `FOGMODE_EXP2`, `FOGMODE_LINEAR`
