// Ground patches (water, embers) and blossoms on an open field.
import type RNG from '../../core/rng';
import type Nav from '../../sim/nav';
import type { Spot } from '../../sim/nav';
import type { Keep } from '../fields';
import { onRoads } from './exits';
import type { Stage } from './types';

/** A patch of ground that works on whoever stands in it: shallow water slows, embers burn. */
export interface Patch extends Spot {
  // Deep water and grass are reserved for the terrain nodes: nothing lays them yet.
  kind: 'water' | 'embers' | 'deep' | 'grass';
  r: number;
  // Deep water turned to ice
  frozen?: boolean;
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
// How far embers keep from the roads, past their own edge, so the way on
// never has to cross them
const EMBERS_OFF_ROAD = 1.2;

// What each kind of patch is when laid: its radius range, and how far it
// keeps from the roads (null: it may lie across one). The kinds are laid in
// this order, and a new kind adds a row.
export const KINDS: Record<Patch['kind'], { radius: [number, number]; offRoad: number | null }> = {
  water: { radius: [2.5, 4], offRoad: null },
  embers: { radius: [1.5, 2.5], offRoad: EMBERS_OFF_ROAD },
  deep: { radius: [2.5, 4], offRoad: null },
  grass: { radius: [2.5, 4], offRoad: null },
};

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
  const lay = (kind: Patch['kind'], n: number): void => {
    const { radius, offRoad: margin } = KINDS[kind];
    let laid = 0;
    for (let tries = 0; tries < 60 && laid < n; tries++) {
      const r = rng.range(...radius);
      const p = { x: rng.range(r + 2, width - r - 2), z: rng.range(r + 2, depth - r - 2) };
      const apart = patches.every((o) => Math.hypot(o.x - p.x, o.z - p.z) > o.r + r + 2);
      const offRoad = margin === null || !onRoads(stage, p.x, p.z, r + margin);
      if (clear(p, r) && apart && offRoad) {
        patches.push({ kind, ...p, r });
        laid++;
      }
    }
  };
  lay('water', rng.int(...counts.water));
  lay('embers', rng.int(...counts.embers));
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
