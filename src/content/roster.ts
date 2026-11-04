// The monster table and the spawn functions. This barrel keeps the import
// path; the table is in src/content/monsters and the spawn code in spawn.ts.
import type { JobKind } from './jobs';

export type { Template } from './jobs';
export { MONSTERS, type MonsterKind } from './monsters/table';

/** The bearer, or a merc job. */
export type MercKind = 'bearer' | JobKind;

export {
  spawnBearer,
  spawnDisguisedAssassin,
  spawnMerc,
  spawnMonster,
  spawnRefugee,
} from './spawn';
