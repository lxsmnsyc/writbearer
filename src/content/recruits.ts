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

/** Rolls a recruit: a job, a name, its traits and its wage. */
export function rollOffer(
  rng: RNG,
  level: number,
  jobs: readonly Offer['kind'][] = HIREABLE,
): Offer {
  const kind = rng.pick(jobs);
  const traits = rollTraits(rng);
  const scale = traits.reduce((k, id) => k * (TRAIT_BY_ID.get(id)?.wage ?? 1), 1);
  return {
    kind,
    name: rng.pick(NAMES),
    level,
    traits,
    wage: Math.round((BASE_WAGE + WAGE_PER_LEVEL * level) * scale),
  };
}

/** Three offers with three different jobs, as at the start of a run. */
export function rollStartingOffers(rng: RNG, level: number): Offer[] {
  const jobs = [...HIREABLE];
  return [0, 1, 2].map(() => {
    const offer = rollOffer(rng, level, jobs);
    jobs.splice(jobs.indexOf(offer.kind), 1);
    return offer;
  });
}
