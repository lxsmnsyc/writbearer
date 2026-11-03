import type { JobKind } from '../../content/jobs';
import ARCANIST_LOOK from './arcanist';
import CLERIC_LOOK from './cleric';
import DUELIST_LOOK from './duelist';
import RANGER_LOOK from './ranger';
import SELLSWORD_LOOK from './sellsword';
import type { JobLook } from './types';
import VANGUARD_LOOK from './vanguard';
import WARDEN_LOOK from './warden';

export type { Attack, HeldWeapon, JobLook } from './types';

/** How each merc job is drawn, by kind. */
export const LOOKS: Record<JobKind, JobLook> = {
  vanguard: VANGUARD_LOOK,
  ranger: RANGER_LOOK,
  cleric: CLERIC_LOOK,
  sellsword: SELLSWORD_LOOK,
  warden: WARDEN_LOOK,
  duelist: DUELIST_LOOK,
  arcanist: ARCANIST_LOOK,
};

/** Whether a kind is a merc job's. */
export const isJobLook = (kind: string): kind is JobKind => Object.hasOwn(LOOKS, kind);
