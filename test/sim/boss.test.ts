import { describe, expect, it } from 'vitest';
import { isFrenzied, spawnBroodMother } from '../../src/content/brood';
import type { Offer } from '../../src/content/recruits';
import { spawnBearer, spawnMerc } from '../../src/content/roster';
import { findNode, learn } from '../../src/content/trees';
import { RunStreams, Stream } from '../../src/core/seed';
import { enterStage, shutArena, spawnParty } from '../../src/game/stage';
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
  sim.run(180, () => !mother.alive || !bearer.alive);
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

  it('is beaten by two mercs sent past the brood, rarely by two that are not', () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const told = seeds.filter((s) => fight(s, ['vanguard', 'ranger'], true)).length;
    const untold = seeds.filter((s) => fight(s, ['vanguard', 'ranger'], false)).length;
    expect(told).toBeGreaterThanOrEqual(4);
    expect(untold).toBeLessThan(told);
    expect(seeds.every((s) => fight(s, ['vanguard', 'ranger', 'cleric'], true))).toBe(true);
    expect(seeds.some((s) => fight(s, ['vanguard'], true))).toBe(false);
  });
});

describe('the arena', () => {
  const index = AREAS_PER_LAYER - 1;
  const arenaStage = (): ReturnType<typeof generateStage> =>
    generateStage(new RunStreams('ASHEN').area(1, Stream.Layout, index), index);

  it('rings the boss and the way down with a wall, open at its gate', () => {
    const stage = arenaStage();
    expect(stage.arena).toBeDefined();
    const nav = navFor(stage);
    const end = nav.path(stage.entrance, stage.exit).at(-1)!;
    expect(Math.hypot(end.x - stage.exit.x, end.z - stage.exit.z)).toBeLessThan(1);
  });

  it('shuts behind the bearer, pulls the party in and wakes the boss', () => {
    const stage = arenaStage();
    const sim = new Sim(1);
    const bearer = spawnParty(sim, stage, ['vanguard', 'ranger']);
    const boss = enterStage(sim, stage)!;
    expect(boss.aware).toBe(false);
    expect(shutArena(sim, stage, boss)).toBe(false);
    const arena = stage.arena!;
    bearer.x = arena.x - arena.r + 3;
    bearer.z = arena.z;
    expect(shutArena(sim, stage, boss)).toBe(true);
    expect(boss.aware).toBe(true);
    for (const u of sim.living(Side.Party)) {
      expect(Math.hypot(u.x - arena.x, u.z - arena.z)).toBeLessThan(arena.r);
    }
    // No way back out through the gate.
    const out = navFor(stage).path(bearer, stage.entrance).at(-1);
    expect(
      out === undefined || Math.hypot(out.x - stage.entrance.x, out.z - stage.entrance.z) > 5,
    ).toBe(true);
  });
});
