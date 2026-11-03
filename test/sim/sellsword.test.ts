import { describe, expect, it } from 'vitest';
import { JOBS } from '../../src/content/jobs';
import {
  CLEAVE,
  CLEAVE_TARGETS,
  HAMSTRING,
  HAMSTRUNG,
  POCKET_SAND,
  RUSH,
  SECOND_WIND,
  cleaveRatio,
  hamstringRatio,
  rushStun,
  sandBlind,
} from '../../src/content/jobs/sellsword/spells';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { DEFAULT_TOGGLES, type Toggles } from '../../src/sim/ai';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { SkillMode } from '../../src/sim/skill';
import { BLIND, STUN } from '../../src/sim/statuses';
import {
  DamageFlags,
  DamageKind,
  DamagePriority,
  HealPriority,
  Side,
  ValuePriority,
} from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

// The Sellsword: Rush, Pocket Sand, Hamstring, Cleave and the innate Second Wind.

// Every blow lands.
const alwaysHit = (sim: Sim): void => {
  sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
    event.hit = true;
  });
};

// The hits `source` lands, as they land
function record(sim: Sim, source: Unit): { ratio: number; flags: number; target: Unit }[] {
  const hits: { ratio: number; flags: number; target: Unit }[] = [];
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (event.source === source) {
      hits.push({ ratio: event.ratio, flags: event.flags, target: event.target });
    }
  });
  return hits;
}

// Orders with every spell off
function quiet(): Toggles {
  const skills: Toggles['skills'] = {};
  for (const id of ['rush', 'pocketSand', 'hamstring', 'cleave']) {
    skills[id] = SkillMode.Off;
  }
  return { ...DEFAULT_TOGGLES, skills };
}

// A Sellsword that does not move or swing, and a still soldier at `x`
function setup(seed: number, x: number, z = 0): { sim: Sim; sword: Unit; foe: Unit } {
  const sim = new Sim(seed);
  alwaysHit(sim);
  spawnBearer(sim, 0, 0);
  const sword = spawnMerc(sim, 'sellsword', 8, 0, 0, quiet());
  sword.kit.interval = 99;
  sword.kit.moveSpeed = 0;
  const foe = spawnMonster(sim, 'hollowSoldier', 8, x, z);
  foe.kit.moveSpeed = 2;
  foe.kit.interval = 99;
  foe.aware = true;
  return { sim, sword, foe };
}

describe('the Sellsword job', () => {
  it('has 4 spells in cast order and Second Wind, and is not offered yet', () => {
    const def = JOBS.sellsword;
    expect(def.spells.map((s) => s.id)).toEqual(['rush', 'pocketSand', 'hamstring', 'cleave']);
    expect(def.innate.effect).toBe(SECOND_WIND);
    expect(def.hireable).toBe(false);
    expect(def.role).toBe('striker');
  });

  it('wins a headless fight alongside the bearer', () => {
    const sim = new Sim(5);
    const bearer = spawnBearer(sim, 0, 0);
    const sword = spawnMerc(sim, 'sellsword', 5, 1, 0);
    for (const x of [3, 4]) {
      spawnMonster(sim, 'hollowSoldier', 3, x, 0.5).aware = true;
    }
    expect(sword.spells).toHaveLength(4);
    sim.run(60, () => !bearer.alive || sim.living(Side.Monster).length === 0);
    expect(sim.living(Side.Monster)).toHaveLength(0);
    expect(sword.alive).toBe(true);
  });
});

describe('Rush', () => {
  it('charges the enemy attacking the bearer, hits it and builds stun', () => {
    const { sim, sword, foe } = setup(1, 0.5, 3.5);
    const hits = record(sim, sword);
    foe.target = sim.bearer;
    sword.x = 3;
    sword.z = -1;
    expect(RUSH.aim?.(sword, sim)).toBe(foe);
    expect(sword.startCast(RUSH, foe)).toBe(true);
    sim.run(RUSH.windup + 0.02);
    expect(sword.distanceTo(foe)).toBeLessThanOrEqual(sword.kit.reach);
    expect(hits.some((h) => h.target === foe && h.flags & DamageFlags.Skill)).toBe(true);
    expect(foe.buildup.get(STUN.id) ?? 0).toBeGreaterThan(0);
    expect(rushStun(1)).toBe(44);
    expect(rushStun(5)).toBe(60);
  });

  it('picks nobody when no enemy is after the bearer', () => {
    const { sim, sword, foe } = setup(3, 2, 1);
    foe.target = sword;
    expect(RUSH.aim?.(sword, sim)).toBeNull();
    foe.target = sim.bearer;
    expect(RUSH.aim?.(sword, sim)).toBe(foe);
  });
});

describe('Pocket Sand', () => {
  it('builds blind in a cone and leaves those behind alone', () => {
    const { sim, sword, foe } = setup(2, 2, 0);
    const beside = spawnMonster(sim, 'hollowSoldier', 8, 2, 0.8);
    const behind = spawnMonster(sim, 'hollowSoldier', 8, -2, 0);
    beside.aware = true;
    behind.aware = true;
    expect(sword.startCast(POCKET_SAND, foe)).toBe(true);
    sim.run(POCKET_SAND.windup + 0.02);
    expect(foe.buildup.get(BLIND.id) ?? 0).toBeGreaterThan(0);
    expect(beside.buildup.get(BLIND.id) ?? 0).toBeGreaterThan(0);
    expect(behind.buildup.get(BLIND.id) ?? 0).toBe(0);
    expect(sandBlind(1)).toBe(45);
  });

  it('blinds once the buildup is full', () => {
    const { sim, sword, foe } = setup(2, 2, 0);
    sword.skillRanks.set('pocketSand', 10);
    expect(sandBlind(10)).toBe(90);
    for (let i = 0; i < 4 && !foe.statuses.has(BLIND.id); i++) {
      sword.skillCooldowns.clear();
      sword.mana = 100;
      sword.startCast(POCKET_SAND, foe);
      sim.run(POCKET_SAND.windup + 0.3);
    }
    expect(foe.statuses.has(BLIND.id)).toBe(true);
  });
});

describe('Hamstring', () => {
  it('hits for 110% plus 8% a rank and slows the target', () => {
    const { sim, sword, foe } = setup(2, 1);
    const hits = record(sim, sword);
    const fast = foe.speed;
    expect(sword.startCast(HAMSTRING, foe)).toBe(true);
    sim.run(HAMSTRING.windup + 0.02);
    expect(hits.find((h) => h.flags & DamageFlags.Skill)?.ratio).toBe(hamstringRatio(1));
    expect(hamstringRatio(5)).toBe(150);
    expect(foe.statuses.has(HAMSTRUNG.id)).toBe(true);
    expect(foe.speed).toBeLessThan(fast);
  });

  it('wears off after 3 seconds', () => {
    const { sim, sword, foe } = setup(2, 1);
    sword.startCast(HAMSTRING, foe);
    sim.run(HAMSTRING.windup + 0.1);
    expect(foe.statuses.has(HAMSTRUNG.id)).toBe(true);
    sim.run(3.2);
    expect(foe.statuses.has(HAMSTRUNG.id)).toBe(false);
  });
});

describe('Cleave', () => {
  it('hits up to 3 enemies in the front arc, and none behind', () => {
    const { sim, sword, foe } = setup(2, 1);
    const crowd = [
      spawnMonster(sim, 'hollowSoldier', 8, 1, 0.5),
      spawnMonster(sim, 'hollowSoldier', 8, 1, -0.5),
      spawnMonster(sim, 'hollowSoldier', 8, 0.9, 0.2),
    ];
    const behind = spawnMonster(sim, 'hollowSoldier', 8, -0.9, 0);
    for (const e of [...crowd, behind]) {
      e.aware = true;
    }
    const hits = record(sim, sword);
    expect(sword.startCast(CLEAVE, foe)).toBe(true);
    sim.run(CLEAVE.windup + 0.02);
    const struck = hits.filter((h) => h.flags & DamageFlags.Skill);
    expect(struck).toHaveLength(CLEAVE_TARGETS);
    expect(struck[0].target).toBe(foe);
    expect(struck.every((h) => h.ratio === cleaveRatio(1))).toBe(true);
    expect(struck.some((h) => h.target === behind)).toBe(false);
    expect(cleaveRatio(10)).toBe(180);
  });

  it('is a plain single hit with one enemy near', () => {
    const { sim, sword, foe } = setup(2, 1);
    const hits = record(sim, sword);
    sword.startCast(CLEAVE, foe);
    sim.run(CLEAVE.windup + 0.02);
    expect(hits.filter((h) => h.flags & DamageFlags.Skill)).toHaveLength(1);
  });

  it('spares a unit that CheckTarget forbids, as a Duel bond does', () => {
    const { sim, sword, foe } = setup(2, 1);
    const other = spawnMonster(sim, 'hollowSoldier', 8, 1, 0.4);
    other.aware = true;
    sim.on(SimEvents.CheckTarget, ValuePriority.Post, (event) => {
      if (event.target === other) {
        event.allowed = false;
      }
    });
    const hits = record(sim, sword);
    sword.startCast(CLEAVE, foe);
    sim.run(CLEAVE.windup + 0.02);
    expect(hits.some((h) => h.target === other)).toBe(false);
  });
});

describe('Second Wind', () => {
  it('heals 20% of max health once, when a blow leaves it at 30% or less', () => {
    const sim = new Sim(1);
    spawnBearer(sim, 0, 0);
    const sword = spawnMerc(sim, 'sellsword', 8, 1, 0, quiet());
    const foe = spawnMonster(sim, 'hollowSoldier', 8, 6, 0);
    const max = sword.derived.maxHp;
    const healed: number[] = [];
    sim.on(SimEvents.UnitHeal, HealPriority.Post, (event) => {
      if (event.target === sword) {
        healed.push(event.value);
      }
    });
    const blow = (): void => {
      foe.hit(sword, { kind: DamageKind.True, fixed: 1 });
    };
    // A blow that leaves it well above 30% does nothing.
    sword.hp = Math.floor(max * 0.6);
    blow();
    expect(healed).toEqual([]);
    sword.hp = Math.floor(max * 0.3);
    blow();
    expect(healed).toEqual([Math.floor(max * 0.2)]);
    // A second time in the same stage does nothing.
    sword.hp = Math.floor(max * 0.2);
    blow();
    expect(healed).toHaveLength(1);
  });
});
