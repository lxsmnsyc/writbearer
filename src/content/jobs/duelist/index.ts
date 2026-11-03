import GiDervishSwords from '~icons/game-icons/dervish-swords';
import GiDuel from '~icons/game-icons/duel';
import GiPiercingSword from '~icons/game-icons/piercing-sword';
import GiShadowFollower from '~icons/game-icons/shadow-follower';
import { Range } from '../../../sim/types';
import { job, stats } from '../stats';
import type { JobDef } from '../types';
import { DUEL, FLURRY, LUNGE, RIPOSTE, SHADOWSTEP, riposteText } from './spells';
import DUELIST_UPGRADES from './upgrades';

// Daggers and swords: fast hits on one target, and a duel with the elite.
// Not offered until roster-balance.
const DUELIST: JobDef = {
  kind: 'duelist',
  template: {
    job: job('Duelist', 200, 20, 50, Range.Melee),
    base: stats(9, 16, 8, 2, 14, 5),
    // Bare hands. Its stiletto, buckler and jerkin come as starter gear.
    weapon: { min: 5, max: 8, matk: 0 },
    kit: { reach: 1.0, interval: 0.8, hitAt: 0.5, moveSpeed: 2.8 },
  },
  discipline: 35,
  role: 'striker',
  fighter: true,
  hireable: false,
  blurb: 'Skirmisher. Strikes from behind and duels the elite.',
  spells: [DUEL, SHADOWSTEP, LUNGE, FLURRY],
  innate: { name: 'Riposte', effect: RIPOSTE, describe: riposteText },
  upgrades: DUELIST_UPGRADES,
  starterGear: ['stiletto', 'buckler', 'jerkin'],
  starterBelt: [['healingDraught', 2]],
  icons: {
    duel: GiDuel,
    shadowstep: GiShadowFollower,
    lunge: GiPiercingSword,
    flurry: GiDervishSwords,
  },
};

export default DUELIST;
