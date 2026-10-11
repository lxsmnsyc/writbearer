import { wageOf } from '../content/recruits';
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
 * Dead mercs draw none. A merc left unpaid when the party takes the road on
 * leaves the party.
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
    return null;
  }

  /**
   * The party takes the road on: every living merc left unpaid walks away,
   * with what it wears. Returns those who left.
   */
  settle(sim: Sim): Unit[] {
    const gone = this.dues(sim)
      .filter((d) => !d.paid)
      .map((d) => d.merc);
    for (const merc of gone) {
      sim.units.delete(merc);
    }
    return gone;
  }
}
