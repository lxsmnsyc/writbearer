import { describe, expect, it } from 'vitest';
import { BASES, BASE_BY_ID, TIERS } from '../../src/content/items';
import { spawnBearer, spawnMerc } from '../../src/content/roster';
import RNG, { hashSeed } from '../../src/core/rng';
import { Pack, equipFromPack } from '../../src/game/inventory';
import { loadItem, saveItem } from '../../src/game/save';
import { ELITE_FROM, EXCEPTIONAL_FROM, itemLines, plainItem, rollItem } from '../../src/gen/loot';
import { EquipSlot, ItemType, Tier, meetsRequirements, requirementText } from '../../src/sim/item';
import Sim from '../../src/sim/sim';

const FIRST_IDS = [
  'jerkin',
  'jerkin',
  'armingSword',
  'towerShield',
  'amulet',
  'kettleHelm',
  'ring',
  'yewLongbow',
];
const IDS_DIGEST = 4267895782;
const FINAL_STATE = 3099429952;

const tier = (id: string): Tier => BASE_BY_ID.get(id)?.tier ?? Tier.Normal;

describe('base tiers', () => {
  it('gives only Normal bases below the Exceptional item level', () => {
    const rng = new RNG(11);
    for (let i = 0; i < 300; i++) {
      const item = rollItem(rng, 1 + (i % (EXCEPTIONAL_FROM - 1)));
      expect(tier(item.base.id)).toBe(Tier.Normal);
    }
  });

  it('gives Exceptional and Elite bases at high item levels, stronger than the Normal range', () => {
    for (const [level, want] of [
      [EXCEPTIONAL_FROM, Tier.Exceptional],
      [ELITE_FROM, Tier.Elite],
    ] as const) {
      const rng = new RNG(5);
      let seen = 0;
      for (let i = 0; i < 300; i++) {
        const item = rollItem(rng, level);
        const siblings = [...TIERS.values()].find(
          (t) => t.exceptional === item.base || t.elite === item.base,
        );
        if (!siblings) {
          continue;
        }
        seen++;
        expect(item.base.tier).toBe(want);
        const normal = BASES.find((b) => TIERS.get(b.id) === siblings)!;
        if (item.base.damage && normal.damage) {
          expect(item.base.damage.min.min).toBeGreaterThan(normal.damage.min.max);
        }
        if (item.base.armor && normal.armor) {
          expect(item.base.armor.min).toBeGreaterThan(normal.armor.max);
        }
        expect(item.base.requirements).toBeDefined();
      }
      expect(seen).toBeGreaterThan(50);
    }
  });

  it('keeps the same rng draws as before for item levels 1 to 10', () => {
    const rng = new RNG(20260105);
    const ids: string[] = [];
    for (let i = 0; i < 200; i++) {
      ids.push(rollItem(rng, 1 + (i % 10)).base.id);
    }
    // Recorded before the tiers existed.
    expect(ids.slice(0, 8)).toEqual(FIRST_IDS);
    expect(hashSeed(...ids)).toBe(IDS_DIGEST);
    expect(rng.state).toBe(FINAL_STATE);
  });

  it('refuses a weapon above the merc STR and equips it with enough', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const merc = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const pack = new Pack();
    const sword = plainItem(TIERS.get('armingSword')!.elite);
    expect(sword.base.requirements?.str).toBeGreaterThan(merc.base.str);
    expect(meetsRequirements(sword, merc)).toBe(false);
    pack.add(sword);
    const refused = equipFromPack(sim, bearer, pack, merc, sword.uid);
    expect(refused).toContain('needs more');
    expect(merc.equipment.get(EquipSlot.Weapon)).not.toBe(sword);
    expect(pack.items).toContain(sword);
    merc.base.str = sword.base.requirements!.str!;
    expect(equipFromPack(sim, bearer, pack, merc, sword.uid)).toBeNull();
    expect(merc.equipment.get(EquipSlot.Weapon)).toBe(sword);
  });

  it('equips body armor whatever the requirement', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const merc = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const pack = new Pack();
    const plate = plainItem(TIERS.get('hauberk')!.elite);
    expect(meetsRequirements(plate, merc)).toBe(false);
    pack.add(plate);
    expect(equipFromPack(sim, bearer, pack, merc, plate.uid)).toBeNull();
    expect(merc.equipment.get(EquipSlot.Body)).toBe(plate);
  });

  it('shows the requirements in the item lines', () => {
    const sword = plainItem(BASE_BY_ID.get('armingSword')!);
    expect(requirementText(sword)).toBe('Requires STR 8');
    expect(itemLines(sword)).toContain('Requires STR 8');
    expect(requirementText(plainItem(BASE_BY_ID.get('pilgrimStaff')!))).toBe('');
  });

  it('round trips an Elite item through the save', () => {
    const rng = new RNG(3);
    const item = rollItem(rng, ELITE_FROM + 5, undefined, { types: [ItemType.Weapon] });
    expect(item.base.tier).toBe(Tier.Elite);
    const loaded = loadItem(structuredClone(saveItem(item)))!;
    expect(loaded.base).toBe(item.base);
    expect(loaded.base.tier).toBe(Tier.Elite);
    expect(loaded.rolls).toEqual(item.rolls);
  });

  it('loads a save written before the tiers', () => {
    const old = {
      base: 'armingSword',
      itemLevel: 3,
      quality: 1,
      rolls: { min: 26, max: 35 },
      affixes: [],
      bonuses: [],
      sockets: 0,
      cards: [],
      refine: 0,
      quantity: 1,
    };
    const loaded = loadItem(old)!;
    expect(loaded.base.id).toBe('armingSword');
    expect(loaded.rolls).toEqual({ min: 26, max: 35 });
  });
});
