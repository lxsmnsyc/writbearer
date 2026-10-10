import { describe, expect, it } from 'vitest';
import PRD from '../../src/core/prd';
import RNG, { hashSeed } from '../../src/core/rng';
import { RunStreams, Stream, normalizeSeed, randomSeed } from '../../src/core/seed';

describe('hashSeed', () => {
  it('gives the same number for the same parts', () => {
    expect(hashSeed('7KQ2M9XA', 1, 'map')).toBe(hashSeed('7KQ2M9XA', 1, 'map'));
  });

  it('keeps known values stable, so shared seeds stay valid across versions', () => {
    expect([hashSeed('WRIT'), hashSeed('WRIT', 0, 'map'), hashSeed('WRIT', 1, 'map')])
      .toMatchInlineSnapshot(`
      [
        2998055352,
        643636297,
        4083301669,
      ]
    `);
  });

  it('separates parts, so ("ab", "c") differs from ("a", "bc")', () => {
    expect(hashSeed('ab', 'c')).not.toBe(hashSeed('a', 'bc'));
  });
});

describe('RNG', () => {
  it('repeats the same sequence from the same state', () => {
    const a = new RNG(42);
    const b = new RNG(42);
    for (let i = 0; i < 100; i++) {
      expect(a.random()).toBe(b.random());
    }
  });

  it('keeps known values stable', () => {
    const rng = new RNG(1);
    expect([rng.random(), rng.random(), rng.random()]).toMatchInlineSnapshot(`
      [
        0.6270739405881613,
        0.002735721180215478,
        0.5274470399599522,
      ]
    `);
  });

  it('resumes from a saved state', () => {
    const a = new RNG(7);
    for (let i = 0; i < 50; i++) {
      a.random();
    }
    const b = new RNG(a.state);
    for (let i = 0; i < 50; i++) {
      expect(b.random()).toBe(a.random());
    }
  });

  it('stays in [0, 1) with a mean near one half', () => {
    const rng = new RNG(123);
    let sum = 0;
    for (let i = 0; i < 100_000; i++) {
      const x = rng.random();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 100_000).toBeCloseTo(0.5, 2);
  });

  it('spreads integers evenly, both ends included', () => {
    const rng = new RNG(9);
    const counts: number[] = Array.from({ length: 6 }, () => 0);
    for (let i = 0; i < 60_000; i++) {
      counts[rng.int(1, 6) - 1]++;
    }
    for (const c of counts) {
      expect(Math.abs(c - 10_000)).toBeLessThan(400);
    }
  });

  it('shuffles without losing items', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    new RNG(5).shuffle(items);
    expect([...items].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('seeds', () => {
  it('makes readable 8-character seeds', () => {
    expect(randomSeed()).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('treats case and outer spaces as the same seed', () => {
    expect(normalizeSeed('  writ ')).toBe('WRIT');
  });
});

describe('RunStreams', () => {
  it('gives the same stream for the same seed, phase and name', () => {
    const a = new RunStreams('WRIT').get(1, Stream.Map);
    const b = new RunStreams(' writ').get(1, Stream.Map);
    expect(a.random()).toBe(b.random());
  });

  it('keeps streams independent: drawing loot never changes the map', () => {
    const quiet = new RunStreams('WRIT');
    const busy = new RunStreams('WRIT');
    for (let i = 0; i < 1000; i++) {
      busy.get(1, Stream.Loot).random();
    }
    expect(busy.get(1, Stream.Map).random()).toBe(quiet.get(1, Stream.Map).random());
  });

  it('gives each phase its own stream', () => {
    const run = new RunStreams('WRIT');
    expect(run.get(1, Stream.Map).random()).not.toBe(run.get(2, Stream.Map).random());
  });

  it('saves and loads every stream position', () => {
    const run = new RunStreams('WRIT');
    run.get(1, Stream.Combat).random();
    run.get(2, Stream.Loot).random();
    const loaded = RunStreams.load('WRIT', run.save());
    expect(loaded.get(1, Stream.Combat).random()).toBe(run.get(1, Stream.Combat).random());
    expect(loaded.get(2, Stream.Loot).random()).toBe(run.get(2, Stream.Loot).random());
  });
});

describe('PRD', () => {
  it('averages out to the requested chance', () => {
    const prd = new PRD(new RNG(3), 0.25);
    let hits = 0;
    for (let i = 0; i < 40_000; i++) {
      if (prd.next()) {
        hits++;
      }
    }
    expect(hits / 40_000).toBeCloseTo(0.25, 2);
  });

  it('keeps failure streaks shorter than plain chance does', () => {
    const longest = (roll: () => boolean): number => {
      let best = 0;
      let run = 0;
      for (let i = 0; i < 40_000; i++) {
        run = roll() ? 0 : run + 1;
        best = Math.max(best, run);
      }
      return best;
    };
    const plain = new RNG(11);
    const prd = new PRD(new RNG(11), 0.25);
    expect(longest(() => prd.next())).toBeLessThan(longest(() => plain.chance(0.25)));
  });

  it('handles certain and impossible chances', () => {
    expect(new PRD(new RNG(1), 1).next()).toBe(true);
    expect(new PRD(new RNG(1), 0).next()).toBe(false);
  });
});
