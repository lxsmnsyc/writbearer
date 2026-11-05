import { Side } from '../../sim/types';
import { markSkulker } from '../../sim/ai/skulker';
import dreadAura from '../../sim/dread-aura';
import type Sim from '../../sim/sim';
import type Unit from '../../sim/unit';

// How near another monster must stand for the Bell to ring
const BELL_COMPANY = 4;

// Whether an aware monster other than the Bell stands near it.
function hasCompany(bell: Unit): boolean {
  for (const m of bell.sim.living(Side.Monster)) {
    if (m !== bell && m.aware && m.kind !== 'drownedBell' && bell.distanceTo(m) <= BELL_COMPANY) {
      return true;
    }
  }
  return false;
}

/** Sets up the fear casters and the hidden assassin by kind. */
export default function dreadSteps(unit: Unit, _template: unknown, _sim: Sim): void {
  if (unit.kind === 'drownedBell') {
    // Rings only while it has company
    dreadAura(unit, { radius: 6, perSecond: 14, active: hasCompany });
  } else if (unit.kind === 'whisperer') {
    dreadAura(unit, { radius: 4, perSecond: 16 });
  } else if (unit.kind === 'skulker') {
    markSkulker(unit);
  }
}
