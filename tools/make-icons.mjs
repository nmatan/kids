/* ---------------------------------------------------------------
   make-icons.mjs — draws the app icons as PNGs.

   Run:  node tools/make-icons.mjs

   Written against Node's built-in zlib so the project needs no npm
   packages at all. Edit ART below to change the icon, then re-run.
   --------------------------------------------------------------- */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'icons');

/* ---------- PNG encoding ---------- */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // 8 bits per channel
  ihdr[9] = 6;  // RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- a very small drawing surface ---------- */

const hex = (s) => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];

class Canvas {
  constructor(size) {
    this.size = size;
    this.buf = Buffer.alloc(size * size * 4); // transparent
  }

  /** Alpha-blend one pixel. */
  blend(x, y, [r, g, b], a) {
    if (a <= 0 || x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    const i = (y * this.size + x) * 4;
    const dstA = this.buf[i + 3] / 255;
    const outA = a + dstA * (1 - a);
    if (outA <= 0) return;
    for (let c = 0; c < 3; c++) {
      this.buf[i + c] = Math.round(([r, g, b][c] * a + this.buf[i + c] * dstA * (1 - a)) / outA);
    }
    this.buf[i + 3] = Math.round(outA * 255);
  }

  /**
   * Fill every pixel where `sdf(x, y) < 0`, antialiased across the edge.
   * `color` may be a function of the normalised y for a gradient.
   * `feather` widens the soft edge — use it for shadows.
   */
  fill(sdf, color, { alpha = 1, feather = 1.1 } = {}) {
    for (let y = 0; y < this.size; y++) {
      const c = typeof color === 'function' ? color(y / this.size) : color;
      for (let x = 0; x < this.size; x++) {
        const d = sdf(x + 0.5, y + 0.5);
        if (d > feather) continue;
        const cov = Math.min(1, Math.max(0, (feather - d) / (2 * feather) + 0.5));
        this.blend(x, y, c, cov * alpha);
      }
    }
  }
}

const roundRect = (size, radius) => (x, y) => {
  const dx = Math.abs(x - size / 2) - (size / 2 - radius);
  const dy = Math.abs(y - size / 2) - (size / 2 - radius);
  const ox = Math.max(dx, 0), oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - radius;
};

const circle = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

/* ---------- the icon itself ---------- */
/* Three dots — one per kid — on a purple gradient. */

const TOP = hex('#8b6bff');
const BOTTOM = hex('#3b1d8f');
const DOTS = ['#ffd23f', '#37d67a', '#ff5c6c'].map(hex);

function ART(canvas, { scale, radius }) {
  const s = canvas.size;
  const gradient = (t) => [
    lerp(TOP[0], BOTTOM[0], t), lerp(TOP[1], BOTTOM[1], t), lerp(TOP[2], BOTTOM[2], t),
  ];

  canvas.fill(roundRect(s, radius), gradient);

  const r = s * 0.115 * scale;
  const spread = s * 0.20 * scale;
  const cx = s / 2, cy = s / 2;
  const positions = [
    [cx, cy - spread * 0.78],            // top
    [cx - spread * 0.9, cy + spread * 0.5], // bottom left
    [cx + spread * 0.9, cy + spread * 0.5], // bottom right
  ];

  positions.forEach(([x, y], i) => {
    // soft drop shadow: low alpha and a wide feather stand in for a blur
    canvas.fill(circle(x, y + s * 0.022, r), [20, 8, 60], { alpha: 0.28, feather: s * 0.03 });
    canvas.fill(circle(x, y, r), DOTS[i]);
  });
}

function build(size, { maskable }) {
  const canvas = new Canvas(size);
  ART(canvas, {
    // Maskable icons get cropped to a circle by Android, so keep the art
    // inside the middle ~60% and let the background go edge to edge.
    scale: maskable ? 0.72 : 1,
    radius: maskable ? 0 : size * 0.22,
  });
  return encodePng(size, size, canvas.buf);
}

mkdirSync(OUT, { recursive: true });

const files = [
  ['icon-192.png', build(192, { maskable: false })],
  ['icon-512.png', build(512, { maskable: false })],
  ['icon-maskable-512.png', build(512, { maskable: true })],
];

for (const [name, data] of files) {
  writeFileSync(join(OUT, name), data);
  console.log(`wrote icons/${name}  (${(data.length / 1024).toFixed(1)} kB)`);
}
