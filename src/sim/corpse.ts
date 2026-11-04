import type { Lifecycle } from '../core/lifecycle';
import { SimEvents } from './events';
import type Sim from './sim';
import type { Side } from './types';
import type Unit from './unit';

// Units laid to rest. Kept here, not on the unit.
const RESTED = new WeakSet<Unit>();
// Guards that forbid raising, per sim.
const GUARDS = new WeakMap<Sim, Set<(unit: Unit) => boolean>>();

/**
 * A body: dead and still in the sim. A unit that left without dying (a
 * bribed one is removed from the sim) or the bearer at the reveal is not.
 */
export function isCorpse(unit: Unit): boolean {
  return !unit.alive && unit.sim.units.has(unit);
}

export function isRested(unit: Unit): boolean {
  return RESTED.has(unit);
}

function isGuarded(unit: Unit): boolean {
  for (const guard of GUARDS.get(unit.sim) ?? []) {
    if (guard(unit)) {
      return true;
    }
  }
  return false;
}

/** Whether this body can still be raised: a corpse, not torn, not rested, not guarded. */
export function canRaise(unit: Unit): boolean {
  return isCorpse(unit) && !unit.torn && !RESTED.has(unit) && !isGuarded(unit);
}

/**
 * A guard: while started, a body for which `guard` returns true cannot be
 * raised. `stop()` removes it and raising works again.
 */
export function addRestGuard(sim: Sim, guard: (unit: Unit) => boolean): Lifecycle {
  return {
    start() {
      let guards = GUARDS.get(sim);
      if (!guards) {
        guards = new Set();
        GUARDS.set(sim, guards);
      }
      guards.add(guard);
    },
    stop() {
      GUARDS.get(sim)?.delete(guard);
    },
  };
}

/** Marks a body as rested without the event, for a loaded save. */
export function markRested(unit: Unit): void {
  RESTED.add(unit);
}

/** Lays a corpse to rest. Returns whether it did; a rested body or a non-corpse is left alone. */
export function layToRest(unit: Unit, by: Unit | null = null): boolean {
  if (!isCorpse(unit) || RESTED.has(unit)) {
    return false;
  }
  RESTED.add(unit);
  unit.sim.emit(SimEvents.UnitLaidToRest, {
    id: 'UnitLaidToRest',
    disabled: false,
    source: unit,
    by,
  });
  return true;
}

/** Corpses of one side within `radius` tiles of a point, raisable or not. */
export function corpsesNear(
  sim: Sim,
  side: Side,
  at: { x: number; z: number },
  radius: number,
): Unit[] {
  const found: Unit[] = [];
  for (const unit of sim.units) {
    if (
      unit.side === side &&
      isCorpse(unit) &&
      Math.hypot(unit.x - at.x, unit.z - at.z) <= radius
    ) {
      found.push(unit);
    }
  }
  return found;
}
