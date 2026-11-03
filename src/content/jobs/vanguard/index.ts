import GiDefensiveWall from '~icons/game-icons/defensive-wall';
import GiHammerDrop from '~icons/game-icons/hammer-drop';
import GiShieldImpact from '~icons/game-icons/shield-impact';
import GiShouting from '~icons/game-icons/shouting';
import { Range } from '../../../sim/types';
import { SUNDER, sunderText } from '../../passives';
import { CHALLENGE, CRUSH, INTERCEPT } from '../../skills';
import { SHIELD_WALL_SKILL } from '../../vanguard';
import { job, stats } from '../stats';
import type { JobDef } from '../types';
import VANGUARD_UPGRADES from './upgrades';

// The guard: holds the line with a tower shield and taunts. Soldiers drill,
// so it starts well disciplined.
const VANGUARD: JobDef = {
  kind: 'vanguard',
  template: {
    job: job('Vanguard', 300, 30, 40, Range.Melee),
    base: stats(14, 5, 16, 1, 8, 6),
    // Bare hands. Its sword, shield and mail come as starter gear.
    weapon: { min: 6, max: 10, matk: 0 },
    kit: { reach: 1.1, interval: 1.0, hitAt: 0.55, moveSpeed: 2.6 },
  },
  discipline: 40,
  role: 'guard',
  fighter: true,
  hireable: true,
  blurb: 'Tank. Holds the line with a tower shield and taunts.',
  spells: [INTERCEPT, CHALLENGE, SHIELD_WALL_SKILL, CRUSH],
  innate: { name: 'Sunder', effect: SUNDER, describe: () => sunderText(1) },
  upgrades: VANGUARD_UPGRADES,
  starterGear: ['armingSword', 'towerShield', 'hauberk'],
  starterBelt: [['healingDraught', 2]],
  icons: {
    intercept: GiShieldImpact,
    challenge: GiShouting,
    shieldWall: GiDefensiveWall,
    crush: GiHammerDrop,
  },
};

export default VANGUARD;
