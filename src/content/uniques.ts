import type { Lifecycle } from '../core/lifecycle';
import {
  type CheckBuildupEvent,
  type CheckStatusDurationEvent,
  SimEvents,
  type UnitDamageEvent,
  type UnitHealEvent,
} from '../sim/events';
import type { Span } from '../sim/item';
import { Category, type Modifier } from '../sim/stats';
import { DREAD, ROOTED } from '../sim/statuses';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Element,
  HealPriority,
  Race,
  Range,
  ValuePriority,
} from '../sim/types';
import type Unit from '../sim/unit';

// Unique items, from the items design: named, on a fixed base, with a fixed
// list of bonuses each rolled in a range, and an effect or a cost beyond
// stats. They drop rarely.

export interface UniqueDef {
  id: string;
  name: string;
  // The base it is made on
  base: string;
  // Item level it can drop from
  level: number;
  sockets: number;
  // The ranges its values are rolled in
  rolls: readonly Span[];
  // What the rolled values give as stats
  modifiers: (values: number[]) => Modifier[];
  // Its tooltip lines, from the rolled values
  lines: (values: number[]) => string[];
  // What it does beyond stats while worn
  effect?: (values: number[]) => (unit: Unit) => Lifecycle;
  // What it does to its wearer's wage, as a multiplier
  wage?: number;
  // A line of lore
  lore: string;
}

// A listener on the sim for as long as the item is worn.
function worn(on: (unit: Unit) => void, off: (unit: Unit) => void): (unit: Unit) => Lifecycle {
  return (unit) => ({
    start: () => {
      on(unit);
    },
    stop: () => {
      off(unit);
    },
  });
}

const attack = (percent: number): Modifier[] => [
  { stat: 'atkMin', percent },
  { stat: 'atkMax', percent },
];

export const UNIQUES: readonly UniqueDef[] = [
  {
    id: 'debtorsChain',
    name: 'Debtor’s Chain',
    base: 'flangedMace',
    level: 3,
    sockets: 0,
    rolls: [{ min: 30, max: 50 }],
    modifiers: ([a]) => attack(a),
    lines: ([a]) => [`+${a}% attack`, 'Its wearer’s wage doubles'],
    wage: 2,
    lore: 'A Guild collector’s flail. The debt comes with it.',
  },
  {
    id: 'lastContract',
    name: 'The Last Contract',
    base: 'hauberk',
    level: 5,
    sockets: 1,
    rolls: [{ min: 20, max: 40 }],
    modifiers: ([a]) => [{ stat: 'armor', add: a }],
    lines: ([a]) => [
      `+${a} armor`,
      'When the bearer would die, its wearer takes the blow instead, and dies. Once an area.',
    ],
    effect: () => {
      let used = -1;
      const listeners = new Map<Unit, (event: UnitDamageEvent) => void>();
      return worn(
        (unit) => {
          const listener = (event: UnitDamageEvent): void => {
            const bearer = unit.sim.bearer;
            if (
              event.target !== bearer ||
              !unit.alive ||
              used === unit.sim.area ||
              event.value < bearer.hp
            ) {
              return;
            }
            used = unit.sim.area;
            event.value = 0;
            // The body is whole: it can be raised.
            unit.lastBlow = null;
            unit.hp = 0;
            unit.die(event.source);
          };
          listeners.set(unit, listener);
          unit.sim.on(SimEvents.UnitDamage, DamagePriority.Pre, listener);
        },
        (unit) => {
          const listener = listeners.get(unit);
          if (listener) {
            unit.sim.off(SimEvents.UnitDamage, DamagePriority.Pre, listener);
          }
        },
      );
    },
    lore: 'Signed in a hand that is not the merc’s own.',
  },
  {
    id: 'widowsLantern',
    name: 'Widow’s Lantern',
    base: 'amulet',
    level: 1,
    sockets: 0,
    rolls: [
      { min: 10, max: 20 },
      { min: 2, max: 4 },
    ],
    modifiers: ([res, wil]) => [
      { reduce: Category.AttackElement, key: Element.Occult, percent: res },
      { base: 'wil', add: wil },
    ],
    lines: ([res, wil]) => [`-${res}% Occult damage taken`, `+${wil} WIL`],
    lore: 'A charm against the whispers, from a bearer who did not come back.',
  },
  {
    id: 'penitentsLash',
    name: 'Penitent’s Lash',
    base: 'stiletto',
    level: 3,
    sockets: 0,
    rolls: [{ min: 25, max: 40 }],
    modifiers: ([a]) => attack(a),
    lines: ([a]) => [`+${a}% attack`, 'Each blow it lands costs its wielder 3% of max health'],
    effect: () => {
      const listeners = new Map<Unit, (event: UnitDamageEvent) => void>();
      return worn(
        (unit) => {
          const listener = (event: UnitDamageEvent): void => {
            if (event.source === unit && event.flags & DamageFlags.BasicAttack && unit.alive) {
              unit.hp = Math.max(1, unit.hp - unit.derived.maxHp * 0.03);
            }
          };
          listeners.set(unit, listener);
          unit.sim.on(SimEvents.UnitDamage, DamagePriority.Post, listener);
        },
        (unit) => {
          const listener = listeners.get(unit);
          if (listener) {
            unit.sim.off(SimEvents.UnitDamage, DamagePriority.Post, listener);
          }
        },
      );
    },
    lore: 'The Penitents scourge themselves before the seal. This one learned to scourge others.',
  },
  {
    id: 'gravewarden',
    name: 'Gravewarden’s Bulwark',
    base: 'towerShield',
    level: 5,
    sockets: 1,
    rolls: [
      { min: 8, max: 12 },
      { min: 20, max: 30 },
    ],
    modifiers: ([block, res]) => [
      { stat: 'blockChance', add: block },
      { reduce: Category.Race, key: Race.Undead, percent: res },
    ],
    lines: ([block, res]) => [`+${block}% block`, `-${res}% damage from the Undead`],
    lore: 'Carried by the Old King’s guard, before they became what they guard against.',
  },
  {
    id: 'saintsReliquary',
    name: 'Saint’s Reliquary',
    base: 'censer',
    level: 4,
    sockets: 0,
    rolls: [{ min: 25, max: 40 }],
    modifiers: () => [],
    lines: ([a]) => [`Its wielder’s heals restore ${a}% more`],
    effect: ([a]) => {
      const listeners = new Map<Unit, (event: UnitHealEvent) => void>();
      return worn(
        (unit) => {
          const listener = (event: UnitHealEvent): void => {
            if (event.source === unit) {
              event.value *= 1 + a / 100;
            }
          };
          listeners.set(unit, listener);
          unit.sim.on(SimEvents.UnitHeal, HealPriority.Amplify, listener);
        },
        (unit) => {
          const listener = listeners.get(unit);
          if (listener) {
            unit.sim.off(SimEvents.UnitHeal, HealPriority.Amplify, listener);
          }
        },
      );
    },
    lore: 'A finger bone of the old faith, from before the Church went under.',
  },
  {
    id: 'mireTreads',
    name: 'Mire Treads',
    base: 'boots',
    level: 2,
    sockets: 0,
    rolls: [{ min: 3, max: 5 }],
    modifiers: ([agi]) => [{ base: 'agi', add: agi }],
    lines: ([agi]) => [`+${agi} AGI`, 'Cannot be rooted'],
    effect: () => {
      const listeners = new Map<Unit, (event: CheckStatusDurationEvent) => void>();
      return worn(
        (unit) => {
          const listener = (event: CheckStatusDurationEvent): void => {
            if (event.target === unit && event.status === ROOTED) {
              event.disabled = true;
            }
          };
          listeners.set(unit, listener);
          unit.sim.on(SimEvents.CheckStatusDuration, ValuePriority.Pre, listener);
        },
        (unit) => {
          const listener = listeners.get(unit);
          if (listener) {
            unit.sim.off(SimEvents.CheckStatusDuration, ValuePriority.Pre, listener);
          }
        },
      );
    },
    lore: 'Waxed against the Undercroft’s water, by someone who walked out of it.',
  },
  {
    id: 'thornhide',
    name: 'Thornhide',
    base: 'jerkin',
    level: 4,
    sockets: 0,
    rolls: [{ min: 20, max: 30 }],
    modifiers: () => [],
    lines: ([a]) => [`Melee attackers take ${a}% of their blow back`],
    effect: ([a]) => {
      const listeners = new Map<Unit, (event: UnitDamageEvent) => void>();
      return worn(
        (unit) => {
          const listener = (event: UnitDamageEvent): void => {
            const { source } = event;
            if (
              event.target === unit &&
              source.alive &&
              source.side !== unit.side &&
              event.range === Range.Melee &&
              !(event.flags & DamageFlags.Redirected) &&
              event.value > 0
            ) {
              unit.hit(source, {
                kind: DamageKind.True,
                fixed: Math.max(1, Math.round((event.value * a) / 100)),
                flags: DamageFlags.Redirected,
              });
            }
          };
          listeners.set(unit, listener);
          unit.sim.on(SimEvents.UnitDamage, DamagePriority.Post, listener);
        },
        (unit) => {
          const listener = listeners.get(unit);
          if (listener) {
            unit.sim.off(SimEvents.UnitDamage, DamagePriority.Post, listener);
          }
        },
      );
    },
    lore: 'Crawler hide, cured with its spines still in.',
  },
  {
    id: 'hollowCrown',
    name: 'The Hollow Crown',
    base: 'kettleHelm',
    level: 6,
    sockets: 0,
    rolls: [{ min: 15, max: 25 }],
    modifiers: ([a]) => attack(a),
    lines: ([a]) => [`+${a}% attack`, 'Dread builds up twice as fast'],
    effect: () => {
      const listeners = new Map<Unit, (event: CheckBuildupEvent) => void>();
      return worn(
        (unit) => {
          const listener = (event: CheckBuildupEvent): void => {
            if (event.target === unit && event.status === DREAD) {
              event.value *= 2;
            }
          };
          listeners.set(unit, listener);
          unit.sim.on(SimEvents.CheckBuildup, ValuePriority.Multiplicative, listener);
        },
        (unit) => {
          const listener = listeners.get(unit);
          if (listener) {
            unit.sim.off(SimEvents.CheckBuildup, ValuePriority.Multiplicative, listener);
          }
        },
      );
    },
    lore: 'Not the Old King’s. A copy, worn by one of the Hollowed who thought it was.',
  },
];

export const UNIQUE_BY_ID: ReadonlyMap<string, UniqueDef> = new Map(UNIQUES.map((u) => [u.id, u]));

/** What a unit's worn uniques do to its wage, as a multiplier. */
export function wageFactor(items: Iterable<{ unique?: string }>): number {
  let k = 1;
  for (const item of items) {
    k *= (item.unique === undefined ? undefined : UNIQUE_BY_ID.get(item.unique)?.wage) ?? 1;
  }
  return k;
}
