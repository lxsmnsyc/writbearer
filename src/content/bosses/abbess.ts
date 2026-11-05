import { SimEvents, type UnitDamageEvent } from '../../sim/events';
import type Sim from '../../sim/sim';
import { type Skill, Targeting } from '../../sim/skill';
import type { StatusDef } from '../../sim/status';
import { DamagePriority, Side } from '../../sim/types';
import type Unit from '../../sim/unit';
import { BESTIARY } from '../bestiary';
import { CONSECRATE, JUDGEMENT } from '../boss-moves';
import { CARD_BY_MONSTER } from '../cards';
import { MONSTERS, spawnMonster } from '../roster';
import { call } from './shared';
import type { BossDef } from './types';

const LITANY_RADIUS = 5;
const SANCTIFIED_TIME = 6;
const FLOCK_CAP = 4;

/** The Abbess's Litany: nothing harms the sanctified while it lasts. */
export const SANCTIFIED: StatusDef = {
  id: 'sanctified',
  name: 'Sanctified',
  duration: SANCTIFIED_TIME,
  immunity: 0,
  buff: true,
  setup: (s) => {
    const listener = (event: UnitDamageEvent): void => {
      if (event.target === s.unit) {
        event.value = 0;
      }
    };
    return {
      start: () => {
        s.unit.sim.on(SimEvents.UnitDamage, DamagePriority.Barrier, listener);
      },
      stop: () => {
        s.unit.sim.off(SimEvents.UnitDamage, DamagePriority.Barrier, listener);
      },
    };
  },
};

const flockOf = (u: Unit): Unit[] =>
  u.sim
    .living(Side.Monster)
    .filter((m) => m.kind === 'penitent' && u.distanceTo(m) <= LITANY_RADIUS);

/**
 * The Abbess. A long Litany that sanctifies every Penitent within 5 tiles of
 * her: nothing harms them for 6 seconds. She is not shielded herself, so the
 * party can go past them to her. A stun or a Shield Bash breaks it off before
 * it ends.
 */
export const LITANY: Skill = {
  id: 'litany',
  name: 'Litany',
  describe: () =>
    `A long prayer. Nothing harms her Penitents within ${LITANY_RADIUS} tiles for ${SANCTIFIED_TIME} seconds.`,
  cost: 40,
  cooldown: 14,
  windup: 2.6,
  recovery: 0.4,
  targeting: Targeting.Self,
  wants(u) {
    return u.aware;
  },
  elite() {
    return false;
  },
  release(u) {
    for (const m of flockOf(u)) {
      m.addStatus(SANCTIFIED, u);
    }
  },
};

/** The Abbess. She calls two Penitents to her, up to four at a time. */
export const CALL_FLOCK: Skill = {
  id: 'callFlock',
  name: 'Call the Flock',
  describe: () => 'Calls two Penitents to her side.',
  cost: 30,
  cooldown: 12,
  windup: 1.0,
  recovery: 0.4,
  targeting: Targeting.Self,
  wants(u) {
    return (
      u.aware && u.sim.living(Side.Monster).filter((m) => m.kind === 'penitent').length < FLOCK_CAP
    );
  },
  elite() {
    return false;
  },
  release(u, _target, sim) {
    call(sim, u, 'penitent', 2);
  },
};

function spawnAbbess(sim: Sim, level: number, x: number, z: number): Unit {
  const boss = spawnMonster(sim, 'abbess', level, x, z);
  boss.skills.push(LITANY, CALL_FLOCK, CONSECRATE, JUDGEMENT);
  boss.mana = boss.derived.maxMana;
  for (const m of call(sim, boss, 'penitent', 2)) {
    m.aware = false;
  }
  return boss;
}

const ABBESS: BossDef = {
  id: 'abbess',
  name: 'The Abbess',
  layer: 2,
  template: MONSTERS.abbess,
  spawn: spawnAbbess,
  card: CARD_BY_MONSTER.abbess,
  bestiary: BESTIARY.abbess,
  view: { kind: 'cantor', size: 1.5 },
  icon: 'abbess',
};

export default ABBESS;
