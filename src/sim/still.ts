import { EventPriority } from '../core/event-emitter';
import { SimEvents } from './events';
import type Sim from './sim';
import type Unit from './unit';

// Where each unit was last tick, and since when it has stayed there
const SPOTS = new WeakMap<Unit, { x: number; z: number; since: number }>();
// How far a unit may drift between ticks and still count as standing
const EPSILON = 0.001;

/** How many seconds a living unit has stayed at its spot. Casting in place does not reset it. */
export function stillFor(unit: Unit): number {
  const spot = SPOTS.get(unit);
  if (!spot || !unit.alive) {
    return 0;
  }
  return Math.max(0, unit.sim.time - spot.since);
}

/** Watches every unit's position once per tick. A walk, a knockback or a dash moves it and resets the timer. */
export default function setupStill(sim: Sim): void {
  sim.on(SimEvents.Tick, EventPriority.Post, () => {
    for (const u of sim.living()) {
      const spot = SPOTS.get(u);
      if (!spot) {
        SPOTS.set(u, { x: u.x, z: u.z, since: sim.time });
      } else if (Math.hypot(u.x - spot.x, u.z - spot.z) > EPSILON) {
        spot.x = u.x;
        spot.z = u.z;
        spot.since = sim.time;
      }
    }
    // A dead unit forgets its spot, so it starts again if it rises
    for (const u of sim.units) {
      if (!u.alive) {
        SPOTS.delete(u);
      }
    }
  });
}
