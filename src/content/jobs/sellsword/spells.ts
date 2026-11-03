import { SimEvents } from '../../../sim/events';
import { strike } from '../../../sim/sim';
import { type Passive, type Skill, Targeting, areaVictims } from '../../../sim/skill';
import type { StatusDef } from '../../../sim/status';
import { BLIND, STUN } from '../../../sim/statuses';
import { allowed } from '../../../sim/targeting';
import { DamageFlags, DamagePriority, Side } from '../../../sim/types';
import type Unit from '../../../sim/unit';
import listen from '../../passives';
import { inReach, isElite, rankOf } from '../../skills';

// The Sellsword's spells and innate, from docs/design/16-builds.md. Numbers
// are first guesses. The spells are exported so the elite upgrades can patch
// them.

// How far Rush reaches from the Sellsword, in tiles
export const RUSH_RANGE = 6;
// How far from the bearer an enemy counts as a threat to it
const THREAT_RANGE = 4;
// Pocket Sand's reach in tiles, and the half-angle of its cone
export const SAND_RANGE = 3;
export const SAND_HALF_ANGLE = Math.PI / 4;
// Cleave's half-angle, and how many enemies it takes
export const CLEAVE_HALF_ANGLE = Math.PI / 3;
export const CLEAVE_TARGETS = 3;
// How long Hamstring slows, in seconds
export const HAMSTRING_TIME = 3;
// Second Wind: the health it fires at and the share it heals, in percent
export const SECOND_WIND_AT = 30;
export const SECOND_WIND_HEAL = 20;

export const rushStun = (rank: number): number => 40 + rank * 4;
export const sandBlind = (rank: number): number => 40 + rank * 5;
export const hamstringRatio = (rank: number): number => 110 + rank * 8;
export const hamstringSlow = (rank: number): number => 30 + rank * 2;
export const cleaveRatio = (rank: number): number => 100 + rank * 8;

/**
 * Cut tendons. Slows the target. Move speed is a fixed factor of the status,
 * so it is the rank 1 figure (32%); the rank part of the text is not applied.
 */
export const HAMSTRUNG: StatusDef = {
  id: 'hamstrung',
  name: 'Hamstrung',
  duration: HAMSTRING_TIME,
  immunity: 0,
  slow: 0.68,
};

// The enemy nearest the bearer that is going for it
function threatToBearer(u: Unit): Unit | null {
  const bearer = u.sim.bearer;
  if (!bearer?.alive) {
    return null;
  }
  let best: Unit | null = null;
  for (const e of allowed(u, u.sim.living(Side.Monster))) {
    if (e.target === bearer && e.distanceTo(bearer) <= THREAT_RANGE) {
      if (!best || e.distanceTo(bearer) < best.distanceTo(bearer)) {
        best = e;
      }
    }
  }
  return best;
}

// Whether `e` lies inside the cone of `half` radians from `u` toward `toward`
function inCone(u: Unit, toward: { x: number; z: number }, e: Unit, half: number): boolean {
  const a = Math.atan2(toward.z - u.z, toward.x - u.x);
  const b = Math.atan2(e.z - u.z, e.x - u.x);
  const d = Math.atan2(Math.sin(a - b), Math.cos(a - b));
  return Math.abs(d) <= half;
}

/**
 * Sellsword spell 1. Charges an enemy that is attacking the bearer and hits
 * it with stun buildup.
 */
export const RUSH: Skill = {
  id: 'rush',
  name: 'Rush',
  describe: (rank) =>
    `Charges an enemy that is attacking the bearer and hits it for 100% damage with ${rushStun(rank)} stun buildup.`,
  cost: 8,
  cooldown: 8,
  windup: 0.15,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  aim: (u) => {
    const threat = threatToBearer(u);
    return threat && u.distanceTo(threat) <= RUSH_RANGE ? threat : null;
  },
  wants: (_u, target) => target !== null,
  elite: (_u, target) => target !== null && isElite(target),
  release(u, target) {
    if (!target?.alive || u.distanceTo(target) > RUSH_RANGE + 0.5) {
      return;
    }
    // Ends one reach from the target, on the side the Sellsword came from.
    if (u.distanceTo(target) > u.kit.reach) {
      const from = Math.atan2(u.z - target.z, u.x - target.x);
      const gap = u.kit.reach * 0.8;
      const x = target.x + Math.cos(from) * gap;
      const z = target.z + Math.sin(from) * gap;
      if (u.sim.nav && !u.sim.nav.walkable(x, z)) {
        return;
      }
      u.x = x;
      u.z = z;
    }
    u.face(target);
    strike(u, target, {
      flags: DamageFlags.Skill,
      buildup: [{ status: STUN, amount: rushStun(rankOf(u, 'rush')) }],
    });
  },
};

/**
 * Sellsword spell 2. Throws sand in a cone, building up Blind on every enemy
 * in it.
 */
export const POCKET_SAND: Skill = {
  id: 'pocketSand',
  name: 'Pocket Sand',
  describe: (rank) =>
    `Throws sand in a cone ${SAND_RANGE} tiles long. Adds ${sandBlind(rank)} blind buildup to each enemy in it.`,
  cost: 8,
  cooldown: 10,
  windup: 0.2,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants: (u, target) =>
    target !== null && u.distanceTo(target) <= SAND_RANGE && !target.statuses.has(BLIND.id),
  elite: (_u, target) => target !== null && isElite(target),
  release(u, target) {
    if (!target?.alive) {
      return;
    }
    u.face(target);
    const amount = sandBlind(rankOf(u, 'pocketSand'));
    for (const v of areaVictims(u, POCKET_SAND, u, SAND_RANGE)) {
      if (v.target === target || inCone(u, target, v.target, SAND_HALF_ANGLE)) {
        v.target.aware = true;
        v.target.buildUp(BLIND, u, amount);
      }
    }
  },
};

/**
 * Sellsword spell 3. A cut at the tendons: a hit that slows the target.
 */
export const HAMSTRING: Skill = {
  id: 'hamstring',
  name: 'Hamstring',
  describe: (rank) =>
    `A cut for ${hamstringRatio(rank)}% damage that slows the target by ${hamstringSlow(rank)}% for ${HAMSTRING_TIME} seconds.`,
  cost: 8,
  cooldown: 6,
  windup: 0.3,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  wants: (u, target) => inReach(u, target) && !target.statuses.has(HAMSTRUNG.id),
  elite: (_u, target) => target !== null && isElite(target),
  release(u, target) {
    if (!target?.alive || u.distanceTo(target) > u.kit.reach + 0.5) {
      return;
    }
    const hit = strike(u, target, {
      ratio: hamstringRatio(rankOf(u, 'hamstring')),
      flags: DamageFlags.Skill,
    });
    if (hit) {
      target.addStatus(HAMSTRUNG, u);
    }
  },
};

/**
 * Sellsword spell 4, the filler. A wide swing at up to 3 enemies in the front
 * arc. With one enemy near it is a plain attack.
 */
export const CLEAVE: Skill = {
  id: 'cleave',
  name: 'Cleave',
  describe: (rank) =>
    `A swing for ${cleaveRatio(rank)}% damage at up to ${CLEAVE_TARGETS} enemies in the front arc.`,
  cost: 6,
  cooldown: 2,
  windup: 0.3,
  recovery: 0.35,
  targeting: Targeting.Enemy,
  wants: (u, target) => inReach(u, target),
  elite: (_u, target) => target !== null && isElite(target),
  release(u, target) {
    if (!target?.alive || u.distanceTo(target) > u.kit.reach + 0.5) {
      return;
    }
    u.face(target);
    // The target first, then the nearest others in the arc
    const hit = [{ target, flags: DamageFlags.AoE }];
    const others = areaVictims(u, CLEAVE, u, u.kit.reach + 0.5)
      .filter((v) => v.target !== target && inCone(u, target, v.target, CLEAVE_HALF_ANGLE))
      .sort((a, b) => u.distanceTo(a.target) - u.distanceTo(b.target));
    for (const v of others) {
      if (hit.length < CLEAVE_TARGETS) {
        hit.push(v);
      }
    }
    const ratio = cleaveRatio(rankOf(u, 'cleave'));
    for (const v of hit) {
      if (v.target.alive) {
        strike(u, v.target, { ratio, flags: DamageFlags.Skill | v.flags });
      }
    }
  },
};

// Sellsword that have used their Second Wind this stage
const WINDED = new WeakSet<Unit>();

/**
 * Sellsword innate. Once per stage, when a blow leaves it at 30% health or
 * less, it heals 20% of its max health.
 */
export const SECOND_WIND: Passive = {
  id: 'secondWind',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (event.target !== unit || !unit.alive || WINDED.has(unit) || event.value <= 0) {
        return;
      }
      const max = unit.derived.maxHp;
      if (unit.hp > max * (SECOND_WIND_AT / 100)) {
        return;
      }
      WINDED.add(unit);
      unit.heal(unit, Math.floor((max * SECOND_WIND_HEAL) / 100));
    }),
};

export const secondWindText = (): string =>
  `Once per stage, at ${SECOND_WIND_AT}% health, it heals ${SECOND_WIND_HEAL}% of max health.`;
