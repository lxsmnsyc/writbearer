import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { CURSED, FRIGHTENED, curse, dispel, frighten } from '../../src/sim/afflict';
import Sim from '../../src/sim/sim';
import { MENDING, SHIELD_WALL, STUN } from '../../src/sim/statuses';
import { Rank } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const DT = 0.05;

function world(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 60, z1: 40 }]);
  return sim;
}

function run(sim: Sim, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    sim.tick(DT);
  }
}

describe('frighten', () => {
  it('skips a boss, an elite, the bearer and the dead', () => {
    const sim = world();
    const bearer = spawnBearer(sim, 30, 20);
    const merc = spawnMerc(sim, 'vanguard', 5, 20, 20);
    const mite = spawnMonster(sim, 'mite', 4, 24, 20);
    const elite = spawnMonster(sim, 'mite', 4, 24, 22, { elite: true });
    const boss = spawnMonster(sim, 'mite', 4, 24, 18);
    boss.rank = Rank.Boss;
    const dead = spawnMonster(sim, 'mite', 4, 26, 20);
    dead.alive = false;
    const given = frighten(merc, [mite, elite, boss, dead, bearer], 3);
    expect(given.map((s) => s.unit)).toEqual([mite]);
    expect(elite.statuses.has(FRIGHTENED.id)).toBe(false);
    expect(boss.statuses.has(FRIGHTENED.id)).toBe(false);
    expect(bearer.statuses.has(FRIGHTENED.id)).toBe(false);
  });

  it('makes a mite run from the source, then return to fight', () => {
    const sim = world();
    spawnBearer(sim, 55, 35);
    const merc = spawnMerc(sim, 'vanguard', 5, 20, 20);
    const mite = spawnMonster(sim, 'mite', 4, 23, 20);
    merc.still = true;
    mite.aware = true;
    frighten(merc, [mite], 2);
    const start = mite.distanceTo(merc);
    run(sim, 1);
    expect(mite.distanceTo(merc)).toBeGreaterThan(start + 0.3);
    expect(mite.statuses.has(FRIGHTENED.id)).toBe(true);
    run(sim, 1.5);
    expect(mite.statuses.has(FRIGHTENED.id)).toBe(false);
    const far = mite.distanceTo(merc);
    merc.hp = merc.derived.maxHp;
    run(sim, 3);
    expect(mite.distanceTo(merc)).toBeLessThan(far);
  });

  it('shrinks the time with WIL', () => {
    const sim = world();
    const merc = spawnMerc(sim, 'vanguard', 5, 20, 20);
    const weak = spawnMonster(sim, 'mite', 4, 24, 20);
    const strong = spawnMonster(sim, 'mite', 4, 24, 22);
    strong.base.wil += 20;
    const [a, b] = frighten(merc, [weak, strong], 4);
    expect(a.remaining).toBeGreaterThan(b.remaining);
  });

  it('is refused by a Dread-immune unit', () => {
    const sim = world();
    const merc = spawnMerc(sim, 'vanguard', 5, 20, 20);
    const mite = spawnMonster(sim, 'mite', 4, 24, 20);
    mite.immunity.set('dread', 3);
    expect(frighten(merc, [mite], 3)).toEqual([]);
  });
});

describe('curse', () => {
  function curseOf(source: Unit, target: Unit, amount: number): boolean {
    return curse(source, target, amount, false);
  }

  it('lowers attack and healing received, then ends on time', () => {
    const sim = world();
    const merc = spawnMerc(sim, 'vanguard', 5, 20, 20);
    const mite = spawnMonster(sim, 'mite', 4, 24, 20);
    const before = mite.derived.atkMax;
    expect(curseOf(merc, mite, 1000)).toBe(true);
    expect(mite.derived.atkMax).toBeLessThan(before * 0.8);
    mite.hp = 1;
    const ev = merc.heal(mite, 20);
    expect(ev.value).toBeCloseTo(10);
    run(sim, 8.5);
    expect(mite.statuses.has(CURSED.id)).toBe(false);
    expect(mite.derived.atkMax).toBe(before);
  });

  it('is resisted by WIL', () => {
    const sim = world();
    const merc = spawnMerc(sim, 'vanguard', 5, 20, 20);
    const frail = spawnMonster(sim, 'mite', 4, 24, 20);
    const stout = spawnMonster(sim, 'mite', 4, 24, 22);
    frail.base.wil = 0;
    stout.base.wil = 30;
    const need = (u: Unit): number => CURSED.threshold?.(u) ?? 0;
    expect(need(stout)).toBeGreaterThan(need(frail));
    const amount = need(frail);
    expect(curseOf(merc, frail, amount)).toBe(true);
    expect(curseOf(merc, stout, amount)).toBe(false);
  });

  it('can be given directly, shorter against high WIL', () => {
    const sim = world();
    const merc = spawnMerc(sim, 'vanguard', 5, 20, 20);
    const mite = spawnMonster(sim, 'mite', 4, 24, 20);
    expect(curse(merc, mite, 1, true)).toBe(true);
    expect(mite.statuses.get(CURSED.id)?.remaining).toBeLessThanOrEqual(CURSED.duration);
  });
});

describe('dispel', () => {
  it('strips buffs in order but not Stun', () => {
    const sim = world();
    const merc = spawnMerc(sim, 'vanguard', 5, 20, 20);
    const mite = spawnMonster(sim, 'mite', 4, 24, 20);
    mite.addStatus(MENDING, merc);
    mite.addStatus(SHIELD_WALL, merc);
    mite.addStatus(STUN, merc);
    const taken = dispel(mite);
    expect(taken.map((s) => s.def)).toEqual([MENDING, SHIELD_WALL]);
    expect(mite.statuses.has(STUN.id)).toBe(true);
    expect(mite.statuses.has(MENDING.id)).toBe(false);
    expect(mite.statuses.has(SHIELD_WALL.id)).toBe(false);
  });

  it('takes up to count and runs the stop hooks', () => {
    const sim = world();
    const merc = spawnMerc(sim, 'vanguard', 5, 20, 20);
    const mite = spawnMonster(sim, 'mite', 4, 24, 20);
    mite.addStatus(SHIELD_WALL, merc);
    mite.addStatus(MENDING, merc);
    const taken = dispel(mite, 1);
    expect(taken.map((s) => s.def)).toEqual([SHIELD_WALL]);
    expect(mite.statuses.has(MENDING.id)).toBe(true);
    expect(taken[0]?.lifecycle).not.toBeNull();
  });
});
