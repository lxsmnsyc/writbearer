import { SimEvents, type UnitHealEvent } from './events';
import { type ActiveStatus, type StatusDef, buffsOf } from './status';
import { allowed } from './targeting';
import { HealPriority, Rank } from './types';
import type Unit from './unit';

// First numbers for afflictions. A starting point for balance, not final values.

// Each point of WIL shrinks a frightened unit's time by this share of the base.
const WIL_RESIST = 0.03;
// Curse: attack and magic attack lost, and share of healing received cut
const CURSE_WEAKEN = 25;
const CURSE_HEAL_CUT = 0.5;
const CURSE_BASE_THRESHOLD = 100;

/** Seconds an affliction lasts on a unit: `seconds` shrunk by its WIL. */
export function resistedTime(target: Unit, seconds: number): number {
  return seconds / (1 + target.base.wil * WIL_RESIST);
}

/**
 * Terror from a skill, such as a Berserker's Howl. The unit runs from the
 * source. It is given, not built up, so the skill chooses its length.
 */
export const FRIGHTENED: StatusDef = {
  id: 'frightened',
  name: 'Frightened',
  duration: 3,
  immunity: 0,
  flees: true,
  endsWithSource: false,
  setup: (s) => ({
    start: () => {
      s.unit.swing = -1;
      s.unit.cast = null;
    },
    stop: () => {
      // Nothing to undo: it returns to the fight.
    },
  }),
};

/**
 * Makes normal monsters run from `source` for about `seconds`, less with
 * WIL. Elites, bosses, the bearer, the dead and units that cannot take
 * Dread are skipped. Returns the statuses given.
 */
export function frighten(source: Unit, targets: Unit[], seconds: number): ActiveStatus[] {
  const out: ActiveStatus[] = [];
  for (const target of allowed(source, targets)) {
    if (
      !target.alive ||
      target === target.sim.bearer ||
      target.rank !== Rank.Normal ||
      (target.immunity.get('dread') ?? 0) > 0
    ) {
      continue;
    }
    // addStatus fires CheckStatusDuration, so immunity passives can refuse it.
    const status = target.addStatus(FRIGHTENED, source, resistedTime(target, seconds));
    if (status) {
      out.push(status);
    }
  }
  return out;
}

/**
 * Cursed by a Hexblade or a Medium: deals 25% less physical and magic
 * damage, and receives half the healing. Resisted by WIL.
 */
export const CURSED: StatusDef = {
  id: 'cursed',
  name: 'Cursed',
  duration: 8,
  immunity: 4,
  threshold: (u) => Math.round(CURSE_BASE_THRESHOLD * (1 + (u.base.wil * 3) / 100) + u.level * 2),
  modifiers: () => [
    { stat: 'atkMin', percent: -CURSE_WEAKEN },
    { stat: 'atkMax', percent: -CURSE_WEAKEN },
    { stat: 'matkMin', percent: -CURSE_WEAKEN },
    { stat: 'matkMax', percent: -CURSE_WEAKEN },
  ],
  setup: (s) => {
    const listener = (event: UnitHealEvent): void => {
      if (event.target === s.unit) {
        event.value *= 1 - CURSE_HEAL_CUT;
      }
    };
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
 * Curses a foe of `source`. By default `power` is buildup, so WIL decides
 * whether it takes hold. With `direct` the curse is given at once, for its
 * duration shrunk by WIL, and `power` is the status's power. Returns whether
 * the target is cursed afterwards.
 */
export function curse(source: Unit, target: Unit, power: number, direct = false): boolean {
  if (!target.alive || allowed(source, [target]).length === 0) {
    return false;
  }
  if (direct) {
    return target.addStatus(CURSED, source, resistedTime(target, CURSED.duration), power) !== null;
  }
  target.buildUp(CURSED, source, power);
  return target.statuses.has(CURSED.id);
}

/**
 * Removes up to `count` buffs from a unit (all by default), in the order
 * they were given, and returns what it took. Only statuses marked `buff` go.
 */
export function dispel(target: Unit, count = Infinity): ActiveStatus[] {
  const taken: ActiveStatus[] = [];
  for (const buff of buffsOf(target)) {
    if (taken.length >= count) {
      break;
    }
    target.removeStatus(buff.def.id);
    taken.push(buff);
  }
  return taken;
}
