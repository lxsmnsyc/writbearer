import { flies, flightTurn } from '../flight';
import type Sim from '../sim';
import { allowed } from '../targeting';
import type Unit from '../unit';
import { nearest } from './common';
import type { MonsterCtx } from './monster';

/**
 * A flyer's wings. It never handles the tick: it only decides whether to
 * come down, then the usual steps move and strike. A diver lands once a foe
 * is in reach, a hoverer perches now and then, and both land after a set time
 * aloft, so melee mercs are never left without a target for long.
 */
export default function flyerStep(_sim: Sim, u: Unit, _dt: number, ctx: MonsterCtx): boolean {
  if (!flies(u)) {
    return false;
  }
  const foe = nearest(u, allowed(u, ctx.party));
  flightTurn(u, foe !== null && u.distanceTo(foe) <= u.kit.reach);
  return false;
}
