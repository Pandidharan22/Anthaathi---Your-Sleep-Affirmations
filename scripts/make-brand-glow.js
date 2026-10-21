/* global __dirname */
/**
 * Build assets/brand/anthaathi-mark-cradle-glow.png: the logo's glow, baked
 * from the cutout so the app can draw it as a plain image behind the mark (the runtime
 * routes — a CSS drop-shadow filter, Image blurRadius — either drew nothing on Android
 * or couldn't spread past the image's own edges).
 *
 * Matches the Splash mockup's `drop-shadow(0 0 20px ...)` at 0.62 opacity on a
 * 96px-wide mark: a CSS blur radius of 20px is a Gaussian with sigma 10px, which at
 * 96/638 scale is ~66 source pixels. The output is padded by PAD on every side so the
 * glow has room to fade out; components/BrandMark.tsx must use the same PAD.
 *
 * Not part of the app build; re-run only if the logo changes:  node scripts/make-brand-glow.js
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const BRAND = path.join(__dirname, '..', 'assets', 'brand');
const SRC = path.join(BRAND, 'anthaathi-mark-cradle.png');
const OUT = path.join(BRAND, 'anthaathi-mark-cradle-glow.png');

const MOCKUP_WIDTH = 96;
const CSS_BLUR_RADIUS = 20;
const OPACITY = 0.62;
const COLOR = [169, 143, 196]; // the glow mauve, colors.action (terracotta until R.7a)
const PAD = 200; // ~3 sigma, in source pixels

const src = PNG.sync.read(fs.readFileSync(SRC));
const sigma = CSS_BLUR_RADIUS / 2 / (MOCKUP_WIDTH / src.width);
const width = src.width + PAD * 2;
const height = src.height + PAD * 2;

// The cutout's alpha, placed on the padded canvas.
let alpha = new Float32Array(width * height);
for (let y = 0; y < src.height; y++) {
  for (let x = 0; x < src.width; x++) {
    alpha[(y + PAD) * width + (x + PAD)] = src.data[(y * src.width + x) * 4 + 3] / 255;
  }
}

// Three box blurs approximate a Gaussian (W3C's suggested method for feGaussianBlur).
const box = Math.max(1, Math.round((sigma * 3 * Math.sqrt(2 * Math.PI)) / 4));

function boxBlur(input, horizontal) {
  const output = new Float32Array(input.length);
  const [outer, inner] = horizontal ? [height, width] : [width, height];
  const at = (o, i) => (horizontal ? o * width + i : i * width + o);
  const half = Math.floor(box / 2);
  for (let o = 0; o < outer; o++) {
    let sum = 0;
    for (let i = -half; i < box - half; i++) sum += i >= 0 && i < inner ? input[at(o, i)] : 0;
    for (let i = 0; i < inner; i++) {
      output[at(o, i)] = sum / box;
      const add = i + box - half;
      const drop = i - half;
      if (add < inner) sum += input[at(o, add)];
      if (drop >= 0) sum -= input[at(o, drop)];
    }
  }
  return output;
}

for (let pass = 0; pass < 3; pass++) {
  alpha = boxBlur(alpha, true);
  alpha = boxBlur(alpha, false);
}

const out = new PNG({ width, height });
for (let p = 0; p < width * height; p++) {
  out.data[p * 4] = COLOR[0];
  out.data[p * 4 + 1] = COLOR[1];
  out.data[p * 4 + 2] = COLOR[2];
  out.data[p * 4 + 3] = Math.round(Math.min(1, alpha[p]) * OPACITY * 255);
}
fs.writeFileSync(OUT, PNG.sync.write(out));
console.log(
  `wrote ${path.relative(process.cwd(), OUT)} (${width}x${height}, sigma ${sigma.toFixed(1)}px)`,
);
