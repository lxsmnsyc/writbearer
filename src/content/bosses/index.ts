import type RNG from '../../core/rng';
import type Sim from '../../sim/sim';
import type Unit from '../../sim/unit';
import ABBESS from './abbess';
import BROOD_MOTHER from './brood-mother';
import GATEKEEPER from './gatekeeper';
import HOLLOWED_SAINT from './hollowed-saint';
import type { BossDef } from './types';

export type { BossDef } from './types';

/** Every built boss, by id. A boss pair adds its defs here. */
export const BOSSES: ReadonlyMap<string, BossDef> = new Map(
  [BROOD_MOTHER, GATEKEEPER, ABBESS, HOLLOWED_SAINT].map((def) => [def.id, def]),
);

/**
 * The designed three bosses of each layer, fixed so a seed keeps its meaning
 * as bosses land. The first of each is built; the rest may not be yet.
 */
export const POOLS: readonly (readonly string[])[] = [
  ['broodMother', 'drownedReeve', 'lanternEater'],
  ['gatekeeper', 'siegeCrew', 'bridgeWarden'],
  ['abbess', 'ossuaryBishop', 'drownedChoir'],
  ['hollowedSaint', 'usurper', 'facelessRegent'],
];

/** The stream area the roll uses: `BOSS_ROLL + depth`. */
export const BOSS_ROLL = 7000;

const ALL = POOLS.flat();

const poolOf = (layer: number): readonly string[] =>
  POOLS[Math.min(Math.max(layer, 0), POOLS.length - 1)];

/**
 * An id that is built, or the first built id of its pool. `built` is the
 * registry's ids; tests pass their own.
 */
export function resolveBoss(
  id: string,
  built: ReadonlySet<string> = new Set(BOSSES.keys()),
): string {
  if (built.has(id)) {
    return id;
  }
  const pool = POOLS.find((p) => p.includes(id)) ?? POOLS[0];
  return pool.find((p) => built.has(p)) ?? POOLS[0][0];
}

/**
 * Rolls a layer's boss from its pool of three, or from all twelve in endless.
 * Pass `streams.area(1, Stream.Map, BOSS_ROLL + depth)`, so no other stream
 * moves.
 */
export function rollBoss(
  rng: RNG,
  depth: number,
  endless: boolean,
  built?: ReadonlySet<string>,
): string {
  return resolveBoss(rng.pick(endless ? ALL : poolOf(depth)), built);
}

/** Spawns a boss by id, or the layer's current boss when there is no id. */
export function spawnBoss(
  sim: Sim,
  layer: number,
  level: number,
  x: number,
  z: number,
  id?: string,
): Unit {
  const def = BOSSES.get(resolveBoss(id ?? poolOf(layer)[0])) ?? BROOD_MOTHER;
  return def.spawn(sim, level, x, z);
}
