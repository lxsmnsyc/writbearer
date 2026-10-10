import { describe, expect, it } from 'vitest';
import { EventPriority } from '../../src/core/event-emitter';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { CHALLENGE, PIERCING_ARROW } from '../../src/content/skills';
import { DEFAULT_TOGGLES, TAUNTED, type Toggles } from '../../src/sim/ai';
import { SimEvents } from '../../src/sim/events';
import Sim, { ARROW_SPEED } from '../../src/sim/sim';
import { SkillMode } from '../../src/sim/skill';
import { DamageFlags, DamagePriority, Side, ValuePriority } from '../../src/sim/types';

const withSkills = (skills: Toggles['skills']): Toggles => ({ ...DEFAULT_TOGGLES, skills });

describe('mana', () => {
  it('regenerates, twice as fast out of a fight', () => {
    const sim = new Sim(1);
    const ranger = spawnMerc(sim, 'ranger', 5, 0, 0);
    ranger.mana = 0;
    sim.run(10);
    expect(ranger.mana).toBeCloseTo(ranger.derived.manaRegen * 2 * 10, 1);
  });

  it('pays for a skill when its windup begins, and the cost can be changed', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0);
    sim.on(SimEvents.CheckSkillCost, ValuePriority.Multiplicative, (event) => {
      event.value /= 2;
    });
    const before = vanguard.mana;
    expect(vanguard.startCast(CHALLENGE, null)).toBe(true);
    expect(vanguard.mana).toBe(before - CHALLENGE.cost / 2);
  });

  it('refuses a skill without the mana, or while it cools down', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0);
    vanguard.mana = CHALLENGE.cost - 1;
    expect(vanguard.startCast(CHALLENGE, null)).toBe(false);
    vanguard.mana = 100;
    expect(vanguard.startCast(CHALLENGE, null)).toBe(true);
    sim.run(CHALLENGE.windup + CHALLENGE.recovery + 0.1);
    expect(vanguard.startCast(CHALLENGE, null)).toBe(false);
    sim.run(CHALLENGE.cooldown);
    expect(vanguard.startCast(CHALLENGE, null)).toBe(true);
  });
});

describe('Challenge', () => {
  it('takes effect on release and turns monsters from the bearer to the Vanguard', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 1, 0, withSkills({ challenge: SkillMode.Off }));
    // Penitents hunt the bearer.
    const penitent = spawnMonster(sim, 'penitent', 4, 3, 1.5);
    penitent.aware = true;
    expect(vanguard.startCast(CHALLENGE, null)).toBe(true);
    sim.tick();
    expect(penitent.statuses.has(TAUNTED)).toBe(false);
    sim.run(CHALLENGE.windup);
    expect(penitent.statuses.get(TAUNTED)?.source).toBe(vanguard);
    sim.run(1);
    expect(penitent.target).toBe(vanguard);
    expect(bearer.hp).toBe(bearer.derived.maxHp);
  });

  it('is used on its own when monsters go for the bearer, and never when Off', () => {
    const count = (mode: SkillMode): number => {
      const sim = new Sim(2);
      const bearer = spawnBearer(sim, 0, 0);
      spawnMerc(sim, 'vanguard', 5, 0.8, 0.6, withSkills({ challenge: mode }));
      for (const [x, z] of [
        [4, 0.5],
        [4.4, -0.5],
      ]) {
        spawnMonster(sim, 'penitent', 4, x, z).aware = true;
      }
      let casts = 0;
      sim.on(SimEvents.UnitSkillRelease, EventPriority.Post, () => {
        casts++;
      });
      sim.run(30, () => !bearer.alive || sim.living(Side.Monster).length === 0);
      return casts;
    };
    expect(count(SkillMode.Auto)).toBeGreaterThan(0);
    expect(count(SkillMode.Off)).toBe(0);
    // No elites in this pack.
    expect(count(SkillMode.Elites)).toBe(0);
  });
});

describe('Piercing Arrow', () => {
  it('hits every monster in its line and none beside it', () => {
    const sim = new Sim(3);
    const ranger = spawnMerc(sim, 'ranger', 5, 0, 0, withSkills({ piercingArrow: SkillMode.Off }));
    const first = spawnMonster(sim, 'hollowSoldier', 4, 3, 0);
    const second = spawnMonster(sim, 'hollowSoldier', 4, 5, 0.2);
    const aside = spawnMonster(sim, 'hollowSoldier', 4, 4, 2);
    const hit = new Set<unknown>();
    sim.on(SimEvents.CheckHit, ValuePriority.Pre, (event) => {
      // Every arrow lands, so the test does not depend on the roll.
      event.hitChance = 1000;
    });
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (event.flags & DamageFlags.Skill) {
        hit.add(event.target);
      }
    });
    for (const m of [first, second, aside]) {
      m.kit.moveSpeed = 0;
    }
    expect(ranger.startCast(PIERCING_ARROW, first)).toBe(true);
    sim.run(PIERCING_ARROW.windup + 1);
    expect(hit.has(first)).toBe(true);
    expect(hit.has(second)).toBe(true);
    expect(hit.has(aside)).toBe(false);
  });

  it('can be walked out of', () => {
    const sim = new Sim(3);
    const ranger = spawnMerc(sim, 'ranger', 5, 0, 0, withSkills({ piercingArrow: SkillMode.Off }));
    const target = spawnMonster(sim, 'hollowSoldier', 4, 5, 0);
    target.kit.moveSpeed = 0;
    expect(ranger.startCast(PIERCING_ARROW, target)).toBe(true);
    sim.run(PIERCING_ARROW.windup + 0.01);
    // It steps aside while the arrow is in flight.
    target.z = 2;
    sim.run(1);
    expect(target.hp).toBe(target.derived.maxHp);
  });
});

describe('arrows', () => {
  it('land after a flight, not on release', () => {
    const sim = new Sim(4);
    const ranger = spawnMerc(sim, 'ranger', 5, 0, 0);
    const target = spawnMonster(sim, 'crawler', 4, 5, 0);
    target.kit.moveSpeed = 0;
    let released = -1;
    let landed = -1;
    sim.on(SimEvents.CheckHit, ValuePriority.Pre, () => {
      if (landed < 0) {
        landed = sim.time;
      }
    });
    ranger.startAttack(target);
    sim.run(3, () => {
      if (released < 0 && sim.projectiles.length > 0) {
        released = sim.time;
      }
      return landed >= 0;
    });
    expect(released).toBeGreaterThan(0);
    expect(landed - released).toBeGreaterThan(5 / ARROW_SPEED - 0.1);
  });
});
