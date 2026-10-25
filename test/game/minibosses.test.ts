import { describe, expect, it } from 'vitest';
import { affixesOf } from '../../src/content/affixes';
import { Floods, MINI_BOSSES, miniBossesOf, spawnMiniBoss } from '../../src/content/minibosses';
import { spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import { enterStage } from '../../src/game/stage';
import { type Patch, generateStage } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';
import { DamageFlags, DamageKind, Rank, Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

function arena(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

const kill = (u: Unit): void => {
  u.hit(u, { kind: DamageKind.True, fixed: u.derived.maxHp * 9, flags: DamageFlags.Redirected });
};

describe('mini-bosses', () => {
  it('stand in every layer', () => {
    for (const layer of [0, 1, 2, 3]) {
      expect(miniBossesOf(layer).length).toBeGreaterThan(0);
    }
  });

  it('come named, stronger than an elite, with their affixes and escort', () => {
    const sim = arena();
    const { boss, escort } = spawnMiniBoss(sim, MINI_BOSSES.bellRinger, 6, 10, 10);
    const elite = spawnMonster(sim, 'penitent', 6, 20, 20, { elite: true });
    expect(boss.named).toBe(true);
    expect(boss.name).toBe('The Bell-Ringer');
    expect(boss.rank).toBe(Rank.Elite);
    expect(boss.derived.maxHp).toBeGreaterThan(elite.derived.maxHp * 1.5);
    expect(escort).toHaveLength(3);
    expect(affixesOf(sim).of(boss)).toEqual(['herald', 'might']);
  });

  it('The First Keeper’s Ward refills only while its Cantors live', () => {
    const sim = arena();
    const { boss, escort } = spawnMiniBoss(sim, MINI_BOSSES.firstKeeper, 6, 10, 10);
    const run = affixesOf(sim);
    const most = run.wardOf(boss).most;
    boss.hit(boss, {
      kind: DamageKind.Magical,
      fixed: Math.round(most / 2),
      flags: DamageFlags.Redirected,
    });
    for (const c of escort.filter((u) => u.kind === 'cantor')) {
      kill(c);
    }
    for (let t = 0; t < 6; t += 0.05) {
      run.update(0.05);
    }
    expect(run.wardOf(boss).ward).toBeLessThan(most);
  });

  it('The Last Herald calls the dead to its side, as a captain does', () => {
    const sim = arena();
    const { boss } = spawnMiniBoss(sim, MINI_BOSSES.lastHerald, 20, 10, 10);
    expect(boss.calls).toEqual(['hollowed', 'hollowed']);
  });

  it('The Drowned Cantor floods the floor round it while it sings, and the water drains once it dies', () => {
    const sim = arena();
    const { boss } = spawnMiniBoss(sim, MINI_BOSSES.drownedCantor, 14, 20, 20);
    const floods = new Floods();
    const patches: Patch[] = [];
    for (let t = 0; t < 10; t += 0.05) {
      floods.update(sim, 0.05, patches);
    }
    expect(patches).toHaveLength(0);
    boss.aware = true;
    for (let t = 0; t < 40; t += 0.05) {
      floods.update(sim, 0.05, patches);
    }
    expect(patches).toHaveLength(4);
    expect(patches.every((p) => p.kind === 'water')).toBe(true);
    kill(boss);
    floods.update(sim, 0.05, patches);
    expect(patches).toHaveLength(0);
  });
});

describe('a fight’s mini-boss', () => {
  const build = (
    objective: 'hunt' | 'horde' | 'vault',
    kind: 'combat' | 'elite',
  ): ReturnType<typeof generateStage> =>
    generateStage(new RNG(4), 10, { kind, ahead: ['combat'], objective, miniBoss: 'shieldOath' });

  it('ends an Elite fight at its farthest boss spot, and is an Elite Hunt’s first quarry', () => {
    const s = build('hunt', 'elite');
    const pack = s.packs.find((p) => p.mini === 'shieldOath')!;
    const bosses = s.spots!.filter((p) => p.kind === 'boss');
    expect(pack.x).toBe(bosses.at(-1)!.x);
    expect(pack.marked).toBe(0);
  });

  it('stands at one of the boss spots in an ordinary fight', () => {
    const s = build('hunt', 'combat');
    const pack = s.packs.find((p) => p.mini)!;
    expect(s.spots!.some((p) => p.kind === 'boss' && p.x === pack.x && p.z === pack.z)).toBe(true);
    expect(pack.marked).toBeUndefined();
  });

  it('leads an Elite Horde’s last wave', () => {
    const s = build('horde', 'elite');
    const last = s.waves!.at(-1)!;
    expect(last.mini).toBe('shieldOath');
    expect(last.elite).toBe(-1);
  });

  it('holds a Vault’s key, and comes into the world with its escort', () => {
    const s = build('vault', 'combat');
    expect(s.packs.find((p) => p.mini)!.key).toBe(0);
    expect(s.packs[1].key).toBeUndefined();
    const sim = new Sim(1);
    enterStage(sim, s);
    const boss = sim.living(Side.Monster).find((u) => u.named)!;
    expect(boss.name).toBe('The Shield-Oath');
    expect(boss.bearsKey).toBe(true);
  });
});
