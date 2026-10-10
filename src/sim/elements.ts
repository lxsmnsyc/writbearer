import type { Element } from './types';

// Rows are the attack element, columns the defense element, in `Element`
// order: Neutral, Fire, Frost, Storm, Earth, Venom, Radiant, Occult, Spectral.
// One table per defense level, 1 to 3.
//
// Values are rAthena renewal's `db/re/attr_fix.yml`, levels 1 to 3, with
// Water as Frost, Wind as Storm, Poison as Venom, Holy as Radiant, Dark as
// Occult and Ghost as Spectral. Undead is a race in this game, not an element.
const TABLE: readonly (readonly (readonly number[])[])[] = [
  [
    [100, 100, 100, 100, 100, 100, 100, 100, 90],
    [100, 25, 90, 100, 150, 150, 100, 100, 100],
    [100, 150, 25, 90, 100, 150, 100, 100, 100],
    [100, 100, 150, 25, 90, 150, 100, 100, 100],
    [100, 90, 100, 150, 25, 150, 100, 100, 100],
    [100, 150, 150, 150, 150, 0, 75, 75, 75],
    [100, 100, 100, 100, 100, 75, 0, 125, 100],
    [100, 100, 100, 100, 100, 75, 125, 0, 100],
    [90, 100, 100, 100, 100, 75, 90, 90, 125],
  ],
  [
    [100, 100, 100, 100, 100, 100, 100, 100, 70],
    [100, 0, 80, 100, 175, 150, 100, 100, 100],
    [100, 175, 0, 80, 100, 150, 100, 100, 100],
    [100, 100, 175, 0, 80, 150, 100, 100, 100],
    [100, 80, 100, 175, 0, 150, 100, 100, 100],
    [100, 150, 150, 150, 150, 0, 75, 75, 75],
    [100, 100, 100, 100, 100, 75, 0, 150, 100],
    [100, 100, 100, 100, 100, 75, 150, 0, 100],
    [70, 100, 100, 100, 100, 75, 80, 80, 150],
  ],
  [
    [100, 100, 100, 100, 100, 100, 100, 100, 50],
    [100, 0, 70, 100, 200, 125, 100, 100, 100],
    [100, 200, 0, 70, 100, 125, 100, 100, 100],
    [100, 100, 200, 0, 70, 125, 100, 100, 100],
    [100, 70, 100, 200, 0, 125, 100, 100, 100],
    [100, 125, 125, 125, 125, 0, 50, 50, 50],
    [100, 100, 100, 100, 100, 50, 0, 175, 100],
    [100, 100, 100, 100, 100, 50, 175, 0, 100],
    [50, 100, 100, 100, 100, 50, 70, 70, 175],
  ],
];

export const MIN_ELEMENT_LEVEL = 1;
export const MAX_ELEMENT_LEVEL = 3;

/**
 * The percent of damage an attack element deals to a defense element at a level.
 */
export function affinity(attack: Element, defense: Element, level: number): number {
  const l = Math.max(MIN_ELEMENT_LEVEL, Math.min(MAX_ELEMENT_LEVEL, level));
  return TABLE[l - 1][attack][defense];
}
