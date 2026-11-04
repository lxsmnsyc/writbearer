import type { EquipSlot, Item } from './item';
import type Sim from './sim';
import type Unit from './unit';

// What is stripped in each sim, by unit. Never saved: a save keeps the items,
// and a loaded run starts with everything working.
const STRIPPED = new WeakMap<Sim, Map<Unit, Set<EquipSlot>>>();
// Units already stripped in each sim, and the area it happened in
const STRUCK = new WeakMap<Sim, { area: number; units: Set<Unit> }>();

function slotsOf(sim: Sim, u: Unit): Set<EquipSlot> | undefined {
  return STRIPPED.get(sim)?.get(u);
}

/** The slots of a unit whose item is stripped. */
export function stripped(u: Unit): EquipSlot[] {
  return [...(slotsOf(u.sim, u) ?? [])];
}

/** Whether the item in a slot is stripped. */
export function isStripped(u: Unit, slot: EquipSlot): boolean {
  return slotsOf(u.sim, u)?.has(slot) ?? false;
}

/** The items a unit wears that still work. */
export function workingItems(u: Unit): Item[] {
  const out: Item[] = [];
  for (const [slot, item] of u.equipment) {
    if (!isStripped(u, slot)) {
      out.push(item);
    }
  }
  return out;
}

/** Stops the item in a slot from working. Returns false if nothing was worn there. */
export function strip(u: Unit, slot: EquipSlot): boolean {
  if (!u.equipment.has(slot) || isStripped(u, slot)) {
    return false;
  }
  let units = STRIPPED.get(u.sim);
  if (!units) {
    units = new Map();
    STRIPPED.set(u.sim, units);
  }
  const slots = units.get(u) ?? new Set<EquipSlot>();
  slots.add(slot);
  units.set(u, slots);
  u.recalc();
  u.refreshCards();
  return true;
}

/** Makes the item in a slot work again. Returns false if it was not stripped. */
export function restore(u: Unit, slot: EquipSlot): boolean {
  const units = STRIPPED.get(u.sim);
  const slots = units?.get(u);
  if (!slots?.delete(slot)) {
    return false;
  }
  if (slots.size === 0) {
    units?.delete(u);
  }
  u.recalc();
  u.refreshCards();
  return true;
}

/** Makes everything work again, and lets a unit be stripped anew. */
export function restoreAll(sim: Sim): void {
  const units = STRIPPED.get(sim);
  STRIPPED.delete(sim);
  STRUCK.delete(sim);
  for (const u of units?.keys() ?? []) {
    u.recalc();
    u.refreshCards();
  }
}

/** Whether a unit may still be stripped in this area; marks it when it may. */
export function claim(sim: Sim, u: Unit): boolean {
  let struck = STRUCK.get(sim);
  if (!struck || struck.area !== sim.area) {
    struck = { area: sim.area, units: new Set() };
    STRUCK.set(sim, struck);
  }
  if (struck.units.has(u)) {
    return false;
  }
  struck.units.add(u);
  return true;
}
