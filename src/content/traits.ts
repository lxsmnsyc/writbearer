import type { Lifecycle } from '../core/lifecycle';
import type RNG from '../core/rng';
import { type CheckBuildupEvent, type CheckStatusDurationEvent, SimEvents } from '../sim/events';
import { DREAD } from '../sim/statuses';
import { ValuePriority } from '../sim/types';
import type Unit from '../sim/unit';

/**
 * A personality trait, rolled when a merc is recruited. Some change how the
 * AI behaves and are read where it decides; others set up listeners here.
 */
export interface Trait {
  id: string;
  name: string;
  description: string;
  // Traits that cannot come with this one
  excludes?: readonly string[];
  // Wage multiplier
  wage?: number;
  // Discipline it adds or takes away, and morale it starts with above the rest
  discipline?: number;
  morale?: number;
  setup?: (unit: Unit) => Lifecycle;
}

// Devout mercs build up dread at this rate.
const DEVOUT_DREAD = 0.5;

export const TRAITS: readonly Trait[] = [
  {
    id: 'brave',
    name: 'Brave',
    description: 'Never runs. Dread cannot take hold of it.',
    excludes: ['cowardly'],
    setup: (unit) => {
      const listener = (event: CheckStatusDurationEvent): void => {
        if (event.target === unit && event.status === DREAD) {
          event.disabled = true;
        }
      };
      return {
        start: () => {
          unit.sim.on(SimEvents.CheckStatusDuration, ValuePriority.Pre, listener);
        },
        stop: () => {
          unit.sim.off(SimEvents.CheckStatusDuration, ValuePriority.Pre, listener);
        },
      };
    },
  },
  {
    id: 'cowardly',
    name: 'Cowardly',
    description: 'Runs from the nearest enemy below 25% health. Less disciplined.',
    excludes: ['brave', 'bloodthirsty'],
    discipline: -10,
  },
  {
    id: 'greedy',
    name: 'Greedy',
    description: 'Asks for half again the wage. Less disciplined.',
    excludes: ['loyal'],
    wage: 1.5,
    discipline: -5,
  },
  {
    id: 'loyal',
    name: 'Loyal',
    description:
      'Stays closer to the bearer and chases less far. Keeps heart: loses half the morale.',
    excludes: ['greedy'],
    wage: 0.9,
    discipline: 5,
    morale: 15,
  },
  {
    id: 'gloryseeker',
    name: 'Glory-seeker',
    description: 'Goes for elites first, whatever its orders say.',
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Follows one more target priority. More disciplined.',
    wage: 1.2,
    discipline: 10,
  },
  {
    id: 'bloodthirsty',
    name: 'Bloodthirsty',
    description: 'Chases three tiles further. Less disciplined.',
    excludes: ['cowardly'],
    discipline: -10,
  },
  {
    id: 'devout',
    name: 'Devout',
    description: 'Dread builds up in it at half the rate. More disciplined.',
    discipline: 5,
    setup: (unit) => {
      const listener = (event: CheckBuildupEvent): void => {
        if (event.target === unit && event.status === DREAD) {
          event.value *= DEVOUT_DREAD;
        }
      };
      return {
        start: () => {
          unit.sim.on(SimEvents.CheckBuildup, ValuePriority.Multiplicative, listener);
        },
        stop: () => {
          unit.sim.off(SimEvents.CheckBuildup, ValuePriority.Multiplicative, listener);
        },
      };
    },
  },
];

export const TRAIT_BY_ID = new Map(TRAITS.map((t) => [t.id, t]));

/** One or two traits that can go together. */
export function rollTraits(rng: RNG): string[] {
  const out: string[] = [rng.pick(TRAITS).id];
  if (rng.chance(0.5)) {
    const first = TRAIT_BY_ID.get(out[0])!;
    const pool = TRAITS.filter(
      (t) =>
        t.id !== first.id && !first.excludes?.includes(t.id) && !t.excludes?.includes(first.id),
    );
    out.push(rng.pick(pool).id);
  }
  return out;
}

/** Gives a merc its traits, starting any that listen for events. */
export function applyTraits(unit: Unit, traits: readonly string[]): void {
  unit.traits = [...traits];
  for (const id of traits) {
    const trait = TRAIT_BY_ID.get(id);
    unit.discipline += trait?.discipline ?? 0;
    unit.morale += trait?.morale ?? 0;
    const life = TRAIT_BY_ID.get(id)?.setup?.(unit);
    if (life) {
      unit.passives.set(`trait:${id}`, life);
      life.start();
    }
  }
}
