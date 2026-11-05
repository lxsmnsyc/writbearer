import { markRaiser } from '../../sim/ai/raiser';
import { markStripper } from '../../sim/ai/stripper';
import { markBerserker } from '../../sim/berserk';
import type Sim from '../../sim/sim';
import { type PickLoot, markThief } from '../../sim/theft';
import Unit from '../../sim/unit';
import { Side } from '../../sim/types';
import OLD_KING from './old-king';

// A husk, made here because spawn.ts imports this module (an import cycle).
function makeHusk(sim: Sim, level: number, x: number, z: number): Unit {
  const t = OLD_KING.husk;
  const at = sim.nav?.free(x, z) ?? { x, z };
  return sim.add(
    new Unit(sim, {
      kind: 'husk',
      name: t.job.name,
      side: Side.Monster,
      job: t.job,
      level,
      base: t.base,
      weapon: t.weapon,
      kit: t.kit,
      race: t.race,
      hunt: t.hunt,
      x: at.x,
      z: at.z,
    }),
  );
}

// The last area in which a Tithe-Taker took something, by sim
const LAST_TAKEN = new WeakMap<Sim, number>();

// One theft per area across every Tithe-Taker
function pickOnce(sim: Sim): PickLoot {
  return (pocket) => {
    if (LAST_TAKEN.get(sim) === sim.area) {
      return null;
    }
    const loot = pocket.pick();
    if (loot) {
      LAST_TAKEN.set(sim, sim.area);
    }
    return loot;
  };
}

/** Sets up the Church's keepers by kind, as their mechanics need. */
export default function churchSteps(unit: Unit, _template: unknown, sim: Sim): void {
  if (unit.kind === 'ossuaryPriest') {
    // Raises the fallen as husks, at most 3 at a time
    markRaiser(unit, { make: makeHusk, cap: 3 });
  } else if (unit.kind === 'titheTaker') {
    markThief(unit, pickOnce(sim));
  } else if (unit.kind === 'confessor') {
    markStripper(unit);
  } else if (unit.kind === 'flagellant') {
    // +60% damage at 10% health, and its lash bleeds
    markBerserker(unit, { most: 0.6, bleed: 2 });
  }
}
