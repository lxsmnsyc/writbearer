import { describe, expect, it } from 'vitest';
import { spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import ObjectiveRun from '../../src/game/objective';
import { enterStage, spawnParty } from '../../src/game/stage';
import { generateLayerMap } from '../../src/gen/graph';
import { type Stage, generateStage, monsterLevel } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';
import { DamageFlags, DamageKind, Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const DT = 0.05;

function escort(elite = false): { sim: Sim; stage: Stage; bearer: Unit; run: ObjectiveRun } {
  const stage = generateStage(new RNG(4), 3, {
    kind: elite ? 'elite' : 'combat',
    ahead: ['combat'],
    objective: 'escort',
  });
  const sim = new Sim(1);
  enterStage(sim, stage);
  const bearer = spawnParty(sim, stage, []);
  return { sim, stage, bearer, run: new ObjectiveRun('escort', stage) };
}

const kill = (u: Unit): void => {
  u.hit(u, { kind: DamageKind.True, fixed: u.derived.maxHp * 2, flags: DamageFlags.Redirected });
};

describe('an Escort', () => {
  it('is rolled on the Marches and the Rift Road only', () => {
    const rolled = (depth: number): boolean =>
      Array.from({ length: 30 }, (_, seed) => generateLayerMap(new RNG(seed + 1), 2, false, depth))
        .flatMap((m) => m.columns.flat())
        .some((n) => n.objective === 'escort');
    expect(rolled(0)).toBe(true);
    expect(rolled(1)).toBe(true);
    expect(rolled(2)).toBe(false);
    expect(rolled(3)).toBe(false);
  });

  it('has five refugees by the entrance, six in an Elite area, who are not of the party', () => {
    const { sim, stage } = escort();
    expect(stage.refugees).toHaveLength(5);
    expect(escort(true).stage.refugees).toHaveLength(6);
    const wards = sim.living(Side.Ward);
    expect(wards).toHaveLength(5);
    expect(sim.living(Side.Party).some((u) => u.kind === 'refugee')).toBe(false);
    for (const w of wards) {
      expect(Math.hypot(w.x - stage.entrance.x, w.z - stage.entrance.z)).toBeLessThan(5);
    }
  });

  it('is done once the bearer brings at least half of them to an exit, and they go', () => {
    const { sim, stage, bearer, run } = escort();
    const wards = sim.living(Side.Ward);
    kill(wards[0]);
    kill(wards[1]);
    run.update(sim, DT, monsterLevel(3));
    expect(run.done).toBe(false);
    const exit = stage.exits[0];
    bearer.x = exit.x - 1;
    bearer.z = exit.z;
    for (const w of wards.slice(2)) {
      w.x = exit.x - 2;
      w.z = exit.z;
    }
    expect(run.update(sim, DT, monsterLevel(3))).toBe(true);
    expect(run.failed).toBe(false);
    expect(sim.living(Side.Ward)).toHaveLength(0);
  });

  it('fails once fewer than half are left, opening the way but owing nothing', () => {
    const { sim, run } = escort();
    run.update(sim, DT, monsterLevel(3));
    const wards = sim.living(Side.Ward);
    wards.slice(0, 3).forEach(kill);
    expect(run.update(sim, DT, monsterLevel(3))).toBe(true);
    expect(run.failed).toBe(true);
    expect(run.status(sim)).toContain('nothing is owed');
  });

  it('keeps its refugees waiting until the bearer comes, then they follow', () => {
    const { sim, stage, bearer } = escort();
    for (const m of sim.living(Side.Monster)) {
      sim.units.delete(m);
    }
    const ward = sim.living(Side.Ward)[0];
    const start = { x: ward.x, z: ward.z };
    bearer.x = stage.entrance.x + 20;
    for (let t = 0; t < 2; t += DT) {
      sim.tick(DT);
    }
    expect(Math.hypot(ward.x - start.x, ward.z - start.z)).toBeLessThan(0.3);
    bearer.x = ward.x + 4;
    bearer.z = ward.z;
    for (let t = 0; t < 1; t += DT) {
      sim.tick(DT);
    }
    bearer.x = ward.x + 10;
    for (let t = 0; t < 6; t += DT) {
      sim.tick(DT);
    }
    expect(ward.distanceTo(bearer)).toBeLessThan(3);
  });

  it('draws monsters to its refugees, as to the party', () => {
    const { sim, stage, bearer } = escort();
    for (const m of sim.living(Side.Monster)) {
      sim.units.delete(m);
    }
    bearer.x = stage.entrance.x + 30;
    const ward = sim.living(Side.Ward)[0];
    const m = spawnMonster(sim, 'husk', 5, ward.x + 1.5, ward.z);
    m.aware = true;
    for (let t = 0; t < 0.5; t += DT) {
      sim.tick(DT);
    }
    expect(m.target?.side).toBe(Side.Ward);
  });
});
