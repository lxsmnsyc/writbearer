import { SimEvents } from '../../sim/events';
import type Sim from '../../sim/sim';
import { DamagePriority, Side } from '../../sim/types';
import type Unit from '../../sim/unit';
import { spawnMonster } from '../roster';

export const party = (sim: Sim): Unit[] => sim.living(Side.Party);

// Calls `once` the first time `boss` drops to `share` of its health.
export function atHealth(sim: Sim, boss: Unit, share: number, once: () => void): void {
  let done = false;
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (!done && event.target === boss && boss.alive && boss.hp <= boss.derived.maxHp * share) {
      done = true;
      once();
    }
  });
}

// Spawns monsters around a boss, awake, as its call brings them.
export function call(
  sim: Sim,
  boss: Unit,
  kind: 'hollowSoldier' | 'penitent',
  count: number,
): Unit[] {
  return Array.from({ length: count }, (_, i) => {
    const a = boss.angle + Math.PI + ((i - (count - 1) / 2) * Math.PI) / 4;
    const m = spawnMonster(
      sim,
      kind,
      Math.max(1, boss.level - 2),
      boss.x + Math.cos(a) * 2.5,
      boss.z + Math.sin(a) * 2.5,
    );
    m.aware = true;
    return m;
  });
}
