import { describe, expect, it } from 'vitest';
import { BONUS_CARDS } from '../../src/content/cards';
import { JOBS } from '../../src/content/jobs';
import { spawnMerc } from '../../src/content/roster';
import { rankOf } from '../../src/content/skills';
import { loadItem, saveItem } from '../../src/game/save';
import { itemLines, plainItem } from '../../src/gen/loot';
import { MAX_RANK, applyUpgrade } from '../../src/sim/builds';
import { EquipSlot, type ItemBase, ItemType } from '../../src/sim/item';
import Sim from '../../src/sim/sim';
import type { Modifier } from '../../src/sim/stats';
import { Element } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const ring = (id: string): ItemBase => ({
  id,
  name: id,
  type: ItemType.Accessory,
  level: 1,
  weight: 1,
  maxSockets: 1,
});

// A ring that carries the given bonuses
function wear(unit: Unit, bonuses: Modifier[]): ReturnType<typeof plainItem> {
  const item = plainItem(ring('ring'));
  item.bonuses = bonuses;
  unit.equip(EquipSlot.Accessory1, item);
  return item;
}

function cleric(level = 5): Unit {
  return spawnMerc(new Sim(1), 'cleric', level, 0, 0);
}

describe('defense element bonus', () => {
  it('a worn Fire 2 makes the wearer Fire 2; unequipping restores the spec element', () => {
    const unit = cleric();
    const before = [unit.element, unit.elementLevel];
    wear(unit, [{ defense: Element.Fire, level: 2 }]);
    expect([unit.element, unit.elementLevel]).toEqual([Element.Fire, 2]);
    unit.unequip(EquipSlot.Accessory1);
    expect([unit.element, unit.elementLevel]).toEqual(before);
  });

  it('two sources use the higher level', () => {
    const unit = cleric();
    wear(unit, [
      { defense: Element.Fire, level: 2 },
      { defense: Element.Frost, level: 3 },
    ]);
    expect([unit.element, unit.elementLevel]).toEqual([Element.Frost, 3]);
  });
});

describe('spell rank bonus', () => {
  it('raises rankOf, and an elite upgrade on the spell reads the raised rank', () => {
    const unit = cleric();
    const base = rankOf(unit, 'heal');
    wear(unit, [{ spell: 'heal', rank: 2 }]);
    expect(rankOf(unit, 'heal')).toBe(base + 2);
    const renew = JOBS.cleric.upgrades.find((u) => u.id === 'renew');
    expect(renew).toBeDefined();
    expect(applyUpgrade(unit, renew!)).toBeNull();
    expect(rankOf(unit, 'heal')).toBe(base + 2);
    expect(rankOf(unit, 'smite')).toBe(rankOf(cleric(), 'smite'));
    unit.unequip(EquipSlot.Accessory1);
    expect(rankOf(unit, 'heal')).toBe(base);
  });

  it('never passes MAX_RANK', () => {
    const unit = cleric();
    wear(unit, [{ spell: 'heal', rank: 50 }]);
    expect(rankOf(unit, 'heal')).toBe(MAX_RANK);
  });

  it('does nothing for a spell the unit lacks', () => {
    const unit = cleric();
    wear(unit, [{ spell: 'fireball', rank: 3 }]);
    expect(unit.skillRank('fireball')).toBe(0);
    expect(unit.skills.some((s) => s.id === 'fireball')).toBe(false);
    expect(rankOf(unit, 'fireball')).toBe(1);
  });

  it('adds the same spell from two sources', () => {
    const unit = cleric();
    const base = rankOf(unit, 'heal');
    wear(unit, [
      { spell: 'heal', rank: 1 },
      { spell: 'heal', rank: 1 },
    ]);
    expect(rankOf(unit, 'heal')).toBe(base + 2);
  });
});

describe('saving and tooltips', () => {
  const forms: Modifier[] = [
    { defense: Element.Fire, level: 2 },
    { spell: 'heal', rank: 1 },
  ];

  it('round trips an item and a card carrying both forms', () => {
    const item = plainItem(ring('ring'));
    item.bonuses = forms;
    const back = loadItem(structuredClone(saveItem(item)));
    expect(back?.bonuses).toEqual(forms);

    for (const base of BONUS_CARDS) {
      const card = plainItem(base);
      const loaded = loadItem(structuredClone(saveItem(card)));
      expect(loaded?.base.socket?.modifiers).toEqual(base.socket?.modifiers);
    }
  });

  it('loads an old item with no such bonuses', () => {
    const old = saveItem(plainItem(ring('ring')));
    expect(loadItem(structuredClone(old))?.bonuses).toEqual([]);
  });

  it('shows both forms in the tooltip', () => {
    const item = plainItem(ring('ring'));
    item.bonuses = forms;
    const lines = itemLines(item);
    expect(lines).toContain('Defense: Fire 2');
    expect(lines).toContain('+1 to Heal');
  });

  it('the example cards carry one form each', () => {
    const mods: Modifier[] = [];
    for (const card of BONUS_CARDS) {
      mods.push(...(card.socket?.modifiers ?? []));
    }
    expect(mods.some((m) => 'defense' in m)).toBe(true);
    expect(mods.some((m) => 'spell' in m)).toBe(true);
  });
});
