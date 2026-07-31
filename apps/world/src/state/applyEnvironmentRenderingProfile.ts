import { Color3, ColorCurves, DefaultRenderingPipeline, Scene } from '@babylonjs/core';
import type { EnvironmentRenderingProfile } from './environmentRenderingProfile';

export type AppliedEnvironmentPresentation = Pick<
  EnvironmentRenderingProfile,
  'emissive'
> & {
  hazeBands: EnvironmentRenderingProfile['atmosphere']['hazeBands'];
  redChannelGain: number;
};

// Canonical scene/post application seam. Haze-band and emissive data are
// returned to their material consumers; stock EXP2 remains the fallback until
// the dedicated fixed-four shader lands. Fog is applied before Babylon's
// post-process pipeline, so color curves and bloom see the fogged frame.
export function applyEnvironmentRenderingProfile(
  scene: Scene,
  profile: EnvironmentRenderingProfile,
  pipeline?: DefaultRenderingPipeline,
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

  return {
    hazeBands: profile.atmosphere.hazeBands,
    emissive: profile.emissive,
    // Babylon ColorCurves has no per-channel gain. Keeping this explicit in
    // the applied result prevents silently pretending the value was consumed.
    redChannelGain: profile.grade?.redChannelGain ?? 1,
  };
}
