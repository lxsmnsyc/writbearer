import { describe, expect, it } from 'vitest';
import { MINI_BOSSES, spawnMiniBoss } from '../../src/content/minibosses';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import Alarms from '../../src/game/alarms';
import Bonus from '../../src/game/bonus';
import ObjectiveRun from '../../src/game/objective';
import { enterStage, spawnParty } from '../../src/game/stage';
import { generateLayerMap } from '../../src/gen/graph';
import { generateStage } from '../../src/gen/stage';
import { Priority, think } from '../../src/sim/ai';
import Sim from '../../src/sim/sim';
import { DamageFlags, DamageKind, Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { updateWarnings } from '../../src/sim/warning';

const DT = 0.05;

function field(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

function post(sim: Sim, x: number, z: number): Unit {
  const p = spawnMonster(sim, 'hornPost', 5, x, z);
  p.still = true;
  p.aware = true;
  return p;
}

const kill = (u: Unit): void => {
  u.hit(u, { kind: DamageKind.True, fixed: u.derived.maxHp * 9, flags: DamageFlags.Redirected });
};

describe('a Silence', () => {
  it('is rolled on the Rift Road only', () => {
    const rolled = (depth: number): boolean =>
      Array.from({ length: 40 }, (_, seed) => generateLayerMap(new RNG(seed + 1), 2, false, depth))
        .flatMap((m) => m.columns.flat())
        .some((n) => n.objective === 'silence');
    expect([0, 1, 2, 3].map(rolled)).toEqual([false, true, false, false]);
  });

  it('stands horn posts across the field, and puts a Horn-Bearer in every pack but the Church’s', () => {
    for (const kind of ['combat', 'elite'] as const) {
      const s = generateStage(new RNG(3), 10, { kind, ahead: ['combat'], objective: 'silence' });
      expect(s.posts).toHaveLength(kind === 'elite' ? 4 : 3);
      expect(s.hornPack?.length).toBeGreaterThan(0);
      expect(s.packs[0].kinds).not.toContain('hornBearer');
      for (const p of s.packs.slice(1).filter((q) => !q.mini)) {
        expect(p.kinds).toContain('hornBearer');
      }
    }
  });

  it('is done once every post in the area is broken', () => {
    const s = generateStage(new RNG(3), 10, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'silence',
    });
    const sim = new Sim(1);
    enterStage(sim, s);
    spawnParty(sim, s, []);
    const run = new ObjectiveRun('silence', s);
    const posts = sim.living(Side.Monster).filter((u) => u.kind === 'hornPost');
    expect(posts).toHaveLength(3);
    expect(posts.every((p) => p.still)).toBe(true);
    expect(run.update(sim, DT, 12)).toBe(false);
    expect(run.status(sim)).toContain('0 of 3');
    posts.forEach(kill);
    expect(run.update(sim, DT, 12)).toBe(true);
  });
});

describe('the Alarmed mutator', () => {
  it('lays posts and Horn-Bearers in fights with waiting packs, and is rolled only for those', () => {
    const s = generateStage(new RNG(2), 10, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'hunt',
      mutators: ['alarmed'],
    });
    expect(s.posts).toHaveLength(2);
    expect(s.packs.slice(1).every((p) => p.kinds.includes('hornBearer'))).toBe(true);
    for (let seed = 1; seed <= 40; seed++) {
      for (const node of generateLayerMap(new RNG(seed), 2, false, 3).columns.flat()) {
        if (node.mutators?.includes('alarmed')) {
          expect(['hunt', 'escort', 'vault', 'collapse']).toContain(node.objective);
        }
      }
    }
  });
});

describe('a Horn-Bearer', () => {
  it('runs for the nearest post once awake, blows it, and calls a fresh pack, once', () => {
    const sim = field();
    const near = post(sim, 20, 10);
    post(sim, 35, 35);
    const herald = spawnMonster(sim, 'hornBearer', 5, 10, 10);
    const alarms = new Alarms();
    expect(alarms.update(sim, DT, 5, ['husk', 'husk'], null)).toBe(0);
    expect(herald.alarm).toBeNull();
    herald.aware = true;
    alarms.update(sim, DT, 5, ['husk', 'husk'], null);
    expect(herald.alarm).toEqual({ x: near.x, z: near.z });
    // It runs there.
    let blown = 0;
    for (let t = 0; t < 10 && blown === 0; t += DT) {
      think(sim, herald, DT);
      blown += alarms.update(sim, DT, 5, ['husk', 'husk'], null);
    }
    expect(blown).toBe(1);
    expect(herald.alarm).toBeNull();
    for (let t = 0; t < 3.2; t += DT) {
      updateWarnings(sim, DT);
    }
    expect(sim.living(Side.Monster).filter((u) => u.kind === 'husk')).toHaveLength(2);
    for (let t = 0; t < 20; t += DT) {
      expect(alarms.update(sim, DT, 5, ['husk'], null)).toBe(0);
    }
  });

  it('goes for another post once its own is broken, and stops when none stands', () => {
    const sim = field();
    const a = post(sim, 15, 10);
    const b = post(sim, 30, 10);
    const herald = spawnMonster(sim, 'hornBearer', 5, 10, 10);
    herald.aware = true;
    const alarms = new Alarms();
    alarms.update(sim, DT, 5, undefined, null);
    expect(herald.alarm).toEqual({ x: a.x, z: a.z });
    kill(a);
    alarms.update(sim, DT, 5, undefined, null);
    expect(herald.alarm).toEqual({ x: b.x, z: b.z });
    kill(b);
    alarms.update(sim, DT, 5, undefined, null);
    expect(herald.alarm).toBeNull();
  });

  it('as the Horn of the Road, blows again at the next post after a while', () => {
    const sim = field();
    const a = post(sim, 12, 10);
    const b = post(sim, 30, 30);
    const { boss } = spawnMiniBoss(sim, MINI_BOSSES.hornOfTheRoad, 8, 11, 10);
    boss.aware = true;
    const alarms = new Alarms();
    expect(alarms.update(sim, DT, 5, ['husk'], null)).toBe(1);
    alarms.update(sim, DT, 5, ['husk'], null);
    expect(boss.alarm).toBeNull();
    for (let t = 0; t < 15.1; t += DT) {
      alarms.update(sim, DT, 5, ['husk'], null);
    }
    expect(boss.alarm).toEqual({ x: b.x, z: b.z });
    expect(a.alive).toBe(true);
  });

  it('is what mercs set on Heralds go for first', () => {
    const sim = field();
    const merc = spawnMerc(sim, 'ranger', 5, 10, 10);
    merc.toggles = { ...merc.toggles!, priorities: [Priority.Heralds, Priority.Nearest] };
    const close = spawnMonster(sim, 'husk', 5, 12, 10);
    close.aware = true;
    const herald = spawnMonster(sim, 'hornBearer', 5, 18, 10);
    herald.aware = true;
    herald.alarm = { x: 30, z: 10 };
    for (let t = 0; t < 0.3; t += DT) {
      think(sim, merc, DT);
    }
    expect(merc.target).toBe(herald);
  });

  it('leaves a horn post standing still, doing nothing', () => {
    const sim = field();
    const p = post(sim, 10, 10);
    spawnMerc(sim, 'vanguard', 5, 11, 10);
    for (let t = 0; t < 2; t += DT) {
      think(sim, p, DT);
    }
    expect(p.target).toBeNull();
    expect(p.x).toBe(10);
  });
});

describe('the Silent bonus', () => {
  it('fails once a horn is blown', () => {
    const sim = field();
    const b = new Bonus('silent', 'silence', { x0: 0, z0: 0, x1: 40, z1: 40 });
    expect(b.met(sim)).toBe(true);
    b.blown();
    expect(b.met(sim)).toBe(false);
  });
});
