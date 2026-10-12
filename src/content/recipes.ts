import type RNG from '../core/rng';
import { plainItem, potionStack, rollItem } from '../gen/loot';
import { type Item, ItemType, Quality } from '../sim/item';
import { Rank } from '../sim/types';
import { GEMS } from './cards';
import { BASE_BY_ID } from './items';

// The Recipe Book, from the items design: what the Synthesis bench in a
// Town can make, from materials and gold. Every recipe is known for now;
// recipe drops wait.

export interface Recipe {
  id: string;
  name: string;
  describe: string;
  materials: readonly [string, number][];
  gold: number;
  // Items made, at the given item level. A Smith's Blessing makes none: it
  // goes into the pouch.
  make: (rng: RNG, itemLevel: number) => Item[];
  // Materials made instead of items
  yields?: readonly [string, number][];
}

const potions =
  (id: string, count: number): ((rng: RNG, level: number) => Item[]) =>
  (): Item[] => {
    const base = BASE_BY_ID.get(id);
    return base ? [potionStack(base, count)] : [];
  };

const ARMOR = [ItemType.Head, ItemType.Body, ItemType.Cloak, ItemType.Boots, ItemType.Shield];

export const RECIPES: readonly Recipe[] = [
  {
    id: 'healing',
    name: 'Healing Draught ×2',
    describe: 'Two Healing Draughts.',
    materials: [['chitin', 2]],
    gold: 10,
    make: potions('healingDraught', 2),
  },
  {
    id: 'mana',
    name: 'Mana Tincture ×2',
    describe: 'Two Mana Tinctures.',
    materials: [['rag', 2]],
    gold: 10,
    make: potions('manaTincture', 2),
  },
  {
    id: 'greater',
    name: 'Greater Draught',
    describe: 'A Greater Draught.',
    materials: [
      ['bone', 2],
      ['radiantEssence', 1],
    ],
    gold: 20,
    make: potions('greaterDraught', 1),
  },
  {
    id: 'gem',
    name: 'Cut a gem',
    describe: 'A gem, any of the four, for any socket.',
    materials: [
      ['chitin', 2],
      ['bone', 2],
      ['rag', 1],
    ],
    gold: 30,
    make: (rng) => [plainItem(rng.pick(GEMS))],
  },
  {
    id: 'blessing',
    name: 'Smith’s Blessing',
    describe: 'Turns one failed refine into the loss of one level, instead of the item.',
    materials: [
      ['iron', 3],
      ['occultEssence', 1],
      ['radiantEssence', 1],
    ],
    gold: 50,
    make: () => [],
    yields: [['blessing', 1]],
  },
  {
    id: 'weapon',
    name: 'Reforge a weapon',
    describe: 'A Magic or better weapon of the area’s level.',
    materials: [
      ['iron', 5],
      ['bone', 2],
      ['venomEssence', 1],
    ],
    gold: 60,
    make: (rng, level) => [
      rollItem(rng, level, Rank.Elite, { types: [ItemType.Weapon], atLeast: Quality.Magic }),
    ],
  },
  {
    id: 'armor',
    name: 'Reforge armor',
    describe: 'A Magic or better piece of armor of the area’s level.',
    materials: [
      ['iron', 5],
      ['chitin', 3],
      ['occultEssence', 1],
    ],
    gold: 60,
    make: (rng, level) => [
      rollItem(rng, level, Rank.Elite, { types: ARMOR, atLeast: Quality.Magic }),
    ],
  },
];
