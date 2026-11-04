import { describe, expect, it } from 'vitest';
import { BASES } from '../../src/content/items';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { PIECE_BY_ID, SET_BY_ID, applySets, setCount } from '../../src/content/sets';
import { Pack, equipFromPack, unequipToPack } from '../../src/game/inventory';
import { loadMerc, saveMerc } from '../../src/game/save';
import { makeSetPiece, plainItem } from '../../src/gen/loot';
import { markStripper } from '../../src/sim/ai/stripper';
import { EquipSlot, type Item } from '../../src/sim/item';
import Sim from '../../src/sim/sim';
import { restoreAll, stripped } from '../../src/sim/strip';
import { DamageFlags, DamageKind } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

function make(id: string): Item {
  const base = BASES.find((b) => b.id === id);
  if (!base) {
    throw new Error(id);
  }
  return plainItem(base);
}

interface Rig {
  sim: Sim;
  bearer: Unit;
  merc: Unit;
  other: Unit;
  stripper: Unit;
}

function rig(): Rig {
  const sim = new Sim(1);
  sim.setFloor(40, 20);
  const bearer = spawnBearer(sim, 10, 10);
  const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
  const other = spawnMerc(sim, 'vanguard', 5, 12, 12);
  const stripper = spawnMonster(sim, 'mite', 1, 13, 10);
  markStripper(stripper);
  merc.equip(EquipSlot.Weapon, make('armingSword'));
  merc.equip(EquipSlot.Body, make('hauberk'));
  other.equip(EquipSlot.Weapon, make('armingSword'));
  return { sim, bearer, merc, other, stripper };
}

// A landed basic attack.
function strike(from: Unit, to: Unit): void {
  from.hit(to, { kind: DamageKind.True, fixed: 1, flags: DamageFlags.BasicAttack });
}

describe('strippers', () => {
  it('strip the weapon first and leave the armor', () => {
    const { merc, stripper } = rig();
    const atk = merc.derived.atkMax;
    const armor = merc.derived.armor;
    strike(stripper, merc);
    expect(stripped(merc)).toEqual([EquipSlot.Weapon]);
    expect(merc.derived.atkMax).toBeLessThan(atk);
    expect(merc.derived.armor).toBe(armor);
    // The item stays in its slot
    expect(merc.equipment.has(EquipSlot.Weapon)).toBe(true);
  });

  it('strip once a merc an area, and another merc may be stripped', () => {
    const { sim, merc, other, stripper } = rig();
    strike(stripper, merc);
    strike(stripper, merc);
    expect(stripped(merc)).toEqual([EquipSlot.Weapon]);
    strike(stripper, other);
    expect(stripped(other)).toEqual([EquipSlot.Weapon]);
    // A new area restores everything and allows a new strip
    sim.area++;
    restoreAll(sim);
    expect(stripped(merc)).toEqual([]);
    expect(stripped(other)).toEqual([]);
    strike(stripper, merc);
    expect(stripped(merc)).toEqual([EquipSlot.Weapon]);
  });

  it('ignore spells', () => {
    const { merc, stripper } = rig();
    stripper.hit(merc, { kind: DamageKind.True, fixed: 1, flags: DamageFlags.DoT });
    stripper.hit(merc, { kind: DamageKind.True, fixed: 1, flags: DamageFlags.Skill });
    expect(stripped(merc)).toEqual([]);
  });

  it('give the bonus back when the item is handed back', () => {
    const { sim, bearer, merc, stripper } = rig();
    const atk = merc.derived.atkMax;
    const pack = new Pack();
    strike(stripper, merc);
    expect(unequipToPack(sim, bearer, pack, merc, EquipSlot.Weapon)).toBeNull();
    expect(stripped(merc)).toEqual([]);
    expect(pack.items).toHaveLength(1);
    expect(equipFromPack(sim, bearer, pack, merc, pack.items[0].uid)).toBeNull();
    expect(merc.derived.atkMax).toBe(atk);
    expect(pack.items).toHaveLength(0);
  });

  it('keep the item through a save, with nothing lost or doubled', () => {
    const { sim, merc, stripper } = rig();
    const atk = merc.derived.atkMax;
    strike(stripper, merc);
    const loaded = loadMerc(sim, structuredClone(saveMerc(merc)), 1, 1);
    expect(loaded.equipment.size).toBe(merc.equipment.size);
    expect(stripped(loaded)).toEqual([]);
    expect(loaded.derived.atkMax).toBe(atk);
  });

  it('do not count a stripped piece toward a set', () => {
    const { sim, merc, stripper } = rig();
    const set = SET_BY_ID.get('ironCompany')!;
    const piece = [...PIECE_BY_ID.values()].find((p) => p.set === set)!;
    merc.equipment.clear();
    merc.equip(EquipSlot.Head, makeSetPiece(piece.piece));
    expect(setCount(sim, set)).toBe(1);
    strike(stripper, merc);
    applySets(sim);
    expect(setCount(sim, set)).toBe(0);
  });
});
