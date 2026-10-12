import { BASE_BY_ID } from '../content/items';
import { affords, gather, salvage, spend } from '../content/materials';
import type { Recipe } from '../content/recipes';
import type RNG from '../core/rng';
import { potionStack, socketLimit } from '../gen/loot';
import { type Item, ItemType, MAX_REFINE, refinable } from '../sim/item';
import type Unit from '../sim/unit';
import type { Pack } from './inventory';

// A Town's services: the Blacksmith, the Synthesis bench, the Temple and
// the Market. Each takes gold or materials from the pack, and rolls from
// the `craft` stream.

// Up to this refine level, refining always works, as rAthena's safe limit.
export const SAFE_REFINE = 4;
// Chance a refine to each level above the safe one works
const REFINE_CHANCE = [1, 1, 1, 1, 1, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
const ADD_SOCKET_CHANCE = 0.75;

/** Chance that refining an item to its next level works. */
export const refineChance = (item: Item): number => REFINE_CHANCE[item.refine + 1] ?? 0;

/** Gold the Blacksmith asks to refine an item to its next level. */
export const refineCost = (item: Item): number => 25 * (item.refine + 1);

/** Gold the Blacksmith asks to add a socket. */
export const socketCost = (item: Item): number => 150 * (item.sockets + 1);

/** Why the Blacksmith will not refine an item, or null. */
export function cannotRefine(pack: Pack, item: Item): string | null {
  if (!refinable(item)) {
    return 'Only weapons and armor can be refined.';
  }
  if (item.refine >= MAX_REFINE) {
    return `It is at +${MAX_REFINE} already.`;
  }
  const cost = refineCost(item);
  return pack.gold < cost ? `Refining costs ${cost} gold. You have ${pack.gold}.` : null;
}

export type RefineResult = 'refined' | 'held' | 'broken';

/**
 * Refines an item one level. Past the safe level it can fail: a Smith's
 * Blessing from the pouch then costs the item one level instead; without one,
 * the item breaks with its cards, and the caller removes it.
 */
export function refine(rng: RNG, pack: Pack, item: Item, bless: boolean): RefineResult {
  pack.gold -= refineCost(item);
  if (rng.chance(refineChance(item))) {
    item.refine++;
    return 'refined';
  }
  if (bless && (pack.materials.get('blessing') ?? 0) > 0) {
    spend(pack.materials, [['blessing', 1]]);
    item.refine = Math.max(0, item.refine - 1);
    return 'held';
  }
  return 'broken';
}

/** Why the Blacksmith will not add a socket, or null. */
export function cannotAddSocket(pack: Pack, item: Item): string | null {
  if (item.sockets >= socketLimit(item)) {
    return 'It cannot take another socket.';
  }
  const cost = socketCost(item);
  return pack.gold < cost ? `A socket costs ${cost} gold. You have ${pack.gold}.` : null;
}

/** Adds a socket. It can fail and break the item, which the caller removes. */
export function addSocket(rng: RNG, pack: Pack, item: Item): 'added' | 'broken' {
  pack.gold -= socketCost(item);
  if (rng.chance(ADD_SOCKET_CHANCE)) {
    item.sockets++;
    return 'added';
  }
  return 'broken';
}

/** Why the bench cannot make a recipe now, or null. */
export function cannotCraft(pack: Pack, recipe: Recipe): string | null {
  if (!affords(pack.materials, recipe.materials)) {
    return 'Not enough materials.';
  }
  return pack.gold < recipe.gold ? `It costs ${recipe.gold} gold. You have ${pack.gold}.` : null;
}

/** Makes a recipe into the pack. Returns why it could not, or null. */
export function craft(rng: RNG, pack: Pack, recipe: Recipe, itemLevel: number): string | null {
  const why = cannotCraft(pack, recipe);
  if (why) {
    return why;
  }
  const made = recipe.make(rng, itemLevel);
  const refused = made.map((i) => pack.refuses(i)).find(Boolean);
  if (refused) {
    return refused;
  }
  spend(pack.materials, recipe.materials);
  pack.gold -= recipe.gold;
  for (const item of made) {
    pack.add(item);
  }
  for (const [id, n] of recipe.yields ?? []) {
    pack.materials.set(id, (pack.materials.get(id) ?? 0) + n);
  }
  return null;
}

/** Breaks a pack item down into materials. Returns why it could not, or null. */
export function salvageItem(pack: Pack, uid: number): string | null {
  const item = pack.items.find((i) => i.uid === uid);
  const found = item && salvage(item);
  if (!item || !found || found.size === 0) {
    return 'That cannot be salvaged.';
  }
  pack.take(uid);
  gather(pack.materials, found);
  return null;
}

/** Gold the Temple asks to raise a dead merc. */
export const raiseCost = (merc: Unit): number => 80 + 20 * merc.level;
const RAISED_HEALTH = 0.5;

/** The Temple raises a dead merc. Returns why it could not, or null. */
export function raise(pack: Pack, merc: Unit): string | null {
  if (merc.alive) {
    return `${merc.name} is alive.`;
  }
  if (merc.torn) {
    return `${merc.name} was torn apart. Nothing is left to raise.`;
  }
  const cost = raiseCost(merc);
  if (pack.gold < cost) {
    return `The Temple asks ${cost} gold. You have ${pack.gold}.`;
  }
  pack.gold -= cost;
  merc.revive(RAISED_HEALTH);
  return null;
}

/** What the Market sells, and for how much. */
export const WARES: readonly { id: string; price: number }[] = [
  { id: 'healingDraught', price: 25 },
  { id: 'manaTincture', price: 25 },
  { id: 'greaterDraught', price: 60 },
];

/** Buys a potion at the Market. Returns why it could not, or null. */
export function buy(pack: Pack, id: string): string | null {
  const ware = WARES.find((w) => w.id === id);
  const base = BASE_BY_ID.get(id);
  if (!ware || !base) {
    return 'That is not for sale.';
  }
  if (pack.gold < ware.price) {
    return `It costs ${ware.price} gold. You have ${pack.gold}.`;
  }
  const bought = potionStack(base, 1);
  const why = pack.refuses(bought);
  if (why) {
    return why;
  }
  pack.gold -= ware.price;
  pack.add(bought);
  return null;
}

/** What the Market pays for an item: more for its level, quality and refine. */
export function sellValue(item: Item): number {
  if (item.base.type === ItemType.Gold) {
    return 0;
  }
  if (item.base.type === ItemType.Potion) {
    return 8 * item.quantity;
  }
  if (item.base.type === ItemType.Card) {
    return 30;
  }
  return Math.round(4 * item.itemLevel * (1 + item.quality) + 10 * item.refine);
}

/** Sells a pack item. Returns why it could not, or null. */
export function sell(pack: Pack, uid: number): string | null {
  const item = pack.items.find((i) => i.uid === uid);
  if (!item) {
    return 'That item is gone.';
  }
  pack.take(uid);
  pack.gold += sellValue(item);
  return null;
}
