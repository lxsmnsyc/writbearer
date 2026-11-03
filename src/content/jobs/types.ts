import type { Hunt } from '../../sim/ai';
import type { Upgrade } from '../../sim/builds';
import type { Passive, Skill } from '../../sim/skill';
import type { BaseStats, Job, Modifier, Weapon } from '../../sim/stats';
import type { Element, Race, Rank } from '../../sim/types';
import type { Kit } from '../../sim/unit';

/** What a unit is made from: its job, stats, bare weapon and kit. */
export interface Template {
  job: Job;
  base: BaseStats;
  weapon: Weapon;
  kit: Partial<Kit>;
  modifiers?: Modifier[];
  race?: Race;
  rank?: Rank;
  element?: Element;
  elementLevel?: number;
  attackElement?: Element;
  hunt?: Hunt;
  skills?: Skill[];
}

/** The slot a job fills at the Guild House. */
export type Role = 'guard' | 'striker' | 'support';

/** A job's innate passive: known from level 1, at rank 1, with no shard to raise it. */
export interface Innate {
  name: string;
  effect: Passive;
  describe: () => string;
}

/**
 * Everything that defines a merc job, from docs/design/16-builds.md. One
 * module per job, under src/content/jobs/<kind>, registered in JOBS.
 */
export interface JobDef {
  // The merc kind, such as 'warden'. Also its key in JOBS, LOOKS and ICONS.
  kind: string;
  // Job stats, base stats, bare weapon and kit. `template.job.name` is the
  // name item bases list in `jobs`.
  template: Template;
  // Discipline before levels and traits
  discipline: number;
  role: Role;
  // Can kill what attacks the bearer alone. The first recruit is a fighter.
  fighter: boolean;
  // Offered at the Guild House
  hireable: boolean;
  // One line on the offer card
  blurb: string;
  // The 4 spells, in cast priority order. The last one is the filler.
  spells: readonly [Skill, Skill, Skill, Skill];
  innate: Innate;
  // 12 elite upgrades, 3 per spell
  upgrades: Upgrade[];
  // Ids of item bases it arrives wearing, and the potions on its belt
  starterGear: readonly string[];
  starterBelt: readonly (readonly [string, number])[];
}
