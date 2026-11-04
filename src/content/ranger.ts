import { SimEvents } from '../sim/events';
import type Sim from '../sim/sim';
import { ARROW_SPEED, strike } from '../sim/sim';
import { type Passive, type Skill, Targeting } from '../sim/skill';
import { ROOTED, SHOCK } from '../sim/statuses';
import { allowed, canTarget } from '../sim/targeting';
import { DamageFlags, Element, Range, Side, ValuePriority } from '../sim/types';
import type { HitOptions } from '../sim/unit';
import type Unit from '../sim/unit';
import { setZone } from '../sim/zone';
import listen from './passives';
import { PIERCE_OVERSHOOT, PIERCE_WIDTH, inLine, inReach, isElite, rankOf } from './skills';

// Enemies within `r` of a spot that `u` may pick as targets. A unit bound in
// a Duel with someone else is not among them.
export const around = (sim: Sim, at: { x: number; z: number }, r: number, u: Unit): Unit[] =>
  allowed(
    u,
    sim.foes(u.side).filter((e) => Math.hypot(e.x - at.x, e.z - at.z) <= r),
  );

// The enemies a piercing arrow from `u` through `target` would reach and may hit
export const inLineOf = (u: Unit, target: Unit): Unit[] => allowed(u, inLine(u, target));

const aimedRatio = (rank: number): number => 200 + rank * 15;

/** The Aimed Shot arrow. An upgrade may change its damage or add to what it does on a hit. */
export function aimedArrow(
  u: Unit,
  target: Unit | null,
  sim: Sim,
  more: { ratio?: number; flags?: number; onHit?: (hit: Unit) => void } = {},
): void {
  if (!target?.alive) {
    return;
  }
  sim.fire(u, target, {
    speed: ARROW_SPEED * 1.3,
    homing: true,
    skill: 'aimedShot',
    options: {
      range: Range.Ranged,
      ratio: (more.ratio ?? 1) * aimedRatio(rankOf(u, 'aimedShot')),
      flags: DamageFlags.Skill | DamageFlags.Projectile | (more.flags ?? 0),
    },
    onHit: more.onHit,
  });
}

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
    aimedArrow(u, target, sim);
  },
};

const SNARE_REACH = 7;
export const snareTime = (rank: number): number => 1.5 + rank * 0.25;

// The awake enemy nearest the bearer that is coming for it, if any.
export function comingForBearer(u: Unit): Unit | null {
  const bearer = u.sim.bearer;
  if (!bearer?.alive) {
    return null;
  }
  let best: Unit | null = null;
  for (const e of u.sim.living(Side.Monster)) {
    const d = e.distanceTo(bearer);
    if (e.aware && e.target === bearer && d <= SNARE_REACH && d > 1.5 && canTarget(u, e)) {
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
    return (
      comingForBearer(u) !== null && !sim.traps.some((t) => t.owner === u && t.skill === 'snare')
    );
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
      skill: 'snare',
    });
  },
};

export const chargedRatio = (rank: number): number => 90 + rank * 8;
const CHAIN_REACH = 3;

/** Fires a Storm arrow that leaps on to one more enemy near the first. */
export function stormArrow(
  u: Unit,
  target: Unit,
  skill: string,
  options: HitOptions,
  after?: (first: Unit) => void,
): void {
  const { sim } = u;
  sim.fire(u, target, {
    speed: ARROW_SPEED,
    homing: true,
    skill,
    options,
    onHit: (first) => {
      after?.(first);
      // A Ranger raised against the party keeps looking among the monsters, as it
      // always has: setting it right moves the Creditor fight (see the outcome).
      const near =
        u.side === Side.Party
          ? around(sim, first, CHAIN_REACH, u)
          : sim.living(Side.Monster).filter((e) => e.distanceTo(first) <= CHAIN_REACH);
      const next = near
        .filter((e) => e !== first)
        .sort((x, y) => x.distanceTo(first) - y.distanceTo(first))
        .at(0);
      if (next) {
        // The chain leaps from the first enemy, not from the Ranger.
        sim.chain(u, first, next, { speed: ARROW_SPEED * 2, skill, options });
      }
    },
  });
}

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
  cooldown: 3.5,
  windup: 0.6,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants(u, target) {
    return inReach(u, target);
  },
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target) {
    if (!target?.alive) {
      return;
    }
    stormArrow(u, target, 'chargedArrow', {
      range: Range.Ranged,
      element: Element.Storm,
      ratio: chargedRatio(rankOf(u, 'chargedArrow')),
      flags: DamageFlags.Skill | DamageFlags.Projectile,
    });
  },
};

export const pierceRatio = (rank: number): number => 150 + rank * 8;

/** Looses an arrow that flies straight through every enemy in its line. */
export function pierceArrow(
  u: Unit,
  target: Unit,
  skill: string,
  ratio: number,
  element?: Element,
): void {
  u.sim.fire(u, target, {
    speed: ARROW_SPEED * 1.4,
    distance: u.kit.reach + PIERCE_OVERSHOOT,
    radius: PIERCE_WIDTH,
    pierce: true,
    skill,
    options: {
      range: Range.Ranged,
      element,
      ratio,
      flags: DamageFlags.Skill | DamageFlags.Projectile,
    },
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
    return inLineOf(u, target).length >= 2 || isElite(target) || target.target === sim.bearer;
  },
  elite(u, target) {
    return target !== null && inLineOf(u, target).some(isElite);
  },
  release(u, target) {
    if (target) {
      pierceArrow(u, target, 'piercingArrow', pierceRatio(rankOf(u, 'piercingArrow')));
    }
  },
};

export const pinTime = (rank: number): number => 1 + rank * 0.25;

/** Ranger, Hawkeye tier 3. Longer reach and surer aim. */
export const EAGLE_EYE: Passive = {
  id: 'eagleEye',
  setup: (unit, rank) => ({
    start: () => {
      unit.kit.reach += 0.5 * rank;
      unit.setBonus('eagleEye', [{ stat: 'accuracy', add: 3 * rank }]);
    },
    stop: () => {
      unit.kit.reach -= 0.5 * rank;
      unit.setBonus('eagleEye', null);
    },
  }),
};
export const eagleEyeText = (rank: number): string =>
  `+${0.5 * rank} tiles of reach and +${3 * rank} accuracy.`;

/** Ranger, Stormcaller tier 2. Storm hits build up Shock faster. */
export const STATIC: Passive = {
  id: 'static',
  setup: (unit, rank) =>
    listen(unit.sim, SimEvents.CheckBuildup, ValuePriority.Multiplicative, (event) => {
      if (event.source === unit && event.status === SHOCK) {
        event.value *= 1 + 0.25 * rank;
      }
    }),
};
export const staticText = (rank: number): string => `+${25 * rank}% Shock buildup.`;

// A root trap of a skill's, set at a spot
export function trap(u: Unit, at: { x: number; z: number }, skill: string, duration: number): void {
  u.sim.traps.push({
    owner: u,
    x: at.x,
    z: at.z,
    radius: 0.5,
    life: 15,
    status: ROOTED,
    duration,
    sprung: false,
    skill,
  });
}

export const ROD_RADIUS = 2.5;
export const rodTime = (rank: number): number => 5 + rank * 0.5;
export const rodRatio = (rank: number): number => 35 + rank * 5;

/** Plants a rod at a spot. `more` adds what an upgrade does to each enemy struck. */
export function plantRod(
  u: Unit,
  at: { x: number; z: number },
  more: { buildup?: HitOptions['buildup']; after?: (e: Unit, wasShocked: boolean) => void } = {},
): void {
  const rank = rankOf(u, 'lightningRod');
  setZone(u.sim, {
    kind: 'lightningRod',
    owner: u,
    x: at.x,
    z: at.z,
    r: ROD_RADIUS,
    life: rodTime(rank),
    element: Element.Storm,
    pulse: (e) => {
      if (e.side !== u.side && u.alive && canTarget(u, e)) {
        const wasShocked = e.statuses.has(SHOCK.id);
        strike(u, e, {
          range: Range.Ranged,
          element: Element.Storm,
          ratio: rodRatio(rank),
          flags: DamageFlags.Skill | DamageFlags.AoE,
          buildup: more.buildup,
        });
        more.after?.(e, wasShocked);
      }
    },
  });
}

/**
 * Ranger, Stormcaller tier 4. Plants a rod that calls lightning: a Storm
 * field that strikes every enemy in it each second.
 */
export const LIGHTNING_ROD: Skill = {
  id: 'lightningRod',
  name: 'Lightning Rod',
  describe: (rank) =>
    `Shoots a rod into the ground by an enemy. For ${rodTime(rank)} seconds, lightning strikes every enemy within ${ROD_RADIUS} tiles of it each second for ${rodRatio(rank)}% Storm damage.`,
  cost: 18,
  cooldown: 15,
  windup: 0.6,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  wants: (u, target, sim) =>
    inReach(u, target) &&
    (around(sim, target, ROD_RADIUS, u).length >= 2 || isElite(target)) &&
    !sim.zones.some((z) => z.owner === u && z.kind === 'lightningRod'),
  elite: (u, target) => target !== null && around(u.sim, target, ROD_RADIUS, u).some(isElite),
  release(u, target) {
    if (target) {
      plantRod(u, target);
    }
  },
};
