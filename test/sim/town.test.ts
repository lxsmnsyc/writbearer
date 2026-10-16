import { describe, expect, it } from 'vitest';
import { CARD_BY_MONSTER } from '../../src/content/cards';
import { BASE_BY_ID } from '../../src/content/items';
import { materialsFrom } from '../../src/content/materials';
import { RECIPES } from '../../src/content/recipes';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import { Pack } from '../../src/game/inventory';
import {
  SAFE_REFINE,
  addSocket,
  buy,
  cannotRefine,
  craft,
  raise,
  refine,
  salvageItem,
  sell,
} from '../../src/game/town';
import { generateLayerMap } from '../../src/gen/graph';
import { plainItem, rollItem } from '../../src/gen/loot';
import { generateStage } from '../../src/gen/stage';
import { EquipSlot, ItemType, Quality } from '../../src/sim/item';
import Sim from '../../src/sim/sim';
import { DamageKind, Rank } from '../../src/sim/types';

const sword = (): ReturnType<typeof plainItem> => plainItem(BASE_BY_ID.get('armingSword')!);
const rich = (): Pack => {
  const pack = new Pack();
  pack.gold = 100000;
  return pack;
};

describe('the Blacksmith', () => {
  it('refines up to the safe level every time, and each level adds attack', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const item = merc.equipment.get(EquipSlot.Weapon)!;
    const atk = merc.derived.atkMax;
    const pack = rich();
    for (let i = 0; i < SAFE_REFINE; i++) {
      expect(refine(new RNG(i), pack, item, false)).toBe('refined');
    }
    merc.recalc();
    expect(item.refine).toBe(SAFE_REFINE);
    expect(merc.derived.atkMax).toBe(atk + SAFE_REFINE * 3);
  });

  it('past the safe level, sometimes breaks the item, unless a Blessing takes the blow', () => {
    const results = new Set<string>();
    const rng = new RNG(5);
    for (let i = 0; i < 60; i++) {
      const item = sword();
      item.refine = 8;
      results.add(refine(rng, rich(), item, false));
    }
    expect(results).toEqual(new Set(['refined', 'broken']));
    const pack = rich();
    pack.materials.set('blessing', 1);
    const item = sword();
    item.refine = 9;
    // At +9 to +10, most attempts fail: find one that does.
    let result = 'refined';
    for (let seed = 0; result === 'refined'; seed++) {
      item.refine = 9;
      result = refine(new RNG(seed), pack, item, true);
    }
    expect(result).toBe('held');
    expect(item.refine).toBe(8);
    expect(pack.materials.get('blessing')).toBeUndefined();
  });

  it('refines weapons and armor only, and asks for gold', () => {
    const ring = plainItem(BASE_BY_ID.get('ring')!);
    expect(cannotRefine(rich(), ring)).toMatch(/Only weapons and armor/);
    expect(cannotRefine(new Pack(), sword())).toMatch(/costs 25 gold/);
  });

  it('adds a socket, or breaks the item trying', () => {
    const results = new Set<string>();
    const rng = new RNG(2);
    for (let i = 0; i < 40; i++) {
      const item = rollItem(rng, 10, Rank.Normal, {
        types: [ItemType.Body],
        atLeast: Quality.Normal,
      });
      item.sockets = 0;
      results.add(addSocket(rng, rich(), item));
    }
    expect(results).toEqual(new Set(['added', 'broken']));
  });
});

describe('the Synthesis bench', () => {
  it('makes a recipe from materials and gold, and refuses without them', () => {
    const pack = new Pack();
    pack.gold = 10;
    const healing = RECIPES.find((r) => r.id === 'healing')!;
    expect(craft(new RNG(1), pack, healing, 5)).toMatch(/materials/);
    pack.materials.set('chitin', 2);
    expect(craft(new RNG(1), pack, healing, 5)).toBeNull();
    expect(pack.gold).toBe(0);
    expect(pack.materials.size).toBe(0);
    expect(pack.items[0].base.id).toBe('healingDraught');
    expect(pack.items[0].quantity).toBe(2);
  });

  it('crafts a Smith’s Blessing into the pouch, and reforges Magic gear', () => {
    const pack = rich();
    for (const id of ['iron', 'occultEssence', 'radiantEssence', 'bone', 'venomEssence']) {
      pack.materials.set(id, 10);
    }
    expect(
      craft(
        new RNG(1),
        pack,
        RECIPES.find((r) => r.id === 'blessing')!,
        5,
      ),
    ).toBeNull();
    expect(pack.materials.get('blessing')).toBe(1);
    expect(
      craft(
        new RNG(1),
        pack,
        RECIPES.find((r) => r.id === 'weapon')!,
        8,
      ),
    ).toBeNull();
    expect(pack.items[0].base.type).toBe(ItemType.Weapon);
    expect(pack.items[0].quality).toBeGreaterThanOrEqual(Quality.Magic);
  });

  it('salvages gear into Iron, and not cards', () => {
    const pack = new Pack();
    const item = sword();
    const card = plainItem(CARD_BY_MONSTER.husk);
    pack.add(item);
    pack.add(card);
    expect(salvageItem(pack, card.uid)).toMatch(/cannot/);
    expect(salvageItem(pack, item.uid)).toBeNull();
    expect(pack.materials.get('iron')).toBe(1);
  });

  it('gets its materials from monsters, by race and element', () => {
    const sim = new Sim(1);
    const rng = new RNG(3);
    const boss = spawnMonster(sim, 'broodMother', 9, 0, 0);
    const found = materialsFrom(rng, boss);
    expect(found.get('chitin')).toBe(4);
    expect(found.get('venomEssence')).toBe(2);
    const soldier = spawnMonster(sim, 'hollowSoldier', 9, 0, 0);
    let bone = 0;
    for (let i = 0; i < 400; i++) {
      bone += materialsFrom(rng, soldier).get('bone') ?? 0;
    }
    expect(bone / 400).toBeGreaterThan(0.25);
    expect(bone / 400).toBeLessThan(0.45);
  });
});

describe('the Temple and the Market', () => {
  it('the Temple raises the dead for gold, but not the torn', () => {
    const sim = new Sim(1);
    const dead = spawnMerc(sim, 'ranger', 5, 0, 0);
    const torn = spawnMerc(sim, 'ranger', 5, 1, 0);
    const mite = spawnMonster(sim, 'mite', 1, 9, 9);
    dead.hp = 1;
    mite.hit(dead, { kind: DamageKind.True, fixed: 1 });
    mite.hit(torn, { kind: DamageKind.True, fixed: 99999 });
    const pack = rich();
    expect(raise(pack, torn)).toMatch(/torn apart/);
    expect(raise(pack, dead)).toBeNull();
    expect(dead.alive).toBe(true);
  });

  it('the Market sells potions and buys gear', () => {
    const pack = new Pack();
    pack.gold = 25;
    expect(buy(pack, 'healingDraught')).toBeNull();
    expect(pack.gold).toBe(0);
    expect(buy(pack, 'healingDraught')).toMatch(/costs 25/);
    const item = sword();
    pack.add(item);
    expect(sell(pack, item.uid)).toBeNull();
    expect(pack.gold).toBeGreaterThan(0);
  });
});

describe('Towns', () => {
  it('stand once in a layer that has one, and nowhere else', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const towns = (town: boolean): number =>
        generateLayerMap(new RNG(seed), 2, town)
          .columns.flat()
          .filter((n) => n.kind === 'town').length;
      expect(towns(true)).toBe(1);
      expect(towns(false)).toBe(0);
    }
  });

  it('are safe, with a well, and a merc to hire only in endless mode', () => {
    const town = generateStage(new RNG(4), 3, { kind: 'town', ahead: ['combat', 'elite'] });
    expect(town.packs).toHaveLength(0);
    expect(town.town).toBeDefined();
    expect(town.recruit).toBeUndefined();
    expect(town.exits).toHaveLength(2);
    const endless = generateStage(new RNG(4), 3, {
      kind: 'town',
      ahead: ['combat'],
      endless: true,
    });
    expect(endless.recruit).toBeDefined();
  });
});
