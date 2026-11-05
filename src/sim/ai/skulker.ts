import { EventPriority } from '../../core/event-emitter';
import { reveal } from '../concealment';
import { SimEvents } from '../events';
import type Sim from '../sim';
import { STUN } from '../statuses';
import { allowed } from '../targeting';
import { DamagePriority, Side } from '../types';
import type Unit from '../unit';
import { engage, nearest } from './common';
import type { MonsterCtx } from './monster';

// Tiles from its quarry at which a hidden skulker shows itself and strikes
const STRIKE_FROM = 2;
// Seconds it stays in view after its blow, before it hides again
const HIDE_AFTER = 1;
// Tiles it backs off before it waits, and the longest it tries
const BACK_OFF = 4;
const BACK_OFF_LIMIT = 3;
// Seconds it waits before the next approach
const WAIT = 3.5;
// Seconds after which a strike that never lands is given up
const STRIKE_LIMIT = 4;

const enum Phase {
  // Hidden and closing on its quarry
  Stalk = 0,
  // In view, striking
  Strike = 1,
  // Backing off and hiding
  Retreat = 2,
  // Hidden and still
  Wait = 3,
}

interface State {
  phase: Phase;
  // Seconds in view since it was last hidden
  seen: number;
  // Seconds spent in the phase
  held: number;
  // Where it stood after its blow
  from: { x: number; z: number };
}

// Skulkers and their state, by unit. Never saved.
const SKULKERS = new WeakMap<Unit, State>();
const WATCHED = new WeakSet<Sim>();

/** Whether a unit is a skulker. */
export function isSkulker(u: Unit): boolean {
  return SKULKERS.has(u);
}

// Goes to the next phase.
function enter(s: State, phase: Phase): void {
  s.phase = phase;
  s.held = 0;
}

// Hides again. Whoever was going for it loses it.
function hide(u: Unit): void {
  u.hidden = true;
  for (const m of u.sim.living()) {
    if (m.target === u) {
      m.target = null;
    }
  }
}

/** Makes a unit a skulker: hidden from the start, and driven by `skulkerStep`. */
export function markSkulker(u: Unit): void {
  SKULKERS.set(u, { phase: Phase.Stalk, seen: 0, held: 0, from: { x: u.x, z: u.z } });
  u.hidden = true;
  const { sim } = u;
  if (WATCHED.has(sim)) {
    return;
  }
  WATCHED.add(sim);
  // Its blow has fallen, hit or miss: it turns to go
  const blow = (source: Unit): void => {
    const s = SKULKERS.get(source);
    if (s && s.phase === Phase.Strike) {
      s.from = { x: source.x, z: source.z };
      enter(s, Phase.Retreat);
    }
  };
  sim.on(SimEvents.UnitMiss, EventPriority.Post, (event) => {
    blow(event.source);
  });
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (event.target.side === Side.Party) {
      blow(event.source);
    }
  });
}

// Who it stalks: the bearer, else the nearest it may target.
function quarryOf(u: Unit, ctx: MonsterCtx): Unit | null {
  const { bearer } = ctx;
  if (bearer && allowed(u, [bearer]).length > 0) {
    return bearer;
  }
  return nearest(u, allowed(u, ctx.party));
}

// Walks away from a spot.
function backOff(u: Unit, from: { x: number; z: number }, dt: number): void {
  const dx = u.x - from.x;
  const dz = u.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  u.target = null;
  u.walkTo(u.x + (dx / d) * 2, u.z + (dz / d) * 2, dt);
}

/**
 * A skulker's turn. It stalks the bearer unseen. Within 2 tiles it shows
 * itself and strikes. Once the blow has fallen it backs off, hides again
 * within a second, and waits a few seconds before it stalks again. A taunt or
 * a stun leaves it to the plain steps.
 */
export default function skulkerStep(_sim: Sim, u: Unit, dt: number, ctx: MonsterCtx): boolean {
  const s = SKULKERS.get(u);
  if (!s || ctx.taunt || u.statuses.has(STUN.id)) {
    return false;
  }
  s.held += dt;
  // Seen again, by a hit or by its own blow: hidden soon, once it is done striking
  if (!u.hidden && s.phase !== Phase.Stalk && s.phase !== Phase.Strike) {
    s.seen += dt;
    if (s.seen >= HIDE_AFTER) {
      hide(u);
      s.seen = 0;
    }
  }
  if (s.phase === Phase.Stalk) {
    const quarry = quarryOf(u, ctx);
    if (!quarry) {
      return false;
    }
    if (u.distanceTo(quarry) > STRIKE_FROM) {
      u.target = quarry;
      u.travel(quarry.x, quarry.z, dt, STRIKE_FROM * 0.5);
      return true;
    }
    reveal(u, null);
    enter(s, Phase.Strike);
  }
  if (s.phase === Phase.Strike) {
    const quarry = quarryOf(u, ctx);
    if (!quarry) {
      return false;
    }
    if (s.held <= STRIKE_LIMIT) {
      engage(u, quarry, dt);
      return true;
    }
    // The blow never landed
    s.from = { x: u.x, z: u.z };
    enter(s, Phase.Retreat);
  }
  if (s.phase === Phase.Retreat) {
    backOff(u, s.from, dt);
    const far = Math.hypot(u.x - s.from.x, u.z - s.from.z) >= BACK_OFF;
    if ((far || s.held >= BACK_OFF_LIMIT) && u.hidden) {
      enter(s, Phase.Wait);
    }
    return true;
  }
  // Waiting, then stalking again
  u.target = null;
  if (s.held >= WAIT) {
    enter(s, Phase.Stalk);
  }
  return true;
}
