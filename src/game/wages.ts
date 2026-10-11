import { wageOf } from '../content/recruits';
import {
  Morale,
  PAID,
  UNPAID,
  UNPAID_DISCIPLINE,
  moraleOf,
  shiftDiscipline,
  shiftMorale,
} from '../sim/morale';
import type Sim from '../sim/sim';
import { Side } from '../sim/types';
import type Unit from '../sim/unit';
import type { Pack } from './inventory';

/** One merc's wage at a Waystation, and whether it is paid. */
export interface Due {
  merc: Unit;
  wage: number;
  paid: boolean;
}

/**
 * The wages owed at one Waystation. Each living merc asks its wage once.
 * Dead mercs draw none. Being paid lifts a merc's morale; being left unpaid
 * when the party takes the road on sinks it, and its Discipline.
 */
export class Payroll {
  private readonly paid = new Set<Unit>();

  /** What each living merc asks, paid or not. */
  dues(sim: Sim): Due[] {
    return sim
      .living(Side.Party)
      .filter((u) => u !== sim.bearer)
      .map((merc) => ({ merc, wage: wageOf(merc), paid: this.paid.has(merc) }));
  }

  /** Pays one merc from the pack. Returns why it could not, or null. */
  pay(pack: Pack, merc: Unit): string | null {
    if (this.paid.has(merc)) {
      return `${merc.name} is paid.`;
    }
    const wage = wageOf(merc);
    if (pack.gold < wage) {
      return `${merc.name} wants ${wage} gold. You have ${pack.gold}.`;
    }
    pack.gold -= wage;
    this.paid.add(merc);
    shiftMorale(merc, PAID);
    return null;
  }

  /**
   * The party takes the road on: every living merc left unpaid loses heart
   * and Discipline. Returns those left unpaid.
   */
  settle(sim: Sim): Unit[] {
    const unpaid = this.dues(sim)
      .filter((d) => !d.paid)
      .map((d) => d.merc);
    for (const merc of unpaid) {
      shiftMorale(merc, UNPAID);
      shiftDiscipline(merc, UNPAID_DISCIPLINE);
    }
    return unpaid;
  }
}

/**
 * Mercs whose morale is broken desert as the party takes a road on, with
 * what they wear. Returns those who left.
 */
export function desert(sim: Sim): Unit[] {
  const gone = sim
    .living(Side.Party)
    .filter((u) => u !== sim.bearer && moraleOf(u) === Morale.Broken);
  for (const merc of gone) {
    sim.units.delete(merc);
  }
  return gone;
}
