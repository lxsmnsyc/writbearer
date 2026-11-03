// Where bodies can walk on a stage, and the check that every place is reached.
import Nav, { type Rect, type Spot } from '../../sim/nav';
import type { Stage } from './types';

/** The floor an area covers, where it lies. */
export const rectOf = (stage: Stage): Rect => ({
  x0: stage.x0 ?? 0,
  z0: stage.z0 ?? 0,
  x1: (stage.x0 ?? 0) + stage.width,
  z1: (stage.z0 ?? 0) + stage.depth,
});

// Removes loose obstacles between the entrance and any place it cannot reach.
// Walls stay: their breaches already guarantee a way through.
export function ensureReachable(stage: Stage, places: Spot[]): void {
  for (let attempt = 0; attempt < 6; attempt++) {
    const nav = navFor(stage);
    const stuck = places.filter((p) => !reaches(nav, stage.entrance, p));
    if (stuck.length === 0) {
      return;
    }
    for (const p of stuck) {
      stage.props = stage.props.filter(
        (prop) =>
          prop.kind === 'wall' ||
          prop.kind === 'vault' ||
          prop.r === undefined ||
          distanceToSegment(prop, stage.entrance, p) > prop.r + 1.2,
      );
    }
  }
}

/** Where units can walk on a stage. */
export function navFor(stage: Stage): Nav {
  return new Nav(stage.width, stage.depth, [...solidsOf(stage), ...holesOf(stage)]);
}

// How far a chasm cell blocks bodies from its middle, so its corners do too
const CHASM_R = 0.72;

/** The chasm's cells, as places bodies cannot go. They do not block sight. */
export function holesOf(stage: Stage): { x: number; z: number; r: number }[] {
  return (stage.chasm ?? []).map((c) => ({ x: c.x, z: c.z, r: CHASM_R }));
}

/** The props that block bodies, as obstacles. */
export function solidsOf(stage: Stage): { x: number; z: number; r: number }[] {
  return stage.props.flatMap((p) => (p.r === undefined ? [] : [{ x: p.x, z: p.z, r: p.r }]));
}

function reaches(nav: Nav, from: Spot, to: Spot): boolean {
  const path = nav.path(from, to);
  const end = path.at(-1);
  return end !== undefined && Math.hypot(end.x - to.x, end.z - to.z) < 2;
}

export function distanceToSegment(p: Spot, a: Spot, b: Spot): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
}
