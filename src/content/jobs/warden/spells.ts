import { SimEvents } from '../../../sim/events';
import { strike } from '../../../sim/sim';
import { type Passive, type Skill, Targeting } from '../../../sim/skill';
import type { StatusDef } from '../../../sim/status';
import { STUN } from '../../../sim/statuses';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Range,
  Rank,
  Side,
  ValuePriority,
} from '../../../sim/types';
import type Unit from '../../../sim/unit';
import listen from '../../passives';
import { inReach, isElite, rankOf } from '../../skills';

// The Warden's spells, innate and statuses, as drawn in
// docs/design/16-builds.md. The job itself is in ./index.

const MARK_TIME = 6;
const INTERPOSE_REACH = 3;
// How far from the bearer the Warden chases an enemy, at most
export const INTERPOSE_CHASE = 4;
export const INTERPOSE_SHARE = 0.8;
const EXECUTE_BELOW = 0.2;
const PURSUE_REACH = 6;

/**
 * An enemy the Warden is after. Given when it damages the bearer or springs
 * a Tripwire. Pursue and Execute need it; upgrades read it.
 */
export const MARKED: StatusDef = {
  id: 'marked',
  name: 'Marked',
  duration: MARK_TIME,
  immunity: 0,
};

export const isMarked = (u: Unit): boolean => u.statuses.has(MARKED.id);

// Bosses and mini-bosses cannot be executed.
const executable = (u: Unit): boolean => u.rank !== Rank.Boss && !u.named;

// Moves a unit to a spot if it can stand there.
function stepTo(u: Unit, x: number, z: number, face: Unit | null): void {
  if (!u.sim.nav || u.sim.nav.walkable(x, z)) {
    u.x = x;
    u.z = z;
    if (face) {
      u.face(face);
    }
  }
}

/**
 * Warden, innate. Within INTERPOSE_REACH tiles of the bearer, takes 80% of
 * every hit aimed at the bearer. An enemy that damages the bearer is marked
 * for 6 seconds. It chases nothing farther than INTERPOSE_CHASE tiles from
 * the bearer, so it stays near enough to step in; Pursue still leaps out.
 */
export const INTERPOSE: Passive = {
  id: 'interpose',
  setup: (unit) => {
    const share = listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Pre, (event) => {
      const bearer = unit.sim.bearer;
      if (
        event.target !== bearer ||
        !unit.alive ||
        unit.disabled ||
        event.value <= 0 ||
        event.source.side === unit.side ||
        event.flags & DamageFlags.Redirected
      ) {
        return;
      }
      // The hit reaches the bearer, so its author is marked.
      event.source.addStatus(MARKED, unit);
      if (unit.distanceTo(bearer) > INTERPOSE_REACH) {
        return;
      }
      const taken = Math.floor(event.value * INTERPOSE_SHARE);
      if (taken > 0) {
        event.value -= taken;
        event.source.hit(unit, {
          kind: DamageKind.True,
          fixed: taken,
          flags: DamageFlags.Redirected,
        });
      }
    });
    const chase = listen(unit.sim, SimEvents.CheckChase, ValuePriority.Exact, (event) => {
      if (event.source === unit) {
        event.value = Math.min(event.value, INTERPOSE_CHASE);
      }
    });
    return {
      start: () => {
        share.start();
        chase.start();
      },
      stop: () => {
        share.stop();
        chase.stop();
      },
    };
  },
};
export const interposeText = (): string =>
  `Within ${INTERPOSE_REACH} tiles of the bearer, takes ${INTERPOSE_SHARE * 100}% of every hit aimed at the bearer, and chases nothing farther than ${INTERPOSE_CHASE} tiles from it. An enemy that damages the bearer is marked for ${MARK_TIME} seconds.`;

// ---------- Cover ----------

const coverTime = (rank: number): number => 3 + rank * 0.25;

/**
 * The Warden stands in front of the bearer. Projectiles that come from the
 * Warden's side of the bearer stop.
 */
export const COVERING: StatusDef = {
  id: 'covering',
  name: 'Covering',
  duration: 3,
  immunity: 0,
  setup: (status) =>
    listen(status.unit.sim, SimEvents.CheckProjectile, 0, (event) => {
      const guard = status.unit;
      const { bearer } = guard.sim;
      if (event.target !== bearer || !guard.alive || event.source.side === guard.side) {
        return;
      }
      // In front: the shooter is on the same side of the bearer as the Warden.
      const front =
        (event.source.x - bearer.x) * (guard.x - bearer.x) +
          (event.source.z - bearer.z) * (guard.z - bearer.z) >
        0;
      if (front) {
        event.disabled = true;
      }
    }),
};

// The enemy shooting at the bearer, nearest first.
function shooter(u: Unit): Unit | null {
  const bearer = u.sim.bearer;
  if (!bearer) {
    return null;
  }
  return (
    u.sim
      .living(Side.Monster)
      .filter(
        (e) =>
          e.aware &&
          e.job.range === Range.Ranged &&
          e.target === bearer &&
          bearer.distanceTo(e) <= 12,
      )
      .sort((a, b) => bearer.distanceTo(a) - bearer.distanceTo(b))
      .at(0) ?? null
  );
}

/**
 * Warden, spell 1. Pulls the bearer behind the Warden and shields it from
 * arrows and bolts from the front.
 */
export const COVER: Skill = {
  id: 'cover',
  name: 'Cover',
  describe: (rank) =>
    `Pulls the bearer behind the Warden. For ${coverTime(rank)} seconds, projectiles from the front cannot reach the bearer.`,
  cost: 12,
  cooldown: 12,
  windup: 0.25,
  recovery: 0.25,
  targeting: Targeting.Self,
  wants: (u) => shooter(u) !== null && !u.statuses.has(COVERING.id),
  elite: (u) => {
    const s = shooter(u);
    return s !== null && isElite(s);
  },
  release(u, _target, sim) {
    const bearer = sim.bearer;
    const s = shooter(u);
    if (!s || !bearer?.alive) {
      return;
    }
    // Behind the Warden, away from the shooter.
    const dx = u.x - s.x;
    const dz = u.z - s.z;
    const d = Math.hypot(dx, dz) || 1;
    stepTo(bearer, u.x + (dx / d) * 0.9, u.z + (dz / d) * 0.9, null);
    u.face(s);
    u.addStatus(COVERING, u, coverTime(rankOf(u, 'cover')));
  },
};

// ---------- Execute ----------

const executeRatio = (rank: number): number => 120 + rank * 12;

/**
 * Warden, spell 2. A heavy blow that finishes a marked enemy below 20%
 * health. Bosses and mini-bosses are immune to the finish.
 */
export const EXECUTE: Skill = {
  id: 'execute',
  name: 'Execute',
  describe: (rank) =>
    `A blow for ${executeRatio(rank)}% damage. It kills a marked non-boss enemy below ${EXECUTE_BELOW * 100}% health.`,
  cost: 12,
  cooldown: 8,
  windup: 0.45,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  // Only against a marked enemy, the one it is meant to finish.
  wants: (u, target) => inReach(u, target) && isMarked(target),
  elite: (_u, target) => target !== null && isElite(target),
  release(u, target) {
    if (!target?.alive || u.distanceTo(target) > u.kit.reach + 0.5) {
      return;
    }
    const marked = isMarked(target);
    const hit = strike(u, target, {
      ratio: executeRatio(rankOf(u, 'execute')),
      flags: DamageFlags.Skill,
    });
    if (
      hit &&
      target.hp > 0 &&
      marked &&
      executable(target) &&
      target.hp < target.derived.maxHp * EXECUTE_BELOW
    ) {
      u.hit(target, {
        kind: DamageKind.True,
        fixed: target.hp,
        flags: DamageFlags.Skill | DamageFlags.Pierce,
      });
    }
  },
};

// ---------- Tripwire ----------

const tripSlow = (rank: number): number => 30 + rank * 2;
const TRIP_TIME = 4;

// One slow status per rank, as a status def has a fixed slow.
const TRIPPED: StatusDef[] = [];
for (let rank = 1; rank <= 10; rank++) {
  TRIPPED.push({
    id: 'tripped',
    name: 'Tripped',
    duration: TRIP_TIME,
    immunity: 0,
    slow: 1 - tripSlow(rank) / 100,
    // Springing the wire marks the enemy too.
    setup: (status) => ({
      start: () => {
        status.unit.addStatus(MARKED, status.source);
      },
      stop: () => {
        // The mark runs out on its own
      },
    }),
  });
}
export const trippedFor = (rank: number): StatusDef =>
  TRIPPED[Math.min(10, Math.max(1, Math.round(rank))) - 1];

// An aware enemy coming, and nothing yet near the Warden or the bearer.
function approaching(u: Unit): Unit | null {
  const bearer = u.sim.bearer;
  if (!bearer) {
    return null;
  }
  const foes = u.sim.living(Side.Monster).filter((e) => e.aware);
  if (foes.some((e) => e.distanceTo(u) < 3 || e.distanceTo(bearer) < 3)) {
    return null;
  }
  return (
    foes
      .filter((e) => e.distanceTo(bearer) <= 12)
      .sort((a, b) => a.distanceTo(bearer) - b.distanceTo(bearer))
      .at(0) ?? null
  );
}

/**
 * Warden, spell 3. An alarm trap in the path of what comes. The enemy that
 * springs it is marked and slowed.
 */
export const TRIPWIRE: Skill = {
  id: 'tripwire',
  name: 'Tripwire',
  describe: (rank) =>
    `An alarm trap. The enemy that triggers it is marked and slowed by ${tripSlow(rank)}% for ${TRIP_TIME} seconds.`,
  cost: 10,
  cooldown: 12,
  windup: 0.4,
  recovery: 0.3,
  targeting: Targeting.Self,
  // Set between fights, one at a time.
  wants: (u, _target, sim) =>
    approaching(u) !== null && !sim.traps.some((t) => t.owner === u && t.skill === 'tripwire'),
  elite: (u) => {
    const e = approaching(u);
    return e !== null && isElite(e);
  },
  release(u, _target, sim) {
    const e = approaching(u);
    const bearer = sim.bearer;
    if (!e || !bearer) {
      return;
    }
    // Two tiles from the bearer, toward the enemy.
    const dx = e.x - bearer.x;
    const dz = e.z - bearer.z;
    const d = Math.hypot(dx, dz) || 1;
    sim.traps.push({
      owner: u,
      x: bearer.x + (dx / d) * 2,
      z: bearer.z + (dz / d) * 2,
      radius: 0.8,
      life: 30,
      status: trippedFor(rankOf(u, 'tripwire')),
      duration: TRIP_TIME,
      sprung: false,
      skill: 'tripwire',
    });
  },
};

// ---------- Pursue ----------

const pursueRatio = (rank: number): number => 100 + rank * 8;
const pursueStun = (rank: number): number => 20 + rank * 2;

// The marked enemy to leap to: the current target if marked, else the nearest.
function quarry(u: Unit, target: Unit | null): Unit | null {
  if (target?.alive && isMarked(target)) {
    return target;
  }
  return (
    u.sim
      .living(Side.Monster)
      .filter((e) => isMarked(e) && u.distanceTo(e) <= PURSUE_REACH)
      .sort((a, b) => u.distanceTo(a) - u.distanceTo(b))
      .at(0) ?? null
  );
}

/**
 * Warden, spell 4, the filler. Leaps to a marked enemy and strikes it,
 * building stun.
 */
export const PURSUE: Skill = {
  id: 'pursue',
  name: 'Pursue',
  describe: (rank) =>
    `Leaps to a marked enemy for ${pursueRatio(rank)}% damage and ${pursueStun(rank)} stun buildup.`,
  cost: 6,
  cooldown: 4,
  windup: 0.25,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  wants: (u, target) => {
    const q = quarry(u, target);
    return q !== null && u.distanceTo(q) <= PURSUE_REACH;
  },
  elite: (_u, target) => target !== null && isElite(target),
  release(u, target) {
    const q = quarry(u, target);
    if (!q || u.distanceTo(q) > PURSUE_REACH) {
      return;
    }
    // Lands one body from the enemy, on the Warden's side of it.
    const dx = u.x - q.x;
    const dz = u.z - q.z;
    const d = Math.hypot(dx, dz) || 1;
    stepTo(u, q.x + (dx / d) * 0.9, q.z + (dz / d) * 0.9, q);
    const rank = rankOf(u, 'pursue');
    u.target = q;
    strike(u, q, {
      ratio: pursueRatio(rank),
      flags: DamageFlags.Skill,
      buildup: [{ status: STUN, amount: pursueStun(rank) }],
    });
  },
};
