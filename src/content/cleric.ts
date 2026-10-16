import { EventPriority } from '../core/event-emitter';
import { SimEvents } from '../sim/events';
import type Sim from '../sim/sim';
import { strike } from '../sim/sim';
import { type Passive, type Skill, Targeting } from '../sim/skill';
import { SEAR } from '../sim/statuses';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Element,
  Race,
  Range,
  Rank,
  Side,
  ValuePriority,
} from '../sim/types';
import type Unit from '../sim/unit';
import { setZone } from '../sim/zone';
import { listen } from './passives';
import { PRAYER_REACH, flockOf, isElite, rankOf } from './skills';

// The Cleric's later skills, from the skill-tree design. First numbers, for
// balance to settle.

// Awake monsters going for one of the party
const after = (sim: Sim, ally: Unit): Unit[] =>
  sim.living(Side.Monster).filter((e) => e.aware && e.target === ally);

// Whether the Cleric already has a zone of this kind on the ground
const placed = (u: Unit, kind: string): boolean =>
  u.sim.zones.some((z) => z.owner === u && z.kind === kind);

// The bearer first, then the rest of the flock
const bearerFirst = (u: Unit, pick: (p: Unit) => boolean): Unit | null => {
  const flock = flockOf(u).filter(pick);
  return flock.find((p) => p === u.sim.bearer) ?? flock.at(0) ?? null;
};

// ---------- Mercy ----------

const MARTYR_REACH = 5;
const MARTYR_SHARE = 0.2;

/** Mercy capstone. When the Cleric dies, the dead around it rise. */
export const MARTYR: Passive = {
  id: 'martyr',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDies, EventPriority.Post, (event) => {
      if (event.source !== unit) {
        return;
      }
      for (const p of unit.sim.units) {
        if (
          p !== unit &&
          p.side === unit.side &&
          p !== unit.sim.bearer &&
          !p.alive &&
          !p.torn &&
          unit.distanceTo(p) <= MARTYR_REACH
        ) {
          p.revive(MARTYR_SHARE);
        }
      }
    }),
};
export const martyrText = (): string =>
  `When the Cleric dies, every fallen ally within ${MARTYR_REACH} tiles rises with ${MARTYR_SHARE * 100}% health. Torn bodies stay dead.`;

// ---------- Sanctuary ----------

const wardAmount = (u: Unit, rank: number): number => 30 + rank * 15 + u.derived.matkMax;

/**
 * Sanctuary tier 1. A Ward on an ally or the bearer: a pool that takes
 * magical damage before its health does.
 */
export const WARD: Skill = {
  id: 'ward',
  name: 'Ward',
  describe: (rank) =>
    `Gives an ally or the bearer a Ward of ${30 + rank * 15}, plus the Cleric's magic attack, that absorbs magical damage.`,
  cost: 10,
  cooldown: 4,
  windup: 0.4,
  recovery: 0.3,
  targeting: Targeting.Ally,
  aim: (u, sim) =>
    bearerFirst(
      u,
      (p) => after(sim, p).length > 0 && p.ward < wardAmount(u, rankOf(u, 'ward')) / 2,
    ),
  wants: (_u, target) => target !== null,
  elite: (_u, target, sim) => target !== null && after(sim, target).some(isElite),
  release(u, target) {
    if (target?.alive) {
      target.ward = Math.max(target.ward, wardAmount(u, rankOf(u, 'ward')));
    }
  },
};

const SACRED_RADIUS = 2.2;
const SACRED_TIME = 8;
const sacredHeal = (u: Unit, rank: number): number =>
  6 + rank * 5 + Math.round(u.derived.matkMax * 0.25);

// The hurt ally with the most hurt allies around it, if two or more are
const hurtCluster = (u: Unit): Unit | null => {
  const hurt = flockOf(u).filter((p) => p.hp < p.derived.maxHp * 0.8);
  const count = (p: Unit): number => hurt.filter((q) => q.distanceTo(p) <= SACRED_RADIUS).length;
  const best = hurt.sort((a, b) => count(b) - count(a)).at(0);
  return best && count(best) >= 2 ? best : null;
};

/** Sanctuary tier 2. Hallows the ground: allies on it are healed each second. */
export const SACRED_GROUND: Skill = {
  id: 'sacredGround',
  name: 'Sacred Ground',
  describe: (rank) =>
    `Hallows the ground ${SACRED_RADIUS} tiles around an ally for ${SACRED_TIME} seconds. Allies on it heal ${6 + rank * 5}, plus a quarter of the Cleric's magic attack, each second.`,
  cost: 18,
  cooldown: 14,
  windup: 0.7,
  recovery: 0.3,
  targeting: Targeting.Ally,
  mends: true,
  aim: (u) => (placed(u, 'sacredGround') ? null : hurtCluster(u)),
  wants: (_u, target) => target !== null,
  elite: () => false,
  release(u, target, sim) {
    if (!target) {
      return;
    }
    const heal = sacredHeal(u, rankOf(u, 'sacredGround'));
    setZone(sim, {
      kind: 'sacredGround',
      owner: u,
      x: target.x,
      z: target.z,
      r: SACRED_RADIUS,
      life: SACRED_TIME,
      element: Element.Radiant,
      pulse: (p) => {
        if (p.side === u.side) {
          u.heal(p, heal);
        }
      },
    });
  },
};

const wallHits = (rank: number): number => 2 + rank;

// An ally a melee enemy is about to hit
const meleeMark = (u: Unit, sim: Sim): Unit | null =>
  bearerFirst(u, (p) =>
    after(sim, p).some((e) => e.job.range === Range.Melee && e.distanceTo(p) <= 2.5),
  );

/**
 * Sanctuary tier 3. A wall of faith on an ally's spot that stops the next
 * few melee blows on whoever stands in it.
 */
export const WALL_OF_FAITH: Skill = {
  id: 'wallOfFaith',
  name: 'Wall of Faith',
  describe: (rank) =>
    `Raises a wall of faith on an ally's spot that stops the next ${wallHits(rank)} melee blows on anyone in it.`,
  cost: 14,
  cooldown: 10,
  windup: 0.4,
  recovery: 0.3,
  targeting: Targeting.Ally,
  aim: (u, sim) => (placed(u, 'wallOfFaith') ? null : meleeMark(u, sim)),
  wants: (_u, target) => target !== null,
  elite: (_u, target, sim) => target !== null && after(sim, target).some(isElite),
  release(u, target, sim) {
    if (!target) {
      return;
    }
    setZone(sim, {
      kind: 'wallOfFaith',
      owner: u,
      x: target.x,
      z: target.z,
      r: 0.9,
      life: 10,
      element: Element.Radiant,
      guards: 'melee',
      charges: wallHits(rankOf(u, 'wallOfFaith')),
    });
  },
};

const VEIL_RADIUS = 2.5;
const veilTime = (rank: number): number => 4 + rank;

// The bearer, when an archer is shooting at the party near it
const shotAt = (u: Unit, sim: Sim): Unit | null => {
  const bearer = sim.bearer;
  if (!bearer?.alive || u.distanceTo(bearer) > PRAYER_REACH) {
    return null;
  }
  const archers = sim
    .living(Side.Monster)
    .some(
      (e) =>
        e.aware &&
        e.job.range === Range.Ranged &&
        e.target?.side === Side.Party &&
        e.target.distanceTo(bearer) <= VEIL_RADIUS,
    );
  return archers ? bearer : null;
};

/** Sanctuary tier 4. A veil over the bearer that arrows and bolts cannot pass. */
export const VEIL: Skill = {
  id: 'veil',
  name: 'Veil',
  describe: (rank) =>
    `A veil ${VEIL_RADIUS} tiles around the bearer for ${veilTime(rank)} seconds. Ranged physical hits on anyone inside are stopped.`,
  cost: 18,
  cooldown: 15,
  windup: 0.5,
  recovery: 0.3,
  targeting: Targeting.Ally,
  aim: (u, sim) => (placed(u, 'veil') ? null : shotAt(u, sim)),
  wants: (_u, target) => target !== null,
  elite: () => false,
  release(u, target, sim) {
    if (!target) {
      return;
    }
    setZone(sim, {
      kind: 'veil',
      owner: u,
      x: target.x,
      z: target.z,
      r: VEIL_RADIUS,
      life: veilTime(rankOf(u, 'veil')),
      element: Element.Radiant,
      guards: 'ranged',
    });
  },
};

const AEGIS_CALM = 3;
const AEGIS_REACH = 8;
const aegisWard = (u: Unit): number => 80 + u.level * 4;

/** Sanctuary capstone. Out of a fight, the bearer's Ward fills again. */
export const AEGIS: Passive = {
  id: 'aegis',
  setup: (unit) => {
    let quietSince = 0;
    return listen(unit.sim, SimEvents.Tick, EventPriority.Post, () => {
      const { sim } = unit;
      const bearer = sim.bearer;
      if (!bearer?.alive || !unit.alive) {
        return;
      }
      const fight = sim
        .living(Side.Monster)
        .some((e) => e.aware && e.distanceTo(bearer) <= AEGIS_REACH);
      if (fight) {
        quietSince = sim.time;
      } else if (sim.time - quietSince >= AEGIS_CALM) {
        bearer.ward = Math.max(bearer.ward, aegisWard(unit));
      }
    });
  },
};
export const aegisText = (): string =>
  `${AEGIS_CALM} seconds out of a fight, the bearer's Ward fills to 80, plus 4 for each of the Cleric's levels.`;

// ---------- Inquisition ----------

/** Inquisition tier 2. Radiant hits sear the dead and the Occult faster. */
export const HOLY_LIGHT: Passive = {
  id: 'holyLight',
  setup: (unit, rank) =>
    listen(unit.sim, SimEvents.CheckBuildup, ValuePriority.Multiplicative, (event) => {
      if (event.source === unit && event.status === SEAR) {
        event.value *= 1 + 0.25 * rank;
      }
    }),
};
export const holyLightText = (rank: number): string =>
  `+${25 * rank}% Sear buildup. Seared Undead and Occult enemies take 20% more damage.`;

const TURN_REACH = 5;
const turnChance = (rank: number): number => 0.15 + rank * 0.05;

const turnable = (u: Unit, target: Unit | null): target is Unit =>
  target !== null &&
  target.race === Race.Undead &&
  target.rank !== Rank.Boss &&
  u.distanceTo(target) <= TURN_REACH;

/**
 * Inquisition tier 3. Commands the dead to be still. A chance to destroy a
 * non-boss Undead outright, more the more it is hurt; Radiant fire if not.
 */
export const TURN_UNDEAD: Skill = {
  id: 'turnUndead',
  name: 'Turn Undead',
  describe: (rank) =>
    `A ${Math.round(turnChance(rank) * 100)}% chance, up to 30% more as it is hurt, to destroy a non-boss Undead at once. Otherwise Radiant fire for 100% magic damage.`,
  cost: 14,
  cooldown: 6,
  windup: 0.6,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  wants: (u, target) => turnable(u, target),
  elite: (_u, target) => target !== null && isElite(target),
  release(u, target, sim) {
    if (!target?.alive || !turnable(u, target)) {
      return;
    }
    const hurt = 1 - target.hp / target.derived.maxHp;
    const chance = turnChance(rankOf(u, 'turnUndead')) + hurt * 0.3;
    if (sim.rng.random() < chance) {
      target.aware = true;
      u.hit(target, { kind: DamageKind.True, fixed: target.hp, flags: DamageFlags.Skill });
      return;
    }
    strike(u, target, {
      kind: DamageKind.Magical,
      element: Element.Radiant,
      range: Range.Ranged,
      ratio: 100,
      flags: DamageFlags.Skill,
    });
  },
};

const CONSECRATE_RADIUS = 2.5;
const CONSECRATE_TIME = 6;
const consecrateRatio = (rank: number): number => 40 + rank * 10;

const around = (sim: Sim, at: { x: number; z: number }): Unit[] =>
  sim.living(Side.Monster).filter((e) => Math.hypot(e.x - at.x, e.z - at.z) <= CONSECRATE_RADIUS);

/**
 * Inquisition tier 4. Hallows the ground under the enemy: Radiant fire
 * burns every enemy on it each second.
 */
export const CONSECRATION: Skill = {
  id: 'consecrate',
  name: 'Consecrate',
  describe: (rank) =>
    `Consecrates the ground ${CONSECRATE_RADIUS} tiles around an enemy for ${CONSECRATE_TIME} seconds. Every enemy on it takes ${consecrateRatio(rank)}% Radiant magic damage each second.`,
  cost: 18,
  cooldown: 12,
  windup: 0.7,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  wants: (u, target, sim) =>
    target !== null &&
    u.distanceTo(target) <= PRAYER_REACH &&
    (around(sim, target).length >= 2 || isElite(target)) &&
    !placed(u, 'consecrate'),
  elite: (_u, target, sim) => target !== null && around(sim, target).some(isElite),
  release(u, target, sim) {
    if (!target) {
      return;
    }
    const ratio = consecrateRatio(rankOf(u, 'consecrate'));
    setZone(sim, {
      kind: 'consecrate',
      owner: u,
      x: target.x,
      z: target.z,
      r: CONSECRATE_RADIUS,
      life: CONSECRATE_TIME,
      element: Element.Radiant,
      pulse: (e) => {
        if (e.side !== u.side && u.alive) {
          strike(u, e, {
            kind: DamageKind.Magical,
            element: Element.Radiant,
            range: Range.Ranged,
            ratio,
            flags: DamageFlags.Skill | DamageFlags.AoE,
          });
        }
      },
    });
  },
};

const PURGE_BANE = 1.25;

/** Inquisition capstone. Occult enemies take more damage from the whole party. */
export const PURGE: Passive = {
  id: 'purge',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Amplify, (event) => {
      if (
        unit.alive &&
        event.source.side === unit.side &&
        event.target.element === Element.Occult &&
        event.kind !== DamageKind.True
      ) {
        event.value *= PURGE_BANE;
      }
    }),
};
export const purgeText = (): string =>
  `While the Cleric lives, Occult enemies take ${Math.round((PURGE_BANE - 1) * 100)}% more damage from the party.`;
