import type Sim from '../../sim/sim';
import { makeSteadfast } from '../../sim/steadfast';
import type Unit from '../../sim/unit';

/** Sets up the Old King's last guard by kind, as their mechanics need. */
export default function guardSteps(unit: Unit, _template: unknown, _sim: Sim): void {
  if (unit.kind === 'gildedEffigy') {
    // Neither stun nor fear takes hold of it
    makeSteadfast(unit);
  }
}
