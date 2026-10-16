import { SimEvents } from '../events';
import type Sim from '../sim';
import { DREAD } from '../statuses';
import { DamageFlags, DamageKind, DamagePriority, Range, ValuePriority } from '../types';
import { zonesAt } from '../zone';

/**
 * What zones on the ground do to hits and buildup: a Pneuma or Safety Wall
 * stops hits on its side, a banner steadies nerves against dread.
 */
export default function setupZoneMechanics(sim: Sim): void {
  sim.on(SimEvents.UnitDamage, DamagePriority.Barrier, (event) => {
    if (event.kind === DamageKind.True || event.flags & DamageFlags.Redirected) {
      return;
    }
    const { target } = event;
    const range = event.range === Range.Ranged ? 'ranged' : 'melee';
    // A Pneuma stops only physical arrows and bolts; a Safety Wall any blow.
    if (range === 'ranged' && event.kind !== DamageKind.Physical) {
      return;
    }
    const guard = zonesAt(sim, target, target.side).find(
      (z) => z.guards === range && z.charges !== 0,
    );
    if (guard) {
      event.value = 0;
      event.flags |= DamageFlags.Blocked;
      if (guard.charges !== undefined) {
        guard.charges--;
      }
    }
  });

  sim.on(SimEvents.CheckBuildup, ValuePriority.Multiplicative, (event) => {
    if (event.status !== DREAD) {
      return;
    }
    for (const z of zonesAt(sim, event.target, event.target.side)) {
      if (z.calm !== undefined) {
        event.value *= z.calm;
      }
    }
  });
}
