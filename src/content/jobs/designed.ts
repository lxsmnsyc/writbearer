import type { Upgrade } from '../../sim/builds';
import { type Skill, Targeting } from '../../sim/skill';
import type { Innate } from './types';

// Placeholders for what docs/design/16-builds.md draws and the game does not
// do yet. Each one only describes itself. The job and upgrade nodes replace
// them with the real thing.

/** A spell that is designed, not built: the AI never casts it. */
export const designedSpell = (
  id: string,
  name: string,
  summary: string,
  cost: number,
  cooldown: number,
): Skill => ({
  id,
  name,
  describe: () => summary,
  cost,
  cooldown,
  windup: 0.4,
  recovery: 0.3,
  targeting: Targeting.Enemy,
  wants: () => false,
  elite: () => false,
  release: () => {
    // Designed, not built
  },
});

/** An elite upgrade with no patch and no effect: never offered. */
export const designedUpgrade = (
  id: string,
  spell: string,
  name: string,
  summary: string,
): Upgrade => ({ id, spell, name, describe: () => summary });

/** An innate passive that does nothing yet. */
export const designedInnate = (id: string, name: string, summary: string): Innate => ({
  name,
  effect: {
    id,
    setup: () => ({
      start: () => {
        // Designed, not built
      },
      stop: () => {
        // Designed, not built
      },
    }),
  },
  describe: () => summary,
});
