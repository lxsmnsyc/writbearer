import { describe, expect, it } from 'vitest';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import {
  DefensePriority,
  clearDefenseElement,
  defenseShift,
  setDefenseElement,
  syncItemDefense,
} from '../../src/sim/defense-element';
import { affinity } from '../../src/sim/elements';
import Sim from '../../src/sim/sim';
import { FREEZE, PETRIFY } from '../../src/sim/statuses';
import { Element } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

function pair(): { vanguard: Unit; soldier: Unit } {
  const sim = new Sim(1);
  const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0);
  const soldier = spawnMonster(sim, 'hollowSoldier', 4, 30, 0);
  return { vanguard, soldier };
}

const SHIFT = defenseShift(Element.Fire, 2);

describe('defense element overrides', () => {
  it('freeze and petrify set Frost 1 and Earth 1, then restore', () => {
    const { vanguard, soldier } = pair();
    soldier.addStatus(FREEZE, vanguard);
    expect([soldier.element, soldier.elementLevel]).toEqual([Element.Frost, 1]);
    soldier.removeStatus(FREEZE.id);
    soldier.addStatus(PETRIFY, vanguard);
    expect(soldier.element).toBe(Element.Earth);
    soldier.removeStatus(PETRIFY.id);
    expect(soldier.element).toBe(Element.Neutral);
  });

  it('a freeze beats a skill shift, in both end orders', () => {
    for (const skillFirst of [true, false]) {
      const { vanguard, soldier } = pair();
      soldier.addStatus(FREEZE, vanguard);
      soldier.addStatus(SHIFT, vanguard);
      expect(soldier.element).toBe(Element.Frost);
      soldier.removeStatus(skillFirst ? SHIFT.id : FREEZE.id);
      expect(soldier.element).toBe(skillFirst ? Element.Frost : Element.Fire);
      expect(soldier.elementLevel).toBe(skillFirst ? 1 : 2);
      soldier.removeStatus(skillFirst ? FREEZE.id : SHIFT.id);
      expect(soldier.element).toBe(Element.Neutral);
      expect(soldier.elementLevel).toBe(1);
    }
  });

  it('a skill shift beats an item, and the item returns after it', () => {
    const { vanguard, soldier } = pair();
    syncItemDefense(soldier, [{ defense: Element.Earth, level: 1 }]);
    expect(soldier.element).toBe(Element.Earth);
    soldier.addStatus(SHIFT, vanguard);
    expect(soldier.element).toBe(Element.Fire);
    soldier.removeStatus(SHIFT.id);
    expect(soldier.element).toBe(Element.Earth);
    syncItemDefense(soldier, []);
    expect(soldier.element).toBe(Element.Neutral);
  });

  it('keeps the base element under an override', () => {
    const { soldier } = pair();
    soldier.element = Element.Storm;
    setDefenseElement(soldier, 'a', Element.Fire, 1, DefensePriority.Skill);
    clearDefenseElement(soldier, 'a');
    expect(soldier.element).toBe(Element.Storm);
    clearDefenseElement(soldier, 'missing');
    expect(soldier.element).toBe(Element.Storm);
  });

  it('a Fire shift takes Frost damage per the affinity table, a Neutral unit does not', () => {
    const { vanguard, soldier } = pair();
    soldier.addStatus(SHIFT, vanguard);
    const shifted = affinity(Element.Frost, soldier.element, soldier.elementLevel);
    const neutral = affinity(Element.Frost, Element.Neutral, 1);
    expect(shifted).toBe(affinity(Element.Frost, Element.Fire, 2));
    expect(shifted).not.toBe(neutral);
  });
});
