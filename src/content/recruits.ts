import type RNG from '../core/rng';
import type { MercKind } from './roster';
import { TRAIT_BY_ID, rollTraits } from './traits';

/** A merc offered for hire, before it joins. */
export interface Offer {
  kind: Exclude<MercKind, 'bearer'>;
  name: string;
  level: number;
  traits: string[];
  // Gold asked to join, and asked again at each phase once wages exist
  wage: number;
}

/** The jobs offered so far. */
export const HIREABLE: readonly Offer['kind'][] = ['vanguard', 'ranger', 'cleric'];

/**
 * The jobs that can fight alone. The first merc is one of them: a Cleric
 * alone cannot kill what attacks the bearer.
 */
export const FIGHTERS: readonly Offer['kind'][] = ['vanguard', 'ranger'];

const NAMES = [
  'Odo',
  'Maren',
  'Hask',
  'Ysolde',
  'Corvin',
  'Bran',
  'Edda',
  'Tamsin',
  'Wulf',
  'Agnes',
  'Rook',
  'Sabine',
  'Garrick',
  'Ilse',
  'Fenn',
  'Mott',
  'Oriel',
  'Brisk',
  'Hale',
  'Petra',
];

const BASE_WAGE = 40;
const WAGE_PER_LEVEL = 10;

/** What a merc without wage traits asks at a level. */
export const wageFor = (level: number): number => BASE_WAGE + WAGE_PER_LEVEL * level;

/** How a merc's traits scale its wage, such as Greedy's half again. */
export const traitScale = (traits: readonly string[]): number =>
  traits.reduce((k, id) => k * (TRAIT_BY_ID.get(id)?.wage ?? 1), 1);

/** What a merc asks at a phase's start: its level's wage, scaled by its traits. */
export const wageOf = (merc: { level: number; traits: readonly string[] }): number =>
  Math.round(wageFor(merc.level) * traitScale(merc.traits));

/** Rolls a recruit: a job, a name, its traits and its wage. */
export function rollOffer(
  rng: RNG,
  level: number,
  jobs: readonly Offer['kind'][] = HIREABLE,
): Offer {
  const kind = rng.pick(jobs);
  const traits = rollTraits(rng);
  return {
    kind,
    name: rng.pick(NAMES),
    level,
    traits,
    wage: wageOf({ level, traits }),
  };
}

/**
 * Three offers at the start of a run, all fighters, with every fighting job
 * among them.
 */
export function rollStartingOffers(rng: RNG, level: number): Offer[] {
  const jobs = [...FIGHTERS, rng.pick(FIGHTERS)];
  rng.shuffle(jobs);
  return jobs.map((kind) => rollOffer(rng, level, [kind]));
}
