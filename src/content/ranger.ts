import { EventPriority } from '../core/event-emitter';
import { SimEvents } from '../sim/events';
import { Shout, acting } from '../sim/shout';
import type Sim from '../sim/sim';
import { ARROW_SPEED, strike } from '../sim/sim';
import { type Passive, type Skill, Targeting } from '../sim/skill';
import { BLEED, ROOTED, SHOCK, SLOWED } from '../sim/statuses';
import { DamageFlags, DamagePriority, Element, Range, Side, ValuePriority } from '../sim/types';
import type { HitOptions } from '../sim/unit';
import type Unit from '../sim/unit';
import { setZone } from '../sim/zone';
import listen from './passives';
import { PIERCE_OVERSHOOT, PIERCE_WIDTH, inLine, inReach, isElite, rankOf } from './skills';

const aimedRatio = (rank: number): number => 200 + rank * 15;

/** Ranger, Hawkeye tier 1. A long, still draw for one heavy arrow. */
export const AIMED_SHOT: Skill = {
  id: 'aimedShot',
  name: 'Aimed Shot',
  describe: (rank) => `A long draw for one arrow at ${aimedRatio(rank)}% damage.`,
  cost: 10,
  cooldown: 5,
  windup: 1.4,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants(u, target) {
    return inReach(u, target);
  },
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target, sim) {
    if (!target?.alive) {
      return;
    }
    sim.fire(u, target, {
      speed: ARROW_SPEED * 1.3,
      homing: true,
      skill: 'aimedShot',
      options: {
        range: Range.Ranged,
        ratio: aimedRatio(rankOf(u, 'aimedShot')),
        flags: DamageFlags.Skill | DamageFlags.Projectile,
      },
    });
  },
};

const SNARE_REACH = 7;
const snareTime = (rank: number): number => 1.5 + rank * 0.25;

// The awake enemy nearest the bearer that is coming for it, if any.
export function comingForBearer(u: Unit): Unit | null {
  const bearer = u.sim.bearer;
  if (!bearer?.alive) {
    return null;
  }
  let best: Unit | null = null;
  for (const e of u.sim.living(Side.Monster)) {
    const d = e.distanceTo(bearer);
    if (e.aware && e.target === bearer && d <= SNARE_REACH && d > 1.5) {
      if (!best || d < best.distanceTo(bearer)) {
        best = e;
      }
    }
  }
  return best;
}

/**
 * Ranger, Trapper tier 1. Throws a snare into the path of an enemy coming
 * for the bearer. The first enemy to step in is held fast.
 */
export const SNARE: Skill = {
  id: 'snare',
  name: 'Snare',
  describe: (rank) =>
    `Sets a snare in the path of an enemy coming for the bearer. It holds the first enemy in for ${snareTime(rank)} seconds.`,
  cost: 8,
  cooldown: 7,
  windup: 0.4,
  recovery: 0.3,
  targeting: Targeting.Self,
  wants(u, _target, sim) {
    // One snare at a time.
    return (
      comingForBearer(u) !== null && !sim.traps.some((t) => t.owner === u && t.skill === 'snare')
    );
  },
  elite(u) {
    const e = comingForBearer(u);
    return e !== null && isElite(e);
  },
  release(u, _target, sim) {
    const e = comingForBearer(u);
    const bearer = sim.bearer;
    if (!e || !bearer) {
      return;
    }
    // A step ahead of the enemy, on its way to the bearer.
    const dx = bearer.x - e.x;
    const dz = bearer.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    const step = Math.min(1.2, d / 2);
    sim.traps.push({
      owner: u,
      x: e.x + (dx / d) * step,
      z: e.z + (dz / d) * step,
      radius: 0.5,
      life: 20,
      status: ROOTED,
      duration: snareTime(rankOf(u, 'snare')),
      sprung: false,
      skill: 'snare',
    });
  },
};

const chargedRatio = (rank: number): number => 90 + rank * 8;
const CHAIN_REACH = 3;

/**
 * Ranger, Stormcaller tier 1. A Storm arrow that leaps on to one more enemy
 * near the first. Storm builds up Shock.
 */
export const CHARGED_ARROW: Skill = {
  id: 'chargedArrow',
  name: 'Charged Arrow',
  describe: (rank) =>
    `A Storm arrow for ${chargedRatio(rank)}% damage that chains to one more enemy within ${CHAIN_REACH} tiles.`,
  cost: 9,
  cooldown: 4,
  windup: 0.6,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants(u, target) {
    return inReach(u, target);
  },
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target, sim) {
    if (!target?.alive) {
      return;
    }
    const options = {
      range: Range.Ranged,
      element: Element.Storm,
      ratio: chargedRatio(rankOf(u, 'chargedArrow')),
      flags: DamageFlags.Skill | DamageFlags.Projectile,
    };
    sim.fire(u, target, {
      speed: ARROW_SPEED,
      homing: true,
      skill: 'chargedArrow',
      options,
      onHit: (first) => {
        const next = sim
          .living(Side.Monster)
          .filter((e) => e !== first && e.distanceTo(first) <= CHAIN_REACH)
          .sort((a, b) => a.distanceTo(first) - b.distanceTo(first))
          .at(0);
        if (next) {
          // The chain leaps from the first enemy, not from the Ranger.
          sim.chain(u, first, next, { speed: ARROW_SPEED * 2, skill: 'chargedArrow', options });
        }
      },
    });
  },
};

const pierceRatio = (rank: number): number => 150 + rank * 15;

/**
 * Ranger, Hawkeye tier 4. A long draw, then an arrow that flies straight
 * through every enemy in its line.
 */
export const PIERCING_ARROW: Skill = {
  id: 'piercingArrow',
  name: 'Piercing Arrow',
  describe: (rank) =>
    `A long draw, then an arrow that hits every enemy in a line for ${pierceRatio(rank)}% damage.`,
  cost: 14,
  cooldown: 6,
  windup: 0.9,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants(u, target, sim) {
    if (!inReach(u, target)) {
      return false;
    }
    // Saved for a line of two or more, an elite, or something after the bearer.
    return inLine(u, target).length >= 2 || isElite(target) || target.target === sim.bearer;
  },
  elite(u, target) {
    return target !== null && inLine(u, target).some(isElite);
  },
  release(u, target, sim) {
    if (!target) {
      return;
    }
    sim.fire(u, target, {
      speed: ARROW_SPEED * 1.4,
      distance: u.kit.reach + PIERCE_OVERSHOOT,
      radius: PIERCE_WIDTH,
      pierce: true,
      skill: 'piercingArrow',
      options: {
        range: Range.Ranged,
        ratio: pierceRatio(rankOf(u, 'piercingArrow')),
        flags: DamageFlags.Skill | DamageFlags.Projectile,
      },
    });
  },
};

const pinTime = (rank: number): number => 1 + rank * 0.5;

/**
 * Ranger, Hawkeye tier 2. An arrow that pins an enemy where it stands. It
 * will also ground flyers once they exist.
 */
export const PIN_DOWN: Skill = {
  id: 'pinDown',
  name: 'Pin Down',
  describe: (rank) => `An arrow that pins an enemy in place for ${pinTime(rank)} seconds.`,
  cost: 8,
  cooldown: 8,
  windup: 0.5,
  recovery: 0.25,
  targeting: Targeting.Enemy,
  wants(u, target, sim) {
    // For whatever is running at the bearer, or an elite.
    return (
      inReach(u, target) &&
      !target.statuses.has(ROOTED.id) &&
      (target.target === sim.bearer || isElite(target))
    );
  },
  elite(_u, target) {
    return target !== null && isElite(target);
  },
  release(u, target, sim) {
    if (!target?.alive) {
      return;
    }
    const time = pinTime(rankOf(u, 'pinDown'));
    sim.fire(u, target, {
      speed: ARROW_SPEED,
      homing: true,
      skill: 'pinDown',
      options: {
        range: Range.Ranged,
        ratio: 80,
        flags: DamageFlags.Skill | DamageFlags.Projectile,
      },
      onHit: (hit) => {
        hit.addStatus(ROOTED, u, time);
      },
    });
  },
};

/** Ranger, Hawkeye tier 3. Longer reach and surer aim. */
export const EAGLE_EYE: Passive = {
  id: 'eagleEye',
  setup: (unit, rank) => ({
    start: () => {
      unit.kit.reach += 0.5 * rank;
      unit.setBonus('eagleEye', [{ stat: 'accuracy', add: 3 * rank }]);
    },
    stop: () => {
      unit.kit.reach -= 0.5 * rank;
      unit.setBonus('eagleEye', null);
    },
  }),
};
export const eagleEyeText = (rank: number): string =>
  `+${0.5 * rank} tiles of reach and +${3 * rank} accuracy.`;

/** Ranger, Stormcaller tier 2. Storm hits build up Shock faster. */
export const STATIC: Passive = {
  id: 'static',
  setup: (unit, rank) =>
    listen(unit.sim, SimEvents.CheckBuildup, ValuePriority.Multiplicative, (event) => {
      if (event.source === unit && event.status === SHOCK) {
        event.value *= 1 + 0.25 * rank;
      }
    }),
};
export const staticText = (rank: number): string => `+${25 * rank}% Shock buildup.`;

// The Ranger's later skills, from the skill-tree design. First numbers,
// for balance to settle.

// Enemies within `r` of a spot
const around = (sim: Sim, at: { x: number; z: number }, r: number): Unit[] =>
  sim.living(Side.Monster).filter((e) => Math.hypot(e.x - at.x, e.z - at.z) <= r);

// A root trap of a skill's, set at a spot
function trap(u: Unit, at: { x: number; z: number }, skill: string, duration: number): void {
  u.sim.traps.push({
    owner: u,
    x: at.x,
    z: at.z,
    radius: 0.5,
    life: 15,
    status: ROOTED,
    duration,
    sprung: false,
    skill,
  });
}

// ---------- Hawkeye ----------

/**
 * Hawkeye capstone. The first arrow at an enemy that has not noticed the
 * party is a critical, at double damage.
 */
export const KILLSHOT: Passive = {
  id: 'killshot',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitDamage, DamagePriority.Affinity, (event) => {
      if (
        event.source === unit &&
        event.range === Range.Ranged &&
        event.flags & DamageFlags.Ambush
      ) {
        event.value *= 2;
        event.flags |= DamageFlags.Critical;
      }
    }),
};
export const killshotText = (): string =>
  'The first arrow at an enemy that has not noticed the party is a critical at double damage.';

// ---------- Trapper ----------

// How far back the bearer's trail is kept, and how often a spot is noted
const TRAIL = 5;
const TRAIL_STEP = 0.5;
const REARGUARD_TRAPS = 2;
const rearguardEvery = (rank: number): number => 7 - rank;
const rearguardRoot = (rank: number): number => 1 + rank * 0.25;

/**
 * Trapper tier 2. Sets snares where the bearer walked a few seconds ago,
 * so what follows it is caught.
 */
export const REARGUARD: Passive = {
  id: 'rearguard',
  setup: (unit, rank) => {
    const trail: { x: number; z: number; at: number }[] = [];
    let next = 0;
    return listen(unit.sim, SimEvents.Tick, EventPriority.Post, () => {
      const { sim } = unit;
      const bearer = sim.bearer;
      if (!bearer?.alive || !unit.alive) {
        return;
      }
      if (trail.length === 0 || sim.time - (trail.at(-1)?.at ?? 0) >= TRAIL_STEP) {
        trail.push({ x: bearer.x, z: bearer.z, at: sim.time });
      }
      while (trail.length > 0 && sim.time - trail[0].at > TRAIL) {
        trail.shift();
      }
      const fight = sim.living(Side.Monster).some((e) => e.aware && e.distanceTo(bearer) <= 10);
      const mine = sim.traps.filter((t) => t.owner === unit && t.skill === 'rearguard');
      if (!fight || sim.time < next || mine.length >= REARGUARD_TRAPS || unit.disabled) {
        return;
      }
      const spot = trail.at(0);
      // Only where the bearer has moved on from, and not on another snare
      if (
        !spot ||
        bearer.distanceTo(spot) < 1.5 ||
        sim.traps.some((t) => Math.hypot(t.x - spot.x, t.z - spot.z) < 1)
      ) {
        return;
      }
      trap(unit, spot, 'rearguard', rearguardRoot(rank));
      next = sim.time + rearguardEvery(rank);
    });
  },
};
export const rearguardText = (rank: number): string =>
  `In a fight, every ${rearguardEvery(rank)} seconds, sets a snare where the bearer walked ${TRAIL} seconds ago. It roots for ${rearguardRoot(rank)} seconds. Two at a time.`;

const BAIT_LURE = 5;
const baitTime = (rank: number): number => 3 + rank * 0.5;

// The enemy nearest the bearer that is coming at the party
function nearestThreat(u: Unit): Unit | null {
  const bearer = u.sim.bearer;
  if (!bearer?.alive) {
    return null;
  }
  return (
    u.sim
      .living(Side.Monster)
      .filter((e) => e.aware && e.target?.side === Side.Party && e.distanceTo(bearer) <= 7)
      .sort((a, b) => a.distanceTo(bearer) - b.distanceTo(bearer))
      .at(0) ?? null
  );
}

/**
 * Trapper tier 3. Throws a decoy past the nearest threat. Monsters near it
 * turn from the party and go for it for a few seconds.
 */
export const BAIT: Skill = {
  id: 'bait',
  name: 'Bait',
  describe: (rank) =>
    `Throws a decoy past the nearest enemy. For ${baitTime(rank)} seconds, enemies within ${BAIT_LURE} tiles of it leave the party and go to it. Bosses are not fooled.`,
  cost: 12,
  cooldown: 16,
  windup: 0.4,
  recovery: 0.3,
  targeting: Targeting.Self,
  wants: (u, _target, sim) => {
    const threat = nearestThreat(u);
    return (
      threat !== null &&
      around(sim, threat, BAIT_LURE).filter((e) => e.aware).length >= 2 &&
      !sim.zones.some((z) => z.owner === u && z.kind === 'bait')
    );
  },
  elite: (u) => {
    const threat = nearestThreat(u);
    return threat !== null && around(u.sim, threat, BAIT_LURE).some(isElite);
  },
  release(u, _target, sim) {
    const threat = nearestThreat(u);
    const bearer = sim.bearer;
    if (!threat || !bearer) {
      return;
    }
    // Two tiles beyond the threat, away from the bearer
    const d = threat.distanceTo(bearer) || 1;
    let x = threat.x + ((threat.x - bearer.x) / d) * 2;
    let z = threat.z + ((threat.z - bearer.z) / d) * 2;
    if (sim.nav && !sim.nav.walkable(x, z)) {
      x = threat.x;
      z = threat.z;
    }
    setZone(sim, {
      kind: 'bait',
      owner: u,
      x,
      z,
      r: 0.6,
      life: baitTime(rankOf(u, 'bait')),
      element: Element.Neutral,
      lure: BAIT_LURE,
    });
  },
};

const SPIKE_RADIUS = 2;
const SPIKE_TIME = 6;

/**
 * Trapper tier 4. Scatters caltrops over an area: enemies in it are slowed
 * and bleed.
 */
export const SPIKE_FIELD: Skill = {
  id: 'spikeField',
  name: 'Spike Field',
  describe: (rank) =>
    `Scatters spikes ${SPIKE_RADIUS} tiles around an enemy for ${SPIKE_TIME} seconds. Enemies in them are slowed by half and bleed ${rank}% of their health each second.`,
  cost: 14,
  cooldown: 12,
  windup: 0.5,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  wants: (u, target, sim) =>
    inReach(u, target) &&
    (around(sim, target, SPIKE_RADIUS).length >= 2 || isElite(target)) &&
    !sim.zones.some((z) => z.owner === u && z.kind === 'spikeField'),
  elite: (u, target) => target !== null && around(u.sim, target, SPIKE_RADIUS).some(isElite),
  release(u, target, sim) {
    if (!target) {
      return;
    }
    const rank = rankOf(u, 'spikeField');
    setZone(sim, {
      kind: 'spikeField',
      owner: u,
      x: target.x,
      z: target.z,
      r: SPIKE_RADIUS,
      life: SPIKE_TIME,
      element: Element.Neutral,
      pulse: (e) => {
        if (e.side !== u.side) {
          e.aware = true;
          e.addStatus(SLOWED, u);
          e.addStatus(BLEED, u, 3, rank);
        }
      },
    });
  },
};

const RING_TRAPS = 6;
const RING_RADIUS = 2.5;

/**
 * Trapper capstone. When the bearer shouts Hold, the Ranger rings the spot
 * with snares.
 */
export const KILLING_GROUND: Passive = {
  id: 'killingGround',
  setup: (unit) => {
    let last = -1;
    return listen(unit.sim, SimEvents.Tick, EventPriority.Post, () => {
      const { sim } = unit;
      const heard = acting(sim, unit);
      const bearer = sim.bearer;
      if (!heard || heard.shout !== Shout.Hold || heard.from === last || !bearer || !unit.alive) {
        return;
      }
      last = heard.from;
      // The ring replaces the last one.
      for (let i = sim.traps.length - 1; i >= 0; i--) {
        if (sim.traps[i].owner === unit && sim.traps[i].skill === 'killingGround') {
          sim.traps.splice(i, 1);
        }
      }
      for (let i = 0; i < RING_TRAPS; i++) {
        const a = (i / RING_TRAPS) * Math.PI * 2;
        const at = {
          x: bearer.x + Math.cos(a) * RING_RADIUS,
          z: bearer.z + Math.sin(a) * RING_RADIUS,
        };
        if (!sim.nav || sim.nav.walkable(at.x, at.z)) {
          trap(unit, at, 'killingGround', 2);
        }
      }
    });
  },
};
export const killingGroundText = (): string =>
  `When the bearer shouts Hold, sets a ring of ${RING_TRAPS} snares ${RING_RADIUS} tiles around it.`;

// ---------- Stormcaller ----------

const volleyRatio = (rank: number): number => 70 + rank * 10;
const VOLLEY_SPREAD = 4;
const VOLLEY_ARROWS = 3;

// The target and the enemies nearest it, one arrow each
const volleyTargets = (u: Unit, target: Unit): Unit[] => [
  target,
  ...u.sim
    .living(Side.Monster)
    .filter((e) => e !== target && e.aware && e.distanceTo(target) <= VOLLEY_SPREAD)
    .sort((a, b) => a.distanceTo(target) - b.distanceTo(target))
    .slice(0, VOLLEY_ARROWS - 1),
];

/** Fires a Storm arrow that chains on to one more enemy near the first. */
function stormArrow(u: Unit, target: Unit, skill: string, options: HitOptions): void {
  const { sim } = u;
  sim.fire(u, target, {
    speed: ARROW_SPEED,
    homing: true,
    skill,
    options,
    onHit: (first) => {
      const next = sim
        .living(Side.Monster)
        .filter((e) => e !== first && e.distanceTo(first) <= 3)
        .sort((a, b) => a.distanceTo(first) - b.distanceTo(first))
        .at(0);
      if (next) {
        sim.chain(u, first, next, { speed: ARROW_SPEED * 2, skill, options });
      }
    },
  });
}

/**
 * Stormcaller tier 3. Looses three Storm arrows at once, each at a
 * different enemy, and each chains on to another.
 */
export const ARC_VOLLEY: Skill = {
  id: 'arcVolley',
  name: 'Arc Volley',
  describe: (rank) =>
    `Looses ${VOLLEY_ARROWS} Storm arrows at the target and the enemies near it, each for ${volleyRatio(rank)}% damage. Each chains to one more enemy.`,
  cost: 16,
  cooldown: 7,
  windup: 0.7,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  wants: (u, target) => inReach(u, target) && volleyTargets(u, target).length >= 2,
  elite: (u, target) => target !== null && volleyTargets(u, target).some(isElite),
  release(u, target) {
    if (!target?.alive) {
      return;
    }
    const options: HitOptions = {
      range: Range.Ranged,
      element: Element.Storm,
      ratio: volleyRatio(rankOf(u, 'arcVolley')),
      flags: DamageFlags.Skill | DamageFlags.Projectile,
    };
    for (const e of volleyTargets(u, target)) {
      stormArrow(u, e, 'arcVolley', options);
    }
  },
};

const ROD_RADIUS = 2.5;
const rodTime = (rank: number): number => 5 + rank * 0.5;
const rodRatio = (rank: number): number => 35 + rank * 5;

/**
 * Stormcaller tier 4. Plants a rod that calls lightning: a Storm field
 * that strikes every enemy in it each second.
 */
export const LIGHTNING_ROD: Skill = {
  id: 'lightningRod',
  name: 'Lightning Rod',
  describe: (rank) =>
    `Shoots a rod into the ground by an enemy. For ${rodTime(rank)} seconds, lightning strikes every enemy within ${ROD_RADIUS} tiles of it each second for ${rodRatio(rank)}% Storm damage.`,
  cost: 18,
  cooldown: 15,
  windup: 0.6,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  wants: (u, target, sim) =>
    inReach(u, target) &&
    (around(sim, target, ROD_RADIUS).length >= 2 || isElite(target)) &&
    !sim.zones.some((z) => z.owner === u && z.kind === 'lightningRod'),
  elite: (u, target) => target !== null && around(u.sim, target, ROD_RADIUS).some(isElite),
  release(u, target, sim) {
    if (!target) {
      return;
    }
    const rank = rankOf(u, 'lightningRod');
    setZone(sim, {
      kind: 'lightningRod',
      owner: u,
      x: target.x,
      z: target.z,
      r: ROD_RADIUS,
      life: rodTime(rank),
      element: Element.Storm,
      pulse: (e) => {
        if (e.side !== u.side && u.alive) {
          strike(u, e, {
            range: Range.Ranged,
            element: Element.Storm,
            ratio: rodRatio(rank),
            flags: DamageFlags.Skill | DamageFlags.AoE,
          });
        }
      },
    });
  },
};

const THUNDER_REACH = 6;
const THUNDER_RATIO = 60;

/**
 * Stormcaller capstone. When an enemy is Shocked, lightning leaps from it
 * to every other enemy within 6 tiles that carries Shock.
 */
export const THUNDERHEAD: Passive = {
  id: 'thunderhead',
  setup: (unit) => {
    // When each enemy was last leapt to, so the storm cannot feed itself
    const leapt = new WeakMap<Unit, number>();
    return listen(unit.sim, SimEvents.StatusApplied, EventPriority.Post, (event) => {
      const { sim } = unit;
      const from = event.status.unit;
      if (
        event.status.def !== SHOCK ||
        from.side === unit.side ||
        event.status.source.side !== unit.side ||
        !unit.alive
      ) {
        return;
      }
      for (const e of sim.living(from.side)) {
        const charged = e.statuses.has(SHOCK.id) || (e.buildup.get(SHOCK.id) ?? 0) > 0;
        if (
          e === from ||
          !charged ||
          e.distanceTo(from) > THUNDER_REACH ||
          sim.time - (leapt.get(e) ?? -Infinity) < 1
        ) {
          continue;
        }
        leapt.set(e, sim.time);
        sim.chain(unit, from, e, {
          speed: ARROW_SPEED * 2.5,
          skill: 'thunderhead',
          options: {
            range: Range.Ranged,
            element: Element.Storm,
            ratio: THUNDER_RATIO,
            flags: DamageFlags.Skill | DamageFlags.Projectile,
          },
        });
      }
    });
  },
};
export const thunderheadText = (): string =>
  `When an enemy is Shocked, lightning leaps from it to every other enemy within ${THUNDER_REACH} tiles that carries Shock, for ${THUNDER_RATIO}% Storm damage.`;
