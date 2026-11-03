import { afterEach, describe, expect, it } from 'vitest';
import { JOBS } from '../../src/content/jobs';
import { spawnMerc } from '../../src/content/roster';
import { CHALLENGE, CRUSH, INTERCEPT } from '../../src/content/skills';
import { SHIELD_WALL_SKILL } from '../../src/content/vanguard';
import RNG from '../../src/core/rng';
import { loadMerc, saveMerc } from '../../src/game/save';
import {
  MAX_RANK,
  type Upgrade,
  applyUpgrade,
  offerUpgrades,
  raise,
  rankCap,
  spellOf,
} from '../../src/sim/builds';
import { gainXp, xpToNext } from '../../src/sim/progress';
import Sim from '../../src/sim/sim';
import type Unit from '../../src/sim/unit';
import { setRank, withUpgrade } from '../support/build';

// The Vanguard's spells, in cast order
const SPELLS = [INTERCEPT, CHALLENGE, SHIELD_WALL_SKILL, CRUSH];

// A test upgrade per spell: a cheaper spell, and one that starts a passive.
const upgrade = (spell: string, n: number, extra: Partial<Upgrade> = {}): Upgrade => ({
  id: `${spell}-${n}`,
  spell,
  name: `${spell} ${n}`,
  describe: () => 'A test upgrade.',
  patch: { cost: 0 },
  ...extra,
});

// Three per spell: Challenge's, Crush's, Shield Wall's, then Intercept's
const POOL: Upgrade[] = [CHALLENGE, CRUSH, SHIELD_WALL_SKILL, INTERCEPT].flatMap((s) =>
  [1, 2, 3].map((n) => upgrade(s.id, n)),
);

// The Vanguard's own upgrades, put back after each test
const UPGRADES = JOBS.vanguard.upgrades;

// Stands in for the Vanguard's upgrades, as a later version of the game might.
function useUpgrades(pool: Upgrade[]): void {
  JOBS.vanguard.upgrades = pool;
}

// A Vanguard, with the pool standing in for its upgrades.
function merc(level = 5, pool = POOL): Unit {
  useUpgrades(pool);
  return spawnMerc(new Sim(1), 'vanguard', level, 0, 0);
}

const roundTrip = <T>(value: T): T => structuredClone(value);

describe('the build model', () => {
  afterEach(() => {
    useUpgrades(UPGRADES);
  });

  it('caps a spell’s rank by merc level, at most 10', () => {
    expect(rankCap(1)).toBe(1);
    expect(rankCap(2)).toBe(2);
    expect(rankCap(5)).toBe(3);
    expect(rankCap(18)).toBe(10);
    expect(rankCap(40)).toBe(MAX_RANK);
  });

  it('knows its 4 spells at rank 1, casts them in order, and arrives with level − 1 shards', () => {
    const m = merc(5);
    expect(m.skills.map((s) => s.id)).toEqual(SPELLS.map((s) => s.id));
    expect(SPELLS.map((s) => m.skillRank(s.id))).toEqual([1, 1, 1, 1]);
    expect(m.shards).toBe(4);
    expect(m.skillPoints).toBe(0);
  });

  it('gains a shard per level, not a skill point', () => {
    const m = merc(5);
    gainXp(m, xpToNext(5));
    expect(m.level).toBe(6);
    expect(m.shards).toBe(5);
    expect(m.skillPoints).toBe(0);
  });

  it('raises a spell with a shard, up to the cap', () => {
    const m = merc(5);
    expect(raise(m, 'crush')).toBeNull();
    expect(raise(m, 'crush')).toBeNull();
    expect(m.skillRank('crush')).toBe(3);
    expect(m.shards).toBe(2);
    expect(raise(m, 'crush')).toBe('Needs level 6.');
    expect(m.skillRank('crush')).toBe(3);
    expect(m.shards).toBe(2);
  });

  it('cannot raise with no shards, or a spell it does not know', () => {
    const m = merc(5);
    m.shards = 0;
    expect(raise(m, 'crush')).toBe('No shards.');
    m.shards = 1;
    expect(raise(m, 'smite')).toBe('Not one of its spells.');
    setRank(m, 'crush', MAX_RANK);
    m.level = 30;
    expect(raise(m, 'crush')).toBe('Mastered.');
  });

  it('casts a spell with its upgrade’s patch', () => {
    const cheap = upgrade('crush', 4, { patch: { cost: 0, cooldown: 1 } });
    const m = merc(5, [cheap]);
    expect(spellOf(m, CRUSH)).toBe(CRUSH);
    withUpgrade(m, cheap);
    const cast = spellOf(m, CRUSH);
    expect(cast.id).toBe('crush');
    expect(cast.cost).toBe(0);
    expect(cast.cooldown).toBe(1);
    expect(cast.release).toBe(CRUSH.release);
    expect(m.skills[3]).toEqual(cast);
  });

  it('holds one upgrade per spell', () => {
    const m = merc();
    expect(applyUpgrade(m, POOL[3])).toBeNull();
    expect(applyUpgrade(m, POOL[4])).toBe('The spell already holds an upgrade.');
    expect(m.upgrades.get('crush')).toBe(POOL[3].id);
  });

  it('starts an upgrade’s passive at the spell’s rank, and again as the rank rises', () => {
    const ranks: number[] = [];
    let running = 0;
    const effect = upgrade('crush', 9, {
      patch: undefined,
      effect: {
        id: 'test',
        setup: (_, rank) => ({
          start: () => {
            ranks.push(rank);
            running++;
          },
          stop: () => {
            running--;
          },
        }),
      },
    });
    const m = merc(5, [effect]);
    withUpgrade(m, effect);
    raise(m, 'crush');
    expect(ranks).toEqual([1, 2]);
    expect(running).toBe(1);
  });

  it('offers only upgrades of spells with none yet, the same for a seed', () => {
    const m = merc();
    withUpgrade(m, POOL[0]);
    withUpgrade(m, POOL[3]);
    const planned = upgrade('shieldWall', 7, { patch: undefined });
    const pool = [...POOL, planned];
    const offer = offerUpgrades(m, pool, new RNG(7), 3);
    expect(offer).toHaveLength(3);
    for (const u of offer) {
      expect(['shieldWall', 'intercept']).toContain(u.spell);
      expect(u).not.toBe(planned);
    }
    expect(offerUpgrades(m, pool, new RNG(7), 3)).toEqual(offer);
    expect(offerUpgrades(m, pool, new RNG(7), 10)).toHaveLength(6);
  });

  it('keeps shards, ranks and upgrades through a save', () => {
    const m = merc(9);
    raise(m, 'crush');
    raise(m, 'crush');
    raise(m, 'intercept');
    withUpgrade(m, POOL[4]);
    const back = loadMerc(new Sim(1), roundTrip(saveMerc(m)), 0, 0);
    expect(back.spells.map((s) => s.id)).toEqual(SPELLS.map((s) => s.id));
    expect(back.shards).toBe(5);
    expect(back.skillRank('crush')).toBe(3);
    expect(back.skillRank('intercept')).toBe(2);
    expect([...back.upgrades]).toEqual([['crush', POOL[4].id]]);
    expect(spellOf(back, CRUSH).cost).toBe(0);
  });

  it('keeps an upgrade it cannot find by id, so a later version can', () => {
    const m = merc(9);
    withUpgrade(m, POOL[4]);
    // A version where the upgrade was renamed: its old id is not in the build.
    useUpgrades(POOL.slice(0, 4));
    const lost = loadMerc(new Sim(1), roundTrip(saveMerc(m)), 0, 0);
    expect([...lost.upgrades]).toEqual([['crush', POOL[4].id]]);
    expect(spellOf(lost, CRUSH)).toBe(CRUSH);
    expect(applyUpgrade(lost, POOL[3])).toBe('The spell already holds an upgrade.');
    const saved = roundTrip(saveMerc(lost));
    expect(saved.upgrades).toEqual([['crush', POOL[4].id]]);

    useUpgrades(POOL);
    const found = loadMerc(new Sim(1), saved, 0, 0);
    expect(spellOf(found, CRUSH).cost).toBe(0);
  });

  it('gives an old save’s tree ranks back as shards', () => {
    // Saved while the Vanguard was on its tree: 3 points spent, 4 left.
    const saved = roundTrip(saveMerc(merc(8)));
    delete saved.shards;
    delete saved.upgrades;
    saved.skillPoints = 4;
    saved.ranks = [
      ['challenge', 2],
      ['shieldWall', 1],
    ];
    const back = loadMerc(new Sim(1), saved, 0, 0);
    expect(back.shards).toBe(7);
    expect(back.skillPoints).toBe(0);
    expect(SPELLS.map((s) => back.skillRank(s.id))).toEqual([1, 1, 1, 1]);
    expect([...back.passives.keys()]).toEqual(['sunder']);
    expect(back.skills.map((s) => s.id)).toEqual(SPELLS.map((s) => s.id));
  });
});
