import { describe, expect, it } from 'vitest';
import { AFFIX_BY_ID, BASE_BY_ID } from '../../src/content/items';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import { Pack, cannotHand, equipFromPack, unequipToPack } from '../../src/game/inventory';
import { itemName, plainItem, rollDrops, rollItem } from '../../src/gen/loot';
import { EquipSlot, type Item, Quality } from '../../src/sim/item';
import Sim from '../../src/sim/sim';
import { Rank } from '../../src/sim/types';

const roll = (seed: number, level: number, rank = Rank.Normal): Item[] => {
  const rng = new RNG(seed);
  return Array.from({ length: 400 }, () => rollItem(rng, level, rank));
};

// Everything but the uid, which counts up across the whole run.
const strip = ({ uid: _uid, ...rest }: Item): Omit<Item, 'uid'> => rest;

describe('rolling items', () => {
  it('rolls the same items from the same stream', () => {
    expect(roll(7, 5).map(strip)).toEqual(roll(7, 5).map(strip));
  });

  it('gives each quality its number of affixes, one per group', () => {
    for (const item of roll(1, 8)) {
      const kinds = item.affixes.map((a) => AFFIX_BY_ID.get(a.id)!);
      const prefixes = kinds.filter((a) => a.kind === 'prefix').length;
      const suffixes = kinds.length - prefixes;
      expect(new Set(kinds.map((a) => a.group)).size).toBe(kinds.length);
      if (item.quality === Quality.Magic) {
        expect(prefixes).toBeLessThanOrEqual(1);
        expect(suffixes).toBeLessThanOrEqual(1);
      } else if (item.quality === Quality.Rare) {
        expect(prefixes).toBeLessThanOrEqual(3);
        expect(suffixes).toBeLessThanOrEqual(3);
        expect(item.name).toBeDefined();
      } else {
        expect(kinds).toHaveLength(0);
      }
    }
  });

  it('only rolls bases and affixes the item level allows', () => {
    for (const item of roll(2, 1)) {
      expect(item.base.level).toBeLessThanOrEqual(1);
      for (const a of item.affixes) {
        expect(AFFIX_BY_ID.get(a.id)!.level).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives fewer sockets to items with more affixes', () => {
    for (const item of roll(3, 8)) {
      if (item.quality === Quality.Rare) {
        expect(item.sockets).toBeLessThanOrEqual(1);
      }
      expect(item.sockets).toBeLessThanOrEqual(item.base.maxSockets);
    }
  });

  it('rolls better from elites', () => {
    const rares = (rank: Rank): number =>
      roll(4, 6, rank).filter((i) => i.quality === Quality.Rare).length;
    expect(rares(Rank.Elite)).toBeGreaterThan(rares(Rank.Normal) * 2);
  });

  it('always drops equipment from an elite', () => {
    const rng = new RNG(5);
    for (let i = 0; i < 50; i++) {
      expect(rollDrops(rng, 4, Rank.Elite).filter((x) => x.base.id !== 'gold').length).toBe(2);
    }
  });

  it('names magic items from their affixes', () => {
    const magic = roll(6, 8).find((i) => i.quality === Quality.Magic && i.affixes.length === 2)!;
    const name = itemName(magic);
    expect(name).toContain(magic.base.name);
    expect(name.split(' ').length).toBeGreaterThan(magic.base.name.split(' ').length);
  });
});

describe('equipment', () => {
  it('gives the starting mercs the stats they had before gear existed', () => {
    const sim = new Sim(1);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0);
    expect(vanguard.derived.armor).toBe(70);
    expect(vanguard.derived.blockChance).toBe(35);
    expect(vanguard.derived.blockAmount).toBe(60);
    expect(vanguard.derived.atkMax - vanguard.derived.atkMin).toBe(8);
    const ranger = spawnMerc(sim, 'ranger', 5, 0, 0);
    expect(ranger.derived.armor).toBe(20);
  });

  it('changes stats when worn and when taken off', () => {
    const sim = new Sim(1);
    const ranger = spawnMerc(sim, 'ranger', 5, 0, 0);
    const before = ranger.derived.armor;
    const hood = plainItem(BASE_BY_ID.get('hood')!);
    ranger.equip(EquipSlot.Head, hood);
    expect(ranger.derived.armor).toBe(before + hood.rolls.armor!);
    ranger.unequip(EquipSlot.Head);
    expect(ranger.derived.armor).toBe(before);
  });
});

describe('the pack', () => {
  it('refuses what is too heavy, and slows the bearer past half its weight', () => {
    const pack = new Pack();
    const hauberk = BASE_BY_ID.get('hauberk')!;
    expect(pack.speed).toBe(1);
    pack.add(plainItem(hauberk));
    pack.add(plainItem(hauberk));
    expect(pack.speed).toBeLessThan(1);
    pack.add(plainItem(hauberk));
    expect(pack.add(plainItem(hauberk))).toBe(false);
  });

  it('hands gear to a merc who can use it, and puts the old piece in the pack', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 10, 0);
    const pack = new Pack();
    const bow = plainItem(BASE_BY_ID.get('huntingBow')!);
    const mace = plainItem(BASE_BY_ID.get('flangedMace')!);
    pack.add(bow);
    pack.add(mace);
    expect(equipFromPack(sim, bearer, pack, vanguard, bow.uid)).toMatch(/cannot use/);
    expect(equipFromPack(sim, bearer, pack, vanguard, mace.uid)).toBeNull();
    expect(vanguard.equipment.get(EquipSlot.Weapon)).toBe(mace);
    expect(pack.items.some((i) => i.base.id === 'armingSword')).toBe(true);
    expect(unequipToPack(sim, bearer, pack, vanguard, EquipSlot.Weapon)).toBeNull();
    expect(vanguard.equipment.has(EquipSlot.Weapon)).toBe(false);
  });

  it('in a fight, hands gear over only from next to the merc', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 5, 6, 0);
    expect(cannotHand(sim, bearer, vanguard)).toBeNull();
    spawnMonster(sim, 'crawler', 4, 3, 3).aware = true;
    expect(cannotHand(sim, bearer, vanguard)).toMatch(/stand next to/);
    vanguard.x = 1;
    expect(cannotHand(sim, bearer, vanguard)).toBeNull();
  });
});
