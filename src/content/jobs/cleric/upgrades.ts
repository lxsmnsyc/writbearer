import { EventPriority } from '../../../core/event-emitter';
import type { Lifecycle } from '../../../core/lifecycle';
import type { Upgrade } from '../../../sim/builds';
import { SimEvents } from '../../../sim/events';
import { shiftMorale } from '../../../sim/morale';
import { strike } from '../../../sim/sim';
import type Sim from '../../../sim/sim';
import type { Passive, Skill } from '../../../sim/skill';
import type { StatusDef } from '../../../sim/status';
import { RENEWED, SEAR } from '../../../sim/statuses';
import { hostiles } from '../../../sim/targeting';
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
} from '../../../sim/types';
import type Unit from '../../../sim/unit';
import { type Zone, setZone } from '../../../sim/zone';
import {
  HEAL,
  PRAYER_REACH,
  SACRED_GROUND,
  SACRED_RADIUS,
  SMITE,
  SMITE_REACH,
  WARD,
  after,
  bearerFirst,
  flockOf,
  hurtCluster,
  neediest,
  placed,
  wardAmount,
} from '../../cleric';
import listen from '../../passives';
import { rankOf } from '../../skills';

// The Cleric's 12 elite upgrades, from docs/design/16-builds.md. Numbers are
// first guesses. A patch that adds to a spell calls the base spell's
// `release`, so the spell keeps working as the cleric module draws it. The
// numbers that grow with rank follow the base spell's rank, as the design
// table has them.

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

// The zone the base spell just set: the owner's last one of a kind.
function lastZone(sim: Sim, owner: Unit, kind: string): Zone | undefined {
  for (let i = sim.zones.length - 1; i >= 0; i--) {
    const z = sim.zones[i];
    if (z.owner === owner && z.kind === kind) {
      return z;
    }
  }
  return undefined;
}

// Runs `extra` on each unit in a zone, after what the zone already does.
function alsoPulse(zone: Zone, extra: (p: Unit) => void): void {
  const base = zone.pulse;
  zone.pulse = (p, z) => {
    base?.(p, z);
    extra(p);
  };
}

// ---------- Ward ----------

/** Cleanse. Ward also lifts every harmful status and clears all buildup. */
const cleanse: Partial<Skill> = {
  describe: (rank) =>
    `${WARD.describe(rank)} Also removes every harmful status from the target and clears its buildup.`,
  release(u, target, sim) {
    WARD.release(u, target, sim);
    if (!target?.alive) {
      return;
    }
    for (const [id, s] of target.statuses) {
      if (s.source.side !== target.side || s.def.hostile) {
        target.removeStatus(id);
      }
    }
    target.buildup.clear();
  },
};

const wallHits = (rank: number): number => Math.floor(2 + rank / 2);

/** Wall of Faith. Ward also raises a barrier on the target's tile. */
const wallOfFaith: Partial<Skill> = {
  describe: (rank) =>
    `${WARD.describe(rank)} Also raises a wall of faith on the target's spot that stops the next ${wallHits(rank)} melee blows on anyone in it.`,
  release(u, target, sim) {
    WARD.release(u, target, sim);
    if (!target || placed(u, 'wallOfFaith')) {
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
      charges: wallHits(rankOf(u, 'ward')),
    });
  },
};

const TWIN_SHARE = 0.6;

// Allies an enemy is after and whose Ward is low, the bearer first, then the
// most hurt.
function endangered(u: Unit, sim: Sim): Unit[] {
  const half = wardAmount(u, rankOf(u, 'ward')) / 2;
  const list = flockOf(u).filter((p) => after(u, p).length > 0 && p.ward < half);
  list.sort((a, b) => {
    if (a === sim.bearer || b === sim.bearer) {
      return a === sim.bearer ? -1 : 1;
    }
    return a.hp / a.derived.maxHp - b.hp / b.derived.maxHp;
  });
  return list;
}

/** Twin Ward. Ward goes to the two allies in most danger, 60% of the pool each. */
const twinWard: Partial<Skill> = {
  describe: (rank) =>
    `${WARD.describe(rank)} Cast on the two allies in most danger; each gets ${TWIN_SHARE * 100}% of the Ward.`,
  aim: (u, sim) => endangered(u, sim).at(0) ?? null,
  release(u, target, sim) {
    if (!target?.alive) {
      return;
    }
    const pool = wardAmount(u, rankOf(u, 'ward'));
    // Alone in danger, an ally gets the whole pool.
    const second = endangered(u, sim).find((p) => p !== target);
    const share = second ? pool * TWIN_SHARE : pool;
    for (const p of [target, second]) {
      if (p?.alive) {
        p.ward = Math.max(p.ward, Math.round(share));
      }
    }
  },
};

// ---------- Heal ----------

const renewPulse = (rank: number): number => 8 + rank * 3;

/** Renew. Heal becomes a heal over time for 6 seconds. */
const renew: Partial<Skill> = {
  describe: (rank) => `Heals an ally for ${renewPulse(rank)} each second for 6 seconds.`,
  cost: 12,
  cooldown: 5,
  windup: 0.4,
  aim: (u) => neediest(u, 0.85, (p) => p.statuses.has(RENEWED.id)),
  release(u, target) {
    target?.addStatus(RENEWED, u, undefined, renewPulse(rankOf(u, 'heal')));
  },
};

const raiseShare = (rank: number): number => 0.1 + rank * 0.05;

// A fallen merc within reach that can still be raised
const fallen = (u: Unit): Unit | null =>
  [...u.sim.units].find(
    (p) =>
      p.side === Side.Party &&
      !p.alive &&
      !p.torn &&
      p !== u.sim.bearer &&
      u.distanceTo(p) <= PRAYER_REACH,
  ) ?? null;

/**
 * Resurrection. Heal can target a dead merc: a long prayer that raises it.
 * Torn bodies stay dead. Costly, so it is a different spell to cast.
 */
const resurrection: Partial<Skill> = {
  describe: (rank) =>
    `${HEAL.describe(rank)} Can instead raise a fallen merc with ${Math.round(raiseShare(rank) * 100)}% health. Torn bodies stay dead.`,
  cost: 30,
  cooldown: 20,
  windup: 3,
  recovery: 0.5,
  aim: (u, sim) => fallen(u) ?? HEAL.aim?.(u, sim) ?? null,
  release(u, target, sim) {
    if (target && !target.alive) {
      target.revive(raiseShare(rankOf(u, 'heal')));
      return;
    }
    HEAL.release(u, target, sim);
  },
};

const MARTYR_REACH = 5;
const MARTYR_SHARE = 0.2;

/** Martyr. When the Cleric dies, the dead around it rise. */
const MARTYR: Passive = {
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

// ---------- Sacred Ground ----------

const VEIL_RADIUS = 2.5;
const veilTime = (rank: number): number => 4 + rank / 2;

// The bearer, when an archer is shooting at the party near it
function shotAt(u: Unit, sim: Sim): Unit | null {
  const bearer = sim.bearer;
  if (!bearer?.alive || u.distanceTo(bearer) > PRAYER_REACH) {
    return null;
  }
  for (const e of hostiles(u)) {
    if (
      e.aware &&
      e.job.range === Range.Ranged &&
      e.target?.side === Side.Party &&
      e.target.distanceTo(bearer) <= VEIL_RADIUS
    ) {
      return bearer;
    }
  }
  return null;
}

/** Veil. A veil over the bearer that stops ranged physical hits. It does not heal. */
const veil: Partial<Skill> = {
  describe: (rank) =>
    `A veil ${VEIL_RADIUS} tiles around the bearer for ${veilTime(rank)} seconds. Ranged physical hits on anyone inside are stopped. It does not heal.`,
  cost: 18,
  cooldown: 15,
  aim: (u, sim) => (placed(u, 'veil') ? null : shotAt(u, sim)),
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
      life: veilTime(rankOf(u, 'sacredGround')),
      element: Element.Radiant,
      guards: 'ranged',
    });
  },
};

const consecrateRatio = (rank: number): number => 40 + rank * 5;

// The ally with two or more of the Cleric's enemies on its ground, the
// bearer first
const burnable = (u: Unit): Unit | null =>
  bearerFirst(
    u,
    (p) =>
      hostiles(u).filter((e) => e.aware && Math.hypot(e.x - p.x, e.z - p.z) <= SACRED_RADIUS)
        .length >= 2,
  );

/** Consecrate. The ground also burns the enemies inside with Radiant fire. */
const consecrate: Partial<Skill> = {
  describe: (rank) =>
    `${SACRED_GROUND.describe(rank)} Enemies inside take ${consecrateRatio(rank)}% Radiant magic damage each second.`,
  aim: (u) => (placed(u, 'sacredGround') ? null : (hurtCluster(u) ?? burnable(u))),
  release(u, target, sim) {
    SACRED_GROUND.release(u, target, sim);
    const zone = lastZone(sim, u, 'sacredGround');
    if (!zone) {
      return;
    }
    const ratio = consecrateRatio(rankOf(u, 'sacredGround'));
    alsoPulse(zone, (e) => {
      if (u.alive && e.side !== u.side && e.alive && hostiles(u).includes(e)) {
        strike(u, e, {
          kind: DamageKind.Magical,
          element: Element.Radiant,
          range: Range.Ranged,
          ratio,
          flags: DamageFlags.Skill | DamageFlags.AoE,
        });
      }
    });
  },
};

const REST_MANA = 2;
const REST_MORALE = 0.5;

/** Pilgrim's Rest. Allies on the ground also regain mana and morale. */
const pilgrimsRest: Partial<Skill> = {
  describe: (rank) =>
    `${SACRED_GROUND.describe(rank)} Allies inside also regain ${REST_MANA} mana and ${REST_MORALE} morale each second.`,
  release(u, target, sim) {
    SACRED_GROUND.release(u, target, sim);
    const zone = lastZone(sim, u, 'sacredGround');
    if (!zone) {
      return;
    }
    alsoPulse(zone, (p) => {
      if (p.side === u.side) {
        p.mana = Math.min(p.derived.maxMana, p.mana + REST_MANA);
        shiftMorale(p, REST_MORALE);
      }
    });
  },
};

// ---------- Smite ----------

const turnChance = (rank: number): number => 0.15 + rank * 0.02;

const turnable = (u: Unit, target: Unit | null): target is Unit =>
  target !== null &&
  target.race === Race.Undead &&
  target.rank !== Rank.Boss &&
  u.distanceTo(target) <= SMITE_REACH;

/**
 * Turn Undead. Smite also has a chance, higher as the target is hurt, to
 * destroy a non-boss Undead outright.
 */
const turnUndead: Partial<Skill> = {
  describe: (rank) =>
    `${SMITE.describe(rank)} Against a non-boss Undead, also a ${Math.round(turnChance(rank) * 100)}% chance, up to 30% more as it is hurt, to destroy it at once.`,
  release(u, target, sim) {
    if (!target?.alive || !turnable(u, target)) {
      SMITE.release(u, target, sim);
      return;
    }
    const hurt = 1 - target.hp / target.derived.maxHp;
    const chance = turnChance(rankOf(u, 'smite')) + hurt * 0.3;
    if (sim.rng.random() < chance) {
      target.aware = true;
      u.hit(target, { kind: DamageKind.True, fixed: target.hp, flags: DamageFlags.Skill });
      return;
    }
    SMITE.release(u, target, sim);
  },
};

const PURGE_BANE = 1.25;
const PURGE_TIME = 8;

/** Marked by Purge: the party deals more damage to it. */
export const PURGED: StatusDef = {
  id: 'purged',
  name: 'Purged',
  duration: PURGE_TIME,
  immunity: 0,
  setup: (s) => {
    const amplify = (event: {
      source: Unit;
      target: Unit;
      value: number;
      kind: DamageKind;
    }): void => {
      if (
        event.target === s.unit &&
        event.source.side !== s.unit.side &&
        event.kind !== DamageKind.True
      ) {
        event.value *= PURGE_BANE;
      }
    };
    return {
      start: () => {
        s.unit.sim.on(SimEvents.UnitDamage, DamagePriority.Amplify, amplify);
      },
      stop: () => {
        s.unit.sim.off(SimEvents.UnitDamage, DamagePriority.Amplify, amplify);
      },
    };
  },
};

/** Purge. Smite marks an Occult target: the party deals 25% more damage to it. */
const purge: Partial<Skill> = {
  describe: (rank) =>
    `${SMITE.describe(rank)} Marks an Occult target for ${PURGE_TIME} seconds. The party deals ${Math.round((PURGE_BANE - 1) * 100)}% more damage to it.`,
  release(u, target, sim) {
    SMITE.release(u, target, sim);
    if (target?.alive && target.element === Element.Occult) {
      target.addStatus(PURGED, u);
    }
  },
};

const HOLY_SPREAD = 0.5;
const HOLY_REACH = 2;

/**
 * Holy Light. The Cleric's Sear buildup doubles, and half of it spreads to
 * the enemies within 2 tiles of the target.
 */
const HOLY_LIGHT: Passive = {
  id: 'holyLight',
  setup: (unit) => {
    // The spread itself builds up too, but is not doubled or spread again.
    let spreading = false;
    const double = listen(
      unit.sim,
      SimEvents.CheckBuildup,
      ValuePriority.Multiplicative,
      (event) => {
        if (!spreading && event.source === unit && event.status === SEAR) {
          event.value *= 2;
        }
      },
    );
    const spread = listen(unit.sim, SimEvents.CheckBuildup, ValuePriority.Post, (event) => {
      if (
        spreading ||
        event.disabled ||
        event.source !== unit ||
        event.status !== SEAR ||
        event.value <= 0
      ) {
        return;
      }
      spreading = true;
      for (const e of hostiles(unit)) {
        if (
          e !== event.target &&
          Math.hypot(e.x - event.target.x, e.z - event.target.z) <= HOLY_REACH
        ) {
          e.buildUp(SEAR, unit, event.value * HOLY_SPREAD);
        }
      }
      spreading = false;
    });
    return together(double, spread);
  },
};

const CLERIC_UPGRADES: Upgrade[] = [
  {
    id: 'cleanse',
    spell: 'ward',
    name: 'Cleanse',
    describe: () => 'Also removes harmful statuses and clears their buildup from the target.',
    patch: cleanse,
  },
  {
    id: 'wallOfFaith',
    spell: 'ward',
    name: 'Wall of Faith',
    describe: (rank) =>
      `Also puts a barrier on the target's tile that stops the next ${wallHits(rank)} melee blows on anyone in it.`,
    patch: wallOfFaith,
  },
  {
    id: 'twinWard',
    spell: 'ward',
    name: 'Twin Ward',
    describe: () =>
      `Casts on the two allies in most danger. Each gets ${TWIN_SHARE * 100}% of the pool.`,
    patch: twinWard,
  },
  {
    id: 'renew',
    spell: 'heal',
    name: 'Renew',
    describe: (rank) =>
      `Becomes a heal over time: ${renewPulse(rank)} health a second for 6 seconds. 12 mana, 5 second cooldown.`,
    patch: renew,
  },
  {
    id: 'resurrection',
    spell: 'heal',
    name: 'Resurrection',
    describe: (rank) =>
      `Can target a dead merc. It costs 30 mana and has a 20 second cooldown. A long windup, then it rises with ${Math.round(raiseShare(rank) * 100)}% health.`,
    patch: resurrection,
  },
  {
    id: 'martyr',
    spell: 'heal',
    name: 'Martyr',
    describe: () =>
      `When the Cleric dies, every dead ally within ${MARTYR_REACH} tiles rises with ${MARTYR_SHARE * 100}% health. Heal itself is unchanged.`,
    effect: MARTYR,
  },
  {
    id: 'veil',
    spell: 'sacredGround',
    name: 'Veil',
    describe: (rank) =>
      `Becomes a ${VEIL_RADIUS}-tile veil around the bearer for ${veilTime(rank)} seconds. It stops ranged physical hits inside. It does not heal. 18 mana, 15 second cooldown.`,
    patch: veil,
  },
  {
    id: 'consecrate',
    spell: 'sacredGround',
    name: 'Consecrate',
    describe: (rank) =>
      `The ground also burns enemies inside for ${consecrateRatio(rank)}% Radiant magic damage a second.`,
    patch: consecrate,
  },
  {
    id: 'pilgrimsRest',
    spell: 'sacredGround',
    name: "Pilgrim's Rest",
    describe: () =>
      `Allies inside also regain ${REST_MANA} mana a second and ${REST_MORALE} morale a second.`,
    patch: pilgrimsRest,
  },
  {
    id: 'turnUndead',
    spell: 'smite',
    name: 'Turn Undead',
    describe: (rank) =>
      `Also a ${Math.round(turnChance(rank) * 100)}% chance, plus up to 30% as the target is hurt, to destroy a non-boss Undead.`,
    patch: turnUndead,
  },
  {
    id: 'purge',
    spell: 'smite',
    name: 'Purge',
    describe: () =>
      `Marks an Occult target for ${PURGE_TIME} seconds. The party deals ${Math.round((PURGE_BANE - 1) * 100)}% more damage to it.`,
    patch: purge,
  },
  {
    id: 'holyLight',
    spell: 'smite',
    name: 'Holy Light',
    describe: () =>
      `Doubles the Sear buildup, and half of it spreads to enemies within ${HOLY_REACH} tiles of the target.`,
    effect: HOLY_LIGHT,
  },
];

export default CLERIC_UPGRADES;
