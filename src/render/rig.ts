// Cut-paper figures on a 3D skeleton.
// Each figure is a set of joints in its own space, turned to face any angle
// and projected into the isometric view. Paper pieces are drawn between the
// projected joints and sorted back to front, so a body narrows when seen from
// the side and limbs pass in front of or behind it as it turns.

export type Kind = 'bearer' | 'vanguard' | 'ranger' | 'hollowSoldier' | 'penitent' | 'crawler';

// Where in each drawn attack (0 to 1) the blow lands or the arrow leaves.
// The view lines the simulation's hit frame up with it.
const KINDS = new Set<string>([
  'bearer',
  'vanguard',
  'ranger',
  'hollowSoldier',
  'penitent',
  'crawler',
]);

export function isKind(kind: string): kind is Kind {
  return KINDS.has(kind);
}

export const HIT_FRACTION: Record<Kind, number> = {
  bearer: 1,
  vanguard: 0.6,
  ranger: 0.7,
  hollowSoldier: 0.65,
  penitent: 0.6,
  crawler: 0.5,
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
  blood: string;
  gold: string;
  flame: string;
  teal: string;
}

// Local space: f forward, s to the right, h up. A figure is about 100 units tall.
type V3 = [number, number, number];
const v = (f: number, s: number, h: number): V3 => [f, s, h];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => scale(a, 1 / (len(a) || 1));
const lerp = (a: V3, b: V3, t: number): V3 => add(a, scale(sub(b, a), t));
const ease = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

// Tiles per figure unit on the floor, and screen pixels per unit of height.
const FLOOR_K = 0.011;
const HEIGHT_K = 0.3;

/**
 * How figures are drawn. `zoom` scales every pixel size with the camera.
 */
export const look = { zoom: 1 };

// Small fixed offsets per corner, so cut edges look hand cut.
const CUT = [0.3, -0.4, 0.5, -0.2, 0.1, -0.5, 0.4, -0.3, 0.2, -0.1];

// ---------- projection ----------
export type Iso = (x: number, z: number) => Pt;

interface Projected extends Pt {
  depth: number;
}

function projector(u: RigUnit, iso: Iso): (p: V3) => Projected {
  const size = u.kind === 'bearer' ? 0.82 : 1;
  const c = Math.cos(u.angle);
  const s = Math.sin(u.angle);
  return (p) => {
    const f = p[0] * size;
    const r = p[1] * size;
    const X = u.x + (f * c - r * s) * FLOOR_K;
    const Z = u.z + (f * s + r * c) * FLOOR_K;
    const o = iso(X, Z);
    return { x: o.x, y: o.y - p[2] * size * HEIGHT_K * look.zoom, depth: X + Z };
  };
}

// ---------- skeleton ----------
interface Skeleton {
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

function skeleton(u: RigUnit, time: number): Skeleton {
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
function reach(sk: Skeleton, side: 'L' | 'R', target: V3, bend: V3 = v(-1, 0, -0.5)): void {
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
function handPath(
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
function paperColor(kind: Kind, C: Palette): string {
  if (kind === 'bearer') {
    return C.bearer;
  }
  if (kind === 'vanguard' || kind === 'ranger') {
    return C.merc;
  }
  if (kind === 'penitent') {
    return C.penitent;
  }
  return C.monster;
}

// Keyframes for an attack: windup until `w`, strike until `s`, then recover.
function phases(
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
interface Part {
  depth: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

function trace(ctx: CanvasRenderingContext2D, pts: Pt[], dx: number, dy: number): void {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const cut = CUT[i % CUT.length] * look.zoom;
    if (i) {
      ctx.lineTo(p.x + dx + cut, p.y + dy - cut);
    } else {
      ctx.moveTo(p.x + dx + cut, p.y + dy - cut);
    }
  });
  ctx.closePath();
}

function fill(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, ink: string | null): void {
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

function taper(a: Pt, b: Pt, wideA: number, wideB: number): Pt[] {
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

function hexAt(c: Pt, radius: number): Pt[] {
  const r = radius * look.zoom * 1.15;
  return [0, 1, 2, 3, 4, 5].map((i) => ({
    x: c.x + r * Math.cos((i * Math.PI) / 3 + 0.5),
    y: c.y + r * Math.sin((i * Math.PI) / 3 + 0.5),
  }));
}

// Convex hull, for paper shapes built from several projected points.
function hull(pts: Pt[]): Pt[] {
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

const avg = (...ps: Projected[]): number => ps.reduce((s, p) => s + p.depth, 0) / ps.length;

// What a unit's hands and gear are doing this frame.
interface Gear {
  bowGrip?: V3;
  stringHand?: V3;
  drawn?: number;
  sword?: { hand: V3; dir: V3 };
  spear?: { back: V3; tip: V3 };
  knife?: { hand: V3; dir: V3 };
  lantern?: V3;
  shield?: { center: V3 };
}

function animate(u: RigUnit, sk: Skeleton, time: number): Gear {
  const g: Gear = {};
  const a = u.atk;
  if (u.kind === 'vanguard') {
    // The shield arm holds the shield out in front.
    reach(sk, 'L', add(sk.chest, v(16, -6, -6)), v(-1, -1, 0));
    g.shield = { center: add(sk.handL, v(5, 2, 0)) };
    if (u.shout >= 0) {
      // Sword raised high, then brought down flat on the shield's face.
      const ph = phases(u.shout, 0.45, 0.5);
      const up = add(sk.head, v(-6, 10, 20));
      const bang = add(g.shield.center, v(-2, 4, 6));
      reach(sk, 'R', handPath(ph, v(10, 14, 56), up, bang), v(-1, 1, 0));
    } else if (a >= 0) {
      const ph = phases(a, 0.5, 0.65);
      const up = v(-8, 12, 108);
      const down = v(30, 6, 52);
      const hand = handPath(ph, v(10, 14, 56), up, down);
      reach(sk, 'R', hand, v(-1, 1, 0));
    }
    g.sword = { hand: sk.handR, dir: norm(sub(sk.handR, sk.elbowR)) };
  }
  if (u.kind === 'ranger') {
    const ready = u.alert || a >= 0;
    if (ready) {
      // Bow arm out toward the target; the string hand pulls back to the cheek.
      const grip = add(sk.shoulderL, v(30, 6, 0));
      reach(sk, 'L', grip, v(0, -1, -0.3));
      let pull = 0;
      if (a >= 0) {
        const ph = phases(a, 0.7, 0.78);
        pull = ph.strike > 0 ? 1 - ph.strike : ph.windup;
        if (ph.recover > 0) {
          pull = 0;
        }
      }
      const nocked = add(grip, v(-4, 0, 0));
      const cheek = add(sk.neck, v(2, 6, 2));
      const released = a >= 0.7 && a < 0.9 ? add(cheek, v(-8, 8, 4)) : null;
      reach(sk, 'R', released ?? lerp(nocked, cheek, pull), v(-1, 1, 0));
      g.bowGrip = sk.handL;
      g.stringHand = sk.handR;
      g.drawn = a >= 0 && a < 0.7 ? pull : 0;
    } else {
      // Bow held low while walking.
      g.bowGrip = sk.handL;
    }
  }
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
  if (u.kind === 'bearer') {
    // The lantern swings on its handle as the bearer walks.
    reach(sk, 'R', add(sk.chest, v(14, 10, -14)), v(-1, 1, -0.5));
    const sway = Math.sin(u.walk) * 3 * u.stride + Math.sin(time * 1.7) * 0.6;
    g.lantern = add(sk.handR, v(sway, 0, -12));
  }
  return g;
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
  const base = iso(u.x, u.z);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(
    base.x,
    base.y,
    (u.kind === 'crawler' ? 10 : 7) * look.zoom,
    (u.kind === 'crawler' ? 4 : 2.5) * look.zoom,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  if (u.kind === 'crawler') {
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
  if (u.kind === 'penitent') {
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
  if (u.kind === 'ranger' || u.kind === 'bearer' || u.kind === 'penitent') {
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
  if (u.kind === 'bearer') {
    const writ = [
      add(sk.chest, v(-7, -5, 8)),
      add(sk.chest, v(-7, 5, 8)),
      add(sk.chest, v(-7, 5, -10)),
      add(sk.chest, v(-7, -5, -10)),
    ].map(proj);
    parts.push({
      depth: avg(...writ),
      draw: (c) => {
        fill(c, hull(writ), C.skin, ink);
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
  if (gear.shield) {
    const c0 = gear.shield.center;
    // The shield has thickness, so it still reads as a slab when seen edge-on.
    const face = [v(3, -10, 26), v(3, 10, 26), v(3, 10, -38), v(3, -10, -38)];
    const slab = [...face, ...face.map((o) => add(o, v(-6, 0, 0)))].map((o) => proj(add(c0, o)));
    const front = face.map((o) => proj(add(c0, o)));
    const boss = proj(add(c0, v(4, 0, -4)));
    const showsFace = Math.cos(u.angle) + Math.sin(u.angle) > -0.2;
    parts.push({
      depth: avg(...front) + 0.0008,
      draw: (c) => {
        fill(c, hull(slab), color, ink);
        if (showsFace) {
          fill(c, hexAt(boss, 1.6), C.gold, null);
        }
      },
    });
  }
  if (gear.sword) {
    const a = proj(gear.sword.hand);
    const b = proj(add(gear.sword.hand, scale(gear.sword.dir, 30)));
    parts.push({
      depth: avg(a, b) + 0.0003,
      draw: (c) => {
        fill(c, taper(a, b, 0.9, 0.4), C.bone, ink);
      },
    });
  }
  if (gear.bowGrip) {
    const g = gear.bowGrip;
    const drawn = gear.drawn ?? 0;
    const top = add(g, v(-3 - drawn * 4, 0, 38));
    const bottom = add(g, v(-3 - drawn * 4, 0, -38));
    const bulge = add(g, v(14 + drawn * 2, 0, 0));
    const T = proj(top);
    const Bm = proj(bottom);
    const M = proj(bulge);
    const S = gear.stringHand && drawn > 0 ? proj(gear.stringHand) : null;
    parts.push({
      depth: avg(T, Bm, M) + 0.0007,
      draw: (c) => {
        c.strokeStyle = C.gold;
        c.lineWidth = 1.5 * look.zoom;
        c.beginPath();
        c.moveTo(T.x, T.y);
        c.quadraticCurveTo(2 * M.x - (T.x + Bm.x) / 2, 2 * M.y - (T.y + Bm.y) / 2, Bm.x, Bm.y);
        c.stroke();
        c.strokeStyle = C.bone;
        c.lineWidth = 0.6 * look.zoom;
        c.beginPath();
        c.moveTo(T.x, T.y);
        if (S) {
          c.lineTo(S.x, S.y);
        }
        c.lineTo(Bm.x, Bm.y);
        c.stroke();
        if (S) {
          // The nocked arrow, from the string to past the bow.
          const tip = proj(add(g, v(14, 0, 0)));
          c.strokeStyle = C.bone;
          c.lineWidth = 0.8 * look.zoom;
          c.beginPath();
          c.moveTo(S.x, S.y);
          c.lineTo(tip.x, tip.y);
          c.stroke();
        }
      },
    });
  }
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
  if (gear.lantern) {
    const hand = proj(sk.handR);
    const L = proj(gear.lantern);
    parts.push({
      depth: L.depth + 0.0006,
      draw: (c) => {
        c.strokeStyle = C.ink;
        c.lineWidth = 0.8 * look.zoom;
        c.beginPath();
        c.moveTo(hand.x, hand.y);
        c.lineTo(L.x, L.y);
        c.stroke();
        fill(c, hexAt(L, 2), C.flame, C.ink);
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
  if (u.kind === 'crawler') {
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
  if (u.kind === 'bearer') {
    const sk = skeleton(u, time);
    const g = animate(u, sk, time);
    if (g.lantern) {
      out.push({ p: proj(g.lantern), color: 'flame' });
    }
    return out;
  }
  if ((u.kind === 'hollowSoldier' || u.kind === 'penitent') && toCamera) {
    const sk = skeleton(u, time);
    out.push({
      p: proj(add(sk.head, v(3, -1.5, 1))),
      color: u.kind === 'hollowSoldier' ? 'teal' : 'blood',
    });
    out.push({
      p: proj(add(sk.head, v(3, 1.5, 1))),
      color: u.kind === 'hollowSoldier' ? 'teal' : 'blood',
    });
  }
  return out;
}

// Where the lantern hangs, for the light rings.
export function lanternSpot(u: RigUnit, iso: Iso, time: number): Pt {
  const sk = skeleton(u, time);
  const g = animate(u, sk, time);
  return projector(u, iso)(g.lantern ?? sk.chest);
}
