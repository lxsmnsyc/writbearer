import { ARROW_SPEED, strike } from '../sim/sim';
import { type Skill, Targeting } from '../sim/skill';
import { PETRIFY, RENEWED, ROOTED, STUN, TAUNTED } from '../sim/statuses';
import { DamageFlags, DamageKind, Element, Race, Range, Rank, Side } from '../sim/types';
import type Unit from '../sim/unit';

// First numbers for active skills. A starting point for balance, not final
// values. Every number that grows with rank says so in its skill's text.

const isElite = (u: Unit): boolean => u.rank !== Rank.Normal;
// The rank a unit has in a skill, at least 1 while it is being used.
const rankOf = (u: Unit, id: string): number => Math.max(1, u.skillRank(id));
const inReach = (u: Unit, target: Unit | null): target is Unit =>
  target !== null && u.distanceTo(target) <= u.kit.reach;

// ---------- Vanguard ----------

const CHALLENGE_RADIUS = 3;
const challengeTime = (rank: number): number => 3 + rank * 0.5;

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

const crushRatio = (rank: number): number => 140 + rank * 20;
const crushEarth = (rank: number): number => 30 + rank * 10;

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

// ---------- Ranger ----------

const aimedRatio = (rank: number): number => 200 + rank * 30;

/** Ranger, Hawkeye tier 1. A long, still draw for one heavy arrow. */
export const AIMED_SHOT: Skill = {
  id: 'aimedShot',
  name: 'Aimed Shot',
  describe: (rank) => `A long draw for one arrow at ${aimedRatio(rank)}% damage.`,
  cost: 10,
  cooldown: 5,
  windup: 1.4,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants(u, target) {
    return inReach(u, target);
  },
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target, sim) {
    if (!target?.alive) {
      return;
    }
    sim.fire(u, target, {
      speed: ARROW_SPEED * 1.3,
      homing: true,
      skill: 'aimedShot',
      options: {
        range: Range.Ranged,
        ratio: aimedRatio(rankOf(u, 'aimedShot')),
        flags: DamageFlags.Skill | DamageFlags.Projectile,
      },
    });
  },
};

const SNARE_REACH = 7;
const snareTime = (rank: number): number => 1.5 + rank * 0.5;

// The awake enemy nearest the bearer that is coming for it, if any.
function comingForBearer(u: Unit): Unit | null {
  const bearer = u.sim.bearer;
  if (!bearer?.alive) {
    return null;
  }
  let best: Unit | null = null;
  for (const e of u.sim.living(Side.Monster)) {
    const d = e.distanceTo(bearer);
    if (e.aware && e.target === bearer && d <= SNARE_REACH && d > 1.5) {
      if (!best || d < best.distanceTo(bearer)) {
        best = e;
      }
    }
  }
  return best;
}

/**
 * Ranger, Trapper tier 1. Throws a snare into the path of an enemy coming
 * for the bearer. The first enemy to step in is held fast.
 */
export const SNARE: Skill = {
  id: 'snare',
  name: 'Snare',
  describe: (rank) =>
    `Sets a snare in the path of an enemy coming for the bearer. It holds the first enemy in for ${snareTime(rank)} seconds.`,
  cost: 8,
  cooldown: 7,
  windup: 0.4,
  recovery: 0.3,
  targeting: Targeting.Self,
  wants(u, _target, sim) {
    // One snare at a time.
    return comingForBearer(u) !== null && !sim.traps.some((t) => t.owner === u);
  },
  elite(u) {
    const e = comingForBearer(u);
    return e !== null && isElite(e);
  },
  release(u, _target, sim) {
    const e = comingForBearer(u);
    const bearer = sim.bearer;
    if (!e || !bearer) {
      return;
    }
    // A step ahead of the enemy, on its way to the bearer.
    const dx = bearer.x - e.x;
    const dz = bearer.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    const step = Math.min(1.2, d / 2);
    sim.traps.push({
      owner: u,
      x: e.x + (dx / d) * step,
      z: e.z + (dz / d) * step,
      radius: 0.5,
      life: 20,
      status: ROOTED,
      duration: snareTime(rankOf(u, 'snare')),
      sprung: false,
    });
  },
};

const chargedRatio = (rank: number): number => 90 + rank * 15;
const CHAIN_REACH = 3;

/**
 * Ranger, Stormcaller tier 1. A Storm arrow that leaps on to one more enemy
 * near the first. Storm builds up Shock.
 */
export const CHARGED_ARROW: Skill = {
  id: 'chargedArrow',
  name: 'Charged Arrow',
  describe: (rank) =>
    `A Storm arrow for ${chargedRatio(rank)}% damage that chains to one more enemy within ${CHAIN_REACH} tiles.`,
  cost: 9,
  cooldown: 4,
  windup: 0.6,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants(u, target) {
    return inReach(u, target);
  },
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target, sim) {
    if (!target?.alive) {
      return;
    }
    const options = {
      range: Range.Ranged,
      element: Element.Storm,
      ratio: chargedRatio(rankOf(u, 'chargedArrow')),
      flags: DamageFlags.Skill | DamageFlags.Projectile,
    };
    sim.fire(u, target, {
      speed: ARROW_SPEED,
      homing: true,
      skill: 'chargedArrow',
      options,
      onHit: (first) => {
        const next = sim
          .living(Side.Monster)
          .filter((e) => e !== first && e.distanceTo(first) <= CHAIN_REACH)
          .sort((a, b) => a.distanceTo(first) - b.distanceTo(first))
          .at(0);
        if (next) {
          // The chain leaps from the first enemy, not from the Ranger.
          sim.chain(u, first, next, { speed: ARROW_SPEED * 2, skill: 'chargedArrow', options });
        }
      },
    });
  },
};

const PIERCE_WIDTH = 0.45;
// How far past the target the arrow keeps flying
const PIERCE_OVERSHOOT = 2.5;
const pierceRatio = (rank: number): number => 150 + rank * 15;

// Enemies the line from `u` through `target` would pass.
function inLine(u: Unit, target: Unit): Unit[] {
  const dx = target.x - u.x;
  const dz = target.z - u.z;
  const d = Math.hypot(dx, dz) || 1;
  const length = u.kit.reach + PIERCE_OVERSHOOT;
  return u.sim.living(Side.Monster).filter((e) => {
    const along = ((e.x - u.x) * dx + (e.z - u.z) * dz) / d;
    const across = Math.abs(((e.x - u.x) * dz - (e.z - u.z) * dx) / d);
    return along > 0 && along <= length && across <= PIERCE_WIDTH;
  });
}

/**
 * Ranger, Hawkeye tier 4. A long draw, then an arrow that flies straight
 * through every enemy in its line.
 */
export const PIERCING_ARROW: Skill = {
  id: 'piercingArrow',
  name: 'Piercing Arrow',
  describe: (rank) =>
    `A long draw, then an arrow that hits every enemy in a line for ${pierceRatio(rank)}% damage.`,
  cost: 14,
  cooldown: 6,
  windup: 0.9,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants(u, target, sim) {
    if (!inReach(u, target)) {
      return false;
    }
    // Saved for a line of two or more, an elite, or something after the bearer.
    return inLine(u, target).length >= 2 || isElite(target) || target.target === sim.bearer;
  },
  elite(u, target) {
    return target !== null && inLine(u, target).some(isElite);
  },
  release(u, target, sim) {
    if (!target) {
      return;
    }
    sim.fire(u, target, {
      speed: ARROW_SPEED * 1.4,
      distance: u.kit.reach + PIERCE_OVERSHOOT,
      radius: PIERCE_WIDTH,
      pierce: true,
      skill: 'piercingArrow',
      options: {
        range: Range.Ranged,
        ratio: pierceRatio(rankOf(u, 'piercingArrow')),
        flags: DamageFlags.Skill | DamageFlags.Projectile,
      },
    });
  },
};

// ---------- Monsters ----------

const HYMN_RADIUS = 4;
const HYMN_SHARE = 0.2;
// Allies below this share of health make the Cantor sing.
const HYMN_WOUNDED = 0.7;

// The Cantor's flock: monsters within the hymn's reach, itself included.
function flock(u: Unit): Unit[] {
  return u.sim.living(Side.Monster).filter((m) => u.distanceTo(m) <= HYMN_RADIUS);
}

/**
 * Penitent Cantor. A long hymn that mends every monster within 4 tiles by a
 * fifth of its health. Breaking it off with a stun or a Shield Bash wastes it.
 */
export const HYMN: Skill = {
  id: 'hymn',
  name: 'Hymn of Mending',
  describe: () =>
    `A long hymn that heals every ally within ${HYMN_RADIUS} tiles for ${HYMN_SHARE * 100}% of their health.`,
  cost: 20,
  cooldown: 6,
  windup: 1.6,
  recovery: 0.4,
  targeting: Targeting.Self,
  wants(u) {
    return flock(u).some((m) => m.hp < m.derived.maxHp * HYMN_WOUNDED);
  },
  elite() {
    return false;
  },
  release(u) {
    for (const m of flock(u)) {
      u.heal(m, m.derived.maxHp * HYMN_SHARE);
    }
  },
};

// ---------- Added for the trees ----------

const pinTime = (rank: number): number => 1 + rank * 0.5;

/**
 * Ranger, Hawkeye tier 2. An arrow that pins an enemy where it stands. It
 * will also ground flyers once they exist.
 */
export const PIN_DOWN: Skill = {
  id: 'pinDown',
  name: 'Pin Down',
  describe: (rank) => `An arrow that pins an enemy in place for ${pinTime(rank)} seconds.`,
  cost: 8,
  cooldown: 8,
  windup: 0.5,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants(u, target, sim) {
    // For whatever is running at the bearer, or an elite.
    return (
      inReach(u, target) &&
      !target.statuses.has(ROOTED.id) &&
      (target.target === sim.bearer || isElite(target))
    );
  },
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target, sim) {
    if (!target?.alive) {
      return;
    }
    const time = pinTime(rankOf(u, 'pinDown'));
    sim.fire(u, target, {
      speed: ARROW_SPEED,
      homing: true,
      skill: 'pinDown',
      options: {
        range: Range.Ranged,
        ratio: 80,
        flags: DamageFlags.Skill | DamageFlags.Projectile,
      },
      onHit: (hit) => {
        hit.addStatus(ROOTED, u, time);
      },
    });
  },
};

const interceptReach = (rank: number): number => 4 + rank;

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

// ---------- Cleric ----------

// How far the Cleric's prayers reach, in tiles.
const PRAYER_REACH = 6;
const healAmount = (u: Unit, rank: number): number => 40 + rank * 20 + u.derived.matkMax;
// Allies below this share of health are worth a Heal.
const HEAL_BELOW = 0.7;

// The living party within reach of the Cleric, the bearer included.
function flockOf(u: Unit): Unit[] {
  return u.sim.living(Side.Party).filter((p) => u.distanceTo(p) <= PRAYER_REACH);
}

// The ally most in need, by share of health. The bearer comes first when
// it is in danger at all.
function neediest(u: Unit, below: number, skip: (p: Unit) => boolean = () => false): Unit | null {
  const hurt = flockOf(u).filter((p) => p.hp < p.derived.maxHp * below && !skip(p));
  const bearer = hurt.find((p) => p === u.sim.bearer);
  if (bearer) {
    return bearer;
  }
  return hurt.sort((a, b) => a.hp / a.derived.maxHp - b.hp / b.derived.maxHp).at(0) ?? null;
}

/** Cleric, Mercy tier 1. Mends one ally, or the bearer. */
export const HEAL: Skill = {
  id: 'heal',
  name: 'Heal',
  describe: (rank) =>
    `Heals an ally or the bearer for ${40 + rank * 20}, plus the Cleric's magic attack.`,
  cost: 10,
  cooldown: 2.5,
  windup: 0.6,
  recovery: 0.3,
  targeting: Targeting.Ally,
  aim: (u) => neediest(u, HEAL_BELOW),
  wants: (_u, target) => target !== null,
  elite: () => false,
  release(u, target) {
    if (target?.alive) {
      u.heal(target, healAmount(u, rankOf(u, 'heal')));
    }
  },
};

const renewPulse = (rank: number): number => 8 + rank * 6;

/** Cleric, Mercy tier 2. Healing that keeps coming for six seconds. */
export const RENEW: Skill = {
  id: 'renew',
  name: 'Renew',
  describe: (rank) => `Heals an ally for ${renewPulse(rank)} each second for 6 seconds.`,
  cost: 12,
  cooldown: 5,
  windup: 0.4,
  recovery: 0.3,
  targeting: Targeting.Ally,
  aim: (u) => neediest(u, 0.85, (p) => p.statuses.has(RENEWED.id)),
  wants: (_u, target) => target !== null,
  elite: () => false,
  release(u, target) {
    target?.addStatus(RENEWED, u, undefined, renewPulse(rankOf(u, 'renew')));
  },
};

// Whether a status on a unit is harmful: something an enemy put there.
const harmful = (p: Unit): boolean =>
  [...p.statuses.values()].some((s) => s.source.side !== p.side);

/** Cleric, Mercy tier 3. Lifts every harmful status and clears all buildup. */
export const CLEANSE: Skill = {
  id: 'cleanse',
  name: 'Cleanse',
  describe: (rank) =>
    `Removes every harmful status from an ally and clears its buildup. Can be prayed every ${11 - rank} seconds.`,
  cost: 10,
  cooldown: 8,
  windup: 0.3,
  recovery: 0.3,
  targeting: Targeting.Ally,
  aim: (u) => flockOf(u).find((p) => harmful(p) || p.buildup.size > 0) ?? null,
  // Worth it for a status, or for buildup more than half way to one.
  wants: (_u, target) =>
    target !== null && (harmful(target) || [...target.buildup.entries()].some(([, v]) => v >= 50)),
  elite: () => false,
  release(u, target) {
    if (!target?.alive) {
      return;
    }
    for (const [id, s] of target.statuses) {
      if (s.source.side !== target.side) {
        target.removeStatus(id);
      }
    }
    target.buildup.clear();
    // Higher ranks shorten the wait for the next one.
    u.skillCooldowns.set('cleanse', 11 - rankOf(u, 'cleanse'));
  },
};

const raiseShare = (rank: number): number => 0.1 * rank;

/**
 * Cleric, Mercy tier 4. A long prayer over a dead merc's body that brings it
 * back. A body torn apart cannot be raised.
 */
export const RESURRECTION: Skill = {
  id: 'resurrection',
  name: 'Resurrection',
  describe: (rank) =>
    `A long prayer over a fallen merc's body that raises it with ${raiseShare(rank) * 100}% health. Torn bodies stay dead.`,
  cost: 30,
  cooldown: 20,
  windup: 3,
  recovery: 0.5,
  targeting: Targeting.Ally,
  aim: (u) =>
    [...u.sim.units].find(
      (p) =>
        p.side === Side.Party &&
        !p.alive &&
        !p.torn &&
        p !== u.sim.bearer &&
        u.distanceTo(p) <= PRAYER_REACH,
    ) ?? null,
  wants: (_u, target) => target !== null,
  elite: () => false,
  release(u, target) {
    target?.revive(raiseShare(rankOf(u, 'resurrection')));
  },
};

const SMITE_REACH = 5;
const smiteRatio = (rank: number): number => 110 + rank * 20;
// Smite burns the Undead and the Occult harder.
const SMITE_BANE = 1.5;

/** Cleric, Inquisition tier 1. Holy fire called down on an enemy. */
export const SMITE: Skill = {
  id: 'smite',
  name: 'Smite',
  describe: (rank) =>
    `Radiant fire for ${smiteRatio(rank)}% magic damage, half again against the Undead and the Occult.`,
  cost: 8,
  cooldown: 3,
  windup: 0.5,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  wants: (u, target) => target !== null && u.distanceTo(target) <= SMITE_REACH,
  elite: (_u, target) => target !== null && isElite(target),
  release(u, target) {
    if (!target?.alive || u.distanceTo(target) > SMITE_REACH + 1) {
      return;
    }
    const bane = target.race === Race.Undead || target.element === Element.Occult;
    strike(u, target, {
      kind: DamageKind.Magical,
      element: Element.Radiant,
      range: Range.Ranged,
      ratio: smiteRatio(rankOf(u, 'smite')) * (bane ? SMITE_BANE : 1),
      flags: DamageFlags.Skill,
    });
  },
};
