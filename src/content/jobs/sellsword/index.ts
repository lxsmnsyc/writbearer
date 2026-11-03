import { Range } from '../../../sim/types';
import { designedInnate, designedSpell } from '../designed';
import { job, stats } from '../stats';
import type { JobDef } from '../types';
import SELLSWORD_UPGRADES from './upgrades';

// A cheap generalist that wins by wearing enemies down and by not dying.
// Placeholder: its spells and innate are designed in docs/design/16-builds.md
// and built by the sellsword node. Not offered until roster-balance.

const RUSH = designedSpell(
  'rush',
  'Rush',
  'Charges an enemy that is attacking the bearer, with stun buildup.',
  8,
  8,
);

const POCKET_SAND = designedSpell(
  'pocketSand',
  'Pocket Sand',
  'A cone that adds blind buildup.',
  8,
  10,
);

const HAMSTRING = designedSpell(
  'hamstring',
  'Hamstring',
  'A cut for 110% damage that slows the target by 30% for 3 seconds.',
  8,
  6,
);

const CLEAVE = designedSpell(
  'cleave',
  'Cleave',
  'A swing for 100% damage at up to 3 enemies in the front arc.',
  6,
  2,
);

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
  innate: designedInnate(
    'secondWind',
    'Second Wind',
    'Once per stage, at 30% health, it heals 20% of max health.',
  ),
  upgrades: SELLSWORD_UPGRADES,
  starterGear: ['armingSword', 'buckler', 'jerkin'],
  starterBelt: [['healingDraught', 2]],
  // Its spell icons come with its spells.
  icons: {},
};

export default SELLSWORD;
