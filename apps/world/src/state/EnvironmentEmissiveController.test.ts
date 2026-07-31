import { Color3, NullEngine, PBRMaterial, Scene } from '@babylonjs/core';
import { describe, expect, it, vi } from 'vitest';
import type { EmissivePresentation } from './environmentRenderingProfile';
import { EnvironmentEmissiveController } from './EnvironmentEmissiveController';

function presentation(
  color: string,
  intensity: number,
  flicker: EmissivePresentation['flicker'] = { amp: 0, hz: 0, seed: 0 },
): EmissivePresentation {
  return {
    color,
    intensity,
    bloomThreshold: 0.65,
    flicker,
    occupancyMask: null,
  };
}

function expectColor(actual: Color3, expected: Color3): void {
  expect(actual.r).toBeCloseTo(expected.r);
  expect(actual.g).toBeCloseTo(expected.g);
  expect(actual.b).toBeCloseTo(expected.b);
}

describe('EnvironmentEmissiveController', () => {
  it('applies recognized groups and restores their authored baselines', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const windowMaterial = new PBRMaterial('MI_FakeInterior_1', scene);
    const lampMaterial = new PBRMaterial('locProp_lampGlobeMat', scene);
    const windowBaseline = new Color3(0.1, 0.2, 0.3);
    const lampBaseline = new Color3(0.9, 0.6, 0.15);
    windowMaterial.emissiveColor.copyFrom(windowBaseline);
    lampMaterial.emissiveColor.copyFrom(lampBaseline);

    const controller = new EnvironmentEmissiveController(scene);
    const windows = presentation('#e8a870', 2.2);
    controller.setProfile({ windows });
    expectColor(windowMaterial.emissiveColor, Color3.FromHexString(windows.color).scale(windows.intensity));
    expectColor(lampMaterial.emissiveColor, lampBaseline);

    const streetLamps = presentation('#c89050', 1.4);
    controller.setProfile({ streetLamps });
    expectColor(windowMaterial.emissiveColor, windowBaseline);
    expectColor(lampMaterial.emissiveColor, Color3.FromHexString(streetLamps.color).scale(streetLamps.intensity));

    controller.dispose();
    expectColor(windowMaterial.emissiveColor, windowBaseline);
    expectColor(lampMaterial.emissiveColor, lampBaseline);
    expect(() => controller.dispose()).not.toThrow();
    scene.dispose();
    engine.dispose();
  });

  it('captures newly constructed material baselines after authored setup', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const controller = new EnvironmentEmissiveController(scene);
    const streetLamps = presentation('#c89050', 1.4);
    controller.setProfile({ streetLamps });

    const baseline = new Color3(0.2, 0.3, 0.4);
    const material = new PBRMaterial('locProp_lampGlobeMat.001', scene);
    material.emissiveColor.copyFrom(baseline);
    // Scene.addMaterial publishes its observable through Babylon's
    // SetImmediate queue so constructors can finish authoring the material.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    scene.onBeforeRenderObservable.notifyObservers(scene);
    expectColor(material.emissiveColor, Color3.FromHexString(streetLamps.color).scale(streetLamps.intensity));

    controller.setProfile(undefined);
    expectColor(material.emissiveColor, baseline);
    scene.dispose();
    engine.dispose();
  });

  it('samples seeded flicker deterministically through one render observer', () => {
    const renderSample = (): Color3 => {
      const engine = new NullEngine();
      vi.spyOn(engine, 'getDeltaTime').mockReturnValue(125);
      const scene = new Scene(engine);
      const material = new PBRMaterial('MI_FakeInterior_2', scene);
      const controller = new EnvironmentEmissiveController(scene);
      controller.setProfile({
        windows: presentation('#ffffff', 2, { amp: 0.5, hz: 2, seed: 17 }),
      });
      scene.onBeforeRenderObservable.notifyObservers(scene);
      const sample = material.emissiveColor.clone();
      scene.dispose();
      engine.dispose();
      return sample;
    };

    const first = renderSample();
    const second = renderSample();
    expectColor(first, second);
    expect(first.r).not.toBeCloseTo(2);
  });
});
