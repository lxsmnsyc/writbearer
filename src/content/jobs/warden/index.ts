import GiGuillotine from '~icons/game-icons/guillotine';
import GiRun from '~icons/game-icons/run';
import GiShieldBounces from '~icons/game-icons/shield-bounces';
import GiTripwire from '~icons/game-icons/tripwire';
import { Range } from '../../../sim/types';
import { job, stats } from '../stats';
import type { JobDef } from '../types';
import { COVER, EXECUTE, INTERPOSE, PURSUE, TRIPWIRE, interposeText } from './spells';
import WARDEN_UPGRADES from './upgrades';

// The bodyguard: stands by the bearer and punishes anyone who touches them.
// Spells, innate and statuses are drawn in docs/design/16-builds.md and live
// in ./spells.

export * from './spells';

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
  hireable: true,
  blurb: 'Bodyguard. Takes the blows meant for the bearer and hunts whoever struck.',
  spells: [COVER, EXECUTE, TRIPWIRE, PURSUE],
  innate: { name: 'Interpose', effect: INTERPOSE, describe: interposeText },
  upgrades: WARDEN_UPGRADES,
  starterGear: ['flangedMace', 'buckler', 'hauberk'],
  starterBelt: [['healingDraught', 2]],
  icons: {
    cover: GiShieldBounces,
    execute: GiGuillotine,
    tripwire: GiTripwire,
    pursue: GiRun,
  },
};

export default WARDEN;
