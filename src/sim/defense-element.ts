import type { Lifecycle } from '../core/lifecycle';
import type { Modifier } from './stats';
import type { ActiveStatus, StatusDef } from './status';
import type { Element } from './types';
import type Unit from './unit';

/** Who set a defense element. A higher source wins: a status over a skill over an item. */
export enum DefensePriority {
  Item = 0,
  Skill = 1,
  Status = 2,
}

interface Override {
  key: string;
  element: Element;
  level: number;
  priority: DefensePriority;
}

interface Layers {
  // The element the unit had before any override
  base: { element: Element; level: number };
  overrides: Override[];
}

// Derived state, never saved: a loaded unit starts with no overrides.
const layers = new WeakMap<Unit, Layers>();

// Writes the winning override, or the base when none is left
function apply(unit: Unit, state: Layers): void {
  let top: Override | undefined;
  for (const o of state.overrides) {
    // On a tie the later one wins
    if (!top || o.priority >= top.priority) {
      top = o;
    }
  }
  const pick = top ?? state.base;
  unit.element = pick.element;
  unit.elementLevel = pick.level;
  if (!top) {
    layers.delete(unit);
  }
}

/** Sets or replaces the override under `key`, then recomputes the unit's element. */
export function setDefenseElement(
  unit: Unit,
  key: string,
  element: Element,
  level: number,
  priority: DefensePriority,
): void {
  let state = layers.get(unit);
  if (!state) {
    state = { base: { element: unit.element, level: unit.elementLevel }, overrides: [] };
    layers.set(unit, state);
  }
  const next: Override = { key, element, level, priority };
  const at = state.overrides.findIndex((o) => o.key === key);
  if (at >= 0) {
    state.overrides[at] = next;
  } else {
    state.overrides.push(next);
  }
  apply(unit, state);
}

/** Removes the override under `key`. Does nothing when there is none. */
export function clearDefenseElement(unit: Unit, key: string): void {
  const state = layers.get(unit);
  if (!state) {
    return;
  }
  state.overrides = state.overrides.filter((o) => o.key !== key);
  apply(unit, state);
}

/** A lifecycle that holds a defense override while it is active. */
export function holdDefenseElement(
  unit: Unit,
  key: string,
  element: Element,
  level: number,
  priority: DefensePriority,
): Lifecycle {
  return {
    start: () => {
      setDefenseElement(unit, key, element, level, priority);
    },
    stop: () => {
      clearDefenseElement(unit, key);
    },
  };
}

/** The setup of a status that makes its unit this element while it lasts. */
export function statusElement(element: Element, level = 1): (s: ActiveStatus) => Lifecycle {
  return (s) =>
    holdDefenseElement(s.unit, `status:${s.def.id}`, element, level, DefensePriority.Status);
}

/** A timed status for skills: the unit counts as this element (the Benedictio effect). */
export function defenseShift(element: Element, level: number, duration = 10): StatusDef {
  return {
    id: `defense-shift-${element}-${level}`,
    name: 'Defense Shift',
    duration,
    immunity: 0,
    buff: true,
    setup: (s) =>
      holdDefenseElement(s.unit, `skill:${s.def.id}`, element, level, DefensePriority.Skill),
  };
}

const ITEM_KEY = 'item';

/** Called by `recalc`: applies the strongest `{ defense, level }` modifier as an item override. */
export function syncItemDefense(unit: Unit, modifiers: readonly Modifier[]): void {
  let best: { element: Element; level: number } | undefined;
  for (const m of modifiers) {
    if ('defense' in m && (!best || m.level > best.level)) {
      best = { element: m.defense, level: m.level };
    }
  }
  if (best) {
    setDefenseElement(unit, ITEM_KEY, best.element, best.level, DefensePriority.Item);
  } else {
    clearDefenseElement(unit, ITEM_KEY);
  }
}
