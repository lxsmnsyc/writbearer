import { spawnBoss } from '../content/bosses';
import { type MercKind, spawnBearer, spawnMerc, spawnMonster } from '../content/roster';
import { GATE_SOLID, type Stage, monsterLevel, solidsOf } from '../gen/stage';
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

// How far inside the arena wall the bearer gets before the gate shuts.
const SHUT_DEPTH = 2;

/**
 * Shuts an arena's gate once the bearer is well inside. Mercs still outside,
 * living or dead, are pulled in through it as it shuts, and the boss wakes.
 * Returns whether it shut now.
 */
export function shutArena(sim: Sim, stage: Stage, boss: Unit | null): boolean {
  const arena = stage.arena;
  const bearer = sim.bearer;
  if (!arena || arena.closed || !bearer?.alive) {
    return false;
  }
  if (Math.hypot(bearer.x - arena.x, bearer.z - arena.z) > arena.r - SHUT_DEPTH) {
    return false;
  }
  arena.closed = true;
  for (const p of stage.props) {
    if (p.kind === 'gate') {
      p.r = GATE_SOLID;
    }
  }
  sim.obstacles.length = 0;
  sim.obstacles.push(...solidsOf(stage));
  sim.setFloor(stage.width, stage.depth);
  const inside = arena.r - 1.5;
  const outside = [...sim.units].filter(
    (u) => u.side === Side.Party && Math.hypot(u.x - arena.x, u.z - arena.z) > inside,
  );
  outside.forEach((u, i) => {
    u.x = arena.x - inside + 0.5;
    u.z = arena.z + (i - (outside.length - 1) / 2) * 0.9;
    u.order = null;
  });
  if (boss) {
    boss.aware = true;
  }
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
