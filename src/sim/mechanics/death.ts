import { EventPriority } from '../../core/event-emitter';
import { SimEvents } from '../events';
import type Sim from '../sim';
import { DamageFlags } from '../types';

const TEAR_SHARE = 0.3;

export default function setupDeathMechanics(sim: Sim): void {
  sim.on(SimEvents.UnitDies, EventPriority.Pre, (event) => {
    if (!event.source.alive) {
      event.disabled = true;
    }
  });

  // The corpse stays. Its unit keeps its place until it is resurrected or
  // removed. A killing blow of 30% of max health or more, or a critical one,
  // tears the body apart instead, and nothing is left to raise.
  sim.on(SimEvents.UnitDies, EventPriority.Exact, (event) => {
    const u = event.source;
    const blow = u.lastBlow;
    u.torn =
      blow !== null &&
      (blow.value >= u.derived.maxHp * TEAR_SHARE || (blow.flags & DamageFlags.Critical) !== 0);
    event.source.alive = false;
    event.source.ward = 0;
    event.source.cast = null;
    event.source.swing = -1;
    event.source.clearStatuses();
  });
}
