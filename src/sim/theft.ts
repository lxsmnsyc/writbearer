import { EventPriority } from '../core/event-emitter';
import { SimEvents } from './events';
import type { Item } from './item';
import type Sim from './sim';
import type Unit from './unit';

/** What a thief takes: one item from the pack, or a share of the gold. */
export type Loot = { item: Item } | { gold: number };

/**
 * The pack, as the sim sees it. The sim has no pack; the run sets this port
 * (src/game/game/theft.ts) and without one nothing can be stolen. The run
 * draws from its own seeded stream, so saves and seeds stay stable.
 */
export interface Pocket {
  // What a thief would take now, or null when there is nothing to take
  pick(): Loot | null;
  // Removes what was picked from the pack
  take(loot: Loot): void;
  // Puts what a thief carried on the ground
  give(loot: Loot, at: { x: number; z: number }): void;
  // Where the party leaves the area, if the run knows
  exits?(): { x: number; z: number }[];
  // A line for the log
  say?(line: string): void;
}

/** Chooses the loot. A thief that wants a named item overrides it. */
export type PickLoot = (pocket: Pocket) => Loot | null;

interface Thief {
  pick: PickLoot;
  // Nothing was in the pack to take: it fights like any monster
  spent: boolean;
  loot: Loot | null;
}

const thieves = new WeakMap<Unit, Thief>();
const watched = new WeakSet<Sim>();

function defaultPick(pocket: Pocket): Loot | null {
  return pocket.pick();
}

/** Makes a unit a thief. `pick` overrides the choice of loot. */
export function markThief(u: Unit, pick: PickLoot = defaultPick): void {
  thieves.set(u, { pick, spent: false, loot: null });
  // A thief that dies drops what it carries
  if (!watched.has(u.sim)) {
    watched.add(u.sim);
    u.sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
      dropLoot(event.source);
    });
  }
}

/** Whether a unit is a thief that may still steal or has stolen. */
export function isThief(u: Unit): boolean {
  return thieves.has(u);
}

/** Whether a thief should still go for the bearer: it has not been spent. */
export function wantsLoot(u: Unit): boolean {
  const thief = thieves.get(u);
  return thief !== undefined && !thief.spent && thief.loot === null;
}

/** What a thief carries now. */
export function carried(u: Unit): Loot | null {
  return thieves.get(u)?.loot ?? null;
}

function describe(loot: Loot): string {
  return 'item' in loot ? (loot.item.name ?? loot.item.base.name) : `${loot.gold} gold`;
}

/** The thief takes loot from the pack. Returns whether it took anything. */
export function steal(u: Unit, sim: Sim): boolean {
  const thief = thieves.get(u);
  const pocket = sim.pocket;
  if (!thief || thief.spent || thief.loot || !pocket) {
    return false;
  }
  const loot = thief.pick(pocket);
  if (!loot) {
    thief.spent = true;
    return false;
  }
  pocket.take(loot);
  thief.loot = loot;
  pocket.say?.(`A thief makes off with ${describe(loot)}.`);
  return true;
}

/** What a thief carried falls where it died. */
export function dropLoot(u: Unit): void {
  const thief = thieves.get(u);
  const pocket = u.sim.pocket;
  if (!thief?.loot || !pocket) {
    return;
  }
  pocket.give(thief.loot, u);
  pocket.say?.(`The thief drops ${describe(thief.loot)}.`);
  thief.loot = null;
}

/** Forgets what a thief carried, as it leaves the map with it. */
export function keepLoot(u: Unit): void {
  const thief = thieves.get(u);
  if (thief) {
    thief.loot = null;
  }
}
