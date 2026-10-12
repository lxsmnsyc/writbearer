import type { Lifecycle } from '../core/lifecycle';
import type { Modifier, Weapon } from './stats';
import type Unit from './unit';

export const enum EquipSlot {
  Weapon = 0,
  Offhand = 1,
  Head = 2,
  Body = 3,
  Cloak = 4,
  Boots = 5,
  Accessory1 = 6,
  Accessory2 = 7,
}

export const EQUIP_SLOTS: readonly EquipSlot[] = [
  EquipSlot.Weapon,
  EquipSlot.Offhand,
  EquipSlot.Head,
  EquipSlot.Body,
  EquipSlot.Cloak,
  EquipSlot.Boots,
  EquipSlot.Accessory1,
  EquipSlot.Accessory2,
];

/** Where an item goes. Accessories fit either accessory slot. */
export const enum ItemType {
  Weapon = 0,
  Shield = 1,
  Head = 2,
  Body = 3,
  Cloak = 4,
  Boots = 5,
  Accessory = 6,
  Gold = 7,
  // Drunk from the belt or by the bearer. Stacks.
  Potion = 8,
  // A monster card or a gem, set into a socket for good.
  Card = 9,
}

/** What a card or a gem does once set into a socket. */
export interface Socketable {
  // The kinds of item it fits. Gems fit any.
  fits: readonly ItemType[] | 'any';
  // One line on what it does
  describe: string;
  modifiers: readonly Modifier[];
  // An effect beyond stats, such as buildup on hit, while it is worn
  setup?: (unit: Unit) => Lifecycle;
}

/** From Diablo 2. Fewer affixes leave room for more sockets. */
export const enum Quality {
  Inferior = 0,
  Normal = 1,
  Superior = 2,
  Magic = 3,
  Rare = 4,
}

/** What a weapon is, which decides who can wield it and how it is drawn. */
export type WeaponKind = 'sword' | 'mace' | 'bow' | 'dagger' | 'staff';

/** A range a base value is rolled in. */
export interface Span {
  min: number;
  max: number;
}

/** Static data for one kind of item. */
export interface ItemBase {
  id: string;
  name: string;
  type: ItemType;
  weapon?: WeaponKind;
  // Item level needed for it to drop, as Diablo 2's qlvl
  level: number;
  weight: number;
  maxSockets: number;
  // Jobs that can use it, by job name. Absent means anyone.
  jobs?: readonly string[];
  // Rolled per copy: weapon damage, armor, block
  damage?: { min: Span; max: Span };
  // Magic attack, for staves and holy symbols
  matk?: Span;
  armor?: Span;
  block?: { chance: number; amount: number };
  // What a potion restores over a few seconds, as shares of max health and mana
  potion?: { health?: number; mana?: number };
  // How many fit in one pack slot or belt slot. Absent means one.
  stackMax?: number;
  // Cards and gems: what they do in a socket
  socket?: Socketable;
}

/** One rolled affix: which, and its rolled values. */
export interface AffixRoll {
  id: string;
  values: number[];
}

/** One copy of an item, rolled when it dropped. */
export interface Item {
  uid: number;
  base: ItemBase;
  itemLevel: number;
  quality: Quality;
  // The rolled base values
  rolls: { min?: number; max?: number; armor?: number; matk?: number };
  affixes: AffixRoll[];
  // What the affixes give, worked out when the item was rolled
  bonuses: Modifier[];
  sockets: number;
  // Cards and gems set into the sockets, at most `sockets` of them
  cards: ItemBase[];
  // Refine level, +0 to +10, raised by a Blacksmith
  refine: number;
  // A rare's rolled name, such as "Grave Fang"
  name?: string;
  // Gold only
  quantity: number;
}

/** An affix: a prefix or suffix that adds bonuses, as in Diablo 2. */
export interface Affix {
  id: string;
  kind: 'prefix' | 'suffix';
  // The word it adds to the name: "Sturdy", or "of the Bear"
  name: string;
  // Only one affix per group on an item
  group: string;
  // Minimum item level, as Diablo 2's alvl
  level: number;
  frequency: number;
  types: readonly ItemType[];
  rolls: readonly Span[];
  // What the rolled values do
  bonuses: (values: number[]) => Modifier[];
}

/** The slot an item goes into, given the accessory slot to use. */
export function slotFor(item: Item, second = false): EquipSlot | null {
  switch (item.base.type) {
    case ItemType.Weapon:
      return EquipSlot.Weapon;
    case ItemType.Shield:
      return EquipSlot.Offhand;
    case ItemType.Head:
      return EquipSlot.Head;
    case ItemType.Body:
      return EquipSlot.Body;
    case ItemType.Cloak:
      return EquipSlot.Cloak;
    case ItemType.Boots:
      return EquipSlot.Boots;
    case ItemType.Accessory:
      return second ? EquipSlot.Accessory2 : EquipSlot.Accessory1;
    default:
      return null;
  }
}

/** Whether a job can use an item at all. */
export function usableBy(item: Item, job: string): boolean {
  return item.base.type !== ItemType.Gold && (!item.base.jobs || item.base.jobs.includes(job));
}

/** Whether an item is a potion, for the belt. */
export const isPotion = (item: Item): boolean => item.base.type === ItemType.Potion;

/** Whether two items stack: same base, and the base stacks at all. */
export const stacks = (a: Item, b: Item): boolean =>
  a.base === b.base && (a.base.stackMax ?? 1) > 1;

/** The weapon damage a weapon gives, or null for anything else. */
export function weaponOf(item: Item): Weapon | null {
  if (item.base.type !== ItemType.Weapon || item.rolls.min === undefined) {
    return null;
  }
  return {
    min: item.rolls.min,
    max: item.rolls.max ?? item.rolls.min,
    matk: item.rolls.matk ?? 0,
  };
}

// What each refine level adds: flat attack to weapons, flat armor to armor.
export const REFINE_ATTACK = 3;
export const REFINE_ARMOR = 2;
export const MAX_REFINE = 10;

/** Whether a Blacksmith can refine an item at all: weapons and armor, not accessories. */
export const refinable = (item: Item): boolean =>
  item.base.type === ItemType.Weapon ||
  item.base.type === ItemType.Shield ||
  item.base.type === ItemType.Head ||
  item.base.type === ItemType.Body ||
  item.base.type === ItemType.Cloak ||
  item.base.type === ItemType.Boots;

function refineModifiers(item: Item): Modifier[] {
  if (item.refine <= 0) {
    return [];
  }
  if (item.base.type === ItemType.Weapon) {
    return [
      { stat: 'atkMin', add: item.refine * REFINE_ATTACK },
      { stat: 'atkMax', add: item.refine * REFINE_ATTACK },
    ];
  }
  return refinable(item) ? [{ stat: 'armor', add: item.refine * REFINE_ARMOR }] : [];
}

/** Whether an item is a card or a gem, for sockets. */
export const isCard = (item: Item): boolean => item.base.type === ItemType.Card;

/** Whether a card or gem fits an item, and the item has a free socket. */
export function canSocket(card: Item, into: Item): boolean {
  const fits = card.base.socket?.fits;
  return (
    fits !== undefined &&
    into.cards.length < into.sockets &&
    (fits === 'any' || fits.includes(into.base.type))
  );
}

/** Every stat bonus an item gives its wearer, base values and affixes alike. */
export function itemModifiers(item: Item): Modifier[] {
  const out: Modifier[] = [];
  if (item.rolls.armor) {
    out.push({ stat: 'armor', add: item.rolls.armor });
  }
  if (item.base.block) {
    out.push({ stat: 'blockChance', add: item.base.block.chance });
    out.push({ stat: 'blockAmount', add: item.base.block.amount });
  }
  out.push(...refineModifiers(item));
  out.push(...item.bonuses);
  for (const card of item.cards) {
    out.push(...(card.socket?.modifiers ?? []));
  }
  return out;
}
