import type { Lifecycle } from '../../../core/lifecycle';
import type { Upgrade } from '../../../sim/builds';
import { SimEvents } from '../../../sim/events';
import type Sim from '../../../sim/sim';
import { ARROW_SPEED } from '../../../sim/sim';
import { type Passive, type Skill, Targeting } from '../../../sim/skill';
import type { StatusDef } from '../../../sim/status';
import { DREAD, PETRIFY, SHIELD_WALL, STUN, SUNDERED } from '../../../sim/statuses';
import { canTarget, hostiles } from '../../../sim/targeting';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  Element,
  Range,
  Side,
  ValuePriority,
} from '../../../sim/types';
import type Unit from '../../../sim/unit';
import { setZone } from '../../../sim/zone';
import listen from '../../passives';
import { inLine, inReach, isElite, rankOf } from '../../skills';
import {
  CHALLENGE,
  CRUSH,
  INTERCEPT,
  SHIELD_WALL_SKILL,
  bash,
  bashStun,
  challengeTime,
  crushEarth,
  crushRatio,
  taunt,
} from '../../vanguard';

// The Vanguard's 12 elite upgrades, from docs/design/16-builds.md. Numbers
// are first guesses. Patches that add to a spell call the base spell's
// `release`, so the spell itself keeps working as src/content/vanguard.ts has it.

// ---------- Intercept ----------

const VOW_ARMOR = 20;
const VOW_TIME = 6;

/** Sworn to the bearer: +20 armor. */
export const VOWED: StatusDef = {
  id: 'vowed',
  name: 'Vowed',
  duration: VOW_TIME,
  immunity: 0,
  buff: true,
  modifiers: () => [{ stat: 'armor', add: VOW_ARMOR }],
};

const BURDEN_SHARE = 0.3;
const BURDEN_TIME = 5;

/** Taking a share of every hit on the bearer. */
export const BURDENED: StatusDef = {
  id: 'burdened',
  name: 'Shared Burden',
  duration: BURDEN_TIME,
  immunity: 0,
  buff: true,
};

// Runs the dash and reports where it began and whether it moved the Vanguard.
function dashed(u: Unit, target: Unit | null, sim: Sim): { x: number; z: number; moved: boolean } {
  const x = u.x;
  const z = u.z;
  INTERCEPT.release(u, target, sim);
  return { x, z, moved: u.x !== x || u.z !== z };
}

/** On arrival, the Vanguard and the bearer gain +20 armor for 6 seconds. */
const vow: Partial<Skill> = {
  release(u, target, sim) {
    if (dashed(u, target, sim).moved) {
      u.addStatus(VOWED, u);
      sim.bearer?.addStatus(VOWED, u);
    }
  },
};

/** For 5 seconds after the dash, the Vanguard takes 30% of every hit on the bearer. */
const sharedBurden: Partial<Skill> = {
  release(u, target, sim) {
    if (dashed(u, target, sim).moved) {
      u.addStatus(BURDENED, u);
    }
  },
};

/** The Vanguard takes 30% of every hit on the bearer while Burdened. */
const SHARED_BURDEN_EFFECT: Passive = {
  id: 'sharedBurden',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Pre, (event) => {
      if (
        event.target !== unit.sim.bearer ||
        !unit.alive ||
        !unit.statuses.has(BURDENED.id) ||
        event.value <= 0 ||
        event.flags & DamageFlags.Redirected
      ) {
        return;
      }
      const taken = Math.floor(event.value * BURDEN_SHARE);
      if (taken > 0) {
        event.value -= taken;
        event.source.hit(unit, {
          kind: DamageKind.True,
          fixed: taken,
          flags: DamageFlags.Redirected,
        });
      }
    }),
};

const CHARGE_STUN = 40;
// How close to the dash an enemy must stand to be run through
const CHARGE_WIDTH = 0.9;
const CHARGE_PUSH = 1.5;
const PUSH_STEP = 0.25;

// Pushes `target` up to `distance` tiles along (dx, dz), stopping at a wall.
function push(target: Unit, dx: number, dz: number, distance: number): void {
  const d = Math.hypot(dx, dz) || 1;
  const { nav } = target.sim;
  for (let moved = PUSH_STEP; moved <= distance + 1e-9; moved += PUSH_STEP) {
    const x = target.x + (dx / d) * PUSH_STEP;
    const z = target.z + (dz / d) * PUSH_STEP;
    if (nav && !nav.walkable(x, z)) {
      return;
    }
    target.x = x;
    target.z = z;
  }
}

/**
 * Each enemy the dash passes through gets 40 stun buildup and is pushed 1.5
 * tiles aside, to the side of the dash it stands on.
 */
const charge: Partial<Skill> = {
  release(u, target, sim) {
    const { x, z } = dashed(u, target, sim);
    const lx = u.x - x;
    const lz = u.z - z;
    const length = Math.hypot(lx, lz);
    if (length === 0) {
      return;
    }
    for (const e of hostiles(u)) {
      const along = ((e.x - x) * lx + (e.z - z) * lz) / length;
      const across = ((e.x - x) * lz - (e.z - z) * lx) / length;
      if (along < 0 || along > length || Math.abs(across) > CHARGE_WIDTH) {
        continue;
      }
      e.buildUp(STUN, u, CHARGE_STUN);
      // Aside is the perpendicular, on the side the enemy is on
      const side = across < 0 ? -1 : 1;
      push(e, (lz / length) * side, (-lx / length) * side, CHARGE_PUSH);
    }
  },
};

// ---------- Challenge ----------

const LAST_LINE_AT = 0.3;
const LAST_LINE_RADIUS = 5;

// The area each Vanguard last fired Last Line in. Kept outside the passive:
// raising Challenge sets the passive up again. Party units carry over between areas.
const FIRED = new WeakMap<Unit, number>();

/**
 * Once an area, when the bearer drops below 30% health, taunts every enemy
 * within 5 tiles of the bearer, as Challenge would.
 */
const LAST_LINE: Passive = {
  id: 'lastLine',
  setup: (unit, rank): Lifecycle =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      const { sim } = unit;
      const bearer = sim.bearer;
      if (
        event.target !== bearer ||
        !bearer.alive ||
        !unit.alive ||
        unit.disabled ||
        FIRED.get(unit) === sim.area ||
        bearer.hp >= bearer.derived.maxHp * LAST_LINE_AT
      ) {
        return;
      }
      FIRED.set(unit, sim.area);
      for (const e of hostiles(unit)) {
        if (e.distanceTo(bearer) <= LAST_LINE_RADIUS) {
          taunt(unit, e, challengeTime(rank));
        }
      }
    }),
};

const BANNER_RADIUS = 4;
const BANNER_TIME = 10;
const BANNER_CALM = 0.5;
const BANNER_MORALE = 1;

/**
 * Challenge also plants a banner for 10 seconds. Allies near it gain morale
 * each second and take half the dread buildup.
 */
const banner: Partial<Skill> = {
  release(u, target, sim) {
    CHALLENGE.release(u, target, sim);
    // One banner of its own at a time
    for (let i = sim.zones.length - 1; i >= 0; i--) {
      if (sim.zones[i].owner === u && sim.zones[i].kind === 'banner') {
        sim.zones.splice(i, 1);
      }
    }
    setZone(sim, {
      kind: 'banner',
      owner: u,
      x: u.x,
      z: u.z,
      r: BANNER_RADIUS,
      life: BANNER_TIME,
      element: Element.Neutral,
      calm: BANNER_CALM,
      pulse: (ally) => {
        if (ally.side === u.side && ally !== sim.bearer) {
          ally.morale = Math.min(100, ally.morale + BANNER_MORALE);
        }
      },
    });
  },
};

/**
 * Challenge becomes a shove on one enemy: 100% damage, stun buildup,
 * interrupts casts. It taunts only that enemy.
 */
const shieldBash: Partial<Skill> = {
  describe: (rank) =>
    `A shove on one enemy for 100% damage. Adds ${bashStun(rank)} stun buildup and interrupts skills. Taunts it for ${challengeTime(rank)} seconds.`,
  targeting: Targeting.Enemy,
  wants(u, target, sim) {
    // Worth it to break a skill, to stop something after the bearer, or to
    // finish a stun already building.
    return (
      inReach(u, target) &&
      canTarget(u, target) &&
      (target.cast !== null ||
        target.target === sim.bearer ||
        (target.buildup.get(STUN.id) ?? 0) > 0)
    );
  },
  elite: (_u, target) => target !== null && isElite(target),
  release(u, target) {
    // A target that stepped away during the windup, or that is not the Vanguard's to pick, is missed.
    if (!target?.alive || !canTarget(u, target) || u.distanceTo(target) > u.kit.reach + 0.5) {
      return;
    }
    const rank = rankOf(u, 'challenge');
    bash(u, target, rank);
    taunt(u, target, challengeTime(rank));
  },
};

// ---------- Shield Wall ----------

const IMMOVABLE_EXTRA = 1;

/** Shield Wall lasts 1 second longer. */
const immovable: Partial<Skill> = {
  release(u, target, sim) {
    SHIELD_WALL_SKILL.release(u, target, sim);
    const wall = u.statuses.get(SHIELD_WALL.id);
    if (wall) {
      wall.remaining += IMMOVABLE_EXTRA;
    }
  },
};

/** No stun, Petrify or Dread while Shield Wall stands. */
const IMMOVABLE: Passive = {
  id: 'immovable',
  setup: (unit) =>
    listen(unit.sim, SimEvents.CheckStatusDuration, ValuePriority.Post, (event) => {
      if (
        event.target === unit &&
        (event.status === STUN || event.status === DREAD || event.status === PETRIFY) &&
        unit.statuses.has(SHIELD_WALL.id)
      ) {
        event.disabled = true;
      }
    }),
};

const rampartTime = (rank: number): number => 4 + rank * 0.5;

// The nearest awake archer or caster shooting at the party
function shooter(u: Unit): Unit | null {
  let best: Unit | null = null;
  for (const e of u.sim.living(Side.Monster)) {
    if (
      e.aware &&
      e.job.range === Range.Ranged &&
      e.target?.side === Side.Party &&
      u.distanceTo(e) <= 10 &&
      u.sim.sees(u, e) &&
      (!best || u.distanceTo(e) < u.distanceTo(best))
    ) {
      best = e;
    }
  }
  return best;
}

/**
 * Shield Wall plants a wall toward the nearest archer instead. The Vanguard
 * can move. Projectiles that fly into the wall stop.
 */
const rampart: Partial<Skill> = {
  describe: (rank) =>
    `Plants a wall toward the nearest archer for ${rampartTime(rank)} seconds. The Vanguard can move. Arrows and bolts that fly into it stop.`,
  wants: (u, _target, sim) =>
    shooter(u) !== null && !sim.zones.some((z) => z.owner === u && z.kind === 'rampart'),
  elite: (u) => {
    const s = shooter(u);
    return s !== null && isElite(s);
  },
  release(u, _target, sim) {
    const s = shooter(u);
    if (!s) {
      return;
    }
    const d = u.distanceTo(s) || 1;
    const step = Math.min(1.6, d / 2);
    setZone(sim, {
      kind: 'rampart',
      owner: u,
      x: u.x + ((s.x - u.x) / d) * step,
      z: u.z + ((s.z - u.z) / d) * step,
      r: 1.3,
      life: rampartTime(rankOf(u, 'shieldWall')),
      element: Element.Earth,
      blocks: true,
    });
  },
};

const BASTION_REACH = 2;

// Whether `guard` stands between `from` and `ally`, close enough to cover it.
function covers(guard: Unit, from: Unit, ally: Unit): boolean {
  const dx = ally.x - from.x;
  const dz = ally.z - from.z;
  const l2 = dx * dx + dz * dz;
  if (l2 === 0 || guard.distanceTo(ally) > BASTION_REACH) {
    return false;
  }
  const t = ((guard.x - from.x) * dx + (guard.z - from.z) * dz) / l2;
  if (t <= 0 || t >= 1) {
    return false;
  }
  return Math.hypot(from.x + dx * t - guard.x, from.z + dz * t - guard.z) <= 1;
}

/**
 * While Shield Wall stands, allies within 2 tiles behind it get the same
 * cover from the front: physical blows stopped, magic halved.
 */
const BASTION: Passive = {
  id: 'bastion',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Block, (event) => {
      const { target } = event;
      if (
        !unit.alive ||
        !unit.statuses.has(SHIELD_WALL.id) ||
        target === unit ||
        target.side !== unit.side ||
        event.source.side === unit.side ||
        event.kind === DamageKind.True ||
        !covers(unit, event.source, target)
      ) {
        return;
      }
      if (event.kind === DamageKind.Physical) {
        event.value = 0;
        event.flags |= DamageFlags.Blocked;
      } else {
        event.value *= 0.5;
      }
    }),
};

// ---------- Crush ----------

const FAULT_LENGTH = 5;
const FAULT_SHARE = 0.8;

// The enemies in the shockwave's line that the Vanguard may pick.
function inFault(u: Unit, target: Unit): Unit[] {
  const out: Unit[] = [];
  for (const e of inLine(u, target)) {
    if (u.distanceTo(e) <= FAULT_LENGTH && canTarget(u, e)) {
      out.push(e);
    }
  }
  return out;
}

/**
 * Crush becomes a 5-tile shockwave in a line. Every enemy in it takes 80% of
 * Crush's damage and buildup.
 */
const faultLine: Partial<Skill> = {
  describe: (rank) =>
    `A shockwave ${FAULT_LENGTH} tiles long. Every enemy in it takes ${Math.round(crushRatio(rank) * FAULT_SHARE)}% damage and ${Math.round(crushEarth(rank) * FAULT_SHARE)} Earth buildup.`,
  wants: (u, target) =>
    target !== null &&
    canTarget(u, target) &&
    u.distanceTo(target) <= FAULT_LENGTH - 0.5 &&
    (inFault(u, target).length >= 2 || isElite(target)),
  elite: (u, target) => target !== null && inFault(u, target).some(isElite),
  release(u, target, sim) {
    if (!target) {
      return;
    }
    const rank = rankOf(u, 'crush');
    // The projectile skips enemies the Vanguard may not pick, such as one dueled by another.
    sim.fire(u, target, {
      speed: ARROW_SPEED * 0.8,
      distance: FAULT_LENGTH,
      radius: 0.6,
      pierce: true,
      skill: 'faultLine',
      options: {
        range: Range.Melee,
        ratio: crushRatio(rank) * FAULT_SHARE,
        flags: DamageFlags.Skill | DamageFlags.AoE,
        buildup: [{ status: PETRIFY, amount: Math.round(crushEarth(rank) * FAULT_SHARE) }],
      },
    });
  },
};

const QUAKE_SPREAD = 3;
const QUAKE_EARTH = 40;

/** When Crush's target is Petrified, every enemy within 3 tiles of it gets 40 Earth buildup. */
const earthshaker: Partial<Skill> = {
  release(u, target, sim) {
    CRUSH.release(u, target, sim);
    if (!target || !target.statuses.has(PETRIFY.id)) {
      return;
    }
    for (const e of hostiles(u)) {
      if (e !== target && e.distanceTo(target) <= QUAKE_SPREAD) {
        e.buildUp(PETRIFY, u, QUAKE_EARTH);
      }
    }
  },
};

const SUNDER_STACKS = 5;

/** Crush puts all 5 Sunder stacks on the target at once. */
const sunderingBlow: Partial<Skill> = {
  release(u, target, sim) {
    const before = target?.statuses.get(SUNDERED.id)?.stacks ?? 0;
    CRUSH.release(u, target, sim);
    const sundered = target?.statuses.get(SUNDERED.id);
    // Only a blow that landed (and so added a stack) fills the rest.
    if (!target || !sundered || sundered.stacks <= before) {
      return;
    }
    for (let i = sundered.stacks; i < SUNDER_STACKS; i++) {
      target.addStatus(SUNDERED, u, undefined, sundered.power);
    }
  },
};

const VANGUARD_UPGRADES: Upgrade[] = [
  {
    id: 'vow',
    spell: 'intercept',
    name: 'Vow',
    describe: () =>
      `On arrival, the Vanguard and the bearer gain +${VOW_ARMOR} armor for ${VOW_TIME} seconds.`,
    patch: vow,
  },
  {
    id: 'sharedBurden',
    spell: 'intercept',
    name: 'Shared Burden',
    describe: () =>
      `For ${BURDEN_TIME} seconds after the dash, the Vanguard takes ${BURDEN_SHARE * 100}% of every hit on the bearer.`,
    patch: sharedBurden,
    effect: SHARED_BURDEN_EFFECT,
  },
  {
    id: 'charge',
    spell: 'intercept',
    name: 'Charge',
    describe: () =>
      `Each enemy the dash passes through gets ${CHARGE_STUN} stun buildup and is pushed aside.`,
    patch: charge,
  },
  {
    id: 'lastLine',
    spell: 'challenge',
    name: 'Last Line',
    describe: (rank) =>
      `Also fires by itself, once an area, when the bearer drops below ${LAST_LINE_AT * 100}% health. It taunts within ${LAST_LINE_RADIUS} tiles of the bearer for ${challengeTime(rank)} seconds.`,
    effect: LAST_LINE,
  },
  {
    id: 'banner',
    spell: 'challenge',
    name: 'Banner',
    describe: () =>
      `Also plants a banner for ${BANNER_TIME} seconds. Allies within ${BANNER_RADIUS} tiles gain morale and take half the dread buildup.`,
    patch: banner,
  },
  {
    id: 'shieldBash',
    spell: 'challenge',
    name: 'Shield Bash',
    describe: (rank) =>
      `Becomes a shove on one enemy: 100% damage, ${bashStun(rank)} stun buildup, interrupts casts. It taunts only that enemy.`,
    patch: shieldBash,
  },
  {
    id: 'immovable',
    spell: 'shieldWall',
    name: 'Immovable',
    describe: () => `No stun, Petrify or Dread during it. Lasts ${IMMOVABLE_EXTRA} second longer.`,
    patch: immovable,
    effect: IMMOVABLE,
  },
  {
    id: 'rampart',
    spell: 'shieldWall',
    name: 'Rampart',
    describe: (rank) =>
      `Plants a wall toward the nearest archer for ${rampartTime(rank)} seconds instead. The Vanguard can move. Projectiles that fly into the wall stop.`,
    patch: rampart,
  },
  {
    id: 'bastion',
    spell: 'shieldWall',
    name: 'Bastion',
    describe: () =>
      `Allies within ${BASTION_REACH} tiles behind it get the same cover from the front.`,
    effect: BASTION,
  },
  {
    id: 'faultLine',
    spell: 'crush',
    name: 'Fault Line',
    describe: () =>
      `Becomes a ${FAULT_LENGTH}-tile shockwave in a line. Every enemy in it takes ${FAULT_SHARE * 100}% of Crush's damage and buildup.`,
    patch: faultLine,
  },
  {
    id: 'earthshaker',
    spell: 'crush',
    name: 'Earthshaker',
    describe: () =>
      `When the target is Petrified, every enemy within ${QUAKE_SPREAD} tiles of it gets ${QUAKE_EARTH} Earth buildup.`,
    patch: earthshaker,
  },
  {
    id: 'sunderingBlow',
    spell: 'crush',
    name: 'Sundering Blow',
    describe: () => `Puts all ${SUNDER_STACKS} Sunder stacks on the target at once.`,
    patch: sunderingBlow,
  },
];

export default VANGUARD_UPGRADES;
