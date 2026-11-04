import type { Hunt, Toggles } from '../ai';
import type { Skill } from '../skill';
import type { BaseStats, Job, Modifier, Weapon } from '../stats';
import type { Element, Race, Rank, Side } from '../types';

/**
 * How a unit moves and swings. Distances are in tiles, times in seconds.
 */
export interface Kit {
  // How close the unit must be to land a basic attack
  reach: number;
  // Time between the starts of two basic attacks
  interval: number;
  // When in the swing the blow lands, or the arrow leaves
  hitAt: number;
  moveSpeed: number;
  // How far the unit notices enemies
  sight: number;
  // How far a monster notices the bearer and its lantern. Mercs, unlit, are
  // noticed from three quarters of it.
  notice: number;
  // How fast it can turn, in radians a second, or 0 to turn at once. A
  // Shieldbearer turns slowly, so it can be flanked.
  turn: number;
}

export const DEFAULT_KIT: Kit = {
  reach: 1,
  interval: 1,
  hitAt: 0.5,
  moveSpeed: 2.5,
  sight: 7,
  notice: 5,
  turn: 0,
};

export interface UnitSpec {
  // The content entry the unit was made from, such as 'vanguard'
  kind?: string;
  name: string;
  side: Side;
  job: Job;
  level: number;
  base: BaseStats;
  weapon: Weapon;
  race?: Race;
  rank?: Rank;
  // Defense element and its level, 1 to 3
  element?: Element;
  elementLevel?: number;
  // The element of basic attacks
  attackElement?: Element;
  modifiers?: Modifier[];
  kit?: Partial<Kit>;
  x?: number;
  z?: number;
  // Mercs follow the player's toggles. Monsters follow their hunt.
  toggles?: Toggles;
  hunt?: Hunt;
  skills?: Skill[];
}
