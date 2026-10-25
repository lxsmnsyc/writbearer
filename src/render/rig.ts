// Cut-paper figures on a 3D skeleton.
// Each figure is a set of joints in its own space, turned to face any angle
// and projected into the isometric view. Paper pieces are drawn between the
// projected joints and sorted back to front, so a body narrows when seen from
// the side and limbs pass in front of or behind it as it turns.

export type Kind =
  | 'bearer'
  | 'vanguard'
  | 'ranger'
  | 'cleric'
  | 'hollowSoldier'
  | 'penitent'
  | 'cantor'
  | 'hollowed'
  | 'husk'
  | 'mite'
  | 'crawler'
  | 'broodMother'
  | 'refugee';

// Where in each drawn attack (0 to 1) the blow lands or the arrow leaves.
// The view lines the simulation's hit frame up with it.
const KINDS = new Set<string>([
  'bearer',
  'vanguard',
  'ranger',
  'cleric',
  'hollowSoldier',
  'penitent',
  'cantor',
  'hollowed',
  'husk',
  'mite',
  'crawler',
  'broodMother',
  'refugee',
]);

export function isKind(kind: string): kind is Kind {
  return KINDS.has(kind);
}

/** Kinds drawn as a Blight crawler, at their own size. */
export const isCrawler = (kind: string): boolean =>
  kind === 'crawler' || kind === 'mite' || kind === 'broodMother';

export const HIT_FRACTION: Record<Kind, number> = {
  bearer: 1,
  vanguard: 0.6,
  ranger: 0.7,
  cleric: 0.7,
  hollowSoldier: 0.65,
  penitent: 0.6,
  cantor: 0.8,
  hollowed: 0.5,
  husk: 0.6,
  mite: 0.5,
  crawler: 0.5,
  broodMother: 0.5,
  refugee: 1,
};

export interface Pt {
  x: number;
  y: number;
}

// What the rig needs to know about a unit.
export interface RigUnit {
  kind: Kind;
  x: number;
  z: number;
  // Facing, in radians, on the floor plane. 0 points along +x.
  angle: number;
  // Walk cycle phase. It advances with distance walked.
  walk: number;
  // 0 when standing, 1 at full walking speed.
  stride: number;
  // Attack progress from 0 to 1, or -1 when not attacking.
  atk: number;
  // Shout progress from 0 to 1, landing at 0.5, or -1. The Vanguard's Challenge.
  shout: number;
  // How far through falling dead, 0 to 1, or -1 while alive.
  fall: number;
  // Elites are drawn a quarter larger.
  elite?: boolean;
  // A mini-boss, drawn larger than an elite
  named?: boolean;
  // Drawn at this size instead of its kind's, as a boss is
  size?: number;
  // What a merc wears that shows: its weapon and whether it has a shield.
  // Absent for monsters, whose gear never changes.
  held?: { weapon: 'sword' | 'mace' | 'bow' | 'dagger' | 'staff' | null; shield: boolean };
  // Time since the last hit taken, for the flinch.
  hurt: number;
  // True while the unit has an enemy to face. Rangers raise the bow.
  alert: boolean;
}

export interface Palette {
  ink: string;
  merc: string;
  bearer: string;
  monster: string;
  penitent: string;
  wood: string;
  skin: string;
  bone: string;
  cloth: string;
  blood: string;
  gold: string;
  flame: string;
  teal: string;
}

// Local space: f forward, s to the right, h up. A figure is about 100 units tall.
export type V3 = [number, number, number];
export const v = (f: number, s: number, h: number): V3 => [f, s, h];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => scale(a, 1 / (len(a) || 1));
export const lerp = (a: V3, b: V3, t: number): V3 => add(a, scale(sub(b, a), t));
export const ease = (t: number): number => t * t * (3 - 2 * t);
export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

// Tiles per figure unit on the floor, and screen pixels per unit of height.
const FLOOR_K = 0.011;
const HEIGHT_K = 0.3;

/**
 * How figures are drawn. `zoom` scales every pixel size with the camera.
 */
export const look = { zoom: 1 };

// Small fixed offsets per corner, so cut edges look hand cut.
const CUT = [0.3, -0.4, 0.5, -0.2, 0.1, -0.5, 0.4, -0.3, 0.2, -0.1];

// How big each figure is drawn. The bearer is small; a mite is a crawler not
// yet grown.
const KIND_SIZE: Record<Kind, number> = {
  bearer: 0.82,
  vanguard: 1,
  ranger: 1,
  cleric: 1,
  hollowSoldier: 1,
  penitent: 1,
  cantor: 1,
  hollowed: 1,
  husk: 0.95,
  mite: 0.55,
  crawler: 1,
  broodMother: 2.1,
  refugee: 0.78,
};

// How big a figure is drawn: its own size if it has one, else its kind's.
const sizeOf = (u: RigUnit): number => {
  if (u.size !== undefined) {
    return u.size;
  }
  let grown = u.elite ? 1.25 : 1;
  if (u.named) {
    grown = 1.45;
  }
  return KIND_SIZE[u.kind] * grown;
};

// ---------- projection ----------
export type Iso = (x: number, z: number) => Pt;

export interface Projected extends Pt {
  depth: number;
}

// Half a tile across and down on the screen, before zoom
const HALF_W = 16;
const HALF_H = 8;

/**
 * Projects a figure's points. Only its feet are snapped to the pixel grid;
 * each point is a whole-pixel offset from them. So as the figure walks, it
 * moves as one block and keeps its shape, instead of each joint snapping on
 * its own and the figure shimmering.
 */
export function projector(u: RigUnit, iso: Iso): (p: V3) => Projected {
  const size = sizeOf(u);
  const c = Math.cos(u.angle);
  const s = Math.sin(u.angle);
  const fallen = topple(u);
  const base = iso(u.x, u.z);
  const z = look.zoom;
  return (raw) => {
    const p = fallen(raw);
    const f = p[0] * size;
    const r = p[1] * size;
    const dx = (f * c - r * s) * FLOOR_K;
    const dz = (f * s + r * c) * FLOOR_K;
    return {
      x: base.x + Math.round((dx - dz) * HALF_W * z),
      y: base.y + Math.round((dx + dz) * HALF_H * z - p[2] * size * HEIGHT_K * z),
      depth: u.x + dx + u.z + dz,
    };
  };
}

// Turns a dying figure's points as it falls. A body tips back over its heels
// and lands flat. A crawler's legs fold under it and it sinks.
function topple(u: RigUnit): (p: V3) => V3 {
  if (u.fall < 0) {
    return (p) => p;
  }
  const t = ease(clamp01(u.fall));
  if (isCrawler(u.kind)) {
    return (p) => v(p[0], p[1] * (1 - t * 0.3), p[2] * (1 - t * 0.7));
  }
  // The knees give first, then the body goes over.
  const sink = Math.min(1, t * 2) * 10;
  const a = ease(clamp01((u.fall - 0.15) / 0.85)) * Math.PI * 0.48;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  // Whatever was held out in front would swing up as the body tips back.
  // A ceiling that lowers with the fall lays it down with the body.
  const ceiling = 100 * (1 - t) + 6;
  return (p) => {
    const h = Math.max(0, p[2] - sink * (p[2] / 100));
    return v(p[0] * ca - h * sa, p[1], Math.min(ceiling, Math.max(1, p[0] * sa + h * ca)));
  };
}

// ---------- skeleton ----------
export interface Skeleton {
  pelvis: V3;
  hipL: V3;
  hipR: V3;
  kneeL: V3;
  kneeR: V3;
  footL: V3;
  footR: V3;
  chest: V3;
  shoulderL: V3;
  shoulderR: V3;
  neck: V3;
  head: V3;
  elbowL: V3;
  elbowR: V3;
  handL: V3;
  handR: V3;
}

// Two-bone IK. Places the middle joint so both bones keep their length,
// bending toward `bend`.
function ik(root: V3, end: V3, a: number, b: number, bend: V3): { mid: V3; end: V3 } {
  let d = sub(end, root);
  let dl = len(d);
  if (dl > a + b - 0.01) {
    d = scale(norm(d), a + b - 0.01);
    dl = a + b - 0.01;
    end = add(root, d);
  }
  const x = (a * a - b * b + dl * dl) / (2 * dl);
  const y = Math.sqrt(Math.max(0, a * a - x * x));
  const dir = norm(d);
  // Remove the part of `bend` along the bone, so it points sideways from it.
  const along = bend[0] * dir[0] + bend[1] * dir[1] + bend[2] * dir[2];
  const perp = norm(sub(bend, scale(dir, along)));
  return { mid: add(add(root, scale(dir, x)), scale(perp, y)), end };
}

const THIGH = 24;
const SHIN = 24;
const UPPER = 17;
const FORE = 17;

export function skeleton(u: RigUnit, time: number): Skeleton {
  const st = u.stride;
  const p = u.walk;
  const bob = st * Math.cos(p * 2) * 1.5;
  const breathe = (1 - st) * Math.sin(time * 2.2 + u.x) * 0.8;
  const flinch = u.hurt < 0.18 ? (1 - u.hurt / 0.18) * 6 : 0;
  // Melee strikes throw the body forward at the moment of the blow.
  const strike =
    u.atk >= 0 && u.kind !== 'ranger'
      ? Math.max(0, Math.sin(clamp01((u.atk - 0.35) / 0.65) * Math.PI))
      : 0;
  // A shout leans back to draw breath, then forward into the roar.
  const roar = u.shout >= 0 ? -Math.sin(u.shout * Math.PI * 2) * 5 : 0;
  const lean =
    st * 4 -
    flinch +
    roar +
    (u.kind === 'hollowSoldier' ? 4 : 0) +
    (u.kind === 'hollowed' ? 30 : 0) +
    (u.kind === 'husk' ? 12 : 0) +
    strike * (u.kind === 'hollowSoldier' ? 14 : 8);

  const pelvis = v(0, 0, 46 + bob);
  const chest = v(lean * 0.6, 0, 72 + bob + breathe);
  const neck = v(lean, 0, 81 + bob + breathe);
  const head = v(lean + 1, 0, 91 + bob + breathe);

  // Feet: each foot slides back while planted and lifts as it swings forward.
  const stride = 15 * st;
  const foot = (phase: number, side: number): V3 => {
    const f = stride * Math.cos(phase);
    const lift = Math.max(0, -Math.sin(phase)) * 7 * st;
    return v(f + 1, side * 6, lift);
  };
  const hipL = v(0, -6, pelvis[2]);
  const hipR = v(0, 6, pelvis[2]);
  const legL = ik(hipL, foot(p, -1), THIGH, SHIN, v(1, 0, 0));
  const legR = ik(hipR, foot(p + Math.PI, 1), THIGH, SHIN, v(1, 0, 0));

  const shoulderL = add(chest, v(0, -11, 6));
  const shoulderR = add(chest, v(0, 11, 6));
  // Arms swing against the legs while walking.
  const swingL = -Math.cos(p) * 10 * st;
  const armL = ik(shoulderL, add(shoulderL, v(4 + swingL, -3, -30)), UPPER, FORE, v(-1, 0, 0));
  const armR = ik(shoulderR, add(shoulderR, v(4 - swingL, 3, -30)), UPPER, FORE, v(-1, 0, 0));

  return {
    pelvis,
    hipL,
    hipR,
    chest,
    shoulderL,
    shoulderR,
    neck,
    head,
    kneeL: legL.mid,
    footL: legL.end,
    kneeR: legR.mid,
    footR: legR.end,
    elbowL: armL.mid,
    handL: armL.end,
    elbowR: armR.mid,
    handR: armR.end,
  };
}

// Moves one arm so its hand reaches `target`.
export function reach(sk: Skeleton, side: 'L' | 'R', target: V3, bend: V3 = v(-1, 0, -0.5)): void {
  const sh = side === 'L' ? sk.shoulderL : sk.shoulderR;
  const r = ik(sh, target, UPPER, FORE, bend);
  if (side === 'L') {
    sk.elbowL = r.mid;
    sk.handL = r.end;
  } else {
    sk.elbowR = r.mid;
    sk.handR = r.end;
  }
}

// A hand's path through an attack: from rest up to the windup pose, down to
// the strike pose, then back to rest.
export function handPath(
  ph: { windup: number; strike: number; recover: number },
  rest: V3,
  up: V3,
  down: V3,
): V3 {
  if (ph.recover > 0) {
    return lerp(down, rest, ph.recover);
  }
  if (ph.strike > 0) {
    return lerp(up, down, ph.strike);
  }
  return lerp(rest, up, ph.windup);
}

// The paper color of each figure. Mercs are pale, monsters are dark.
export function paperColor(kind: Kind, C: Palette): string {
  if (kind === 'bearer') {
    return C.bearer;
  }
  if (kind === 'vanguard' || kind === 'ranger' || kind === 'cleric') {
    return C.merc;
  }
  if (kind === 'penitent' || kind === 'cantor' || kind === 'hollowed') {
    return C.penitent;
  }
  if (kind === 'refugee') {
    return C.cloth;
  }
  return C.monster;
}

// Keyframes for an attack: windup until `w`, strike until `s`, then recover.
export function phases(
  t: number,
  w: number,
  s: number,
): { windup: number; strike: number; recover: number } {
  return {
    windup: ease(clamp01(t / w)),
    strike: ease(clamp01((t - w) / (s - w))),
    recover: ease(clamp01((t - s) / (1 - s))),
  };
}

// ---------- drawing ----------
export interface Part {
  depth: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

// Corners snap to whole pixels, so a moving figure's edges step cleanly
// instead of shimmering through half-covered pixels every frame.
function trace(ctx: CanvasRenderingContext2D, pts: Pt[], dx: number, dy: number): void {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const cut = CUT[i % CUT.length] * look.zoom;
    const x = Math.round(p.x + dx + cut);
    const y = Math.round(p.y + dy - cut);
    if (i) {
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
    }
  });
  ctx.closePath();
}

export function fill(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  color: string,
  ink: string | null,
): void {
  // A hard shadow under each piece, as layered paper casts.
  trace(ctx, pts, look.zoom, look.zoom);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  trace(ctx, pts, 0, 0);
  ctx.fillStyle = color;
  ctx.fill();
  if (ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = look.zoom;
    ctx.stroke();
  }
}

export function taper(a: Pt, b: Pt, wideA: number, wideB: number): Pt[] {
  const k = look.zoom * 1.5;
  const wa = wideA * k;
  const wb = wideB * k;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  return [
    { x: a.x + nx * wa, y: a.y + ny * wa },
    { x: b.x + nx * wb, y: b.y + ny * wb },
    { x: b.x - nx * wb, y: b.y - ny * wb },
    { x: a.x - nx * wa, y: a.y - ny * wa },
  ];
}

export function hexAt(c: Pt, radius: number): Pt[] {
  const r = radius * look.zoom * 1.15;
  return [0, 1, 2, 3, 4, 5].map((i) => ({
    x: c.x + r * Math.cos((i * Math.PI) / 3 + 0.5),
    y: c.y + r * Math.sin((i * Math.PI) / 3 + 0.5),
  }));
}

// Convex hull, for paper shapes built from several projected points.
export function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) {
      lower.pop();
    }
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) {
      upper.pop();
    }
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export const avg = (...ps: Projected[]): number => ps.reduce((s, p) => s + p.depth, 0) / ps.length;

// What a unit's hands and gear are doing this frame.
interface Gear {
  spear?: { back: V3; tip: V3 };
  knife?: { hand: V3; dir: V3 };
  staff?: { hand: V3 };
  claws?: { hand: V3; dir: V3 }[];
}

function animate(u: RigUnit, sk: Skeleton, time: number): Gear {
  const g: Gear = {};
  const a = u.atk;
  if (u.kind === 'hollowSoldier') {
    // Both hands on the spear. Windup pulls it back, the strike lunges.
    let push = 0;
    if (a >= 0) {
      const ph = phases(a, 0.55, 0.7);
      if (ph.recover > 0) {
        push = 1 - ph.recover;
      } else if (ph.strike > 0) {
        push = ph.strike;
      } else {
        push = -ph.windup * 0.6;
      }
    }
    const front = add(sk.chest, v(18 + push * 30, 6, -10));
    const back = add(sk.chest, v(-2 + push * 30, 8, -14));
    reach(sk, 'R', front, v(-1, 1, -0.5));
    reach(sk, 'L', back, v(-1, -1, -0.5));
    const dir = norm(sub(sk.handR, sk.handL));
    g.spear = { back: sub(sk.handL, scale(dir, 30)), tip: add(sk.handR, scale(dir, 48)) };
  }
  if (u.kind === 'penitent') {
    let hand = add(sk.chest, v(14, 8, -8));
    if (a >= 0) {
      const ph = phases(a, 0.5, 0.65);
      const up = add(sk.head, v(4, 8, 14));
      const down = add(sk.chest, v(26, 4, -12));
      hand = handPath(ph, hand, up, down);
    }
    reach(sk, 'R', hand, v(-1, 1, 0));
    const dir = a >= 0 && a < 0.5 ? v(0, 0, 1) : norm(sub(sk.handR, sk.elbowR));
    g.knife = { hand: sk.handR, dir };
  }
  if (u.kind === 'cantor') {
    // The staff of the eye, held upright. The hymn lifts it high, then plants it.
    let hand = add(sk.chest, v(10, 10, -4));
    if (a >= 0) {
      const ph = phases(a, HIT_FRACTION.cantor, HIT_FRACTION.cantor + 0.08);
      const up = add(sk.head, v(6, 8, 18));
      hand = handPath(ph, hand, up, hand);
      reach(sk, 'L', add(sk.head, v(8, -6, 6)), v(-1, -1, 0));
    }
    reach(sk, 'R', hand, v(-1, 1, 0));
    g.staff = { hand: sk.handR };
  }
  if (u.kind === 'husk') {
    // Arms hang forward, reaching, as the drowned dead shamble. The blow
    // is both arms brought down at once.
    for (const side of ['L', 'R'] as const) {
      const k = side === 'L' ? -1 : 1;
      let hand = add(sk.chest, v(32, k * 6, 2 + Math.sin(time * 1.3 + k) * 2));
      if (a >= 0) {
        const ph = phases(a, 0.5, 0.65);
        hand = handPath(ph, hand, add(sk.head, v(8, k * 8, 6)), add(sk.chest, v(26, k * 5, -26)));
      }
      reach(sk, side, hand, v(-1, k, 0));
    }
  }
  if (u.kind === 'hollowed') {
    // Long arms hang forward, claws out. The rake comes down from above.
    for (const side of ['L', 'R'] as const) {
      const k = side === 'L' ? -1 : 1;
      let hand = add(sk.chest, v(26, k * 9, -34));
      if (a >= 0) {
        const ph = phases(a, side === 'L' ? 0.4 : 0.45, side === 'L' ? 0.5 : 0.55);
        hand = handPath(ph, hand, add(sk.head, v(4, k * 10, 10)), add(sk.chest, v(30, k * 4, -24)));
      }
      reach(sk, side, hand, v(-1, k, 0));
    }
    g.claws = [
      { hand: sk.handL, dir: norm(sub(sk.handL, sk.elbowL)) },
      { hand: sk.handR, dir: norm(sub(sk.handR, sk.elbowR)) },
    ];
  }
  return g;
}

/** The shadow under a figure's feet. */
export function drawShadow(ctx: CanvasRenderingContext2D, u: RigUnit, iso: Iso): void {
  const base = iso(u.x, u.z);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(
    base.x,
    base.y,
    (isCrawler(u.kind) && u.kind !== 'mite' ? 10 : 7) * sizeOf(u) * look.zoom,
    (isCrawler(u.kind) && u.kind !== 'mite' ? 4 : 2.5) * sizeOf(u) * look.zoom,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

export function drawUnit(
  ctx: CanvasRenderingContext2D,
  u: RigUnit,
  iso: Iso,
  C: Palette,
  time: number,
  flash: boolean,
): void {
  const proj = projector(u, iso);
  drawShadow(ctx, u, iso);

  if (isCrawler(u.kind)) {
    drawCrawler(ctx, u, proj, C, flash);
    return;
  }

  const sk = skeleton(u, time);
  const gear = animate(u, sk, time);
  const color = flash ? '#ffffff' : paperColor(u.kind, C);
  const ink = C.ink;
  const parts: Part[] = [];
  const limb = (a: V3, b: V3, wa = 1.4, wb = 0.8, col = color): void => {
    const A = proj(a);
    const B = proj(b);
    parts.push({
      depth: avg(A, B),
      draw: (c) => {
        fill(c, taper(A, B, wa, wb), col, ink);
      },
    });
  };

  limb(sk.hipL, sk.kneeL);
  limb(sk.kneeL, sk.footL);
  limb(sk.hipR, sk.kneeR);
  limb(sk.kneeR, sk.footR);
  limb(sk.shoulderL, sk.elbowL, 1.2, 0.8);
  limb(sk.elbowL, sk.handL, 1.0, 0.6);
  limb(sk.shoulderR, sk.elbowR, 1.2, 0.8);
  limb(sk.elbowR, sk.handR, 1.0, 0.6);

  // Torso: a paper piece between the shoulders and the hips.
  const torso = [
    sk.shoulderL,
    sk.shoulderR,
    add(sk.hipR, v(0, -1, 0)),
    add(sk.hipL, v(0, 1, 0)),
  ].map(proj);
  if (u.kind === 'hollowed') {
    // A robe torn off at the knee, over bare legs.
    const hem = [v(12, 0, 22), v(-10, 0, 26), v(0, 15, 20), v(0, -15, 24), v(8, 11, 16)].map(proj);
    const rags = hull([...torso, ...hem]);
    parts.push({
      depth: avg(...torso) - 0.001,
      draw: (c) => {
        fill(c, rags, color, ink);
      },
    });
  } else if (u.kind === 'penitent' || u.kind === 'cantor') {
    // A robe to the ground instead of legs.
    const hem = [
      v(14, 0, 0),
      v(-12, 0, 0),
      v(0, 18, 0),
      v(0, -18, 0),
      v(9, 13, 0),
      v(9, -13, 0),
      v(-8, 13, 0),
      v(-8, -13, 0),
    ].map(proj);
    const robe = hull([...torso, ...hem]);
    parts.push({
      depth: avg(...torso) - 0.001,
      draw: (c) => {
        fill(c, robe, color, ink);
      },
    });
    const sash = [
      add(sk.pelvis, v(0, -12, 8)),
      add(sk.pelvis, v(0, 12, 8)),
      add(sk.pelvis, v(0, 12, 2)),
      add(sk.pelvis, v(0, -12, 2)),
    ].map(proj);
    parts.push({
      depth: avg(...torso) + 0.0005,
      draw: (c) => {
        fill(c, hull(sash), C.blood, null);
      },
    });
    // The legs are under the robe.
    parts.splice(0, 4);
  } else {
    parts.push({
      depth: avg(...torso),
      draw: (c) => {
        fill(c, hull(torso), color, ink);
      },
    });
  }

  const H = proj(sk.head);
  const headR = 3.2 * (u.kind === 'bearer' ? 0.82 : 1);
  parts.push({
    depth: H.depth + 0.0004,
    draw: (c) => {
      fill(c, hexAt(H, headR), color, ink);
    },
  });

  // Hoods, crowns and the Writ.
  if (u.kind === 'penitent' || u.kind === 'cantor' || u.kind === 'hollowed') {
    const hood = [
      add(sk.head, v(-6, -5, -2)),
      add(sk.head, v(-6, 5, -2)),
      add(sk.head, v(-9, 0, 14)),
      add(sk.head, v(2, 0, 11)),
    ].map(proj);
    parts.push({
      depth: H.depth + 0.0005,
      draw: (c) => {
        fill(c, hull(hood), color, ink);
      },
    });
  }
  if (u.kind === 'hollowSoldier') {
    const ring = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
    const band = ring.map((t) => proj(add(sk.head, v(Math.cos(t) * 7, Math.sin(t) * 7, 5))));
    const spikes = ring
      .filter((_, i) => i % 2 === 0)
      .map((t) => proj(add(sk.head, v(Math.cos(t) * 7, Math.sin(t) * 7, 13))));
    parts.push({
      depth: H.depth + 0.0006,
      draw: (c) => {
        fill(c, hull([...band, ...spikes]), C.gold, ink);
      },
    });
  }

  // Gear.
  if (gear.spear) {
    const a = proj(gear.spear.back);
    const b = proj(gear.spear.tip);
    const dir = norm(sub(gear.spear.tip, gear.spear.back));
    const head = [
      proj(add(gear.spear.tip, scale(dir, 12))),
      proj(add(gear.spear.tip, v(0, 0, 3))),
      proj(add(gear.spear.tip, v(0, 0, -3))),
    ];
    parts.push({
      depth: avg(a, b) + 0.0006,
      draw: (c) => {
        fill(c, taper(a, b, 0.6, 0.6), C.wood, null);
        fill(c, head, C.bone, ink);
      },
    });
  }
  if (gear.knife) {
    const a = proj(gear.knife.hand);
    const b = proj(add(gear.knife.hand, scale(gear.knife.dir, 14)));
    parts.push({
      depth: avg(a, b) + 0.0006,
      draw: (c) => {
        fill(c, taper(a, b, 1, 0.2), C.bone, ink);
      },
    });
  }
  if (gear.staff) {
    const h = gear.staff.hand;
    const a = proj(add(h, v(0, 0, -40)));
    const b = proj(add(h, v(0, 0, 44)));
    // The Church's eye on top: a pale disc with a red pupil.
    const eye = proj(add(h, v(0, 0, 50)));
    parts.push({
      depth: avg(a, b) + 0.0006,
      draw: (c) => {
        fill(c, taper(a, b, 0.7, 0.7), C.wood, null);
        fill(c, hexAt(eye, 3.4), C.bone, ink);
        c.fillStyle = C.blood;
        c.fillRect(Math.round(eye.x) - 1, Math.round(eye.y) - 1, 2, 2);
      },
    });
  }
  for (const claw of gear.claws ?? []) {
    // Three long fingers, fanned.
    const a = proj(claw.hand);
    const tips = [-1, 0, 1].map((k) =>
      proj(add(claw.hand, add(scale(claw.dir, 16), v(0, k * 5, k === 0 ? 0 : -3)))),
    );
    parts.push({
      depth: a.depth + 0.0005,
      draw: (c) => {
        for (const b of tips) {
          fill(c, taper(a, b, 0.6, 0.1), C.bone, null);
        }
      },
    });
  }
  parts
    .sort((a, b) => a.depth - b.depth)
    .forEach((p) => {
      p.draw(ctx);
    });
}

// The crawler walks on six legs in two alternating sets of three.
function drawCrawler(
  ctx: CanvasRenderingContext2D,
  u: RigUnit,
  proj: (p: V3) => Projected,
  C: Palette,
  flash: boolean,
): void {
  const color = flash ? '#ffffff' : C.monster;
  const lunge = u.atk >= 0 ? Math.sin(clamp01(u.atk) * Math.PI) * 12 : 0;
  const bob = Math.sin(u.walk * 2) * 1.2 * u.stride;
  const parts: Part[] = [];
  const body = [
    v(-24, -10, 12),
    v(-24, 10, 12),
    v(16 + lunge, -12, 14),
    v(16 + lunge, 12, 14),
    v(-10, 0, 32 + bob),
    v(8 + lunge, 0, 30 + bob),
    v(-20, 0, 6),
    v(14 + lunge, 0, 8),
  ].map(proj);
  const headPts = [
    v(22 + lunge, -7, 14),
    v(22 + lunge, 7, 14),
    v(34 + lunge * 1.4, 0, 8),
    v(28 + lunge, 0, 20),
  ].map(proj);
  const legs: [V3, V3, V3][] = [];
  for (const [i, f] of [-16, -2, 12].entries()) {
    for (const side of [-1, 1]) {
      const set = (i + (side > 0 ? 1 : 0)) % 2;
      const phase = u.walk * 1.5 + set * Math.PI;
      const swing = Math.cos(phase) * 8 * u.stride;
      const lift = Math.max(0, -Math.sin(phase)) * 6 * u.stride;
      const root = v(f, side * 9, 14);
      const foot = v(f + swing, side * 22, lift);
      const knee = v(f + swing * 0.5, side * 20, 22 + lift);
      legs.push([root, knee, foot]);
    }
  }
  for (const [r, k, f] of legs) {
    const R = proj(r);
    const K = proj(k);
    const F = proj(f);
    parts.push({
      depth: avg(R, K, F) - 0.0002,
      draw: (c) => {
        fill(c, taper(R, K, 1.2, 0.8), color, C.ink);
        fill(c, taper(K, F, 0.8, 0.4), color, C.ink);
      },
    });
  }
  parts.push({
    depth: avg(...body),
    draw: (c) => {
      fill(c, hull(body), color, C.ink);
    },
  });
  parts.push({
    depth: avg(...headPts) + 0.0003,
    draw: (c) => {
      fill(c, hull(headPts), color, C.ink);
    },
  });
  if (u.kind === 'broodMother') {
    // Her egg sac: pale, swollen, dragged behind her, swelling as she breathes.
    const swell = 1 + Math.sin(u.walk * 0.7 + u.x) * 0.04;
    const sac = [
      v(-20, -13 * swell, 10),
      v(-20, 13 * swell, 10),
      v(-44 * swell, -15 * swell, 12),
      v(-44 * swell, 15 * swell, 12),
      v(-52 * swell, 0, 16),
      v(-34, 0, 30 * swell),
      v(-30, 0, 2),
    ].map(proj);
    parts.push({
      depth: avg(...sac) - 0.0001,
      draw: (c) => {
        fill(c, hull(sac), flash ? '#ffffff' : C.skin, C.ink);
      },
    });
  }
  parts
    .sort((a, b) => a.depth - b.depth)
    .forEach((p) => {
      p.draw(ctx);
    });
}

// Glowing points drawn after the darkness: eyes, growths, the lantern flame.
export function emissives(
  u: RigUnit,
  iso: Iso,
  time: number,
): { p: Pt; color: 'teal' | 'blood' | 'flame' }[] {
  const proj = projector(u, iso);
  const out: { p: Pt; color: 'teal' | 'blood' | 'flame' }[] = [];
  // Eyes only show when the face turns toward the camera.
  const toCamera = Math.cos(u.angle) + Math.sin(u.angle) > -0.4;
  if (isCrawler(u.kind)) {
    const lunge = u.atk >= 0 ? Math.sin(clamp01(u.atk) * Math.PI) * 12 : 0;
    for (const f of [-10, 0, 10]) {
      out.push({ p: proj(v(f, 0, 36)), color: 'teal' });
    }
    if (toCamera) {
      out.push(
        { p: proj(v(30 + lunge, -3, 15)), color: 'teal' },
        { p: proj(v(30 + lunge, 3, 15)), color: 'teal' },
      );
    }
    return out;
  }
  const eyed = ['hollowSoldier', 'penitent', 'cantor', 'hollowed', 'husk'];
  if (eyed.includes(u.kind) && toCamera) {
    const sk = skeleton(u, time);
    // The Old King's dead and the mad see by the Hollow's light. The Church's eyes are red.
    const color =
      u.kind === 'hollowSoldier' || u.kind === 'hollowed' || u.kind === 'husk' ? 'teal' : 'blood';
    out.push({ p: proj(add(sk.head, v(3, -1.5, 1))), color });
    out.push({ p: proj(add(sk.head, v(3, 1.5, 1))), color });
  }
  return out;
}
