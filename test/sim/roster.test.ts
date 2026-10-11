import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { HYMN, SHIELD_BASH } from '../../src/content/skills';
import { DEFAULT_TOGGLES, Priority, Stance } from '../../src/sim/ai';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { SkillMode } from '../../src/sim/skill';
import { DREAD } from '../../src/sim/statuses';
import { DamagePriority, HealPriority, Rank, ValuePriority } from '../../src/sim/types';

describe('Penitent Cantor', () => {
  it('sings its hymn when an ally is wounded, and mends it', () => {
    const sim = new Sim(1);
    spawnBearer(sim, 0, 0);
    const cantor = spawnMonster(sim, 'cantor', 4, 20, 0);
    const penitent = spawnMonster(sim, 'penitent', 4, 21, 0);
    cantor.aware = true;
    penitent.hp = 20;
    sim.run(HYMN.windup + 0.2);
    expect(penitent.hp).toBeGreaterThan(20);
  });

  it('loses the hymn to a Shield Bash', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0, {
      ...DEFAULT_TOGGLES,
      skills: { challenge: SkillMode.Off, shieldBash: SkillMode.Off },
    });
    const cantor = spawnMonster(sim, 'cantor', 4, 1, 0);
    cantor.hp = 20;
    sim.on(SimEvents.CheckHit, ValuePriority.Pre, (event) => {
      event.hitChance = 1000;
    });
    let healed = 0;
    sim.on(SimEvents.UnitHeal, HealPriority.Post, (event) => {
      healed += event.value;
    });
    expect(cantor.startCast(HYMN, null)).toBe(true);
    expect(vanguard.startCast(SHIELD_BASH, cantor)).toBe(true);
    sim.run(HYMN.windup + 0.5);
    expect(healed).toBe(0);
  });

  it('keeps back from the party behind the other Penitents', () => {
    const sim = new Sim(2);
    const bearer = spawnBearer(sim, 0, 0);
    spawnMerc(sim, 'vanguard', 5, 1, 0, { ...DEFAULT_TOGGLES, stance: Stance.Hold });
    const cantor = spawnMonster(sim, 'cantor', 4, 5, 0);
    const penitent = spawnMonster(sim, 'penitent', 4, 5, 1);
    cantor.aware = true;
    penitent.aware = true;
    sim.run(3);
    expect(cantor.distanceTo(bearer)).toBeGreaterThan(penitent.distanceTo(bearer));
  });

  it('is what mercs go for first under "Casters and healers"', () => {
    const sim = new Sim(3);
    spawnBearer(sim, 0, 0);
    const ranger = spawnMerc(sim, 'ranger', 5, 0, 1, {
      ...DEFAULT_TOGGLES,
      priorities: [Priority.Casters, Priority.Nearest],
      skills: { piercingArrow: SkillMode.Off },
    });
    spawnMonster(sim, 'penitent', 4, 3, 1).aware = true;
    const cantor = spawnMonster(sim, 'cantor', 4, 5, 3);
    cantor.aware = true;
    sim.tick();
    expect(ranger.target).toBe(cantor);
  });
});

describe('the Hollowed', () => {
  it('runs past a merc in its way to strike the bearer', () => {
    const sim = new Sim(4);
    const bearer = spawnBearer(sim, 0, 0);
    spawnMerc(sim, 'vanguard', 5, 1.2, 0, {
      ...DEFAULT_TOGGLES,
      stance: Stance.Hold,
      skills: { challenge: SkillMode.Off, shieldBash: SkillMode.Off },
    });
    const hollowed = spawnMonster(sim, 'hollowed', 4, 3, 0);
    hollowed.aware = true;
    let first: unknown = null;
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (event.source === hollowed && first === null) {
        first = event.target;
      }
    });
    sim.run(5, () => first !== null);
    expect(first).toBe(bearer);
  });

  it('fills mercs with dread, and they run from it', () => {
    const sim = new Sim(5);
    const ranger = spawnMerc(sim, 'ranger', 5, 0, 0);
    const hollowed = spawnMonster(sim, 'hollowed', 4, 1, 0);
    hollowed.kit.moveSpeed = 0;
    hollowed.kit.interval = 0;
    ranger.ward = 30;
    ranger.addStatus(DREAD, hollowed);
    expect(ranger.ward).toBe(0);
    const before = ranger.distanceTo(hollowed);
    sim.run(1);
    expect(ranger.distanceTo(hollowed)).toBeGreaterThan(before + 1);
    expect(ranger.target).toBeNull();
  });

  it('never makes the bearer run: the Writ drives it on', () => {
    const sim = new Sim(5);
    const bearer = spawnBearer(sim, 0, 0);
    const hollowed = spawnMonster(sim, 'hollowed', 4, 1, 0);
    bearer.buildUp(DREAD, hollowed, 100000);
    expect(bearer.statuses.has(DREAD.id)).toBe(false);
  });
});

describe('elites', () => {
  it('have far more health than the plain kind', () => {
    const sim = new Sim(6);
    const plain = spawnMonster(sim, 'hollowSoldier', 4, 0, 0);
    const elite = spawnMonster(sim, 'hollowSoldier', 4, 5, 0, { elite: true });
    expect(elite.rank).toBe(Rank.Elite);
    expect(elite.derived.maxHp).toBeGreaterThanOrEqual(plain.derived.maxHp * 2.4);
  });
});

describe('noticing the party', () => {
  it('sees the lantern-bearer from further than an unlit merc', () => {
    const sim = new Sim(7);
    const bearer = spawnBearer(sim, 0, 0);
    spawnMerc(sim, 'ranger', 5, 20, 0, {
      ...DEFAULT_TOGGLES,
      stance: Stance.Hold,
    });
    // Crawlers notice at 5: the bearer at 4.5, but a merc only at 3.75.
    const byBearer = spawnMonster(sim, 'crawler', 4, 4.5, 0);
    const byMerc = spawnMonster(sim, 'crawler', 4, 24.5, 0);
    for (const m of [byBearer, byMerc]) {
      m.kit.moveSpeed = 0;
    }
    bearer.kit.moveSpeed = 0;
    sim.tick();
    expect(byBearer.aware).toBe(true);
    expect(byMerc.aware).toBe(false);
  });
});
