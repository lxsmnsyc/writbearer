import type { Lifecycle } from '../../core/lifecycle';
import { EquipSlot, type Item, itemModifiers, weaponOf } from '../item';
import { MENDING, REFRESHING } from '../statuses';
import { type BaseStats, type Modifier, deriveStats } from '../stats';
import type Unit from '../unit';

/** Belt slots each merc has. */
export const BELT_SLOTS = 3;
// Seconds between two potions.
export const POTION_COOLDOWN = 1;

/** One named input to the unit's stat modifiers. */
export interface RecalcSource {
  id: string;
  modifiers(unit: Unit): Modifier[];
}

/**
 * Where `recalc` gets its modifiers, summed in this order (float sums depend
 * on it). To add or filter a source, add a module with one RecalcSource and
 * one entry here, at the place it should sum.
 */
export const RECALC_SOURCES: RecalcSource[] = [
  // The unit's own, from its spec
  { id: 'own', modifiers: (unit) => unit.modifiers },
  { id: 'equipment', modifiers: equipmentModifiers },
  { id: 'statuses', modifiers: statusModifiers },
  // Passives and auras, by the id of what gives them
  { id: 'bonuses', modifiers: bonusModifiers },
];

function equipmentModifiers(unit: Unit): Modifier[] {
  const out: Modifier[] = [];
  for (const item of unit.equipment.values()) {
    out.push(...itemModifiers(item));
  }
  return out;
}

function statusModifiers(unit: Unit): Modifier[] {
  const out: Modifier[] = [];
  for (const st of unit.statuses.values()) {
    out.push(...(st.def.modifiers?.(st) ?? []));
  }
  return out;
}

function bonusModifiers(unit: Unit): Modifier[] {
  const out: Modifier[] = [];
  for (const list of unit.bonuses.values()) {
    out.push(...list);
  }
  return out;
}

/** Spends a stat point on a base stat. Returns false if there is none to spend. */
export function raiseStat(unit: Unit, stat: keyof BaseStats): boolean {
  if (unit.statPoints <= 0) {
    return false;
  }
  unit.statPoints--;
  unit.base[stat]++;
  unit.recalc();
  return true;
}

/**
 * Drinks a potion: from a belt slot, or a given one such as the bearer's
 * from the pack. Returns false if it cannot drink now.
 */
export function drink(unit: Unit, potion: Item): boolean {
  const effect = potion.base.potion;
  if (!unit.alive || !effect || unit.potionCooldown > 0 || potion.quantity <= 0) {
    return false;
  }
  potion.quantity--;
  unit.potionCooldown = POTION_COOLDOWN;
  if (effect.health) {
    unit.addStatus(MENDING, unit, undefined, effect.health);
  }
  if (effect.mana) {
    unit.addStatus(REFRESHING, unit, undefined, effect.mana);
  }
  // An empty stack leaves its belt slot.
  const slot = unit.belt.indexOf(potion);
  if (slot >= 0 && potion.quantity <= 0) {
    unit.belt[slot] = null;
  }
  return true;
}

/** The first potion on the belt that restores health, or mana. */
export function beltPotion(unit: Unit, kind: 'health' | 'mana'): Item | null {
  return unit.belt.find((p) => p !== null && (p.base.potion?.[kind] ?? 0) > 0) ?? null;
}

/** Sets or clears a bonus from a passive or aura. The stats follow at once. */
export function setBonus(unit: Unit, id: string, modifiers: Modifier[] | null): void {
  if (modifiers) {
    unit.bonuses.set(id, modifiers);
  } else if (!unit.bonuses.delete(id)) {
    return;
  }
  unit.recalc();
}

/**
 * Puts an item on, and returns what it replaced. The stats follow at once.
 */
export function equip(unit: Unit, slot: EquipSlot, item: Item): Item | null {
  const before = unit.equipment.get(slot) ?? null;
  unit.equipment.set(slot, item);
  unit.recalc();
  unit.refreshCards();
  return before;
}

/** Takes an item off, and returns it. */
export function unequip(unit: Unit, slot: EquipSlot): Item | null {
  const item = unit.equipment.get(slot) ?? null;
  unit.equipment.delete(slot);
  unit.recalc();
  unit.refreshCards();
  return item;
}

/**
 * Starts the effects of what the unit wears, a unique's or a socketed
 * card's, and stops those of what it no longer wears. Call it after gear
 * or sockets change.
 */
export function refreshCards(unit: Unit): void {
  const worn = new Map<string, (unit: Unit) => Lifecycle>();
  for (const item of unit.equipment.values()) {
    if (item.effect) {
      worn.set(`${item.uid}:unique`, item.effect);
    }
    for (const [i, card] of item.cards.entries()) {
      if (card.socket?.setup) {
        worn.set(`${item.uid}:${i}`, card.socket.setup);
      }
    }
  }
  for (const [key, life] of unit.cardEffects) {
    if (!worn.has(key)) {
      life.stop();
      unit.cardEffects.delete(key);
    }
  }
  for (const [key, setup] of worn) {
    if (!unit.cardEffects.has(key)) {
      const life = setup(unit);
      unit.cardEffects.set(key, life);
      life.start();
    }
  }
}

/**
 * Computes the stats again from their inputs. Call it after any input
 * changes: level, raised stats, gear or a bonus starting or ending.
 */
export function recalc(unit: Unit): void {
  const held = unit.equipment.get(EquipSlot.Weapon);
  const modifiers: Modifier[] = [];
  for (const source of RECALC_SOURCES) {
    modifiers.push(...source.modifiers(unit));
  }
  unit.stats = deriveStats({
    job: unit.job,
    level: unit.level,
    base: unit.base,
    weapon: (held && weaponOf(held)) ?? unit.weapon,
    modifiers,
  });
  unit.hp = Math.min(unit.hp, unit.derived.maxHp);
  unit.mana = Math.min(unit.mana, unit.derived.maxMana);
}
