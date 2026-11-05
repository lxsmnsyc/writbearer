import { markKidnapper } from '../../sim/ai/kidnapper';
import { makeFlyer } from '../../sim/flight';
import type Sim from '../../sim/sim';
import { markThief } from '../../sim/theft';
import type Unit from '../../sim/unit';
import type { Template } from '../jobs';
import churchSteps from './church-steps';
import guardSteps from './guard-steps';

/** A template-flag step: reads a flag on the template and sets the unit up. */
export type SpawnStep = (unit: Unit, template: Template, sim: Sim) => void;

// A thief template steals from the pack and runs.
function thiefFlag(unit: Unit, template: Template): void {
  if (template.thief) {
    markThief(unit);
  }
}

// A flying template takes wings.
function flyerFlag(unit: Unit, template: Template): void {
  if (template.flies) {
    makeFlyer(unit, template.flies);
  }
}

// A kidnapper template grabs a ward and drags it off.
function kidnapperFlag(unit: Unit, template: Template): void {
  if (template.kidnapper) {
    markKidnapper(unit);
  }
}

/**
 * Steps spawnMonster runs, in order, after the unit is made. A node that adds
 * a template flag adds one module and one entry here.
 */
export const SPAWN_STEPS: readonly SpawnStep[] = [
  thiefFlag,
  flyerFlag,
  kidnapperFlag,
  churchSteps,
  guardSteps,
];
