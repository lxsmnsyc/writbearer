import { EventEngine } from '../core/event-engine';
import RNG from '../core/rng';
import { think } from './ai';
import type { SimEventMap } from './events';
import setupMechanics from './mechanics';
import { DamageFlags, Range, type Side } from './types';
import type Unit from './unit';

// The fixed simulation step: 20 ticks per second.
export const TICK = 0.05;
// Recovery after a blow lands, before the unit can act again.
const RECOVERY = 0.2;
// Units closer than this push apart.
const BODY = 0.5;

// Moves a basic attack along. The blow lands on the hit frame.
function advanceSwing(u: Unit, dt: number): void {
  if (u.swing < 0 || !u.alive) {
    return;
  }
  const before = u.swing;
  u.swing += dt;
  const target = u.swingTarget;
  if (before < u.kit.hitAt && u.swing >= u.kit.hitAt && target?.alive) {
    // A target that stepped out of reach since the swing began is missed.
    const slack = u.job.range === Range.Ranged ? 1 : 0.5;
    if (u.distanceTo(target) <= u.kit.reach + slack) {
      let flags = DamageFlags.BasicAttack;
      if (u.job.range === Range.Ranged) {
        flags |= DamageFlags.Projectile;
      }
      if (target.isFlankedBy(u)) {
        flags |= DamageFlags.Flank;
      }
      target.aware = true;
      u.hit(target, { flags });
    }
  }
  // The swing ends a short recovery after the blow.
  if (u.swing >= u.kit.hitAt + RECOVERY) {
    u.swing = -1;
    u.swingTarget = null;
  }
}

/**
 * One stage of play. Every mechanic, skill and item effect is a listener
 * on this bus.
 */
export default class Sim extends EventEngine<SimEventMap> {
  // Rolls for combat: damage rolls, hits, crits and blocks.
  readonly rng: RNG;

  readonly units = new Set<Unit>();

  // The unit the party protects. The run ends if it dies.
  bearer: Unit | null = null;

  // Seconds since the stage began.
  time = 0;

  // Solid round props, such as pillars. Units cannot stand inside them.
  readonly obstacles: { x: number; z: number; r: number }[] = [];

  // The floor's size, in tiles. Units stay inside. Infinite means no bounds.
  size = Infinity;

  constructor(rng: RNG | number) {
    super();
    this.rng = typeof rng === 'number' ? new RNG(rng) : rng;
    setupMechanics(this);
  }

  add(unit: Unit): Unit {
    this.units.add(unit);
    return unit;
  }

  living(side?: Side): Unit[] {
    const out: Unit[] = [];
    for (const u of this.units) {
      if (u.alive && (side === undefined || u.side === side)) {
        out.push(u);
      }
    }
    return out;
  }

  /** Advances the stage by one fixed step. */
  tick(dt = TICK): void {
    this.time += dt;
    const living = this.living();
    for (const u of living) {
      u.cooldown = Math.max(0, u.cooldown - dt);
    }
    for (const u of living) {
      think(this, u, dt);
    }
    for (const u of living) {
      advanceSwing(u, dt);
    }
    this.separate();
  }

  /** Runs ticks until `done` returns true or `seconds` pass. */
  run(seconds: number, done: () => boolean = () => false): void {
    const end = this.time + seconds;
    while (this.time < end && !done()) {
      this.tick();
    }
  }

  // Bodies push each other apart. Mercs make way for the bearer.
  private separate(): void {
    const living = this.living();
    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) {
        const a = living[i];
        const b = living[j];
        const d = a.distanceTo(b);
        if (d >= BODY || d === 0) {
          continue;
        }
        let share = 0.5;
        if (a === this.bearer && b.side === a.side) {
          share = 0;
        }
        if (b === this.bearer && a.side === b.side) {
          share = 1;
        }
        const push = BODY - d;
        const nx = (a.x - b.x) / d;
        const nz = (a.z - b.z) / d;
        a.x += nx * push * share;
        a.z += nz * push * share;
        b.x -= nx * push * (1 - share);
        b.z -= nz * push * (1 - share);
      }
    }
    for (const u of living) {
      for (const o of this.obstacles) {
        const d = Math.hypot(u.x - o.x, u.z - o.z);
        if (d < o.r && d > 0) {
          u.x = o.x + ((u.x - o.x) / d) * o.r;
          u.z = o.z + ((u.z - o.z) / d) * o.r;
        }
      }
      if (Number.isFinite(this.size)) {
        u.x = Math.min(this.size - 0.5, Math.max(0.5, u.x));
        u.z = Math.min(this.size - 0.5, Math.max(0.5, u.z));
      }
    }
  }
}
