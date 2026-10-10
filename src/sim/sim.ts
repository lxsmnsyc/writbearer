import { EventEngine } from '../core/event-engine';
import RNG from '../core/rng';
import type { SimEventMap } from './events';
import setupMechanics from './mechanics';
import type Unit from './unit';

/**
 * One stage of play. Every mechanic, skill and item effect is a listener
 * on this bus.
 */
export default class Sim extends EventEngine<SimEventMap> {
  // Rolls for combat: damage rolls, hits, crits and blocks.
  readonly rng: RNG;

  readonly units = new Set<Unit>();

  constructor(rng: RNG | number) {
    super();
    this.rng = typeof rng === 'number' ? new RNG(rng) : rng;
    setupMechanics(this);
  }

  add(unit: Unit): Unit {
    this.units.add(unit);
    return unit;
  }
}
