import { Color3 } from '@babylonjs/core';

// Overcast South Mountain Reservation reference palette — see
// docs/dissonance-forest-color-handoff.md for the source look-dev spec.
// Currently only consulted where `profile.lookVariant === 'overcast'`
// (ps3 today); every mode/branch that doesn't check that flag keeps its
// original ("genesis") colors untouched.

export interface HueFamily {
  base: Color3;
  hueJitterDeg: number;
  satJitter: number;
  valueJitter: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Standard RGB<->HSV, h in degrees [0,360), s/v in [0,1]. Jittering hue in
// RGB space (naive per-channel offsets) looks muddy — HSV keeps hue
// rotation perceptually clean, which is what sells "same family, different
// leaf" instead of "same leaf, different noise."
function rgbToHsv(c: Color3): [number, number, number] {
  const { r, g, b } = c;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return [h, s, v];
}

function hsvToRgb(h: number, s: number, v: number): Color3 {
  const c = v * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return new Color3(r + m, g + m, b + m);
}

// Jitters a base color in HSV space. `satJitter`/`valueJitter` are
// fractions of the full 0-1 s/v range (not fractions of the base value);
// each is sampled as +/- half the given spread.
export function jitterHsv(base: Color3, hueJitterDeg: number, satJitter: number, valueJitter: number): Color3 {
  const [h, s, v] = rgbToHsv(base);
  const h2 = h + (Math.random() - 0.5) * 2 * hueJitterDeg;
  const s2 = clamp01(s + (Math.random() - 0.5) * 2 * satJitter);
  const v2 = clamp01(v + (Math.random() - 0.5) * 2 * valueJitter);
  return hsvToRgb(h2, s2, v2);
}

export function jitterFamily(family: HueFamily): Color3 {
  return jitterHsv(family.base, family.hueJitterDeg, family.satJitter, family.valueJitter);
}

// Rotates hue while leaving saturation/value alone — used to derive a
// related-but-distinct family (e.g. cooler conifer needles) from one of
// the six named families below without inventing an unreferenced color.
export function hueShift(base: Color3, deg: number): Color3 {
  const [h, s, v] = rgbToHsv(base);
  return hsvToRgb(h + deg, s, v);
}

// Scales brightness only — used to fold a per-template "shade factor" into
// a palette base color before per-instance jitter is applied on top.
export function scaleValue(base: Color3, factor: number): Color3 {
  const [h, s, v] = rgbToHsv(base);
  return hsvToRgb(h, s, clamp01(v * factor));
}

export const FOREST_PALETTE: Record<
  'canopyWarm' | 'mossCool' | 'understoryMid' | 'leafLitter' | 'barkGreyBrown' | 'rustAccent',
  HueFamily
> = {
  canopyWarm: {
    base: Color3.FromHexString('#7CA344'),
    hueJitterDeg: 8, satJitter: 0.10, valueJitter: 0.12,
  },
  mossCool: {
    base: Color3.FromHexString('#4E8F63'),
    hueJitterDeg: 6, satJitter: 0.08, valueJitter: 0.10,
  },
  understoryMid: {
    base: Color3.FromHexString('#6A9450'),
    hueJitterDeg: 10, satJitter: 0.10, valueJitter: 0.15,
  },
  leafLitter: {
    base: Color3.FromHexString('#8A7358'),
    hueJitterDeg: 5, satJitter: 0.30, valueJitter: 0.10,
  },
  barkGreyBrown: {
    base: Color3.FromHexString('#6E6A5F'),
    hueJitterDeg: 4, satJitter: 0.20, valueJitter: 0.12,
  },
  // Base sits between the doc's resting rust (#A6472A) and hot-core
  // (#C25B2E) tones; the positive-leaning value jitter is what actually
  // produces the occasional brighter "hot core" instance.
  rustAccent: {
    base: Color3.FromHexString('#B04F2C'),
    hueJitterDeg: 5, satJitter: 0.05, valueJitter: 0.10,
  },
};

// Builds a thin-instance "color" buffer (stride 4, rgba) by jittering the
// given family once per instance. Pair with a material whose
// diffuse/albedoColor is white — thin-instance color multiplies the
// material color, so white lets the instance color be the sole colorant.
export function buildJitteredColorBuffer(count: number, family: HueFamily): Float32Array {
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const c = jitterFamily(family);
    data[i * 4 + 0] = c.r;
    data[i * 4 + 1] = c.g;
    data[i * 4 + 2] = c.b;
    data[i * 4 + 3] = 1;
  }
  return data;
}
