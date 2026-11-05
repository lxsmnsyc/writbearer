import { SimEvents } from './events';
import type Sim from './sim';
import { BLEED } from './statuses';
import { DamageFlags, DamagePriority, Side } from './types';
import type Unit from './unit';

/** How a berserker fights: `most` is the extra damage share at its worst. */
export interface BerserkSpec {
  // Extra outgoing damage at 10% health (first guess 0.6 for +60%)
  most: number;
  // Power of the Bleed each landed basic attack adds
  bleed: number;
}

// Missing health share at which the bonus is at `most`
const WORST = 0.9;

const BERSERKERS = new WeakMap<Unit, BerserkSpec>();
const WATCHED = new WeakSet<Sim>();

/** The extra damage share a berserker has now: 0 at full health, `most` at 10%. */
export function rage(u: Unit): number {
  const spec = BERSERKERS.get(u);
  if (!spec) {
    return 0;
  }
  const missing = 1 - u.hp / u.derived.maxHp;
  return spec.most * Math.min(1, Math.max(0, missing / WORST));
}

/** Whether a unit is a berserker. */
export function isBerserker(u: Unit): boolean {
  return BERSERKERS.has(u);
}

/**
 * Makes a unit a berserker: it hits harder the more it is hurt, and each
 * basic attack that lands on the party adds Bleed.
 */
export function markBerserker(u: Unit, spec: BerserkSpec): void {
  BERSERKERS.set(u, spec);
  const sim = u.sim;
  if (WATCHED.has(sim)) {
    return;
  }
  WATCHED.add(sim);
  // The bonus, before the exact steps
  sim.on(SimEvents.UnitDamage, DamagePriority.Pre, (event) => {
    if (BERSERKERS.has(event.source) && event.source.side !== event.target.side) {
      event.value *= 1 + rage(event.source);
    }
  });
  // The bleed, once the blow has landed
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    const s = BERSERKERS.get(event.source);
    if (
      s &&
      event.value > 0 &&
      (event.flags & DamageFlags.BasicAttack) !== 0 &&
      event.target.side === Side.Party &&
      event.target.alive
    ) {
      event.target.addStatus(BLEED, event.source, BLEED.duration, s.bleed);
    }
  });
}
