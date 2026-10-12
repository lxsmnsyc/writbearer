import { potionStack } from '../gen/loot';
import {
  EQUIP_SLOTS,
  EquipSlot,
  type Item,
  ItemType,
  canSocket,
  isPotion,
  slotFor,
  stacks,
  usableBy,
} from '../sim/item';
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
    return this.items.reduce((sum, i) => sum + i.base.weight * i.quantity, 0);
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
    if (this.items.length >= PACK_SLOTS && !this.stackFor(item)) {
      return 'The pack is full.';
    }
    if (this.weight + item.base.weight * item.quantity > PACK_WEIGHT) {
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
      return true;
    }
    // Potions join a stack of their kind while it has room.
    let left = item.quantity;
    for (const stack of this.items) {
      if (left > 0 && stacks(stack, item)) {
        const moved = Math.min(left, (stack.base.stackMax ?? 1) - stack.quantity);
        stack.quantity += moved;
        left -= moved;
      }
    }
    if (left > 0) {
      item.quantity = left;
      this.items.push(item);
    }
    return true;
  }

  // A stack an item could join, if any.
  private stackFor(item: Item): Item | undefined {
    return this.items.find(
      (s) => stacks(s, item) && s.quantity + item.quantity <= (s.base.stackMax ?? 1),
    );
  }

  /** The first potion in the pack that restores health. */
  healingPotion(): Item | undefined {
    return this.items.find((i) => (i.base.potion?.health ?? 0) > 0);
  }

  /** Drops empty stacks, after the bearer drank the last of one. */
  tidy(): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].quantity <= 0) {
        this.items.splice(i, 1);
      }
    }
  }

  take(uid: number): Item | null {
    const i = this.items.findIndex((x) => x.uid === uid);
    return i < 0 ? null : this.items.splice(i, 1)[0];
  }
}

// The vault holds this many stacks, with no weight limit.
const VAULT_SLOTS = 40;

/**
 * The party's storage for the run, as rAthena's Kafra storage. It opens only
 * at a Waystation. What is in it is safe until the run ends.
 */
export class Vault {
  readonly items: Item[] = [];
  readonly slots = VAULT_SLOTS;
}

/** Moves an item from the pack into the vault. Returns why it failed, or null. */
export function storeInVault(pack: Pack, vault: Vault, uid: number): string | null {
  if (vault.items.length >= vault.slots) {
    return 'The vault is full.';
  }
  const item = pack.take(uid);
  if (!item) {
    return 'That item is gone.';
  }
  vault.items.push(item);
  return null;
}

/** Moves an item from the vault into the pack. Returns why it failed, or null. */
export function takeFromVault(pack: Pack, vault: Vault, uid: number): string | null {
  const i = vault.items.findIndex((x) => x.uid === uid);
  if (i < 0) {
    return 'That item is gone.';
  }
  const why = pack.refuses(vault.items[i]);
  if (why) {
    return why;
  }
  pack.add(vault.items.splice(i, 1)[0]);
  return null;
}

/** The first item a merc wears that a card or gem can go into, if any. */
export function socketFor(merc: Unit, card: Item): Item | null {
  for (const slot of EQUIP_SLOTS) {
    const worn = merc.equipment.get(slot);
    if (worn && canSocket(card, worn)) {
      return worn;
    }
  }
  return null;
}

/**
 * Sets a card or gem from the pack into the first item the merc wears that
 * fits it and has a free socket. It stays there for good. Returns why it
 * could not, or null.
 */
export function socketCard(
  sim: Sim,
  bearer: Unit,
  pack: Pack,
  merc: Unit,
  uid: number,
): string | null {
  const card = pack.items.find((x) => x.uid === uid);
  if (!card?.base.socket) {
    return 'That cannot go in a socket.';
  }
  const blocked = cannotHand(sim, bearer, merc);
  if (blocked) {
    return blocked;
  }
  const into = socketFor(merc, card);
  if (!into) {
    return `Nothing ${merc.name} wears has a free socket for the ${card.base.name}.`;
  }
  pack.take(uid);
  into.cards.push(card.base);
  merc.recalc();
  merc.refreshCards();
  return null;
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
    return `${merc.name} is dead.`;
  }
  if (inFight(sim, bearer) && bearer.distanceTo(merc) > HAND_REACH) {
    return `In a fight, stand next to ${merc.name} to hand gear over.`;
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
    return `${merc.name} cannot use that.`;
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

// Potions a belt slot holds.
export const BELT_STACK = 5;

/**
 * Moves potions from a pack stack onto a merc's belt: onto a slot of the
 * same kind with room, or an empty one. Returns why it failed, or null.
 */
export function packToBelt(
  sim: Sim,
  bearer: Unit,
  pack: Pack,
  merc: Unit,
  uid: number,
): string | null {
  const stack = pack.items.find((x) => x.uid === uid);
  if (!stack || !isPotion(stack)) {
    return 'Only potions go on the belt.';
  }
  const blocked = cannotHand(sim, bearer, merc);
  if (blocked) {
    return blocked;
  }
  let slot = merc.belt.findIndex((b) => b !== null && stacks(b, stack) && b.quantity < BELT_STACK);
  if (slot < 0) {
    slot = merc.belt.indexOf(null);
  }
  if (slot < 0) {
    return `${merc.name}'s belt is full.`;
  }
  const current = merc.belt[slot];
  const room = BELT_STACK - (current?.quantity ?? 0);
  const moved = Math.min(room, stack.quantity);
  if (current) {
    current.quantity += moved;
  } else {
    merc.belt[slot] = potionStack(stack.base, moved);
  }
  stack.quantity -= moved;
  pack.tidy();
  return null;
}

/** Moves a belt slot's potions back into the pack. Returns why it failed, or null. */
export function beltToPack(
  sim: Sim,
  bearer: Unit,
  pack: Pack,
  merc: Unit,
  slot: number,
): string | null {
  const stack = merc.belt[slot];
  if (!stack) {
    return null;
  }
  const blocked = cannotHand(sim, bearer, merc) ?? pack.refuses(stack);
  if (blocked) {
    return blocked;
  }
  merc.belt[slot] = null;
  pack.add(stack);
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
