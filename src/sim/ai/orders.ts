import type Unit from '../unit';
import { SkillMode } from '../skill';
import { honoursElites, prioritiesFollowed } from '../morale';

export const enum Stance {
  // Stays near the bearer when there is nothing to fight
  Guard = 0,
  // Walks ahead of the bearer
  Advance = 1,
  // Stays where it stands and only fights what comes close
  Hold = 2,
}

/** Target priorities, checked in order. The first that matches anyone wins. */
export const enum Priority {
  AttackingBearer = 0,
  Nearest = 1,
  LowestHealth = 2,
  Elites = 3,
  // Monsters with skills of their own, such as healers
  Casters = 4,
  // Heralds running to blow a horn
  Heralds = 5,
  // Enemies weakest to the merc's attack element, or to any element it may attack with
  WeakToElement = 6,
}

/** The player's settings for one merc. */
export interface Toggles {
  stance: Stance;
  priorities: Priority[];
  // How far from the bearer the merc may chase, in tiles
  chase: number;
  // How each skill may be used, by skill id. A missing skill is Auto.
  skills: Record<string, SkillMode>;
  // Drinks a healing potion from the belt below this share of health
  drinkAt: number;
}

/** The belt rules a player can pick, from the mercenaries design. */
export const DRINK_AT = { half: 0.5, low: 0.3, emergency: 0.15 } as const;
// A merc with skills drinks for mana below this share, but only in a fight.
export const MANA_AT = 0.25;

export const DEFAULT_TOGGLES: Toggles = {
  stance: Stance.Guard,
  priorities: [Priority.AttackingBearer, Priority.Nearest],
  chase: 7,
  skills: {},
  drinkAt: DRINK_AT.low,
};

/** A copy of a merc's orders, so changing one never changes another. */
export function copyToggles(toggles: Toggles): Toggles {
  return { ...toggles, priorities: [...toggles.priorities], skills: { ...toggles.skills } };
}

/** Gives a merc new standing orders. The merc keeps its own copy. */
export function setToggles(unit: Unit, toggles: Toggles): void {
  unit.toggles = copyToggles(toggles);
}

/** How a merc may use a skill, under its orders. */
export function skillMode(toggles: Toggles, id: string): SkillMode {
  return toggles.skills[id] ?? SkillMode.Auto;
}

// How traits bend a merc's orders.
const BLOODTHIRSTY_CHASE = 3;
const LOYAL_CHASE = 2;

// A merc's orders as its traits bend them.
export function withTraits(u: Unit, toggles: Toggles): Toggles {
  let { chase, priorities } = toggles;
  if (u.traits.includes('bloodthirsty')) {
    chase += BLOODTHIRSTY_CHASE;
  }
  if (u.traits.includes('loyal')) {
    chase -= LOYAL_CHASE;
  }
  if (u.traits.includes('gloryseeker')) {
    priorities = [Priority.Elites, ...priorities.filter((p) => p !== Priority.Elites)];
  }
  return { ...toggles, chase, priorities };
}

// A merc's orders as far as its Discipline keeps them: only its first few
// target priorities, and skills saved for elites spent on anything once it
// is too unruly to hold them.
export function obeyed(u: Unit, toggles: Toggles): Toggles {
  const priorities = toggles.priorities.slice(0, prioritiesFollowed(u));
  if (honoursElites(u)) {
    return { ...toggles, priorities };
  }
  const skills = Object.fromEntries(
    Object.entries(toggles.skills).map(([id, mode]) => [
      id,
      mode === SkillMode.Elites ? SkillMode.Auto : mode,
    ]),
  );
  return { ...toggles, priorities, skills };
}
