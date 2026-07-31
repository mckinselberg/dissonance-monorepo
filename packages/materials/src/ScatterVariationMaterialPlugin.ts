import {
  Material,
  MaterialPluginBase,
  ShaderLanguage,
} from '@babylonjs/core';
import type { Mesh } from '@babylonjs/core';
import type { ScatterVariationProfile } from './ScatterVariationProfile';

const ATTRIBUTE_NAME = 'scatterVariation';

// GLSL helpers for a cheap RGB<->HSV round trip — only hue and value need
// touching, so this doesn't need to be more than the standard one-liner
// conversions (no need for a colorspace-correct implementation here).
const HSV_HELPERS = `
  vec3 dtaRgb2Hsv(vec3 c) {
    vec4 k = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, k.wz), vec4(c.gb, k.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }
  vec3 dtaHsv2Rgb(vec3 c) {
    vec4 k = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + k.xyz) * 6.0 - k.www);
    return c.z * mix(k.xxx, clamp(p - k.xxx, 0.0, 1.0), c.y);
  }
`;

/**
 * Per-thin-instance hue/value jitter, applied to a material's albedo so N
 * instances sharing one material and one texture don't read as visibly
 * cloned. Sibling to @dissonance/world's FoliageSwayPlugin (same
 * MaterialPluginBase shape) but buffer-driven rather than derived from the
 * instance transform, since jitter needs to be independently tunable from
 * position and needs two channels (hue, value), not one phase float.
 *
 * NOT yet verified against a live render (no browser session run in this
 * pass) — CUSTOM_FRAGMENT_UPDATE_ALBEDO is the injection point Babylon's
 * PBR plugin docs use for albedo-stage edits, but treat this as unverified
 * until it's actually seen driving pixels in the demo scene.
 */
export class ScatterVariationMaterialPlugin extends MaterialPluginBase {
  constructor(material: Material) {
    super(material, 'ScatterVariationMaterialPlugin', 210, undefined, true, true);
  }

  override getClassName(): string {
    return 'ScatterVariationMaterialPlugin';
  }

  override getAttributes(attributes: string[]): void {
    attributes.push(ATTRIBUTE_NAME);
  }

  override getCustomCode(shaderType: string, shaderLanguage = ShaderLanguage.GLSL) {
    if (shaderLanguage !== ShaderLanguage.GLSL) return null;

    if (shaderType === 'vertex') {
      const result: Record<string, string> = {
        CUSTOM_VERTEX_DEFINITIONS: `
          attribute vec2 ${ATTRIBUTE_NAME};
          varying vec2 vScatterVariation;
        `,
        CUSTOM_VERTEX_MAIN_END: `
          vScatterVariation = ${ATTRIBUTE_NAME};
        `,
      };
      return result;
    }

    if (shaderType === 'fragment') {
      const result: Record<string, string> = {
        CUSTOM_FRAGMENT_DEFINITIONS: `
          varying vec2 vScatterVariation;
          ${HSV_HELPERS}
        `,
        // surfaceAlbedo is PBR's post-texture, pre-lighting albedo value at
        // this injection point — jittering here means the shift applies to
        // the sampled texture color, not to a raw uniform.
        CUSTOM_FRAGMENT_UPDATE_ALBEDO: `
          {
            vec3 dtaHsv = dtaRgb2Hsv(surfaceAlbedo);
            dtaHsv.x = fract(dtaHsv.x + vScatterVariation.x);
            dtaHsv.z = clamp(dtaHsv.z * (1.0 + vScatterVariation.y), 0.0, 1.0);
            surfaceAlbedo = dtaHsv2Rgb(dtaHsv);
          }
        `,
      };
      return result;
    }

    return null;
  }
}

// Deterministic per-instance jitter (mulberry32) so a given instance index
// always gets the same variation across reloads/relayouts, without needing
// to persist the buffer itself.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fills and binds the per-instance variation buffer for every thin instance
 * currently on `mesh`. Call after `thinInstanceAdd`/`thinInstanceSetBuffer`
 * for the instance matrices, using the same `count`.
 */
export function setScatterVariationBuffer(
  mesh: Mesh,
  count: number,
  profile: ScatterVariationProfile,
  seed = 1,
): void {
  const rand = mulberry32(seed);
  const data = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const { hueShift, valueJitter } = profile;
    data[i * 2] = hueShift.min + rand() * (hueShift.max - hueShift.min);
    data[i * 2 + 1] = valueJitter.min + rand() * (valueJitter.max - valueJitter.min);
  }
  mesh.thinInstanceSetBuffer(ATTRIBUTE_NAME, data, 2);
}
