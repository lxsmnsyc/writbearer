// A Collapse's falling floor, and the floor an area still has.
import type { Rect, Spot } from '../../sim/nav';
import { rectOf } from './reach';
import type { Stage } from './types';

/**
 * A Collapse's floor, falling away from the entrance's edge toward the
 * exits: the way it falls, how far it has fallen, where it stops, and how
 * fast it goes, in tiles a second.
 */
export interface Collapse {
  dir: Spot;
  front: number;
  stop: number;
  speed: number;
}

/**
 * The floor of an area still standing: all of it, but what a Collapse has
 * taken. The floor falls a whole tile at a time.
 */
export function floorOf(stage: Stage): Rect {
  const r = rectOf(stage);
  const fallen = Math.floor(stage.collapse?.front ?? 0);
  const dir = stage.collapse?.dir;
  if (!dir || fallen <= 0) {
    return r;
  }
  if (dir.x > 0) {
    return { ...r, x0: r.x0 + fallen };
  }
  if (dir.x < 0) {
    return { ...r, x1: r.x1 - fallen };
  }
  if (dir.z > 0) {
    return { ...r, z0: r.z0 + fallen };
  }
  return { ...r, z1: r.z1 - fallen };
}

// How far across a Collapse's floor falls, as a share of its width, how
// fast in tiles a second, and how much faster in an Elite area
const COLLAPSE_STOP = 0.68;
const COLLAPSE_SPEED = 0.5;
const COLLAPSE_ELITE = 1.2;

// A Collapse's floor: it falls from the entrance's edge, and stops short of
// the exits.
export function collapseFor(width: number, elite: boolean): Collapse {
  return {
    dir: { x: 1, z: 0 },
    front: 0,
    stop: width * COLLAPSE_STOP,
    speed: COLLAPSE_SPEED * (elite ? COLLAPSE_ELITE : 1),
  };
}
