import { reveal } from '../concealment';
import { Side } from '../types';
import type Sim from '../sim';
import type Unit from '../unit';
import { nearest } from './common';
import sidestep from './dodge';
import { Hunt } from './monster';

// How near a ward keeps to the bearer, and how near a monster comes before
// it shies away from it, toward the bearer
const WARD_FOLLOW = 2.2;
const WARD_SHY = 2.5;
// How near the bearer comes before a ward joins it
const WARD_JOIN = 6;

// How near the bearer a disguised assassin must be to turn on it
const TURN_REACH = 3;

// A ward, such as an Escort's refugee, waits until the bearer comes for it,
// then follows the bearer and never fights. With a monster at hand, it keeps
// the bearer between them as best it can.
export default function thinkWard(sim: Sim, u: Unit, dt: number): void {
  u.target = null;
  const bearer = sim.bearer?.alive ? sim.bearer : null;
  if (bearer && !u.aware && u.distanceTo(bearer) <= WARD_JOIN) {
    u.aware = true;
  }
  if (!bearer || !u.aware || sidestep(sim, u, dt)) {
    return;
  }
  // A disguised assassin walks with the others until its time comes, and
  // then turns on the bearer if near enough.
  if (u.disguise !== null && u.hunt === Hunt.Assassin) {
    u.fuse -= dt;
    if (u.fuse <= 0 && u.distanceTo(bearer) <= TURN_REACH) {
      reveal(u, null);
      return;
    }
  }
  const near = nearest(
    u,
    sim.living(Side.Monster).filter((m) => m.aware && u.distanceTo(m) <= WARD_SHY),
  );
  if (near) {
    const dx = bearer.x - near.x;
    const dz = bearer.z - near.z;
    const d = Math.hypot(dx, dz) || 1;
    u.travel(bearer.x + (dx / d) * 1.2, bearer.z + (dz / d) * 1.2, dt, 0.3);
  } else if (u.distanceTo(bearer) > WARD_FOLLOW) {
    u.travel(bearer.x, bearer.z, dt, WARD_FOLLOW - 0.4);
  }
}
