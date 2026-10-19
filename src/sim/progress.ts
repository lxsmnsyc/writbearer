import { Rank } from './types';
import { shiftDiscipline } from './morale';
import type Unit from './unit';

// First numbers for leveling. A run ends near level 25, as the skill-tree
// design expects. Areas swarm, so a plain kill is worth little.

/** Stat points gained per level, to raise by hand. */
export const STAT_POINTS = 3;
// Experience for a kill, per monster level, by rank.
const KILL_XP: Record<Rank, number> = {
  [Rank.Normal]: 5,
  [Rank.Elite]: 35,
  [Rank.Boss]: 150,
};

/** Experience needed to go from `level` to the next. */
export function xpToNext(level: number): number {
  return Math.round(20 * level ** 1.5);
}

/** Experience a kill is worth, before it is shared. */
export function killXp(monster: Unit): number {
  return KILL_XP[monster.rank] * monster.level;
}

/**
 * Adds experience. Each level gained gives a skill point and stat points.
 * Returns how many levels were gained.
 */
export function gainXp(unit: Unit, xp: number): number {
  unit.xp += xp;
  let gained = 0;
  while (unit.xp >= xpToNext(unit.level)) {
    unit.xp -= xpToNext(unit.level);
    unit.level++;
    unit.skillPoints++;
    unit.statPoints += STAT_POINTS;
    // Each level makes a merc a little more disciplined.
    shiftDiscipline(unit, 1);
    gained++;
  }
  if (gained > 0) {
    unit.recalc();
  }
  return gained;
}
