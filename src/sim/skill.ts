import type { Lifecycle } from '../core/lifecycle';
import type Sim from './sim';
import type Unit from './unit';

/** How a merc may use one of its skills. The player sets it per skill. */
export const enum SkillMode {
  // Uses it whenever its rule says so
  Auto = 0,
  // Only against elites and bosses
  Elites = 1,
  Off = 2,
}

/** Who a skill is aimed at. */
export const enum Targeting {
  // The merc's current target
  Enemy = 0,
  // The merc itself, such as a shout around it
  Self = 1,
}

/**
 * An active skill. Times are in seconds and distances in tiles. The skill
 * costs mana when the windup starts, and takes effect on release.
 */
export interface Skill {
  id: string;
  name: string;
  // What it does at a rank
  describe: (rank: number) => string;
  cost: number;
  cooldown: number;
  windup: number;
  recovery: number;
  targeting: Targeting;
  /**
   * Whether the merc's AI wants to use it now. `target` is whom the merc
   * is fighting, or null. Mana and cooldown are checked elsewhere.
   */
  wants: (unit: Unit, target: Unit | null, sim: Sim) => boolean;
  /** Whether a use would reach an elite or a boss, for the Elites mode. */
  elite: (unit: Unit, target: Unit | null, sim: Sim) => boolean;
  /** The effect, on the release frame. */
  release: (unit: Unit, target: Unit | null, sim: Sim) => void;
}

/** A skill being used: windup, release, then recovery. */
export interface Cast {
  skill: Skill;
  target: Unit | null;
  // Seconds since the windup began
  t: number;
}

/**
 * A passive skill. Learning it, or a new rank of it, sets it up again at the
 * new rank: its listeners and bonuses last while the merc has it.
 */
export interface Passive {
  id: string;
  setup: (unit: Unit, rank: number) => Lifecycle;
}
