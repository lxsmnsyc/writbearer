import type Sim from '../sim';
import { forbids } from '../targeting';
import { Side } from '../types';
import type Unit from '../unit';
import { flee } from './common';
import sidestep from './dodge';
import { drinkFromBelt, thinkMerc } from './merc';
import { thinkMonster } from './monster';
import { DEFAULT_TOGGLES } from './orders';
import thinkWard from './ward';

/** One unit's decision for this tick. Units mid-swing are committed to it. */
export default function think(sim: Sim, u: Unit, dt: number): void {
  if (u.alive && u.side === Side.Party && u !== sim.bearer && !u.disabled) {
    drinkFromBelt(u, u.toggles ?? DEFAULT_TOGGLES);
  }
  if (!u.alive || u.busy || u.disabled) {
    return;
  }
  const fear = u.fear;
  if (fear && u !== sim.bearer) {
    flee(u, fear, dt);
    return;
  }
  // A target the rules now forbid is dropped.
  if (u.target && u !== sim.bearer && forbids(u, u.target)) {
    u.target = null;
  }
  if (u === sim.bearer) {
    if (u.order && u.travel(u.order.x, u.order.z, dt, 0.01)) {
      u.order = null;
    }
    return;
  }
  if (u.side === Side.Ward) {
    thinkWard(sim, u, dt);
  } else if (u.side === Side.Party) {
    if (!sidestep(sim, u, dt)) {
      thinkMerc(sim, u, dt);
    }
  } else {
    thinkMonster(sim, u, dt);
  }
}
