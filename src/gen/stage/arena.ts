// A layer's last area: the boss's wide field and the way down.
import type RNG from '../../core/rng';
import type { Spot } from '../../sim/nav';
import { OUT } from './exits';
import { KEEP_ENTRANCE, KEEP_EXIT } from './field';
import { approachPack } from './packs';
import { adder, tallFor } from './props';
import { ensureReachable } from './reach';
import type { Stage } from './types';

// A boss's field, wide enough to run in, and the ground kept clear round it
const BOSS_WIDTH = 64;
const BOSS_DEPTH = 46;
const BOSS_CLEAR = 6;

/**
 * A layer's last area: a wide open field with no way back, the boss in its
 * middle and the way down far beyond it, shut while the boss lives. There
 * is room to run from its blows. A few pillars or dead trees stand about,
 * and packs of the layer's own stray on the near side.
 */
export default function generateArena(
  rng: RNG,
  index: number,
  biome: number,
  bossId?: string,
): Stage {
  const width = BOSS_WIDTH;
  const depth = BOSS_DEPTH;
  const entrance = { x: 2.5, z: depth / 2 };
  const boss = { x: width * 0.6, z: depth / 2 };
  const exit = { x: width - 3, z: depth / 2 };
  const stage: Stage = {
    index,
    kind: 'boss',
    biome,
    width,
    depth,
    entrance,
    exit,
    exits: [{ ...exit, ahead: 'down', side: 'east', out: OUT.east, sign: exit }],
    props: [],
    sigils: [boss],
    stains: [],
    packs: [],
    roads: [],
    down: true,
    boss,
    bossId,
  };
  const add = adder(stage, rng);

  add('stair', exit.x, exit.z);
  add('brazier', exit.x - 1.2, exit.z - 1.6);
  add('brazier', exit.x - 1.2, exit.z + 1.6);

  // Old blood round where the boss waits
  for (let i = 0; i < 10; i++) {
    const a = rng.random() * Math.PI * 2;
    const d = rng.range(1, BOSS_CLEAR);
    stage.stains.push({
      x: boss.x + Math.cos(a) * d,
      z: boss.z + Math.sin(a) * d,
      r: rng.range(0.5, 1.1),
    });
  }

  // Sparse cover: something to put between the bearer and a charge, never
  // enough to wall it in.
  const tall = tallFor(biome);
  const clearOf = (x: number, z: number): boolean =>
    Math.hypot(x - entrance.x, z - entrance.z) > KEEP_ENTRANCE &&
    Math.hypot(x - boss.x, z - boss.z) > BOSS_CLEAR &&
    Math.hypot(x - exit.x, z - exit.z) > KEEP_EXIT;
  const solids: Spot[] = [];
  for (let i = 0; i < width * depth * 0.012; i++) {
    const x = rng.range(3, width - 3);
    const z = rng.range(3, depth - 3);
    if (!clearOf(x, z) || solids.some((o) => Math.hypot(o.x - x, o.z - z) < 4)) {
      continue;
    }
    if (rng.chance(0.7)) {
      add(tall, x, z);
    } else {
      add('rubble', x, z).r = rng.range(0.35, 0.6);
    }
    solids.push({ x, z });
  }
  for (const t of [0.3, 0.45]) {
    const x = width * t;
    const z = entrance.z + (t < 0.4 ? -1 : 1) * rng.range(5, 10);
    stage.packs.push({ kinds: approachPack(rng, biome), x, z, elite: -1 });
  }
  ensureReachable(stage, [boss, exit]);
  return stage;
}
