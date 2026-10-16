import type { Lifecycle } from '../core/lifecycle';
import { SimEvents, type UnitDamageEvent, type UnitHealEvent } from './events';
import type { BaseStat } from './stats';
import type { ActiveStatus, StatusDef } from './status';
import { DamageFlags, DamageKind, DamagePriority, Element, HealPriority, Race } from './types';
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

// Seconds a potion takes to work, and how often it ticks.
const POTION_TIME = 3;

// Restores a share of max health or mana over the status's duration. The
// share is the status's power.
// It restores in pulses, so small amounts are not lost to rounding.
const POTION_PULSE = 0.5;

function restore(kind: 'health' | 'mana'): (s: ActiveStatus, dt: number) => void {
  return (s, dt) => {
    if (Math.floor(s.elapsed / POTION_PULSE) === Math.floor((s.elapsed - dt) / POTION_PULSE)) {
      return;
    }
    const share = (s.power * POTION_PULSE) / POTION_TIME;
    if (kind === 'health') {
      s.unit.heal(s.unit, s.unit.derived.maxHp * share);
    } else {
      s.unit.mana = Math.min(s.unit.derived.maxMana, s.unit.mana + s.unit.derived.maxMana * share);
    }
  };
}

/** A healing draught at work. */
export const MENDING: StatusDef = {
  id: 'mending',
  name: 'Mending',
  duration: POTION_TIME,
  immunity: 0,
  tick: restore('health'),
};

/** A mana tincture at work. */
export const REFRESHING: StatusDef = {
  id: 'refreshing',
  name: 'Refreshing',
  duration: POTION_TIME,
  immunity: 0,
  tick: restore('mana'),
};

/** Healing over time from a Cleric's Renew. Its power is health per pulse. */
export const RENEWED: StatusDef = {
  id: 'renewed',
  name: 'Renewed',
  duration: 6,
  immunity: 0,
  tick: (s, dt) => {
    if (Math.floor(s.elapsed) !== Math.floor(s.elapsed - dt)) {
      s.source.heal(s.unit, s.power);
    }
  },
};

/**
 * Radiant. Holy fire that clings to the dead and the Occult: they take a
 * fifth more damage from the other side while it burns. Nothing else can
 * be seared.
 */
export const SEAR: StatusDef = {
  id: 'sear',
  name: 'Sear',
  duration: 4,
  immunity: 3,
  threshold: (u) =>
    u.race === Race.Undead || u.element === Element.Occult ? threshold('wil')(u) : Infinity,
  setup: (s) => {
    const listener = (event: UnitDamageEvent): void => {
      if (event.target === s.unit && event.source.side !== s.unit.side) {
        event.value *= 1.2;
      }
    };
    return {
      start: () => {
        s.unit.sim.on(SimEvents.UnitDamage, DamagePriority.Amplify, listener);
      },
      stop: () => {
        s.unit.sim.off(SimEvents.UnitDamage, DamagePriority.Amplify, listener);
      },
    };
  },
};

/**
 * Behind a raised shield, as the Vanguard's Shield Wall: every physical
 * blow from the front is stopped, and magic from the front halved. It
 * cannot move.
 */
export const SHIELD_WALL: StatusDef = {
  id: 'shieldWall',
  name: 'Shield Wall',
  duration: 3,
  immunity: 0,
  slow: 0,
  setup: (s) => {
    const listener = (event: UnitDamageEvent): void => {
      if (
        event.target !== s.unit ||
        event.kind === DamageKind.True ||
        event.flags & DamageFlags.Flank
      ) {
        return;
      }
      if (event.kind === DamageKind.Physical) {
        event.value = 0;
        event.flags |= DamageFlags.Blocked;
      } else {
        event.value *= 0.5;
      }
    };
    return {
      start: () => {
        s.unit.sim.on(SimEvents.UnitDamage, DamagePriority.Block, listener);
      },
      stop: () => {
        s.unit.sim.off(SimEvents.UnitDamage, DamagePriority.Block, listener);
      },
    };
  },
};

/** Slowed by spikes underfoot. Refreshed while it stands in them. */
export const SLOWED: StatusDef = {
  id: 'slowed',
  name: 'Slowed',
  duration: 1.2,
  immunity: 0,
  slow: 0.5,
};

/** Bleeding: a share of max health each second, 1% per point of power. */
export const BLEED: StatusDef = {
  id: 'bleed',
  name: 'Bleed',
  duration: 4,
  immunity: 0,
  tick: (s, dt) => {
    if (Math.floor(s.elapsed) > Math.floor(s.elapsed - dt) && s.elapsed >= 1) {
      s.source.hit(s.unit, {
        kind: DamageKind.True,
        fixed: Math.max(1, Math.round(s.unit.derived.maxHp * 0.01 * s.power)),
        flags: DamageFlags.DoT,
      });
    }
  },
};

/** The status each element builds up. Spectral has none yet. */
export const ELEMENT_STATUS: Partial<Record<Element, StatusDef>> = {
  [Element.Fire]: BURN,
  [Element.Frost]: CHILL,
  [Element.Storm]: SHOCK,
  [Element.Earth]: PETRIFY,
  [Element.Venom]: POISON,
  [Element.Occult]: DREAD,
  [Element.Radiant]: SEAR,
};
