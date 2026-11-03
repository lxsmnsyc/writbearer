import { Range } from '../../../sim/types';
import { designedInnate, designedSpell } from '../designed';
import { job, stats } from '../stats';
import type { JobDef } from '../types';
import WARDEN_UPGRADES from './upgrades';

// The bodyguard: stands by the bearer and punishes anyone who touches them.
// Placeholder: its spells and innate are designed in docs/design/16-builds.md
// and built by the warden node. Not offered until roster-balance.

const COVER = designedSpell(
  'cover',
  'Cover',
  'Pulls the bearer behind the Warden. For 3 seconds, projectiles from the front cannot reach the bearer.',
  12,
  12,
);

const EXECUTE = designedSpell(
  'execute',
  'Execute',
  'A blow for 120% damage. It kills a marked non-boss enemy below 20% health.',
  12,
  8,
);

const TRIPWIRE = designedSpell(
  'tripwire',
  'Tripwire',
  'An alarm trap. The enemy that triggers it is marked and slowed by 30% for 4 seconds.',
  10,
  12,
);

const PURSUE = designedSpell(
  'pursue',
  'Pursue',
  'Leaps to a marked enemy for 100% damage and stun buildup.',
  6,
  4,
);

const WARDEN: JobDef = {
  kind: 'warden',
  template: {
    job: job('Warden', 270, 26, 50, Range.Melee),
    base: stats(12, 6, 14, 2, 9, 8),
    // Bare hands. Its mace, buckler and mail come as starter gear.
    weapon: { min: 6, max: 10, matk: 0 },
    kit: { reach: 1.1, interval: 1.1, hitAt: 0.55, moveSpeed: 2.7 },
  },
  discipline: 40,
  role: 'guard',
  fighter: true,
  hireable: false,
  blurb: 'Bodyguard. Takes the blows meant for the bearer and hunts whoever struck.',
  spells: [COVER, EXECUTE, TRIPWIRE, PURSUE],
  innate: designedInnate(
    'interpose',
    'Interpose',
    'Within 2 tiles of the bearer, takes hits aimed at the bearer at 70% of their damage. An enemy that damages the bearer is marked for 6 seconds.',
  ),
  upgrades: WARDEN_UPGRADES,
  starterGear: ['flangedMace', 'buckler', 'hauberk'],
  starterBelt: [['healingDraught', 2]],
};

export default WARDEN;
