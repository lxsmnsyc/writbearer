import { RAISE_SHARE, type RaiseOptions, raisableNear, raise, raisedBy } from '../raise';
import { type Skill, Targeting } from '../skill';
import type Sim from '../sim';
import { Side } from '../types';
import type Unit from '../unit';
import { type Warning, warn } from '../warning';
import type { MonsterCtx } from './monster';

/** What makes a unit a raiser. */
export interface RaiserSpec extends RaiseOptions {
  // Most units it keeps alive at once
  cap?: number;
}

// How far from itself a raiser sees a body, and how near it stands to cast
const SEEK = 9;
const RAISE_REACH = 3.5;
// The most a raiser keeps alive at once, by default
const RAISE_CAP = 3;
// Seconds of the long cast
const RAISE_WINDUP = 2.2;

// Raisers and their rules, by unit. Never saved.
const RAISERS = new WeakMap<Unit, RaiserSpec>();
// The body a raiser casts over, and the ring it shows there
const PICKED = new WeakMap<Unit, Unit>();
const SHOWN = new WeakMap<Unit, Warning>();

// The nearest body it may raise, if it has room for another.
function pickBody(u: Unit, reach: number): Unit | null {
  if (raisedBy(u).length >= (RAISERS.get(u)?.cap ?? RAISE_CAP)) {
    return null;
  }
  return raisableNear(u.sim, u, reach).at(0) ?? null;
}

/**
 * Raise Dead. A long cast over the nearest fallen monster in reach: it stands
 * up as a weaker undead on the raiser's side. A stun breaks the cast and the
 * body stays.
 */
export const RAISE_DEAD: Skill = {
  id: 'raiseDead',
  name: 'Raise Dead',
  describe: () =>
    `A long cast that raises a fallen monster nearby at ${RAISE_SHARE * 100}% health. Breaking it off with a stun leaves the body.`,
  cost: 0,
  cooldown: 4,
  windup: RAISE_WINDUP,
  recovery: 0.5,
  targeting: Targeting.Self,
  wants(u) {
    return RAISERS.has(u) && pickBody(u, RAISE_REACH) !== null;
  },
  elite() {
    return false;
  },
  release(u) {
    const spec = RAISERS.get(u);
    const body = PICKED.get(u) ?? pickBody(u, RAISE_REACH);
    PICKED.delete(u);
    if (spec && body) {
      raise(u, body, spec);
    }
  },
};

/** Makes a unit a raiser: it gains Raise Dead and raiserStep drives it. */
export function markRaiser(u: Unit, spec: RaiserSpec): void {
  RAISERS.set(u, spec);
  if (!u.skills.includes(RAISE_DEAD)) {
    u.skills.push(RAISE_DEAD);
  }
}

/** Whether a unit is a raiser. */
export function isRaiser(u: Unit): boolean {
  return RAISERS.has(u);
}

// Lifts the ring of a cast that is over, broken off or not.
function clearRing(sim: Sim, u: Unit): void {
  const shown = SHOWN.get(u);
  if (!shown) {
    return;
  }
  SHOWN.delete(u);
  const i = sim.warnings.indexOf(shown);
  if (i >= 0) {
    sim.warnings.splice(i, 1);
  }
}

/**
 * A raiser's turn. With a body in reach it casts Raise Dead over it, a ring
 * on the ground showing where; with one farther off it walks there, nearest
 * first. With none, or with its brood at the cap, it falls through to the
 * usual steps and keeps behind its allies.
 */
export default function raiserStep(sim: Sim, u: Unit, dt: number, _ctx: MonsterCtx): boolean {
  if (!RAISERS.has(u)) {
    return false;
  }
  clearRing(sim, u);
  const body = pickBody(u, SEEK);
  if (!body) {
    return false;
  }
  u.target = null;
  if (u.distanceTo(body) > RAISE_REACH) {
    u.travel(body.x, body.z, dt, RAISE_REACH - 0.5);
    return true;
  }
  if (u.canCast(RAISE_DEAD) && u.startCast(RAISE_DEAD, null)) {
    PICKED.set(u, body);
    SHOWN.set(
      u,
      warn(sim, {
        x: body.x,
        z: body.z,
        shape: { kind: 'circle', r: 0.9 },
        windup: RAISE_WINDUP,
        spare: Side.Monster,
        source: u,
        strike: () => {},
      }),
    );
  }
  // On cooldown, it waits by the body
  return true;
}
