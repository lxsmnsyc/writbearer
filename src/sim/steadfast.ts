import { type CheckStatusDurationEvent, SimEvents } from './events';
import type Sim from './sim';
import { STUN } from './statuses';
import { ValuePriority } from './types';
import type Unit from './unit';

const STEADFAST = new WeakSet<Unit>();
const WATCHED = new WeakSet<Sim>();

/** Whether a unit is steadfast. */
export function isSteadfast(u: Unit): boolean {
  return STEADFAST.has(u);
}

/**
 * Makes a unit steadfast: no Stun, and no status that makes it flee (Dread).
 * Other disables and Sunder still work on it.
 */
export function makeSteadfast(u: Unit): void {
  STEADFAST.add(u);
  const sim = u.sim;
  if (WATCHED.has(sim)) {
    return;
  }
  WATCHED.add(sim);
  // One listener for every steadfast unit of the sim
  sim.on(SimEvents.CheckStatusDuration, ValuePriority.Pre, (event: CheckStatusDurationEvent) => {
    if (STEADFAST.has(event.target) && (event.status === STUN || event.status.flees)) {
      event.disabled = true;
    }
  });
}
