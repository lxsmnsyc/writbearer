import { EventPriority } from '../core/event-emitter';
import { SimEvents } from './events';
import type Sim from './sim';
import type { StatusDef } from './status';
import { removeStatus } from './unit/statuses';
import type Unit from './unit';

interface Hold {
  victim: Unit;
  // The area the hold began in: a hold never outlives it
  area: number;
}

const holds = new WeakMap<Unit, Hold>();
const captors = new WeakMap<Unit, Unit>();
const watched = new WeakSet<Sim>();

/** A victim in a captor's grip cannot act. It is lifted when the hold ends. */
export const HELD: StatusDef = {
  id: 'held',
  name: 'Held',
  duration: 1e9,
  immunity: 0,
  disables: true,
  // A hold that outlived its captor, or the area, lets go
  tick: (status) => {
    const captor = captors.get(status.unit);
    if (!captor || !captor.alive || holds.get(captor)?.area !== status.unit.sim.area) {
      if (captor) {
        release(captor);
      } else {
        removeStatus(status.unit, HELD.id);
      }
    }
  },
};

/** Whom a captor holds, if anyone. */
export function heldBy(captor: Unit): Unit | null {
  const hold = holds.get(captor);
  if (!hold) {
    return null;
  }
  if (hold.area !== captor.sim.area) {
    release(captor);
    return null;
  }
  return hold.victim;
}

/** Whether a unit is in someone's grip. */
export function isHeld(victim: Unit): boolean {
  return captors.has(victim);
}

/**
 * A captor lets go of whom it holds, where it stands. A kill, a stun, a
 * root or a fear on the captor calls this.
 */
export function release(captor: Unit): void {
  const hold = holds.get(captor);
  if (!hold) {
    return;
  }
  holds.delete(captor);
  captors.delete(hold.victim);
  removeStatus(hold.victim, HELD.id);
}

// Watches for what breaks a hold, once per sim
function watch(sim: Sim): void {
  if (watched.has(sim)) {
    return;
  }
  watched.add(sim);
  sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
    release(event.source);
    // A victim that dies is let go of too
    const captor = captors.get(event.source);
    if (captor) {
      release(captor);
    }
  });
  sim.on(SimEvents.StatusApplied, EventPriority.Post, (event) => {
    const def = event.status.def;
    if (def.id !== HELD.id && (def.disables || def.flees || def.slow === 0)) {
      release(event.status.unit);
    }
  });
}

/** The captor takes hold of the victim. Returns whether it did. */
export function grab(captor: Unit, victim: Unit): boolean {
  if (!captor.alive || !victim.alive || holds.has(captor) || captors.has(victim)) {
    return false;
  }
  watch(captor.sim);
  if (!victim.addStatus(HELD, captor)) {
    return false;
  }
  holds.set(captor, { victim, area: captor.sim.area });
  captors.set(victim, captor);
  return true;
}

/** Moves a held victim to its captor, so it goes where the captor goes. */
export function drag(captor: Unit): void {
  const victim = heldBy(captor);
  if (victim) {
    victim.x = captor.x;
    victim.z = captor.z;
  }
}
