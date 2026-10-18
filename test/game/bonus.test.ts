import { describe, expect, it } from 'vitest';
import { spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import Bonus, { SWIFT_TIME } from '../../src/game/bonus';
import { CHALLENGES, generateLayerMap } from '../../src/gen/graph';
import Sim from '../../src/sim/sim';

const AREA = { x0: 0, z0: 0, x1: 40, z1: 30 };

describe('a bonus challenge', () => {
  it('is rolled for every fight, from those its objective allows', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const node of generateLayerMap(new RNG(seed), 2, true).columns.flat()) {
        expect(node.challenge !== undefined).toBe(node.objective !== undefined);
        if (node.objective && node.challenge) {
          expect(CHALLENGES[node.objective]).toContain(node.challenge);
        }
      }
    }
  });

  it('Untouched fails once the bearer is hit, and only then', () => {
    const sim = new Sim(1);
    const b = new Bonus('untouched', 'hunt', AREA);
    b.lost();
    expect(b.met(sim)).toBe(true);
    b.hurt();
    expect(b.met(sim)).toBe(false);
    expect(b.state).toBe('failed');
  });

  it('No losses fails once a merc dies', () => {
    const sim = new Sim(1);
    const b = new Bonus('noLosses', 'maze', AREA);
    b.hurt();
    expect(b.met(sim)).toBe(true);
    b.lost();
    expect(b.met(sim)).toBe(false);
  });

  it('Swift fails once its time is up', () => {
    const sim = new Sim(1);
    const b = new Bonus('swift', 'maze', AREA);
    b.tick(SWIFT_TIME.maze - 1);
    expect(b.met(sim)).toBe(true);
    b.tick(2);
    expect(b.met(sim)).toBe(false);
  });

  it('Thorough needs every monster in the area dead, not those beyond it', () => {
    const sim = new Sim(1);
    const b = new Bonus('thorough', 'hunt', AREA);
    const inside = spawnMonster(sim, 'crawler', 4, 10, 10);
    spawnMonster(sim, 'crawler', 4, 60, 10);
    expect(b.met(sim)).toBe(false);
    expect(b.status(sim)).toContain('1 left');
    inside.alive = false;
    expect(b.met(sim)).toBe(true);
  });
});
