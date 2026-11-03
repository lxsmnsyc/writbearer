import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { CHARGED_ARROW, INTERCEPT, SNARE } from '../../src/content/skills';
import { EAGLE_EYE, SHARED_BURDEN, VOW } from '../../src/content/passives';
import { DEFAULT_TOGGLES, Stance, setToggles } from '../../src/sim/ai';
import { SimEvents } from '../../src/sim/events';
import { STAT_POINTS, gainXp, killXp, xpToNext } from '../../src/sim/progress';
import Sim from '../../src/sim/sim';
import { ROOTED, SUNDERED } from '../../src/sim/statuses';
import { DamageKind, DamagePriority, Rank, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { teach } from '../support/build';

const alwaysHit = (sim: Sim): void => {
  sim.on(SimEvents.CheckHit, ValuePriority.Pre, (event) => {
    event.hitChance = 1000;
  });
};

describe('experience', () => {
  it('raises the level, with a shard and stat points each time', () => {
    const sim = new Sim(1);
    const ranger = spawnMerc(sim, 'ranger', 5, 0, 0);
    const shards = ranger.shards;
    expect(gainXp(ranger, xpToNext(5) + xpToNext(6))).toBe(2);
    expect(ranger.level).toBe(7);
    expect(ranger.shards).toBe(shards + 2);
    expect(ranger.statPoints).toBe(STAT_POINTS * 2);
  });

  it('gives more for elites and deeper monsters', () => {
    const sim = new Sim(1);
    const plain = spawnMonster(sim, 'crawler', 4, 0, 0);
    const deep = spawnMonster(sim, 'crawler', 8, 0, 0);
    const elite = spawnMonster(sim, 'crawler', 4, 0, 0, { elite: true });
    expect(elite.rank).toBe(Rank.Elite);
    expect(killXp(deep)).toBeGreaterThan(killXp(plain));
    expect(killXp(elite)).toBeGreaterThan(killXp(deep));
  });

  it('raises a stat with a point', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const hp = vanguard.derived.maxHp;
    expect(vanguard.raiseStat('vit')).toBe(false);
    vanguard.statPoints = 1;
    expect(vanguard.raiseStat('vit')).toBe(true);
    expect(vanguard.derived.maxHp).toBeGreaterThan(hp);
  });
});

describe('spells', () => {
  it('arrive known at rank 1, with the innate passive and a shard per level past the first', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0);
    expect(vanguard.shards).toBe(4);
    expect(vanguard.skillPoints).toBe(0);
    expect(vanguard.skills.map((s) => s.id)).toEqual([
      'intercept',
      'challenge',
      'shieldWall',
      'crush',
    ]);
    expect(vanguard.skills.map((s) => vanguard.skillRank(s.id))).toEqual([1, 1, 1, 1]);
    expect([...vanguard.passives.keys()]).toEqual(['sunder']);
  });
});

describe('passives', () => {
  // Vow, Shared Burden and Eagle Eye are now elite upgrades, built by
  // vanguard-upgrades and ranger-upgrades.
  it.skip('Vow: armor near the bearer, set up again at a new rank without stacking', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 1, 0);
    const base = vanguard.derived.armor;
    teach(vanguard, VOW, 1);
    sim.tick();
    expect(vanguard.derived.armor).toBe(base + 10);
    teach(vanguard, VOW, 2);
    sim.tick();
    expect(vanguard.derived.armor).toBe(base + 20);
    bearer.x = 20;
    setToggles(vanguard, { ...DEFAULT_TOGGLES, stance: Stance.Hold });
    sim.tick();
    expect(vanguard.derived.armor).toBe(base);
  });

  it('Sunder, the innate: melee hits strip armor, stacking, then it grows back', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const soldier = spawnMonster(sim, 'hollowSoldier', 4, 30, 0);
    alwaysHit(sim);
    const armor = soldier.derived.armor;
    // True damage skips the hit roll, so both hits land.
    vanguard.hit(soldier, { kind: DamageKind.True, fixed: 10 });
    vanguard.hit(soldier, { kind: DamageKind.True, fixed: 10 });
    expect(soldier.statuses.get(SUNDERED.id)?.stacks).toBe(2);
    expect(soldier.derived.armor).toBe(armor - 8);
    sim.run(SUNDERED.duration + 0.1);
    expect(soldier.derived.armor).toBe(armor);
  });

  it.skip('Shared Burden: the Vanguard takes a share of each hit on the bearer', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 20, 0);
    const crawler = spawnMonster(sim, 'crawler', 4, 40, 0);
    teach(vanguard, SHARED_BURDEN, 2);
    const hp = vanguard.hp;
    crawler.hit(bearer, { kind: DamageKind.True, fixed: 100 });
    expect(bearer.derived.maxHp - bearer.hp).toBe(90);
    expect(hp - vanguard.hp).toBe(10);
  });

  it.skip('Eagle Eye: more reach, which a new rank does not double', () => {
    const sim = new Sim(1);
    const ranger = spawnMerc(sim, 'ranger', 5, 0, 0);
    const reach = ranger.kit.reach;
    teach(ranger, EAGLE_EYE, 1);
    expect(ranger.kit.reach).toBe(reach + 0.5);
    teach(ranger, EAGLE_EYE, 2);
    expect(ranger.kit.reach).toBe(reach + 1);
  });
});

describe('new skills', () => {
  it('Snare holds the first enemy coming for the bearer', () => {
    const sim = new Sim(2);
    spawnBearer(sim, 0, 0);
    const ranger = spawnMerc(sim, 'ranger', 5, -1, 0);
    const penitent = spawnMonster(sim, 'penitent', 4, 6, 0);
    penitent.aware = true;
    sim.tick();
    expect(ranger.startCast(SNARE, null)).toBe(true);
    sim.run(SNARE.windup + 0.05);
    expect(sim.traps).toHaveLength(1);
    sim.run(3, () => penitent.statuses.has(ROOTED.id));
    expect(penitent.statuses.has(ROOTED.id)).toBe(true);
    expect(sim.traps).toHaveLength(0);
  });

  it('Charged Arrow leaps to a second enemy', () => {
    const sim = new Sim(3);
    const ranger = spawnMerc(sim, 'ranger', 5, 0, 0);
    const first = spawnMonster(sim, 'hollowSoldier', 4, 5, 0);
    const second = spawnMonster(sim, 'hollowSoldier', 4, 6.5, 1);
    for (const m of [first, second]) {
      m.kit.moveSpeed = 0;
    }
    const hit = new Set<Unit>();
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
      if (event.source === ranger) {
        hit.add(event.target);
      }
    });
    alwaysHit(sim);
    ranger.kit.interval = 0;
    expect(ranger.startCast(CHARGED_ARROW, first)).toBe(true);
    sim.run(CHARGED_ARROW.windup + 1);
    expect(hit.has(first)).toBe(true);
    expect(hit.has(second)).toBe(true);
  });

  it('Intercept puts the Vanguard between the bearer and its attacker', () => {
    const sim = new Sim(4);
    const bearer = spawnBearer(sim, 0, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 5, -4, 0);
    const penitent = spawnMonster(sim, 'penitent', 4, 3, 0);
    penitent.aware = true;
    penitent.kit.moveSpeed = 0;
    sim.tick();
    expect(vanguard.startCast(INTERCEPT, null)).toBe(true);
    sim.run(INTERCEPT.windup + 0.05);
    expect(vanguard.x).toBeGreaterThan(bearer.x);
    expect(vanguard.distanceTo(bearer)).toBeLessThan(1.5);
  });
});
