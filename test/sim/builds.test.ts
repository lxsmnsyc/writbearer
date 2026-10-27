import { afterEach, describe, expect, it } from 'vitest';
import { spawnMerc } from '../../src/content/roster';
import { CHALLENGE, CRUSH, INTERCEPT, SHIELD_BASH } from '../../src/content/skills';
import { learn, treeFor } from '../../src/content/trees';
import RNG from '../../src/core/rng';
import { loadMerc, saveMerc } from '../../src/game/save';
import {
  MAX_RANK,
  type Upgrade,
  applyUpgrade,
  offerUpgrades,
  raise,
  rankCap,
  registerBuild,
  spellOf,
  unregisterBuild,
} from '../../src/sim/builds';
import { gainXp, xpToNext } from '../../src/sim/progress';
import Sim from '../../src/sim/sim';
import type Unit from '../../src/sim/unit';
import { setRank, withSpells, withUpgrade } from '../support/build';

const SPELLS = [CHALLENGE, CRUSH, SHIELD_BASH, INTERCEPT];

// A test upgrade per spell: a cheaper spell, and one that starts a passive.
const upgrade = (spell: string, n: number, extra: Partial<Upgrade> = {}): Upgrade => ({
  id: `${spell}-${n}`,
  spell,
  name: `${spell} ${n}`,
  describe: () => 'A test upgrade.',
  patch: { cost: 0 },
  ...extra,
});

const POOL: Upgrade[] = SPELLS.flatMap((s) => [1, 2, 3].map((n) => upgrade(s.id, n)));

const merc = (level = 5): Unit =>
  withSpells(spawnMerc(new Sim(1), 'vanguard', level, 0, 0), SPELLS);

const roundTrip = <T>(value: T): T => structuredClone(value);

describe('the build model', () => {
  afterEach(() => {
    unregisterBuild('vanguard');
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
    const m = merc();
    const cheap = upgrade('crush', 1, { patch: { cost: 0, cooldown: 1 } });
    expect(spellOf(m, CRUSH)).toBe(CRUSH);
    withUpgrade(m, cheap);
    const cast = spellOf(m, CRUSH);
    expect(cast.id).toBe('crush');
    expect(cast.cost).toBe(0);
    expect(cast.cooldown).toBe(1);
    expect(cast.release).toBe(CRUSH.release);
    expect(m.skills[1]).toEqual(cast);
  });

  it('holds one upgrade per spell', () => {
    const m = merc();
    expect(applyUpgrade(m, POOL[3])).toBeNull();
    expect(applyUpgrade(m, POOL[4])).toBe('The spell already holds an upgrade.');
    expect(m.upgrades.get('crush')).toBe(POOL[3].id);
  });

  it('starts an upgrade’s passive at the spell’s rank, and again as the rank rises', () => {
    const m = merc();
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
    withUpgrade(m, effect);
    raise(m, 'crush');
    expect(ranks).toEqual([1, 2]);
    expect(running).toBe(1);
  });

  it('offers only upgrades of spells with none yet, the same for a seed', () => {
    const m = merc();
    withUpgrade(m, POOL[0]);
    withUpgrade(m, POOL[3]);
    const planned = upgrade('shieldBash', 7, { patch: undefined });
    const pool = [...POOL, planned];
    const offer = offerUpgrades(m, pool, new RNG(7), 3);
    expect(offer).toHaveLength(3);
    for (const u of offer) {
      expect(['shieldBash', 'intercept']).toContain(u.spell);
      expect(u).not.toBe(planned);
    }
    expect(offerUpgrades(m, pool, new RNG(7), 3)).toEqual(offer);
    expect(offerUpgrades(m, pool, new RNG(7), 10)).toHaveLength(6);
  });

  it('keeps shards, ranks and upgrades through a save', () => {
    registerBuild('vanguard', { spells: SPELLS, upgrades: POOL });
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

  it('gives an old save’s tree ranks back as shards', () => {
    // Saved while the Vanguard was on its tree: 3 points spent, 4 left.
    const old = spawnMerc(new Sim(1), 'vanguard', 8, 0, 0);
    const branch = treeFor(old)[0];
    learn(old, branch, branch.nodes[0]);
    learn(old, branch, branch.nodes[0]);
    learn(old, branch, branch.nodes[1]);
    const saved = roundTrip(saveMerc(old));
    expect(saved.shards).toBeUndefined();

    registerBuild('vanguard', { spells: SPELLS, upgrades: POOL });
    const back = loadMerc(new Sim(1), saved, 0, 0);
    expect(back.shards).toBe(7);
    expect(back.skillPoints).toBe(0);
    expect(SPELLS.map((s) => back.skillRank(s.id))).toEqual([1, 1, 1, 1]);
    expect(back.passives.size).toBe(0);
    expect(back.skills.map((s) => s.id)).toEqual(SPELLS.map((s) => s.id));
  });
});
