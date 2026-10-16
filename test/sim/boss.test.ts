import { describe, expect, it } from 'vitest';
import { isFrenzied, spawnBroodMother } from '../../src/content/brood';
import type { Offer } from '../../src/content/recruits';
import { spawnBearer, spawnMerc } from '../../src/content/roster';
import { findNode, learn } from '../../src/content/trees';
import { RunStreams, Stream } from '../../src/core/seed';
import { enterStage, spawnParty, wakeBoss } from '../../src/game/stage';
import dodge from '../support/dodge';
import { AREAS_PER_LAYER } from '../../src/gen/layers';
import { generateStage, navFor } from '../../src/gen/stage';
import { DEFAULT_TOGGLES, Hunt, Priority } from '../../src/sim/ai';
import Sim from '../../src/sim/sim';
import { DamageKind, Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const PLAN: Record<Offer['kind'], string[]> = {
  vanguard: ['challenge', 'sunder', 'crush', 'vow', 'challenge', 'crush', 'vow', 'sunder'],
  ranger: ['aimedShot', 'snare', 'chargedArrow', 'pinDown', 'aimedShot', 'snare', 'pinDown'],
  cleric: ['heal', 'smite', 'renew', 'heal', 'smite', 'renew', 'heal'],
};

const mites = (sim: Sim): Unit[] => sim.living(Side.Monster).filter((m) => m.kind === 'mite');

// A party of level 9 mercs against the Mother, the bearer standing back.
// Returns whether she died before the bearer did.
function fight(seed: number, jobs: Offer['kind'][], casters: boolean): boolean {
  const sim = new Sim(seed);
  sim.setFloor(40, 30);
  const bearer = spawnBearer(sim, 6, 15);
  const toggles = casters
    ? {
        ...DEFAULT_TOGGLES,
        priorities: [Priority.AttackingBearer, Priority.Casters, Priority.Nearest],
      }
    : undefined;
  jobs.forEach((job, i) => {
    const merc = spawnMerc(sim, job, 9, 8, 13 + i * 1.5, toggles);
    for (const id of PLAN[job]) {
      const found = findNode(merc, id);
      if (found) {
        learn(merc, found.branch, found.node);
      }
    }
  });
  const mother = spawnBroodMother(sim, 9, 16, 15);
  mother.aware = true;
  // The bearer stands behind its mercs, and steps out of her acid.
  sim.run(180, () => {
    dodge(sim, bearer, { x: 6, z: 15 });
    return !mother.alive || !bearer.alive;
  });
  return !mother.alive && bearer.alive;
}

describe('the Brood Mother', () => {
  it('lays mites once awake, and stops at eight of hers', () => {
    const sim = new Sim(1);
    sim.setFloor(40, 30);
    spawnBearer(sim, 2, 15);
    const mother = spawnBroodMother(sim, 9, 20, 15);
    sim.run(1);
    expect(mites(sim)).toHaveLength(0);
    mother.aware = true;
    sim.run(2);
    expect(mites(sim)).toHaveLength(3);
    sim.run(60);
    expect(mites(sim).length).toBeLessThanOrEqual(8);
  });

  it('frenzies at half health: she and her brood go for the bearer', () => {
    const sim = new Sim(1);
    sim.setFloor(40, 30);
    const bearer = spawnBearer(sim, 2, 15);
    const mother = spawnBroodMother(sim, 9, 20, 15);
    mother.aware = true;
    sim.run(2);
    expect(isFrenzied(mother)).toBe(false);
    bearer.hit(mother, { kind: DamageKind.True, fixed: mother.derived.maxHp * 0.6 });
    expect(isFrenzied(mother)).toBe(true);
    expect(mother.hunt).toBe(Hunt.Bearer);
    expect(mites(sim).every((m) => m.hunt === Hunt.Bearer)).toBe(true);
  });

  it('takes her brood with her when she dies', () => {
    const sim = new Sim(1);
    sim.setFloor(40, 30);
    const bearer = spawnBearer(sim, 2, 15);
    const mother = spawnBroodMother(sim, 9, 20, 15);
    mother.aware = true;
    sim.run(2);
    expect(mites(sim).length).toBeGreaterThan(0);
    bearer.hit(mother, { kind: DamageKind.True, fixed: 100000 });
    expect(mites(sim)).toHaveLength(0);
  });

  it('is beaten by three mercs, by two about half the time, and never by one', () => {
    const seeds = Array.from({ length: 12 }, (_, i) => i + 1);
    const told = seeds.filter((s) => fight(s, ['vanguard', 'ranger'], true)).length;
    const untold = seeds.filter((s) => fight(s, ['vanguard', 'ranger'], false)).length;
    for (const two of [told, untold]) {
      expect(two).toBeGreaterThanOrEqual(4);
      expect(two).toBeLessThan(12);
    }
    expect(seeds.every((s) => fight(s, ['vanguard', 'ranger', 'cleric'], true))).toBe(true);
    expect(seeds.some((s) => fight(s, ['vanguard'], true))).toBe(false);
  });
});

describe('the boss field', () => {
  const index = AREAS_PER_LAYER - 1;
  const bossStage = (): ReturnType<typeof generateStage> =>
    generateStage(new RunStreams('ASHEN').area(1, Stream.Layout, index), index);

  it('is wide open, with the way down beyond the boss and no way back', () => {
    const stage = bossStage();
    expect(stage.width).toBeGreaterThanOrEqual(60);
    expect(stage.props.some((p) => p.kind === 'wall')).toBe(false);
    expect(stage.exits.map((e) => e.ahead)).toEqual(['down']);
    expect(stage.exit.x).toBeGreaterThan(stage.boss!.x);
    const nav = navFor(stage);
    const end = nav.path(stage.entrance, stage.exit).at(-1)!;
    expect(Math.hypot(end.x - stage.exit.x, end.z - stage.exit.z)).toBeLessThan(1);
  });

  it('wakes the boss once the bearer comes near', () => {
    const stage = bossStage();
    const sim = new Sim(1);
    const bearer = spawnParty(sim, stage, ['vanguard']);
    const boss = enterStage(sim, stage)!;
    expect(wakeBoss(sim, boss)).toBe(false);
    expect(boss.aware).toBe(false);
    bearer.x = boss.x - 10;
    bearer.z = boss.z;
    expect(wakeBoss(sim, boss)).toBe(true);
    expect(boss.aware).toBe(true);
    expect(wakeBoss(sim, boss)).toBe(false);
  });
});
