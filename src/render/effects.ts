import RNG from '../core/rng';
import { SimEvents } from '../sim/events';
import type Sim from '../sim/sim';
import { DamagePriority, HealPriority, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { EventPriority } from '../core/event-emitter';
import { type Pt, blob, fillPoly, hex, pt, quad } from './draw';
import { C } from './palette';
import { isCrawler, look } from './rig';
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

// A ring that spreads on the floor, such as a Vanguard's Challenge.
interface Ring {
  x: number;
  z: number;
  // Reach in tiles at the end
  radius: number;
  age: number;
  life: number;
  color: string;
}

// A mote of light rising off a healed body.
interface Mote {
  x: number;
  z: number;
  h: number;
  life: number;
}

const RING_LIFE = 0.45;
// The pool a body leaves, by kind, in tiles. Most leave half a tile.
const POOL: Partial<Record<string, number>> = { crawler: 0.6, mite: 0.3, broodMother: 1.4 };
// How high arrows fly, in pixels
const ARROW_HEIGHT = 22;

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
  if (u.kind === 'penitent' || u.kind === 'cantor' || u.kind === 'hollowed') {
    return C.penitent;
  }
  return C.monster;
}

/**
 * Blood, flying paper pieces, arrows and skill marks. They only decorate:
 * the simulation never reads them, and they draw from their own random
 * stream. Arrows are the simulation's own projectiles, drawn where they are.
 */
export class Effects {
  readonly decals: Decal[] = [];
  readonly particles: Particle[] = [];
  readonly pieces: Piece[] = [];
  readonly rings: Ring[] = [];
  readonly motes: Mote[] = [];
  // Units torn apart. They leave pieces instead of a corpse.
  readonly gibbed = new Set<Unit>();
  private readonly rng = new RNG(99);

  constructor(
    private readonly sim: Sim,
    private readonly views: Views,
  ) {
    sim.on(SimEvents.UnitSkillRelease, EventPriority.Post, (event) => {
      const u = event.source;
      if (event.skill.id === 'challenge') {
        // Red is danger: whatever stands inside must turn and fight.
        this.rings.push({ x: u.x, z: u.z, radius: 3, age: 0, life: RING_LIFE, color: C.blood });
      } else if (event.skill.id === 'hymn') {
        // Gold is light: the Church's rite, mending its own.
        this.rings.push({
          x: u.x,
          z: u.z,
          radius: 4,
          age: 0,
          life: RING_LIFE * 1.5,
          color: C.gold,
        });
      }
    });
    sim.on(SimEvents.UnitHeal, HealPriority.Post, (event) => {
      if (event.value <= 0) {
        return;
      }
      for (let i = 0; i < 5; i++) {
        this.motes.push({
          x: event.target.x + this.rng.range(-0.25, 0.25),
          z: event.target.z + this.rng.range(-0.25, 0.25),
          h: this.rng.range(0.2, 1.6),
          life: this.rng.range(0.5, 1),
        });
      }
    });
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (event.value <= 0) {
        return;
      }
      this.views.hit(event.target);
      const dx = event.target.x - event.source.x;
      const dz = event.target.z - event.source.z;
      const d = Math.hypot(dx, dz) || 1;
      this.views.knock(event.target, (dx / d) * 0.18, (dz / d) * 0.18);
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
    // A raised body is whole again.
    sim.on(SimEvents.UnitRevived, EventPriority.Post, (event) => {
      this.gibbed.delete(event.source);
      this.levelUp(event.source);
    });
    sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
      const u = event.source;
      const heavy = u.torn;
      if (heavy) {
        this.gibbed.add(u);
        this.dismember(u, event.killer);
      } else {
        // The body falls where it stood and bleeds out under itself.
        this.stain(u.x, u.z, POOL[u.kind] ?? 0.5, C.blood);
      }
    });
  }

  /** A gold ring and rising light around a merc who just gained a level. */
  levelUp(u: Unit): void {
    this.rings.push({ x: u.x, z: u.z, radius: 1.4, age: 0, life: RING_LIFE * 2, color: C.gold });
    for (let i = 0; i < 12; i++) {
      this.motes.push({
        x: u.x + this.rng.range(-0.4, 0.4),
        z: u.z + this.rng.range(-0.4, 0.4),
        h: this.rng.range(0, 1.2),
        life: this.rng.range(0.8, 1.6),
      });
    }
  }

  /** Forgets everything on the old stage's floor and in its air. */
  clear(): void {
    this.decals.length = 0;
    this.particles.length = 0;
    this.pieces.length = 0;
    this.rings.length = 0;
    this.motes.length = 0;
    // The torn-apart dead who came along stay torn apart.
    for (const u of this.gibbed) {
      if (!this.sim.units.has(u)) {
        this.gibbed.delete(u);
      }
    }
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
    if (isCrawler(u.kind)) {
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

    for (const ring of this.rings) {
      ring.age += dt;
    }
    removeWhere(this.rings, (ring) => ring.age >= ring.life);
    for (const m of this.motes) {
      m.h += dt * 1.2;
      m.life -= dt;
    }
    removeWhere(this.motes, (m) => m.life <= 0);
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

  /** Rings on the floor, drawn under everything that stands. */
  drawRings(ctx: CanvasRenderingContext2D, iso: (x: number, z: number) => Pt): void {
    ctx.lineWidth = look.zoom;
    for (const ring of this.rings) {
      ctx.strokeStyle = ring.color;
      const t = ring.age / ring.life;
      const c = iso(ring.x, ring.z);
      // A tile's half-diagonal is 16 pixels across and 8 down.
      const rx = ring.radius * Math.sqrt(t) * 16 * Math.SQRT2 * look.zoom;
      ctx.globalAlpha = 1 - t * t;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx, rx / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx * 0.8, rx * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Arrows in flight and blood in the air. `seen` hides what the party cannot see. */
  drawAir(
    ctx: CanvasRenderingContext2D,
    iso: (x: number, z: number) => Pt,
    seen: (x: number, z: number) => boolean,
  ): void {
    ctx.lineWidth = 1;
    const h = ARROW_HEIGHT * look.zoom;
    for (const p of this.sim.projectiles) {
      if (!seen(p.x, p.z)) {
        continue;
      }
      const head = iso(p.x, p.z);
      // A skill arrow leaves a long pale streak, a plain one a short shaft.
      const length = p.skill ? 1.1 : 0.3;
      const tail = iso(p.x - p.dx * length, p.z - p.dz * length);
      ctx.strokeStyle = p.skill ? C.bone : C.ink;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y - h);
      ctx.lineTo(head.x, head.y - h);
      ctx.stroke();
      ctx.fillStyle = C.bone;
      ctx.fillRect(Math.round(head.x), Math.round(head.y - h), 1, 1);
    }
    ctx.fillStyle = C.gold;
    for (const m of this.motes) {
      if (seen(m.x, m.z)) {
        const b = iso(m.x, m.z);
        ctx.fillRect(Math.round(b.x), Math.round(b.y - m.h * HEIGHT_PX * look.zoom), 1, 1);
      }
    }
    ctx.fillStyle = C.blood;
    for (const p of this.particles) {
      if (!seen(p.x, p.z)) {
        continue;
      }
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
