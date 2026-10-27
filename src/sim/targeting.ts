import { SimEvents } from './events';
import type Unit from './unit';

// Whether the target is a living foe of the source: the built-in rule.
function isFoe(source: Unit, target: Unit): boolean {
  return target.alive && source.sim.foes(source.side).includes(target);
}

function ask(source: Unit, target: Unit): boolean {
  const check = { id: 'CheckTarget', disabled: false, source, target, allowed: true };
  source.sim.emit(SimEvents.CheckTarget, check);
  return check.allowed;
}

/**
 * Whether `source` may pick the hostile unit `target`. The built-in rule is
 * that the target is alive and one of the source's foes; listeners on
 * CheckTarget decide the rest. Only hostile choices ask: healing and buffing
 * an ally, and area damage, do not.
 */
export function canTarget(source: Unit, target: Unit): boolean {
  return isFoe(source, target) && ask(source, target);
}

/**
 * Whether a listener forbids `target`, a foe of `source`. Allies, the dead
 * and units that are not foes are never forbidden, so this is for checks at
 * release and for dropping a target that already exists.
 */
export function forbids(source: Unit, target: Unit): boolean {
  return isFoe(source, target) && !ask(source, target);
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
