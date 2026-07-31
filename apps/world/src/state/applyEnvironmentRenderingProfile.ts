import { Color3, ColorCurves, DefaultRenderingPipeline, Scene } from '@babylonjs/core';
import type { HazeBandFogConfig } from '@dissonance/materials';
import type { EnvironmentRenderingProfile } from './environmentRenderingProfile';

export type EnvironmentPresentationConsumers = {
  haze: { setConfig(config: HazeBandFogConfig | null): void };
  emissive: { setProfile(profile: EnvironmentRenderingProfile): void };
};

export type AppliedEnvironmentPresentation = Pick<
  EnvironmentRenderingProfile,
  'emissive'
> & {
  hazeBands: EnvironmentRenderingProfile['atmosphere']['hazeBands'];
  redChannelGain: number;
};

// Canonical scene/post application seam. Stock EXP2 supplies base extinction;
// optional consumers layer fixed-four haze and named emissive presentations
// onto current/future materials. Fog and material haze both render before the
// post-process pipeline, so color curves and bloom see the composed frame.
export function applyEnvironmentRenderingProfile(
  scene: Scene,
  profile: EnvironmentRenderingProfile,
  pipeline?: DefaultRenderingPipeline,
  consumers?: EnvironmentPresentationConsumers,
): AppliedEnvironmentPresentation {
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = profile.atmosphere.fogDensity;
  scene.fogColor = Color3.FromHexString(profile.atmosphere.fogColor);

  if (pipeline) {
    const grade = profile.grade;
    pipeline.imageProcessingEnabled = Boolean(grade);
    pipeline.imageProcessing.colorCurvesEnabled = Boolean(grade);
    if (grade) {
      const curves = new ColorCurves();
      curves.globalSaturation = (grade.saturationScale - 1) * 100;
      curves.shadowsHue = grade.shadowsHue;
      curves.shadowsDensity = grade.shadowsDensity * 100;
      curves.highlightsHue = grade.highlightsHue;
      curves.highlightsDensity = grade.highlightsDensity * 100;
      pipeline.imageProcessing.colorCurves = curves;
    }
    const bloom = profile.bloom;
    pipeline.bloomEnabled = Boolean(bloom);
    if (bloom) {
      pipeline.bloomThreshold = bloom.threshold;
      pipeline.bloomWeight = bloom.weight;
      pipeline.bloomKernel = bloom.kernel;
      pipeline.bloomScale = bloom.scale;
    }
  }

  const haze = profile.atmosphere.hazeBands;
  if (haze) {
    const [band0, band1, band2, band3] = haze.bands;
    const toShaderBand = (band: typeof band0) => ({
      depth: band.depth,
      color: Color3.FromHexString(band.color),
      inscatter: band.inscatter,
    });
    consumers?.haze.setConfig({
      bands: [
        toShaderBand(band0),
        toShaderBand(band1),
        toShaderBand(band2),
        toShaderBand(band3),
      ],
      bandSoftness: haze.bandSoftness,
      heightFalloff: haze.heightFalloff,
      farDistance: profile.visibility.streamRadius,
      density: profile.atmosphere.fogDensity,
      redChannelGain: profile.grade?.redChannelGain ?? 1,
    });
  } else {
    consumers?.haze.setConfig(null);
  }
  consumers?.emissive.setProfile(profile);

  return {
    hazeBands: profile.atmosphere.hazeBands,
    emissive: profile.emissive,
    // Babylon ColorCurves has no per-channel gain. The fixed-four material
    // consumer applies this value with the haze pass; it remains explicit in
    // the result for callers that need to inspect the resolved presentation.
    redChannelGain: profile.grade?.redChannelGain ?? 1,
  };
}
