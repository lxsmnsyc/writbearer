import type Sim from '../../sim/sim';
import type Unit from '../../sim/unit';
import { BESTIARY } from '../bestiary';
import { CHARGE, CLEAVE, slam } from '../boss-moves';
import { CARD_BY_MONSTER } from '../cards';
import { MONSTERS, spawnMonster } from '../roster';
import { atHealth, call } from './shared';
import type { BossDef } from './types';

/**
 * The Gatekeeper. A wide cleave in front of him and a charge at the bearer,
 * both shown on the ground first. At half health he blows his horn, three
 * of his guard come, and he starts slamming the ground around him.
 */
function spawnGatekeeper(sim: Sim, level: number, x: number, z: number): Unit {
  const boss = spawnMonster(sim, 'gatekeeper', level, x, z);
  let wounded = false;
  boss.skills.push(
    CLEAVE,
    CHARGE,
    slam(() => wounded),
  );
  atHealth(sim, boss, 0.5, () => {
    wounded = true;
    call(sim, boss, 'hollowSoldier', 3);
  });
  return boss;
}

const GATEKEEPER: BossDef = {
  id: 'gatekeeper',
  name: 'The Gatekeeper',
  layer: 1,
  template: MONSTERS.gatekeeper,
  spawn: spawnGatekeeper,
  card: CARD_BY_MONSTER.gatekeeper,
  bestiary: BESTIARY.gatekeeper,
  view: { kind: 'hollowSoldier', size: 1.8 },
  icon: 'gatekeeper',
};

export default GATEKEEPER;
