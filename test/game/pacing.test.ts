import { describe, expect, it } from 'vitest';
import { spawnBearer } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import Director, { waveShare } from '../../src/game/director';
import ObjectiveRun, { type Pace } from '../../src/game/objective';
import { enterStage, spawnParty } from '../../src/game/stage';
import { type Stage, generateStage, navFor, rectOf } from '../../src/gen/stage';
import Flow from '../../src/sim/flow';
import type { Spot } from '../../src/sim/nav';
import Sim from '../../src/sim/sim';
import { Side } from '../../src/sim/types';
import { updateWarnings } from '../../src/sim/warning';

const DT = 0.05;

function horde(): { sim: Sim; stage: Stage; run: ObjectiveRun } {
  const stage = generateStage(new RNG(2), 10, {
    kind: 'combat',
    ahead: ['combat'],
    objective: 'horde',
  });
  const sim = new Sim(1);
  enterStage(sim, stage);
  const bearer = spawnParty(sim, stage, []);
  // Past the entrance, so the Horde begins
  bearer.x = stage.entrance.x + 8;
  return { sim, stage, run: new ObjectiveRun('horde', stage) };
}

function play(sim: Sim, run: ObjectiveRun, seconds: number, pace: Pace): void {
  for (let t = 0; t < seconds; t += DT) {
    run.update(sim, DT, 12, pace);
    updateWarnings(sim, DT);
  }
}

describe('a wave paced by the director', () => {
  it('is smaller the sooner it follows the last, and full after half a minute', () => {
    expect(waveShare(0)).toBeCloseTo(0.6);
    expect(waveShare(15)).toBeCloseTo(0.8);
    expect(waveShare(30)).toBe(1);
    expect(waveShare(90)).toBe(1);
  });

  it('waits out a lull, then comes as big as the director lets it, from where it chooses', () => {
    const { sim, stage, run } = horde();
    const at: Spot = { x: stage.width - 6, z: 4 };
    let calm = true;
    const pace: Pace = { calm: () => calm, share: () => 0.5, spawnAt: () => at };
    play(sim, run, 10, pace);
    expect(sim.warnings).toHaveLength(0);
    expect(run.status(sim)).toContain('gathering');
    calm = false;
    play(sim, run, DT, pace);
    expect(sim.warnings).toHaveLength(1);
    expect(sim.warnings[0].x).toBe(at.x);
    play(sim, run, 3.2, pace);
    const wave = stage.waves![0].kinds;
    expect(sim.living(Side.Monster)).toHaveLength(Math.ceil(wave.length * 0.5));
  });
});

describe('where the director sends a wave', () => {
  it('is out of the party’s sight, not too near it, mostly from behind, and not twice running', () => {
    const stage = generateStage(new RNG(5), 10, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'horde',
    });
    const sim = new Sim(1);
    enterStage(sim, stage);
    const bearer = spawnParty(sim, stage, []);
    const nav = navFor(stage);
    const flow = new Flow(rectOf(stage), stage.entrance, (x, z) => nav.walkable(x, z));
    // The bearer halfway across
    const mid = stage
      .spots!.filter((p) => p.kind === 'spawn')
      .sort((a, b) => flow.at(a) - flow.at(b));
    const stand = nav.free(stage.width / 2, stage.depth / 2);
    bearer.x = stand.x;
    bearer.z = stand.z;
    const director = new Director(sim, new RNG(9));
    director.beginArea(stage.spots, flow);
    const here = flow.at(bearer);
    let behind = 0;
    let last: Spot | null = null;
    const fallback = { x: -1, z: -1 };
    for (let i = 0; i < 40; i++) {
      const p = director.spawnAt(fallback);
      expect(p).not.toBe(fallback);
      expect(mid).toContain(p);
      expect(bearer.distanceTo(p)).toBeGreaterThanOrEqual(8);
      expect(bearer.distanceTo(p) > 9 || !sim.sees(bearer, p)).toBe(true);
      expect(p).not.toBe(last);
      last = p;
      if (flow.at(p) <= here) {
        behind++;
      }
    }
    expect(behind).toBeGreaterThan(20);
  });

  it('falls back when no spot will do', () => {
    const sim = new Sim(1);
    sim.setWorld([{ x0: 0, z0: 0, x1: 20, z1: 20 }]);
    spawnBearer(sim, 5, 5);
    const director = new Director(sim, new RNG(1));
    director.beginArea([{ kind: 'spawn', x: 6, z: 5 }], null);
    const fallback = { x: 1, z: 1 };
    expect(director.spawnAt(fallback)).toBe(fallback);
  });
});
