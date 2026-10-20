import { describe, expect, it } from 'vitest';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import ObjectiveRun from '../../src/game/objective';
import { enterStage, spawnParty } from '../../src/game/stage';
import { generateLayerMap } from '../../src/gen/graph';
import { placeStage } from '../../src/gen/place';
import { type Stage, floorOf, generateStage, rectOf } from '../../src/gen/stage';
import { inRect } from '../../src/sim/nav';
import Sim from '../../src/sim/sim';
import { Side } from '../../src/sim/types';

const DT = 0.05;

const collapse = (seed: number, index = 10): Stage =>
  generateStage(new RNG(seed), index, {
    kind: 'combat',
    ahead: ['combat'],
    objective: 'collapse',
  });

describe('a Collapse', () => {
  it('is rolled on the Rift Road only', () => {
    const rolled = (depth: number): boolean =>
      Array.from({ length: 30 }, (_, seed) => generateLayerMap(new RNG(seed + 1), 2, false, depth))
        .flatMap((m) => m.columns.flat())
        .some((n) => n.objective === 'collapse');
    expect([0, 1, 2, 3].map(rolled)).toEqual([false, true, false, false]);
  });

  it('falls from the entrance’s edge and stops short of every exit', () => {
    for (let seed = 1; seed <= 16; seed++) {
      const s = collapse(seed);
      const c = s.collapse!;
      expect(c.dir).toEqual({ x: 1, z: 0 });
      for (const e of s.exits) {
        expect(e.x).toBeGreaterThan(c.stop + 2);
      }
    }
  });

  it('turns with its area as it is laid in the world', () => {
    const s = placeStage(collapse(2), { x: 0, z: 1 }, { x: 100, z: 100 });
    const c = s.collapse!;
    expect(c.dir).toEqual({ x: 0, z: 1 });
    c.front = 5;
    const all = rectOf(s);
    expect(floorOf(s)).toEqual({ ...all, z0: all.z0 + 5 });
  });

  it('waits for the bearer to move on, then takes the floor and whoever is on it', () => {
    const s = collapse(3);
    const sim = new Sim(1);
    enterStage(sim, s);
    const bearer = spawnParty(sim, s, []);
    for (const m of sim.living(Side.Monster)) {
      sim.units.delete(m);
    }
    const run = new ObjectiveRun('collapse', s);
    const step = (seconds: number): void => {
      for (let t = 0; t < seconds; t += DT) {
        run.update(sim, DT, 12);
      }
    };
    step(10);
    expect(s.collapse!.front).toBe(0);
    expect(run.status(sim)).toContain('once the bearer moves on');
    bearer.x = s.entrance.x + 10;
    const merc = spawnMerc(sim, 'vanguard', 5, 1.2, s.depth / 2);
    const monster = spawnMonster(sim, 'husk', 5, 1.2, s.depth / 2 + 3);
    step(8);
    const c = s.collapse!;
    expect(c.front).toBeGreaterThan(2);
    expect(sim.floor[0].x0).toBe(floorOf(s).x0);
    expect(sim.units.has(monster)).toBe(false);
    expect(inRect(floorOf(s), merc)).toBe(true);
    expect(merc.hp).toBeLessThan(merc.derived.maxHp);
    expect(run.done).toBe(false);
    const exit = s.exits[0];
    bearer.x = exit.x - 1;
    bearer.z = exit.z;
    step(DT);
    expect(run.done).toBe(true);
    const front = c.front;
    step(5);
    expect(c.front).toBe(front);
  });
});
