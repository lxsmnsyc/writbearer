import { EventPriority } from '../core/event-emitter';
import { SimEvents } from './events';
import type Sim from './sim';
import type Unit from './unit';

/** A job-defined resource a unit holds beside mana, such as spirit spheres. */
export interface ResourceDef {
  id: string;
  name: string;
  max: number;
  start: number;
  // Amount lost each second. Omitted means none.
  decayPerSecond?: number;
  // Whether the amount stays when the party enters a new area.
  keepAcrossAreas?: boolean;
}

interface Held {
  def: ResourceDef;
  amount: number;
  // The sim area the amount belongs to
  area: number;
}

// Kept here and not on Unit, so a rank raise that reruns passive setup keeps it.
const HELD = new WeakMap<Unit, Map<string, Held>>();
const WATCHED = new WeakSet<Sim>();

/** Registers a resource on the unit at its starting amount. Granting twice keeps the amount. */
export function grant(unit: Unit, def: ResourceDef): void {
  let held = HELD.get(unit);
  if (!held) {
    held = new Map();
    HELD.set(unit, held);
  }
  const old = held.get(def.id);
  if (old) {
    old.def = def;
    old.amount = Math.min(old.amount, def.max);
    return;
  }
  held.set(def.id, {
    def,
    amount: Math.min(def.start, def.max),
    area: unit.sim.area,
  });
  watch(unit.sim);
}

/** The amount the unit holds, or 0 for a resource it lacks. */
export function amountOf(unit: Unit, id: string): number {
  return HELD.get(unit)?.get(id)?.amount ?? 0;
}

/** Adds up to the cap. Returns the amount actually gained. */
export function gain(unit: Unit, id: string, n: number): number {
  const entry = HELD.get(unit)?.get(id);
  if (!entry || n <= 0) {
    return 0;
  }
  const before = entry.amount;
  entry.amount = Math.min(entry.def.max, before + n);
  return entry.amount - before;
}

/** Takes n if the unit has that much, and returns true. Otherwise changes nothing. */
export function spend(unit: Unit, id: string, n: number): boolean {
  const entry = HELD.get(unit)?.get(id);
  if (!entry || entry.amount < n) {
    return false;
  }
  entry.amount -= n;
  return true;
}

/** The unit's resources, in the order granted, for the UI. Empty for most units. */
export function resourcesOf(
  unit: Unit,
): { id: string; name: string; amount: number; max: number }[] {
  const out: { id: string; name: string; amount: number; max: number }[] = [];
  const held = HELD.get(unit);
  if (held) {
    for (const entry of held.values()) {
      out.push({
        id: entry.def.id,
        name: entry.def.name,
        amount: entry.amount,
        max: entry.def.max,
      });
    }
  }
  return out;
}

// One tick listener per sim: resets at an area change, then decays.
function watch(sim: Sim): void {
  if (WATCHED.has(sim)) {
    return;
  }
  WATCHED.add(sim);
  sim.on(SimEvents.Tick, EventPriority.Post, (event) => {
    for (const unit of sim.units) {
      const held = HELD.get(unit);
      if (!held) {
        continue;
      }
      for (const entry of held.values()) {
        if (entry.area !== sim.area) {
          entry.area = sim.area;
          if (entry.def.keepAcrossAreas !== true) {
            entry.amount = Math.min(entry.def.start, entry.def.max);
          }
        }
        const decay = entry.def.decayPerSecond ?? 0;
        if (decay > 0 && unit.alive) {
          entry.amount = Math.max(0, entry.amount - decay * event.dt);
        }
      }
    }
  });
}
