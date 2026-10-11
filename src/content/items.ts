import { type Affix, type ItemBase, ItemType } from '../sim/item';
import { Category } from '../sim/stats';
import { Race, Range } from '../sim/types';

// First item data. A starting point for balance, not final values.

const VANGUARD = ['Vanguard'];
const RANGER = ['Ranger'];
// Jobs not in the game yet. Their gear still drops, as the design says about
// half of all drops fit someone in the party.
const ARCANIST = ['Arcanist'];
const DUELIST = ['Duelist'];
const CLERIC = ['Cleric'];

export const BASES: readonly ItemBase[] = [
  // Weapons
  {
    id: 'armingSword',
    name: 'Arming Sword',
    type: ItemType.Weapon,
    weapon: 'sword',
    level: 1,
    weight: 50,
    maxSockets: 3,
    jobs: VANGUARD,
    damage: { min: { min: 25, max: 31 }, max: { min: 33, max: 39 } },
  },
  {
    id: 'flangedMace',
    name: 'Flanged Mace',
    type: ItemType.Weapon,
    weapon: 'mace',
    level: 4,
    weight: 70,
    maxSockets: 3,
    jobs: VANGUARD,
    damage: { min: { min: 30, max: 36 }, max: { min: 38, max: 46 } },
  },
  {
    id: 'huntingBow',
    name: 'Hunting Bow',
    type: ItemType.Weapon,
    weapon: 'bow',
    level: 1,
    weight: 30,
    maxSockets: 3,
    jobs: RANGER,
    damage: { min: { min: 21, max: 27 }, max: { min: 29, max: 35 } },
  },
  {
    id: 'yewLongbow',
    name: 'Yew Longbow',
    type: ItemType.Weapon,
    weapon: 'bow',
    level: 5,
    weight: 40,
    maxSockets: 4,
    jobs: RANGER,
    damage: { min: { min: 25, max: 31 }, max: { min: 36, max: 44 } },
  },
  {
    id: 'stiletto',
    name: 'Stiletto',
    type: ItemType.Weapon,
    weapon: 'dagger',
    level: 2,
    weight: 15,
    maxSockets: 2,
    jobs: DUELIST,
    damage: { min: { min: 16, max: 20 }, max: { min: 22, max: 28 } },
  },
  {
    id: 'ashStaff',
    name: 'Ash Staff',
    type: ItemType.Weapon,
    weapon: 'staff',
    level: 2,
    weight: 40,
    maxSockets: 4,
    jobs: ARCANIST,
    damage: { min: { min: 10, max: 14 }, max: { min: 18, max: 24 } },
  },
  {
    id: 'pilgrimStaff',
    name: 'Pilgrim Staff',
    type: ItemType.Weapon,
    weapon: 'staff',
    level: 1,
    weight: 35,
    maxSockets: 3,
    jobs: [...CLERIC, ...ARCANIST],
    damage: { min: { min: 8, max: 12 }, max: { min: 14, max: 18 } },
    matk: { min: 28, max: 36 },
  },
  {
    id: 'censer',
    name: 'Iron Censer',
    type: ItemType.Weapon,
    weapon: 'mace',
    level: 4,
    weight: 45,
    maxSockets: 2,
    jobs: CLERIC,
    damage: { min: { min: 14, max: 18 }, max: { min: 20, max: 26 } },
    matk: { min: 36, max: 46 },
  },
  // Shields
  {
    id: 'towerShield',
    name: 'Tower Shield',
    type: ItemType.Shield,
    level: 1,
    weight: 90,
    maxSockets: 2,
    jobs: VANGUARD,
    armor: { min: 16, max: 24 },
    block: { chance: 35, amount: 60 },
  },
  {
    id: 'buckler',
    name: 'Buckler',
    type: ItemType.Shield,
    level: 2,
    weight: 30,
    maxSockets: 2,
    jobs: [...VANGUARD, ...DUELIST],
    armor: { min: 6, max: 10 },
    block: { chance: 20, amount: 45 },
  },
  // Armor
  {
    id: 'hood',
    name: 'Hood',
    type: ItemType.Head,
    level: 1,
    weight: 5,
    maxSockets: 2,
    armor: { min: 3, max: 6 },
  },
  {
    id: 'kettleHelm',
    name: 'Kettle Helm',
    type: ItemType.Head,
    level: 3,
    weight: 30,
    maxSockets: 2,
    jobs: VANGUARD,
    armor: { min: 10, max: 15 },
  },
  {
    id: 'jerkin',
    name: 'Leather Jerkin',
    type: ItemType.Body,
    level: 1,
    weight: 40,
    maxSockets: 3,
    armor: { min: 16, max: 24 },
  },
  {
    id: 'hauberk',
    name: 'Mail Hauberk',
    type: ItemType.Body,
    level: 1,
    weight: 120,
    maxSockets: 3,
    jobs: VANGUARD,
    armor: { min: 44, max: 56 },
  },
  {
    id: 'vestments',
    name: 'Grey Vestments',
    type: ItemType.Body,
    level: 1,
    weight: 25,
    maxSockets: 3,
    jobs: CLERIC,
    armor: { min: 10, max: 16 },
  },
  {
    id: 'shroud',
    name: 'Pilgrim Shroud',
    type: ItemType.Cloak,
    level: 1,
    weight: 10,
    maxSockets: 2,
    armor: { min: 2, max: 5 },
  },
  {
    id: 'boots',
    name: 'Road Boots',
    type: ItemType.Boots,
    level: 1,
    weight: 15,
    maxSockets: 2,
    armor: { min: 3, max: 6 },
  },
  { id: 'ring', name: 'Iron Ring', type: ItemType.Accessory, level: 1, weight: 1, maxSockets: 1 },
  {
    id: 'amulet',
    name: 'Bone Amulet',
    type: ItemType.Accessory,
    level: 3,
    weight: 2,
    maxSockets: 1,
  },
];

/** Potions, from weakest to strongest. */
export const POTIONS: readonly ItemBase[] = [
  {
    id: 'healingDraught',
    name: 'Healing Draught',
    type: ItemType.Potion,
    level: 1,
    weight: 2,
    maxSockets: 0,
    stackMax: 10,
    potion: { health: 0.35 },
  },
  {
    id: 'manaTincture',
    name: 'Mana Tincture',
    type: ItemType.Potion,
    level: 1,
    weight: 2,
    maxSockets: 0,
    stackMax: 10,
    potion: { mana: 0.4 },
  },
  {
    id: 'greaterDraught',
    name: 'Greater Healing Draught',
    type: ItemType.Potion,
    level: 7,
    weight: 3,
    maxSockets: 0,
    stackMax: 10,
    potion: { health: 0.6 },
  },
];

export const GOLD: ItemBase = {
  id: 'gold',
  name: 'Gold',
  type: ItemType.Gold,
  level: 0,
  weight: 0,
  maxSockets: 0,
};

export const BASE_BY_ID = new Map([...BASES, ...POTIONS].map((b) => [b.id, b]));

const ARMOR_TYPES = [ItemType.Shield, ItemType.Head, ItemType.Body, ItemType.Cloak, ItemType.Boots];
const ANY = [ItemType.Weapon, ...ARMOR_TYPES, ItemType.Accessory];

/** Prefixes and suffixes, in tiers. Tiers of one group never roll together. */
export const AFFIXES: readonly Affix[] = [
  // Prefixes
  {
    id: 'sturdy',
    kind: 'prefix',
    name: 'Sturdy',
    group: 'armor',
    level: 1,
    frequency: 10,
    types: ARMOR_TYPES,
    rolls: [{ min: 8, max: 15 }],
    bonuses: ([v]) => [{ stat: 'armor', add: v }],
  },
  {
    id: 'fortified',
    kind: 'prefix',
    name: 'Fortified',
    group: 'armor',
    level: 6,
    frequency: 6,
    types: ARMOR_TYPES,
    rolls: [{ min: 20, max: 32 }],
    bonuses: ([v]) => [{ stat: 'armor', add: v }],
  },
  {
    id: 'sharp',
    kind: 'prefix',
    name: 'Sharp',
    group: 'damage',
    level: 1,
    frequency: 10,
    types: [ItemType.Weapon],
    rolls: [{ min: 10, max: 20 }],
    bonuses: ([v]) => [
      { stat: 'atkMin', percent: v },
      { stat: 'atkMax', percent: v },
    ],
  },
  {
    id: 'cruel',
    kind: 'prefix',
    name: 'Cruel',
    group: 'damage',
    level: 6,
    frequency: 5,
    types: [ItemType.Weapon],
    rolls: [{ min: 25, max: 40 }],
    bonuses: ([v]) => [
      { stat: 'atkMin', percent: v },
      { stat: 'atkMax', percent: v },
    ],
  },
  {
    id: 'consecrated',
    kind: 'prefix',
    name: 'Consecrated',
    group: 'race',
    level: 2,
    frequency: 6,
    types: [ItemType.Weapon],
    rolls: [{ min: 15, max: 30 }],
    bonuses: ([v]) => [{ amplify: Category.Race, key: Race.Undead, percent: v }],
  },
  {
    id: 'steady',
    kind: 'prefix',
    name: 'Steady',
    group: 'accuracy',
    level: 1,
    frequency: 8,
    types: [ItemType.Weapon, ItemType.Accessory, ItemType.Head],
    rolls: [{ min: 5, max: 12 }],
    bonuses: ([v]) => [{ stat: 'accuracy', add: v }],
  },
  {
    id: 'farsighted',
    kind: 'prefix',
    name: 'Farsighted',
    group: 'range',
    level: 3,
    frequency: 5,
    types: [ItemType.Weapon, ItemType.Accessory],
    rolls: [{ min: 8, max: 16 }],
    bonuses: ([v]) => [{ amplify: Category.AttackRange, key: Range.Ranged, percent: v }],
  },
  // Suffixes
  {
    id: 'bear',
    kind: 'suffix',
    name: 'of the Bear',
    group: 'vit',
    level: 1,
    frequency: 10,
    types: ANY,
    rolls: [{ min: 2, max: 5 }],
    bonuses: ([v]) => [{ base: 'vit', add: v }],
  },
  {
    id: 'ox',
    kind: 'suffix',
    name: 'of the Ox',
    group: 'str',
    level: 1,
    frequency: 8,
    types: ANY,
    rolls: [{ min: 2, max: 5 }],
    bonuses: ([v]) => [{ base: 'str', add: v }],
  },
  {
    id: 'hawk',
    kind: 'suffix',
    name: 'of the Hawk',
    group: 'dex',
    level: 1,
    frequency: 8,
    types: ANY,
    rolls: [{ min: 2, max: 5 }],
    bonuses: ([v]) => [{ base: 'dex', add: v }],
  },
  {
    id: 'life',
    kind: 'suffix',
    name: 'of Life',
    group: 'hp',
    level: 2,
    frequency: 8,
    types: ANY,
    rolls: [{ min: 15, max: 35 }],
    bonuses: ([v]) => [{ stat: 'maxHp', add: v }],
  },
  {
    id: 'vigil',
    kind: 'suffix',
    name: 'of the Vigil',
    group: 'wil',
    level: 2,
    frequency: 6,
    types: ANY,
    rolls: [{ min: 2, max: 5 }],
    bonuses: ([v]) => [{ base: 'wil', add: v }],
  },
  {
    id: 'warding',
    kind: 'suffix',
    name: 'of Warding',
    group: 'resistance',
    level: 3,
    frequency: 6,
    types: ARMOR_TYPES,
    rolls: [{ min: 10, max: 25 }],
    bonuses: ([v]) => [{ stat: 'resistance', add: v }],
  },
  {
    id: 'bulwark',
    kind: 'suffix',
    name: 'of the Bulwark',
    group: 'block',
    level: 4,
    frequency: 5,
    types: [ItemType.Shield],
    rolls: [{ min: 5, max: 10 }],
    bonuses: ([v]) => [{ stat: 'blockChance', add: v }],
  },
];

export const AFFIX_BY_ID = new Map(AFFIXES.map((a) => [a.id, a]));

// Words for a rare's name: one from each list, as Diablo 2's rare names.
export const RARE_FIRST = [
  'Grave',
  'Ash',
  'Hollow',
  'Writ',
  'Bitter',
  'Pale',
  'Iron',
  'Carrion',
  'Vigil',
  'Sorrow',
];
export const RARE_SECOND = [
  'Fang',
  'Oath',
  'Shroud',
  'Hymn',
  'Bite',
  'Ward',
  'Debt',
  'Mark',
  'Brand',
  'Keeper',
];

/** Potions each merc arrives with on its belt, and the bearer in its pack. */
export const STARTER_BELT: Record<string, [string, number][]> = {
  vanguard: [['healingDraught', 2]],
  ranger: [
    ['healingDraught', 2],
    ['manaTincture', 1],
  ],
  cleric: [
    ['healingDraught', 1],
    ['manaTincture', 2],
  ],
};
export const STARTER_PACK: [string, number][] = [
  ['healingDraught', 4],
  ['manaTincture', 2],
];

/** The gear each merc arrives with. Plain, middle-of-the-range copies. */
export const STARTER_GEAR: Record<string, string[]> = {
  vanguard: ['armingSword', 'towerShield', 'hauberk'],
  ranger: ['huntingBow', 'jerkin'],
  cleric: ['pilgrimStaff', 'vestments'],
};
