import RNG from '../core/rng';
import { type Ground, LAYERS } from '../gen/layers';
import type { Stage } from '../gen/stage';
import { type Pt, pt } from './draw';

export interface FloorImage {
  canvas: HTMLCanvasElement;
  // Where the area's near corner sits in the image
  ox: number;
  oy: number;
}

const MORTAR = '#202020';
const STONES = ['#3c3c3c', '#383838', '#414141', '#3a3938', '#353535', '#444343'];
const PAD = 4;
// The chasm's depths, and the rock lip along its far edges
const CHASM = '#050505';
const LIP = '#4e4c48';

// Bare ground for the layers outside the city: earth on the surface, raw
// rock on the chasm walls.
const SOIL: Record<Exclude<Ground, 'flagstone'>, { base: string; patches: string[] }> = {
  earth: { base: '#2a2824', patches: ['#2f2c27', '#33302a', '#282622', '#36332c'] },
  rock: { base: '#2c2c2c', patches: ['#363636', '#313131', '#3b3a39', '#2a2a2a'] },
};
const GRASS = ['#4a493f', '#55544a', '#3f3e36'];
const ROAD = '#3f3b34';
const RUT = '#2b2824';
// Half the road's width, in tiles
const ROAD_HALF = 1.1;

/**
 * Draws a stage's floor once, by its layer's ground. In the city it is worn
 * flagstones of uneven size with mortar between them; there is no grid, a
 * tile may hold one stone, two or four. Outside it, bare earth or rock with
 * a road across. Then cracks, grit, rubble, bones and puddles.
 */
export function buildFloor(stage: Stage, zoom: number, seed: number): FloorImage {
  const tw = 32 * zoom;
  const th = 16 * zoom;
  const { width, depth } = stage;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(((width + depth) * tw) / 2 + PAD * 2);
  canvas.height = Math.ceil(((width + depth) * th) / 2 + PAD * 2);
  const ctx = canvas.getContext('2d')!;
  const ox = depth * (tw / 2) + PAD;
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

  // Drawn as the area was built, from its own (0, 0); the renderer puts the
  // image where the area lies. Roads are kept where they lie, so are moved back.
  const X0 = stage.x0 ?? 0;
  const Z0 = stage.z0 ?? 0;
  const local: Stage = {
    ...stage,
    roads: stage.roads.map((road) => road.map((p) => ({ x: p.x - X0, z: p.z - Z0 }))),
  };
  const ground = LAYERS[stage.biome].ground;
  const outline = [at(0, 0), at(width, 0), at(width, depth), at(0, depth)];
  if (ground === 'flagstone') {
    poly(outline, MORTAR);
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        for (const s of splitTile(x, z, rng)) {
          stone(ctx, at, rng, s, zoom, poly);
        }
      }
    }
  } else {
    poly(outline, SOIL[ground].base);
    soil(ctx, at, rng, local, zoom, ground);
    drawRoads(ctx, at, rng, local, zoom);
  }

  // Dark grime where feet and blood have worn the stone.
  const area = (width * depth) / 26;
  for (let i = 0; i < area * 3; i++) {
    const c = at(rng.range(1, width - 1), rng.range(1, depth - 1));
    ctx.fillStyle = 'rgba(10,10,10,0.25)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rng.range(6, 18) * zoom, rng.range(3, 8) * zoom, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Puddles of black water.
  for (let i = 0; i < Math.round(area / 4); i++) {
    const c = at(rng.range(2, width - 2), rng.range(2, depth - 2));
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
  for (let i = 0; i < area * 4; i++) {
    const c = at(rng.range(0.5, width - 0.5), rng.range(0.5, depth - 0.5));
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

  // The chasm: tiles of black, with a lip of rock along the far edges, where
  // the ground breaks off.
  const holes = new Set((stage.chasm ?? []).map((c) => `${c.x - X0},${c.z - Z0}`));
  const hole = (x: number, z: number): boolean => holes.has(`${x},${z}`);
  for (const key of holes) {
    const [x, z] = key.split(',').map(Number);
    const corners = [
      at(x - 0.5, z - 0.5),
      at(x + 0.5, z - 0.5),
      at(x + 0.5, z + 0.5),
      at(x - 0.5, z + 0.5),
    ];
    poly(corners, CHASM);
    ctx.strokeStyle = LIP;
    ctx.lineWidth = zoom;
    if (!hole(x, z - 1)) {
      line(ctx, corners[0], corners[1]);
    }
    if (!hole(x - 1, z)) {
      line(ctx, corners[3], corners[0]);
    }
  }

  return { canvas, ox, oy };
}

function line(ctx: CanvasRenderingContext2D, a: Pt, b: Pt): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

// Patches of earth or rock, and on the surface, tufts of dead grass.
function soil(
  ctx: CanvasRenderingContext2D,
  at: (x: number, z: number) => Pt,
  rng: RNG,
  stage: Stage,
  zoom: number,
  ground: Exclude<Ground, 'flagstone'>,
): void {
  const { patches } = SOIL[ground];
  for (let i = 0; i < stage.width * stage.depth * 1.5; i++) {
    const c = at(rng.range(0, stage.width), rng.range(0, stage.depth));
    const rx = rng.range(6, 16) * zoom;
    ctx.fillStyle = rng.pick(patches);
    ctx.beginPath();
    ctx.ellipse(Math.round(c.x), Math.round(c.y), rx, rx * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ground !== 'earth') {
    return;
  }
  for (let i = 0; i < stage.width * stage.depth * 2.5; i++) {
    const c = at(rng.range(0.3, stage.width - 0.3), rng.range(0.3, stage.depth - 0.3));
    ctx.fillStyle = rng.pick(GRASS);
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    const h = Math.round(rng.range(1, 3) * zoom);
    ctx.fillRect(x, y - h, 1, h);
    ctx.fillRect(x + 2, y - h + 1, 1, h - 1 || 1);
  }
}

// The roads across the area: packed earth with wheel ruts and loose stones,
// with ragged edges.
function drawRoads(
  ctx: CanvasRenderingContext2D,
  at: (x: number, z: number) => Pt,
  rng: RNG,
  stage: Stage,
  zoom: number,
): void {
  const points: { x: number; z: number }[] = [];
  for (const road of stage.roads) {
    for (let i = 1; i < road.length; i++) {
      const a = road[i - 1];
      const b = road[i];
      const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.3);
      for (let k = 0; k < n; k++) {
        points.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
      }
    }
  }
  // A world circle of radius r is an ellipse on the floor image.
  const sx = (tile: number): number => tile * 16 * Math.SQRT2 * zoom;
  ctx.fillStyle = ROAD;
  for (const p of points) {
    const c = at(p.x, p.z);
    const r = sx(ROAD_HALF * rng.range(0.85, 1.1));
    ctx.beginPath();
    ctx.ellipse(Math.round(c.x), Math.round(c.y), r, r / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = RUT;
  for (const p of points) {
    for (const side of [-0.45, 0.45]) {
      const c = at(p.x, p.z + side);
      ctx.fillRect(Math.round(c.x), Math.round(c.y), Math.ceil(2 * zoom), 1);
    }
  }
  for (const p of points) {
    if (rng.chance(0.5)) {
      const c = at(p.x + rng.range(-0.9, 0.9), p.z + rng.range(-0.9, 0.9));
      ctx.fillStyle = rng.pick(STONES);
      ctx.fillRect(Math.round(c.x), Math.round(c.y), Math.ceil(2 * zoom), 1);
    }
  }
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
