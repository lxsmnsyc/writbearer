import { describe, expect, it } from 'vitest';
import {
  ARC_VOLLEY,
  BAIT,
  KILLING_GROUND,
  KILLSHOT,
  LIGHTNING_ROD,
  REARGUARD,
  SPIKE_FIELD,
  THUNDERHEAD,
} from '../../src/content/ranger';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { SimEvents } from '../../src/sim/events';
import { Shout, cry } from '../../src/sim/shout';
import Sim, { ARROW_SPEED } from '../../src/sim/sim';
import { BLEED, SHOCK, SLOWED } from '../../src/sim/statuses';
import { DamageFlags, DamagePriority, Range, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { setRank, teach } from '../support/build';

// The Ranger's spells, and the skill code its elite upgrades will use.
// Cases of skills that are now upgrade placeholders are skipped until
// ranger-upgrades builds them (src/content/jobs/ranger/upgrades.ts).

// Every blow lands, so the tests do not hang on the roll.
const alwaysHit = (sim: Sim): void => {
  sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
    event.hit = true;
  });
};

const still = (...units: Unit[]): void => {
  for (const u of units) {
    u.kit.moveSpeed = 0;
  }
};

describe('the Ranger', () => {
  it.skip('Killshot doubles the first arrow at an enemy that has not noticed the party', () => {
    const sim = new Sim(3);
    alwaysHit(sim);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 0);
    const a = spawnMonster(sim, 'hollowSoldier', 5, 6, 0);
    const b = spawnMonster(sim, 'hollowSoldier', 5, 6, 3);
    const flags: number[] = [];
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      flags.push(event.flags);
    });
    teach(ranger, KILLSHOT);
    ranger.hit(b, { range: Range.Ranged, fixed: 40 });
    a.aware = false;
    sim.fire(ranger, a, { speed: ARROW_SPEED, homing: true, options: { range: Range.Ranged } });
    still(a, b);
    sim.run(1);
    expect(flags.at(-1)! & DamageFlags.Ambush).toBeTruthy();
    expect(flags.at(-1)! & DamageFlags.Critical).toBeTruthy();
    // Now it is awake: no second killshot.
    sim.fire(ranger, a, { speed: ARROW_SPEED, homing: true, options: { range: Range.Ranged } });
    sim.run(1);
    expect(flags.at(-1)! & DamageFlags.Ambush).toBeFalsy();
  });

  it.skip('Rearguard sets a snare where the bearer walked', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 1);
    spawnMonster(sim, 'hollowSoldier', 5, 9, 0).aware = true;
    teach(ranger, REARGUARD, 3);
    bearer.order = { x: 8, z: 0 };
    sim.run(7);
    const traps = sim.traps.filter((t) => t.skill === 'rearguard');
    expect(traps.length).toBeGreaterThan(0);
    expect(traps[0].x).toBeLessThan(bearer.x - 1);
  });

  it.skip('Bait draws monsters away from the party, but not a boss', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const ranger = spawnMerc(sim, 'ranger', 10, 1, 0);
    const a = spawnMonster(sim, 'hollowSoldier', 5, 4, 0);
    const b = spawnMonster(sim, 'hollowSoldier', 5, 4, 1);
    for (const m of [a, b]) {
      m.aware = true;
      m.target = bearer;
    }
    teach(ranger, BAIT, 2);
    expect(BAIT.wants(ranger, null, sim)).toBe(true);
    BAIT.release(ranger, null, sim);
    const bait = sim.zones[0];
    expect(bait.x).toBeGreaterThan(4);
    still(bearer, ranger);
    sim.run(2);
    expect(a.distanceTo(bait)).toBeLessThan(1);
    expect(bearer.hp).toBe(bearer.derived.maxHp);
  });

  it.skip('Spike Field slows and bleeds what stands in it', () => {
    const sim = new Sim(1);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 0);
    const a = spawnMonster(sim, 'hollowSoldier', 5, 5, 0);
    spawnMonster(sim, 'hollowSoldier', 5, 5, 1);
    still(a);
    teach(ranger, SPIKE_FIELD, 3);
    expect(SPIKE_FIELD.wants(ranger, a, sim)).toBe(true);
    SPIKE_FIELD.release(ranger, a, sim);
    sim.run(1.05);
    expect(a.statuses.has(SLOWED.id)).toBe(true);
    expect(a.statuses.get(BLEED.id)?.power).toBe(3);
    sim.run(2);
    expect(a.hp).toBeLessThan(a.derived.maxHp);
  });

  it.skip('Killing Ground rings the bearer with snares when it shouts Hold', () => {
    const sim = new Sim(1);
    spawnBearer(sim, 10, 10);
    const ranger = spawnMerc(sim, 'ranger', 10, 11, 10);
    teach(ranger, KILLING_GROUND);
    expect(cry(sim, Shout.Hold)).toBeNull();
    sim.run(2);
    expect(sim.traps.filter((t) => t.skill === 'killingGround')).toHaveLength(6);
  });

  it.skip('Arc Volley looses an arrow at each of three enemies', () => {
    const sim = new Sim(4);
    alwaysHit(sim);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 0);
    const foes = [0, 1.5, -1.5].map((z) => spawnMonster(sim, 'hollowSoldier', 5, 6, z));
    for (const f of foes) {
      f.aware = true;
    }
    still(...foes);
    teach(ranger, ARC_VOLLEY);
    expect(ranger.startCast(ARC_VOLLEY, foes[0])).toBe(true);
    sim.run(ARC_VOLLEY.windup + 1.5);
    for (const f of foes) {
      expect(f.hp).toBeLessThan(f.derived.maxHp);
    }
  });

  it('Lightning Rod strikes everything in its field each second', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 0);
    const a = spawnMonster(sim, 'hollowSoldier', 5, 5, 0);
    const b = spawnMonster(sim, 'hollowSoldier', 5, 5, 1.5);
    still(a, b);
    setRank(ranger, 'lightningRod', 2);
    LIGHTNING_ROD.release(ranger, a, sim);
    sim.run(3.05);
    expect(a.hp).toBeLessThan(a.derived.maxHp);
    expect(b.hp).toBeLessThan(b.derived.maxHp);
  });

  it.skip('Thunderhead leaps from one Shocked enemy to every other charged one', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 0);
    const first = spawnMonster(sim, 'hollowSoldier', 5, 5, 0);
    const charged = spawnMonster(sim, 'hollowSoldier', 5, 7, 0);
    const plain = spawnMonster(sim, 'hollowSoldier', 5, 6, 2);
    still(first, charged, plain);
    teach(ranger, THUNDERHEAD);
    charged.buildup.set(SHOCK.id, 10);
    first.addStatus(SHOCK, ranger);
    sim.run(0.5);
    expect(charged.hp).toBeLessThan(charged.derived.maxHp);
    expect(plain.hp).toBe(plain.derived.maxHp);
  });
});
