import { SimEvents } from '../events';
import type Sim from '../sim';
import { HealPriority } from '../types';

export default function setupHealMechanics(sim: Sim): void {
  // The dead cannot be healed. Resurrection is its own effect.
  sim.on(SimEvents.UnitHeal, HealPriority.Pre, (event) => {
    if (!event.target.alive) {
      event.disabled = true;
    }
  });

  sim.on(SimEvents.UnitHeal, HealPriority.Exact, (event) => {
    const { target } = event;
    const value = Math.max(0, Math.min(Math.floor(event.value), target.derived.maxHp - target.hp));
    target.hp += value;
    event.value = value;
  });
}
