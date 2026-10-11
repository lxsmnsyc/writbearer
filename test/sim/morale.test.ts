import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { findNode, learn } from '../../src/content/trees';
import { AIMED_SHOT } from '../../src/content/skills';
import { DEFAULT_TOGGLES, Priority } from '../../src/sim/ai';
import { SkillMode } from '../../src/sim/skill';
import {
  MORALE_START,
  Morale,
  effectiveDiscipline,
  moraleOf,
  prioritiesFollowed,
  shiftMorale,
} from '../../src/sim/morale';
import { gainXp, xpToNext } from '../../src/sim/progress';
import Sim from '../../src/sim/sim';
import { DREAD } from '../../src/sim/statuses';
import { DamageKind } from '../../src/sim/types';

describe('Discipline', () => {
  it('starts from the job, the level and the traits, and grows a point a level', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const veteran = spawnMerc(sim, 'vanguard', 5, 0, 1, undefined, { traits: ['veteran'] });
    const coward = spawnMerc(sim, 'vanguard', 5, 0, 2, undefined, { traits: ['cowardly'] });
    expect(vanguard.discipline).toBe(45);
    expect(veteran.discipline).toBe(55);
    expect(coward.discipline).toBe(35);
    gainXp(vanguard, xpToNext(5));
    expect(vanguard.discipline).toBe(46);
  });

  it('is scaled by morale in a fight, and decides how many priorities are followed', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 5, 0, 0);
    merc.discipline = 60;
    merc.morale = 80;
    expect(effectiveDiscipline(merc)).toBe(60);
    expect(prioritiesFollowed(merc)).toBe(3);
    merc.morale = MORALE_START;
    expect(effectiveDiscipline(merc)).toBe(54);
    expect(prioritiesFollowed(merc)).toBe(2);
    merc.discipline = 30;
    merc.morale = 5;
    expect(effectiveDiscipline(merc)).toBe(15);
    expect(prioritiesFollowed(merc)).toBe(1);
  });

  it('an unruly merc follows only its first priority', () => {
    const targetOf = (discipline: number): string | undefined => {
      const sim = new Sim(1);
      spawnBearer(sim, 0, 0);
      const toggles = { ...DEFAULT_TOGGLES, priorities: [Priority.Elites, Priority.Casters] };
      const merc = spawnMerc(sim, 'ranger', 5, 0, 1, toggles);
      merc.discipline = discipline;
      spawnMonster(sim, 'crawler', 4, 2, 1).aware = true;
      spawnMonster(sim, 'cantor', 4, 4, 1).aware = true;
      sim.tick();
      return merc.target?.kind;
    };
    expect(targetOf(45)).toBe('cantor');
    expect(targetOf(10)).toBe('crawler');
  });

  it('below 20, skills saved for elites are spent on anything', () => {
    const casts = (discipline: number): boolean => {
      const sim = new Sim(1);
      const ranger = spawnMerc(sim, 'ranger', 5, 0, 0, {
        ...DEFAULT_TOGGLES,
        skills: { aimedShot: SkillMode.Elites },
      });
      const found = findNode(ranger, 'aimedShot')!;
      learn(ranger, found.branch, found.node);
      ranger.discipline = discipline;
      spawnMonster(sim, 'crawler', 4, 4, 0).aware = true;
      sim.tick();
      return ranger.cast?.skill === AIMED_SHOT;
    };
    expect(casts(45)).toBe(false);
    expect(casts(10)).toBe(true);
  });
});

describe('morale', () => {
  it('falls when a fellow merc dies, half as much for the Loyal', () => {
    const sim = new Sim(1);
    const a = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const loyal = spawnMerc(sim, 'vanguard', 5, 0, 1, undefined, { traits: ['loyal'] });
    const b = spawnMerc(sim, 'ranger', 5, 0, 2);
    const before = { a: a.morale, loyal: loyal.morale };
    spawnMonster(sim, 'mite', 1, 9, 9).hit(b, { kind: DamageKind.True, fixed: 99999 });
    expect(a.morale).toBe(before.a - 10);
    expect(loyal.morale).toBe(before.loyal - 5);
  });

  it('rises when an elite falls, and drops when Dread takes hold', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const elite = spawnMonster(sim, 'crawler', 4, 9, 9, { elite: true });
    merc.hit(elite, { kind: DamageKind.True, fixed: 99999 });
    expect(merc.morale).toBe(MORALE_START + 4);
    merc.addStatus(DREAD, spawnMonster(sim, 'hollowed', 4, 9, 0));
    expect(merc.morale).toBe(MORALE_START + 4 - 8);
  });

  it('has four levels', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 5, 0, 0);
    expect(moraleOf(merc)).toBe(Morale.Normal);
    shiftMorale(merc, 30);
    expect(moraleOf(merc)).toBe(Morale.High);
    shiftMorale(merc, -70);
    expect(moraleOf(merc)).toBe(Morale.Low);
    shiftMorale(merc, -100);
    expect(merc.morale).toBe(0);
    expect(moraleOf(merc)).toBe(Morale.Broken);
  });
});
