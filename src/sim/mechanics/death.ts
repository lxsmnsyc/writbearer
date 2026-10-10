import { EventPriority } from '../../core/event-emitter';
import { SimEvents } from '../events';
import type Sim from '../sim';

export default function setupDeathMechanics(sim: Sim): void {
  sim.on(SimEvents.UnitDies, EventPriority.Pre, (event) => {
    if (!event.source.alive) {
      event.disabled = true;
    }
  });

  // The corpse stays. Its unit keeps its place until it is resurrected or removed.
  sim.on(SimEvents.UnitDies, EventPriority.Exact, (event) => {
    event.source.alive = false;
    event.source.ward = 0;
    event.source.cast = null;
    event.source.swing = -1;
    event.source.statuses.clear();
  });
}
