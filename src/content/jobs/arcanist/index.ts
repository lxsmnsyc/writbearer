import { Range } from '../../../sim/types';
import { designedInnate, designedSpell } from '../designed';
import { job, stats } from '../stats';
import type { JobDef } from '../types';
import ARCANIST_UPGRADES from './upgrades';

// Fire and Frost area magic: the highest damage of the starting jobs.
// Placeholder: its spells and innate are designed in docs/design/16-builds.md
// and built by the arcanist node. Not offered until roster-balance.

const FROST_NOVA = designedSpell(
  'frostNova',
  'Frost Nova',
  'A ring of Frost around the Arcanist, 2.5 tiles, for 90% damage and Freeze buildup.',
  14,
  7,
);

const FIREBALL = designedSpell(
  'fireball',
  'Fireball',
  'A 2-tile Fire area for 130% damage. No friendly fire.',
  16,
  6,
);

const FROST_SHARD = designedSpell(
  'frostShard',
  'Frost Shard',
  'A Frost bolt for 100% damage.',
  7,
  2.5,
);

const FIREBOLT = designedSpell(
  'firebolt',
  'Firebolt',
  'A Fire bolt for 100% damage and Burn buildup.',
  7,
  2.5,
);

const ARCANIST: JobDef = {
  kind: 'arcanist',
  template: {
    job: job('Arcanist', 190, 18, 110, Range.Melee),
    base: stats(3, 6, 7, 18, 8, 12),
    // Bare hands. Its staff and jerkin come as starter gear.
    weapon: { min: 3, max: 6, matk: 0 },
    kit: { reach: 1.0, interval: 1.2, hitAt: 0.55, moveSpeed: 2.6 },
  },
  discipline: 40,
  role: 'striker',
  fighter: true,
  hireable: false,
  blurb: 'Mage. Burns and freezes whole packs, at some risk to its friends.',
  spells: [FROST_NOVA, FIREBALL, FROST_SHARD, FIREBOLT],
  innate: designedInnate(
    'elementalSense',
    'Elemental Sense',
    'For each target, casts the bolt of the element the target is weaker to. If neither is better, Firebolt.',
  ),
  upgrades: ARCANIST_UPGRADES,
  starterGear: ['ashStaff', 'jerkin'],
  starterBelt: [
    ['healingDraught', 1],
    ['manaTincture', 2],
  ],
};

export default ARCANIST;
