import { Range, Rank, Side } from '../types';
import type Sim from '../sim';
import { TAUNTED } from '../statuses';
import { allowed, forbids } from '../targeting';
import type Unit from '../unit';
import type { Zone } from '../zone';
import { engage, nearest } from './common';
import flyerStep from './flyer';
import kidnapperStep from './kidnapper';
import thiefStep from './thief';

/** What a monster goes for. */
export const enum Hunt {
  Bearer = 0,
  Nearest = 1,
  // Goes for the bearer and does not stop for anyone in the way
  Assassin = 2,
  // Stays behind its allies and keeps away from the party
  Support = 3,
}

// A monster that notices the party wakes every monster this close to it.
const PACK_RADIUS = 3;
// Mercs carry no lantern, so monsters notice them from closer.
const UNLIT_NOTICE = 0.75;

// A monster's skills, used whenever their rule says so.
export function monsterSkill(sim: Sim, u: Unit, target: Unit | null): boolean {
  for (const skill of u.skills) {
    if (u.canCast(skill) && skill.wants(u, target, sim) && u.startCast(skill, target)) {
      return true;
    }
  }
  return false;
}

// How far a support monster keeps from the party, and from its allies.
const SUPPORT_GAP = 4.5;
const SUPPORT_NEAR = 2.5;

// Keeps behind its allies, out of the party's reach.
export function support(sim: Sim, u: Unit, party: Unit[], dt: number): void {
  const threat = nearest(u, party);
  if (threat && u.distanceTo(threat) <= u.kit.reach) {
    engage(u, threat, dt);
    return;
  }
  u.target = threat;
  const allies = sim.living(Side.Monster).filter((m) => m !== u && m.aware);
  const ally = nearest(u, allies);
  if (threat && u.distanceTo(threat) < SUPPORT_GAP) {
    // Step back, away from the party.
    const dx = u.x - threat.x;
    const dz = u.z - threat.z;
    const d = Math.hypot(dx, dz) || 1;
    u.walkTo(u.x + (dx / d) * 2, u.z + (dz / d) * 2, dt);
  } else if (ally && u.distanceTo(ally) > SUPPORT_NEAR) {
    u.travel(ally.x, ally.z, dt, SUPPORT_NEAR);
  }
}

// The nearest decoy of the party's drawing this monster in, if any.
function lureFor(sim: Sim, u: Unit): Zone | undefined {
  return sim.zones
    .filter(
      (z) =>
        z.lure !== undefined &&
        z.owner.side !== u.side &&
        u.distanceTo(z) <= z.lure &&
        !forbids(u, z.owner),
    )
    .sort((a, b) => u.distanceTo(a) - u.distanceTo(b))
    .at(0);
}

// How near a ranged monster lets the party come before it steps back, and
// how far it steps
const KEEP_BACK = 3;
const STEP_BACK = 2.5;
/** How near its horn post a herald comes to blow it. */
export const ALARM_REACH = 1.2;
// A marked monster runs for help once its health falls below this share.
const RUN_AT = 0.5;

// Wakes every monster within a pack's reach of a spot.
function wakePack(sim: Sim, at: { x: number; z: number }): void {
  for (const m of sim.living(Side.Monster)) {
    if (Math.hypot(m.x - at.x, m.z - at.z) <= PACK_RADIUS) {
      m.aware = true;
    }
  }
}

/**
 * A Hunt's marked monster, badly hurt, runs once to the nearest pack still
 * unaware and wakes it. A taunt stops it. Returns whether it is running.
 */
function runForHelp(sim: Sim, u: Unit, dt: number, taunted: boolean): boolean {
  if (u.marked && !u.ran && u.hp < u.derived.maxHp * RUN_AT) {
    u.ran = true;
    const help = sim
      .living(Side.Monster)
      .filter((m) => !m.aware && m.distanceTo(u) > PACK_RADIUS)
      .sort((a, b) => u.distanceTo(a) - u.distanceTo(b))
      .at(0);
    u.runningTo = help ? { x: help.x, z: help.z } : null;
  }
  const to = u.runningTo;
  if (!to || taunted) {
    u.runningTo = null;
    return false;
  }
  u.target = null;
  if (u.travel(to.x, to.z, dt, PACK_RADIUS - 1)) {
    wakePack(sim, to);
    u.runningTo = null;
  }
  return true;
}

/** What a step of a monster's turn knows about it. */
export interface MonsterCtx {
  // The party and those it keeps safe
  party: Unit[];
  bearer: Unit | null;
  // The taunt that holds it, unless it may not target the taunter
  taunt: { source: Unit } | undefined;
}

/** One step of a monster's turn. Returns true when it handled the tick. */
export type MonsterStep = (sim: Sim, u: Unit, dt: number, ctx: MonsterCtx) => boolean;

// Runs once to wake a pack when badly hurt and marked.
function runStep(sim: Sim, u: Unit, dt: number, ctx: MonsterCtx): boolean {
  return runForHelp(sim, u, dt, ctx.taunt !== undefined);
}

// A herald runs for its horn post, unless taunted.
function heraldStep(_sim: Sim, u: Unit, dt: number, ctx: MonsterCtx): boolean {
  if (u.alarm && !ctx.taunt) {
    u.target = null;
    u.travel(u.alarm.x, u.alarm.z, dt, ALARM_REACH);
    return true;
  }
  return false;
}

// A decoy draws in what is not taunted, bosses aside.
function lureStep(sim: Sim, u: Unit, dt: number, ctx: MonsterCtx): boolean {
  const bait = ctx.taunt || u.rank === Rank.Boss ? undefined : lureFor(sim, u);
  if (bait) {
    u.target = null;
    u.travel(bait.x, bait.z, dt, 0.6);
    return true;
  }
  return false;
}

// Casts a skill whose rule says so.
function skillStep(sim: Sim, u: Unit, _dt: number, ctx: MonsterCtx): boolean {
  const current = u.target && forbids(u, u.target) ? null : u.target;
  return monsterSkill(sim, u, ctx.taunt?.source ?? current);
}

// A support monster keeps behind its allies.
function supportStep(sim: Sim, u: Unit, dt: number, ctx: MonsterCtx): boolean {
  if (u.hunt === Hunt.Support && !ctx.taunt) {
    support(sim, u, allowed(u, ctx.party), dt);
    return true;
  }
  return false;
}

// Goes for a target, last of the steps: it always handles the tick.
function pursueStep(sim: Sim, u: Unit, dt: number, ctx: MonsterCtx): boolean {
  const { party, bearer, taunt } = ctx;
  // It goes only for whom it can see. Losing sight of its quarry, it walks
  // to where it saw it last, and waits there.
  const seen = allowed(u, party).filter((p) => sim.sees(u, p));
  let target: Unit | null;
  if (taunt?.source.alive) {
    target = taunt.source;
  } else if (
    (u.hunt === Hunt.Bearer || u.hunt === Hunt.Assassin) &&
    bearer &&
    seen.includes(bearer)
  ) {
    target = bearer;
  } else {
    target = nearest(u, seen);
  }
  if (!target) {
    u.target = null;
    const last = u.lastSeen;
    if (last && u.travel(last.x, last.z, dt, 0.3)) {
      u.lastSeen = null;
    }
    return true;
  }
  u.lastSeen = { x: target.x, z: target.z };
  // A ranged monster steps back from whoever comes too close, unless taunted.
  // It steps back from anyone close, forbidden or not: this is distance, not a choice of target.
  if (u.job.range === Range.Ranged && !taunt) {
    const close = nearest(u, party);
    if (close && u.distanceTo(close) < KEEP_BACK) {
      const d = u.distanceTo(close) || 1;
      const away = sim.clamp({
        x: u.x + ((u.x - close.x) / d) * STEP_BACK,
        z: u.z + ((u.z - close.z) / d) * STEP_BACK,
      });
      if (sim.nav?.walkable(away.x, away.z) !== false) {
        u.target = target;
        u.travel(away.x, away.z, dt, 0.3);
        return true;
      }
    }
  }
  // A party member standing in reach is in the way, and gets hit first.
  // The monster still counts as going for its real target, so mercs that
  // guard the bearer see it coming.
  // A taunted monster has eyes only for its taunter.
  const intended = target;
  const melee = u.job.range === Range.Melee;
  if (
    melee &&
    !taunt?.source.alive &&
    u.hunt !== Hunt.Assassin &&
    u.distanceTo(target) > u.kit.reach
  ) {
    const blocker = allowed(u, party).find((p) => p !== target && u.distanceTo(p) <= u.kit.reach);
    if (blocker) {
      target = blocker;
    }
  }
  engage(u, target, dt);
  u.target = intended;
  return true;
}

/**
 * A monster's turn as an ordered list of steps. The first to return true
 * ends the turn. A new behavior adds a module and inserts one step here.
 */
export const MONSTER_STEPS: MonsterStep[] = [
  runStep,
  heraldStep,
  lureStep,
  kidnapperStep,
  thiefStep,
  flyerStep,
  skillStep,
  supportStep,
  pursueStep,
];

export function thinkMonster(sim: Sim, u: Unit, dt: number): void {
  if (u.still) {
    u.target = null;
    return;
  }
  const party = sim.foes(Side.Monster);
  if (!u.aware) {
    const noticed = party.some(
      (p) =>
        u.distanceTo(p) <= u.kit.notice * (p === sim.bearer ? 1 : UNLIT_NOTICE) && sim.sees(u, p),
    );
    if (!noticed) {
      return;
    }
    wakePack(sim, u);
  }
  const bearer = sim.bearer?.alive ? sim.bearer : null;
  // A taunted monster goes for whoever taunted it.
  // A taunt from a unit it may not target is ignored.
  const taunted = u.statuses.get(TAUNTED.id);
  const taunt = taunted && !forbids(u, taunted.source) ? taunted : undefined;
  const ctx: MonsterCtx = { party, bearer, taunt };
  for (const step of MONSTER_STEPS) {
    if (step(sim, u, dt, ctx)) {
      return;
    }
  }
}
