import GiFireball from '~icons/game-icons/fireball';
import GiFlame from '~icons/game-icons/flame';
import GiIceBolt from '~icons/game-icons/ice-bolt';
import GiSnowflake from '~icons/game-icons/snowflake-2';
import { Range } from '../../../sim/types';
import { job, stats } from '../stats';
import type { JobDef } from '../types';
import {
  ELEMENTAL_SENSE,
  FIREBALL,
  FIREBOLT,
  FROST_NOVA,
  FROST_SHARD,
  elementalSenseText,
} from './spells';
import ARCANIST_UPGRADES from './upgrades';

// Fire and Frost magic: area spells, and a bolt picked by what the target
// is weak to. The highest damage of the starting jobs, at some risk to its
// friends once it takes Inferno. Not offered until roster-balance.
const ARCANIST: JobDef = {
  kind: 'arcanist',
  template: {
    job: job('Arcanist', 190, 18, 110, Range.Ranged),
    base: stats(3, 6, 7, 18, 8, 12),
    // Bare hands. Its staff and jerkin come as starter gear.
    weapon: { min: 3, max: 6, matk: 0 },
    kit: { reach: 5.5, interval: 1.2, hitAt: 0.55, moveSpeed: 2.6 },
  },
  discipline: 40,
  role: 'striker',
  fighter: true,
  hireable: false,
  blurb: 'Mage. Burns and freezes whole packs, at some risk to its friends.',
  spells: [FROST_NOVA, FIREBALL, FROST_SHARD, FIREBOLT],
  innate: { name: 'Elemental Sense', effect: ELEMENTAL_SENSE, describe: elementalSenseText },
  upgrades: ARCANIST_UPGRADES,
  starterGear: ['ashStaff', 'jerkin'],
  starterBelt: [
    ['healingDraught', 1],
    ['manaTincture', 2],
  ],
  icons: {
    frostNova: GiSnowflake,
    fireball: GiFireball,
    frostShard: GiIceBolt,
    firebolt: GiFlame,
  },
};

export default ARCANIST;
