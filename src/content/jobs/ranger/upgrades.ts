import { EventPriority } from '../../../core/event-emitter';
import type { Upgrade } from '../../../sim/builds';
import { SimEvents } from '../../../sim/events';
import { Shout, acting } from '../../../sim/shout';
import { ARROW_SPEED, strike } from '../../../sim/sim';
import type { Passive, Skill } from '../../../sim/skill';
import { BLEED, ROOTED, SHOCK, SLOWED, STUN } from '../../../sim/statuses';
import { canTarget } from '../../../sim/targeting';
import { DamageFlags, Element, Range, Side } from '../../../sim/types';
import type Unit from '../../../sim/unit';
import { type Zone, setZone } from '../../../sim/zone';
import listen from '../../passives';
import {
  AIMED_SHOT,
  SNARE,
  aimedArrow,
  around,
  comingForBearer,
  inLineOf,
  pierceArrow,
  pierceRatio,
  pinTime,
  plantRod,
  snareTime,
  stormArrow,
  trap,
} from '../../ranger';
import { isElite, rankOf } from '../../skills';

// The Ranger's 12 elite upgrades, from docs/design/16-builds.md. Numbers
// are first guesses. A patch that adds to a spell calls the base spell's
// `release`, so the spell itself keeps working as ranger.ts has it.

// ---------- Snare ----------

// How far back the bearer's trail is kept, and how often a spot is noted
const TRAIL = 5;
const TRAIL_STEP = 0.5;
const REARGUARD_TRAPS = 2;
const REARGUARD_EVERY = 7;

interface Step {
  x: number;
  z: number;
  at: number;
}

// Each Ranger's note of where the bearer has walked
const trails = new WeakMap<Unit, Step[]>();

// Where the bearer stood TRAIL seconds ago, if it has moved on from there
function trailSpot(u: Unit): Step | null {
  const bearer = u.sim.bearer;
  const spot = trails.get(u)?.at(0);
  if (!bearer?.alive || !spot || bearer.distanceTo(spot) < 1.5) {
    return null;
  }
  // Not on another snare
  if (u.sim.traps.some((t) => Math.hypot(t.x - spot.x, t.z - spot.z) < 1)) {
    return null;
  }
  return spot;
}

/** In a fight, lays a snare where the bearer walked 5 seconds ago every 7 seconds. */
const REARGUARD: Passive = {
  id: 'rearguard',
  setup: (unit) => {
    const trail: Step[] = [];
    trails.set(unit, trail);
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
      const spot = trailSpot(unit);
      if (spot) {
        trap(unit, spot, 'rearguard', snareTime(rankOf(unit, 'snare')));
        next = sim.time + REARGUARD_EVERY;
      }
    });
  },
};

/** Snare also lays a snare on the tile the bearer stood on 5 seconds ago. */
const rearguard: Partial<Skill> = {
  release(u, target, sim) {
    SNARE.release(u, target, sim);
    const spot = trailSpot(u);
    if (spot) {
      trap(u, spot, 'rearguard', snareTime(rankOf(u, 'snare')));
    }
  },
};

const BAIT_LURE = 5;
const baitTime = (rank: number): number => 3 + rank * 0.25;

// The enemy nearest the bearer that is coming at the party and may be picked
function nearestThreat(u: Unit): Unit | null {
  const bearer = u.sim.bearer;
  if (!bearer?.alive) {
    return null;
  }
  let best: Unit | null = null;
  for (const e of u.sim.living(Side.Monster)) {
    if (
      e.aware &&
      e.target?.side === Side.Party &&
      e.distanceTo(bearer) <= 7 &&
      canTarget(u, e) &&
      (!best || e.distanceTo(bearer) < best.distanceTo(bearer))
    ) {
      best = e;
    }
  }
  return best;
}

const ownZone = (u: Unit, z: Zone, kind: string): boolean => z.owner === u && z.kind === kind;

/** Snare throws a decoy past the nearest threat. Monsters near it go to it. */
const bait: Partial<Skill> = {
  wants: (u, _target, sim) =>
    nearestThreat(u) !== null && !sim.zones.some((z) => ownZone(u, z, 'bait')),
  elite: (u) => {
    const threat = nearestThreat(u);
    return threat !== null && around(u.sim, threat, BAIT_LURE, u).some(isElite);
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
      life: baitTime(rankOf(u, 'snare')),
      element: Element.Neutral,
      lure: BAIT_LURE,
    });
  },
};

const SPIKE_RADIUS = 2;
const SPIKE_TIME = 6;

/** Snare becomes a spike field where the enemy stands: it slows and bleeds, and does not root. */
const spikeField: Partial<Skill> = {
  wants: (u, _target, sim) =>
    comingForBearer(u) !== null && !sim.zones.some((z) => ownZone(u, z, 'spikeField')),
  release(u, _target, sim) {
    const e = comingForBearer(u);
    if (!e) {
      return;
    }
    setZone(sim, {
      kind: 'spikeField',
      owner: u,
      x: e.x,
      z: e.z,
      r: SPIKE_RADIUS,
      life: SPIKE_TIME,
      element: Element.Neutral,
      pulse: (foe) => {
        if (foe.side !== u.side && canTarget(u, foe)) {
          foe.aware = true;
          foe.addStatus(SLOWED, u);
          // 1% of max health a second
          foe.addStatus(BLEED, u, 3, 1);
        }
      },
    });
  },
};

// ---------- Lightning Rod ----------

const RING_TRAPS = 6;
const RING_RADIUS = 2.5;

/** When the bearer shouts Hold, plants the rod on the spot at once and rings it with snares. */
const KILLING_GROUND: Passive = {
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
      // The ring and the rod replace the last ones.
      for (let i = sim.traps.length - 1; i >= 0; i--) {
        if (sim.traps[i].owner === unit && sim.traps[i].skill === 'killingGround') {
          sim.traps.splice(i, 1);
        }
      }
      for (let i = sim.zones.length - 1; i >= 0; i--) {
        if (ownZone(unit, sim.zones[i], 'lightningRod')) {
          sim.zones.splice(i, 1);
        }
      }
      plantRod(unit, bearer);
      const root = snareTime(rankOf(unit, 'snare'));
      for (let i = 0; i < RING_TRAPS; i++) {
        const a = (i / RING_TRAPS) * Math.PI * 2;
        const at = {
          x: bearer.x + Math.cos(a) * RING_RADIUS,
          z: bearer.z + Math.sin(a) * RING_RADIUS,
        };
        if (!sim.nav || sim.nav.walkable(at.x, at.z)) {
          trap(unit, at, 'killingGround', root);
        }
      }
    });
  },
};

const CELL_BUILDUP = 20;
const CELL_STUN = 1;

/** Each strike adds 20 Shock buildup. An enemy that becomes Shocked in the field is stunned. */
const stormCell: Partial<Skill> = {
  release(u, target) {
    if (target) {
      plantRod(u, target, {
        buildup: [{ status: SHOCK, amount: CELL_BUILDUP }],
        after: (e, wasShocked) => {
          if (!wasShocked && e.statuses.has(SHOCK.id)) {
            e.addStatus(STUN, u, CELL_STUN);
          }
        },
      });
    }
  },
};

const BURST_RATIO = 150;
const BURST_BUILDUP = 40;

/** When a rod's field ends it bursts on every enemy inside. */
const OVERCHARGE: Passive = {
  id: 'overcharge',
  setup: (unit) => {
    const rods = new Set<Zone>();
    return listen(unit.sim, SimEvents.Tick, EventPriority.Post, () => {
      const { sim } = unit;
      for (const zone of sim.zones) {
        if (ownZone(unit, zone, 'lightningRod')) {
          rods.add(zone);
        }
      }
      for (const zone of rods) {
        if (sim.zones.includes(zone)) {
          continue;
        }
        rods.delete(zone);
        // Only a field that ran out bursts, not one cleared with the stage
        if (zone.life > 0 || !unit.alive) {
          continue;
        }
        for (const e of around(sim, zone, zone.r, unit)) {
          strike(unit, e, {
            range: Range.Ranged,
            element: Element.Storm,
            ratio: BURST_RATIO,
            flags: DamageFlags.Skill | DamageFlags.AoE,
            buildup: [{ status: SHOCK, amount: BURST_BUILDUP }],
          });
        }
      }
    });
  },
};

// ---------- Aimed Shot ----------

/** Aimed Shot also roots the target. */
const pinDown: Partial<Skill> = {
  release(u, target, sim) {
    aimedArrow(u, target, sim, {
      onHit: (hit) => {
        hit.addStatus(ROOTED, u, pinTime(rankOf(u, 'aimedShot')));
      },
    });
  },
};

const EAGLE_REACH = 3;

/** Aimed Shot reaches 3 tiles further. */
const eagleEye: Partial<Skill> = {
  wants: (u, target) => target !== null && u.distanceTo(target) <= u.kit.reach + EAGLE_REACH,
};

const KILLSHOT_MULTIPLIER = 2;

/** A shot at an enemy that has not noticed the party is a critical at double damage. */
const killshot: Partial<Skill> = {
  release(u, target, sim) {
    const unseen = target !== null && !target.aware;
    aimedArrow(
      u,
      target,
      sim,
      unseen ? { ratio: KILLSHOT_MULTIPLIER, flags: DamageFlags.Critical } : {},
    );
  },
};

/** Aimed Shot at an enemy that has not noticed the party needs no windup. */
const KILLSHOT_QUICK: Passive = {
  id: 'killshotQuick',
  setup: (unit) =>
    listen(unit.sim, SimEvents.UnitSkillWindup, EventPriority.Post, (event) => {
      const { cast } = unit;
      if (
        event.source === unit &&
        event.skill.id === AIMED_SHOT.id &&
        event.target &&
        !event.target.aware &&
        cast?.skill === event.skill
      ) {
        // Just short of the release, so the next step looses it
        cast.t = event.skill.windup - 1e-6;
      }
    }),
};

// ---------- Charged Arrow ----------

const VOLLEY_ARROWS = 3;
const VOLLEY_SPREAD = 4;
const VOLLEY_RATIO = 70;

/** Charged Arrow looses 3 arrows at different enemies, each chaining once. */
const arcVolley: Partial<Skill> = {
  release(u, target, sim) {
    if (!target?.alive) {
      return;
    }
    const others = around(sim, target, VOLLEY_SPREAD, u)
      .filter((e) => e !== target && e.aware)
      .sort((a, b) => a.distanceTo(target) - b.distanceTo(target))
      .slice(0, VOLLEY_ARROWS - 1);
    for (const e of [target, ...others]) {
      stormArrow(u, e, 'chargedArrow', {
        range: Range.Ranged,
        element: Element.Storm,
        ratio: VOLLEY_RATIO,
        flags: DamageFlags.Skill | DamageFlags.Projectile,
      });
    }
  },
};

const THUNDER_REACH = 6;
const THUNDER_RATIO = 60;

/** When the Ranger Shocks an enemy, lightning leaps to every other enemy within 6 tiles that carries Shock. */
const THUNDERHEAD: Passive = {
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
        event.status.source !== unit ||
        !unit.alive
      ) {
        return;
      }
      for (const e of around(sim, from, THUNDER_REACH, unit)) {
        const charged = e.statuses.has(SHOCK.id) || (e.buildup.get(SHOCK.id) ?? 0) > 0;
        if (e === from || !charged || sim.time - (leapt.get(e) ?? -Infinity) < 1) {
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

/** Charged Arrow does not chain: it pierces every enemy in its line. */
const piercingArrow: Partial<Skill> = {
  elite: (u, target) => target !== null && inLineOf(u, target).some(isElite),
  release(u, target) {
    if (target) {
      pierceArrow(u, target, 'chargedArrow', pierceRatio(rankOf(u, 'chargedArrow')), Element.Storm);
    }
  },
};

const RANGER_UPGRADES: Upgrade[] = [
  {
    id: 'rearguard',
    spell: 'snare',
    name: 'Rearguard',
    describe: () =>
      `Also lays a snare where the bearer stood ${TRAIL} seconds ago. In a fight, it lays one by itself every ${REARGUARD_EVERY} seconds. ${REARGUARD_TRAPS} at a time.`,
    patch: rearguard,
    effect: REARGUARD,
  },
  {
    id: 'bait',
    spell: 'snare',
    name: 'Bait',
    describe: (rank) =>
      `Becomes a decoy placed past the nearest threat for ${baitTime(rank)} seconds. Monsters within ${BAIT_LURE} tiles go to it. Bosses ignore it.`,
    patch: bait,
  },
  {
    id: 'spikeField',
    spell: 'snare',
    name: 'Spike Field',
    describe: () =>
      `Becomes a ${SPIKE_RADIUS}-tile field for ${SPIKE_TIME} seconds. It slows by half and bleeds 1% of max health a second. It does not root.`,
    patch: spikeField,
  },
  {
    id: 'killingGround',
    spell: 'lightningRod',
    name: 'Killing Ground',
    describe: () =>
      `When the bearer shouts Hold, the rod is planted on the Hold point at once and ringed with ${RING_TRAPS} snares.`,
    effect: KILLING_GROUND,
  },
  {
    id: 'stormCell',
    spell: 'lightningRod',
    name: 'Storm Cell',
    describe: () =>
      `Each strike adds ${CELL_BUILDUP} Shock buildup. An enemy that becomes Shocked in the field is stunned for ${CELL_STUN} second.`,
    patch: stormCell,
  },
  {
    id: 'overcharge',
    spell: 'lightningRod',
    name: 'Overcharge',
    describe: () =>
      `When the field ends it bursts for ${BURST_RATIO}% damage and ${BURST_BUILDUP} Shock buildup on every enemy inside.`,
    effect: OVERCHARGE,
  },
  {
    id: 'pinDown',
    spell: 'aimedShot',
    name: 'Pin Down',
    describe: (rank) =>
      `Also roots the target for ${pinTime(rank)} seconds. It grounds a flyer once flyers exist.`,
    patch: pinDown,
  },
  {
    id: 'eagleEye',
    spell: 'aimedShot',
    name: 'Eagle Eye',
    describe: () => `+${EAGLE_REACH} tiles of reach. It never misses a flyer, once flyers exist.`,
    patch: eagleEye,
  },
  {
    id: 'killshot',
    spell: 'aimedShot',
    name: 'Killshot',
    describe: () =>
      'A shot at an enemy that had not noticed the party is a critical at double damage and needs no windup.',
    patch: killshot,
    effect: KILLSHOT_QUICK,
  },
  {
    id: 'arcVolley',
    spell: 'chargedArrow',
    name: 'Arc Volley',
    describe: () =>
      `Fires ${VOLLEY_ARROWS} arrows at different enemies, ${VOLLEY_RATIO}% damage each. Each chains once.`,
    patch: arcVolley,
  },
  {
    id: 'thunderhead',
    spell: 'chargedArrow',
    name: 'Thunderhead',
    describe: () =>
      `A Shocked target sends a bolt to every Shocked enemy within ${THUNDER_REACH} tiles for ${THUNDER_RATIO}% Storm damage.`,
    effect: THUNDERHEAD,
  },
  {
    id: 'piercingArrow',
    spell: 'chargedArrow',
    name: 'Piercing Arrow',
    describe: (rank) =>
      `Does not chain. Hits every enemy in a line for ${pierceRatio(rank)}% damage.`,
    patch: piercingArrow,
  },
];

export default RANGER_UPGRADES;
