import type { Lifecycle } from '../../../core/lifecycle';
import { EventPriority } from '../../../core/event-emitter';
import type { Upgrade } from '../../../sim/builds';
import { SimEvents } from '../../../sim/events';
import { shiftMorale } from '../../../sim/morale';
import { strike } from '../../../sim/sim';
import { type Passive, type Skill, areaVictims } from '../../../sim/skill';
import type { StatusDef } from '../../../sim/status';
import { BLEED } from '../../../sim/statuses';
import { canTarget } from '../../../sim/targeting';
import { DamageFlags, DamagePriority, Element, Side, ValuePriority } from '../../../sim/types';
import type Unit from '../../../sim/unit';
import { setZone } from '../../../sim/zone';
import listen from '../../passives';
import { isElite, rankOf } from '../../skills';
import {
  DUEL_RANGE,
  FLURRY,
  FLURRY_HITS,
  LUNGE,
  LUNGE_RANGE,
  SHADOWSTEP,
  beginDuel,
  duelTime,
  flurryRatio,
  partnerOf,
} from './spells';

// The Duelist's 12 elite upgrades, from docs/design/16-builds.md. Numbers
// are first guesses. Patches that add to a spell call the base spell's
// `release`, so the spell itself keeps working as the duelist node built it.

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

// Runs a spell's base release with the caster marked in `during`, so a
// listener can tell the spell's own hits from the rest.
function marked(during: WeakSet<Unit>, base: Skill): Skill['release'] {
  return (u, target, sim) => {
    during.add(u);
    try {
      base.release(u, target, sim);
    } finally {
      during.delete(u);
    }
  };
}

// Read through a call, so a check after a strike is not narrowed away
const isAlive = (u: Unit | null): boolean => u?.alive === true;

// Whether a hit is one blow, not a tick of damage over time
const isBlow = (flags: number): boolean => (flags & DamageFlags.DoT) === 0;

// ---------- Duel ----------

const GRAND_CRIT = 50;

/** Duel lasts until one of them dies. */
const grandDuel: Partial<Skill> = {
  release(u, target) {
    if (
      !target?.alive ||
      partnerOf(u) ||
      partnerOf(target) ||
      u.distanceTo(target) > DUEL_RANGE + 0.5
    ) {
      return;
    }
    target.aware = true;
    u.face(target);
    beginDuel(u, target, Number.POSITIVE_INFINITY);
  },
};

/** +50 crit rate on blows at the Duel partner. */
const GRAND_DUEL: Passive = {
  id: 'grandDuel',
  setup: (unit) =>
    listen(unit.sim, SimEvents.CheckHit, ValuePriority.Additive, (event) => {
      if (event.source === unit && partnerOf(unit) === event.target) {
        event.critRate += GRAND_CRIT;
      }
    }),
};

const CHEER = 1;

/** While the Duelist duels, every merc of the party gains 1 morale a second. */
const CROWD_PLEASER: Passive = {
  id: 'crowdPleaser',
  setup: (unit) => {
    let held = 0;
    return listen(unit.sim, SimEvents.Tick, EventPriority.Post, (event) => {
      const { sim } = unit;
      if (!unit.alive || partnerOf(unit) === null) {
        held = 0;
        return;
      }
      held += event.dt;
      while (held >= 1) {
        held -= 1;
        for (const m of sim.living(Side.Party)) {
          if (m !== sim.bearer) {
            shiftMorale(m, CHEER);
          }
        }
      }
    });
  },
};

const TAUNT_RANGE = 6;

// The nearest awake elite the Duelist may challenge from afar
function proudFor(u: Unit): Unit | null {
  if (partnerOf(u)) {
    return null;
  }
  let best: Unit | null = null;
  for (const e of u.sim.living(Side.Monster)) {
    if (
      e.aware &&
      isElite(e) &&
      partnerOf(e) === null &&
      u.distanceTo(e) <= TAUNT_RANGE &&
      canTarget(u, e) &&
      (!best || u.distanceTo(e) < u.distanceTo(best))
    ) {
      best = e;
    }
  }
  return best;
}

/**
 * Duel reaches an elite up to 6 tiles away. The bond holds it at once, so it
 * can only go for the Duelist and walks to it.
 */
const tauntTheProud: Partial<Skill> = {
  aim: (u) => proudFor(u),
  wants: (u, target) =>
    target !== null &&
    isElite(target) &&
    partnerOf(u) === null &&
    partnerOf(target) === null &&
    u.distanceTo(target) <= TAUNT_RANGE,
  release(u, target) {
    if (
      !target?.alive ||
      partnerOf(u) ||
      partnerOf(target) ||
      u.distanceTo(target) > TAUNT_RANGE + 0.5
    ) {
      return;
    }
    target.aware = true;
    u.face(target);
    if (beginDuel(u, target, duelTime(rankOf(u, 'duel')))) {
      target.face(u);
    }
  },
};

// ---------- Shadowstep ----------

const FLOURISH_MANA = 15;
const FLOURISH_MORALE = 1;

/** A Shadowstep that kills gives back mana and morale, and is ready again. */
const flourish: Partial<Skill> = {
  release(u, target, sim) {
    // Only a target the step itself killed counts.
    const was = isAlive(target);
    SHADOWSTEP.release(u, target, sim);
    if (!was || isAlive(target)) {
      return;
    }
    u.mana = Math.min(u.derived.maxMana, u.mana + FLOURISH_MANA);
    shiftMorale(u, FLOURISH_MORALE);
    u.skillCooldowns.set(SHADOWSTEP.id, 0);
  },
};

const SMOKE_TIME = 3;
const SMOKE_RADIUS = 1;

/**
 * Lost in smoke: no enemy may pick the Duelist, except a Duel partner. Those
 * that had it as their target drop it on their next think.
 */
export const SMOKED: StatusDef = {
  id: 'smoked',
  name: 'Smoke',
  duration: SMOKE_TIME,
  immunity: 0,
  setup: (status) =>
    listen(status.unit.sim, SimEvents.CheckTarget, ValuePriority.Post, (event) => {
      const u = status.unit;
      if (event.target === u && event.source.side !== u.side && partnerOf(u) !== event.source) {
        event.allowed = false;
      }
    }),
};

/** Shadowstep leaves a cloud where it began, and the enemies lose track of the Duelist. */
const smokeStep: Partial<Skill> = {
  release(u, target, sim) {
    const x = u.x;
    const z = u.z;
    SHADOWSTEP.release(u, target, sim);
    if (u.x === x && u.z === z) {
      // It did not step
      return;
    }
    setZone(sim, {
      kind: 'smoke',
      owner: u,
      x,
      z,
      r: SMOKE_RADIUS,
      life: SMOKE_TIME,
      element: Element.Neutral,
    });
    u.addStatus(SMOKED, u, SMOKE_TIME);
  },
};

const MARK_HITS = 3;
const MARK_BONUS = 1.2;
const MARK_TIME = 10;

/**
 * Marked by an assassin: its next blows on the unit deal 20% more. The
 * status's `power` holds the blows left.
 */
export const ASSASSINS_MARK: StatusDef = {
  id: 'assassinsMark',
  name: "Assassin's Mark",
  duration: MARK_TIME,
  immunity: 0,
  setup: (status) =>
    listen(status.unit.sim, SimEvents.UnitDamage, DamagePriority.Amplify, (event) => {
      if (event.target !== status.unit || event.source !== status.source || !isBlow(event.flags)) {
        return;
      }
      event.value *= MARK_BONUS;
      status.power--;
      if (status.power <= 0) {
        status.unit.removeStatus(status.def.id);
      }
    }),
};

/** Shadowstep marks its target for the Duelist's next 3 blows. */
const assassinsMark: Partial<Skill> = {
  release(u, target, sim) {
    SHADOWSTEP.release(u, target, sim);
    if (target?.alive && u.distanceTo(target) <= u.kit.reach + 0.5) {
      target.addStatus(ASSASSINS_MARK, u, MARK_TIME, MARK_HITS);
    }
  },
};

// ---------- Lunge ----------

// Duelists whose Lunge is being released with Feint
const feinting = new WeakSet<Unit>();

/** Lunge as cast with Feint: its thrust is marked for the Feint listener. */
const feint: Partial<Skill> = {
  release: marked(feinting, LUNGE),
};

/** Undoes the shield block on a feinting thrust. */
const FEINT: Passive = {
  id: 'feint',
  setup: (unit) => {
    // The damage just before the Block step
    let held = 0;
    const before = listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Reduce, (event) => {
      if (event.source === unit && feinting.has(unit)) {
        held = event.value;
      }
    });
    // Assumes this runs after every blocking listener at this priority. The
    // core one is registered when the Sim is built, so it runs first; a
    // blocking listener added later than this one would still block.
    const after = listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Block, (event) => {
      if (event.source === unit && feinting.has(unit) && event.flags & DamageFlags.Blocked) {
        event.value = held;
        event.flags &= ~DamageFlags.Blocked;
      }
    });
    return together(before, after);
  },
};

const SIDESTEP_TIME = 3;
const SIDESTEP_DODGE = 30;
const SIDESTEP_GAP = 0.8;

/** Stepped aside: blows aimed at the unit have 30 less hit chance. */
export const SIDESTEPPING: StatusDef = {
  id: 'sidestep',
  name: 'Sidestep',
  duration: SIDESTEP_TIME,
  immunity: 0,
  buff: true,
  setup: (status) =>
    listen(status.unit.sim, SimEvents.CheckHit, ValuePriority.Additive, (event) => {
      if (event.target === status.unit) {
        event.hitChance -= SIDESTEP_DODGE;
      }
    }),
};

// Steps `u` a little to one side of the line to `target`, if the ground is open.
function stepAside(u: Unit, target: Unit): void {
  const along = Math.atan2(target.z - u.z, target.x - u.x);
  for (const side of [1, -1]) {
    const a = along + (side * Math.PI) / 2;
    const x = u.x + Math.cos(a) * SIDESTEP_GAP;
    const z = u.z + Math.sin(a) * SIDESTEP_GAP;
    if (!u.sim.nav || u.sim.nav.walkable(x, z)) {
      u.x = x;
      u.z = z;
      u.face(target);
      return;
    }
  }
}

/** Lunge ends with a sidestep that leaves the Duelist harder to hit. */
const sidestep: Partial<Skill> = {
  release(u, target, sim) {
    if (!target?.alive || u.distanceTo(target) > LUNGE_RANGE + 0.5) {
      return;
    }
    LUNGE.release(u, target, sim);
    stepAside(u, target);
    u.addStatus(SIDESTEPPING, u, SIDESTEP_TIME);
  },
};

/**
 * After an evade, Lunge fires by itself at the attacker, free and as a
 * critical, when it is off cooldown and the Duelist is not mid-swing or
 * mid-cast. Its cooldown then starts.
 */
const UNTOUCHABLE: Passive = {
  id: 'untouchable',
  setup: (unit) => {
    let answering = false;
    const evade = listen(unit.sim, SimEvents.UnitMiss, EventPriority.Post, (event) => {
      const foe = event.source;
      if (
        answering ||
        event.target !== unit ||
        !unit.alive ||
        unit.disabled ||
        unit.busy ||
        (unit.skillCooldowns.get(LUNGE.id) ?? 0) > 0 ||
        !canTarget(unit, foe) ||
        unit.distanceTo(foe) > LUNGE_RANGE
      ) {
        return;
      }
      answering = true;
      try {
        LUNGE.release(unit, foe, unit.sim);
      } finally {
        answering = false;
      }
      unit.skillCooldowns.set(LUNGE.id, LUNGE.cooldown);
    });
    // The answering thrust lands, as a critical.
    const crit = listen(unit.sim, SimEvents.CheckHit, ValuePriority.Post, (event) => {
      if (answering && event.source === unit) {
        event.hit = true;
        event.critical = true;
      }
    });
    return together(evade, crit);
  },
};

// ---------- Flurry ----------

// Duelists whose Flurry is being released with Bleed Out
const bleeding = new WeakSet<Unit>();

/** Flurry as cast with Bleed Out: its hits are marked for the Bleed Out listener. */
const bleedOut: Partial<Skill> = {
  release: marked(bleeding, FLURRY),
};

const bleedPower = (rank: number): number => 1 + rank * 0.2;

/** A critical Flurry hit makes the target bleed. */
const BLEED_OUT: Passive = {
  id: 'bleedOut',
  setup: (unit, rank) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (
        event.source === unit &&
        bleeding.has(unit) &&
        event.flags & DamageFlags.Critical &&
        event.target.alive
      ) {
        event.target.addStatus(BLEED, unit, undefined, bleedPower(rank));
      }
    }),
};

const CUT = 0.03;
const CUTS_MAX = 20;

/** Each blow in a row on the same target deals 3% more, up to 20 blows. */
const THOUSAND_CUTS: Passive = {
  id: 'thousandCuts',
  setup: (unit) => {
    let last: Unit | null = null;
    let row = 0;
    return listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Amplify, (event) => {
      if (event.source !== unit || !isBlow(event.flags)) {
        return;
      }
      if (event.target === last) {
        row = Math.min(CUTS_MAX, row + 1);
      } else {
        last = event.target;
        row = 0;
      }
      event.value *= 1 + CUT * row;
    });
  },
};

const WHIRL_RADIUS = 2;

// The foes a Whirlwind would cut
const whirled = (u: Unit): Unit[] => {
  const out: Unit[] = [];
  for (const v of areaVictims(u, FLURRY, u, WHIRL_RADIUS)) {
    out.push(v.target);
  }
  return out;
};

/** Flurry's four hits go round every enemy within 2 tiles, one hit each in turn. */
const whirlwind: Partial<Skill> = {
  wants: (u) => whirled(u).length > 0,
  elite: (u) => whirled(u).some(isElite),
  release(u) {
    const ratio = flurryRatio(rankOf(u, 'flurry'));
    for (let i = 0; i < FLURRY_HITS; i++) {
      for (const v of areaVictims(u, FLURRY, u, WHIRL_RADIUS)) {
        if (v.target.alive) {
          strike(u, v.target, { ratio, flags: DamageFlags.Skill | v.flags });
        }
      }
    }
  },
};

const DUELIST_UPGRADES: Upgrade[] = [
  {
    id: 'grandDuel',
    spell: 'duel',
    name: 'Grand Duel',
    describe: () =>
      `Lasts until one of them dies. The Duelist gets +${GRAND_CRIT}% crit rate against its foe.`,
    patch: grandDuel,
    effect: GRAND_DUEL,
  },
  {
    id: 'crowdPleaser',
    spell: 'duel',
    name: 'Crowd Pleaser',
    describe: () => `During the Duel, the party's morale rises by ${CHEER} a second.`,
    effect: CROWD_PLEASER,
  },
  {
    id: 'tauntTheProud',
    spell: 'duel',
    name: 'Taunt the Proud',
    describe: (rank) =>
      `Can be cast on an elite up to ${TAUNT_RANGE} tiles away. The ${duelTime(rank)} second Duel begins at once, and the elite walks to the Duelist.`,
    patch: tauntTheProud,
  },
  {
    id: 'flourish',
    spell: 'shadowstep',
    name: 'Flourish',
    describe: () =>
      `A kill with it restores ${FLOURISH_MANA} mana and ${FLOURISH_MORALE} morale, and resets its cooldown.`,
    patch: flourish,
  },
  {
    id: 'smokeStep',
    spell: 'shadowstep',
    name: 'Smoke Step',
    describe: () =>
      `Leaves a cloud on the start tile. Enemies lose track of the Duelist for ${SMOKE_TIME} seconds.`,
    patch: smokeStep,
  },
  {
    id: 'assassinsMark',
    spell: 'shadowstep',
    name: "Assassin's Mark",
    describe: () =>
      `The target takes ${Math.round((MARK_BONUS - 1) * 100)}% more damage from the Duelist's next ${MARK_HITS} hits.`,
    patch: assassinsMark,
  },
  {
    id: 'feint',
    spell: 'lunge',
    name: 'Feint',
    describe: () => 'The thrust cannot be blocked.',
    patch: feint,
    effect: FEINT,
  },
  {
    id: 'sidestep',
    spell: 'lunge',
    name: 'Sidestep',
    describe: () =>
      `Ends with a sidestep: hits on the Duelist have ${SIDESTEP_DODGE}% less chance to land for ${SIDESTEP_TIME} seconds.`,
    patch: sidestep,
  },
  {
    id: 'untouchable',
    spell: 'lunge',
    name: 'Untouchable',
    describe: () =>
      'Fires by itself at the attacker right after an evade, free and as a critical, when it is off cooldown.',
    effect: UNTOUCHABLE,
  },
  {
    id: 'bleedOut',
    spell: 'flurry',
    name: 'Bleed Out',
    describe: (rank) =>
      `Crits add bleed: ${bleedPower(rank).toFixed(1)}% of max health a second as True damage, for ${BLEED.duration} seconds.`,
    patch: bleedOut,
    effect: BLEED_OUT,
  },
  {
    id: 'thousandCuts',
    spell: 'flurry',
    name: 'Thousand Cuts',
    describe: () =>
      `Each hit in a row on the same target adds ${CUT * 100}% damage, up to ${CUTS_MAX} hits. Switching targets resets it.`,
    effect: THOUSAND_CUTS,
  },
  {
    id: 'whirlwind',
    spell: 'flurry',
    name: 'Whirlwind',
    describe: () =>
      `The ${FLURRY_HITS} hits strike every enemy within ${WHIRL_RADIUS} tiles of the Duelist, one hit each in turn.`,
    patch: whirlwind,
  },
];

export default DUELIST_UPGRADES;
