import type { Lifecycle } from '../core/lifecycle';
import { SimEvents, type UnitHealEvent } from './events';
import type { BaseStat } from './stats';
import type { ActiveStatus, StatusDef } from './status';
import { DamageFlags, DamageKind, Element, HealPriority } from './types';
import type Unit from './unit';

// First numbers for statuses. A starting point for balance, not final values.

// Buildup a unit needs before resistance. Each point of the resist stat adds 3%.
const BASE_THRESHOLD = 100;
const threshold =
  (stat: BaseStat) =>
  (u: Unit): number =>
    Math.round(BASE_THRESHOLD * (1 + (u.base[stat] * 3) / 100) + u.level * 2);

// Damage over time, as a share of the target's max health each second. It
// skips defense and comes from the status's source, so kills are credited.
function damageOverTime(share: number): (s: ActiveStatus, dt: number) => void {
  return (s, dt) => {
    const before = Math.floor(s.elapsed - dt);
    if (Math.floor(s.elapsed) > before && s.elapsed >= 1) {
      s.source.hit(s.unit, {
        kind: DamageKind.True,
        fixed: Math.max(1, Math.round(s.unit.derived.maxHp * share)),
        flags: DamageFlags.DoT,
      });
    }
  };
}

// Sets the unit's defense element while the status lasts, as rAthena's
// status_calc_element does for Freeze and Stone.
function becomes(element: Element): (s: ActiveStatus) => Lifecycle {
  return (s) => {
    const before = { element: s.unit.element, level: s.unit.elementLevel };
    return {
      start: () => {
        s.unit.element = element;
        s.unit.elementLevel = 1;
      },
      stop: () => {
        s.unit.element = before.element;
        s.unit.elementLevel = before.level;
      },
    };
  };
}

/** Must fight whoever taunted it. Given by skills, not built up. */
export const TAUNTED: StatusDef = {
  id: 'taunted',
  name: 'Taunted',
  duration: 4,
  immunity: 0,
  endsWithSource: true,
};

/** Armor broken by a Vanguard's Sunder. Stacks up to 5; each stack takes 4 armor per rank. */
export const SUNDERED: StatusDef = {
  id: 'sundered',
  name: 'Sundered',
  duration: 4,
  immunity: 0,
  maxStacks: 5,
  modifiers: (s) => [{ stat: 'armor', add: -4 * s.power * s.stacks }],
};

/** Held fast by a snare. Can still fight what comes into reach. */
export const ROOTED: StatusDef = {
  id: 'rooted',
  name: 'Rooted',
  duration: 2.5,
  immunity: 4,
  slow: 0,
};

/** Cannot act. Built up by heavy blows such as Shield Bash. Resisted by VIT. */
export const STUN: StatusDef = {
  id: 'stun',
  name: 'Stun',
  duration: 1.5,
  immunity: 3,
  threshold: threshold('vit'),
  disables: true,
};

/** Fire. Damage over time. */
export const BURN: StatusDef = {
  id: 'burn',
  name: 'Burn',
  duration: 4,
  immunity: 2,
  threshold: threshold('vit'),
  tick: damageOverTime(0.03),
};

/** Frost, the second time while chilled. Cannot act, and counts as Frost 1. */
export const FREEZE: StatusDef = {
  id: 'freeze',
  name: 'Freeze',
  duration: 2,
  immunity: 4,
  disables: true,
  setup: becomes(Element.Frost),
};

/** Frost. Slows the target. Built up again while it lasts, it becomes Freeze. */
export const CHILL: StatusDef = {
  id: 'chill',
  name: 'Chill',
  duration: 4,
  immunity: 0,
  threshold: threshold('vit'),
  slow: 0.6,
  escalate: FREEZE,
};

/** Storm. A very short stun. */
export const SHOCK: StatusDef = {
  id: 'shock',
  name: 'Shock',
  duration: 0.6,
  immunity: 2,
  threshold: threshold('dex'),
  disables: true,
};

/** Earth. Cannot act, and counts as Earth 1. */
export const PETRIFY: StatusDef = {
  id: 'petrify',
  name: 'Petrify',
  duration: 2.5,
  immunity: 5,
  threshold: threshold('wil'),
  disables: true,
  setup: becomes(Element.Earth),
};

// Healing a poisoned unit receives is cut by this share.
const POISON_HEAL_CUT = 0.5;

/** Venom. Damage over time that ignores armor, and less healing received. */
export const POISON: StatusDef = {
  id: 'poison',
  name: 'Poison',
  duration: 6,
  immunity: 2,
  threshold: threshold('vit'),
  tick: damageOverTime(0.02),
  setup: (s) => {
    const listener = (event: UnitHealEvent): void => {
      if (event.target === s.unit) {
        event.value *= 1 - POISON_HEAL_CUT;
      }
    };
    // Removed when the poison ends, so old statuses leave no listeners behind.
    return {
      start: () => {
        s.unit.sim.on(SimEvents.UnitHeal, HealPriority.Reduce, listener);
      },
      stop: () => {
        s.unit.sim.off(SimEvents.UnitHeal, HealPriority.Reduce, listener);
      },
    };
  },
};

/**
 * Occult. The whispers break the nerve: the unit drops its Ward and runs
 * from the source. The bearer is driven on by the Writ and never runs.
 */
export const DREAD: StatusDef = {
  id: 'dread',
  name: 'Dread',
  duration: 2.5,
  immunity: 5,
  threshold: (u) => (u === u.sim.bearer ? Infinity : threshold('wil')(u)),
  flees: true,
  setup: (s) => ({
    start: () => {
      s.unit.ward = 0;
      s.unit.swing = -1;
      s.unit.cast = null;
    },
    stop: () => {
      // Nothing to undo: the lost Ward does not come back.
    },
  }),
};

/** The status each element builds up. Radiant and Spectral have none yet. */
export const ELEMENT_STATUS: Partial<Record<Element, StatusDef>> = {
  [Element.Fire]: BURN,
  [Element.Frost]: CHILL,
  [Element.Storm]: SHOCK,
  [Element.Earth]: PETRIFY,
  [Element.Venom]: POISON,
  [Element.Occult]: DREAD,
};
