import { SimEvents } from '../events';
import { EQUIP_SLOTS, type EquipSlot } from '../item';
import type Sim from '../sim';
import { claim, isStripped, strip } from '../strip';
import { DamageFlags, DamagePriority, Side } from '../types';
import type Unit from '../unit';

// Strippers by sim, and the sims already listening.
const STRIPPERS = new WeakMap<Sim, WeakSet<Unit>>();
const WATCHED = new WeakSet<Sim>();

/** The slot a stripper takes: the weapon, then armor, then the rest. */
export function pickSlot(target: Unit): EquipSlot | null {
  for (const slot of EQUIP_SLOTS) {
    if (target.equipment.has(slot) && !isStripped(target, slot)) {
      return slot;
    }
  }
  return null;
}

function strike(sim: Sim, source: Unit, target: Unit, flags: number): void {
  // Only a basic attack landing on the party counts
  if ((flags & DamageFlags.BasicAttack) === 0 || target.side !== Side.Party) {
    return;
  }
  if (!STRIPPERS.get(sim)?.has(source) || !source.alive || !target.alive) {
    return;
  }
  const slot = pickSlot(target);
  if (slot === null || !claim(sim, target)) {
    return;
  }
  const item = target.equipment.get(slot);
  strip(target, slot);
  sim.pocket?.say?.(`${source.name} strips ${target.name} of ${item?.name ?? item?.base.name}.`);
}

/** Makes a unit a stripper: each basic attack that lands may strip one item. */
export function markStripper(u: Unit): void {
  const sim = u.sim;
  let set = STRIPPERS.get(sim);
  if (!set) {
    set = new WeakSet();
    STRIPPERS.set(sim, set);
  }
  set.add(u);
  if (!WATCHED.has(sim)) {
    WATCHED.add(sim);
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (event.value > 0) {
        strike(sim, event.source, event.target, event.flags);
      }
    });
  }
}
