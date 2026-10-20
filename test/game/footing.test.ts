import { describe, expect, it } from 'vitest';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import Footing from '../../src/game/footing';
import { type Stage, generateStage } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';

// An empty field, its ground laid by hand
function bare(): { sim: Sim; stage: Stage } {
  const stage = generateStage(new RNG(1), 2, { kind: 'combat', ahead: ['combat'] });
  stage.props = [];
  stage.patches = [];
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: stage.width, z1: stage.depth }]);
  return { sim, stage };
}

describe('the ground of an open field', () => {
  it('slows anyone wading through water, party and monsters alike, and only there', () => {
    const { sim, stage } = bare();
    stage.patches = [{ kind: 'water', x: 10, z: 10, r: 3 }];
    const merc = spawnMerc(sim, 'vanguard', 5, 10, 10);
    const monster = spawnMonster(sim, 'husk', 5, 11, 10);
    const dry = spawnMonster(sim, 'husk', 5, 20, 10);
    const pace = [merc.speed, monster.speed, dry.speed];
    new Footing().update(sim, 0.05, [stage]);
    expect(merc.speed).toBeLessThan(pace[0]);
    expect(monster.speed).toBeLessThan(pace[1]);
    expect(dry.speed).toBe(pace[2]);
  });

  it('burns anyone standing in embers once a second', () => {
    const { sim, stage } = bare();
    stage.patches = [{ kind: 'embers', x: 10, z: 10, r: 2 }];
    const monster = spawnMonster(sim, 'husk', 5, 10, 10);
    const footing = new Footing();
    const full = monster.hp;
    for (let t = 0; t < 0.9; t += 0.05) {
      footing.update(sim, 0.05, [stage]);
    }
    expect(monster.hp).toBe(full);
    for (let t = 0; t < 2.2; t += 0.05) {
      footing.update(sim, 0.05, [stage]);
    }
    expect(monster.hp).toBeLessThan(full);
    expect(full - monster.hp).toBeLessThan(full * 0.2);
  });

  it('mends the party around a blossom as one of them walks into it, once', () => {
    const { sim, stage } = bare();
    stage.props = [{ kind: 'blossom', x: 10, z: 10, seed: 0.5 }];
    const near = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const far = spawnMerc(sim, 'ranger', 5, 20, 10);
    for (const m of [near, far]) {
      m.hp = Math.round(m.derived.maxHp / 2);
    }
    const footing = new Footing();
    expect(footing.update(sim, 0.05, [stage])).toHaveLength(0);
    const by = spawnMerc(sim, 'cleric', 5, 10.3, 10);
    by.hp = 1;
    expect(footing.update(sim, 0.05, [stage])).toHaveLength(1);
    expect(near.hp).toBeGreaterThan(near.derived.maxHp / 2);
    expect(by.hp).toBeGreaterThan(1);
    expect(far.hp).toBe(Math.round(far.derived.maxHp / 2));
    const after = near.hp;
    near.hp = Math.round(near.derived.maxHp / 2);
    expect(footing.update(sim, 0.05, [stage])).toHaveLength(0);
    expect(after).toBeGreaterThan(near.hp);
  });
});
