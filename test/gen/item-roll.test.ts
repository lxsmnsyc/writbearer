import { describe, expect, it } from 'vitest';
import { RECIPES } from '../../src/content/recipes';
import { spawnMerc } from '../../src/content/roster';
import { spoilsOf } from '../../src/game/game/rewards';
import type GameState from '../../src/game/game/state';
import RNG from '../../src/core/rng';
import { type ItemSave, loadItem, saveItem } from '../../src/game/save';
import { itemLines, itemName, rollItem } from '../../src/gen/loot';
import { SimEvents } from '../../src/sim/events';
import { EquipSlot, type Item, ItemType, Quality } from '../../src/sim/item';
import Sim from '../../src/sim/sim';
import { Element, Rank, ValuePriority } from '../../src/sim/types';

const clone = (save: ItemSave): ItemSave => structuredClone(save);

const roll = (seed: number, level = 10, count = 400, sim?: Sim): Item[] => {
  const rng = new RNG(seed);
  return Array.from({ length: count }, () => rollItem(rng, level, Rank.Elite, {}, sim));
};

const rare = (type: ItemType, element: Element): Item => {
  for (let seed = 1; seed < 400; seed++) {
    const found = roll(seed).find(
      (i) => i.quality === Quality.Rare && i.base.type === type && i.element === element,
    );
    if (found) {
      return found;
    }
  }
  throw new Error('no such item');
};

// Taken on the tree before this node
const BEFORE = 2591832227;
const BEFORE_STATE = 2785523601;

// Everything the draws before the element decide.
const digest = (item: Item): unknown => [
  item.base.id,
  item.quality,
  item.rolls,
  item.affixes,
  item.bonuses,
  item.sockets,
  item.name,
];

describe('rare elements', () => {
  it('only gives an element to Rare weapons and armor', () => {
    let weapons = 0;
    let armor = 0;
    for (const item of roll(3, 12, 1500)) {
      if (item.element === undefined) {
        continue;
      }
      expect(item.quality).toBe(Quality.Rare);
      if (item.base.type === ItemType.Weapon) {
        weapons++;
        expect(item.elementLevel).toBeUndefined();
      } else {
        armor++;
        expect(item.base.type).toBeGreaterThanOrEqual(ItemType.Head);
        expect(item.base.type).toBeLessThanOrEqual(ItemType.Boots);
        expect([1, 2]).toContain(item.elementLevel);
      }
    }
    expect(weapons).toBeGreaterThan(0);
    expect(armor).toBeGreaterThan(0);
  });

  it('sets the wearer attack element from a weapon and clears it when removed', () => {
    const weapon = rare(ItemType.Weapon, Element.Fire);
    const merc = spawnMerc(new Sim(1), 'ranger', 5, 0, 0);
    const before = merc.attackElement;
    merc.equip(EquipSlot.Weapon, weapon);
    expect(merc.attackElement).toBe(Element.Fire);
    merc.unequip(EquipSlot.Weapon);
    expect(merc.attackElement).toBe(before);
  });

  it('sets the wearer defense element from armor and clears it when removed', () => {
    const helm = rare(ItemType.Head, Element.Frost);
    const merc = spawnMerc(new Sim(1), 'vanguard', 5, 0, 0);
    const before = [merc.element, merc.elementLevel];
    merc.equip(EquipSlot.Head, helm);
    expect([merc.element, merc.elementLevel]).toEqual([Element.Frost, helm.elementLevel]);
    merc.unequip(EquipSlot.Head);
    expect([merc.element, merc.elementLevel]).toEqual(before);
  });

  it('shows the element in the name and the tooltip', () => {
    const weapon = rare(ItemType.Weapon, Element.Fire);
    expect(itemName(weapon)).toContain('(Fire)');
    expect(itemLines(weapon)).toContain('Attacks with Fire');
    const helm = rare(ItemType.Head, Element.Frost);
    expect(itemLines(helm)).toContain(`Defense: Frost ${helm.elementLevel}`);
  });

  it('leaves the existing draws where they were', () => {
    // Taken on the tree before this node: 200 items, seed 42, item level 20.
    const rng = new RNG(42);
    const items = Array.from({ length: 200 }, () => rollItem(rng, 20, Rank.Elite));
    expect(hash(JSON.stringify(items.map(digest)))).toBe(BEFORE);
    expect(rng.state).toBe(BEFORE_STATE);
  });
});

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

describe('CheckItemRoll', () => {
  it('is a no-op with no listener', () => {
    const quiet = roll(9, 10, 200, new Sim(1));
    expect(quiet.map(digest)).toEqual(roll(9, 10, 200).map(digest));
  });

  it('lets a listener raise the base roll scale', () => {
    const sim = new Sim(1);
    sim.on(SimEvents.CheckItemRoll, ValuePriority.Additive, (event) => {
      event.scale *= 2;
    });
    const plain = roll(5, 10, 100);
    const boosted = roll(5, 10, 100, sim);
    let higher = 0;
    for (const [i, item] of plain.entries()) {
      const other = boosted[i];
      if (item.rolls.armor !== undefined) {
        // Same base and affix draws, so the same slot of the stream
        expect(other.base.id).toBe(item.base.id);
        expect(other.rolls.armor!).toBeGreaterThanOrEqual(item.rolls.armor);
        if (other.rolls.armor! > item.rolls.armor) {
          higher++;
        }
      }
    }
    expect(higher).toBeGreaterThan(10);
  });

  it('lets a listener set the affix count of a Rare', () => {
    const sim = new Sim(1);
    sim.on(SimEvents.CheckItemRoll, ValuePriority.Additive, (event) => {
      if (event.quality === Quality.Rare) {
        event.affixCount = 1;
      }
    });
    const rares = roll(6, 12, 400, sim).filter((i) => i.quality === Quality.Rare);
    expect(rares.length).toBeGreaterThan(5);
    for (const item of rares) {
      expect(item.affixes.length).toBeLessThanOrEqual(1);
    }
    const normal = roll(6, 12, 400).filter((i) => i.quality === Quality.Rare);
    expect(Math.max(...normal.map((i) => i.affixes.length))).toBeGreaterThan(1);
  });
});

describe('saving an element item', () => {
  it('round trips the element and rebuilds its effect', () => {
    const helm = rare(ItemType.Head, Element.Frost);
    const loaded = loadItem(clone(saveItem(helm)))!;
    expect(loaded.element).toBe(Element.Frost);
    expect(loaded.elementLevel).toBe(helm.elementLevel);
    const merc = spawnMerc(new Sim(1), 'vanguard', 5, 0, 0);
    merc.equip(EquipSlot.Head, loaded);
    expect(merc.element).toBe(Element.Frost);
  });

  it('loads an old item without an element', () => {
    const plain = roll(2).find((i) => i.element === undefined)!;
    const { element: _e, elementLevel: _l, ...saved } = clone(saveItem(plain));
    const loaded = loadItem(saved)!;
    expect(loaded.element).toBeUndefined();
  });
});

describe('callers with a sim', () => {
  it('fires CheckItemRoll for a chest reward and a bench recipe', () => {
    const sim = new Sim(1);
    let fired = 0;
    sim.on(SimEvents.CheckItemRoll, ValuePriority.Additive, () => {
      fired++;
    });
    const g = { sim, mercs: () => [] };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    spoilsOf(g as unknown as GameState, 'arms', new RNG(1), 6, false);
    expect(fired).toBeGreaterThan(1);
    const before = fired;
    const recipe = RECIPES.find((r) => r.id === 'weapon')!;
    recipe.make(new RNG(1), 6, sim);
    expect(fired).toBe(before + 1);
  });
});
