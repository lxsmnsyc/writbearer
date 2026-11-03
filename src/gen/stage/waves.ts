// A Horde's waves and the director's mobs.
import type { Affix } from '../../content/affixes';
import type { MiniBossId } from '../../content/minibosses';
import type { MonsterKind } from '../../content/roster';
import type RNG from '../../core/rng';
import type { Spot } from '../../sim/nav';
import { AREAS_PER_LAYER } from '../layers';
import {
  ELITE_FROM,
  PACK_DISTANCE,
  THREAT,
  areaBudget,
  factionPool,
  packOf,
  rollAffixes,
  shoots,
} from './packs';
import { navFor } from './reach';
import type { Stage } from './types';

/** A mob, as Left 4 Dead's: what comes, and how many seconds after the last, or the start. */
export interface Mob {
  kinds: MonsterKind[];
  after: number;
}

/** One wave of a Horde: what comes, from where on the edge, and how long after the last. */
export interface Wave {
  kinds: MonsterKind[];
  from: Spot;
  // Seconds after the wave before it, or after the Horde begins for the first
  delay: number;
  // Index into `kinds` of an elite leading it, or -1
  elite: number;
  // Its elite's affixes, the first shared by the wave
  affixes?: Affix[];
  // A mini-boss leading it, with its escort, ahead of its kinds
  mini?: MiniBossId;
}

// A Horde's waves: 4, one more in an Elite area and one more below the
// Marches, each a little stronger, 20 seconds apart unless beaten sooner.
const HORDE_WAVES = 4;
const WAVE_GAP = 20;
const FIRST_WAVE = 3;
// The most monsters in one wave
const WAVE_MOST = 15;

/**
 * A Horde's waves, from the threat budget a stage's packs would have had,
 * split over them and rising. Each comes from a spot on the north, south or
 * east edge, far from the entrance. The last is led by an elite once deep
 * enough, or always in an Elite area.
 */
export function buildWaves(
  stage: Stage,
  rng: RNG,
  elite: boolean,
  count = HORDE_WAVES + (elite ? 1 : 0) + (stage.index >= AREAS_PER_LAYER ? 1 : 0),
): Wave[] {
  const total = areaBudget(stage.index, elite, stage.scale);
  const pool = factionPool(stage);
  const nav = navFor(stage);
  const edge = (): Spot => {
    for (let i = 0; i < 40; i++) {
      const side = rng.int(0, 2);
      const x = side === 2 ? stage.width - 2 : rng.range(PACK_DISTANCE + 4, stage.width - 3);
      const z = [1.5, stage.depth - 1.5, rng.range(3, stage.depth - 3)][side];
      if (nav.walkable(x, z)) {
        return { x, z };
      }
    }
    return { x: stage.width - 4, z: stage.depth / 2 };
  };
  const waves: Wave[] = [];
  for (let w = 0; w < count; w++) {
    // Later waves are stronger: shares rising from 0.6 to 1.4 of the mean
    let budget = (total / count) * (0.6 + (0.8 * w) / Math.max(1, count - 1));
    const kinds: MonsterKind[] = [];
    while (budget > 0 && kinds.length < WAVE_MOST) {
      for (const k of packOf(rng, rng.pick(pool), WAVE_MOST - kinds.length)) {
        kinds.push(k);
        budget -= THREAT[k];
      }
    }
    const last = w === count - 1;
    const led = last && (elite || stage.index >= ELITE_FROM);
    waves.push({
      kinds,
      from: edge(),
      delay: w === 0 ? FIRST_WAVE : WAVE_GAP,
      elite: led ? 0 : -1,
      affixes: led ? rollAffixes(rng, stage.biome, kinds.length, shoots(kinds[0])) : undefined,
    });
  }
  return waves;
}

// Mobs in a Hunt or an Escort: how many, how much of an area's threat each
// holds, and how many seconds apart they come, at the least
const MOBS = 3;
const MOB_SHARE = 0.15;
const MOB_EVERY: [number, number] = [60, 120];

/**
 * A Hunt's or an Escort's mobs, as Left 4 Dead's: groups the director sends
 * on a randomized beat while it is building up, each a share of the area's
 * threat, from the layer's packs.
 */
export function buildMobs(stage: Stage, rng: RNG, elite: boolean): Mob[] {
  const pool = factionPool(stage);
  if (pool.length === 0) {
    return [];
  }
  return Array.from({ length: MOBS }, () => {
    let budget = areaBudget(stage.index, elite, stage.scale) * MOB_SHARE;
    const kinds: MonsterKind[] = [];
    while (budget > 0 && kinds.length < WAVE_MOST) {
      for (const k of packOf(rng, rng.pick(pool), WAVE_MOST - kinds.length)) {
        kinds.push(k);
        budget -= THREAT[k];
      }
    }
    return { kinds, after: rng.range(...MOB_EVERY) };
  });
}
