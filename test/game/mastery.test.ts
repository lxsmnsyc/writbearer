import { afterEach, describe, expect, it } from 'vitest';
import { JOBS } from '../../src/content/jobs';
import { spawnMerc } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import { RunStreams } from '../../src/core/seed';
import { AREAS_PER_LAYER } from '../../src/gen/layers';
import type GameState from '../../src/game/game/state';
import { pickCard, visitStation } from '../../src/game/game/station';
import { generateLayerMap } from '../../src/gen/graph';
import {
  BONUS_SHARDS,
  OFFER_CARDS,
  SHARD_CARD,
  loadOffers,
  masteryOffer,
  offersAt,
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
    const loaded = loadOffers(structuredClone(offers), mercs);
    expect(loaded).toEqual(offers);
    const unknown = [{ title: 'x', cards: [{ merc: 0, upgrade: 'no-such-upgrade' }] }];
    expect(loadOffers(unknown, mercs)).toEqual([]);
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

  it('adds a shard to the picked merc when the bonus was met', () => {
    const mercs = party(3);
    const offer = masteryOffer(mercs, new RNG(5), true);
    expect(offer?.cards).toHaveLength(OFFER_CARDS);
    const card = offer!.cards[1];
    const before = mercs[card.merc].shards;
    expect(takeCard(mercs, card, offer!.bonus)).toBeNull();
    expect(mercs[card.merc].shards).toBe(before + BONUS_SHARDS);
    const other = mercs.find((_, i) => i !== card.merc)!;
    expect(other.shards).toBe(4);
  });

  it('offers at the Waystations of phases 2 to 4 only', () => {
    expect([0, 1, 2, 3, 4, 5].map(offersAt)).toEqual([false, true, true, true, false, false]);
  });

  it('drops saved cards that can no longer be taken, and offers left empty', () => {
    const mercs = party(2);
    const offers = waystationOffers(mercs, new RNG(2));
    const first = offers[0].cards[0];
    expect(takeCard(mercs, first)).toBeNull();
    const saved = structuredClone(offers);
    const loaded = loadOffers(saved, mercs);
    // The taken spell's other cards are gone from the first offer
    expect(loaded[0].cards.every((c) => c.upgrade !== first.upgrade)).toBe(true);
    expect(loaded[0].cards.length).toBeLessThan(OFFER_CARDS);
    // A merc who died leaves an empty offer, which is dropped
    mercs[1].alive = false;
    expect(loadOffers(saved, mercs)).toHaveLength(1);
  });

  describe('at the Waystation post', () => {
    // Just what visitStation reads and changes
    function post(layer: number, mercs: Unit[]): GameState {
      // A Game needs a canvas, so a stand-in with only these fields
      return {
        stage: { station: { x: 0, z: 0 } },
        stationOpen: false,
        stationMet: false,
        bearer: { x: 0, z: 0, alive: true, order: null },
        keys: new Set<string>(),
        hooks: {},
        offers: [],
        offeredAt: -1,
        stageIndex: layer * AREAS_PER_LAYER,
        streams: new RunStreams('MASTERY'),
        saving: false,
        mercs: () => mercs,
        itemsChanged: () => {},
      } as unknown as GameState; // oxlint-disable-line typescript/no-unsafe-type-assertion
    }

    it('draws each living merc an offer once, and pauses until all are taken', () => {
      const mercs = party(2);
      const g = post(1, mercs);
      visitStation(g);
      expect(g.offers).toHaveLength(2);
      expect(pickCard(g, 0)).toBeNull();
      expect(pickCard(g, 0)).toBeNull();
      expect(g.offers).toHaveLength(0);
      expect(mercs[0].upgrades.size).toBe(1);
      expect(mercs[1].upgrades.size).toBe(1);
      // Walking away and back draws no new offer
      g.bearer.x = 50;
      visitStation(g);
      g.bearer.x = 0;
      visitStation(g);
      expect(g.offers).toHaveLength(0);
    });

    it('draws the same cards for the same run', () => {
      const a = post(1, party(2));
      const b = post(1, party(2));
      visitStation(a);
      visitStation(b);
      expect(b.offers).toEqual(a.offers);
    });

    it('offers nothing after phase 4', () => {
      const g = post(4, party(2));
      visitStation(g);
      expect(g.offers).toHaveLength(0);
    });
  });
});
