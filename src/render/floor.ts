import RNG from '../core/rng';
import type { Stage } from '../game/stage';
import { type Pt, pt } from './draw';

export interface FloorImage {
  canvas: HTMLCanvasElement;
  // Where tile (0, 0) sits in the image
  ox: number;
  oy: number;
}

const MORTAR = '#202020';
const STONES = ['#3c3c3c', '#383838', '#414141', '#3a3938', '#353535', '#444343'];
const PAD = 4;

/**
 * Draws a stage's floor once: worn flagstones of uneven size with mortar
 * between them, cracks, grit, rubble, bones and puddles. There is no grid:
 * a tile may hold one stone, two or four.
 */
export function buildFloor(stage: Stage, zoom: number, seed: number): FloorImage {
  const tw = 32 * zoom;
  const th = 16 * zoom;
  const size = stage.size;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(size * tw + PAD * 2);
  canvas.height = Math.ceil(size * th + PAD * 2);
  const ctx = canvas.getContext('2d')!;
  const ox = size * (tw / 2) + PAD;
  const oy = PAD;
  const at = (x: number, z: number): Pt => pt((x - z) * (tw / 2) + ox, (x + z) * (th / 2) + oy);
  const rng = new RNG(seed);

  const poly = (pts: Pt[], color: string): void => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i) {
        ctx.lineTo(p.x, p.y);
      } else {
        ctx.moveTo(p.x, p.y);
      }
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  poly([at(0, 0), at(size, 0), at(size, size), at(0, size)], MORTAR);

  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      for (const s of splitTile(x, z, rng)) {
        stone(ctx, at, rng, s, zoom, poly);
      }
    }
  }

  // Dark grime where feet and blood have worn the stone.
  for (let i = 0; i < size * 3; i++) {
    const c = at(rng.range(1, size - 1), rng.range(1, size - 1));
    ctx.fillStyle = 'rgba(10,10,10,0.25)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rng.range(6, 18) * zoom, rng.range(3, 8) * zoom, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Puddles of black water.
  for (let i = 0; i < Math.round(size / 4); i++) {
    const c = at(rng.range(2, size - 2), rng.range(2, size - 2));
    const rx = rng.range(8, 16) * zoom;
    ctx.fillStyle = '#141414';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, rx * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = zoom;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, rx * 0.45, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }

  // Rubble and old bones.
  for (let i = 0; i < size * 4; i++) {
    const c = at(rng.range(0.5, size - 0.5), rng.range(0.5, size - 0.5));
    if (rng.chance(0.75)) {
      const r = rng.range(1, 2.6) * zoom;
      const pts = [0, 1, 2, 3, 4].map((k) => {
        const a = (k / 5) * Math.PI * 2 + rng.random();
        return pt(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.7);
      });
      poly(
        pts.map((p) => pt(p.x + zoom, p.y + zoom)),
        'rgba(0,0,0,0.5)',
      );
      poly(pts, rng.pick(STONES));
    } else {
      ctx.strokeStyle = '#8f8a82';
      ctx.lineWidth = zoom;
      const a = rng.random() * Math.PI;
      const l = rng.range(2, 4) * zoom;
      ctx.beginPath();
      ctx.moveTo(c.x - Math.cos(a) * l, c.y - Math.sin(a) * l * 0.5);
      ctx.lineTo(c.x + Math.cos(a) * l, c.y + Math.sin(a) * l * 0.5);
      ctx.stroke();
    }
  }

  return { canvas, ox, oy };
}

interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

// One stone fills the tile, or it splits into two or four.
function splitTile(x: number, z: number, rng: RNG): Rect[] {
  const r = rng.random();
  if (r < 0.45) {
    return [{ x0: x, z0: z, x1: x + 1, z1: z + 1 }];
  }
  if (r < 0.7) {
    const m = rng.range(0.35, 0.65);
    return [
      { x0: x, z0: z, x1: x + m, z1: z + 1 },
      { x0: x + m, z0: z, x1: x + 1, z1: z + 1 },
    ];
  }
  if (r < 0.9) {
    const m = rng.range(0.35, 0.65);
    return [
      { x0: x, z0: z, x1: x + 1, z1: z + m },
      { x0: x, z0: z + m, x1: x + 1, z1: z + 1 },
    ];
  }
  const mx = rng.range(0.4, 0.6);
  const mz = rng.range(0.4, 0.6);
  return [
    { x0: x, z0: z, x1: x + mx, z1: z + mz },
    { x0: x + mx, z0: z, x1: x + 1, z1: z + mz },
    { x0: x, z0: z + mz, x1: x + mx, z1: z + 1 },
    { x0: x + mx, z0: z + mz, x1: x + 1, z1: z + 1 },
  ];
}

function stone(
  ctx: CanvasRenderingContext2D,
  at: (x: number, z: number) => Pt,
  rng: RNG,
  s: Rect,
  zoom: number,
  poly: (pts: Pt[], color: string) => void,
): void {
  // Gaps of mortar between stones, and corners that are not quite square.
  const gap = rng.range(0.03, 0.06);
  const j = (): number => rng.range(-0.025, 0.025);
  const corners = [
    at(s.x0 + gap + j(), s.z0 + gap + j()),
    at(s.x1 - gap + j(), s.z0 + gap + j()),
    at(s.x1 - gap + j(), s.z1 - gap + j()),
    at(s.x0 + gap + j(), s.z1 - gap + j()),
  ];
  poly(corners, rng.pick(STONES));

  // A worn highlight on the back edges and a shadow on the front ones.
  ctx.lineWidth = zoom * 0.8;
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(corners[3].x, corners[3].y);
  ctx.lineTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[2].x, corners[2].y);
  ctx.lineTo(corners[3].x, corners[3].y);
  ctx.stroke();

  // Grit: a few lighter and darker specks.
  const point = (u: number, v: number): Pt => {
    const a = corners[0];
    const b = corners[1];
    const c = corners[2];
    const d = corners[3];
    const top = pt(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u);
    const bottom = pt(d.x + (c.x - d.x) * u, d.y + (c.y - d.y) * u);
    return pt(top.x + (bottom.x - top.x) * v, top.y + (bottom.y - top.y) * v);
  };
  const area = (s.x1 - s.x0) * (s.z1 - s.z0);
  for (let i = 0; i < Math.round(area * 10 * zoom); i++) {
    const p = point(rng.range(0.1, 0.9), rng.range(0.1, 0.9));
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(Math.round(p.x), Math.round(p.y), zoom > 1 ? 2 : 1, 1);
  }

  // Some stones are cracked.
  if (rng.chance(0.14)) {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = zoom * 0.7;
    ctx.beginPath();
    const a = point(rng.range(0.1, 0.3), rng.range(0.1, 0.9));
    const b = point(rng.range(0.4, 0.6), rng.range(0.2, 0.8));
    const c = point(rng.range(0.7, 0.9), rng.range(0.1, 0.9));
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }
}
