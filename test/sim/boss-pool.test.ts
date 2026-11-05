import { describe, expect, it } from 'vitest';
import {
  BOSSES,
  BOSS_ROLL,
  POOLS,
  resolveBoss,
  rollBoss,
  spawnBoss,
} from '../../src/content/bosses/index';
import { RunStreams, Stream } from '../../src/core/seed';
import Sim from '../../src/sim/sim';

const roll = (seed: string, depth: number, endless = false): string =>
  rollBoss(new RunStreams(seed).area(1, Stream.Map, BOSS_ROLL + depth), depth, endless);

describe('boss pools', () => {
  it('fixes three bosses for each of four layers, twelve in all', () => {
    expect(POOLS.map((p) => p.length)).toEqual([3, 3, 3, 3]);
    expect(new Set(POOLS.flat()).size).toBe(12);
  });

  it('registers the four current bosses, each first in its own pool', () => {
    for (const [layer, pool] of POOLS.entries()) {
      const def = BOSSES.get(pool[0]);
      expect(def?.layer).toBe(layer);
      expect(def?.template).toBeDefined();
    }
  });

  it('rolls the same boss for the same seed', () => {
    for (let depth = 0; depth < 4; depth++) {
      expect(roll('seed-a', depth)).toBe(roll('seed-a', depth));
    }
  });

  it('moves no saved stream', () => {
    const streams = new RunStreams('seed-b');
    streams.get(1, Stream.Map).int(0, 9);
    const before = streams.save();
    rollBoss(streams.area(1, Stream.Map, BOSS_ROLL), 0, false);
    expect(streams.save()).toEqual(before);
  });

  it('rolls only built bosses of the layer', () => {
    for (let depth = 0; depth < 4; depth++) {
      for (let i = 0; i < 40; i++) {
        const id = roll(`seed-${i}`, depth);
        expect(BOSSES.has(id)).toBe(true);
        expect(POOLS[depth]).toContain(id);
      }
    }
  });

  it('resolves an unbuilt id to the first built one of its pool', () => {
    const built = new Set(['broodMother', 'lanternEater', 'gatekeeper']);
    expect(resolveBoss('drownedReeve', built)).toBe('broodMother');
    expect(resolveBoss('lanternEater', built)).toBe('lanternEater');
    expect(resolveBoss('bridgeWarden', built)).toBe('gatekeeper');
  });

  it('reaches all of a pool over many seeds once they are built', () => {
    const built = new Set(POOLS.flat());
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const streams = new RunStreams(`pool-${i}`);
      const rng = streams.area(1, Stream.Map, BOSS_ROLL + 1);
      seen.add(resolveBoss(rng.pick(POOLS[1]), built));
    }
    expect(seen.size).toBe(3);
  });

  it('endless rolls over all twelve, resolved to built bosses', () => {
    const seen = new Set<string>();
    const all = new Set(POOLS.flat());
    for (let i = 0; i < 400; i++) {
      const rng = new RunStreams(`e-${i}`).area(1, Stream.Map, BOSS_ROLL + 5);
      seen.add(rollBoss(rng, 5, true, all));
      expect(BOSSES.has(roll(`e-${i}`, 5, true))).toBe(true);
    }
    expect(seen.size).toBe(12);
  });

  it('spawns the layer boss with no id, and a named one by id', () => {
    const sim = new Sim(1);
    expect(spawnBoss(sim, 1, 10, 5, 5).kind).toBe('gatekeeper');
    expect(spawnBoss(sim, 1, 10, 5, 5, 'abbess').kind).toBe('abbess');
    expect(spawnBoss(sim, 0, 10, 5, 5, 'drownedReeve').kind).toBe('broodMother');
  });
});
