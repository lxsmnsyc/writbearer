import { drag, grab, heldBy, release } from '../grab';
import leaveMap from '../leave';
import type Sim from '../sim';
import { allowed, hostiles } from '../targeting';
import { Side } from '../types';
import type Unit from '../unit';
import { engage, nearest } from './common';
import type { MonsterCtx } from './monster';

const kidnappers = new WeakSet<Unit>();

/** Makes a unit a kidnapper. */
export function markKidnapper(u: Unit): void {
  kidnappers.add(u);
}

/** Whether a unit is a kidnapper. */
export function isKidnapper(u: Unit): boolean {
  return kidnappers.has(u);
}

// How near an exit the kidnapper must come to be gone
const EXIT_REACH = 0.8;
// How far off its line to the goal a foe counts as in the way
const LANE = 1.2;

// The nearest open exit, else the farthest corner of the floor.
function exitFor(sim: Sim, u: Unit): { x: number; z: number } {
  let best: { x: number; z: number } | null = null;
  for (const e of sim.pocket?.exits?.() ?? []) {
    if (!best || u.distanceTo(e) < u.distanceTo(best)) {
      best = e;
    }
  }
  if (best) {
    return best;
  }
  const corners = [
    { x: sim.x0, z: sim.z0 },
    { x: sim.width, z: sim.z0 },
    { x: sim.x0, z: sim.depth },
    { x: sim.width, z: sim.depth },
  ];
  let far = { x: u.x + 40, z: u.z };
  let farD = -1;
  for (const c of corners) {
    if (Number.isFinite(c.x) && Number.isFinite(c.z) && u.distanceTo(c) > farD) {
      far = c;
      farD = u.distanceTo(c);
    }
  }
  return sim.clamp(far);
}

// How far a point is from the segment between two others
function laneDistance(
  p: { x: number; z: number },
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = dx * dx + dz * dz;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
}

// A foe within reach that stands on the kidnapper's way to a goal
function blockerOn(u: Unit, goal: { x: number; z: number }, ctx: MonsterCtx): Unit | null {
  const foes = allowed(u, ctx.party).filter(
    (p) =>
      p.side !== Side.Ward && u.distanceTo(p) <= u.kit.reach && laneDistance(p, u, goal) <= LANE,
  );
  return nearest(u, foes);
}

/**
 * A kidnapper goes for the nearest ward and ignores the rest, takes hold of
 * it by touch, and drags it to an exit; the ward leaves with it and is lost.
 * A foe on its way is fought, not walked through. With no ward in the area,
 * it fights like any monster. A stun, root, fear or kill lets the ward go
 * (src/sim/grab.ts).
 */
export default function kidnapperStep(sim: Sim, u: Unit, dt: number, ctx: MonsterCtx): boolean {
  if (!isKidnapper(u)) {
    return false;
  }
  const victim = heldBy(u);
  if (victim) {
    const to = exitFor(sim, u);
    const blocker = blockerOn(u, to, ctx);
    if (blocker) {
      engage(u, blocker, dt);
      return true;
    }
    u.target = null;
    const arrived = u.travel(to.x, to.z, dt, EXIT_REACH);
    drag(u);
    if (arrived) {
      // Gone with the ward: no death for either
      release(u);
      leaveMap(victim);
      leaveMap(u);
    }
    return true;
  }
  const wards = hostiles(u).filter((w) => w.side === Side.Ward);
  const ward = ctx.taunt ? null : nearest(u, wards);
  if (!ward) {
    return false;
  }
  const blocker = blockerOn(u, ward, ctx);
  if (blocker) {
    engage(u, blocker, dt);
    return true;
  }
  u.target = ward;
  if (u.distanceTo(ward) <= u.kit.reach) {
    u.face(ward);
    grab(u, ward);
    return true;
  }
  u.travel(ward.x, ward.z, dt, u.kit.reach * 0.9);
  return true;
}
