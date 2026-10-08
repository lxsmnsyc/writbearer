// Writbearer visual demo: greyscale cut-paper figures in pixel art.
// Color is information: red is blood and danger, gold is light and the
// bearer, teal is the Hollow's dead.

import { drawUnit, emissives, type Kind } from './rig';

// ---------- screen ----------
const W = 384;
const H = 216;
const SCALE = 3;

const screen = document.getElementById('screen') as HTMLCanvasElement;
screen.width = W * SCALE;
screen.height = H * SCALE;
const out = screen.getContext('2d')!;
out.imageSmoothingEnabled = false;

const small = document.createElement('canvas');
small.width = W;
small.height = H;
const ctx = small.getContext('2d', { willReadFrequently: true })!;

const maskCanvas = document.createElement('canvas');
maskCanvas.width = W;
maskCanvas.height = H;
const mask = maskCanvas.getContext('2d')!;

// ---------- palette ----------
const C = {
  void: '#0a0a0a',
  stoneA: '#3e3e3e',
  stoneB: '#373737',
  stoneLine: '#1a1a1a',
  ink: '#0c0c0c',
  merc: '#e4e4e4',
  bearer: '#7a7a7a',
  monster: '#1c1c1c',
  cultist: '#2a2a2a',
  wood: '#2e2e2e',
  skin: '#b8b8b8',
  bone: '#d6d6d6',
  cloth: '#9a9a9a',
  blood: '#8e1414',
  bloodDark: '#560b0b',
  gold: '#c9973a',
  flame: '#f2c25a',
  teal: '#5fd4c0',
};
const GREYS = Array.from({ length: 16 }, (_, i) => Math.round(8 + i * 15.5));
const PALETTE: [number, number, number][] = [
  ...GREYS.map((g) => [g, g, g] as [number, number, number]),
  ...[C.blood, C.bloodDark, '#3a0808', C.gold, '#7a5a22', C.flame, C.teal, '#2f6a60'].map(
    (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number],
  ),
];

// ---------- random ----------
let seed = 7;
const rand = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const range = (a: number, b: number): number => a + rand() * (b - a);

// ---------- projection ----------
// The world is in tiles. A tile is 32x16 pixels on screen.
const TW = 32;
const TH = 16;
const MAP = 26;
const cam = { x: 0, y: 0 };
interface Pt {
  x: number;
  y: number;
}
const P = (x: number, y: number): Pt => ({ x, y });
const iso = (x: number, z: number): Pt => P(Math.round((x - z) * (TW / 2) - cam.x), Math.round((x + z) * (TH / 2) - cam.y));
// A point on the floor, in tiles.
interface Spot {
  x: number;
  z: number;
}
function unproject(sx: number, sy: number): Spot {
  const X = sx + cam.x;
  const Y = sy + cam.y;
  const a = (2 * X) / TW;
  const b = (2 * Y) / TH;
  return { x: (a + b) / 2, z: (b - a) / 2 };
}

// ---------- drawing primitives ----------
function fillPoly(pts: Pt[], color: string, stroke: string | null = C.ink): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
function quad(a: Pt, b: Pt, wa: number, wb: number): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  return [P(a.x + nx * wa, a.y + ny * wa), P(b.x + nx * wb, b.y + ny * wb), P(b.x - nx * wb, b.y - ny * wb), P(a.x - nx * wa, a.y - ny * wa)];
}
function hex(c: Pt, r: number, rot = 0.5): Pt[] {
  return [0, 1, 2, 3, 4, 5].map((i) => P(c.x + r * Math.cos((i * Math.PI) / 3 + rot), c.y + r * Math.sin((i * Math.PI) / 3 + rot)));
}
function blob(c: Pt, rx: number, ry: number, n = 9, s = 1): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 0.7 + ((Math.sin(i * 12.9898 + s * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.5;
    return P(c.x + Math.cos(a) * rx * k, c.y + Math.sin(a) * ry * k);
  });
}

// ---------- units ----------
type Side = 'party' | 'monster';

interface Unit {
  kind: Kind;
  side: Side;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  reach: number;
  damage: number;
  rate: number;
  cooldown: number;
  // Facing on the floor, in radians, and the facing it turns toward.
  angle: number;
  want: number;
  // Walk cycle phase, and how much of a stride the legs are taking (0 to 1).
  walk: number;
  stride: number;
  moving: boolean;
  // Attack progress from 0 to 1, or -1. The effect lands at `hitAt`.
  atk: number;
  atkTarget: Unit | null;
  hitDone: boolean;
  hurt: number;
  // True while the unit has an enemy. Rangers raise the bow.
  alert: boolean;
  target: Unit | null;
  awake: boolean;
  flash: number;
  dead: boolean;
}

// How long each attack takes, and when in it the blow lands.
const ATTACK: Record<Kind, { time: number; hitAt: number }> = {
  bearer: { time: 1, hitAt: 1 },
  vanguard: { time: 0.65, hitAt: 0.58 },
  ranger: { time: 0.95, hitAt: 0.7 },
  soldier: { time: 0.85, hitAt: 0.62 },
  cultist: { time: 0.6, hitAt: 0.56 },
  crawler: { time: 0.5, hitAt: 0.5 },
};

const STATS: Record<Kind, Pick<Unit, 'maxHp' | 'speed' | 'reach' | 'damage' | 'rate'>> = {
  bearer: { maxHp: 40, speed: 2.4, reach: 0, damage: 0, rate: 0 },
  vanguard: { maxHp: 140, speed: 2.6, reach: 0.95, damage: 14, rate: 0.9 },
  ranger: { maxHp: 70, speed: 2.7, reach: 5.5, damage: 11, rate: 1.0 },
  soldier: { maxHp: 55, speed: 1.9, reach: 1.1, damage: 7, rate: 1.3 },
  cultist: { maxHp: 35, speed: 2.2, reach: 0.9, damage: 6, rate: 1.0 },
  crawler: { maxHp: 30, speed: 2.5, reach: 0.9, damage: 5, rate: 0.8 },
};

function makeUnit(kind: Kind, x: number, z: number): Unit {
  const s = STATS[kind];
  return {
    kind,
    side: kind === 'bearer' || kind === 'vanguard' || kind === 'ranger' ? 'party' : 'monster',
    x,
    z,
    hp: s.maxHp,
    ...s,
    cooldown: 0,
    angle: Math.PI / 4,
    want: Math.PI / 4,
    walk: rand() * 6,
    stride: 0,
    moving: false,
    atk: -1,
    atkTarget: null,
    hitDone: false,
    hurt: 9,
    alert: false,
    target: null,
    awake: false,
    flash: 0,
    dead: false,
  };
}

// ---------- world ----------
interface Prop {
  kind: 'pillar' | 'gibbet' | 'pike' | 'banner' | 'altar' | 'candle';
  x: number;
  z: number;
}
interface Piece {
  kind: 'limb' | 'head' | 'chunk' | 'shield';
  x: number;
  z: number;
  vx: number;
  vz: number;
  h: number;
  vh: number;
  rot: number;
  spin: number;
  color: string;
}
interface Decal {
  x: number;
  z: number;
  r: number;
  color: string;
  seed: number;
}
interface Particle {
  x: number;
  z: number;
  h: number;
  vx: number;
  vz: number;
  vh: number;
  life: number;
}
interface Arrow {
  x: number;
  z: number;
  h: number;
  target: Unit;
  damage: number;
}

let units: Unit[] = [];
let props: Prop[] = [];
let pieces: Piece[] = [];
let decals: Decal[] = [];
let particles: Particle[] = [];
let arrows: Arrow[] = [];
let bearer: Unit;
let waveTimer = 0;
let killed = 0;
let gameOver = false;

const SIGIL = P(17, 8);

function reset(): void {
  seed = 7;
  units = [];
  pieces = [];
  decals = [];
  particles = [];
  arrows = [];
  killed = 0;
  gameOver = false;
  waveTimer = 14;
  bearer = makeUnit('bearer', 6, 17);
  units.push(bearer, makeUnit('vanguard', 7, 16), makeUnit('ranger', 5, 17.6));
  props = [
    { kind: 'pillar', x: 9, z: 9 },
    { kind: 'pillar', x: 12, z: 18 },
    { kind: 'pillar', x: 4, z: 7 },
    { kind: 'pillar', x: 20, z: 15 },
    { kind: 'gibbet', x: 10.5, z: 5 },
    { kind: 'pike', x: 14, z: 13 },
    { kind: 'pike', x: 21, z: 5 },
    { kind: 'pike', x: 3, z: 12 },
    { kind: 'banner', x: 15, z: 5.2 },
    { kind: 'altar', x: SIGIL.x, z: SIGIL.y },
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    props.push({ kind: 'candle', x: SIGIL.x + Math.cos(a) * 2.4, z: SIGIL.y + Math.sin(a) * 2.4 });
  }
  // Old blood on the floor.
  for (let i = 0; i < 6; i++) decals.push({ x: range(3, 23), z: range(3, 23), r: range(0.4, 0.9), color: C.bloodDark, seed: i });
  // Cultists at the altar, a soldier pack and crawlers in the dark.
  for (const [x, z] of [[16, 6.6], [18.6, 9], [15.4, 9.4]]) units.push(makeUnit('cultist', x, z));
  for (const [x, z] of [[20, 18], [21, 19.4]]) units.push(makeUnit('soldier', x, z));
  for (const [x, z] of [[8, 4], [6.5, 3.5]]) units.push(makeUnit('crawler', x, z));
}

function spawnWave(): void {
  const kinds: Kind[] = ['soldier', 'soldier', 'crawler', 'cultist'];
  const a = rand() * Math.PI * 2;
  const cx = Math.min(MAP - 2, Math.max(2, bearer.x + Math.cos(a) * 10));
  const cz = Math.min(MAP - 2, Math.max(2, bearer.z + Math.sin(a) * 10));
  const n = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const u = makeUnit(kinds[Math.floor(rand() * kinds.length)], cx + range(-1, 1), cz + range(-1, 1));
    u.awake = true;
    units.push(u);
  }
}

// ---------- input ----------
const keys = new Set<string>();
let moveTo: Spot | null = null;
addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'r') reset();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
screen.addEventListener('mousedown', (e) => {
  const r = screen.getBoundingClientRect();
  const sx = ((e.clientX - r.left) / r.width) * W;
  const sy = ((e.clientY - r.top) / r.height) * H;
  const spot = unproject(sx, sy);
  // Clamp to the map, so a click in the dark beyond the edge still works.
  moveTo = { x: Math.min(MAP - 0.5, Math.max(0.5, spot.x)), z: Math.min(MAP - 0.5, Math.max(0.5, spot.z)) };
});

// ---------- simulation ----------
const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);
const alive = (): Unit[] => units.filter((u) => !u.dead);

function step(u: Unit, tx: number, tz: number, dt: number, speed = u.speed, backward = false): void {
  if (u.atk >= 0) return;
  const dx = tx - u.x;
  const dz = tz - u.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return;
  const s = Math.min(d, speed * dt);
  u.x += (dx / d) * s;
  u.z += (dz / d) * s;
  u.moving = true;
  // The walk cycle advances with distance, so feet do not slide.
  u.walk += s * 5.2 * (backward ? -1 : 1);
  if (!backward) u.want = Math.atan2(dz, dx);
}

function face(u: Unit, t: { x: number; z: number }): void {
  u.want = Math.atan2(t.z - u.z, t.x - u.x);
}

// Starts an attack. The effect lands later, at the attack's hit frame.
function attack(u: Unit, t: Unit): void {
  if (u.atk >= 0 || u.cooldown > 0) return;
  u.atk = 0;
  u.atkTarget = t;
  u.hitDone = false;
  u.cooldown = u.rate + ATTACK[u.kind].time;
}

function landAttack(u: Unit): void {
  const t = u.atkTarget;
  if (!t || t.dead) return;
  if (u.kind === 'ranger') {
    arrows.push({ x: u.x, z: u.z, h: 1.4, target: t, damage: u.damage });
  } else if (dist(u, t) <= u.reach + 0.35) {
    hurt(t, u.damage, u);
  }
}

function hurt(target: Unit, amount: number, from: { x: number; z: number }): void {
  if (target.dead) return;
  const armor = target.kind === 'vanguard' ? 0.5 : 1;
  target.hp -= amount * armor;
  target.flash = 0.12;
  target.hurt = 0;
  target.awake = true;
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  for (let i = 0; i < 7; i++) {
    particles.push({ x: target.x, z: target.z, h: 0.7, vx: (dx / d) * range(0.5, 2.5) + range(-1, 1), vz: (dz / d) * range(0.5, 2.5) + range(-1, 1), vh: range(1, 3), life: range(0.4, 0.9) });
  }
  if (rand() < 0.5) decals.push({ x: target.x + range(-0.4, 0.4), z: target.z + range(-0.4, 0.4), r: range(0.12, 0.25), color: C.blood, seed: rand() * 99 });
  if (target.hp <= 0) kill(target, dx / d, dz / d);
}

function kill(u: Unit, dx: number, dz: number): void {
  u.dead = true;
  if (u.side === 'monster') killed++;
  if (u === bearer) gameOver = true;
  decals.push({ x: u.x, z: u.z, r: u.kind === 'crawler' ? 0.9 : 0.75, color: C.blood, seed: rand() * 99 });
  const color = bodyColor(u);
  const fling = (kind: Piece['kind'], c = color): void => {
    pieces.push({ kind, x: u.x, z: u.z, vx: dx * range(1, 3) + range(-1.5, 1.5), vz: dz * range(1, 3) + range(-1.5, 1.5), h: 0.6, vh: range(1.5, 3.5), rot: rand() * 6, spin: range(-10, 10), color: c });
  };
  if (u.kind === 'crawler') {
    for (let i = 0; i < 4; i++) fling('chunk');
  } else {
    fling('head');
    for (let i = 0; i < 4; i++) fling('limb');
    fling('chunk');
    if (u.kind === 'vanguard') fling('shield', C.merc);
  }
  for (let i = 0; i < 14; i++) {
    particles.push({ x: u.x, z: u.z, h: 0.6, vx: range(-2.5, 2.5), vz: range(-2.5, 2.5), vh: range(1.5, 4), life: range(0.5, 1.1) });
  }
}

function update(dt: number): void {
  for (const u of units) {
    u.moving = false;
    u.cooldown = Math.max(0, u.cooldown - dt);
    u.flash = Math.max(0, u.flash - dt);
    u.hurt += dt;
    if (u.atk >= 0 && !u.dead) {
      if (u.atkTarget) face(u, u.atkTarget);
      u.atk += dt / ATTACK[u.kind].time;
      if (!u.hitDone && u.atk >= ATTACK[u.kind].hitAt) {
        u.hitDone = true;
        landAttack(u);
      }
      if (u.atk >= 1) u.atk = -1;
    }
  }
  if (!gameOver) {
    // The bearer: WASD moves along the screen, a click walks to a spot.
    let mx = 0;
    let my = 0;
    if (keys.has('w') || keys.has('arrowup')) my -= 1;
    if (keys.has('s') || keys.has('arrowdown')) my += 1;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (mx || my) {
      moveTo = null;
      // Screen right is (+x, -z), screen down is (+x, +z).
      const wx = mx + my;
      const wz = -mx + my;
      const l = Math.hypot(wx, wz);
      step(bearer, bearer.x + (wx / l) * 2, bearer.z + (wz / l) * 2, dt);
    } else if (moveTo) {
      step(bearer, moveTo.x, moveTo.z, dt);
      if (dist(bearer, moveTo) < 0.1) moveTo = null;
    }
  }

  const living = alive();
  const enemies = living.filter((u) => u.side === 'monster');
  const party = living.filter((u) => u.side === 'party');

  for (const u of living) {
    if (u === bearer) continue;
    if (u.side === 'party') {
      // Mercs go first for anything attacking the bearer, then the nearest threat.
      const onBearer = enemies.filter((e) => e.target === bearer && dist(e, bearer) < 7);
      const pool = onBearer.length ? onBearer : enemies.filter((e) => e.awake && (dist(e, u) < 6 || dist(e, bearer) < 6));
      u.target = pool.sort((a, b) => dist(a, u) - dist(b, u))[0] ?? null;
      if (u.target) {
        const d = dist(u, u.target);
        face(u, u.target);
        if (u.kind === 'ranger' && d < 2.2 && u.atk < 0) {
          // Back away while still facing the threat.
          step(u, u.x + (u.x - u.target.x), u.z + (u.z - u.target.z), dt, u.speed * 0.7, true);
        } else if (d > u.reach) {
          step(u, u.target.x, u.target.z, dt);
        } else {
          attack(u, u.target);
        }
      } else {
        // Guard position: the Vanguard in front of the bearer, the Ranger behind.
        const off = u.kind === 'vanguard' ? 1.3 : -1.3;
        const gx = bearer.x + off * Math.cos(bearer.angle);
        const gz = bearer.z + off * Math.sin(bearer.angle);
        if (dist(u, { x: gx, z: gz }) > 0.6) step(u, gx, gz, dt);
        if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 3 * dt);
      }
    } else {
      // Monsters wake when they see the lantern, then hunt.
      if (!u.awake && dist(u, bearer) < 7) {
        // One sees the lantern and the whole pack wakes.
        for (const m of enemies) if (dist(m, u) < 4) m.awake = true;
      }
      if (!u.awake) continue;
      if (u.kind === 'crawler') u.target = party.sort((a, b) => dist(a, u) - dist(b, u))[0] ?? null;
      else u.target = bearer.dead ? party[0] ?? null : bearer;
      // Something in the way gets hit first.
      const blocker = party.find((p) => p !== u.target && dist(p, u) < u.reach * 0.9);
      const t = blocker ?? u.target;
      if (!t) continue;
      face(u, t);
      if (dist(u, t) > u.reach) step(u, t.x, t.z, dt);
      else attack(u, t);
    }
  }

  // Bodies push each other apart, and props block.
  for (let i = 0; i < living.length; i++) {
    for (let j = i + 1; j < living.length; j++) {
      const a = living[i];
      const b = living[j];
      const d = dist(a, b);
      if (d > 0 && d < 0.55) {
        // Mercs make way for the bearer instead of pushing it.
        const yieldA = b === bearer && a.side === 'party' ? 1 : a === bearer && b.side === 'party' ? 0 : 0.5;
        const nx = (a.x - b.x) / d;
        const nz = (a.z - b.z) / d;
        const push = 0.55 - d;
        a.x += nx * push * yieldA;
        a.z += nz * push * yieldA;
        b.x -= nx * push * (1 - yieldA);
        b.z -= nz * push * (1 - yieldA);
      }
    }
    const u = living[i];
    for (const p of props) {
      if (p.kind === 'candle') continue;
      const r = p.kind === 'altar' ? 0.8 : 0.45;
      const d = dist(u, p);
      if (d < r && d > 0) {
        u.x = p.x + ((u.x - p.x) / d) * r;
        u.z = p.z + ((u.z - p.z) / d) * r;
      }
    }
    u.x = Math.min(MAP - 0.5, Math.max(0.5, u.x));
    u.z = Math.min(MAP - 0.5, Math.max(0.5, u.z));
  }

  for (const u of living) u.alert = !!u.target && !u.target.dead;
  for (const u of living) {
    // Turn toward the wanted facing, and ease the stride in and out.
    let d = u.want - u.angle;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    u.angle += Math.sign(d) * Math.min(Math.abs(d), 9 * dt);
    u.stride += ((u.moving ? 1 : 0) - u.stride) * Math.min(1, dt * 10);
    // Planted feet settle back to standing when the unit stops.
    if (!u.moving && u.stride < 0.05) u.walk += (Math.round(u.walk / Math.PI) * Math.PI - u.walk) * Math.min(1, dt * 6);
  }

  for (const a of arrows) {
    const d = dist(a, a.target);
    const s = 12 * dt;
    if (d <= s || a.target.dead) {
      hurt(a.target, a.damage, a);
      a.h = -1;
    } else {
      a.x += ((a.target.x - a.x) / d) * s;
      a.z += ((a.target.z - a.z) / d) * s;
    }
  }
  arrows = arrows.filter((a) => a.h >= 0);

  for (const p of particles) {
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.vh -= 9 * dt;
    p.h += p.vh * dt;
    p.life -= dt;
    if (p.h <= 0) {
      if (rand() < 0.15) decals.push({ x: p.x, z: p.z, r: 0.08, color: C.blood, seed: rand() * 99 });
      p.life = 0;
    }
  }
  particles = particles.filter((p) => p.life > 0);

  for (const p of pieces) {
    if (p.h > 0 || p.vh > 0) {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.vh -= 9 * dt;
      p.h = Math.max(0, p.h + p.vh * dt);
      p.rot += p.spin * dt;
      if (p.h === 0) {
        p.vh = 0;
        p.vx *= 0.3;
        p.vz *= 0.3;
        p.spin = 0;
        decals.push({ x: p.x, z: p.z, r: 0.14, color: C.blood, seed: rand() * 99 });
      }
    }
  }
  if (decals.length > 400) decals.splice(6, decals.length - 400);

  waveTimer -= dt;
  if (waveTimer <= 0 && enemies.length < 9 && !gameOver) {
    spawnWave();
    waveTimer = 16;
  }
}

// ---------- figures ----------
function bodyColor(u: Unit): string {
  if (u.kind === 'bearer') return C.bearer;
  if (u.side === 'party') return C.merc;
  if (u.kind === 'cultist') return C.cultist;
  return C.monster;
}

function drawProp(p: Prop, base: Pt): void {
  if (p.kind === 'pillar') {
    fillPoly([P(base.x - 7, base.y), P(base.x + 7, base.y), P(base.x + 7, base.y - 46), P(base.x - 7, base.y - 46)], C.stoneA);
    fillPoly([P(base.x - 7, base.y - 46), P(base.x + 7, base.y - 46), P(base.x + 2, base.y - 52)], C.stoneA);
  }
  if (p.kind === 'gibbet') {
    fillPoly([P(base.x - 2, base.y), P(base.x + 2, base.y), P(base.x + 2, base.y - 64), P(base.x - 2, base.y - 64)], C.wood);
    fillPoly([P(base.x - 2, base.y - 64), P(base.x + 24, base.y - 64), P(base.x + 24, base.y - 60), P(base.x - 2, base.y - 60)], C.wood);
    ctx.fillStyle = C.ink;
    ctx.fillRect(base.x + 20, base.y - 60, 1, 10);
    // The hanged body sways a little.
    const sway = Math.sin(time * 0.8) * 1.5;
    const h = P(base.x + 20 + sway, base.y - 48);
    fillPoly(hex(h, 3), C.skin);
    fillPoly([P(h.x - 4, h.y + 3), P(h.x + 4, h.y + 3), P(h.x + 2, h.y + 16), P(h.x - 2, h.y + 16)], C.skin);
    fillPoly(quad(P(h.x - 1, h.y + 16), P(h.x - 1 - sway * 0.3, h.y + 28), 1, 0.6), C.skin);
    fillPoly(quad(P(h.x + 1, h.y + 16), P(h.x + 2 - sway * 0.3, h.y + 28), 1, 0.6), C.skin);
    ctx.fillStyle = C.blood;
    ctx.fillRect(Math.round(h.x), Math.round(h.y + 30 + ((time * 20) % 18)), 1, 2);
  }
  if (p.kind === 'pike') {
    fillPoly([P(base.x - 1, base.y), P(base.x + 1, base.y), P(base.x + 1, base.y - 40), P(base.x - 1, base.y - 40)], C.wood);
    fillPoly(hex(P(base.x, base.y - 44), 4), C.skin);
    fillPoly([P(base.x - 3, base.y - 40), P(base.x + 3, base.y - 40), P(base.x, base.y - 30)], C.blood, null);
  }
  if (p.kind === 'banner') {
    fillPoly([P(base.x - 1, base.y), P(base.x + 1, base.y), P(base.x + 1, base.y - 60), P(base.x - 1, base.y - 60)], C.wood);
    fillPoly([P(base.x + 1, base.y - 58), P(base.x + 20, base.y - 56), P(base.x + 19, base.y - 32), P(base.x + 14, base.y - 36), P(base.x + 10, base.y - 30), P(base.x + 6, base.y - 35), P(base.x + 1, base.y - 31)], C.skin);
    ctx.fillStyle = C.bone;
    ctx.beginPath();
    ctx.ellipse(base.x + 10, base.y - 46, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.blood;
    ctx.fillRect(base.x + 9, base.y - 47, 2, 2);
  }
  if (p.kind === 'altar') {
    const t = P(base.x, base.y - 10);
    fillPoly([P(base.x - 14, base.y), P(base.x, base.y + 7), P(base.x + 14, base.y), P(base.x + 14, base.y - 10), P(base.x, base.y - 3), P(base.x - 14, base.y - 10)], C.stoneA);
    fillPoly([P(t.x - 14, t.y), P(t.x, t.y - 7), P(t.x + 14, t.y), P(t.x, t.y + 7)], C.bone);
    fillPoly(blob(P(t.x - 3, t.y), 7, 3), C.blood, null);
    fillPoly(hex(P(t.x + 6, t.y - 1), 3, 0), C.gold);
  }
  if (p.kind === 'candle') {
    fillPoly([P(base.x - 1, base.y), P(base.x + 1, base.y), P(base.x + 1, base.y - 6), P(base.x - 1, base.y - 6)], C.bone, null);
  }
}

function drawPiece(p: Piece): void {
  const b = iso(p.x, p.z);
  const c = P(b.x, b.y - p.h * 16);
  const r = p.rot;
  if (p.kind === 'head') fillPoly(hex(c, 3, r), p.color);
  if (p.kind === 'limb') fillPoly(quad(P(c.x - Math.cos(r) * 4, c.y - Math.sin(r) * 2), P(c.x + Math.cos(r) * 4, c.y + Math.sin(r) * 2), 1.2, 0.7), p.color);
  if (p.kind === 'chunk') fillPoly(hex(c, 3.5, r).map((q, i) => (i % 2 ? P(q.x, q.y + 1) : q)), p.color);
  if (p.kind === 'shield') fillPoly([P(c.x - 7, c.y - 2), P(c.x + 7, c.y - 5), P(c.x + 8, c.y), P(c.x - 6, c.y + 3)], p.color);
}

// ---------- render ----------
let time = 0;

function render(): void {
  // The camera follows the bearer, snapped to whole pixels.
  const bp = P((bearer.x - bearer.z) * (TW / 2), (bearer.x + bearer.z) * (TH / 2));
  cam.x += (bp.x - W / 2 - cam.x) * 0.12;
  cam.y += (bp.y - H / 2 - cam.y) * 0.12;
  cam.x = Math.round(cam.x);
  cam.y = Math.round(cam.y);

  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, W, H);

  // Floor.
  for (let x = 0; x < MAP; x++) {
    for (let z = 0; z < MAP; z++) {
      const c = iso(x + 0.5, z + 0.5);
      if (c.x < -20 || c.x > W + 20 || c.y < -20 || c.y > H + 20) continue;
      fillPoly([iso(x, z), iso(x + 1, z), iso(x + 1, z + 1), iso(x, z + 1)], (x * 3 + z) % 2 ? C.stoneA : C.stoneB, C.stoneLine);
    }
  }

  // The blood sigil, painted on the floor.
  const sc = iso(SIGIL.x, SIGIL.y);
  ctx.strokeStyle = C.blood;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(sc.x, sc.y, 52, 26, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  [0, 2, 4, 1, 3].forEach((i, k) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const q = P(sc.x + Math.cos(a) * 46, sc.y + Math.sin(a) * 23);
    if (k) ctx.lineTo(q.x, q.y);
    else ctx.moveTo(q.x, q.y);
  });
  ctx.closePath();
  ctx.stroke();

  for (const d of decals) {
    const c = iso(d.x, d.z);
    fillPoly(blob(c, d.r * 16, d.r * 8, 8, d.seed), d.color, null);
  }
  for (const p of pieces) if (p.h === 0) drawPiece(p);

  // Everything that stands, sorted back to front.
  const list: { depth: number; draw: () => void }[] = [];
  for (const p of props) list.push({ depth: p.x + p.z, draw: () => drawProp(p, iso(p.x, p.z)) });
  for (const u of units) if (!u.dead) list.push({ depth: u.x + u.z, draw: () => drawUnit(ctx, u, iso, C, time, u.flash > 0) });
  for (const p of pieces) if (p.h > 0) list.push({ depth: p.x + p.z, draw: () => drawPiece(p) });
  list.sort((a, b) => a.depth - b.depth).forEach((t) => t.draw());

  for (const a of arrows) {
    const b = iso(a.x, a.z);
    const t = iso(a.target.x, a.target.z);
    const d = Math.hypot(t.x - b.x, t.y - b.y) || 1;
    ctx.strokeStyle = C.bone;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - a.h * 16);
    ctx.lineTo(b.x + ((t.x - b.x) / d) * 5, b.y - a.h * 16 + ((t.y - b.y) / d) * 5);
    ctx.stroke();
  }
  for (const p of particles) {
    const b = iso(p.x, p.z);
    ctx.fillStyle = C.blood;
    ctx.fillRect(Math.round(b.x), Math.round(b.y - p.h * 16), 1, 1);
  }

  // Darkness, with hard rings of light around the lantern and candles.
  mask.globalCompositeOperation = 'source-over';
  mask.clearRect(0, 0, W, H);
  mask.fillStyle = 'rgba(0,0,0,0.66)';
  mask.fillRect(0, 0, W, H);
  mask.globalCompositeOperation = 'destination-out';
  const ring = (c: Pt, r: number, a: number): void => {
    mask.fillStyle = `rgba(0,0,0,${a})`;
    mask.beginPath();
    mask.ellipse(c.x, c.y, r, r * 0.6, 0, 0, Math.PI * 2);
    mask.fill();
  };
  const flicker = Math.sin(time * 9) * 1.5;
  if (!bearer.dead) {
    const lp = iso(bearer.x, bearer.z);
    ring(lp, 92 + flicker, 0.3);
    ring(lp, 64 + flicker, 0.35);
    ring(lp, 38 + flicker, 0.5);
  }
  for (const p of props) if (p.kind === 'candle') ring(iso(p.x, p.z), 14, 0.4);
  // Each merc carries a faint light, so the party never vanishes.
  for (const u of units) if (!u.dead && u.side === 'party' && u !== bearer) ring(iso(u.x, u.z), 14, 0.35);
  ctx.drawImage(maskCanvas, 0, 0);

  for (const u of units) {
    if (u.dead) continue;
    for (const e of emissives(u, iso, time)) {
      ctx.fillStyle = e.color === 'teal' ? C.teal : e.color === 'blood' ? C.blood : C.flame;
      const size = e.color === 'flame' ? 2 : 1;
      ctx.fillRect(Math.round(e.p.x) - (size >> 1), Math.round(e.p.y) - (size >> 1), size, size);
    }
  }
  for (const p of props) {
    if (p.kind !== 'candle') continue;
    const b = iso(p.x, p.z);
    ctx.fillStyle = C.flame;
    ctx.fillRect(b.x, b.y - 8, 1, 2);
  }

  // Health bars: gold for the party, red for monsters.
  for (const u of units) {
    if (u.dead || (u.hp >= u.maxHp && u.side === 'party')) continue;
    if (u.side === 'monster' && !u.awake) continue;
    const b = iso(u.x, u.z);
    const y = b.y - (u.kind === 'bearer' ? 36 : u.kind === 'crawler' ? 16 : 44);
    ctx.fillStyle = C.ink;
    ctx.fillRect(b.x - 7, y, 14, 2);
    ctx.fillStyle = u.side === 'party' ? C.gold : C.blood;
    ctx.fillRect(b.x - 7, y, Math.max(0, Math.round((14 * u.hp) / u.maxHp)), 2);
  }

  quantize();

  out.drawImage(small, 0, 0, W * SCALE, H * SCALE);
  out.font = '16px ui-monospace, monospace';
  out.fillStyle = '#9a9a9a';
  out.fillText('WASD or click to move the bearer.  R to restart.', 16, 26);
  out.fillText(`Slain: ${killed}`, W * SCALE - 120, 26);
  if (gameOver) {
    out.fillStyle = 'rgba(0,0,0,0.6)';
    out.fillRect(0, 0, W * SCALE, H * SCALE);
    out.fillStyle = C.blood;
    out.font = '36px ui-serif, Georgia, serif';
    out.textAlign = 'center';
    out.fillText('The bearer has fallen.', (W * SCALE) / 2, (H * SCALE) / 2);
    out.font = '16px ui-monospace, monospace';
    out.fillStyle = '#9a9a9a';
    out.fillText('Press R to draw another lot.', (W * SCALE) / 2, (H * SCALE) / 2 + 36);
    out.textAlign = 'start';
  }
}

// Snaps every pixel to the palette, with a light ordered dither.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const cache = new Map<number, number>();
function nearest(r: number, g: number, b: number): number {
  const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PALETTE.length; i++) {
    const c = PALETTE[i];
    const d = (c[0] - r) ** 2 * 0.3 + (c[1] - g) ** 2 * 0.59 + (c[2] - b) ** 2 * 0.11;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  cache.set(key, best);
  return best;
}
function quantize(): void {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const t = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 6;
      const c = PALETTE[nearest(Math.max(0, d[i] + t), Math.max(0, d[i + 1] + t), Math.max(0, d[i + 2] + t))];
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- loop ----------
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  frames++;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
reset();
requestAnimationFrame(frame);
(window as unknown as { ready: boolean }).ready = true;
(window as unknown as { units: () => Unit[] }).units = () => units;
let frames = 0;
(window as unknown as { frames: () => number }).frames = () => frames;
