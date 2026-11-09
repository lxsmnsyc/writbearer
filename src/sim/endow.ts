import type { StatusDef } from './status';
import type { Element } from './types';
import type Unit from './unit';

// Power is the element's number plus one, so a Neutral endow is not zero.
function elementOf(power: number): Element {
  return power - 1;
}

/**
 * Endowed: the unit's weapon takes an element for a while. Its basic attacks
 * and the skills that use the weapon element hit with it; skills that set
 * their own element keep it. `attackElement` is the weapon element, so the
 * AI's weakness pick (CheckAttackElements) sees the endow with no listener.
 * The old element comes back when the status ends.
 */
export const ENDOWED: StatusDef = {
  id: 'endowed',
  name: 'Endowed',
  duration: 10,
  immunity: 0,
  buff: true,
  setup: (s) => {
    let before: Element | null = null;
    return {
      start: () => {
        before = s.unit.attackElement;
        s.unit.attackElement = elementOf(s.power);
      },
      stop: () => {
        if (before !== null) {
          s.unit.attackElement = before;
          before = null;
        }
      },
    };
  },
};

/**
 * Sets the unit's weapon element for `seconds`. A second endow replaces the
 * first, element and time. A dead unit takes none. Returns whether it took.
 */
export function endow(unit: Unit, element: Element, seconds: number, source: Unit = unit): boolean {
  if (!unit.alive) {
    return false;
  }
  // Remove first: a refresh would keep the higher power, not the new element.
  unit.removeStatus(ENDOWED.id);
  return unit.addStatus(ENDOWED, source, seconds, element + 1) !== null;
}

/** The element the unit is endowed with, or null. */
export function endowment(unit: Unit): Element | null {
  const s = unit.statuses.get(ENDOWED.id);
  return s ? elementOf(s.power) : null;
}
