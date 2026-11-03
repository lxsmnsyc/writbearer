// The level director's key points on an open field.
import type RNG from '../../core/rng';
import Flow from '../../sim/flow';
import type Nav from '../../sim/nav';
import type { Spot } from '../../sim/nav';
import type { Keep } from '../fields';
import { rectOf } from './reach';
import type { Stage } from './types';

/** A key point the level director works with. See the director design. */
export interface KeyPoint extends Spot {
  kind: 'spawn' | 'boss' | 'relief';
}

// Spawn spots: one in each cell of a grid this many tiles across, at most
// this many, no nearer the entrance than this
const SPAWN_GRID = 8;
const SPAWNS_MOST = 16;
const SPAWN_FROM_ENTRANCE = 6;
// How many places a spot is tried at before it is given up
const SPOT_TRIES = 6;
// Boss spots, at these shares of the way along the first road, a few tiles
// to its side; relief spots along every road, a few apart
const BOSS_ALONG = [0.35, 0.6, 0.85];
const BOSS_ASIDE = 3;
const RELIEF_SPOTS = 4;
const RELIEF_ASIDE = 2.5;
const RELIEF_NEAR = 0.8;
const RELIEF_APART = 6;

// The point a share of the way along a road, and the way it runs there
function along(road: readonly Spot[], share: number): { at: Spot; dir: Spot } {
  const legs = road.slice(1).map((b, i) => Math.hypot(b.x - road[i].x, b.z - road[i].z));
  let left = legs.reduce((n, l) => n + l, 0) * share;
  for (const [i, l] of legs.entries()) {
    if (left <= l && l > 0) {
      const a = road[i];
      const b = road[i + 1];
      const t = left / l;
      return {
        at: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t },
        dir: { x: (b.x - a.x) / l, z: (b.z - a.z) / l },
      };
    }
    left -= l;
  }
  return { at: road[road.length - 1], dir: { x: 1, z: 0 } };
}

/**
 * Lays the level director's key points over an open field: spawn spots
 * spread across it, boss spots along the first road, and relief spots
 * beside the roads. Each stands on open ground, clear of the places.
 */
export function laySpots(stage: Stage, rng: RNG, nav: Nav, keep: readonly Keep[]): KeyPoint[] {
  const spots: KeyPoint[] = [];
  // Only where the party can walk to from the entrance
  const flow = new Flow(rectOf(stage), stage.entrance, (x, z) => nav.walkable(x, z));
  const clear = (p: Spot, gap: number): boolean =>
    Number.isFinite(flow.at(p)) &&
    p.x > 1 &&
    p.z > 1 &&
    p.x < stage.width - 1 &&
    p.z < stage.depth - 1 &&
    nav.roomy(p.x, p.z) &&
    !keep.some((k) => Math.hypot(k.x - p.x, k.z - p.z) < k.r + gap);
  // A few tries in each cell of the grid, anywhere in it
  const cells = Math.floor(stage.width / SPAWN_GRID);
  const tryCell = (i: number, j: number): Spot | null => {
    for (let t = 0; t < SPOT_TRIES; t++) {
      const p = { x: (i + rng.random()) * SPAWN_GRID, z: (j + rng.random()) * SPAWN_GRID };
      const far = Math.hypot(p.x - stage.entrance.x, p.z - stage.entrance.z) >= SPAWN_FROM_ENTRANCE;
      if (far && clear(p, 0)) {
        return p;
      }
    }
    return null;
  };
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const p = tryCell(i, j);
      if (p) {
        spots.push({ kind: 'spawn', ...p });
      }
    }
  }
  spots.splice(SPAWNS_MOST, Infinity);
  const road = stage.roads.at(0);
  // Each boss spot to one side of the road or the other, a little along it
  // if both are taken
  for (const share of road ? BOSS_ALONG : []) {
    const first = rng.chance(0.5) ? 1 : -1;
    const tries = [0, 0.04, -0.04, 0.08, -0.08].flatMap((nudge) =>
      [first, -first].map((side) => ({ nudge, side })),
    );
    for (const { nudge, side } of tries) {
      const { at, dir } = along(road!, share + nudge);
      const p = nav.free(at.x - dir.z * side * BOSS_ASIDE, at.z + dir.x * side * BOSS_ASIDE);
      if (clear(p, 0)) {
        spots.push({ kind: 'boss', ...p });
        break;
      }
    }
  }
  const relief: KeyPoint[] = [];
  // Beside the road where there is room, nearer it where there is not, as
  // on a bridge
  for (let tries = 0; tries < 80 && relief.length < RELIEF_SPOTS; tries++) {
    const r = rng.pick(stage.roads);
    const { at, dir } = along(r, rng.range(0.2, 0.8));
    const side = (rng.chance(0.5) ? 1 : -1) * (tries < 40 ? RELIEF_ASIDE : RELIEF_NEAR);
    const p = { x: at.x - dir.z * side, z: at.z + dir.x * side };
    const apart = relief.every((o) => Math.hypot(o.x - p.x, o.z - p.z) >= RELIEF_APART);
    if (apart && clear(p, 0)) {
      relief.push({ kind: 'relief', ...p });
    }
  }
  return [...spots, ...relief];
}
