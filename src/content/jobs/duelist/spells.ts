import type { Lifecycle } from '../../../core/lifecycle';
import { Hunt } from '../../../sim/ai';
import { SimEvents } from '../../../sim/events';
import { strike } from '../../../sim/sim';
import { type Passive, type Skill, Targeting } from '../../../sim/skill';
import type { StatusDef } from '../../../sim/status';
import { allowed } from '../../../sim/targeting';
import { DamageFlags, Range, Side, ValuePriority } from '../../../sim/types';
import type Unit from '../../../sim/unit';
import listen from '../../passives';
import { inReach, isElite, rankOf } from '../../skills';

// The Duelist's spells and innate, from docs/design/16-builds.md. Numbers are
// first guesses. The spells are exported so the elite upgrades can patch them.

// How far from the Duelist an elite may stand for a Duel to begin
export const DUEL_RANGE = 2.5;
// How far Shadowstep reaches for a caster or healer
export const SHADOWSTEP_RANGE = 8;
// How far Lunge reaches
export const LUNGE_RANGE = 4;
// The chance to parry a melee hit, in percent
export const RIPOSTE_CHANCE = 15;

export const duelTime = (rank: number): number => 4 + rank * 0.5;
export const shadowstepRatio = (rank: number): number => 130 + rank * 10;
export const lungeRatio = (rank: number): number => 120 + rank * 10;
export const flurryRatio = (rank: number): number => 40 + rank * 4;
export const FLURRY_HITS = 4;

/**
 * Bound in a Duel. Both fighters carry it, each with the other as its source.
 * While it lasts, neither may target or be targeted by anyone else (area hits
 * still land). It ends when either dies.
 */
export const DUELING: StatusDef = {
  id: 'dueling',
  name: 'Duel',
  duration: 4,
  immunity: 0,
  endsWithSource: true,
  setup: (status): Lifecycle => {
    const { sim } = status.unit;
    const a = status.unit;
    const b = status.source;
    const forbid = (event: { source: Unit; target: Unit; allowed: boolean }): void => {
      // Only the pair may choose each other: a choice that crosses the bond is refused.
      const bound = (u: Unit): boolean => u === a || u === b;
      if (bound(event.source) !== bound(event.target)) {
        event.allowed = false;
      }
    };
    return {
      start: () => {
        sim.on(SimEvents.CheckTarget, ValuePriority.Post, forbid);
      },
      stop: () => {
        sim.off(SimEvents.CheckTarget, ValuePriority.Post, forbid);
      },
    };
  },
};

/** The unit a unit is bound to in a Duel, or null. */
export const partnerOf = (u: Unit): Unit | null => u.statuses.get(DUELING.id)?.source ?? null;

/** Binds `a` and `b` in a Duel for `time` seconds. Returns whether it began. */
export function beginDuel(a: Unit, b: Unit, time: number): boolean {
  if (partnerOf(a) || partnerOf(b)) {
    return false;
  }
  const first = a.addStatus(DUELING, b, time);
  const second = b.addStatus(DUELING, a, time);
  if (!first || !second) {
    // Either side refused it (immune, dead): neither is bound.
    a.removeStatus(DUELING.id);
    b.removeStatus(DUELING.id);
    return false;
  }
  a.target = b;
  b.target = a;
  return true;
}

const isAlive = (u: Unit): boolean => u.alive;
const dueling = (u: Unit): boolean => partnerOf(u) !== null;

/**
 * Duelist spell 1. Binds the Duelist and one elite: neither can target or be
 * targeted by anyone else for a few seconds.
 */
export const DUEL: Skill = {
  id: 'duel',
  name: 'Duel',
  describe: (rank) =>
    `Binds the Duelist and one elite for ${duelTime(rank)} seconds. Neither can target or be targeted by anyone else.`,
  cost: 14,
  cooldown: 16,
  windup: 0.4,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  wants(u, target) {
    return (
      target !== null &&
      isElite(target) &&
      !dueling(u) &&
      !dueling(target) &&
      u.distanceTo(target) <= DUEL_RANGE
    );
  },
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target) {
    if (
      !target?.alive ||
      dueling(u) ||
      dueling(target) ||
      u.distanceTo(target) > DUEL_RANGE + 0.5
    ) {
      return;
    }
    target.aware = true;
    u.face(target);
    beginDuel(u, target, duelTime(rankOf(u, 'duel')));
  },
};

// Whether a monster casts spells or heals, the targets Shadowstep looks for
function isCaster(e: Unit): boolean {
  return e.hunt === Hunt.Support || e.skills.length > 0 || e.weapon.matk > 0;
}

// The nearest caster or healer the Duelist may target
function casterFor(u: Unit): Unit | null {
  let best: Unit | null = null;
  for (const e of allowed(u, u.sim.living(Side.Monster))) {
    if (e.aware && isCaster(e) && u.distanceTo(e) <= SHADOWSTEP_RANGE) {
      if (!best || u.distanceTo(e) < u.distanceTo(best)) {
        best = e;
      }
    }
  }
  return best;
}

// Moves `u` to a point `gap` tiles from `target` along the bearing `angle`,
// if the ground there is open. Returns whether it moved.
function stepTo(u: Unit, target: Unit, angle: number, gap: number): boolean {
  const x = target.x + Math.cos(angle) * gap;
  const z = target.z + Math.sin(angle) * gap;
  if (u.sim.nav && !u.sim.nav.walkable(x, z)) {
    return false;
  }
  u.x = x;
  u.z = z;
  u.face(target);
  return true;
}

/**
 * Duelist spell 2. Teleports behind a caster or healer, then hits it from
 * behind, so a shield cannot block it.
 */
export const SHADOWSTEP: Skill = {
  id: 'shadowstep',
  name: 'Shadowstep',
  describe: (rank) =>
    `Teleports behind a caster or healer, then hits it for ${shadowstepRatio(rank)}% damage with the back bonus.`,
  cost: 10,
  cooldown: 10,
  windup: 0.25,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  aim: (u) => casterFor(u),
  wants: (_u, target) => target !== null,
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target) {
    if (!target?.alive || u.distanceTo(target) > SHADOWSTEP_RANGE + 0.5) {
      return;
    }
    // Behind is opposite to where the target faces.
    const back = target.angle + Math.PI;
    const gap = u.kit.reach * 0.8;
    if (!stepTo(u, target, back, gap) && !stepTo(u, target, back, gap * 0.5)) {
      return;
    }
    strike(u, target, {
      ratio: shadowstepRatio(rankOf(u, 'shadowstep')),
      flags: DamageFlags.Skill,
    });
  },
};

/**
 * Duelist spell 3. A thrust that closes the gap: the Duelist crosses it and
 * strikes.
 */
export const LUNGE: Skill = {
  id: 'lunge',
  name: 'Lunge',
  describe: (rank) => `A thrust that closes the gap, for ${lungeRatio(rank)}% damage.`,
  cost: 8,
  cooldown: 6,
  windup: 0.3,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  wants: (u, target) => target !== null && u.distanceTo(target) <= LUNGE_RANGE,
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target) {
    if (!target?.alive || u.distanceTo(target) > LUNGE_RANGE + 0.5) {
      return;
    }
    // Ends one reach from the target, on the side the Duelist came from.
    if (u.distanceTo(target) > u.kit.reach) {
      const from = Math.atan2(u.z - target.z, u.x - target.x);
      if (!stepTo(u, target, from, u.kit.reach * 0.8)) {
        return;
      }
    }
    strike(u, target, { ratio: lungeRatio(rankOf(u, 'lunge')), flags: DamageFlags.Skill });
  },
};

/**
 * Duelist spell 4, the filler. Four quick hits, each through the full damage
 * pipeline.
 */
export const FLURRY: Skill = {
  id: 'flurry',
  name: 'Flurry',
  describe: (rank) => `${FLURRY_HITS} quick hits for ${flurryRatio(rank)}% damage each.`,
  cost: 8,
  cooldown: 3,
  windup: 0.3,
  recovery: 0.4,
  targeting: Targeting.Enemy,
  wants: (u, target) => inReach(u, target),
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target) {
    if (!target?.alive || u.distanceTo(target) > u.kit.reach + 0.5) {
      return;
    }
    const ratio = flurryRatio(rankOf(u, 'flurry'));
    for (let i = 0; i < FLURRY_HITS; i++) {
      // A hit that kills ends the flurry
      if (!isAlive(target)) {
        break;
      }
      strike(u, target, { ratio, flags: DamageFlags.Skill });
    }
  },
};

/**
 * Duelist innate. A melee hit on the Duelist may be parried: it is cancelled
 * and answered by a free counter. The counter never misses, so it cannot be
 * parried back.
 */
export const RIPOSTE: Passive = {
  id: 'riposte',
  setup: (unit) =>
    listen(unit.sim, SimEvents.CheckHit, ValuePriority.Post, (event) => {
      if (
        event.target !== unit ||
        !unit.alive ||
        !event.hit ||
        event.range !== Range.Melee ||
        event.source.side === unit.side ||
        event.flags & (DamageFlags.Sure | DamageFlags.Reflected) ||
        unit.disabled
      ) {
        return;
      }
      if (unit.sim.rng.random() * 100 >= RIPOSTE_CHANCE) {
        return;
      }
      event.hit = false;
      event.critical = false;
      unit.face(event.source);
      strike(unit, event.source, { flags: DamageFlags.BasicAttack | DamageFlags.Sure });
    }),
};

export const riposteText = (): string =>
  `A ${RIPOSTE_CHANCE}% chance to parry a melee hit. A parry triggers a free counter.`;
