import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import { enterStage } from '../../src/game/stage';
import { OBJECTIVES } from '../../src/gen/graph';
import { generateStage } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';
import { Side } from '../../src/sim/types';
import { spawnMonster } from '../../src/content/roster';

describe('a monster as an area is entered', () => {
  it('never stands inside something solid, such as a sealing site’s altar', () => {
    let altars = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const objective of OBJECTIVES) {
        for (const index of [0, 1, 5]) {
          const stage = generateStage(new RNG(seed), index, {
            kind: 'combat',
            ahead: ['combat'],
            objective,
          });
          const sim = new Sim(1);
          enterStage(sim, stage);
          altars += stage.props.filter((p) => p.kind === 'altar').length;
          for (const m of sim.living(Side.Monster)) {
            expect(sim.nav!.roomy(m.x, m.z)).toBe(true);
          }
        }
      }
    }
    expect(altars).toBeGreaterThan(0);
  });
});

describe('a body shoved into a wall', () => {
  it('is moved back to open ground after a moment, not at once', () => {
    const sim = new Sim(1);
    for (let z = 0; z < 6; z += 0.9) {
      sim.obstacles.push({ x: 5, z, r: 0.5 });
    }
    sim.setFloor(10, 10);
    const crawler = spawnMonster(sim, 'crawler', 4, 2, 2);
    crawler.x = 5;
    crawler.z = 2.2;
    sim.tick();
    expect(sim.nav!.walkable(crawler.x, crawler.z)).toBe(false);
    sim.run(1.2);
    expect(sim.nav!.roomy(crawler.x, crawler.z)).toBe(true);
  });
});

describe('the ruined wall across an open field', () => {
  it('stands in short stretches, never across the whole field', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const stage = generateStage(new RNG(seed), 2, { kind: 'combat', ahead: ['combat'] });
      const walls = stage.props.filter((p) => p.kind === 'wall').sort((a, b) => a.z - b.z);
      let run = 0;
      let longest = 0;
      walls.forEach((w, i) => {
        run = i > 0 && w.z - walls[i - 1].z < 1 ? run + 0.9 : 0.9;
        longest = Math.max(longest, run);
      });
      expect(longest).toBeLessThanOrEqual(8);
      expect(walls.length * 0.9).toBeLessThan(stage.depth * 0.75);
    }
  });
});
