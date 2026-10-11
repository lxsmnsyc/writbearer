import { EventEngine } from '../core/event-engine';
import RNG from '../core/rng';
import { think } from './ai';
import { type SimEventMap, SimEvents } from './events';
import setupMechanics from './mechanics';
import Nav from './nav';
import type { Projectile } from './projectile';
import type { Trap } from './trap';
import { DamageFlags, Range, Side } from './types';
import type { HitOptions } from './unit';
import type Unit from './unit';

// The fixed simulation step: 20 ticks per second.
export const TICK = 0.05;
// Recovery after a blow lands, before the unit can act again.
const RECOVERY = 0.2;
// Units closer than this push apart.
const BODY = 0.5;
// Arrows fly this fast, in tiles per second.
export const ARROW_SPEED = 14;
// A homing projectile lands once this close to its target.
const LAND = 0.25;
// Straight projectiles move in steps no longer than this, so they cannot skip a body.
const SUBSTEP = 0.2;
// Mana regenerates this much faster when the unit is not fighting.
const REST_REGEN = 2;

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
      if (u.job.range === Range.Ranged) {
        // The arrow leaves now and lands when it reaches the target.
        u.sim.fire(u, target, {
          speed: ARROW_SPEED,
          homing: true,
          options: { flags: DamageFlags.BasicAttack | DamageFlags.Projectile },
        });
      } else {
        strike(u, target, { flags: DamageFlags.BasicAttack });
      }
    }
  }
  // The swing ends a short recovery after the blow.
  if (u.swing >= u.kit.hitAt + RECOVERY) {
    u.swing = -1;
    u.swingTarget = null;
  }
}

// Moves a skill along: windup, release, recovery.
function advanceCast(u: Unit, dt: number): void {
  const cast = u.cast;
  if (!cast || !u.alive) {
    return;
  }
  const before = cast.t;
  cast.t += dt;
  const { skill } = cast;
  if (before < skill.windup && cast.t >= skill.windup) {
    u.sim.emit(SimEvents.UnitSkillRelease, {
      id: 'UnitSkillRelease',
      disabled: false,
      source: u,
      skill,
      target: cast.target,
    });
  }
  if (u.cast === cast && cast.t >= skill.windup + skill.recovery) {
    u.cast = null;
  }
}

/**
 * A blow that lands now: wakes the target and marks hits from behind.
 * Returns the damage event, or null on a miss.
 */
export function strike(source: Unit, target: Unit, options: HitOptions): ReturnType<Unit['hit']> {
  let flags = options.flags ?? 0;
  if (target.isFlankedBy(source)) {
    flags |= DamageFlags.Flank;
  }
  target.aware = true;
  return source.hit(target, { ...options, flags });
}

// A homing projectile turns toward its target and lands on reaching it.
function flyHoming(p: Projectile, dt: number): void {
  const t = p.homing;
  if (!t?.alive) {
    p.done = true;
    return;
  }
  const dx = t.x - p.x;
  const dz = t.z - p.z;
  const d = Math.hypot(dx, dz);
  const step = p.speed * dt;
  if (d <= step + LAND) {
    p.x = t.x;
    p.z = t.z;
    p.done = true;
    strike(p.source, t, p.options);
    p.onHit?.(t);
    return;
  }
  p.dx = dx / d;
  p.dz = dz / d;
  p.x += p.dx * step;
  p.z += p.dz * step;
}

// A straight projectile hits each enemy it passes, in small steps.
function flyStraight(sim: Sim, p: Projectile, dt: number): void {
  const enemies = sim.living(p.source.side === Side.Party ? Side.Monster : Side.Party);
  let travel = Math.min(p.left, p.speed * dt);
  while (travel > 0 && !p.done) {
    const step = Math.min(SUBSTEP, travel);
    travel -= step;
    p.left -= step;
    p.x += p.dx * step;
    p.z += p.dz * step;
    for (const u of enemies) {
      if (u.alive && !p.hits.has(u) && Math.hypot(u.x - p.x, u.z - p.z) <= p.radius) {
        p.hits.add(u);
        strike(p.source, u, p.options);
        p.onHit?.(u);
        if (!p.pierce) {
          p.done = true;
          break;
        }
      }
    }
    if (p.left <= 0) {
      p.done = true;
    }
  }
}

function removeDone(list: Projectile[]): void {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].done) {
      list.splice(i, 1);
    }
  }
}

export interface FireOptions {
  speed: number;
  // Follows the target and lands on it. Otherwise it flies straight.
  homing?: boolean;
  // How far a straight projectile flies, in tiles
  distance?: number;
  // How close an enemy must pass to be hit
  radius?: number;
  pierce?: boolean;
  skill?: string;
  options: HitOptions;
  onHit?: (target: Unit) => void;
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

  // The floor's size, in tiles, along x and z. Units stay inside. Infinite
  // means no bounds.
  width = Infinity;
  depth = Infinity;

  // Where units can walk, once the floor is set. Without it, they walk straight.
  nav: Nav | null = null;

  // Arrows and other things in flight.
  readonly projectiles: Projectile[] = [];

  // Traps set on the floor.
  readonly traps: Trap[] = [];

  constructor(rng: RNG | number) {
    super();
    this.rng = typeof rng === 'number' ? new RNG(rng) : rng;
    setupMechanics(this);
  }

  /** Sets the floor's size and builds where units can walk around the obstacles. */
  setFloor(width: number, depth: number): void {
    this.width = width;
    this.depth = depth;
    this.nav = new Nav(width, depth, this.obstacles);
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

  /** Launches a projectile from `source` toward `target`. */
  fire(source: Unit, target: Unit, f: FireOptions): Projectile {
    const dx = target.x - source.x;
    const dz = target.z - source.z;
    const d = Math.hypot(dx, dz) || 1;
    const p: Projectile = {
      source,
      x: source.x,
      z: source.z,
      dx: dx / d,
      dz: dz / d,
      speed: f.speed,
      left: f.distance ?? d + 2,
      homing: f.homing ? target : null,
      radius: f.radius ?? 0.4,
      pierce: f.pierce ?? false,
      hits: new Set(),
      options: f.options,
      skill: f.skill ?? null,
      done: false,
      onHit: f.onHit,
    };
    this.projectiles.push(p);
    return p;
  }

  /** Launches a homing projectile from one unit's position on behalf of another, as a chain. */
  chain(source: Unit, from: Unit, target: Unit, f: FireOptions): Projectile {
    const p = this.fire(source, target, { ...f, homing: true });
    p.x = from.x;
    p.z = from.z;
    p.hits.add(from);
    return p;
  }

  /** Advances the stage by one fixed step. */
  tick(dt = TICK): void {
    this.time += dt;
    const living = this.living();
    for (const u of living) {
      u.cooldown = Math.max(0, u.cooldown - dt);
      for (const [id, left] of u.skillCooldowns) {
        u.skillCooldowns.set(id, Math.max(0, left - dt));
      }
      u.tickStatuses(dt);
      // Mana comes back slowly, and twice as fast out of a fight.
      const rate = u.target?.alive ? 1 : REST_REGEN;
      u.mana = Math.min(u.derived.maxMana, u.mana + u.derived.manaRegen * rate * dt);
    }
    for (const u of living) {
      think(this, u, dt);
    }
    for (const u of living) {
      advanceSwing(u, dt);
      advanceCast(u, dt);
    }
    for (const p of this.projectiles) {
      if (p.homing) {
        flyHoming(p, dt);
      } else {
        flyStraight(this, p, dt);
      }
    }
    removeDone(this.projectiles);
    this.springTraps(dt);
    this.separate();
    this.emit(SimEvents.Tick, { id: 'Tick', disabled: false, dt });
  }

  // An enemy stepping on a trap springs it. Old traps rust away.
  private springTraps(dt: number): void {
    for (const trap of this.traps) {
      trap.life -= dt;
      const foes = this.living(trap.owner.side === Side.Party ? Side.Monster : Side.Party);
      const victim = foes.find((u) => Math.hypot(u.x - trap.x, u.z - trap.z) <= trap.radius);
      if (victim) {
        victim.aware = true;
        victim.addStatus(trap.status, trap.owner, trap.duration);
        trap.sprung = true;
      }
    }
    for (let i = this.traps.length - 1; i >= 0; i--) {
      if (this.traps[i].sprung || this.traps[i].life <= 0) {
        this.traps.splice(i, 1);
      }
    }
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
      if (Number.isFinite(this.width)) {
        u.x = Math.min(this.width - 0.5, Math.max(0.5, u.x));
      }
      if (Number.isFinite(this.depth)) {
        u.z = Math.min(this.depth - 0.5, Math.max(0.5, u.z));
      }
    }
  }
}
