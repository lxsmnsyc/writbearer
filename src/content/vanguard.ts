import { EventPriority } from '../core/event-emitter';
import { Stance } from '../sim/ai';
import { SimEvents } from '../sim/events';
import { Shout, acting } from '../sim/shout';
import { ARROW_SPEED, strike } from '../sim/sim';
import { type Passive, type Skill, Targeting } from '../sim/skill';
import { DREAD, PETRIFY, SHIELD_WALL, STUN, SUNDERED, TAUNTED } from '../sim/statuses';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Element,
  Range,
  Side,
  ValuePriority,
} from '../sim/types';
import type Unit from '../sim/unit';
import { setZone } from '../sim/zone';
import listen from './passives';
import { inLine, inReach, isElite, rankOf } from './skills';

const CHALLENGE_RADIUS = 3;
const challengeTime = (rank: number): number => 3 + rank * 0.25;

// Awake monsters within the Challenge's reach.
function challenged(u: Unit): Unit[] {
  return u.sim.living(Side.Monster).filter((e) => e.aware && u.distanceTo(e) <= CHALLENGE_RADIUS);
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
    for (const e of u.sim.living(Side.Monster)) {
      if (u.distanceTo(e) <= CHALLENGE_RADIUS) {
        e.aware = true;
        if (e.addStatus(TAUNTED, u, time)) {
          e.target = u;
        }
      }
    }
  },
};

const crushRatio = (rank: number): number => 140 + rank * 10;
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

const bashRatio = (rank: number): number => 100 + rank * 10;
const bashStun = (rank: number): number => 50 + rank * 10;

/**
 * Vanguard, Breaker tier 3. A shove with the shield's face: a blow that
 * builds up stun and breaks off any skill the target is winding up.
 */
export const SHIELD_BASH: Skill = {
  id: 'shieldBash',
  name: 'Shield Bash',
  describe: (rank) =>
    `A shove with the shield for ${bashRatio(rank)}% damage. Adds ${bashStun(rank)} stun buildup and interrupts skills.`,
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
    const rank = rankOf(u, 'shieldBash');
    const hit = strike(u, target, {
      ratio: bashRatio(rank),
      flags: DamageFlags.Skill,
      buildup: [{ status: STUN, amount: bashStun(rank) }],
    });
    if (hit) {
      target.cast = null;
    }
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
      u.distanceTo(bearer) <= interceptReach(u.skillRank('intercept') || 1)
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

// Whether `guard` stands between `from` and `ally`, close enough to cover it.
function covers(guard: Unit, from: Unit, ally: Unit): boolean {
  const dx = ally.x - from.x;
  const dz = ally.z - from.z;
  const l2 = dx * dx + dz * dz;
  if (l2 === 0 || guard.distanceTo(ally) > 4) {
    return false;
  }
  const t = ((guard.x - from.x) * dx + (guard.z - from.z) * dz) / l2;
  if (t <= 0 || t >= 1) {
    return false;
  }
  return Math.hypot(from.x + dx * t - guard.x, from.z + dz * t - guard.z) <= 1;
}

/** Bulwark tier 3. Allies behind it take less from arrows and bolts. */
export const BASTION: Passive = {
  id: 'bastion',
  setup: (unit, rank) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Reduce, (event) => {
      if (
        unit.alive &&
        event.range === Range.Ranged &&
        event.target !== unit &&
        event.target.side === unit.side &&
        event.source.side !== unit.side &&
        covers(unit, event.source, event.target)
      ) {
        event.value *= 1 - 0.08 * rank;
      }
    }),
};
export const bastionText = (rank: number): string =>
  `Allies standing behind it take ${8 * rank}% less ranged damage.`;

const rampartTime = (rank: number): number => 4 + rank;

// The nearest awake archer or caster shooting at the party
function shooter(u: Unit): Unit | null {
  return (
    u.sim
      .living(Side.Monster)
      .filter(
        (e) =>
          e.aware &&
          e.job.range === Range.Ranged &&
          e.target?.side === Side.Party &&
          u.distanceTo(e) <= 10 &&
          u.sim.sees(u, e),
      )
      .sort((a, b) => u.distanceTo(a) - u.distanceTo(b))
      .at(0) ?? null
  );
}

/**
 * Bulwark tier 4. Plants its shield as a short wall between the party and
 * an archer. Arrows that fly into it stop there.
 */
export const RAMPART: Skill = {
  id: 'rampart',
  name: 'Rampart',
  describe: (rank) =>
    `Plants a wall toward the nearest archer for ${rampartTime(rank)} seconds. Arrows and bolts that fly into it stop.`,
  cost: 16,
  cooldown: 14,
  windup: 0.4,
  recovery: 0.3,
  targeting: Targeting.Self,
  wants: (u, _target, sim) =>
    shooter(u) !== null && !sim.zones.some((z) => z.owner === u && z.kind === 'rampart'),
  elite: (u) => {
    const s = shooter(u);
    return s !== null && isElite(s);
  },
  release(u, _target, sim) {
    const s = shooter(u);
    if (!s) {
      return;
    }
    const d = u.distanceTo(s) || 1;
    const step = Math.min(1.6, d / 2);
    setZone(sim, {
      kind: 'rampart',
      owner: u,
      x: u.x + ((s.x - u.x) / d) * step,
      z: u.z + ((s.z - u.z) / d) * step,
      r: 1.3,
      life: rampartTime(rankOf(u, 'rampart')),
      element: Element.Earth,
      blocks: true,
    });
  },
};

// Whether the Vanguard stands firm: behind its Shield Wall, or holding.
function firm(u: Unit): boolean {
  if (u.statuses.has(SHIELD_WALL.id)) {
    return true;
  }
  return u.toggles?.stance === Stance.Hold || acting(u.sim, u)?.shout === Shout.Hold;
}

/** Bulwark capstone. Cannot be stunned or frightened while it stands firm. */
export const IMMOVABLE: Passive = {
  id: 'immovable',
  setup: (unit) =>
    listen(unit.sim, SimEvents.CheckStatusDuration, ValuePriority.Post, (event) => {
      if (
        event.target === unit &&
        (event.status === STUN || event.status === DREAD || event.status === PETRIFY) &&
        firm(unit)
      ) {
        event.disabled = true;
      }
    }),
};
export const immovableText = (): string =>
  'Cannot be stunned, petrified or frightened during Shield Wall or while holding.';

// ---------- Breaker ----------

const faultRatio = (rank: number): number => 110 + rank * 15;
const faultEarth = (rank: number, crush: number): number =>
  20 + rank * 8 + (crush > 0 ? crushEarth(crush) / 4 : 0);
const FAULT_LENGTH = 5;

// The line counts only what is within the shockwave's length.
const inLineOf = (u: Unit, target: Unit): Unit[] =>
  inLine(u, target).filter((e) => u.distanceTo(e) <= FAULT_LENGTH);

/**
 * Breaker tier 4. Stamps a shockwave along the ground that cracks every
 * enemy in its line. Ranks in Crush deepen its Earth.
 */
export const FAULT_LINE: Skill = {
  id: 'faultLine',
  name: 'Fault Line',
  describe: (rank) =>
    `A shockwave along the ground, ${FAULT_LENGTH} tiles long, for ${faultRatio(rank)}% damage to every enemy in it. Adds ${faultEarth(rank, 0)} Earth buildup, more with each rank in Crush.`,
  cost: 14,
  cooldown: 8,
  windup: 0.5,
  recovery: 0.35,
  targeting: Targeting.Enemy,
  wants: (u, target) =>
    target !== null &&
    u.distanceTo(target) <= FAULT_LENGTH - 0.5 &&
    (inLineOf(u, target).length >= 2 || isElite(target)),
  elite: (u, target) => target !== null && inLineOf(u, target).some(isElite),
  release(u, target, sim) {
    if (!target) {
      return;
    }
    const rank = rankOf(u, 'faultLine');
    sim.fire(u, target, {
      speed: ARROW_SPEED * 0.8,
      distance: FAULT_LENGTH,
      radius: 0.6,
      pierce: true,
      skill: 'faultLine',
      options: {
        range: Range.Melee,
        ratio: faultRatio(rank),
        flags: DamageFlags.Skill | DamageFlags.AoE,
        buildup: [{ status: PETRIFY, amount: faultEarth(rank, u.skillRanks.get('crush') ?? 0) }],
      },
    });
  },
};

const QUAKE_REACH = 6;
const QUAKE_SPREAD = 3;
const QUAKE_EARTH = 40;

/**
 * Breaker capstone. When an enemy near it turns to stone, the ground
 * shakes around it: every enemy within 3 tiles of it gets Earth buildup.
 */
export const EARTHSHAKER: Passive = {
  id: 'earthshaker',
  setup: (unit) => {
    // A quake that petrifies another does not set off a third.
    let shaking = false;
    return listen(unit.sim, SimEvents.StatusApplied, EventPriority.Post, (event) => {
      const stone = event.status.unit;
      if (
        shaking ||
        event.status.def !== PETRIFY ||
        stone.side === unit.side ||
        !unit.alive ||
        unit.distanceTo(stone) > QUAKE_REACH
      ) {
        return;
      }
      shaking = true;
      for (const e of unit.sim.living(stone.side)) {
        if (e !== stone && e.distanceTo(stone) <= QUAKE_SPREAD) {
          e.buildUp(PETRIFY, unit, QUAKE_EARTH);
        }
      }
      shaking = false;
    });
  },
};
export const earthshakerText = (): string =>
  `When an enemy within ${QUAKE_REACH} tiles is Petrified, every enemy within ${QUAKE_SPREAD} tiles of it gets ${QUAKE_EARTH} Earth buildup.`;

// ---------- Oathkeeper ----------

const BANNER_RADIUS = 4;
const bannerTime = (rank: number): number => 10 + rank * 2;
const bannerCalm = (rank: number): number => Math.max(0.1, 0.6 - rank * 0.1);

/**
 * Oathkeeper tier 4. Plants the Guild's banner. Allies near it take heart,
 * and dread takes hold of them slower.
 */
export const BANNER: Skill = {
  id: 'banner',
  name: 'Banner',
  describe: (rank) =>
    `Plants a banner for ${bannerTime(rank)} seconds. Allies within ${BANNER_RADIUS} tiles gain ${rank * 0.5} morale each second, and take ${Math.round((1 - bannerCalm(rank)) * 100)}% less dread buildup.`,
  cost: 15,
  cooldown: 25,
  windup: 0.5,
  recovery: 0.3,
  targeting: Targeting.Self,
  wants: (u, _target, sim) =>
    pressing(u, 6).length >= 3 && !sim.zones.some((z) => z.owner === u && z.kind === 'banner'),
  elite: (u) => pressing(u, 6).some(isElite),
  release(u, _target, sim) {
    const rank = rankOf(u, 'banner');
    setZone(sim, {
      kind: 'banner',
      owner: u,
      x: u.x,
      z: u.z,
      r: BANNER_RADIUS,
      life: bannerTime(rank),
      element: Element.Neutral,
      calm: bannerCalm(rank),
      pulse: (ally) => {
        if (ally.side === u.side && ally !== sim.bearer) {
          ally.morale = Math.min(100, ally.morale + rank * 0.5);
        }
      },
    });
  },
};

const LAST_LINE_AT = 0.3;
const LAST_LINE_RADIUS = 5;
const LAST_LINE_TIME = 4;

/**
 * Oathkeeper capstone. Once an area, when the bearer drops below 30%
 * health, roars: every enemy within 5 tiles of the bearer turns on it.
 */
export const LAST_LINE: Passive = {
  id: 'lastLine',
  setup: (unit) => {
    let used = -1;
    return listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      const { sim } = unit;
      const bearer = sim.bearer;
      if (
        event.target !== bearer ||
        !bearer.alive ||
        !unit.alive ||
        unit.disabled ||
        used === sim.area ||
        bearer.hp >= bearer.derived.maxHp * LAST_LINE_AT
      ) {
        return;
      }
      used = sim.area;
      for (const e of sim.living(Side.Monster)) {
        if (e.distanceTo(bearer) <= LAST_LINE_RADIUS) {
          e.aware = true;
          if (e.addStatus(TAUNTED, unit, LAST_LINE_TIME)) {
            e.target = unit;
          }
        }
      }
    });
  },
};
export const lastLineText = (): string =>
  `Once an area, when the bearer drops below ${LAST_LINE_AT * 100}% health, taunts every enemy within ${LAST_LINE_RADIUS} tiles of it for ${LAST_LINE_TIME} seconds.`;
