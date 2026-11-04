import type Sim from '../../sim/sim';
import { markThief } from '../../sim/theft';
import type Unit from '../../sim/unit';
import type { Template } from '../jobs';

/** A template-flag step: reads a flag on the template and sets the unit up. */
export type SpawnStep = (unit: Unit, template: Template, sim: Sim) => void;

// A thief template steals from the pack and runs.
function thiefFlag(unit: Unit, template: Template): void {
  if (template.thief) {
    markThief(unit);
  }
}

/**
 * Steps spawnMonster runs, in order, after the unit is made. A node that adds
 * a template flag adds one module and one entry here.
 */
export const SPAWN_STEPS: readonly SpawnStep[] = [thiefFlag];
