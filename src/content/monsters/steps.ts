import type Sim from '../../sim/sim';
import type Unit from '../../sim/unit';
import type { Template } from '../jobs';

/** A template-flag step: reads a flag on the template and sets the unit up. */
export type MonsterStep = (unit: Unit, template: Template, sim: Sim) => void;

/**
 * Steps spawnMonster runs, in order, after the unit is made. A node that adds
 * a template flag adds one module and one entry here.
 */
export const MONSTER_STEPS: readonly MonsterStep[] = [];
