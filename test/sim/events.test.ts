import { describe, expect, it } from 'vitest';
import {
  EVENTS,
  EVENT_BY_ID,
  type EventPlay,
  type EventScene,
  pickEvent,
} from '../../src/content/events';
import { BASE_BY_ID } from '../../src/content/items';
import { spawnBearer, spawnMerc } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import { Pack } from '../../src/game/inventory';
import { generateLayerMap } from '../../src/gen/graph';
import { potionStack } from '../../src/gen/loot';
import { generateStage } from '../../src/gen/stage';
import type { Item } from '../../src/sim/item';
import Sim from '../../src/sim/sim';
import { Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

interface Setup {
  sim: Sim;
  pack: Pack;
  mercs: Unit[];
  given: Item[];
  hired: { wage: number }[];
  play: EventPlay;
}

// An Event begun on a party of a Vanguard and a Ranger, with gold and two
// Healing Draughts in the pack.
function begin(id: string, seed = 1, gold = 10000): Setup {
  const sim = new Sim(1);
  spawnBearer(sim, 10, 10);
  const mercs = [spawnMerc(sim, 'vanguard', 6, 11, 10), spawnMerc(sim, 'ranger', 6, 11, 11)];
  const pack = new Pack();
  pack.gold = gold;
  pack.add(potionStack(BASE_BY_ID.get('healingDraught')!, 2));
  const given: Item[] = [];
  const hired: { wage: number }[] = [];
  const scene: EventScene = {
    rng: new RNG(seed),
    sim,
    pack,
    level: 5,
    mercLevel: 6,
    at: { x: 14, z: 12 },
    give: (items) => {
      given.push(...items);
    },
    cannotHire: (wage) => (pack.gold < wage ? 'Too poor.' : null),
    hire: (_, wage) => {
      pack.gold -= wage;
      hired.push({ wage });
    },
  };
  return { sim, pack, mercs, given, hired, play: EVENT_BY_ID.get(id)!.begin(scene) };
}

const choose = (play: EventPlay, label: string): string => {
  const choice = play.choices.find((c) => c.label.startsWith(label))!;
  expect(choice.why?.() ?? null).toBeNull();
  return choice.pick();
};

const monsters = (sim: Sim): Unit[] => sim.living(Side.Monster);

describe('Events on the map', () => {
  it('appear from the second column, on some layers’ maps', () => {
    let seen = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { columns } = generateLayerMap(new RNG(seed));
      expect(columns[0].some((n) => n.kind === 'event')).toBe(false);
      seen += columns.flat().filter((n) => n.kind === 'event').length;
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('are small safe fields with the Event’s scenery round where it happens', () => {
    const stage = generateStage(new RNG(3), 4, {
      kind: 'event',
      ahead: ['combat', 'camp'],
      scene: ['altar', 'candle', 'banner'],
    });
    expect(stage.packs).toHaveLength(0);
    expect(stage.event).toBeDefined();
    expect(stage.exits).toHaveLength(2);
    for (const kind of ['altar', 'candle', 'banner'] as const) {
      const prop = stage.props.find((p) => p.kind === kind)!;
      expect(Math.hypot(prop.x - stage.event!.x, prop.z - stage.event!.z)).toBeCloseTo(2.2);
    }
  });

  it('are picked from the layer’s own, without repeats while any are left', () => {
    const rng = new RNG(5);
    const seen = new Set<string>();
    const here = EVENTS.filter((e) => e.layers.includes(0));
    for (let i = 0; i < here.length; i++) {
      const def = pickEvent(rng, 0, seen);
      expect(def.layers).toContain(0);
      expect(seen.has(def.id)).toBe(false);
      seen.add(def.id);
    }
    expect(pickEvent(rng, 0, seen).layers).toContain(0);
    for (let i = 0; i < 30; i++) {
      expect(pickEvent(rng, 3, new Set()).id).not.toBe('refugees');
    }
  });

  it('every choice of every Event says what came of it', () => {
    for (const def of EVENTS) {
      for (let i = 0; i < 3; i++) {
        const { play } = begin(def.id, i + 1);
        expect(play.text.length).toBeGreaterThan(20);
        for (const choice of play.choices) {
          expect(
            begin(def.id, i + 1)
              .play.choices.find((c) => c.label === choice.label)!
              .pick(),
          ).not.toBe('');
        }
      }
    }
  });
});

describe('the Events', () => {
  it('the toll is paid in gold, or in a fight with the Old King’s guard', () => {
    const paid = begin('toll');
    choose(paid.play, 'Pay');
    expect(paid.pack.gold).toBe(10000 - 70);
    expect(monsters(paid.sim)).toHaveLength(0);
    const refused = begin('toll');
    choose(refused.play, 'Refuse');
    const guard = monsters(refused.sim);
    expect(guard).toHaveLength(3);
    expect(guard.every((m) => m.kind === 'hollowSoldier' && m.aware)).toBe(true);
    const poor = begin('toll', 1, 10);
    expect(poor.play.choices[0].why?.()).toMatch(/costs 70 gold/);
  });

  it('a dead bearer can be searched for good gear, which the mercs mind, or buried', () => {
    const searched = begin('deadBearer');
    const before = searched.mercs.map((m) => m.morale);
    choose(searched.play, 'Search');
    expect(searched.given).toHaveLength(2);
    searched.mercs.forEach((m, i) => {
      expect(m.morale).toBeLessThan(before[i]);
    });
    const buried = begin('deadBearer');
    choose(buried.play, 'Bury');
    buried.mercs.forEach((m, i) => {
      expect(m.morale).toBeGreaterThan(before[i]);
    });
    expect(choose(begin('deadBearer').play, 'Read')).toMatch(/word for word/);
  });

  it('refugees take two Healing Draughts, and one in three is an assassin', () => {
    const given = begin('refugees');
    choose(given.play, 'Give');
    expect(given.pack.healingPotion()).toBeUndefined();
    let assassins = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const shared = begin('refugees', seed);
      const gold = shared.pack.gold;
      choose(shared.play, 'Share');
      const hollowed = monsters(shared.sim);
      if (hollowed.length > 0) {
        assassins++;
        expect(hollowed[0].kind).toBe('hollowed');
        expect(shared.pack.gold).toBe(gold);
      } else {
        expect(shared.pack.gold).toBeGreaterThan(gold);
      }
    }
    expect(assassins).toBeGreaterThan(10);
    expect(assassins).toBeLessThan(35);
  });

  it('the sergeant drills Discipline into the mercs for gold', () => {
    const s = begin('sergeant');
    const before = s.mercs.map((m) => m.discipline);
    choose(s.play, 'Pay');
    s.mercs.forEach((m, i) => {
      expect(m.discipline).toBe(before[i] + 5);
    });
    expect(s.pack.gold).toBe(10000 - 75);
  });

  it('the Penitents’ blessing heals the party, and only the Devout like it', () => {
    const s = begin('penitents');
    for (const u of s.sim.living(Side.Party)) {
      u.hp = 1;
    }
    s.mercs[0].traits = ['devout'];
    s.mercs[1].traits = [];
    const before = s.mercs.map((m) => m.morale);
    choose(s.play, 'Take');
    for (const u of s.sim.living(Side.Party)) {
      expect(u.hp).toBe(u.derived.maxHp);
    }
    expect(s.mercs[0].morale).toBeGreaterThan(before[0]);
    expect(s.mercs[1].morale).toBeLessThan(before[1]);
    const alms = begin('penitents');
    choose(alms.play, 'Leave alms');
    expect(alms.pack.materials.get('blessing')).toBe(1);
  });

  it('the dice win or lose the stake, by the seed', () => {
    const outcomes = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const s = begin('dice', seed);
      choose(s.play, 'Wager');
      outcomes.add(s.pack.gold - 10000);
      expect(begin('dice', seed).play.choices[0].pick()).toBe(
        begin('dice', seed).play.choices[0].pick(),
      );
    }
    expect([...outcomes].sort((a, b) => a - b)).toEqual([-50, 50]);
  });

  it('digging out the cellar hurts the mercs and finds gear', () => {
    const s = begin('cellar');
    choose(s.play, 'Dig');
    for (const m of s.mercs) {
      expect(m.hp).toBeCloseTo(m.derived.maxHp * 0.75);
    }
    expect(s.given).toHaveLength(2);
    expect(s.pack.materials.get('iron')).toBe(2);
  });

  it('a deserter comes at half the wage, with a flaw', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = begin('deserter', seed);
      expect(['vanguard', 'ranger', 'cleric']).toContain(s.play.figure);
      expect(s.play.text).toMatch(/cowardice|greed/);
      choose(s.play, 'Take');
      expect(s.hired).toHaveLength(1);
      expect(s.pack.gold).toBe(10000 - s.hired[0].wage);
    }
    const poor = begin('deserter', 1, 0);
    expect(poor.play.choices[0].why?.()).toBe('Too poor.');
  });
});
