// What a Town does for the party: the smith, the bench, the Temple and the
// Market.
import { Stream } from '../../core/seed';
import type RNG from '../../core/rng';
import type Unit from '../../sim/unit';
import { type Item, refinable } from '../../sim/item';
import { monsterLevel } from '../../gen/stage';
import { itemName } from '../../gen/loot';
import type { Recipe } from '../../content/recipes';
import {
  addSocket,
  buy as buyPotion,
  cannotAddSocket,
  cannotRefine,
  craft as craftRecipe,
  raise as raiseMerc,
  refine,
  salvageItem,
  sell as sellItem,
} from '../town';
import type GameState from './state';

/** Every item the smith can work on: the pack's, then what each merc wears. */
export function smithable(g: GameState): { item: Item; merc: Unit | null }[] {
  return [
    ...g.pack.items.filter((i) => refinable(i)).map((item) => ({ item, merc: null })),
    ...g.mercs().flatMap((merc) => [...merc.equipment.values()].map((item) => ({ item, merc }))),
  ];
}

// Where an item is, so a broken one can be taken from there.
function remove(g: GameState, item: Item): void {
  if (g.pack.take(item.uid)) {
    return;
  }
  for (const merc of g.mercs()) {
    for (const [slot, worn] of merc.equipment) {
      if (worn === item) {
        merc.unequip(slot);
      }
    }
  }
}

function craftRng(g: GameState): RNG {
  return g.streams.get(1, Stream.Craft);
}

/** The smith refines an item one level. Returns what happened. */
export function refineItem(g: GameState, item: Item, bless: boolean): string {
  const why = cannotRefine(g.pack, item);
  if (why) {
    return why;
  }
  const name = itemName(item);
  const result = refine(craftRng(g), g.pack, item, bless);
  if (result === 'broken') {
    remove(g, item);
  }
  for (const merc of g.mercs()) {
    merc.recalc();
  }
  g.itemsChanged();
  if (result === 'refined') {
    return `${name} is now +${item.refine}.`;
  }
  return result === 'held'
    ? `The refine failed. The Blessing kept ${name}, at +${item.refine}.`
    : `The refine failed. ${name} broke, with every card in it.`;
}

/** The smith adds a socket. Returns what happened. */
export function socketItem(g: GameState, item: Item): string {
  const why = cannotAddSocket(g.pack, item);
  if (why) {
    return why;
  }
  const name = itemName(item);
  const result = addSocket(craftRng(g), g.pack, item);
  if (result === 'broken') {
    remove(g, item);
  }
  g.itemsChanged();
  return result === 'added'
    ? `${name} now has ${item.sockets} sockets.`
    : `The punch slipped. ${name} broke.`;
}

/** The bench makes a recipe. Returns why it could not, or null. */
export function craft(g: GameState, recipe: Recipe): string | null {
  const why = craftRecipe(craftRng(g), g.pack, recipe, monsterLevel(g.stageIndex));
  g.itemsChanged();
  return why;
}

/** The bench breaks a pack item down into materials. */
export function salvage(g: GameState, uid: number): string | null {
  const why = salvageItem(g.pack, uid);
  g.itemsChanged();
  return why;
}

/** The Temple raises a dead merc. */
export function raise(g: GameState, merc: Unit): string | null {
  const why = raiseMerc(g.pack, merc);
  g.views.snap(g.sim);
  g.itemsChanged();
  return why;
}

/** The Market sells a potion. */
export function buy(g: GameState, id: string): string | null {
  const why = buyPotion(g.pack, id);
  g.itemsChanged();
  return why;
}

/** The Market buys a pack item. */
export function sell(g: GameState, uid: number): string | null {
  const why = sellItem(g.pack, uid);
  g.itemsChanged();
  return why;
}
