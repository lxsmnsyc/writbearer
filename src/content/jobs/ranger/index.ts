import GiArrowScope from '~icons/game-icons/arrow-scope';
import GiChargedArrow from '~icons/game-icons/charged-arrow';
import GiLightningTree from '~icons/game-icons/lightning-tree';
import GiWolfTrap from '~icons/game-icons/wolf-trap';
import { Range } from '../../../sim/types';
import { job, stats } from '../stats';
import type { JobDef } from '../types';
import RANGER_UPGRADES from './upgrades';
import { AIMED_SHOT, CHARGED_ARROW, LIGHTNING_ROD, SNARE, STATIC, staticText } from '../../ranger';

// A striker with a bow: kills from behind the guard and punishes groups with
// Storm. Hunters go their own way.
const RANGER: JobDef = {
  kind: 'ranger',
  template: {
    job: job('Ranger', 180, 18, 60, Range.Ranged),
    base: stats(5, 10, 8, 3, 18, 6),
    // Bare hands. Its bow and jerkin come as starter gear.
    weapon: { min: 4, max: 8, matk: 0 },
    kit: { reach: 5.5, interval: 1.1, hitAt: 0.7, moveSpeed: 2.7 },
  },
  discipline: 35,
  role: 'striker',
  fighter: true,
  hireable: true,
  blurb: 'Ranged damage. Picks off threats with a bow and sets snares.',
  spells: [SNARE, LIGHTNING_ROD, AIMED_SHOT, CHARGED_ARROW],
  innate: { name: 'Static', effect: STATIC, describe: () => staticText(1) },
  upgrades: RANGER_UPGRADES,
  starterGear: ['huntingBow', 'jerkin'],
  starterBelt: [
    ['healingDraught', 2],
    ['manaTincture', 1],
  ],
  icons: {
    snare: GiWolfTrap,
    lightningRod: GiLightningTree,
    aimedShot: GiArrowScope,
    chargedArrow: GiChargedArrow,
  },
};

export default RANGER;
