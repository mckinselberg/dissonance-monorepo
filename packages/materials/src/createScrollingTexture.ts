import { Texture } from '@babylonjs/core';
import type { Scene, Observer } from '@babylonjs/core';

export interface ScrollingTextureParams {
  scrollSpeedU?: number; // UV units/second; bake outputs are seamless so any value wraps cleanly
  scrollSpeedV?: number;
}

export interface ScrollingTextureHandle {
  texture: Texture;
  setScrollSpeed(u: number, v: number): void;
  dispose(): void;
}

const DEFAULTS: Required<ScrollingTextureParams> = {
  scrollSpeedU: 0,
  scrollSpeedV: 0.35,
};

/**
 * Loads a texture and drives its UV offset every frame — the animation half
 * of a UV-scrolled emissive material, split out from EmissiveDataPatternMaterial
 * so a caller that wants to keep its own lit PBRMaterial (existing albedo/
 * metallic/roughness) can still get the scrolling readout effect by just
 * assigning the returned texture to `material.emissiveTexture`, instead of
 * adopting EmissiveDataPatternMaterial's opinionated unlit/black-albedo
 * standalone-screen material.
 */
export function createScrollingTexture(
  scene: Scene,
  texturePath: string,
  params: ScrollingTextureParams = {},
): ScrollingTextureHandle {
  let { scrollSpeedU, scrollSpeedV } = { ...DEFAULTS, ...params };

  const texture = new Texture(texturePath, scene);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;

  let observer: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    texture.uOffset += scrollSpeedU * dt;
    texture.vOffset += scrollSpeedV * dt;
  });

  return {
    texture,
    setScrollSpeed(u: number, v: number) {
      scrollSpeedU = u;
      scrollSpeedV = v;
    },
    dispose() {
      if (observer) {
        scene.onBeforeRenderObservable.remove(observer);
        observer = null;
      }
      texture.dispose();
    },
  };
}
