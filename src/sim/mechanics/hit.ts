import { SimEvents } from '../events';
import type Sim from '../sim';
import { ValuePriority } from '../types';

const MIN_HIT = 5;
const MAX_HIT = 95;

/**
 * The hit check for physical hits, from rAthena: hit chance is
 * 80 + accuracy - evasion, held between 5% and 95%. A critical skips it.
 */
export default function setupHitMechanics(sim: Sim): void {
  sim.on(SimEvents.CheckHit, ValuePriority.Initial, (event) => {
    event.critRate = event.source.derived.crit;
    event.hitChance = 80 + event.source.derived.accuracy - event.target.derived.evasion;
  });

  sim.on(SimEvents.CheckHit, ValuePriority.Exact, (event) => {
    const chance = Math.max(MIN_HIT, Math.min(MAX_HIT, event.hitChance));
    event.critical = sim.rng.random() * 100 < event.critRate;
    event.hit = event.critical || sim.rng.random() * 100 < chance;
  });
}
