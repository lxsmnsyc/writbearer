import RNG from '../core/rng';
import { SimEvents } from '../sim/events';
import type Sim from '../sim/sim';
import { DamageFlags, DamagePriority, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { EventPriority } from '../core/event-emitter';
import { type Pt, blob, fillPoly, hex, pt, quad } from './draw';
import { C } from './palette';
import { look } from './rig';
import type { Views } from './view';

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

export interface Piece {
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

interface Arrow {
  from: Unit;
  x: number;
  z: number;
  tx: number;
  tz: number;
  life: number;
}

const MAX_DECALS = 400;
const GRAVITY = 9;
// Height in pixels of one tile of height
const HEIGHT_PX = 16;

export function bodyColor(u: Unit): string {
  if (u.kind === 'bearer') {
    return C.bearer;
  }
  if (u.side === Side.Party) {
    return C.merc;
  }
  if (u.kind === 'penitent') {
    return C.penitent;
  }
  return C.monster;
}

/**
 * Blood, flying paper pieces and arrows. They only decorate: the simulation
 * never reads them, and they draw from their own random stream.
 */
export class Effects {
  readonly decals: Decal[] = [];
  readonly particles: Particle[] = [];
  readonly pieces: Piece[] = [];
  readonly arrows: Arrow[] = [];
  private readonly rng = new RNG(99);

  constructor(
    sim: Sim,
    private readonly views: Views,
  ) {
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (event.value <= 0) {
        return;
      }
      this.views.hit(event.target);
      const dx = event.target.x - event.source.x;
      const dz = event.target.z - event.source.z;
      const d = Math.hypot(dx, dz) || 1;
      this.views.knock(event.target, (dx / d) * 0.18, (dz / d) * 0.18);
      if (event.flags & DamageFlags.Projectile) {
        this.arrows.push({
          from: event.source,
          x: event.source.x,
          z: event.source.z,
          tx: event.target.x,
          tz: event.target.z,
          life: 0.12,
        });
      }
      this.spray(event.target, event.source, 16);
      if (this.rng.chance(0.5)) {
        this.stain(
          event.target.x + this.rng.range(-0.4, 0.4),
          event.target.z + this.rng.range(-0.4, 0.4),
          this.rng.range(0.12, 0.25),
          C.blood,
        );
      }
    });
    sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
      this.dismember(event.source, event.killer);
    });
  }

  /** Old blood already on the floor when a stage begins. */
  stain(x: number, z: number, r: number, color: string): void {
    this.decals.push({ x, z, r, color, seed: this.rng.random() * 99 });
    if (this.decals.length > MAX_DECALS) {
      this.decals.splice(0, this.decals.length - MAX_DECALS);
    }
  }

  private spray(target: Unit, from: Unit, count: number): void {
    const dx = target.x - from.x;
    const dz = target.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: target.x,
        z: target.z,
        h: 0.7,
        vx: (dx / d) * this.rng.range(0.5, 2.5) + this.rng.range(-1, 1),
        vz: (dz / d) * this.rng.range(0.5, 2.5) + this.rng.range(-1, 1),
        vh: this.rng.range(1, 3),
        life: this.rng.range(0.4, 0.9),
      });
    }
  }

  // The dead fall apart into their paper pieces, which stay where they land.
  private dismember(u: Unit, killer: Unit | null): void {
    const dx = killer ? u.x - killer.x : 0;
    const dz = killer ? u.z - killer.z : 0;
    const d = Math.hypot(dx, dz) || 1;
    this.stain(u.x, u.z, u.kind === 'crawler' ? 0.9 : 0.75, C.blood);
    const color = bodyColor(u);
    const fling = (kind: Piece['kind'], c = color): void => {
      this.pieces.push({
        kind,
        x: u.x,
        z: u.z,
        vx: (dx / d) * this.rng.range(1, 3) + this.rng.range(-1.5, 1.5),
        vz: (dz / d) * this.rng.range(1, 3) + this.rng.range(-1.5, 1.5),
        h: 0.6,
        vh: this.rng.range(1.5, 3.5),
        rot: this.rng.random() * 6,
        spin: this.rng.range(-10, 10),
        color: c,
      });
    };
    if (u.kind === 'crawler') {
      for (let i = 0; i < 4; i++) {
        fling('chunk');
      }
    } else {
      fling('head');
      for (let i = 0; i < 4; i++) {
        fling('limb');
      }
      fling('chunk');
      if (u.kind === 'vanguard') {
        fling('shield', C.merc);
      }
    }
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x: u.x,
        z: u.z,
        h: 0.6,
        vx: this.rng.range(-2.5, 2.5),
        vz: this.rng.range(-2.5, 2.5),
        vh: this.rng.range(1.5, 4),
        life: this.rng.range(0.5, 1.1),
      });
    }
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.vh -= GRAVITY * dt;
      p.h += p.vh * dt;
      p.life -= dt;
      if (p.h <= 0) {
        if (this.rng.chance(0.15)) {
          this.stain(p.x, p.z, 0.08, C.blood);
        }
        p.life = 0;
      }
    }
    removeWhere(this.particles, (p) => p.life <= 0);

    for (const p of this.pieces) {
      if (p.h > 0 || p.vh > 0) {
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.vh -= GRAVITY * dt;
        p.h = Math.max(0, p.h + p.vh * dt);
        p.rot += p.spin * dt;
        if (p.h === 0) {
          p.vh = 0;
          p.vx = 0;
          p.vz = 0;
          p.spin = 0;
          this.stain(p.x, p.z, 0.14, C.blood);
        }
      }
    }

    for (const a of this.arrows) {
      a.life -= dt;
    }
    removeWhere(this.arrows, (a) => a.life <= 0);
  }

  drawDecals(ctx: CanvasRenderingContext2D, iso: (x: number, z: number) => Pt): void {
    for (const d of this.decals) {
      fillPoly(
        ctx,
        blob(iso(d.x, d.z), d.r * 16 * look.zoom, d.r * 8 * look.zoom, 8, d.seed),
        d.color,
        null,
      );
    }
  }

  drawAir(ctx: CanvasRenderingContext2D, iso: (x: number, z: number) => Pt): void {
    for (const a of this.arrows) {
      const t = 1 - a.life / 0.12;
      const x = a.x + (a.tx - a.x) * t;
      const z = a.z + (a.tz - a.z) * t;
      const b = iso(x, z);
      const e = iso(a.tx, a.tz);
      const d = Math.hypot(e.x - b.x, e.y - b.y) || 1;
      ctx.strokeStyle = C.bone;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 22 * look.zoom);
      ctx.lineTo(b.x + ((e.x - b.x) / d) * 5, b.y - 22 * look.zoom + ((e.y - b.y) / d) * 5);
      ctx.stroke();
    }
    ctx.fillStyle = C.blood;
    for (const p of this.particles) {
      const b = iso(p.x, p.z);
      ctx.fillRect(Math.round(b.x), Math.round(b.y - p.h * HEIGHT_PX * look.zoom), 1, 1);
    }
  }
}

/** Draws one paper piece of the dead, in the air or on the floor. */
export function drawPiece(
  ctx: CanvasRenderingContext2D,
  iso: (x: number, z: number) => Pt,
  p: Piece,
): void {
  const b = iso(p.x, p.z);
  const z = look.zoom;
  const c = pt(b.x, b.y - p.h * HEIGHT_PX * z);
  const r = p.rot;
  if (p.kind === 'head') {
    fillPoly(ctx, hex(c, 3 * z, r), p.color);
  } else if (p.kind === 'limb') {
    fillPoly(
      ctx,
      quad(
        pt(c.x - Math.cos(r) * 4, c.y - Math.sin(r) * 2),
        pt(c.x + Math.cos(r) * 4, c.y + Math.sin(r) * 2),
        1.2,
        0.7,
      ),
      p.color,
    );
  } else if (p.kind === 'chunk') {
    fillPoly(
      ctx,
      hex(c, 3.5 * z, r).map((q, i) => (i % 2 ? pt(q.x, q.y + z) : q)),
      p.color,
    );
  } else {
    fillPoly(
      ctx,
      [pt(c.x - 7, c.y - 2), pt(c.x + 7, c.y - 5), pt(c.x + 8, c.y), pt(c.x - 6, c.y + 3)],
      p.color,
    );
  }
}

function removeWhere<T>(items: T[], dead: (item: T) => boolean): void {
  let w = 0;
  for (const item of items) {
    if (!dead(item)) {
      items[w++] = item;
    }
  }
  items.length = w;
}
