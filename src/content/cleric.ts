import { EventPriority } from '../core/event-emitter';
import { SimEvents } from '../sim/events';
import { strike } from '../sim/sim';
import { type Passive, type Skill, Targeting } from '../sim/skill';
import { hostiles } from '../sim/targeting';
import { DamageFlags, DamageKind, Element, Race, Range, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { setZone } from '../sim/zone';
import listen from './passives';
import { isElite, rankOf } from './skills';

// How far the Cleric's prayers reach, in tiles.
export const PRAYER_REACH = 6;
// 20 a rank, not doc 16's 10: the other spells' gains are halved, but at 10
// three mercs beat the layer-1 boss in only 4 of 6 seeds, and
// test/sim/bosses.test.ts needs 5.
export const healAmount = (u: Unit, rank: number): number => 40 + rank * 20 + u.derived.matkMax;
// Allies below this share of health are worth a Heal.
export const HEAL_BELOW = 0.7;

// The living party within reach of the Cleric, the bearer included.
export function flockOf(u: Unit): Unit[] {
  return u.sim.living(Side.Party).filter((p) => u.distanceTo(p) <= PRAYER_REACH);
}

// The ally most in need, by share of health. The bearer comes first when
// it is in danger at all.
export function neediest(
  u: Unit,
  below: number,
  skip: (p: Unit) => boolean = () => false,
): Unit | null {
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
  mends: true,
  aim: (u) => neediest(u, HEAL_BELOW),
  wants: (_u, target) => target !== null,
  elite: () => false,
  release(u, target) {
    if (target?.alive) {
      u.heal(target, healAmount(u, rankOf(u, 'heal')));
    }
  },
};

export const SMITE_REACH = 5;
const smiteRatio = (rank: number): number => 110 + rank * 10;
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

// The Cleric's later skills, from the skill-tree design. First numbers, for
// balance to settle.

// Awake enemies going for one of the party, that the Cleric may target. An
// elite in a Duel is not one of them (docs/design/16-builds.md, Duel).
export const after = (u: Unit, ally: Unit): Unit[] =>
  hostiles(u).filter((e) => e.aware && e.target === ally);

// Whether the Cleric already has a zone of this kind on the ground
export const placed = (u: Unit, kind: string): boolean =>
  u.sim.zones.some((z) => z.owner === u && z.kind === kind);

// The bearer first, then the rest of the flock
export const bearerFirst = (u: Unit, pick: (p: Unit) => boolean): Unit | null => {
  const flock = flockOf(u).filter(pick);
  return flock.find((p) => p === u.sim.bearer) ?? flock.at(0) ?? null;
};

// ---------- Sanctuary ----------

export const wardAmount = (u: Unit, rank: number): number => 30 + rank * 8 + u.derived.matkMax;

/**
 * Sanctuary tier 1. A Ward on an ally or the bearer: a pool that takes
 * magical damage before its health does.
 */
export const WARD: Skill = {
  id: 'ward',
  name: 'Ward',
  describe: (rank) =>
    `Gives an ally or the bearer a Ward of ${30 + rank * 8}, plus the Cleric's magic attack, that absorbs magical damage.`,
  cost: 10,
  cooldown: 4,
  windup: 0.4,
  recovery: 0.3,
  targeting: Targeting.Ally,
  aim: (u) =>
    bearerFirst(u, (p) => after(u, p).length > 0 && p.ward < wardAmount(u, rankOf(u, 'ward')) / 2),
  wants: (_u, target) => target !== null,
  elite: (u, target) => target !== null && after(u, target).some(isElite),
  release(u, target) {
    if (target?.alive) {
      target.ward = Math.max(target.ward, wardAmount(u, rankOf(u, 'ward')));
    }
  },
};

export const SACRED_RADIUS = 2.2;
export const SACRED_TIME = 8;
// Health a second at a rank, before magic attack: 2.5 a rank, rounded down
const sacredBase = (rank: number): number => 6 + Math.floor(rank * 2.5);
export const sacredHeal = (u: Unit, rank: number): number =>
  sacredBase(rank) + Math.round(u.derived.matkMax * 0.25);

// The hurt ally with the most hurt allies around it, if two or more are
export const hurtCluster = (u: Unit): Unit | null => {
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
    `Hallows the ground ${SACRED_RADIUS} tiles around an ally for ${SACRED_TIME} seconds. Allies on it heal ${sacredBase(rank)}, plus a quarter of the Cleric's magic attack, each second.`,
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
