import { describe, expect, it } from 'vitest';
import { spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import Captains, { CALLS, CALL_EVERY, FIRST_CALL } from '../../src/game/captains';
import { enterStage } from '../../src/game/stage';
import { generateStage } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';
import { DamageFlags, DamageKind, Side } from '../../src/sim/types';

const DT = 0.05;

// A field with one captain in it, already in the fight, and no one else
function lone(): { sim: Sim; captain: ReturnType<typeof spawnMonster> } {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  const captain = spawnMonster(sim, 'hollowSoldier', 6, 20, 20);
  captain.calls = ['husk', 'husk', 'husk'];
  captain.aware = true;
  return { sim, captain };
}

function run(sim: Sim, captains: Captains, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    captains.update(sim, DT);
    sim.tick(DT);
  }
}

describe('a captain', () => {
  it('leads the lair from the third area, and in any Elite area', () => {
    const captained = (index: number, kind: 'combat' | 'elite'): boolean[] =>
      Array.from({ length: 8 }, (_, seed) => {
        const s = generateStage(new RNG(seed + 1), index, { kind, ahead: ['combat'] });
        return s.packs[1].captain === 0;
      });
    expect(captained(0, 'combat').some(Boolean)).toBe(false);
    expect(captained(0, 'elite').every(Boolean)).toBe(true);
    expect(captained(3, 'combat').every(Boolean)).toBe(true);
  });

  it('is given followers from its own pack as the area is entered', () => {
    const stage = generateStage(new RNG(3), 3, { kind: 'combat', ahead: ['combat'] });
    const sim = new Sim(1);
    enterStage(sim, stage);
    const captains = sim.living(Side.Monster).filter((m) => m.calls.length > 0);
    expect(captains.length).toBeGreaterThanOrEqual(1);
    const pack = stage.packs[1].kinds;
    for (const k of captains[0].calls) {
      expect(pack).toContain(k);
    }
  });

  it('calls its followers on a beat once in the fight, a few times and no more', () => {
    const { sim } = lone();
    const captains = new Captains();
    const count = (): number => sim.living(Side.Monster).length;
    run(sim, captains, FIRST_CALL - 0.5);
    expect(count()).toBe(1);
    run(sim, captains, 2);
    expect(count()).toBe(4);
    expect(sim.living(Side.Monster).every((m) => m.aware)).toBe(true);
    run(sim, captains, CALL_EVERY * (CALLS + 2));
    expect(count()).toBe(1 + 3 * CALLS);
  });

  it('calls no one while unaware, nor once it dies, even mid-call', () => {
    const { sim, captain } = lone();
    captain.aware = false;
    const captains = new Captains();
    run(sim, captains, FIRST_CALL + 2);
    expect(sim.living(Side.Monster)).toHaveLength(1);
    captain.aware = true;
    run(sim, captains, FIRST_CALL + 0.3);
    expect(sim.warnings).toHaveLength(1);
    captain.hit(captain, {
      kind: DamageKind.True,
      fixed: captain.derived.maxHp * 2,
      flags: DamageFlags.Redirected,
    });
    run(sim, captains, CALL_EVERY * 2);
    expect(sim.living(Side.Monster)).toHaveLength(0);
  });
});
