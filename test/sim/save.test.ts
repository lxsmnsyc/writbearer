import { describe, expect, it } from 'vitest';
import { CARDS } from '../../src/content/cards';
import { BASE_BY_ID } from '../../src/content/items';
import { spawnMerc } from '../../src/content/roster';
import { learn, treeFor } from '../../src/content/trees';
import { UNIQUE_BY_ID } from '../../src/content/uniques';
import RNG from '../../src/core/rng';
import { RunStreams, Stream } from '../../src/core/seed';
import { loadItem, loadMerc, saveItem, saveMerc } from '../../src/game/save';
import { makeUnique, rollItem } from '../../src/gen/loot';
import { EquipSlot } from '../../src/sim/item';
import Sim from '../../src/sim/sim';
import { Rank } from '../../src/sim/types';

// Through a structured clone, as IndexedDB keeps it. It refuses functions.
const roundTrip = <T>(value: T): T => structuredClone(value);

describe('the save', () => {
  it('keeps an item’s rolls, affixes, refine and cards, under a new id', () => {
    const item = rollItem(new RNG(3), 12, Rank.Boss);
    item.refine = 4;
    item.sockets = 1;
    item.cards = [CARDS[0]];
    const loaded = loadItem(roundTrip(saveItem(item)))!;
    expect(loaded.uid).not.toBe(item.uid);
    expect({ ...loaded, uid: 0, effect: undefined }).toEqual({
      ...item,
      uid: 0,
      effect: undefined,
    });
    expect(loaded.cards[0]).toBe(CARDS[0]);
  });

  it('gives a unique back its effect', () => {
    const item = makeUnique(new RNG(2), UNIQUE_BY_ID.get('thornhide')!);
    const loaded = loadItem(roundTrip(saveItem(item)))!;
    expect(loaded.uniqueValues).toEqual(item.uniqueValues);
    expect(loaded.effect).toBeTypeOf('function');
  });

  it('brings a merc back as it was: level, stats, skills, gear, belt and heart', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 8, 0, 0, undefined, {
      name: 'Odo',
      traits: ['loyal'],
    });
    const branch = treeFor(merc)[0];
    learn(merc, branch, branch.nodes[0]);
    merc.raiseStat('str');
    merc.morale = 33;
    merc.discipline = 61;
    merc.xp = 120;
    merc.hp = 50;
    const armor = rollItem(new RNG(5), 8, Rank.Elite, { types: [BASE_BY_ID.get('hauberk')!.type] });
    merc.equip(EquipSlot.Body, armor);
    merc.belt[2] = null;

    const saved = roundTrip(saveMerc(merc));
    const back = loadMerc(new Sim(1), saved, 3, 4);
    expect(back.name).toBe('Odo');
    expect(back.level).toBe(8);
    expect(back.traits).toEqual(['loyal']);
    expect(back.base).toEqual(merc.base);
    expect(back.morale).toBe(33);
    expect(back.discipline).toBe(61);
    expect(back.xp).toBe(120);
    expect(back.skillPoints).toBe(merc.skillPoints);
    expect(back.statPoints).toBe(merc.statPoints);
    expect([...back.skillRanks]).toEqual([...merc.skillRanks]);
    expect(back.skills.map((s) => s.id)).toEqual(merc.skills.map((s) => s.id));
    expect(new Set(back.equipment.keys())).toEqual(new Set(merc.equipment.keys()));
    expect(back.equipment.get(EquipSlot.Body)?.base.id).toBe(armor.base.id);
    expect(back.belt.map((b) => b?.quantity ?? 0)).toEqual(merc.belt.map((b) => b?.quantity ?? 0));
    expect(back.derived).toEqual(merc.derived);
    expect(back.hp).toBe(50);
  });

  it('keeps a dead merc dead, and a torn one torn', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'ranger', 6, 0, 0);
    merc.hp = 0;
    merc.alive = false;
    merc.torn = true;
    const back = loadMerc(new Sim(1), roundTrip(saveMerc(merc)), 0, 0);
    expect(back.alive).toBe(false);
    expect(back.torn).toBe(true);
  });

  it('picks the random streams up where they stood', () => {
    const run = new RunStreams('ASHEN');
    run.get(1, Stream.Loot).random();
    run.get(1, Stream.Combat).random();
    const loaded = RunStreams.load('ASHEN', roundTrip(run.save()));
    for (const stream of [Stream.Loot, Stream.Combat]) {
      expect(loaded.get(1, stream).random()).toBe(run.get(1, stream).random());
    }
  });
});
