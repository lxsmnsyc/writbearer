import type { Lifecycle } from '../core/lifecycle';
import { type Item, ItemType } from './item';
import type { Element } from './types';
import type Unit from './unit';

/**
 * What a Rare's element does while worn: a weapon sets the wearer's attack
 * element, an armor piece adds a defense element modifier. Undefined with none.
 */
export default function elementEffect(item: Item): ((unit: Unit) => Lifecycle) | undefined {
  const element = item.element;
  if (element === undefined) {
    return undefined;
  }
  if (item.base.type === ItemType.Weapon) {
    return (unit) => {
      let before: Element | null = null;
      return {
        start: () => {
          before = unit.attackElement;
          unit.attackElement = element;
        },
        stop: () => {
          if (before !== null) {
            unit.attackElement = before;
            before = null;
          }
        },
      };
    };
  }
  const id = `item:${item.uid}:element`;
  const level = item.elementLevel ?? 1;
  return (unit) => ({
    start: () => {
      unit.setBonus(id, [{ defense: element, level }]);
    },
    stop: () => {
      unit.setBonus(id, null);
    },
  });
}
