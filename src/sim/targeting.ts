import { SimEvents } from './events';
import type Unit from './unit';

/**
 * Whether `source` may pick the hostile unit `target`. The built-in rule is
 * that the target is alive and one of the source's foes; listeners on
 * CheckTarget decide the rest. Only hostile choices ask: healing and buffing
 * an ally, and area damage, do not.
 */
export function canTarget(source: Unit, target: Unit): boolean {
  if (!target.alive || !source.sim.foes(source.side).includes(target)) {
    return false;
  }
  const check = {
    id: 'CheckTarget',
    disabled: false,
    source,
    target,
    allowed: true,
  };
  source.sim.emit(SimEvents.CheckTarget, check);
  return check.allowed;
}

/** The units `source` fights that it may pick as a target. */
export function hostiles(source: Unit): Unit[] {
  const out: Unit[] = [];
  for (const u of source.sim.foes(source.side)) {
    if (canTarget(source, u)) {
      out.push(u);
    }
  }
  return out;
}

/** Keeps the units of a list that `source` may pick as a target. */
export function allowed(source: Unit, units: Unit[]): Unit[] {
  const out: Unit[] = [];
  for (const u of units) {
    if (canTarget(source, u)) {
      out.push(u);
    }
  }
  return out;
}
