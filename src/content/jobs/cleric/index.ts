import { Range } from '../../../sim/types';
import { AEGIS, SACRED_GROUND, WARD, aegisText } from '../../cleric';
import { HEAL, SMITE } from '../../skills';
import { job, stats } from '../stats';
import type { JobDef } from '../types';
import CLERIC_UPGRADES from './upgrades';

// A priest of the old faith, before the Church went under. It mends the
// party and raises its dead. Its holy fire burns the Undead and the mad.
// Priests keep their vows.
const CLERIC: JobDef = {
  kind: 'cleric',
  template: {
    job: job('Cleric', 220, 20, 90, Range.Melee),
    base: stats(6, 5, 10, 14, 8, 12),
    // Bare hands. Its staff and vestments come as starter gear.
    weapon: { min: 4, max: 7, matk: 0 },
    kit: { reach: 1.0, interval: 1.2, hitAt: 0.55, moveSpeed: 2.6 },
  },
  discipline: 45,
  role: 'support',
  // Alone it cannot kill what attacks the bearer.
  fighter: false,
  hireable: true,
  blurb: 'Healer. Mends the party, raises its dead, smites the Undead.',
  spells: [WARD, HEAL, SACRED_GROUND, SMITE],
  innate: { name: 'Aegis', effect: AEGIS, describe: aegisText },
  upgrades: CLERIC_UPGRADES,
  starterGear: ['pilgrimStaff', 'vestments'],
  starterBelt: [
    ['healingDraught', 1],
    ['manaTincture', 2],
  ],
};

export default CLERIC;
