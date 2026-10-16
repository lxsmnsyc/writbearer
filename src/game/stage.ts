import { spawnBoss } from '../content/bosses';
import { type MercKind, spawnBearer, spawnMerc, spawnMonster } from '../content/roster';
import { type Stage, monsterLevel, solidsOf } from '../gen/stage';
import type Sim from '../sim/sim';
import { Side } from '../sim/types';
import type Unit from '../sim/unit';

/**
 * Lays a stage's floor and obstacles into the simulation, and spawns its
 * packs and its boss. Returns the boss, if the stage has one.
 */
export function enterStage(sim: Sim, stage: Stage): Unit | null {
  sim.area++;
  sim.obstacles.length = 0;
  sim.obstacles.push(...solidsOf(stage));
  sim.setFloor(stage.width, stage.depth);
  for (const pack of stage.packs) {
    pack.kinds.forEach((kind, i) => {
      const a = (i / pack.kinds.length) * Math.PI * 2;
      const r = pack.kinds.length > 1 ? 1.1 : 0;
      spawnMonster(
        sim,
        kind,
        monsterLevel(stage.index),
        pack.x + Math.cos(a) * r,
        pack.z + Math.sin(a) * r,
        {
          elite: i === pack.elite,
        },
      ).marked = i === pack.marked;
    });
  }
  // A boss stands a level above the layer's last packs would.
  return stage.boss
    ? spawnBoss(sim, stage.biome, monsterLevel(stage.index) + 1, stage.boss.x, stage.boss.z)
    : null;
}

// How near the bearer comes before a boss wakes. A blow wakes it sooner.
const WAKE_REACH = 13;

/**
 * Wakes a boss once the bearer comes near it. Returns whether it woke now.
 * There is no way back out of a boss's field, so the fight is on.
 */
export function wakeBoss(sim: Sim, boss: Unit | null): boolean {
  const bearer = sim.bearer;
  if (!boss?.alive || boss.aware || !bearer?.alive) {
    return false;
  }
  if (boss.distanceTo(bearer) > WAKE_REACH) {
    return false;
  }
  boss.aware = true;
  return true;
}

/** The level mercs start a run at. */
export const START_LEVEL = 5;

/** The bearer at a stage's entrance, with any mercs it starts with. */
export function spawnParty(
  sim: Sim,
  stage: Stage,
  mercs: readonly Exclude<MercKind, 'bearer'>[] = ['vanguard', 'ranger'],
): Unit {
  const { x, z } = stage.entrance;
  const bearer = spawnBearer(sim, x, z);
  mercs.forEach((kind, i) => {
    spawnMerc(sim, kind, START_LEVEL, x + 1 - i * 0.6, z - 1 + i);
  });
  return bearer;
}

/**
 * Moves the party onto a new stage's entrance: the living and the dead
 * alike, since dead mercs come along. Monsters of the old stage stay behind.
 */
export function carryParty(sim: Sim, stage: Stage): void {
  const party = [...sim.units].filter((u) => u.side === Side.Party);
  for (const u of sim.units) {
    if (!party.includes(u)) {
      sim.units.delete(u);
    }
  }
  sim.projectiles.length = 0;
  sim.warnings.length = 0;
  const { x, z } = stage.entrance;
  party.forEach((u, i) => {
    const a = (i / party.length) * Math.PI * 2;
    const r = u === sim.bearer ? 0 : 1.1;
    u.x = x + 0.5 + Math.cos(a) * r;
    u.z = z + Math.sin(a) * r;
    u.order = null;
    u.target = null;
    u.swing = -1;
    u.cast = null;
  });
}
