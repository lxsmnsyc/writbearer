import { afterEach, describe, expect, it } from 'vitest';
import { JOBS } from '../../src/content/jobs';
import { spawnMerc } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import { generateLayerMap } from '../../src/gen/graph';
import {
  OFFER_CARDS,
  SHARD_CARD,
  loadOffers,
  masteryOffer,
  takeCard,
  waystationOffers,
} from '../../src/game/mastery';
import { type Upgrade, isBuilt, upgradeOf } from '../../src/sim/builds';
import Sim from '../../src/sim/sim';
import type Unit from '../../src/sim/unit';

// A test upgrade per spell, three each: all built
const test = (spell: string, n: number): Upgrade => ({
  id: `${spell}-test-${n}`,
  spell,
  name: `${spell} ${n}`,
  describe: () => 'A test upgrade.',
  patch: { cost: 0 },
});

// The Vanguard's own upgrades, put back after each test
const REAL = JOBS.vanguard.upgrades;

// Vanguards with the test upgrades standing in for the job's
function party(n: number): Unit[] {
  const pool: Upgrade[] = [];
  for (const spell of JOBS.vanguard.spells) {
    for (const k of [1, 2, 3]) {
      pool.push(test(spell.id, k));
    }
  }
  JOBS.vanguard.upgrades = pool;
  const sim = new Sim(1);
  return Array.from({ length: n }, () => spawnMerc(sim, 'vanguard', 5, 0, 0));
}

describe('elite upgrade offers', () => {
  afterEach(() => {
    JOBS.vanguard.upgrades = REAL;
  });

  it('offers each living merc 3 upgrades of its own spells at a Waystation', () => {
    const mercs = party(3);
    mercs[1].alive = false;
    const offers = waystationOffers(mercs, new RNG(7));
    expect(offers.map((o) => o.cards[0].merc)).toEqual([0, 2]);
    const spells = new Set(JOBS.vanguard.spells.map((s) => s.id));
    for (const offer of offers) {
      expect(offer.cards).toHaveLength(OFFER_CARDS);
      for (const card of offer.cards) {
        const spell = card.upgrade?.replace(/-test-\d$/, '') ?? '';
        expect(spells.has(spell)).toBe(true);
      }
    }
  });

  it('draws the same offers for the same seed', () => {
    const a = waystationOffers(party(2), new RNG(3));
    const b = waystationOffers(party(2), new RNG(3));
    expect(b).toEqual(a);
  });

  it('sets the picked upgrade on the merc', () => {
    const mercs = party(2);
    const [offer] = waystationOffers(mercs, new RNG(1));
    const card = offer.cards[1];
    expect(takeCard(mercs, card)).toBeNull();
    const spell = mercs[0].upgrades.keys().next().value ?? '';
    expect(upgradeOf(mercs[0], spell)?.id).toBe(card.upgrade);
    expect(mercs[1].upgrades.size).toBe(0);
  });

  it('offers shards once all 4 spells hold an upgrade', () => {
    const mercs = party(1);
    for (let i = 0; i < 4; i++) {
      const [offer] = waystationOffers(mercs, new RNG(i));
      expect(takeCard(mercs, offer.cards[0])).toBeNull();
    }
    expect(mercs[0].upgrades.size).toBe(4);
    const [offer] = waystationOffers(mercs, new RNG(9));
    expect(offer.cards).toEqual([{ merc: 0, upgrade: null }]);
    const before = mercs[0].shards;
    expect(takeCard(mercs, offer.cards[0])).toBeNull();
    expect(mercs[0].shards).toBe(before + SHARD_CARD);
  });

  it('offers a Mastery card to each of 3 different living mercs', () => {
    const mercs = party(4);
    mercs[2].alive = false;
    const offer = masteryOffer(mercs, new RNG(5));
    expect(offer?.cards).toHaveLength(3);
    const owners = offer?.cards.map((c) => c.merc) ?? [];
    expect(new Set(owners).size).toBe(3);
    expect(owners).not.toContain(2);
    expect(masteryOffer([], new RNG(5))).toBeNull();
  });

  it('refuses a card for a merc who has died since', () => {
    const mercs = party(1);
    const [offer] = waystationOffers(mercs, new RNG(1));
    mercs[0].alive = false;
    expect(takeCard(mercs, offer.cards[0])).toBe('That merc is gone.');
  });

  it('keeps an open offer through a save and load', () => {
    const mercs = party(2);
    const offers = waystationOffers(mercs, new RNG(2));
    const loaded = loadOffers(structuredClone(offers));
    expect(loaded).toEqual(offers);
    const unknown = [{ title: 'x', cards: [{ merc: 0, upgrade: 'no-such-upgrade' }] }];
    expect(loadOffers(unknown)).toEqual([]);
  });

  it('offers the Vanguard’s own built upgrades', () => {
    JOBS.vanguard.upgrades = REAL;
    const mercs = [spawnMerc(new Sim(1), 'vanguard', 5, 0, 0)];
    const [offer] = waystationOffers(mercs, new RNG(4));
    expect(offer.cards).toHaveLength(OFFER_CARDS);
    for (const card of offer.cards) {
      const upgrade = REAL.find((u) => u.id === card.upgrade);
      expect(upgrade && isBuilt(upgrade)).toBe(true);
    }
  });

  it('puts the Mastery reward on some roads, never twice at one fork', () => {
    let seen = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { columns } = generateLayerMap(new RNG(seed));
      for (const [c, column] of columns.entries()) {
        const paid = column.filter((n) => n.reward === 'mastery');
        seen += paid.length;
        if (c === 0) {
          expect(paid.length).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
