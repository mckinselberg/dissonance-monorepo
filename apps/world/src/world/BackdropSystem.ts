import { Color3, Color4, HemisphericLight, Vector3, type Scene } from '@babylonjs/core';
import {
  Sun,
  sunHeightForHour,
  StarField,
  DriftingClouds,
  MountainRing,
  type WaterPlane,
} from '@dissonance/world';
import type { HeightmapContract } from '@dissonance/geo';
import type { AmbientAudio } from '@dissonance/audio';
import type { WeatherMode } from '@dissonance/shared-types';
import { effect, type Signal } from '@preact/signals';
import type { AtmosphereSignals } from '../state/atmosphere';
import type { ScaleTuningSignals } from '../state/scaleTuning';
import type { VisibilitySignals } from '../state/visibility';

// Ported from dont-turn-around's MountainRing (@dissonance/world) to mask
// the DEM's rectangular edge — without it the terrain just stops and the
// void beyond reads as falling off the edge of a cube. DTA's ring is a
// fixed-size circle around a ~340-unit-radius world; this DEM is
// real-world-scale, rescalable (H-scale/V-exagg sliders), and rectangular,
// so the ring uses MountainRing's 'rectangle' shape hugging the DEM's own
// bbox instead of a circle — a circle here would either leave a large gap
// along the flat edges (if sized to clear the corners) or clip through the
// corners (if sized to hug the edges), since this bbox's aspect ratio isn't
// square. Rebuilt alongside the terrain whenever hScale/vExag change.
// Real (unscaled) meters the ring's base sits below the DEM's lowest point,
// so it never floats above the terrain it's meant to be a backdrop for.
const MOUNTAIN_BASE_MARGIN_M = 50;
// Dark blue-grey distant-silhouette tone — reuses DTA's ps3-mode color
// (its most naturalistic profile) rather than tying to the terrain/sky
// color pickers, which is more churn than this needs right now.
const MOUNTAIN_NEAR_COLOR = new Color3(0.06, 0.066, 0.095);

// Overcast dims both the sun and the ambient fill — a real overcast sky
// is heavily diffused light (soft, flat, no strong directional shadow),
// not just "clouds added on top" while the lighting stays sunny.
const OVERCAST_DIMMING = 0.6;

// Owns the sky/backdrop layer as one unit — sun/light/stars (time-of-day
// driven) plus clouds/mountains (hScale/vExag + density driven) — since
// every one of them is disposed and rebuilt from the same handful of
// atmosphere/scale/weather signals. Takes `water` so it can manage the
// clouds'/sun's own reflection render-list membership internally, the same
// way it owns everything else about their lifecycle.
export class BackdropSystem {
  private readonly light: HemisphericLight;
  private readonly sun: Sun;
  private readonly starRadius: number;
  private stars: StarField;
  private clouds: DriftingClouds;
  private mountains: MountainRing;

  constructor(
    private readonly scene: Scene,
    private readonly water: WaterPlane,
    private readonly contract: HeightmapContract,
    farClip: number,
    private readonly atmosphere: AtmosphereSignals,
    private readonly weatherMode: Signal<WeatherMode>,
    private readonly scaleTuning: ScaleTuningSignals,
    private readonly visibility: VisibilitySignals,
    private readonly ambientAudio: AmbientAudio,
  ) {
    this.light = new HemisphericLight('light', new Vector3(0.3, 1, 0.2), scene);
    this.sun = new Sun(scene, {
      hour: atmosphere.timeOfDay.value,
      castShadows: true,
      // Sun's optional flare sprites currently live on Babylon's asset CDN.
      // Leave the local sun disc enabled, but do not make runtime CDN requests.
      lensFlare: false,
      colorTint: Color3.FromHexString(atmosphere.sunTint.value),
    });
    // StarField's default radius (3000) assumed nothing else in the scene
    // would ever be farther than that from the camera — true for DTA's
    // small fixed-size world, false here once the mountain ring/terrain can
    // sit tens of thousands of units out at higher H-scale. A star
    // numerically nearer than the mountain silhouette in front of it wins
    // the depth test and punches through, so pin the dome just inside the
    // camera's own far-clip plane instead — nothing renders beyond maxZ
    // anyway, so this guarantees stars are always the farthest thing on
    // screen, whatever hScale is set to.
    this.starRadius = farClip * 0.95;
    this.stars = new StarField(scene, {
      count: atmosphere.starCount.value,
      color: Color3.FromHexString(atmosphere.starColor.value),
      radius: this.starRadius,
    });
    effect(() => {
      this.stars.setColor(Color3.FromHexString(this.atmosphere.starColor.value));
    });
    effect(() => {
      this.sun.setColorTint(Color3.FromHexString(this.atmosphere.sunTint.value));
    });
    // Reads atmosphere.overcast.value too (inside applyTimeOfDay), so this
    // effect also re-runs on an overcast toggle — the overcast checkbox's
    // own commit handler only needs to trigger rebuildClouds(), not repeat
    // this call itself.
    effect(() => this.applyTimeOfDay(this.atmosphere.timeOfDay.value));

    // Same technique as @dissonance/world's CloudSystem (a decoupled
    // sibling — CloudSystem's sizes/altitudes are hardcoded to DTA's
    // ~800-unit world and gated behind its ExperienceProfile, neither of
    // which fits this real-world-scale DEM viewer). Sized in real meters,
    // then converted the same way terrain/water are: X/Z by
    // horizontalScale, Y by verticalExaggeration.
    this.clouds = this.buildClouds();
    this.clouds.getMeshes().forEach((m) => this.water.addToRenderList(m));
    this.water.addToRenderList(this.sun.getMesh());

    // Rectangle, not circle: hugs the same maxX/maxZ rectangle
    // clampToWorldBounds uses (the DEM's actual bbox, rendered-space) so
    // the ring sits right at the terrain's real edge on every side,
    // corners included — no gap where the terrain just stops and the void
    // behind it used to show through. Independent of whether "Bounded
    // world" (the movement clamp) is on; that toggle only affects walking
    // past the edge, not where the ring sits.
    this.mountains = this.buildMountains();
  }

  getShadowGenerator() {
    return this.sun.getShadowGenerator();
  }

  update(dt: number): void {
    this.clouds.update(dt);
  }

  setCloudsVisible(visible: boolean): void {
    this.clouds.setVisible(visible);
  }

  setMountainsVisible(visible: boolean): void {
    this.mountains.setVisible(visible);
  }

  // Star count only changes via a dedicated slider (not the live hScale/
  // vExag rebuild), so it gets its own rebuild entry point rather than
  // living inside rebuild().
  rebuildStars(): void {
    this.stars.dispose();
    this.stars = new StarField(this.scene, {
      count: this.atmosphere.starCount.value,
      color: Color3.FromHexString(this.atmosphere.starColor.value),
      radius: this.starRadius,
    });
    this.stars.setNightFactor(1 - Math.max(0, sunHeightForHour(this.atmosphere.timeOfDay.value)));
  }

  // Cloud positions/sizes are baked in at construction (unlike water's
  // cheap setScale), so both a scale change and the cloud-density slider
  // rebuild them from scratch.
  rebuildClouds(): void {
    this.clouds.getMeshes().forEach((m) => this.water.removeFromRenderList(m));
    this.clouds.dispose();
    this.clouds = this.buildClouds();
    this.clouds.getMeshes().forEach((m) => this.water.addToRenderList(m));
    this.clouds.setVisible(this.visibility.clouds.value);
  }

  rebuildMountains(): void {
    this.mountains.dispose();
    this.mountains = this.buildMountains();
    this.mountains.setVisible(this.visibility.mountains.value);
  }

  // Ambient fill dims at night too (Sun's own directional light already
  // does this internally) — a bright hemispheric fill at midnight would
  // fight the dark sky/sun color instead of reading as night.
  // sun.setTimeOfDay always resets light.intensity to an absolute value
  // first, so the *= below is safe to run more than once for the same
  // hour/overcast pair — it never compounds.
  private applyTimeOfDay(hour: number): void {
    this.sun.setTimeOfDay(hour);
    const dayFactor = Math.max(0, sunHeightForHour(hour));
    const overcastFactor = this.atmosphere.overcast.value ? OVERCAST_DIMMING : 1;
    this.sun.light.intensity *= overcastFactor;
    this.light.intensity = (0.15 + dayFactor * 0.4) * overcastFactor;
    const skyNight = Color3.FromHexString(this.atmosphere.skyNightColor.value).toColor4(1);
    const skyDay = Color3.FromHexString(this.atmosphere.skyDayColor.value).toColor4(1);
    this.scene.clearColor = Color4.Lerp(skyNight, skyDay, dayFactor);
    this.stars.setNightFactor(1 - dayFactor);
    this.ambientAudio.setNightLevel(1 - dayFactor);
  }

  // Overcast reads from atmosphere.overcast.value rather than taking a
  // parameter — it's a scene-wide toggle, not something callers pick per
  // call, same as contract/hScale already being closed over here.
  private buildClouds(): DriftingClouds {
    const hScale = this.scaleTuning.hScale.value;
    const vExag = this.scaleTuning.vExag.value;
    const overcast = this.atmosphere.overcast.value;
    return new DriftingClouds(this.scene, {
      count: overcast ? Math.max(this.atmosphere.cloudCount.value, 60) : this.atmosphere.cloudCount.value,
      spread: (this.contract.bbox.maxX - this.contract.bbox.minX) * hScale * 1.3,
      altitudeMin: (overcast ? this.contract.elevation.max + 150 : this.contract.elevation.max + 250) * vExag,
      altitudeMax: (overcast ? this.contract.elevation.max + 220 : this.contract.elevation.max + 450) * vExag,
      diameterMin: (overcast ? 600 : 300) * hScale,
      diameterMax: (overcast ? 1400 : 800) * hScale,
      driftSpeed: (this.weatherMode.value === 'windy' ? 15 : 5) * hScale,
      // Manually controlled (Sky section's color picker + opacity slider) —
      // overcast used to auto-shift these too, but now that there's direct
      // user control it no longer overrides color/alpha, only the
      // count/altitude/diameter density feel above.
      color: Color3.FromHexString(this.atmosphere.cloudColor.value),
      alpha: this.atmosphere.cloudOpacity.value,
    });
  }

  // halfWidth/halfDepth scale by hScale like everything else horizontal
  // (clouds' spread, water's extent); bottomY/heightScale scale by vExag
  // like everything vertical (clouds' altitude, terrain's own elevation) —
  // so the ring stays proportionate to the terrain across both sliders
  // independently, not just at their default combination.
  private buildMountains(): MountainRing {
    const hScale = this.scaleTuning.hScale.value;
    const vExag = this.scaleTuning.vExag.value;
    const realWidth = this.contract.bbox.maxX - this.contract.bbox.minX;
    const realDepth = this.contract.bbox.maxZ - this.contract.bbox.minZ;
    return new MountainRing(this.scene, {
      shape: 'rectangle' as const,
      halfWidth: (realWidth / 2) * hScale,
      halfDepth: (realDepth / 2) * hScale,
      bottomY: (this.contract.elevation.min - MOUNTAIN_BASE_MARGIN_M) * vExag,
      heightScale: vExag,
      nearColor: MOUNTAIN_NEAR_COLOR,
    });
  }
}
