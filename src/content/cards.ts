import type { Lifecycle } from '../core/lifecycle';
import { type CheckBuildupEvent, SimEvents, type UnitDamageEvent } from '../sim/events';
import { type ItemBase, ItemType, type Socketable } from '../sim/item';
import { Category } from '../sim/stats';
import type { StatusDef } from '../sim/status';
import { DREAD, POISON } from '../sim/statuses';
import { DamageFlags, DamagePriority, Element, Race, ValuePriority } from '../sim/types';
import type Unit from '../sim/unit';
import type { MonsterKind } from './roster';

// Monster cards and gems, from the items design. Each monster kind drops
// its card; bosses drop trade-off cards. A card or gem goes into a free
// socket for good.

// Adds buildup of a status to whatever the wearer's basic attacks hit.
function buildupOnHit(status: StatusDef, amount: number): (unit: Unit) => Lifecycle {
  return (unit) => {
    const listener = (event: UnitDamageEvent): void => {
      if (event.source === unit && event.flags & DamageFlags.BasicAttack && event.target.alive) {
        event.target.buildUp(status, unit, amount);
      }
    };
    return {
      start: () => {
        unit.sim.on(SimEvents.UnitDamage, DamagePriority.Post, listener);
      },
      stop: () => {
        unit.sim.off(SimEvents.UnitDamage, DamagePriority.Post, listener);
      },
    };
  };
}

// Dread builds up in the wearer at half the rate.
function steadyNerve(unit: Unit): Lifecycle {
  const listener = (event: CheckBuildupEvent): void => {
    if (event.target === unit && event.status === DREAD) {
      event.value *= 0.5;
    }
  };
  return {
    start: () => {
      unit.sim.on(SimEvents.CheckBuildup, ValuePriority.Multiplicative, listener);
    },
    stop: () => {
      unit.sim.off(SimEvents.CheckBuildup, ValuePriority.Multiplicative, listener);
    },
  };
}

const WEAPON = [ItemType.Weapon];
const SHIELD = [ItemType.Shield];
const HEAD = [ItemType.Head];
const BODY = [ItemType.Body];
const ACCESSORY = [ItemType.Accessory];

const card = (monster: MonsterKind, name: string, level: number, socket: Socketable): ItemBase => ({
  id: `${monster}Card`,
  name: `${name} Card`,
  type: ItemType.Card,
  level,
  weight: 1,
  maxSockets: 0,
  socket,
});

/** Each monster kind's card, by the kind that drops it. */
// The Creditor drops nothing: the run ends with it.
export const CARD_BY_MONSTER: Record<Exclude<MonsterKind, 'creditor'>, ItemBase> = {
  mite: card('mite', 'Mite', 1, {
    fits: ACCESSORY,
    describe: '+3 AGI.',
    modifiers: [{ base: 'agi', add: 3 }],
  }),
  husk: card('husk', 'Husk', 1, {
    fits: BODY,
    describe: '+10% max health.',
    modifiers: [{ stat: 'maxHp', percent: 10 }],
  }),
  crawler: card('crawler', 'Crawler', 1, {
    fits: WEAPON,
    describe: 'Attacks add 15 Poison buildup.',
    modifiers: [],
    setup: buildupOnHit(POISON, 15),
  }),
  hollowSoldier: card('hollowSoldier', 'Hollow Soldier', 1, {
    fits: SHIELD,
    describe: '+15% armor.',
    modifiers: [{ stat: 'armor', percent: 15 }],
  }),
  hornBearer: card('hornBearer', 'Horn-Bearer', 1, {
    fits: SHIELD,
    describe: '+15 evasion.',
    modifiers: [{ stat: 'evasion', add: 15 }],
  }),
  hornPost: card('hornPost', 'Horn Post', 1, {
    fits: SHIELD,
    describe: '+10 resistance.',
    modifiers: [{ stat: 'resistance', add: 10 }],
  }),
  penitent: card('penitent', 'Penitent', 1, {
    fits: WEAPON,
    describe: '+20% damage to Humans.',
    modifiers: [{ amplify: Category.Race, key: Race.Human, percent: 20 }],
  }),
  cantor: card('cantor', 'Cantor', 1, {
    fits: ACCESSORY,
    describe: '+4 INT. +10% max mana.',
    modifiers: [
      { base: 'int', add: 4 },
      { stat: 'maxMana', percent: 10 },
    ],
  }),
  hollowed: card('hollowed', 'Hollowed', 1, {
    fits: HEAD,
    describe: 'Dread builds up at half the rate.',
    modifiers: [],
    setup: steadyNerve,
  }),
  // Boss cards trade something away.
  broodMother: card('broodMother', 'Brood Mother', 1, {
    fits: BODY,
    describe: '+25% max health. -10% attack.',
    modifiers: [
      { stat: 'maxHp', percent: 25 },
      { stat: 'atkMin', percent: -10 },
      { stat: 'atkMax', percent: -10 },
    ],
  }),
  gatekeeper: card('gatekeeper', 'Gatekeeper', 1, {
    fits: SHIELD,
    describe: '+40% armor. -15 evasion.',
    modifiers: [
      { stat: 'armor', percent: 40 },
      { stat: 'evasion', add: -15 },
    ],
  }),
  abbess: card('abbess', 'Abbess', 1, {
    fits: ACCESSORY,
    describe: '+25% damage to the Undead. -15% max mana.',
    modifiers: [
      { amplify: Category.Race, key: Race.Undead, percent: 25 },
      { stat: 'maxMana', percent: -15 },
    ],
  }),
  hollowedSaint: card('hollowedSaint', 'Hollowed Saint', 1, {
    fits: WEAPON,
    describe: 'Attacks add 25 Dread buildup. Takes 15% more Occult damage.',
    modifiers: [{ reduce: Category.AttackElement, key: Element.Occult, percent: -15 }],
    setup: buildupOnHit(DREAD, 25),
  }),
};

const gem = (
  id: string,
  name: string,
  describe: string,
  socket: Socketable['modifiers'],
): ItemBase => ({
  id,
  name,
  type: ItemType.Card,
  level: 1,
  weight: 1,
  maxSockets: 0,
  socket: { fits: 'any', describe, modifiers: socket },
});

/** Plain gems with a stat each. They fit any socket. */
export const GEMS: readonly ItemBase[] = [
  gem('garnet', 'Garnet', '+2 STR.', [{ base: 'str', add: 2 }]),
  gem('topaz', 'Topaz', '+2 DEX.', [{ base: 'dex', add: 2 }]),
  gem('onyx', 'Onyx', '+2 VIT.', [{ base: 'vit', add: 2 }]),
  gem('opal', 'Opal', '+2 INT.', [{ base: 'int', add: 2 }]),
];

export const CARDS: readonly ItemBase[] = [...Object.values(CARD_BY_MONSTER), ...GEMS];

/** A monster's card by its kind, for any unit's kind. */
export const CARD_OF: ReadonlyMap<string, ItemBase> = new Map(Object.entries(CARD_BY_MONSTER));
