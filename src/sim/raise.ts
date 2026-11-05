import { canRaise, corpsesNear } from './corpse';
import type Sim from './sim';
import { Side } from './types';
import type Unit from './unit';

/** A raised unit stands at this share of its maximum health by default. */
export const RAISE_SHARE = 0.4;
/** A raised unit is this many levels below the body it came from. */
export const RAISE_LEVELS_LOST = 2;

/** How to make the undead a body becomes. */
export interface RaiseOptions {
  // Makes the new monster at a place, added to the sim
  make: (sim: Sim, level: number, x: number, z: number) => Unit;
  // Share of the new unit's max health it stands with
  share?: number;
  // Its level; by default the body's, less RAISE_LEVELS_LOST
  level?: number;
}

// Each raised unit, and who raised it. Never saved.
const RAISED = new WeakMap<Unit, Unit>();
// What each raiser has raised
const BROOD = new WeakMap<Unit, Set<Unit>>();

/** Whether a unit stood up from a body. Its own body cannot be raised again. */
export function wasRaised(unit: Unit): boolean {
  return RAISED.has(unit);
}

/** The units a raiser raised that are still alive. */
export function raisedBy(raiser: Unit): Unit[] {
  const out: Unit[] = [];
  for (const unit of BROOD.get(raiser) ?? []) {
    if (unit.alive && unit.sim.units.has(unit)) {
      out.push(unit);
    }
  }
  return out;
}

/** Whether a monster-side body may be raised: the corpse rules, and not itself raised. */
export function raisable(corpse: Unit): boolean {
  return corpse.side === Side.Monster && canRaise(corpse) && !RAISED.has(corpse);
}

/** Raisable monster bodies within `reach` of a point, nearest first. */
export function raisableNear(sim: Sim, at: { x: number; z: number }, reach: number): Unit[] {
  const found: Unit[] = [];
  for (const corpse of corpsesNear(sim, Side.Monster, at, reach)) {
    if (raisable(corpse)) {
      found.push(corpse);
    }
  }
  found.sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
  return found;
}

/**
 * Stands a body up as a new monster on the raiser's side. The body is taken
 * out of the sim without a death: it fires no event and pays nothing, and it
 * can neither be raised nor revived again. Returns the new unit, or null when
 * the body cannot be raised.
 */
export function raise(raiser: Unit, corpse: Unit, options: RaiseOptions): Unit | null {
  if (!raisable(corpse)) {
    return null;
  }
  const sim = raiser.sim;
  sim.units.delete(corpse);
  const level = Math.max(1, options.level ?? corpse.level - RAISE_LEVELS_LOST);
  const unit = options.make(sim, level, corpse.x, corpse.z);
  unit.side = raiser.side;
  unit.aware = true;
  // A Hunt waits for what its quarry raises
  unit.marked = raiser.marked;
  unit.hp = Math.max(1, unit.derived.maxHp * (options.share ?? RAISE_SHARE));
  RAISED.set(unit, raiser);
  let brood = BROOD.get(raiser);
  if (!brood) {
    brood = new Set();
    BROOD.set(raiser, brood);
  }
  brood.add(unit);
  return unit;
}
