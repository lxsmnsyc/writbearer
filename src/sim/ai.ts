import { honoursElites, prioritiesFollowed } from './morale';
import { Shout, acting, responseDelay } from './shout';
import type Sim from './sim';
import { SkillMode } from './skill';
import { MENDING, REFRESHING, TAUNTED } from './statuses';
import { Rank, Side } from './types';
import type Unit from './unit';
import { type Warning, inside } from './warning';
import type { Zone } from './zone';

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
  // Drinks a healing potion from the belt below this share of health
  drinkAt: number;
}

/** The belt rules a player can pick, from the mercenaries design. */
export const DRINK_AT = { half: 0.5, low: 0.3, emergency: 0.15 } as const;
// A merc with skills drinks for mana below this share, but only in a fight.
const MANA_AT = 0.25;

export const DEFAULT_TOGGLES: Toggles = {
  stance: Stance.Guard,
  priorities: [Priority.AttackingBearer, Priority.Nearest],
  chase: 7,
  skills: {},
  drinkAt: DRINK_AT.low,
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
const PACK_RADIUS = 3;
// Mercs carry no lantern, so monsters notice them from closer.
const UNLIT_NOTICE = 0.75;
// How traits bend a merc's orders.
const BLOODTHIRSTY_CHASE = 3;
const LOYAL_CHASE = 2;
const COWARD_AT = 0.25;

// Mana a merc that heals keeps back for its healing skills.
const HEAL_RESERVE = 25;
// How close Hold mercs let enemies come before fighting.
const HOLD_RADIUS = 2;
// How far from the bearer rallied mercs fight, and how far behind it they
// fall back, in tiles.
const RALLY_CHASE = 2;
const FALL_BACK = 1.6;

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
  // A healer keeps mana back for its healing.
  const reserve = u.skills.some((s) => s.mends === true) ? HEAL_RESERVE : 0;
  for (const skill of u.skills) {
    const mode = skillMode(toggles, skill.id);
    if (mode === SkillMode.Off || !u.canCast(skill)) {
      continue;
    }
    if (skill.mends !== true && u.mana - u.skillCost(skill) < reserve) {
      continue;
    }
    const aimed = skill.aim ? skill.aim(u, sim) : target;
    if ((skill.aim && !aimed) || !skill.wants(u, aimed, sim)) {
      continue;
    }
    if (mode === SkillMode.Elites && !skill.elite(u, aimed, sim)) {
      continue;
    }
    if (u.startCast(skill, aimed)) {
      return true;
    }
  }
  return false;
}

// A merc's orders as its traits bend them.
function withTraits(u: Unit, toggles: Toggles): Toggles {
  let { chase, priorities } = toggles;
  if (u.traits.includes('bloodthirsty')) {
    chase += BLOODTHIRSTY_CHASE;
  }
  if (u.traits.includes('loyal')) {
    chase -= LOYAL_CHASE;
  }
  if (u.traits.includes('gloryseeker')) {
    priorities = [Priority.Elites, ...priorities.filter((p) => p !== Priority.Elites)];
  }
  return { ...toggles, chase, priorities };
}

// A merc's orders as far as its Discipline keeps them: only its first few
// target priorities, and skills saved for elites spent on anything once it
// is too unruly to hold them.
function obeyed(u: Unit, toggles: Toggles): Toggles {
  const priorities = toggles.priorities.slice(0, prioritiesFollowed(u));
  if (honoursElites(u)) {
    return { ...toggles, priorities };
  }
  const skills = Object.fromEntries(
    Object.entries(toggles.skills).map(([id, mode]) => [
      id,
      mode === SkillMode.Elites ? SkillMode.Auto : mode,
    ]),
  );
  return { ...toggles, priorities, skills };
}

// Runs to the bearer's far side from the nearest threat, out of the fight.
function fallBack(sim: Sim, u: Unit, bearer: Unit, dt: number): void {
  u.target = null;
  const threat = nearest(
    bearer,
    sim.living(Side.Monster).filter((e) => e.aware),
  );
  const mercs = sim.living(Side.Party).filter((m) => m !== bearer);
  const spread = (mercs.indexOf(u) - (mercs.length - 1) / 2) * 0.9;
  let dx = -Math.cos(bearer.angle);
  let dz = -Math.sin(bearer.angle);
  if (threat) {
    const d = bearer.distanceTo(threat) || 1;
    dx = (bearer.x - threat.x) / d;
    dz = (bearer.z - threat.z) / d;
  }
  // A merc still on the threat's side goes round the bearer, not through it.
  const behind = (u.x - bearer.x) * dx + (u.z - bearer.z) * dz;
  if (behind < FALL_BACK / 2) {
    const side = spread >= 0 ? 1 : -1;
    u.travel(
      bearer.x + (dx - dz * side) * FALL_BACK,
      bearer.z + (dz + dx * side) * FALL_BACK,
      dt,
      0.3,
    );
    return;
  }
  u.travel(
    bearer.x + dx * FALL_BACK - dz * spread,
    bearer.z + dz * FALL_BACK + dx * spread,
    dt,
    0.3,
  );
}

function thinkMerc(sim: Sim, u: Unit, dt: number): void {
  let toggles = withTraits(u, obeyed(u, u.toggles ?? DEFAULT_TOGGLES));
  const bearer = sim.bearer?.alive ? sim.bearer : null;
  // A coward near death runs from the nearest enemy.
  if (u.traits.includes('cowardly') && u.hp < u.derived.maxHp * COWARD_AT) {
    const threat = nearest(
      u,
      sim.living(Side.Monster).filter((e) => e.aware),
    );
    if (threat && u.distanceTo(threat) <= u.kit.sight) {
      flee(u, threat, dt);
      return;
    }
  }
  // The bearer's shout overrides the merc's orders while it lasts.
  const heard = acting(sim, u);
  if (heard?.shout === Shout.FallBack && bearer) {
    fallBack(sim, u, bearer, dt);
    return;
  }
  if (heard?.shout === Shout.Focus && heard.target) {
    if (useSkill(sim, u, toggles, heard.target)) {
      u.target = heard.target;
    } else {
      engage(u, heard.target, dt);
    }
    return;
  }
  if (heard?.shout === Shout.Rally) {
    toggles = { ...toggles, stance: Stance.Guard, chase: Math.min(toggles.chase, RALLY_CHASE) };
  } else if (heard?.shout === Shout.Hold) {
    toggles = { ...toggles, stance: Stance.Hold };
  }
  const enemies = sim.living(Side.Monster).filter((e) => {
    if (bearer && e.distanceTo(bearer) > toggles.chase) {
      return false;
    }
    if (toggles.stance === Stance.Hold) {
      return u.distanceTo(e) <= HOLD_RADIUS + u.kit.reach && sim.sees(u, e);
    }
    // With no bearer left to keep to, a merc goes after every enemy that is
    // up, as at the end, in the Creditor's tomb.
    if (!bearer) {
      return e.aware;
    }
    // Only what the merc or the bearer can see: nothing behind a wall.
    return (
      (u.distanceTo(e) <= u.kit.sight && sim.sees(u, e)) ||
      (e.distanceTo(bearer) <= u.kit.sight && sim.sees(bearer, e))
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
  // Up to four mercs: the first two at the bearer's sides, the next two
  // further back or further out.
  const side = slot % 2 === 0 ? 1 : -1;
  const row = Math.floor(slot / 2);
  const advance = toggles.stance === Stance.Advance;
  const ahead = advance ? 2.5 - row * 0.8 : 0.6 - row * 1.2;
  const spread = (advance ? 0.8 : 1.1) * (u.traits.includes('loyal') ? 0.75 : 1) + row * 0.6;
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

// The nearest decoy of the party's drawing this monster in, if any.
function lureFor(sim: Sim, u: Unit): Zone | undefined {
  return sim.zones
    .filter((z) => z.lure !== undefined && z.owner.side !== u.side && u.distanceTo(z) <= z.lure)
    .sort((a, b) => u.distanceTo(a) - u.distanceTo(b))
    .at(0);
}

function thinkMonster(sim: Sim, u: Unit, dt: number): void {
  const party = sim.living(Side.Party);
  if (!u.aware) {
    const noticed = party.some(
      (p) =>
        u.distanceTo(p) <= u.kit.notice * (p === sim.bearer ? 1 : UNLIT_NOTICE) && sim.sees(u, p),
    );
    if (!noticed) {
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
  // A decoy draws in what is not taunted, bosses aside.
  const bait = taunt || u.rank === Rank.Boss ? undefined : lureFor(sim, u);
  if (bait) {
    u.target = null;
    u.travel(bait.x, bait.z, dt, 0.6);
    return;
  }
  if (monsterSkill(sim, u, taunt?.source ?? u.target)) {
    return;
  }
  if (u.hunt === Hunt.Support && !taunt) {
    support(sim, u, party, dt);
    return;
  }
  // It goes only for whom it can see. Losing sight of its quarry, it walks
  // to where it saw it last, and waits there.
  const seen = party.filter((p) => sim.sees(u, p));
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
    return;
  }
  u.lastSeen = { x: target.x, z: target.z };
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

// Drinks from the belt by the merc's rules. Drinking takes no time.
function drinkFromBelt(u: Unit, toggles: Toggles): void {
  if (u.potionCooldown > 0) {
    return;
  }
  const heal = u.beltPotion('health');
  if (heal && u.hp < u.derived.maxHp * toggles.drinkAt && !u.statuses.has(MENDING.id)) {
    u.drink(heal);
    return;
  }
  const mana = u.beltPotion('mana');
  if (
    mana &&
    u.skills.length > 0 &&
    u.target?.alive === true &&
    u.mana < u.derived.maxMana * MANA_AT &&
    !u.statuses.has(REFRESHING.id)
  ) {
    u.drink(mana);
  }
}

/** One unit's decision for this tick. Units mid-swing are committed to it. */
export function think(sim: Sim, u: Unit, dt: number): void {
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
  if (u === sim.bearer) {
    if (u.order && u.travel(u.order.x, u.order.z, dt, 0.01)) {
      u.order = null;
    }
    return;
  }
  if (u.side === Side.Party) {
    if (!sidestep(sim, u, dt)) {
      thinkMerc(sim, u, dt);
    }
  } else {
    thinkMonster(sim, u, dt);
  }
}

// How far past a warning's edge a merc steps to be clear of it
const CLEAR = 0.8;

// Where to step to be out of a warning: away from its middle, or to the
// near side of a line.
function outOf(w: Warning, u: Unit): { x: number; z: number } {
  const s = w.shape;
  if (s.kind === 'line') {
    const dx = s.x2 - w.x;
    const dz = s.z2 - w.z;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((u.x - w.x) * dx + (u.z - w.z) * dz) / l2));
    const px = w.x + dx * t;
    const pz = w.z + dz * t;
    const l = Math.sqrt(l2);
    // The side of the line it is on, or the left if right on it
    const side = Math.sign((u.x - px) * (-dz / l) + (u.z - pz) * (dx / l)) || 1;
    const out = s.width / 2 + CLEAR;
    return { x: px + (-dz / l) * side * out, z: pz + (dx / l) * side * out };
  }
  let reach = s.r;
  if (s.kind === 'square') {
    reach = s.r * Math.SQRT2;
  }
  const d = Math.hypot(u.x - w.x, u.z - w.z);
  // Right in the middle, it steps back the way it faces.
  const ax = d > 0.05 ? (u.x - w.x) / d : -Math.cos(u.angle);
  const az = d > 0.05 ? (u.z - w.z) / d : -Math.sin(u.angle);
  return { x: w.x + ax * (reach + CLEAR), z: w.z + az * (reach + CLEAR) };
}

/**
 * A merc in a warning meant for its side steps out of it, once it reacts:
 * as late as it would answer a shout, so a disciplined merc gets clear
 * where an unruly one is still swinging. Returns whether it is stepping.
 */
function sidestep(sim: Sim, u: Unit, dt: number): boolean {
  const w = sim.warnings.find(
    (x) => x.spare !== u.side && x.t >= responseDelay(u) && inside(x, u.x, u.z),
  );
  if (!w) {
    return false;
  }
  const to = outOf(w, u);
  const at = sim.clamp(to);
  u.travel(at.x, at.z, dt);
  return true;
}
