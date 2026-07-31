// Shared helpers for the authoring-time bake scripts in this package.
// Not part of the shipped src/ barrel — these run under plain Node with
// sharp, never in the browser bundle.
import sharp from 'sharp';

// Seamless tiling via the classic "offset and heal" technique: swap the
// image's quadrants diagonally (a half-width/half-height wraparound roll).
// This relocates the tile-to-tile wrap seam (originally between the tile's
// far-left and far-right edges) into a single cross through the tile's own
// center — and makes the tile's *outer* edges automatically seamless,
// because they now land on pixels that were already adjacent in the source
// photo. What's left is to hide the new center-cross seam, done here with a
// local blur band rather than mirroring (mirroring the whole tile reads as
// an obvious kaleidoscope/diamond artifact on any source with directional
// structure — tried first, rejected on inspection).
export async function offsetHealTile(baseBuffer, size, featherPx, opts = {}) {
  const { blurDivisor = 3, contrastCorrect = true } = opts;
  if (size % 2 !== 0) throw new Error('offsetHealTile requires an even size');
  const half = size / 2;
  const base = sharp(baseBuffer).resize(size, size, { fit: 'fill' });

  const [tl, tr, bl, br] = await Promise.all([
    base.clone().extract({ left: 0, top: 0, width: half, height: half }).toBuffer(),
    base.clone().extract({ left: half, top: 0, width: half, height: half }).toBuffer(),
    base.clone().extract({ left: 0, top: half, width: half, height: half }).toBuffer(),
    base.clone().extract({ left: half, top: half, width: half, height: half }).toBuffer(),
  ]);

  let rolled = sharp({
    create: { width: size, height: size, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).composite([
    { input: br, left: 0, top: 0 },
    { input: bl, left: half, top: 0 },
    { input: tr, left: 0, top: half },
    { input: tl, left: half, top: half },
  ]);
  const rolledBuffer = await rolled.png().toBuffer();

  // Blur just the two center bands (the new seam cross), then composite
  // that blurred strip back over the sharp rolled image — so everything
  // away from the center stays crisp, and only the seam itself is smeared
  // into a soft transition instead of a hard line.
  // Blur flattens local contrast (it averages shadow-into-highlight), which
  // reads as a lighter smudge against the crisp surrounding grain — pushing
  // contrast back up after the blur keeps the band from standing out as its
  // own washed-out stripe.
  const applyBand = (extracted) => {
    let pipeline = extracted.blur(Math.max(0.3, featherPx / blurDivisor));
    if (contrastCorrect) pipeline = pipeline.linear(1.35, -25);
    return pipeline.toBuffer();
  };
  const vBand = await applyBand(
    sharp(rolledBuffer).extract({
      left: Math.max(0, half - featherPx),
      top: 0,
      width: featherPx * 2,
      height: size,
    }),
  );
  const hBand = await applyBand(
    sharp(rolledBuffer).extract({
      left: 0,
      top: Math.max(0, half - featherPx),
      width: size,
      height: featherPx * 2,
    }),
  );

  return sharp(rolledBuffer)
    .composite([
      { input: vBand, left: half - featherPx, top: 0 },
      { input: hBand, left: 0, top: half - featherPx },
    ])
    .png()
    .toBuffer();
}

// Builds an NxNx3 composite of `tileBuffer` repeated `reps` times per axis —
// the "3x3 test render" the acceptance criteria asks for. A real seam shows
// up as a visible grid line; a mirror-tile seam shows up (if at all) as a
// soft symmetric crease, not a hard edge.
export async function repeatGrid(tileBuffer, tileSize, reps) {
  const composites = [];
  for (let y = 0; y < reps; y++) {
    for (let x = 0; x < reps; x++) {
      composites.push({ input: tileBuffer, left: x * tileSize, top: y * tileSize });
    }
  }
  return sharp({
    create: {
      width: tileSize * reps,
      height: tileSize * reps,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

// Cheap bump-to-normal conversion: treats greyscale luminance as a height
// field and runs a 3x3 Sobel gradient over it. Fine for shallow relief
// (leather tooling, panel seams); not a substitute for authored/baked
// high-poly normals.
export async function heightToNormal(greyBuffer, width, height, strength = 2.0) {
  // sharp's raw output keeps the source's channel count even after
  // .greyscale() (R=G=B, not collapsed to 1 channel) — index with the
  // reported stride rather than assuming 1 byte/pixel, or every read after
  // the first row aliases across channels and the result is noise.
  const { data, info } = await sharp(greyBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;

  const at = (x, y) => {
    const cx = Math.min(width - 1, Math.max(0, x));
    const cy = Math.min(height - 1, Math.max(0, y));
    return data[(cy * width + cx) * channels] / 255;
  };

  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx =
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len;
      ny /= len;
      nz /= len;

      const i = (y * width + x) * 3;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }

  return sharp(out, { raw: { width, height, channels: 3 } }).png().toBuffer();
}
