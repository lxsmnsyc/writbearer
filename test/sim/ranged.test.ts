import { describe, expect, it } from 'vitest';
import { affixesOf } from '../../src/content/affixes';
import { MINI_BOSSES, spawnMiniBoss } from '../../src/content/minibosses';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import { generateStage, rollAffixes } from '../../src/gen/stage';
import { DEFAULT_TOGGLES, copyToggles } from '../../src/sim/ai';
import Sim from '../../src/sim/sim';

const DT = 0.05;

function field(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

describe('ranged monsters', () => {
  it('shoot from range instead of closing in', () => {
    const sim = field();
    spawnBearer(sim, 30, 30);
    const merc = spawnMerc(sim, 'vanguard', 5, 10, 10);
    merc.toggles = { ...copyToggles(DEFAULT_TOGGLES), chase: 0 };
    const archer = spawnMonster(sim, 'hollowArcher', 5, 15, 10);
    archer.aware = true;
    let fired = false;
    for (let t = 0; t < 3 && !fired; t += DT) {
      sim.tick(DT);
      fired = sim.projectiles.some((p) => p.source === archer);
    }
    expect(fired).toBe(true);
    expect(archer.distanceTo(merc)).toBeGreaterThan(3);
  });

  it('step back from whoever comes too close', () => {
    const sim = field();
    spawnBearer(sim, 35, 35);
    const merc = spawnMerc(sim, 'vanguard', 5, 20, 20);
    merc.toggles = { ...copyToggles(DEFAULT_TOGGLES), chase: 0 };
    const slinger = spawnMonster(sim, 'penitentSlinger', 5, 21.5, 20);
    slinger.aware = true;
    const before = slinger.distanceTo(merc);
    for (let t = 0; t < 0.6; t += DT) {
      sim.tick(DT);
    }
    expect(slinger.distanceTo(merc)).toBeGreaterThan(before);
  });

  it('stand in the Rift Road’s packs, and the Church’s deeper down', () => {
    const kinds = (index: number): Set<string> => {
      const all = new Set<string>();
      for (let seed = 1; seed <= 20; seed++) {
        const s = generateStage(new RNG(seed), index, {
          kind: 'combat',
          ahead: ['combat'],
          objective: 'hunt',
        });
        for (const p of s.packs) {
          for (const k of p.kinds) {
            all.add(k);
          }
        }
      }
      return all;
    };
    expect(kinds(12).has('hollowArcher')).toBe(true);
    expect(kinds(20).has('penitentSlinger')).toBe(true);
  });
});

describe('Multishot', () => {
  it('is rolled only for an elite that shoots', () => {
    const rng = new RNG(2);
    for (let i = 0; i < 60; i++) {
      expect(rollAffixes(rng, 3, 5, false)).not.toContain('multishot');
    }
    const shooters = Array.from({ length: 60 }, () => rollAffixes(rng, 3, 5, true));
    expect(shooters.some((a) => a.includes('multishot'))).toBe(true);
  });

  it('looses three shots at once, at the target and those near it', () => {
    const sim = field();
    spawnBearer(sim, 35, 35);
    for (const [x, z] of [
      [10, 10],
      [10, 12],
      [12, 10],
    ]) {
      const m = spawnMerc(sim, 'vanguard', 5, x, z);
      m.toggles = { ...copyToggles(DEFAULT_TOGGLES), chase: 0 };
    }
    const archer = spawnMonster(sim, 'hollowArcher', 5, 15, 12, { elite: true });
    affixesOf(sim).give(archer, 'multishot');
    archer.aware = true;
    let most = 0;
    for (let t = 0; t < 3; t += DT) {
      sim.tick(DT);
      most = Math.max(most, sim.projectiles.filter((p) => p.source === archer).length);
    }
    expect(archer.volley).toBe(3);
    expect(most).toBeGreaterThanOrEqual(3);
  });

  it('is the Bone Quartermaster’s, with archers at its side', () => {
    const sim = field();
    const { boss, escort } = spawnMiniBoss(sim, MINI_BOSSES.boneQuartermaster, 10, 20, 20);
    expect(boss.volley).toBe(3);
    expect(escort.filter((u) => u.kind === 'hollowArcher')).toHaveLength(2);
  });
});
