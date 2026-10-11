import { EquipSlot, type Item, ItemType, slotFor, usableBy } from '../sim/item';
import type Sim from '../sim/sim';
import { Side } from '../sim/types';
import type Unit from '../sim/unit';

// The bearer's pack, as rAthena's inventory: limited by slots and by weight.
const PACK_SLOTS = 30;
const PACK_WEIGHT = 400;
// Above half the weight limit, the bearer walks this much slower.
const HEAVY_SPEED = 0.75;
// In a fight, an item is handed over only from this close.
const HAND_REACH = 2;
// A fight is on when an awake monster is this close to the bearer.
const FIGHT_RADIUS = 8;

/** Something lying on the floor, waiting for the bearer. */
export interface GroundItem {
  item: Item;
  x: number;
  z: number;
}

/** What the bearer carries: equipment and gold. */
export class Pack {
  readonly items: Item[] = [];
  gold = 0;

  get weight(): number {
    return this.items.reduce((sum, i) => sum + i.base.weight, 0);
  }

  readonly maxWeight = PACK_WEIGHT;
  readonly slots = PACK_SLOTS;

  /** How the load slows the bearer, as rAthena's 50% rule. */
  get speed(): number {
    return this.weight > PACK_WEIGHT / 2 ? HEAVY_SPEED : 1;
  }

  /** Why an item cannot go in, or null if it can. */
  refuses(item: Item): string | null {
    if (item.base.type === ItemType.Gold) {
      return null;
    }
    if (this.items.length >= PACK_SLOTS) {
      return 'The pack is full.';
    }
    if (this.weight + item.base.weight > PACK_WEIGHT) {
      return 'The pack is too heavy for that.';
    }
    return null;
  }

  /** Puts an item in. Returns false if it does not fit. */
  add(item: Item): boolean {
    if (this.refuses(item)) {
      return false;
    }
    if (item.base.type === ItemType.Gold) {
      this.gold += item.quantity;
    } else {
      this.items.push(item);
    }
    return true;
  }

  take(uid: number): Item | null {
    const i = this.items.findIndex((x) => x.uid === uid);
    return i < 0 ? null : this.items.splice(i, 1)[0];
  }
}

/** Whether a fight is on around the bearer. */
export function inFight(sim: Sim, bearer: Unit): boolean {
  return sim.living(Side.Monster).some((m) => m.aware && m.distanceTo(bearer) <= FIGHT_RADIUS);
}

/**
 * Why the bearer cannot hand gear to or take it from a merc now, or null.
 * In a fight it must stand next to the merc. Out of one, any distance works.
 */
export function cannotHand(sim: Sim, bearer: Unit, merc: Unit): string | null {
  if (!merc.alive) {
    return `The ${merc.name} is dead.`;
  }
  if (inFight(sim, bearer) && bearer.distanceTo(merc) > HAND_REACH) {
    return `In a fight, stand next to the ${merc.name} to hand gear over.`;
  }
  return null;
}

/**
 * Moves an item from the pack onto a merc. What it replaces goes back into
 * the pack. Returns why it failed, or null.
 */
export function equipFromPack(
  sim: Sim,
  bearer: Unit,
  pack: Pack,
  merc: Unit,
  uid: number,
): string | null {
  const item = pack.items.find((x) => x.uid === uid);
  if (!item) {
    return 'That item is gone.';
  }
  if (!usableBy(item, merc.job.name)) {
    return `The ${merc.name} cannot use that.`;
  }
  const blocked = cannotHand(sim, bearer, merc);
  if (blocked) {
    return blocked;
  }
  // An accessory goes in the first free accessory slot, or replaces the first.
  let slot = slotFor(item);
  if (slot === EquipSlot.Accessory1 && merc.equipment.has(EquipSlot.Accessory1)) {
    slot = merc.equipment.has(EquipSlot.Accessory2) ? EquipSlot.Accessory1 : EquipSlot.Accessory2;
  }
  if (slot === null) {
    return 'That cannot be worn.';
  }
  pack.take(uid);
  const before = merc.equip(slot, item);
  if (before) {
    pack.items.push(before);
  }
  return null;
}

/** Moves an item from a merc into the pack. Returns why it failed, or null. */
export function unequipToPack(
  sim: Sim,
  bearer: Unit,
  pack: Pack,
  merc: Unit,
  slot: EquipSlot,
): string | null {
  const item = merc.equipment.get(slot);
  if (!item) {
    return null;
  }
  const blocked = cannotHand(sim, bearer, merc) ?? pack.refuses(item);
  if (blocked) {
    return blocked;
  }
  merc.unequip(slot);
  pack.items.push(item);
  return null;
}
