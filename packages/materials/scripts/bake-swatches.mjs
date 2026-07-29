// Authoring-time bake: turns a cropped reference-art swatch into a seamless
// tileable PBR set (albedo/roughness/normal). Run with `pnpm bake` from
// this package. Not part of the shipped src/ barrel.
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { offsetHealTile, repeatGrid, heightToNormal } from './lib/tile-utils.mjs';
import { REF_DIR } from './lib/env.mjs';

const OUT_DIR = path.resolve('scripts/_out');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Named tuning values — see docs/dissonance/instanced-material-pipeline-constants.md
const TARGET_RESOLUTION = 512;
const SEAM_FEATHER_PX = 18; // width of the blurred band hiding the offset-heal center seam
const NORMAL_STRENGTH = 2.0;
const ROUGHNESS_MIN = 140; // ~0.55 encoded — worn leather isn't matte-flat
const ROUGHNESS_MAX = 230; // ~0.90 encoded — crevices read near-diffuse
const TILE_TEST_REPS = 3;

// Clean, device-free, gutter-free patch of tooled/worn leather found behind
// the collar noise emitter prop on the Echo-17 reference sheet. Stands in
// for the doc's "frayed fabric"/"charcoal weave" bucket — it is a different
// material than what those sheet thumbnails literally show (see the
// Phase 0 audit note), used because it's the only crop with enough native
// resolution to bake honestly instead of upscaling a ~65px thumbnail.
const SWATCHES = [
  {
    slug: 'echo17-worn-leather-wrap',
    prefix: 'echo17_worn_leather_wrap',
    source: 'collar-noise-emitter.webp',
    rect: { left: 280, top: 895, width: 200, height: 190 },
  },
];

for (const swatch of SWATCHES) {
  const srcPath = path.join(REF_DIR, swatch.source);
  const cropped = await sharp(srcPath).extract(swatch.rect).toBuffer();

  const albedoTile = await offsetHealTile(cropped, TARGET_RESOLUTION, SEAM_FEATHER_PX);
  const albedoJpg = await sharp(albedoTile).jpeg({ quality: 92 }).toBuffer();

  const greyTile = await sharp(albedoTile).greyscale().toBuffer();

  const roughnessTile = await sharp(greyTile)
    .linear((ROUGHNESS_MAX - ROUGHNESS_MIN) / 255, ROUGHNESS_MIN)
    .png()
    .toBuffer();

  const normalTile = await heightToNormal(
    greyTile,
    TARGET_RESOLUTION,
    TARGET_RESOLUTION,
    NORMAL_STRENGTH,
  );

  const swatchDir = path.join(OUT_DIR, swatch.slug);
  fs.mkdirSync(swatchDir, { recursive: true });
  fs.writeFileSync(path.join(swatchDir, `${swatch.prefix}_diff_${TARGET_RESOLUTION}.jpg`), albedoJpg);
  fs.writeFileSync(path.join(swatchDir, `${swatch.prefix}_rough_${TARGET_RESOLUTION}.png`), roughnessTile);
  fs.writeFileSync(path.join(swatchDir, `${swatch.prefix}_nor_gl_${TARGET_RESOLUTION}.png`), normalTile);

  const tileTest = await repeatGrid(albedoTile, TARGET_RESOLUTION, TILE_TEST_REPS);
  fs.writeFileSync(path.join(swatchDir, `_tile_test_${TILE_TEST_REPS}x${TILE_TEST_REPS}.png`), tileTest);

  console.log('baked', swatch.slug, '->', swatchDir);
}
