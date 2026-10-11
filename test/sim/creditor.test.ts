import { describe, expect, it } from 'vitest';
import { COLLECT, SOUL_SHARE, reveal } from '../../src/content/creditor';
import type { Offer } from '../../src/content/recruits';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { learn, treeFor } from '../../src/content/trees';
import { RunStreams, Stream } from '../../src/core/seed';
import { generateTomb } from '../../src/gen/stage';
import { Morale, moraleOf } from '../../src/sim/morale';
import Sim from '../../src/sim/sim';
import { DamageKind, Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

function spendAll(m: Unit): void {
  for (let pass = 0; pass < 40 && m.skillPoints > 0; pass++) {
    for (const branch of treeFor(m)) {
      for (const node of branch.nodes) {
        if (m.skillPoints > 0) {
          learn(m, branch, node);
        }
      }
    }
  }
}

const killed = (sim: Sim, m: Unit, blow: number): void => {
  spawnMonster(sim, 'mite', 1, 29, 23).hit(m, { kind: DamageKind.True, fixed: blow });
};

// Four level 32 mercs against the level 36 Creditor, `dead` of them lying
// dead at the reveal. Returns whether the Creditor fell.
function fight(seed: number, dead: number, souls: number): boolean {
  const sim = new Sim(seed);
  sim.setFloor(30, 24);
  const bearer = spawnBearer(sim, 15, 12);
  const jobs: Offer['kind'][] = ['vanguard', 'ranger', 'cleric', 'ranger'];
  const mercs = jobs.map((job, i) => {
    const m = spawnMerc(sim, job, 32, 13 + (i % 2) * 4, 10 + i);
    spendAll(m);
    return m;
  });
  for (const m of mercs.slice(0, dead)) {
    m.hp = 1;
    killed(sim, m, 1);
  }
  const r = reveal(sim, bearer, 36, souls);
  sim.run(300, () => !r.creditor.alive || sim.living(Side.Party).length === 0);
  return !r.creditor.alive;
}

const SEEDS = [1, 2, 3, 4, 5, 6];

describe('the seal breaking', () => {
  it('turns the bearer into the Creditor, stronger for every soul', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 10, 10);
    const plain = reveal(sim, bearer, 36, 0).creditor;
    const sim2 = new Sim(1);
    const fed = reveal(sim2, spawnBearer(sim2, 10, 10), 36, 5).creditor;
    expect(sim.bearer).toBeNull();
    expect(sim.units.has(bearer)).toBe(false);
    expect(plain.side).toBe(Side.Monster);
    expect(plain.x).toBe(10);
    expect(plain.skills).toContain(COLLECT);
    expect(fed.derived.maxHp).toBeGreaterThan(
      plain.derived.maxHp * (1 + (SOUL_SHARE * 5) / 100) - 2,
    );
  });

  it('raises the dead to its side, but not the torn, and the cowardly at low heart run', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 10, 10);
    const living = spawnMerc(sim, 'vanguard', 10, 11, 10);
    const dead = spawnMerc(sim, 'ranger', 10, 9, 10);
    const torn = spawnMerc(sim, 'ranger', 10, 10, 11);
    const coward = spawnMerc(sim, 'vanguard', 10, 10, 9, undefined, { traits: ['cowardly'] });
    dead.hp = 1;
    killed(sim, dead, 1);
    killed(sim, torn, 100000);
    coward.morale = 20;
    expect(moraleOf(coward)).toBe(Morale.Low);
    const r = reveal(sim, bearer, 36, 0);
    expect(r.raised).toEqual([dead]);
    expect(dead.alive).toBe(true);
    expect(dead.side).toBe(Side.Monster);
    expect(torn.alive).toBe(false);
    expect(r.fled).toEqual([coward]);
    expect(sim.units.has(coward)).toBe(false);
    expect(living.side).toBe(Side.Party);
  });

  it('is fought by the living mercs, with no bearer left to guard', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 10, 13, 10);
    const r = reveal(sim, bearer, 36, 0);
    sim.run(1);
    expect(merc.target).toBe(r.creditor);
  });
});

describe('the final fight', () => {
  it('is won by four mercs of a clean run, and lost with two of them raised against them', () => {
    expect(SEEDS.filter((s) => fight(s, 0, 0)).length).toBe(6);
    expect(SEEDS.filter((s) => fight(s, 2, 2)).length).toBeLessThanOrEqual(1);
  });

  it('takes place in a closed tomb', () => {
    const tomb = generateTomb(new RunStreams('ASHEN').area(1, Stream.Layout, 2000), 32);
    expect(tomb.exits).toHaveLength(0);
    expect(tomb.packs).toHaveLength(0);
    expect(tomb.tomb).toBeDefined();
  });
});
