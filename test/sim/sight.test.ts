import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import Sim from '../../src/sim/sim';

// A wall across the floor at x = 10, from z = 0 to z = 20, or none.
function floor(wall: boolean): Sim {
  const sim = new Sim(1);
  if (wall) {
    for (let z = 0; z <= 20; z += 0.9) {
      sim.obstacles.push({ x: 10, z, r: 0.5 });
    }
  }
  sim.setFloor(30, 30);
  return sim;
}

describe('sight', () => {
  it('is blocked by what stands across the line', () => {
    const sim = floor(true);
    expect(sim.sees({ x: 8, z: 5 }, { x: 12, z: 5 })).toBe(false);
    expect(sim.sees({ x: 8, z: 5 }, { x: 8, z: 15 })).toBe(true);
    expect(sim.sees({ x: 8, z: 25 }, { x: 12, z: 25 })).toBe(true);
  });

  it('keeps a merc from going for an enemy behind a wall', () => {
    for (const wall of [true, false]) {
      const sim = floor(wall);
      spawnBearer(sim, 7, 5);
      const merc = spawnMerc(sim, 'vanguard', 5, 8, 5);
      const mite = spawnMonster(sim, 'mite', 1, 12, 5);
      mite.aware = true;
      mite.kit.moveSpeed = 0;
      sim.run(1);
      expect(merc.target === mite, `wall ${wall}`).toBe(!wall);
    }
  });

  it('keeps a monster from noticing the party through a wall', () => {
    for (const wall of [true, false]) {
      const sim = floor(wall);
      spawnBearer(sim, 8, 5);
      const mite = spawnMonster(sim, 'mite', 1, 12, 5);
      sim.run(0.5);
      expect(mite.aware, `wall ${wall}`).toBe(!wall);
    }
  });
});
