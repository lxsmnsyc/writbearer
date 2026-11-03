// Ground patches (water, embers) and blossoms on an open field.
import type RNG from '../../core/rng';
import type Nav from '../../sim/nav';
import type { Spot } from '../../sim/nav';
import type { Keep } from '../fields';
import { onRoads } from './exits';
import type { Stage } from './types';

/** A patch of ground that works on whoever stands in it: shallow water slows, embers burn. */
export interface Patch extends Spot {
  kind: 'water' | 'embers';
  r: number;
}

// What lies on each layer's open fields, as counts to roll between: pools
// of shallow water, patches of embers and healing blossoms.
export const GROUND: readonly {
  water: [number, number];
  embers: [number, number];
  blossoms: [number, number];
}[] = [
  { water: [1, 2], embers: [0, 0], blossoms: [2, 2] },
  { water: [0, 0], embers: [2, 3], blossoms: [1, 1] },
  { water: [2, 3], embers: [0, 0], blossoms: [1, 2] },
  { water: [1, 2], embers: [1, 2], blossoms: [1, 1] },
];
const WATER_R: [number, number] = [2.5, 4];
const EMBERS_R: [number, number] = [1.5, 2.5];
// How far embers keep from the roads, past their own edge, so the way on
// never has to cross them
const EMBERS_OFF_ROAD = 1.2;

/**
 * Lays an open field's water, embers and blossoms on open ground, clear of
 * the entrance, the exits and the places. Water may lie across a road;
 * embers keep off them.
 */
export function layGround(stage: Stage, rng: RNG, nav: Nav, keep: readonly Keep[]): void {
  const counts = GROUND[stage.biome] ?? GROUND[0];
  const { width, depth } = stage;
  const clear = (p: Spot, r: number): boolean =>
    nav.roomy(p.x, p.z) && !keep.some((k) => Math.hypot(k.x - p.x, k.z - p.z) < k.r + r);
  const patches: Patch[] = [];
  const lay = (kind: Patch['kind'], n: number, radius: [number, number]): void => {
    let laid = 0;
    for (let tries = 0; tries < 60 && laid < n; tries++) {
      const r = rng.range(...radius);
      const p = { x: rng.range(r + 2, width - r - 2), z: rng.range(r + 2, depth - r - 2) };
      const apart = patches.every((o) => Math.hypot(o.x - p.x, o.z - p.z) > o.r + r + 2);
      const offRoad = kind === 'water' || !onRoads(stage, p.x, p.z, r + EMBERS_OFF_ROAD);
      if (clear(p, r) && apart && offRoad) {
        patches.push({ kind, ...p, r });
        laid++;
      }
    }
  };
  lay('water', rng.int(...counts.water), WATER_R);
  lay('embers', rng.int(...counts.embers), EMBERS_R);
  stage.patches = patches;
  const want = rng.int(...counts.blossoms);
  let grown = 0;
  for (let tries = 0; tries < 60 && grown < want; tries++) {
    const p = { x: rng.range(6, width - 6), z: rng.range(4, depth - 4) };
    if (clear(p, 1) && patches.every((o) => Math.hypot(o.x - p.x, o.z - p.z) > o.r + 1)) {
      stage.props.push({ kind: 'blossom', ...p, seed: rng.random() });
      grown++;
    }
  }
}
