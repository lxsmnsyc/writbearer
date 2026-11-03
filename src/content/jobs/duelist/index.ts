import { Range } from '../../../sim/types';
import { designedInnate, designedSpell } from '../designed';
import { job, stats } from '../stats';
import type { JobDef } from '../types';
import DUELIST_UPGRADES from './upgrades';

// Daggers and swords: fast hits on one target, and a duel with the elite.
// Placeholder: its spells and innate are designed in docs/design/16-builds.md
// and built by the duelist node. Not offered until roster-balance.

const DUEL = designedSpell(
  'duel',
  'Duel',
  'Binds the Duelist and one elite for 4 seconds. Neither can target or be targeted by anyone else.',
  14,
  16,
);

const SHADOWSTEP = designedSpell(
  'shadowstep',
  'Shadowstep',
  'Teleports behind a caster or healer, then hits it for 130% damage with the back bonus.',
  10,
  10,
);

const LUNGE = designedSpell(
  'lunge',
  'Lunge',
  'A thrust that closes the gap, for 120% damage.',
  8,
  6,
);

const FLURRY = designedSpell('flurry', 'Flurry', 'Four quick hits for 40% damage each.', 8, 3);

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
  innate: designedInnate(
    'riposte',
    'Riposte',
    'A 15% chance to parry a melee hit. A parry triggers a free counter.',
  ),
  upgrades: DUELIST_UPGRADES,
  starterGear: ['stiletto', 'buckler', 'jerkin'],
  starterBelt: [['healingDraught', 2]],
};

export default DUELIST;
