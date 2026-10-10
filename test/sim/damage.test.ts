import { describe, expect, it } from 'vitest';
import { EventPriority } from '../../src/core/event-emitter';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { type BaseStats, Category, type Job, deriveStats } from '../../src/sim/stats';
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
} from '../../src/sim/types';
import Unit, { type UnitSpec } from '../../src/sim/unit';

const JOB: Job = {
  name: 'Test',
  baseHp: 1000,
  hpPerLevel: 0,
  baseMana: 50,
  manaPerLevel: 0,
  range: Range.Melee,
};
const ZERO: BaseStats = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, wil: 0 };

// A level 1 unit with no stats and a 100 damage weapon, so results are exact.
function unit(sim: Sim, spec: Partial<UnitSpec> = {}): Unit {
  return sim.add(
    new Unit(sim, {
      name: 'Unit',
      side: Side.Party,
      job: JOB,
      level: 1,
      base: ZERO,
      weapon: { min: 100, max: 100, matk: 0 },
      ...spec,
    }),
  );
}

// Overrides the hit and crit rolls, after the mechanic made them.
function force(sim: Sim, hit: boolean, critical = false): void {
  sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
    event.hit = hit;
    event.critical = critical;
  });
}

function setup(): { sim: Sim; a: Unit; b: Unit } {
  const sim = new Sim(1);
  force(sim, true);
  return { sim, a: unit(sim), b: unit(sim, { side: Side.Monster }) };
}

describe('Initial', () => {
  it('rolls weapon damage plus status attack for melee', () => {
    const { sim, b } = setup();
    const a = unit(sim, { base: { ...ZERO, str: 10, dex: 10 } });
    // 100 + 10 * 2 + 10 / 5
    expect(a.hit(b)?.value).toBe(122);
    expect(b.hp).toBe(1000 - 122);
  });

  it('scales ranged attacks with DEX', () => {
    const { sim, b } = setup();
    const a = unit(sim, {
      job: { ...JOB, range: Range.Ranged },
      base: { ...ZERO, str: 10, dex: 10 },
    });
    // 100 + 10 * 2 + 10 / 5, with the stats swapped
    expect(a.hit(b)?.value).toBe(122);
    const strong = unit(sim, { job: { ...JOB, range: Range.Ranged }, base: { ...ZERO, str: 20 } });
    expect(strong.hit(b)?.value).toBe(104);
  });

  it('rolls magic from INT and the weapon', () => {
    const { sim, b } = setup();
    const a = unit(sim, { base: { ...ZERO, int: 20 }, weapon: { min: 0, max: 0, matk: 0 } });
    expect(a.hit(b, { kind: DamageKind.Magical })?.value).toBe(30);
  });

  it('rolls within the weapon range, the same way for the same seed', () => {
    const rolls = (): number[] => {
      const sim = new Sim(77);
      force(sim, true);
      const a = unit(sim, { weapon: { min: 50, max: 150, matk: 0 } });
      const b = unit(sim, { modifiers: [{ stat: 'maxHp', add: 1_000_000 }] });
      return Array.from({ length: 20 }, () => a.hit(b)?.value ?? -1);
    };
    const first = rolls();
    for (const v of first) {
      expect(v).toBeGreaterThanOrEqual(50);
      expect(v).toBeLessThanOrEqual(150);
    }
    expect(rolls()).toEqual(first);
  });
});

describe('skill ratio and flat bonus', () => {
  it('applies the percent, then the flat bonus', () => {
    const { a, b } = setup();
    expect(a.hit(b, { ratio: 250, flat: 30 })?.value).toBe(280);
  });
});

describe('Amplify and Reduce', () => {
  it('adds bonuses in one category and multiplies across categories', () => {
    const { sim, b } = setup();
    b.race = Race.Undead;
    b.rank = Rank.Elite;
    const a = unit(sim, {
      modifiers: [
        { amplify: Category.Race, key: Race.Undead, percent: 20 },
        { amplify: Category.Race, key: Race.Undead, percent: 15 },
        { amplify: Category.Rank, key: Rank.Elite, percent: 10 },
      ],
    });
    // 100 * 1.35 * 1.10
    expect(a.hit(b)?.value).toBe(148);
  });

  it("reduces by the target's categories", () => {
    const { sim, a } = setup();
    a.attackElement = Element.Fire;
    const b = unit(sim, {
      side: Side.Monster,
      modifiers: [
        { reduce: Category.AttackElement, key: Element.Fire, percent: 25 },
        { reduce: Category.AttackRange, key: Range.Melee, percent: 10 },
      ],
    });
    // 100 * 0.75 * 0.90
    expect(a.hit(b)?.value).toBe(67);
  });
});

describe('Defense', () => {
  it('reduces physical damage by armor with diminishing returns', () => {
    const { sim, a } = setup();
    const b = unit(sim, { modifiers: [{ stat: 'armor', add: 100 }] });
    // 100 * 4100 / 5000
    expect(a.hit(b)?.value).toBe(82);
  });

  it('never reduces more than 90% through armor', () => {
    const { sim, a } = setup();
    const b = unit(sim, { modifiers: [{ stat: 'armor', add: 1_000_000 }] });
    expect(a.hit(b, { ratio: 1000 })?.value).toBe(100);
  });

  it('subtracts soft defense after hard defense', () => {
    const { sim, a } = setup();
    // VIT 20 at level 1: 20 / 2 + 1 / 2, rounded down
    const b = unit(sim, { base: { ...ZERO, vit: 20 } });
    expect(a.hit(b)?.value).toBe(90);
  });

  it('reduces magical damage by resistance', () => {
    const { sim } = setup();
    const a = unit(sim, { base: { ...ZERO, int: 20 }, weapon: { min: 0, max: 0, matk: 0 } });
    const b = unit(sim, { modifiers: [{ stat: 'resistance', add: 100 }] });
    // 30 * 1100 / 2000
    expect(a.hit(b, { kind: DamageKind.Magical })?.value).toBe(16);
  });

  it('skips hard defense on Pierce, but not soft defense', () => {
    const { sim, a } = setup();
    const b = unit(sim, { base: { ...ZERO, vit: 20 }, modifiers: [{ stat: 'armor', add: 100 }] });
    expect(a.hit(b, { flags: DamageFlags.Pierce })?.value).toBe(90);
  });
});

describe('Element', () => {
  it('uses the attack element against the defense element and level', () => {
    const { sim, a } = setup();
    a.attackElement = Element.Fire;
    const earth = unit(sim, { element: Element.Earth, elementLevel: 1 });
    expect(a.hit(earth)?.value).toBe(150);
    const frost = unit(sim);
    const fire3 = unit(sim, { element: Element.Fire, elementLevel: 3 });
    frost.attackElement = Element.Frost;
    expect(frost.hit(fire3)?.value).toBe(200);
  });

  it('lets Spectral resist Neutral more at higher levels', () => {
    const { sim, a } = setup();
    const ghost = unit(sim, { element: Element.Spectral, elementLevel: 3 });
    expect(a.hit(ghost)?.value).toBe(50);
  });

  it('can make an element useless against itself', () => {
    const { sim, a } = setup();
    a.attackElement = Element.Fire;
    const fire2 = unit(sim, { element: Element.Fire, elementLevel: 2 });
    expect(a.hit(fire2)?.value).toBe(0);
  });
});

describe('hit check', () => {
  it('uses 80 + accuracy - evasion, from rAthena', () => {
    const sim = new Sim(1);
    let chance = 0;
    sim.on(SimEvents.CheckHit, ValuePriority.Pre, (event) => {
      chance = event.hitChance;
    });
    const a = unit(sim, { level: 10, base: { ...ZERO, dex: 30 } });
    const b = unit(sim, { level: 5, base: { ...ZERO, agi: 50 } });
    a.hit(b);
    // 80 + (10 + 30) - (5 + 50)
    expect(chance).toBe(65);
  });

  it('sends a miss instead of damage', () => {
    const sim = new Sim(1);
    force(sim, false);
    const a = unit(sim);
    const b = unit(sim);
    let misses = 0;
    let hits = 0;
    sim.on(SimEvents.UnitMiss, EventPriority.Exact, () => {
      misses++;
    });
    sim.on(SimEvents.UnitDamage, DamagePriority.Exact, () => {
      hits++;
    });
    expect(a.hit(b)).toBeNull();
    expect(misses).toBe(1);
    expect(hits).toBe(0);
    expect(b.hp).toBe(1000);
  });

  it('lands about as often as the formula says', () => {
    const sim = new Sim(5);
    const a = unit(sim);
    const b = unit(sim, {
      modifiers: [
        { stat: 'evasion', add: 30 },
        { stat: 'maxHp', add: 1_000_000_000 },
      ],
    });
    a.modifiers.push({ stat: 'crit', add: -100 });
    a.recalc();
    let landed = 0;
    for (let i = 0; i < 20_000; i++) {
      if (a.hit(b)) {
        landed++;
      }
    }
    // 80 + 1 - (1 + 30) = 50%
    expect(landed / 20_000).toBeCloseTo(0.5, 1);
  });

  it('skips the check for magic', () => {
    const sim = new Sim(1);
    force(sim, false);
    const a = unit(sim, { base: { ...ZERO, int: 20 } });
    const b = unit(sim);
    expect(a.hit(b, { kind: DamageKind.Magical })).not.toBeNull();
  });
});

describe('Critical', () => {
  it('multiplies damage by 1.4', () => {
    const sim = new Sim(1);
    force(sim, true, true);
    const a = unit(sim);
    const b = unit(sim);
    const event = a.hit(b);
    expect(event?.value).toBe(140);
    expect((event?.flags ?? 0) & DamageFlags.Critical).not.toBe(0);
  });
});

describe('Block and Barrier', () => {
  it('blocks physical hits from the front, but not from the flank', () => {
    const { sim, a } = setup();
    const b = unit(sim, {
      modifiers: [
        { stat: 'blockChance', add: 100 },
        { stat: 'blockAmount', add: 60 },
      ],
    });
    expect(a.hit(b)?.value).toBe(40);
    expect(a.hit(b, { flags: DamageFlags.Flank })?.value).toBe(100);
  });

  it('absorbs magical damage with Ward first', () => {
    const { sim, b } = setup();
    const a = unit(sim, { base: { ...ZERO, int: 20 }, weapon: { min: 0, max: 0, matk: 0 } });
    b.ward = 20;
    expect(a.hit(b, { kind: DamageKind.Magical })?.value).toBe(10);
    expect(b.ward).toBe(0);
  });

  it('leaves Ward alone for physical hits', () => {
    const { a, b } = setup();
    b.ward = 50;
    a.hit(b);
    expect(b.ward).toBe(50);
  });
});

describe('True damage', () => {
  it('skips amplify, defense, element and reduce', () => {
    const { sim, a } = setup();
    a.attackElement = Element.Fire;
    const b = unit(sim, {
      element: Element.Fire,
      elementLevel: 3,
      modifiers: [
        { stat: 'armor', add: 500 },
        { reduce: Category.Kind, key: DamageKind.True, percent: 50 },
      ],
    });
    expect(a.hit(b, { kind: DamageKind.True, fixed: 50 })?.value).toBe(50);
  });
});

describe('Exact', () => {
  it('stops at 1 health on NonLethal', () => {
    const { a, b } = setup();
    a.hit(b, { kind: DamageKind.True, fixed: 5000, flags: DamageFlags.NonLethal });
    expect(b.hp).toBe(1);
    expect(b.alive).toBe(true);
  });

  it('kills at 0 health, once', () => {
    const { sim, a, b } = setup();
    const deaths: Unit[] = [];
    sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
      deaths.push(event.source);
    });
    a.hit(b, { kind: DamageKind.True, fixed: 5000 });
    expect(b.alive).toBe(false);
    expect(b.hp).toBe(0);
    expect(a.hit(b, { kind: DamageKind.True, fixed: 10 })?.value).toBe(0);
    expect(deaths).toEqual([b]);
  });
});

describe('healing', () => {
  it('restores health up to the maximum', () => {
    const { a, b } = setup();
    a.hit(b, { kind: DamageKind.True, fixed: 300 });
    expect(a.heal(b, 200).value).toBe(200);
    expect(a.heal(b, 500).value).toBe(100);
    expect(b.hp).toBe(1000);
  });

  it('cannot heal the dead', () => {
    const { a, b } = setup();
    a.hit(b, { kind: DamageKind.True, fixed: 5000 });
    a.heal(b, 100);
    expect(b.hp).toBe(0);
  });
});

describe('stats', () => {
  it('gives the same result for the same inputs', () => {
    const input = {
      job: JOB,
      level: 7,
      base: { ...ZERO, vit: 12, int: 9 },
      weapon: { min: 10, max: 20, matk: 5 },
      modifiers: [],
    };
    expect(deriveStats(input)).toEqual(deriveStats(input));
  });

  it('scales health with VIT and applies flat, then percent bonuses', () => {
    const r = deriveStats({
      job: JOB,
      level: 1,
      base: { ...ZERO, vit: 50 },
      weapon: { min: 0, max: 0, matk: 0 },
      modifiers: [
        { stat: 'maxHp', add: 500 },
        { stat: 'maxHp', percent: 10 },
      ],
    });
    // (1000 * 1.5 + 500) * 1.1
    expect(r.derived.maxHp).toBe(2200);
  });

  it('keeps health within a lowered maximum after recalculating', () => {
    const sim = new Sim(1);
    const u = unit(sim);
    u.base = { ...ZERO };
    u.modifiers.push({ stat: 'maxHp', percent: -50 });
    u.recalc();
    expect(u.hp).toBe(500);
  });
});
