import { describe, expect, it } from 'vitest';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import MutatorRun, { BURST, RISE_AFTER } from '../../src/game/mutators';
import { generateLayerMap } from '../../src/gen/graph';
import Sim from '../../src/sim/sim';
import { DamageKind, Side } from '../../src/sim/types';

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

describe('mutators on the map', () => {
  it('are on every Elite, two from the last layer, and none on ordinary fights in the first', () => {
    for (const seed of SEEDS) {
      for (const depth of [0, 1, 3]) {
        for (const node of generateLayerMap(new RNG(seed), 2, true, depth).columns.flat()) {
          const n = node.mutators?.length ?? 0;
          if (node.kind === 'elite') {
            // A Labyrinth can roll only Darkness.
            expect(n).toBe(depth >= 3 && node.objective !== 'maze' ? 2 : 1);
            expect(new Set(node.mutators).size).toBe(n);
          } else if (depth === 0 || !node.objective) {
            expect(n).toBe(0);
          } else {
            expect(n).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe('a mutator', () => {
  it('Blood moon: a monster below half health hits harder', () => {
    const hit = (blood: boolean, hurt: boolean): number => {
      const sim = new Sim(1);
      const run = new MutatorRun(sim, () => 4);
      run.set(blood ? ['bloodMoon'] : []);
      const merc = spawnMerc(sim, 'vanguard', 5, 0, 0);
      const crawler = spawnMonster(sim, 'crawler', 4, 1, 0);
      if (hurt) {
        crawler.hp = 1;
      }
      const before = merc.hp;
      crawler.hit(merc, { kind: DamageKind.True, fixed: 10 });
      return before - merc.hp;
    };
    expect(hit(false, true)).toBe(10);
    expect(hit(true, false)).toBe(10);
    expect(hit(true, true)).toBe(13);
  });

  it('Volatile: a monster bursts where it dies, after a warning', () => {
    const sim = new Sim(1);
    const run = new MutatorRun(sim, () => 4);
    run.set(['volatile']);
    const merc = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const crawler = spawnMonster(sim, 'crawler', 4, 1, 0);
    merc.hit(crawler, { kind: DamageKind.True, fixed: 100000 });
    expect(sim.warnings).toHaveLength(1);
    const before = merc.hp;
    sim.run(BURST.windup + 0.1);
    expect(merc.hp).toBeLessThan(before);
  });

  it('Restless dead: a whole body rises as a Husk, a torn one does not', () => {
    const sim = new Sim(1);
    const run = new MutatorRun(sim, () => 4);
    run.set(['restless']);
    const merc = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const whole = spawnMonster(sim, 'crawler', 4, 10, 0);
    const torn = spawnMonster(sim, 'crawler', 4, -10, 0);
    whole.hp = 1;
    merc.hit(whole, { kind: DamageKind.True, fixed: 1 });
    merc.hit(torn, { kind: DamageKind.True, fixed: 100000 });
    expect(whole.torn).toBe(false);
    expect(torn.torn).toBe(true);
    run.update(RISE_AFTER - 1);
    expect(sim.living(Side.Monster)).toHaveLength(0);
    run.update(2);
    const risen = sim.living(Side.Monster);
    expect(risen.map((u) => u.kind)).toEqual(['husk']);
    expect(whole.torn).toBe(true);
    // A risen Husk does not rise again.
    risen[0].hp = 1;
    merc.hit(risen[0], { kind: DamageKind.True, fixed: 1 });
    expect(risen[0].torn).toBe(false);
    run.update(RISE_AFTER + 1);
    expect(sim.living(Side.Monster)).toHaveLength(0);
  });
});
