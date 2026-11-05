import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { EventPriority } from '../../src/core/event-emitter';
import RNG from '../../src/core/rng';
import ObjectiveRun, { type Pace } from '../../src/game/objective';
import { enterStage, spawnParty } from '../../src/game/stage';
import { generateStage } from '../../src/gen/stage';
import type { Spot } from '../../src/sim/nav';
import { updateWarnings } from '../../src/sim/warning';
import { Hunt } from '../../src/sim/ai';
import { SimEvents } from '../../src/sim/events';
import { RAISE_DEAD, isRaiser, markRaiser } from '../../src/sim/ai/raiser';
import { addRestGuard, layToRest } from '../../src/sim/corpse';
import { raise, raisedBy, wasRaised } from '../../src/sim/raise';
import Sim from '../../src/sim/sim';
import { STUN } from '../../src/sim/statuses';
import { Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const DT = 0.05;

function run(sim: Sim, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    sim.tick(DT);
  }
}

// A bearer far off, a raiser at (10, 10) and a body beside it.
function rig(cap?: number): { sim: Sim; raiser: Unit; body: Unit } {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 60, z1: 40 }]);
  spawnBearer(sim, 50, 30);
  const raiser = spawnMonster(sim, 'cantor', 4, 10, 10);
  raiser.aware = true;
  raiser.hunt = Hunt.Support;
  markRaiser(raiser, {
    cap,
    make: (s, level, x, z) => spawnMonster(s, 'hollowSoldier', level, x, z),
  });
  const body = fall(spawnMonster(sim, 'hollowSoldier', 6, 12, 10));
  return { sim, raiser, body };
}

// A plain killing blow: the body is left whole.
function fall(u: Unit): Unit {
  u.hp = 0;
  u.lastBlow = { value: 1, flags: 0 };
  u.die(null);
  return u;
}

function make(sim: Sim, level: number, x: number, z: number): Unit {
  return spawnMonster(sim, 'hollowSoldier', level, x, z);
}

describe('monster corpses', () => {
  it('stay in the sim until the stage is left', () => {
    const sim = new Sim(1);
    sim.setWorld([{ x0: 0, z0: 0, x1: 60, z1: 40 }]);
    spawnBearer(sim, 50, 30);
    const body = fall(spawnMonster(sim, 'hollowSoldier', 6, 12, 10));
    run(sim, 10);
    expect(sim.units.has(body)).toBe(true);
    expect(body.alive).toBe(false);
  });

  it('marks only the units given a raiser rule', () => {
    const { sim, raiser, body } = rig();
    expect(isRaiser(raiser)).toBe(true);
    expect(isRaiser(body)).toBe(false);
    expect(sim.units.has(body)).toBe(true);
  });
});

describe('raise', () => {
  it('stands a fresh corpse up at its spot with the health share, and the corpse is gone', () => {
    const { sim, raiser, body } = rig();
    const up = raise(raiser, body, { make, share: 0.5 });
    expect(up).not.toBeNull();
    expect(up?.alive).toBe(true);
    expect(up?.side).toBe(Side.Monster);
    expect(up?.x).toBeCloseTo(12, 0);
    expect(up?.level).toBe(4);
    expect(up?.hp).toBeCloseTo((up?.derived.maxHp ?? 0) * 0.5, 5);
    expect(sim.units.has(body)).toBe(false);
    expect(wasRaised(must(up))).toBe(true);
    // A consumed body cannot be raised or revived again
    expect(raise(raiser, body, { make })).toBeNull();
    expect(body.revive(1)).toBe(false);
  });

  it('leaves a torn body alone', () => {
    const { sim, raiser } = rig();
    const torn = spawnMonster(sim, 'hollowSoldier', 6, 12, 12);
    torn.hp = 0;
    torn.lastBlow = { value: torn.derived.maxHp, flags: 0 };
    torn.die(null);
    expect(torn.torn).toBe(true);
    expect(raise(raiser, torn, { make })).toBeNull();
    expect(sim.units.has(torn)).toBe(true);
  });

  it('leaves a body laid to rest, and one a guard forbids', () => {
    const { sim, raiser, body } = rig();
    layToRest(body);
    expect(raise(raiser, body, { make })).toBeNull();
    const other = fall(spawnMonster(sim, 'hollowSoldier', 6, 12, 12));
    const guard = addRestGuard(sim, (u) => u === other);
    guard.start();
    expect(raise(raiser, other, { make })).toBeNull();
    guard.stop();
    expect(raise(raiser, other, { make })).not.toBeNull();
  });

  it('does not raise the body of a unit that was itself raised', () => {
    const { raiser, body } = rig();
    const up = must(raise(raiser, body, { make }));
    fall(up);
    expect(raise(raiser, up, { make })).toBeNull();
  });

  it('can be called with an explicit kind and level', () => {
    const { sim, raiser, body } = rig();
    const up = raise(raiser, body, {
      make: (s, level, x, z) => spawnMonster(s, 'mite', level, x, z),
      level: 9,
    });
    expect(up?.kind).toBe('mite');
    expect(up?.level).toBe(9);
    expect(sim.units.has(must(up))).toBe(true);
  });
});

describe('a raiser', () => {
  it('walks to a body, casts, and raises it', () => {
    const { sim, raiser, body } = rig();
    let deaths = 0;
    sim.on(SimEvents.UnitDies, EventPriority.Post, () => {
      deaths++;
    });
    const before = sim.units.size;
    run(sim, 6);
    expect(sim.units.has(body)).toBe(false);
    expect(raisedBy(raiser)).toHaveLength(1);
    expect(sim.units.size).toBe(before);
    // Consuming the body fires no death
    expect(deaths).toBe(0);
  });

  it('is broken off by a stun, and the body stays', () => {
    const { sim, raiser, body } = rig();
    // Until the cast has begun
    for (let t = 0; t < 3 && raiser.cast === null; t += DT) {
      sim.tick(DT);
    }
    expect(raiser.cast?.skill).toBe(RAISE_DEAD);
    raiser.addStatus(STUN, raiser);
    expect(raiser.cast).toBeNull();
    run(sim, 1);
    expect(sim.units.has(body)).toBe(true);
    expect(raisedBy(raiser)).toHaveLength(0);
  });

  it('shows a ring on the ground while it casts', () => {
    const { sim, raiser } = rig();
    for (let t = 0; t < 3 && raiser.cast === null; t += DT) {
      sim.tick(DT);
    }
    expect(sim.warnings.some((w) => w.source === raiser)).toBe(true);
  });

  it('does not raise past its cap', () => {
    const { sim, raiser } = rig(2);
    for (let i = 0; i < 4; i++) {
      fall(spawnMonster(sim, 'hollowSoldier', 6, 12 + i * 0.5, 12));
    }
    run(sim, 40);
    expect(raisedBy(raiser)).toHaveLength(2);
  });

  it('does not stop mercs from ending a fight with it', () => {
    const sim = new Sim(2);
    sim.setWorld([{ x0: 0, z0: 0, x1: 60, z1: 40 }]);
    spawnBearer(sim, 20, 20);
    spawnMerc(sim, 'vanguard', 8, 22, 20);
    spawnMerc(sim, 'vanguard', 8, 22, 22);
    const raiser = spawnMonster(sim, 'cantor', 3, 25, 20);
    raiser.aware = true;
    markRaiser(raiser, { make });
    fall(spawnMonster(sim, 'hollowSoldier', 3, 27, 22));
    run(sim, 60);
    expect(raiser.alive).toBe(false);
  });
});

describe('a raised unit and a Horde', () => {
  it('is counted among those left, and carries its raiser’s Hunt mark', () => {
    const stage = generateStage(new RNG(2), 10, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'horde',
    });
    const sim = new Sim(1);
    enterStage(sim, stage);
    const bearer = spawnParty(sim, stage, []);
    bearer.x = stage.entrance.x + 8;
    const objective = new ObjectiveRun('horde', stage);
    const left = (): number => Number(/(\d+) left/.exec(objective.status(sim))?.[1]);
    const at: Spot = { x: stage.width - 6, z: 4 };
    const pace: Pace = { calm: () => false, share: () => 1, spawnAt: () => at };
    for (let t = 0; t < 4; t += DT) {
      objective.update(sim, DT, 12, pace);
      updateWarnings(sim, DT);
    }
    const wave = sim.living(Side.Monster);
    expect(wave.length).toBeGreaterThan(2);
    const [raiser, victim] = wave;
    raiser.marked = true;
    markRaiser(raiser, { make });
    const before = left();
    fall(victim);
    expect(left()).toBe(before - 1);
    const up = must(raise(raiser, victim, { make }));
    expect(left()).toBe(before);
    expect(up.marked).toBe(true);
    // Once it dies it is counted gone
    fall(up);
    expect(left()).toBe(before - 1);
  });
});

function must(u: Unit | null | undefined): Unit {
  if (!u) {
    throw new Error('no unit');
  }
  return u;
}
