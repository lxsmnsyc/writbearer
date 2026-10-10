import type Sim from './sim';
import { SkillMode } from './skill';
import { TAUNTED } from './statuses';
import { Rank, Side } from './types';
import type Unit from './unit';

export const enum Stance {
  // Stays near the bearer when there is nothing to fight
  Guard = 0,
  // Walks ahead of the bearer
  Advance = 1,
  // Stays where it stands and only fights what comes close
  Hold = 2,
}

/** Target priorities, checked in order. The first that matches anyone wins. */
export const enum Priority {
  AttackingBearer = 0,
  Nearest = 1,
  LowestHealth = 2,
  Elites = 3,
  // Monsters with skills of their own, such as healers
  Casters = 4,
}

/** The player's settings for one merc. */
export interface Toggles {
  stance: Stance;
  priorities: Priority[];
  // How far from the bearer the merc may chase, in tiles
  chase: number;
  // How each skill may be used, by skill id. A missing skill is Auto.
  skills: Record<string, SkillMode>;
}

export const DEFAULT_TOGGLES: Toggles = {
  stance: Stance.Guard,
  priorities: [Priority.AttackingBearer, Priority.Nearest],
  chase: 7,
  skills: {},
};

/** A copy of a merc's orders, so changing one never changes another. */
export function copyToggles(toggles: Toggles): Toggles {
  return { ...toggles, priorities: [...toggles.priorities], skills: { ...toggles.skills } };
}

/** Gives a merc new standing orders. The merc keeps its own copy. */
export function setToggles(unit: Unit, toggles: Toggles): void {
  unit.toggles = copyToggles(toggles);
}

/** How a merc may use a skill, under its orders. */
export function skillMode(toggles: Toggles, id: string): SkillMode {
  return toggles.skills[id] ?? SkillMode.Auto;
}

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
const PACK_RADIUS = 4;
// How close Hold mercs let enemies come before fighting.
const HOLD_RADIUS = 2;

function nearest(from: Unit, units: Unit[]): Unit | null {
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const u of units) {
    const d = from.distanceTo(u);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

function pick(merc: Unit, toggles: Toggles, bearer: Unit | null, enemies: Unit[]): Unit | null {
  for (const p of toggles.priorities) {
    let pool: Unit[];
    if (p === Priority.AttackingBearer) {
      pool = bearer ? enemies.filter((e) => e.target === bearer) : [];
    } else if (p === Priority.Elites) {
      pool = enemies.filter((e) => e.rank !== Rank.Normal);
    } else if (p === Priority.Casters) {
      pool = enemies.filter((e) => e.skills.length > 0);
    } else {
      pool = enemies;
    }
    if (pool.length === 0) {
      continue;
    }
    if (p === Priority.LowestHealth) {
      return pool.reduce((a, b) => (b.hp < a.hp ? b : a));
    }
    return nearest(merc, pool);
  }
  return nearest(merc, enemies);
}

// Moves toward a target and attacks once in reach.
function engage(u: Unit, target: Unit, dt: number): void {
  u.target = target;
  if (u.distanceTo(target) <= u.kit.reach) {
    u.face(target);
    u.startAttack(target);
  } else {
    u.travel(target.x, target.z, dt, u.kit.reach * 0.9);
  }
}

// Uses the first skill the merc's orders allow and its rule wants.
function useSkill(sim: Sim, u: Unit, toggles: Toggles, target: Unit | null): boolean {
  for (const skill of u.skills) {
    const mode = skillMode(toggles, skill.id);
    if (mode === SkillMode.Off || !u.canCast(skill) || !skill.wants(u, target, sim)) {
      continue;
    }
    if (mode === SkillMode.Elites && !skill.elite(u, target, sim)) {
      continue;
    }
    if (u.startCast(skill, target)) {
      return true;
    }
  }
  return false;
}

function thinkMerc(sim: Sim, u: Unit, dt: number): void {
  const toggles = u.toggles ?? DEFAULT_TOGGLES;
  const bearer = sim.bearer?.alive ? sim.bearer : null;
  const enemies = sim.living(Side.Monster).filter((e) => {
    if (bearer && e.distanceTo(bearer) > toggles.chase) {
      return false;
    }
    if (toggles.stance === Stance.Hold) {
      return u.distanceTo(e) <= HOLD_RADIUS + u.kit.reach;
    }
    return (
      u.distanceTo(e) <= u.kit.sight || (bearer !== null && e.distanceTo(bearer) <= u.kit.sight)
    );
  });
  const target = pick(u, toggles, bearer, enemies);
  if (useSkill(sim, u, toggles, target)) {
    u.target = target;
    return;
  }
  if (target) {
    engage(u, target, dt);
    return;
  }
  u.target = null;
  if (!bearer || toggles.stance === Stance.Hold) {
    return;
  }
  // Guard spots sit to each side of the bearer. Advance spots sit ahead.
  const mercs = sim.living(Side.Party).filter((m) => m !== bearer);
  const slot = mercs.indexOf(u);
  const side = slot % 2 === 0 ? 1 : -1;
  const ahead = toggles.stance === Stance.Advance ? 2.5 : 0.6;
  const spread = toggles.stance === Stance.Advance ? 0.8 : 1.1;
  const a = bearer.angle;
  const gx = bearer.x + Math.cos(a) * ahead - Math.sin(a) * spread * side;
  const gz = bearer.z + Math.sin(a) * ahead + Math.cos(a) * spread * side;
  u.travel(gx, gz, dt, 0.3);
}

// A monster's skills, used whenever their rule says so.
function monsterSkill(sim: Sim, u: Unit, target: Unit | null): boolean {
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
function support(sim: Sim, u: Unit, party: Unit[], dt: number): void {
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

// Runs from whatever frightens it.
function flee(u: Unit, from: Unit, dt: number): void {
  const dx = u.x - from.x;
  const dz = u.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  u.target = null;
  u.walkTo(u.x + (dx / d) * 2, u.z + (dz / d) * 2, dt);
}

function thinkMonster(sim: Sim, u: Unit, dt: number): void {
  const party = sim.living(Side.Party);
  if (!u.aware) {
    if (!party.some((p) => u.distanceTo(p) <= u.kit.sight)) {
      return;
    }
    for (const m of sim.living(Side.Monster)) {
      if (m.distanceTo(u) <= PACK_RADIUS) {
        m.aware = true;
      }
    }
  }
  const bearer = sim.bearer?.alive ? sim.bearer : null;
  // A taunted monster goes for whoever taunted it.
  const taunt = u.statuses.get(TAUNTED.id);
  if (monsterSkill(sim, u, taunt?.source ?? u.target)) {
    return;
  }
  if (u.hunt === Hunt.Support && !taunt) {
    support(sim, u, party, dt);
    return;
  }
  let target: Unit | null;
  if (taunt?.source.alive) {
    target = taunt.source;
  } else if ((u.hunt === Hunt.Bearer || u.hunt === Hunt.Assassin) && bearer) {
    target = bearer;
  } else {
    target = nearest(u, party);
  }
  if (!target) {
    u.target = null;
    return;
  }
  // A party member standing in reach is in the way, and gets hit first.
  // The monster still counts as going for its real target, so mercs that
  // guard the bearer see it coming.
  // A taunted monster has eyes only for its taunter.
  const intended = target;
  if (!taunt?.source.alive && u.hunt !== Hunt.Assassin && u.distanceTo(target) > u.kit.reach) {
    const blocker = party.find((p) => p !== target && u.distanceTo(p) <= u.kit.reach);
    if (blocker) {
      target = blocker;
    }
  }
  engage(u, target, dt);
  u.target = intended;
}

/** One unit's decision for this tick. Units mid-swing are committed to it. */
export function think(sim: Sim, u: Unit, dt: number): void {
  if (!u.alive || u.busy || u.disabled) {
    return;
  }
  const fear = u.fear;
  if (fear && u !== sim.bearer) {
    flee(u, fear, dt);
    return;
  }
  if (u === sim.bearer) {
    if (u.order && u.travel(u.order.x, u.order.z, dt, 0.01)) {
      u.order = null;
    }
    return;
  }
  if (u.side === Side.Party) {
    thinkMerc(sim, u, dt);
  } else {
    thinkMonster(sim, u, dt);
  }
}
