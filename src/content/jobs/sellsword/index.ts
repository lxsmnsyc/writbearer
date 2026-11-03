import GiBroadsword from '~icons/game-icons/broadsword';
import GiCrossedSwords from '~icons/game-icons/crossed-swords';
import GiHamstring from '~icons/game-icons/cut-palm';
import GiSand from '~icons/game-icons/sands-of-time';
import { Range } from '../../../sim/types';
import { job, stats } from '../stats';
import type { JobDef } from '../types';
import { CLEAVE, HAMSTRING, POCKET_SAND, RUSH, SECOND_WIND, secondWindText } from './spells';
import SELLSWORD_UPGRADES from './upgrades';

// A cheap generalist that wins by wearing enemies down and by not dying.
// Not offered until roster-balance.

const SELLSWORD: JobDef = {
  kind: 'sellsword',
  template: {
    job: job('Sellsword', 240, 24, 40, Range.Melee),
    base: stats(12, 9, 12, 1, 10, 5),
    // Bare hands. Its sword, buckler and jerkin come as starter gear.
    weapon: { min: 5, max: 9, matk: 0 },
    kit: { reach: 1.1, interval: 1.0, hitAt: 0.55, moveSpeed: 2.6 },
  },
  // Paid to fight, not sworn to.
  discipline: 30,
  role: 'striker',
  fighter: true,
  hireable: false,
  blurb: 'Generalist. Wears enemies down with dirty tricks and refuses to die.',
  spells: [RUSH, POCKET_SAND, HAMSTRING, CLEAVE],
  innate: { name: 'Second Wind', effect: SECOND_WIND, describe: secondWindText },
  upgrades: SELLSWORD_UPGRADES,
  starterGear: ['armingSword', 'buckler', 'jerkin'],
  starterBelt: [['healingDraught', 2]],
  icons: {
    rush: GiCrossedSwords,
    pocketSand: GiSand,
    hamstring: GiHamstring,
    cleave: GiBroadsword,
  },
};

export default SELLSWORD;
