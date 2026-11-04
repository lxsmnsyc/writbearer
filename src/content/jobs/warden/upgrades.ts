import type { Lifecycle } from '../../../core/lifecycle';
import { EventPriority } from '../../../core/event-emitter';
import type { Upgrade } from '../../../sim/builds';
import { reveal } from '../../../sim/concealment';
import { SimEvents } from '../../../sim/events';
import { strike } from '../../../sim/sim';
import type Sim from '../../../sim/sim';
import type { Passive, Skill } from '../../../sim/skill';
import type { StatusDef } from '../../../sim/status';
import { STUN } from '../../../sim/statuses';
import { canTarget } from '../../../sim/targeting';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Element,
  Side,
  ValuePriority,
} from '../../../sim/types';
import type Unit from '../../../sim/unit';
import { type Zone, setZone, within } from '../../../sim/zone';
import listen from '../../passives';
import { isElite, rankOf } from '../../skills';
import {
  COVER,
  COVERING,
  EXECUTE,
  INTERPOSE_SHARE,
  MARKED,
  PURSUE,
  TRIPWIRE,
  isMarked,
  trippedFor,
} from './spells';

// The Warden's 12 elite upgrades, from docs/design/16-builds.md. Numbers
// are first guesses. Patches that add to a spell call the base spell's
// `release`, so the spell itself keeps working as the warden node built it.

// Starts and stops several lifecycles as one.
function together(...lives: Lifecycle[]): Lifecycle {
  return {
    start: () => {
      for (const life of lives) {
        life.start();
      }
    },
    stop: () => {
      for (const life of lives) {
        life.stop();
      }
    },
  };
}

// Read through a call, so a check after a strike is not narrowed away
const isAlive = (u: Unit | null): boolean => u?.alive === true;

const isCovering = (u: Unit): boolean => u.statuses.has(COVERING.id);

// Moves a unit to a spot if it can stand there. Returns whether it moved.
function stepTo(u: Unit, x: number, z: number): boolean {
  if (u.sim.nav && !u.sim.nav.walkable(x, z)) {
    return false;
  }
  u.x = x;
  u.z = z;
  return true;
}

// Moves `u` to one body from `to`, on the side `u` comes from.
function landBy(u: Unit, to: Unit): boolean {
  const dx = u.x - to.x;
  const dz = u.z - to.z;
  const d = Math.hypot(dx, dz) || 1;
  const moved = stepTo(u, to.x + (dx / d) * 0.9, to.z + (dz / d) * 0.9);
  u.face(to);
  return moved;
}

// The nearest living foe of `u` it may target, other than `not`, or null.
function nearestFoe(u: Unit, not: Unit | null, reach = Infinity): Unit | null {
  let best: Unit | null = null;
  for (const e of u.sim.foes(u.side)) {
    if (
      e !== not &&
      u.distanceTo(e) <= reach &&
      canTarget(u, e) &&
      (!best || u.distanceTo(e) < u.distanceTo(best))
    ) {
      best = e;
    }
  }
  return best;
}

// ---------- Cover ----------

const SHIELD_SHARE = 0.4;
// The Ward Living Shield builds stops at this share of max health
const SHIELD_WARD_CAP = 0.5;

/**
 * During Cover, the Warden takes 40% of a hit Interpose shares instead of
 * INTERPOSE_SHARE; the bearer is still spared that share. What it takes becomes Ward.
 */
const LIVING_SHIELD: Passive = {
  id: 'livingShield',
  setup: (unit) => {
    const shielded = (target: Unit, flags: number): boolean =>
      target === unit && (flags & DamageFlags.Redirected) !== 0 && isCovering(unit);
    const lessen = listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Pre, (event) => {
      if (shielded(event.target, event.flags)) {
        event.value *= SHIELD_SHARE / INTERPOSE_SHARE;
      }
    });
    const ward = listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (shielded(event.target, event.flags) && unit.alive && event.value > 0) {
        const cap = Math.floor(unit.derived.maxHp * SHIELD_WARD_CAP);
        unit.ward = Math.min(cap, unit.ward + event.value);
      }
    });
    return together(lessen, ward);
  },
};

const TETHER_REACH = 3;
const TETHER_SPEED = 1.3;

/** Tied to the bearer: moves 30% faster. */
export const TETHERED: StatusDef = {
  id: 'tethered',
  name: 'Tethered',
  duration: 3,
  immunity: 0,
  slow: TETHER_SPEED,
};

/** Cover begins with a dash to the bearer's side, and the Warden then keeps close. */
const tether: Partial<Skill> = {
  release(u, target, sim) {
    const bearer = sim.bearer;
    if (bearer?.alive) {
      // To the bearer's side, toward where the Warden stood
      landBy(u, bearer);
    }
    COVER.release(u, target, sim);
    const covering = u.statuses.get(COVERING.id);
    if (covering) {
      u.addStatus(TETHERED, u, covering.remaining);
    }
  },
};

/** During Cover, the Warden picks no enemy more than 3 tiles from the bearer. */
const TETHER: Passive = {
  id: 'tether',
  setup: (unit) =>
    listen(unit.sim, SimEvents.CheckChase, ValuePriority.Post, (event) => {
      if (event.source === unit && isCovering(unit)) {
        event.value = Math.min(event.value, TETHER_REACH);
      }
    }),
};

// Read the reach at the time of the hit: a free attack needs the foe close.
const RETALIATE_SLACK = 0.5;

/**
 * During Cover, a foe in reach that damages the bearer takes a free attack
 * from the Warden, outside its attack timer.
 */
const RETALIATE: Passive = {
  id: 'retaliate',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      const foe = event.source;
      if (
        event.target !== unit.sim.bearer ||
        event.value <= 0 ||
        event.flags & DamageFlags.DoT ||
        !unit.alive ||
        unit.disabled ||
        !isCovering(unit) ||
        !foe.alive ||
        !canTarget(unit, foe) ||
        unit.distanceTo(foe) > unit.kit.reach + RETALIATE_SLACK
      ) {
        return;
      }
      unit.face(foe);
      strike(unit, foe, { flags: DamageFlags.BasicAttack });
    }),
};

// ---------- Execute ----------

// Runs Execute and reports whether it killed its target.
function executed(u: Unit, target: Unit | null, sim: Sim): boolean {
  const was = isAlive(target);
  EXECUTE.release(u, target, sim);
  return was && !isAlive(target);
}

const BLOOD_DEBT = 0.1;

/** A kill with Execute heals the bearer for 10% of the enemy's max health. */
const bloodDebt: Partial<Skill> = {
  release(u, target, sim) {
    // Read before the blow: death clears statuses and recomputes stats.
    const amount = Math.floor((target?.derived.maxHp ?? 0) * BLOOD_DEBT);
    if (!executed(u, target, sim)) {
      return;
    }
    const bearer = sim.bearer;
    if (bearer?.alive && amount > 0) {
      u.heal(bearer, amount);
    }
  },
};

const HANGMAN_LEAP = 3;

/** Execute reaches a marked enemy up to 3 tiles out: the Warden leaps to it first. */
const hangmansReach: Partial<Skill> = {
  wants: (u, target) =>
    target !== null &&
    isMarked(target) &&
    canTarget(u, target) &&
    u.distanceTo(target) <= u.kit.reach + HANGMAN_LEAP,
  release(u, target, sim) {
    if (!target?.alive || u.distanceTo(target) > u.kit.reach + HANGMAN_LEAP + 0.5) {
      return;
    }
    if (u.distanceTo(target) > u.kit.reach) {
      landBy(u, target);
    }
    EXECUTE.release(u, target, sim);
  },
};

/** A kill with Execute makes Pursue ready and marks the nearest enemy. */
const lastRites: Partial<Skill> = {
  release(u, target, sim) {
    if (!executed(u, target, sim)) {
      return;
    }
    u.skillCooldowns.set(PURSUE.id, 0);
    const next = nearestFoe(u, target);
    if (next) {
      next.addStatus(MARKED, u);
    }
  },
};

// ---------- Tripwire ----------

const SENTRY_REACH = 6;

/** While a Tripwire of the Warden's stands, hidden enemies within 6 tiles of it are revealed. */
const SENTRY: Passive = {
  id: 'sentry',
  setup: (unit) =>
    listen(unit.sim, SimEvents.Tick, EventPriority.Post, () => {
      const { sim } = unit;
      if (!unit.alive) {
        return;
      }
      for (const trap of sim.traps) {
        if (trap.owner !== unit || trap.skill !== TRIPWIRE.id || trap.sprung) {
          continue;
        }
        for (const e of sim.foes(unit.side)) {
          if (e.hidden && Math.hypot(e.x - trap.x, e.z - trap.z) <= SENTRY_REACH) {
            reveal(e, unit);
          }
        }
      }
    }),
};

const FIELD_KIND = 'trapField';
const FIELD_RADIUS = 2.5;
const FIELD_LIFE = 30;
const TRIP_TIME = 4;

const ownField = (u: Unit, z: Zone): boolean => z.owner === u && z.kind === FIELD_KIND;

/** Tripwire lays a 2.5-tile field instead of a wire, where the wire would go. */
const trapField: Partial<Skill> = {
  wants: (u, target, sim) => {
    for (const z of sim.zones) {
      if (ownField(u, z)) {
        return false;
      }
    }
    return TRIPWIRE.wants(u, target, sim);
  },
  release(u, target, sim) {
    TRIPWIRE.release(u, target, sim);
    // The wire the base spell just set becomes the field's middle.
    for (let i = sim.traps.length - 1; i >= 0; i--) {
      const trap = sim.traps[i];
      if (trap.owner === u && trap.skill === TRIPWIRE.id) {
        sim.traps.splice(i, 1);
        setZone(sim, {
          kind: FIELD_KIND,
          owner: u,
          x: trap.x,
          z: trap.z,
          r: FIELD_RADIUS,
          life: FIELD_LIFE,
          element: Element.Neutral,
        });
        return;
      }
    }
  },
};

/** Every enemy that walks into one of the Warden's fields is marked and slowed. */
const TRAP_FIELD: Passive = {
  id: 'trapField',
  setup: (unit) => {
    // Who stood in each field on the last tick
    const inside = new WeakMap<Zone, Set<Unit>>();
    return listen(unit.sim, SimEvents.Tick, EventPriority.Post, () => {
      const { sim } = unit;
      for (const zone of sim.zones) {
        if (!ownField(unit, zone)) {
          continue;
        }
        const before = inside.get(zone) ?? new Set<Unit>();
        const now = new Set<Unit>();
        for (const e of sim.foes(unit.side)) {
          if (!within(zone, e)) {
            continue;
          }
          now.add(e);
          if (!before.has(e)) {
            e.aware = true;
            e.addStatus(trippedFor(rankOf(unit, TRIPWIRE.id)), unit, TRIP_TIME);
          }
        }
        inside.set(zone, now);
      }
    });
  },
};

const AMBUSH_STUN = 1;
const AMBUSH_TRAP_LIFE = 60;

// The Wardens of each Sim that hold Never Surprised
const WATCHFUL = new WeakMap<Sim, Set<Unit>>();

/** Keeps the Warden on the watch list the ambush hooks below read. */
const NEVER_SURPRISED: Passive = {
  id: 'neverSurprised',
  setup: (unit) => ({
    start: () => {
      const set = WATCHFUL.get(unit.sim) ?? new Set<Unit>();
      set.add(unit);
      WATCHFUL.set(unit.sim, set);
    },
    stop: () => {
      WATCHFUL.get(unit.sim)?.delete(unit);
    },
  }),
};

// The living Wardens of a Sim with Never Surprised
function watchers(sim: Sim): Unit[] {
  const out: Unit[] = [];
  for (const u of WATCHFUL.get(sim) ?? []) {
    if (u.alive && u.sim === sim) {
      out.push(u);
    }
  }
  return out;
}

/** Whether the party sees Ambushes for what they are on the map. The map calls it. */
export const seesAmbushes = (sim: Sim): boolean => watchers(sim).length > 0;

/**
 * An Ambush springs: each watchful Warden has a Tripwire already set at the
 * area's entrance. The Ambush objective calls it.
 */
export function springAmbush(sim: Sim, entrance: { x: number; z: number }): void {
  for (const w of watchers(sim)) {
    sim.traps.push({
      owner: w,
      x: entrance.x,
      z: entrance.z,
      radius: 0.8,
      life: AMBUSH_TRAP_LIFE,
      status: trippedFor(rankOf(w, TRIPWIRE.id)),
      duration: TRIP_TIME,
      sprung: false,
      skill: TRIPWIRE.id,
    });
  }
}

/** An Ambush's monsters arrive stunned for 1 second when a Warden watches. */
export function ambushersArrive(sim: Sim, units: readonly Unit[]): void {
  const w = watchers(sim).at(0);
  if (!w) {
    return;
  }
  for (const u of units) {
    u.addStatus(STUN, w, AMBUSH_STUN);
  }
}

// ---------- Pursue ----------

const MARKED_BONUS = 1.1;

// The first living merc with Marked for Death, so two do not stack.
function firstHunter(sim: Sim, side: Side): Unit | null {
  for (const u of sim.living(side)) {
    if (u.upgrades.get(PURSUE.id) === 'markedForDeath') {
      return u;
    }
  }
  return null;
}

/** Every merc deals 10% more damage to marked enemies. */
const MARKED_FOR_DEATH: Passive = {
  id: 'markedForDeath',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Amplify, (event) => {
      if (
        event.source.side !== unit.side ||
        event.kind === DamageKind.True ||
        !isMarked(event.target) ||
        firstHunter(unit.sim, unit.side) !== unit
      ) {
        return;
      }
      event.value *= MARKED_BONUS;
    }),
};

const DEBT_CRIT = 25;

/** +25 crit rate on the Warden's hits on marked enemies. */
const DEBT_COLLECTOR: Passive = {
  id: 'debtCollector',
  setup: (unit) =>
    listen(unit.sim, SimEvents.CheckHit, ValuePriority.Additive, (event) => {
      if (event.source === unit && isMarked(event.target)) {
        event.critRate += DEBT_CRIT;
      }
    }),
};

const SEEK_REACH = 6;

// The nearest hidden or disguised enemy Pursue could leap to
function unseen(u: Unit): Unit | null {
  let best: Unit | null = null;
  for (const e of u.sim.living()) {
    // A disguised enemy passes for a ward, so its side does not tell.
    const enemy =
      (e.hidden && e.side === Side.Monster) || (e.disguise !== null && e.side !== u.side);
    if (enemy && u.distanceTo(e) <= SEEK_REACH && (!best || u.distanceTo(e) < u.distanceTo(best))) {
      best = e;
    }
  }
  return best;
}

/**
 * With no marked enemy to go for, Pursue leaps to a hidden or disguised
 * enemy, reveals and marks it, and strikes.
 */
const readTheRoom: Partial<Skill> = {
  wants: (u, target, sim) => PURSUE.wants(u, target, sim) || unseen(u) !== null,
  elite: (u, target, sim) => {
    if (PURSUE.wants(u, target, sim)) {
      return PURSUE.elite(u, target, sim);
    }
    const e = unseen(u);
    return e !== null && isElite(e);
  },
  release(u, target, sim) {
    if (PURSUE.wants(u, target, sim)) {
      PURSUE.release(u, target, sim);
      return;
    }
    const e = unseen(u);
    if (!e) {
      return;
    }
    reveal(e, u);
    e.addStatus(MARKED, u);
    PURSUE.release(u, e, sim);
  },
};

/** At the start of each area, every disguised enemy is revealed. */
const READ_THE_ROOM: Passive = {
  id: 'readTheRoom',
  setup: (unit) => {
    let read = -1;
    return listen(unit.sim, SimEvents.Tick, EventPriority.Post, () => {
      const { sim } = unit;
      if (!unit.alive || read === sim.area) {
        return;
      }
      read = sim.area;
      for (const e of sim.living()) {
        if (e.disguise !== null && e.side !== unit.side) {
          reveal(e, unit);
        }
      }
    });
  },
};

const pct = (share: number): number => Math.round(share * 100);

const WARDEN_UPGRADES: Upgrade[] = [
  {
    id: 'livingShield',
    spell: 'cover',
    name: 'Living Shield',
    describe: () =>
      `During Cover, Interpose costs the Warden ${pct(SHIELD_SHARE)}% of the hit instead of ${pct(INTERPOSE_SHARE)}%, and what it takes becomes a Ward on the Warden.`,
    effect: LIVING_SHIELD,
  },
  {
    id: 'tether',
    spell: 'cover',
    name: 'Tether',
    describe: () =>
      `The Warden dashes to the bearer's side on cast. For the rest of Cover it moves ${pct(TETHER_SPEED - 1)}% faster and goes for no enemy more than ${TETHER_REACH} tiles from the bearer.`,
    patch: tether,
    effect: TETHER,
  },
  {
    id: 'retaliate',
    spell: 'cover',
    name: 'Retaliate',
    describe: () =>
      'During Cover, an enemy in reach that damages the bearer takes a free attack from the Warden.',
    effect: RETALIATE,
  },
  {
    id: 'bloodDebt',
    spell: 'execute',
    name: 'Blood Debt',
    describe: () =>
      `A kill with it heals the bearer for ${pct(BLOOD_DEBT)}% of the enemy's max health.`,
    patch: bloodDebt,
  },
  {
    id: 'hangmansReach',
    spell: 'execute',
    name: "Hangman's Reach",
    describe: () => `The Warden first leaps up to ${HANGMAN_LEAP} tiles to the target.`,
    patch: hangmansReach,
  },
  {
    id: 'lastRites',
    spell: 'execute',
    name: 'Last Rites',
    describe: () => 'A kill with it makes Pursue ready again and marks the nearest enemy.',
    patch: lastRites,
  },
  {
    id: 'sentry',
    spell: 'tripwire',
    name: 'Sentry',
    describe: () =>
      `While the trap stands, it reveals hidden enemies within ${SENTRY_REACH} tiles of it.`,
    effect: SENTRY,
  },
  {
    id: 'trapField',
    spell: 'tripwire',
    name: 'Trap Field',
    describe: () =>
      `The trap is a ${FIELD_RADIUS}-tile field. Every enemy that enters it is marked and slowed.`,
    patch: trapField,
    effect: TRAP_FIELD,
  },
  {
    id: 'neverSurprised',
    spell: 'tripwire',
    name: 'Never Surprised',
    describe: () =>
      `Ambushes show on the map. In one, a Tripwire is already set at the entrance, and the ambushers arrive stunned for ${AMBUSH_STUN} second.`,
    effect: NEVER_SURPRISED,
  },
  {
    id: 'markedForDeath',
    spell: 'pursue',
    name: 'Marked for Death',
    describe: () => `Every merc deals ${pct(MARKED_BONUS - 1)}% more damage to marked enemies.`,
    effect: MARKED_FOR_DEATH,
  },
  {
    id: 'debtCollector',
    spell: 'pursue',
    name: 'Debt Collector',
    describe: () => `+${DEBT_CRIT}% crit rate against marked enemies.`,
    effect: DEBT_COLLECTOR,
  },
  {
    id: 'readTheRoom',
    spell: 'pursue',
    name: 'Read the Room',
    describe: () =>
      'Can leap to a hidden or disguised enemy and reveals it. It also reveals disguised enemies at the start of each area.',
    patch: readTheRoom,
    effect: READ_THE_ROOM,
  },
];

export default WARDEN_UPGRADES;
