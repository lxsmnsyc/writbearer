import { EventPriority } from '../../../core/event-emitter';
import type { Upgrade } from '../../../sim/builds';
import { SimEvents } from '../../../sim/events';
import { effectiveDiscipline } from '../../../sim/morale';
import { ARROW_SPEED, strike } from '../../../sim/sim';
import { type Passive, type Skill, Targeting } from '../../../sim/skill';
import type { StatusDef } from '../../../sim/status';
import { BURN, CHILL } from '../../../sim/statuses';
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
import { inReach, isElite, rankOf } from '../../skills';
import {
  FIREBALL,
  FROST_NOVA,
  NOVA_RADIUS,
  blast,
  fireboltBurn,
  fireboltRatio,
  shardRatio,
} from './spells';

// The Arcanist's 12 elite upgrades, from docs/design/16-builds.md. Numbers
// are first guesses. A bolt patch that replaced `wants` would have to keep
// the Elemental Sense check, so the bolt patches here change `release` only.

// ---------- Frost Nova ----------

// How far from the bearer the wall of ice stands, its half length, and how
// far enemies may be for it to be raised, in tiles
const WALL_AT = 2;
const WALL_HALF = 3;
const WALL_THREAT = 7;
const wallTime = (rank: number): number => 4 + rank * 0.5;

// Awake enemies near the bearer
function nearBearer(u: Unit): Unit[] {
  const bearer = u.sim.bearer ?? u;
  const out: Unit[] = [];
  for (const e of u.sim.living(Side.Monster)) {
    if (e.aware && Math.hypot(e.x - bearer.x, e.z - bearer.z) <= WALL_THREAT) {
      out.push(e);
    }
  }
  return out;
}

/** Frost Nova becomes a wall of ice across the way from the enemies to the bearer. */
const glacialWall: Partial<Skill> = {
  targeting: Targeting.Self,
  wants: (u, _target, sim) =>
    nearBearer(u).length > 0 && !sim.zones.some((z) => z.owner === u && z.kind === 'iceWall'),
  elite: (u) => nearBearer(u).some(isElite),
  release(u, _target, sim) {
    const bearer = sim.bearer ?? u;
    const foes = nearBearer(u);
    if (foes.length === 0) {
      return;
    }
    // Across the middle of the foes, a little way out from the bearer
    let fx = 0;
    let fz = 0;
    for (const e of foes) {
      fx += e.x;
      fz += e.z;
    }
    fx = fx / foes.length - bearer.x;
    fz = fz / foes.length - bearer.z;
    const d = Math.hypot(fx, fz) || 1;
    const away = Math.min(WALL_AT, d / 2);
    const cx = bearer.x + (fx / d) * away;
    const cz = bearer.z + (fz / d) * away;
    const seconds = wallTime(rankOf(u, 'frostNova'));
    const tiles: [number, number][] = [];
    for (let s = -WALL_HALF; s <= WALL_HALF; s += 0.5) {
      const x = Math.floor(cx - (fz / d) * s);
      const z = Math.floor(cz + (fx / d) * s);
      if (!tiles.some((t) => t[0] === x && t[1] === z)) {
        tiles.push([x, z]);
      }
    }
    sim.nav?.block(tiles, seconds);
    setZone(sim, {
      kind: 'iceWall',
      owner: u,
      x: cx,
      z: cz,
      r: WALL_HALF * 0.5,
      life: seconds,
      element: Element.Frost,
    });
  },
};

const RIME_TIME = 5;

/** Slowed by 40% while in a rimefield. Refreshed each tick it stands in one. */
export const RIMED: StatusDef = {
  id: 'rimed',
  name: 'Rimed',
  duration: 0.5,
  immunity: 0,
  slow: 0.6,
};

/** Frost Nova also leaves a field of frost where it was cast. */
const rimefield: Partial<Skill> = {
  release(u, target, sim) {
    FROST_NOVA.release(u, target, sim);
    setZone(sim, {
      kind: 'rimefield',
      owner: u,
      x: u.x,
      z: u.z,
      r: NOVA_RADIUS,
      life: RIME_TIME,
      element: Element.Frost,
    });
  },
};

const RIMEFIELD_EFFECT: Passive = {
  id: 'rimefield',
  setup: (unit) =>
    listen(unit.sim, SimEvents.Tick, EventPriority.Post, () => {
      const { sim } = unit;
      for (const z of sim.zones) {
        if (z.owner !== unit || z.kind !== 'rimefield') {
          continue;
        }
        for (const e of sim.foes(unit.side)) {
          if (Math.hypot(e.x - z.x, e.z - z.z) > z.r) {
            continue;
          }
          const on = e.statuses.get(RIMED.id);
          if (!on || on.remaining < 0.25) {
            e.addStatus(RIMED, unit);
          }
        }
      }
    }),
};

// How close an enemy comes to count as touching, and the seconds between snaps
const TOUCH = 1.5;
const SNAP_EVERY = 12;

/** Frost Nova also fires, free, when an enemy first touches the Arcanist. */
const COLD_SNAP: Passive = {
  id: 'coldSnap',
  setup: (unit) => {
    let touching = new Set<Unit>();
    let last = Number.NEGATIVE_INFINITY;
    return listen(unit.sim, SimEvents.Tick, EventPriority.Post, () => {
      const { sim } = unit;
      if (!unit.alive || unit.disabled) {
        touching = new Set();
        return;
      }
      const now = new Set<Unit>();
      let fresh = false;
      for (const e of sim.foes(unit.side)) {
        if (e.distanceTo(unit) <= TOUCH) {
          now.add(e);
          fresh ||= !touching.has(e);
        }
      }
      touching = now;
      if (fresh && sim.time - last >= SNAP_EVERY) {
        last = sim.time;
        FROST_NOVA.release(unit, null, sim);
      }
    });
  },
};

// ---------- Fireball ----------

const VOLCANO_TIME = 4;
const VOLCANO_FIRE = 1.2;

/** Fireball also leaves a field of Fire where it landed. */
const volcano: Partial<Skill> = {
  release(u, target, sim) {
    if (!target) {
      return;
    }
    const at = { x: target.x, z: target.z };
    FIREBALL.release(u, target, sim);
    setZone(sim, {
      kind: 'volcano',
      owner: u,
      x: at.x,
      z: at.z,
      r: 2,
      life: VOLCANO_TIME,
      element: Element.Fire,
    });
  },
};

const VOLCANO_EFFECT: Passive = {
  id: 'volcano',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Amplify, (event) => {
      if (event.element !== Element.Fire || event.kind === DamageKind.True) {
        return;
      }
      if (event.source.side !== unit.side) {
        return;
      }
      for (const z of unit.sim.zones) {
        if (
          z.owner === unit &&
          z.kind === 'volcano' &&
          Math.hypot(event.source.x - z.x, event.source.z - z.z) <= z.r
        ) {
          event.value *= VOLCANO_FIRE;
          return;
        }
      }
    }),
};

const INFERNO_RADIUS = 4;
const INFERNO_COST = 32;
const INFERNO_COOLDOWN = 12;
// Effective Discipline from which the Arcanist spares its party
const INFERNO_CONTROL = 60;
const infernoRatio = (rank: number): number => 200 + rank * 15;

// Foes in the blast of an Inferno at a spot
function infernoFoes(u: Unit, at: { x: number; z: number }): Unit[] {
  const out: Unit[] = [];
  for (const v of blast(u, FIREBALL, at, INFERNO_RADIUS)) {
    if (v.target.side !== u.side) {
      out.push(v.target);
    }
  }
  return out;
}

/** Fireball becomes a 4-tile Inferno that burns the party too, unless the Arcanist keeps control. */
const inferno: Partial<Skill> = {
  cost: INFERNO_COST,
  cooldown: INFERNO_COOLDOWN,
  friendlyFire: (u) => effectiveDiscipline(u) < INFERNO_CONTROL,
  wants: (u, target) =>
    inReach(u, target) && (isElite(target) || infernoFoes(u, target).length >= 2),
  elite: (u, target) => target !== null && infernoFoes(u, target).some(isElite),
  release(u, target) {
    if (!target?.alive || u.distanceTo(target) > u.kit.reach + 1) {
      return;
    }
    const ratio = infernoRatio(rankOf(u, 'fireball'));
    for (const v of blast(u, FIREBALL, target, INFERNO_RADIUS)) {
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

const ECHO_CHANCE = 0.25;

/** A Fireball sometimes casts again, free. */
const ECHO: Passive = {
  id: 'echo',
  setup: (unit) => {
    let echoing = false;
    return listen(unit.sim, SimEvents.UnitSkillRelease, EventPriority.Post, (event) => {
      if (event.source !== unit || event.skill.id !== 'fireball' || echoing) {
        return;
      }
      if (!unit.sim.rng.chance(ECHO_CHANCE)) {
        return;
      }
      echoing = true;
      try {
        const spell = unit.skills.find((s) => s.id === 'fireball') ?? FIREBALL;
        spell.release(unit, event.target, unit.sim);
      } finally {
        echoing = false;
      }
    });
  },
};

// ---------- Frost Shard ----------

/** Slowed by 30% by a chilling shard. */
export const SHARD_SLOW: StatusDef = {
  id: 'shardSlow',
  name: 'Slowed',
  duration: 3,
  immunity: 0,
  slow: 0.7,
};
const chillBuildup = (rank: number): number => 15 + rank * 2;

/** Frost Shard also slows its target and builds Chill. */
const chill: Partial<Skill> = {
  release(u, target, sim) {
    if (!target?.alive) {
      return;
    }
    const rank = rankOf(u, 'frostShard');
    sim.fire(u, target, {
      speed: ARROW_SPEED * 1.2,
      homing: true,
      skill: 'frostShard',
      options: {
        kind: DamageKind.Magical,
        element: Element.Frost,
        range: Range.Ranged,
        ratio: shardRatio(rank),
        flags: DamageFlags.Skill | DamageFlags.Projectile,
        buildup: [{ status: CHILL, amount: chillBuildup(rank) }],
      },
      onHit: (hit) => {
        hit.addStatus(SHARD_SLOW, u);
      },
    });
  },
};

const SHATTER_RADIUS = 2;
const shatterRatio = (rank: number): number => 60 + rank * 6;

/** An enemy killed while Frozen shatters: Frost damage around it, and no corpse. */
const SHATTERPOINT: Passive = {
  id: 'shatterpoint',
  setup: (unit, rank) => {
    // Enemies seen frozen as they died, because death clears statuses
    const frozen = new Set<Unit>();
    const before = listen(unit.sim, SimEvents.UnitDies, EventPriority.Pre, (event) => {
      const dying = event.source;
      if (dying.alive && dying.side !== unit.side && dying.statuses.has('freeze')) {
        frozen.add(dying);
      }
    });
    const after = listen(unit.sim, SimEvents.UnitDies, EventPriority.Post, (event) => {
      const dying = event.source;
      if (!frozen.delete(dying)) {
        return;
      }
      dying.torn = true;
      if (!unit.alive) {
        return;
      }
      for (const e of unit.sim.foes(unit.side)) {
        if (e.alive && Math.hypot(e.x - dying.x, e.z - dying.z) <= SHATTER_RADIUS) {
          strike(unit, e, {
            kind: DamageKind.Magical,
            element: Element.Frost,
            range: Range.Ranged,
            ratio: shatterRatio(rank),
            flags: DamageFlags.Skill | DamageFlags.AoE,
          });
        }
      }
    });
    return {
      start: () => {
        before.start();
        after.start();
      },
      stop: () => {
        before.stop();
        after.stop();
        frozen.clear();
      },
    };
  },
};

const BLOOD_SHARE = 0.05;

// Set while the cost is asked for below, so the question does not ask itself
let pricing = false;

// Whether the Arcanist is out of mana for a Frost Shard and can pay in health
function paysBlood(u: Unit, skill: Skill): boolean {
  if (skill.id !== 'frostShard' || pricing) {
    return false;
  }
  pricing = true;
  const cost = u.skillCost(skill);
  pricing = false;
  return cost > 0 && u.mana < cost && u.hp > u.derived.maxHp * BLOOD_SHARE + 1;
}

/** Frost Shard costs 5% of max health, not mana, when the mana is gone. */
const OVERCHANNEL: Passive = {
  id: 'overchannel',
  setup: (unit) => {
    const cost = listen(unit.sim, SimEvents.CheckSkillCost, ValuePriority.Post, (event) => {
      if (event.source === unit && paysBlood(unit, event.skill)) {
        event.value = 0;
      }
    });
    const pay = listen(unit.sim, SimEvents.UnitSkillWindup, EventPriority.Pre, (event) => {
      if (event.source === unit && paysBlood(unit, event.skill)) {
        unit.hp = Math.max(1, unit.hp - unit.derived.maxHp * BLOOD_SHARE);
      }
    });
    return {
      start: () => {
        cost.start();
        pay.start();
      },
      stop: () => {
        cost.stop();
        pay.stop();
      },
    };
  },
};

// ---------- Firebolt ----------

/** Firebolt builds twice the Burn. */
const ignite: Partial<Skill> = {
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
        buildup: [{ status: BURN, amount: fireboltBurn(rank) * 2 }],
      },
    });
  },
};

const IGNITE_RADIUS = 2;
const igniteSpread = (rank: number): number => 40 + rank * 4;

/** A burning enemy that dies spreads Burn to enemies near it. */
const IGNITE_EFFECT: Passive = {
  id: 'ignite',
  setup: (unit, rank) => {
    const burning = new Set<Unit>();
    const before = listen(unit.sim, SimEvents.UnitDies, EventPriority.Pre, (event) => {
      const dying = event.source;
      if (dying.alive && dying.side !== unit.side && dying.statuses.has(BURN.id)) {
        burning.add(dying);
      }
    });
    const after = listen(unit.sim, SimEvents.UnitDies, EventPriority.Post, (event) => {
      const dying = event.source;
      if (!burning.delete(dying) || !unit.alive) {
        return;
      }
      for (const e of unit.sim.foes(unit.side)) {
        if (e.alive && Math.hypot(e.x - dying.x, e.z - dying.z) <= IGNITE_RADIUS) {
          e.buildUp(BURN, unit, igniteSpread(rank));
        }
      }
    });
    return {
      start: () => {
        before.start();
        after.start();
      },
      stop: () => {
        before.stop();
        after.stop();
        burning.clear();
      },
    };
  },
};

const MANA_FLOW = 3;

/** Each Firebolt hit returns mana. */
const MANA_FLOW_EFFECT: Passive = {
  id: 'manaFlow',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (
        event.source === unit &&
        event.element === Element.Fire &&
        event.kind === DamageKind.Magical &&
        (event.flags & DamageFlags.Skill) !== 0 &&
        (event.flags & DamageFlags.Projectile) !== 0
      ) {
        unit.mana = Math.min(unit.derived.maxMana, unit.mana + MANA_FLOW);
      }
    }),
};

const PIERCE_COUNT = 3;
const PIERCE_PAST = 2.5;

/** Firebolt flies straight and passes through up to 3 enemies in a line. */
const piercingBolt: Partial<Skill> = {
  release(u, target, sim) {
    if (!target?.alive) {
      return;
    }
    const rank = rankOf(u, 'firebolt');
    let hits = 0;
    const bolt = sim.fire(u, target, {
      speed: ARROW_SPEED * 1.2,
      distance: u.kit.reach + PIERCE_PAST,
      radius: 0.45,
      pierce: true,
      skill: 'firebolt',
      options: {
        kind: DamageKind.Magical,
        element: Element.Fire,
        range: Range.Ranged,
        ratio: fireboltRatio(rank),
        flags: DamageFlags.Skill | DamageFlags.Projectile,
        buildup: [{ status: BURN, amount: fireboltBurn(rank) }],
      },
      onHit: () => {
        hits++;
        if (hits >= PIERCE_COUNT) {
          bolt.done = true;
        }
      },
    });
  },
};

const ARCANIST_UPGRADES: Upgrade[] = [
  {
    id: 'glacialWall',
    spell: 'frostNova',
    name: 'Glacial Wall',
    describe: (rank) =>
      `Becomes a wall of ice between the bearer and the enemies for ${wallTime(rank)} seconds. It blocks the path.`,
    patch: glacialWall,
  },
  {
    id: 'rimefield',
    spell: 'frostNova',
    name: 'Rimefield',
    describe: () =>
      `The ring leaves a frost field for ${RIME_TIME} seconds. Enemies in it are slowed by 40%.`,
    patch: rimefield,
    effect: RIMEFIELD_EFFECT,
  },
  {
    id: 'coldSnap',
    spell: 'frostNova',
    name: 'Cold Snap',
    describe: () =>
      `Also fires by itself when an enemy first touches the Arcanist, once every ${SNAP_EVERY} seconds, free.`,
    effect: COLD_SNAP,
  },
  {
    id: 'volcano',
    spell: 'fireball',
    name: 'Volcano',
    describe: () =>
      `Leaves a Fire field for ${VOLCANO_TIME} seconds. Allies inside deal 20% more Fire damage.`,
    patch: volcano,
    effect: VOLCANO_EFFECT,
  },
  {
    id: 'inferno',
    spell: 'fireball',
    name: 'Inferno',
    describe: (rank) =>
      `A ${INFERNO_RADIUS}-tile area for ${infernoRatio(rank)}% magic damage. It costs ${INFERNO_COST} mana and has a ${INFERNO_COOLDOWN} second cooldown. It hurts the party, unless the Arcanist's effective Discipline is ${INFERNO_CONTROL} or more.`,
    patch: inferno,
  },
  {
    id: 'echo',
    spell: 'fireball',
    name: 'Echo',
    describe: () => `A ${ECHO_CHANCE * 100}% chance to cast it again for free.`,
    effect: ECHO,
  },
  {
    id: 'chill',
    spell: 'frostShard',
    name: 'Chill',
    describe: (rank) =>
      `Also slows the target by 30% for 3 seconds and adds ${chillBuildup(rank)} Chill buildup.`,
    patch: chill,
  },
  {
    id: 'shatterpoint',
    spell: 'frostShard',
    name: 'Shatterpoint',
    describe: (rank) =>
      `An enemy killed while Frozen shatters for ${shatterRatio(rank)}% Frost damage to enemies within ${SHATTER_RADIUS} tiles. It leaves no corpse.`,
    effect: SHATTERPOINT,
  },
  {
    id: 'overchannel',
    spell: 'frostShard',
    name: 'Overchannel',
    describe: () => 'At 0 mana, it costs 5% of max health instead.',
    effect: OVERCHANNEL,
  },
  {
    id: 'ignite',
    spell: 'firebolt',
    name: 'Ignite',
    describe: (rank) =>
      `Burn buildup is doubled. A burning enemy that dies spreads ${igniteSpread(rank)} Burn buildup to enemies within ${IGNITE_RADIUS} tiles.`,
    patch: ignite,
    effect: IGNITE_EFFECT,
  },
  {
    id: 'manaFlow',
    spell: 'firebolt',
    name: 'Mana Flow',
    describe: () => `Each hit returns ${MANA_FLOW} mana.`,
    effect: MANA_FLOW_EFFECT,
  },
  {
    id: 'piercingBolt',
    spell: 'firebolt',
    name: 'Piercing Bolt',
    describe: () => `Passes through up to ${PIERCE_COUNT} enemies in a line.`,
    patch: piercingBolt,
  },
];

export default ARCANIST_UPGRADES;
