import { describe, expect, it } from 'vitest';
import {
  spawnBearer,
  spawnDisguisedAssassin,
  spawnMerc,
  spawnMonster,
  spawnRefugee,
} from '../../src/content/roster';
import RNG from '../../src/core/rng';
import { assassinAmong } from '../../src/game/stage';
import { type Stage, generateStage } from '../../src/gen/stage';
import { reveal } from '../../src/sim/concealment';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { canTarget } from '../../src/sim/targeting';
import { Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { Hunt } from '../../src/sim/ai';

const DT = 0.05;

function field(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

function run(sim: Sim, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    sim.tick(DT);
  }
}

function hiddenMonster(sim: Sim, x: number, z: number): Unit {
  const m = spawnMonster(sim, 'hollowArcher', 5, x, z);
  m.hidden = true;
  m.aware = true;
  return m;
}

describe('hidden units', () => {
  it('are ignored by mercs until revealed', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const m = hiddenMonster(sim, 14, 10);
    // It stands and does nothing, so the only question is whether mercs pick it
    m.still = true;
    expect(canTarget(merc, m)).toBe(false);
    run(sim, 2);
    expect(merc.target).toBeNull();
    expect(m.hp).toBe(m.derived.maxHp);
  });

  it('are revealed when they strike', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const m = spawnMonster(sim, 'hollowSoldier', 5, 13, 10);
    m.hidden = true;
    m.aware = true;
    const seen: Unit[] = [];
    sim.on(SimEvents.UnitRevealed, 0, (e) => {
      seen.push(e.source);
    });
    run(sim, 3);
    expect(m.hidden).toBe(false);
    expect(seen).toEqual([m]);
    expect(merc.hp).toBeLessThan(merc.derived.maxHp);
  });

  it('are revealed by reveal(), which makes them targetable and tells the sim', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const m = hiddenMonster(sim, 30, 30);
    const events: { source: Unit; by: Unit | null }[] = [];
    sim.on(SimEvents.UnitRevealed, 0, (e) => {
      events.push({ source: e.source, by: e.by });
    });
    reveal(m, merc);
    expect(canTarget(merc, m)).toBe(true);
    expect(events).toEqual([{ source: m, by: merc }]);
    // Revealing twice says nothing more
    reveal(m, merc);
    expect(events).toHaveLength(1);
  });

  it('are revealed when area damage hits them', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const m = hiddenMonster(sim, 30, 30);
    merc.hit(m, { ratio: 100 });
    expect(m.hidden).toBe(false);
  });
});

describe('the disguised assassin', () => {
  it('is a refugee until it turns, then hunts the bearer', () => {
    const sim = field();
    const bearer = spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 8, 10);
    const a = spawnDisguisedAssassin(sim, 5, 11, 10);
    spawnRefugee(sim, 5, 12, 10);
    expect(a.side).toBe(Side.Ward);
    expect(a.disguise).toBe('refugee');
    expect(a.name).toBe('Refugee');
    // Nobody fights it while it walks with the others
    expect(canTarget(merc, a)).toBe(false);
    run(sim, 5);
    expect(a.side).toBe(Side.Ward);
    expect(a.disguise).toBe('refugee');
    // It turns once its time comes, and is then a monster like the others
    for (let t = 0; t < 15 && a.side === Side.Ward; t += DT) {
      sim.tick(DT);
    }
    expect(a.disguise).toBeNull();
    expect(a.side).toBe(Side.Monster);
    expect(a.name).toBe('Assassin');
    expect(a.hunt).toBe(Hunt.Assassin);
    expect(canTarget(merc, a)).toBe(true);
    // And it goes for the bearer
    sim.tick(DT);
    expect(a.target).toBe(bearer);
  });

  it('turns when it is hurt', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 8, 10);
    const a = spawnDisguisedAssassin(sim, 5, 11, 10);
    merc.hit(a, { ratio: 100 });
    expect(a.side).toBe(Side.Monster);
  });
});

describe('which Escort hides an assassin', () => {
  const escort = (seed: number, index: number): Stage =>
    generateStage(new RNG(seed), index, { kind: 'combat', ahead: ['combat'], objective: 'escort' });

  it('is the same for the same stage and lands about one Escort in four', () => {
    let hit = 0;
    let total = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const stage = escort(seed, (seed % 12) + 1);
      const n = stage.refugees?.length ?? 0;
      if (n === 0) {
        continue;
      }
      total++;
      const pick = assassinAmong(stage, n);
      // Regenerating each stage doubles the cost, so repeat it for every fourth seed
      if (seed % 4 === 0) {
        expect(assassinAmong(escort(seed, (seed % 12) + 1), n)).toBe(pick);
      }
      expect(pick).toBeLessThan(n);
      if (pick >= 0) {
        hit++;
      }
    }
    expect(total).toBeGreaterThan(100);
    expect(hit / total).toBeGreaterThan(0.18);
    expect(hit / total).toBeLessThan(0.32);
  });
});
