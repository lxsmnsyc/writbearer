import { SimEvents } from './events';
import type Sim from './sim';
import { DamagePriority, ValuePriority } from './types';
import type Unit from './unit';

/**
 * Hidden and disguised units. A hidden unit cannot be targeted by the other
 * side, and so is never noticed. A disguised unit is drawn and listed as
 * another kind. `reveal` ends both, runs the unit's own `onReveal` and tells
 * the sim.
 */
export function reveal(u: Unit, by: Unit | null): void {
  if (!u.hidden && u.disguise === null) {
    return;
  }
  u.hidden = false;
  u.disguise = null;
  u.onReveal?.(by);
  u.sim.emit(SimEvents.UnitRevealed, { id: 'UnitRevealed', disabled: false, source: u, by });
}

export default function setupConcealment(sim: Sim): void {
  // Nothing may pick a hidden unit.
  sim.on(SimEvents.CheckTarget, ValuePriority.Post, (event) => {
    if (event.target.hidden) {
      event.allowed = false;
    }
  });

  // Area damage finds a hidden unit, and a blow or a spell from a hidden one
  // gives it away.
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    reveal(event.target, event.source);
    reveal(event.source, event.target);
  });
}
