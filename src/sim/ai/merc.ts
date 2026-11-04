import { affinity } from '../elements';
import { SimEvents } from '../events';
import { Shout, acting } from '../shout';
import type Sim from '../sim';
import { SkillMode } from '../skill';
import { allowed, forbids } from '../targeting';
import { Rank, Side } from '../types';
import type Unit from '../unit';
import { MENDING, REFRESHING } from '../statuses';
import { engage, flee, nearest } from './common';
import {
  DEFAULT_TOGGLES,
  MANA_AT,
  Priority,
  Stance,
  type Toggles,
  obeyed,
  skillMode,
  withTraits,
} from './orders';

const COWARD_AT = 0.25;
// Mana a merc that heals keeps back for its healing skills.
const HEAL_RESERVE = 25;
// How close Hold mercs let enemies come before fighting.
const HOLD_RADIUS = 2;
// How far from the bearer rallied mercs fight, and how far behind it they
// fall back, in tiles.
const RALLY_CHASE = 2;
const FALL_BACK = 1.6;

// The enemies that take the most damage from the merc's attack elements, if
// any takes more than normal. CheckAttackElements lets a job add elements.
function weakest(merc: Unit, enemies: Unit[]): Unit[] {
  const check = {
    id: 'CheckAttackElements',
    disabled: false,
    source: merc,
    elements: [merc.attackElement],
  };
  merc.sim.emit(SimEvents.CheckAttackElements, check);
  let best = 100;
  let out: Unit[] = [];
  for (const e of enemies) {
    let score = 0;
    for (const element of check.elements) {
      score = Math.max(score, affinity(element, e.element, e.elementLevel));
    }
    if (score > best) {
      best = score;
      out = [e];
    } else if (score === best && out.length > 0) {
      out.push(e);
    }
  }
  return out;
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
    } else if (p === Priority.Heralds) {
      pool = enemies.filter((e) => e.alarm !== null);
    } else if (p === Priority.WeakToElement) {
      pool = weakest(merc, enemies);
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
    // A skill's own aim can name a hostile unit the rules forbid. An ally is not asked.
    if (aimed && forbids(u, aimed)) {
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

export function thinkMerc(sim: Sim, u: Unit, dt: number): void {
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
  if (heard?.shout === Shout.Focus && heard.target && !forbids(u, heard.target)) {
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
  // How far the merc may chase, after its orders, traits and shouts
  const chaseCheck = { id: 'CheckChase', disabled: false, source: u, value: toggles.chase };
  sim.emit(SimEvents.CheckChase, chaseCheck);
  const chase = chaseCheck.value;
  const enemies = allowed(u, sim.living(Side.Monster)).filter((e) => {
    if (bearer && e.distanceTo(bearer) > chase) {
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

// Drinks from the belt by the merc's rules. Drinking takes no time.
export function drinkFromBelt(u: Unit, toggles: Toggles): void {
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
