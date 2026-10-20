import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import ObjectiveRun, { WAVE_WARNING } from '../../src/game/objective';
import { enterStage, spawnParty } from '../../src/game/stage';
import { generateLayerMap } from '../../src/gen/graph';
import { RITE_TIME, type Stage, generateStage, navFor } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';
import { Side } from '../../src/sim/types';
import { updateWarnings } from '../../src/sim/warning';

const DT = 0.05;
const LEVEL = 20;

const ritual = (seed: number, index = 18): Stage =>
  generateStage(new RNG(seed), index, { kind: 'combat', ahead: ['combat'], objective: 'ritual' });

describe('a Ritual', () => {
  it('is rolled from the Undercroft down, and never above', () => {
    const rolled = (depth: number): boolean =>
      Array.from({ length: 30 }, (_, seed) => generateLayerMap(new RNG(seed + 1), 2, false, depth))
        .flatMap((m) => m.columns.flat())
        .some((n) => n.objective === 'ritual');
    expect(rolled(0)).toBe(false);
    expect(rolled(1)).toBe(false);
    expect(rolled(2)).toBe(true);
    expect(rolled(3)).toBe(true);
  });

  it('lays three sigils across the field, west to east, each reachable, with two waves each', () => {
    for (let seed = 1; seed <= 16; seed++) {
      for (const index of [18, 26]) {
        const s = ritual(seed, index);
        const rites = s.rites ?? [];
        expect(rites).toHaveLength(3);
        expect(rites[0].x).toBeLessThan(rites[1].x);
        expect(rites[1].x).toBeLessThan(rites[2].x);
        expect(s.waves).toHaveLength(6);
        expect(s.packs).toHaveLength(0);
        const nav = navFor(s);
        for (const r of rites) {
          const end = nav.path(s.entrance, r).at(-1)!;
          expect(Math.hypot(end.x - r.x, end.z - r.z), `${seed} ${index}`).toBeLessThan(1);
        }
      }
    }
  });

  it('breaks each sigil once the bearer has stood on it long enough, and calls a wave on and halfway', () => {
    const s = ritual(3);
    const sim = new Sim(1);
    enterStage(sim, s);
    const bearer = spawnParty(sim, s, []);
    const run = new ObjectiveRun('ritual', s);
    const rites = s.rites!;
    const step = (seconds: number): void => {
      for (let t = 0; t < seconds; t += DT) {
        run.update(sim, DT, LEVEL);
        updateWarnings(sim, DT);
      }
    };
    // Off the sigil, nothing happens.
    step(2);
    expect(rites[0].held).toBe(0);
    expect(sim.warnings).toHaveLength(0);
    bearer.x = rites[0].x;
    bearer.z = rites[0].z;
    step(DT);
    expect(sim.warnings).toHaveLength(1);
    step(WAVE_WARNING + 0.2);
    const first = sim.living(Side.Monster).length;
    expect(first).toBe(s.waves![0].kinds.length);
    // Stepping off pauses it, and keeps what was done.
    bearer.x += 6;
    const held = rites[0].held;
    step(3);
    expect(rites[0].held).toBe(held);
    bearer.x = rites[0].x;
    step(RITE_TIME - held + 0.2);
    expect(rites[0].broken).toBe(true);
    expect(sim.living(Side.Monster).length + sim.warnings.length).toBeGreaterThan(first);
    expect(run.done).toBe(false);
    expect(run.status(sim)).toContain('1 of 3');
    for (const r of rites.slice(1)) {
      bearer.x = r.x;
      bearer.z = r.z;
      step(RITE_TIME + 0.2);
    }
    expect(run.done).toBe(true);
  });
});
