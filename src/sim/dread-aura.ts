import { EventPriority } from '../core/event-emitter';
import { SimEvents } from './events';
import { DREAD } from './statuses';
import { hostiles } from './targeting';
import type Unit from './unit';

/** A value fixed once, or read again each second so a power can change. */
type Reading = number | ((u: Unit) => number);

/** How a unit frightens those near it. */
export interface DreadAuraOptions {
  // Tiles from the unit in which its Dread reaches
  radius: Reading;
  // Dread built up in each victim every second
  perSecond: Reading;
  // Whether it rings now, read each second. Default: always.
  active?: (u: Unit) => boolean;
}

const read = (r: Reading, u: Unit): number => (typeof r === 'function' ? r(u) : r);

/**
 * An aura of Dread. Once a second, while the unit is alive and aware and
 * `active` allows, each unit it may target within `radius` builds up Dread
 * from it. The bearer never takes Dread, and Brave and Devout units resist
 * it, through the status.
 */
export default function dreadAura(u: Unit, options: DreadAuraOptions): void {
  const { sim } = u;
  let tick = 0;
  sim.on(SimEvents.Tick, EventPriority.Post, (event) => {
    if (!u.alive || !u.aware) {
      return;
    }
    tick += event.dt;
    if (tick < 1) {
      return;
    }
    tick -= 1;
    if (options.active && !options.active(u)) {
      return;
    }
    const radius = read(options.radius, u);
    const amount = read(options.perSecond, u);
    for (const victim of hostiles(u)) {
      if (victim !== sim.bearer && u.distanceTo(victim) <= radius) {
        victim.buildUp(DREAD, u, amount);
      }
    }
  });
}
