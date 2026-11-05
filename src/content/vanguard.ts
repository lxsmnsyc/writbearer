import { EventPriority } from '../core/event-emitter';
import { SimEvents } from '../sim/events';
import { strike } from '../sim/sim';
import { type Passive, type Skill, Targeting } from '../sim/skill';
import { PETRIFY, SHIELD_WALL, STUN, SUNDERED, TAUNTED } from '../sim/statuses';
import { hostiles } from '../sim/targeting';
import { DamageFlags, DamageKind, DamagePriority, Range, Side } from '../sim/types';
import type Unit from '../sim/unit';
import listen from './passives';
import { inReach, isElite, rankOf } from './skills';

export const CHALLENGE_RADIUS = 3;
export const challengeTime = (rank: number): number => 3 + rank * 0.25;

// Awake enemies within the Challenge's reach that the Vanguard may pick.
function challenged(u: Unit): Unit[] {
  return hostiles(u).filter((e) => e.aware && u.distanceTo(e) <= CHALLENGE_RADIUS);
}

/** Forces `e` to fight `u` for `time` seconds. */
export function taunt(u: Unit, e: Unit, time: number): void {
  e.aware = true;
  if (e.addStatus(TAUNTED, u, time)) {
    e.target = u;
  }
}

/**
 * Vanguard, Bulwark tier 1. Bangs the shield and roars: every enemy within
 * 3 tiles must fight the Vanguard for a few seconds.
 */
export const CHALLENGE: Skill = {
  id: 'challenge',
  name: 'Challenge',
  describe: (rank) =>
    `Taunts every enemy within ${CHALLENGE_RADIUS} tiles for ${challengeTime(rank)} seconds.`,
  cost: 12,
  cooldown: 9,
  windup: 0.35,
  recovery: 0.3,
  targeting: Targeting.Self,
  wants(u, _target, sim) {
    // Worth it when something near goes for the bearer, or two go for anyone else.
    const near = challenged(u).filter((e) => e.statuses.get(TAUNTED.id)?.source !== u);
    return (
      near.some((e) => e.target === sim.bearer) || near.filter((e) => e.target !== u).length >= 2
    );
  },
  elite(u) {
    return challenged(u).some(isElite);
  },
  release(u) {
    const time = challengeTime(rankOf(u, 'challenge'));
    // An enemy the Vanguard may not pick, such as one dueled by another, is skipped.
    for (const e of hostiles(u)) {
      if (u.distanceTo(e) <= CHALLENGE_RADIUS) {
        taunt(u, e, time);
      }
    }
  },
};

export const crushRatio = (rank: number): number => 140 + rank * 10;
export const crushEarth = (rank: number): number => 30 + rank * 5;

/**
 * Vanguard, Breaker tier 2. A heavy overhead blow that builds up Earth,
 * toward Petrify.
 */
export const CRUSH: Skill = {
  id: 'crush',
  name: 'Crush',
  describe: (rank) =>
    `A heavy blow for ${crushRatio(rank)}% damage that adds ${crushEarth(rank)} Earth buildup.`,
  cost: 10,
  cooldown: 6,
  windup: 0.5,
  recovery: 0.35,
  targeting: Targeting.Enemy,
  wants(u, target) {
    // Saved for something worth the mana: an elite, or a sturdy foe.
    return inReach(u, target) && (isElite(target) || target.hp > target.derived.maxHp * 0.5);
  },
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target) {
    if (!target?.alive || u.distanceTo(target) > u.kit.reach + 0.5) {
      return;
    }
    const rank = rankOf(u, 'crush');
    strike(u, target, {
      ratio: crushRatio(rank),
      flags: DamageFlags.Skill,
      buildup: [{ status: PETRIFY, amount: crushEarth(rank) }],
    });
  },
};

const BASH_RATIO = 100;
export const bashStun = (rank: number): number => 50 + rank * 5;

/** A shove that builds up stun and breaks off the skill the target is winding up. */
export function bash(u: Unit, target: Unit, rank: number): void {
  const hit = strike(u, target, {
    ratio: BASH_RATIO,
    flags: DamageFlags.Skill,
    buildup: [{ status: STUN, amount: bashStun(rank) }],
  });
  if (hit) {
    target.cast = null;
  }
}

/**
 * Vanguard, Breaker tier 3. A shove with the shield's face: a blow that
 * builds up stun and breaks off any skill the target is winding up.
 */
export const SHIELD_BASH: Skill = {
  id: 'shieldBash',
  name: 'Shield Bash',
  describe: (rank) =>
    `A shove with the shield for ${BASH_RATIO}% damage. Adds ${bashStun(rank)} stun buildup and interrupts skills.`,
  cost: 8,
  cooldown: 5,
  windup: 0.3,
  recovery: 0.35,
  targeting: Targeting.Enemy,
  wants(u, target, sim) {
    // Worth it to break a skill, to stop something after the bearer, or to
    // finish a stun already building.
    return (
      inReach(u, target) &&
      (target.cast !== null ||
        target.target === sim.bearer ||
        (target.buildup.get(STUN.id) ?? 0) > 0)
    );
  },
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target) {
    // A target that stepped away during the windup is missed.
    if (!target?.alive || u.distanceTo(target) > u.kit.reach + 0.5) {
      return;
    }
    bash(u, target, rankOf(u, 'shieldBash'));
  },
};

const interceptReach = (rank: number): number => 4 + rank * 0.5;

// The enemy nearest the bearer that is going for it.
function threatToBearer(u: Unit): Unit | null {
  const bearer = u.sim.bearer;
  if (!bearer?.alive) {
    return null;
  }
  const threats = u.sim
    .living(Side.Monster)
    .filter((e) => e.target === bearer && e.distanceTo(bearer) <= 4)
    .sort((a, b) => a.distanceTo(bearer) - b.distanceTo(bearer));
  return threats.at(0) ?? null;
}

/**
 * Vanguard, Oathkeeper tier 2. A dash that puts the Vanguard between the
 * bearer and whatever is coming for it.
 */
export const INTERCEPT: Skill = {
  id: 'intercept',
  name: 'Intercept',
  describe: (rank) =>
    `Dashes up to ${interceptReach(rank)} tiles to stand between the bearer and the nearest enemy going for it.`,
  cost: 8,
  cooldown: 8,
  windup: 0.15,
  recovery: 0.2,
  targeting: Targeting.Self,
  wants(u, _target, sim) {
    const threat = threatToBearer(u);
    const bearer = sim.bearer;
    return (
      threat !== null &&
      bearer !== null &&
      u.distanceTo(bearer) > 1.5 &&
      u.distanceTo(bearer) <= interceptReach(rankOf(u, 'intercept'))
    );
  },
  elite(u) {
    const threat = threatToBearer(u);
    return threat !== null && isElite(threat);
  },
  release(u, _target, sim) {
    const threat = threatToBearer(u);
    const bearer = sim.bearer;
    if (!threat || !bearer) {
      return;
    }
    // One tile from the bearer, toward the threat.
    const dx = threat.x - bearer.x;
    const dz = threat.z - bearer.z;
    const d = Math.hypot(dx, dz) || 1;
    const x = bearer.x + (dx / d) * 0.9;
    const z = bearer.z + (dz / d) * 0.9;
    if (!sim.nav || sim.nav.walkable(x, z)) {
      u.x = x;
      u.z = z;
      u.face(threat);
    }
  },
};

/** Vanguard, Breaker tier 1. Melee hits break armor: 4 per rank, stacking 5 times. */
export const SUNDER: Passive = {
  id: 'sunder',
  setup: (unit, rank) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (
        event.source === unit &&
        event.range === Range.Melee &&
        event.value > 0 &&
        !(event.flags & DamageFlags.DoT)
      ) {
        event.target.addStatus(SUNDERED, unit, undefined, rank);
      }
    }),
};
export const sunderText = (rank: number): string =>
  `Melee hits take ${4 * rank} armor from the target for 4 seconds, stacking 5 times.`;

const VOW_RADIUS = 4;

/** Vanguard, Oathkeeper tier 1. More armor while near the bearer. */
export const VOW: Passive = {
  id: 'vow',
  setup: (unit, rank) => {
    let near = false;
    const tick = listen(unit.sim, SimEvents.Tick, EventPriority.Post, () => {
      const bearer = unit.sim.bearer;
      const now = bearer !== null && bearer.alive && unit.distanceTo(bearer) <= VOW_RADIUS;
      if (now !== near) {
        near = now;
        unit.setBonus('vow', now ? [{ stat: 'armor', add: 10 * rank }] : null);
      }
    });
    return {
      start: () => {
        tick.start();
      },
      stop: () => {
        tick.stop();
        unit.setBonus('vow', null);
      },
    };
  },
};
export const vowText = (rank: number): string =>
  `+${10 * rank} armor while within ${VOW_RADIUS} tiles of the bearer.`;

/** Vanguard, Oathkeeper tier 3. Takes a share of every hit on the bearer. */
export const SHARED_BURDEN: Passive = {
  id: 'sharedBurden',
  setup: (unit, rank) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Pre, (event) => {
      if (
        event.target !== unit.sim.bearer ||
        !unit.alive ||
        event.value <= 0 ||
        event.flags & DamageFlags.Redirected
      ) {
        return;
      }
      const taken = Math.floor(event.value * 0.05 * rank);
      if (taken > 0) {
        event.value -= taken;
        event.source.hit(unit, {
          kind: DamageKind.True,
          fixed: taken,
          flags: DamageFlags.Redirected,
        });
      }
    }),
};
export const sharedBurdenText = (rank: number): string =>
  `Takes ${5 * rank}% of every hit on the bearer.`;

// The Vanguard's later skills, from the skill-tree design. First numbers,
// for balance to settle.

// Awake monsters near the Vanguard that are going for the party
const pressing = (u: Unit, r: number): Unit[] =>
  u.sim
    .living(Side.Monster)
    .filter((e) => e.aware && u.distanceTo(e) <= r && e.target?.side === Side.Party);

// ---------- Bulwark ----------

const wallTime = (rank: number): number => 2 + rank * 0.25;

/**
 * Bulwark tier 2. Plants its feet behind its shield: every physical blow
 * from the front is stopped, and magic halved, while it cannot move.
 */
export const SHIELD_WALL_SKILL: Skill = {
  id: 'shieldWall',
  name: 'Shield Wall',
  describe: (rank) =>
    `For ${wallTime(rank)} seconds, stops every physical blow from the front and halves magic from it. It cannot move meanwhile.`,
  cost: 12,
  cooldown: 12,
  windup: 0.2,
  recovery: 0.2,
  targeting: Targeting.Self,
  // When several come at it, or an elite does
  wants: (u) => {
    const near = pressing(u, 2.5).filter((e) => e.target === u);
    return near.length >= 2 || near.some(isElite);
  },
  elite: (u) => pressing(u, 2.5).some(isElite),
  release(u) {
    u.addStatus(SHIELD_WALL, u, wallTime(rankOf(u, 'shieldWall')));
  },
};
