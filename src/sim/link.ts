import { EventPriority } from '../core/event-emitter';
import { SimEvents } from './events';
import type Sim from './sim';
import { DamageFlags, DamageKind, DamagePriority } from './types';
import type Unit from './unit';

// Linked units: a group that shares hits, must all fall inside a window or
// the fallen rise, heals itself and can swap places.

export interface LinkOptions {
  /** Seconds the rest have to fall after the first of them does. */
  window?: number;
  /** Share of its health a risen unit comes back with. */
  rise?: number;
  /** Share of its health each unit heals the most hurt other every `healEvery`. */
  heal?: number;
  healEvery?: number;
}

const DEFAULTS = { window: 6, rise: 0.5, heal: 0, healEvery: 2 };

interface Group {
  units: Unit[];
  window: number;
  rise: number;
  heal: number;
  healEvery: number;
  // When the first of the fallen died, or null while all stand
  fellAt: number | null;
  healed: number;
}

export default class Links {
  private readonly groups = new Set<Group>();
  private readonly of = new Map<Unit, Group>();

  constructor(private readonly sim: Sim) {
    sim.on(SimEvents.UnitDamage, DamagePriority.Barrier, (e) => {
      this.share(e.target, e);
    });
    sim.on(SimEvents.UnitDies, EventPriority.Post, (e) => {
      this.fell(e.source);
    });
    sim.on(SimEvents.Tick, EventPriority.Post, (e) => {
      for (const g of this.groups) {
        this.tick(g, e.dt);
      }
    });
  }

  /** Links units into one group. A unit is in one group at a time. */
  link(units: readonly Unit[], options: LinkOptions = {}): void {
    const g: Group = {
      units: [...units],
      ...DEFAULTS,
      ...options,
      fellAt: null,
      healed: 0,
    };
    this.groups.add(g);
    for (const u of g.units) {
      this.of.set(u, g);
    }
  }

  /** Who a unit is linked with, itself included. Empty when unlinked. */
  group(u: Unit): readonly Unit[] {
    return this.of.get(u)?.units ?? [];
  }

  /** Two linked, living units trade places. Returns whether they did. */
  swap(a: Unit, b: Unit): boolean {
    const g = this.of.get(a);
    if (!g || g !== this.of.get(b) || a === b || !a.alive || !b.alive) {
      return false;
    }
    const { x, z } = a;
    a.x = b.x;
    a.z = b.z;
    b.x = x;
    b.z = z;
    a.route = null;
    b.route = null;
    this.sim.emit(SimEvents.LinkSwapped, {
      id: 'LinkSwapped',
      disabled: false,
      source: a,
      with: b,
    });
    return true;
  }

  // A hit on one is split evenly among the living. A hit passed on is not
  // passed on again, and carries the Redirected flag.
  private share(u: Unit, e: { source: Unit; value: number; flags: number }): void {
    const g = this.of.get(u);
    const alive = g?.units.filter((b) => b.alive);
    if (!alive || alive.length < 2 || (e.flags & DamageFlags.Redirected) !== 0 || e.value <= 0) {
      return;
    }
    const part = e.value / alive.length;
    e.value = part;
    for (const b of alive) {
      if (b !== u) {
        e.source.hit(b, {
          kind: DamageKind.True,
          fixed: Math.max(1, Math.round(part)),
          flags: DamageFlags.Redirected,
        });
      }
    }
  }

  // The first to fall opens the window; the last one closes it.
  private fell(u: Unit): void {
    const g = this.of.get(u);
    if (!g) {
      return;
    }
    let standing = false;
    for (const b of g.units) {
      standing ||= b.alive;
    }
    if (standing) {
      g.fellAt ??= this.sim.time;
    } else {
      g.fellAt = null;
    }
  }

  private tick(g: Group, dt: number): void {
    if (g.fellAt !== null && this.sim.time - g.fellAt >= g.window) {
      g.fellAt = null;
      for (const b of g.units) {
        if (!b.alive && b.revive(g.rise)) {
          this.sim.emit(SimEvents.LinkRisen, { id: 'LinkRisen', disabled: false, source: b });
        }
      }
    }
    if (g.heal <= 0) {
      return;
    }
    g.healed += dt;
    if (g.healed < g.healEvery) {
      return;
    }
    g.healed = 0;
    for (const u of g.units) {
      let worst: Unit | null = null;
      for (const b of g.units) {
        if (b !== u && b.alive && b.hp < b.derived.maxHp) {
          if (!worst || b.hp / b.derived.maxHp < worst.hp / worst.derived.maxHp) {
            worst = b;
          }
        }
      }
      if (u.alive && worst) {
        u.heal(worst, worst.derived.maxHp * g.heal);
      }
    }
  }
}

const LINKS = new WeakMap<Sim, Links>();

/** The linked groups at work in a simulation. */
export function linksOf(sim: Sim): Links {
  let run = LINKS.get(sim);
  if (!run) {
    run = new Links(sim);
    LINKS.set(sim, run);
  }
  return run;
}
