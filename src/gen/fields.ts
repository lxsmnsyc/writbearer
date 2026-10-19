import type RNG from '../core/rng';
import type { Spot } from '../sim/nav';

// The ground plans of open fight areas, after Aghanim's Labyrinth's rooms:
// square, crossed from a corner to the far edge, and never cut in two.
// Obstacles stand as islands or as walls with several openings, so there
// are always at least two ways across.
//
// - Grove: clumps of trees with paths looping between them. The Marches.
// - Cavern: chambers walled by rock, joined by one or two openings in each
//   wall. The Rift Road.
// - Bridges: islands over the chasm, joined by narrow bridges, with one more
//   bridge than needed. The Rift Road.
// - Halls: rooms in a grid, a doorway between each two, pillars inside. The
//   Undercroft and the Sunken Crown.

export type Plan = 'grove' | 'cavern' | 'bridges' | 'halls';

/** A circle kept open: the entrance, an exit, a place. */
export interface Keep extends Spot {
  r: number;
}

/** What a plan lays down, for the area to place as props. */
export interface Layout {
  // Blocking pieces: trees and rocks in clumps, or wall blocks in lines
  trees: Spot[];
  walls: Spot[];
  pillars: Spot[];
  // Floor cells that are chasm: one tile each, at their middles
  chasm: Spot[];
}

const BRIDGES_CHANCE = 0.4;
// How often the Undercroft's flooded caverns stand in for its halls
const CAVERN_BELOW = 0.3;

/** The plan an open field of a layer takes, by its layer's ground. */
export function planFor(rng: RNG, biome: number): Plan {
  if (biome === 0) {
    return 'grove';
  }
  if (biome === 1) {
    return rng.chance(BRIDGES_CHANCE) ? 'bridges' : 'cavern';
  }
  return biome === 2 && rng.chance(CAVERN_BELOW) ? 'cavern' : 'halls';
}

/** Lays out a plan over a `size` by `size` field, keeping the given circles open. */
export function layOut(rng: RNG, plan: Plan, size: number, keep: readonly Keep[]): Layout {
  const out: Layout = { trees: [], walls: [], pillars: [], chasm: [] };
  if (plan === 'grove') {
    grove(rng, size, keep, out);
  } else if (plan === 'bridges') {
    bridges(rng, size, keep, out);
  } else {
    rooms(rng, plan, size, keep, out);
  }
  return out;
}

const kept = (keep: readonly Keep[], p: Spot, gap = 0): boolean =>
  keep.some((k) => Math.hypot(k.x - p.x, k.z - p.z) < k.r + gap);

// Island clumps: how far apart their middles are on the grid, how big, and
// the least gap between two
const GROVE_CELL = 9;
const GROVE_R: [number, number] = [2.8, 4.8];
const GROVE_GAP = 3;
const GROVE_FILL = 0.85;
const TREE_STEP = 1.3;
// Lone trees between the clumps, and how far they keep from anything else
const LONE_TREES = 24;
const LONE_GAP = 2.5;

// Clumps of trees on a loose grid, apart from each other and the kept ground.
function grove(rng: RNG, size: number, keep: readonly Keep[], out: Layout): void {
  const clumps: Keep[] = [];
  const n = Math.floor(size / GROVE_CELL);
  const cell = size / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!rng.chance(GROVE_FILL)) {
        continue;
      }
      const r = rng.range(...GROVE_R);
      const c = {
        x: (i + 0.5) * cell + rng.range(-2, 2),
        z: (j + 0.5) * cell + rng.range(-2, 2),
        r,
      };
      const clear =
        !kept(keep, c, r + 1) &&
        clumps.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= o.r + r + GROVE_GAP) &&
        c.x - r > 2 &&
        c.z - r > 2 &&
        c.x + r < size - 2 &&
        c.z + r < size - 2;
      if (clear) {
        clumps.push(c);
      }
    }
  }
  for (const c of clumps) {
    // Rows of trees across the clump, a little ragged
    const squash = rng.range(0.7, 1);
    for (let dx = -c.r; dx <= c.r; dx += TREE_STEP) {
      for (let dz = -c.r; dz <= c.r; dz += TREE_STEP) {
        if (Math.hypot(dx, dz / squash) > c.r) {
          continue;
        }
        out.trees.push({
          x: c.x + dx + rng.range(-0.3, 0.3),
          z: c.z + dz + rng.range(-0.3, 0.3),
        });
      }
    }
  }
  let lone = 0;
  for (let tries = 0; tries < LONE_TREES * 4 && lone < LONE_TREES; tries++) {
    const t = { x: rng.range(2, size - 2), z: rng.range(2, size - 2) };
    const clear =
      !kept(keep, t, 1) &&
      clumps.every((c) => Math.hypot(c.x - t.x, c.z - t.z) > c.r + LONE_GAP) &&
      out.trees.every((o) => Math.hypot(o.x - t.x, o.z - t.z) > LONE_GAP);
    if (clear) {
      out.trees.push(t);
      lone++;
    }
  }
}

// A field of rooms: three by three, each pair joined by openings in the wall
// between them. A cavern's walls are ragged rock with one or two wide gaps;
// halls have straight walls with one doorway and pillars inside.
const ROOMS = 3;
const WALL_STEP = 0.9;
const DOOR = { cavern: 4.5, halls: 3.2 };

function rooms(
  rng: RNG,
  plan: 'cavern' | 'halls',
  size: number,
  keep: readonly Keep[],
  out: Layout,
): void {
  const cell = size / ROOMS;
  const door = DOOR[plan];
  const ragged = plan === 'cavern';
  // Lays a wall from `a` to `b` along one axis, leaving its openings.
  const wall = (fixed: number, from: number, to: number, alongX: boolean): void => {
    const count = ragged && rng.chance(0.5) ? 2 : 1;
    const span = to - from;
    const doors = Array.from({ length: count }, (_, k) => {
      const lo = from + (span * k) / count + door;
      const hi = from + (span * (k + 1)) / count - door;
      return rng.range(lo, Math.max(lo, hi));
    });
    const wobble = rng.range(0, Math.PI * 2);
    for (let t = from; t <= to; t += WALL_STEP) {
      if (doors.some((d) => Math.abs(t - d) < door / 2)) {
        continue;
      }
      const sway = ragged ? Math.sin(t * 0.6 + wobble) * 0.9 : 0;
      const p = alongX ? { x: t, z: fixed + sway } : { x: fixed + sway, z: t };
      if (!kept(keep, p, 1)) {
        out.walls.push(p);
      }
    }
  };
  for (let k = 1; k < ROOMS; k++) {
    for (let j = 0; j < ROOMS; j++) {
      // The wall between two rooms side by side, and the one between two
      // rooms one above the other
      wall(k * cell, j * cell + 0.5, (j + 1) * cell - 0.5, false);
      wall(k * cell, j * cell + 0.5, (j + 1) * cell - 0.5, true);
    }
  }
  // Halls hold pillars in pairs; caverns, a few loose rocks.
  for (let i = 0; i < ROOMS; i++) {
    for (let j = 0; j < ROOMS; j++) {
      const cx = (i + 0.5) * cell;
      const cz = (j + 0.5) * cell;
      const spots = ragged
        ? Array.from({ length: rng.int(0, 2) }, () => ({
            x: cx + rng.range(-cell / 4, cell / 4),
            z: cz + rng.range(-cell / 4, cell / 4),
          }))
        : [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: cx + sx * 3, z: cz + sz * 3 })));
      for (const p of spots) {
        if (!kept(keep, p, 1.5)) {
          out.pillars.push(p);
        }
      }
    }
  }
}

// Islands over the chasm: one under each kept circle, a few between, and
// bridges joining them, each island to its nearest, then one more.
const ISLAND_R: [number, number] = [5, 7];
const MIDDLE_ISLANDS: [number, number] = [3, 4];
const BRIDGE_HALF = 1.5;

function bridges(rng: RNG, size: number, keep: readonly Keep[], out: Layout): void {
  const islands: Keep[] = keep.map((k) => ({ x: k.x, z: k.z, r: Math.max(k.r + 1, 4.5) }));
  const want = islands.length + rng.int(...MIDDLE_ISLANDS);
  for (let tries = 0; tries < 200 && islands.length < want; tries++) {
    const r = rng.range(...ISLAND_R);
    const c = { x: rng.range(r + 2, size - r - 2), z: rng.range(r + 2, size - r - 2), r };
    if (islands.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= o.r + r + 4)) {
      islands.push(c);
    }
  }
  // Each island joins the nearest already joined, as a tree from the first;
  // then one more bridge, the shortest left, makes a loop.
  const spans: [Keep, Keep][] = [];
  const joined = [islands[0]];
  const rest = islands.slice(1);
  const gap = (a: Keep, b: Keep): number => Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
  while (rest.length > 0) {
    let best: [number, number] = [0, 0];
    let bestGap = Infinity;
    rest.forEach((b, i) => {
      joined.forEach((a, j) => {
        if (gap(a, b) < bestGap) {
          bestGap = gap(a, b);
          best = [i, j];
        }
      });
    });
    const [b] = rest.splice(best[0], 1);
    spans.push([joined[best[1]], b]);
    joined.push(b);
  }
  const extra = islands
    .flatMap((a, i) => islands.slice(i + 1).map((b): [Keep, Keep] => [a, b]))
    .filter(([a, b]) => !spans.some(([p, q]) => (p === a && q === b) || (p === b && q === a)))
    .sort(([a, b], [c, d]) => gap(a, b) - gap(c, d));
  if (extra.length > 0) {
    spans.push(extra[0]);
  }
  const onBridge = (p: Spot): boolean => spans.some(([a, b]) => toSegment(p, a, b) <= BRIDGE_HALF);
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      const p = { x: x + 0.5, z: z + 0.5 };
      const ground = islands.some((o) => Math.hypot(o.x - p.x, o.z - p.z) <= o.r) || onBridge(p);
      if (!ground) {
        out.chasm.push(p);
      }
    }
  }
}

function toSegment(p: Spot, a: Spot, b: Spot): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
}
