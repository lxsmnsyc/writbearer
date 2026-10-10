import { SimEvents } from '../events';
import type Sim from '../sim';
import { ELEMENT_STATUS } from '../statuses';
import { DamageFlags, DamageKind, DamagePriority } from '../types';

// Magical hits build up more per point of damage. INT raises it further.
const MAGIC_BUILDUP = 1.5;

/**
 * Hits that land add buildup: their element's status, plus any the hit
 * carries itself. Damage over time adds none, so a burn cannot feed itself.
 */
export default function setupBuildupMechanics(sim: Sim): void {
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    const { source, target } = event;
    if (event.value <= 0 || !target.alive || event.flags & DamageFlags.DoT) {
      return;
    }
    const status = ELEMENT_STATUS[event.element];
    if (status) {
      const magical = event.kind === DamageKind.Magical;
      const scale = magical ? MAGIC_BUILDUP * (1 + source.base.int / 100) : 1;
      target.buildUp(status, source, event.value * scale);
    }
    for (const b of event.buildup) {
      target.buildUp(b.status, source, b.amount);
    }
  });
}
