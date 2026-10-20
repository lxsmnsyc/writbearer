import type { Rect, Spot } from '../sim/nav';
import type { Exit, Stage } from './stage';

// Areas are built facing east, from the entrance on their west edge. To
// join them into one world, each is turned to face the way the party
// leaves the last one, and moved so its entrance lies past that exit.

/** The four ways an area can face: east, south, west and north. */
export const FACINGS: readonly Spot[] = [
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
  { x: 0, z: -1 },
];

// How a built area maps into the world: its local (0, 0) lands at `at`,
// local x runs along `u` and local z along `v`, a quarter turn from `u`.
interface Frame {
  at: Spot;
  u: Spot;
  v: Spot;
}

const frameOf = (facing: Spot, at: Spot): Frame => ({
  at,
  u: facing,
  v: { x: -facing.z, z: facing.x },
});

const toWorld = (f: Frame, p: Spot): Spot => ({
  x: f.at.x + p.x * f.u.x + p.z * f.v.x,
  z: f.at.z + p.x * f.u.z + p.z * f.v.z,
});

const turn = (f: Frame, d: Spot): Spot => ({
  x: d.x * f.u.x + d.z * f.v.x,
  z: d.x * f.u.z + d.z * f.v.z,
});

/**
 * Turns a built area to face `facing` and moves its local (0, 0) to `at`.
 * Every point in it moves with it. Returns the same stage.
 */
export function placeStage(stage: Stage, facing: Spot, at: Spot): Stage {
  const f = frameOf(facing, at);
  // Some points are shared, such as the first exit, which is also `exit`.
  const moved = new Set<object>();
  const move = (p: Spot | undefined): void => {
    if (!p || moved.has(p)) {
      return;
    }
    moved.add(p);
    const w = toWorld(f, p);
    p.x = w.x;
    p.z = w.z;
  };
  const corners = [toWorld(f, { x: 0, z: 0 }), toWorld(f, { x: stage.width, z: stage.depth })];
  move(stage.entrance);
  for (const e of stage.exits) {
    move(e);
    move(e.sign);
    e.out = turn(f, e.out);
  }
  move(stage.exit);
  for (const list of [stage.props, stage.sigils, stage.stains, stage.packs, stage.hazards ?? []]) {
    list.forEach(move);
  }
  stage.roads.forEach((road) => {
    road.forEach(move);
  });
  for (const p of [
    stage.boss,
    stage.station,
    stage.recruit,
    stage.rest,
    stage.tomb,
    stage.town,
    stage.event,
    stage.reward,
  ]) {
    move(p);
  }
  stage.recruits?.forEach(move);
  stage.chasm?.forEach(move);
  stage.patches?.forEach(move);
  stage.refugees?.forEach(move);
  stage.rites?.forEach(move);
  stage.waves?.forEach((w) => {
    move(w.from);
  });
  if (stage.goal) {
    stage.goal = turnRect(f, stage.goal);
  }
  stage.x0 = Math.min(corners[0].x, corners[1].x);
  stage.z0 = Math.min(corners[0].z, corners[1].z);
  stage.width = Math.abs(corners[1].x - corners[0].x);
  stage.depth = Math.abs(corners[1].z - corners[0].z);
  return stage;
}

function turnRect(f: Frame, r: Rect): Rect {
  const a = toWorld(f, { x: r.x0, z: r.z0 });
  const b = toWorld(f, { x: r.x1, z: r.z1 });
  return {
    x0: Math.min(a.x, b.x),
    z0: Math.min(a.z, b.z),
    x1: Math.max(a.x, b.x),
    z1: Math.max(a.z, b.z),
  };
}

/** How far an area's exits sit in from its edge, as `placeExits` lays them. */
const EXIT_INSET = 3;

/**
 * Places a built area beyond an exit of one already placed: turned to face
 * the way out, its west edge on the exit's edge, and its entrance across
 * from the exit. Returns the same stage.
 */
export function placeBeyond(next: Stage, exit: Exit): Stage {
  const facing = exit.out;
  // The point on the edge the exit leads across
  const edge = { x: exit.x + facing.x * EXIT_INSET, z: exit.z + facing.z * EXIT_INSET };
  const v = { x: -facing.z, z: facing.x };
  // Local (0, entrance.z) is on the next area's west edge, across from it.
  const at = {
    x: Math.round(edge.x - next.entrance.z * v.x),
    z: Math.round(edge.z - next.entrance.z * v.z),
  };
  return placeStage(next, facing, at);
}

/** The facing of an area placed with its local x along `u`, as an index into FACINGS. */
export const facingIndex = (u: Spot): number =>
  FACINGS.findIndex((f) => f.x === Math.sign(u.x) && f.z === Math.sign(u.z));
