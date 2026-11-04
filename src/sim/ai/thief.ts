import type Sim from '../sim';
import { carried, keepLoot, steal, wantsLoot } from '../theft';
import leaveMap from '../leave';
import type Unit from '../unit';
import type { MonsterCtx } from './monster';

// A thief at this share of its reach from the bearer takes its due.
const GRAB_AT = 0.9;
// How near an exit the thief must come to be gone
const EXIT_REACH = 0.8;

// The nearest open exit, or the farthest map edge when there is none.
function escapeFor(sim: Sim, u: Unit): { x: number; z: number } {
  const exits = sim.pocket?.exits?.() ?? [];
  let best: { x: number; z: number } | null = null;
  for (const e of exits) {
    if (!best || u.distanceTo(e) < u.distanceTo(best)) {
      best = e;
    }
  }
  if (best) {
    return best;
  }
  // The farthest corner of the floor, or straight away from the bearer
  const edges = [
    { x: sim.x0, z: sim.z0 },
    { x: sim.width, z: sim.z0 },
    { x: sim.x0, z: sim.depth },
    { x: sim.width, z: sim.depth },
  ];
  let far: { x: number; z: number } | null = null;
  for (const e of edges) {
    if (
      Number.isFinite(e.x) &&
      Number.isFinite(e.z) &&
      (!far || u.distanceTo(e) > u.distanceTo(far))
    ) {
      far = e;
    }
  }
  return sim.clamp(far ?? { x: u.x + 40, z: u.z });
}

/**
 * A thief goes for the bearer and ignores the rest, takes an item or some
 * gold with one touch, then runs for an exit and is gone. With nothing to
 * take, it fights like any monster.
 */
export default function thiefStep(sim: Sim, u: Unit, dt: number, ctx: MonsterCtx): boolean {
  if (carried(u)) {
    // Running: a stun stops the unit before it gets here, a root or snare
    // slows its feet.
    u.target = null;
    const to = escapeFor(sim, u);
    if (u.travel(to.x, to.z, dt, EXIT_REACH)) {
      // Gone with the item: no death, no drop
      keepLoot(u);
      leaveMap(u);
    }
    return true;
  }
  const bearer = ctx.bearer;
  if (!wantsLoot(u) || !bearer || ctx.taunt) {
    return false;
  }
  if (u.distanceTo(bearer) <= u.kit.reach * GRAB_AT + 0.4) {
    u.target = bearer;
    // Nothing in the pack: steal marks the thief spent and it fights on
    return steal(u, sim);
  }
  u.target = bearer;
  u.travel(bearer.x, bearer.z, dt, u.kit.reach * GRAB_AT);
  return true;
}
