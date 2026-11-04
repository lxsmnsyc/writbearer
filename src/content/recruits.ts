import type RNG from '../core/rng';
import { JOBS, JOB_KINDS, type JobDef, type JobKind, type Role } from './jobs';
import { TRAIT_BY_ID, rollTraits } from './traits';
import { wageFactor } from './uniques';

/** A merc offered for hire, before it joins. */
export interface Offer {
  kind: JobKind;
  name: string;
  level: number;
  traits: string[];
  // Gold asked to join, and asked again at each phase once wages exist
  wage: number;
}

// The hireable jobs, in registry order, that pass a test
function hireable(test: (def: JobDef) => boolean): JobKind[] {
  const kinds: JobKind[] = [];
  for (const kind of JOB_KINDS) {
    if (JOBS[kind].hireable && test(JOBS[kind])) {
      kinds.push(kind);
    }
  }
  return kinds;
}

/** The jobs offered at the Guild House. */
export const HIREABLE: readonly JobKind[] = hireable(() => true);

/**
 * The hireable jobs that can fight alone. The first merc is one of them: a
 * Cleric alone cannot kill what attacks the bearer.
 */
export const FIGHTERS: readonly JobKind[] = hireable((def) => def.fighter);

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

/**
 * What a merc asks at a phase's start: its level's wage, scaled by its traits
 * and by what it wears, such as the Debtor's Chain.
 */
export const wageOf = (merc: {
  level: number;
  traits: readonly string[];
  equipment?: ReadonlyMap<unknown, { unique?: string }>;
}): number =>
  Math.round(
    wageFor(merc.level) * traitScale(merc.traits) * wageFactor(merc.equipment?.values() ?? []),
  );

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

/** How many recruits wait at the Guild House at the start of a run. */
export const STARTING_OFFERS = 5;

/** The slots drawn first at the Guild House, one job each. */
export const SLOTS: readonly Role[] = ['guard', 'striker', 'support'];

/**
 * The jobs of the Guild House recruits: one per slot, then any others up to
 * STARTING_OFFERS, no job twice. If none of them is a fighter, the last
 * one drawn gives way to one.
 */
export function rollStartingJobs(rng: RNG): JobKind[] {
  const jobs: JobKind[] = [];
  const free = (kind: JobKind): boolean => !jobs.includes(kind);
  // One job for each slot
  for (const role of SLOTS) {
    const kinds = hireable((def) => def.role === role).filter(free);
    if (kinds.length > 0) {
      jobs.push(rng.pick(kinds));
    }
  }
  // Then any job not drawn yet
  while (jobs.length < STARTING_OFFERS) {
    const kinds = HIREABLE.filter(free);
    if (kinds.length === 0) {
      break;
    }
    jobs.push(rng.pick(kinds));
  }
  // A Cleric alone cannot kill what attacks the bearer.
  const fighters = FIGHTERS.filter(free);
  if (!jobs.some((kind) => JOBS[kind].fighter) && fighters.length > 0) {
    jobs[jobs.length - 1] = rng.pick(fighters);
  }
  return rng.shuffle(jobs);
}

/**
 * The recruits at the Guild House at the start of a run, drawn by slot
 * (rollStartingJobs), each under a different name.
 */
export function rollStartingOffers(rng: RNG, level: number): Offer[] {
  const jobs = rollStartingJobs(rng);
  const offers: Offer[] = [];
  for (const kind of jobs) {
    let offer = rollOffer(rng, level, [kind]);
    for (let i = 0; i < 20 && offers.some((o) => o.name === offer.name); i++) {
      offer = rollOffer(rng, level, [kind]);
    }
    offers.push(offer);
  }
  return offers;
}
