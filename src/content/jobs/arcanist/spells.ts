import { affinity } from '../../../sim/elements';
import { SimEvents } from '../../../sim/events';
import { ARROW_SPEED, strike } from '../../../sim/sim';
import { type Passive, type Skill, Targeting, type Victim, areaVictims } from '../../../sim/skill';
import { BURN, CHILL } from '../../../sim/statuses';
import { DamageFlags, DamageKind, Element, Range, ValuePriority } from '../../../sim/types';
import type Unit from '../../../sim/unit';
import listen from '../../passives';
import { inReach, isElite, rankOf } from '../../skills';

// The Arcanist's spells and innate, from docs/design/16-builds.md. Numbers are
// first guesses. The spells are exported so the elite upgrades can patch them.

// The ring of Frost Nova, around the Arcanist, in tiles
export const NOVA_RADIUS = 2.5;
// The blast of Fireball, around its target, in tiles
export const FIREBALL_RADIUS = 2;

export const novaRatio = (rank: number): number => 90 + rank * 8;
export const novaChill = (rank: number): number => 30 + rank * 3;
export const fireballRatio = (rank: number): number => 130 + rank * 12;
export const shardRatio = (rank: number): number => 100 + rank * 8;
export const fireboltRatio = (rank: number): number => 100 + rank * 8;
export const fireboltBurn = (rank: number): number => 20 + rank * 2;

// The spell as this unit casts it, with its elite upgrade applied
function castAs(u: Unit, base: Skill): Skill {
  return u.skills.find((s) => s.id === base.id) ?? base;
}

// Who the ring of a nova or the blast of a fireball hits at a spot
const blast = (u: Unit, spell: Skill, at: { x: number; z: number }, radius: number): Victim[] =>
  areaVictims(u, castAs(u, spell), at, radius);

/**
 * Arcanist spell 1. A ring of Frost around the Arcanist that answers whatever
 * reaches it, and builds toward Freeze.
 */
export const FROST_NOVA: Skill = {
  id: 'frostNova',
  name: 'Frost Nova',
  describe: (rank) =>
    `A ring of Frost ${NOVA_RADIUS} tiles around the Arcanist for ${novaRatio(rank)}% magic damage, with ${novaChill(rank)} Chill buildup toward Freeze.`,
  cost: 14,
  cooldown: 7,
  windup: 0.5,
  recovery: 0.3,
  targeting: Targeting.Self,
  wants: (u) => blast(u, FROST_NOVA, u, NOVA_RADIUS).length > 0,
  elite: (u) => blast(u, FROST_NOVA, u, NOVA_RADIUS).some((v) => isElite(v.target)),
  release(u) {
    const rank = rankOf(u, 'frostNova');
    for (const v of blast(u, FROST_NOVA, u, NOVA_RADIUS)) {
      if (!v.target.alive) {
        continue;
      }
      v.target.aware = true;
      strike(u, v.target, {
        kind: DamageKind.Magical,
        element: Element.Frost,
        range: Range.Ranged,
        ratio: novaRatio(rank),
        flags: DamageFlags.Skill | v.flags,
        buildup: [{ status: CHILL, amount: novaChill(rank) }],
      });
    }
  },
};

/**
 * Arcanist spell 2. A Fire area on a crowd. It does not hurt the party unless
 * an upgrade gives it friendly fire.
 */
export const FIREBALL: Skill = {
  id: 'fireball',
  name: 'Fireball',
  describe: (rank) =>
    `A ${FIREBALL_RADIUS}-tile Fire area at the target for ${fireballRatio(rank)}% magic damage. It does not hurt allies.`,
  cost: 16,
  cooldown: 6,
  windup: 0.8,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  // Saved for a crowd, or an elite
  wants: (u, target) =>
    inReach(u, target) &&
    (isElite(target) || blast(u, FIREBALL, target, FIREBALL_RADIUS).length >= 2),
  elite: (u, target) =>
    target !== null && blast(u, FIREBALL, target, FIREBALL_RADIUS).some((v) => isElite(v.target)),
  release(u, target) {
    if (!target?.alive || u.distanceTo(target) > u.kit.reach + 1) {
      return;
    }
    const ratio = fireballRatio(rankOf(u, 'fireball'));
    for (const v of blast(u, FIREBALL, target, FIREBALL_RADIUS)) {
      if (!v.target.alive) {
        continue;
      }
      v.target.aware = true;
      strike(u, v.target, {
        kind: DamageKind.Magical,
        element: Element.Fire,
        range: Range.Ranged,
        ratio,
        flags: DamageFlags.Skill | v.flags,
      });
    }
  },
};

/** The element a target takes more from, Fire unless Frost is plainly better. */
export function senseElement(target: Unit): Element.Fire | Element.Frost {
  const fire = affinity(Element.Fire, target.element, target.elementLevel);
  const frost = affinity(Element.Frost, target.element, target.elementLevel);
  return frost > fire ? Element.Frost : Element.Fire;
}

// Whether a bolt is the one Elemental Sense picks for the target
const sensed = (target: Unit, element: Element): boolean => senseElement(target) === element;

/** Arcanist spell 3. A Frost bolt. Cast at what takes more from Frost than Fire. */
export const FROST_SHARD: Skill = {
  id: 'frostShard',
  name: 'Frost Shard',
  describe: (rank) => `A Frost bolt for ${shardRatio(rank)}% magic damage.`,
  cost: 7,
  cooldown: 2.5,
  windup: 0.5,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants: (u, target) => inReach(u, target) && sensed(target, Element.Frost),
  elite: (_u, target) => target !== null && isElite(target),
  release(u, target, sim) {
    if (!target?.alive) {
      return;
    }
    sim.fire(u, target, {
      speed: ARROW_SPEED * 1.2,
      homing: true,
      skill: 'frostShard',
      options: {
        kind: DamageKind.Magical,
        element: Element.Frost,
        range: Range.Ranged,
        ratio: shardRatio(rankOf(u, 'frostShard')),
        flags: DamageFlags.Skill | DamageFlags.Projectile,
      },
    });
  },
};

/**
 * Arcanist spell 4, the filler. A Fire bolt that builds Burn. Cast at
 * everything that does not take more from Frost.
 */
export const FIREBOLT: Skill = {
  id: 'firebolt',
  name: 'Firebolt',
  describe: (rank) =>
    `A Fire bolt for ${fireboltRatio(rank)}% magic damage and ${fireboltBurn(rank)} Burn buildup.`,
  cost: 7,
  cooldown: 2.5,
  windup: 0.5,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants: (u, target) => inReach(u, target) && sensed(target, Element.Fire),
  elite: (_u, target) => target !== null && isElite(target),
  release(u, target, sim) {
    if (!target?.alive) {
      return;
    }
    const rank = rankOf(u, 'firebolt');
    sim.fire(u, target, {
      speed: ARROW_SPEED * 1.2,
      homing: true,
      skill: 'firebolt',
      options: {
        kind: DamageKind.Magical,
        element: Element.Fire,
        range: Range.Ranged,
        ratio: fireboltRatio(rank),
        flags: DamageFlags.Skill | DamageFlags.Projectile,
        buildup: [{ status: BURN, amount: fireboltBurn(rank) }],
      },
    });
  },
};

/**
 * Arcanist innate. For each target the Arcanist casts the bolt of the element
 * the target is weaker to (see `senseElement`; the bolts read it in `wants`).
 * Here it also tells the "weak to my element" priority that both Fire and
 * Frost count, so the Arcanist goes first for what either one hurts most.
 */
export const ELEMENTAL_SENSE: Passive = {
  id: 'elementalSense',
  setup: (unit) =>
    listen(unit.sim, SimEvents.CheckAttackElements, ValuePriority.Post, (event) => {
      if (event.source !== unit) {
        return;
      }
      for (const element of [Element.Fire, Element.Frost]) {
        if (!event.elements.includes(element)) {
          event.elements.push(element);
        }
      }
    }),
};

export const elementalSenseText = (): string =>
  'For each target, casts the bolt of the element the target is weaker to. If neither is better, Firebolt. Counts Fire and Frost for the weak-to-my-element priority.';
