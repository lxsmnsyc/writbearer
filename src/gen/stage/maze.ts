// The Labyrinth: its cells, traps, gates and key.
import type RNG from '../../core/rng';
import type { Spot } from '../../sim/nav';
import { AREAS_PER_LAYER } from '../layers';
import { placeExits } from './exits';
import { TRAPS_DEEP, TRAPS_SHALLOW, TRAP_PERIOD } from './hazards';
import { type Prop, adder } from './props';
import type { AreaPlan, Stage } from './types';

/** A gate across a Labyrinth's corridor, and the lever that opens it. The hall's gates have none: the key opens them. */
export interface Gate {
  blocks: Prop[];
  lever?: Prop;
  open?: boolean;
}

/**
 * Opens a gate: its bars drop, so they no longer block. Returns where they
 * stood, to take them out of the simulation's obstacles.
 */
export function openGate(gate: Gate): Spot[] {
  if (gate.open === true) {
    return [];
  }
  gate.open = true;
  if (gate.lever) {
    gate.lever.open = true;
  }
  for (const b of gate.blocks) {
    b.r = undefined;
    b.open = true;
  }
  return gate.blocks.map((b) => ({ x: b.x, z: b.z }));
}

// Inner gates in a Labyrinth: one, and two deeper in
const GATES_DEEP_FROM = 8;

// A Labyrinth's cells, in tiles across, and how many across and down
const CELL = 4;
const MAZE_COLUMNS = 14;
const MAZE_ROWS = 9;
// How many branches leave the main path and rejoin it, one more deeper in,
// and how far along the path each spans, in cells
const BRANCHES = 2;
const BRANCH_SPAN: [number, number] = [3, 7];
// Traps along the path, before the director's scale: a base, one more each
// two areas, and three more in an Elite fight
const MAZE_TRAPS = 7;
// The first cells of the path, kept clear of traps
const MAZE_CLEAR = 2;
// Where the wall blocks of a rubble heap stand round a cell's middle
const RUBBLE: readonly [number, number][] = [
  [-0.5, -0.4],
  [0.5, -0.3],
  [0, 0.5],
];

/**
 * A Labyrinth, as Aghanim's Labyrinth's obstacle rooms: a course of ruined
 * walls cut into square cells, with one main path from the entrance on the
 * west to a hall down the east side, and branches that leave the path and
 * rejoin it. It has no monsters. Its traps stand along the path, as many and
 * as quick as the director's scale says. One branch holds a chest. Another
 * is a way round traps on the path. The hall's key lies on the way, and a
 * gate on the path opens from a lever before it.
 */
export function generateMaze(rng: RNG, index: number, plan: AreaPlan, biome: number): Stage {
  const width = MAZE_COLUMNS * CELL;
  const depth = MAZE_ROWS * CELL;
  const startRow = Math.floor(MAZE_ROWS / 2);
  const entrance = { x: 2, z: startRow * CELL + CELL / 2 };
  const stage: Stage = {
    index,
    kind: plan.kind,
    biome,
    width,
    depth,
    entrance,
    exit: entrance,
    exits: [],
    props: [],
    sigils: [],
    stains: [],
    packs: [],
    roads: [],
    down: false,
    objective: 'maze',
    goal: { x0: width - CELL, z0: 0, x1: width, z1: depth },
    hazards: [],
  };
  const add = adder(stage, rng);
  placeExits(stage, add, plan.ahead, depth / 2, plan.sides, width - CELL / 2);
  stage.reward = { x: width - CELL / 2, z: depth / 2 };

  const hall = MAZE_COLUMNS - 1;
  const key = (i: number, j: number): number => i * MAZE_ROWS + j;
  const cellOf = (k: number): [number, number] => [Math.floor(k / MAZE_ROWS), k % MAZE_ROWS];
  const edge = (p: number, q: number): string => `${Math.min(p, q)},${Math.max(p, q)}`;
  // The carved cells, and the open ways between them
  const carved = new Set<number>();
  const ways = new Set<string>();
  const join = (p: number, q: number): void => {
    carved.add(p);
    carved.add(q);
    ways.add(edge(p, q));
  };
  const near = (k: number): number[] => {
    const [i, j] = cellOf(k);
    return (
      [
        [i + 1, j],
        [i - 1, j],
        [i, j + 1],
        [i, j - 1],
      ] as [number, number][]
    )
      .filter(([x, z]) => x >= 0 && x < hall && z >= 0 && z < MAZE_ROWS)
      .map(([x, z]) => key(x, z));
  };

  // The main path: east from the entrance, turning up or down the rows on
  // the way, to the column before the hall.
  const path = [key(0, startRow)];
  carved.add(path[0]);
  for (let i = 0, j = startRow; i < hall - 1;) {
    if (i > 0 && rng.chance(0.55)) {
      const dir = rng.chance(0.5) ? 1 : -1;
      const run = rng.int(1, 3);
      for (let n = 0; n < run; n++) {
        const z = j + dir;
        if (z < 0 || z >= MAZE_ROWS) {
          break;
        }
        join(key(i, j), key(i, z));
        path.push(key(i, z));
        j = z;
      }
    }
    join(key(i, j), key(i + 1, j));
    path.push(key(i + 1, j));
    i++;
  }

  // Branches: each a way through uncarved cells from one cell of the path to
  // one a few cells further along, found breadth first.
  const branches: { from: number; to: number; cells: number[] }[] = [];
  const want = BRANCHES + (index >= AREAS_PER_LAYER ? 1 : 0);
  for (let tries = 0; tries < 30 && branches.length < want; tries++) {
    const from = rng.int(1, path.length - 1 - BRANCH_SPAN[0]);
    const to = Math.min(path.length - 1, from + rng.int(...BRANCH_SPAN));
    if (branches.some((b) => from < b.to && to > b.from)) {
      continue;
    }
    const back = new Map<number, number>();
    const todo = near(path[from]).filter((k) => !carved.has(k));
    for (const k of todo) {
      back.set(k, path[from]);
    }
    let found = -1;
    for (let n = 0; n < todo.length && found < 0; n++) {
      const k = todo[n];
      if (near(k).includes(path[to])) {
        found = k;
        break;
      }
      for (const q of rng.shuffle(near(k))) {
        if (!carved.has(q) && !back.has(q)) {
          back.set(q, k);
          todo.push(q);
        }
      }
    }
    if (found < 0) {
      continue;
    }
    const cells: number[] = [];
    for (let k = found; k !== path[from]; k = back.get(k)!) {
      cells.unshift(k);
    }
    if (cells.length < 2) {
      continue;
    }
    join(path[to], cells[cells.length - 1]);
    let last = path[from];
    for (const k of cells) {
      join(last, k);
      last = k;
    }
    branches.push({ from, to, cells });
  }
  // The path's last cell opens on the hall.
  const door = path[path.length - 1];
  const [, doorRow] = cellOf(door);

  // A wall stands along every edge of a carved cell with no way through it,
  // kept low, so the party sees over them though not through them.
  const STEP = 0.9;
  const open = (p: number, q: number): boolean => ways.has(edge(p, q));
  // A cell's edge of wall blocks, from a corner, along x or along z
  const wall = (x: number, z: number, alongX: boolean): void => {
    for (let t = 0; t <= CELL + 0.01; t += STEP) {
      add('wall', alongX ? x + t : x, alongX ? z : z + t).seed = rng.random() * 0.2;
    }
  };
  for (let i = 0; i < hall; i++) {
    for (let j = 0; j < MAZE_ROWS; j++) {
      const k = key(i, j);
      const x0 = i * CELL;
      const z0 = j * CELL;
      const eastOf = i + 1 < hall ? key(i + 1, j) : -1;
      // The hall's side is walled all along but for the door.
      const onHall = eastOf < 0;
      const shutEast = onHall ? k !== door : !open(k, eastOf);
      if (shutEast && (onHall || carved.has(k) || carved.has(eastOf))) {
        wall(x0 + CELL, z0, false);
      }
      const southOf = j < MAZE_ROWS - 1 ? key(i, j + 1) : -1;
      if (southOf >= 0 && !open(k, southOf) && (carved.has(k) || carved.has(southOf))) {
        wall(x0, z0 + CELL, true);
      }
      // Uncarved ground holds a low heap of rubble, so it reads as no way.
      if (!carved.has(k)) {
        for (const [dx, dz] of RUBBLE) {
          add('wall', x0 + CELL / 2 + dx, z0 + CELL / 2 + dz).seed = rng.random() * 0.2;
        }
      }
    }
  }
  const middle = (k: number): Spot => {
    const [i, j] = cellOf(k);
    return { x: i * CELL + CELL / 2, z: j * CELL + CELL / 2 };
  };
  const used = new Set<number>(path.slice(0, MAZE_CLEAR));

  // The hall is reached from the entrance through these cells, with some
  // fallen in
  const hallReached = (fallen: ReadonlySet<number>): boolean => {
    const seen = new Set([path[0]]);
    const todo = [path[0]];
    for (let k = todo.pop(); k !== undefined; k = todo.pop()) {
      for (const q of near(k)) {
        if (open(k, q) && !seen.has(q) && !fallen.has(q)) {
          seen.add(q);
          todo.push(q);
        }
      }
    }
    return seen.has(door);
  };
  // The way a body runs through a cell: along x if it is open east or west
  const axisOf = (k: number): 'x' | 'z' => {
    const [i, j] = cellOf(k);
    const sideways = [key(i + 1, j), key(i - 1, j)].some((q) => i > 0 && open(k, q));
    return sideways || (i === 0 && open(k, key(1, j))) ? 'x' : 'z';
  };
  // The director's scale sets how many traps stand and how quick they are.
  const scale = plan.scale ?? 1;
  const kinds = index >= AREAS_PER_LAYER ? TRAPS_DEEP : TRAPS_SHALLOW;
  const pits = new Set<number>();
  const trap = (k: number): void => {
    let kind = rng.pick(kinds);
    // A floor falls in only where the hall can still be reached without it.
    if (kind === 'floor') {
      if (hallReached(new Set([...pits, k]))) {
        pits.add(k);
      } else {
        kind = 'spikes';
      }
    }
    used.add(k);
    const at = middle(k);
    const period = TRAP_PERIOD[kind] / scale;
    stage.hazards?.push({
      kind,
      x: at.x,
      z: at.z,
      period,
      phase: rng.range(0, period),
      axis: axisOf(k),
    });
  };
  // Spread along the path, in order along the flow
  const elite = plan.kind === 'elite';
  const count = Math.round((MAZE_TRAPS + Math.floor(index / 2) + (elite ? 3 : 0)) * scale);
  const room = path.length - MAZE_CLEAR;
  for (let n = 0; n < Math.min(count, room); n++) {
    const k = path[MAZE_CLEAR + Math.floor(((n + 0.5) * room) / Math.min(count, room))];
    if (!used.has(k)) {
      trap(k);
    }
  }
  // The first branch holds a chest behind a trap. The others are ways round
  // the path's traps, with one more trap on the stretch they skip.
  branches.forEach((b, n) => {
    if (n === 0) {
      const mid = b.cells[Math.floor(b.cells.length / 2)];
      const at = middle(mid);
      add('chest', at.x, at.z);
      used.add(mid);
      const guard = b.cells.find((k) => !used.has(k));
      if (guard !== undefined) {
        trap(guard);
      }
      return;
    }
    const skipped = path.slice(b.from + 1, b.to).find((k) => !used.has(k));
    if (skipped !== undefined) {
      trap(skipped);
    }
  });

  // A gate's bars along the edge between two cells
  const bars = (p: number, q: number): Prop[] => {
    const [i, j] = cellOf(p);
    const [a, b] = cellOf(q);
    const out: Prop[] = [];
    for (let t = STEP / 2; t < CELL; t += STEP) {
      const x = a === i ? i * CELL + t : Math.max(i, a) * CELL;
      const z = b === j ? j * CELL + t : Math.max(j, b) * CELL;
      out.push(add('gate', x, z));
    }
    return out;
  };
  stage.gates = [];
  // Inner gates across the path, outside every branch's span so none goes
  // round them, each with its lever on the path a little before it.
  const gates = index >= GATES_DEEP_FROM ? 2 : 1;
  const spans = (n: number): boolean => branches.some((b) => n >= b.from && n < b.to);
  const gated: number[] = [];
  for (let g = 0; g < gates; g++) {
    const lo = Math.floor((path.length * (g + 1)) / (gates + 2));
    const n = path
      .map((_, m) => m)
      .filter((m) => m > MAZE_CLEAR + 1 && m < path.length - 2 && !spans(m) && !gated.includes(m))
      .sort((x, y) => Math.abs(x - lo) - Math.abs(y - lo))
      .at(0);
    if (n !== undefined) {
      gated.push(n);
    }
  }
  for (const n of gated.sort((x, y) => x - y)) {
    const leverAt = path.slice(MAZE_CLEAR, n).findLast((k) => !used.has(k)) ?? path[n - 1];
    used.add(leverAt);
    const lever = middle(leverAt);
    stage.gates.push({ blocks: bars(path[n], path[n + 1]), lever: add('lever', lever.x, lever.z) });
  }
  // The hall's key lies on the way: in the longest way round, or two thirds
  // along the path. The hall's gate opens with it.
  const round = branches
    .slice(1)
    .sort((x, y) => y.cells.length - x.cells.length)
    .at(0);
  const keyCell =
    round?.cells.find((k) => !used.has(k)) ??
    path.slice(Math.floor(path.length * 0.66)).find((k) => !used.has(k)) ??
    path[path.length - 2];
  const at = middle(keyCell);
  add('key', at.x, at.z);
  stage.gates.push({ blocks: bars(door, key(hall, doorRow)) });
  return stage;
}
