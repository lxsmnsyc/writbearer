import { EventPriority } from '../../core/event-emitter';
import { Hunt } from '../../sim/ai';
import { SimEvents } from '../../sim/events';
import type Sim from '../../sim/sim';
import { DREAD } from '../../sim/statuses';
import type Unit from '../../sim/unit';
import { BESTIARY } from '../bestiary';
import { DREAD_NOVA, LUNGE } from '../boss-moves';
import { CARD_BY_MONSTER } from '../cards';
import { MONSTERS, spawnMonster } from '../roster';
import { atHealth, party } from './shared';
import type { BossDef } from './types';

// How far her Dread reaches, and how far once she is wounded to half
const DREAD_AURA = 3;
const DREAD_AURA_WOUNDED = 4.5;
// Dread built up each second in a merc within the aura
const DREAD_PER_SECOND = 14;

/**
 * The Hollowed Saint. Dread gathers in every merc near her, each second.
 * She leaps onto where the bearer stood, and bursts with Dread around her.
 * At half health her Dread reaches further, and she goes for the bearer.
 */
function spawnSaint(sim: Sim, level: number, x: number, z: number): Unit {
  const boss = spawnMonster(sim, 'hollowedSaint', level, x, z);
  boss.skills.push(LUNGE, DREAD_NOVA);
  let aura = DREAD_AURA;
  let tick = 0;
  sim.on(SimEvents.Tick, EventPriority.Post, (event) => {
    if (!boss.alive || !boss.aware) {
      return;
    }
    tick += event.dt;
    if (tick < 1) {
      return;
    }
    tick -= 1;
    for (const m of party(sim)) {
      if (m !== sim.bearer && boss.distanceTo(m) <= aura) {
        m.buildUp(DREAD, boss, DREAD_PER_SECOND);
      }
    }
  });
  // Wounded, she widens her Dread and hunts the bearer alone.
  atHealth(sim, boss, 0.5, () => {
    aura = DREAD_AURA_WOUNDED;
    boss.hunt = Hunt.Bearer;
  });
  return boss;
}

const HOLLOWED_SAINT: BossDef = {
  id: 'hollowedSaint',
  name: 'The Hollowed Saint',
  layer: 3,
  template: MONSTERS.hollowedSaint,
  spawn: spawnSaint,
  card: CARD_BY_MONSTER.hollowedSaint,
  bestiary: BESTIARY.hollowedSaint,
  view: { kind: 'hollowed', size: 1.6 },
  icon: 'hollowedSaint',
};

export default HOLLOWED_SAINT;
