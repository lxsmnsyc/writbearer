import { EventPriority } from '../../../core/event-emitter';
import type { Lifecycle } from '../../../core/lifecycle';
import type { Upgrade } from '../../../sim/builds';
import { SimEvents, type UnitDamageEvent } from '../../../sim/events';
import { EquipSlot, type WeaponKind } from '../../../sim/item';
import type Sim from '../../../sim/sim';
import { strike } from '../../../sim/sim';
import { type Passive, type Skill, areaVictims } from '../../../sim/skill';
import { type StatusDef, buffsOf, stealBuff } from '../../../sim/status';
import { BLIND, ROOTED, TAUNTED } from '../../../sim/statuses';
import { allowed } from '../../../sim/targeting';
import { DamageFlags, DamagePriority, Race, Side, ValuePriority } from '../../../sim/types';
import type Unit from '../../../sim/unit';
import listen from '../../passives';
import { inReach, isElite, rankOf } from '../../skills';
import {
  CLEAVE,
  POCKET_SAND,
  RUSH,
  SAND_RANGE,
  hamstringRatio,
  hamstrungAt,
  sandBlind,
} from './spells';

// The Sellsword's 12 elite upgrades, from docs/design/16-builds.md. Numbers
// are first guesses. Two counts last the run and are kept in `Unit.tally`:
// the phases each Sellsword survived and how long it fought with each kind
// of weapon. The run adds to them (src/game/game/listeners.ts).

// Several listeners started and stopped as one
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

// Whether a status in effect slows the unit
function isSlowed(u: Unit): boolean {
  for (const s of u.statuses.values()) {
    if (s.def.slow !== undefined && s.def.slow < 1) {
      return true;
    }
  }
  return false;
}

// The spell as the unit casts it, with its upgrade, or the base one
function castOf(u: Unit, base: Skill): Skill {
  return u.skills.find((s) => s.id === base.id) ?? base;
}

// ---------- Rush ----------

const SHIELD_RUSH_TIME = 3;

/** After it arrives, the Sellsword taunts the target. */
const shieldRush: Partial<Skill> = {
  release(u, target, sim) {
    RUSH.release(u, target, sim);
    if (target?.alive && u.distanceTo(target) <= u.kit.reach + 0.5) {
      target.addStatus(TAUNTED, u, SHIELD_RUSH_TIME);
    }
  },
};

// Seconds after a Rush in which the target's death starts another
const CHAIN_WINDOW = 2;

/** If the target dies soon after, it rushes the next enemy going for the bearer, free. */
const CHAIN_RUSH: Passive = {
  id: 'chainRush',
  setup: (unit) => {
    const { sim } = unit;
    let marked: Unit | null = null;
    let at = Number.NEGATIVE_INFINITY;
    // Marked before the blow, so a Rush that kills chains too
    const mark = listen(sim, SimEvents.UnitSkillRelease, EventPriority.Pre, (event) => {
      if (event.source === unit && event.skill.id === RUSH.id && event.target) {
        marked = event.target;
        at = sim.time;
      }
    });
    const chain = listen(sim, SimEvents.UnitDies, EventPriority.Post, (event) => {
      if (event.source !== marked || sim.time - at > CHAIN_WINDOW) {
        return;
      }
      marked = null;
      if (!unit.alive || unit.disabled) {
        return;
      }
      const spell = castOf(unit, RUSH);
      const next = spell.aim?.(unit, sim) ?? null;
      if (!next) {
        return;
      }
      marked = next;
      at = sim.time;
      spell.release(unit, next, sim);
    });
    return together(mark, chain);
  },
};

export const KNOCK_DISTANCE = 2;
const KNOCK_STEP = 0.25;

// Pushes `target` up to `distance` tiles straight away from `from`, stopping
// at a wall.
function knock(target: Unit, from: { x: number; z: number }, distance: number): void {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  const { nav } = target.sim;
  for (let moved = KNOCK_STEP; moved <= distance + 1e-9; moved += KNOCK_STEP) {
    const x = target.x + (dx / d) * KNOCK_STEP;
    const z = target.z + (dz / d) * KNOCK_STEP;
    if (nav && !nav.walkable(x, z)) {
      return;
    }
    target.x = x;
    target.z = z;
  }
}

/** The target is pushed 2 tiles away from the bearer. */
const knockAside: Partial<Skill> = {
  release(u, target, sim) {
    RUSH.release(u, target, sim);
    if (target?.alive && u.distanceTo(target) <= u.kit.reach + 0.5) {
      knock(target, sim.bearer ?? u, KNOCK_DISTANCE);
    }
  },
};

// ---------- Pocket Sand ----------

export const BRIBE_COST = 12;
// How far the Sellsword reaches with a bribe, in tiles
const BRIBE_RANGE = 4;
// Seconds a bribed enemy walks off before it is gone
const BRIBE_WALK = 3;
/** The gold a bribe costs, by the enemy's level. */
export const bribeGold = (target: Unit): number => 10 + target.level * 4;

/** Paid off: walks away from the Sellsword, then leaves the field, dropping nothing. */
export const BRIBED: StatusDef = {
  id: 'bribed',
  name: 'Bribed',
  duration: BRIBE_WALK,
  immunity: 0,
  flees: true,
  tick: (s, dt) => {
    // On its last tick it is gone: removed, not killed, so no death listener
    // runs and it drops nothing. It reads as not alive, so objectives that
    // keep their own lists of units (an Ambush's or a Horde's waves) count it
    // as gone.
    const u = s.unit;
    if (s.remaining <= dt && u.alive) {
      u.alive = false;
      u.cast = null;
      u.swing = -1;
      u.target = null;
      u.sim.units.delete(u);
    }
  },
};

// Whether the party can pay off this enemy now
function bribable(sim: Sim, e: Unit): boolean {
  return (
    e.alive &&
    e.side === Side.Monster &&
    e.race === Race.Human &&
    !isElite(e) &&
    !e.statuses.has(BRIBED.id) &&
    sim.purse !== null &&
    sim.purse.gold >= bribeGold(e)
  );
}

/** Becomes a bribe: a non-elite Human enemy takes gold and leaves the fight. */
const bribe: Partial<Skill> = {
  cost: BRIBE_COST,
  aim: (u, sim) => {
    let best: Unit | null = null;
    for (const e of allowed(u, sim.living(Side.Monster))) {
      if (u.distanceTo(e) <= BRIBE_RANGE && bribable(sim, e)) {
        if (!best || u.distanceTo(e) < u.distanceTo(best)) {
          best = e;
        }
      }
    }
    return best;
  },
  wants: (_u, target) => target !== null,
  elite: () => false,
  release(u, target, sim) {
    if (!target || !bribable(sim, target) || u.distanceTo(target) > BRIBE_RANGE + 0.5) {
      return;
    }
    sim.purse!.gold -= bribeGold(target);
    target.target = null;
    target.cast = null;
    target.swing = -1;
    target.addStatus(BRIBED, u);
  },
};

/** No one fights a bribed enemy, and it fights no one. */
const BRIBE_EFFECT: Passive = {
  id: 'bribe',
  setup: (unit) =>
    listen(unit.sim, SimEvents.CheckTarget, ValuePriority.Post, (event) => {
      if (event.source.statuses.has(BRIBED.id) || event.target.statuses.has(BRIBED.id)) {
        event.allowed = false;
      }
    }),
};

export const PLAY_DEAD_TIME = 3;
export const PLAY_DEAD_HEALTH = 20;

/** Lying still after a blow that should have killed. Gets up with 20% health. */
export const PLAYING_DEAD: StatusDef = {
  id: 'playingDead',
  name: 'Playing Dead',
  duration: PLAY_DEAD_TIME,
  immunity: 0,
  disables: true,
  setup: (s) => ({
    start: () => undefined,
    stop: () => {
      const u = s.unit;
      if (u.alive) {
        u.hp = Math.max(u.hp, Math.floor((u.derived.maxHp * PLAY_DEAD_HEALTH) / 100));
      }
    },
  }),
};

// The area each Sellsword last played dead in
const PLAYED = new WeakMap<Unit, number>();

/**
 * The first time the Sellsword would die in an area, it throws sand, lies
 * still and gets up. Monsters may not target it while it lies still.
 */
const PLAY_DEAD: Passive = {
  id: 'playDead',
  setup: (unit) => {
    const { sim } = unit;
    const fall = listen(sim, SimEvents.UnitDies, EventPriority.Pre, (event) => {
      if (event.source !== unit || !unit.alive || PLAYED.get(unit) === sim.area) {
        return;
      }
      PLAYED.set(unit, sim.area);
      event.disabled = true;
      unit.hp = 1;
      unit.lastBlow = null;
      unit.target = null;
      const amount = sandBlind(rankOf(unit, POCKET_SAND.id));
      for (const v of areaVictims(unit, POCKET_SAND, unit, SAND_RANGE)) {
        v.target.aware = true;
        v.target.buildUp(BLIND, unit, amount);
      }
      unit.addStatus(PLAYING_DEAD, unit);
    });
    const hide = listen(sim, SimEvents.CheckTarget, ValuePriority.Post, (event) => {
      if (
        event.target === unit &&
        event.source.side === Side.Monster &&
        unit.statuses.has(PLAYING_DEAD.id)
      ) {
        event.allowed = false;
      }
    });
    return together(fall, hide);
  },
};

export const SALT = 1.15;
// Hits already salted, so two Sellswords with it do not stack
const SALTED = new WeakSet<UnitDamageEvent>();

/** Blinded enemies take 15% more damage from every merc. */
const SALT_THE_WOUND: Passive = {
  id: 'saltTheWound',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Amplify, (event) => {
      if (
        !unit.alive ||
        SALTED.has(event) ||
        event.source.side !== Side.Party ||
        event.target.side === Side.Party ||
        !event.target.statuses.has(BLIND.id)
      ) {
        return;
      }
      SALTED.add(event);
      event.value *= SALT;
    }),
};

// ---------- Hamstring ----------

export const LOW_BLOW_CRIT = 25;

/** More crit rate against blinded or slowed targets. */
const LOW_BLOW: Passive = {
  id: 'lowBlow',
  setup: (unit) =>
    listen(unit.sim, SimEvents.CheckHit, ValuePriority.Additive, (event) => {
      if (
        event.source === unit &&
        (event.target.statuses.has(BLIND.id) || isSlowed(event.target))
      ) {
        event.critRate += LOW_BLOW_CRIT;
      }
    }),
};

export const CUTPURSE_CHANCE = 0.15;

/** Each hit may steal one buff from the target, to keep. */
const CUTPURSE: Passive = {
  id: 'cutpurse',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (
        event.source !== unit ||
        !unit.alive ||
        event.value <= 0 ||
        (event.flags & DamageFlags.DoT) !== 0 ||
        event.target.side === unit.side ||
        buffsOf(event.target).length === 0
      ) {
        return;
      }
      if (unit.sim.rng.chance(CUTPURSE_CHANCE)) {
        stealBuff(unit, event.target);
      }
    }),
};

export const CRIPPLE_TIME = 1.5;

/** On a target already slowed, Hamstring roots it too. It is cast again until it roots. */
const cripple: Partial<Skill> = {
  wants: (u, target) => inReach(u, target) && !target.statuses.has(ROOTED.id),
  release(u, target) {
    if (!target?.alive || u.distanceTo(target) > u.kit.reach + 0.5) {
      return;
    }
    const slowed = isSlowed(target);
    const rank = rankOf(u, 'hamstring');
    const hit = strike(u, target, { ratio: hamstringRatio(rank), flags: DamageFlags.Skill });
    if (hit) {
      target.addStatus(hamstrungAt(rank), u);
      if (slowed) {
        target.addStatus(ROOTED, u, CRIPPLE_TIME);
      }
    }
  },
};

// ---------- Cleave ----------

const HABIT = 'habit.';
const WEAPON_KINDS: readonly WeaponKind[] = ['sword', 'mace', 'bow', 'dagger', 'staff'];
export const HABIT_SPEED = 1.2;

/** The kind of weapon a unit holds, if any. */
export function heldKind(u: Unit): WeaponKind | undefined {
  return u.equipment.get(EquipSlot.Weapon)?.base.weapon;
}

/** The kind of weapon a unit has fought with longest this run, or null. */
export function habitOf(u: Unit): WeaponKind | null {
  let best: WeaponKind | null = null;
  let most = 0;
  for (const kind of WEAPON_KINDS) {
    const seconds = u.tally.get(HABIT + kind) ?? 0;
    if (seconds > most) {
      best = kind;
      most = seconds;
    }
  }
  return best;
}

/**
 * Counts the seconds each living Sellsword fights with the weapon it holds.
 * The run calls it every tick.
 */
export function countWeaponUse(sim: Sim, dt: number): void {
  for (const u of sim.living(Side.Party)) {
    const kind = u.kind === 'sellsword' && u.target?.alive ? heldKind(u) : undefined;
    if (kind) {
      const key = HABIT + kind;
      u.tally.set(key, (u.tally.get(key) ?? 0) + dt);
    }
  }
}

/** Attacks 20% faster with the weapon kind it has used longest this run. */
const WEAPON_HABIT: Passive = {
  id: 'weaponHabit',
  setup: (unit) => {
    let last = unit.cooldown;
    return listen(unit.sim, SimEvents.Tick, EventPriority.Post, () => {
      // A basic attack that began this tick reset the cooldown upward
      if (unit.cooldown > last + 1e-9) {
        const kind = heldKind(unit);
        if (kind !== undefined && kind === habitOf(unit)) {
          unit.cooldown /= HABIT_SPEED;
        }
      }
      last = unit.cooldown;
    });
  },
};

const PHASES = 'phases';
export const VETERAN_MAX = 3;

/** The phases a unit has survived this run. */
export const phasesSurvived = (u: Unit): number => u.tally.get(PHASES) ?? 0;

/** Each living Sellsword survived a phase. The run calls it as a new phase begins. */
export function survivePhase(sim: Sim): void {
  for (const u of sim.living(Side.Party)) {
    if (u.kind === 'sellsword') {
      u.tally.set(PHASES, phasesSurvived(u) + 1);
    }
  }
}

/** Cleave counts as a rank higher for each phase survived, up to +3. */
const VETERAN: Passive = {
  id: 'veteranOfManyWars',
  setup: (unit) =>
    listen(unit.sim, SimEvents.CheckSkillRank, ValuePriority.Additive, (event) => {
      if (event.source === unit && event.skill === CLEAVE.id) {
        event.value += Math.min(VETERAN_MAX, phasesSurvived(unit));
      }
    }),
};

export const POCKET_CHANGE = 1.5;
// The Sellsword whose Cleave is landing now
let cleaving: Unit | null = null;

/** Cleave, marking its blows as Cleave's. */
const pocketChange: Partial<Skill> = {
  release(u, target, sim) {
    const before = cleaving;
    cleaving = u;
    try {
      CLEAVE.release(u, target, sim);
    } finally {
      cleaving = before;
    }
  },
};

/** Enemies killed by Cleave drop 50% more gold. */
const POCKET_CHANGE_EFFECT: Passive = {
  id: 'pocketChange',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDies, EventPriority.Pre, (event) => {
      const dying = event.source;
      if (event.killer === unit && cleaving === unit && dying.side !== unit.side) {
        dying.bounty = Math.max(dying.bounty, POCKET_CHANGE);
      }
    }),
};

const SELLSWORD_UPGRADES: Upgrade[] = [
  {
    id: 'shieldRush',
    spell: 'rush',
    name: 'Shield Rush',
    describe: () =>
      `After it arrives, the Sellsword taunts that enemy for ${SHIELD_RUSH_TIME} seconds.`,
    patch: shieldRush,
  },
  {
    id: 'chainRush',
    spell: 'rush',
    name: 'Chain Rush',
    describe: () =>
      `If the target dies within ${CHAIN_WINDOW} seconds, it rushes the next enemy attacking the bearer, free.`,
    effect: CHAIN_RUSH,
  },
  {
    id: 'knockAside',
    spell: 'rush',
    name: 'Knock Aside',
    describe: () => `The target is pushed ${KNOCK_DISTANCE} tiles away from the bearer.`,
    patch: knockAside,
  },
  {
    id: 'bribe',
    spell: 'pocketSand',
    name: 'Bribe',
    describe: () =>
      `Becomes a bribe. It costs ${BRIBE_COST} mana and 10 gold plus 4 per enemy level. A non-elite Human enemy walks off and leaves the fight, dropping nothing.`,
    patch: bribe,
    effect: BRIBE_EFFECT,
  },
  {
    id: 'playDead',
    spell: 'pocketSand',
    name: 'Play Dead',
    describe: () =>
      `The first time the Sellsword would die in an area, it throws sand, lies still for ${PLAY_DEAD_TIME} seconds and gets up with ${PLAY_DEAD_HEALTH}% health. Monsters ignore it while it lies still.`,
    effect: PLAY_DEAD,
  },
  {
    id: 'saltTheWound',
    spell: 'pocketSand',
    name: 'Salt the Wound',
    describe: () =>
      `Blinded enemies take ${Math.round((SALT - 1) * 100)}% more damage from every merc.`,
    effect: SALT_THE_WOUND,
  },
  {
    id: 'lowBlow',
    spell: 'hamstring',
    name: 'Low Blow',
    describe: () => `+${LOW_BLOW_CRIT}% crit rate against blinded or slowed targets.`,
    effect: LOW_BLOW,
  },
  {
    id: 'cutpurse',
    spell: 'hamstring',
    name: 'Cutpurse',
    describe: () =>
      `Each hit has a ${CUTPURSE_CHANCE * 100}% chance to steal one buff from the target and keep it.`,
    effect: CUTPURSE,
  },
  {
    id: 'cripple',
    spell: 'hamstring',
    name: 'Cripple',
    describe: () => `Hamstring on an already slowed target roots it for ${CRIPPLE_TIME} seconds.`,
    patch: cripple,
  },
  {
    id: 'weaponHabit',
    spell: 'cleave',
    name: 'Weapon Habit',
    describe: () =>
      `+${Math.round((HABIT_SPEED - 1) * 100)}% attack speed with the weapon type the Sellsword has used longest this run.`,
    effect: WEAPON_HABIT,
  },
  {
    id: 'veteranOfManyWars',
    spell: 'cleave',
    name: 'Veteran of Many Wars',
    describe: () =>
      `Cleave counts as 1 rank higher for each phase the Sellsword survives, up to +${VETERAN_MAX}. Shards still add to it.`,
    effect: VETERAN,
  },
  {
    id: 'pocketChange',
    spell: 'cleave',
    name: 'Pocket Change',
    describe: () =>
      `Enemies killed by Cleave drop ${Math.round((POCKET_CHANGE - 1) * 100)}% more gold.`,
    patch: pocketChange,
    effect: POCKET_CHANGE_EFFECT,
  },
];

export default SELLSWORD_UPGRADES;
