import type RNG from '../core/rng';
import { type Item, ItemType, Quality } from '../sim/item';
import { Element, Race, Rank } from '../sim/types';

// Crafting materials, from the items design. Monsters leave them by race
// and element; salvaged gear gives Iron. They go into the pouch, which has
// no weight and no slot limit.

export interface Material {
  id: string;
  name: string;
}

export const MATERIALS: readonly Material[] = [
  { id: 'chitin', name: 'Chitin' },
  { id: 'bone', name: 'Bone' },
  { id: 'rag', name: 'Rags' },
  { id: 'iron', name: 'Iron' },
  { id: 'venomEssence', name: 'Venom Essence' },
  { id: 'occultEssence', name: 'Occult Essence' },
  { id: 'radiantEssence', name: 'Radiant Essence' },
  // Crafted, and spent by the Blacksmith on a failed refine
  { id: 'blessing', name: 'Smith’s Blessing' },
];

export const MATERIAL_NAME = new Map(MATERIALS.map((m) => [m.id, m.name]));

/** Materials gathered or spent, by material id. */
export type Materials = Map<string, number>;

const BY_RACE: Partial<Record<Race, string>> = {
  [Race.Insect]: 'chitin',
  [Race.Beast]: 'chitin',
  [Race.Undead]: 'bone',
  [Race.Human]: 'rag',
};

const BY_ELEMENT: Partial<Record<Element, string>> = {
  [Element.Venom]: 'venomEssence',
  [Element.Occult]: 'occultEssence',
  [Element.Radiant]: 'radiantEssence',
};

// Chance and count of a race's material, and of an element's essence, by rank
const RACE_DROP: Record<Rank, [number, number]> = {
  [Rank.Normal]: [0.2, 1],
  [Rank.Elite]: [1, 2],
  [Rank.Boss]: [1, 4],
};
const ESSENCE_DROP: Record<Rank, [number, number]> = {
  [Rank.Normal]: [0.05, 1],
  [Rank.Elite]: [0.5, 1],
  [Rank.Boss]: [1, 2],
};

/** What a slain monster leaves for the pouch. */
export function materialsFrom(
  rng: RNG,
  monster: { race: Race; element: Element; rank: Rank },
): Materials {
  const out: Materials = new Map();
  const race = BY_RACE[monster.race];
  const [raceChance, raceCount] = RACE_DROP[monster.rank];
  if (race && rng.chance(raceChance)) {
    out.set(race, raceCount);
  }
  const essence = BY_ELEMENT[monster.element];
  const [essenceChance, essenceCount] = ESSENCE_DROP[monster.rank];
  if (essence && rng.chance(essenceChance)) {
    out.set(essence, essenceCount);
  }
  return out;
}

/**
 * What a piece of gear breaks down into: Iron, more for better quality,
 * and Radiant Essence from Magic and Rare gear. Its cards are lost.
 */
export function salvage(item: Item): Materials {
  const out: Materials = new Map();
  if (item.base.type === ItemType.Gold || item.base.type === ItemType.Potion) {
    return out;
  }
  if (item.base.type === ItemType.Card) {
    return out;
  }
  const extra = Math.max(0, item.quality - Quality.Normal);
  out.set('iron', 1 + extra);
  if (item.quality >= Quality.Magic) {
    out.set('radiantEssence', 1);
  }
  return out;
}

/** Adds materials to a pouch. */
export function gather(pouch: Materials, found: Materials): void {
  for (const [id, n] of found) {
    pouch.set(id, (pouch.get(id) ?? 0) + n);
  }
}

/** Whether a pouch holds every material in a cost. */
export const affords = (pouch: Materials, cost: readonly [string, number][]): boolean =>
  cost.every(([id, n]) => (pouch.get(id) ?? 0) >= n);

/** Takes a cost out of a pouch. Check `affords` first. */
export function spend(pouch: Materials, cost: readonly [string, number][]): void {
  for (const [id, n] of cost) {
    const left = (pouch.get(id) ?? 0) - n;
    if (left > 0) {
      pouch.set(id, left);
    } else {
      pouch.delete(id);
    }
  }
}
