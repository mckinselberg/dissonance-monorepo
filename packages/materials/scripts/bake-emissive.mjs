// Authoring-time bake: crops the scramble-screen / signal-palette reference
// art into tileable emissive data-pattern maps. Run with `pnpm bake:emissive`
// from this package. Not part of the shipped src/ barrel.
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { offsetHealTile, repeatGrid } from './lib/tile-utils.mjs';
import { REF_DIR } from './lib/env.mjs';

const OUT_DIR = path.resolve('scripts/_out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const TARGET_RESOLUTION = 512;
// High-contrast graphic content (bright glyphs/bars on near-black) shows a
// blurred band as an obvious flat-gray stripe — the opposite problem from
// the organic leather swatch. Keep the band narrow and lightly blurred, and
// skip the post-blur contrast push entirely (see bake-swatches.mjs for why
// that push exists at all).
const SEAM_FEATHER_PX = 8;
const SEAM_BLUR_DIVISOR = 10;
const TILE_TEST_REPS = 3;

const PATTERNS = [
  {
    slug: 'echo17-scramble-screen',
    prefix: 'echo17_scramble_screen',
    source: 'viz-scramble-screen.webp',
    // top nudged past the "VISUAL SCRAMBLE SCREEN" header row; height
    // trimmed short of the panel's own bottom margin — both bled gray
    // page-background into the first attempt (visible as a solid gray
    // stripe once tiled, not a healing artifact).
    rect: { left: 30, top: 280, width: 660, height: 560 },
  },
  {
    slug: 'echo17-signal-palette',
    prefix: 'echo17_signal_palette',
    source: 'signal-palette-(live-feed).webp',
    rect: { left: 20, top: 112, width: 820, height: 120 },
    // This source is a thin strip (150px tall) stretched ~3.4x to reach the
    // 512 square — the resize itself pre-blurs the vertical axis, so a
    // normal feather band flattens to a fully solid gray stripe instead of
    // a soft transition. This material's real use is a horizontally
    // scrolling readout band, not vertical tiling, so shrink the feather
    // rather than fight the stretch.
    featherOverridePx: 3,
  },
];

for (const pattern of PATTERNS) {
  const srcPath = path.join(REF_DIR, pattern.source);
  const cropped = await sharp(srcPath).extract(pattern.rect).toBuffer();

  const tile = await offsetHealTile(
    cropped,
    TARGET_RESOLUTION,
    pattern.featherOverridePx ?? SEAM_FEATHER_PX,
    { blurDivisor: SEAM_BLUR_DIVISOR, contrastCorrect: false },
  );
  const emissiveJpg = await sharp(tile).jpeg({ quality: 92 }).toBuffer();

  const dir = path.join(OUT_DIR, pattern.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${pattern.prefix}_emissive_${TARGET_RESOLUTION}.jpg`), emissiveJpg);

  const tileTest = await repeatGrid(tile, TARGET_RESOLUTION, TILE_TEST_REPS);
  fs.writeFileSync(path.join(dir, `_tile_test_${TILE_TEST_REPS}x${TILE_TEST_REPS}.png`), tileTest);

  console.log('baked', pattern.slug, '->', dir);
}
