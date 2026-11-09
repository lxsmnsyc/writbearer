import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { CHALLENGE } from '../../src/content/vanguard';
import { addLight, lightOf, noticeOf, removeLight } from '../../src/sim/light';
import Sim from '../../src/sim/sim';
import { stillFor } from '../../src/sim/still';

function floor(): Sim {
  const sim = new Sim(1);
  sim.setFloor(40, 40);
  return sim;
}

// A mite just outside the reach of an unlit bearer's lantern
function setup(): {
  bearer: ReturnType<typeof spawnBearer>;
  mite: ReturnType<typeof spawnMonster>;
  sim: Sim;
} {
  const sim = floor();
  const bearer = spawnBearer(sim, 5, 20);
  const mite = spawnMonster(sim, 'mite', 1, 5 + 6, 20);
  mite.kit.notice = 4;
  mite.kit.moveSpeed = 0;
  return { bearer, mite, sim };
}

describe('light radius', () => {
  it('is the kit value with no bonus', () => {
    const sim = floor();
    const bearer = spawnBearer(sim, 5, 5);
    expect(lightOf(bearer)).toBe(bearer.kit.sight);
    expect(noticeOf(bearer)).toBe(bearer.kit.notice);
  });

  it('stacks by source, replaces by key and goes away on removal', () => {
    const sim = floor();
    const bearer = spawnBearer(sim, 5, 5);
    const base = bearer.kit.sight;
    addLight(bearer, 'a', { add: 2 });
    addLight(bearer, 'a', { add: 2 });
    expect(lightOf(bearer)).toBe(base + 2);
    addLight(bearer, 'b', { percent: 0.5 });
    expect(lightOf(bearer)).toBe((base + 2) * 1.5);
    removeLight(bearer, 'a');
    removeLight(bearer, 'b');
    expect(lightOf(bearer)).toBe(base);
  });

  it('makes monsters notice the lantern from further', () => {
    for (const wide of [false, true]) {
      const { bearer, mite, sim } = setup();
      if (wide) {
        addLight(bearer, 'wide', { add: 3 });
      }
      sim.run(0.5);
      expect(mite.aware, `wide ${wide}`).toBe(wide);
    }
  });

  it('restores the old reach when removed', () => {
    const { bearer, mite, sim } = setup();
    addLight(bearer, 'wide', { add: 3 });
    removeLight(bearer, 'wide');
    sim.run(0.5);
    expect(mite.aware).toBe(false);
  });

  it('widens the distance at which a merc picks up an enemy', () => {
    for (const wide of [false, true]) {
      const sim = floor();
      spawnBearer(sim, 3, 21);
      const merc = spawnMerc(sim, 'vanguard', 5, 3, 20);
      merc.kit.sight = 4.5;
      const mite = spawnMonster(sim, 'mite', 1, 3 + 5.5, 20);
      mite.aware = true;
      mite.kit.moveSpeed = 0;
      if (wide) {
        addLight(merc, 'wide', { add: 2 });
      }
      sim.run(0.3);
      expect(merc.target === mite, `wide ${wide}`).toBe(wide);
    }
  });
});

describe('standing still', () => {
  it('grows while idle and resets on movement', () => {
    const sim = floor();
    spawnBearer(sim, 5, 20);
    const merc = spawnMerc(sim, 'vanguard', 5, 3, 20);
    const mite = spawnMonster(sim, 'mite', 1, 3 + 4, 20);
    mite.aware = true;
    mite.kit.moveSpeed = 0;
    // The merc is held back, so it idles.
    merc.kit.moveSpeed = 0;
    sim.run(1);
    expect(stillFor(merc)).toBeCloseTo(1, 0);
    sim.run(1);
    expect(stillFor(merc)).toBeGreaterThan(1.8);
    // Fighting in place does not reset it; walking does.
    merc.kit.moveSpeed = 3;
    sim.run(0.2);
    expect(stillFor(merc)).toBeLessThan(0.1);
  });

  it('resets when a still unit is pushed, and is 0 for the dead', () => {
    const sim = floor();
    const bearer = spawnBearer(sim, 5, 5);
    bearer.kit.moveSpeed = 0;
    sim.run(1);
    expect(stillFor(bearer)).toBeGreaterThan(0.9);
    bearer.x += 2;
    sim.run(0.05);
    expect(stillFor(bearer)).toBeLessThan(0.1);
    sim.run(1);
    expect(stillFor(bearer)).toBeGreaterThan(0.9);
    bearer.alive = false;
    expect(stillFor(bearer)).toBe(0);
  });

  it('keeps counting while the unit casts in place', () => {
    const sim = floor();
    spawnBearer(sim, 5, 5);
    const merc = spawnMerc(sim, 'vanguard', 5, 8, 8);
    merc.kit.moveSpeed = 0;
    sim.run(0.5);
    merc.mana = merc.derived.maxMana;
    expect(merc.startCast(CHALLENGE, null)).toBe(true);
    sim.run(0.5);
    expect(merc.cast).not.toBeNull();
    expect(stillFor(merc)).toBeGreaterThan(0.9);
  });
});
