import { describe, expect, it } from 'vitest';
import { JOBS } from '../../src/content/jobs';
import { DUELING, beginDuel } from '../../src/content/jobs/duelist/spells';
import RANGER_UPGRADES from '../../src/content/jobs/ranger/upgrades';
import {
  AIMED_SHOT,
  CHARGED_ARROW,
  LIGHTNING_ROD,
  SNARE,
  chargedRatio,
  pierceRatio,
  pinTime,
  rodTime,
  snareTime,
} from '../../src/content/ranger';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { DEFAULT_TOGGLES, type Toggles } from '../../src/sim/ai';
import { type Upgrade, isBuilt } from '../../src/sim/builds';
import { SimEvents } from '../../src/sim/events';
import { Shout, cry } from '../../src/sim/shout';
import Sim from '../../src/sim/sim';
import { type Skill, SkillMode } from '../../src/sim/skill';
import { BLEED, ROOTED, SHOCK, SLOWED, STUN } from '../../src/sim/statuses';
import { canTarget } from '../../src/sim/targeting';
import { DamageFlags, DamagePriority, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { setRank, withUpgrade } from '../support/build';

// The Ranger's spells and its 12 elite upgrades.

const SPELLS = ['snare', 'lightningRod', 'aimedShot', 'chargedArrow'];

const upgrade = (id: string): Upgrade => {
  const found = RANGER_UPGRADES.find((u) => u.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
};

// Every blow lands, so the tests do not hang on the roll.
const alwaysHit = (sim: Sim): void => {
  sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
    event.hit = true;
  });
};

// Orders with every spell off, so only the casts a test starts happen
const quiet = (): Toggles => {
  const skills: Toggles['skills'] = {};
  for (const id of SPELLS) {
    skills[id] = SkillMode.Off;
  }
  return { ...DEFAULT_TOGGLES, skills };
};

// A still Ranger with an upgrade when one is named, and a bearer behind it
function rangerWith(id: string | null, seed = 3): { sim: Sim; ranger: Unit; bearer: Unit } {
  const sim = new Sim(seed);
  alwaysHit(sim);
  const bearer = spawnBearer(sim, -3, 0);
  bearer.kit.moveSpeed = 0;
  const ranger = spawnMerc(sim, 'ranger', 10, 0, 0, quiet());
  ranger.kit.interval = 0;
  ranger.kit.moveSpeed = 0;
  ranger.mana = ranger.derived.maxMana;
  if (id) {
    withUpgrade(ranger, upgrade(id));
  }
  return { sim, ranger, bearer };
}

// A still, awake, tough monster
function foe(sim: Sim, x: number, z: number, elite = false): Unit {
  const m = spawnMonster(sim, 'hollowSoldier', 3, x, z, { elite });
  m.aware = true;
  m.kit.moveSpeed = 0;
  m.kit.interval = 99;
  m.cooldown = 99;
  m.derived.maxHp = 100000;
  m.hp = 100000;
  return m;
}

// The spell as the unit casts it, with its upgrade
function spell(u: Unit, id: string): Skill {
  const found = u.skills.find((s) => s.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
}

// Casts a spell from start to release
function cast(sim: Sim, u: Unit, id: string, target: Unit | null, extra = 0.01): void {
  const s = spell(u, id);
  expect(u.startCast(s, target)).toBe(true);
  sim.run(s.windup + extra);
}

// The damage each unit takes from skills, by who
function damageTaken(sim: Sim): Map<Unit, number> {
  const taken = new Map<Unit, number>();
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (event.flags & DamageFlags.Skill) {
      taken.set(event.target, (taken.get(event.target) ?? 0) + event.value);
    }
  });
  return taken;
}

describe('the Ranger spells', () => {
  it('rank 10 is about the old rank 5: gains are halved', () => {
    expect(snareTime(10)).toBe(4);
    expect(rodTime(10)).toBe(10);
    expect(pinTime(10)).toBe(3.5);
    expect(chargedRatio(10)).toBe(170);
    expect(pierceRatio(10)).toBe(230);
    expect(AIMED_SHOT.describe(10)).toContain('350%');
    expect(CHARGED_ARROW.cooldown).toBe(3.5);
  });

  it('Lightning Rod strikes everything in its field each second', () => {
    const { sim, ranger } = rangerWith(null);
    const a = foe(sim, 5, 0);
    const b = foe(sim, 5, 1.5);
    setRank(ranger, 'lightningRod', 2);
    LIGHTNING_ROD.release(ranger, a, sim);
    sim.run(3.05);
    expect(a.hp).toBeLessThan(a.derived.maxHp);
    expect(b.hp).toBeLessThan(b.derived.maxHp);
  });

  it('Snare roots the enemy coming for the bearer', () => {
    const { sim, ranger, bearer } = rangerWith(null);
    const e = foe(sim, 2, 0);
    e.target = bearer;
    expect(SNARE.wants(ranger, null, sim)).toBe(true);
    SNARE.release(ranger, null, sim);
    expect(sim.traps.filter((t) => t.skill === 'snare')).toHaveLength(1);
  });
});

describe('the Ranger upgrades', () => {
  it('builds all 12, 3 for each spell', () => {
    expect(JOBS.ranger.upgrades).toBe(RANGER_UPGRADES);
    expect(RANGER_UPGRADES).toHaveLength(12);
    for (const id of SPELLS) {
      expect(RANGER_UPGRADES.filter((u) => u.spell === id)).toHaveLength(3);
    }
    for (const u of RANGER_UPGRADES) {
      expect(isBuilt(u), u.id).toBe(true);
    }
  });
});

describe('Snare upgrades', () => {
  it('Rearguard lays a snare where the bearer walked, with the cast and by itself', () => {
    const { sim, ranger, bearer } = rangerWith('rearguard');
    const e = foe(sim, 6, 0);
    e.target = bearer;
    e.kit.moveSpeed = 0;
    bearer.x = -8;
    sim.run(0.1);
    // The bearer walks 6 tiles on: its old spot is behind
    bearer.x = 0;
    sim.run(5.5);
    // By itself, in a fight
    expect(sim.traps.filter((t) => t.skill === 'rearguard').length).toBeGreaterThan(0);
    const spot = sim.traps.find((t) => t.skill === 'rearguard');
    expect(spot?.x).toBeLessThan(-5);
    // With the cast too, once the bearer has moved on again
    sim.traps.length = 0;
    bearer.x = 6;
    e.x = 10;
    cast(sim, ranger, 'snare', null);
    expect(sim.traps.some((t) => t.skill === 'snare')).toBe(true);
    expect(sim.traps.some((t) => t.skill === 'rearguard')).toBe(true);
  });

  it('Bait draws monsters away from the party, but not a boss', () => {
    const { sim, ranger, bearer } = rangerWith('bait');
    const a = foe(sim, 3, 0);
    const b = foe(sim, 3, 1);
    a.kit.moveSpeed = 2.7;
    b.kit.moveSpeed = 2.7;
    for (const m of [a, b]) {
      m.target = bearer;
    }
    const boss = spawnMonster(sim, 'hollowSoldier', 3, 3, -1);
    boss.aware = true;
    boss.target = bearer;
    expect(spell(ranger, 'snare').wants(ranger, null, sim)).toBe(true);
    cast(sim, ranger, 'snare', null);
    const decoy = sim.zones.find((z) => z.kind === 'bait');
    expect(decoy?.x).toBeGreaterThan(3);
    // It replaces the snare
    expect(sim.traps).toHaveLength(0);
    sim.run(2);
    expect(a.distanceTo(decoy!)).toBeLessThan(1);
    expect(bearer.hp).toBe(bearer.derived.maxHp);
  });

  it('Spike Field slows and bleeds what stands in it, and does not root', () => {
    const { sim, ranger, bearer } = rangerWith('spikeField');
    const a = foe(sim, 2, 0);
    a.target = bearer;
    cast(sim, ranger, 'snare', null);
    expect(sim.traps).toHaveLength(0);
    expect(sim.zones.find((z) => z.kind === 'spikeField')?.r).toBe(2);
    sim.run(1.1);
    expect(a.statuses.has(SLOWED.id)).toBe(true);
    expect(a.statuses.has(ROOTED.id)).toBe(false);
    expect(a.statuses.get(BLEED.id)?.power).toBe(1);
    sim.run(2);
    expect(a.hp).toBeLessThan(a.derived.maxHp);
  });
});

describe('Lightning Rod upgrades', () => {
  it('Killing Ground plants the rod on the Hold point and rings it with 6 snares', () => {
    const { sim, bearer } = rangerWith('killingGround');
    bearer.x = 10;
    bearer.z = 10;
    foe(sim, 30, 30);
    expect(cry(sim, Shout.Hold)).toBeNull();
    sim.run(2);
    expect(sim.traps.filter((t) => t.skill === 'killingGround')).toHaveLength(6);
    const rod = sim.zones.find((z) => z.kind === 'lightningRod');
    expect(rod?.x).toBe(10);
    expect(rod?.z).toBe(10);
  });

  it('Storm Cell adds Shock buildup and stuns an enemy that becomes Shocked', () => {
    const { sim, ranger } = rangerWith('stormCell');
    const a = foe(sim, 5, 0);
    foe(sim, 5, 1);
    a.buildup.set(SHOCK.id, 95);
    setRank(ranger, 'lightningRod', 3);
    cast(sim, ranger, 'lightningRod', a);
    sim.run(1.1);
    expect(a.statuses.has(SHOCK.id)).toBe(true);
    expect(a.statuses.has(STUN.id)).toBe(true);
  });

  it('Overcharge bursts for 150% and 40 Shock buildup when the field ends', () => {
    const { sim, ranger } = rangerWith('overcharge');
    const a = foe(sim, 5, 0);
    const far = foe(sim, 20, 0);
    const taken = damageTaken(sim);
    const added: number[] = [];
    sim.on(SimEvents.CheckBuildup, ValuePriority.Post, (event) => {
      if (event.status === SHOCK && event.target === a) {
        added.push(event.value);
      }
    });
    setRank(ranger, 'lightningRod', 1);
    cast(sim, ranger, 'lightningRod', a);
    // Past the last strike, before the end
    sim.run(rodTime(1) - 0.7);
    const before = taken.get(a) ?? 0;
    added.length = 0;
    sim.run(1.5);
    expect(sim.zones.some((z) => z.kind === 'lightningRod')).toBe(false);
    expect(taken.get(a) ?? 0).toBeGreaterThan(before);
    expect(Math.max(...added)).toBeGreaterThanOrEqual(40);
    expect(taken.get(far) ?? 0).toBe(0);
  });
});

describe('Aimed Shot upgrades', () => {
  it('Pin Down also roots the target', () => {
    const { sim, ranger } = rangerWith('pinDown');
    const a = foe(sim, 5, 0);
    cast(sim, ranger, 'aimedShot', a, 0.5);
    expect(a.statuses.has(ROOTED.id)).toBe(true);
    expect(a.hp).toBeLessThan(a.derived.maxHp);
  });

  it('Eagle Eye lets it fire 3 tiles further out', () => {
    const plain = rangerWith(null);
    const far = foe(plain.sim, plain.ranger.kit.reach + 2, 0);
    expect(spell(plain.ranger, 'aimedShot').wants(plain.ranger, far, plain.sim)).toBe(false);
    const { sim, ranger } = rangerWith('eagleEye');
    const e = foe(sim, ranger.kit.reach + 2, 0);
    expect(spell(ranger, 'aimedShot').wants(ranger, e, sim)).toBe(true);
    cast(sim, ranger, 'aimedShot', e, 1.5);
    expect(e.hp).toBeLessThan(e.derived.maxHp);
  });

  it('Killshot makes a shot at an unaware enemy a double critical with no windup', () => {
    const shot = (id: string | null, aware: boolean): { dealt: number; ms: number } => {
      const { sim, ranger } = rangerWith(id);
      const e = foe(sim, 5, 0);
      e.aware = aware;
      const taken = damageTaken(sim);
      expect(ranger.startCast(spell(ranger, 'aimedShot'), e)).toBe(true);
      let t = 0;
      while (!taken.has(e) && t < 4) {
        sim.tick();
        t += 1 / 20;
      }
      return { dealt: taken.get(e) ?? 0, ms: t };
    };
    const plain = shot(null, false);
    const killshot = shot('killshot', false);
    const aware = shot('killshot', true);
    expect(killshot.dealt).toBeGreaterThan(plain.dealt * 2);
    expect(killshot.ms).toBeLessThan(plain.ms - 0.5);
    // Once the enemy is awake, it is an ordinary shot
    expect(aware.dealt).toBeCloseTo(plain.dealt, 0);
    expect(aware.ms).toBeGreaterThan(1);
  });
});

describe('Charged Arrow upgrades', () => {
  it('Arc Volley looses an arrow at each of three enemies', () => {
    const { sim, ranger } = rangerWith('arcVolley');
    const foes = [0, 1.5, -1.5].map((z) => foe(sim, 6, z));
    cast(sim, ranger, 'chargedArrow', foes[0], 1.5);
    for (const f of foes) {
      expect(f.hp).toBeLessThan(f.derived.maxHp);
    }
  });

  it('Thunderhead leaps from one Shocked enemy to every other charged one', () => {
    const { sim, ranger } = rangerWith('thunderhead');
    const first = foe(sim, 5, 0);
    const charged = foe(sim, 7, 0);
    const plain = foe(sim, 6, 2);
    charged.buildup.set(SHOCK.id, 10);
    first.addStatus(SHOCK, ranger);
    sim.run(0.5);
    expect(charged.hp).toBeLessThan(charged.derived.maxHp);
    expect(plain.hp).toBe(plain.derived.maxHp);
  });

  it('Piercing Arrow hits every enemy in a line and does not chain', () => {
    const { sim, ranger } = rangerWith('piercingArrow');
    const first = foe(sim, 3, 0);
    const second = foe(sim, 5, 0.2);
    const aside = foe(sim, 4, 2);
    cast(sim, ranger, 'chargedArrow', first, 1.5);
    expect(first.hp).toBeLessThan(first.derived.maxHp);
    expect(second.hp).toBeLessThan(second.derived.maxHp);
    expect(aside.hp).toBe(aside.derived.maxHp);
  });

  it('Piercing Arrow skips an elite dueled by a Duelist', () => {
    const { sim, ranger } = rangerWith('piercingArrow');
    const duelist = spawnMerc(sim, 'duelist', 10, 4, 3);
    const first = foe(sim, 3, 0);
    const dueled = foe(sim, 5, 0.1, true);
    const behind = foe(sim, 7, 0);
    expect(beginDuel(duelist, dueled, 10)).toBe(true);
    expect(dueled.statuses.has(DUELING.id)).toBe(true);
    expect(canTarget(ranger, dueled)).toBe(false);
    cast(sim, ranger, 'chargedArrow', first, 1.5);
    expect(first.hp).toBeLessThan(first.derived.maxHp);
    expect(behind.hp).toBeLessThan(behind.derived.maxHp);
    expect(dueled.hp).toBe(dueled.derived.maxHp);
  });

  it('Arc Volley and Rearguard leave a dueled elite alone', () => {
    const { sim, ranger } = rangerWith('arcVolley');
    const duelist = spawnMerc(sim, 'duelist', 10, 4, 3);
    const first = foe(sim, 6, 0);
    const dueled = foe(sim, 6, 1, true);
    beginDuel(duelist, dueled, 10);
    cast(sim, ranger, 'chargedArrow', first, 1.5);
    expect(first.hp).toBeLessThan(first.derived.maxHp);
    expect(dueled.hp).toBe(dueled.derived.maxHp);
  });
});
