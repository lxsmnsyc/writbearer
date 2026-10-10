import { TAUNTED } from '../sim/ai';
import { ARROW_SPEED } from '../sim/sim';
import { type Skill, Targeting } from '../sim/skill';
import { DamageFlags, Range, Rank, Side } from '../sim/types';
import type Unit from '../sim/unit';

// First numbers for the first two skills. Rank 1 of each, before skill trees.

const CHALLENGE_RADIUS = 3;
const CHALLENGE_DURATION = 4;

const isElite = (u: Unit): boolean => u.rank !== Rank.Normal;

// Awake monsters within the Challenge's reach.
function challenged(u: Unit): Unit[] {
  return u.sim.living(Side.Monster).filter((e) => e.aware && u.distanceTo(e) <= CHALLENGE_RADIUS);
}

/**
 * Vanguard, Bulwark tier 1. Bangs the shield and roars: every enemy within
 * 3 tiles must fight the Vanguard for 4 seconds.
 */
export const CHALLENGE: Skill = {
  id: 'challenge',
  name: 'Challenge',
  description: `Taunts every enemy within ${CHALLENGE_RADIUS} tiles for ${CHALLENGE_DURATION} seconds.`,
  cost: 12,
  cooldown: 9,
  windup: 0.35,
  recovery: 0.3,
  targeting: Targeting.Self,
  wants(u, _target, sim) {
    // Worth it when something near goes for the bearer, or two go for anyone else.
    const near = challenged(u).filter((e) => e.statuses.get(TAUNTED)?.source !== u);
    return (
      near.some((e) => e.target === sim.bearer) || near.filter((e) => e.target !== u).length >= 2
    );
  },
  elite(u) {
    return challenged(u).some(isElite);
  },
  release(u) {
    for (const e of u.sim.living(Side.Monster)) {
      if (u.distanceTo(e) <= CHALLENGE_RADIUS) {
        e.aware = true;
        e.statuses.set(TAUNTED, { source: u, remaining: CHALLENGE_DURATION });
        e.target = u;
      }
    }
  },
};

const PIERCE_RATIO = 180;
const PIERCE_WIDTH = 0.45;
// How far past the target the arrow keeps flying
const PIERCE_OVERSHOOT = 2.5;

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
 * Ranger, tier 4 of its tree, given early for the first fights. A long draw,
 * then an arrow that flies straight through every enemy in its line.
 */
export const PIERCING_ARROW: Skill = {
  id: 'piercingArrow',
  name: 'Piercing Arrow',
  description: `A long draw, then an arrow that hits every enemy in a line for ${PIERCE_RATIO}% damage.`,
  cost: 14,
  cooldown: 6,
  windup: 0.9,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants(u, target, sim) {
    if (!target || u.distanceTo(target) > u.kit.reach) {
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
        ratio: PIERCE_RATIO,
        flags: DamageFlags.Skill | DamageFlags.Projectile,
      },
    });
  },
};
