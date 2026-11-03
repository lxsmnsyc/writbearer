import type { KeyPoint } from '../../gen/stage';
import { Shout } from '../../sim/shout';
import { Element, Side } from '../../sim/types';
import { type Pt, fillPoly } from '../draw';
import { C } from '../palette';
import type { Frame } from '../renderer';
import { look } from '../rig';
import { ZONE_LOOKS } from '../zones';
import type { Scene } from './scene';

// The level director's key points, by kind
const SPOT_COLOR: Record<KeyPoint['kind'], string> = {
  spawn: C.blood,
  boss: C.gold,
  relief: C.teal,
};

// Each zone's color on the ground, by its element
const ZONE_COLOR: Partial<Record<Element, string>> = {
  [Element.Radiant]: C.flame,
  [Element.Storm]: C.storm,
  [Element.Earth]: C.earth,
  [Element.Neutral]: C.bone,
};

// Warnings on the ground fill with red as they come due, so the party can
// see a blow coming and step out of it.
export function drawWarnings(s: Scene, f: Frame): void {
  const { ctx, iso } = s;
  for (const w of f.sim.warnings) {
    const k = Math.min(1, w.t / w.windup);
    const sh = w.shape;
    let outline: Pt[];
    let fill: Pt[];
    if (sh.kind === 'circle') {
      const ring = (r: number): Pt[] =>
        Array.from({ length: 20 }, (_, i) => {
          const a = (i / 20) * Math.PI * 2;
          return iso(w.x + Math.cos(a) * r, w.z + Math.sin(a) * r);
        });
      outline = ring(sh.r);
      fill = ring(sh.r * k);
    } else if (sh.kind === 'square') {
      const square = (r: number): Pt[] => [
        iso(w.x - r, w.z - r),
        iso(w.x + r, w.z - r),
        iso(w.x + r, w.z + r),
        iso(w.x - r, w.z + r),
      ];
      outline = square(sh.r);
      fill = square(sh.r * k);
    } else if (sh.kind === 'line') {
      const dx = sh.x2 - w.x;
      const dz = sh.z2 - w.z;
      const l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * (sh.width / 2);
      const nz = (dx / l) * (sh.width / 2);
      const strip = (t: number): Pt[] => [
        iso(w.x + nx, w.z + nz),
        iso(w.x + dx * t + nx, w.z + dz * t + nz),
        iso(w.x + dx * t - nx, w.z + dz * t - nz),
        iso(w.x - nx, w.z - nz),
      ];
      outline = strip(1);
      fill = strip(k);
    } else {
      const fan = (r: number): Pt[] => [
        iso(w.x, w.z),
        ...Array.from({ length: 9 }, (_, i) => {
          const a = sh.angle - sh.spread / 2 + (sh.spread * i) / 8;
          return iso(w.x + Math.cos(a) * r, w.z + Math.sin(a) * r);
        }),
      ];
      outline = fan(sh.r);
      fill = fan(sh.r * k);
    }
    ctx.globalAlpha = 0.25 + 0.35 * k;
    fillPoly(ctx, fill, C.blood, null);
    ctx.globalAlpha = 1;
    fillPoly(ctx, outline, 'rgba(0,0,0,0)', C.blood);
  }
}

// Zones skills leave on the ground: a ring in the element's color, faint
// inside, with a mark for what stands at its middle.
export function drawZones(s: Scene, f: Frame): void {
  const { ctx, iso } = s;
  for (const z of f.sim.zones) {
    const color = ZONE_COLOR[z.element] ?? C.bone;
    const ring = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return iso(z.x + Math.cos(a) * z.r, z.z + Math.sin(a) * z.r);
    });
    // It fades as it runs out.
    const fade = Math.min(1, z.life / 1.5);
    ctx.globalAlpha = (0.1 + 0.05 * Math.sin(f.time * 3)) * fade;
    fillPoly(ctx, ring, color, null);
    ctx.globalAlpha = 0.7 * fade;
    fillPoly(ctx, ring, 'rgba(0,0,0,0)', color);
    ctx.globalAlpha = fade;
    const c = iso(z.x, z.z);
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    const mark = ZONE_LOOKS[z.kind];
    if (mark) {
      mark(ctx, { x, y }, z, iso);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x - 1, y - 1, 3, 2);
    }
    ctx.globalAlpha = 1;
  }
}

// Snares set on the floor: iron jaws, open, a ring of teeth.
export function drawTraps(s: Scene, f: Frame): void {
  const { ctx } = s;
  for (const t of f.sim.traps) {
    const b = s.iso(t.x, t.z);
    ctx.fillStyle = C.ink;
    ctx.fillRect(b.x - 4, b.y - 1, 9, 3);
    ctx.fillStyle = C.bone;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(b.x - 4 + i * 2, b.y - 2 + (i % 2), 1, 1);
    }
  }
}

// A red ring marks the enemy the bearer told the party to focus on, and a
// gold ring the merc whose orders are open.
export function drawRings(s: Scene, f: Frame): void {
  const { ctx } = s;
  const z = look.zoom;
  const focused = new Set(
    f.sim
      .living(Side.Party)
      .map((m) => (m.heard?.shout === Shout.Focus ? m.heard.target : null))
      .filter((t) => t?.alive),
  );
  for (const t of focused) {
    if (t) {
      const r = f.views.rig(t, f.alpha);
      const b = s.body(r.x, r.z);
      ctx.strokeStyle = C.blood;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 12 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (f.selected?.alive) {
    const r = f.views.rig(f.selected, f.alpha);
    const b = s.body(r.x, r.z);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 10 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// The level director's key points, for tuning it: a red diamond where a
// wave may come from, gold where a boss may stand, teal for relief.
export function drawSpots(s: Scene, f: Frame): void {
  const { ctx, iso } = s;
  for (const p of f.areas.flatMap((a) => a.stage.spots ?? [])) {
    const r = p.kind === 'boss' ? 0.6 : 0.4;
    fillPoly(
      ctx,
      [iso(p.x - r, p.z), iso(p.x, p.z - r), iso(p.x + r, p.z), iso(p.x, p.z + r)],
      SPOT_COLOR[p.kind],
      C.ink,
    );
  }
}
