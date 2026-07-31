// One-off inspection tool: cuts several candidate patches out of the raw
// reference images so a human (or a Read-tool glance) can pick a clean,
// device-free, gutter-free region before the real bake script commits to
// specific crop rects. Not part of the shipped package.
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { REF_DIR } from './lib/env.mjs';

const OUT_DIR = path.resolve('scripts/_inspect');
fs.mkdirSync(OUT_DIR, { recursive: true });

const candidates = [
  { file: 'throat-pickup-mic.webp', name: 'throat-top', rect: { left: 40, top: 20, width: 760, height: 300 } },
  { file: 'throat-pickup-mic.webp', name: 'throat-left', rect: { left: 20, top: 500, width: 250, height: 700 } },
  { file: 'collar-noise-emitter.webp', name: 'collar-left-strap', rect: { left: 240, top: 260, width: 260, height: 300 } },
  { file: 'collar-noise-emitter.webp', name: 'collar-bottom', rect: { left: 260, top: 900, width: 500, height: 220 } },
];

for (const c of candidates) {
  const src = path.join(REF_DIR, c.file);
  await sharp(src)
    .extract(c.rect)
    .resize(256, 256, { fit: 'fill' })
    .png()
    .toFile(path.join(OUT_DIR, `${c.name}.png`));
  console.log('wrote', c.name);
}
