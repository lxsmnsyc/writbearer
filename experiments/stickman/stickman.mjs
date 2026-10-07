// Generates an isometric stick-man sprite sheet with no dependencies.
// Rows: 8 directions. Columns: idle, walk x6, attack x3.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const FRAME = 48;
const DIRS = 8;
const COLS = 10;

// ---------- raster ----------
function makeImage(w, h) {
  return { w, h, data: new Uint8Array(w * h * 4) };
}
function setPx(img, x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  const a = c[3] / 255;
  img.data[i] = img.data[i] * (1 - a) + c[0] * a;
  img.data[i + 1] = img.data[i + 1] * (1 - a) + c[1] * a;
  img.data[i + 2] = img.data[i + 2] * (1 - a) + c[2] * a;
  img.data[i + 3] = Math.min(255, img.data[i + 3] + c[3] * (1 - img.data[i + 3] / 255));
}
function dot(img, x, y, c, r) {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (dx * dx + dy * dy <= r * r + 0.5) setPx(img, x + dx, y + dy, c);
}
function line(img, x0, y0, x1, y1, c, r = 1) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) * 2 + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    dot(img, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, c, r);
  }
}
function ellipse(img, cx, cy, rx, ry, c) {
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++)
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) setPx(img, cx + x, cy + y, c);
}

// ---------- png ----------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(img) {
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 4 + 1)] = 0;
    Buffer.from(img.data.buffer, y * img.w * 4, img.w * 4).copy(raw, y * (img.w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- skeleton ----------
// World: x forward, y right, z up. Units are pixels.
function pose(kind, t) {
  const s = Math.sin(t * Math.PI * 2);
  const bob = kind === 'walk' ? Math.abs(Math.cos(t * Math.PI * 2)) * 1 : 0;
  const swing = kind === 'walk' ? 1 : 0;
  const hip = [0, 0, 15 + bob];
  const neck = [kind === 'attack' ? 1.5 : 0, 0, 25 + bob];
  const head = [neck[0], 0, 29.5 + bob];
  const legs = [-1, 1].map((side) => {
    const ph = side * s * swing;
    const lift = kind === 'walk' ? Math.max(0, side * Math.cos(t * Math.PI * 2)) * 2.5 : 0;
    const foot = [ph * 5, side * 2.5, lift];
    const knee = [ph * 2.5 + 1.5, side * 2.2, 7.5 + lift * 0.5 + bob * 0.5];
    return { side, hip: [0, side * 2, hip[2]], knee, foot };
  });
  const arms = [-1, 1].map((side) => {
    const sh = [neck[0], side * 3, 23.5 + bob];
    let hand, elbow;
    if (kind === 'attack' && side === 1) {
      const p = [0.2, 1, 0.4][Math.round(t * 2)];
      hand = [sh[0] + 2 + p * 8, 2, 21 + p * 1.5];
      elbow = [sh[0] + 1 + p * 3.5, 3, 18.5 + p * 2];
    } else {
      const ph = -side * s * swing;
      hand = [ph * 4, side * 3.5, 15 + bob];
      elbow = [ph * 2, side * 3.8, 19 + bob];
    }
    return { side, sh, elbow, hand };
  });
  return { hip, neck, head, legs, arms };
}

// ---------- projection ----------
// Direction 0 faces the camera (screen down). Each row turns 45 degrees clockwise on screen.
function project(p, dir, ox, oy) {
  const a = (dir * Math.PI) / 4 + Math.PI / 4;
  const x = p[0] * Math.cos(a) - p[1] * Math.sin(a);
  const y = p[0] * Math.sin(a) + p[1] * Math.cos(a);
  return { sx: ox + (x - y) * 0.75, sy: oy + (x + y) * 0.38 - p[2], depth: x + y };
}

const NEAR = [236, 232, 225, 255];
const FAR = [140, 136, 132, 255];
const HEAD = [250, 246, 238, 255];
const EYE = [30, 30, 36, 255];
const SHADOW = [0, 0, 0, 70];

function drawFrame(img, col, row) {
  const ox = col * FRAME + FRAME / 2;
  const oy = row * FRAME + FRAME - 8;
  const kind = col === 0 ? 'idle' : col <= 6 ? 'walk' : 'attack';
  const t = kind === 'walk' ? (col - 1) / 6 : kind === 'attack' ? (col - 7) / 2 : 0;
  const P = pose(kind, t);
  const pr = (p) => project(p, row, ox, oy);

  ellipse(img, ox, oy, 6, 2, SHADOW);

  const segs = [];
  for (const l of P.legs) {
    segs.push([l.hip, l.knee], [l.knee, l.foot]);
  }
  for (const a of P.arms) {
    segs.push([a.sh, a.elbow], [a.elbow, a.hand]);
  }
  segs.push([P.hip, P.neck]);
  const arms = P.arms;
  segs.push([arms[0].sh, arms[1].sh]);

  const items = segs.map(([a, b]) => {
    const A = pr(a), B = pr(b);
    return { A, B, depth: (A.depth + B.depth) / 2 };
  });
  const head = pr(P.head);
  items.push({ head, depth: head.depth });
  items.sort((p, q) => p.depth - q.depth);

  const mid = pr(P.hip).depth;
  for (const it of items) {
    if (it.head) {
      dot(img, it.head.sx, it.head.sy, HEAD, 3);
      const f = pr([P.head[0] + 2.6, 0, P.head[2] + 0.3]);
      if (f.depth > it.head.depth) setPx(img, f.sx, f.sy, EYE);
    } else {
      const c = it.depth < mid - 0.5 ? FAR : NEAR;
      line(img, it.A.sx, it.A.sy, it.B.sx, it.B.sy, c, 1);
    }
  }
}

const sheet = makeImage(FRAME * COLS, FRAME * DIRS);
for (let r = 0; r < DIRS; r++) for (let c = 0; c < COLS; c++) drawFrame(sheet, c, r);
writeFileSync(new URL('./stickman-sheet.png', import.meta.url), png(sheet));

// Preview: 3x scale on a dark grid, so frames are easy to read.
const S = 3;
const prev = makeImage(sheet.w * S, sheet.h * S);
for (let y = 0; y < prev.h; y++)
  for (let x = 0; x < prev.w; x++) {
    const cell = ((Math.floor(x / (FRAME * S)) + Math.floor(y / (FRAME * S))) % 2) ? 44 : 52;
    const i = (y * prev.w + x) * 4;
    prev.data[i] = cell; prev.data[i + 1] = cell + 4; prev.data[i + 2] = cell + 10; prev.data[i + 3] = 255;
    const si = (Math.floor(y / S) * sheet.w + Math.floor(x / S)) * 4;
    const a = sheet.data[si + 3] / 255;
    for (let k = 0; k < 3; k++) prev.data[i + k] = prev.data[i + k] * (1 - a) + sheet.data[si + k] * a;
  }
writeFileSync(new URL('./stickman-preview.png', import.meta.url), png(prev));
console.log('sheet', sheet.w, sheet.h, 'preview', prev.w, prev.h);
