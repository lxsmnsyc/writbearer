import { SimEvents } from './events';
import type Sim from './sim';
import { Range, ValuePriority } from './types';
import type Unit from './unit';

/**
 * Flyers. While aloft a unit cannot be picked by a melee attacker (a unit
 * whose job fights in melee): ranged attacks, spells and projectiles reach it.
 * It comes down to strike, and a Pin Down shot grounds it. Landing is time
 * based and unconditional, so a party of melee mercs always gets its turn.
 *
 * 'dive' lands when a foe is in reach. 'hover' strikes from the air and only
 * perches now and then.
 */
export type FlightStyle = 'dive' | 'hover';

/** How long a flyer stays down after a dive or a perch, in seconds. */
export const LAND_TIME = 3;
/** The longest a flyer stays aloft in one stretch, in seconds. */
export const ALOFT_MAX = 8;

interface Flight {
  style: FlightStyle;
  // It is grounded until this sim time
  until: number;
  // When it last took off, or null until its step has seen it aloft
  since: number | null;
}

// Per-unit flight state. A unit not in the map does not fly.
const FLYERS = new WeakMap<Unit, Flight>();

/** Gives a unit wings. It starts aloft. */
export function makeFlyer(u: Unit, style: FlightStyle): void {
  FLYERS.set(u, { style, until: u.sim.time, since: null });
}

/** Whether a unit is a flyer, aloft or not. */
export function flies(u: Unit): boolean {
  return FLYERS.has(u);
}

/** A flyer's style, or null for a walker. */
export function flightStyle(u: Unit): FlightStyle | null {
  return FLYERS.get(u)?.style ?? null;
}

/** Whether a unit is in the air right now. */
export function isAloft(u: Unit): boolean {
  const f = FLYERS.get(u);
  return f !== undefined && u.sim.time >= f.until;
}

/** Grounds a flyer for `seconds` of sim time. It never shortens a longer stay. No effect on a walker. */
export function ground(u: Unit, seconds: number): void {
  const f = FLYERS.get(u);
  if (!f) {
    return;
  }
  f.until = Math.max(f.until, u.sim.time + seconds);
  f.since = null;
}

/** A flyer comes down for the usual time. */
export function land(u: Unit): void {
  ground(u, LAND_TIME);
}

/** A flyer rises at once. */
export function takeOff(u: Unit): void {
  const f = FLYERS.get(u);
  if (f) {
    f.until = u.sim.time;
    f.since = null;
  }
}

/**
 * The flyer's turn: it comes down when its style says so, or when it has been
 * up too long. Returns nothing; the usual steps then move and strike.
 */
export function flightTurn(u: Unit, foeInReach: boolean): void {
  const f = FLYERS.get(u);
  if (!f || !isAloft(u)) {
    return;
  }
  f.since ??= u.sim.time;
  if ((f.style === 'dive' && foeInReach) || u.sim.time - f.since >= ALOFT_MAX) {
    land(u);
  }
}

export default function setupFlight(sim: Sim): void {
  // A melee attacker may not pick a unit that is aloft. Same priority as the
  // hidden rule. Area damage is not filtered by CheckTarget, so an area skill
  // still hits a flyer.
  sim.on(SimEvents.CheckTarget, ValuePriority.Post, (event) => {
    if (event.source.job.range === Range.Melee && isAloft(event.target)) {
      event.allowed = false;
    }
  });
}
