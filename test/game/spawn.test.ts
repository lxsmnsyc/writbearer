import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import { enterStage } from '../../src/game/stage';
import { OBJECTIVES } from '../../src/gen/graph';
import { generateStage } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';
import { Side } from '../../src/sim/types';

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
            expect(sim.nav!.walkable(m.x, m.z)).toBe(true);
          }
        }
      }
    }
    expect(altars).toBeGreaterThan(0);
  });
});
