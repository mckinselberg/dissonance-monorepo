import { Color3, PBRMaterial } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { createScrollingTexture } from './createScrollingTexture';
import type { ScrollingTextureHandle } from './createScrollingTexture';

export interface EmissiveDataPatternParams {
  scrollSpeedU?: number;
  scrollSpeedV?: number;
  tint?: Color3;
  intensity?: number;
}

const DEFAULTS: Required<Pick<EmissiveDataPatternParams, 'tint' | 'intensity'>> = {
  tint: new Color3(1, 1, 1),
  intensity: 1.5,
};

/**
 * A UV-scrolled emissive material for machine-readout surfaces (scramble
 * screens, signal-palette live feeds) — the reusable substrate only, per
 * the pipeline doc's scope: no device state logic, just a standalone
 * material + a demo mesh the caller supplies.
 *
 * Unlit by design: a self-illuminated readout shouldn't pick up scene
 * lighting/shadows the way a physical surface would. If you want the
 * scrolling texture on an existing *lit* material instead (e.g. Lineglass's
 * faceted gem look, which wants to keep its albedo/metallic/roughness), use
 * `createScrollingTexture` directly and assign it to `emissiveTexture`.
 */
export class EmissiveDataPatternMaterial {
  readonly material: PBRMaterial;
  private readonly scrolling: ScrollingTextureHandle;

  constructor(name: string, scene: Scene, texturePath: string, params: EmissiveDataPatternParams = {}) {
    const merged = { ...DEFAULTS, ...params };

    this.scrolling = createScrollingTexture(scene, texturePath, {
      scrollSpeedU: params.scrollSpeedU,
      scrollSpeedV: params.scrollSpeedV,
    });

    this.material = new PBRMaterial(name, scene);
    this.material.unlit = true;
    this.material.albedoColor = Color3.Black();
    this.material.emissiveTexture = this.scrolling.texture;
    this.material.emissiveColor = merged.tint.scale(merged.intensity);
  }

  setScrollSpeed(u: number, v: number): void {
    this.scrolling.setScrollSpeed(u, v);
  }

  setTint(tint: Color3, intensity: number): void {
    this.material.emissiveColor = tint.scale(intensity);
  }

  dispose(): void {
    this.material.dispose();
    this.scrolling.dispose();
  }
}
