import ARCANIST from './arcanist';
import CLERIC from './cleric';
import DUELIST from './duelist';
import RANGER from './ranger';
import SELLSWORD from './sellsword';
import type { JobDef } from './types';
import VANGUARD from './vanguard';
import WARDEN from './warden';

export type { Innate, JobDef, Role, Template } from './types';

/** Every merc job's kind. The Guild House offers the hireable ones in this order. */
export const JOB_KINDS = [
  'vanguard',
  'ranger',
  'cleric',
  'sellsword',
  'warden',
  'duelist',
  'arcanist',
] as const;

/** A merc job's kind, such as 'warden'. */
export type JobKind = (typeof JOB_KINDS)[number];

/** Every merc job, by kind. */
export const JOBS: Record<JobKind, JobDef> = {
  vanguard: VANGUARD,
  ranger: RANGER,
  cleric: CLERIC,
  sellsword: SELLSWORD,
  warden: WARDEN,
  duelist: DUELIST,
  arcanist: ARCANIST,
};

export const isJobKind = (kind: string): kind is JobKind => Object.hasOwn(JOBS, kind);
